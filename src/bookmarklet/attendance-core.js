// Shared calculation engine. This file has no browser dependencies.
(function (root) {
  'use strict';
  const round = (n, places = 2) => +n.toFixed(places);
  const report = Object.freeze({
    academicYear: 2026,
    date: '2026-10-07',
    hours: Object.freeze({ ENG3446: 13, ITE4116M: 104, ITP4206: 52, ITP4230: 52, ITP4233: 39, LAN4103: 26, SDD4007: 13 })
  });
  const codeFromText = text => String(text || '').toUpperCase().match(/\b[A-Z]{2,4}\d{4}[A-Z]?\b/)?.[0] || '';
  const academicYear = date => date.getMonth() < 8 ? date.getFullYear() - 1 : date.getFullYear();
  function matchesReport(modules, date = new Date()) {
    const codes = [...new Set(modules.map(m => m.value || m.moduleCode))].sort();
    return academicYear(date) === report.academicYear && codes.join('|') === Object.keys(report.hours).sort().join('|');
  }
  function timeToMinutes(value) {
    const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})(?:\s*([ap]m))?$/i);
    if (!m) return null;
    let h = +m[1];
    if (+m[2] > 59 || h > 23 || (m[3] && (h < 1 || h > 12))) return null;
    if (m[3]) h = h % 12 + (/pm/i.test(m[3]) ? 12 : 0);
    return h * 60 + +m[2];
  }
  function lessonRange(text) {
    const parts = String(text || '').split(/\s*[-–—]\s*/);
    if (parts.length !== 2) return null;
    const start = timeToMinutes(parts[0]);
    let end = timeToMinutes(parts[1]);
    if (start == null || end == null) return null;
    if (end < start) end += 1440;
    return { start, end, minutes: end - start };
  }
  const lessonMinutes = text => lessonRange(text)?.minutes || 0;
  function statusOf(row) {
    const status = String(row.status || '').trim();
    if (/^(present|出席)$/i.test(status)) return 'present';
    if (/^(late|遲到)$/i.test(status)) return 'late';
    if (/^(absent|缺席)$/i.test(status)) return 'absent';
    return 'unknown';
  }
  function attendedMinutesFromRow(row) {
    const range = lessonRange(row.lessonTime);
    const status = statusOf(row);
    if (!range || status === 'unknown') return null;
    if (status === 'absent') return 0;
    // Respect the recorded status: arrivals within the portal's grace period
    // are still Present. Only a Late record loses minutes.
    if (status === 'present') return range.minutes;
    let arrive = timeToMinutes(row.attendTime);
    if (arrive == null) return null;
    if (range.end > 1440 && arrive < range.start) arrive += 1440;
    return Math.max(0, range.minutes - Math.max(0, arrive - range.start));
  }
  function parseVtcDateTime(value) {
    if (!value) return null;
    const s = String(value).trim();
    const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/);
    const d = m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function eventStartEnd(event) {
    const start = parseVtcDateTime(event.startDateTime || event.start || event.startTime || event.startDate || event.begin);
    const end = parseVtcDateTime(event.endDateTime || event.end || event.endTime || event.endDate || event.finish);
    return start && end && end > start ? { start, end } : null;
  }
  const eventMinutes = event => {
    const se = eventStartEnd(event);
    return se ? (se.end - se.start) / 60000 : 0;
  };
  const getEventText = event => [event.moduleCode, event.summary, event.title, event.name, event.subject, event.details, event.description].filter(Boolean).join(' ');
  function normalizeEvents(events) {
    const seen = new Set();
    return events.filter(event => {
      if (!event || typeof event !== 'object') return false;
      const text = getEventText(event);
      const se = eventStartEnd(event);
      const code = codeFromText(text);
      if (!code || !se || event.allDay === true || event.cancelled === true || /\b(cancelled|canceled|exam|examination)\b|取消|考試/i.test(text)) return false;
      const key = `${code}|${+se.start}|${+se.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function detailDate(row) {
    const m = String(row.date || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
  }
  const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  function dedupeDetails(rows) {
    const seen = new Set();
    return rows.filter(row => {
      const key = `${row.moduleCode}|${row.date}|${row.lessonTime}|${row.room}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  // Read only explicit totals, never individual lesson durations or percentages.
  // This also accepts the CODE (N hr) headers in the school class report.
  function extractOfficialHours(doc, moduleCode = '') {
    const hours = {};
    const add = (code, value) => {
      if (code && value > 0 && value <= 2000) {
        if (hours[code] != null && hours[code] !== value) hours[code] = null;
        else if (!(code in hours)) hours[code] = value;
      }
    };
    for (const el of doc.querySelectorAll('th, option, [data-module-hours], .module-hours')) {
      const text = String(el.textContent || '').replace(/\s+/g, ' ');
      const match = text.match(/\b([A-Z]{2,4}\d{4}[A-Z]?)\b.{0,120}?\(\s*(\d+(?:\.\d+)?)\s*(?:hr?s?|hours?|小時|時數)\s*\)/i);
      if (match) add(match[1].toUpperCase(), +match[2]);
      if (el.hasAttribute('data-module-hours')) add(el.getAttribute('data-module-code') || moduleCode, +el.getAttribute('data-module-hours'));
    }
    if (moduleCode) {
      for (const el of doc.querySelectorAll('label, p, td, span')) {
        if (el.children.length > 2) continue;
        const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
        if (text.length > 180) continue;
        const match = text.match(/(?:total\s+(?:scheduled\s+|contact\s+|teaching\s+)?hours|module\s+(?:contact\s+)?hours|總時數|總課時)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:hr?s?|hours?|小時)?/i);
        if (match) add(moduleCode, +match[1]);
      }
    }
    return Object.fromEntries(Object.entries(hours).filter(([, value]) => value != null));
  }
  function summarize({ moduleCode, moduleText, rows = [], events = [], officialHours, referenceHours, manualHours, fallbackTotal, threshold = 70, now = new Date(), calendarAvailable = true }) {
    rows = dedupeDetails(rows);
    events = normalizeEvents(events).filter(e => codeFromText(getEventText(e)) === moduleCode);
    let recordMinutes = 0, attendedMinutes = 0, lateMinutes = 0, unknown = 0;
    const counts = { present: 0, late: 0, absent: 0 };
    for (const row of rows) {
      const mins = attendedMinutesFromRow(row);
      if (mins == null || !lessonMinutes(row.lessonTime)) { unknown++; continue; }
      counts[statusOf(row)]++;
      recordMinutes += lessonMinutes(row.lessonTime);
      attendedMinutes += mins;
      if (statusOf(row) === 'late') lateMinutes += lessonMinutes(row.lessonTime) - mins;
    }
    // A recorded lesson replaces its calendar entry. Past entries with no
    // attendance record stay unresolved; they are never treated as future.
    const matched = new Set();
    let futureMinutes = 0, unrecordedPastMinutes = 0, reconciledMinutes = 0;
    for (const event of events) {
      const se = eventStartEnd(event);
      const idx = rows.findIndex((row, i) => {
        const d = detailDate(row), range = lessonRange(row.lessonTime);
        const eventStart = se.start.getHours() * 60 + se.start.getMinutes();
        const eventEnd = eventStart + eventMinutes(event);
        return !matched.has(i) && d && range && dayKey(d) === dayKey(se.start) && range.start < eventEnd && range.end > eventStart;
      });
      if (idx >= 0) {
        matched.add(idx);
        reconciledMinutes += lessonMinutes(rows[idx].lessonTime);
      } else {
        reconciledMinutes += eventMinutes(event);
        if (se.end <= now) unrecordedPastMinutes += eventMinutes(event);
        else if (se.start > now) futureMinutes += eventMinutes(event);
        else unrecordedPastMinutes += eventMinutes(event);
      }
    }
    rows.forEach((row, i) => { if (!matched.has(i)) reconciledMinutes += lessonMinutes(row.lessonTime); });
    const rawCalendarHours = events.length ? events.reduce((sum, e) => sum + eventMinutes(e), 0) / 60 : +(fallbackTotal || 0);
    const inferredHours = !calendarAvailable && rawCalendarHours ? rawCalendarHours : reconciledMinutes ? reconciledMinutes / 60 : rawCalendarHours;
    let total = inferredHours || null, source = 'calendar';
    for (const [value, name] of [[referenceHours, 'report'], [officialHours, 'portal'], [manualHours, 'manual']]) {
      if (Number.isFinite(value) && value > 0) { total = value; source = name; }
    }
    const issues = [];
    if (!calendarAvailable || !events.length) issues.push('noTimeline');
    if (unknown) issues.push('unknownRecords');
    if (unrecordedPastMinutes) issues.push('missingRecords');
    if (total && recordMinutes > total * 60 + 0.01) issues.push('totalTooSmall');
    if (total && calendarAvailable && total * 60 > reconciledMinutes + 1) issues.push('incompleteCalendar');
    if (total && source !== 'calendar' && Math.abs(total - rawCalendarHours) > 0.01) issues.push('calendarMismatch');
    if (source === 'calendar') issues.push('estimatedTotal');
    const remainingMinutes = total == null ? null : Math.max(0, total * 60 - recordMinutes);
    const deductedMinutes = recordMinutes - attendedMinutes;
    const currentRaw = recordMinutes ? attendedMinutes / recordMinutes * 100 : null;
    const current = currentRaw == null ? null : round(currentRaw);
    const invalid = issues.includes('totalTooSmall') || unknown > 0;
    const bestRaw = total && !invalid ? Math.max(0, Math.min(100, (total * 60 - deductedMinutes) / (total * 60) * 100)) : null;
    const best = bestRaw == null ? null : round(bestRaw);
    // Budget from recorded attendance and the module total, independent of
    // calendar coverage. Missing timetable records remain a data-quality note.
    // Attending every other remaining hour must still meet the requirement.
    const neededMinutes = total && !invalid ? Math.max(0, total * 60 * threshold / 100 - attendedMinutes) : null;
    const skipMinutes = neededMinutes == null ? null : Math.max(0, remainingMinutes - neededMinutes);
    // Separate the full-module budget from the buffer against today's recorded
    // rate. A student below the current requirement has no immediate buffer.
    const currentBufferMinutes = !invalid && recordMinutes > 0 ? Math.min(remainingMinutes ?? Infinity, Math.max(0, attendedMinutes * 100 / threshold - recordMinutes)) : null;
    const floorHours = minutes => Math.floor((minutes + 1e-8) / 60 * 100) / 100;
    const effective = total && !invalid ? round(deductedMinutes / (total * 60) * 100, 1) : null;
    return {
      moduleCode, moduleText, records: rows.length, ...counts, lateHours: round(lateMinutes / 60),
      attendanceRecordHours: round(recordMinutes / 60), attendedHours: round(attendedMinutes / 60), deductedHours: round(deductedMinutes / 60),
      currentHourRate: current, calendarScheduledHours: total == null ? null : round(total), totalCalendarScheduledHours: total == null ? null : round(total),
      rawCalendarScheduledHours: round(rawCalendarHours), hoursSource: source, remainingHours: remainingMinutes == null ? null : round(remainingMinutes / 60),
      futureCalendarHours: calendarAvailable ? round(Math.min(futureMinutes, remainingMinutes ?? futureMinutes) / 60) : null,
      unrecordedPastHours: round(unrecordedPastMinutes / 60), unknownRecords: unknown,
      bestPossibleFullTermRate: best, skipAllowanceHours: skipMinutes == null ? null : floorHours(skipMinutes),
      requiredFutureAttendanceHours: neededMinutes == null ? null : Math.ceil((neededMinutes - 1e-8) / 60 * 100) / 100,
      currentSkipBufferHours: currentBufferMinutes == null ? null : floorHours(currentBufferMinutes),
      absentRate: effective, effectiveAbsentRate: effective, overallAbsentRate: effective, overallEffectiveAbsentRate: effective,
      avgLessonHours: events.length ? round(events.reduce((sum, e) => sum + eventMinutes(e), 0) / events.length / 60, 1) : 2,
      issues, _manualOverride: source === 'manual',
      status70: currentRaw == null ? 'NO_RECORD' : currentRaw + 1e-9 < threshold ? 'BELOW_70_NOW' : 'OK_NOW',
      bestStatus70: bestRaw == null ? 'NO_CALENDAR_MATCH' : bestRaw + 1e-9 < threshold ? 'CANNOT_REACH_70_EVEN_IF_FUTURE_PRESENT' : 'CAN_REACH_OR_KEEP_70_IF_FUTURE_PRESENT'
    };
  }
  const api = { report, academicYear, matchesReport, timeToMinutes, lessonRange, lessonMinutes, statusOf, attendedMinutesFromRow, codeFromText, getEventText, parseVtcDateTime, eventStartEnd, eventMinutes, normalizeEvents, detailDate, dedupeDetails, extractOfficialHours, summarize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VtcAttendanceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
