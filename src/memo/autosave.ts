export type MemoSaveState = 'saved' | 'saving' | 'failed'

export interface MemoAutosave {
  schedule(value: string): void
  flush(): Promise<void>
  retry(): Promise<void>
}

export function createMemoAutosave(
  save: (value: string) => Promise<void>,
  onStateChange: (state: MemoSaveState) => void,
  delayMilliseconds = 250,
): MemoAutosave {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pendingSave: { value: string; generation: number } | undefined
  let failedValue: string | undefined
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
          failedValue = undefined
          onStateChange('saved')
        }
      } catch {
        if (generation === latestGeneration) {
          failedValue = value
          onStateChange('failed')
        }
      }
    })
    return saveChain
  }

  return {
    schedule(value) {
      pendingSave = { value, generation: ++latestGeneration }
      failedValue = undefined
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
      if (failedValue !== undefined) {
        pendingSave = { value: failedValue, generation: ++latestGeneration }
        failedValue = undefined
        onStateChange('saving')
      }
      return queuePendingSave()
    },
  }
}
