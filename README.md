# 受注管理システム（きょうしん輸送）

運送業の受注明細を登録・管理する Web アプリ。受注の登録・一覧・印刷（運行指示書・引取書・月次レポート）・マネーフォワード請求書CSVの出力ができる。

| 項目 | 内容 |
|---|---|
| 誰向け | きょうしん輸送の事務担当（複数のPCで同じデータを共有して使う） |
| 状態 | Production（2025年10月から本番運用） |
| 本番URL | https://takumitsuikebuchi-lab.github.io/order-management-system/ |
| 技術構成 | 静的 HTML / CSS / JavaScript（`index.html` + `styles.css` + `utils.js`）＋ Supabase（PostgREST）。ビルド工程なし |
| 配信 | GitHub Pages（GitHub Actions でテストに合格したときだけ反映） |
| データ | Supabase の `orders` / `customers` / `simple_masters`。各端末のブラウザには直近13か月分の控えだけを置く |
| バックアップ | 毎日 0:00（日本時間）に全データを CSV で非公開リポジトリ [kyoshin-order-backups](https://github.com/takumitsuikebuchi-lab/kyoshin-order-backups) に保存 |

## 使い方（利用者）

本番URLを開くだけで使える。右上の表示が `接続: Cloud（同期完了）` になっていれば正常。
詳しい操作は `かんたん運用マニュアル.md`、困ったときは `RUNBOOK.md` を見る。

### 主な機能
- 受注の新規登録・編集・複製・削除（編集時は受注番号を変更できない）
- 絞り込み（顧客・日付・ドライバー・車両・並び順）と「🗑 すべてクリア」
- 月表示（既定）と「📚 全件表示」の切替
- 上部カード: 当月売上高（税込・税抜・消費税）、受注件数、本日・翌日の配送予定
- 印刷: 📄 運行指示書（選択分）、📋 引取書、📑 月次レポートPDF（巡回指導用・A4横）
- CSV: 当月の受注明細の出力、💰 請求書CSV（マネーフォワード用）、CSV取込（バックアップCSVも読める）
- マスタ: 顧客・積荷・荷姿・単位・ドライバー・車両
- 💾 CSV保存先フォルダ設定（Chrome / Edge のみ。他のブラウザは通常のダウンロードになる）

### 対応ブラウザ
Google Chrome・Microsoft Edge・Safari の最新版（Chrome 80 / Safari 14 相当以上）。

## 開発・保守（担当者・AI）

作業前に `CLAUDE.md` → `requirements.md` → `SETUP.md` → `tasks/lessons.md` を読む。

### 手元で動かす

```bash
python3 -m http.server 4173
```

ブラウザで `http://localhost:4173/` を開く。`cloud-config.json` が有効なので**本番のデータに接続される**。試しに保存すると本番に書き込まれるので注意。

### テスト

前提: Node.js 22 以上、python3（テスト用サーバーの起動に使う）。

```bash
npm ci
```

```bash
npx playwright install chromium
```

```bash
npm test
```

`npm test` は「共有クラウド設定の照合・構文チェック（`npm run check`）」と「Playwright の UI テスト（`npm run test:ui`）」を順に実行する。テストは偽の Supabase を使うので本番データには触れない。

### デプロイ

`main` に push するだけ。GitHub Actions（`.github/workflows/guard-and-sync.yml`）が「チェック → テスト → 合格したら GitHub Pages へ反映」を行う。テストに落ちたら本番は前の版のまま。
`styles.css` / `utils.js` を変えたら、`index.html` の読み込みタグの `?v=` 番号を必ず上げる（利用端末のキャッシュを更新させるため）。

### ファイル構成

```
order-management-system/
├── index.html                    # アプリ本体（画面と処理のほぼすべて）
├── styles.css                    # 見た目
├── utils.js                      # 画面に依存しない関数（税計算・日付・CSV・エラー判定など）
├── cloud-config.json             # 共有クラウド設定（Supabase の URL と公開キー）の正本
├── schema.sql                    # DB のテーブル定義
├── migrations/                   # DB への追加変更（日付順に実行）
├── scripts/check-app.js          # 設定の照合と構文チェック（npm run check）
├── tests/smoke.spec.js           # UI テスト（基本の操作）
├── tests/regression.spec.js      # UI テスト（2026-10-09 に直した不具合の再発防止）
├── package.json / playwright.config.js
├── .github/workflows/guard-and-sync.yml  # テスト → 本番反映
├── CLAUDE.md                     # 保守の指示書（AI 向け。まずここを読む）
├── requirements.md               # 壊してはいけない仕様
├── SETUP.md                      # 運用環境・設定・トラブル対応
├── RUNBOOK.md                    # 障害対応とバックアップからの復元手順
├── TEST_CHECKLIST.md             # 手動の動作確認
├── CHANGELOG.md                  # 変更履歴
├── かんたん運用マニュアル.md      # 利用者向けマニュアル
├── 運用マニュアル.html / システム全体像.html / 切替手順_方式A_A社.html  # 補足資料
├── AGENTS.md                     # 参照スタブ（内容は CLAUDE.md に統合済み）
└── tasks/                        # 作業ログ（todo.md）・教訓（lessons.md）・レビュー結果
```

## 注意点

- **このリポジトリは公開（Public）**。顧客名・住所・電話番号を含むファイル（バックアップCSV・アプリから出力したCSV）は絶対にコミットしない。`backups/` と `CSV保存/` は `.gitignore` 済み
- Supabase の接続キー（`cloud-config.json`）はブラウザから使う公開用のキー。データベース側は誰でも読み書きできる設定のため、強化策は `tasks/todo.md` の未対応項目を参照
- Supabase の旧形式キー（`eyJ...`）は 2026 年末までに廃止予定。アプリは新形式（`sb_publishable_...`）にも対応済み。切替手順は `SETUP.md`
- 本番データへの削除・一括変更は、必ず事前にバックアップ（kyoshin-order-backups）の存在を確認してから行う

**更新日**: 2026年10月9日
