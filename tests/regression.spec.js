// 2026-10-09 本番稼働1年レビューで直した不具合の再発防止テスト
// Supabase（PostgREST）を真似た「メモリ上の偽サーバー」を使い、ブラウザから実際に飛ぶリクエストで確かめる。
const { test, expect } = require('@playwright/test');

const BASE = 'https://example.supabase.co/rest/v1';

// ---- テスト用データ（すべて架空） ----
function cloudOrder(id, orderNo, date, customerName, extra = {}) {
  return {
    id,
    order_no: orderNo,
    date,
    customer_name: customerName,
    pickup_location: '札幌市場',
    pickup_address: '札幌市中央区（テスト）',
    delivery_location: '旭川市場',
    delivery_address: '旭川市（テスト）',
    delivery_tel: '000-0000-0000',
    cargo: 'トマト',
    quantity: 10,
    unit: 'ケース',
    packaging: 'ダンボール',
    unit_price: 100,
    amount_net: 1000,
    amount_gross: 1100,
    instructions: '',
    driver: 'テスト運転手A',
    vehicle: 'テスト車両1',
    instruction_sheet: false,
    invoice_sent: false,
    payment_received: false,
    order_completed: false,
    created_at: '2026-10-01T00:00:00+00:00',
    updated_at: '2026-10-01T00:00:00+00:00',
    ...extra
  };
}

// ---- PostgREST を真似た偽サーバー ----
// 対応: select / order / limit / Range / Prefer: count=exact / eq / gte / in / PATCH / POST / DELETE
function createFakeSupabase(initial = {}) {
  const db = {
    orders: (initial.orders || []).map(r => ({ ...r })),
    customers: (initial.customers || []).map(r => ({ ...r })),
    simple_masters: (initial.simple_masters || []).map(r => ({ ...r }))
  };
  const requests = [];
  const failures = { orders: null };   // 例: { status: 503 } で注文テーブルへの書き込みを失敗させる
  let clock = Date.parse('2026-10-09T00:00:00Z');
  let nextId = 1000;
  const now = () => new Date(clock += 1000).toISOString().replace('Z', '+00:00');

  function parseValueList(raw) {
    // in.("a","b") / in.(a,b)
    const inner = raw.replace(/^in\.\(/, '').replace(/\)$/, '');
    const out = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (ch === '"') { quoted = !quoted; continue; }
      if (ch === ',' && !quoted) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur !== '' || inner.endsWith(',')) out.push(cur);
    return out;
  }
  function matches(row, filters) {
    return filters.every(([col, expr]) => {
      const v = row[col];
      if (expr.startsWith('eq.')) return String(v) === expr.slice(3);
      if (expr.startsWith('gte.')) return String(v) >= expr.slice(4);
      if (expr.startsWith('in.')) return parseValueList(expr).includes(String(v));
      if (expr === 'not.is.null') return v !== null && v !== undefined;
      return true;
    });
  }
  function sortRows(rows, orderParam) {
    if (!orderParam) return rows;
    const keys = orderParam.split(',').map(k => {
      const [col, dir] = k.split('.');
      return { col, desc: dir === 'desc' };
    });
    return rows.slice().sort((a, b) => {
      for (const k of keys) {
        const av = a[k.col], bv = b[k.col];
        if (av === bv) continue;
        const cmp = (typeof av === 'number' && typeof bv === 'number') ? av - bv : String(av) < String(bv) ? -1 : 1;
        return k.desc ? -cmp : cmp;
      }
      return 0;
    });
  }
  const json = (route, status, body, headers = {}) => route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range', ...headers },
    body: JSON.stringify(body)
  });

  async function handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.split('/').pop();
    const method = req.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const params = [...url.searchParams.entries()];
    const filters = params.filter(([k]) => !['select', 'order', 'limit', 'on_conflict'].includes(k));
    const headers = req.headers();
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    requests.push({ method, table, url: req.url(), query: url.search, headers, body });
    const rows = db[table];
    if (!rows) return json(route, 404, { message: 'no table' });

    if (method === 'GET') {
      let result = sortRows(rows.filter(r => matches(r, filters)), url.searchParams.get('order'));
      const total = result.length;
      const limit = url.searchParams.get('limit');
      if (limit) result = result.slice(0, Number(limit));
      const range = headers['range'];
      let contentRange = total ? `0-${result.length - 1}/${total}` : `*/${total}`;
      if (range) {
        const [s, e] = range.split('-').map(Number);
        const capped = Math.min(e, s + 999);   // PostgREST の 1 応答 1,000 行上限
        result = result.slice(s, capped + 1);
        contentRange = result.length ? `${s}-${s + result.length - 1}/${total}` : `*/${total}`;
      }
      return json(route, 200, result, { 'content-range': contentRange });
    }
    if (table === 'orders' && failures.orders && method !== 'GET') {
      return json(route, failures.orders.status, { message: 'fake failure' });
    }
    if (method === 'PATCH') {
      if (table === 'orders' && filters.some(([c, e]) => c === 'order_no' && e === 'eq.BAD-1')) {
        return json(route, 400, { message: 'invalid input' });
      }
      const hit = rows.filter(r => matches(r, filters));
      hit.forEach(r => { Object.assign(r, body); if ('updated_at' in r) r.updated_at = now(); });
      return json(route, 200, hit.map(r => ({ ...r })));
    }
    if (method === 'POST') {
      const list = Array.isArray(body) ? body : [body];
      const created = list.map(item => {
        const row = { id: table === 'orders' ? nextId++ : `${table}-${nextId++}`, created_at: now(), ...item };
        if (table === 'orders') row.updated_at = now();
        rows.push(row);
        return { ...row };
      });
      return json(route, 201, created);
    }
    if (method === 'DELETE') {
      const keep = rows.filter(r => !matches(r, filters));
      const removed = rows.length - keep.length;
      db[table] = keep;
      return json(route, 200, [], { 'x-removed': String(removed) });
    }
    return json(route, 405, { message: 'unsupported' });
  }
  return { db, requests, failures, handle, now };
}

