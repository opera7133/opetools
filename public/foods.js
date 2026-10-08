// Inventory is derived from a baseline and the retained consumption records.
// Existing snapshots migrate with a baseline that preserves their current remaining quantity.
function initializeInventory() {
  for (const food of state.foods) {
    if (Number.isFinite(food.inventoryBase)) continue;
    const consumed = state.records.reduce((sum, r) => sum + (r.ingredients || []).filter(i => i.foodId === food.id).reduce((s, i) => s + (Number(i.usage) || 0), 0), 0);
    food.inventoryBase = (food.remaining ?? food.quantity) + consumed;
  }
  state.schemaVersion = 2;
}
function reconcileInventory() {
  initializeInventory();
  for (const food of state.foods) {
    const consumed = state.records.reduce((sum, r) => sum + (r.ingredients || []).filter(i => i.foodId === food.id).reduce((s, i) => s + (Number(i.usage) || 0), 0), 0);
    food.remaining = Math.max(0, food.inventoryBase - consumed);
  }
}

// ========== State & Storage ==========
let state = {
  foods: [], // { id, name, price, quantity, unit, remaining, note }
  records: [], // { id, date, mealTime, type, memo, ingredients:[{foodId,usage,usageType,cost}], items:[{name,price}], totalCost }
  syncConfig: { id: "", editKey: "" },
  currentMonth: null,
};

const TODAY = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

let isSyncing = false;
let syncTimeout = null;

function autoSyncUpload() { toolSync.autoUpload(); }

function migrateRecords() {
  state.records.forEach((r) => {
    if (r.ingredients) {
      r.ingredients.forEach((ing) => {
        if (ing.usageType !== "amount") {
          const food = state.foods.find((f) => f.id === ing.foodId);
          if (food) {
            if (food.price > 0 && ing.cost !== undefined) {
              let est = (ing.cost / food.price) * food.quantity;
              ing.usage = Math.round(est * 10) / 10;
            } else {
              const rem = food.remaining ?? food.quantity;
              if (ing.usageType === "fraction") {
                const n = ing.usageNumer ?? 1;
                const d = ing.usageDenom ?? 1;
                ing.usage = rem * (d > 0 ? n / d : 0);
              } else if (ing.usageType === "decimal") {
                ing.usage = rem * (parseFloat(ing.usage) || 0);
              } else {
                ing.usage = rem * ((parseFloat(ing.usage) || 0) / 100);
              }
            }
            ing.usageType = "amount";
          }
        }
      });
    }
  });
}

function saveState() {
  reconcileInventory();
  if (!isSyncing) { state.syncDirty = true; state.syncChange = (state.syncChange || 0) + 1; }
  localStorage.setItem("foods_tool_v1", JSON.stringify(state));
  if (!isSyncing) autoSyncUpload();
}
function loadState() {
  const raw = localStorage.getItem("foods_tool_v1");
  if (raw) {
    try {
      state = JSON.parse(raw);
    } catch (e) {}
  }
  if (state.syncConfig?.proxyUrl?.replace(/\/$/, '') === 'https://tools.ainznino.workers.dev') state.syncConfig.proxyUrl = 'https://opetools-workers.ainznino.workers.dev';
  if (!state.foods) state.foods = [];
  if (!state.records) state.records = [];
  migrateRecords();
  initializeInventory();
  if (!state.syncConfig)
    state.syncConfig = {
      id: "",
      editKey: "",
      proxyUrl: "",
      autoDownload: false,
      serverVersion: "v2",
    };
  if (!state.currentMonth) {
    const d = new Date();
    state.currentMonth = { year: d.getFullYear(), month: d.getMonth() };
  }

  if (document.getElementById("syncToken")) {
    const s = state.syncConfig;
    if (s.id && s.editKey)
      document.getElementById("syncToken").value = `${s.id}:${s.editKey}`;
    else document.getElementById("syncToken").value = "";

    document.getElementById("syncProxyUrl").value =
      state.syncConfig.proxyUrl || "https://opetools-workers.ainznino.workers.dev";

    const sVer = s.serverVersion || "v2";
    const rads = document.getElementsByName("syncServer");
    rads.forEach((r) => (r.checked = r.value === sVer));
  }
  if (document.getElementById("syncAutoDL")) {
    document.getElementById("syncAutoDL").checked =
      !!state.syncConfig.autoDownload;
  }
}

