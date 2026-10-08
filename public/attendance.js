function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function bindAttendanceActions(element, date, period, name, code) {
  for (const button of element.querySelectorAll('[data-action="copy"]')) button.addEventListener('click', () => copyText(code));
  for (const button of element.querySelectorAll('[data-action="edit"]')) button.addEventListener('click', () => openCodeInputModal(date, period, name, code));
}
function validateAttendanceData(data) {
  const plain = value => value && typeof value === 'object' && !Array.isArray(value);
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  if (!plain(data) || (!plain(data.timetables) && !plain(data.records)) || (data.schemaVersion !== undefined && ![1,2].includes(data.schemaVersion))) throw new Error('出席データの形式が正しくありません。');
  for (const [d, slots] of Object.entries(data.records || {})) {
    if (!validDate(d) || !plain(slots)) throw new Error('記録の日付が不正です。');
    for (const [p, record] of Object.entries(slots)) if (!/^\d+$/.test(p) || Number(p) < 1 || Number(p) > 20 || !plain(record) || typeof record.className !== 'string' || record.className.length > 200 || typeof record.code !== 'string' || record.code.length > 100) throw new Error('出席記録の形式が不正です。');
  }
  for (const quarter of Object.values(data.timetables || {})) {
    if (!plain(quarter)) throw new Error('時間割の形式が不正です。');
    for (const slots of Object.values(quarter)) {
      if (!plain(slots) || Object.values(slots).some(name => typeof name !== 'string' || name.length > 200)) throw new Error('科目名が不正です。');
    }
  }
  if (data.periods !== undefined && (!Array.isArray(data.periods) || data.periods.some(p => !plain(p) || !Number.isInteger(p.id) || p.id < 1 || p.id > 20 || typeof p.name !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.endTime)))) throw new Error('時限設定が不正です。');
  if (Object.keys(data.quarters || {}).some(key => !/^q[1-4]$/.test(key))) throw new Error('学期IDが不正です。');
  for (const q of Object.values(data.quarters || {})) if (!plain(q) || !validDate(q.startDate) || !validDate(q.endDate) || typeof q.name !== 'string') throw new Error('学期設定が不正です。');
  if (data.exceptions !== undefined && (!Array.isArray(data.exceptions) || data.exceptions.some(e => !plain(e) || !validDate(e.date) || !['holiday','cancel','substitution','reschedule'].includes(e.type)))) throw new Error('例外設定が不正です。');
  if (data.courseIds !== undefined && (!plain(data.courseIds) || Object.values(data.courseIds).some(id => typeof id !== 'string' || (id && !/^[a-zA-Z0-9:_.-]{1,120}$/.test(id))))) throw new Error('共有科目IDが不正です。');
}

// ========== Attendance Tracker State & Defaults ==========
const LOCAL_STORAGE_KEY = "opetools_attendance_state";

const DEFAULT_PERIODS = [
  { id: 1, name: "1限", startTime: "08:50", endTime: "10:20" },
  { id: 2, name: "2限", startTime: "10:30", endTime: "12:00" },
  { id: 3, name: "3限", startTime: "13:00", endTime: "14:30" },
  { id: 4, name: "4限", startTime: "14:40", endTime: "16:10" },
  { id: 5, name: "5限", startTime: "16:20", endTime: "17:50" },
  { id: 6, name: "6限", startTime: "18:00", endTime: "19:30" },
];

const DEFAULT_QUARTERS = {
  q1: { name: "前期1 (Q1)", startDate: "2026-04-01", endDate: "2026-06-10" },
  q2: { name: "前期2 (Q2)", startDate: "2026-06-11", endDate: "2026-08-06" },
  q3: { name: "後期1 (Q3)", startDate: "2026-10-05", endDate: "2026-12-02" },
  q4: { name: "後期2 (Q4)", startDate: "2026-12-03", endDate: "2027-02-16" },
};

let state = {
  schemaVersion: 2,
  courseIds: {},
  pendingRecords: {},
  notifications: [],
  quarters: JSON.parse(JSON.stringify(DEFAULT_QUARTERS)),
  periods: JSON.parse(JSON.stringify(DEFAULT_PERIODS)),
  timetables: {
    q1: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} },
    q2: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} },
    q3: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} },
    q4: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} },
  },
  exceptions: [],
  records: {}, // "YYYY-MM-DD" -> { "periodId": { className, code, timestamp } }
  syncConfig: {
    id: "",
    editKey: "",
    proxyUrl: "https://tools.ainznino.workers.dev",
    serverVersion: "v2",
    autoDownload: false,
  },
};

// Application UI state
let activeTab = "dashboard";
let simulatedTime = null; // Date object when simulated, null otherwise
let dashboardSelectedDate = null; // Currently displayed date on dashboard timeline (defaults to today)
let activeModalData = null; // Data for editing modal
let isSyncing = false;

// Format dates
function formatDateString(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDayOfWeekJp(dayNum) {
  return ["日", "月", "火", "水", "木", "金", "土"][dayNum];
}

// Convert HH:MM to minutes
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

// Get the current simulated or real time
function getCurrentTime() {
  if (simulatedTime) {
    return new Date(simulatedTime);
  }
  return new Date();
}

// ========== State Save & Load ==========
function saveState() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      validateAttendanceData(parsed);
      state = {
        quarters:
          parsed.quarters || JSON.parse(JSON.stringify(DEFAULT_QUARTERS)),
        periods: parsed.periods || JSON.parse(JSON.stringify(DEFAULT_PERIODS)),
        timetables: parsed.timetables || {
          q1: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} },
          q2: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} },
          q3: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} },
          q4: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} },
        },
        exceptions: parsed.exceptions || [],
        schemaVersion: 2,
        courseIds: parsed.courseIds || {},
        pendingRecords: parsed.pendingRecords || {},
        notifications: parsed.notifications || [],
        notificationEnabled: parsed.notificationEnabled || false,
        importPending: parsed.importPending || false,
        configDirty: parsed.configDirty || false,
        records: parsed.records || {},
        syncConfig: parsed.syncConfig ? { ...state.syncConfig, ...parsed.syncConfig, serverVersion: parsed.syncConfig.serverVersion || 'v1' } : {
          id: "",
          editKey: "",
          proxyUrl: "https://tools.ainznino.workers.dev",
          serverVersion: "v2",
          autoDownload: false,
        },
      };
    } catch (e) {
      console.error(
        "Failed to load local storage state, resetting to defaults",
        e,
      );
    }
  }
}

// ========== Core Logic: Schedule Resolvers ==========

