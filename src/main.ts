import './style.css'
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { firebaseAuth } from './firebase/client'
import {
  draftFromRecord,
  localDateTimeToIso,
  type RecordDraft,
} from './history/editor'
import { groupHistoryEntries, historyDateLabel, historyTimeLabel } from './history/view'
import { isOwnerUid } from './firebase/owner'
import { isDailyUseConfigured } from './auth/device'
import { createMemoAutosave, type MemoSaveState } from './memo/autosave'
import {
  createPrototypeRecord,
  hasPreviousRecordWithin,
} from './prototype/database'
import { completedLaunchUrl, launchMode } from './prototype/launch'
import type { EntryKind } from './prototype/types'
import {
  getHistoryEntries,
  getAppSettings,
  getRecentlyDeletedRecords,
  getRecordConflict,
  getRecordById,
  restoreRecord,
  resolveRecordConflict,
  saveAuthenticatedOwner,
  softDeleteRecord,
  updateMemoBody,
  updateRecord,
  type RecordChanges,
} from './storage/database'
import type { HistoryEntry, RecordData, SyncStatus } from './storage/types'
import { uploadNewRecord } from './sync/upload'
import { syncPendingNewRecords } from './sync/run'

const BASE_URL = import.meta.env.BASE_URL

function requireAppElement(): HTMLElement {
  const element = document.querySelector<HTMLElement>('#app')
  if (!element) {
    throw new Error('アプリの表示領域が見つかりません。')
  }
  return element
}

const app = requireAppElement()

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    }
    return entities[character] ?? character
  })
}

function labelFor(kind: EntryKind): string {
  return { wake: '起床', sleep: '就寝', memo: 'メモ' }[kind]
}

function formatTime(isoDate: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate))
}

function currentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function savedActionMarkup(record: RecordData, hasRecentSameKind: boolean): string {
  const label = labelFor(record.kind)
  const duplicateMessage = hasRecentSameKind
    ? `<p class="duplicate-notice">直前にも${escapeHtml(label)}があります。</p>`
    : ''

  return `
    <section class="shell action-shell ${record.kind}" aria-labelledby="page-title">
      <p class="eyebrow">打刻完了</p>
      <h1 id="page-title">${escapeHtml(label)}</h1>
      <p class="result-time">${escapeHtml(formatTime(record.occurredAt))}</p>
      <div class="save-status" aria-live="polite">
        <p class="result-message success">✓ 端末に保存済み</p>
        <p class="sync-pending" data-sync-status>↻ 同期待ち</p>
      </div>
      ${duplicateMessage}
      <a class="secondary-link" href="${BASE_URL}history/">履歴を確認</a>
    </section>
  `
}

function startNewRecordUpload(record: RecordData): void {
  void uploadNewRecord(record).then((outcome) => {
    const status = app.querySelector<HTMLElement>('[data-sync-status]')
    if (!status) return
    const displays = {
      synced: '✓ 同期済み',
      pending: '↻ 同期待ち',
      failed: '⚠ 同期に失敗',
      'reauth-required': '⚠ 再ログインが必要',
    }
    status.textContent = displays[outcome]
    status.dataset.state = outcome
  }).catch((error: unknown) => {
    console.error('同期状態を端末内へ保存できませんでした。', error)
  })
}

function showMemoSaveState(state: MemoSaveState): void {
  const status = app.querySelector<HTMLElement>('[data-memo-save-status]')
  const retry = app.querySelector<HTMLButtonElement>('[data-memo-save-retry]')
  if (!status || !retry) {
    return
  }

  const display = {
    saved: '✓ 自動保存済み',
    saving: '… 保存中',
    failed: '⚠ 未保存',
  }[state]
  status.textContent = display
  status.dataset.state = state
  retry.hidden = state !== 'failed'
}