function toggleAutoSyncDL(checked) {
  state.syncConfig.autoDownload = checked;
  saveState();
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

// Click outside modal to close
document.querySelectorAll(".modal-overlay").forEach((el) => {
  el.addEventListener("click", function (e) {
    if (e.target === this) closeModal(this.id);
  });
});

// ========== Month navigation ==========
function changeMonth(delta) {
  let { year, month } = state.currentMonth;
  month += delta;
  if (month < 0) {
    month = 11;
    year--;
  }
  if (month > 11) {
    month = 0;
    year++;
  }
  state.currentMonth = { year, month };
  saveState();
  renderAll();
}
function getMonthLabel() {
  const { year, month } = state.currentMonth;
  return `${year}年${month + 1}月`;
}
function isInCurrentMonth(dateStr) {
  const { year, month } = state.currentMonth;
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

// ========== Tab switching ==========
function switchTab(name, btn) {
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelectorAll(".tab-panel")
    .forEach((p) => p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(`panel-${name}`).classList.add("active");
  if (name === "records") renderRecords();
  if (name === "foods") renderFoods();
  if (name === "chart") renderCharts();
}

// ========== Meal form state ==========
let currentMealTime = "morning";
let currentMealType = "cooking";
let selectedIngredients = []; // { foodId, usage, usageType }
let eatingOutItems = []; // { name, price }

function selectMealTime(mt, btn) {
  currentMealTime = mt;
  ["morning", "lunch", "dinner", "other"].forEach((t) => {
    document
      .getElementById(`mt${t.charAt(0).toUpperCase() + t.slice(1)}`)
      .classList.toggle("active", t === mt);
  });
}

function selectMealType(mt, btn) {
  currentMealType = mt;
  document
    .getElementById("typeCooking")
    .classList.toggle("active", mt === "cooking");
  document
    .getElementById("typeEatingout")
    .classList.toggle("active", mt === "eatingout");
  document
    .getElementById("typePrepmake")
    .classList.toggle("active", mt === "prepmake");

  if (mt === "cooking") {
    document.getElementById("sectionCooking").style.display = "";
    document.getElementById("sectionEatingout").style.display = "none";
    document.getElementById("fgCookingMemo").style.display = "";
    document.getElementById("fgPrepMake").style.display = "none";
    document.getElementById("labelCookingTotal").textContent =
      "自炊コスト（合計）";
  } else if (mt === "prepmake") {
    document.getElementById("sectionCooking").style.display = "";
    document.getElementById("sectionEatingout").style.display = "none";
    document.getElementById("fgCookingMemo").style.display = "none";
    document.getElementById("fgPrepMake").style.display = "";
    document.getElementById("labelCookingTotal").textContent =
      "総材料費（記録は0円になります）";
  } else {
    document.getElementById("sectionCooking").style.display = "none";
    document.getElementById("sectionEatingout").style.display = "";
  }
}

// ========== Food Picker Modal ==========
let pickerSelectedIds = new Set();
let isPickerForEdit = false;
let editModalIngredients = [];
let editingRecordId = null;

function openFoodPickerModal(forEdit = false) {
  isPickerForEdit = forEdit;
  const targetList = forEdit ? editModalIngredients : selectedIngredients;
  pickerSelectedIds = new Set(targetList.map((i) => i.foodId));
  renderFoodPickerList();
  document.getElementById("foodPickerModal").classList.add("open");
}
function renderFoodPickerList() {
  const el = document.getElementById("foodPickerList");
  const availableFoods = state.foods.filter((f) => {
    const rem = f.remaining ?? f.quantity;
    return rem > 0 || pickerSelectedIds.has(f.id);
  });

  if (availableFoods.length === 0) {
    el.innerHTML =
      '<div class="empty-state"><div class="empty-icon">📦</div><p>使用可能な食品がありません。<br>まず「食品管理」タブで食品を追加してください。</p></div>';
    return;
  }
  el.innerHTML = availableFoods
    .map((f) => {
      const sel = pickerSelectedIds.has(f.id);
      return `<div class="food-item" style="cursor:pointer; ${sel ? "background:#f0fdf4; border-color:var(--color-primary);" : ""}"
            onclick="togglePickerFood('${f.id}', this)">
            <div class="food-item-info">
              <div class="food-name">${esc(f.name)}</div>
              <div class="food-price">¥${f.price} / ${f.quantity}${esc(f.unit)} → 残り: ${formatRemaining(f)}</div>
            </div>
            <span style="font-size:1.2rem;">${sel ? "✅" : "⬜"}</span>
          </div>`;
    })
    .join("");
}
function togglePickerFood(id, el) {
  if (pickerSelectedIds.has(id)) {
    pickerSelectedIds.delete(id);
    el.style.background = "";
    el.style.borderColor = "";
    el.querySelector("span").textContent = "⬜";
  } else {
    pickerSelectedIds.add(id);
    el.style.background = "#f0fdf4";
    el.style.borderColor = "var(--color-primary)";
    el.querySelector("span").textContent = "✅";
  }
}
function confirmFoodPicker() {
  const targetList = isPickerForEdit
    ? editModalIngredients
    : selectedIngredients;
  pickerSelectedIds.forEach((id) => {
    if (!targetList.find((i) => i.foodId === id)) {
      targetList.push({
        foodId: id,
        usage: 100,
        usageType: "percent",
      });
    }
  });
  // Remove deselected
  const newTargetList = targetList.filter((i) =>
    pickerSelectedIds.has(i.foodId),
  );

  if (isPickerForEdit) editModalIngredients = newTargetList;
  else selectedIngredients = newTargetList;

  closeModal("foodPickerModal");

  if (isPickerForEdit) {
    renderEditSelectedIngredients();
    recalcEditRecordTotal();
  } else {
    renderSelectedIngredients();
    recalcCookingTotal();
  }
}

function renderSelectedIngredients() {
  const el = document.getElementById("selectedIngredients");
  if (selectedIngredients.length === 0) {
    el.innerHTML =
      '<div class="empty-state" style="padding:24px;"><div class="empty-icon">🧺</div><p>食品を追加してください</p></div>';
    return;
  }
  el.innerHTML = selectedIngredients
    .map((ing, idx) => {
      const food = state.foods.find((f) => f.id === ing.foodId);
      if (!food) return "";
      const cost = calcIngredientCost(food, ing);
      const usageAmount = getUsageAmount(food, ing);
      const rem = food.remaining ?? food.quantity;
      const afterRem = Math.max(0, rem - usageAmount);
      return `<div class="ingredient-row">
            <div>
              <div class="ing-name">${esc(food.name)}</div>
              <div class="ing-price">¥${food.price} / ${food.quantity}${esc(food.unit)}<br/>
              <span style="color:var(--color-primary-dark);">残: ${Math.round(rem * 10) / 10}${esc(food.unit)} → ${Math.round(afterRem * 10) / 10}${esc(food.unit)}</span></div>
            </div>
            <div class="ing-usage">
              ${
                ing.usageType === "fraction"
                  ? `<div class="fraction-input">
                    <input type="number" value="${ing.usageNumer ?? 1}" min="1" onchange="updateIngUsage(${idx},'numer',this.value)" style="width:42px;padding:3px 5px;font-size:0.78rem;" />
                    <span class="fraction-sep">/</span>
                    <input type="number" value="${ing.usageDenom ?? 2}" min="1" onchange="updateIngUsage(${idx},'denom',this.value)" style="width:42px;padding:3px 5px;font-size:0.78rem;" />
                  </div>`
                  : `<input class="usage-input" type="number" value="${ing.usage}" min="0" step="0.1" onchange="updateIngUsage(${idx},'value',this.value)" style="width:54px;padding:3px 5px;font-size:0.78rem;" />`
              }
              <select onchange="updateIngUsageType(${idx},this.value)" style="padding:3px 5px;font-size:0.75rem;width:auto;">
                <option value="amount" ${ing.usageType === "amount" ? "selected" : ""}>単位量(${esc(food.unit)})</option>
                <option value="percent" ${!ing.usageType || ing.usageType === "percent" ? "selected" : ""}>残りの割合(%)</option>
                <option value="fraction" ${ing.usageType === "fraction" ? "selected" : ""}>残りの割合(分数)</option>
                <option value="decimal" ${ing.usageType === "decimal" ? "selected" : ""}>残りの割合(小数)</option>
              </select>
            </div>
            <div class="computed-cost">¥${cost}</div>
            <button class="btn-icon danger" onclick="removeIngredient(${idx})" title="削除">✕</button>
          </div>`;
    })
    .join("");
}
function updateIngUsage(idx, key, val) {
  if (key === "value" || key === "percent") {
    selectedIngredients[idx].usage = parseFloat(val) || 0;
  } else if (key === "numer") {
    selectedIngredients[idx].usageNumer = parseInt(val) || 1;
  } else if (key === "denom") {
    selectedIngredients[idx].usageDenom = parseInt(val) || 1;
  }
  renderSelectedIngredients();
  recalcCookingTotal();
}
function updateIngUsageType(idx, type) {
  selectedIngredients[idx].usageType = type;
  if (type === "fraction") {
    if (!selectedIngredients[idx].usageNumer)
      selectedIngredients[idx].usageNumer = 1;
    if (!selectedIngredients[idx].usageDenom)
      selectedIngredients[idx].usageDenom = 2;
  } else if (type === "percent") {
    selectedIngredients[idx].usage = 100;
  } else if (type === "decimal") {
    selectedIngredients[idx].usage = 0.5;
  } else if (type === "amount") {
    const food = state.foods.find(
      (f) => f.id === selectedIngredients[idx].foodId,
    );
    selectedIngredients[idx].usage = food
      ? (food.remaining ?? food.quantity)
      : 0;
  }
  renderSelectedIngredients();
  recalcCookingTotal();
}
function removeIngredient(idx) {
  selectedIngredients.splice(idx, 1);
  renderSelectedIngredients();
  recalcCookingTotal();
}

function getUsageAmount(food, ing) {
  const rem = food.remaining ?? food.quantity;
  if (ing.usageType === "fraction") {
    const n = ing.usageNumer ?? 1;
    const d = ing.usageDenom ?? 1;
    return rem * (d > 0 ? n / d : 0);
  } else if (ing.usageType === "decimal") {
    return rem * (parseFloat(ing.usage) || 0);
  } else if (ing.usageType === "amount") {
    return parseFloat(ing.usage) || 0;
  } else {
    // percent
    return rem * ((parseFloat(ing.usage) || 0) / 100);
  }
}

function calcIngredientCost(food, ing) {
  const usageAmount = getUsageAmount(food, ing);
  const costRatio = food.quantity > 0 ? usageAmount / food.quantity : 0;
  return Math.round(food.price * costRatio);
}

function recalcCookingTotal() {
  let total = 0;
  selectedIngredients.forEach((ing) => {
    const food = state.foods.find((f) => f.id === ing.foodId);
    if (food) total += calcIngredientCost(food, ing);
  });
  document.getElementById("cookingTotal").textContent = `¥${total}`;
}

function renderEditSelectedIngredients() {
  const el = document.getElementById("editSelectedIngredients");
  if (editModalIngredients.length === 0) {
    el.innerHTML =
      '<div class="empty-state" style="padding:16px;"><p>食品がありません</p></div>';
    return;
  }
  el.innerHTML = editModalIngredients
    .map((ing, idx) => {
      const food = state.foods.find((f) => f.id === ing.foodId);
      if (!food) return "";
      const cost = calcIngredientCost(food, ing);
      const usageAmount = getUsageAmount(food, ing);
      return `<div class="ingredient-row" style="margin-bottom:8px; border:1px solid #e5e7eb; padding:8px; display:flex; flex-direction:column; gap:4px;">
      <div style="font-weight:bold;">${esc(food.name)} <span style="font-weight:normal; font-size:0.8rem;">(¥${food.price}/${food.quantity}${esc(food.unit)})</span></div>
      <div class="ing-usage" style="display:flex; gap:8px; align-items:center;">
        ${
          ing.usageType === "fraction"
            ? `<div class="fraction-input"><input type="number" value="${ing.usageNumer ?? 1}" onchange="updateEditIngUsage(${idx},'numer',this.value)" style="width:42px;padding:3px;"/><span class="fraction-sep">/</span><input type="number" value="${ing.usageDenom ?? 2}" onchange="updateEditIngUsage(${idx},'denom',this.value)" style="width:42px;padding:3px;"/></div>`
            : `<input class="usage-input" type="number" value="${ing.usage}" min="0" step="0.1" onchange="updateEditIngUsage(${idx},'value',this.value)" style="width:60px;padding:3px;"/>`
        }
        <select onchange="updateEditIngUsageType(${idx},this.value)" style="padding:3px;">
            <option value="amount" ${ing.usageType === "amount" ? "selected" : ""}>単位量(${esc(food.unit)})</option>
            <option value="percent" ${!ing.usageType || ing.usageType === "percent" ? "selected" : ""}>全体の割合(%)</option>
            <option value="fraction" ${ing.usageType === "fraction" ? "selected" : ""}>全体の割合(分数)</option>
            <option value="decimal" ${ing.usageType === "decimal" ? "selected" : ""}>全体の割合(小数)</option>
        </select>
        <span style="margin-left:auto; font-weight:bold;">¥${cost}</span>
        <button class="btn-icon danger" onclick="removeEditIngredient(${idx})">✕</button>
      </div>
    </div>`;
    })
    .join("");
}

function updateEditIngUsage(idx, key, val) {
  if (key === "value" || key === "percent")
    editModalIngredients[idx].usage = parseFloat(val) || 0;
  else if (key === "numer")
    editModalIngredients[idx].usageNumer = parseInt(val) || 1;
  else if (key === "denom")
    editModalIngredients[idx].usageDenom = parseInt(val) || 1;
  renderEditSelectedIngredients();
  recalcEditRecordTotal();
}
function updateEditIngUsageType(idx, type) {
  editModalIngredients[idx].usageType = type;
  if (type === "percent") editModalIngredients[idx].usage = 100;
  else if (type === "decimal") editModalIngredients[idx].usage = 0.5;
  renderEditSelectedIngredients();
  recalcEditRecordTotal();
}
function removeEditIngredient(idx) {
  editModalIngredients.splice(idx, 1);
  renderEditSelectedIngredients();
  recalcEditRecordTotal();
}
function recalcEditRecordTotal() {
  let total = 0;
  editModalIngredients.forEach((ing) => {
    const food = state.foods.find((f) => f.id === ing.foodId);
    if (food) total += calcIngredientCost(food, ing);
  });
  document.getElementById("editRecordTotalLabel").textContent = `¥${total}`;
}

// ========== Eating out Items ==========
function addEatingOutItem() {
  eatingOutItems.push({ name: "", price: 0 });
  renderEatingOutItems();
}
function removeEatingOutItem(idx) {
  eatingOutItems.splice(idx, 1);
  renderEatingOutItems();
}
function renderEatingOutItems() {
  const el = document.getElementById("eatingoutItemList");
  if (eatingOutItems.length === 0) {
    el.innerHTML =
      '<p style="font-size:0.82rem;color:var(--color-text-muted);margin:0 0 8px;">商品を追加してください</p>';
    return;
  }
  el.innerHTML = eatingOutItems
    .map(
      (item, idx) => `
          <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;margin-bottom:8px;">
            <input type="text" value="${esc(item.name)}" placeholder="商品名" onchange="updateEatingItem(${idx},'name',this.value)" />
            <input type="number" value="${item.price || ""}" placeholder="円" min="0" style="width:90px;" onchange="updateEatingItem(${idx},'price',this.value)" />
            <button class="btn-icon danger" onclick="removeEatingOutItem(${idx})">✕</button>
          </div>
        `,
    )
    .join("");
  recalcEatingOutTotal();
}
function updateEatingItem(idx, key, val) {
  if (key === "price") eatingOutItems[idx].price = parseInt(val) || 0;
  else eatingOutItems[idx].name = val;
  recalcEatingOutTotal();
}
function recalcEatingOutTotal() {
  const total = eatingOutItems.reduce((s, i) => s + (i.price || 0), 0);
  document.getElementById("eatingOutTotal").textContent = `¥${total}`;
}

// ========== Submit Record ==========
function submitRecord() {
  initializeInventory();
  const date = document.getElementById("addDate").value;
  if (!date) {
    alert("日付を入力してください");
    return;
  }

  let totalCost = 0;
  let record = {
    id: genId(),
    date,
    mealTime: currentMealTime,
    type: currentMealType,
  };

  if (currentMealType === "cooking" || currentMealType === "prepmake") {
    if (selectedIngredients.length === 0) {
      alert("食品を1つ以上選択してください");
      return;
    }

    let prepName = "",
      prepServings = 1;
    if (currentMealType === "prepmake") {
      prepName = document.getElementById("prepName").value.trim();
      prepServings =
        parseFloat(document.getElementById("prepServings").value) || 1;
      if (!prepName) {
        alert("完成品の名前を入力してください");
        return;
      }
    }

    const ingredients = selectedIngredients.map((ing) => {
      const food = state.foods.find((f) => f.id === ing.foodId);
      const usageAmount = getUsageAmount(food, ing);
      const cost = calcIngredientCost(food, ing);
      return {
        foodId: ing.foodId,
        foodName: food?.name || ing.foodName || "削除済み食品",
        unit: food?.unit || ing.unit || "",
        usage: usageAmount,
        usageType: "amount",
        cost,
      };
    });

    totalCost = ingredients.reduce((s, i) => s + i.cost, 0);

    if (currentMealType === "prepmake") {
      record.memo = `【作り置き作成】${prepName} (${prepServings}食)`;
      record.totalCost = 0; // 作り置き作成時は0円として記録

      // foodsに作り置きアイテムを追加
      record.outputFoodId = genId();
      state.foods.push({
        id: record.outputFoodId,
        name: `【作り置き】${prepName}`,
        price: totalCost,
        quantity: prepServings,
        unit: "食",
        remaining: prepServings,
        inventoryBase: prepServings,
        note: `${date} 作成`,
      });
    } else {
      record.memo = document.getElementById("cookingMemo").value;
      record.totalCost = totalCost;
    }

    record.ingredients = ingredients;

    // Update food remaining
    selectedIngredients.forEach((ing) => {
      const food = state.foods.find((f) => f.id === ing.foodId);
      if (!food) return;

      const usageAmount = getUsageAmount(food, ing);
      food.remaining = Math.max(
        0,
        (food.remaining ?? food.quantity) - usageAmount,
      );
    });
  } else {
    // Eating Out
    if (eatingOutItems.length === 0) {
      alert("商品を1つ以上追加してください");
      return;
    }
    const validItems = eatingOutItems.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      alert("商品名を入力してください");
      return;
    }
    totalCost = eatingOutItems.reduce((s, i) => s + (i.price || 0), 0);
    record.restaurantName = document.getElementById("restaurantName").value;
    record.items = [...eatingOutItems];
    record.totalCost = totalCost;
  }

  state.records.push(record);
  saveState();

  // Reset form
  selectedIngredients = [];
  eatingOutItems = [];
  document.getElementById("cookingMemo").value = "";
  document.getElementById("prepName").value = "";
  document.getElementById("restaurantName").value = "";
  renderSelectedIngredients();
  renderEatingOutItems();
  recalcCookingTotal();

  // Switch to records tab
  switchTab("records", document.getElementById("tab-records"));
  renderAll();
  alert("記録を保存しました ✓");
}

// ========== Food Management & Edit ==========
function addFood() {
  const name = document.getElementById("newFoodName").value.trim();
  const price = parseInt(document.getElementById("newFoodPrice").value) || 0;
  const quantity =
    parseFloat(document.getElementById("newFoodQuantity").value) || 0;
  const unit = document.getElementById("newFoodUnit").value;
  const note = document.getElementById("newFoodNote").value.trim();
  const purchaseDate = document.getElementById("newFoodDate").value || TODAY;

  if (!name) {
    alert("食品名を入力してください");
    return;
  }
  if (price <= 0) {
    alert("価格を入力してください");
    return;
  }
  if (quantity <= 0) {
    alert("購入量を入力してください");
    return;
  }

  state.foods.push({
    id: genId(),
    name,
    price,
    quantity,
    unit,
    remaining: quantity,
    inventoryBase: quantity,
    note,
    purchaseDate,
  });
  saveState();
  document.getElementById("newFoodName").value = "";
  document.getElementById("newFoodPrice").value = "";
  document.getElementById("newFoodQuantity").value = "";
  document.getElementById("newFoodNote").value = "";
  const newFoodDateEl = document.getElementById("newFoodDate");
  if (newFoodDateEl) newFoodDateEl.value = TODAY;
  renderFoods();
}
function deleteFood(id) {
  if (!confirm("この食品を削除しますか？")) return;
  state.foods = state.foods.filter((f) => f.id !== id);
  saveState();
  renderFoods();
}
function formatRemaining(food) {
  const r = food.remaining ?? food.quantity;
  return `${Math.round(r * 10) / 10}${food.unit}`;
}
function renderFoods() {
  const el = document.getElementById("foodList");
  if (state.foods.length === 0) {
    el.innerHTML =
      '<div class="empty-state"><div class="empty-icon">📦</div><p>食品が登録されていません</p></div>';
    return;
  }

  const availableFoods = [];
  const emptyFoods = [];
  state.foods.forEach((f) => {
    const rem = f.remaining ?? f.quantity;
    if (rem <= 0) emptyFoods.push(f);
    else availableFoods.push(f);
  });

  const renderItems = (foods) => {
    return foods
      .map((f) => {
        const rem = f.remaining ?? f.quantity;
        const pct = f.quantity > 0 ? rem / f.quantity : 0;
        const low = pct <= 0.2;
        const dateStr = f.purchaseDate ? `購入: ${f.purchaseDate}` : "";
        return `<div class="food-item">
              <div class="food-item-info">
                <div class="food-name">${esc(f.name)}</div>
                <div class="food-price">${dateStr ? dateStr + " / " : ""}¥${f.price} / ${f.quantity}${esc(f.unit)}${f.note ? ` — ${esc(f.note)}` : ""}</div>
              </div>
              <span class="food-remaining ${low ? "low" : ""}">残 ${formatRemaining(f)}</span>
              <div style="display:flex;gap:4px;">
                <button class="btn-icon" title="編集" onclick="openFoodEditModal('${f.id}')">✎</button>
                <button class="btn-icon danger" title="削除" onclick="deleteFood('${f.id}')">🗑</button>
              </div>
            </div>`;
      })
      .reverse()
      .join("");
  };

  let html = renderItems(availableFoods);
  if (emptyFoods.length > 0) {
    html += `<details style="margin-top: 16px;">
            <summary style="cursor: pointer; color: var(--color-text-muted); font-size: 0.9rem; font-weight: bold; margin-bottom: 8px;">消費済み (${emptyFoods.length})</summary>
            ${renderItems(emptyFoods)}
          </details>`;
  }
  el.innerHTML = html;
}

let editingFoodId = null;
function openFoodEditModal(id) {
  const f = state.foods.find((x) => x.id === id);
  if (!f) return;
  editingFoodId = id;
  document.getElementById("editFoodName").value = f.name;
  document.getElementById("editFoodPrice").value = f.price;
  document.getElementById("editFoodQuantity").value = f.quantity;
  document.getElementById("editFoodUnit").value = f.unit || "g";
  document.getElementById("editFoodRemaining").value =
    f.remaining ?? f.quantity;
  const editFoodDateEl = document.getElementById("editFoodDate");
  if (editFoodDateEl) editFoodDateEl.value = f.purchaseDate || TODAY;
  document.getElementById("editFoodNote").value = f.note || "";
  document.getElementById("foodEditModal").classList.add("open");
}
function saveFoodEdit() {
  const f = state.foods.find((x) => x.id === editingFoodId);
  if (!f) return;
  initializeInventory();
  const oldRemaining = f.remaining;
  f.name = document.getElementById("editFoodName").value.trim();
  f.price = parseInt(document.getElementById("editFoodPrice").value) || 0;
  f.quantity =
    parseFloat(document.getElementById("editFoodQuantity").value) || 0;
  f.unit = document.getElementById("editFoodUnit").value;
  f.remaining =
    parseFloat(document.getElementById("editFoodRemaining").value) || 0;
  f.inventoryBase += f.remaining - oldRemaining;
  const editFoodDateEl = document.getElementById("editFoodDate");
  if (editFoodDateEl) f.purchaseDate = editFoodDateEl.value;
  f.note = document.getElementById("editFoodNote").value.trim();
  saveState();
  closeModal("foodEditModal");
  renderFoods();
}

// ========== Records & Edit ==========
const MEAL_ICONS = {
  morning: "☀️",
  lunch: "🌤️",
  dinner: "🌙",
  other: "🍩",
};
const MEAL_LABELS = {
  morning: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  other: "その他",
};

function renderRecords() {
  const el = document.getElementById("recordList");
  const monthRecords = state.records.filter((r) => isInCurrentMonth(r.date));
  if (monthRecords.length === 0) {
    el.innerHTML =
      '<div class="empty-state"><div class="empty-icon">🗒️</div><p>この月の記録はありません</p></div>';
    return;
  }

  // Group by date descending
  const groups = {};
  monthRecords.forEach((r) => {
    if (!groups[r.date]) groups[r.date] = [];
    groups[r.date].push(r);
  });
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  const MEAL_ORDER = { morning: 1, lunch: 2, dinner: 3, other: 4 };

  el.innerHTML = sortedDates
    .map((date) => {
      const recs = groups[date];
      recs.sort(
        (a, b) => (MEAL_ORDER[a.mealTime] || 5) - (MEAL_ORDER[b.mealTime] || 5),
      );
      const dayTotal = recs.reduce((s, r) => s + (r.totalCost || 0), 0);
      const items = recs
        .map((r) => {
          const title =
            r.type === "cooking" || r.type === "prepmake"
              ? r.memo || (r.type === "prepmake" ? "作り置き作成" : "自炊")
              : r.restaurantName || "外食";

          let sub = "";
          if (r.type === "cooking" || r.type === "prepmake") {
            sub = (r.ingredients || [])
              .map((ing) => {
                const f = state.foods.find((x) => x.id === ing.foodId);
                return f ? f.name : "不明";
              })
              .join("、");
          } else {
            sub = (r.items || []).map((i) => i.name).join("、");
          }

          const tagHtml =
            r.type === "cooking"
              ? '<span class="tag tag-cooking" style="margin-left:4px;">自炊</span>'
              : r.type === "eatingout"
                ? '<span class="tag tag-eating-out" style="margin-left:4px;">外食</span>'
                : '<span class="tag tag-prepmake" style="margin-left:4px;">作り置き作成</span>';

          return `<div class="record-item">
              <div class="record-icon ${r.mealTime}">${MEAL_ICONS[r.mealTime] || "🍽️"}</div>
              <div class="record-body">
                <div class="record-title">${esc(title)}</div>
                <div class="record-sub">
                  <span class="meal-badge ${r.mealTime}">${MEAL_LABELS[r.mealTime] || r.mealTime}</span>
                  ${tagHtml}
                  ${sub ? `<span style="margin-left:6px; opacity:0.8;">${esc(sub)}</span>` : ""}
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:4px;">
                <span class="record-cost" style="margin-right:4px;">¥${r.totalCost}</span>
                <button class="btn-icon" title="編集" onclick="openRecordEditModal('${r.id}')">✎</button>
                <button class="btn-icon danger" title="削除" onclick="deleteRecord('${r.id}')">🗑</button>
              </div>
            </div>`;
        })
        .join("");

      const d = new Date(date + "T00:00:00");
      const dLabel = `${d.getMonth() + 1}/${d.getDate()} (${["日", "月", "火", "水", "木", "金", "土"][d.getDay()]})`;
      return `<div class="date-group-header">${dLabel}<span class="date-total">¥${dayTotal}</span></div>${items}`;
    })
    .join("");
}

function deleteRecord(id) {
  if (!confirm("この記録を削除しますか？")) return;
  initializeInventory();
  const record = state.records.find(r => r.id === id);
  if (record?.outputFoodId) {
    if (state.records.some(r => r.id !== id && r.ingredients?.some(i => i.foodId === record.outputFoodId))) { alert('この作り置きを使った記録があるので、先にそちらを編集・削除してください。'); return; }
    state.foods = state.foods.filter(f => f.id !== record.outputFoodId);
  }
  state.records = state.records.filter((r) => r.id !== id);
  saveState();
  renderAll();
}

function openRecordEditModal(id) {
  const r = state.records.find((x) => x.id === id);
  if (!r) return;
  editingRecordId = id;
  document.getElementById("editRecordDate").value = r.date;
  document.getElementById("editRecordTime").value = r.mealTime;
  document.getElementById("editRecordCost").value = r.totalCost || 0;

  const ingArea = document.getElementById("editRecordIngredientsArea");
  if (r.type === "cooking" || r.type === "prepmake") {
    document.getElementById("editRecordNote").value = r.memo || "";
    ingArea.style.display = "";
    editModalIngredients = JSON.parse(JSON.stringify(r.ingredients || []));
    renderEditSelectedIngredients();
    recalcEditRecordTotal();
  } else {
    document.getElementById("editRecordNote").value = r.restaurantName || "";
    ingArea.style.display = "none";
    editModalIngredients = [];
  }
  document.getElementById("recordEditModal").classList.add("open");
}

function saveRecordEdit() {
  initializeInventory();
  const r = state.records.find((x) => x.id === editingRecordId);
  if (!r) return;
  r.date = document.getElementById("editRecordDate").value;
  r.mealTime = document.getElementById("editRecordTime").value;

  if (r.type === "cooking" || r.type === "prepmake") {
    r.memo = document.getElementById("editRecordNote").value.trim();

    // Resolve new ingredients first
    const resolvedNewIngredients = editModalIngredients.map((ing) => {
      const food = state.foods.find((f) => f.id === ing.foodId);
      let usageAmount = 0;
      let cost = 0;
      if (food) {
        usageAmount = getUsageAmount(food, ing);
        cost = calcIngredientCost(food, ing);
      }
      return {
        foodId: ing.foodId,
        foodName: food?.name || ing.foodName || "削除済み食品",
        unit: food?.unit || ing.unit || "",
        usage: usageAmount,
        usageType: "amount",
        cost,
      };
    });

    // Reverse old ingredients stock
    if (r.ingredients) {
      r.ingredients.forEach((oldIng) => {
        const food = state.foods.find((f) => f.id === oldIng.foodId);
        if (food) {
          food.remaining =
            (food.remaining ?? food.quantity) + (oldIng.usage || 0);
        }
      });
    }

    // Apply new ingredients
    let newTotalCost = 0;
    resolvedNewIngredients.forEach((ing) => {
      const food = state.foods.find((f) => f.id === ing.foodId);
      if (food) {
        food.remaining = Math.max(
          0,
          (food.remaining ?? food.quantity) - ing.usage,
        );
      }
      newTotalCost += ing.cost;
    });

    r.ingredients = resolvedNewIngredients;
    r.totalCost = r.type === "prepmake" ? 0 : newTotalCost;
    if (r.outputFoodId) {
      const output = state.foods.find(f => f.id === r.outputFoodId);
      if (output) output.price = newTotalCost;
    }
    // ※ prepmake cost is theoretically 0 in record, but if we updated the prep item food price, it could get complicated.
    // For now, we keep it simple.
  } else {
    r.totalCost =
      parseInt(document.getElementById("editRecordCost").value) || 0;
    r.restaurantName = document.getElementById("editRecordNote").value.trim();
  }

  saveState();
  closeModal("recordEditModal");
  renderAll();
}

// ========== Summary ==========
function renderSummary() {
  const monthRecords = state.records.filter((r) => isInCurrentMonth(r.date));
  const monthTotal = monthRecords.reduce((s, r) => s + (r.totalCost || 0), 0);
  document.getElementById("statMonthTotal").textContent =
    `¥${monthTotal.toLocaleString()}`;

  const todayRecords = state.records.filter((r) => r.date === TODAY);
  const todayTotal = todayRecords.reduce((s, r) => s + (r.totalCost || 0), 0);
  document.getElementById("statToday").textContent =
    `¥${todayTotal.toLocaleString()}`;

  const { year, month } = state.currentMonth;
  const days = new Set(monthRecords.map((r) => r.date)).size;
  const avg = days > 0 ? Math.round(monthTotal / days) : 0;
  document.getElementById("statAvg").textContent = `¥${avg.toLocaleString()}`;
}

// ========== Charts ==========
let mealTimeChartInstance = null;
let typeChartInstance = null;
let weeklyChartInstance = null;

function renderCharts() {
  if (typeof Chart === "undefined") return;

  const monthRecords = state.records.filter((r) => isInCurrentMonth(r.date));

  // 1. Meal Time Chart
  const mealTimeContainer = document.getElementById("mealTimeChartContainer");
  if (mealTimeChartInstance) {
    mealTimeChartInstance.destroy();
    mealTimeChartInstance = null;
  }

  const mealGroups = { morning: 0, lunch: 0, dinner: 0, other: 0 };
  monthRecords.forEach((r) => {
    mealGroups[r.mealTime] = (mealGroups[r.mealTime] || 0) + (r.totalCost || 0);
  });
  const mealTotal = Object.values(mealGroups).reduce((a, b) => a + b, 0);

  if (mealTotal === 0) {
    mealTimeContainer.innerHTML = `<div class="empty-chart-message" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-muted);font-size:0.85rem;">今月の記録がありません</div>`;
  } else {
    mealTimeContainer.innerHTML = `<canvas id="mealTimeChart"></canvas>`;
    const ctx = document.getElementById("mealTimeChart").getContext("2d");
    mealTimeChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["朝食", "昼食", "夕食", "その他"],
        datasets: [
          {
            data: [
              mealGroups.morning,
              mealGroups.lunch,
              mealGroups.dinner,
              mealGroups.other,
            ],
            backgroundColor: ["#f59e0b", "#3b82f6", "#6366f1", "#8b5cf6"],
            borderColor: "#ffffff",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              generateLabels: function (chart) {
                const data = chart.data;
                if (data.labels.length && data.datasets.length) {
                  return data.labels.map(function (label, i) {
                    const meta = chart.getDatasetMeta(0);
                    const style = meta.controller.getStyle(i);
                    const val = data.datasets[0].data[i] || 0;
                    const pct = mealTotal > 0 ? ((val / mealTotal) * 100).toFixed(1) : "0.0";
                    return {
                      text: ` ${label}: ¥${val.toLocaleString()} (${pct}%)`,
                      fillStyle: style.backgroundColor,
                      strokeStyle: style.borderColor,
                      lineWidth: style.borderWidth,
                      hidden: isNaN(data.datasets[0].data[i]) || meta.data[i].hidden,
                      index: i
                    };
                  });
                }
                return [];
              },
              font: {
                family: '"Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
                size: 11,
                weight: "600",
              },
              color: "#4b5563",
              padding: 12,
            },
          },
          tooltip: {
            backgroundColor: "rgba(17, 24, 39, 0.9)",
            titleFont: {
              family: '"Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
              size: 12,
            },
            bodyFont: {
              family: '"Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
              size: 12,
            },
            callbacks: {
              label: function (context) {
                const label = context.label || "";
                const val = context.parsed || 0;
                const pct = ((val / mealTotal) * 100).toFixed(1);
                return ` ${label}: ¥${val.toLocaleString()} (${pct}%)`;
              },
            },
          },
        },
        cutout: "60%",
      },
    });
  }

  // 2. Type Chart
  const typeContainer = document.getElementById("typeChartContainer");
  if (typeChartInstance) {
    typeChartInstance.destroy();
    typeChartInstance = null;
  }

  let cooking = 0,
    eatingOut = 0,
    prepmake = 0;
  monthRecords.forEach((r) => {
    if (r.type === "cooking") cooking += r.totalCost || 0;
    else if (r.type === "eatingout") eatingOut += r.totalCost || 0;
    else prepmake += r.totalCost || 0;
  });
  const typeTotal = cooking + eatingOut + prepmake;

  if (typeTotal === 0) {
    typeContainer.innerHTML = `<div class="empty-chart-message" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-muted);font-size:0.85rem;">今月の記録がありません</div>`;
  } else {
    typeContainer.innerHTML = `<canvas id="typeChart"></canvas>`;
    const labels = ["自炊", "外食"];
    const data = [cooking, eatingOut];
    const colors = ["#16a34a", "#f59e0b"];
    if (prepmake > 0) {
      labels.push("作り置き");
      data.push(prepmake);
      colors.push("#4338ca");
    }

    const ctx = document.getElementById("typeChart").getContext("2d");
    typeChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: colors,
            borderColor: "#ffffff",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              generateLabels: function (chart) {
                const data = chart.data;
                if (data.labels.length && data.datasets.length) {
                  return data.labels.map(function (label, i) {
                    const meta = chart.getDatasetMeta(0);
                    const style = meta.controller.getStyle(i);
                    const val = data.datasets[0].data[i] || 0;
                    const pct = typeTotal > 0 ? ((val / typeTotal) * 100).toFixed(1) : "0.0";
                    return {
                      text: ` ${label}: ¥${val.toLocaleString()} (${pct}%)`,
                      fillStyle: style.backgroundColor,
                      strokeStyle: style.borderColor,
                      lineWidth: style.borderWidth,
                      hidden: isNaN(data.datasets[0].data[i]) || meta.data[i].hidden,
                      index: i
                    };
                  });
                }
                return [];
              },
              font: {
                family: '"Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
                size: 11,
                weight: "600",
              },
              color: "#4b5563",
              padding: 12,
            },
          },
          tooltip: {
            backgroundColor: "rgba(17, 24, 39, 0.9)",
            titleFont: {
              family: '"Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
              size: 12,
            },
            bodyFont: {
              family: '"Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
              size: 12,
            },
            callbacks: {
              label: function (context) {
                const label = context.label || "";
                const val = context.parsed || 0;
                const pct = ((val / typeTotal) * 100).toFixed(1);
                return ` ${label}: ¥${val.toLocaleString()} (${pct}%)`;
              },
            },
          },
        },
        cutout: "60%",
      },
    });
  }

  // 3. Weekly Chart
  const weeklyContainer = document.getElementById("weeklyChartContainer");
  if (weeklyChartInstance) {
    weeklyChartInstance.destroy();
    weeklyChartInstance = null;
  }

  const weekData = [0, 0, 0, 0, 0];
  monthRecords.forEach((r) => {
    const day = new Date(r.date + "T00:00:00").getDate();
    const weekIdx = Math.min(4, Math.floor((day - 1) / 7));
    weekData[weekIdx] += r.totalCost || 0;
  });
  const weeklyTotal = weekData.reduce((a, b) => a + b, 0);

  if (weeklyTotal === 0) {
    weeklyContainer.innerHTML = `<div class="empty-chart-message" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-muted);font-size:0.85rem;">今月の記録がありません</div>`;
  } else {
    weeklyContainer.innerHTML = `<canvas id="weeklyChart"></canvas>`;
    const ctx = document.getElementById("weeklyChart").getContext("2d");
    weeklyChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["第1週", "第2週", "第3週", "第4週", "第5週"],
        datasets: [
          {
            label: "支出",
            data: weekData,
            backgroundColor: "rgba(22, 163, 74, 0.8)",
            borderColor: "#16a34a",
            borderWidth: 1.5,
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            right: 65, // Add padding to avoid clipping the end value labels
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: "rgba(17, 24, 39, 0.9)",
            titleFont: {
              family: '"Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
              size: 12,
            },
            bodyFont: {
              family: '"Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
              size: 12,
            },
            callbacks: {
              label: function (context) {
                const val = context.parsed.x || 0;
                return ` 支出: ¥${val.toLocaleString()}`;
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: "#f3f4f6",
            },
            ticks: {
              font: {
                family: '"Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
                size: 10,
              },
              color: "#6b7280",
              callback: function (value) {
                return "¥" + value.toLocaleString();
              },
            },
          },
          y: {
            grid: {
              display: false,
            },
            ticks: {
              font: {
                family: '"Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
                size: 11,
                weight: "600",
              },
              color: "#4b5563",
            },
          },
        },
      },
      plugins: [
        {
          id: "barLabels",
          afterDatasetsDraw(chart) {
            const { ctx, data } = chart;
            ctx.save();
            ctx.font = '600 11px "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif';
            ctx.fillStyle = "#4b5563";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            chart.getDatasetMeta(0).data.forEach((bar, index) => {
              const val = data.datasets[0].data[index];
              if (val > 0) {
                ctx.fillText(`¥${val.toLocaleString()}`, bar.x + 8, bar.y);
              }
            });
            ctx.restore();
          },
        },
      ],
    });
  }
}

// ========== Utils ==========
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function esc(str) {
  return (str || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderAll() {
  document.getElementById("currentMonthLabel").textContent = getMonthLabel();
  renderSummary();
  renderRecords();
  renderFoods();
  renderCharts();
}

// ========== Init ==========
window.addEventListener("load", () => {
  loadState();
  document.getElementById("addDate").value = TODAY;
  const newFoodDateEl = document.getElementById("newFoodDate");
  if (newFoodDateEl) newFoodDateEl.value = TODAY;
  addEatingOutItem();
  renderAll();

  if (
    state.syncConfig &&
    state.syncConfig.id &&
    state.syncConfig.autoDownload
  ) {
    syncDownload(true);
  }
});

const toolSync = new OpetoolsSync('foods', () => state, () => localStorage.setItem("foods_tool_v1", JSON.stringify(state)), data => { state.foods = data.foods; state.records = data.records; migrateRecords(); initializeInventory(); }, renderAll);