// Check which quarter a date belongs to
function getQuarterForDate(dateStr) {
  for (const [qKey, qVal] of Object.entries(state.quarters)) {
    if (dateStr >= qVal.startDate && dateStr <= qVal.endDate) {
      return qKey;
    }
  }
  // If outside ranges, try to guess or return first
  const month = parseInt(dateStr.split("-")[1], 10);
  if (month >= 4 && month <= 6) return "q1";
  if (month >= 6 && month <= 9) return "q2";
  if (month >= 10 && month <= 12) return "q3";
  return "q4";
}

// Check exceptions for a date
function getExceptionsForDate(dateStr) {
  return state.exceptions.filter((e) => e.date === dateStr);
}

// Resolve the actual timetable for a given date
function resolveTimetableForDate(dateStr) {
  const dateObj = new Date(dateStr + "T00:00:00");
  const exceptions = getExceptionsForDate(dateStr);

  // 1. Check if the entire day is a holiday
  const holidayExp = exceptions.find((e) => e.type === "holiday");
  if (holidayExp) {
    return { isHoliday: true, reason: "祝日・全休", classes: {} };
  }

  // 2. Check if day of week is substituted
  let dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon...
  const subExp = exceptions.find((e) => e.type === "substitution");
  let isSubstituted = false;
  if (subExp && subExp.substituteDay) {
    dayOfWeek = subExp.substituteDay;
    isSubstituted = true;
  }

  // Get active quarter
  const quarter = getQuarterForDate(dateStr);
  const quarterTimetable = state.timetables[quarter] || {};
  const dayClasses = quarterTimetable[dayOfWeek] || {};

  // Build base classes
  const classes = {};

  // Standard classes from timetable (if weekday 1-5, or if substituted)
  if ((dayOfWeek >= 1 && dayOfWeek <= 5) || isSubstituted) {
    for (const period of state.periods) {
      const className = dayClasses[period.id];
      if (className) {
        classes[period.id] = {
          className,
          isCancelled: false,
          isRescheduled: false,
          originalClassName: className,
        };
      }
    }
  }

  // 3. Apply cancellations
  exceptions
    .filter((e) => e.type === "cancel")
    .forEach((e) => {
      if (classes[e.periodId]) {
        classes[e.periodId].isCancelled = true;
      }
    });

  // 4. Apply rescheduled classes / extra classes
  exceptions
    .filter((e) => e.type === "reschedule")
    .forEach((e) => {
      classes[e.periodId] = {
        className: e.className,
        isCancelled: false,
        isRescheduled: true,
        originalClassName: e.className,
      };
    });

  return {
    isHoliday: false,
    isSubstituted,
    substitutedDayName: getDayOfWeekJp(dayOfWeek) + "曜日",
    classes,
  };
}

// Find if there is a class currently "active" for code entry
function getActivePeriod(nowDate) {
  const dateStr = formatDateString(nowDate);
  const resolved = resolveTimetableForDate(dateStr);
  if (resolved.isHoliday) return null;

  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  let bestPeriod = null;
  let minDiff = Infinity;

  for (const period of state.periods) {
    const classInfo = resolved.classes[period.id];
    if (!classInfo || classInfo.isCancelled) continue;

    const startMin = timeToMinutes(period.startTime);
    const endMin = timeToMinutes(period.endTime);

    // Active window: 15 minutes before class start until 45 minutes after class ends
    const windowStart = startMin - 15;
    const windowEnd = endMin + 45;

    if (currentMinutes >= windowStart && currentMinutes <= windowEnd) {
      // Priority 1: Currently running class
      if (currentMinutes >= startMin && currentMinutes <= endMin) {
        return {
          period,
          className: classInfo.className,
          dateStr,
          status: "running",
        };
      }

      // Priority 2: Closest in active window
      const diff = Math.min(
        Math.abs(currentMinutes - startMin),
        Math.abs(currentMinutes - endMin),
      );
      if (diff < minDiff) {
        minDiff = diff;
        bestPeriod = {
          period,
          className: classInfo.className,
          dateStr,
          status: currentMinutes < startMin ? "upcoming" : "finished",
        };
      }
    }
  }

  return bestPeriod;
}

// ========== Attendance Actions ==========
function setAttendanceCode(dateStr, periodId, className, code) {
  const previous = state.records[dateStr]?.[periodId];
  const trimmed = code.trim();
  if (trimmed.length > 100) { alert('コードは100文字以内で入力してね。'); return; }
  state.records[dateStr] ||= {};
  const timestamp = new Date().toISOString();
  state.records[dateStr][periodId] = { className, code: trimmed, timestamp, revision: previous?.revision || 0 };
  if (state.syncConfig.id && state.syncConfig.editKey && state.syncConfig.serverVersion === 'v2') {
    const key = `${dateStr}/${periodId}`;
    const shared = state.notifications?.find(n => n.course_id === state.courseIds?.[className] && n.date === dateStr);
    state.pendingRecords ||= {};
    state.pendingRecords[key] = { operationId: crypto.randomUUID(), datasetId: state.syncConfig.id, date: dateStr, periodId, className, code: trimmed, timestamp, revision: previous?.revision || 0, notificationRevision: shared?.revision || 0 };
  }
  saveState();
  syncStatus('端末に保存済み。');
  if (state.syncConfig.id && state.syncConfig.editKey) flushAttendanceRecords();
}

function getAttendanceCode(dateStr, periodId) {
  if (state.records[dateStr] && state.records[dateStr][periodId]) {
    return state.records[dateStr][periodId].code || "";
  }
  return "";
}

// ========== UI Tab & Navigation handlers ==========
function switchTab(tabId, element) {
  activeTab = tabId;

  // Update Tab buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  element.classList.add("active");

  // Hide all tab panes
  document.querySelectorAll(".tab-pane").forEach((pane) => {
    pane.classList.add("hidden");
  });

  // Show selected tab pane
  const activePane =
    document.getElementById(`tab-pane-${tabId}`) ||
    document.getElementById(`tab-content-${tabId}`);
  if (activePane) {
    activePane.classList.remove("hidden");
  }

  renderAll();
}

function switchDeviceGuide(device) {
  const pcBtn = document.getElementById("device-btn-pc");
  const mobileBtn = document.getElementById("device-btn-mobile");
  const pcPanel = document.getElementById("device-guide-pc");
  const mobilePanel = document.getElementById("device-guide-mobile");

  if (!pcBtn || !mobileBtn || !pcPanel || !mobilePanel) return;

  if (device === "pc") {
    pcBtn.classList.add("active");
    mobileBtn.classList.remove("active");
    pcPanel.classList.remove("hidden");
    mobilePanel.classList.add("hidden");
  } else {
    mobileBtn.classList.add("active");
    pcBtn.classList.remove("active");
    mobilePanel.classList.remove("hidden");
    pcPanel.classList.add("hidden");
  }
}