function renderMemo(record: RecordData): void {
  app.innerHTML = `
    <section class="shell memo-shell" aria-labelledby="page-title">
      <header class="memo-header">
        <h1 id="page-title">メモ</h1>
        <time datetime="${escapeHtml(record.occurredAt)}">${escapeHtml(formatTime(record.occurredAt))}</time>
      </header>
      <label class="visually-hidden" for="memo-body">任意のメモ</label>
      <textarea id="memo-body" class="memo-input" rows="7" placeholder="任意のメモ" autofocus>${escapeHtml(record.body)}</textarea>
      <div class="memo-status" aria-live="polite">
        <p data-memo-save-status data-state="saved">✓ 自動保存済み</p>
        <p class="sync-pending" data-sync-status>↻ 同期待ち</p>
      </div>
      <button class="primary-button" type="button" data-memo-save-retry hidden>保存を再試行</button>
      <a class="secondary-link" href="${BASE_URL}history/">履歴を確認</a>
    </section>
  `

  const textarea = app.querySelector<HTMLTextAreaElement>('#memo-body')
  const retry = app.querySelector<HTMLButtonElement>('[data-memo-save-retry]')
  if (!textarea || !retry) {
    throw new Error('メモ入力欄を初期化できません。')
  }

  const autosave = createMemoAutosave<string>(
    async (body) => {
      await updateMemoBody(record.id, body)
      startBackgroundSync()
    },
    showMemoSaveState,
  )
  let composing = false

  textarea.addEventListener('compositionstart', () => {
    composing = true
  })
  textarea.addEventListener('compositionend', () => {
    composing = false
    autosave.schedule(textarea.value)
  })
  textarea.addEventListener('input', () => {
    if (!composing) {
      autosave.schedule(textarea.value)
    }
  })
  textarea.addEventListener('blur', () => {
    void autosave.flush()
  })
  retry.addEventListener('click', () => {
    void autosave.retry()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void autosave.flush()
    }
  })
  window.addEventListener('pagehide', () => {
    void autosave.flush()
  })
  textarea.focus({ preventScroll: true })
}

async function renderSetup(authMessage = ''): Promise<void> {
  const auth = firebaseAuth()
  await auth.authStateReady()
  const user = auth.currentUser
  const owner = user ? isOwnerUid(user.uid) : false
  if (user && owner) {
    await saveAuthenticatedOwner(user.uid)
    try {
      await syncPendingNewRecords()
    } catch (error) {
      console.error('初回ログイン後のFirebase取得に失敗しました。', error)
    }
  }
  const settings = await getAppSettings()
  const trustedDevice = isDailyUseConfigured(settings)

  app.innerHTML = `
    <section class="shell setup-shell" aria-labelledby="page-title">
      <p class="eyebrow">${trustedDevice ? '設定済み端末' : '初回設定'}</p>
      <h1 id="page-title">ろばみみ打刻</h1>
      <p class="description">
        起床・就寝・メモをまずこの端末へ保存し、オンライン時に本人専用のFirebaseへ同期します。
        最初の一度だけ、Googleで本人確認します。
      </p>
      <ol class="setup-steps" aria-label="初回設定の進み具合">
        <li class="complete"><strong>使い方を確認</strong><span>端末保存を先に行い、圏外でも打刻します。</span></li>
        <li class="${trustedDevice ? 'complete' : 'current'}"><strong>Googleで本人確認</strong><span>${trustedDevice ? '✓ この端末は本人確認済みです。' : '本人の記録だけへ接続します。'}</span></li>
        <li><strong>オフライン準備</strong><span>次の画面で圏外起動を検査します。</span></li>
        <li><strong>ホーム画面へ追加</strong><span>起床・就寝・メモ・履歴の入口を作ります。</span></li>
      </ol>
      <section class="setup-auth" aria-labelledby="auth-title">
        <h2 id="auth-title">2. Googleで本人確認</h2>
        ${authMessage}
        ${
          user && owner
            ? `<p class="result-message success">✓ この端末を本人確認済みにしました</p>
               <p class="help">圏外でも端末内へ記録し、オンライン時に本人のFirebaseへ同期します。</p>
               <details><summary>本人UIDを確認</summary><code>${escapeHtml(user.uid)}</code><p class="help">UIDはパスワードではありません。</p></details>
               <button class="primary-button" type="button" data-sign-out>Googleからログアウト</button>
               <p class="help">ログアウトしても、この端末の記録と本人確認済み設定は消えません。</p>`
            : user
              ? `<p class="result-message">このGoogleアカウントは、ろばみみ打刻の本人として登録されていません。</p>
                 <button class="primary-button" type="button" data-sign-out>ログアウト</button>`
              : `${trustedDevice ? '<p class="result-message success">✓ この端末の本人確認済み設定は保持されています。</p><p class="help">Firebase同期を再開するには、同じGoogleアカウントでログインしてください。</p>' : ''}
                 <button class="primary-button" type="button" data-google-sign-in>${trustedDevice ? 'Googleへ再ログイン' : 'Googleで本人確認'}</button>`
        }
      </section>
      ${trustedDevice ? `<section class="setup-next" aria-labelledby="next-title"><h2 id="next-title">次の準備</h2>
        <nav class="entry-grid" aria-label="ホーム画面入口の準備">
          <a class="entry wake" href="${BASE_URL}wake/?install=1">起床を準備</a>
          <a class="entry sleep" href="${BASE_URL}sleep/?install=1">就寝を準備</a>
          <a class="entry memo" href="${BASE_URL}memo/?install=1">メモを準備</a>
          <a class="entry history" href="${BASE_URL}history/">履歴を見る</a>
        </nav><p class="help">本人確認前の端末では、打刻・履歴を開きません。</p></section>` : ''}
    </section>
  `

  app.querySelector<HTMLButtonElement>('[data-google-sign-in]')?.addEventListener('click', async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
      await renderSetup()
    } catch (error) {
      console.error(error)
      await renderSetup('<p class="result-message">Googleログインを完了できませんでした。もう一度お試しください。</p>')
    }
  })
  app.querySelector<HTMLButtonElement>('[data-sign-out]')?.addEventListener('click', async () => {
    await signOut(auth)
    await renderSetup()
  })
}