async function useFakeCloud(page, fake, { anonKey = 'eyJtest.fake.anon.key.for.playwright.only.000000000000000000000000' } = {}) {
  await page.route('**/cloud-config.json?*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ url: 'https://example.supabase.co', anonKey, enabled: true })
  }));
  await page.route('https://example.supabase.co/rest/v1/**', route => fake.handle(route));
}

async function useLocalOnly(page, orders, extra = {}) {
  await page.route('**/cloud-config.json?*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ url: 'https://example.supabase.co', anonKey: 'test-anon-key', enabled: false })
  }));
  await page.addInitScript(({ orders, extra }) => {
    localStorage.setItem('orders', JSON.stringify(orders));
    localStorage.setItem('driverMaster', JSON.stringify(extra.drivers || ['テスト運転手A']));
    localStorage.setItem('vehicleMaster', JSON.stringify(['テスト車両1']));
    localStorage.setItem('customerMaster', JSON.stringify(extra.customers || []));
  }, { orders, extra });
}

function localOrder(id, orderNo, date, customerName, extra = {}) {
  return {
    id, orderNo, date, customerName,
    pickupLocation: '札幌市場', pickupAddress: '札幌市（テスト）',
    deliveryLocation: '旭川市場', deliveryAddress: '旭川市（テスト）', deliveryTel: '000-0000-0000',
    cargo: 'トマト', quantity: 10, unit: 'ケース', packaging: 'ダンボール',
    unitPrice: 100, amountNet: 1000, amountGross: 1100,
    instructions: 'テスト備考', driver: 'テスト運転手A', vehicle: 'テスト車両1',
    instructionSheet: false, invoiceSent: false, paymentReceived: false, orderCompleted: false,
    ...extra
  };
}

async function freezeDate(page, iso) {
  await page.addInitScript(({ fixedIso }) => {
    const RealDate = Date;
    const fixed = new RealDate(fixedIso).getTime();
    class MockDate extends RealDate {
      constructor(...args) { if (args.length === 0) { super(fixed); return; } super(...args); }
      static now() { return fixed; }
    }
    window.Date = MockDate;
  }, { fixedIso: iso });
}

