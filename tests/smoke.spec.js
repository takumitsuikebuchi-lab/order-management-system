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

async function installPrintCapture(page) {
  await page.addInitScript(() => {
    window.__printWrites = [];
    window.open = () => {
      const capture = { html: '', printed: false, closed: false };
      window.__printWrites.push(capture);
      return {
        document: {
          write(content) {
            capture.html += String(content || '');
          },
          close() {
            capture.closed = true;
          }
        },
        focus() {},
        print() {
          capture.printed = true;
        }
      };
    };
  });
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

async function seedConflictMode(page) {
  const conflictedOrder = {
    ...seededOrders[0],
    instructions: '別端末で更新済み'
  };

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

  await page.route('https://example.supabase.co/rest/v1/orders?select=*&order=date.asc&order=order_no.asc', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(seededOrders)
    });
  });

  await page.route(/https:\/\/example\.supabase\.co\/rest\/v1\/orders\?order_no=eq\..*&select=\*&limit=1/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([conflictedOrder])
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

async function installCsvCapture(page) {
  await page.addInitScript(() => {
    window.__csvCapture = { filename: '', content: '' };
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function patchedCreateObjectURL(blob) {
      Promise.resolve(blob.text()).then(text => {
        window.__csvCapture.content = text;
      });
      return originalCreateObjectURL(blob);
    };

    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function patchedClick() {
      window.__csvCapture.filename = this.download || '';
      return originalClick.call(this);
    };
  });
}

async function ensureSelectOption(page, selector, value) {
  await page.evaluate(({ selector: selectSelector, value: optionValue }) => {
    const select = document.querySelector(selectSelector);
    if (!select) return;
    const exists = Array.from(select.options).some(option => option.value === optionValue);
    if (!exists) {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionValue;
      select.appendChild(option);
    }
    select.value = optionValue;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, { selector, value });
}

async function checkedOrderCount(page) {
  return await page.locator('#tableBody .order-checkbox:checked').count();
}

async function replaceOrdersAndRefresh(page, orders) {
  await page.evaluate((nextOrders) => {
    localStorage.setItem('orders', JSON.stringify(nextOrders));
    loadData();
    renderTable();
    updateStats();
    setupFilters();
  }, orders);
}

async function freezePageDate(page, isoDateString) {
  await page.addInitScript(({ fixedIso }) => {
    const RealDate = Date;
    const fixedTime = new RealDate(fixedIso).getTime();

    class MockDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) {
          super(fixedTime);
          return;
        }
        super(...args);
      }

      static now() {
        return fixedTime;
      }

      static parse(value) {
        return RealDate.parse(value);
      }

      static UTC(...args) {
        return RealDate.UTC(...args);
      }
    }

    Object.setPrototypeOf(MockDate, RealDate);
    window.Date = MockDate;
  }, { fixedIso: isoDateString });
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

test('customer master add flow updates the master list', async ({ page }) => {
  await seedLocalMode(page);
  await page.goto('/');

  await page.getByRole('button', { name: /顧客マスタ/ }).click();
  await expect(page.locator('#customerMasterModal')).toBeVisible();
  await expect(page.locator('#customerMasterBody tr')).toHaveCount(2);

  await page.getByRole('button', { name: /新規追加/ }).click();
  await expect(page.locator('#customerAddModal')).toBeVisible();

  await page.locator('#newCustomerName').fill('追加テスト商事');
  await page.locator('#newCustomerAddress').fill('札幌市東区テスト1-2-3');
  await page.locator('#newCustomerTel').fill('011-999-0000');

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '追加', exact: true }).click();

  await expect(page.locator('#customerMasterBody tr')).toHaveCount(3);
  await expect(page.locator('#customerMasterBody input[data-field="name"]').nth(2)).toHaveValue('追加テスト商事');
});