function renderSetupRequired(): void {
  app.innerHTML = `
    <section class="shell action-shell error" aria-labelledby="page-title">
      <p class="eyebrow">初回設定が必要です</p>
      <h1 id="page-title">まだ記録していません</h1>
      <p class="result-message">この端末は、ろばみみ打刻の本人確認が済んでいません。</p>
      <a class="primary-button" href="${BASE_URL}">初回設定を開く</a>
    </section>
  `
}

function renderInstallPreview(kind: EntryKind): void {
  const label = labelFor(kind)
  window.history.replaceState(null, '', `${BASE_URL}${kind}/#shortcut`)
  app.innerHTML = `
    <section class="shell action-shell ${kind}" aria-labelledby="page-title">
      <p class="eyebrow">ホーム画面へ追加する準備</p>
      <h1 id="page-title">${label}</h1>
      <p class="description">
        このページではまだ記録しません。Chromeのメニューから「ホーム画面に追加」、続いて
        「ショートカットを作成」を選び、ホーム画面名を「${label}」にしてください。
      </p>
      <a class="secondary-link" href="${BASE_URL}">設定入口へ戻る</a>
    </section>
  `
}

async function renderAction(kind: EntryKind): Promise<void> {
  const label = labelFor(kind)
  app.innerHTML = `
    <section class="shell action-shell ${kind}" aria-labelledby="page-title">
      <p class="eyebrow">端末内へ保存中</p>
      <h1 id="page-title">${label}</h1>
      <p class="result-time" aria-live="polite">--:--</p>
    </section>
  `

  try {
    const record = await createPrototypeRecord(kind)
    window.history.replaceState(null, '', completedLaunchUrl(BASE_URL, kind))
    if (kind === 'wake' || kind === 'sleep') {
      let hasRecentSameKind = false
      try {
        hasRecentSameKind = await hasPreviousRecordWithin(record, 5 * 60 * 1000)
      } catch (error) {
        console.error('連続打刻の確認に失敗しました。', error)
      }
      app.innerHTML = savedActionMarkup(record, hasRecentSameKind)
      startNewRecordUpload(record)
      return
    }
    renderMemo(record)
    startNewRecordUpload(record)
  } catch (error) {
    console.error(error)
    app.innerHTML = `
      <section class="shell action-shell error" aria-labelledby="page-title">
        <p class="eyebrow">保存失敗</p>
        <h1 id="page-title">記録できません</h1>
        <p class="result-message">端末内への保存に失敗しました。</p>
        <button class="primary-button" type="button" data-retry>もう一度</button>
      </section>
    `
    app.querySelector<HTMLButtonElement>('[data-retry]')?.addEventListener('click', () => {
      void renderAction(kind)
    })
  }
}

