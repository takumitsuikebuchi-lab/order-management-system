const { test, expect } = require('@playwright/test');

const seededOrders = [
  {
    id: 'test-1',
    orderNo: 'R260319-001',
    date: '2026-03-19',
    customerName: 'テスト青果',
    pickupLocation: '札幌市場',
    pickupAddress: '札幌市中央区北12条西20丁目',
    deliveryLocation: '旭川市場',
    deliveryAddress: '旭川市永山2条5丁目',
    deliveryTel: '0166-48-2311',
    cargo: 'トマト',
    quantity: 10,
    unit: 'ケース',
    packaging: 'ダンボール',
    unitPrice: 100,
    amountNet: 1000,
    amountGross: 1100,
    instructions: 'テストデータ1',
    driver: '混載流通',
    vehicle: '札幌100あ12-34',
    instructionSheet: false,
    invoiceSent: false,
    paymentReceived: false,
    orderCompleted: false
  },
  {
    id: 'test-2',
    orderNo: 'R260319-002',
    date: '2026-03-20',
    customerName: 'サンプル運送',
    pickupLocation: '帯広市場',
    pickupAddress: '帯広市西20条南1丁目',
    deliveryLocation: '札幌中央市場',
    deliveryAddress: '札幌市中央区北12条',
    deliveryTel: '011-611-3111',
    cargo: 'じゃがいも',
    quantity: 20,
    unit: '袋',
    packaging: '麻袋20kg',
    unitPrice: 85,
    amountNet: 1700,
    amountGross: 1870,
    instructions: 'テストデータ2',
    driver: '門脇悟大',
    vehicle: '帯広500た56-78',
    instructionSheet: false,
    invoiceSent: false,
    paymentReceived: false,
    orderCompleted: false
  }
];

const seededCustomers = [
  {
    name: 'テスト青果',
    pickupAddress: '札幌市中央区北12条西20丁目',
    deliveryAddress: '旭川市永山2条5丁目',
    phoneNumber: '011-000-0000'
  },
  {
    name: 'サンプル運送',
    pickupAddress: '帯広市西20条南1丁目',
    deliveryAddress: '札幌市中央区北12条',
    phoneNumber: '0155-00-0000'
  }
];

async function seedLocalMode(page) {
  await page.route('**/cloud-config.json?*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: 'https://example.supabase.co',
        anonKey: 'test-anon-key',
        enabled: false
      })
    });
  });

  await page.addInitScript(({ orders, customers }) => {
    localStorage.setItem('setupCompleted', 'true');
    localStorage.setItem('setupMode', 'cloud');
    localStorage.setItem('orders', JSON.stringify(orders));
    localStorage.setItem('customerMaster', JSON.stringify(customers));
    localStorage.setItem('driverMaster', JSON.stringify(['混載流通', '門脇悟大']));
    localStorage.setItem('vehicleMaster', JSON.stringify(['札幌100あ12-34', '帯広500た56-78']));
  }, { orders: seededOrders, customers: seededCustomers });
}

async function seedLockedCloudMode(page) {
  await page.route('**/cloud-config.json?*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: 'https://example.supabase.co',
        anonKey: 'test-anon-key',
        enabled: true
      })
    });
  });

  await page.route('https://example.supabase.co/rest/v1/orders**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(seededOrders)
    });
  });

  await page.route('https://example.supabase.co/rest/v1/customers**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  await page.route('https://example.supabase.co/rest/v1/simple_masters**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem('setupCompleted', 'true');
    localStorage.setItem('setupMode', 'cloud');
  });
}

async function visibleCustomers(page) {
  return await page.locator('#tableBody tr').evaluateAll(rows =>
    rows
      .filter(row => getComputedStyle(row).display !== 'none')
      .map(row => row.cells[2]?.textContent?.trim() || '')
  );
}

test('basic order row actions open the expected UI', async ({ page }) => {
  await seedLocalMode(page);
  await page.goto('/');

  await expect(page.locator('#tableBody tr')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /新規受注/ })).toBeVisible();

  await page.getByRole('button', { name: /新規受注/ }).click();
  await expect(page.locator('#modalTitle')).toHaveText('新規受注登録');
  await page.locator('#orderModal .close-button').click();

  await page.locator('#tableBody tr').nth(0).getByRole('button', { name: '編集' }).click();
  await expect(page.locator('#modalTitle')).toHaveText('受注編集');
  await page.locator('#orderModal .close-button').click();

  await page.locator('#tableBody tr').nth(0).getByRole('button', { name: '複製' }).click();
  await expect(page.locator('#modalTitle')).toHaveText('受注複製');
  await page.locator('#orderModal .close-button').click();

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#tableBody tr').nth(1).getByRole('button', { name: '削除' }).click();
  await expect(page.locator('#tableBody tr')).toHaveCount(1);
});

test('customer filter survives a table refresh', async ({ page }) => {
  await seedLocalMode(page);
  await page.goto('/');

  await page.locator('#searchInput').fill('テスト');
  await expect.poll(async () => await visibleCustomers(page)).toEqual(['テスト青果']);

  await page.evaluate((orders) => {
    window.applyFetchedOrders(orders);
  }, seededOrders);

  await expect(page.locator('#searchInput')).toHaveValue('テスト');
  await expect.poll(async () => await visibleCustomers(page)).toEqual(['テスト青果']);
});

test('shared cloud config keeps cloud settings locked in normal mode', async ({ page }) => {
  await seedLockedCloudMode(page);
  await page.goto('/');

  await expect(page.locator('#cloudStatus')).toContainText('接続: Cloud（同期完了');

  await page.getByRole('button', { name: /クラウド設定/ }).click();
  await expect(page.locator('#cloudConfigLockNotice')).toBeVisible();
  await expect(page.locator('#cloudProjectUrl')).toBeDisabled();
  await expect(page.locator('#cloudAnonKey')).toBeDisabled();
  await expect(page.locator('#cloudEnabledCheckbox')).toBeDisabled();
  await expect(page.locator('#cloudSettingsSaveButton')).toBeDisabled();
});
