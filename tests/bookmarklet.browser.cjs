// Fixture integration test: exercises the generated bookmarklet, not a VTC login.
const { chromium } = require(process.env.VTC_PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ timezoneId: 'Asia/Hong_Kong' });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-10-08T12:00:00+08:00'));
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const codes = ['ENG3446', 'ITE4116M', 'ITP4206', 'ITP4230', 'ITP4233', 'LAN4103', 'SDD4007'];
  const form = code => `<html lang="en"><body><form name="attendance" action="/mock-profile" method="post"><select name="module"><option value="0">Choose module</option>${codes.map(c => `<option value="${c}">${c} Example module</option>`).join('')}</select><input name="changeModuleButton" id="changeModuleButton" type="submit" value="Change"></form>${code === 'ITP4206' ? '<p>Total contact hours: 50</p>' : ''}<table class="hkvtcsp_wording"><tbody>${code === 'ITP4206' ? '<tr><td>07/10/2026 (Wed)</td><td>Present</td><td>10:03</td><td>10:00 - 12:00</td><td>Lab</td></tr>' : ''}</tbody></table></body></html>`;
  await page.route('**/mock-portal', route => route.fulfill({ contentType: 'text/html', body: '<html lang="en"><body><a href="/mock-calendar">Calendar</a><a href="/mock-profile">Profile</a></body></html>' }));
  await page.route('**/mock-calendar', route => route.fulfill({ contentType: 'text/html', body: '<script>var eventFeedUrl="/mock-feed";</script>' }));
  await page.route('**/mock-feed?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([
    { summary: 'ITP4206 Example module', start: '2026-10-07T10:00:00', end: '2026-10-07T12:00:00' },
    { summary: 'ITP4206 Example module', start: '2026-10-09T10:00:00', end: '2026-10-09T12:00:00' }
  ]) }));
  const posts = [];
  await page.route('**/mock-profile', route => {
    const code = new URLSearchParams(route.request().postData() || '').get('module');
    if (code) posts.push(code);
    return route.fulfill({ contentType: 'text/html', body: form(code) });
  });
  await page.goto('http://127.0.0.1:4173/mock-portal');
  await page.addScriptTag({ url: 'http://127.0.0.1:4173/src/bookmarklet/vtc-combined-grabber.js' });
  await page.locator('.vtc-module').first().waitFor({ timeout: 20000 });
  const cached = await page.evaluate(() => JSON.parse(localStorage.getItem('vtc-integrated-data')));
  assert.deepEqual(posts, codes);
  assert.equal(cached.details.length, 1);
  assert.equal(cached.calendarEvents.length, 2);
  const s = cached.semesterSummaries.Overall.find(s => s.moduleCode === 'ITP4206');
  assert.equal(s.calendarScheduledHours, 50);
  assert.equal(s.hoursSource, 'portal');
  assert.equal(s.currentHourRate, 100);
  assert.equal(cached.semesterSummaries.Overall.find(s => s.moduleCode === 'ITE4116M').calendarScheduledHours, null);
  assert.equal(await page.evaluate(() => window.vtcIntegratedScraper), false);
  assert.equal(await page.evaluate(() => window._vtcPreventLeave), null);
  assert.equal(await page.locator('iframe').count(), 0);
  assert.deepEqual(errors, []);
  const headerHours = await page.evaluate(() => VtcAttendanceCore.extractOfficialHours(new DOMParser().parseFromString('<table><tr><th>ENG3446 (13 hr)</th><th>ITE4116M (104 hr)</th></tr></table>', 'text/html')));
  assert.deepEqual(headerHours, { ENG3446: 13, ITE4116M: 104 });
  await page.locator('[data-action=close]').click();
  await page.route('**/mock-feed?**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.addScriptTag({ url: 'http://127.0.0.1:4173/src/bookmarklet/vtc-combined-grabber.js?retry=1' });
  await page.locator('.vtc-module').first().waitFor({ timeout: 20000 });
  const retry = await page.evaluate(() => JSON.parse(localStorage.getItem('vtc-integrated-data')));
  assert.equal(retry.calendarAvailable, false);
  const retriedModule = retry.semesterSummaries.Overall.find(s => s.moduleCode === 'ITP4206');
  assert.equal(retriedModule.skipAllowanceHours, 15);
  assert.equal(retriedModule.requiredFutureAttendanceHours, 33);
  assert.ok(retriedModule.issues.includes('noTimeline'));
  const extracted = await page.evaluate(() => {
    const parse = (html, code = '') => VtcAttendanceCore.extractOfficialHours(new DOMParser().parseFromString(html, 'text/html'), code);
    return {
      columns: parse('<table><tr><th>Module</th><th>Total contact hours</th><th>Credits</th></tr><tr><td>ABC1234 Sample</td><td>27.5 h</td><td>3</td></tr><tr><td>XYZ9876</td><td>42</td><td>6</td></tr></table>'),
      paired: parse('<table><tr><td>Total teaching hours</td><td>42</td></tr></table>', 'XYZ9876'),
      chinese: parse('<p>ABC1234 總課時：27.5 小時</p>'),
      other: parse('<p>XYZ9876 Total contact hours: 42</p>', 'ABC1234'),
      conflict: parse('<p>Total contact hours: 42</p><p>Total hours: 40</p>', 'XYZ9876'),
      irrelevant: parse('<p>Credits: 3</p><p>Attendance: 70%</p><p>Lesson hours: 2</p>', 'ABC1234')
    };
  });
  assert.deepEqual(extracted, {
    columns: { ABC1234: 27.5, XYZ9876: 42 }, paired: { XYZ9876: 42 }, chinese: { ABC1234: 27.5 },
    other: { XYZ9876: 42 }, conflict: {}, irrelevant: {}
  });
  await page.goto('http://127.0.0.1:4173/src/bookmarklet/help.html');
  assert.ok((await page.locator('#bmCodeCombined').inputValue()).includes('http://127.0.0.1:4173/src/bookmarklet/vtc-combined-grabber.js'));
  console.log('Bookmarklet fixture checks passed: generic explicit total extraction, conflicts/credits rejected, no school defaults, calendar/profile/form scraping, portal precedence, grace-period Present, cache, cleanup, calendar failure recovery, rerun, local loader.');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