function renderCompletedReload(kind: EntryKind): void {
  const label = labelFor(kind)
  app.innerHTML = `
    <section class="shell action-shell ${kind}" aria-labelledby="page-title">
      <p class="eyebrow">記録済み画面</p>
      <h1 id="page-title">${label}</h1>
      <p class="result-message">この画面の再読み込みでは、新しい記録を追加しません。</p>
      <p class="help">次の打刻はホーム画面の「${label}」を押してください。</p>
      <a class="secondary-link" href="${BASE_URL}history/">履歴を確認</a>
    </section>
  `
}

function syncStatusMarkup(status: SyncStatus): string {
  const statuses: Record<SyncStatus, { label: string; className: string } | null> = {
    synced: null,
    pending: { label: '↻ 同期待ち', className: 'pending' },
    failed: { label: '⚠ 同期失敗', className: 'failed' },
    'reauth-required': { label: '⚠ 再ログインが必要', className: 'reauth-required' },
    conflict: { label: '⚠ 確認が必要', className: 'conflict' },
  }
  const display = statuses[status]
  return display
    ? `<span class="history-sync ${display.className}">${escapeHtml(display.label)}</span>`
    : ''
}

function historyRecordMarkup(entry: HistoryEntry): string {
  const { record, syncStatus } = entry
  const body = record.kind === 'memo' && record.body !== ''
    ? `<p class="history-body">${escapeHtml(record.body)}</p>`
    : ''

  return `
    <a class="history-record" href="${BASE_URL}history/?${syncStatus === 'conflict' ? 'conflict' : 'record'}=${encodeURIComponent(record.id)}">
      <time datetime="${escapeHtml(record.occurredAt)}">${escapeHtml(historyTimeLabel(record.occurredAt, record.timezone))}</time>
      <strong class="history-kind ${record.kind}">${escapeHtml(labelFor(record.kind))}</strong>
      ${syncStatusMarkup(syncStatus)}
      ${body}
    </a>
  `
}

function conflictVersionMarkup(title: string, record: RecordData): string {
  const body = record.kind === 'memo' ? record.body || '（空のメモ）' : '本文なし'
  return `<section class="conflict-version"><h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(labelFor(record.kind))}・${escapeHtml(historyDateLabel(record.occurredAt, record.timezone))}
    ${escapeHtml(historyTimeLabel(record.occurredAt, record.timezone))}</p>
    <p class="history-body">${escapeHtml(body)}</p><p class="help">変更版 ${record.revision}</p></section>`
}

async function renderConflict(recordId: string): Promise<void> {
  const conflict = await getRecordConflict(recordId)
  if (!conflict) {
    app.innerHTML = `<section class="shell"><h1>競合は解決済みです</h1><a class="secondary-link" href="${BASE_URL}history/">履歴へ戻る</a></section>`
    return
  }
  app.innerHTML = `<section class="shell conflict-shell" aria-labelledby="page-title">
    <p class="eyebrow">確認が必要な変更</p><h1 id="page-title">残す内容を選択</h1>
    <p class="description">端末とFirebaseの両方で変更されました。自動では上書きしていません。</p>
    <div class="conflict-versions">${conflictVersionMarkup('この端末の内容', conflict.local)}${conflictVersionMarkup('Firebaseの内容', conflict.remote)}</div>
    <button class="primary-button" type="button" data-resolve="local">この端末の内容を残す</button>
    <button class="secondary-button" type="button" data-resolve="remote">Firebaseの内容を残す</button>
    <a class="text-link" href="${BASE_URL}history/">今は選ばず履歴へ戻る</a></section>`
  for (const button of app.querySelectorAll<HTMLButtonElement>('[data-resolve]')) {
    button.addEventListener('click', async () => {
      const choice = button.dataset.resolve as 'local' | 'remote'
      const confirmed = window.confirm(`${choice === 'local' ? 'この端末' : 'Firebase'}の内容を残しますか？`)
      if (!confirmed) return
      await resolveRecordConflict(recordId, choice)
      if (choice === 'local') await syncPendingNewRecords()
      window.location.assign(`${BASE_URL}history/`)
    })
  }
}

