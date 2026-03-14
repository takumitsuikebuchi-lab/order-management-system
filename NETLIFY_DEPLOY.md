# Netlify デプロイ手順

## 現在の位置づけ

このドキュメントは **旧運用メモ** です。
2026年3月時点の本番公開先は **GitHub Pages** であり、日常運用では Netlify は使用していません。

## 現在の本番公開先

- 本番URL: `https://takumitsuikebuchi-lab.github.io/order-management-system/`
- 反映元ブランチ: `main`
- 共有クラウド設定: `cloud-config.json`

## 現在の標準反映手順

1. `main` に変更を commit / push
2. GitHub Pages の反映を待つ
3. ブラウザをハードリロードする
4. 右上が `接続: Cloud（同期完了）` になることを確認する

## Netlify を使う場合

Netlify は現行の標準手順ではありません。
特別な検証や一時公開が必要な場合だけ、別環境として扱ってください。

その場合でも、以下は必須です。

- 本番と混同しない別URLで運用する
- `cloud-config.json` の向き先を意識する
- 本番運用の判断は GitHub Pages 側で確認する

## 参考

- 現行の保守手順は `SETUP.md`
- AI向けの運用前提は `AGENTS.md`
