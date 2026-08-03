import './style.css'
import { createPrototypeRecord, deleteAllPrototypeRecords, getPrototypeRecords } from './prototype/database'
import { completedLaunchUrl, launchMode } from './prototype/launch'
import type { EntryKind, PrototypeRecord } from './prototype/types'

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

function formatDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(isoDate))
}

function renderSetup(): void {
  app.innerHTML = `
    <section class="shell" aria-labelledby="page-title">
      <p class="eyebrow">最小試作</p>
      <h1 id="page-title">ろばみみ打刻</h1>
      <p class="description">
        四つの入口がAndroidのホーム画面で独立し、圏外でも同じ端末内データを使えるか確認します。
        Firebaseへの送信はまだ行いません。
      </p>
      <nav class="entry-grid" aria-label="試作入口">
        <a class="entry wake" href="${BASE_URL}wake/?install=1">起床を準備</a>
        <a class="entry sleep" href="${BASE_URL}sleep/?install=1">就寝を準備</a>
        <a class="entry memo" href="${BASE_URL}memo/?install=1">メモを準備</a>
        <a class="entry history" href="${BASE_URL}history/">履歴を見る</a>
      </nav>
      <p class="help">「準備」ページでは記録されません。Chromeから各ページをホーム画面へ追加します。</p>
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
    app.innerHTML = `
      <section class="shell action-shell ${kind}" aria-labelledby="page-title">
        <p class="eyebrow">端末内保存</p>
        <h1 id="page-title">${label}</h1>
        <p class="result-time">${escapeHtml(formatDateTime(record.occurredAt))}</p>
        <p class="result-message success" aria-live="polite">✓ 記録しました</p>
        <p class="help">Firebase同期はまだない最小試作です。</p>
        <a class="secondary-link" href="${BASE_URL}history/">履歴を確認</a>
      </section>
    `
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

function recordItem(record: PrototypeRecord): string {
  return `
    <li class="record-item">
      <strong>${escapeHtml(labelFor(record.kind))}</strong>
      <time datetime="${escapeHtml(record.occurredAt)}">${escapeHtml(formatDateTime(record.occurredAt))}</time>
      <code>${escapeHtml(record.id.slice(0, 8))}</code>
    </li>
  `
}

async function renderHistory(): Promise<void> {
  const records = await getPrototypeRecords()
  app.innerHTML = `
    <section class="shell" aria-labelledby="page-title">
      <p class="eyebrow">端末内データ</p>
      <h1 id="page-title">履歴</h1>
      <p class="description">Firebaseへは送られていない試作記録です。</p>
      ${
        records.length > 0
          ? `<ol class="record-list">${records.map(recordItem).join('')}</ol>`
          : '<p class="empty-message">まだ記録がありません。</p>'
      }
      <div class="history-actions">
        <a class="secondary-link" href="${BASE_URL}">設定入口へ戻る</a>
        ${records.length > 0 ? '<button class="danger-button" type="button" data-delete-all>試作記録を全削除</button>' : ''}
      </div>
    </section>
  `

  app.querySelector<HTMLButtonElement>('[data-delete-all]')?.addEventListener('click', async () => {
    if (!window.confirm('Firebase未同期の試作記録をすべて削除しますか？')) {
      return
    }
    await deleteAllPrototypeRecords()
    await renderHistory()
  })
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
    renderSetup()
    return
  }
  if (entry === 'history') {
    await renderHistory()
    return
  }
  if (entry === 'wake' || entry === 'sleep' || entry === 'memo') {
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