test('driver master save updates filter options', async ({ page }) => {
  await seedLocalMode(page);
  await page.goto('/');

  await page.getByRole('button', { name: /ドライバーマスタ/ }).click();
  await expect(page.locator('#simpleMasterModal')).toBeVisible();
  await expect(page.locator('#simpleMasterTitle')).toHaveText('ドライバーマスタ管理');

  await page.locator('#simpleMasterInput').fill('追加ドライバー');
  await page.getByRole('button', { name: '追加', exact: true }).click();
  await expect(page.locator('#simpleMasterList')).toContainText('追加ドライバー');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#simpleMasterModal .modal-footer').getByRole('button', { name: '保存', exact: true }).click();

  await page.locator('#driverFilter').selectOption('追加ドライバー');
  await expect(page.locator('#driverFilter')).toHaveValue('追加ドライバー');
});

test('print entry points still respond as expected', async ({ page }) => {
  await seedLocalMode(page);
  await page.goto('/');

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /引取書/ }).click();

  await page.locator('#tableBody tr').nth(0).locator('.order-checkbox').check();
  await page.getByRole('button', { name: /運行指示書/ }).click();
  await expect(page.locator('#instructionSettingsModal')).toBeVisible();
  await expect(page.locator('#instructionSettingsModal h2')).toHaveText('運行指示書の設定');
  await expect(page.locator('#orderSequenceList .order-sequence-item')).toHaveCount(1);
});

test('instruction sheet and pickup slip write printable HTML', async ({ page }) => {
  await seedLocalMode(page);
  await installPrintCapture(page);
  await page.goto('/');

  await page.locator('#tableBody tr').nth(0).locator('.order-checkbox').check();

  await page.getByRole('button', { name: /運行指示書/ }).click();
  await page.locator('#instructionSettingsModal .modal-footer').getByRole('button', { name: /運行指示書を出力/ }).click();

  await expect.poll(async () => {
    return await page.evaluate(() => window.__printWrites.length);
  }).toBe(1);

  await expect.poll(async () => {
    return await page.evaluate(() => window.__printWrites[0]?.printed === true);
  }).toBe(true);

  await expect.poll(async () => {
    return await page.evaluate(() => window.__printWrites[0]?.html || '');
  }).toContain('運行指示書');

  await page.locator('#tableBody tr').nth(0).locator('.order-checkbox').check();
  await page.getByRole('button', { name: /引取書/ }).click();

  await expect.poll(async () => {
    return await page.evaluate(() => window.__printWrites.length);
  }).toBe(2);

  await expect.poll(async () => {
    return await page.evaluate(() => window.__printWrites[1]?.html || '');
  }).toContain('貨物引取書・荷渡書');
});

test('csv export creates an internal format download', async ({ page }) => {
  await seedLocalMode(page);
  await installCsvCapture(page);
  await page.goto('/');

  await page.evaluate(() => {
    window.showCsvFormatDialog = async () => 'internal';
    window.saveCsvToDir = async () => false;
  });

  await page.getByRole('button', { name: /CSV出力/ }).click();

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.filename);
  }).toContain('受注明細_');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.content);
  }).toContain('受注番号,日付,顧客名');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.content);
  }).toContain('R260319-001');
});