function showEditorSaveState(state: MemoSaveState): void {
  const status = app.querySelector<HTMLElement>('[data-editor-save-status]')
  const retry = app.querySelector<HTMLButtonElement>('[data-editor-save-retry]')
  if (!status || !retry) {
    return
  }
  status.textContent = {
    saved: '✓ 自動保存済み',
    saving: '… 保存中',
    failed: '⚠ 未保存',
  }[state]
  status.dataset.state = state
  retry.hidden = state !== 'failed'
}

async function renderRecordEditor(recordId: string): Promise<void> {
  const record = await getRecordById(recordId)
  if (!record) {
    app.innerHTML = `
      <section class="shell" aria-labelledby="page-title">
        <p class="eyebrow">履歴編集</p>
        <h1 id="page-title">記録が見つかりません</h1>
        <a class="secondary-link" href="${BASE_URL}history/">履歴へ戻る</a>
      </section>
    `
    return
  }

  let lastSavedDraft = draftFromRecord(record)
  app.innerHTML = `
    <section class="shell editor-shell" aria-labelledby="page-title">
      <p class="eyebrow">履歴編集</p>
      <h1 id="page-title">記録を修正</h1>
      <div class="editor-field">
        <label for="record-kind">種類</label>
        <select id="record-kind">
          <option value="wake"${record.kind === 'wake' ? ' selected' : ''}>起床</option>
          <option value="sleep"${record.kind === 'sleep' ? ' selected' : ''}>就寝</option>
          <option value="memo"${record.kind === 'memo' ? ' selected' : ''}>メモ</option>
        </select>
      </div>
      <div class="editor-field">
        <label for="record-datetime">日時（この端末の現地時刻）</label>
        <input id="record-datetime" type="datetime-local" value="${escapeHtml(lastSavedDraft.localDateTime)}" required>
      </div>
      <div class="editor-field" data-editor-body-field${record.kind === 'memo' ? '' : ' hidden'}>
        <label for="record-body">本文</label>
        <textarea id="record-body" rows="7">${escapeHtml(record.body)}</textarea>
      </div>
      <div class="editor-save-status" aria-live="polite">
        <p data-editor-save-status data-state="saved">✓ 自動保存済み</p>
        <p class="sync-pending">↻ 同期待ち</p>
      </div>
      <button class="primary-button" type="button" data-editor-save-retry hidden>保存を再試行</button>
      <div class="editor-actions">
        <a class="secondary-link" href="${BASE_URL}history/">履歴へ戻る</a>
        <button class="danger-button" type="button" data-delete-record>この記録を削除</button>
      </div>
    </section>
  `

  const kindInput = app.querySelector<HTMLSelectElement>('#record-kind')
  const dateTimeInput = app.querySelector<HTMLInputElement>('#record-datetime')
  const bodyInput = app.querySelector<HTMLTextAreaElement>('#record-body')
  const bodyField = app.querySelector<HTMLElement>('[data-editor-body-field]')
  const retry = app.querySelector<HTMLButtonElement>('[data-editor-save-retry]')
  const deleteButton = app.querySelector<HTMLButtonElement>('[data-delete-record]')
  if (!kindInput || !dateTimeInput || !bodyInput || !bodyField || !retry || !deleteButton) {
    throw new Error('編集画面を初期化できません。')
  }

  function readDraft(): RecordDraft {
    const kind = kindInput?.value
    if (kind !== 'wake' && kind !== 'sleep' && kind !== 'memo') {
      throw new Error('記録の種類が不正です。')
    }
    return {
      kind,
      localDateTime: dateTimeInput?.value ?? '',
      body: kind === 'memo' ? (bodyInput?.value ?? '') : '',
    }
  }

  async function persistDraft(draft: RecordDraft): Promise<void> {
    const changes: RecordChanges = { kind: draft.kind, body: draft.body }
    if (draft.localDateTime !== lastSavedDraft.localDateTime) {
      changes.occurredAt = localDateTimeToIso(draft.localDateTime)
      changes.timezone = currentTimezone()
    }
    const updatedRecord = await updateRecord(recordId, changes)
    lastSavedDraft = draftFromRecord(updatedRecord)
  }

  const autosave = createMemoAutosave<RecordDraft>(persistDraft, showEditorSaveState)
  let composing = false

  kindInput.addEventListener('change', () => {
    const nextKind = kindInput.value
    if (nextKind !== 'memo' && bodyInput.value !== '') {
      const confirmed = window.confirm('種類を変更するとメモ本文は空になります。変更しますか？')
      if (!confirmed) {
        kindInput.value = 'memo'
        return
      }
      bodyInput.value = ''
    }
    bodyField.hidden = nextKind !== 'memo'
    autosave.schedule(readDraft())
    void autosave.flush()
  })
  dateTimeInput.addEventListener('input', () => {
    autosave.schedule(readDraft())
  })
  bodyInput.addEventListener('compositionstart', () => {
    composing = true
  })
  bodyInput.addEventListener('compositionend', () => {
    composing = false
    autosave.schedule(readDraft())
  })
  bodyInput.addEventListener('input', () => {
    if (!composing) {
      autosave.schedule(readDraft())
    }
  })
  for (const input of [dateTimeInput, bodyInput]) {
    input.addEventListener('blur', () => {
      void autosave.flush()
    })
  }
  retry.addEventListener('click', () => {
    void autosave.retry()
  })
  deleteButton.addEventListener('click', async () => {
    const confirmed = window.confirm('この記録を削除しますか？30日以内なら復元できます。')
    if (!confirmed) {
      return
    }
    deleteButton.disabled = true
    try {
      await autosave.flush()
      await persistDraft(readDraft())
      await softDeleteRecord(recordId)
      window.location.assign(`${BASE_URL}history/`)
    } catch (error) {
      console.error(error)
      deleteButton.disabled = false
      window.alert('端末内の保存に失敗したため、削除しませんでした。')
    }
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void autosave.flush()
    }
  })
  window.addEventListener('pagehide', () => {
    void autosave.flush()
  })
}

