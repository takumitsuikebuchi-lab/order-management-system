        // データストレージ
        let orders = [];
        let currentMonth = new Date();
        let editingId = null;
        let currentMasterType = null;
        let draggedItem = null;

        // 会社情報（きょうしん輸送株式会社のデフォルト値を設定）
        let companyInfo = {
            name: 'きょうしん輸送株式会社',
            address: '夕張郡栗山町字旭台23番地129',
            tel: '0123-76-9950'
        };

        // 顧客マスタ
        let customerMaster = [
            { name: '㈱北海道青果', address: '札幌市中央区南1条西5丁目', tel: '011-211-1111' },
            { name: '㈱札幌市場', address: '札幌市中央区北12条西20丁目', tel: '011-611-3111' },
            { name: '㈱道南物産', address: '函館市若松町9-19', tel: '0138-22-3333' },
            { name: '㈱北海道市場', address: '札幌市東区北9条東4丁目', tel: '011-711-2222' },
            { name: '㈱旭川青果', address: '旭川市流通団地1条2丁目', tel: '0166-48-1111' },
            { name: '㈱帯広市場', address: '帯広市西20条南1丁目', tel: '0155-33-3333' },
            { name: '㈱釧路水産', address: '釧路市新富士町6丁目', tel: '0154-51-2222' },
            { name: '㈱函館青果', address: '函館市西桔梗町589', tel: '0138-49-5555' },
            { name: 'JA北海道', address: '札幌市中央区北4条西1丁目', tel: '011-232-6000' },
            { name: 'JAさっぽろ', address: '札幌市中央区北10条西24丁目', tel: '011-621-1111' },
            { name: '堀田 淳一', address: '夕張郡栗山町鳩山４', tel: '0123-72-1234' },
            { name: 'JAそらち南栗山町馬鈴薯集出荷貯蔵センター', address: '夕張郡栗山町富士', tel: '0123-73-5678' },
            { name: 'JAそらち南本所販売部', address: '夕張郡栗山町角田165番地', tel: '0123-72-1468' }
        ];

        // その他のマスタデータ
        let cargoMaster = ['トマト', 'じゃがいも', '玉ねぎ', 'キャベツ', '人参', 'メロン', 'とうもろこし', 'かぼちゃ', 'いか', '鮭', 'ホタテ', '鮮魚', '冷凍食品', 'その他'];
        let packagingMaster = ['ダンボール', '10kg DB', '麻袋20kg', 'パレット', 'コンテナ', 'ビニール袋', '発泡スチロール', '木箱', 'プラスチックケース'];
        let unitMaster = ['ケース', '個', '袋', '箱', 'パレット', 'kg', '台'];

        // 仕様サマリ（挙動は変更しない定数化とユーティリティ集）
        const PRINT_DELAY_MS = 500;              // 印刷実行までの待機時間
        const MULTI_ORDERS_PER_PAGE = 4;         // 複数案件印刷時の1ページ当たり最大件数
        const MF_WITHHOLDING = '含まない';        // MF請求書CSVの源泉徴収指定
        const TAX_RATE_STR = '10%';              // MF請求書CSVの品目消費税率
        const CSV_CRLF = '\r\n';               // CSV改行コード（CRLF）
        const CSV_BOM  = '\uFEFF';              // CSV BOM（UTF-8）

        // CSV保存先（File System Access API で選択されたフォルダ）
        let exportBaseDirHandle = null;

        // IndexedDB helpers（ディレクトリハンドルをページ間で永続化）
        const _IDB_NAME = 'csv_settings', _IDB_STORE = 'handles', _IDB_KEY = 'exportBaseDir';
        function _openHandleIDB() {
            return new Promise((res, rej) => {
                const r = indexedDB.open(_IDB_NAME, 1);
                r.onupgradeneeded = e => e.target.result.createObjectStore(_IDB_STORE);
                r.onsuccess = e => res(e.target.result);
                r.onerror = e => rej(e.target.error);
            });
        }
        async function _saveDirHandle(handle) {
            try {
                const db = await _openHandleIDB();
                const tx = db.transaction(_IDB_STORE, 'readwrite');
                tx.objectStore(_IDB_STORE).put(handle, _IDB_KEY);
                await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
                db.close();
            } catch(e) {}
            // フォルダ名だけ localStorage に保存してページ読み込み時のチラつきを防ぐ
            try { localStorage.setItem('lastCsvDirName', handle.name); } catch(_) {}
        }
        async function _loadDirHandle() {
            try {
                const db = await _openHandleIDB();
                const handle = await new Promise((res, rej) => {
                    const r = db.transaction(_IDB_STORE, 'readonly').objectStore(_IDB_STORE).get(_IDB_KEY);
                    r.onsuccess = e => res(e.target.result || null);
                    r.onerror = e => rej(e.target.error);
                });
                db.close();
                return handle;
            } catch(e) { return null; }
        }
        function _updateCsvDirBtn() {
            const btn = document.getElementById('csvDirBtn');
            if (!btn) return;
            btn.textContent = exportBaseDirHandle
                ? `💾 ${exportBaseDirHandle.name}`
                : '💾 CSV保存先フォルダ設定';
        }

        async function chooseExportDir() {
            if (!window.showDirectoryPicker) {
                alert('このブラウザはフォルダ保存に未対応です。Chrome/Edge等をご利用ください。\n（未対応の場合は通常のダウンロードで保存します）');
                return;
            }
            // 既存ハンドルを復元して startIn に渡す（前回のフォルダが選択済み状態で開く）
            if (!exportBaseDirHandle) exportBaseDirHandle = await _loadDirHandle();
            try {
                const opts = { mode: 'readwrite' };
                if (exportBaseDirHandle) opts.startIn = exportBaseDirHandle;
                exportBaseDirHandle = await window.showDirectoryPicker(opts);
                await _saveDirHandle(exportBaseDirHandle);
                _updateCsvDirBtn();
                alert('CSV保存先フォルダを設定しました。今後はサブフォルダへ自動保存します。');
            } catch (e) {
                // キャンセル時は何もしない
            }
        }

        async function saveCsvToDir(blob, filename, subfolderName) {
            // ハンドルが未設定なら IndexedDB から復元
            if (!exportBaseDirHandle) {
                exportBaseDirHandle = await _loadDirHandle();
                _updateCsvDirBtn();
            }
            if (!exportBaseDirHandle) return false;
            // パーミッションを確認・再取得（ユーザー操作後なのでダイアログ不要）
            try {
                const perm = await exportBaseDirHandle.queryPermission({ mode: 'readwrite' });
                if (perm !== 'granted') {
                    const req = await exportBaseDirHandle.requestPermission({ mode: 'readwrite' });
                    if (req !== 'granted') return false;
                }
            } catch(e) {
                exportBaseDirHandle = null;
                _updateCsvDirBtn();
                return false;
            }
            try {
                const targetDir = subfolderName ? await exportBaseDirHandle.getDirectoryHandle(subfolderName, { create: true }) : exportBaseDirHandle;
                const fileHandle = await targetDir.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                return true;
            } catch (err) {
                console.error('CSV保存に失敗:', err);
                return false;
            }
        }

        // HTML特殊文字エスケープ（XSS防止）
        function escHtml(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function toNumber(v) {
            if (v === null || v === undefined) return 0;
            const s = String(v).replace(/[^\d.-]/g, '');
            const n = Number(s);
            return Number.isFinite(n) ? n : 0;
        }

        function fmtDate(isoLike) {
            if (!isoLike) return '';
            const d = new Date(isoLike);
            if (isNaN(d)) return String(isoLike);
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${d.getFullYear()}/${mm}/${dd}`;
        }
        // RFC 4180準拠 CSVパーサー（空フィールド・クォートエスケープ対応）
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

        // CSVフィールドクォート（ダブルクォートをエスケープ）
        function csvQ(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }

        let driverMaster = ['混載流通', '門脇悟大', '道管サービス', '佐川急便', '山田太郎', '鈴木次郎', '田中三郎', '渡辺流雅'];
        let vehicleMaster = ['札幌100あ12-34', '札幌300み22-33', '札幌400す11-22', '札幌500な33-44', '帯広500た56-78', '旭川400す11-22', '函館300ら90-12', '函館400て99-00', '釧路100あ77-88', '85-82 日野大型車'];

        // ホバー追跡（Chrome拡張がクリックをブロックする場合のアクションバー操作用）
        let hoveredOrderId = null;

        // 初期化
        // ============================================================
        // 拡張機能オーバーレイ対策: DOMContentLoaded より前に登録
        // elementsFromPoint でオーバーレイを透かして下のボタンを探す
        // ============================================================
        document.addEventListener('click', function(e) {
            // ▼▼▼ 診断ログ（編集ボタンを押したときコンソールに表示されるか確認）
            var tgt = e.target;
            if (tgt && (tgt.tagName === 'BUTTON' || tgt.tagName === 'A' ||
                        (tgt.parentElement && (tgt.parentElement.tagName === 'BUTTON' || tgt.parentElement.tagName === 'A')))) {
                console.warn('[DBG-CLICK] click on/near button/a. target=' + tgt.tagName + ' class=' + tgt.className);
            }
            var els = document.elementsFromPoint(e.clientX, e.clientY);
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                // テーブル行のボタン（<button>または<a role="button">）
                if ((el.tagName === 'BUTTON' || el.tagName === 'A') && el.getAttribute('data-action')) {
                    var action = el.getAttribute('data-action');
                    console.warn('[DBG-CLICK] data-action button found: action=' + action);
                    var tr = el.closest('tr[data-order-id]');
                    if (tr) {
                        var rowId = Number(tr.getAttribute('data-order-id'));
                        if (!isNaN(rowId)) {
                            if (action === 'edit')      { editOrder(rowId, el); break; }
                            if (action === 'duplicate') { duplicateOrder(rowId, el); break; }
                            if (action === 'delete')    { deleteOrder(rowId); break; }
                        }
                    }
                    // 顧客マスタ削除
                    if (action === 'delete-customer') {
                        var idx = parseInt(el.getAttribute('data-index'));
                        if (!isNaN(idx)) { deleteCustomer(idx); break; }
                    }
                    // シンプルマスタ削除
                    if (action === 'delete-master-item') {
                        var idx2 = parseInt(el.getAttribute('data-index'));
                        if (!isNaN(idx2)) { deleteSimpleMasterItem(idx2); break; }
                    }
                }
            }
        }, true); // CAPTURE フェーズで登録（拡張機能より先に実行）

        // mousedown 診断ログ（click がブロックされても mousedown は届くか確認）
        document.addEventListener('mousedown', function(e) {
            var tgt = e.target;
            if (tgt && (tgt.tagName === 'BUTTON' || tgt.tagName === 'A' ||
                        (tgt.parentElement && (tgt.parentElement.tagName === 'BUTTON' || tgt.parentElement.tagName === 'A')))) {
                console.warn('[DBG-MDOWN] mousedown target=' + tgt.tagName + ' class=' + tgt.className);
            }
            // mousedown でもボタン操作を試みる（<a>タグ対応）
            var els = document.elementsFromPoint(e.clientX, e.clientY);
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                if ((el.tagName === 'BUTTON' || el.tagName === 'A') && el.getAttribute('data-action')) {
                    var action = el.getAttribute('data-action');
                    var tr = el.closest('tr[data-order-id]');
                    if (tr) {
                        var rowId = Number(tr.getAttribute('data-order-id'));
                        if (!isNaN(rowId)) {
                            if (action === 'edit')      { e.preventDefault(); editOrder(rowId, el); break; }
                            if (action === 'duplicate') { e.preventDefault(); duplicateOrder(rowId, el); break; }
                            if (action === 'delete')    { e.preventDefault(); deleteOrder(rowId); break; }
                        }
                    }
                }
            }
        }, true);

        // mouseover でテーブル行のホバーを追跡（クリックがブロックされても動作する）
        document.addEventListener('mouseover', function(e) {
            var tgt = e.target;
            var tr = tgt && typeof tgt.closest === 'function'
                ? tgt.closest('#tableBody tr[data-order-id]')
                : null;
            if (tr) {
                var newId = Number(tr.getAttribute('data-order-id'));
                if (!isNaN(newId) && newId !== hoveredOrderId) {
                    hoveredOrderId = newId;
                    updateRowActionBar();
                }
            }
        }, true);

        document.addEventListener('DOMContentLoaded', function() {
            // 初回起動チェック：セットアップ未完了ならウィザードへリダイレクト
            const setupCompleted = localStorage.getItem('setupCompleted');
            if (!setupCompleted) {
                window.location.href = 'setup-wizard.html';
                return;
            }
            
            // 現在の月を設定
            currentMonth = new Date();
            currentMonth.setDate(1); // 月の1日に設定
            
            // クラウド設定読み込み＆ステータス表示
            loadCloudConfig();
            updateCloudStatusUI();

            loadData();
            loadMasters();
            rebuildColorMapFor('driver', driverMaster);
            updateMonth();
            updateTodayDate();
            renderTable();
            updateStats();
            setupFilters();
            updateSelectOptions();
            
            // クラウドが有効なら最新データを取得して画面を更新
            if (cloudEnabled()) {
                // マスタデータを読み込む
                loadMastersFromCloud().then(() => {
                    // 案件データを読み込む
                    return cloudFetchOrders();
                }).then(fetched => {
                    if (Array.isArray(fetched) && fetched.length > 0) {
                        orders = fetched.map(row => normalizeOrderRow(row));
                        // ID欠損の受注に一意なIDを補完
                        const base = Date.now();
                        orders.forEach((o, idx) => {
                            if (o.id === undefined || o.id === null || o.id === '') {
                                o.id = base + idx;
                            }
                        });
                        saveData();
                        renderTable();
                        updateStats();
                        setupFilters();
                        updateCloudStatusUI(true);
                    }
                }).catch(err => {
                    console.warn('クラウド読み込み失敗:', err);
                    updateCloudStatusUI(false);
                });
            }
            
            
            // 1分ごとに日付を更新
            setInterval(updateTodayDate, 60000);

            // CSV保存先フォルダをIndexedDBから復元してボタンに反映
            // ① localStorage のフォルダ名ヒントで即時表示（チラつき防止）
            try {
                const hint = localStorage.getItem('lastCsvDirName');
                if (hint) { const b = document.getElementById('csvDirBtn'); if (b) b.textContent = `💾 ${hint}`; }
            } catch(_) {}
            // ② IndexedDB からハンドルを非同期復元して正式更新
            _loadDirHandle().then(h => { if (h) { exportBaseDirHandle = h; _updateCsvDirBtn(); } }).catch(()=>{});

            // クリックイベントでオートコンプリートを閉じる
            document.addEventListener('click', function(e) {
                if (!e.target.closest('.autocomplete-wrapper')) {
                    document.querySelectorAll('.autocomplete-list').forEach(list => {
                        list.classList.remove('active');
                    });
                }
            });

            // === イベントデリゲーション: テーブル本体 ===
            // inline onclick/onchange を使わず addEventListener で処理する
            // （Chrome拡張やCSPによるinline handler無効化を回避）
            var tableBody = document.getElementById('tableBody');
            if (tableBody) {
                // ボタンクリック（編集・複製・削除）
                tableBody.addEventListener('click', function(e) {
                    var btn = e.target.closest('[data-action]');
                    if (!btn || btn.tagName === 'INPUT') return; // input は change で処理
                    var tr = btn.closest('tr');
                    if (!tr) return;
                    var orderId = Number(tr.getAttribute('data-order-id'));
                    if (isNaN(orderId)) return;
                    var action = btn.getAttribute('data-action');
                    if (action === 'edit') editOrder(orderId, btn);
                    else if (action === 'duplicate') duplicateOrder(orderId, btn);
                    else if (action === 'delete') deleteOrder(orderId);
                });
                // チェックボックス変更（選択・請求書・入金）
                tableBody.addEventListener('change', function(e) {
                    var el = e.target;
                    if (el.classList.contains('order-checkbox')) {
                        updateRowSelection();
                        return;
                    }
                    var action = el.getAttribute('data-action');
                    if (!action) return;
                    var tr = el.closest('tr');
                    if (!tr) return;
                    var orderId = Number(tr.getAttribute('data-order-id'));
                    if (isNaN(orderId)) return;
                    if (action === 'toggle-invoice') toggleInvoice(orderId);
                    else if (action === 'toggle-payment') togglePayment(orderId);
                });
            }

            // === イベントデリゲーション: 顧客マスタモーダル ===
            var customerBody = document.getElementById('customerMasterBody');
            if (customerBody) {
                customerBody.addEventListener('click', function(e) {
                    var btn = e.target.closest('button[data-action="delete-customer"]');
                    if (!btn) return;
                    var idx = parseInt(btn.getAttribute('data-index'));
                    if (!isNaN(idx)) deleteCustomer(idx);
                });
            }

            // === イベントデリゲーション: シンプルマスタモーダル ===
            var masterList = document.getElementById('simpleMasterList');
            if (masterList) {
                masterList.addEventListener('click', function(e) {
                    var btn = e.target.closest('button[data-action="delete-master-item"]');
                    if (!btn) return;
                    var idx = parseInt(btn.getAttribute('data-index'));
                    if (!isNaN(idx)) deleteSimpleMasterItem(idx);
                });
            }
        });

        // CSV形式選択モーダル（confirm()の代替 — OKが社内用になる誤解を防ぐ）
        function showCsvFormatDialog() {
            return new Promise(resolve => {
                const overlay = document.createElement('div');
                overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
                overlay.innerHTML = `
                    <div style="background:#fff;border-radius:10px;padding:28px 24px;min-width:300px;box-shadow:0 8px 32px rgba(0,0,0,.25);">
                        <h3 style="margin:0 0 18px;font-size:16px;font-weight:bold;">📊 CSV形式を選択</h3>
                        <button id="_csvFmt_internal" style="display:block;width:100%;padding:12px;margin-bottom:10px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:bold;">📋 社内用形式（通常使用）</button>
                        <button id="_csvFmt_supabase" style="display:block;width:100%;padding:12px;margin-bottom:10px;background:#10b981;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:bold;">☁️ Supabase形式（インポート用）</button>
                        <button id="_csvFmt_cancel" style="display:block;width:100%;padding:10px;background:#f3f4f6;color:#6b7280;border:none;border-radius:6px;cursor:pointer;font-size:14px;">キャンセル</button>
                    </div>`;
                document.body.appendChild(overlay);
                overlay.querySelector('#_csvFmt_internal').onclick  = () => { overlay.remove(); resolve('internal'); };
                overlay.querySelector('#_csvFmt_supabase').onclick  = () => { overlay.remove(); resolve('supabase'); };
                overlay.querySelector('#_csvFmt_cancel').onclick    = () => { overlay.remove(); resolve(null); };
                overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
            });
        }

        // 今日の日付を更新
        function updateTodayDate() {
            const today = new Date();
            const days = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
            const month = today.getMonth() + 1;
            const date = today.getDate();
            const day = days[today.getDay()];
            document.getElementById('todayDate').textContent = `${month}/${date} ${day}`;
        }

        // マスタフィルタリング
        function filterMaster(keyword, type) {
            const listId = type === 'customer' ? 'customerAutocomplete' : 
                          type === 'pickup' ? 'pickupAutocomplete' : 'deliveryAutocomplete';
            const list = document.getElementById(listId);
            
            if (!keyword) {
                list.classList.remove('active');
                return;
            }
            
            const filtered = customerMaster.filter(item => 
                item.name.toLowerCase().includes(keyword.toLowerCase())
            );
            
            if (filtered.length > 0) {
                list.innerHTML = '';
                filtered.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'autocomplete-item';
                    div.textContent = item.name;
                    div.addEventListener('click', () => selectMasterItem(item.name, type));
                    list.appendChild(div);
                });
                list.classList.add('active');
            } else {
                list.classList.remove('active');
            }
        }

        // マスタアイテム選択
        function selectMasterItem(name, type) {
            const selectedItem = customerMaster.find(item => item.name === name);
            
            if (type === 'customer') {
                document.getElementById('customerName').value = name;
                document.getElementById('customerAutocomplete').classList.remove('active');
            } else if (type === 'pickup') {
                document.getElementById('pickupLocation').value = name;
                document.getElementById('pickupAutocomplete').classList.remove('active');
                if (selectedItem) {
                    document.getElementById('pickupAddress').value = selectedItem.address;
                }
            } else if (type === 'delivery') {
                document.getElementById('deliveryLocation').value = name;
                document.getElementById('deliveryAutocomplete').classList.remove('active');
                if (selectedItem) {
                    document.getElementById('deliveryAddress').value = selectedItem.address;
                    document.getElementById('deliveryTel').value = selectedItem.tel;
                }
            }
        }

        // チェックボックス選択時の行色変更
        function updateRowSelection() {
            const rows = document.querySelectorAll('#tableBody tr');
            rows.forEach(row => {
                const checkbox = row.querySelector('.checkbox');
                if (checkbox && checkbox.checked) {
                    row.classList.add('row-selected');
                } else {
                    row.classList.remove('row-selected');
                }
            });
        }

        // アクションバーのホバー行操作パネルを更新
        function updateRowActionBar() {
            var bar   = document.getElementById('rowActionBar');
            var label = document.getElementById('hoveredOrderLabel');
            if (!bar || !label) return;
            if (!hoveredOrderId) { bar.style.display = 'none'; return; }
            var order = orders.find(function(o) { return o.id === hoveredOrderId; });
            if (!order) { bar.style.display = 'none'; return; }
            bar.style.display = 'flex';
            var dateStr = '';
            try { dateStr = ' (' + formatDate(order.date) + ')'; } catch(_) {}
            label.textContent = (order.orderNo || '') + '　' + (order.customerName || '') + dateStr;
        }

        // アクションバー経由の操作（Chrome拡張がクリックをブロックする場合のバックアップ）
        function editHoveredOrder() {
            if (!hoveredOrderId) { showToast('受注表の行にマウスを合わせてから操作してください', 'error'); return; }
            editOrder(hoveredOrderId, null);
        }
        function duplicateHoveredOrder() {
            if (!hoveredOrderId) { showToast('受注表の行にマウスを合わせてから操作してください', 'error'); return; }
            duplicateOrder(hoveredOrderId, null);
        }
        function deleteHoveredOrder() {
            if (!hoveredOrderId) { showToast('受注表の行にマウスを合わせてから操作してください', 'error'); return; }
            deleteOrder(hoveredOrderId);
        }

        // データ読み込み
        function loadData() {
            const saved = localStorage.getItem('orders');
            if (saved) {
                orders = JSON.parse(saved);
                // ID欠損の補完（CSV取込や旧データ対策）
                let changed = false;
                orders.forEach((o, idx) => {
                    if (o.id === undefined || o.id === null || o.id === '') {
                        o.id = Date.now() + idx;
                        changed = true;
                    }
                });
                if (changed) saveData();
            } else {
                // サンプルデータ
                orders = [
                    {
                        id: 1, orderNo: 'R240901-001', date: '2024-09-01',
                        customerName: '㈱北海道青果', pickupLocation: '札幌市場',
                        pickupAddress: '札幌市中央区北12条西20丁目', deliveryLocation: '旭川市場',
                        deliveryAddress: '旭川市永山2条5丁目', deliveryTel: '0166-48-2311',
                        cargo: 'トマト', quantity: 150, unit: 'ケース', packaging: 'ダンボール',
                        unitPrice: 120, amountNet: 18000, amountGross: 19800,
                        instructions: '※冷蔵輸送必須\n※8時～10時到着厳守', driver: '混載流通',
                        vehicle: '札幌100あ12-34', instructionSheet: false, invoiceSent: false, paymentReceived: false, orderCompleted: false
                    },
                    {
                        id: 2, orderNo: 'R240902-001', date: '2024-09-02',
                        customerName: '㈱札幌市場', pickupLocation: '帯広市場',
                        pickupAddress: '帯広市西20条南1丁目', deliveryLocation: '札幌中央市場',
                        deliveryAddress: '札幌市中央区北12条', deliveryTel: '011-611-3111',
                        cargo: 'じゃがいも', quantity: 200, unit: '袋', packaging: '麻袋20kg',
                        unitPrice: 85, amountNet: 17000, amountGross: 18700,
                        instructions: '※午前中配送\n※フォークリフト荷降ろし', driver: '門脇悟大',
                        vehicle: '帯広500た56-78', instructionSheet: true, invoiceSent: false, paymentReceived: false, orderCompleted: false
                    },
                    {
                        id: 3, orderNo: 'ROW7', date: '2025-09-03',
                        customerName: 'JAそらち南本所販売部', pickupLocation: '堀田 淳一',
                        pickupAddress: '夕張郡栗山町鳩山４', deliveryLocation: 'JAそらち南栗山町馬鈴薯集出荷貯蔵センター',
                        deliveryAddress: '夕張郡栗山町富士', deliveryTel: '0123-73-5678',
                        cargo: 'かぼちゃ', quantity: 368, unit: 'ケース', packaging: '10kg DB',
                        unitPrice: 95, amountNet: 34960, amountGross: 38456,
                        instructions: '※集荷時ケース数異なる場合有', driver: '渡辺流雅',
                        vehicle: '85-82 日野大型車', instructionSheet: false, invoiceSent: false, paymentReceived: false, orderCompleted: false
                    }
                ];
            }
        }

        // マスタデータ読み込み
        function loadMasters() {
            const savedCustomers = localStorage.getItem('customerMaster');
            if (savedCustomers) customerMaster = JSON.parse(savedCustomers);
            
            const savedCargo = localStorage.getItem('cargoMaster');
            if (savedCargo) cargoMaster = JSON.parse(savedCargo);
            
            const savedPackaging = localStorage.getItem('packagingMaster');
            if (savedPackaging) packagingMaster = JSON.parse(savedPackaging);
            
            const savedUnit = localStorage.getItem('unitMaster');
            if (savedUnit) unitMaster = JSON.parse(savedUnit);
            
            const savedDriver = localStorage.getItem('driverMaster');
            if (savedDriver) driverMaster = JSON.parse(savedDriver);
            
            const savedVehicle = localStorage.getItem('vehicleMaster');
            if (savedVehicle) vehicleMaster = JSON.parse(savedVehicle);
        }

        // データ保存
        function saveData() {
            localStorage.setItem('orders', JSON.stringify(orders));
        }

        // ====== クラウド（Supabase）関連ユーティリティ ======
        let cloudConfig = { url: '', anonKey: '', enabled: false };

        function loadCloudConfig() {
            try {
                const saved = localStorage.getItem('cloudConfig');
                if (saved) {
                    cloudConfig = JSON.parse(saved) || cloudConfig;
                }
            } catch(e) { /* noop */ }
            return cloudConfig;
        }

        function saveCloudConfig(cfg) {
            cloudConfig = { ...cloudConfig, ...cfg };
            localStorage.setItem('cloudConfig', JSON.stringify(cloudConfig));
        }

        function cloudEnabled() {
            return !!(cloudConfig && cloudConfig.enabled && cloudConfig.url && cloudConfig.anonKey);
        }

        function getSupabaseBase() {
            return (cloudConfig.url || '').replace(/\/$/, '') + '/rest/v1';
        }

        function supabaseHeaders() {
            return {
                'Content-Type': 'application/json',
                'apikey': cloudConfig.anonKey,
                'Authorization': 'Bearer ' + cloudConfig.anonKey,
                'Prefer': 'return=representation, resolution=merge-duplicates'
            };
        }

        // ネットワーク＆フェッチ安定化ラッパー
        function isOnline() {
            try { return navigator.onLine !== false; } catch(_) { return true; }
        }
        async function cloudFetchRetry(url, options = {}, opts = {}) {
            const {
                retries = 2,
                timeoutMs = 10000,
                backoffBaseMs = 500,
                backoffFactor = 2,
                retryOnStatuses = [429, 500, 502, 503, 504]
            } = opts;
            let attempt = 0;
            while (true) {
                if (!isOnline()) {
                    const err = new Error('OFFLINE'); err.code = 'OFFLINE'; throw err;
                }
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeoutMs);
                try {
                    const res = await fetch(url, { ...options, signal: controller.signal });
                    clearTimeout(timer);
                    if (!res.ok && retryOnStatuses.includes(res.status) && attempt < retries) {
                        const delay = backoffBaseMs * Math.pow(backoffFactor, attempt);
                        await new Promise(r => setTimeout(r, delay + Math.floor(Math.random()*100)));
                        attempt++;
                        continue;
                    }
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res;
                } catch(e) {
                    clearTimeout(timer);
                    if (attempt < retries) {
                        const delay = backoffBaseMs * Math.pow(backoffFactor, attempt);
                        await new Promise(r => setTimeout(r, delay + Math.floor(Math.random()*100)));
                        attempt++;
                        continue;
                    }
                    throw e;
                }
            }
        }

        // オフライン同期キュー
        const CLOUD_QUEUE_KEY = 'cloudSyncQueue';
        function getCloudQueue() {
            try { const raw = localStorage.getItem(CLOUD_QUEUE_KEY); return raw ? JSON.parse(raw) : []; } catch(_) { return []; }
        }
        function setCloudQueue(q) {
            try { localStorage.setItem(CLOUD_QUEUE_KEY, JSON.stringify(q)); } catch(_) {}
        }
        function getCloudQueueLength() { try { return getCloudQueue().length; } catch(_) { return 0; } }
        function safeClone(obj) { try { return JSON.parse(JSON.stringify(obj)); } catch(_) { return obj; } }
        function enqueueCloudOp(op, payload) {
            const q = getCloudQueue();
            q.push({ op, payload: safeClone(payload), createdAt: Date.now() });
            setCloudQueue(q);
            try { compactCloudQueue(); } catch(_){}
            const newLen = getCloudQueueLength();
            try { logWarn('CLOUD_QUEUE', 'enqueue ' + op, newLen); } catch(_){}
            try { showToast(`Cloud同期待ち（キュー:${newLen}）`, 'warn'); } catch(_){}
        }
        function compactCloudQueue() {
            const q = getCloudQueue();
            if (!q.length) return;
            const map = new Map();
            const localIdToOrderNo = new Map();
            try {
                for (const o of orders) {
                    localIdToOrderNo.set(o.id, o.orderNo);
                }
            } catch(_){}
            for (const item of q) {
                let key = '';
                if (item.op === 'update') {
                    const lid = item.payload && item.payload.localId;
                    const ono = localIdToOrderNo.get(lid) || '';
                    key = 'U:' + (ono || lid);
                    const existing = map.get(key);
                    if (existing) {
                        existing.payload.patch = { ...(existing.payload.patch||{}), ...(item.payload.patch||{}) };
                    } else {
                        map.set(key, safeClone(item));
                    }
                } else if (item.op === 'upsert') {
                    const ono = (item.payload && (item.payload.orderNo || item.payload.order_no)) || '';
                    key = 'P:' + ono;
                    map.set(key, safeClone(item));
                } else if (item.op === 'delete') {
                    const ono = item.payload && item.payload.orderNo;
                    key = 'D:' + ono;
                    // deleteは最優先。関連するupdate/upsertを上書き
                    map.set(key, safeClone(item));
                    map.delete('U:' + ono);
                    map.delete('P:' + ono);
                } else if (item.op === 'batchUpdate') {
                    const ids = (item.payload && item.payload.localIds) || [];
                    key = 'B:' + ids.slice().sort().join(',');
                    const existing = map.get(key);
                    if (existing) {
                        existing.payload.patch = { ...(existing.payload.patch||{}), ...(item.payload.patch||{}) };
                    } else {
                        map.set(key, safeClone(item));
                    }
                } else {
                    key = 'X:' + JSON.stringify(item.payload || {});
                    map.set(key, safeClone(item));
                }
            }
            const compacted = Array.from(map.values());
            setCloudQueue(compacted);
            try { logInfo('CLOUD_QUEUE_COMPACT', 'size', compacted.length); } catch(_){}
        }
        async function flushCloudQueue(limit) {
            if (!cloudEnabled()) return;
            try { compactCloudQueue(); } catch(_){}
            const q = getCloudQueue();
            if (!q.length) { updateCloudStatusUI(true); return; }
            updateCloudStatusUI();
            const toProcess = typeof limit === 'number' ? q.slice(0, limit) : q.slice();
            let processed = 0;
            for (const item of toProcess) {
                try {
                    if (item.op === 'upsert') {
                        await cloudUpsertOrder(item.payload);
                    } else if (item.op === 'delete') {
                        await cloudDeleteOrderByOrderNo(item.payload.orderNo);
                    } else if (item.op === 'update') {
                        await cloudUpdateOrder(item.payload.localId, item.payload.patch);
                    } else if (item.op === 'batchUpdate') {
                        await cloudBatchUpdate(item.payload.localIds, item.payload.patch);
                    }
                    processed++;
                } catch(e) {
                    try { logError('CLOUD_QUEUE_FLUSH', e); } catch(_){ }
                    break; // 次回に再試行
                }
            }
            if (processed > 0) {
                const remaining = q.slice(processed);
                setCloudQueue(remaining);
                try { showToast(`Cloud同期処理（${processed}件）`); } catch(_){ }
            }
            if (!getCloudQueue().length) updateCloudStatusUI(true);
        }
        window.addEventListener('online', () => { try { flushCloudQueue(); } catch(_){} });
        setInterval(() => { try { flushCloudQueue(3); } catch(_){} }, 30000);

        function updateCloudStatusUI(connected) {
            const el = document.getElementById('cloudStatus');
            if (!el) return;
            const qlen = (typeof getCloudQueueLength === 'function') ? getCloudQueueLength() : 0;
            const queueText = qlen > 0 ? `・キュー:${qlen}` : '';
            if (!cloudEnabled()) {
                el.textContent = '接続: ローカル';
                el.style.background = '#eee';
                el.style.color = '#333';
            } else if (connected === true) {
                el.textContent = `接続: Cloud（同期完了${queueText ? ' ' + queueText : ''}）`;
                el.style.background = '#e7f7ef';
                el.style.color = '#0a7a3b';
            } else if (connected === false) {
                el.textContent = `接続: Cloud（エラー${queueText ? ' ' + queueText : ''}）`;
                el.style.background = '#fdecea';
                el.style.color = '#b71c1c';
            } else {
                el.textContent = `接続: Cloud（同期中${queueText ? ' ' + queueText : ''}）`;
                el.style.background = '#f0f7ff';
                el.style.color = '#0b5ed7';
            }
        }

        // 簡易トースト通知
        function showToast(message, type) {
            try {
                const containerId = 'toast-container';
                let c = document.getElementById(containerId);
                if (!c) {
                    c = document.createElement('div');
                    c.id = containerId;
                    c.style.position = 'fixed';
                    c.style.top = '16px';
                    c.style.right = '16px';
                    c.style.zIndex = '9999';
                    c.style.display = 'flex';
                    c.style.flexDirection = 'column';
                    c.style.gap = '8px';
                    document.body.appendChild(c);
                }
                const toast = document.createElement('div');
                toast.textContent = message;
                toast.style.padding = '10px 12px';
                toast.style.borderRadius = '4px';
                toast.style.color = '#fff';
                toast.style.fontSize = '12px';
                toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                toast.style.background = type === 'error' ? '#d93025' : (type === 'warn' ? '#f57c00' : '#2e7d32');
                c.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transition = 'opacity 300ms ease';
                    setTimeout(() => { try { c.removeChild(toast); } catch(_){} }, 320);
                }, 2000);
            } catch(_) { /* noop */ }
        }

        // 簡易ロガー＆タグ集計
        const logStats = { info: {}, warn: {}, error: {} };
        function logInfo(tag, ...args) {
            try { logStats.info[tag] = (logStats.info[tag] || 0) + 1; console.log(`[INFO:${tag}]`, ...args); } catch(_){}
        }
        function logWarn(tag, ...args) {
            try { logStats.warn[tag] = (logStats.warn[tag] || 0) + 1; console.warn(`[WARN:${tag}]`, ...args); } catch(_){}
        }
        function logError(tag, ...args) {
            try { logStats.error[tag] = (logStats.error[tag] || 0) + 1; console.error(`[ERROR:${tag}]`, ...args); } catch(_){}
        }
        function printLogStats() {
            try { console.table(logStats); } catch(_) { console.log('LOG_STATS', JSON.stringify(logStats)); }
        }

        // 行正規化（Supabase→画面）
        function normalizeOrderRow(row) {
            return {
                id: row.id,
                orderNo: row.order_no || row.orderno || row.orderNo,
                date: row.date,
                customerName: row.customer_name || row.customerName,
                pickupLocation: row.pickup_location || row.pickupLocation,
                pickupAddress: row.pickup_address || row.pickupAddress || '',
                deliveryLocation: row.delivery_location || row.deliveryLocation,
                deliveryAddress: row.delivery_address || row.deliveryAddress || '',
                deliveryTel: row.delivery_tel || row.deliveryTel || '',
                cargo: row.cargo,
                quantity: Number(row.quantity ?? 0),
                unit: row.unit || '',
                packaging: row.packaging || '',
                unitPrice: Number(row.unit_price ?? row.unitPrice ?? 0),
                amountNet: Number(row.amount_net ?? row.amountNet ?? 0),
                amountGross: Number(row.amount_gross ?? row.amountGross ?? 0),
                instructions: row.instructions || '',
                driver: row.driver || '',
                vehicle: row.vehicle || '',
                instructionSheet: !!row.instruction_sheet || !!row.instructionSheet,
                invoiceSent: !!row.invoice_sent || !!row.invoiceSent,
                paymentReceived: !!row.payment_received || !!row.paymentReceived,
                orderCompleted: !!row.order_completed || !!row.orderCompleted
            };
        }

        async function cloudFetchOrders() {
            const url = getSupabaseBase() + '/orders?select=*&order=date.asc&order=order_no.asc';
            const res = await cloudFetchRetry(url, { headers: supabaseHeaders() }, { retries: 2, timeoutMs: 10000 });
            return await res.json();
        }

        async function cloudUpsertOrder(order) {
            if (!cloudEnabled()) return;
            updateCloudStatusUI();
            const base = getSupabaseBase();
            const patchBody = serializeOrderForCloud(order);
            delete patchBody.id; // idは更新対象外
            const orderNo = order.orderNo || order.order_no;
            if (!orderNo) {
                console.warn('order_noが不明のためクラウド同期をスキップ');
                return;
            }
            // 1) order_noでPATCH（存在しなければ空配列が返る）
            const urlPatch = `${base}/orders?order_no=eq.${encodeURIComponent(orderNo)}`;
            const resPatch = await cloudFetchRetry(urlPatch, { method: 'PATCH', headers: supabaseHeaders(), body: JSON.stringify(patchBody) }, { retries: 2, timeoutMs: 10000 });
            let updatedRows = [];
            try { updatedRows = await resPatch.json(); } catch(_) { /* representationが返らない場合 */ }
            if (Array.isArray(updatedRows) && updatedRows.length > 0) {
                const row = updatedRows[0];
                if (row && row.id) order.id = row.id; // Supabaseのidを反映
                updateCloudStatusUI(true);
                return; // 更新で完了
            }
            // 2) 既存行がなければPOST（idは送らない）
            const insertBody = serializeOrderForCloud(order);
            delete insertBody.id;
            const urlPost = `${base}/orders?on_conflict=order_no`;
            try {
                const resPost = await cloudFetchRetry(urlPost, { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify(insertBody) }, { retries: 2, timeoutMs: 10000 });
                const rows = await resPost.json();
                if (rows && rows[0] && rows[0].id) {
                    order.id = rows[0].id;
                }
                updateCloudStatusUI(true);
            } catch(e) {
                const msg = String(e && e.message || '');
                if (msg.includes('HTTP 409')) {
                    try {
                        const urlPatch2 = `${base}/orders?order_no=eq.${encodeURIComponent(orderNo)}`;
                        await cloudFetchRetry(urlPatch2, { method: 'PATCH', headers: supabaseHeaders(), body: JSON.stringify(patchBody) }, { retries: 2, timeoutMs: 10000 });
                        updateCloudStatusUI(true);
                        try { flushCloudQueue(2); } catch(_){}
                    } catch(e2) {
                        try { logError('CLOUD_UPSERT_CONFLICT_PATCH', e2); } catch(_){}
                        enqueueCloudOp('upsert', order);
                        updateCloudStatusUI(false);
                        try { showToast('Cloud同期競合（キューに追加）', 'error'); } catch(_){}
                    }
                } else {
                    try { logError('CLOUD_UPSERT_POST', e); } catch(_){}
                    enqueueCloudOp('upsert', order);
                    updateCloudStatusUI(false);
                    try { showToast('Cloud同期に失敗（キューに追加）', 'error'); } catch(_){}
                }
            }
        }

        async function cloudUpdateOrder(localId, patch) {
            if (!cloudEnabled()) return;
            updateCloudStatusUI();
            const base = getSupabaseBase();
            const o = orders.find(x => x.id === localId);
            if (!o) return;
            const body = serializeOrderForCloud({ ...o, ...patch });
            delete body.id;
            const url = `${base}/orders?order_no=eq.${encodeURIComponent(o.orderNo)}`;
            try {
                const res = await cloudFetchRetry(url, { method: 'PATCH', headers: supabaseHeaders(), body: JSON.stringify(body) }, { retries: 2, timeoutMs: 10000 });
                updateCloudStatusUI(true);
                try { flushCloudQueue(2); } catch(_){}
                return await res.json();
            } catch(e) {
                try { logError('CLOUD_UPDATE', e); } catch(_){}
                enqueueCloudOp('update', { localId, patch });
                updateCloudStatusUI(false);
                try { showToast('Cloud更新に失敗（キューに追加）', 'error'); } catch(_){}
            }
        }

        async function cloudBatchUpdate(localIds, patch) {
            if (!cloudEnabled() || !localIds || localIds.length === 0) return;
            updateCloudStatusUI();
            const base = getSupabaseBase();
            const orderNos = localIds.map(id => {
                const o = orders.find(x => x.id === id);
                return o ? o.orderNo : null;
            }).filter(v => v);
            if (orderNos.length === 0) return;
            const inParam = 'in.(' + orderNos.map(x => encodeURIComponent(String(x))).join(',') + ')';
            const url = `${base}/orders?order_no=${inParam}`;
            const body = serializeOrderForCloud(patch);
            delete body.id;
            try {
                await cloudFetchRetry(url, { method: 'PATCH', headers: supabaseHeaders(), body: JSON.stringify(body) }, { retries: 2, timeoutMs: 10000 });
                updateCloudStatusUI(true);
                try { flushCloudQueue(2); } catch(_){}
            } catch(e) {
                try { logError('CLOUD_BATCH_UPDATE', e); } catch(_){}
                enqueueCloudOp('batchUpdate', { localIds, patch });
                updateCloudStatusUI(false);
                try { showToast('Cloud一括更新に失敗（キューに追加）', 'error'); } catch(_){}
            }
        }

        async function cloudDeleteOrderByOrderNo(orderNo) {
            if (!cloudEnabled()) return;
            updateCloudStatusUI();
            const base = getSupabaseBase();
            const url = `${base}/orders?order_no=eq.${encodeURIComponent(orderNo)}`;
            try {
                await cloudFetchRetry(url, { method: 'DELETE', headers: supabaseHeaders() }, { retries: 2, timeoutMs: 10000 });
                updateCloudStatusUI(true);
                try { flushCloudQueue(2); } catch(_){}
            } catch(e) {
                try { logError('CLOUD_DELETE', e); } catch(_){ }
                try { enqueueCloudOp('delete', { orderNo }); } catch(_){}
                updateCloudStatusUI(false);
                try { showToast('Cloud削除に失敗（キューに追加）', 'error'); } catch(_){}
            }
        }

        function serializeOrderForCloud(src) {
            // 画面→Supabaseフィールド名
            const map = {
                id: src.id,
                order_no: src.orderNo,
                date: src.date,
                customer_name: src.customerName,
                pickup_location: src.pickupLocation,
                pickup_address: src.pickupAddress,
                delivery_location: src.deliveryLocation,
                delivery_address: src.deliveryAddress,
                delivery_tel: src.deliveryTel,
                cargo: src.cargo,
                quantity: src.quantity,
                unit: src.unit,
                packaging: src.packaging,
                unit_price: src.unitPrice,
                amount_net: src.amountNet,
                amount_gross: src.amountGross,
                instructions: src.instructions,
                driver: src.driver,
                vehicle: src.vehicle,
                instruction_sheet: src.instructionSheet,
                invoice_sent: src.invoiceSent,
                payment_received: src.paymentReceived,
                order_completed: src.orderCompleted
            };
            // 未定義を除去
            Object.keys(map).forEach(k => { if (map[k] === undefined) delete map[k]; });
            return map;
        }

        // ====== マスタデータ同期機能 ======
        
        // 顧客マスタをSupabaseから取得
        async function cloudFetchCustomers() {
            if (!cloudEnabled()) return [];
            try {
                const base = getSupabaseBase();
                const resp = await cloudFetchRetry(`${base}/customers?select=*&order=created_at.asc`, {
                    headers: supabaseHeaders()
                });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                return await resp.json();
            } catch (err) {
                logError('cloudFetchCustomers', err);
                return [];
            }
        }
        
        // 顧客マスタをSupabaseに保存（全件削除後再挿入）
        async function cloudSaveCustomers(customers) {
            if (!cloudEnabled()) return;
            if (!customers || customers.length === 0) {
                logInfo('cloudSaveCustomers', 'No customers to save');
                return;
            }
            
            try {
                const base = getSupabaseBase();
                const headers = supabaseHeaders();
                
                // 既存データを取得
                let existingIds = [];
                try {
                    const fetchResp = await cloudFetchRetry(`${base}/customers?select=id`, {
                        headers: headers
                    }, { retries: 1 });
                    if (fetchResp.ok) {
                        const existing = await fetchResp.json();
                        existingIds = existing.map(r => r.id);
                    }
                } catch (fetchErr) {
                    logInfo('cloudSaveCustomers', 'Could not fetch existing records, skipping delete');
                }
                
                // 既存レコードをIDで削除（バッチ処理）
                if (existingIds.length > 0) {
                    try {
                        // IDのリストを使って一括削除
                        const idsStr = existingIds.map(id => `"${id}"`).join(',');
                        await cloudFetchRetry(`${base}/customers?id=in.(${idsStr})`, {
                            method: 'DELETE',
                            headers: { ...headers, 'Prefer': 'return=minimal' }
                        }, { retries: 0 });
                        logInfo('cloudSaveCustomers', `Deleted ${existingIds.length} existing records`);
                    } catch (deleteErr) {
                        logInfo('cloudSaveCustomers', 'Delete failed, continuing with insert');
                    }
                }
                
                // 新しいデータを挿入
                const resp = await cloudFetchRetry(`${base}/customers`, {
                    method: 'POST',
                    headers: { ...headers, 'Prefer': 'return=minimal' },
                    body: JSON.stringify(customers.map(c => ({
                        customer_name: c.name || c.customerName,
                        pickup_address: c.address || c.pickupAddress || '',
                        delivery_address: c.deliveryAddress || '',
                        phone_number: c.tel || c.phoneNumber || ''
                    })))
                });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                
                logInfo('cloudSaveCustomers', `Saved ${customers.length} customers`);
            } catch (err) {
                logError('cloudSaveCustomers', err);
                throw err;
            }
        }
        
        // シンプルマスタをSupabaseから取得
        async function cloudFetchSimpleMaster(masterType) {
            if (!cloudEnabled()) return [];
            try {
                const base = getSupabaseBase();
                const resp = await cloudFetchRetry(`${base}/simple_masters?master_type=eq.${masterType}&select=*&order=sort_order.asc`, {
                    headers: supabaseHeaders()
                });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data = await resp.json();
                return data.map(item => item.name);
            } catch (err) {
                logError('cloudFetchSimpleMaster', masterType, err);
                return [];
            }
        }
        
        // シンプルマスタをSupabaseに保存（全件削除後再挿入）
        async function cloudSaveSimpleMaster(masterType, items) {
            if (!cloudEnabled()) return;
            try {
                const base = getSupabaseBase();
                const headers = supabaseHeaders();
                
                // 既存データを削除
                await cloudFetchRetry(`${base}/simple_masters?master_type=eq.${masterType}`, {
                    method: 'DELETE',
                    headers: { ...headers, 'Prefer': 'return=minimal' }
                });
                
                // 新しいデータを挿入
                if (items.length > 0) {
                    const resp = await cloudFetchRetry(`${base}/simple_masters`, {
                        method: 'POST',
                        headers: { ...headers, 'Prefer': 'return=minimal' },
                        body: JSON.stringify(items.map((name, index) => ({
                            master_type: masterType,
                            name: name,
                            sort_order: index
                        })))
                    });
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                }
                logInfo('cloudSaveSimpleMaster', masterType, `Saved ${items.length} items`);
            } catch (err) {
                logError('cloudSaveSimpleMaster', masterType, err);
            }
        }
        
        // 全マスタデータをSupabaseから読み込む
        async function loadMastersFromCloud() {
            if (!cloudEnabled()) return;
            
            try {
                // 顧客マスタを取得（空配列ならローカルデータを保持）
                const cloudCustomers = await cloudFetchCustomers();
                if (cloudCustomers.length > 0) {
                    customerMaster = cloudCustomers.map(c => ({
                        name: c.customer_name,
                        address: c.pickup_address || '',
                        tel: c.phone_number || ''
                    }));
                    localStorage.setItem('customerMaster', JSON.stringify(customerMaster));
                }

                // シンプルマスタを取得（空配列ならローカルデータを保持）
                const cloudCargo = await cloudFetchSimpleMaster('cargo');
                if (cloudCargo.length > 0) { cargoMaster = cloudCargo; localStorage.setItem('cargoMaster', JSON.stringify(cargoMaster)); }

                const cloudPackaging = await cloudFetchSimpleMaster('packaging');
                if (cloudPackaging.length > 0) { packagingMaster = cloudPackaging; localStorage.setItem('packagingMaster', JSON.stringify(packagingMaster)); }

                const cloudUnit = await cloudFetchSimpleMaster('unit');
                if (cloudUnit.length > 0) { unitMaster = cloudUnit; localStorage.setItem('unitMaster', JSON.stringify(unitMaster)); }

                const cloudDriver = await cloudFetchSimpleMaster('driver');
                if (cloudDriver.length > 0) { driverMaster = cloudDriver; localStorage.setItem('driverMaster', JSON.stringify(driverMaster)); }

                const cloudVehicle = await cloudFetchSimpleMaster('vehicle');
                if (cloudVehicle.length > 0) { vehicleMaster = cloudVehicle; localStorage.setItem('vehicleMaster', JSON.stringify(vehicleMaster)); }
                
                logInfo('loadMastersFromCloud', 'All masters loaded from cloud');
                updateSelectOptions();
                setupFilters();
                
                // 顧客マスタの表示を更新
                if (typeof renderCustomerMaster === 'function') {
                    renderCustomerMaster();
                }
            } catch (err) {
                logError('loadMastersFromCloud', err);
            }
        }

        // クラウド設定モーダル操作
        function openCloudSettings() {
            loadCloudConfig();
            document.getElementById('cloudProjectUrl').value = cloudConfig.url || '';
            document.getElementById('cloudAnonKey').value = cloudConfig.anonKey || '';
            document.getElementById('cloudEnabledCheckbox').checked = !!cloudConfig.enabled;
            document.getElementById('cloudSettingsModal').style.display = 'block';
        }
        function closeCloudSettings() {
            document.getElementById('cloudSettingsModal').style.display = 'none';
        }
        function saveCloudSettings() {
            const url = document.getElementById('cloudProjectUrl').value.trim();
            const key = document.getElementById('cloudAnonKey').value.trim();
            const enabled = document.getElementById('cloudEnabledCheckbox').checked;
            saveCloudConfig({ url, anonKey: key, enabled });
            updateCloudStatusUI();
            closeCloudSettings();
            // 設定が有効化されたら即時同期（読み込み）
            if (cloudEnabled()) {
                cloudFetchOrders().then(fetched => {
                    if (Array.isArray(fetched)) {
                        orders = fetched.map(row => normalizeOrderRow(row));
                        saveData();
                        renderTable();
                        updateStats();
                        setupFilters();
                        updateCloudStatusUI(true);
                    }
                }).catch(err => {
                    console.warn('クラウド読み込み失敗:', err);
                    updateCloudStatusUI(false);
                });
            }
        }
/* ===== カラー自動生成（cargo / driver 用）: renderTable の直前に追記 ===== */

// 名前空間ごとに色マップをlocalStorageに保持
function getColorMapKey(ns) { return `colorMap_${ns}`; }
function getColorMap(ns) {
    try { return JSON.parse(localStorage.getItem(getColorMapKey(ns))) || {}; }
    catch(_) { return {}; }
}
function setColorMap(ns, map) {
    localStorage.setItem(getColorMapKey(ns), JSON.stringify(map));
}

// 文字列→ハッシュ（DJB2）
function hashString(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
    return h >>> 0; // unsigned
}

// HSL → HEX
function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2*l - 1)) * s;
    const x = c * (1 - Math.abs(((h/60) % 2) - 1));
    const m = l - c/2;
    let r=0,g=0,b=0;
    if (0<=h && h<60) { r=c; g=x; b=0; }
    else if (60<=h && h<120) { r=x; g=c; b=0; }
    else if (120<=h && h<180) { r=0; g=c; b=x; }
    else if (180<=h && h<240) { r=0; g=x; b=c; }
    else if (240<=h && h<300) { r=x; g=0; b=c; }
    else { r=c; g=0; b=x; }
    const toHex = v => Math.round((v+m)*255).toString(16).padStart(2,'0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// HEX → 相対輝度（テキスト色決定用）
function hexLuminance(hex) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    const a = [r,g,b].map(v => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));
    return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2];
}
/* === ドライバー個別の色を強制指定（この2名は固定色） === */
var COLOR_OVERRIDES = {
  driver: {
    '渡曾羊一': { bg: '#0EA5E9', fg: '#FFFFFF', _hue: 198 }, // 明るいスカイブルー
    '門馬将太': { bg: '#F97316', fg: '#FFFFFF', _hue: 24 }    // 濃いオレンジ
  }
};

// === ここから追記：色の被りを避けるユーティリティ ===
function hueDiff(a, b) {
  var d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// 既存で使っている色（map）から使用済みHue配列を取り出す（_hueが無い古いデータは無視）
function getUsedHuesFromMap(map) {
  var used = [];
  for (var k in map) {
    if (map.hasOwnProperty(k) && map[k] && typeof map[k]._hue === 'number') {
      used.push(map[k]._hue);
    }
  }
  return used;
}

// 指定の最小色差(minGap)を保ちながら、名前から安定的にHueを決める
function assignDistinctColor(ns, name, usedHues, minGapDeg) {
  // 黄金角（約137.508）を使ってハッシュ由来の初期Hueを広げる
  var baseHue = ((hashString(name) * 137.508) % 360 + 360) % 360;
  var step = 27; // 探索ステップ（度）。大きいほど衝突回避しやすい
  var sat  = (ns === 'cargo') ? 65 : 70; // ドライバーはより鮮やかに
  var lig  = (ns === 'cargo') ? 45 : 45;

  // 既存Hueと十分離れるまで回す
  for (var i = 0; i < 360 / step + 2; i++) {
    var hue = (baseHue + i * step) % 360;
    var ok = true;
    for (var j = 0; j < usedHues.length; j++) {
      if (hueDiff(hue, usedHues[j]) < minGapDeg) { ok = false; break; }
    }
    if (ok) {
      var bg = hslToHex(hue, sat, lig);
      var fg = hexLuminance(bg) > 0.6 ? '#111827' : '#ffffff';
      return { bg: bg, fg: fg, _hue: hue };
    }
  }
  // 万一すべて近い場合はベースを使用
  var bg2 = hslToHex(baseHue, sat, lig);
  var fg2 = hexLuminance(bg2) > 0.6 ? '#111827' : '#ffffff';
  return { bg: bg2, fg: fg2, _hue: baseHue };
}
// === ドライバー等の一覧に対して、色を再割当（全員が十分に違う色に） ===
function rebuildColorMapFor(ns, namesArray) {
  var names = (namesArray || []).slice();
  var map = {};
  var used = [];

  // 1) まず強制指定（OVERRIDE）を先に確定して used に登録
  var ovr = (COLOR_OVERRIDES[ns] || {});
  for (var k in ovr) {
    if (ovr.hasOwnProperty(k)) {
      map[k] = ovr[k];
      if (typeof ovr[k]._hue === 'number') used.push(ovr[k]._hue);
    }
  }

  // 2) 残りを名前順で自動割当
  names.sort(function(a, b){ return String(a).localeCompare(String(b)); });
  for (var i = 0; i < names.length; i++) {
    var nm = (names[i] || '').trim();
    if (!nm) continue;
    if (map[nm]) continue; // 既に上書き済みはスキップ
    var minGap = (ns === 'driver') ? 26 : 18;
    var col = assignDistinctColor(ns, nm, used, minGap);
    map[nm] = col;
    used.push(col._hue);
  }

  setColorMap(ns, map);
}


// ★ 置き換え版：色の最小距離を確保して割当
function nameToColor(ns, nameRaw) {
  var name = (nameRaw || '').trim();

// ★個別上書きがあればそれを即返す
var ovr = (COLOR_OVERRIDES[ns] || {});
if (ovr[name]) {
  var map0 = getColorMap(ns) || {};
  map0[name] = ovr[name];
  setColorMap(ns, map0);
  return ovr[name];
}
  if (!name) return { bg:'#e5e7eb', fg:'#111827' };

  var map = getColorMap(ns) || {};
  if (map[name] && map[name].bg && map[name].fg) {
    return map[name]; // 既存割当があればそのまま
  }

  // 既存の使用Hue一覧（_hueが無い古いデータは無視される）
  var usedHues = getUsedHuesFromMap(map);
  var minGap = (ns === 'driver') ? 26 : 18; // ドライバーはより広く色差を取る

  var col = assignDistinctColor(ns, name, usedHues, minGap);
  map[name] = col;
  setColorMap(ns, map);
  return col;
}


// 一覧タグ用の style 文字列を返す
function getTagStyle(ns, name) {
    const { bg, fg } = nameToColor(ns, name);
    return `background:${bg};color:${fg};border:1px solid ${bg}`;
}

        // テーブル描画
        function renderTable() {
            const tbody = document.getElementById('tableBody');
            let monthOrders = getMonthOrders();
            
            // 並び替え処理
            const sortOrder = document.getElementById('sortOrder') ? document.getElementById('sortOrder').value : 'date-asc';
            if (sortOrder === 'date-asc') {
                // 日付順（昇順）
                monthOrders.sort((a, b) => {
                    const dateA = new Date(a.date);
                    const dateB = new Date(b.date);
                    if (dateA.getTime() === dateB.getTime()) {
                        // 同じ日付の場合はIDで並び替え
                        return a.id - b.id;
                    }
                    return dateA - dateB;
                });
            } else if (sortOrder === 'id-asc') {
                // 登録順（ID順）
                monthOrders.sort((a, b) => a.id - b.id);
            }
            
tbody.innerHTML = monthOrders.map(function(o) {
    // タグ色: 既存の getTagStyle を利用
    var cargoHtml  = '<span class="tag" style="' + getTagStyle('cargo',  o.cargo)  + '">' + escHtml(o.cargo  || '-') + '</span>';
    var driverHtml = o.driver
        ? '<span class="tag" style="' + getTagStyle('driver', o.driver) + '">' + escHtml(o.driver) + '</span>'
        : '-';

    var qty = (o.quantity !== null && o.quantity !== undefined) ? o.quantity : '';
    var unit = (o.unit || '');

    return '' +
      '<tr data-order-id="' + o.id + '">' +
        '<td><input type="checkbox" class="checkbox order-checkbox" data-id="' + o.id + '"></td>' +
        '<td style="white-space: nowrap;">' + formatDate(o.date) + '</td>' +
        '<td>' + escHtml(o.customerName   || '-') + '</td>' +
        '<td>' + escHtml(o.pickupLocation  || '-') + '</td>' +
        '<td>' + escHtml(o.deliveryLocation|| '-') + '</td>' +
        '<td>' + cargoHtml + '</td>' +
        '<td style="white-space: nowrap;">' + escHtml(qty) + ' ' + escHtml(unit) + '</td>' +
        '<td>' + escHtml(o.packaging || '-') + '</td>' +
        '<td style="text-align: right;">¥' + ((o.unitPrice || 0).toLocaleString()) + '</td>' +
        '<td style="text-align: right;">¥' + ((o.amountNet || 0).toLocaleString()) + '</td>' +
        '<td style="text-align: right;">¥' + ((o.amountGross || 0).toLocaleString()) + '</td>' +
        '<td>' + driverHtml + '</td>' +
        '<td style="font-size: 0.7rem;">' + escHtml(o.vehicle || '-') + '</td>' +
        '<td style="text-align: center;">' + (o.instructionSheet ? '<span class="badge badge-success">済</span>' : '<span class="badge badge-warning">未</span>') + '</td>' +
        '<td style="text-align: center;"><input type="checkbox" class="checkbox-small" data-action="toggle-invoice" ' + (o.invoiceSent ? 'checked' : '') + '></td>' +
        '<td style="text-align: center;"><input type="checkbox" class="checkbox-small" data-action="toggle-payment" ' + (o.paymentReceived ? 'checked' : '') + '></td>' +
'<td style="white-space: nowrap;">' +
  '<a href="javascript:void(0)" role="button" class="btn btn-sm btn-primary" data-action="edit" style="margin-right: 2px;">編集</a>' +
  '<a href="javascript:void(0)" role="button" class="btn btn-sm btn-warning" data-action="duplicate" style="margin-right: 2px;">複製</a>' +
  '<a href="javascript:void(0)" role="button" class="btn btn-sm btn-danger" data-action="delete">削除</a>' +
'</td>' +

      '</tr>';
}).join('');

// innerHTML設定後に直接addEventListenerを設定（click + mousedown 両方）
tbody.querySelectorAll('tr[data-order-id]').forEach(function(tr) {
    var rowId = Number(tr.getAttribute('data-order-id'));
    if (isNaN(rowId)) return;
    var editBtn = tr.querySelector('[data-action="edit"]');
    var dupBtn  = tr.querySelector('[data-action="duplicate"]');
    var delBtn  = tr.querySelector('[data-action="delete"]');
    var invCb   = tr.querySelector('input[data-action="toggle-invoice"]');
    var payyCb  = tr.querySelector('input[data-action="toggle-payment"]');
    var selCb   = tr.querySelector('input.order-checkbox');
    if (editBtn) {
        editBtn.addEventListener('click',     function(e) { e.preventDefault(); editOrder(rowId, editBtn); });
        editBtn.addEventListener('mousedown', function(e) { e.preventDefault(); editOrder(rowId, editBtn); });
    }
    if (dupBtn) {
        dupBtn.addEventListener('click',     function(e) { e.preventDefault(); duplicateOrder(rowId, dupBtn); });
        dupBtn.addEventListener('mousedown', function(e) { e.preventDefault(); duplicateOrder(rowId, dupBtn); });
    }
    if (delBtn) {
        delBtn.addEventListener('click',     function(e) { e.preventDefault(); deleteOrder(rowId); });
        delBtn.addEventListener('mousedown', function(e) { e.preventDefault(); deleteOrder(rowId); });
    }
    if (invCb)  invCb.addEventListener('change',  function() { toggleInvoice(rowId); });
    if (payyCb) payyCb.addEventListener('change', function() { togglePayment(rowId); });
    if (selCb)  selCb.addEventListener('change',  function() { updateRowSelection(); });
});

updateStatsFromView();
updateRowActionBar();
        }
        
        // 並び替え処理
        function sortTable() {
            renderTable();
            filterTable(); // フィルタも再適用
        }

        // 請求書チェック切り替え
        function toggleInvoice(id) {
            const order = orders.find(o => o.id === id);
            if (order) {
                order.invoiceSent = !order.invoiceSent;
                saveData();
                // クラウド更新
                try { if (cloudEnabled()) cloudUpdateOrder(id, { invoiceSent: order.invoiceSent }); } catch(e) {}
            }
        }

        // 入金チェック切り替え
        function togglePayment(id) {
            const order = orders.find(o => o.id === id);
            if (order) {
                order.paymentReceived = !order.paymentReceived;
                saveData();
                // クラウド更新
                try { if (cloudEnabled()) cloudUpdateOrder(id, { paymentReceived: order.paymentReceived }); } catch(e) {}
            }
        }

        // 月別データ取得
        function getMonthOrders() {
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth();
            const startDate = new Date(year, month, 1);
            const endDate = new Date(year, month + 1, 1); // 次月の1日の0時0分
            
            return orders.filter(order => {
                const orderDate = new Date(order.date + 'T00:00:00'); // タイムゾーンの問題を回避
                return orderDate >= startDate && orderDate < endDate;
            });
        }

        // 統計更新
        function updateStats() {
            const monthOrders = getMonthOrders();
            const totalGross = monthOrders.reduce((sum, order) => sum + (order.amountGross || 0), 0);
            const totalNet = monthOrders.reduce((sum, order) => sum + (order.amountNet || 0), 0);
            const incomplete = monthOrders.filter(order => !order.orderCompleted).length;
            
            // 本日と翌日の配送予定件数を計算
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
            const tomorrowStr = `${tomorrow.getFullYear()}-${(tomorrow.getMonth() + 1).toString().padStart(2, '0')}-${tomorrow.getDate().toString().padStart(2, '0')}`;
            
            const todayDeliveries = orders.filter(order => 
                order.date === todayStr && !order.orderCompleted
            ).length;
            
            const tomorrowDeliveries = orders.filter(order => 
                order.date === tomorrowStr && !order.orderCompleted
            ).length;
            
            document.getElementById('totalGross').textContent = `¥${totalGross.toLocaleString()}`;
            document.getElementById('totalNet').textContent = `¥${totalNet.toLocaleString()}`;
            document.getElementById('orderCount').textContent = `${monthOrders.length}件`;
            document.getElementById('incompleteCount').textContent = `${incomplete}件`;
            document.getElementById('todayDeliveryCount').textContent = `${todayDeliveries}件`;
            document.getElementById('tomorrowDeliveryCount').textContent = `${tomorrowDeliveries}件`;
        }
// ===== 表示中の一覧（#tableBody の可視行）から集計して上部カードに反映 =====
function updateStatsFromView() {
    const rows = document.querySelectorAll('#tableBody tr');
    let visibleIds = [];
    rows.forEach(tr => {
        if (tr.style.display !== 'none') {
            const id = parseInt(tr.getAttribute('data-order-id'));
            if (!isNaN(id)) visibleIds.push(id);
        }
    });

    const visibleOrders = orders.filter(o => visibleIds.includes(o.id));

    const totalGross = visibleOrders.reduce((sum, o) => sum + (o.amountGross || 0), 0);
    const totalNet   = visibleOrders.reduce((sum, o) => sum + (o.amountNet   || 0), 0);
    const count      = visibleOrders.length;
    const incomplete = visibleOrders.filter(o => !o.orderCompleted).length;

    document.getElementById('totalGross').textContent = `¥${totalGross.toLocaleString()}`;
    document.getElementById('totalNet').textContent   = `¥${totalNet.toLocaleString()}`;
    document.getElementById('orderCount').textContent = `${count}件`;
    document.getElementById('incompleteCount').textContent = `${incomplete}件`;
}


        // 月表示更新
        function updateMonth() {
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth() + 1;
            document.getElementById('currentMonth').textContent = `${year}年${month}月`;
        }

        // 前月
        function prevMonth() {
            currentMonth.setMonth(currentMonth.getMonth() - 1);
            updateMonth();
            renderTable();
            updateStats();
        }

        // 次月
        function nextMonth() {
            currentMonth.setMonth(currentMonth.getMonth() + 1);
            updateMonth();
            renderTable();
            updateStats();
        }

        // 日付フィルタクリア
        function clearDateFilter() {
            document.getElementById('dateFilter').value = '';
            filterTable();
        }

        // モーダル開く
        function openModal() {
            editingId = null;
            document.getElementById('modalTitle').textContent = '新規受注登録';
            document.getElementById('orderForm').reset();
            document.getElementById('orderDate').value = new Date().toISOString().split('T')[0];
            generateOrderNo();
            document.getElementById('orderModal').style.display = 'block';
            const content = document.querySelector('#orderModal .modal-content');
            if (content) content.scrollTop = 0;
        }

        // モーダル閉じる
        function closeModal() {
            document.getElementById('orderModal').style.display = 'none';
            editingId = null;
            document.querySelectorAll('.autocomplete-list').forEach(list => {
                list.classList.remove('active');
            });
        }

        // 顧客マスタモーダル開く
        function openCustomerMaster() {
            renderCustomerMaster();
            document.getElementById('customerMasterModal').style.display = 'block';
        }

        // 顧客マスタモーダル閉じる
        function closeCustomerMaster() {
            document.getElementById('customerMasterModal').style.display = 'none';
        }

        // 顧客マスタ描画
        function renderCustomerMaster() {
            const tbody = document.getElementById('customerMasterBody');
            tbody.innerHTML = customerMaster.map((customer, index) => `
                <tr>
                    <td><input type="text" class="form-input-full jp-input" value="${escHtml(customer.name)}" data-field="name" data-index="${index}" lang="ja" inputmode="text"></td>
                    <td><input type="text" class="form-input-full jp-input" value="${escHtml(customer.address)}" data-field="address" data-index="${index}" lang="ja" inputmode="text"></td>
                    <td><input type="tel" class="form-input-full numeric-input" value="${escHtml(customer.tel)}" data-field="tel" data-index="${index}" inputmode="tel"></td>
                    <td>
                        <button class="btn btn-sm btn-danger" data-action="delete-customer" data-index="${index}">削除</button>
                    </td>
                </tr>
            `).join('');
            // 直接リスナーを設定（バブリング干渉対策）
            tbody.querySelectorAll('button[data-action="delete-customer"]').forEach(function(btn) {
                var idx = parseInt(btn.getAttribute('data-index'));
                if (!isNaN(idx)) btn.addEventListener('click', function() { deleteCustomer(idx); });
            });
        }

        // 顧客追加行
        function addCustomerRow() {
            customerMaster.push({ name: '', address: '', tel: '' });
            renderCustomerMaster();
        }

        // 顧客削除
        function deleteCustomer(index) {
            customerMaster.splice(index, 1);
            renderCustomerMaster();
        }

        // 顧客マスタ保存
        async function saveCustomerMaster() {
            const inputs = document.querySelectorAll('#customerMasterBody input');
            inputs.forEach(input => {
                const index = parseInt(input.dataset.index);
                const field = input.dataset.field;
                customerMaster[index][field] = input.value;
            });
            
            localStorage.setItem('customerMaster', JSON.stringify(customerMaster));
            
            // Supabaseにも保存
            await cloudSaveCustomers(customerMaster);
            
            setupFilters(); // フィルターを更新
            closeCustomerMaster();
            alert('顧客マスタを保存しました');
        }

        // シンプルマスタモーダル開く
        function openCargoMaster() {
            currentMasterType = 'cargo';
            document.getElementById('simpleMasterTitle').textContent = '積荷マスタ管理';
            renderSimpleMaster(cargoMaster);
            document.getElementById('simpleMasterModal').style.display = 'block';
        }

        function openPackagingMaster() {
            currentMasterType = 'packaging';
            document.getElementById('simpleMasterTitle').textContent = '荷姿マスタ管理';
            renderSimpleMaster(packagingMaster);
            document.getElementById('simpleMasterModal').style.display = 'block';
        }

        function openUnitMaster() {
            currentMasterType = 'unit';
            document.getElementById('simpleMasterTitle').textContent = '単位マスタ管理';
            renderSimpleMaster(unitMaster);
            document.getElementById('simpleMasterModal').style.display = 'block';
        }

        function openDriverMaster() {
            currentMasterType = 'driver';
            document.getElementById('simpleMasterTitle').textContent = 'ドライバーマスタ管理';
            renderSimpleMaster(driverMaster);
            document.getElementById('simpleMasterModal').style.display = 'block';
        }

        function openVehicleMaster() {
            currentMasterType = 'vehicle';
            document.getElementById('simpleMasterTitle').textContent = '車両マスタ管理';
            renderSimpleMaster(vehicleMaster);
            document.getElementById('simpleMasterModal').style.display = 'block';
        }

        // シンプルマスタ描画
        function renderSimpleMaster(masterData) {
            const list = document.getElementById('simpleMasterList');
            list.innerHTML = masterData.map((item, index) => {
                // 文字列配列とオブジェクト配列の両方に対応
                const name = typeof item === 'string' ? item : item.name;
                return `
                    <div class="master-item" draggable="true" data-index="${index}" data-name="${escHtml(name)}">
                        <span class="drag-handle">☰</span>
                        <span class="master-item-content">${escHtml(name)}</span>
                        <div class="master-item-actions">
                            <button data-action="delete-master-item" data-index="${index}">×</button>
                        </div>
                    </div>
                `;
            }).join('');
            // 直接リスナーを設定（バブリング干渉対策）
            list.querySelectorAll('button[data-action="delete-master-item"]').forEach(function(btn) {
                var idx = parseInt(btn.getAttribute('data-index'));
                if (!isNaN(idx)) btn.addEventListener('click', function() { deleteSimpleMasterItem(idx); });
            });
            // ドラッグ&ドロップイベントを設定
            setupDragAndDrop();
        }

        // ドラッグ&ドロップ設定
        function setupDragAndDrop() {
            const items = document.querySelectorAll('.master-item');
            
            items.forEach(item => {
                item.addEventListener('dragstart', handleDragStart);
                item.addEventListener('dragover', handleDragOver);
                item.addEventListener('drop', handleDrop);
                item.addEventListener('dragend', handleDragEnd);
            });
        }

        function handleDragStart(e) {
            draggedItem = e.currentTarget;
            e.currentTarget.classList.add('dragging');
        }

        function handleDragOver(e) {
            e.preventDefault();
            const container = document.getElementById('simpleMasterList');
            const afterElement = getDragAfterElement(container, e.clientY);
            if (afterElement == null) {
                container.appendChild(draggedItem);
            } else {
                container.insertBefore(draggedItem, afterElement);
            }
        }

        function handleDrop(e) {
            e.preventDefault();
            updateMasterOrder();
        }

        function handleDragEnd(e) {
            e.currentTarget.classList.remove('dragging');
        }

        function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('.master-item:not(.dragging)')];
            
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }

        function updateMasterOrder() {
            const items = document.querySelectorAll('.master-item');
            const newOrder = [];
            
            items.forEach(item => {
                // data-name属性から直接値を取得（文字列配列として保存）
                const name = item.dataset.name;
                newOrder.push(name);
            });
            
            switch(currentMasterType) {
                case 'cargo': cargoMaster = newOrder; renderSimpleMaster(cargoMaster); break;
                case 'packaging': packagingMaster = newOrder; renderSimpleMaster(packagingMaster); break;
                case 'unit': unitMaster = newOrder; renderSimpleMaster(unitMaster); break;
                case 'driver': driverMaster = newOrder; renderSimpleMaster(driverMaster); break;
                case 'vehicle': vehicleMaster = newOrder; renderSimpleMaster(vehicleMaster); break;
            }
        }

        // シンプルマスタアイテム追加
        function addSimpleMasterItem() {
            const input = document.getElementById('simpleMasterInput');
            const value = input.value.trim();
            if (!value) return;
            
            switch(currentMasterType) {
                case 'cargo': cargoMaster.push(value); renderSimpleMaster(cargoMaster); break;
                case 'packaging': packagingMaster.push(value); renderSimpleMaster(packagingMaster); break;
                case 'unit': unitMaster.push(value); renderSimpleMaster(unitMaster); break;
                case 'driver': driverMaster.push(value); renderSimpleMaster(driverMaster); break;
                case 'vehicle': vehicleMaster.push(value); renderSimpleMaster(vehicleMaster); break;
            }
            
            input.value = '';
        }

        // シンプルマスタアイテム削除
        function deleteSimpleMasterItem(index) {
            switch(currentMasterType) {
                case 'cargo': cargoMaster.splice(index, 1); renderSimpleMaster(cargoMaster); break;
                case 'packaging': packagingMaster.splice(index, 1); renderSimpleMaster(packagingMaster); break;
                case 'unit': unitMaster.splice(index, 1); renderSimpleMaster(unitMaster); break;
                case 'driver': driverMaster.splice(index, 1); renderSimpleMaster(driverMaster); break;
                case 'vehicle': vehicleMaster.splice(index, 1); renderSimpleMaster(vehicleMaster); break;
            }
        }

        // シンプルマスタモーダル閉じる
        function closeSimpleMaster() {
            document.getElementById('simpleMasterModal').style.display = 'none';
            document.getElementById('simpleMasterInput').value = '';
        }

        // シンプルマスタ保存
        async function saveSimpleMaster() {
            let masterData = [];
            
            switch(currentMasterType) {
                case 'cargo': 
                    localStorage.setItem('cargoMaster', JSON.stringify(cargoMaster));
                    masterData = cargoMaster;
                    break;
                case 'packaging': 
                    localStorage.setItem('packagingMaster', JSON.stringify(packagingMaster));
                    masterData = packagingMaster;
                    break;
                case 'unit': 
                    localStorage.setItem('unitMaster', JSON.stringify(unitMaster));
                    masterData = unitMaster;
                    break;
                case 'driver': 
                    localStorage.setItem('driverMaster', JSON.stringify(driverMaster));
                    masterData = driverMaster;
                    break;
                case 'vehicle': 
                    localStorage.setItem('vehicleMaster', JSON.stringify(vehicleMaster));
                    masterData = vehicleMaster;
                    break;
            }
            
            // Supabaseにも保存
            await cloudSaveSimpleMaster(currentMasterType, masterData);
            
            updateSelectOptions();
            setupFilters(); // フィルターを更新
            closeSimpleMaster();
            alert(`${document.getElementById('simpleMasterTitle').textContent.replace('管理', '')}を保存しました`);
        }

        // シンプルマスタCSV出力
        async function exportSimpleMasterCSV() {
            let masterData, masterName;
            switch(currentMasterType) {
                case 'cargo': masterData = cargoMaster; masterName = '積荷マスタ'; break;
                case 'packaging': masterData = packagingMaster; masterName = '荷姿マスタ'; break;
                case 'unit': masterData = unitMaster; masterName = '単位マスタ'; break;
                case 'driver': masterData = driverMaster; masterName = 'ドライバーマスタ'; break;
                case 'vehicle': masterData = vehicleMaster; masterName = '車両マスタ'; break;
                default: alert('マスタタイプが不明です'); return;
            }
            
            const headers = ['名称'];
            let csv = headers.join(',') + CSV_CRLF;
            masterData.forEach(item => {
                // 文字列配列とオブジェクト配列の両方に対応
                const name = typeof item === 'string' ? item : item.name;
                csv += `"${name}"\n`;
            });
            
            const blob = new Blob([CSV_BOM + csv], { type: 'text/csv;charset=utf-8;' });
            const date = new Date();
            const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
            const fname = `${masterName}_${dateStr}.csv`;
            
            if (await saveCsvToDir(blob, fname)) {
                alert('CSVを保存しました（設定フォルダ）');
                return;
            }
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fname;
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        }

        // シンプルマスタCSV取込
        function importSimpleMasterCSV(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            let masterData, masterName;
            switch(currentMasterType) {
                case 'cargo': masterData = cargoMaster; masterName = '積荷マスタ'; break;
                case 'packaging': masterData = packagingMaster; masterName = '荷姿マスタ'; break;
                case 'unit': masterData = unitMaster; masterName = '単位マスタ'; break;
                case 'driver': masterData = driverMaster; masterName = 'ドライバーマスタ'; break;
                case 'vehicle': masterData = vehicleMaster; masterName = '車両マスタ'; break;
                default: alert('マスタタイプが不明です'); return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const text = e.target.result;
                    const lines = text.split('\n');
                    
                    // ヘッダー行をスキップ
                    const hasHeader = lines[0].includes('名称');
                    const startIndex = hasHeader ? 1 : 0;
                    
                    let importCount = 0;
                    let skipCount = 0;
                    
                    for (let i = startIndex; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;
                        
                        // CSVをパース（ダブルクォートに対応）
                        const nameVal = line.replace(/^"|"$/g, '').trim();
                        
                        if (!nameVal) {
                            skipCount++;
                            continue;
                        }
                        
                        // 重複チェック（文字列配列として扱う）
                        const exists = masterData.includes(nameVal);
                        if (!exists) {
                            masterData.push(nameVal);
                            importCount++;
                        } else {
                            skipCount++;
                        }
                    }
                    
                    // マスタデータを更新
                    switch(currentMasterType) {
                        case 'cargo': cargoMaster = masterData; break;
                        case 'packaging': packagingMaster = masterData; break;
                        case 'unit': unitMaster = masterData; break;
                        case 'driver': driverMaster = masterData; break;
                        case 'vehicle': vehicleMaster = masterData; break;
                    }
                    
                    renderSimpleMaster(masterData);
                    
                    // Supabaseに保存
                    if (cloudEnabled()) {
                        cloudSaveSimpleMaster(currentMasterType, masterData).then(() => {
                            logInfo('importSimpleMasterCSV', `${currentMasterType} saved to Supabase`);
                        }).catch(err => {
                            logError('importSimpleMasterCSV', `Failed to save ${currentMasterType} to Supabase`, err);
                        });
                    }
                    
                    alert(`${masterName}CSV取込完了\n追加: ${importCount}件\nスキップ: ${skipCount}件（重複または空）`);
                } catch (error) {
                    console.error('CSV取込エラー:', error);
                    alert('CSVファイルの読み込みに失敗しました');
                }
            };
            
            reader.readAsText(file);
            event.target.value = '';
        }

        // 顧客新規追加モーダルを開く
        function openAddCustomerModal() {
            const form = document.getElementById('customerAddForm');
            if (form) form.reset();
            document.getElementById('customerAddModal').style.display = 'block';
            const nameInput = document.getElementById('newCustomerName');
            if (nameInput) nameInput.focus();
        }

        // 顧客新規追加モーダルを閉じる
        function closeCustomerAddModal() {
            document.getElementById('customerAddModal').style.display = 'none';
        }

        // 顧客新規追加を保存
        function saveNewCustomer() {
            const name = document.getElementById('newCustomerName').value.trim();
            const address = document.getElementById('newCustomerAddress').value.trim();
            const tel = document.getElementById('newCustomerTel').value.trim();

            if (!name) {
                alert('顧客名は必須です');
                return;
            }

            // 同名重複チェック（名前ベース）
            const exists = customerMaster.some(c => c.name === name);
            if (exists) {
                alert('同名の顧客が既に存在します');
                return;
            }

            customerMaster.push({ name, address, tel });
            localStorage.setItem('customerMaster', JSON.stringify(customerMaster));
            renderCustomerMaster();
            setupFilters();
            // クラウド同期
            try { if (cloudEnabled()) cloudSaveCustomers(customerMaster).catch(e => logError('CLOUD_SAVE_CUSTOMERS', e)); } catch(_) {}
            closeCustomerAddModal();
            alert('顧客を追加しました');
        }

        // セレクトオプション更新
        function updateSelectOptions() {
            // 積荷
            const cargoSelect = document.getElementById('cargo');
            cargoSelect.innerHTML = '<option value="">選択してください</option>' +
                cargoMaster.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');

            // 荷姿
            const packagingSelect = document.getElementById('packaging');
            packagingSelect.innerHTML = '<option value="">選択してください</option>' +
                packagingMaster.map(p => `<option value="${escHtml(p)}">${escHtml(p)}</option>`).join('');

            // 単位
            const unitSelect = document.getElementById('unit');
            unitSelect.innerHTML = '<option value="">選択してください</option>' +
                unitMaster.map(u => `<option value="${escHtml(u)}">${escHtml(u)}</option>`).join('');

            // ドライバー
            const driverSelect = document.getElementById('driver');
            driverSelect.innerHTML = '<option value="">選択してください</option>' +
                driverMaster.map(d => `<option value="${escHtml(d)}">${escHtml(d)}</option>`).join('');

            // 車両
            const vehicleSelect = document.getElementById('vehicle');
            vehicleSelect.innerHTML = '<option value="">選択してください</option>' +
                vehicleMaster.map(v => `<option value="${escHtml(v)}">${escHtml(v)}</option>`).join('');
        }

        // 受注番号生成（同日・同プレフィックスの最大番号+1）
        function generateOrderNo() {
            const dateInput = document.getElementById('orderDate');
            const dateStr = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0];
            const [yearFull, monthRaw, dayRaw] = dateStr.split('-');
            const yy = String(yearFull || '').slice(2);
            const mm = String(monthRaw || '').padStart(2, '0');
            const dd = String(dayRaw || '').padStart(2, '0');
            const prefix = `R${yy}${mm}${dd}-`;
            let maxN = 0;
            if (Array.isArray(orders)) {
                for (const o of orders) {
                    const on = o && o.orderNo ? String(o.orderNo) : '';
                    if (on.startsWith(prefix)) {
                        const n = parseInt(on.slice(prefix.length), 10);
                        if (!Number.isNaN(n)) maxN = Math.max(maxN, n);
                    }
                }
            }
            const next = maxN + 1;
            const orderNo = `${prefix}${String(next).padStart(3, '0')}`;
            const input = document.getElementById('orderNo');
            if (input) input.value = orderNo;
        }

        // 金額計算（数量×単価から計算）
        function calculateAmount() {
            const quantity = parseFloat(document.getElementById('quantity').value) || 0;
            const unitPrice = parseFloat(document.getElementById('unitPrice').value) || 0;
            
            if (quantity && unitPrice) {
                const amountNet = quantity * unitPrice;
                const amountGross = Math.round(amountNet * 1.1);
                
                document.getElementById('amountNet').value = amountNet;
                document.getElementById('amountGross').value = amountGross;
            }
        }

        // 税別金額から税込金額を計算
        function calculateGrossFromNet() {
            const amountNet = parseFloat(document.getElementById('amountNet').value) || 0;
            const amountGross = Math.round(amountNet * 1.1);
            document.getElementById('amountGross').value = amountGross;
        }


        // 受注保存
        function saveOrder() {
            // フォーム入力値の取得と検証
            const orderNo = document.getElementById('orderNo').value;
            const orderDate = document.getElementById('orderDate').value;
            const customerName = document.getElementById('customerName').value;
            const pickupLocation = document.getElementById('pickupLocation').value;
            const deliveryLocation = document.getElementById('deliveryLocation').value;
            const cargo = document.getElementById('cargo').value;
            const quantity = document.getElementById('quantity').value;
            const unit = document.getElementById('unit').value;
            const packaging = document.getElementById('packaging').value;
            const unitPrice = document.getElementById('unitPrice').value;
            const amountNet = document.getElementById('amountNet').value;
            
            // 必須項目のチェック（数量、単位、単価は必須から除外）
            if (!orderNo || !orderDate || !customerName || !pickupLocation || !deliveryLocation || !cargo) {
                alert('必須項目を入力してください');
                return;
            }
            // 受注No重複チェック（編集時は自身を除外）
            const hasDup = orders.some(o => String(o.orderNo) === String(orderNo) && (!editingId || o.id !== editingId));
            if (hasDup) {
                alert('受注Noが既存データと重複しています。別の番号にしてください。');
                return;
            }
            
            const formData = {
                orderNo: orderNo,
                date: orderDate,
                customerName: customerName,
                pickupLocation: pickupLocation,
                pickupAddress: document.getElementById('pickupAddress').value,
                deliveryLocation: deliveryLocation,
                deliveryAddress: document.getElementById('deliveryAddress').value,
                deliveryTel: document.getElementById('deliveryTel').value,
                cargo: cargo,
                quantity: parseFloat(quantity) || 0,
                unit: unit || '',
                packaging: packaging || '',
                unitPrice: parseFloat(unitPrice) || 0,
                amountNet: parseFloat(amountNet) || 0,
                amountGross: parseFloat(document.getElementById('amountGross').value) || 0,
                instructions: document.getElementById('instructions').value,
                driver: document.getElementById('driver').value,
                vehicle: document.getElementById('vehicle').value
            };

            if (editingId) {
                // 既存データの更新（instructionSheet/invoiceSent/paymentReceived/orderCompleted は保持）
                const index = orders.findIndex(o => o.id === editingId);
                if (index !== -1) {
                    orders[index] = { ...orders[index], ...formData, id: editingId };
                }
            } else {
                // 新規データの追加（フラグは初期値false）
                formData.id = Date.now();
                formData.instructionSheet = false;
                formData.invoiceSent = false;
                formData.paymentReceived = false;
                formData.orderCompleted = false;
                orders.push(formData);
            }
            
            // データ保存と画面更新
            let savedOk = true;
            try { saveData(); } catch(e) { savedOk = false; logError('LOCAL_SAVE', e); }
            // クラウド保存（有効時）
            try {
                const target = editingId ? orders.find(o => o.id === editingId) : formData;
                if (cloudEnabled() && target) {
                    cloudUpsertOrder(target)
                        .then(() => { logInfo('CLOUD_SYNC', 'upsert ok', target.orderNo); showToast('Cloud同期完了'); try { flushCloudQueue(2); } catch(_){} })
                        .catch(err => { logError('CLOUD_SYNC', err); enqueueCloudOp('upsert', target); updateCloudStatusUI(false); showToast('Cloud同期に失敗（キューに追加）', 'error'); });
                }
            } catch(e) { logError('CLOUD_SYNC_UNCAUGHT', e); }
            
            // 登録した月に自動で切り替え
            const orderDateObj = new Date(orderDate);
            currentMonth = new Date(orderDateObj.getFullYear(), orderDateObj.getMonth(), 1);
            updateMonth();
            
            const prevScrollY = window.scrollY;
            renderTable();
            const prevSearch = document.getElementById('searchInput')?.value || '';
            const prevDateFilter = document.getElementById('dateFilter')?.value || '';
            const prevDriverFilter = document.getElementById('driverFilter')?.value || '';
            const prevCustomerFilterSearch = document.getElementById('customerFilterSearch')?.value || '';
            
            updateStats();
            setupFilters();
            
            if (document.getElementById('searchInput')) document.getElementById('searchInput').value = prevSearch;
            if (document.getElementById('dateFilter')) document.getElementById('dateFilter').value = prevDateFilter;
            if (document.getElementById('customerFilterSearch')) document.getElementById('customerFilterSearch').value = prevCustomerFilterSearch;
            if (document.getElementById('driverFilter')) {
                const driverSel = document.getElementById('driverFilter');
                const exists = Array.from(driverSel.options).some(opt => opt.value === prevDriverFilter);
                driverSel.value = exists ? prevDriverFilter : '';
            }
            
            filterTable();
            // 編集した行へスクロール＆フォーカス（行が非表示ならスクロール位置を復元）
            try {
                const targetId = editingId ? editingId : formData.id;
                setTimeout(() => {
                    const row = document.querySelector('#tableBody tr[data-order-id="' + targetId + '"]');
                    if (row && row.style.display !== 'none') {
                         row.scrollIntoView({ block: 'center', behavior: 'smooth' });
                         // 一時ハイライト（2秒程度で自動解除）
                         try {
                             row.classList.add('row-highlight');
                             setTimeout(() => { try { row.classList.remove('row-highlight'); } catch(_){} }, 2000);
                         } catch(_){}
                         const editBtn = row.querySelector('.btn.btn-sm.btn-primary');
                         if (editBtn) { try { editBtn.focus({ preventScroll: true }); } catch(_){} }
                     } else {
                         window.scrollTo({ top: prevScrollY, behavior: 'auto' });
                     }
                }, 0);
            } catch(_) { /* noop */ }
            closeModal();
            
            if (savedOk) { showToast(editingId ? '編集を保存しました' : '新規受注を保存しました'); } else { showToast('ローカル保存に失敗しました', 'error'); }
        }

        // 受注編集（idが取れない場合は行のdata-order-idからフォールバック）
        function editOrder(id, el) {
            // ▼▼▼ 診断ログ
            console.warn('[DBG-EDIT] editOrder called. id=' + id + ' type=' + typeof id + ' orders.length=' + orders.length);
            let order = orders.find(o => o.id === id);
            if (!order) {
                const btn = el || document.activeElement;
                const tr = btn && typeof btn.closest === 'function' ? btn.closest('tr') : null;
                const idAttr = tr ? tr.getAttribute('data-order-id') : null;
                console.warn('[DBG-EDIT] fallback: idAttr=' + idAttr);
                if (idAttr != null) {
                    order = orders.find(o => String(o.id) === String(idAttr));
                }
            }
            console.warn('[DBG-EDIT] order found=' + (!!order) + (order ? ' orderNo=' + order.orderNo : ''));
            if (!order) {
                showToast('受注データが見つかりません（id:' + id + '）', 'error');
                return;
            }
            
            editingId = order.id;
            document.getElementById('modalTitle').textContent = '受注編集';
            
            document.getElementById('orderNo').value = order.orderNo;
            document.getElementById('orderDate').value = order.date;
            document.getElementById('customerName').value = order.customerName;
            document.getElementById('pickupLocation').value = order.pickupLocation;
            document.getElementById('pickupAddress').value = order.pickupAddress || '';
            document.getElementById('deliveryLocation').value = order.deliveryLocation;
            document.getElementById('deliveryAddress').value = order.deliveryAddress || '';
            document.getElementById('deliveryTel').value = order.deliveryTel || '';
            document.getElementById('cargo').value = order.cargo;
            document.getElementById('quantity').value = order.quantity;
            document.getElementById('unit').value = order.unit;
            document.getElementById('packaging').value = order.packaging || '';
            document.getElementById('unitPrice').value = order.unitPrice;
            document.getElementById('amountNet').value = order.amountNet;
            document.getElementById('amountGross').value = order.amountGross;
            document.getElementById('instructions').value = order.instructions || '';
            document.getElementById('driver').value = order.driver || '';
            document.getElementById('vehicle').value = order.vehicle || '';
            
            document.getElementById('orderModal').style.display = 'block';
            const content = document.querySelector('#orderModal .modal-content');
            if (content) content.scrollTop = 0;
        }
// === 受注複製機能（idが取れない場合は行のdata-order-idからフォールバック） ===
function duplicateOrder(id, el) {
    let o = orders.find(x => x.id === id);
    if (!o) {
        const btn = el || document.activeElement;
        const tr = btn && typeof btn.closest === 'function' ? btn.closest('tr') : null;
        const idAttr = tr ? tr.getAttribute('data-order-id') : null;
        if (idAttr != null) {
            o = orders.find(x => String(x.id) === String(idAttr));
        }
    }
    if (!o) return;

    // 編集IDは新規として扱う
    editingId = null;

    // モーダルタイトルを変更
    document.getElementById('modalTitle').textContent = '受注複製';

    // モーダルを開く
    document.getElementById('orderForm').reset();
    document.getElementById('orderModal').style.display = 'block';
    const content = document.querySelector('#orderModal .modal-content');
    if (content) content.scrollTop = 0;

    // 元データをフォームに流し込み（必要箇所だけ引き継ぐ）
    document.getElementById('orderDate').value = '';
    document.getElementById('customerName').value = o.customerName || '';
    document.getElementById('pickupLocation').value = o.pickupLocation || '';
    document.getElementById('pickupAddress').value = o.pickupAddress || '';
    document.getElementById('deliveryLocation').value = o.deliveryLocation || '';
    document.getElementById('deliveryAddress').value = o.deliveryAddress || '';
    document.getElementById('deliveryTel').value = o.deliveryTel || '';
    document.getElementById('cargo').value = o.cargo || '';
    document.getElementById('quantity').value = o.quantity || '';
    document.getElementById('unit').value = o.unit || '';
    document.getElementById('packaging').value = o.packaging || '';
    document.getElementById('unitPrice').value = o.unitPrice || '';
    document.getElementById('amountNet').value = o.amountNet || '';
    document.getElementById('amountGross').value = o.amountGross || '';
    document.getElementById('instructions').value = o.instructions || '';
    document.getElementById('driver').value = '';
    document.getElementById('vehicle').value = '';

    // 新しい受注Noを採番（現在の注文日入力値に基づく）
    generateOrderNo();

    // オートコンプリートの候補を閉じる
    document.querySelectorAll('.autocomplete-list').forEach(list => list.classList.remove('active'));
}


        // 受注削除
        function deleteOrder(id) {
            if (!confirm('この受注を削除しますか？')) return;
            const target = orders.find(o => o.id === id);
            orders = orders.filter(o => o.id !== id);
            saveData();
            renderTable();
            updateStats();
            setupFilters();
            // クラウド同期
            if (target && cloudEnabled()) {
                cloudDeleteOrderByOrderNo(target.orderNo).catch(err => logError('CLOUD_DELETE', err));
            }
        }

        // 日付フォーマット
        function formatDate(dateStr) {
            const date = new Date(dateStr);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${month}/${day}`;
        }

        // フィルタ設定
        function setupFilters() {
            // ドライバーフィルターをマスタデータから生成
            document.getElementById('driverFilter').innerHTML = '<option value="">全ドライバー</option>' +
                driverMaster.map(d => `<option value="${escHtml(d)}">${escHtml(d)}</option>`).join('');

            // 顧客キーワード検索候補（datalist）を生成
            const customerList = document.getElementById('customerFilterList');
            if (customerList) {
                customerList.innerHTML = customerMaster.map(c => `<option value="${escHtml(c.name)}"></option>`).join('');
            }
        }

        // テーブルフィルタ
        function filterTable() {
            const search = document.getElementById('searchInput').value.toLowerCase();
            const dateFilter = document.getElementById('dateFilter').value;
            const driverFilter = document.getElementById('driverFilter').value;
            const customerFilterSearch = (document.getElementById('customerFilterSearch')?.value || '').toLowerCase();
            
            const rows = document.querySelectorAll('#tableBody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                const dateText = row.cells[1].textContent;
                const driver = row.cells[11].textContent;
                const customer = row.cells[2].textContent;
                
                let show = true;
                
                if (search && !text.includes(search)) show = false;
                if (dateFilter) {
                    const filterDate = new Date(dateFilter);
                    const rowDateStr = `${filterDate.getMonth() + 1}`.padStart(2, '0') + '/' + `${filterDate.getDate()}`.padStart(2, '0');
                    if (dateText !== rowDateStr) show = false;
                }
                if (driverFilter && !driver.includes(driverFilter)) show = false;
                if (customerFilterSearch && !customer.toLowerCase().includes(customerFilterSearch)) show = false;
                
                row.style.display = show ? '' : 'none';
            });
updateStatsFromView();  // ★フィルタ適用後の可視行で再集計

        }

        // 全選択切り替え
        function toggleSelectAll() {
            const selectAll = document.getElementById('selectAll');
            const checkboxes = document.querySelectorAll('#tableBody .order-checkbox');
            checkboxes.forEach(cb => cb.checked = selectAll.checked);
            updateRowSelection();
        }

        // 運行指示書印刷
        // 選択受注を取得して設定モーダルを開くエントリーポイント
        function printInstructions() {
            console.warn('[DBG-PRINT] printInstructions called');
            const checkboxes = document.querySelectorAll('#tableBody .order-checkbox:checked');
            console.warn('[DBG-PRINT] checked boxes count=' + checkboxes.length);
            const selected = [];
            checkboxes.forEach(cb => {
                const id = parseInt(cb.getAttribute('data-id'));
                if (!isNaN(id)) selected.push(id);
            });
            if (selected.length === 0) {
                showToast('印刷する受注を選択してください（行左端のチェックボックスにチェックを入れてください）', 'error');
                return;
            }
            const selectedOrders = orders.filter(o => selected.includes(o.id));
            console.warn('[DBG-PRINT] selectedOrders count=' + selectedOrders.length);
            openInstructionSettingsModal(selectedOrders);
        }

        // 運行指示書設定モーダル関連の変数
        let instructionOrders = [];
        let dispatchTimeValue = '';

        // 運行指示書設定モーダルを開く
        function openInstructionSettingsModal(selectedOrders) {
            instructionOrders = [...selectedOrders];
            
            // デフォルトの配車時間を設定（現在時刻）
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            document.getElementById('dispatchTime').value = `${hours}:${minutes}`;
            
            // 順序リストを生成
            renderOrderSequenceList();
            
            document.getElementById('instructionSettingsModal').style.display = 'flex';
        }

        // 運行指示書設定モーダルを閉じる
        function closeInstructionSettingsModal() {
            document.getElementById('instructionSettingsModal').style.display = 'none';
            instructionOrders = [];
        }

        // 順序リストを描画
        function renderOrderSequenceList() {
            const listContainer = document.getElementById('orderSequenceList');
            listContainer.innerHTML = '';
            
            instructionOrders.forEach((order, index) => {
                // undefinedチェック
                if (!order) {
                    console.warn(`instructionOrders[${index}] is undefined`);
                    return;
                }
                
                const item = document.createElement('div');
                item.className = 'order-sequence-item';
                item.draggable = true;
                item.dataset.index = index;
                
                item.innerHTML = `
                    <div class="drag-handle">≡</div>
                    <div class="order-number">${index + 1}.</div>
                    <div class="order-info">
                        <strong>${escHtml(order.customerName || order.customer_name || '（顧客名なし）')}</strong>
                        <span style="color: #666; margin-left: 10px;">${escHtml(order.orderNo || order.order_no || '')}</span>
                    </div>
                `;
                
                // ドラッグイベント
                item.addEventListener('dragstart', handleInstructionDragStart);
                item.addEventListener('dragover', handleInstructionDragOver);
                item.addEventListener('drop', handleInstructionDrop);
                item.addEventListener('dragend', handleInstructionDragEnd);
                
                listContainer.appendChild(item);
            });
        }

        // 運行指示書用ドラッグ開始
        let draggedElement = null;
        let draggedIndex = null;

        function handleInstructionDragStart(e) {
            draggedElement = e.currentTarget;
            draggedIndex = parseInt(e.currentTarget.dataset.index);
            e.currentTarget.style.opacity = '0.4';
        }

        // 運行指示書用ドラッグオーバー
        function handleInstructionDragOver(e) {
            if (e.preventDefault) {
                e.preventDefault();
            }
            e.dataTransfer.dropEffect = 'move';
            return false;
        }

        // 運行指示書用ドロップ
        function handleInstructionDrop(e) {
            if (e.stopPropagation) {
                e.stopPropagation();
            }
            
            const dropIndex = parseInt(e.currentTarget.dataset.index);
            
            // バリデーション：draggedIndexが有効か確認
            if (draggedIndex === null || draggedIndex === undefined || isNaN(draggedIndex)) {
                return false;
            }
            
            if (draggedIndex !== dropIndex && draggedIndex >= 0 && dropIndex >= 0) {
                // 配列の要素を入れ替え
                const draggedItem = instructionOrders[draggedIndex];
                if (draggedItem) {
                    instructionOrders.splice(draggedIndex, 1);
                    instructionOrders.splice(dropIndex, 0, draggedItem);
                    
                    // リストを再描画
                    renderOrderSequenceList();
                }
            }
            
            return false;
        }

        // 運行指示書用ドラッグ終了
        function handleInstructionDragEnd(e) {
            e.currentTarget.style.opacity = '1';
        }

        // 運行指示書を生成
        function generateInstructionSheet() {
            const dispatchTime = document.getElementById('dispatchTime').value;
            
            if (!dispatchTime) {
                alert('配車時間を入力してください');
                return;
            }
            
            dispatchTimeValue = dispatchTime;
            
            // モーダルを閉じる前にinstructionOrdersのコピーを作成
            const ordersToProcess = [...instructionOrders];
            
            // モーダルを閉じる
            closeInstructionSettingsModal();
            
            // 運行指示書を印刷（修正版）
            printInstructionsWithSettings(ordersToProcess, dispatchTimeValue);
        }
        // 配車時間と順序を設定した運行指示書を印刷（完全版）
        function printInstructionsWithSettings(printOrders, dispatchTime) {
            try {
            console.log('printInstructionsWithSettings開始:', printOrders, dispatchTime);
            // データ正規化: スネークケースとキャメルケースの両方に対応
            printOrders = printOrders.map(order => ({
                ...order,
                orderNo: order.orderNo || order.order_no || '',
                customerName: order.customerName || order.customer_name || '',
                pickupLocation: order.pickupLocation || order.pickup_location || '',
                pickupAddress: order.pickupAddress || order.pickup_address || '',
                deliveryLocation: order.deliveryLocation || order.delivery_location || '',
                deliveryAddress: order.deliveryAddress || order.delivery_address || '',
                deliveryTel: order.deliveryTel || order.delivery_tel || '',
                cargo: order.cargo || '',
                quantity: order.quantity || '',
                unit: order.unit || '',
                packaging: order.packaging || '',
                instructions: order.instructions || '',
                driver: order.driver || '',
                vehicle: order.vehicle || ''
            }));
            
            // ドライバー整合性チェック（空欄は除外）
            if (printOrders.length > 1) {
                const drivers = Array.from(new Set(
                    printOrders
                        .map(o => (o.driver || '').trim())
                        .filter(d => d.length > 0)
                ));
                if (drivers.length > 1) {
                    alert('複数選択時は同一ドライバーで印刷してください（空欄は除外）');
                    return;
                }
            }
            
            // 運行指示書の生成
            let printContent = `
                <!DOCTYPE html>
                <html lang="ja">
                <head>
                    <meta charset="UTF-8">
                    <title>運行指示書</title>
                    <style>
                        @page { 
                            size: A4; 
                            margin: 10mm 15mm;
                        }
                        body { 
                            font-family: 'MS Gothic', 'ＭＳ ゴシック', monospace; 
                            font-size: 10pt;
                            line-height: 1.3;
                            color: #000;
                        }
                        .page { 
                            page-break-after: always;
                            position: relative;
                            width: 100%;
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 8px;
                        }
                        .title {
                            font-size: 14pt;
                            font-weight: bold;
                            margin-bottom: 2px;
                        }
                        .company-info {
                            font-size: 9pt;
                            line-height: 1.2;
                        }
                        
                        /* 配車時間の表示スタイル */
                        .dispatch-time {
                            font-size: 11pt;
                            font-weight: bold;
                            margin: 10px 0 15px 0;
                            padding: 8px;
                            background: #ffffcc;
                            border: 2px solid #000;
                            text-align: center;
                        }
                        
                        /* 複数案件用のスタイル */
                        .multi-orders {
                            margin-top: 10px;
                        }
                        .order-section {
                            margin-bottom: 15px;
                            border: 2px solid #000;
                            padding: 5px;
                        }
                        .order-header-outside {
                            font-size: 12pt;
                            font-weight: bold;
                            margin: 6px 0 6px 0;
                            line-height: 1.4;
                        }
                        .compact-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 5px;
                            font-size: 9pt;
                        }
                        .compact-table th {
                            background: #eeeeee;
                            border: 1px solid #000;
                            padding: 2px 4px;
                            text-align: left;
                            width: 20%;
                            font-weight: normal;
                        }
                        .compact-table td {
                            border: 1px solid #000;
                            padding: 2px 4px;
                        }
                        .instructions-compact {
                            border: 1px solid #000;
                            padding: 3px 5px;
                            font-size: 8pt;
                            min-height: 25px;
                            margin-bottom: 5px;
                        }
                        
                        /* 標準指示事項と法令遵守の横並びコンテナ */
                        .bottom-section-container {
                            display: flex;
                            gap: 10px;
                            margin-top: 10px;
                        }
                        
                        /* 標準指示事項（複数案件用） */
                        .standard-instructions {
                            font-size: 7pt;
                            line-height: 1.4;
                            padding: 8px;
                            background: #f5f5f5;
                            border: 1px solid #000;
                            flex: 1;
                        }
                        
                        /* 法令遵守に基づく運行計画 */
                        .operation-plan {
                            border: 1px solid #000;
                            padding: 8px;
                            font-size: 8pt;
                            flex: 1;
                        }
                        .operation-plan-title {
                            font-size: 9pt;
                            font-weight: bold;
                            margin-bottom: 5px;
                        }
                        .plan-table {
                            width: 100%;
                        }
                        .plan-table td {
                            padding: 2px 0;
                            font-size: 7pt;
                            vertical-align: bottom;
                        }
                        .plan-label {
                            width: 30%;
                        }
                        .plan-value {
                            border-bottom: 1px solid #000;
                            width: 70%;
                        }
                        
                        /* 押印スペース */
                        .signature-area {
                            margin-top: 10px;
                            text-align: right;
                        }
                        .signature-box {
                            display: inline-block;
                            text-align: center;
                        }
                        .signature-label {
                            font-size: 9pt;
                            margin-bottom: 3px;
                        }
                        .signature-stamp {
                            border: 1px solid #000;
                            width: 60px;
                            height: 60px;
                            display: inline-block;
                        }
                        
                        /* フッター注記 */
                        .footer-note {
                            font-size: 8pt;
                            margin-top: 10px;
                            line-height: 1.3;
                        }
                    </style>
                </head>
                <body>
            `;
            
            // 複数案件を1枚にまとめる場合
            const MULTI_ORDERS_PER_PAGE = 4;
            
            for (let startIdx = 0; startIdx < printOrders.length; startIdx += MULTI_ORDERS_PER_PAGE) {
                const chunk = printOrders.slice(startIdx, startIdx + MULTI_ORDERS_PER_PAGE);
                const isLastPage = (startIdx + MULTI_ORDERS_PER_PAGE) >= printOrders.length;
                const isFirstPage = (startIdx === 0);

                printContent += `
                    <div class="page">
                        <div class="header">
                            <div class="title">運行指示書（貨物）</div>
                            <div class="company-info">
                                ${companyInfo.name}<br>
                                ${companyInfo.address}<br>
                                TEL・FAX ${companyInfo.tel}
                            </div>
                        </div>
                `;
                
                // 配車時間、ドライバー、車両、日付情報を1ページ目の最初の案件の上に表示
                if (isFirstPage && dispatchTime) {
                    const firstOrder = chunk[0];
                    const driverName = firstOrder.driver || '未定';
                    const vehicleName = firstOrder.vehicle || '未定';
                    // 日付表示（西暦なし、月/日+曜日）
                    let orderDate = '';
                    if (firstOrder.date) {
                        const date = new Date(firstOrder.date);
                        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
                        orderDate = `${date.getMonth() + 1}/${date.getDate()}(${dayOfWeek})`;
                    }
                    
                    printContent += `
                        <div class="dispatch-time">
                            <div style="display: flex; justify-content: space-around; align-items: center; flex-wrap: wrap;">
                                <div style="margin: 5px;"><strong>日付:</strong> ${orderDate}</div>
                                <div style="margin: 5px;"><strong>ドライバー:</strong> ${driverName}</div>
                                <div style="margin: 5px;"><strong>車両:</strong> ${vehicleName}</div>
                                <div style="margin: 5px;"><strong>1件目の配車時間:</strong> ${dispatchTime}</div>
                            </div>
                        </div>
                    `;
                }

                printContent += `<div class="multi-orders">`;

                // このページに載せる案件を表示
                chunk.forEach((order, idx) => {
                    const globalIdx = startIdx + idx;
                    const orderDate = order.date ? new Date(order.date).toLocaleDateString('ja-JP') : '';
                    
                    printContent += `
                        <div class="order-header-outside">
                            ${globalIdx + 1}件目: ${escHtml(order.customerName || '')} (${orderDate})
                        </div>
                        <div class="order-section">
                            <table class="compact-table">
                                <tr>
                                    <th>引取先</th>
                                    <td>${escHtml(order.pickupLocation || '')}</td>
                                    <th>配送先</th>
                                    <td>${escHtml(order.deliveryLocation || '')}</td>
                                </tr>
                                <tr>
                                    <th>引取住所</th>
                                    <td colspan="3">${escHtml(order.pickupAddress || '')}</td>
                                </tr>
                                <tr>
                                    <th>配送住所</th>
                                    <td colspan="3">${escHtml(order.deliveryAddress || '')}</td>
                                </tr>
                                <tr>
                                    <th>積荷</th>
                                    <td>${escHtml(order.cargo || '')}</td>
                                    <th>数量</th>
                                    <td>${escHtml(order.quantity || '')} ${escHtml(order.unit || '')}</td>
                                </tr>
                            </table>
                            <div class="instructions-compact">
                                <strong>指示事項:</strong> ${escHtml(order.instructions || '').replace(/\n/g, '<br>')}
                            </div>
                        </div>
                    `;
                });

                printContent += `</div>`;

                // 最終ページにのみ標準指示事項、法令遵守、押印スペース、フッター注記を表示
                if (isLastPage) {
                    printContent += `
                        <div class="bottom-section-container">
                            <div class="standard-instructions">
                                <strong>【標準指示事項】</strong><br>
                                ・法定速度・車間距離・シートベルト徹底<br>
                                ・連続運転4時間以内ごとに30分以上の休憩（分割可）<br>
                                ・荷崩れ防止／固縛確認、危険予測運転の徹底<br>
                                ・出発／帰庫時の点呼、酒気帯び無・体調良好を確認<br>
                                ・異常／事故／渋滞等は速やかに配車へ連絡<br>
                                <div style="margin-top: 10px; text-align: right;">
                                    <div style="display: inline-block; text-align: center;">
                                        <div style="font-size: 7pt; margin-bottom: 3px;">運行管理者　押印</div>
                                        <div style="border: 1px solid #000; width: 50px; height: 50px; display: inline-block;"></div>
                                    </div>
                                </div>
                                <div style="margin-top: 8px; font-size: 6pt; line-height: 1.3;">
                                    ※本指示書は輸送安全規則に沿った記載項目を含みます。点呼簿・運転日報と併せて保管してください。
                                </div>
                            </div>
                            
                            <div class="operation-plan">
                                <div class="operation-plan-title">法令遵守に基づく運行計画（現場記入可）</div>
                                <table class="plan-table">
                                    <tr>
                                        <td class="plan-label">出発予定</td>
                                        <td class="plan-value">&nbsp;</td>
                                    </tr>
                                    <tr>
                                        <td class="plan-label">到着予定</td>
                                        <td class="plan-value">&nbsp;</td>
                                    </tr>
                                    <tr>
                                        <td class="plan-label">運行経路・主な経由地（日時）</td>
                                        <td class="plan-value">&nbsp;</td>
                                    </tr>
                                    <tr>
                                        <td class="plan-label">注意が必要な箇所の位置</td>
                                        <td class="plan-value">&nbsp;</td>
                                    </tr>
                                    <tr>
                                        <td class="plan-label">休憩地点と時間</td>
                                        <td class="plan-value">&nbsp;</td>
                                    </tr>
                                    <tr>
                                        <td class="plan-label">交代地点</td>
                                        <td class="plan-value">&nbsp;</td>
                                    </tr>
                                    <tr>
                                        <td colspan="2" style="padding-top: 5px;">その他 安全確保に必要な事項</td>
                                    </tr>
                                    <tr>
                                        <td colspan="2" class="plan-value">&nbsp;</td>
                                    </tr>
                                </table>
                            </div>
                        </div>
                    `;
                }

                printContent += `</div>`;
            }

            printContent += `
                </body>
                </html>
            `;

            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                showToast('ポップアップがブロックされました。アドレスバー付近の「ポップアップを許可」をクリックしてください。', 'error');
                return;
            }
            printWindow.document.write(printContent);
            printWindow.document.close();

            setTimeout(() => {
                printWindow.print();
            }, 500);
            
            // 指示書発行フラグ更新
            printOrders.forEach(order => {
                order.instructionSheet = true;
            });
            saveData();
            // クラウド一括更新
            try {
                if (cloudEnabled()) {
                    const ids = printOrders.map(o => o.id).filter(id => id != null);
                    cloudBatchUpdate(ids, { instructionSheet: true });
                }
            } catch(e) {}
            renderTable();
            updateStats();
            } catch (error) {
                console.error('printInstructionsWithSettingsエラー:', error);
                alert('運行指示書の生成中にエラーが発生しました: ' + error.message);
            }
        }

        // 引取書印刷
        function printPickupSlips() {
            const checkboxes = document.querySelectorAll('#tableBody .order-checkbox:checked');
            
            const selected = [];
            checkboxes.forEach(cb => {
                const id = parseInt(cb.getAttribute('data-id'));
                if (!isNaN(id)) {
                    selected.push(id);
                }
            });
            
            if (selected.length === 0) {
                alert('印刷する受注を選択してください');
                return;
            }
            
            const printOrders = orders.filter(o => selected.includes(o.id));
            
            // 貨物引取書・荷渡書の生成
            let printContent = `
                <!DOCTYPE html>
                <html lang="ja">
                <head>
                    <meta charset="UTF-8">
                    <title>貨物引取書・荷渡書</title>
                    <style>
                        @page { 
                            size: A4; 
                            margin: 10mm;
                        }
                        body { 
                            font-family: 'MS Gothic', 'ＭＳ ゴシック', monospace; 
                            font-size: 10pt;
                            line-height: 1.3;
                            color: #000;
                        }
                        .page { 
                            page-break-after: always;
                            position: relative;
                        }
                        .slip {
                            border: 2px dashed #333;
                            padding: 12px;
                            margin-bottom: 15px;
                            position: relative;
                            height: 48%;
                        }
                        .slip-type {
                            position: absolute;
                            top: 8px;
                            right: 12px;
                            font-size: 9pt;
                        }
                        .title {
                            font-size: 14pt;
                            font-weight: bold;
                            text-align: center;
                            margin-bottom: 5px;
                        }
                        .company-info {
                            text-align: center;
                            font-size: 9pt;
                            line-height: 1.2;
                            margin-bottom: 8px;
                        }
                        .info-table {
                            width: 100%;
                            margin-bottom: 8px;
                        }
                        .info-table td {
                            padding: 2px 5px;
                            font-size: 9pt;
                        }
                        .main-table {
                            width: 100%;
                            border-collapse: collapse;
                            border: 1px solid #000;
                            margin-bottom: 8px;
                        }
                        .main-table th {
                            background: #d8d8d8;
                            border: 1px solid #000;
                            padding: 3px;
                            font-size: 9pt;
                            font-weight: normal;
                            text-align: center;
                        }
                        .main-table td {
                            border: 1px solid #000;
                            padding: 3px;
                            font-size: 9pt;
                            text-align: center;
                        }
                        .address-table {
                            width: 100%;
                            border-collapse: collapse;
                        }
                        .address-table td {
                            border: 1px solid #000;
                            padding: 4px 6px;
                            font-size: 9pt;
                        }
                        .address-label {
                            background: #d8d8d8;
                            width: 20%;
                            font-weight: normal;
                        }
                        .receipt-section {
                            margin-top: 10px;
                            border: 1px solid #000;
                            padding: 5px;
                        }
                        .receipt-title {
                            font-size: 9pt;
                            margin-bottom: 8px;
                        }
                        .receipt-table {
                            width: 100%;
                        }
                        .receipt-table td {
                            padding: 3px 0;
                            font-size: 9pt;
                        }
                        .underline {
                            display: inline-block;
                            border-bottom: 1px solid #000;
                            min-width: 150px;
                            margin: 0 5px;
                        }
                        .stamp-box {
                            display: inline-block;
                            border: 1px solid #000;
                            width: 40px;
                            height: 40px;
                            vertical-align: bottom;
                            margin-left: 10px;
                        }
                        .cut-line {
                            border-top: 1px dotted #666;
                            margin: 10px 0;
                            position: relative;
                            height: 0;
                        }
                    </style>
                </head>
                <body>
            `;
            
            // 各受注ごとに貨物引取書・荷渡書を生成
            printOrders.forEach((order, index) => {
                const orderDate = new Date(order.date);
                const formattedDate = `${orderDate.getFullYear()}/${(orderDate.getMonth() + 1).toString().padStart(2, '0')}/${orderDate.getDate().toString().padStart(2, '0')}`;
                
                printContent += `
                    <div class="page">
                        <!-- お客様控え -->
                        <div class="slip">
                            <div class="slip-type">《お客様控》</div>
                            <div class="title">貨物引取書・荷渡書</div>
                            <div class="company-info">
                                ${companyInfo.name}《お客様控》<br>
                                ${companyInfo.address}<br>
                                TEL・FAX ${companyInfo.tel}
                            </div>
                            
                            <table class="info-table">
                                <tr>
                                    <td style="width: 15%;">配達日</td>
                                    <td style="width: 35%;"><strong>${formattedDate}</strong></td>
                                    <td style="width: 15%;">車番</td>
                                    <td style="width: 35%;"><strong>${order.vehicle || ''}</strong></td>
                                </tr>
                                <tr>
                                    <td>運転者</td>
                                    <td colspan="3"><strong>${order.driver || ''}</strong></td>
                                </tr>
                            </table>
                            
                            <table class="address-table" style="margin-bottom: 4px;">
                                <tr>
                                    <td class="address-label">引取先</td>
                                    <td>${escHtml(order.pickupLocation)} 様<br><span style="font-size: 8pt;">${escHtml(order.pickupAddress || '')}</span></td>
                                </tr>
                            </table>
                            
                            <table class="address-table" style="margin-bottom: 4px;">
                                <tr>
                                    <td class="address-label">荷渡先</td>
                                    <td>${escHtml(order.deliveryLocation)} 様<br><span style="font-size: 8pt;">${escHtml(order.deliveryAddress || '')}</span></td>
                                </tr>
                            </table>
                            
                            <table class="address-table" style="margin-bottom: 8px;">
                                <tr>
                                    <td class="address-label">ご依頼主</td>
                                    <td>${escHtml(order.customerName)} 様</td>
                                </tr>
                            </table>
                            
                            <table class="main-table">
                                <tr>
                                    <th style="width: 16%;">品名</th>
                                    <th style="width: 14%;">品種</th>
                                    <th style="width: 14%;">規格</th>
                                    <th style="width: 14%;">荷姿</th>
                                    <th style="width: 14%;">個数</th>
                                    <th style="width: 14%;">単位</th>
                                </tr>
                                <tr>
                                    <td>${escHtml(order.cargo)}</td>
                                    <td></td>
                                    <td></td>
                                    <td>${escHtml(order.packaging || '')}</td>
                                    <td>${escHtml(order.quantity)}</td>
                                    <td>${escHtml(order.unit)}</td>
                                </tr>
                                <tr style="height: 20px;">
                                    <td>&nbsp;</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td colspan="4" style="text-align: right; background: #d8d8d8;">合計</td>
                                    <td style="font-weight: bold;">${order.quantity}</td>
                                    <td style="font-weight: bold;">${order.unit}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div class="cut-line"></div>
                        
                        <!-- 原本（保管用） -->
                        <div class="slip">
                            <div class="slip-type">《原本（保管用）》</div>
                            <div class="title">貨物引取書・荷渡書</div>
                            <div class="company-info">
                                ${companyInfo.name}《原本（保管用）》<br>
                                ${companyInfo.address}<br>
                                TEL・FAX ${companyInfo.tel}
                            </div>
                            
                            <table class="info-table">
                                <tr>
                                    <td style="width: 15%;">配達日</td>
                                    <td style="width: 35%;"><strong>${formattedDate}</strong></td>
                                    <td style="width: 15%;">車番</td>
                                    <td style="width: 35%;"><strong>${order.vehicle || ''}</strong></td>
                                </tr>
                                <tr>
                                    <td>運転者</td>
                                    <td colspan="3"><strong>${order.driver || ''}</strong></td>
                                </tr>
                            </table>
                            
                            <table class="address-table" style="margin-bottom: 4px;">
                                <tr>
                                    <td class="address-label">引取先</td>
                                    <td>${escHtml(order.pickupLocation)} 様<br><span style="font-size: 8pt;">${escHtml(order.pickupAddress || '')}</span></td>
                                </tr>
                            </table>
                            
                            <table class="address-table" style="margin-bottom: 4px;">
                                <tr>
                                    <td class="address-label">荷渡先</td>
                                    <td>${escHtml(order.deliveryLocation)} 様<br><span style="font-size: 8pt;">${escHtml(order.deliveryAddress || '')}</span></td>
                                </tr>
                            </table>
                            
                            <table class="address-table" style="margin-bottom: 8px;">
                                <tr>
                                    <td class="address-label">ご依頼主</td>
                                    <td>${escHtml(order.customerName)} 様</td>
                                </tr>
                            </table>
                            
                            <table class="main-table" style="margin-bottom: 8px;">
                                <tr>
                                    <th style="width: 16%;">品名</th>
                                    <th style="width: 14%;">品種</th>
                                    <th style="width: 14%;">規格</th>
                                    <th style="width: 14%;">荷姿</th>
                                    <th style="width: 14%;">個数</th>
                                    <th style="width: 14%;">単位</th>
                                </tr>
                                <tr>
                                    <td>${escHtml(order.cargo)}</td>
                                    <td></td>
                                    <td></td>
                                    <td>${escHtml(order.packaging || '')}</td>
                                    <td>${escHtml(order.quantity)}</td>
                                    <td>${escHtml(order.unit)}</td>
                                </tr>
                                <tr style="height: 20px;">
                                    <td>&nbsp;</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td colspan="4" style="text-align: right; background: #d8d8d8;">合計</td>
                                    <td style="font-weight: bold;">${order.quantity}</td>
                                    <td style="font-weight: bold;">${order.unit}</td>
                                </tr>
                            </table>
                            
                            <div class="receipt-section">
                                <div class="receipt-title">受領確認（お客様ご記入）</div>
                                <table class="receipt-table">
                                    <tr>
                                        <td style="width: 30%;">・受領者氏名（署名）：</td>
                                        <td>
                                            <span class="underline">&nbsp;</span>
                                            様印：<span class="stamp-box"></span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>・日付：</td>
                                        <td>
                                            <span style="display: inline-block; border-bottom: 1px solid #000; width: 60px;">&nbsp;</span>年
                                            <span style="display: inline-block; border-bottom: 1px solid #000; width: 40px;">&nbsp;</span>月
                                            <span style="display: inline-block; border-bottom: 1px solid #000; width: 40px;">&nbsp;</span>日
                                        </td>
                                    </tr>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            printContent += '</body></html>';
            
            const printWindow = window.open('', '_blank', 'width=800,height=600');
            if (!printWindow) {
                showToast('ポップアップがブロックされました。アドレスバー付近の「ポップアップを許可」をクリックしてください。', 'error');
                return;
            }
            printWindow.document.write(printContent);
            printWindow.document.close();
            setTimeout(() => {
                printWindow.print();
            }, PRINT_DELAY_MS);
        }

        // 社内用CSVを当月受注から生成（BOM付、数値は正規化）
        async function exportCSV() {
            // CSV形式の選択ダイアログを表示（モーダルUI）
            const fmt = await showCsvFormatDialog();
            if (fmt === null) return; // キャンセル

            const monthOrders = getMonthOrders();
            let headers, csv, fname;

            if (fmt === 'supabase') {
                // Supabase形式
                headers = ['order_no', 'date', 'customer_name', 'pickup_location', 'pickup_address', 'delivery_location', 'delivery_address', 'delivery_tel', 'cargo', 'quantity', 'unit', 'packaging', 'unit_price', 'amount_net', 'amount_gross', 'driver', 'vehicle', 'instructions', 'instruction_sheet', 'invoice_sent', 'payment_received', 'order_completed'];
                
                csv = headers.join(',') + CSV_CRLF;
                monthOrders.forEach(order => {
                    const row = [
                        order.orderNo || '',
                        order.date || '',
                        order.customerName || '',
                        order.pickupLocation || '',
                        order.pickupAddress || '',
                        order.deliveryLocation || '',
                        order.deliveryAddress || '',
                        order.deliveryTel || '',
                        order.cargo || '',
                        order.quantity || '',
                        order.unit || '',
                        order.packaging || '',
                        toNumber(order.unitPrice) || '',
                        toNumber(order.amountNet) || '',
                        toNumber(order.amountGross) || '',
                        order.driver || '',
                        order.vehicle || '',
                        order.instructions || '',
                        order.instructionSheet ? 'true' : 'false',
                        order.invoiceSent ? 'true' : 'false',
                        order.paymentReceived ? 'true' : 'false',
                        order.orderCompleted ? 'true' : 'false'
                    ];
                    csv += row.map(v => csvQ(v)).join(',') + CSV_CRLF;
                });
                fname = `受注明細_Supabase形式_${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月.csv`;
            } else { // fmt === 'internal'
                // 社内用形式（全項目対応）
                headers = ['受注番号', '日付', '顧客名', '引取先', '引取先住所', '配送先', '配送先住所', '配送先電話番号', '積荷', '数量', '単位', '荷姿', '単価', '金額(税別)', '金額(税込)', 'ドライバー', '車両', '備考', '指示書', '請求済', '入金済', '完了'];
                
                csv = headers.join(',') + CSV_CRLF;
                monthOrders.forEach(order => {
                    const row = [
                        order.orderNo || '',
                        order.date || '',
                        order.customerName || '',
                        order.pickupLocation || '',
                        order.pickupAddress || '',
                        order.deliveryLocation || '',
                        order.deliveryAddress || '',
                        order.deliveryTel || '',
                        order.cargo || '',
                        order.quantity || '',
                        order.unit || '',
                        order.packaging || '',
                        toNumber(order.unitPrice) || '',
                        toNumber(order.amountNet) || '',
                        toNumber(order.amountGross) || '',
                        order.driver || '',
                        order.vehicle || '',
                        order.instructions || '',
                        order.instructionSheet ? 'true' : 'false',
                        order.invoiceSent ? 'true' : 'false',
                        order.paymentReceived ? 'true' : 'false',
                        order.orderCompleted ? 'true' : 'false'
                    ];
                    csv += row.map(v => csvQ(v)).join(',') + CSV_CRLF;
                });
                fname = `受注明細_${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月.csv`;
            }

            const blob = new Blob([CSV_BOM + csv], { type: 'text/csv;charset=utf-8;' });
            // 案件CSV フォルダへ保存（フォルダ設定済みなら）
            if (await saveCsvToDir(blob, fname)) {
                alert('CSVを保存しました（設定フォルダ）');
                return;
            }
            // フォールバック：通常ダウンロード
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fname;
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        }

        // CSVインポート（ヘッダーマッピング機能付き、Supabase自動同期）
        function importCSV(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                const lines = text.split('\n');
                const csvHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                
                // ヘッダーマッピング定義
                const headerMapping = {
                    // Supabase形式
                    'order_no': 'orderNo',
                    'date': 'date',
                    'customer_name': 'customerName',
                    'pickup_location': 'pickupLocation',
                    'pickup_address': 'pickupAddress',
                    'delivery_location': 'deliveryLocation',
                    'delivery_address': 'deliveryAddress',
                    'delivery_tel': 'deliveryTel',
                    'cargo': 'cargo',
                    'quantity': 'quantity',
                    'unit': 'unit',
                    'packaging': 'packaging',
                    'unit_price': 'unitPrice',
                    'amount_net': 'amountNet',
                    'amount_gross': 'amountGross',
                    'driver': 'driver',
                    'vehicle': 'vehicle',
                    'instructions': 'instructions',
                    'instruction_sheet': 'instructionSheet',
                    'invoice_sent': 'invoiceSent',
                    'payment_received': 'paymentReceived',
                    'order_completed': 'orderCompleted',
                    // 社内用形式（全項目対応）
                    '受注番号': 'orderNo',
                    '日付': 'date',
                    '顧客名': 'customerName',
                    '引取先': 'pickupLocation',
                    '引取先住所': 'pickupAddress',
                    '配送先': 'deliveryLocation',
                    '配送先住所': 'deliveryAddress',
                    '配送先電話番号': 'deliveryTel',
                    '積荷': 'cargo',
                    '数量': 'quantity',
                    '単位': 'unit',
                    '荷姿': 'packaging',
                    '単価': 'unitPrice',
                    '金額(税別)': 'amountNet',
                    '金額(税込)': 'amountGross',
                    'ドライバー': 'driver',
                    '車両': 'vehicle',
                    '備考': 'instructions',
                    '指示書': 'instructionSheet',
                    '請求済': 'invoiceSent',
                    '入金済': 'paymentReceived',
                    '完了': 'orderCompleted'
                };
                
                // ヘッダーのマッピング
                const mappedHeaders = csvHeaders.map(header => headerMapping[header] || null);
                const importedOrders = [];
                
                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i]) continue;
                    
                    const cleanValues = parseCsvLine(lines[i]).map(v => v.trim());
                    
                    // マッピングされたデータオブジェクトを作成
                    const order = {
                        id: Date.now() + i,
                        orderNo: '',
                        date: '',
                        customerName: '',
                        pickupLocation: '',
                        pickupAddress: '',
                        deliveryLocation: '',
                        deliveryAddress: '',
                        deliveryTel: '',
                        cargo: '',
                        quantity: 0,
                        unit: '',
                        packaging: '',
                        unitPrice: 0,
                        amountNet: 0,
                        amountGross: 0,
                        driver: '',
                        vehicle: '',
                        instructions: '',
                        instructionSheet: false,
                        invoiceSent: false,
                        paymentReceived: false,
                        orderCompleted: false
                    };
                    
                    // マッピングに従ってデータを割り当て
                    mappedHeaders.forEach((mappedHeader, index) => {
                        if (mappedHeader && cleanValues[index]) {
                            const value = cleanValues[index];
                            if (mappedHeader === 'quantity' || mappedHeader === 'unitPrice' || mappedHeader === 'amountNet' || mappedHeader === 'amountGross') {
                                order[mappedHeader] = parseFloat(value) || 0;
                            } else if (mappedHeader === 'instructionSheet' || mappedHeader === 'invoiceSent' || mappedHeader === 'paymentReceived' || mappedHeader === 'orderCompleted') {
                                order[mappedHeader] = value === 'true' || value === '1' || value === 'TRUE';
                            } else {
                                order[mappedHeader] = value;
                            }
                        }
                    });
                    
                    // orderNoが空の場合は自動生成
                    if (!order.orderNo) {
                        order.orderNo = `R${new Date().getFullYear().toString().slice(2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${(orders.length + i).toString().padStart(3, '0')}`;
                    }
                    
                    // 受注No重複チェック（既存データを上書き更新）
                    const dupIdx = orders.findIndex(o => String(o.orderNo) === String(order.orderNo));
                    if (dupIdx !== -1) {
                        orders[dupIdx] = { ...orders[dupIdx], ...order, id: orders[dupIdx].id };
                    } else {
                        orders.push(order);
                    }
                    importedOrders.push(order);
                }
                
                saveData();
                renderTable();
                updateStats();
                setupFilters();
                
                // Supabase自動同期（クラウド有効の場合のみ）
                if (cloudEnabled() && importedOrders.length > 0) {
                    (async () => {
                        try {
                            for (const order of importedOrders) {
                                try {
                                    await cloudUpsertOrder(order);
                                } catch(err) {
                                    console.error('Cloud同期エラー:', err);
                                }
                            }
                            showToast(`CSVインポート完了、Supabase同期完了（${importedOrders.length}件）`, 'success');
                        } catch(err) {
                            console.error('CSVインポート同期エラー:', err);
                        }
                    })();
                } else {
                    alert(`CSVファイルをインポートしました（${lines.length - 1}件）`);
                }
            };
            
            reader.readAsText(file);
            event.target.value = '';
        }

        // 顧客マスタCSVエクスポート
        async function exportCustomerCSV() {
            const headers = ['顧客名', '住所', '電話番号'];
            
            let csv = headers.join(',') + CSV_CRLF;
            customerMaster.forEach(customer => {
                const row = [
                    customer.name,
                    customer.address,
                    customer.tel
                ];
                csv += row.map(v => csvQ(v)).join(',') + CSV_CRLF;
            });
            
            const blob = new Blob([CSV_BOM + csv], { type: 'text/csv;charset=utf-8;' });
            const date = new Date();
            const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
            const fname = `顧客マスタ_${dateStr}.csv`;
            if (await saveCsvToDir(blob, fname)) {
                alert('CSVを保存しました（設定フォルダ）');
                return;
            }
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fname;
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        }

        // 顧客マスタCSVインポート
        function importCustomerCSV(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const text = e.target.result;
                    const lines = text.split('\n');
                    
                    // ヘッダー行をスキップ
                    const hasHeader = lines[0].includes('顧客名') || lines[0].includes('住所') || lines[0].includes('電話番号');
                    const startIndex = hasHeader ? 1 : 0;
                    
                    let importCount = 0;
                    let skipCount = 0;
                    
                    for (let i = startIndex; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;
                        
                        // CSVをパース（RFC 4180準拠）
                        const cleanValues = parseCsvLine(line).map(v => v.trim());
                        
                        // 列不足は空文字で補完（住所・電話が空でも取り込む）
                        const nameVal = cleanValues[0] ?? '';
                        const addressVal = cleanValues[1] ?? '';
                        const telVal = cleanValues[2] ?? '';

                        const newCustomer = {
                            name: nameVal,
                            address: addressVal,
                            tel: telVal
                        };
                        
                        // 重複チェック（顧客名が同じものは追加しない）
                        const exists = customerMaster.some(c => c.name === newCustomer.name);
                        if (!exists && newCustomer.name) {
                            customerMaster.push(newCustomer);
                            importCount++;
                        } else {
                            skipCount++;
                        }
                    }
                    
                    // マスタを保存して画面を更新
                    localStorage.setItem('customerMaster', JSON.stringify(customerMaster));
                    renderCustomerMaster();
                    setupFilters(); // フィルターを更新
                    
                    // Supabaseに保存
                    if (cloudEnabled()) {
                        cloudSaveCustomers(customerMaster).then(() => {
                            logInfo('importCustomerCSV', 'Saved to Supabase');
                        }).catch(err => {
                            logError('importCustomerCSV', 'Failed to save to Supabase', err);
                        });
                    }
                    
                    // 結果を表示
                    let message = `CSVインポート完了\n`;
                    message += `追加: ${importCount}件`;
                    if (skipCount > 0) {
                        message += `\nスキップ: ${skipCount}件（重複または不正なデータ）`;
                    }
                    alert(message);
                    
                } catch (error) {
                    alert('CSVファイルの読み込みに失敗しました。\nファイル形式を確認してください。');
                    // エラーはアラートで通知（不要なコンソール出力は削除）
                }
            };
            
            reader.readAsText(file);
            event.target.value = ''; // 同じファイルを再度選択できるようにリセット
        }

// マネーフォワード請求書CSVを当月受注から生成（列順固定・源泉徴収一括指定）
async function exportInvoiceCSV() {
  const orders = (typeof getMonthOrders === 'function') ? getMonthOrders() : [];
  if (!orders || orders.length === 0) {
    alert('出力するデータがありません（当月の受注が0件）');
    return;
  }

  // MFサンプルCSVの1行目（40列）と完全一致
  const HEADERS = [
    'csv_type(変更不可)', '行形式', '取引先名称', '件名', '請求日', 'お支払期限', '請求書番号', '売上計上日',
    'メモ', 'タグ', '小計', '消費税', '源泉徴収税', '合計金額', '取引先敬称', '取引先郵便番号',
    '取引先都道府県', '取引先住所1', '取引先住所2', '取引先部署', '取引先担当者役職', '取引先担当者氏名',
    '自社担当者氏名', '備考', '振込先', '入金ステータス', 'メール送信ステータス', '郵送ステータス',
    'ダウンロードステータス', '納品日', '品名', '品目コード', '単価', '数量', '単位', '納品書番号',
    '詳細', '金額', '源泉徴収', '品目消費税率'
  ];

  // 共有定数を使用（CSV改行・BOM・源泉徴収指定）

  // 常時クォート
  const q = (v) => `"${String(v ?? '').replace(/"/g,'""')}"`;

  // 数値変換は共有ユーティリティ toNumber を使用

  const y = currentMonth.getFullYear();
  const m = currentMonth.getMonth() + 1;
  const yyyymm = `${y}${String(m).padStart(2,'0')}`;

  // 日付フォーマットは共有ユーティリティ fmtDate を使用

  // 請求日＝当月末、支払期限＝翌月末
  const lastDayOfMonth = new Date(y, m, 0);
  const invoiceDate = `${y}/${String(m).padStart(2,'0')}/${String(lastDayOfMonth.getDate()).padStart(2,'0')}`;
  const dueDate = (() => {
    const ny = m === 12 ? y+1 : y;
    const nm = m === 12 ? 1 : (m+1);
    const last = new Date(ny, nm, 0);
    return `${ny}/${String(nm).padStart(2,'0')}/${String(last.getDate()).padStart(2,'0')}`;
  })();

  // 顧客ごとに集計
  const byCustomer = {};
  orders.forEach(o => {
    const key = o.customerName || '(不明顧客)';
    if (!byCustomer[key]) byCustomer[key] = { items: [], net:0, gross:0, tax:0 };
    const item = {
      date: fmtDate(o.date),
      cargo: o.cargo || '',
      pickup: o.pickupLocation || '',
      delivery: o.deliveryLocation || '',
      instructions: o.instructions || '',
      unitPrice: toNumber(o.unitPrice),
      quantity : toNumber(o.quantity),
      unit     : o.unit || '',
      packaging: o.packaging || '',
      amountNet: toNumber(o.amountNet),
      amountGross: toNumber(o.amountGross)
    };
    byCustomer[key].items.push(item);
    byCustomer[key].net   += item.amountNet;
    byCustomer[key].gross += item.amountGross;
    byCustomer[key].tax   += (item.amountGross - item.amountNet);
  });

  // 行生成：オブジェクト → HEADERS順に並べて出力（ズレ防止）
  const rowFrom = (obj) => HEADERS.map(h => q(obj[h]));

  const rows = [];
  rows.push(HEADERS.map(q));

  let invSeq = 0;
  let detailCount = 0;

  Object.entries(byCustomer).forEach(([customerName, sum]) => {
    if (!sum.items.length) return;
    invSeq += 1;
    const invoiceNo = `${yyyymm}-${String(invSeq).padStart(3,'0')}`;

    // 1) 請求書行（マスタ）
    const master = {
      'csv_type(変更不可)': '40101',
      '行形式': '請求書',
      '取引先名称': customerName,
      '件名': `${y}年${m}月分 運送料`,
      '請求日': invoiceDate,
      'お支払期限': dueDate,
      '請求書番号': invoiceNo,
      '売上計上日': invoiceDate,
      '小計': byCustomer[customerName].net,
      '消費税': byCustomer[customerName].tax,
      '合計金額': byCustomer[customerName].gross,
      '備考': `配送実績: ${sum.items.length}件`,
      '源泉徴収': MF_WITHHOLDING // ★ここが必ず入る
      // 他の列は未指定なら空文字になる
    };
    rows.push(rowFrom(master));

    // 2) 品目行（明細）
    sum.items.sort((a,b)=> new Date(a.date.replace(/\//g,'-')) - new Date(b.date.replace(/\//g,'-')));
    sum.items.forEach(it => {
      const d = it.date ? new Date(it.date.replace(/\//g,'-')) : null;
      const md = d && !isNaN(d) ? `${d.getMonth()+1}/${d.getDate()}` : '';
      const itemName = `${md} ${it.cargo}運送`.trim();
      const pLoc = it.pickup ? (String(it.pickup).endsWith('様') ? it.pickup : `${it.pickup} 様`) : '';
      const dLoc = it.delivery ? (String(it.delivery).endsWith('様') ? it.delivery : `${it.delivery} 様`) : '';
      const detail = `${pLoc}→${dLoc}`;

      const itemRow = {
        'csv_type(変更不可)': '40101',
        '行形式': '品目',
        '納品日': it.date,
        '品名': itemName,
        '単価': it.unitPrice,
        '数量': it.quantity,
        '単位': it.unit,
        '詳細': detail,
        '金額': it.amountNet,
        '源泉徴収': MF_WITHHOLDING, // ★ここも必ず入る
        '品目消費税率': TAX_RATE_STR
      };
      rows.push(rowFrom(itemRow));
      detailCount++;
    });
  });

  if (detailCount === 0) {
    alert('出力する明細がありません（全て0円か未入力の可能性）');
    return;
  }

  // 取り込み前のセルフチェック（源泉徴収が空の行があれば中断）
  const colIdx = HEADERS.indexOf('源泉徴収');
  const firstBad = rows.findIndex((r, i) => i>0 && r[colIdx] === '""'); // 先頭はヘッダーなので除外
  if (firstBad !== -1) {
    alert(`内部検証: ${firstBad} 行目の「源泉徴収」が空です。生成ロジックに不整合があります。`);
    return;
  }

  // ダウンロード（BOM付UTF-8 + CRLF）
  const csvText = rows.map(r => r.join(',')).join(CSV_CRLF);
  const blob = new Blob([CSV_BOM + csvText], { type: 'text/csv;charset=utf-8;' });
  const fname = `請求書_${y}年${String(m).padStart(2,'0')}月分_マネーフォワード.csv`;
  if (await saveCsvToDir(blob, fname)) {
    alert(`請求書CSVを保存しました（設定フォルダ、明細 ${detailCount} 行）。`);
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fname;
  a.click();
  alert(`請求書CSVを出力しました（明細 ${detailCount} 行）。MFへインポートしてください。`);
}
       // （仕様変更）モーダル外クリックでは閉じない
window.onclick = function(event) {
    // 何もしない（×ボタン or ESC だけで閉じます）
};


        // キーボードショートカット
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeModal();
                closeCustomerMaster();
                closeSimpleMaster();
                closeCustomerAddModal();
            }
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                openModal();
            }
            // Ctrl/Command + S でモーダル保存（モーダル表示時のみ）
            if ((e.ctrlKey || e.metaKey) && (e.key && e.key.toLowerCase() === 's')) {
                const modal = document.getElementById('orderModal');
                const isOpen = modal && (modal.style.display === 'block' || getComputedStyle(modal).display !== 'none');
                if (isOpen) {
                    e.preventDefault();
                    e.stopPropagation();
                    saveOrder();
                }
            }
        });
