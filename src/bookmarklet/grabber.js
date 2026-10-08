// == VTC Integrated Bookmarklet (Calendar + Attendance + Dashboard Overlay) ==
// This script runs on any VTC portal page.
// It fetches calendar events, scrapes Class Attendance via hidden iframe,
// then renders the attendance dashboard directly on the page.
//
// To deploy:
//   1. Run node scripts/build.mjs and host vtc-combined-grabber.js.
//   2. The hosted help page creates a loader for its adjacent built script.
//   3. Share the bookmarklet with users.

(function () {
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const startYear = month < 8 ? currentYear - 1 : currentYear;
  const RANGE_START = new Date(startYear, 8, 1);  // Sep 1 of academic year start
  const RANGE_END   = new Date(startYear + 1, 8, 1);  // Sep 1 of next year
  let currentThreshold = 70;
  try {
    const savedThreshold = localStorage.getItem('vtc_threshold');
    if (savedThreshold === '80') currentThreshold = 80;
  } catch (e) {}

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => String(s || "").replace(/\s+/g, " ").trim();
  const parseHtml = html => new DOMParser().parseFromString(html, "text/html");
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

  // ── Built-in translations (shared by grabber + dashboard) ─────────────
  // Prefer window.vtcTranslations (loaded from translations.js on prior runs)
  // so edits in translations.js take effect without touching the bookmarklet.
  const builtinTranslations = {
    en: {
      languageName: 'English',
      crossSem: 'cross sem',
      crossSemTooltip: 'Module runs across semesters',
      title: 'VTC Attendance Checker',
      legend: 'blue = current rate, green = best possible rate, red line = {threshold}%',
      noteEdit: 'note: you can edit the module total hr if you got a actual attendance table so you can check how many hr you can skip :-) ',
      download: 'download',
      exportIcs: 'export ICS',
      exportIcsTitle: 'download an .ics file you can import into Google Calendar, Apple Calendar, or Outlook',
      filterModules: 'filter modules',
      overall: 'Overall',
      editMode: 'edit mode',
      doneEditing: 'done editing',
      close: 'close',
      moduleHeader: 'module',
      currentHeader: 'current',
      bestHeader: 'best possible',
      hoursHeader: 'hours',
      futureHeader: 'future',
      statusHeader: 'status',
      absentRateLabel: 'absent rate',
      lateLabel: 'late',
      skipWarning: 'IF YOU SKIP, YOU HAVE HIGH CHANCE YOUR ABSENT RATE WENT HIGH!',
      failed: 'failed',
      passed: 'passed',
      almostPass: 'almost pass',
      noRecord: 'no record',
      absentWarnInstantFail: '≥{threshold}% = instant fail',
      exportIcsPrompt: 'Which modules do you want to put in your calendar?',
      warningTitle: 'for reference only',
      warningSub: 'not 100% confirmed. always double-check with your official attendance.',
      roundUpFmt: '(round up as {n}%)',
      skipAroundFmt: 'you can skip around {time} ({approx})',
      mustAttendAll: 'you must attend all',
      approxLessonFmt: '≈ {n} lesson{plural} @ {avg}h',
      approxHalf: '≈ half a lesson @ {avg}h',
      approxQuarter: '≈ quarter of a lesson @ {avg}h',
      summaryJson: 'summary JSON',
      detailsJson: 'details JSON',
      summaryCsv: 'summary CSV',
      detailsCsv: 'details CSV',
      selectModulesToExport: 'select modules to export',
      all: 'all',
      off: 'off',
      other: 'other',
      hideFilter: 'hide filter',
      semesterFmt: 'Sem {n}',
      exporting: 'exporting...',
      moduleTip: 'module code and name',
      currentTip: 'your current attendance rate based on recorded hours',
      bestTip: 'max possible rate if you attend every future lesson',
      hoursTip: 'attended hours / total scheduled hours from calendar',
      futureTip: 'hours for lessons that have not happened yet',
      statusTip: 'passed = above {threshold}%, almost pass = below {threshold}% but can reach, failed = cooked, no record = not started/no attendance data',
      bestBarTipFmt: 'best possible rate: {value}',
      currentBarTipFmt: 'current rate: {value}',
      na: 'N/A',
      curShort: 'cur',
      bestShort: 'best',
      futShort: 'fut',
      ratingExcellent: 'excellent',
      ratingBad: 'bad',
      ratingNormal: 'normal',
      ratingUnknown: 'unknown',
      // ── Status-card strings (grabber progress) ──
      statusStart: 'Starting integrated grabber...',
      statusFindingCalendarApi: 'Finding calendar API...',
      statusFindingAttendancePage: 'Finding Class Attendance page...',
      statusFetchingEvents: 'Fetching calendar events...',
      statusFoundEvents: 'Found {n} calendar events',
      statusFetchingCalendarRange: 'Fetching calendar {start} -> {end}',
      statusGrabbingModules: 'Grabbing {n} module(s)...',
      statusGrabbingModuleProgress: '{current}/{total}: {name}',
      statusDetectingSemesters: 'Detecting semesters...',
      statusError: 'Error: {message}',
      statusUnknownError: 'unknown error',
      statusGrabbingTitle: 'Grabbing...',
      statusDoneTitle: 'Done! Grabbed {n} module(s)',
      statusErrorTitle: 'Something went wrong',
      statusDone: 'Done!',
      statusErrorShort: 'Error',
      doNotLeavePage: 'DO NOT LEAVE THE PAGE',
      // ── Language-detection alert (when portal is in Chinese) ──
      languageDetected: 'Detected non-English page language.',
      languageIssueTitle: 'Language issue',
      languageDetectedDetail: 'This site appears to be in {lang}.',
      languageSwitchToEnglish: 'Please switch the portal language to English and retry.',
      languageAlert: 'VTC Attendance Grabber: Please change the site language to English and run the grabber again.'
    },
    zh: {
      languageName: '繁體中文（香港）',
      crossSem: '跨Sem',
      crossSemTooltip: '跨Sem',
      title: 'VTC 出席率Checker',
      legend: '藍色 = 目前出席率，綠色 = 最佳可能出席率，紅線 = {threshold}%',
      noteEdit: '話比你知：如果見到個單元時間比你手上有嘅出席率list嘅時間有啲唔同嘅話，可以開編輯模式改時間就可以睇到大約可走堂時間 :-) ',
      download: '下載',
      exportIcs: '匯出 ICS',
      exportIcsTitle: '可匯入 Google 日曆 / Apple 日曆 / Outlook',
      filterModules: '篩選',
      overall: '整體',
      editMode: '編輯模式',
      doneEditing: '完成編輯',
      close: '關閉',
      moduleHeader: '單元',
      currentHeader: '目前',
      bestHeader: '最佳可能',
      hoursHeader: '時數',
      futureHeader: '未來',
      statusHeader: '狀態',
      absentRateLabel: '缺席率',
      lateLabel: '遲到',
      skipWarning: '呢個單元如果你走嘅話，個缺席率很可能即刻爆！',
      failed: '炒左',
      passed: 'Pass',
      almostPass: '差唔多Pass',
      noRecord: '沒有紀錄',
      absentWarnInstantFail: '≥{threshold}% = 即炒',
      exportIcsPrompt: '你想將哪些單元加入日曆？',
      warningTitle: '只供參考',
      warningSub: '未必 100% 準確。請以官方出席紀錄為準。',
      roundUpFmt: '（四捨五入為 {n}%）',
      skipAroundFmt: '你可以走大約 {time}（{approx}）',
      mustAttendAll: '你一定要出席',
      approxLessonFmt: '≈ {n} 堂 @ {avg}小時',
      approxHalf: '≈ 半堂 @ {avg}小時',
      approxQuarter: '≈ 四分之一堂 @ {avg}小時',
      summaryJson: '摘要 JSON',
      detailsJson: '詳細 JSON',
      summaryCsv: '摘要 CSV',
      detailsCsv: '詳細 CSV',
      selectModulesToExport: '選擇要匯出嘅單元',
      all: '全部',
      off: '取消',
      other: '其他',
      hideFilter: '隱藏篩選',
      semesterFmt: '第{n}學期',
      exporting: '匯出中...',
      moduleTip: '單元代碼與名稱',
      currentTip: '根據已記錄時數計算的目前出席率',
      bestTip: '如果所有課堂都上嘅出席率',
      hoursTip: '出席時數 / 行事曆排定總時數',
      futureTip: '尚未開始課堂的時數',
      statusTip: 'Pass只要過{threshold}%就得，差唔多Pass就上多啲堂，紅色你知咩料啦。 灰色=未開始/無記錄 ',
      bestBarTipFmt: '最高可能出席率：{value}',
      currentBarTipFmt: '目前出席率：{value}',
      na: '無',
      curShort: '目前',
      bestShort: '最佳',
      futShort: '未來',
      ratingExcellent: '勁',
      ratingBad: 'Restudy大師',
      ratingNormal: '一般',
      ratingUnknown: '未知',
      // ── Status-card strings (grabber progress) ──
      statusStart: '正在啟動整合抓取器...',
      statusFindingCalendarApi: '正在尋找日曆 API...',
      statusFindingAttendancePage: '正在尋找課堂出席頁面...',
      statusFetchingEvents: '正在獲取日曆活動...',
      statusFoundEvents: '找到 {n} 個日曆活動',
      statusFetchingCalendarRange: '正在獲取日曆 {start} -> {end}',
      statusGrabbingModules: '正在抓取 {n} 個單元...',
      statusGrabbingModuleProgress: '{current}/{total}: {name}',
      statusDetectingSemesters: '正在偵測學期...',
      statusError: '錯誤: {message}',
      statusUnknownError: '未知錯誤',
      statusGrabbingTitle: '拎緊data...',
      statusDoneTitle: '完成！已抓取 {n} 個模組',
      statusErrorTitle: '發生錯誤',
      statusDone: '完成！',
      statusErrorShort: '錯誤',
      doNotLeavePage: '請勿離開此頁面',
      // ── Language-detection alert (when portal is in Chinese) ──
      languageDetected: '偵測到非英文頁面。',
      languageIssueTitle: '語言問題',
      languageDetectedDetail: '此網站目前使用 {lang}。',
      languageSwitchToEnglish: '請將網站語言切換為英文後重試。',
      languageAlert: 'VTC 出席率Checker：請將網站語言改為英文，然後再次執行。'
    }
  };
  const tStatus = (key) => {
    const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('vtc_lang')) || 'en';
    const src = (typeof window !== 'undefined' && window.vtcTranslations) || builtinTranslations;
    return (src[lang] && src[lang][key]) || (src.en && src.en[key]) || (builtinTranslations.en && builtinTranslations.en[key]) || key;
  };

  // ── Prevent double-run ───────────────────────────────────────────────
  if (window.vtcIntegratedScraper) {
    alert('the integrated grabber is already running.\nplease refresh the page to restart.');
    return;
  }
  window.vtcIntegratedScraper = true;

  // Prevent accidental page leave while grabbing
  var preventLeave = function(e) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  };
  window.addEventListener('beforeunload', preventLeave);
  // Store the remover so we can detach it later
  window._vtcPreventLeave = function() {
    window.removeEventListener('beforeunload', preventLeave);
  };

  console.log('[VTC Attendance] Integrated grabber loaded.');

  // ── VISUAL STATUS UI ─────────────────────────────────────────────────
  let vtcStatusCard = null;
  let statusStepsContainer = null;
  let statusHeaderIcon = null;
  let statusHeaderTitle = null;
  let statusSteps = [];
  const escHtml = s => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

  const statusStyles = document.createElement('style');
  statusStyles.textContent = `
    @keyframes vtc-pop-in {
      0% { opacity: 0; transform: translateX(40px) scale(0.95); }
      100% { opacity: 1; transform: translateX(0) scale(1); }
    }
    @keyframes vtc-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }
    @keyframes vtc-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes vtc-step-in {
      0% { opacity: 0; transform: translateX(-8px); }
      100% { opacity: 1; transform: translateX(0); }
    }
    #vtc-integrated-status {
      animation: vtc-pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    #vtc-integrated-status .vtc-status-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    #vtc-integrated-status .vtc-status-title {
      font-size: 15px;
      font-weight: 700;
      color: #e5e7eb;
      letter-spacing: 0.3px;
    }
    #vtc-integrated-status .vtc-status-sub {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    #vtc-integrated-status .vtc-spinner {
      width: 18px;
      height: 18px;
      border: 2.5px solid rgba(96,165,250,0.2);
      border-top-color: #60a5fa;
      border-radius: 50%;
      animation: vtc-spin 0.8s linear infinite;
      flex-shrink: 0;
    }
    /* portal (light) variant for the small status spinner */
    #vtc-integrated-status.vtc-theme-portal .vtc-spinner {
      border: 2.5px solid rgba(11,61,145,0.12);
      border-top-color: #0b3d91;
      background: transparent;
    }
    #vtc-integrated-status .vtc-check {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #34d399;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0a0a0a;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
    }
    #vtc-integrated-status .vtc-steps {
      padding-top: 4px;
    }
    #vtc-integrated-status .vtc-step {
      animation: vtc-step-in 0.25s ease forwards;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 3px 0;
      font-size: 13px;
      color: #a1a1aa;
    }
    #vtc-integrated-status .vtc-step.active {
      color: #bfdbfe;
    }
    #vtc-integrated-status .vtc-step.done {
      color: #34d399;
    }
    #vtc-integrated-status .vtc-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #71717a;
      flex-shrink: 0;
    }
    #vtc-integrated-status .vtc-step.active .vtc-dot {
      background: #60a5fa;
      animation: vtc-pulse 1.2s ease-in-out infinite;
    }
    #vtc-integrated-status .vtc-step.done .vtc-dot {
      background: #34d399;
    }
    #vtc-integrated-status .vtc-status-footer {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid rgba(255,255,255,0.06);
      font-size: 11px;
      color: #78716c;
      text-align: center;
      letter-spacing: 0.02em;
    }
    /* portal (light) variants for status steps and text */
    #vtc-integrated-status.vtc-theme-portal .vtc-step {
      color: #4b5563; /* muted dark for normal steps */
    }
    #vtc-integrated-status.vtc-theme-portal .vtc-step.active {
      color: #0b63d6; /* blue for active */
    }
    #vtc-integrated-status.vtc-theme-portal .vtc-step.done {
      color: #16a34a; /* green for done */
    }
    #vtc-integrated-status.vtc-theme-portal .vtc-status-footer {
      color: #6b7280;
    }
  `;
  document.head.appendChild(statusStyles);

  function ensureStatusCard() {
    if (vtcStatusCard) return;
    vtcStatusCard = document.createElement('div');
    vtcStatusCard.id = 'vtc-integrated-status';
    const st = vtcStatusCard.style;
    st.position = 'fixed';
    st.top = '16px';
    st.right = '16px';
    st.zIndex = '999999';
    st.width = '320px';
    st.padding = '16px 20px';
    st.borderRadius = '14px';
    st.fontFamily = 'Arial, Helvetica, sans-serif';
    st.fontSize = '14px';
    st.lineHeight = '1.5';

    // detect saved theme preference; default to portal (light) when missing
    let isPortalTheme = true;
    try {
      const saved = (typeof localStorage !== 'undefined') ? localStorage.getItem('vtc_theme') : null;
      if (saved && saved !== 'portal') isPortalTheme = false;
    } catch (e) {
      isPortalTheme = true;
    }

    if (isPortalTheme) {
      st.color = '#0b3d91';
      st.background = 'rgba(255,255,255,0.98)';
      st.border = '1px solid rgba(11,61,145,0.08)';
      st.boxShadow = '0 10px 24px rgba(14,30,37,0.06)';
    } else {
      st.color = '#e5e7eb';
      st.background = 'rgba(3, 15, 35, 0.98)';
      st.border = '1px solid rgba(96, 165, 250, 0.2)';
      st.boxShadow = '0 20px 40px rgba(2, 8, 23, 0.82)';
    }
    if (st.backdropFilter !== undefined) st.backdropFilter = 'blur(10px)';
    // add a class so CSS (statusStyles) can target portal variant
    vtcStatusCard.classList.toggle('vtc-theme-portal', isPortalTheme);

    // Build static structure once
    vtcStatusCard.innerHTML =
      '<div class="vtc-status-header">' +
        '<span style="font-size:16px;">&#9989;</span>' +
        '<span class="vtc-status-title">VTC Attendance Grabber</span>' +
      '</div>' +
      '<div class="vtc-status-sub">' +
        '<div id="vtc-status-icon" class="vtc-spinner"></div>' +
        '<strong id="vtc-status-subtitle" style="color:#fbbf24;font-size:14px;letter-spacing:0.3px;">Grabbing...</strong>' +
      '</div>' +
      '<div id="vtc-status-warning" class="vtc-status-warning" style="display:none;margin:6px 0;padding:8px 6px;font-size:13px;color:#f87171;font-weight:700;text-align:center;letter-spacing:0.3px;background:rgba(248,113,113,0.08);border-radius:6px;border:1px solid rgba(248,113,113,0.2);">&#9888; ' + tStatus('doNotLeavePage') + '</div>' +
      '<div id="vtc-status-steps" class="vtc-steps"></div>' +
      '<div class="vtc-status-footer">VTC attendance checker</div>';

    document.body.appendChild(vtcStatusCard);
    statusStepsContainer = vtcStatusCard.querySelector('#vtc-status-steps');
    statusHeaderIcon = vtcStatusCard.querySelector('#vtc-status-icon');
    statusHeaderTitle = vtcStatusCard.querySelector('#vtc-status-subtitle');

    // adjust some inner element colors for portal (light) theme
    try {
      if (isPortalTheme) {
        const titleEl = vtcStatusCard.querySelector('.vtc-status-title');
        if (titleEl) titleEl.style.color = '#0b3d91';
        if (statusHeaderTitle) statusHeaderTitle.style.color = '#0b63d6';
        if (statusHeaderIcon) {
          statusHeaderIcon.style.border = '2.5px solid rgba(11,61,145,0.12)';
          statusHeaderIcon.style.borderTopColor = '#0b3d91';
          statusHeaderIcon.style.background = 'transparent';
        }
      } else {
        const titleEl = vtcStatusCard.querySelector('.vtc-status-title');
        if (titleEl) titleEl.style.color = '#e5e7eb';
        if (statusHeaderTitle) statusHeaderTitle.style.color = '#60a5fa';
        if (statusHeaderIcon) {
          statusHeaderIcon.style.border = '2.5px solid rgba(96,165,250,0.2)';
          statusHeaderIcon.style.borderTopColor = '#60a5fa';
        }
      }
    } catch (e) { /* ignore */ }
  }

  function setStatusIconAndTitle(type) {
    if (!statusHeaderIcon || !statusHeaderTitle) return;
    if (type === 'success') {
      statusHeaderIcon.className = 'vtc-check';
      statusHeaderIcon.innerHTML = '&#10003;';
      statusHeaderTitle.style.color = '#34d399';
      statusHeaderTitle.textContent = tStatus('statusDone');
    } else if (type === 'error') {
      statusHeaderIcon.className = 'vtc-check';
      statusHeaderIcon.style.background = '#f87171';
      statusHeaderIcon.style.color = '#fff';
      statusHeaderIcon.innerHTML = '&#10007;';
      statusHeaderTitle.style.color = '#f87171';
      statusHeaderTitle.textContent = tStatus('statusErrorShort');
    } else {
      statusHeaderIcon.className = 'vtc-spinner';
      statusHeaderIcon.innerHTML = '';
      statusHeaderIcon.style.background = '';
      statusHeaderIcon.style.color = '';
      statusHeaderTitle.style.color = '#60a5fa';
      statusHeaderTitle.textContent = tStatus('statusGrabbingTitle');
    }
  }

  function renderSteps(type) {
    if (!statusStepsContainer) return;
    statusStepsContainer.innerHTML = statusSteps.map((step, i) => {
      const isDone = i < statusSteps.length - 1 || type === 'success';
      const isActive = i === statusSteps.length - 1 && type !== 'success' && type !== 'error';
      const cls = isDone ? 'done' : (isActive ? 'active' : '');
      const icon = isDone
        ? '<div class="vtc-check">&#10003;</div>'
        : (isActive ? '<div class="vtc-spinner"></div>' : '<div class="vtc-dot"></div>');
      return `<div class="vtc-step ${cls}">${icon}<span>${escHtml(step)}</span></div>`;
    }).join('');
  }

  function showStatus(title, type) {
    ensureStatusCard();
    setStatusIconAndTitle(type);
    renderSteps(type);
    var warning = document.getElementById('vtc-status-warning');
    if (warning) {
      warning.style.display = (type !== 'success' && type !== 'error') ? 'block' : 'none';
    }
  }

  function pushStep(text) {
    statusSteps.push(text);
    showStatus(tStatus('statusGrabbingTitle'), 'info');
  }

  function updateStatus(html) {
    if (statusSteps.length === 0) return;
    statusSteps[statusSteps.length - 1] = html;
    showStatus(tStatus('statusGrabbingTitle'), 'info');
  }

  function removeStatus(delay) {
    if (!vtcStatusCard) return;
    var warning = document.getElementById('vtc-status-warning');
    if (warning) warning.style.display = 'none';
    // Remove beforeunload handler so user can leave freely
    if (window._vtcPreventLeave) {
      window._vtcPreventLeave();
      window._vtcPreventLeave = null;
    }
    setTimeout(() => {
      if (vtcStatusCard) {
        vtcStatusCard.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        vtcStatusCard.style.opacity = '0';
        vtcStatusCard.style.transform = 'translateX(40px) scale(0.95)';
        setTimeout(() => {
          if (vtcStatusCard && vtcStatusCard.parentNode) {
            vtcStatusCard.parentNode.removeChild(vtcStatusCard);
          }
          vtcStatusCard = null;
          statusStepsContainer = null;
          statusHeaderIcon = null;
          statusHeaderTitle = null;
          statusSteps = [];
        }, 400);
      }
    }, delay || 0);
  }

  pushStep(tStatus('statusStart'));

  // ── HELPERS ──────────────────────────────────────────────────────────
  const download = (name, content, type) => {
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toCsv = rows => {
    const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
    const esc = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
    return [
      keys.map(esc).join(","),
      ...rows.map(row => keys.map(key => esc(row[key])).join(","))
    ].join("\n");
  };

  const escapeIcs = s => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n").replace(/\r/g, "");

  const toIcsCompactDate = raw => {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    // already compact
    if (/^\d{8}T\d{6}(Z)?$/.test(s)) return s;
    // ISO 2025-09-05T11:30:00 or 2025-09-05T11:30:00+08:00
    const m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
    if (m) return `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}${m[6]}`;
    // fallback: try Date parsing
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const pad = n => String(n).padStart(2, "0");
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    }
    return s;
  };

  const foldIcsLine = line => {
    // RFC 5545 lines must be <= 75 octets; fold with CRLF + space
    const result = [];
    let bytes = 0;
    let current = "";
    for (const char of line) {
      const charBytes = new Blob([char]).size;
      if (bytes + charBytes > 75) {
        result.push(current);
        current = " " + char;
        bytes = 1 + charBytes;
      } else {
        current += char;
        bytes += charBytes;
      }
    }
    if (current) result.push(current);
    return result.join("\r\n");
  };

  const toIcs = events => {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//VTC MyPortal Export//Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:VTC Timetable",
      "X-WR-TIMEZONE:Asia/Hong_Kong"
    ];

    const now = new Date();
    const nowStamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

    for (const ev of events) {
      const startRaw = ev.startDateTime || ev.start || ev.startTime || ev.begin || "";
      const endRaw   = ev.endDateTime   || ev.end   || ev.endTime   || ev.finish || "";
      if (!startRaw || !endRaw) continue;

      const dtStart = toIcsCompactDate(startRaw);
      const dtEnd   = toIcsCompactDate(endRaw);
      if (!dtStart || !dtEnd) continue;

      const summary = escapeIcs(ev.summary || ev.title || ev.name || ev.subject || "Lesson");
      const description = escapeIcs(ev.details || ev.description || "");
      const location = escapeIcs(ev.location || "");

      // build a stable UID similar to the portal export
      const uidStr = `${summary}-${dtStart}-${dtEnd}-IV`;
      const uid = typeof btoa === "function"
        ? btoa(unescape(encodeURIComponent(uidStr))).replace(/=+$/, "") + "@vtc-myportal"
        : `vtc-${summary.replace(/\s+/g, "_")}-${dtStart}@vtc-myportal`;

      lines.push("BEGIN:VEVENT");
      lines.push(foldIcsLine(`UID:${uid}`));
      lines.push(`DTSTAMP:${nowStamp}`);
      lines.push(`DTSTART;TZID=Asia/Hong_Kong:${dtStart}`);
      lines.push(`DTEND;TZID=Asia/Hong_Kong:${dtEnd}`);
      lines.push(foldIcsLine(`SUMMARY:${summary}`));
      if (description) lines.push(foldIcsLine(`DESCRIPTION:${description}`));
      if (location) lines.push(foldIcsLine(`LOCATION:${location}`));
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  };

  // Accept either a single string or an array of strings (for multi-language support)
  const findMenuUrlByText = textOrTexts => {
    const texts = Array.isArray(textOrTexts) ? textOrTexts : [textOrTexts];
    const links = [...document.querySelectorAll("a[href]")];
    for (const text of texts) {
      const link = links.find(a => {
        const label = clean(a.textContent);
        return label === text || label.includes(text);
      });
      if (link) {
        return new URL(link.getAttribute("href"), document.baseURI).href;
      }
    }
    throw new Error(`Cannot find left menu link: ${texts.join(' / ')}`);
  };

  const { timeToMinutes, lessonMinutes, attendedMinutesFromRow, parseVtcDateTime, eventStartEnd, eventMinutes, getEventText } = window.VtcAttendanceCore;
  const moduleCodeFromText = window.VtcAttendanceCore.codeFromText;
  const postForm = async (form, extraFields = {}) => {
    const fd = new FormData(form);

    for (const [key, value] of Object.entries(extraFields)) {
      fd.set(key, value);
    }

    const action = new URL(form.getAttribute("action"), location.origin).href;

    const res = await fetch(action, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams(fd)
    });

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}: ${action}`);
    }

    return await res.text();
  };

  const getCalendarFeedUrl = async () => {
    if (typeof eventFeedUrl !== "undefined") {
      return new URL(eventFeedUrl, location.origin).href;
    }

    const calendarUrl = findMenuUrlByText(["Calendar", "日曆"]);
    console.log("Fetching Calendar page:", calendarUrl);
    pushStep(tStatus('statusFindingCalendarApi'));

    const res = await fetch(calendarUrl, {
      method: "GET",
      credentials: "same-origin",
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}: ${calendarUrl}`);
    }

    const html = await res.text();
    const m = html.match(/var\s+eventFeedUrl\s*=\s*['"]([^'"]+)['"]/);

    if (!m) {
      throw new Error("Cannot find eventFeedUrl in Calendar page.");
    }

    return new URL(m[1], location.origin).href;
  };

  const fetchCalendarEvents = async () => {
    const feedUrl = await getCalendarFeedUrl();

    const fetchRange = async (fromDate, toDate) => {
      const url = new URL(feedUrl);
      url.searchParams.set("from", ymd(fromDate));
      url.searchParams.set("to", ymd(toDate));

      const res = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: {
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest"
        }
      });

      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}: ${url}`);
      }

      return await res.json();
    };

    const normalize = data => {
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.events)) return data.events;
      if (Array.isArray(data.data)) return data.data;
      return [data];
    };

    const addMonths = d => new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const all = [];

    for (let cursor = new Date(RANGE_START); cursor < RANGE_END; cursor = addMonths(cursor)) {
      const next = addMonths(cursor);
      const chunkEnd = next < RANGE_END ? next : RANGE_END;

      console.log(`Calendar fetch: ${ymd(cursor)} -> ${ymd(chunkEnd)}`);
      updateStatus(tStatus('statusFetchingCalendarRange').replace('{start}', ymd(cursor)).replace('{end}', ymd(chunkEnd)));
      all.push(...normalize(await fetchRange(cursor, chunkEnd)));
      await sleep(150);
    }

    const seen = new Set();

    return all.filter(event => {
      const key = JSON.stringify(event);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  function findAttendanceForm(doc) {
    return [...doc.forms].find(form =>
      form.querySelector("select") &&
      form.querySelector("[id$='changeModuleButton']")
    );
  }

  const loadIframe = async url => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1200px;height:900px;";
    document.body.appendChild(iframe);

    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Profile page timed out. Retry the bookmarklet.')), 20000);
        iframe.onload = () => { clearTimeout(timer); resolve(); };
        iframe.onerror = () => { clearTimeout(timer); reject(new Error('Could not load the Profile page.')); };
        iframe.src = url;
      });
    } catch (error) { iframe.remove(); throw error; }

    await sleep(1000);
    return iframe;
  };

  const waitForIframeLoadAfterClick = async (iframe, clickFn) => {
    const loaded = new Promise(resolve => {
      const done = () => {
        iframe.removeEventListener("load", done);
        resolve();
      };

      iframe.addEventListener("load", done);
    });

    clickFn();

    await Promise.race([loaded, sleep(6000)]);
    await sleep(1000);
  };

  const findClassAttendancePage = async () => {
    const profileUrl = findMenuUrlByText(["Profile", "個人檔案"]);
    console.log("Loading Profile in hidden iframe:", profileUrl);
    pushStep(tStatus('statusFindingAttendancePage'));

    const iframe = await loadIframe(profileUrl);
    let doc = iframe.contentDocument;

    if (findAttendanceForm(doc)) {
      const html = doc.documentElement.outerHTML;
      iframe.remove();
      return html;
    }

    const classTabLink = [...doc.querySelectorAll("a[id]")]
      .find(a => {
        const t = clean(a.textContent);
        return t.includes("Class Attendance") || t.includes("課堂出席");
      });

    if (!classTabLink) {
      console.log("Iframe Profile preview:", clean(doc.body ? doc.body.innerText : "").slice(0, 1500));
      iframe.remove();
      throw new Error("Cannot find Class Attendance tab link in Profile iframe.");
    }

    console.log("Clicking Class Attendance tab in iframe:", classTabLink.id);

    await waitForIframeLoadAfterClick(iframe, () => classTabLink.click());

    doc = iframe.contentDocument;

    if (!findAttendanceForm(doc)) {
      console.log("After iframe tab click preview:", clean(doc.body ? doc.body.innerText : "").slice(0, 1500));
      iframe.remove();
      throw new Error("Clicked Class Attendance tab, but cannot find attendance module form.");
    }

    const html = doc.documentElement.outerHTML;
    iframe.remove();
    return html;
  };

  // ── SEMESTER ESTIMATION FROM CALENDAR GAPS ───────────────────────────
  const estimateSemesterRanges = (events) => {
    const allDates = events.map(e => {
      const se = eventStartEnd(e);
      if (!se) return null;
      return new Date(se.start.getFullYear(), se.start.getMonth(), se.start.getDate());
    }).filter(Boolean).sort((a, b) => a - b);

    if (allDates.length === 0) return [];

    const seen = new Set();
    const dates = allDates.filter(d => {
      const key = d.toDateString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const first = dates[0];
    const last = dates[dates.length - 1];
    const totalDays = (last - first) / (1000 * 60 * 60 * 24);

    // Short study period — just one block
    if (totalDays < 60) {
      return [{ name: "Overall", start: first, end: last }];
    }

    // Find all gaps >= 10 days between consecutive event dates
    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
      const gap = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
      if (gap >= 10) {
        gaps.push({
          from: dates[i - 1],
          to: dates[i],
          days: gap
        });
      }
    }

    // Sort by gap size descending, take top 2 as semester breaks
    gaps.sort((a, b) => b.days - a.days);
    const breakPoints = gaps.slice(0, 2).map(g => ({
      date: new Date(g.from.getTime() + (g.to - g.from) / 2)
    }));
    breakPoints.sort((a, b) => a.date - b.date);

    const ranges = [];
    let cursor = new Date(first);
    let idx = 1;

    for (const bp of breakPoints) {
      if (bp.date > cursor) {
        ranges.push({
          name: "Sem " + idx,
          start: new Date(cursor),
          end: new Date(bp.date)
        });
        idx++;
        cursor = new Date(bp.date.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    if (cursor <= last) {
      ranges.push({
        name: "Sem " + idx,
        start: new Date(cursor),
        end: new Date(last)
      });
    }

    // If no meaningful breaks found, fall back to even split (max 3)
    if (ranges.length === 0) {
      const chunkDays = Math.max(45, Math.round(totalDays / 3));
      let c = new Date(first);
      let i = 1;
      while (c < last && i <= 3) {
        const end = new Date(c.getTime() + chunkDays * 24 * 60 * 60 * 1000);
        ranges.push({ name: "Sem " + i, start: new Date(c), end: end > last ? last : end });
        c = new Date(end.getTime() + 24 * 60 * 60 * 1000);
        i++;
      }
    }

    return ranges;
  };

  const getModules = doc => {
    const form = findAttendanceForm(doc);

    if (!form) {
      throw new Error("Cannot find attendance module form.");
    }

    const select = form.querySelector("select");
    const seen = new Set();

    return [...select.options]
      .filter(option => option.value)
      .map(option => ({
        value: moduleCodeFromText(option.value) || moduleCodeFromText(option.textContent),
        portalValue: option.value,
        text: clean(option.textContent)
      }))
      .filter(module => {
        if (!module.value) return false;
        const key = `${module.value}|${module.text}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const parseRows = doc => {
    return [...doc.querySelectorAll("table.hkvtcsp_wording tbody tr")]
      .map(tr => {
        const tds = [...tr.querySelectorAll("td")].map(td => clean(td.textContent));

        return {
          date: tds[0] || "",
          status: tds[1] || "",
          attendTime: tds[2] || "",
          lessonTime: tds[3] || "",
          room: tds[4] || ""
        };
      })
      .filter(row => /^\d{2}\/\d{2}\/\d{4}/.test(row.date));
  };

  const submitModule = async (html, module) => {
    const doc = parseHtml(html);
    const form = findAttendanceForm(doc);

    if (!form) {
      throw new Error("Cannot find attendance module form.");
    }

    const select = form.querySelector("select");
    const button = form.querySelector("[id$='changeModuleButton']");

    const fields = {};
    fields[select.name] = module.portalValue ?? module.value;
    fields[button.name] = button.value || "";
    fields[`${form.name}_SUBMIT`] = "1";

    return await postForm(form, fields);
  };

  // Read explicit module totals from the page and each fetched attendance form.
  // The staff CAS report in the supplied photograph is a different origin and
  // cannot be fetched with the student's MyPortal session.
  (async () => {
    const core = window.VtcAttendanceCore;
    pushStep(tStatus('statusFetchingEvents'));
    let calendarEvents = [], calendarAvailable = true;
    try {
      calendarEvents = core.normalizeEvents(await fetchCalendarEvents());
      pushStep(tStatus('statusFoundEvents').replace('{n}', calendarEvents.length));
    } catch (error) {
      calendarAvailable = false;
      console.warn('[VTC Attendance] Timetable unavailable; projections will be marked for verification.', error);
      pushStep('Timetable unavailable. Continuing with attendance records.');
    }
    let html = await findClassAttendancePage();
    const modules = getModules(parseHtml(html));
    const details = [];
    const officialHours = core.extractOfficialHours(document);
    pushStep(tStatus('statusGrabbingModules').replace('{n}', modules.length));
    for (let idx = 0; idx < modules.length; idx++) {
      const module = modules[idx];
      updateStatus(tStatus('statusGrabbingModuleProgress').replace('{current}', idx + 1).replace('{total}', modules.length).replace('{name}', module.text));
      html = await submitModule(html, module);
      const doc = parseHtml(html);
      Object.assign(officialHours, core.extractOfficialHours(doc, module.value));
      parseRows(doc).forEach(row => {
        const date = core.detailDate(row);
        if (date && date >= RANGE_START && date < RANGE_END) details.push({ moduleCode: module.value, moduleText: module.text, ...row });
      });
      await sleep(250);
    }
    pushStep(tStatus('statusDetectingSemesters'));
    const semesterRanges = estimateSemesterRanges(calendarEvents);
    const data = {
      version: 2, academicYear: startYear, modules, details: core.dedupeDetails(details), calendarEvents,
      officialHours, calendarAvailable,
      semesterRanges: semesterRanges.map(r => ({ name: r.name, start: r.start.toISOString(), end: r.end.toISOString() })),
      scrapedAt: new Date().toISOString()
    };
    const dashboard = window.VtcAttendanceDashboard.mount(data, { download, toIcs });
    // Preserve the legacy Overall summaries for the old landing-page reader.
    data.semesterSummaries = { Overall: dashboard.summaries() };
    try { localStorage.setItem('vtc-integrated-data', JSON.stringify(data)); }
    catch (error) { console.warn('[VTC Attendance] Could not save the grabbed records.', error); }
    showStatus(tStatus('statusDoneTitle').replace('{n}', modules.length), 'success');
    removeStatus(1500);
  })().catch(error => {
    console.error('[VTC Attendance] Grabber error:', error);
    pushStep(tStatus('statusError').replace('{message}', error.message || tStatus('statusUnknownError')));
    showStatus(tStatus('statusErrorTitle'), 'error');
  }).finally(() => {
    window._vtcPreventLeave?.();
    window.vtcIntegratedScraper = false;
  });
})();
