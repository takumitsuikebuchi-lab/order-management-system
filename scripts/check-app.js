// CI と手元で使う静的チェック（node scripts/check-app.js）
// 1) cloud-config.json の形と、index.html の埋め込みフォールバック設定が一致していること
// 2) index.html のインライン <script> と utils.js が ES2019 までの構文で書かれていること
//    （?. や ?? などの ES2020 構文は古い事務所PCのブラウザで画面全体が動かなくなる。2026-03-13 の事故）
'use strict';
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const root = path.join(__dirname, '..');
const errors = [];

// ---- 1) 共有クラウド設定 ----
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'cloud-config.json'), 'utf8'));
if (!cfg.url || !cfg.anonKey || typeof cfg.enabled !== 'boolean') {
  errors.push('cloud-config.json の形が不正です（url / anonKey / enabled が必要）');
}
const KEY_PATTERN = /^(eyJ[A-Za-z0-9_\-.]{50,}|sb_publishable_[A-Za-z0-9_\-]{10,})$/;   // 旧形式 JWT / 新形式 publishable key
if (cfg.anonKey && !KEY_PATTERN.test(cfg.anonKey)) {
  errors.push('cloud-config.json の anonKey が想定外の形式です（eyJ... か sb_publishable_... のみ。sb_secret_ は絶対に入れない）');
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const emb = html.match(/EMBEDDED_SHARED_CLOUD_CONFIG\s*=\s*\{([\s\S]*?)\};/);
if (!emb) {
  errors.push('index.html に EMBEDDED_SHARED_CLOUD_CONFIG がありません');
} else {
  const block = emb[1];
  const url = (block.match(/url:\s*'([^']*)'/) || [])[1];
  const key = (block.match(/anonKey:\s*'([^']*)'/) || [])[1];
  const enabled = (block.match(/enabled:\s*(true|false)/) || [])[1];
  if (url !== cfg.url) errors.push('index.html の埋め込み url が cloud-config.json と一致しません');
  if (key !== cfg.anonKey) errors.push('index.html の埋め込み anonKey が cloud-config.json と一致しません');
  if ((enabled === 'true') !== cfg.enabled) errors.push('index.html の埋め込み enabled が cloud-config.json と一致しません');
}

// ---- 2) 構文（ES2019 まで） ----
const sources = [];
[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m, i) => {
  const line = html.slice(0, m.index).split('\n').length;
  sources.push({ name: `index.html の ${i + 1} 個目の <script>（${line} 行目から）`, code: m[1], lineOffset: line - 1 });
});
sources.push({ name: 'utils.js', code: fs.readFileSync(path.join(root, 'utils.js'), 'utf8'), lineOffset: 0 });
if (sources.length < 2) errors.push('index.html に <script> が見つかりません');
for (const src of sources) {
  try {
    acorn.parse(src.code, { ecmaVersion: 2019, sourceType: 'script' });
  } catch (e) {
    const line = e.loc ? e.loc.line + src.lineOffset : '?';
    errors.push(`${src.name}: ES2019 として読めません（${line} 行目付近: ${e.message}）。?. や ?? を使っていないか確認してください`);
  }
}

if (errors.length) {
  console.error(errors.map(e => '✗ ' + e).join('\n'));
  process.exit(1);
}
console.log(`OK: 共有クラウド設定と埋め込み設定が一致 / ${sources.length} 個のスクリプトが ES2019 で読めます`);