function deletedRecordMarkup(record: RecordData): string {
  const body = record.kind === 'memo' && record.body !== ''
    ? `<p class="history-body">${escapeHtml(record.body)}</p>`
    : ''
  return `
    <article class="deleted-record">
      <div class="deleted-record-main">
        <time datetime="${escapeHtml(record.occurredAt)}">
          ${escapeHtml(historyDateLabel(record.occurredAt, record.timezone))}
          ${escapeHtml(historyTimeLabel(record.occurredAt, record.timezone))}
        </time>
        <strong class="history-kind ${record.kind}">${escapeHtml(labelFor(record.kind))}</strong>
        ${body}
      </div>
      <button class="primary-button" type="button" data-restore-record="${escapeHtml(record.id)}">復元</button>
    </article>
  `
}

async function renderRecentlyDeleted(): Promise<void> {
  const records = await getRecentlyDeletedRecords()
  app.innerHTML = `
    <section class="shell deleted-shell" aria-labelledby="page-title">
      <p class="eyebrow">30日以内</p>
      <h1 id="page-title">最近削除した記録</h1>
      <p class="description">復元すると通常の履歴に戻り、同期待ちになります。</p>
      ${
        records.length > 0
          ? `<div class="deleted-records">${records.map(deletedRecordMarkup).join('')}</div>`
          : '<p class="empty-message">復元できる記録はありません。</p>'
      }
      <a class="secondary-link" href="${BASE_URL}history/">履歴へ戻る</a>
    </section>
  `

  for (const button of app.querySelectorAll<HTMLButtonElement>('[data-restore-record]')) {
    button.addEventListener('click', async () => {
      const recordId = button.dataset.restoreRecord
      if (!recordId) {
        return
      }
      button.disabled = true
      try {
        await restoreRecord(recordId)
        await renderRecentlyDeleted()
      } catch (error) {
        console.error(error)
        button.disabled = false
        window.alert('記録を復元できませんでした。')
      }
    })
  }
}

