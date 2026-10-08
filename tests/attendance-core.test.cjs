const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/bookmarklet/attendance-core.js');
const now = new Date(2026, 9, 8, 12);
const row = (date, status, lessonTime, attendTime = '-') => ({ moduleCode: 'ITP4206', date, status, lessonTime, attendTime, room: 'Lab' });
const event = (start, end, extra = {}) => ({ summary: 'ITP4206 Mobile development', start, end, ...extra });
const summary = options => core.summarize({ moduleCode: 'ITP4206', moduleText: 'ITP4206 Mobile development', now, ...options });

test('school report totals are scoped to the exact module set and academic year', () => {
  const modules = Object.keys(core.report.hours).map(value => ({ value }));
  assert.ok(core.matchesReport(modules, now));
  assert.ok(!core.matchesReport(modules, new Date(2027, 9, 8)));
  assert.ok(!core.matchesReport(modules.slice(1), now));
  assert.ok(!core.matchesReport([...modules, { value: 'ENG9999' }], now));
  assert.deepEqual(core.report.hours, { ENG3446: 13, ITE4116M: 104, ITP4206: 52, ITP4230: 52, ITP4233: 39, LAN4103: 26, SDD4007: 13 });
});
test('manual > portal > matching school report > timetable', () => {
  const options = { events: [event('2026-10-09T10:00:00', '2026-10-09T12:00:00')], referenceHours: 52, officialHours: 48, manualHours: 50 };
  assert.equal(summary(options).calendarScheduledHours, 50);
  assert.equal(summary({ ...options, manualHours: undefined }).hoursSource, 'portal');
  assert.equal(summary({ ...options, manualHours: undefined, officialHours: undefined }).calendarScheduledHours, 52);
  assert.equal(summary({ events: options.events }).calendarScheduledHours, 2);
});
test('Present respects the portal grace period, Late subtracts actual minutes', () => {
  assert.equal(core.attendedMinutesFromRow(row('', 'Present', '14:30 - 17:30', '14:33')), 180);
  assert.equal(core.attendedMinutesFromRow(row('', 'Late', '14:00 - 17:30', '14:25')), 185);
  assert.equal(core.attendedMinutesFromRow(row('', 'Late', '14:00 - 17:30', '18:00')), 0);
  assert.equal(core.attendedMinutesFromRow(row('', 'Absent', '14:00 - 17:30')), 0);
});
test('invalid or unknown records do not turn into full attendance', () => {
  assert.equal(core.attendedMinutesFromRow(row('', 'Pending', '10:00 - 12:00')), null);
  assert.equal(core.attendedMinutesFromRow(row('', 'Late', '10:00 - 12:00')), null);
  const s = summary({ rows: [row('01/10/2026', 'Pending', '10:00 - 12:00')], referenceHours: 52 });
  assert.equal(s.currentHourRate, null);
  assert.equal(s.bestPossibleFullTermRate, null);
  assert.equal(s.skipAllowanceHours, null);
});
test('12-hour and overnight lessons, invalid clock values', () => {
  assert.equal(core.timeToMinutes('12:00 AM'), 0);
  assert.equal(core.timeToMinutes('2:30 PM'), 870);
  assert.equal(core.timeToMinutes('25:00'), null);
  assert.equal(core.timeToMinutes('10:60'), null);
  assert.equal(core.lessonMinutes('9:00 AM – 12:00 PM'), 180);
  assert.equal(core.attendedMinutesFromRow(row('', 'Late', '23:00 - 01:00', '00:15')), 45);
});
test('semantic calendar duplicates, cancellation and exam events are excluded', () => {
  const e = event('2026-10-09T10:00:00', '2026-10-09T12:00:00');
  assert.equal(core.normalizeEvents([e, { ...e, id: 'another-id' }, { ...e, title: 'Exam' }, { ...e, cancelled: true }, { summary: 'Holiday', start: e.start, end: e.end }]).length, 1);
});
test('same-day separate lessons remain separate, shortened records replace calendar duration', () => {
  const rows = [row('07/10/2026', 'Present', '10:00 - 11:00', '10:00'), row('07/10/2026', 'Absent', '14:00 - 16:00')];
  const events = [event('2026-10-07T10:00:00', '2026-10-07T12:00:00'), event('2026-10-07T14:00:00', '2026-10-07T16:00:00')];
  const s = summary({ rows: [...rows, rows[0]], events });
  assert.equal(s.records, 2);
  assert.equal(s.calendarScheduledHours, 3);
  assert.equal(s.rawCalendarScheduledHours, 4);
  assert.equal(s.attendedHours, 1);
  assert.equal(s.futureCalendarHours, 0);
});
test('missing past records stay separate from future; budget depends on recorded attendance and total', () => {
  const events = [event('2026-10-07T10:00:00', '2026-10-07T12:00:00'), event('2026-10-09T10:00:00', '2026-10-09T12:00:00')];
  const s = summary({ events });
  assert.equal(s.futureCalendarHours, 2);
  assert.equal(s.unrecordedPastHours, 2);
  assert.equal(s.skipAllowanceHours, 1.2);
  assert.equal(s.requiredFutureAttendanceHours, 2.8);
  assert.ok(s.issues.includes('missingRecords'));
});
test('absence is weighted by hours rather than number of lessons; exact 70% is allowed', () => {
  const rows = [row('07/10/2026', 'Absent', '09:00 - 12:00'), row('07/10/2026', 'Present', '12:00 - 19:00', '12:00')];
  const events = [event('2026-10-07T09:00:00', '2026-10-07T12:00:00'), event('2026-10-07T12:00:00', '2026-10-07T19:00:00')];
  const s = summary({ rows, events });
  assert.equal(s.absentRate, 30);
  assert.equal(s.currentHourRate, 70);
  assert.equal(s.status70, 'OK_NOW');
  assert.equal(s.bestStatus70, 'CAN_REACH_OR_KEEP_70_IF_FUTURE_PRESENT');
  assert.equal(summary({ rows, events, threshold: 80 }).bestStatus70, 'CANNOT_REACH_70_EVEN_IF_FUTURE_PRESENT');
});
test('total below recorded hours produces no inflated projection', () => {
  const s = summary({ rows: [row('07/10/2026', 'Present', '10:00 - 13:00', '10:00')], manualHours: 2 });
  assert.equal(s.bestPossibleFullTermRate, null);
  assert.equal(s.skipAllowanceHours, null);
  assert.ok(s.issues.includes('totalTooSmall'));
});
test('no calendar timeline preserves imported total and still calculates the hours budget', () => {
  const s = summary({ rows: [row('07/10/2026', 'Present', '10:00 - 12:00', '10:00')], fallbackTotal: 63, calendarAvailable: false });
  assert.equal(s.calendarScheduledHours, 63);
  assert.equal(s.futureCalendarHours, null);
  assert.equal(s.skipAllowanceHours, 18.9);
  assert.equal(s.requiredFutureAttendanceHours, 42.1);
  assert.equal(s.currentSkipBufferHours, 0.85);
});
test('provided ENG3446 example preserves minute precision', () => {
  const rows = [row('04/09/2026', 'Late', '14:00 - 17:30', '14:30'), row('11/09/2026', 'Absent', '14:00 - 17:30'), row('18/09/2026', 'Late', '14:00 - 17:30', '14:25'), row('25/09/2026', 'Present', '14:00 - 16:30', '13:59')];
  const s = summary({ rows, referenceHours: 13, calendarAvailable: false });
  assert.equal(s.attendanceRecordHours, 13);
  assert.equal(s.attendedHours, 8.58);
  assert.equal(s.deductedHours, 4.42);
  assert.equal(s.currentHourRate, 66.03);
  assert.equal(s.effectiveAbsentRate, 34);
});
test('rounding a displayed percentage cannot change requirement eligibility', () => {
  const s = summary({ rows: [row('07/10/2026', 'Absent', '09:00 - 12:00'), row('07/10/2026', 'Present', '12:00 - 19:00', '12:00')], referenceHours: 9.99999 });
  assert.equal(s.bestPossibleFullTermRate, 70);
  assert.equal(s.bestStatus70, 'CANNOT_REACH_70_EVEN_IF_FUTURE_PRESENT');
});
test('screenshot ITP4230: 5.7h module budget, 30.8h still required, no current-rate buffer', () => {
  const rows = [
    row('03/09/2026', 'Absent', '09:30 - 11:00'),
    row('08/09/2026', 'Present', '15:00 - 17:30', '15:04'),
    row('17/09/2026', 'Absent', '09:30 - 11:00'),
    row('22/09/2026', 'Absent', '15:00 - 17:30'),
    row('24/09/2026', 'Late', '08:30 - 11:00', '10:24'),
    row('29/09/2026', 'Absent', '15:00 - 17:30'),
    row('06/10/2026', 'Present', '15:00 - 17:30', '14:55')
  ];
  const options = { rows, referenceHours: 52, calendarAvailable: false };
  const s = summary(options);
  assert.equal(s.attendedHours, 5.6);
  assert.equal(s.attendanceRecordHours, 15.5);
  assert.equal(s.deductedHours, 9.9);
  assert.equal(s.remainingHours, 36.5);
  assert.equal(s.requiredFutureAttendanceHours, 30.8);
  assert.equal(s.skipAllowanceHours, 5.7);
  assert.equal(s.currentSkipBufferHours, 0);
  const strict = summary({ ...options, threshold: 80 });
  assert.equal(strict.requiredFutureAttendanceHours, 36);
  assert.equal(strict.skipAllowanceHours, 0.5);
  const attended = summary({ ...options, rows: [...rows, row('08/10/2026', 'Present', '15:00 - 17:30', '15:00')] });
  assert.equal(attended.skipAllowanceHours, 5.7);
  assert.equal(attended.requiredFutureAttendanceHours, 28.3);
  const missed = summary({ ...options, rows: [...rows, row('08/10/2026', 'Absent', '15:00 - 17:30')] });
  assert.equal(missed.skipAllowanceHours, 3.2);
});
test('a complete module or exhausted absence budget cannot create extra skip hours', () => {
  const rows = [row('07/10/2026', 'Present', '10:00 - 12:00', '10:00')];
  const completed = summary({ rows, referenceHours: 2, calendarAvailable: false });
  assert.equal(completed.skipAllowanceHours, 0);
  assert.equal(completed.currentSkipBufferHours, 0);
  const s = summary({ rows: [row('07/10/2026', 'Absent', '10:00 - 12:00')], referenceHours: 4, calendarAvailable: false });
  assert.equal(s.skipAllowanceHours, 0);
  assert.equal(s.bestStatus70, 'CANNOT_REACH_70_EVEN_IF_FUTURE_PRESENT');
});
