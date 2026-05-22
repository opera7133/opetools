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

function autoSyncUpload() {
  if (state.syncConfig && state.syncConfig.id && state.syncConfig.editKey) {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      fetch(getSyncEndpoint(state.syncConfig.id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Edit-Key": state.syncConfig.editKey,
        },
        body: JSON.stringify({
          foods: state.foods,
          records: state.records,
        }),
      }).catch((e) => console.error("Auto sync failed", e));
    }, 1500); // 1.5s debounce
  }
}

function migrateRecords() {
  state.records.forEach(r => {
    if (r.ingredients) {
      r.ingredients.forEach(ing => {
        if (ing.usageType !== 'amount') {
          const food = state.foods.find(f => f.id === ing.foodId);
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
            ing.usageType = 'amount';
          }
        }
      });
    }
  });
}

function saveState() {
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
  if (!state.foods) state.foods = [];
  if (!state.records) state.records = [];
  migrateRecords();
  if (!state.syncConfig)
    state.syncConfig = {
      id: "",
      editKey: "",
      proxyUrl: "",
      autoDownload: false,
      serverVersion: "v2"
    };
  if (!state.currentMonth) {
    const d = new Date();
    state.currentMonth = { year: d.getFullYear(), month: d.getMonth() };
  }

  if (document.getElementById("syncToken")) {
    const s = state.syncConfig;
    if (s.id && s.editKey) document.getElementById("syncToken").value = `${s.id}:${s.editKey}`;
    else document.getElementById("syncToken").value = "";
    
    document.getElementById("syncProxyUrl").value =
      state.syncConfig.proxyUrl || "https://tools.ainznino.workers.dev";
      
    const sVer = s.serverVersion || "v2";
    const rads = document.getElementsByName("syncServer");
    rads.forEach(r => r.checked = (r.value === sVer));
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
  const targetList = isPickerForEdit ? editModalIngredients : selectedIngredients;
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
  const newTargetList = targetList.filter((i) => pickerSelectedIds.has(i.foodId));
  
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
    el.innerHTML = '<div class="empty-state" style="padding:16px;"><p>食品がありません</p></div>';
    return;
  }
  el.innerHTML = editModalIngredients.map((ing, idx) => {
    const food = state.foods.find(f => f.id === ing.foodId);
    if(!food) return "";
    const cost = calcIngredientCost(food, ing);
    const usageAmount = getUsageAmount(food, ing);
    return `<div class="ingredient-row" style="margin-bottom:8px; border:1px solid #e5e7eb; padding:8px; display:flex; flex-direction:column; gap:4px;">
      <div style="font-weight:bold;">${esc(food.name)} <span style="font-weight:normal; font-size:0.8rem;">(¥${food.price}/${food.quantity}${esc(food.unit)})</span></div>
      <div class="ing-usage" style="display:flex; gap:8px; align-items:center;">
        ${
          ing.usageType === "fraction"
            ? `<div class="fraction-input"><input type="number" value="${ing.usageNumer??1}" onchange="updateEditIngUsage(${idx},'numer',this.value)" style="width:42px;padding:3px;"/><span class="fraction-sep">/</span><input type="number" value="${ing.usageDenom??2}" onchange="updateEditIngUsage(${idx},'denom',this.value)" style="width:42px;padding:3px;"/></div>`
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
  }).join("");
}

function updateEditIngUsage(idx, key, val) {
  if (key === "value" || key === "percent") editModalIngredients[idx].usage = parseFloat(val) || 0;
  else if (key === "numer") editModalIngredients[idx].usageNumer = parseInt(val) || 1;
  else if (key === "denom") editModalIngredients[idx].usageDenom = parseInt(val) || 1;
  renderEditSelectedIngredients();
  recalcEditRecordTotal();
}
function updateEditIngUsageType(idx, type) {
  editModalIngredients[idx].usageType = type;
  if(type === "percent") editModalIngredients[idx].usage = 100;
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
  editModalIngredients.forEach(ing => {
    const food = state.foods.find(f => f.id === ing.foodId);
    if(food) total += calcIngredientCost(food, ing);
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
      state.foods.push({
        id: genId(),
        name: `【作り置き】${prepName}`,
        price: totalCost,
        quantity: prepServings,
        unit: "食",
        remaining: prepServings,
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
  f.name = document.getElementById("editFoodName").value.trim();
  f.price = parseInt(document.getElementById("editFoodPrice").value) || 0;
  f.quantity =
    parseFloat(document.getElementById("editFoodQuantity").value) || 0;
  f.unit = document.getElementById("editFoodUnit").value;
  f.remaining =
    parseFloat(document.getElementById("editFoodRemaining").value) || 0;
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
  const r = state.records.find((x) => x.id === editingRecordId);
  if (!r) return;
  r.date = document.getElementById("editRecordDate").value;
  r.mealTime = document.getElementById("editRecordTime").value;

  if (r.type === "cooking" || r.type === "prepmake") {
    r.memo = document.getElementById("editRecordNote").value.trim();
    
    // Resolve new ingredients first
    const resolvedNewIngredients = editModalIngredients.map(ing => {
       const food = state.foods.find(f => f.id === ing.foodId);
       let usageAmount = 0;
       let cost = 0;
       if (food) {
           usageAmount = getUsageAmount(food, ing);
           cost = calcIngredientCost(food, ing);
       }
       return {
           foodId: ing.foodId,
           usage: usageAmount,
           usageType: "amount",
           cost
       };
    });
    
    // Reverse old ingredients stock
    if (r.ingredients) {
      r.ingredients.forEach(oldIng => {
        const food = state.foods.find(f => f.id === oldIng.foodId);
        if (food) {
          food.remaining = (food.remaining ?? food.quantity) + (oldIng.usage || 0);
        }
      });
    }
    
    // Apply new ingredients
    let newTotalCost = 0;
    resolvedNewIngredients.forEach(ing => {
       const food = state.foods.find(f => f.id === ing.foodId);
       if (food) {
           food.remaining = Math.max(0, (food.remaining ?? food.quantity) - ing.usage);
       }
       newTotalCost += ing.cost;
    });
    
    r.ingredients = resolvedNewIngredients;
    r.totalCost = (r.type === "prepmake") ? 0 : newTotalCost; 
    // ※ prepmake cost is theoretically 0 in record, but if we updated the prep item food price, it could get complicated.
    // For now, we keep it simple.
  } else {
    r.totalCost = parseInt(document.getElementById("editRecordCost").value) || 0;
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
function renderCharts() {
  // ... (省略せずに記述しますが、既存のものとほぼ同じ)
  const monthRecords = state.records.filter((r) => isInCurrentMonth(r.date));
  // max is unused if 0
  const mealGroups = { morning: 0, lunch: 0, dinner: 0, other: 0 };
  monthRecords.forEach((r) => {
    mealGroups[r.mealTime] = (mealGroups[r.mealTime] || 0) + (r.totalCost || 0);
  });
  const mealMax = Math.max(1, ...Object.values(mealGroups));
  const mealColors = {
    morning: "#f59e0b",
    lunch: "#3b82f6",
    dinner: "#6366f1",
    other: "#8b5cf6",
  };
  document.getElementById("mealTimeChart").innerHTML = Object.entries(
    mealGroups,
  )
    .map(
      ([k, v]) => `
          <div class="bar-row">
            <span class="bar-label">${MEAL_LABELS[k]}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.round((v / mealMax) * 100)}%;background:${mealColors[k]};"></div></div>
            <span class="bar-amount">¥${v.toLocaleString()}</span>
          </div>
        `,
    )
    .join("");

  // Type chart (prepmake is 0 mostly, but added to cooking or left alone. separate prepmake isn't very useful unless cost > 0)
  let cooking = 0,
    eatingOut = 0,
    prepmake = 0;
  monthRecords.forEach((r) => {
    if (r.type === "cooking") cooking += r.totalCost || 0;
    else if (r.type === "eatingout") eatingOut += r.totalCost || 0;
    else prepmake += r.totalCost || 0;
  });
  const typeMax = Math.max(1, cooking, eatingOut, prepmake);
  const typeRows = [
    ["自炊", cooking, "#16a34a"],
    ["外食", eatingOut, "#f59e0b"],
  ];
  if (prepmake > 0) typeRows.push(["作り置き", prepmake, "#4338ca"]);
  document.getElementById("typeChart").innerHTML = typeRows
    .map(
      ([label, val, color]) => `
          <div class="bar-row">
            <span class="bar-label">${label}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.round((val / typeMax) * 100)}%;background:${color};"></div></div>
            <span class="bar-amount">¥${val.toLocaleString()}</span>
          </div>
        `,
    )
    .join("");

  // Weekly chart
  const weekData = [0, 0, 0, 0, 0];
  monthRecords.forEach((r) => {
    const day = new Date(r.date + "T00:00:00").getDate();
    const weekIdx = Math.min(4, Math.floor((day - 1) / 7));
    weekData[weekIdx] += r.totalCost || 0;
  });
  const weekMax = Math.max(1, ...weekData);
  const weekColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  document.getElementById("weeklyChart").innerHTML = weekData
    .map(
      (v, i) => `
          <div class="bar-row">
            <span class="bar-label">第${i + 1}週</span>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.round((v / weekMax) * 100)}%;background:${weekColors[i]};"></div></div>
            <span class="bar-amount">¥${v.toLocaleString()}</span>
          </div>
        `,
    )
    .join("");
}

// ========== Cloud Sync ==========

function toggleSyncServer() {} 

function parseSyncToken(token) {
    let id = "", key = "";
    if (!token) return {id, key};
    if (token.startsWith("{")) {
        try {
            const parsed = JSON.parse(token);
            id = parsed.id || "";
            key = parsed.editKey || parsed.key || "";
        } catch(e){}
    } else if (token.includes(":")) {
        const parts = token.split(":");
        id = parts[0];
        key = parts.slice(1).join(":");
    } else if (token.includes("_")) {
        const parts = token.split("_");
        id = parts[0];
        key = parts.slice(1).join("_");
    }
    return {id, key};
}

function copySyncToken() {
  const token = document.getElementById("syncToken").value.trim();
  if (!token) {
    alert("トークンを入力・同期してください");
    return;
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(token).then(() => {
        alert("コピーしました：\n" + token);
    }).catch((e) => prompt("以下のテキストをコピーしてください", token));
  } else {
    prompt("以下のテキストをコピーしてください", token);
  }
}

function saveSyncConfig() {
  const token = document.getElementById("syncToken").value.trim();
  const {id, key} = parseSyncToken(token);
  
  let serverVersion = "v2";
  const rads = document.getElementsByName("syncServer");
  rads.forEach(r => { if(r.checked) serverVersion = r.value; });

  state.syncConfig = {
    id: id || token, // if not parseable cleanly, just store
    editKey: key,
    proxyUrl: document.getElementById("syncProxyUrl").value.trim(),
    serverVersion
  };
  saveState();
  
  const statusEl = document.getElementById("syncStatus");
  statusEl.textContent = "設定を保存しました。";
  statusEl.style.color = "var(--color-primary)";
}

function getSyncEndpoint(idStr = null) {
  const proxyUrl = state.syncConfig.proxyUrl || "https://tools.ainznino.workers.dev";
  const serverVersion = state.syncConfig.serverVersion || "v2";
  const baseUrl = proxyUrl ? proxyUrl.replace(/\/$/, "") : "https://jsonhosting.com";
  
  const path = serverVersion === "v2" ? "/api/v2/data" : "/api/json";
  if (idStr) return `${baseUrl}${path}/${idStr}`;
  return `${baseUrl}${path}`;
}


async function syncUpload() {
  const tokenInput = document.getElementById("syncToken");
  const proxyInput = document.getElementById("syncProxyUrl");
  const tokenStr = tokenInput.value.trim();
  const {id, key: editKey} = parseSyncToken(tokenStr);
  const statusEl = document.getElementById("syncStatus");

  statusEl.textContent = "アップロード中...";
  statusEl.style.color = "var(--color-primary)";

  try {
    const payload = JSON.stringify({
      foods: state.foods,
      records: state.records,
    });

    if (id && editKey) {
      const res = await fetch(getSyncEndpoint(id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Edit-Key": editKey,
        },
        body: payload,
      });
      if (!res.ok) throw new Error("アップロード失敗");
      statusEl.textContent =
        "アップロード完了！ (" + new Date().toLocaleTimeString() + ")";
    } else {
      const res = await fetch(getSyncEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (!res.ok) throw new Error("新規作成失敗");
      const data = await res.json();
      tokenInput.value = `${data.id}:${data.editKey}`;
      
      let serverVersion = "v2";
      const rads = document.getElementsByName("syncServer");
      rads.forEach(r => { if(r.checked) serverVersion = r.value; });
      state.syncConfig = { id: data.id, editKey: data.editKey, proxyUrl: proxyInput.value.trim(), serverVersion };

      saveState();
      statusEl.textContent = "新規作成してアップロードしました！";
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = "エラー: " + err.message;
    statusEl.style.color = "var(--color-danger)";
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
      statusEl.textContent = "Data IDを入力してください";
      statusEl.style.color = "var(--color-danger)";
    }
    return;
  }

  if (!silent) {
    statusEl.textContent = "ダウンロード中...";
    statusEl.style.color = "var(--color-primary)";
  }

  try {
    // キャッシュを防ぐためにタイムスタンプを付与
    const res = await fetch(getSyncEndpoint(id)+`?t=${Date.now()}`);
    if (!res.ok) throw new Error("ダウンロード失敗");
    const data = (await res.json()).content;

    if (data.foods && data.records) {
      isSyncing = true;
      state.foods = data.foods;
      state.records = data.records;
      migrateRecords();
      saveState();
      isSyncing = false;
      renderAll();
      if (!silent) {
        statusEl.textContent =
          "ダウンロードしてデータを復元しました！ (" +
          new Date().toLocaleTimeString() +
          ")";
      }
    } else {
      throw new Error("データ形式が不正です");
    }
  } catch (err) {
    console.error(err);
    if (!silent) {
      statusEl.textContent = "エラー: " + err.message;
      statusEl.style.color = "var(--color-danger)";
    }
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
