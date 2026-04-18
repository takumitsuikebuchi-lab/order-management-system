// @ts-check
// 受注管理システム 共通純関数ユーティリティ
// - DOM や運用中のグローバル変数（orders, currentMonth など）に依存しない純関数のみ
// - index.html 内のメイン <script> より前に読み込み、グローバル関数として公開する
// - 既存の inline onclick/onchange から直接呼ばれる前提のため、module 化しない

/**
 * ローカルID生成（UUID v4）。クラウド同期後は Supabase 側の UUID に上書きされる。
 * @returns {string} UUID v4 文字列
 */
function generateLocalId() {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch (_) {}
    // フォールバック: 旧ブラウザ用の簡易 UUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * HTML 特殊文字エスケープ（XSS 防止）
 * @param {unknown} s
 * @returns {string}
 */
function escHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 文字列を数値に。カンマ・通貨記号を除去。失敗時は 0。
 * @param {unknown} v
 * @returns {number}
 */
function toNumber(v) {
    if (v === null || v === undefined) return 0;
    const s = String(v).replace(/[^\d.-]/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
}

/**
 * ISO 風日付文字列を YYYY/MM/DD に整形。変換失敗時はそのまま返す。
 * @param {string|number|Date|null|undefined} isoLike
 * @returns {string}
 */
function fmtDate(isoLike) {
    if (!isoLike) return '';
    const d = new Date(isoLike);
    if (isNaN(d.getTime())) return String(isoLike);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}/${mm}/${dd}`;
}

/**
 * 一覧表示用の日付（MM/DD）
 * @param {string|number|Date} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}/${day}`;
}

/**
 * RFC 4180 準拠 CSV の1行パーサ（空フィールド・クォートエスケープ対応）
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
    const result = [];
    let i = 0, len = line.length;
    while (i <= len) {
        if (i === len) { result.push(''); break; }
        if (line[i] === '"') {
            let val = '';
            i++; // skip opening quote
            while (i < len) {
                if (line[i] === '"') {
                    if (i + 1 < len && line[i + 1] === '"') { val += '"'; i += 2; }
                    else { i++; break; }
                } else { val += line[i]; i++; }
            }
            result.push(val);
            if (i < len && line[i] === ',') i++; // skip comma
        } else {
            const next = line.indexOf(',', i);
            if (next === -1) { result.push(line.substring(i)); break; }
            result.push(line.substring(i, next));
            i = next + 1;
        }
    }
    return result;
}

/**
 * CSV フィールドクォート（ダブルクォートをエスケープ）
 * @param {unknown} v
 * @returns {string}
 */
function csvQ(v) {
    return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
}

/**
 * 検索用の文字列正規化: 半角/全角カナ・英数字の揺れを NFKC で吸収し小文字化
 * @param {unknown} s
 * @returns {string}
 */
function normalizeForSearch(s) {
    try {
        return String(s == null ? '' : s).normalize('NFKC').toLowerCase();
    } catch (_) {
        return String(s == null ? '' : s).toLowerCase();
    }
}