async function installPrintCapture(page) {
  await page.addInitScript(() => {
    window.__printWrites = [];
    window.open = () => {
      const capture = { html: '' };
      window.__printWrites.push(capture);
      return {
        document: { open() {}, write(c) { capture.html += String(c || ''); }, close() {} },
        focus() {}, print() {}, close() {}, addEventListener() {}
      };
    };
  });
}

// ======================================================================

test('a checkbox change made while the cloud is down is kept and sent once it recovers', async ({ page }) => {
  const fake = createFakeSupabase({ orders: [cloudOrder(1, 'R261009-001', '2026-10-09', '請求テスト商事')] });
  await freezeDate(page, '2026-10-09T10:00:00+09:00');
  await useFakeCloud(page, fake);
  await page.goto('/');
  await expect(page.locator('#cloudStatus')).toContainText('同期完了');

  fake.failures.orders = { status: 503 };
  await page.locator('#tableBody tr').first().locator('input.checkbox-small').first().check();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cloudSyncQueue') || '[]').length)).toBe(1);

  // 以前はここで失敗した更新がキューから消えていた
  await page.evaluate(() => flushCloudQueue());
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cloudSyncQueue') || '[]').length)).toBe(1);
  expect(fake.db.orders[0].invoice_sent).toBe(false);

  fake.failures.orders = null;
  await page.evaluate(() => flushCloudQueue());
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cloudSyncQueue') || '[]').length)).toBe(0);
  expect(fake.db.orders[0].invoice_sent).toBe(true);

  // チェック欄の更新は、変更した項目だけを送る（他の端末の修正を古い値で上書きしない）
  const patches = fake.requests.filter(r => r.method === 'PATCH' && r.table === 'orders');
  expect(Object.keys(patches[patches.length - 1].body)).toEqual(['invoice_sent']);
});

test('a change the cloud permanently rejects is set aside without blocking the next ones', async ({ page }) => {
  const fake = createFakeSupabase({ orders: [cloudOrder(1, 'R261009-001', '2026-10-09', '退避テスト商事')] });
  await freezeDate(page, '2026-10-09T10:00:00+09:00');
  await useFakeCloud(page, fake);
  await page.goto('/');
  await expect(page.locator('#cloudStatus')).toContainText('同期完了');

  await page.evaluate(() => {
    localStorage.setItem('cloudSyncQueue', JSON.stringify([
      { qid: 'q1', op: 'update', payload: { localId: 'x', orderNo: 'BAD-1', patch: { invoiceSent: true } }, createdAt: 1 },
      { qid: 'q2', op: 'update', payload: { localId: 1, orderNo: 'R261009-001', patch: { paymentReceived: true } }, createdAt: 2 }
    ]));
  });
  await page.evaluate(() => flushCloudQueue());
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cloudSyncQueue') || '[]').length)).toBe(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cloudSyncFailed') || '[]').length)).toBe(1);
  expect(fake.db.orders[0].payment_received).toBe(true);
  await expect(page.locator('#cloudStatus')).toContainText('未保存:1');
});

