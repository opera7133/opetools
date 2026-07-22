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
    serverVersion: "v1",
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
  if (isSyncing) return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
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
        records: parsed.records || {},
        syncConfig: parsed.syncConfig || {
          id: "",
          editKey: "",
          proxyUrl: "https://tools.ainznino.workers.dev",
          serverVersion: "v1",
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
  if (!state.records[dateStr]) {
    state.records[dateStr] = {};
  }
  state.records[dateStr][periodId] = {
    className,
    code: code.trim(),
    timestamp: new Date().toISOString(),
  };
  saveState();

  if (state.syncConfig && state.syncConfig.id && state.syncConfig.editKey) {
    syncUpload(true);
  }
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
      statusBadge = `<span class="badge badge-success cursor-pointer" onclick="copyText('${code}')">出席 [${code}] 📋</span>`;
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
          <button class="btn btn-secondary btn-sm" onclick="openCodeInputModal('${dashboardSelectedDate}', ${period.id}, '${classInfo.className}', '${code}')">
            ${code ? "✍️ 編集" : "➕ 入力"}
          </button>
          ${code ? `<button class="btn btn-secondary btn-sm" onclick="copyText('${code}')" title="出席コードをコピー">📋 コピー</button>` : ""}
        </div>
      `;
    }

    itemEl.innerHTML = `
      <div class="timeline-dot ${isCurrent ? "active" : ""} ${code ? "completed" : ""}"></div>
      <div class="flex-grow">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <span class="text-xs text-gray-500 font-bold">${period.name} (${period.startTime} - ${period.endTime})</span>
            <h4 class="text-base font-bold text-gray-800 mt-0.5 ${classInfo.isCancelled ? "line-through text-gray-400" : ""}">
              ${classInfo.className}
            </h4>
          </div>
          <div class="flex items-center gap-3">
            ${statusBadge}
            ${actionButtons}
          </div>
        </div>
      </div>
    `;

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
      if (!searchVal) return text;
      const regex = new RegExp(`(${searchVal})`, "gi");
      return text.replace(regex, `<span class="search-highlight">$1</span>`);
    };

    tr.innerHTML = `
      <td class="p-3 text-gray-700 font-mono">${highlight(rec.dateStr)}</td>
      <td class="p-3 text-gray-700">${periodName}</td>
      <td class="p-3 font-semibold text-gray-800">${highlight(rec.className)}</td>
      <td class="p-3 font-mono font-bold text-indigo-700">${rec.code ? highlight(rec.code) : '<span class="text-gray-400 font-normal">なし</span>'}</td>
      <td class="p-3">
        <div class="flex items-center gap-1.5">
          <button class="btn btn-secondary btn-sm" onclick="openCodeInputModal('${rec.dateStr}', ${rec.periodId}, '${rec.className}', '${rec.code}')">
            ✍️ 編集
          </button>
          ${rec.code ? `<button class="btn btn-secondary btn-sm" onclick="copyText('${rec.code}')">📋 コピー</button>` : ""}
        </div>
      </td>
    `;
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
      <span class="text-xs font-bold text-gray-700">${p.name}</span>
      <div class="flex items-center gap-1">
        <input type="text" id="period-start-${p.id}" class="form-input time-input" value="${p.startTime}" placeholder="08:50" />
        <span class="text-gray-400 text-xs">-</span>
        <input type="text" id="period-end-${p.id}" class="form-input time-input" value="${p.endTime}" placeholder="10:20" />
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
  state.periods = updated;
  saveState();
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
      <span class="text-sm font-bold text-indigo-800">${qObj.name}</span>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs text-gray-500 font-bold mb-1">開始日</label>
          <input type="date" id="quarter-start-${qKey}" class="form-input text-xs" value="${qObj.startDate}" />
        </div>
        <div>
          <label class="block text-xs text-gray-500 font-bold mb-1">終了日</label>
          <input type="date" id="quarter-end-${qKey}" class="form-input text-xs" value="${qObj.endDate}" />
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
  saveState();
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

    let tds = `<td class="period-label">${period.name}</td>`;

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
            value="${className}"
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

  saveState();
  const msgEl = document.getElementById("timetableSaveMessage");
  msgEl.textContent = "時間割を保存しました！";
  setTimeout(() => {
    msgEl.textContent = "";
  }, 3000);

  renderAll();
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
      details = `<span class="badge badge-warning">休講</span> ${periodName} 休講`;
    } else if (exp.type === "reschedule") {
      const periodName =
        state.periods.find((p) => p.id === exp.periodId)?.name ||
        `${exp.periodId}限`;
      details = `<span class="badge badge-primary">臨時</span> ${periodName} に「${exp.className}」を追加`;
    } else if (exp.type === "substitution") {
      const dayName = getDayOfWeekJp(exp.substituteDay);
      details = `<span class="badge badge-success">曜日振替</span> ${dayName}曜日の時間割を適用`;
    }

    tr.innerHTML = `
      <td class="p-3 text-gray-700 font-mono">${exp.date}</td>
      <td class="p-3 text-gray-800">${details}</td>
      <td class="p-3">
        <button class="btn btn-secondary btn-sm text-red-650" onclick="deleteException('${exp.id}')">
          削除
        </button>
      </td>
    `;
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
  saveState();

  // Reset fields
  document.getElementById("exceptionClassName").value = "";
  renderExceptions();
  renderAll();
  alert("例外を追加しました。");
}

function deleteException(id) {
  if (confirm("この例外設定を削除しますか？")) {
    state.exceptions = state.exceptions.filter((e) => e.id !== id);
    saveState();
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
  quickSaveStatus.textContent = "出席コードを保存しました！";
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
    encodeURIComponent(JSON.stringify(state, null, 2));
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
      if (parsed.timetables || parsed.records) {
        state = {
          quarters: parsed.quarters || state.quarters,
          periods: parsed.periods || state.periods,
          timetables: parsed.timetables || state.timetables,
          exceptions: parsed.exceptions || state.exceptions,
          records: parsed.records || state.records,
          syncConfig: parsed.syncConfig || state.syncConfig,
        };
        saveState();
        renderAll();
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
    if (parsed.timetables || parsed.records) {
      state = {
        quarters: parsed.quarters || state.quarters,
        periods: parsed.periods || state.periods,
        timetables: parsed.timetables || state.timetables,
        exceptions: parsed.exceptions || state.exceptions,
        records: parsed.records || state.records,
        syncConfig: parsed.syncConfig || state.syncConfig,
      };
      saveState();
      renderAll();
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
      syncConfig: {
        id: "",
        editKey: "",
        proxyUrl: "https://tools.ainznino.workers.dev",
        serverVersion: "v1",
        autoDownload: false,
      },
    };
    saveState();
    renderAll();
    alert("データを初期化しました。");
  }
}

// ========== Cloud Synchronization Implementation ==========

function parseSyncToken(token) {
  let id = "",
    key = "";
  if (!token) return { id, key };
  if (token.startsWith("{")) {
    try {
      const parsed = JSON.parse(token);
      id = parsed.id || "";
      key = parsed.editKey || parsed.key || "";
    } catch (e) {}
  } else if (token.includes(":")) {
    const parts = token.split(":");
    id = parts[0];
    key = parts.slice(1).join(":");
  } else if (token.includes("_")) {
    const parts = token.split("_");
    id = parts[0];
    key = parts.slice(1).join("_");
  }
  return { id, key };
}

function getSyncEndpoint(idStr = null) {
  const proxyUrl =
    state.syncConfig.proxyUrl || "https://tools.ainznino.workers.dev";
  const serverVersion = state.syncConfig.serverVersion || "v1";
  const baseUrl = proxyUrl
    ? proxyUrl.replace(/\/$/, "")
    : "https://jsonhosting.com";

  const path = serverVersion === "v2" ? "/api/v2/data" : "/api/json";
  if (idStr) return `${baseUrl}${path}/${idStr}`;
  return `${baseUrl}${path}`;
}

async function syncUpload(silent = false) {
  let id = "";
  let editKey = "";

  if (silent) {
    id = state.syncConfig.id;
    editKey = state.syncConfig.editKey;
  } else {
    const tokenInput = document.getElementById("syncToken");
    const tokenStr = tokenInput ? tokenInput.value.trim() : "";
    const parsed = parseSyncToken(tokenStr);
    id = parsed.id;
    editKey = parsed.key;
  }

  const statusEl = document.getElementById("syncStatus");

  if (!silent && statusEl) {
    statusEl.textContent = "アップロード中...";
    statusEl.className = "mt-4 text-sm font-semibold text-indigo-600";
  }

  try {
    const payload = JSON.stringify({
      quarters: state.quarters,
      periods: state.periods,
      timetables: state.timetables,
      exceptions: state.exceptions,
      records: state.records,
    });

    const proxyInput = document.getElementById("syncProxyUrl");
    const proxyUrl = proxyInput
      ? proxyInput.value.trim()
      : state.syncConfig.proxyUrl || "";
    const serverVersion =
      document.querySelector('input[name="syncServer"]:checked')?.value ||
      "v1";
    const autoDownload =
      document.getElementById("syncAutoDL")?.checked || false;

    if (id && editKey) {
      // Update existing JSON hosting bin
      const res = await fetch(getSyncEndpoint(id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Edit-Key": editKey,
        },
        body: payload,
      });
      if (!res.ok) throw new Error("アップロードに失敗しました");

      // Always save token & config to state and localStorage
      state.syncConfig = {
        id,
        editKey,
        proxyUrl,
        serverVersion,
        autoDownload,
      };
      saveState();

      if (!silent && statusEl) {
        statusEl.textContent =
          "同期完了！アップロードしました (" +
          new Date().toLocaleTimeString() +
          ")";
        statusEl.className = "mt-4 text-sm font-semibold text-emerald-600";
      }
    } else {
      if (silent) return; // Don't auto-create bin in background

      // Create new JSON hosting bin
      const res = await fetch(getSyncEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (!res.ok) throw new Error("新規作成に失敗しました");
      const data = await res.json();
      const newId = data.id || "";
      const newKey = data.editKey || data.key || "";

      if (tokenInput) {
        tokenInput.value = `${newId}:${newKey}`;
      }

      state.syncConfig = {
        id: newId,
        editKey: newKey,
        proxyUrl,
        serverVersion,
        autoDownload,
      };
      saveState();

      if (statusEl) {
        statusEl.textContent =
          "新規の同期トークンを作成し、ローカルに保存してデータをアップロードしました！";
        statusEl.className = "mt-4 text-sm font-semibold text-emerald-600";
      }
    }
  } catch (err) {
    console.error(err);
    if (!silent && statusEl) {
      statusEl.textContent = "エラー: " + err.message;
      statusEl.className = "mt-4 text-sm font-semibold text-red-600";
    }
  }
}

async function syncDownload(silent = false) {
  let id = state.syncConfig.id;
  if (!id) {
    const t = parseSyncToken(document.getElementById("syncToken").value.trim());
    id = t.id;
  }
  const statusEl = document.getElementById("syncStatus");
  if (!id) {
    if (!silent) {
      statusEl.textContent = "同期 ID/トークンを入力してください";
      statusEl.className = "mt-4 text-sm font-semibold text-red-600";
    }
    return;
  }

  if (!silent) {
    statusEl.textContent = "データをダウンロード中...";
    statusEl.className = "mt-4 text-sm font-semibold text-indigo-600";
  }

  try {
    const res = await fetch(getSyncEndpoint(id) + `?t=${Date.now()}`);
    if (!res.ok) throw new Error("ダウンロードに失敗しました");

    const responseJson = await res.json();
    // In v1/v2, the actual saved content is usually wrapped in responseJson.content
    const data = responseJson.content;

    if (data && (data.timetables || data.records)) {
      isSyncing = true;
      state.quarters = data.quarters || state.quarters;
      state.periods = data.periods || state.periods;
      state.timetables = data.timetables || state.timetables;
      state.exceptions = data.exceptions || state.exceptions;
      state.records = data.records || state.records;
      saveState();
      isSyncing = false;

      renderAll();
      if (!silent) {
        statusEl.textContent =
          "同期完了！データをダウンロードしました (" +
          new Date().toLocaleTimeString() +
          ")";
        statusEl.className = "mt-4 text-sm font-semibold text-emerald-600";
      }
    } else {
      throw new Error("データ形式が正しくありません");
    }
  } catch (err) {
    console.error(err);
    if (!silent) {
      statusEl.textContent = "エラー: " + err.message;
      statusEl.className = "mt-4 text-sm font-semibold text-red-600";
    }
  }
}

function copySyncToken() {
  const token = document.getElementById("syncToken").value.trim();
  if (!token) {
    alert("トークンを入力または作成してください");
    return;
  }
  copyText(token);
}

function saveSyncConfig() {
  const token = document.getElementById("syncToken").value.trim();
  const { id, key } = parseSyncToken(token);
  const serverVersion = document.querySelector(
    'input[name="syncServer"]:checked',
  ).value;
  const proxyUrl = document.getElementById("syncProxyUrl").value.trim();
  const autoDownload = document.getElementById("syncAutoDL").checked;

  state.syncConfig = {
    id,
    editKey: key,
    proxyUrl,
    serverVersion,
    autoDownload,
  };
  saveState();

  const statusEl = document.getElementById("syncStatus");
  statusEl.textContent = "同期設定を保存しました。";
  statusEl.className = "mt-4 text-sm font-semibold text-emerald-600";
}

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

  // Clock ticking and quick entry update
  setInterval(() => {
    // If simulation time is active, we don't automatically tick it here (unless desired)
    // but we update the clock anyway
    if (!simulatedTime) {
      updateClockAndQuickPanel();
    }
  }, 1000); // update every second for clock ticking
});