test('editing warns when the same order was changed on another device', async ({ page }) => {
  await seedConflictMode(page);
  await page.goto('/');

  await page.locator('#tableBody tr').nth(0).getByRole('button', { name: '編集' }).click();
  await page.locator('#customerName').fill(seededOrders[0].customerName);
  await page.locator('#pickupLocation').fill(seededOrders[0].pickupLocation);
  await page.locator('#deliveryLocation').fill(seededOrders[0].deliveryLocation);
  await page.evaluate((cargo) => {
    const select = document.getElementById('cargo');
    if (!select) return;
    const exists = Array.from(select.options).some(option => option.value === cargo);
    if (!exists) {
      const option = document.createElement('option');
      option.value = cargo;
      option.textContent = cargo;
      select.appendChild(option);
    }
    select.value = cargo;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, seededOrders[0].cargo);
  await page.locator('#instructions').fill('この端末での変更');

  let seenAlert = '';
  page.once('dialog', async dialog => {
    seenAlert = dialog.message();
    await dialog.accept();
  });

  await page.locator('#orderModal .modal-footer').getByRole('button', { name: '保存', exact: true }).click();

  await expect.poll(() => seenAlert).toContain('別の端末でこの受注が更新されています');
  await expect(page.locator('#orderModal')).toBeVisible();
  await expect(page.locator('#instructions')).toHaveValue('この端末での変更');
});

test('csv import adds a new order row', async ({ page }) => {
  await seedLocalMode(page);
  await page.goto('/');

  const csvText = [
    '受注番号,日付,顧客名,引取先,引取先住所,配送先,配送先住所,配送先電話番号,積荷,数量,単位,荷姿,単価,金額(税別),金額(税込),ドライバー,車両,備考,指示書,請求済,入金済,完了',
    'R260319-003,2026-03-21,CSV取込テスト,石狩市場,石狩市新港,函館市場,函館市港町,0138-00-0000,にんじん,30,箱,ダンボール,150,4500,4950,混載流通,札幌100あ12-34,CSV取り込み,false,false,false,false'
  ].join('\n');

  let seenAlert = '';
  page.once('dialog', async dialog => {
    seenAlert = dialog.message();
    await dialog.accept();
  });

  await page.locator('#csvImport').setInputFiles({
    name: 'orders.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvText, 'utf8')
  });

  await expect.poll(() => seenAlert).toContain('CSVファイルをインポートしました');
  await expect(page.locator('#tableBody tr')).toHaveCount(3);
  await expect(page.locator('#tableBody')).toContainText('CSV取込テスト');
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const orders = JSON.parse(localStorage.getItem('orders') || '[]');
      return orders.some(order => order.orderNo === 'R260319-003');
    });
  }).toBe(true);
});

test('customer master csv import adds new customers and skips duplicates', async ({ page }) => {
  await seedLocalMode(page);
  await page.goto('/');

  await page.getByRole('button', { name: /顧客マスタ/ }).click();
  await expect(page.locator('#customerMasterBody tr')).toHaveCount(2);

  const csvText = [
    '顧客名,住所,電話番号',
    'テスト青果,札幌市中央区北12条西20丁目,011-000-0000',
    'CSV顧客追加,小樽市港町1-2-3,0134-00-0000'
  ].join('\n');

  let seenAlert = '';
  page.once('dialog', async dialog => {
    seenAlert = dialog.message();
    await dialog.accept();
  });

  await page.locator('#customerCsvImport').setInputFiles({
    name: 'customers.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvText, 'utf8')
  });

  await expect.poll(() => seenAlert).toContain('CSVインポート完了');
  await expect.poll(() => seenAlert).toContain('追加: 1件');
  await expect.poll(() => seenAlert).toContain('スキップ: 1件');
  await expect(page.locator('#customerMasterBody tr')).toHaveCount(3);
  await expect(page.locator('#customerMasterBody input[data-field="name"]').nth(2)).toHaveValue('CSV顧客追加');
});

test('customer master csv export creates a customer csv download', async ({ page }) => {
  await seedLocalMode(page);
  await installCsvCapture(page);
  await page.goto('/');

  await page.evaluate(() => {
    window.saveCsvToDir = async () => false;
  });

  await page.getByRole('button', { name: /顧客マスタ/ }).click();
  await page.locator('#customerMasterModal').getByRole('button', { name: /CSV出力/ }).click();

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.filename);
  }).toContain('顧客マスタ_');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.content);
  }).toContain('顧客名,住所,電話番号');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.content);
  }).toContain('テスト青果');
});

