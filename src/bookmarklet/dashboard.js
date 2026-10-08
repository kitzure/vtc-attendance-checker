(function (root) {
  'use strict';
  const core = root.VtcAttendanceCore;
  const CSS = "__VTC_DASHBOARD_CSS__";
  const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const number = value => value == null ? '—' : Number(value).toLocaleString('en', { maximumFractionDigits: 2 });
  const strings = {
    en: {
      title: 'Attendance', subtitle: 'VTC · Academic year', close: 'Close', theme: 'Switch theme', edit: 'Edit hours', done: 'Done editing', reset: 'Reset', settings: 'Dashboard settings',
      semester: 'Study period', overall: 'Full academic year', language: 'Language', threshold: 'Attendance requirement', source: 'Total hours', auto: 'Automatic hours', calendar: 'Timetable only',
      modules: 'Modules', attention: 'Need attention', missing: 'Need verification', ontrack: 'On track', search: 'Search code or module name', filter: 'Show', all: 'All modules',
      current: 'Recorded attendance', best: 'Best possible', hours: 'Attended / total', remaining: 'Remaining hours', loss: 'Hours lost', absent: 'Absence incl. lateness',
      portal: 'Portal total', report: 'School report · 7 Oct 2026', manual: 'Edited total', estimate: 'Timetable estimate', raw: 'Timetable', recorded: 'Recorded',
      below: 'Below requirement', unreachable: 'Below even at best', noRecord: 'No records', verify: 'Check records',
      headNote: 'Current rates use recorded lessons. Best possible is an upper bound assuming all remaining hours are attended.',
      referenceNote: 'Your matching 2026/27 module set uses the supplied school report when the portal has no explicit total. You can switch to timetable totals or edit any module.',
      warning: 'Compare with your official attendance record.',
      noTimeline: 'Timetable unavailable. The budget uses recorded attendance and the module total.',
      unknownRecords: 'A status, lesson time or late arrival is missing. Check the lesson records.',
      missingRecords: 'Past timetable lessons have no attendance record. The budget uses the available records and may change when they update.',
      totalTooSmall: 'The total is smaller than recorded hours. Correct it before using projections.',
      incompleteCalendar: 'The timetable does not cover the full total. The budget uses the module total.',
      estimatedTotal: 'No official total found. This total is an estimate from the timetable and records.',
      calendarMismatch: 'Timetable hours differ from this total.',
      allowance: 'Remaining absence budget', noAllowance: 'No remaining absence budget', unknownAllowance: 'Check attendance or total hours',
      budgetCondition: 'Assumes you attend the other remaining hours.', needAttend: 'Still need to attend at least {hours} h to reach {threshold}%.',
      budgetFormula: 'Absence budget = remaining hours − hours still needed', currentBuffer: 'Can skip now while keeping recorded attendance at {threshold}% or above', noCurrentBuffer: 'No current skip buffer at {threshold}%.',
      details: 'Calculation & lesson records', empty: 'No modules match', emptyHint: 'Try another search or show all modules.', noModules: 'No attendance modules found.',
      totalLabel: 'Total module hours', invalidTotal: 'Enter a finite total greater than zero and at least the recorded hours.', saved: 'Hours updated.',
      date: 'Date', status: 'Status', lesson: 'Lesson', arrival: 'Arrival', room: 'Room', count: 'records',
      download: 'Download', format: 'Export format', summaryJson: 'Summary JSON', detailsJson: 'Details JSON', summaryCsv: 'Summary CSV', detailsCsv: 'Details CSV',
      exportIcs: 'Export calendar', selectIcs: 'Choose modules for calendar export', cancel: 'Cancel', selectAll: 'Select all',
      allocated: 'Semester share is estimated from the timetable; full module total', fullStatus: 'Status and allowance use the full module.', preview: 'Local preview · supplied exports',
      min: 'min', h: 'h', present: 'Present', late: 'Late', absentStatus: 'Absent'
    },
    zh: {
      title: '出席紀錄', subtitle: 'VTC · 學年', close: '關閉', theme: '切換主題', edit: '編輯時數', done: '完成編輯', reset: '重設', settings: '檢視設定',
      semester: '學期', overall: '整個學年', language: '語言', threshold: '最低出席要求', source: '總時數', auto: '自動選擇時數', calendar: '只用時間表',
      modules: '單元', attention: '需要留意', missing: '需要核實', ontrack: '達到要求', search: '搜尋單元編號或名稱', filter: '顯示', all: '所有單元',
      current: '已記錄出席率', best: '最高可能出席率', hours: '出席 / 總時數', remaining: '剩餘時數', loss: '扣減時數', absent: '缺席率（包括遲到）',
      portal: 'Portal 總時數', report: '學校報表 · 2026年10月7日', manual: '已修改時數', estimate: '時間表估計', raw: '時間表', recorded: '已記錄',
      below: '未達要求', unreachable: '最高仍未達要求', noRecord: '沒有紀錄', verify: '核實紀錄',
      headNote: '目前出席率根據已記錄課堂計算。最高可能出席率假設剩餘時數全部出席，只代表上限。',
      referenceNote: '你的2026/27單元組合符合所提供的學校報表。Portal 沒有列出總時數時會採用報表，可切換時間表或手動修改。',
      warning: '請與官方出席紀錄核對。',
      noTimeline: '沒有時間表。可缺席時數按已記錄出席及單元總時數計算。',
      unknownRecords: '狀態、課堂時間或遲到時間不完整，請核對課堂紀錄。',
      missingRecords: '已過去的課堂缺少出席紀錄。可缺席時數按現有紀錄計算，紀錄更新後可能改變。',
      totalTooSmall: '總時數少於已記錄時數，請先更正。', incompleteCalendar: '時間表未涵蓋總時數，可缺席時數按單元總時數計算。',
      estimatedTotal: '未找到官方總時數，目前按時間表及紀錄估計。', calendarMismatch: '時間表時數與所用總時數不同。',
      allowance: '剩餘可缺席時數', noAllowance: '沒有剩餘可缺席時數', unknownAllowance: '請核對出席紀錄或總時數',
      budgetCondition: '假設其餘剩餘時數全部出席。', needAttend: '仍須出席至少 {hours} 小時，才能達到 {threshold}%。',
      budgetFormula: '可缺席時數 = 剩餘時數 − 仍須出席時數', currentBuffer: '現在可缺席且仍維持已記錄出席率至少 {threshold}%', noCurrentBuffer: '目前沒有維持 {threshold}% 的可缺席餘額。',
      details: '計算及課堂紀錄', empty: '沒有符合條件的單元', emptyHint: '試試其他搜尋或顯示所有單元。', noModules: '找不到出席單元。',
      totalLabel: '單元總時數', invalidTotal: '請輸入大於零且不少於已記錄時數的有效數字。', saved: '已更新時數。',
      date: '日期', status: '狀態', lesson: '課堂時間', arrival: '到達時間', room: '課室', count: '筆紀錄',
      download: '下載', format: '匯出格式', summaryJson: '摘要 JSON', detailsJson: '詳細 JSON', summaryCsv: '摘要 CSV', detailsCsv: '詳細 CSV',
      exportIcs: '匯出日曆', selectIcs: '選擇要匯出日曆的單元', cancel: '取消', selectAll: '全選',
      allocated: '按時間表估計學期分配；整個單元總時數', fullStatus: '狀態及可缺席時數按整個單元計算。', preview: '本機預覽 · 已提供的匯出紀錄',
      min: '分鐘', h: '小時', present: '出席', late: '遲到', absentStatus: '缺席'
    }
  };
  function mount(data, helpers = {}) {
    document.getElementById('vtc-attendance-dashboard-overlay')?.remove();
    document.getElementById('vtc-dashboard-reopen')?.remove();
    const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
    const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
    const modules = data.modules || [];
    const dates = data.scrapedAt ? new Date(data.scrapedAt) : new Date();
    if (Number.isNaN(dates.getTime())) throw new Error('Invalid attendance snapshot date');
    const year = data.academicYear ?? core.academicYear(dates);
    const profileMatches = core.matchesReport(modules, new Date(year, 8, 1));
    const storageKey = `vtc-hours-v2:${year}:${modules.map(m => m.value).sort().join(',')}`;
    let manual = {};
    try { manual = JSON.parse(read(storageKey, '{}')) || {}; } catch {}
    let lang = read('vtc_lang', 'en') === 'zh' ? 'zh' : 'en';
    let threshold = read('vtc_threshold', '70') === '80' ? 80 : 70;
    let theme = read('vtc_theme', 'portal') === 'portal' ? 'light' : 'dark';
    let sourceMode = read('vtc_hours_source', 'auto');
    let semester = 'Overall', edit = false, search = '', filter = 'all';
    const narrow = window.matchMedia('(max-width: 560px)');
    let settingsOpen = !narrow.matches;
    let overall = [], shown = [];
    const t = key => strings[lang][key] || strings.en[key] || key;
    const priorFocus = document.activeElement;
    const overlay = document.createElement('dialog');
    overlay.id = 'vtc-attendance-dashboard-overlay';
    overlay.setAttribute('aria-labelledby', 'vtc-title');
    overlay.setAttribute('lang', lang === 'zh' ? 'zh-Hant' : 'en');
    if (CSS !== '__VTC_DASHBOARD_CSS__') {
      const style = document.createElement('style');
      style.textContent = CSS;
      overlay.append(style);
    }
    const page = document.createElement('div');
    page.className = 'vtc-page';
    overlay.append(page);
    function inRange(date, range) {
      if (!date) return false;
      const end = new Date(range.end); end.setHours(23, 59, 59, 999);
      return date >= new Date(range.start) && date <= end;
    }
    function calculate() {
      const details = core.dedupeDetails(data.details || []);
      const events = core.normalizeEvents(data.calendarEvents || []);
      overall = modules.map(module => core.summarize({
        moduleCode: module.value, moduleText: module.text, rows: details.filter(d => d.moduleCode === module.value),
        events, officialHours: sourceMode === 'auto' ? data.officialHours?.[module.value] : undefined,
        referenceHours: sourceMode === 'auto' && profileMatches ? core.report.hours[module.value] : undefined,
        manualHours: manual[module.value], fallbackTotal: data.fallbackTotals?.[module.value], threshold,
        calendarAvailable: data.calendarAvailable !== false, now: dates
      }));
      const range = semester === 'Overall' ? null : (data.semesterRanges || []).find(r => r.name === semester);
      shown = range ? overall.flatMap(s => {
        const rows = details.filter(d => d.moduleCode === s.moduleCode && inRange(core.detailDate(d), range));
        const evs = events.filter(e => core.codeFromText(core.getEventText(e)) === s.moduleCode && inRange(core.eventStartEnd(e)?.start, range));
        if (!rows.length && !evs.length) return [];
        const allEvs = events.filter(e => core.codeFromText(core.getEventText(e)) === s.moduleCode);
        const allMins = allEvs.reduce((sum, e) => sum + core.eventMinutes(e), 0);
        const partMins = evs.reduce((sum, e) => sum + core.eventMinutes(e), 0);
        const allocated = allMins > partMins && partMins > 0 && s.calendarScheduledHours != null;
        const local = core.summarize({ moduleCode: s.moduleCode, moduleText: s.moduleText, rows, events: evs,
          officialHours: allocated ? s.calendarScheduledHours * partMins / allMins : s.calendarScheduledHours,
          threshold, now: dates, calendarAvailable: data.calendarAvailable !== false });
        return [{ ...local, hoursSource: s.hoursSource, totalCalendarScheduledHours: s.calendarScheduledHours,
          bestPossibleFullTermRate: s.bestPossibleFullTermRate, skipAllowanceHours: s.skipAllowanceHours,
          requiredFutureAttendanceHours: s.requiredFutureAttendanceHours, currentSkipBufferHours: s.currentSkipBufferHours,
          overallEffectiveAbsentRate: s.effectiveAbsentRate, overallCurrentHourRate: s.currentHourRate,
          issues: [...new Set([...local.issues.filter(i => i !== 'calendarMismatch'), ...s.issues])], allocated, fullSummary: s }];
      }) : overall;
    }
    function status(summary) {
      const s = summary.fullSummary || summary;
      if (s.issues.some(i => ['totalTooSmall', 'unknownRecords', 'missingRecords'].includes(i))) return { key: 'verify', tone: 'neutral' };
      if (s.bestStatus70 === 'CANNOT_REACH_70_EVEN_IF_FUTURE_PRESENT') return { key: 'unreachable', tone: 'danger' };
      if (s.currentHourRate == null) return { key: 'noRecord', tone: 'neutral' };
      if (s.status70 === 'BELOW_70_NOW') return { key: 'below', tone: 'warning' };
      return { key: 'ontrack', tone: 'success' };
    }
    const option = (value, label, selected) => `<option value="${esc(value)}" ${selected === value ? 'selected' : ''}>${esc(label)}</option>`;
    function shell() {
      overlay.dataset.theme = theme;
      overlay.lang = lang === 'zh' ? 'zh-Hant' : 'en';
      page.innerHTML = `
        <header class="vtc-header">
          <div><p class="vtc-eyebrow">${esc(t('subtitle'))} ${year}/${String(year + 1).slice(-2)}</p><h1 id="vtc-title">${esc(t('title'))}<span class="vtc-title-count">${modules.length}</span></h1></div>
          <div class="vtc-top-actions"><button type="button" data-action="theme" aria-label="${esc(t('theme'))}">${theme === 'light' ? '◐' : '☀'}</button>
            <label class="vtc-sr-only" for="vtc-language">${esc(t('language'))}</label><select id="vtc-language">${option('en', 'English', lang)}${option('zh', '繁體中文', lang)}</select>
            <button type="button" data-action="close">${esc(t('close'))} <span aria-hidden="true">×</span></button></div>
        </header>
        <details class="vtc-settings" ${settingsOpen ? 'open' : ''}><summary>${esc(t('settings'))}<span>${threshold}%</span></summary><section class="vtc-controls" aria-label="${esc(t('filter'))}">
          <label>${esc(t('semester'))}<select id="vtc-semester">${option('Overall', t('overall'), semester)}${(data.semesterRanges || []).filter(r => r.name !== 'Overall').map(r => option(r.name, lang === 'zh' ? r.name.replace('Sem ', '學期 ') : r.name, semester)).join('')}</select></label>
          <label>${esc(t('threshold'))}<select id="vtc-threshold">${option('70', '70%', String(threshold))}${option('80', '80%', String(threshold))}</select></label>
          <label>${esc(t('source'))}<select id="vtc-source">${option('auto', t('auto'), sourceMode)}${option('calendar', t('calendar'), sourceMode)}</select></label>
          <button type="button" class="vtc-edit-button" data-action="edit" aria-pressed="${edit}">${esc(t(edit ? 'done' : 'edit'))}</button>
        </section></details>
        <p class="vtc-explainer">${esc(t('headNote'))}</p>
        ${profileMatches && sourceMode === 'auto' ? `<p class="vtc-reference">${esc(t('referenceNote'))}</p>` : ''}
        <section id="vtc-overview" class="vtc-overview" aria-label="${esc(t('modules'))}"></section>
        <div class="vtc-list-toolbar"><label class="vtc-search"><span class="vtc-sr-only">${esc(t('search'))}</span><input id="vtc-search" type="search" placeholder="${esc(t('search'))}" value="${esc(search)}"></label>
          <label class="vtc-filter">${esc(t('filter'))}<select id="vtc-filter">${option('all', t('all'), filter)}${option('attention', t('attention'), filter)}${option('verification', t('missing'), filter)}</select></label></div>
        <section id="vtc-modules" class="vtc-module-list" aria-label="${esc(t('modules'))}"></section>
        <footer class="vtc-footer"><div><strong>VTC Attendance Checker</strong><p>${esc(t('warning'))}${data.preview ? ` · ${esc(t('preview'))}` : ''}</p></div>
          <div class="vtc-export"><label class="vtc-sr-only" for="vtc-format">${esc(t('format'))}</label><select id="vtc-format">${['summaryJson', 'detailsJson', 'summaryCsv', 'detailsCsv'].map(key => option(key, t(key), '')).join('')}</select><button type="button" data-action="download">${esc(t('download'))}</button><button type="button" data-action="ics" ${!data.calendarEvents?.length ? 'disabled' : ''}>${esc(t('exportIcs'))}</button></div></footer>
        <p id="vtc-message" class="vtc-message" role="status"></p>`;
      render();
    }
    function card(s) {
      const state = status(s);
      const origin = { portal: 'portal', report: 'report', calendar: 'estimate', manual: 'manual' }[s.hoursSource];
      const rows = (data.details || []).filter(r => r.moduleCode === s.moduleCode && (semester === 'Overall' || inRange(core.detailDate(r), data.semesterRanges.find(r => r.name === semester))));
      const severe = s.issues.filter(i => i !== 'calendarMismatch' && i !== 'estimatedTotal');
      const best = s.bestPossibleFullTermRate;
      const allowance = s.skipAllowanceHours;
      const loss = s.fullSummary?.deductedHours ?? s.deductedHours;
      return `<article class="vtc-module" data-code="${esc(s.moduleCode)}">
        <div class="vtc-module-heading"><div><h2>${esc(s.moduleCode)}${/M$/.test(s.moduleCode) ? `<span class="vtc-cross">${lang === 'zh' ? '跨學期' : 'Across semesters'}</span>` : ''}</h2><p>${esc(s.moduleText.replace(new RegExp('^' + s.moduleCode + '\\s*'), ''))}</p></div><span class="vtc-status" data-tone="${state.tone}">${esc(t(state.key))}</span></div>
        <div class="vtc-metrics"><div class="vtc-rate"><span>${esc(t('current'))}</span><strong>${number(s.currentHourRate)}<small>${s.currentHourRate == null ? '' : '%'}</small></strong><div class="vtc-progress" aria-hidden="true"><i style="width:${Math.min(100, s.currentHourRate || 0)}%"></i><b style="left:${threshold}%"></b></div></div>
          <div><span>${esc(t('best'))}</span><strong>${number(best)}<small>${best == null ? '' : '%'}</small></strong></div>
          <div><span>${esc(t('hours'))}</span><strong>${number(s.attendedHours)}<small> / ${number(s.calendarScheduledHours)} ${esc(t('h'))}</small></strong><span class="vtc-source" data-source="${s.hoursSource}">${esc(t(origin))}</span></div>
          <div><span>${esc(t('remaining'))}</span><strong>${number(s.remainingHours)}<small> ${esc(t('h'))}</small></strong></div></div>
        ${s.allocated ? `<p class="vtc-inline-note">${esc(t('allocated'))}: ${number(s.totalCalendarScheduledHours)} ${esc(t('h'))}. ${esc(t('fullStatus'))}</p>` : ''}
        <div class="vtc-module-bottom"><p><span>${esc(t('loss'))}</span> <strong>${number(loss)} ${esc(t('h'))}</strong> <span class="vtc-divider">/</span> ${esc(t('absent'))} <strong>${number(s.overallEffectiveAbsentRate)}%</strong></p>
          <div class="vtc-budget"><p class="vtc-allowance" data-tone="${allowance == null ? 'neutral' : allowance > 0 ? 'success' : 'warning'}">${esc(t(allowance == null ? 'unknownAllowance' : allowance > 0 ? 'allowance' : 'noAllowance'))}${allowance != null ? ` <strong>${number(allowance)} ${esc(t('h'))}</strong>` : ''}</p>${allowance != null ? `<p class="vtc-budget-condition">${esc(t('budgetCondition'))}</p>${s.requiredFutureAttendanceHours > 0 ? `<p>${esc(t('needAttend').replace('{hours}', number(s.requiredFutureAttendanceHours)).replace('{threshold}', threshold))}</p>` : ''}` : ''}</div></div>
        ${edit ? `<form class="vtc-edit-form" data-code="${esc(s.moduleCode)}"><label for="hours-${esc(s.moduleCode)}">${esc(t('totalLabel'))}</label><input id="hours-${esc(s.moduleCode)}" class="vtc-hours-input" name="hours" type="number" inputmode="decimal" min="0.01" step="0.01" value="${number(s.totalCalendarScheduledHours).replaceAll(',', '')}" required aria-describedby="error-${esc(s.moduleCode)}"><button type="submit">${esc(t('done'))}</button>${manual[s.moduleCode] != null ? `<button type="button" data-action="reset" data-code="${esc(s.moduleCode)}">${esc(t('reset'))}</button>` : ''}<p id="error-${esc(s.moduleCode)}" class="vtc-field-error"></p></form>` : ''}
        ${severe.length ? `<div class="vtc-data-note">${severe.map(i => `<p>${esc(t(i))}${i === 'missingRecords' ? ` (${number(s.unrecordedPastHours)} ${esc(t('h'))})` : ''}</p>`).join('')}</div>` : ''}
        <details class="vtc-details"><summary>${esc(t('details'))}<span>${rows.length} ${esc(t('count'))}</span></summary><div class="vtc-calculation"><p>${esc(t('recorded'))}: <strong>${number(s.attendanceRecordHours)} ${esc(t('h'))}</strong> · ${esc(t('raw'))}: <strong>${number(s.rawCalendarScheduledHours)} ${esc(t('h'))}</strong></p>${allowance != null ? `<p>${esc(t('budgetFormula'))}: <strong>max(0, ${number(s.fullSummary?.remainingHours ?? s.remainingHours)} − ${number(s.requiredFutureAttendanceHours)}) = ${number(allowance)} ${esc(t('h'))}</strong></p>` : ''}${s.currentSkipBufferHours != null ? `<p>${s.currentSkipBufferHours > 0 ? `${esc(t('currentBuffer').replace('{threshold}', threshold))}: <strong>${number(s.currentSkipBufferHours)} ${esc(t('h'))}</strong>` : esc(t('noCurrentBuffer').replace('{threshold}', threshold))}</p>` : ''}${s.issues.includes('calendarMismatch') ? `<p>${esc(t('calendarMismatch'))}</p>` : ''}${s.issues.includes('estimatedTotal') ? `<p>${esc(t('estimatedTotal'))}</p>` : ''}</div>
          ${rows.length ? `<div class="vtc-record-scroll" tabindex="0" role="region" aria-label="${esc(s.moduleCode)} ${esc(t('details'))}"><table><caption class="vtc-sr-only">${esc(s.moduleCode)} ${esc(t('details'))}</caption><thead><tr>${['date', 'status', 'lesson', 'arrival', 'room'].map(k => `<th scope="col">${esc(t(k))}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.date)}</td><td>${esc(core.statusOf(r) === 'present' ? t('present') : core.statusOf(r) === 'late' ? t('late') : core.statusOf(r) === 'absent' ? t('absentStatus') : r.status)}</td><td>${esc(r.lessonTime)}</td><td>${esc(r.attendTime)}</td><td>${esc(r.room)}</td></tr>`).join('')}</tbody></table></div>` : `<p class="vtc-calculation">${esc(t('noRecord'))}</p>`}</details></article>`;
    }
    function render() {
      calculate();
      const attention = shown.filter(s => ['below', 'unreachable'].includes(status(s).key)).length;
      const verification = shown.filter(s => s.issues.some(i => !['calendarMismatch'].includes(i))).length;
      page.querySelector('#vtc-overview').innerHTML = [['modules', shown.length], ['attention', attention], ['missing', verification]].map(([key, n]) => `<div><strong>${n}</strong><span>${esc(t(key))}</span></div>`).join('');
      const query = search.toLowerCase().trim();
      const selected = shown.filter(s => (!query || `${s.moduleCode} ${s.moduleText}`.toLowerCase().includes(query)) &&
        (filter === 'all' || filter === 'attention' && ['below', 'unreachable'].includes(status(s).key) || filter === 'verification' && s.issues.some(i => i !== 'calendarMismatch')))
        .sort((a, b) => (a.bestPossibleFullTermRate ?? 101) - (b.bestPossibleFullTermRate ?? 101) || a.moduleCode.localeCompare(b.moduleCode));
      page.querySelector('#vtc-modules').innerHTML = selected.length ? selected.map(card).join('') : `<div class="vtc-empty"><h2>${esc(t(modules.length ? 'empty' : 'noModules'))}</h2><p>${esc(t('emptyHint'))}</p></div>`;
    }
    function close() {
      overlay.close(); overlay.remove();
      narrow.removeEventListener('change', onNarrowChange);
      priorFocus?.focus?.();
      const reopen = document.createElement('button');
      reopen.id = 'vtc-dashboard-reopen'; reopen.textContent = lang === 'zh' ? '出席紀錄' : 'Attendance';
      reopen.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483646;padding:12px 18px;background:#146b66;color:white;border:0;border-radius:8px;font:600 16px system-ui;cursor:pointer';
      reopen.addEventListener('click', () => mount(data, helpers)); document.body.append(reopen);
    }
    function onNarrowChange(e) {
      settingsOpen = !e.matches;
      const settings = page.querySelector('.vtc-settings');
      if (settings) settings.open = settingsOpen;
    }
    narrow.addEventListener('change', onNarrowChange);
    function saveFile(name, contents, type) {
      if (helpers.download) return helpers.download(name, contents, type);
      const url = URL.createObjectURL(new Blob([contents], { type }));
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function csv(rows) {
      const keys = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(k => k !== 'fullSummary');
      const escape = v => '"' + String(Array.isArray(v) ? v.join('; ') : v ?? '').replaceAll('"', '""') + '"';
      return '\uFEFF' + [keys.map(escape).join(','), ...rows.map(r => keys.map(k => escape(r[k])).join(','))].join('\r\n');
    }
    function icsModal() {
      if (!helpers.toIcs) return;
      const dialog = document.createElement('dialog'); dialog.className = 'vtc-ics-modal'; dialog.setAttribute('aria-labelledby', 'vtc-ics-title');
      const codes = [...new Set((data.calendarEvents || []).map(e => core.codeFromText(core.getEventText(e))).filter(Boolean))].sort();
      dialog.innerHTML = `<h2 id="vtc-ics-title">${esc(t('selectIcs'))}</h2><label><input type="checkbox" id="vtc-ics-all" checked> ${esc(t('selectAll'))}</label><div class="vtc-ics-options">${codes.map(code => `<label><input type="checkbox" name="module" value="${esc(code)}" checked> ${esc(code)}</label>`).join('')}</div><div class="vtc-dialog-actions"><button type="button" data-cancel>${esc(t('cancel'))}</button><button type="button" data-export>${esc(t('exportIcs'))}</button></div>`;
      overlay.append(dialog); dialog.showModal();
      dialog.querySelector('#vtc-ics-all').addEventListener('change', e => dialog.querySelectorAll('[name=module]').forEach(input => { input.checked = e.target.checked; }));
      dialog.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => dialog.remove());
      dialog.querySelector('[data-export]').addEventListener('click', () => {
        const selected = new Set([...dialog.querySelectorAll('[name=module]:checked')].map(input => input.value));
        const events = data.calendarEvents.filter(e => !core.codeFromText(core.getEventText(e)) || selected.has(core.codeFromText(core.getEventText(e))));
        saveFile('vtc-calendar-events.ics', helpers.toIcs(events), 'text/calendar;charset=utf-8'); dialog.close();
      });
    }
    overlay.addEventListener('cancel', e => { if (e.target === overlay) { e.preventDefault(); close(); } });
    page.addEventListener('click', e => {
      const button = e.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'close') return close();
      if (action === 'theme') { theme = theme === 'light' ? 'dark' : 'light'; write('vtc_theme', theme === 'light' ? 'portal' : 'compact'); overlay.dataset.theme = theme; button.textContent = theme === 'light' ? '◐' : '☀'; }
      if (action === 'edit') { edit = !edit; shell(); page.querySelector('[data-action=edit]').focus(); }
      if (action === 'reset') { delete manual[button.dataset.code]; write(storageKey, JSON.stringify(manual)); render(); }
      if (action === 'ics') icsModal();
      if (action === 'download') {
        calculate();
        const format = page.querySelector('#vtc-format').value;
        const rows = format.startsWith('summary') ? shown.map(({ fullSummary, ...s }) => s) : data.details || [];
        const isCsv = format.endsWith('Csv');
        saveFile(`vtc-integrated-attendance-${format.startsWith('summary') ? 'summary' : 'details'}.${isCsv ? 'csv' : 'json'}`, isCsv ? csv(rows) : JSON.stringify(rows, null, 2), isCsv ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8');
      }
    });
    page.addEventListener('submit', e => {
      if (!e.target.matches('.vtc-edit-form')) return;
      e.preventDefault();
      const code = e.target.dataset.code, input = e.target.elements.hours, value = Number(input.value);
      const summary = overall.find(s => s.moduleCode === code);
      const recorded = summary?.attendanceRecordHours || 0;
      if (!Number.isFinite(value) || value <= 0 || value < recorded) {
        input.setAttribute('aria-invalid', 'true'); e.target.querySelector('.vtc-field-error').textContent = t('invalidTotal'); input.focus(); return;
      }
      manual[code] = value; write(storageKey, JSON.stringify(manual)); render();
      page.querySelector(`#hours-${code}`)?.focus(); page.querySelector('#vtc-message').textContent = t('saved');
    });
    page.addEventListener('input', e => { if (e.target.id === 'vtc-search') { search = e.target.value; render(); } });
    page.addEventListener('change', e => {
      const id = e.target.id;
      if (id === 'vtc-language') { lang = e.target.value; write('vtc_lang', lang); shell(); page.querySelector('#vtc-language').focus(); }
      if (id === 'vtc-semester') { semester = e.target.value; render(); }
      if (id === 'vtc-threshold') { threshold = +e.target.value; write('vtc_threshold', String(threshold)); page.querySelector('.vtc-settings summary span').textContent = threshold + '%'; render(); }
      if (id === 'vtc-source') { sourceMode = e.target.value; write('vtc_hours_source', sourceMode); shell(); page.querySelector('#vtc-source').focus(); }
      if (id === 'vtc-filter') { filter = e.target.value; render(); }
    });
    page.addEventListener('toggle', e => { if (e.target.matches('.vtc-settings')) settingsOpen = e.target.open; }, true);
    shell(); document.body.append(overlay); overlay.showModal();
    page.querySelector('[data-action=close]').focus();
    return { overlay, summaries: () => { calculate(); return shown; }, close };
  }
  root.VtcAttendanceDashboard = { mount };
})(window);
