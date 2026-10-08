# VTC attendance checker (VTC 出席紀錄)

A browser bookmarklet that reads MyPortal attendance and timetable data, then shows a dashboard with module totals, attendance rates, lesson records and exports. The original project is at <https://github.com/kitzure/vtc-attendance-checker>.

## Build and use

Run `node scripts/build.mjs` after changing the calculation engine, dashboard, CSS or scraper. This produces `src/bookmarklet/vtc-combined-grabber.js`, a standalone script that needs no runtime imports or package installation.

Host the repository as a static site, open `src/bookmarklet/help.html`, and copy its bookmarklet into a browser bookmark. Run that bookmark on the logged-in VTC MyPortal. The help page builds its loader from its own URL, so a fork loads its own script.

The hosted original site will continue to use its original code until these changes are deployed there. A locally served bookmarklet needs the local server to remain running. Browser or portal policies may restrict loading a script from another host.

## How total hours are chosen

The dashboard displays the source next to every total:

1. A saved manual edit, scoped to the academic year and module set.
2. An explicit total found in the portal, including `CODE (N hr)` report headers or labelled total contact hours.
3. The supplied school report reference, **only for the exact seven-module set below in academic year 2026/27**.
4. A timetable estimate, reconciled with recorded lessons.

The school report supplied on 7 October 2026 shows these totals. These are reference data for that module set, not universal VTC module defaults.

| Module | Previous exported timetable total | School report total |
| --- | ---: | ---: |
| ENG3446 | 13 | 13 |
| ITE4116M | 68 | 104 |
| ITP4206 | 63 | 52 |
| ITP4230 | 65 | 52 |
| ITP4233 | 45 | 39 |
| LAN4103 | 32 | 26 |
| SDD4007 | 16 | 13 |

The photographed staff report is on `cas.vtc.edu.hk`, a different origin from MyPortal. The student bookmarklet does not fetch that staff-only report. It can read explicit totals in the student-accessible page, otherwise it uses the scoped reference above. Future cohorts or different module sets fall back to the timetable. Choose **Timetable only** to bypass portal/reference totals, or **Edit hours** to correct a total. Each manual edit can be reset.

## Calculations and limits

- `Present`: the full recorded lesson duration, including arrivals that the portal still marks Present. `Late`: subtract actual late minutes, capped at the lesson duration. `Absent`: zero attended minutes. Unknown statuses or missing late arrival times require verification.
- Current attendance = attended minutes / recorded lesson minutes. Absence including lateness = lost minutes / total module minutes. Lesson counts are not used as the hours denominator.
- Best possible attendance = (total module minutes − known lost minutes) / total module minutes. This is an **upper bound**, assuming all remaining hours are attended; missing records can lower it.
- Calendar entries are deduplicated by module/start/end. Explicit cancelled, all-day and exam entries are excluded. Recorded lesson durations replace matching timetable entries, including shortened lessons and separate sessions on the same day.
- Remaining absence budget = `max(0, total hours − recorded hours − max(0, requirement × total hours − attended hours))`. Equivalently it is the permitted absence hours minus known lost hours, capped at the unrecorded remainder. It assumes every other remaining hour is attended. The dashboard also shows how many more hours must be attended.
- Example: ITP4230 has 52 total hours, 15.5 recorded hours and 5.6 attended hours. At 70%, 36.4 hours are required; 30.8 more must be attended out of 36.5 remaining. The absence budget is **5.7 hours**, including when the timetable has gaps. At 80% it is **0.5 hours**.
- Past lessons without attendance records stay unresolved and are not counted as future calendar lessons. Timetable gaps remain visible but do not suppress the budget based on recorded attendance and module totals. Unknown attendance statuses/arrival times or a total below recorded hours still prevent a reliable calculation.
- Calculation details also show the immediate buffer against the current recorded rate: `max(0, attended hours / requirement − recorded hours)`. This is separate from the full-module budget: a student below the current requirement has no immediate buffer, even if attending later lessons can leave a full-module absence budget.
- Computation retains minute precision; rounding only formats the figures. Requirement eligibility uses unrounded rates, with equality at the selected 70%/80% threshold accepted. The 70% Higher Diploma / 80% Foundation Studies options are consistent with [VTC's published orientation information](https://www.vtc.edu.hk/ive/hw/cs/AY2526_NewStud-Orient-Info_Eng.pdf); programme-specific conditions and the official record still apply.
- Semester boundaries are estimated from calendar gaps. A module that spans semesters has its total allocated in proportion to timetable hours, labelled as an estimate. Its status, upper bound and allowance use the whole module.

The dashboard supports English/Traditional Chinese, light/dark themes, module search, attention/verification filters, expandable lesson records, JSON/CSV downloads and selected-module ICS export. Native dialogs provide focus containment and Escape handling. Manual edits persist locally and exports recalculate from the latest values.

## Local preview

Run `node scripts/preview.mjs` and open <http://127.0.0.1:4173>. Choose the original summary and details JSON exports in the import form.

Alternatively preload files without committing them:

```powershell
node scripts/preview.mjs --summary "C:\path\vtc-integrated-attendance-summary.json" --details "C:\path\vtc-integrated-attendance-details.json" --date "2026-10-08T12:00:00+08:00"
```

Preloaded data are written only to the ignored `.local-preview/` directory. Summary/details exports do not contain the raw timetable, so this preview labels the timetable unavailable. It calculates the remaining absence budget from recorded attendance and total hours, and does not fabricate calendar events.

## Verification

```text
node --test tests/attendance-core.test.cjs
node scripts/build.mjs
node --check src/bookmarklet/vtc-combined-grabber.js
```

Browser checks use an externally available Playwright package and Chrome, with the preview server running and the supplied exports preloaded. Set `VTC_PLAYWRIGHT_PATH` to the package location if it is not on Node's module path:

```text
node tests/dashboard.browser.cjs
node tests/bookmarklet.browser.cjs
```

Coverage includes source precedence, scope, minute precision, unknown records, shortened/same-day lessons, missing past records, exact thresholds, 320–1440px reflow, 2× CSS zoom, edits/reset/persistence, exports, languages/themes, search/filter, dialogs and the generated bookmarklet's fixture portal fetch flow. Fixture tests are not a live authenticated VTC portal verification. No screen reader or other browser engine was tested.