test('new order save adds a row locally', async ({ page }) => {
  await seedLocalMode(page);
  await page.goto('/');

  await page.getByRole('button', { name: /新規受注/ }).click();
  await expect(page.locator('#modalTitle')).toHaveText('新規受注登録');

  await page.locator('#orderNo').fill('R260319-010');
  await page.locator('#orderDate').fill('2026-03-22');
  await page.locator('#customerName').fill('新規保存テスト');
  await page.locator('#pickupLocation').fill('苫小牧市場');
  await page.locator('#pickupAddress').fill('苫小牧市港町1-1');
  await page.locator('#deliveryLocation').fill('札幌加工センター');
  await page.locator('#deliveryAddress').fill('札幌市白石区流通センター1-1');
  await ensureSelectOption(page, '#cargo', 'たまねぎ');
  await page.locator('#quantity').fill('12');
  await ensureSelectOption(page, '#unit', 'ケース');
  await ensureSelectOption(page, '#packaging', 'ダンボール');
  await page.locator('#unitPrice').fill('200');
  await page.locator('#amountNet').fill('2400');
  await ensureSelectOption(page, '#driver', '混載流通');
  await ensureSelectOption(page, '#vehicle', '札幌100あ12-34');
  await page.locator('#instructions').fill('新規保存の自動テスト');

  await page.locator('#orderModal .modal-footer').getByRole('button', { name: '保存', exact: true }).click();

  await expect(page.locator('#orderModal')).toBeHidden();
  await expect(page.locator('#tableBody tr')).toHaveCount(3);
  await expect(page.locator('#tableBody')).toContainText('新規保存テスト');
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const orders = JSON.parse(localStorage.getItem('orders') || '[]');
      return orders.some(order => order.orderNo === 'R260319-010');
    });
  }).toBe(true);
});

test('invoice csv export creates a moneyforward formatted download', async ({ page }) => {
  await seedLocalMode(page);
  await installCsvCapture(page);
  await page.goto('/');

  await page.evaluate(() => {
    window.saveCsvToDir = async () => false;
  });

  let seenAlert = '';
  page.once('dialog', async dialog => {
    seenAlert = dialog.message();
    await dialog.accept();
  });

  await page.getByRole('button', { name: /請求書CSV/ }).click();

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.filename);
  }).toContain('請求書_');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.content);
  }).toContain('csv_type(変更不可)');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.content);
  }).toContain('40101');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.content);
  }).toContain('源泉徴収');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.content);
  }).toContain('含まない');

  await expect.poll(() => seenAlert).toContain('請求書CSVを出力しました');
});

test('simple master csv import adds new driver values and skips duplicates', async ({ page }) => {
  await seedLocalMode(page);
  await page.goto('/');

  await page.getByRole('button', { name: /ドライバーマスタ/ }).click();
  await expect(page.locator('#simpleMasterTitle')).toHaveText('ドライバーマスタ管理');

  const csvText = [
    '名称',
    '混載流通',
    'CSVドライバー'
  ].join('\n');

  let seenAlert = '';
  page.once('dialog', async dialog => {
    seenAlert = dialog.message();
    await dialog.accept();
  });

  await page.locator('#simpleMasterCsvImport').setInputFiles({
    name: 'drivers.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvText, 'utf8')
  });

  await expect.poll(() => seenAlert).toContain('ドライバーマスタCSV取込完了');
  await expect.poll(() => seenAlert).toContain('追加: 1件');
  await expect.poll(() => seenAlert).toContain('スキップ: 1件');
  await expect(page.locator('#simpleMasterList')).toContainText('CSVドライバー');
});

test('simple master csv export creates a driver csv download', async ({ page }) => {
  await seedLocalMode(page);
  await installCsvCapture(page);
  await page.goto('/');

  await page.evaluate(() => {
    window.saveCsvToDir = async () => false;
  });

  await page.getByRole('button', { name: /ドライバーマスタ/ }).click();
  await page.locator('#simpleMasterModal').getByRole('button', { name: /CSV出力/ }).click();

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.filename);
  }).toContain('ドライバーマスタ_');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.content);
  }).toContain('名称');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.content);
  }).toContain('混載流通');
});

test('select all toggles all visible order checkboxes', async ({ page }) => {
  await seedLocalMode(page);
  await page.goto('/');

  await expect(await checkedOrderCount(page)).toBe(0);

  await page.locator('#selectAll').check();
  await expect.poll(async () => await checkedOrderCount(page)).toBe(2);

  await page.locator('#selectAll').uncheck();
  await expect.poll(async () => await checkedOrderCount(page)).toBe(0);
});