test('saving the customer master sends only the difference and keeps customers added on another device', async ({ page }) => {
  const fake = createFakeSupabase({
    orders: [cloudOrder(1, 'R261009-001', '2026-10-09', '顧客A')],
    customers: [
      { id: 'c1', customer_name: '顧客A', pickup_address: '住所A', delivery_address: '配送A', phone_number: '000-1', created_at: '2026-01-01' },
      { id: 'c2', customer_name: '顧客B', pickup_address: '住所B', delivery_address: '', phone_number: '000-2', created_at: '2026-01-02' },
      { id: 'c3', customer_name: '顧客C', pickup_address: '住所C', delivery_address: '', phone_number: '000-3', created_at: '2026-01-03' }
    ]
  });
  await useFakeCloud(page, fake);
  page.on('dialog', d => d.accept());
  await page.goto('/');
  await expect(page.locator('#cloudStatus')).toContainText('同期完了');

  await page.locator('.action-bar').getByRole('button', { name: /顧客マスタ/ }).click();
  await expect(page.locator('#customerMasterBody tr')).toHaveCount(3);
  // 画面を開いた後で、別の端末が顧客を追加した
  fake.db.customers.push({ id: 'c4', customer_name: '顧客D（別端末）', pickup_address: '', delivery_address: '', phone_number: '', created_at: '2026-01-04' });

  await page.locator('#customerMasterBody input[data-field="address"]').first().fill('住所A（修正）');
  await page.locator('#customerMasterBody tr').nth(1).getByRole('button', { name: '削除' }).click();
  await page.locator('#customerMasterModal .modal-footer .btn-primary').click();
  await expect(page.locator('#customerMasterModal')).toBeHidden();

  const custReqs = fake.requests.filter(r => r.table === 'customers' && r.method !== 'GET');
  expect(custReqs.some(r => r.method === 'DELETE' && r.query.includes('not.is.null'))).toBe(false);
  expect(custReqs.filter(r => r.method === 'PATCH').map(r => r.query)).toEqual(['?id=eq.c1']);
  expect(custReqs.filter(r => r.method === 'DELETE').length).toBe(1);
  expect(fake.db.customers.map(c => c.id).sort()).toEqual(['c1', 'c3', 'c4']);
  expect(fake.db.customers.find(c => c.id === 'c1').pickup_address).toBe('住所A（修正）');
  expect(fake.db.customers.find(c => c.id === 'c1').delivery_address).toBe('配送A');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('customerMaster')).map(c => c.name));
  expect(saved).toContain('顧客D（別端末）');
});

test('saving a simple master sends only additions, order changes and deletions', async ({ page }) => {
  const fake = createFakeSupabase({
    orders: [cloudOrder(1, 'R261009-001', '2026-10-09', '顧客A')],
    simple_masters: [
      { id: 'm1', master_type: 'driver', name: '運転手1', sort_order: 0 },
      { id: 'm2', master_type: 'driver', name: '運転手2', sort_order: 1 },
      { id: 'm3', master_type: 'driver', name: '運転手3', sort_order: 2 },
      { id: 'v1', master_type: 'vehicle', name: '車両1', sort_order: 0 }
    ]
  });
  await useFakeCloud(page, fake);
  page.on('dialog', d => d.accept());
  await page.goto('/');
  await expect(page.locator('#cloudStatus')).toContainText('同期完了');

  await page.locator('.action-bar').getByRole('button', { name: /ドライバーマスタ/ }).click();
  await expect(page.locator('#simpleMasterList .master-item')).toHaveCount(3);
  await page.locator('#simpleMasterList .master-item').nth(1).getByRole('button', { name: '×' }).click();
  await page.locator('#simpleMasterInput').fill('運転手4');
  await page.locator('#simpleMasterModal').getByRole('button', { name: /追加/ }).click();
  await page.locator('#simpleMasterModal .modal-footer .btn-primary').click();
  await expect(page.locator('#simpleMasterModal')).toBeHidden();

  const reqs = fake.requests.filter(r => r.table === 'simple_masters' && r.method !== 'GET');
  expect(reqs.some(r => r.method === 'DELETE' && r.query.includes('master_type'))).toBe(false);
  expect(fake.db.simple_masters.filter(m => m.master_type === 'driver').map(m => m.name).sort()).toEqual(['運転手1', '運転手3', '運転手4']);
  expect(fake.db.simple_masters.filter(m => m.master_type === 'vehicle').length).toBe(1);
});

test('when the cloud suddenly returns zero orders, the list on this device is kept', async ({ page }) => {
  const fake = createFakeSupabase({ orders: [cloudOrder(1, 'R261009-001', '2026-10-09', '保持テスト商事')] });
  await freezeDate(page, '2026-10-09T10:00:00+09:00');
  await useFakeCloud(page, fake);
  await page.goto('/');
  await expect(page.locator('#tableBody')).toContainText('保持テスト商事');

  fake.db.orders = [];
  await page.evaluate(() => refreshCloudData({ includeMasters: false }).catch(() => {}));
  await expect(page.locator('#cloudStatus')).toContainText('エラー');
  await expect(page.locator('#tableBody')).toContainText('保持テスト商事');
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('orders') || '[]').length);
  expect(kept).toBe(1);
});