async function renderHistory(): Promise<void> {
  const entries = await getHistoryEntries()
  const groups = groupHistoryEntries(entries)
  app.innerHTML = `
    <section class="shell history-shell" aria-labelledby="page-title">
      <p class="eyebrow">端末内の記録</p>
      <h1 id="page-title">履歴</h1>
      ${
        groups.length > 0
          ? `<div class="history-groups">${groups
              .map(
                (group) => `
                  <section class="history-day" aria-labelledby="history-day-${escapeHtml(group.key)}">
                    <h2 id="history-day-${escapeHtml(group.key)}">${escapeHtml(group.label)}</h2>
                    <div class="history-day-records">${group.entries.map(historyRecordMarkup).join('')}</div>
                  </section>
                `,
              )
              .join('')}</div>`
          : '<p class="empty-message">まだ記録がありません。</p>'
      }
      <div class="history-actions">
        <button class="primary-button" type="button" data-sync-retry>同期を再試行</button>
        <a class="secondary-link" href="${BASE_URL}">設定入口へ戻る</a>
        <a class="text-link" href="${BASE_URL}history/?deleted=1">最近削除した記録</a>
      </div>
    </section>
  `

  app.querySelector<HTMLButtonElement>('[data-sync-retry]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement
    button.disabled = true
    button.textContent = '同期中…'
    await syncPendingNewRecords()
    await renderHistory()
  })
}

function startBackgroundSync(refreshHistory = false): void {
  void syncPendingNewRecords()
    .then(async (result) => {
      if (refreshHistory && result.total > 0) await renderHistory()
    })
    .catch((error: unknown) => console.error('自動同期を開始できませんでした。', error))
}

async function registerServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return
  }
  await navigator.serviceWorker.register(`${BASE_URL}sw.js`, { scope: BASE_URL })
}

async function start(): Promise<void> {
  await registerServiceWorker()
  const entry = document.body.dataset.entry

  if (entry === 'setup') {
    await renderSetup()
    return
  }

  const settings = await getAppSettings()
  if (!isDailyUseConfigured(settings)) {
    renderSetupRequired()
    return
  }
  if (entry === 'history') {
    const parameters = new URLSearchParams(window.location.search)
    const recordId = parameters.get('record')
    const conflictId = parameters.get('conflict')
    if (parameters.get('deleted') === '1') {
      await renderRecentlyDeleted()
    } else if (conflictId) {
      await renderConflict(conflictId)
    } else if (recordId) {
      await renderRecordEditor(recordId)
    } else {
      await renderHistory()
      startBackgroundSync(true)
    }
    return
  }
  if (entry === 'wake' || entry === 'sleep' || entry === 'memo') {
    startBackgroundSync()
    const mode = launchMode(window.location.search)
    if (mode === 'prepare') {
      renderInstallPreview(entry)
    } else if (mode === 'completed') {
      renderCompletedReload(entry)
    } else {
      await renderAction(entry)
    }
    return
  }

  throw new Error('不明な入口です。')
}

void start().catch((error: unknown) => {
  console.error(error)
  app.innerHTML = `
    <section class="shell action-shell error">
      <p class="eyebrow">起動失敗</p>
      <h1>画面を開けません</h1>
      <p class="result-message">アプリの起動中に問題が発生しました。</p>
    </section>
  `
})

window.addEventListener('online', () => {
  void getAppSettings().then((settings) => {
    if (isDailyUseConfigured(settings)) startBackgroundSync(document.body.dataset.entry === 'history')
  }).catch((error: unknown) => console.error('オンライン復帰時の同期を開始できませんでした。', error))
})