test('month navigation updates the visible month and monthly stats', async ({ page }) => {
  await seedLocalMode(page);
  await page.goto('/');

  const aprilOrder = {
    id: 'test-3',
    orderNo: 'R260401-001',
    date: '2026-04-05',
    customerName: '4月テスト商事',
    pickupLocation: '釧路市場',
    pickupAddress: '釧路市新富士町1-1',
    deliveryLocation: '札幌冷蔵倉庫',
    deliveryAddress: '札幌市東区東雁来',
    deliveryTel: '0154-00-0000',
    cargo: '玉ねぎ',
    quantity: 15,
    unit: 'ケース',
    packaging: 'ダンボール',
    unitPrice: 200,
    amountNet: 3000,
    amountGross: 3300,
    instructions: '',
    driver: '混載流通',
    vehicle: '札幌100あ12-34',
    instructionSheet: false,
    invoiceSent: false,
    paymentReceived: false,
    orderCompleted: false
  };

  await replaceOrdersAndRefresh(page, [...seededOrders, aprilOrder]);

  await page.evaluate(() => {
    currentMonth = new Date('2026-03-01T00:00:00');
    updateMonth();
    renderTable();
    updateStats();
  });

  await expect(page.locator('#currentMonth')).toHaveText('2026年3月');
  await expect(page.locator('#orderCount')).toHaveText('2件');
  await expect(page.locator('#totalGross')).toHaveText('¥2,970');

  await page.getByRole('button', { name: '→' }).click();

  await expect(page.locator('#currentMonth')).toHaveText('2026年4月');
  await expect(page.locator('#orderCount')).toHaveText('1件');
  await expect(page.locator('#totalGross')).toHaveText('¥3,300');
});

test('invoice and payment checkboxes persist to local storage', async ({ page }) => {
  await seedLocalMode(page);
  await page.goto('/');

  const firstRow = page.locator('#tableBody tr').nth(0);
  const invoiceCheckbox = firstRow.locator('input.checkbox-small').nth(0);
  const paymentCheckbox = firstRow.locator('input.checkbox-small').nth(1);

  await invoiceCheckbox.check();
  await paymentCheckbox.check();

  await expect.poll(async () => {
    return await page.evaluate(() => {
      const orders = JSON.parse(localStorage.getItem('orders') || '[]');
      return {
        invoiceSent: !!orders[0]?.invoiceSent,
        paymentReceived: !!orders[0]?.paymentReceived
      };
    });
  }).toEqual({ invoiceSent: true, paymentReceived: true });
});

test('visible stats follow customer filtering and reset after clear', async ({ page }) => {
  await seedLocalMode(page);
  await page.goto('/');

  const adjustedOrders = [
    seededOrders[0],
    {
      ...seededOrders[1],
      orderCompleted: true
    }
  ];

  await replaceOrdersAndRefresh(page, adjustedOrders);

  await expect(page.locator('#orderCount')).toHaveText('2件');
  await expect(page.locator('#totalGross')).toHaveText('¥2,970');
  await expect(page.locator('#totalNet')).toHaveText('¥2,700');
  await expect(page.locator('#incompleteCount')).toHaveText('1件');

  await page.locator('#searchInput').fill('サンプル');

  await expect(page.locator('#orderCount')).toHaveText('1件');
  await expect(page.locator('#totalGross')).toHaveText('¥1,870');
  await expect(page.locator('#totalNet')).toHaveText('¥1,700');
  await expect(page.locator('#incompleteCount')).toHaveText('0件');
  await expect(page.locator('#tableBody tr').filter({ hasText: 'テスト青果' })).toBeHidden();
  await expect(page.locator('#tableBody tr').filter({ hasText: 'サンプル運送' })).toBeVisible();

  await page.getByRole('button', { name: 'クリア' }).click();

  await expect(page.locator('#searchInput')).toHaveValue('');
  await expect(page.locator('#orderCount')).toHaveText('2件');
  await expect(page.locator('#totalGross')).toHaveText('¥2,970');
  await expect(page.locator('#incompleteCount')).toHaveText('1件');
  await expect(page.locator('#tableBody tr').filter({ hasText: 'テスト青果' })).toBeVisible();
  await expect(page.locator('#tableBody tr').filter({ hasText: 'サンプル運送' })).toBeVisible();
});

