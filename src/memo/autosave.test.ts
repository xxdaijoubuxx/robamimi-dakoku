import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoAutosave, type MemoSaveState } from './autosave'

afterEach(() => {
  vi.useRealTimers()
})

describe('メモ自動保存', () => {
  it('250ミリ秒入力が止まった後に保存する', async () => {
    vi.useFakeTimers()
    const save = vi.fn(async () => undefined)
    const states: MemoSaveState[] = []
    const autosave = createMemoAutosave(save, (state) => states.push(state))

    autosave.schedule('頭痛')
    await vi.advanceTimersByTimeAsync(249)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(save).toHaveBeenCalledWith('頭痛')
    expect(states).toEqual(['saving', 'saved'])
  })

  it('入力途中の予約をまとめ、最新の本文だけを保存する', async () => {
    vi.useFakeTimers()
    const save = vi.fn(async () => undefined)
    const autosave = createMemoAutosave(save, () => undefined)

    autosave.schedule('頭痛')
    await vi.advanceTimersByTimeAsync(100)
    autosave.schedule('頭痛がした')
    await vi.advanceTimersByTimeAsync(250)

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('頭痛がした')
  })

  it('画面離脱時は待ち時間なしで保存する', async () => {
    vi.useFakeTimers()
    const save = vi.fn(async () => undefined)
    const autosave = createMemoAutosave(save, () => undefined)

    autosave.schedule('すぐ保存')
    await autosave.flush()

    expect(save).toHaveBeenCalledWith('すぐ保存')
  })

  it('保存中に次の入力が始まったら、最新本文の完了まで保存済みにしない', async () => {
    vi.useFakeTimers()
    let finishFirstSave: (() => void) | undefined
    const save = vi.fn(
      (value: string) =>
        value === '頭痛'
          ? new Promise<void>((resolve) => {
              finishFirstSave = resolve
            })
          : Promise.resolve(),
    )
    const states: MemoSaveState[] = []
    const autosave = createMemoAutosave(save, (state) => states.push(state))

    autosave.schedule('頭痛')
    await vi.advanceTimersByTimeAsync(250)
    autosave.schedule('頭痛がした')
    finishFirstSave?.()
    await vi.advanceTimersByTimeAsync(250)
    await autosave.flush()

    expect(states).toEqual(['saving', 'saving', 'saved'])
    expect(save).toHaveBeenNthCalledWith(2, '頭痛がした')
  })

  it('失敗を未保存と表示し、同じ本文を再試行できる', async () => {
    vi.useFakeTimers()
    const save = vi.fn().mockRejectedValueOnce(new Error('test')).mockResolvedValueOnce(undefined)
    const states: MemoSaveState[] = []
    const autosave = createMemoAutosave(save, (state) => states.push(state))

    autosave.schedule('消さない')
    await vi.advanceTimersByTimeAsync(250)
    await autosave.retry()

    expect(save).toHaveBeenNthCalledWith(1, '消さない')
    expect(save).toHaveBeenNthCalledWith(2, '消さない')
    expect(states).toEqual(['saving', 'failed', 'saving', 'saved'])
  })
})
