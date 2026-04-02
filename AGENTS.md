# Order Management System — AI Maintenance Notes

> Claude Codeを使う場合は、同じリポジトリの `CLAUDE.md` も参照すること。
> `CLAUDE.md` にはClaude Code固有の指示（作業前の読込ファイル順・データ保護ルール・禁止事項）が書かれている。

## Current operating model

- Production URL: `https://takumitsuikebuchi-lab.github.io/order-management-system/`
- Default branch: `main`
- Runtime is a static site served from GitHub Pages.
- Shared cloud connection settings are stored in `cloud-config.json`.
- Current shared Supabase Project ID: `xrmczawpwpctbpuebddi`
- Current shared Supabase URL: `https://xrmczawpwpctbpuebddi.supabase.co`
- Browsers still keep `localStorage`, but day-to-day operation is designed to converge to the shared Supabase data.
- `index.html` also contains an embedded fallback cloud config so new browsers do not fail open if `cloud-config.json` is accidentally missing.

## Recent updates

### 2026-03-17

- GitHub default branch was changed to `main`.
- `main` and `master` were manually resynced to the same commit after an accidental revert.
- `.github/workflows/guard-and-sync.yml` was added so pushes to `main` verify the app and mirror the result to `master`.
- `index.html` keeps the shared cloud config loader and now also has an embedded fallback for safer startup if `cloud-config.json` is missing.

### 2026-03-18

- Periodic cloud refresh now preserves the current table filter state instead of snapping back to the full list.
- The order list search UI was simplified to one `顧客検索` field that supports both free-text input and datalist selection.
- Customer filter clearing is now done by the single right-side `クリア` button.
- Date filter clearing is labeled `日付解除` to distinguish it from customer filter clearing.

### 2026-04-01

- `CLAUDE.md` を新設。Claude Codeが改修前に読むべきファイル順・データ保護ルール・禁止事項を明記
- `.github/workflows/weekly-backup.yml` を追加。毎週水曜深夜0時（JST）に受注明細・顧客マスタをCSV出力し `backups/` フォルダへ自動保存
- `tasks/todo.md` を追加（タスク管理ログ）

### 2026-04-02

- 顧客マスタの「＋ 新規追加」で、追加直後は見えるがリロード後に消える不具合を修正
- 原因は、新規追加でも `cloudSaveCustomers()` により `customers` 全件を `DELETE → POST` していたこと
- `saveNewCustomer()` は全件保存をやめ、`cloudInsertCustomer()` で1件だけクラウドへ追加できたときだけ localStorage と画面へ反映するよう変更
- これにより、保存途中の一瞬の空状態や、POST失敗後のリロードで古い顧客一覧に戻る競合を避ける

### 2026-03-19

- Playwright-based UI smoke tests were added outside the app runtime so regression checks do not change production behavior.
- The GitHub Actions guard workflow now runs the UI smoke tests before mirroring `main` to `master`.
- The smoke suite now covers core order CRUD, filter persistence, month switching, dashboard stats, selected-order printing, CSV import/export, customer/simple master CSV flows, cloud queue recovery, and empty-master sync propagation.

## Important invariants

- `cloud-config.json` is the source of truth for Supabase URL / anon key / enabled flag.
- The embedded fallback in `index.html` is only a safety net; if `cloud-config.json` changes, update the embedded fallback too.
- In normal operation, the in-app cloud settings modal is locked when shared config is active.
- Temporary manual override is only for maintenance and requires `?manualCloudConfig=1`.
- Order data, customer master, and simple masters are expected to sync through Supabase across PCs and browsers.
- Empty master arrays are valid data and must propagate to other devices.
- Order editing includes lightweight conflict detection. If the same order was changed elsewhere, the save should warn and stop.

## Normal operations

- New PCs and browsers should just open the production URL.
- Confirm the top-right status becomes `接続: Cloud（同期完了）`.
- Do not reconfigure cloud settings from the UI during normal business use.

## Emergency maintenance

### If Supabase URL or anon key must be changed

1. Edit `cloud-config.json`
2. Commit and push to `main`
3. Wait for GitHub Pages to update
4. Hard reload browsers (`Ctrl+F5` on Windows, `Cmd+Shift+R` on Mac)

### If you must bypass the lock temporarily

- Open `index.html?manualCloudConfig=1`
- Change the cloud settings in the modal
- Use this only for diagnosis or temporary recovery
- Afterward, reflect the final correct values back into `cloud-config.json`

### If devices show different data

1. Check the top-right status label
2. If it is not `接続: Cloud（同期完了）`, investigate connectivity and shared config first
3. Hard reload the page
4. Confirm `cloud-config.json` still points at the intended Supabase project
5. If only one browser is wrong, inspect whether that session was manually overridden

## Files AI tools should read first

- `CLAUDE.md` — Claude Code固有の指示書（必ず最初に読む）
- `README.md`
- `AGENTS.md`（このファイル）
- `SETUP.md`
- `requirements.md`
- `RUNBOOK.md`
- `TEST_CHECKLIST.md`
- `tasks/lessons.md`
- `package.json`
- `tests/smoke.spec.js`
- `cloud-config.json`
- `index.html`

## Backup

- Weekly auto-backup is configured in `.github/workflows/weekly-backup.yml`
- Runs every Wednesday at 15:00 UTC (= midnight JST Thursday)
- Exports `orders` and `customers` tables as CSV to `backups/YYYY-MM-DD_受注明細.csv` and `backups/YYYY-MM-DD_顧客マスタ.csv`
- Manual trigger is available from GitHub Actions tab → "Weekly Backup" → "Run workflow"
- **Before any modification that touches order data, verify a recent backup exists in `backups/`**

## Known design decisions

- The app is intentionally single-file centered: most behavior lives in `index.html`.
- Supabase writes are guarded by retry / queue logic.
- Shared config was added to eliminate browser-by-browser drift.
- Cloud settings UI was intentionally restricted to reduce accidental local-only operation.
- `.github/workflows/guard-and-sync.yml` verifies `cloud-config.json` and mirrors `main` to `master` on push.
- The visible order list must not lose active filters just because a background cloud refresh ran.
- UI regression checks should stay external to the app runtime; prefer test files and workflow steps over diagnostic code inside `index.html`.
- CSV import must not silently duplicate an existing order when `orderNo` matches.
- Cloud write failures must preserve local data first and recover through the queue when connectivity returns.
- 顧客マスタの「＋ 新規追加」は全件保存を使わず、1件ずつ安全に追加する。ここを再び `DELETE → POST` に戻さない。
