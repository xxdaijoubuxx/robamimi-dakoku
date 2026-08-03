export type MemoSaveState = 'saved' | 'saving' | 'failed'

export interface MemoAutosave<Value> {
  schedule(value: Value): void
  flush(): Promise<void>
  retry(): Promise<void>
}

export function createMemoAutosave<Value>(
  save: (value: Value) => Promise<void>,
  onStateChange: (state: MemoSaveState) => void,
  delayMilliseconds = 250,
): MemoAutosave<Value> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pendingSave: { value: Value; generation: number } | undefined
  let failedSave: { value: Value } | undefined
  let latestGeneration = 0
  let saveChain = Promise.resolve()

  function clearTimer(): void {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  function queuePendingSave(): Promise<void> {
    clearTimer()
    if (pendingSave === undefined) {
      return saveChain
    }

    const { value, generation } = pendingSave
    pendingSave = undefined
    saveChain = saveChain.then(async () => {
      try {
        await save(value)
        if (generation === latestGeneration) {
          failedSave = undefined
          onStateChange('saved')
        }
      } catch {
        if (generation === latestGeneration) {
          failedSave = { value }
          onStateChange('failed')
        }
      }
    })
    return saveChain
  }

  return {
    schedule(value) {
      pendingSave = { value, generation: ++latestGeneration }
      failedSave = undefined
      onStateChange('saving')
      clearTimer()
      timer = setTimeout(() => {
        void queuePendingSave()
      }, delayMilliseconds)
    },
    flush() {
      return queuePendingSave()
    },
    retry() {
      if (failedSave !== undefined) {
        pendingSave = { value: failedSave.value, generation: ++latestGeneration }
        failedSave = undefined
        onStateChange('saving')
      }
      return queuePendingSave()
    },
  }
}