test('a new order created before 9am gets today’s date and order number (not yesterday’s)', async ({ page }) => {
  await freezeDate(page, '2026-10-09T07:30:00+09:00');
  await useLocalOnly(page, []);
  await page.goto('/');
  await page.locator('.action-bar').getByRole('button', { name: /新規受注/ }).click();
  await expect(page.locator('#orderDate')).toHaveValue('2026-10-09');
  await expect(page.locator('#orderNo')).toHaveValue('R261009-001');
  await expect(page.locator('#orderNo')).not.toHaveJSProperty('readOnly', true);
});

test('editing locks the order number and keeps a driver that is no longer in the master', async ({ page }) => {
  await freezeDate(page, '2026-10-09T10:00:00+09:00');
  await useLocalOnly(page, [localOrder('a1', 'R261009-001', '2026-10-09', '退職テスト商事', { driver: '退職した運転手' })]);
  await page.goto('/');
  await page.locator('#tableBody tr').first().getByRole('button', { name: '編集' }).click();
  await expect(page.locator('#orderNo')).toHaveJSProperty('readOnly', true);
  await expect(page.locator('#driver')).toHaveValue('退職した運転手');
  await page.locator('#orderModal .modal-footer').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('#orderModal')).toBeHidden();
  const driver = await page.evaluate(() => JSON.parse(localStorage.getItem('orders'))[0].driver);
  expect(driver).toBe('退職した運転手');
});

test('print output escapes driver and vehicle names and blocks scripts', async ({ page }) => {
  await freezeDate(page, '2026-10-09T10:00:00+09:00');
  await useLocalOnly(page, [localOrder('a1', 'R261009-001', '2026-10-09', '印刷テスト商事', {
    driver: '<img src=x onerror=alert(1)>', vehicle: '<b>車</b>', unit: '<i>箱</i>'
  })]);
  await installPrintCapture(page);
  await page.goto('/');
  await page.locator('#tableBody tr').first().locator('.order-checkbox').check();
  await page.locator('.action-bar').getByRole('button', { name: /引取書/ }).click();
  await expect.poll(() => page.evaluate(() => window.__printWrites.length)).toBe(1);
  const html = await page.evaluate(() => window.__printWrites[0].html);
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(html).not.toContain('<img src=x');
  expect(html).not.toContain('<b>車</b>');
  expect(html).toContain("script-src 'none'");
  expect((html.match(/《お客様控》/g) || []).length).toBe(2);
  expect(html).toContain('受領確認（お客様ご記入）');
});