test('today and tomorrow delivery cards exclude completed orders', async ({ page }) => {
  await freezePageDate(page, '2026-03-19T09:00:00+09:00');
  await seedLocalMode(page);
  await page.goto('/');

  const todayCompletedOrder = {
    id: 'test-4',
    orderNo: 'R260319-004',
    date: '2026-03-19',
    customerName: '完了済みテスト',
    pickupLocation: '石狩市場',
    pickupAddress: '石狩市新港西1丁目',
    deliveryLocation: '札幌西倉庫',
    deliveryAddress: '札幌市西区発寒',
    deliveryTel: '0133-00-0000',
    cargo: '長ねぎ',
    quantity: 8,
    unit: 'ケース',
    packaging: 'ダンボール',
    unitPrice: 120,
    amountNet: 960,
    amountGross: 1056,
    instructions: '',
    driver: '混載流通',
    vehicle: '札幌100あ12-34',
    instructionSheet: false,
    invoiceSent: false,
    paymentReceived: false,
    orderCompleted: true
  };

  await replaceOrdersAndRefresh(page, [...seededOrders, todayCompletedOrder]);

  await expect(page.locator('#todayDeliveryCount')).toHaveText('1件');
  await expect(page.locator('#tomorrowDeliveryCount')).toHaveText('1件');
  await expect(page.locator('#incompleteCount')).toHaveText('2件');
});

test('csv export follows the currently selected month', async ({ page }) => {
  await seedLocalMode(page);
  await installCsvCapture(page);
  await page.goto('/');

  const aprilOrder = {
    id: 'test-5',
    orderNo: 'R260401-001',
    date: '2026-04-06',
    customerName: '4月青果',
    pickupLocation: '函館市場',
    pickupAddress: '函館市港町1-1',
    deliveryLocation: '札幌青果センター',
    deliveryAddress: '札幌市白石区流通センター',
    deliveryTel: '0138-00-0000',
    cargo: 'アスパラ',
    quantity: 12,
    unit: 'ケース',
    packaging: 'ダンボール',
    unitPrice: 220,
    amountNet: 2640,
    amountGross: 2904,
    instructions: '4月出力確認',
    driver: '混載流通',
    vehicle: '函館100か11-22',
    instructionSheet: false,
    invoiceSent: false,
    paymentReceived: false,
    orderCompleted: false
  };

  await replaceOrdersAndRefresh(page, [...seededOrders, aprilOrder]);
  await page.evaluate(() => {
    window.showCsvFormatDialog = async () => 'internal';
    window.saveCsvToDir = async () => false;
    currentMonth = new Date('2026-04-01T00:00:00');
    updateMonth();
    renderTable();
    updateStats();
  });

  await page.getByRole('button', { name: /CSV出力/ }).click();

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.filename);
  }).toContain('2026年4月');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.content);
  }).toContain('R260401-001');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.content);
  }).not.toContain('R260319-001');
});