function adjustDate(days) {
  const d = new Date(dashboardSelectedDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  dashboardSelectedDate = formatDateString(d);
  renderDashboard();
}

function resetToToday() {
  dashboardSelectedDate = formatDateString(getCurrentTime());
  renderDashboard();
}

// Simulation time
function applySimulatedTime() {
  const val = document.getElementById("simTimeInput").value;
  if (val) {
    simulatedTime = new Date(val);
    renderAll();
  }
}

function resetSimulatedTime() {
  simulatedTime = null;
  document.getElementById("simTimeInput").value = "";
  renderAll();
}

// ========== Renders ==========

function updateClockAndQuickPanel() {
  const now = getCurrentTime();
  const dateStr = formatDateString(now);

  // Update current time display
  const clockEl = document.getElementById("currentTimeDisplay");
  if (clockEl) {
    const timeFormatted =
      now.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "short",
      }) + (simulatedTime ? " (シミュレーション中)" : "");
    clockEl.textContent = timeFormatted;
  }

  // Update header quarter badge
  const quarterKey = getQuarterForDate(dateStr);
  const qObj = state.quarters[quarterKey];
  const badgeEl = document.getElementById("currentQuarterBadge");
  if (badgeEl && qObj) {
    badgeEl.textContent = qObj.name;
  }

  // Update sidebar info
  const infoQuarter = document.getElementById("infoQuarter");
  if (infoQuarter && qObj) infoQuarter.textContent = qObj.name;

  const infoAppliedDay = document.getElementById("infoAppliedDay");
  const exceptions = getExceptionsForDate(dateStr);
  const isSub = exceptions.some((e) => e.type === "substitution");
  const isHoli = exceptions.some((e) => e.type === "holiday");

  if (infoAppliedDay) {
    if (isHoli) {
      infoAppliedDay.textContent = "全休・祝日";
    } else {
      const resolved = resolveTimetableForDate(dateStr);
      infoAppliedDay.textContent = resolved.isSubstituted
        ? `${resolved.substitutedDayName} (曜日振替)`
        : `${getDayOfWeekJp(now.getDay())}曜日`;
    }
  }

  const exceptionAlert = document.getElementById("infoExceptionAlert");
  if (exceptionAlert) {
    if (exceptions.length > 0) {
      exceptionAlert.classList.remove("hidden");
    } else {
      exceptionAlert.classList.add("hidden");
    }
  }

  // Auto-detect and render quick entry
  const activeClass = getActivePeriod(now);
  const quickPanel = document.getElementById("quickEntryPanel");
  if (activeClass) {
    quickPanel.classList.remove("hidden");
    document.getElementById("quickClassName").textContent =
      activeClass.className;
    document.getElementById("quickClassTime").textContent =
      `${activeClass.period.name} (${activeClass.period.startTime} - ${activeClass.period.endTime})`;

    // Check if code already exists
    const existingCode = getAttendanceCode(
      activeClass.dateStr,
      activeClass.period.id,
    );
    const codeInput = document.getElementById("quickAttendanceCode");
    if (codeInput && document.activeElement !== codeInput) {
      codeInput.value = existingCode;
    }

    // Status text
    const statusEl = document.getElementById("quickSaveStatus");
    if (existingCode) {
      statusEl.textContent = `入力済み: ${existingCode} (共有・コピークリップボード可)`;
      statusEl.classList.remove("hidden");
      statusEl.className = "mt-2 text-xs font-semibold text-emerald-600";
    } else {
      statusEl.textContent = "未入力です。出席コードを保存してください。";
      statusEl.classList.remove("hidden");
      statusEl.className = "mt-2 text-xs font-semibold text-orange-600";
    }

    // Store reference in quick entry save button
    quickPanel.setAttribute("data-date", activeClass.dateStr);
    quickPanel.setAttribute("data-period", activeClass.period.id);
    quickPanel.setAttribute("data-classname", activeClass.className);
  } else {
    quickPanel.classList.add("hidden");
  }
}

function renderAll() {
  updateClockAndQuickPanel();

  // Renders for tabs
  if (activeTab === "dashboard") {
    renderDashboard();
  } else if (activeTab === "history") {
    renderHistory();
  } else if (activeTab === "timetable") {
    // Config page setup
    renderPeriodTimesConfig();
    renderQuarterDatesConfig();
    renderTimetableGrid();
  } else if (activeTab === "exceptions") {
    renderExceptions();
  }
}

