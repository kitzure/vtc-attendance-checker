// Run against scripts/preview.mjs with Playwright available externally.
const { chromium } = require(process.env.VTC_PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Hong_Kong' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/dashboard-preview.html');
  await page.locator('.vtc-module').first().waitFor();
  assert.equal(await page.locator('.vtc-module').count(), 7);
  const sums = await page.evaluate(() => window.previewDashboard.summaries());
  assert.deepEqual(Object.fromEntries(sums.map(s => [s.moduleCode, s.calendarScheduledHours])), { ENG3446: 13, ITE4116M: 68, ITP4206: 63, SDD4007: 16, ITP4233: 45, LAN4103: 32, ITP4230: 65 });
  assert.equal(sums.find(s => s.moduleCode === 'ITP4230').skipAllowanceHours, 9.6);
  assert.equal(sums.find(s => s.moduleCode === 'ITP4230').requiredFutureAttendanceHours, 39.9);
  assert.ok(sums.every(s => s.hoursSource === 'calendar'));
  assert.ok((await page.locator('[data-code=ITP4230] .vtc-allowance').textContent()).includes('Estimated absence budget 9.6 h'));
  assert.ok((await page.locator('[data-code=ITP4230] .vtc-budget').textContent()).includes('39.9 h'));
  await fs.mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/dashboard-desktop.png' });
  const overflow = async () => page.evaluate(() => {
    const el = document.getElementById('vtc-attendance-dashboard-overlay');
    return { scroll: el.scrollWidth, client: el.clientWidth };
  });
  for (const width of [820, 560, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const dims = await overflow();
    assert.ok(dims.scroll <= dims.client + 1, `Overflow at ${width}: ${JSON.stringify(dims)}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/dashboard-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#vtc-search').fill('LAN4103');
  assert.equal(await page.locator('.vtc-module').count(), 1);
  await page.locator('#vtc-search').fill('no matching module');
  assert.equal(await page.locator('.vtc-empty').count(), 1);
  await page.locator('#vtc-search').fill('');
  await page.locator('#vtc-filter').selectOption('attention');
  assert.equal(await page.locator('.vtc-module').count(), 4);
  await page.locator('#vtc-filter').selectOption('all');
  await page.locator('[data-action=edit]').click();
  await page.locator('#hours-ITP4206').fill('10');
  await page.locator('[data-code=ITP4206].vtc-edit-form button[type=submit]').click();
  assert.equal(await page.locator('#hours-ITP4206').getAttribute('aria-invalid'), 'true');
  await page.locator('#hours-ITP4206').fill('50');
  await page.locator('[data-code=ITP4206].vtc-edit-form button[type=submit]').click();
  assert.equal(await page.evaluate(() => previewDashboard.summaries().find(s => s.moduleCode === 'ITP4206').calendarScheduledHours), 50);
  await page.locator('#vtc-format').selectOption('summaryJson');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-action=download]').click();
  const download = await downloadPromise;
  const json = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  assert.equal(json.find(s => s.moduleCode === 'ITP4206').calendarScheduledHours, 50);
  assert.equal(json.find(s => s.moduleCode === 'ITP4206').skipAllowanceHours, 11);
  assert.equal(json.find(s => s.moduleCode === 'ITP4206').requiredFutureAttendanceHours, 20);
  await page.locator('[data-action=close]').click();
  await page.locator('#vtc-dashboard-reopen').click();
  assert.equal(await page.locator('[data-code=ITP4206] .vtc-source').textContent(), 'Edited total');
  await page.locator('[data-action=edit]').click();
  await page.locator('[data-action=reset][data-code=ITP4206]').click();
  assert.equal(await page.locator('#hours-ITP4206').inputValue(), '63');
  await page.locator('[data-action=edit]').click();
  await page.locator('#vtc-source').selectOption('calendar');
  assert.equal(await page.locator('[data-code=ITP4206] .vtc-metrics > div:nth-child(3) strong').textContent(), '15 / 63 h');
  await page.locator('#vtc-source').selectOption('auto');
  await page.locator('#vtc-threshold').selectOption('80');
  assert.equal(await page.locator('[data-code=ITP4206] .vtc-status').textContent(), 'Below requirement');
  await page.locator('#vtc-threshold').selectOption('70');
  await page.locator('#vtc-language').selectOption('zh');
  assert.equal(await page.locator('#vtc-title').textContent(), '出席紀錄7');
  await page.locator('[data-action=theme]').click();
  assert.equal(await page.locator('#vtc-attendance-dashboard-overlay').getAttribute('data-theme'), 'dark');
  await page.screenshot({ path: 'test-results/dashboard-dark-zh.png' });
  await page.locator('[data-code=LAN4103] summary').click();
  assert.equal(await page.locator('[data-code=LAN4103] tbody tr').count(), 5);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#vtc-attendance-dashboard-overlay').count(), 0);
  await page.locator('#vtc-dashboard-reopen').click();
  await page.locator('#vtc-language').selectOption('en');
  await page.locator('[data-action=theme]').click();
  const fixture = {
    modules: [{ value: 'ITP4206', text: 'ITP4206 ' + 'A very long module title '.repeat(12) }],
    details: [{ moduleCode: 'ITP4206', moduleText: 'ITP4206 Mobile', date: '07/10/2026', status: 'Present', lessonTime: '10:00 - 12:00', attendTime: '10:03', room: 'Lab' }],
    calendarEvents: [{ summary: 'ITP4206 Mobile', start: '2026-10-07T10:00:00', end: '2026-10-07T12:00:00' }, { summary: 'ITP4206 Mobile', start: '2026-10-09T10:00:00', end: '2026-10-09T12:00:00' }],
    officialHours: { ITP4206: 4 }, scrapedAt: '2026-10-08T12:00:00+08:00',
    semesterRanges: [{ name: 'Sem 1', start: '2026-09-01', end: '2026-12-31' }]
  };
  await page.evaluate(data => { window.previewDashboard = VtcAttendanceDashboard.mount(data, { toIcs: evs => JSON.stringify(evs) }); }, fixture);
  assert.equal(await page.evaluate(() => previewDashboard.summaries()[0].skipAllowanceHours), 1.2);
  await page.locator('#vtc-semester').selectOption('Sem 1');
  assert.equal(await page.locator('.vtc-module').count(), 1);
  await page.locator('[data-action=ics]').click();
  assert.ok(await page.locator('.vtc-ics-modal').isVisible());
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.vtc-ics-modal').count(), 0);
  assert.ok(await page.locator('#vtc-attendance-dashboard-overlay').isVisible());
  await page.locator('[data-action=ics]').click();
  await page.locator('#vtc-ics-all').uncheck();
  await page.locator('[name=module]').check();
  const icsDownload = page.waitForEvent('download');
  await page.locator('[data-export]').click();
  assert.equal((await icsDownload).suggestedFilename(), 'vtc-calendar-events.ics');
  await page.setViewportSize({ width: 320, height: 900 });
  assert.ok((await overflow()).scroll <= 320);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  assert.ok((await overflow()).scroll <= (await overflow()).client + 1);
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  await page.evaluate(() => { window.previewDashboard = VtcAttendanceDashboard.mount({
    modules: [{ value: 'ABC1234', text: 'ABC1234 Another student module' }],
    details: [{ moduleCode: 'ABC1234', date: '07/10/2026', status: 'Present', lessonTime: '10:00 - 12:00' }],
    calendarAvailable: false, scrapedAt: '2026-10-08T12:00:00+08:00'
  }); });
  assert.equal(await page.locator('.vtc-source').textContent(), 'Total unavailable');
  assert.equal(await page.evaluate(() => previewDashboard.summaries()[0].calendarScheduledHours), null);
  await page.locator('[data-action=edit]').click();
  assert.equal(await page.locator('#hours-ABC1234').inputValue(), '');
  await page.locator('#hours-ABC1234').fill('20');
  await page.locator('.vtc-edit-form button[type=submit]').click();
  assert.equal(await page.evaluate(() => previewDashboard.summaries()[0].skipAllowanceHours), 6);
  await page.locator('[data-action=reset]').click();
  assert.equal(await page.evaluate(() => previewDashboard.summaries()[0].calendarScheduledHours), null);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: report-free estimates, unknown totals and manual recovery, 320–1440px reflow, 2× CSS zoom, edit validation/persistence/reset, JSON export, search/filter, languages/themes, records, semester, ICS dialog/export, Escape, no page errors.');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