test('invoice csv export uses only the selected month and groups that month customers', async ({ page }) => {
  await seedLocalMode(page);
  await installCsvCapture(page);
  await page.goto('/');

  const aprilOrders = [
    {
      id: 'test-6',
      orderNo: 'R260401-010',
      date: '2026-04-03',
      customerName: '4月共同運送',
      pickupLocation: '小樽市場',
      pickupAddress: '小樽市港町1-2',
      deliveryLocation: '札幌共同倉庫',
      deliveryAddress: '札幌市東区東雁来',
      deliveryTel: '0134-00-0000',
      cargo: 'にんじん',
      quantity: 10,
      unit: 'ケース',
      packaging: 'ダンボール',
      unitPrice: 180,
      amountNet: 1800,
      amountGross: 1980,
      instructions: '',
      driver: '混載流通',
      vehicle: '小樽100さ33-44',
      instructionSheet: false,
      invoiceSent: false,
      paymentReceived: false,
      orderCompleted: false
    },
    {
      id: 'test-7',
      orderNo: 'R260401-011',
      date: '2026-04-08',
      customerName: '4月共同運送',
      pickupLocation: '北見市場',
      pickupAddress: '北見市卸町2丁目',
      deliveryLocation: '札幌共同倉庫',
      deliveryAddress: '札幌市東区東雁来',
      deliveryTel: '0157-00-0000',
      cargo: 'たまねぎ',
      quantity: 14,
      unit: '袋',
      packaging: 'ネット',
      unitPrice: 130,
      amountNet: 1820,
      amountGross: 2002,
      instructions: '',
      driver: '門脇悟大',
      vehicle: '北見100た55-66',
      instructionSheet: false,
      invoiceSent: false,
      paymentReceived: false,
      orderCompleted: false
    }
  ];

  await replaceOrdersAndRefresh(page, [...seededOrders, ...aprilOrders]);
  await page.evaluate(() => {
    window.saveCsvToDir = async () => false;
    currentMonth = new Date('2026-04-01T00:00:00');
    updateMonth();
    renderTable();
    updateStats();
  });

  let seenAlert = '';
  page.once('dialog', async dialog => {
    seenAlert = dialog.message();
    await dialog.accept();
  });

  await page.getByRole('button', { name: /請求書CSV/ }).click();

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.filename);
  }).toContain('請求書_2026年04月分');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.content);
  }).toContain('4月共同運送');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.content);
  }).toContain('202604-001');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__csvCapture.content);
  }).not.toContain('テスト青果');

  await expect.poll(() => seenAlert).toContain('明細 2 行');
});

test('instruction sheet modal and print output use only the selected orders', async ({ page }) => {
  await seedLocalMode(page);
  await installPrintCapture(page);
  await page.goto('/');

  await page.locator('#tableBody tr').nth(1).locator('.order-checkbox').check();
  await page.getByRole('button', { name: /運行指示書/ }).click();

  await expect(page.locator('#instructionSettingsModal')).toBeVisible();
  await expect(page.locator('#orderSequenceList')).toContainText('サンプル運送');
  await expect(page.locator('#orderSequenceList')).toContainText('R260319-002');
  await expect(page.locator('#orderSequenceList')).not.toContainText('テスト青果');

  await page.locator('#dispatchTime').fill('08:30');
  await page.getByRole('button', { name: '運行指示書を出力' }).click();

  await expect(page.locator('#instructionSettingsModal')).toBeHidden();
  await expect.poll(async () => {
    return await page.evaluate(() => window.__printWrites.length);
  }).toBe(1);

  await expect.poll(async () => {
    return await page.evaluate(() => window.__printWrites[0]?.html || '');
  }).toContain('サンプル運送');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__printWrites[0]?.html || '');
  }).toContain('08:30');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__printWrites[0]?.html || '');
  }).not.toContain('テスト青果');
});

test('pickup slip print output uses only the selected orders', async ({ page }) => {
  await seedLocalMode(page);
  await installPrintCapture(page);
  await page.goto('/');

  await page.locator('#tableBody tr').nth(1).locator('.order-checkbox').check();
  await page.getByRole('button', { name: /引取書/ }).click();

  await expect.poll(async () => {
    return await page.evaluate(() => window.__printWrites.length);
  }).toBe(1);

  await expect.poll(async () => {
    return await page.evaluate(() => window.__printWrites[0]?.html || '');
  }).toContain('サンプル運送');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__printWrites[0]?.html || '');
  }).toContain('帯広500た56-78');

  await expect.poll(async () => {
    return await page.evaluate(() => window.__printWrites[0]?.html || '');
  }).not.toContain('テスト青果');
});