// 1. Dashboard View
function renderDashboard() {
  const timelineContainer = document.getElementById("timelineContainer");
  if (!timelineContainer) return;

  if (!dashboardSelectedDate) {
    dashboardSelectedDate = formatDateString(getCurrentTime());
  }

  const dObj = new Date(dashboardSelectedDate + "T00:00:00");
  const dayName = getDayOfWeekJp(dObj.getDay());
  document.getElementById("timelineDateLabel").textContent =
    `${dObj.getFullYear()}年${dObj.getMonth() + 1}月${dObj.getDate()}日 (${dayName})`;

  const resolved = resolveTimetableForDate(dashboardSelectedDate);
  timelineContainer.innerHTML = "";

  if (resolved.isHoliday) {
    timelineContainer.innerHTML = `
      <div class="text-center py-12 text-gray-500">
        <p class="text-3xl mb-2">🏖️</p>
        <p class="font-bold">この日は全休（祝日または休校日）に設定されています。</p>
        <p class="text-xs text-gray-400 mt-1">時間割の授業はありません。</p>
      </div>
    `;
    return;
  }

  const now = getCurrentTime();
  const isToday = dashboardSelectedDate === formatDateString(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let classCount = 0;

  state.periods.forEach((period) => {
    const classInfo = resolved.classes[period.id];
    if (!classInfo) return; // skip if no class in this period

    classCount++;
    const code = getAttendanceCode(dashboardSelectedDate, period.id);

    const startMin = timeToMinutes(period.startTime);
    const endMin = timeToMinutes(period.endTime);

    let timeStatusClass = ""; // visual timeline highlight
    let isCurrent = false;

    if (isToday) {
      if (currentMinutes >= startMin && currentMinutes <= endMin) {
        timeStatusClass = "border-indigo-400 bg-indigo-50/20";
        isCurrent = true;
      } else if (currentMinutes > endMin) {
        timeStatusClass = "opacity-75 bg-gray-50/50";
      }
    }

    let statusBadge = "";
    if (classInfo.isCancelled) {
      statusBadge = `<span class="badge badge-danger">休講</span>`;
    } else if (code) {
      statusBadge = `<span class="badge badge-success cursor-pointer" data-action="copy">コード記録済み [${escapeHtml(code)}] 📋</span>`;
    } else {
      statusBadge = `<span class="badge badge-warning">未入力</span>`;
    }

    if (classInfo.isRescheduled) {
      statusBadge += ` <span class="badge badge-primary">臨時</span>`;
    }

    const itemEl = document.createElement("div");
    itemEl.className = `timeline-item flex items-start gap-4 p-4 border-b border-gray-150 transition-all ${timeStatusClass}`;

    let actionButtons = "";
    if (!classInfo.isCancelled) {
      actionButtons = `
        <div class="flex items-center gap-1">
          <button class="btn btn-secondary btn-sm" data-action="edit">
            ${code ? "✍️ 編集" : "➕ 入力"}
          </button>
          ${code ? `<button class="btn btn-secondary btn-sm" data-action="copy" title="出席コードをコピー">📋 コピー</button>` : ""}
        </div>
      `;
    }

    itemEl.innerHTML = `
      <div class="timeline-dot ${isCurrent ? "active" : ""} ${code ? "completed" : ""}"></div>
      <div class="flex-grow">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <span class="text-xs text-gray-500 font-bold">${escapeHtml(period.name)} (${escapeHtml(period.startTime)} - ${escapeHtml(period.endTime)})</span>
            <h4 class="text-base font-bold text-gray-800 mt-0.5 ${classInfo.isCancelled ? "line-through text-gray-400" : ""}">
              ${escapeHtml(classInfo.className)}
            </h4>
          </div>
          <div class="flex items-center gap-3">
            ${statusBadge}
            ${actionButtons}
          </div>
        </div>
      </div>
    `;

    bindAttendanceActions(itemEl, dashboardSelectedDate, period.id, classInfo.className, code);
    timelineContainer.appendChild(itemEl);
  });

  if (classCount === 0) {
    timelineContainer.innerHTML = `
      <div class="text-center py-12 text-gray-500">
        <p class="text-2xl mb-2">☕</p>
        <p class="font-bold">登録されている授業はありません。</p>
        <p class="text-xs text-gray-400 mt-1">時間割を設定するか、例外設定で臨時授業を追加できます。</p>
      </div>
    `;
  }
}

// 2. History View
function renderHistory() {
  const tbody = document.getElementById("historyTableBody");
  const emptyState = document.getElementById("historyEmptyState");
  if (!tbody) return;

  const searchVal = document
    .getElementById("historySearch")
    .value.toLowerCase()
    .trim();
  const filterQ = document.getElementById("historyFilterQuarter").value;

  tbody.innerHTML = "";

  // Gather all records
  const allRecords = [];

  Object.entries(state.records).forEach(([dateStr, periods]) => {
    Object.entries(periods).forEach(([pId, rObj]) => {
      if (rObj && rObj.className) {
        allRecords.push({
          dateStr,
          periodId: parseInt(pId, 10),
          className: rObj.className,
          code: rObj.code || "",
          timestamp: rObj.timestamp,
        });
      }
    });
  });

  // Sort reverse chronological
  allRecords.sort((a, b) => {
    if (a.dateStr !== b.dateStr) return b.dateStr.localeCompare(a.dateStr);
    return b.periodId - a.periodId;
  });

  let matchCount = 0;

  allRecords.forEach((rec) => {
    const qKey = getQuarterForDate(rec.dateStr);

    // Apply quarter filter
    if (filterQ !== "all" && qKey !== filterQ) return;

    // Apply search filter
    const periodName =
      state.periods.find((p) => p.id === rec.periodId)?.name ||
      `${rec.periodId}限`;
    const searchMatch =
      !searchVal ||
      rec.className.toLowerCase().includes(searchVal) ||
      rec.code.toLowerCase().includes(searchVal) ||
      rec.dateStr.includes(searchVal) ||
      periodName.includes(searchVal);

    if (!searchMatch) return;

    matchCount++;

    const tr = document.createElement("tr");
    tr.className = "border-b border-gray-150 hover:bg-gray-50/50";

    // Highlight helper
    const highlight = (text) => {
      const safe = escapeHtml(text);
      if (!searchVal) return safe;
      const needle = escapeHtml(searchVal).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return safe.replace(new RegExp(`(${needle})`, 'gi'), '<span class="search-highlight">$1</span>');
    };

    tr.innerHTML = `
      <td class="p-3 text-gray-700 font-mono">${highlight(rec.dateStr)}</td>
      <td class="p-3 text-gray-700">${escapeHtml(periodName)}</td>
      <td class="p-3 font-semibold text-gray-800">${highlight(rec.className)}</td>
      <td class="p-3 font-mono font-bold text-indigo-700">${rec.code ? highlight(rec.code) : '<span class="text-gray-400 font-normal">なし</span>'}</td>
      <td class="p-3">
        <div class="flex items-center gap-1.5">
          <button class="btn btn-secondary btn-sm" data-action="edit">
            ✍️ 編集
          </button>
          ${rec.code ? `<button class="btn btn-secondary btn-sm" data-action="copy">📋 コピー</button>` : ""}
        </div>
      </td>
    `;
    bindAttendanceActions(tr, rec.dateStr, rec.periodId, rec.className, rec.code);
    tbody.appendChild(tr);
  });

  if (matchCount === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
  }
}

// 3. Timetable Setting Forms
function renderPeriodTimesConfig() {
  const container = document.getElementById("periodTimesConfig");
  if (!container) return;

  container.innerHTML = "";
  state.periods.forEach((p) => {
    const div = document.createElement("div");
    div.className =
      "p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-col gap-1.5";
    div.innerHTML = `
      <span class="text-xs font-bold text-gray-700">${escapeHtml(p.name)}</span>
      <div class="flex items-center gap-1">
        <input type="text" id="period-start-${p.id}" class="form-input time-input" value="${escapeHtml(p.startTime)}" placeholder="08:50" />
        <span class="text-gray-400 text-xs">-</span>
        <input type="text" id="period-end-${p.id}" class="form-input time-input" value="${escapeHtml(p.endTime)}" placeholder="10:20" />
      </div>
    `;
    container.appendChild(div);
  });
}

function savePeriodTimes() {
  const updated = state.periods.map((p) => {
    const start = document.getElementById(`period-start-${p.id}`).value.trim();
    const end = document.getElementById(`period-end-${p.id}`).value.trim();
    return { ...p, startTime: start, endTime: end };
  });
  try { validateAttendanceData({ ...attendancePayload(true), periods: updated }); if (updated.some(p => p.startTime >= p.endTime)) throw new Error('時限の終了は開始より後に設定してね。'); } catch(e) { alert(e.message); return; }
  state.periods = updated;
  state.configDirty = true; saveState();
  alert("時限設定を保存しました！");
  renderAll();
}

function renderQuarterDatesConfig() {
  const container = document.getElementById("quarterDatesConfig");
  if (!container) return;

  container.innerHTML = "";
  Object.entries(state.quarters).forEach(([qKey, qObj]) => {
    const div = document.createElement("div");
    div.className =
      "p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-col gap-3";
    div.innerHTML = `
      <span class="text-sm font-bold text-indigo-800">${escapeHtml(qObj.name)}</span>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs text-gray-500 font-bold mb-1">開始日</label>
          <input type="date" id="quarter-start-${qKey}" class="form-input text-xs" value="${escapeHtml(qObj.startDate)}" />
        </div>
        <div>
          <label class="block text-xs text-gray-500 font-bold mb-1">終了日</label>
          <input type="date" id="quarter-end-${qKey}" class="form-input text-xs" value="${escapeHtml(qObj.endDate)}" />
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

function saveQuarterDates() {
  Object.keys(state.quarters).forEach((qKey) => {
    const start = document.getElementById(`quarter-start-${qKey}`).value;
    const end = document.getElementById(`quarter-end-${qKey}`).value;
    state.quarters[qKey].startDate = start;
    state.quarters[qKey].endDate = end;
  });
  state.configDirty = true; saveState();
  alert("学期日程を設定しました！");
  renderAll();
}

function renderTimetableGrid() {
  const tbody = document.getElementById("timetableGridBody");
  if (!tbody) return;

  const qKey = document.getElementById("editTimetableQuarter").value;
  tbody.innerHTML = "";

  const qTimetable = state.timetables[qKey] || {};

  state.periods.forEach((period) => {
    const tr = document.createElement("tr");

    let tds = `<td class="period-label">${escapeHtml(period.name)}</td>`;

    // Monday to Friday (1 to 5)
    for (let day = 1; day <= 5; day++) {
      const className = (qTimetable[day] && qTimetable[day][period.id]) || "";
      tds += `
        <td>
          <input
            type="text"
            class="timetable-input font-bold"
            data-day="${day}"
            data-period="${period.id}"
            value="${escapeHtml(className)}"
            placeholder="-"
          />
        </td>
      `;
    }

    tr.innerHTML = tds;
    tbody.appendChild(tr);
  });
}

function saveTimetableGrid() {
  const qKey = document.getElementById("editTimetableQuarter").value;
  if (!state.timetables[qKey]) {
    state.timetables[qKey] = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} };
  }

  const inputs = document.querySelectorAll(
    "#timetableGridBody input.timetable-input",
  );
  inputs.forEach((input) => {
    const day = input.getAttribute("data-day");
    const period = input.getAttribute("data-period");
    const val = input.value.trim();

    if (!state.timetables[qKey][day]) {
      state.timetables[qKey][day] = {};
    }
    state.timetables[qKey][day][period] = val;
  });

  state.configDirty = true; saveState();
  const msgEl = document.getElementById("timetableSaveMessage");
  msgEl.textContent = "時間割を保存しました！";
  setTimeout(() => {
    msgEl.textContent = "";
  }, 3000);

  renderAll();
  renderNotificationSettings();
}

// 4. Exceptions List
function renderExceptions() {
  const tbody = document.getElementById("exceptionsTableBody");
  const emptyState = document.getElementById("exceptionsEmptyState");
  if (!tbody) return;

  tbody.innerHTML = "";

  // Sort exceptions by date
  const sortedExps = [...state.exceptions].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  sortedExps.forEach((exp) => {
    const tr = document.createElement("tr");
    tr.className = "border-b border-gray-150";

    let details = "";
    if (exp.type === "holiday") {
      details = `<span class="badge badge-danger">全休・祝日</span> 全ての授業なし`;
    } else if (exp.type === "cancel") {
      const periodName =
        state.periods.find((p) => p.id === exp.periodId)?.name ||
        `${exp.periodId}限`;
      details = `<span class="badge badge-warning">休講</span> ${escapeHtml(periodName)} 休講`;
    } else if (exp.type === "reschedule") {
      const periodName =
        state.periods.find((p) => p.id === exp.periodId)?.name ||
        `${exp.periodId}限`;
      details = `<span class="badge badge-primary">臨時</span> ${escapeHtml(periodName)} に「${escapeHtml(exp.className)}」を追加`;
    } else if (exp.type === "substitution") {
      const dayName = getDayOfWeekJp(exp.substituteDay);
      details = `<span class="badge badge-success">曜日振替</span> ${dayName}曜日の時間割を適用`;
    }

    tr.innerHTML = `
      <td class="p-3 text-gray-700 font-mono">${escapeHtml(exp.date)}</td>
      <td class="p-3 text-gray-800">${details}</td>
      <td class="p-3">
        <button class="btn btn-secondary btn-sm text-red-650" data-action="delete">
          削除
        </button>
      </td>
    `;
    tr.querySelector('[data-action="delete"]').addEventListener('click', () => deleteException(exp.id));
    tbody.appendChild(tr);
  });

  if (sortedExps.length === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
  }
}

function toggleExceptionFields() {
  const type = document.getElementById("exceptionType").value;

  const periodGroup = document.getElementById("exceptionPeriodGroup");
  const nameGroup = document.getElementById("exceptionClassNameGroup");
  const subDayGroup = document.getElementById("exceptionSubDayGroup");

  periodGroup.classList.add("hidden");
  nameGroup.classList.add("hidden");
  subDayGroup.classList.add("hidden");

  if (type === "cancel") {
    periodGroup.classList.remove("hidden");
  } else if (type === "reschedule") {
    periodGroup.classList.remove("hidden");
    nameGroup.classList.remove("hidden");
  } else if (type === "substitution") {
    subDayGroup.classList.remove("hidden");
  }
}

function addException(event) {
  event.preventDefault();

  const dateVal = document.getElementById("exceptionDate").value;
  const typeVal = document.getElementById("exceptionType").value;
  const periodVal = parseInt(
    document.getElementById("exceptionPeriod").value,
    10,
  );
  const classNameVal = document
    .getElementById("exceptionClassName")
    .value.trim();
  const subDayVal = parseInt(
    document.getElementById("exceptionSubDay").value,
    10,
  );

  if (!dateVal) return;

  const newExp = {
    id: "exp-" + Date.now() + Math.random().toString(36).slice(2, 5),
    date: dateVal,
    type: typeVal,
    periodId:
      typeVal === "cancel" || typeVal === "reschedule" ? periodVal : null,
    className: typeVal === "reschedule" ? classNameVal : "",
    substituteDay: typeVal === "substitution" ? subDayVal : null,
  };

  state.exceptions.push(newExp);
  state.configDirty = true; saveState();

  // Reset fields
  document.getElementById("exceptionClassName").value = "";
  renderExceptions();
  renderAll();
  alert("例外を追加しました。");
}

function deleteException(id) {
  if (confirm("この例外設定を削除しますか？")) {
    state.exceptions = state.exceptions.filter((e) => e.id !== id);
    state.configDirty = true; saveState();
    renderExceptions();
    renderAll();
  }
}

// ========== Attendance Input Modal ==========
function openCodeInputModal(dateStr, periodId, className, currentCode) {
  activeModalData = { dateStr, periodId, className };

  document.getElementById("modalTitle").textContent = "出席コードの入力";
  const periodName =
    state.periods.find((p) => p.id === periodId)?.name || `${periodId}限`;
  document.getElementById("modalSubTitle").textContent =
    `${dateStr} ${periodName}: ${className}`;

  const input = document.getElementById("modalCodeInput");
  input.value = currentCode || "";

  document.getElementById("attendanceModal").classList.remove("hidden");
  setTimeout(() => input.focus(), 100);
}

function closeAttendanceModal() {
  document.getElementById("attendanceModal").classList.add("hidden");
  activeModalData = null;
}

function saveModalAttendance() {
  if (!activeModalData) return;

  const codeVal = document.getElementById("modalCodeInput").value.trim();
  const { dateStr, periodId, className } = activeModalData;

  setAttendanceCode(dateStr, periodId, className, codeVal);
  closeAttendanceModal();
  renderAll();
}

function saveQuickAttendance() {
  const panel = document.getElementById("quickEntryPanel");
  const dateStr = panel.getAttribute("data-date");
  const periodId = parseInt(panel.getAttribute("data-period"), 10);
  const className = panel.getAttribute("data-classname");
  const codeVal = document.getElementById("quickAttendanceCode").value.trim();

  if (!dateStr || isNaN(periodId)) return;

  setAttendanceCode(dateStr, periodId, className, codeVal);
  renderAll();

  const quickSaveStatus = document.getElementById("quickSaveStatus");
  quickSaveStatus.textContent = "端末に保存しました。同期状態はクラウド設定で確認できます。";
  quickSaveStatus.className = "mt-2 text-xs font-semibold text-emerald-600";
  setTimeout(() => {
    quickSaveStatus.textContent = "";
  }, 3000);
}

// ========== Helper Functions: Copy / Clipboard ==========
function copyText(text) {
  if (!text) return;
  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert(`出席コード「${text}」をコピーしました！`);
      })
      .catch((err) => {
        prompt("コピーしてください：", text);
      });
  } else {
    prompt("コピーしてください：", text);
  }
}

// ========== Import / Export JSON ==========
function exportDataJSON() {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify({ ...attendancePayload(true), revision: undefined }, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute(
    "download",
    `opetools_attendance_${formatDateString(getCurrentTime())}.json`,
  );
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importDataJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const parsed = JSON.parse(e.target.result);
      validateAttendanceData(parsed);
      if (parsed.timetables || parsed.records) {
        state = {
          quarters: parsed.quarters || state.quarters,
          periods: parsed.periods || state.periods,
          timetables: parsed.timetables || state.timetables,
          exceptions: parsed.exceptions || state.exceptions,
          records: parsed.records || state.records,
          schemaVersion: 2,
          courseIds: parsed.courseIds || {},
          pendingRecords: {},
          importPending: true,
          syncConfig: state.syncConfig,
        };
        saveState();
        renderAll();
        renderNotificationSettings();
        alert("JSONファイルからデータをインポートしました！");
      } else {
        alert("インポート失敗：無効なファイル形式です。");
      }
    } catch (err) {
      alert("JSONのパースに失敗しました。");
      console.error(err);
    }
  };
  reader.readAsText(file);
}

async function loadSampleData() {
  if (
    !confirm(
      "サンプルデータ（登録済みの時間割・出席コード例）をアプリに読み込みますか？\n※現在ブラウザに保存されているデータが上書きされます。",
    )
  ) {
    return;
  }
  try {
    const res = await fetch("/attendance/opetools_attendance_example.json");
    if (!res.ok) throw new Error("サンプルデータの読み込みに失敗しました。");
    const parsed = await res.json();
    validateAttendanceData(parsed);
    if (parsed.timetables || parsed.records) {
      state = {
        quarters: parsed.quarters || state.quarters,
        periods: parsed.periods || state.periods,
        timetables: parsed.timetables || state.timetables,
        exceptions: parsed.exceptions || state.exceptions,
        records: parsed.records || state.records,
        schemaVersion: 2,
        courseIds: parsed.courseIds || {},
        pendingRecords: {},
        syncConfig: state.syncConfig,
        importPending: true,
      };
      saveState();
      renderAll();
      renderNotificationSettings();
      alert("サンプルデータを正常に読み込みました！");
    } else {
      throw new Error("無効なファイル形式です。");
    }
  } catch (err) {
    alert("エラー: " + err.message);
    console.error(err);
  }
}

function resetAllData() {
  if (
    confirm(
      "時間割、出席コードの履歴、例外設定を含むすべてのデータをリセットしますか？この操作は取り消せません。",
    )
  ) {
    state = {
      quarters: JSON.parse(JSON.stringify(DEFAULT_QUARTERS)),
      periods: JSON.parse(JSON.stringify(DEFAULT_PERIODS)),
      timetables: {
        q1: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} },
        q2: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} },
        q3: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} },
        q4: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} },
      },
      exceptions: [],
      records: {},
      schemaVersion: 2, courseIds: {}, pendingRecords: {}, notifications: [],
      syncConfig: {
        id: "",
        editKey: "",
        proxyUrl: "https://tools.ainznino.workers.dev",
        serverVersion: "v2",
        autoDownload: false,
      },
    };
    saveState();
    renderAll();
    alert("データを初期化しました。");
  }
}

// ========== Cloud Synchronization ==========
let uploadChain = Promise.resolve();
let flushingRecords = false;

function parseSyncToken(token) {
  if (!token) return { id: '', key: '' };
  if (token.startsWith('{')) {
    try { const t = JSON.parse(token); return { id: t.id || '', key: t.editKey || t.key || '' }; } catch { return { id: '', key: '' }; }
  }
  const separator = token.includes(':') ? ':' : '_';
  const [id, ...parts] = token.split(separator);
  return { id, key: parts.join(separator) };
}
function getSyncEndpoint(id = null) {
  const base = (state.syncConfig.proxyUrl || 'https://tools.ainznino.workers.dev').replace(/\/$/, '');
  const path = state.syncConfig.serverVersion === 'v1' ? '/api/json' : '/api/v2/attendance';
  return base + path + (id ? '/' + encodeURIComponent(id) : '');
}
function syncStatus(message, failed = false) {
  const el = document.getElementById('syncStatus');
  if (el) { el.textContent = message; el.className = `mt-4 text-sm font-semibold ${failed ? 'text-red-600' : 'text-indigo-600'}`; }
  const quick = document.getElementById('quickSaveStatus');
  if (quick) quick.textContent = message;
}
async function syncRequest(endpoint, options = {}, config = state.syncConfig) {
  const response = await fetch(endpoint, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Edit-Key': config.editKey || '', ...options.headers },
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) { const err = new Error(data.error || `HTTP ${response.status}`); err.status = response.status; err.data = data; throw err; }
  return data;
}
function attendancePayload(includeRecords = false) {
  const result = { schemaVersion: 2, quarters: state.quarters, periods: state.periods, timetables: state.timetables, exceptions: state.exceptions, courseIds: state.courseIds || {}, revision: state.syncConfig.revision };
  if (includeRecords) result.records = state.records;
  return result;
}
function readSyncFields() {
  const token = parseSyncToken(document.getElementById('syncToken').value.trim());
  return { id: token.id, editKey: token.key, proxyUrl: document.getElementById('syncProxyUrl').value.trim(), serverVersion: document.querySelector('input[name="syncServer"]:checked')?.value || 'v2', autoDownload: document.getElementById('syncAutoDL').checked };
}
function saveSyncConfig() {
  const config = readSyncFields();
  if (config.id !== state.syncConfig.id || config.serverVersion !== state.syncConfig.serverVersion || config.proxyUrl !== state.syncConfig.proxyUrl) {
    if (Object.keys(state.pendingRecords || {}).length) { alert('未同期コードがあるので、先に再送するかバックアップしてから接続先を変更してね。'); return false; }
    state.notifications = [];
    config.revision = undefined;
  } else config.revision = state.syncConfig.revision;
  state.syncConfig = config; saveState(); syncStatus('同期設定を保存しました。'); return true;
}
function syncUpload(silent = false) {
  const task = uploadChain.then(() => performSyncUpload(silent));
  uploadChain = task.catch(() => {});
  return task;
}
async function performSyncUpload(silent) {
  if (!silent && !saveSyncConfig()) return;
  const config = { ...state.syncConfig };
  const includeRecords = !config.id || state.importPending;
  try {
    if (config.id && config.serverVersion === 'v2' && config.revision === undefined) throw new Error('先にクラウドから読み込み、現在のデータを確認してください。');
    const data = await syncRequest(getSyncEndpoint(config.id || null), { method: config.id ? 'PATCH' : 'POST', body: JSON.stringify(config.serverVersion === 'v1' ? { ...attendancePayload(true) } : attendancePayload(includeRecords)) }, config);
    state.syncConfig = { ...config, id: config.id || data.id, editKey: config.editKey || data.editKey || data.key, revision: data.revision };
    document.getElementById('syncToken').value = `${state.syncConfig.id}:${state.syncConfig.editKey}`;
    state.importPending = false;
    state.configDirty = false;
    saveState();
    if (includeRecords && state.syncConfig.serverVersion === 'v2') await syncDownload(true);
    syncStatus('クラウドに保存しました。');
    if (state.syncConfig.serverVersion === 'v2') await flushAttendanceRecords();
  } catch (e) { syncStatus('同期失敗: ' + e.message + '（端末の記録は残っています）', true); }
}
async function syncDownload(silent = false) {
  if (!silent && !saveSyncConfig()) return;
  if (state.configDirty || state.importPending) {
    if (silent) { syncStatus('未同期の設定・インポートがあるため自動読込を止めました。', true); return; }
    if (!confirm('端末に未同期の設定があります。クラウドの設定で置き換えますか？先にバックアップしてね。')) return;
  }
  const config = { ...state.syncConfig };
  const configBefore = JSON.stringify(attendancePayload(false));
  if (!config.id) { syncStatus('同期トークンを入力してください。', true); return; }
  try {
    const response = await syncRequest(getSyncEndpoint(config.id), {}, config);
    const data = response.content;
    validateAttendanceData(data);
    if (state.syncConfig.id !== config.id || JSON.stringify(attendancePayload(false)) !== configBefore) throw new Error('読込中に設定が更新されました。もう一度確認してください。');
    // Pending local entries survive downloads, but their base revision stays unchanged to expose conflicts.
    const pending = state.pendingRecords || {};
    const pendingValues = Object.values(pending).map(p => ({ ...p }));
    state.quarters = data.quarters || state.quarters;
    state.periods = data.periods || state.periods;
    state.timetables = data.timetables || state.timetables;
    state.exceptions = data.exceptions || [];
    state.courseIds = data.courseIds || {};
    state.records = data.records || {};
    for (const p of pendingValues) { state.records[p.date] ||= {}; state.records[p.date][p.periodId] = { className: p.className, code: p.code, timestamp: p.timestamp, revision: p.revision }; }
    state.notifications = response.notifications || [];
    state.notificationEnabled = Boolean(response.notificationEnabled);
    state.syncConfig.revision = response.revision;
    state.configDirty = false; state.importPending = false;
    saveState(); renderAll(); renderNotificationSettings();
    if (!silent) syncStatus('クラウドから読み込みました。未同期コードは端末に保持しています。');
  } catch (e) { syncStatus('読み込み失敗: ' + e.message, true); }
}
async function flushAttendanceRecords() {
  let completed = false;
  if (flushingRecords || !state.syncConfig.id || !state.syncConfig.editKey) return;
  if (state.syncConfig.serverVersion === 'v1') { syncUpload(true); return; }
  flushingRecords = true;
  try {
    for (const [key, pending] of Object.entries(state.pendingRecords || {})) {
      if (pending.paused) continue;
      const sent = { ...pending };
      if (sent.datasetId !== state.syncConfig.id) throw new Error('未同期コードの接続先が違います。');
      const response = await syncRequest(getSyncEndpoint(state.syncConfig.id) + '/records', { method: 'PUT', body: JSON.stringify(sent) });
      const current = state.pendingRecords[key];
      if (current?.operationId === sent.operationId) delete state.pendingRecords[key];
      else if (current) current.revision = response.revision;
      if (state.records[sent.date]?.[sent.periodId]) state.records[sent.date][sent.periodId].revision = response.revision;
      saveState();
      syncStatus(response.notification === 'course-id-required' ? 'クラウド保存済み。通知には共有科目IDの設定が必要です。' : response.notification === 'disabled' ? 'クラウド保存済み。Discord通知は未参加です。' : 'クラウド保存済み。Discord通知の処理を受け付けました。');
    }
    // Refresh revisions/status without overwriting local config edits.
    const data = await syncRequest(getSyncEndpoint(state.syncConfig.id));
    state.notifications = data.notifications || [];
    // Do not advance config revision: unuploaded config changes must still detect concurrent changes.
    saveState(); renderNotificationSettings();
    completed = true;
  } catch (e) { syncStatus('端末に保存済み・未同期: ' + e.message, true); }
  finally { flushingRecords = false; }
  if (completed && Object.values(state.pendingRecords || {}).some(p => !p.paused)) queueMicrotask(() => flushAttendanceRecords());
}
async function retryAttendanceRecords() {
  try {
    const data = await syncRequest(getSyncEndpoint(state.syncConfig.id));
    for (const pending of Object.values(state.pendingRecords || {})) {
      const remote = data.content.records?.[pending.date]?.[pending.periodId];
      const course = state.courseIds?.[pending.className];
      const shared = data.notifications?.find(n => n.course_id === course && n.date === pending.date);
      if ((remote && remote.code !== pending.code) || (shared && shared.code !== pending.code)) {
        if (!confirm(`${pending.className} (${pending.date})\nクラウド/Discordのコードを「${pending.code}」に訂正しますか？`)) { pending.paused = true; continue; }
      }
      pending.paused = false;
      pending.revision = remote?.revision || 0;
      pending.notificationRevision = shared?.revision || 0;
    }
    saveState(); await flushAttendanceRecords();
  } catch (e) { syncStatus(e.message, true); }
}
async function migrateAttendance() {
  if (Object.keys(state.pendingRecords || {}).length) { alert('先に未同期コードを保存してください。'); return; }
  if (!confirm('今の端末のデータから、出席専用の新しい同期トークンを作ります。旧トークンは変更しません。先に必要なデータを読み込み・バックアップしてね。')) return;
  state.syncConfig = { ...state.syncConfig, id: '', editKey: '', revision: undefined, serverVersion: 'v2' };
  document.querySelector('input[name="syncServer"][value="v2"]').checked = true;
  document.getElementById('syncToken').value = '';
  state.notifications = []; state.notificationEnabled = false;
  saveState(); await syncUpload(true); renderNotificationSettings();
}
function copySyncToken() { const token = document.getElementById('syncToken').value.trim(); if (token) navigator.clipboard.writeText(token).catch(() => prompt('このトークンをコピーしてね', token)); }
function renderNotificationSettings() {
  const container = document.getElementById('courseIdSettings');
  if (!container) return;
  container.replaceChildren();
  const names = new Set(Object.keys(state.courseIds || {}));
  for (const quarter of Object.values(state.timetables)) for (const day of Object.values(quarter)) for (const name of Object.values(day)) if (name) names.add(name);
  for (const e of state.exceptions) if (e.className) names.add(e.className);
  for (const name of [...names].sort()) {
    const label = document.createElement('label'); label.className = 'form-group'; label.textContent = name;
    const input = document.createElement('input'); input.className = 'form-input'; input.dataset.courseName = name; input.value = state.courseIds?.[name] || ''; input.placeholder = '例: tut:2026:後期の科目コード:クラス（英数字で）';
    label.appendChild(input); container.appendChild(label);
  }
  const status = document.getElementById('notificationStatus');
  status.textContent = state.notificationEnabled ? 'Discord通知に参加済み。共有科目IDが設定された科目だけ通知します。' : 'Discord通知は未参加です。';
  const notices = document.getElementById('notificationHistory'); notices.replaceChildren();
  for (const n of [...(state.notifications || [])].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 20)) {
    const row = document.createElement('p');
    const statuses = { sent: '通知済み', pending: '通知待ち', sending: '送信中', unknown: '送信結果不明・管理者確認が必要', failed: '通知失敗・管理者確認が必要' };
    row.textContent = `${n.date} ${n.class_name}: ${statuses[n.status] || n.status}`;
    notices.appendChild(row);
  }
}
async function saveCourseIds() {
  const ids = {};
  for (const input of document.querySelectorAll('[data-course-name]')) {
    const id = input.value.trim();
    if (id && !/^[a-zA-Z0-9:_.-]{1,120}$/.test(id)) { alert('共有科目IDは120文字以内の英数字と : _ . - で入力してね。'); return; }
    ids[input.dataset.courseName] = id;
  }
  state.courseIds = ids; state.configDirty = true; saveState(); await syncUpload(true);
}
async function joinNotifications(leave = false) {
  if (state.syncConfig.serverVersion !== 'v2' || !state.syncConfig.id) { alert('出席専用v2の同期トークンを作成してください。'); return; }
  try {
    const input = document.getElementById('notificationGroupKey');
    const result = await syncRequest(getSyncEndpoint(state.syncConfig.id) + '/membership', { method: 'POST', body: JSON.stringify(leave ? { leave: true } : { groupKey: input.value.trim() }) });
    input.value = ''; state.notificationEnabled = result.notificationEnabled; saveState(); renderNotificationSettings();
  } catch (e) { syncStatus(e.message, true); }
}
window.addEventListener('online', () => flushAttendanceRecords());

// ========== Lifecycle Initialization ==========

window.addEventListener("load", async () => {
  loadState();

  // Set default dashboard display date to today
  dashboardSelectedDate = formatDateString(getCurrentTime());

  // Setup sync fields if config exists
  if (state.syncConfig) {
    if (state.syncConfig.id && state.syncConfig.editKey) {
      document.getElementById("syncToken").value =
        `${state.syncConfig.id}:${state.syncConfig.editKey}`;
    } else if (state.syncConfig.id) {
      document.getElementById("syncToken").value = state.syncConfig.id;
    }

    if (state.syncConfig.proxyUrl) {
      document.getElementById("syncProxyUrl").value = state.syncConfig.proxyUrl;
    }

    document.getElementById("syncAutoDL").checked =
      !!state.syncConfig.autoDownload;

    const serverVer = state.syncConfig.serverVersion || "v1";
    const rads = document.getElementsByName("syncServer");
    rads.forEach((r) => {
      r.checked = r.value === serverVer;
    });
  }

  // Auto-sync if configured
  if (state.syncConfig.autoDownload && state.syncConfig.id) {
    await syncDownload(true);
  }

  renderAll();
  renderNotificationSettings();
  if (Object.keys(state.pendingRecords || {}).length) flushAttendanceRecords();

  // Clock ticking and quick entry update
  setInterval(() => {
    // If simulation time is active, we don't automatically tick it here (unless desired)
    // but we update the clock anyway
    if (!simulatedTime) {
      updateClockAndQuickPanel();
    }
  }, 1000); // update every second for clock ticking
});