test('csv import keeps existing values for blank cells, reads 12,000 and t/f, and skips bad dates', async ({ page }) => {
  await freezeDate(page, '2026-10-09T10:00:00+09:00');
  await useLocalOnly(page, [localOrder('a1', 'R261009-001', '2026-10-09', '取込テスト商事')]);
  const dialogs = [];
  page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
  await page.goto('/');

  const csv = [
    '受注番号,日付,顧客名,単価,金額(税別),請求済,備考',
    'R261009-001,2026-10-09,取込テスト商事,,"12,000",t,',
    'R261009-099,2026/13/40,日付不正商事,100,100,f,'
  ].join('\n');
  await page.locator('#csvImport').setInputFiles({ name: 'orders.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
  await expect.poll(() => dialogs.join('\n')).toContain('CSVファイルをインポートしました（1件）');
  expect(dialogs.join('\n')).toContain('日付が読めないため取り込まなかった行: 1件');
  const o = await page.evaluate(() => JSON.parse(localStorage.getItem('orders')).find(x => x.orderNo === 'R261009-001'));
  expect(o.amountNet).toBe(12000);
  expect(o.invoiceSent).toBe(true);
  expect(o.instructions).toBe('テスト備考');   // 空欄は既存の値のまま
  expect(o.unitPrice).toBe(100);
});

test('customer csv import reads the backup format (customer_name, phone_number columns)', async ({ page }) => {
  await useLocalOnly(page, []);
  const dialogs = [];
  page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
  await page.goto('/');
  await page.locator('.action-bar').getByRole('button', { name: /顧客マスタ/ }).click();
  const csv = [
    'id,customer_name,pickup_address,delivery_address,phone_number,created_at,updated_at',
    'c1,バックアップ商事,札幌市（テスト）,旭川市（テスト）,000-9999,2026-10-08 09:36:41+00,2026-10-08 09:36:41+00'
  ].join('\n');
  await page.locator('#customerMasterModal input[type="file"]').setInputFiles({ name: 'c.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
  await expect.poll(() => dialogs.join('\n')).toContain('追加: 1件');
  const c = await page.evaluate(() => JSON.parse(localStorage.getItem('customerMaster'))[0]);
  expect(c).toMatchObject({ name: 'バックアップ商事', address: '札幌市（テスト）', tel: '000-9999', deliveryAddress: '旭川市（テスト）' });
});

test('editing the same order twice in a row does not raise a false conflict warning', async ({ page }) => {
  const fake = createFakeSupabase({ orders: [cloudOrder(1, 'R261009-001', '2026-10-09', '連続編集商事')] });
  await freezeDate(page, '2026-10-09T10:00:00+09:00');
  await useFakeCloud(page, fake);
  const dialogs = [];
  page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
  await page.goto('/');
  await expect(page.locator('#cloudStatus')).toContainText('同期完了');

  for (const text of ['1回目の修正', '2回目の修正']) {
    await page.locator('#tableBody tr').first().getByRole('button', { name: '編集' }).click();
    await page.locator('#instructions').fill(text);
    await page.locator('#orderModal .modal-footer').getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.locator('#orderModal')).toBeHidden();
    await expect.poll(() => fake.db.orders[0].instructions).toBe(text);
  }
  expect(dialogs.filter(m => m.includes('別の端末'))).toEqual([]);
});

test('invoice csv warns about zero-yen orders before exporting', async ({ page }) => {
  await freezeDate(page, '2026-10-09T10:00:00+09:00');
  await useLocalOnly(page, [
    localOrder('a1', 'R261009-001', '2026-10-09', '有料商事'),
    localOrder('a2', 'R261009-002', '2026-10-09', '後日精算商事', { amountNet: 0, amountGross: 0, unitPrice: 0, instructions: '料金は後日' })
  ]);
  const dialogs = [];
  page.on('dialog', async d => { dialogs.push(d.message()); await d.dismiss(); });
  await page.goto('/');
  await page.locator('.action-bar').getByRole('button', { name: /請求書CSV/ }).click();
  await expect.poll(() => dialogs.length).toBe(1);
  expect(dialogs[0]).toContain('0円の受注が 1 件');
  expect(dialogs[0]).toContain('R261009-002');
});

test('monthly report pdf lists the month orders under the company name', async ({ page }) => {
  await freezeDate(page, '2026-10-09T10:00:00+09:00');
  await useLocalOnly(page, [localOrder('a1', 'R261009-001', '2026-10-09', '月次テスト商事'), localOrder('a2', 'R260901-001', '2026-09-01', '先月商事')]);
  await installPrintCapture(page);
  await page.goto('/');
  await page.locator('.action-bar').getByRole('button', { name: /月次レポートPDF/ }).click();
  await expect.poll(() => page.evaluate(() => window.__printWrites.length)).toBe(1);
  const html = await page.evaluate(() => window.__printWrites[0].html);
  expect(html).toContain('きょうしん輸送株式会社');
  expect(html).toContain('月次テスト商事');
  expect(html).not.toContain('先月商事');
});

test('the all-orders button shows every month and switches back to the month view', async ({ page }) => {
  await freezeDate(page, '2026-10-09T10:00:00+09:00');
  await useLocalOnly(page, [localOrder('a1', 'R261009-001', '2026-10-09', '今月商事'), localOrder('a2', 'R260901-001', '2026-09-01', '先月商事')]);
  await page.goto('/');
  await expect(page.locator('#tableBody tr')).toHaveCount(1);
  await page.locator('#allOrdersToggle').click();
  await expect(page.locator('#tableBody tr')).toHaveCount(2);
  await expect(page.locator('#allOrdersToggle')).toContainText('月表示に戻る');
  await page.locator('#allOrdersToggle').click();
  await expect(page.locator('#tableBody tr')).toHaveCount(1);
});

test('opening with ?manualCloudConfig=1 unlocks the cloud settings for maintenance', async ({ page }) => {
  const fake = createFakeSupabase({ orders: [cloudOrder(1, 'R261009-001', '2026-10-09', '保守商事')] });
  await useFakeCloud(page, fake);
  await page.goto('/?manualCloudConfig=1');
  await page.getByRole('button', { name: /クラウド設定/ }).click();
  await expect(page.locator('#cloudConfigLockNotice')).toBeHidden();
  await expect(page.locator('#cloudProjectUrl')).toBeEnabled();
  await expect(page.locator('#cloudSettingsSaveButton')).toBeEnabled();
});

test('the sort selector switches between date order and registration order', async ({ page }) => {
  await freezeDate(page, '2026-10-09T10:00:00+09:00');
  await useLocalOnly(page, [
    localOrder(2, 'R261009-002', '2026-10-01', '先に配送する商事'),
    localOrder(1, 'R261009-001', '2026-10-20', '後で配送する商事')
  ]);
  await page.goto('/');
  await page.selectOption('#sortOrder', 'date-asc');
  await expect(page.locator('#tableBody tr').first()).toContainText('先に配送する商事');
  await page.selectOption('#sortOrder', 'id-asc');
  await expect(page.locator('#tableBody tr').first()).toContainText('後で配送する商事');
});

test('the periodic sync fetches only changed rows, and falls back to a full fetch when a row was deleted', async ({ page }) => {
  const fake = createFakeSupabase({ orders: [
    cloudOrder(1, 'R261009-001', '2026-10-09', '差分A商事'),
    cloudOrder(2, 'R261009-002', '2026-10-09', '差分B商事')
  ] });
  await freezeDate(page, '2026-10-09T10:00:00+09:00');
  await useFakeCloud(page, fake);
  await page.goto('/');
  await expect(page.locator('#tableBody tr')).toHaveCount(2);

  // 別の端末が1件を修正
  Object.assign(fake.db.orders[0], { customer_name: '差分A商事（修正）', updated_at: fake.now() });
  const before = fake.requests.length;
  await page.evaluate(() => refreshCloudData({ includeMasters: false, showStatus: false, incremental: true }));
  await expect(page.locator('#tableBody')).toContainText('差分A商事（修正）');
  const queries = fake.requests.slice(before).filter(r => r.table === 'orders').map(r => r.query);
  expect(queries.some(q => q.includes('updated_at=gte.'))).toBe(true);
  expect(queries.some(q => q === '?select=*&order=date.asc,order_no.asc')).toBe(false);

  // 別の端末が1件を削除 → 件数が合わないので全件を取り直す
  fake.db.orders = fake.db.orders.filter(o => o.id !== 2);
  const before2 = fake.requests.length;
  await page.evaluate(() => refreshCloudData({ includeMasters: false, showStatus: false, incremental: true }));
  await expect(page.locator('#tableBody tr')).toHaveCount(1);
  const queries2 = fake.requests.slice(before2).filter(r => r.table === 'orders').map(r => r.query);
  expect(queries2).toContain('?select=*&order=date.asc,order_no.asc');
});

test('a new-format publishable key is sent only in the apikey header', async ({ page }) => {
  const fake = createFakeSupabase({ orders: [cloudOrder(1, 'R261009-001', '2026-10-09', '新キー商事')] });
  await useFakeCloud(page, fake, { anonKey: 'sb_publishable_testkey_for_playwright_only' });
  await page.goto('/');
  await expect(page.locator('#tableBody')).toContainText('新キー商事');
  const r = fake.requests.find(x => x.table === 'orders' && x.method === 'GET');
  expect(r.headers['apikey']).toBe('sb_publishable_testkey_for_playwright_only');
  expect(r.headers['authorization']).toBeUndefined();
});

test('an old-format (JWT) key is still sent as both apikey and Authorization', async ({ page }) => {
  const fake = createFakeSupabase({ orders: [cloudOrder(1, 'R261009-001', '2026-10-09', '旧キー商事')] });
  await useFakeCloud(page, fake);
  await page.goto('/');
  await expect(page.locator('#tableBody')).toContainText('旧キー商事');
  const r = fake.requests.find(x => x.table === 'orders' && x.method === 'GET');
  expect(r.headers['authorization']).toMatch(/^Bearer eyJ/);
});
