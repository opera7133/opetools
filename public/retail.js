// ========== Retail Prices App State ==========
const LOCAL_STORAGE_KEY = "opetools_retail_state";
const TODAY = new Date().toISOString().split("T")[0];

let state = {
  shops: [], // Array of { id, name, logoUrl, memo, lat, lng }
  items: [], // Array of { id, name, category }
  prices: [], // Array of { id, shopId, itemId, price, quantity, unit, normalizedPrice, date, note }
  syncConfig: {
    id: "",
    editKey: "",
    proxyUrl: "https://tools.ainznino.workers.dev",
    serverVersion: "v2",
    autoDownload: false,
  },
};

let activeTab = "compare";
let isSyncing = false;
let detailsChartInstance = null;
let currentDetailsItemId = null;

// Maps
let shopFormMap = null;
let shopFormMarker = null;
let shopsListMap = null;
let shopsListMarkers = [];

// Default Icons for Leaflet to prevent asset load issues
let mapIcon = null;

function initLeafletIcons() {
  if (typeof L !== "undefined") {
    mapIcon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });
  }
}

// ========== Price Normalization Helpers ==========
function calculateNormalizedPrice(price, quantity, unit) {
  if (!price || !quantity || isNaN(price) || isNaN(quantity) || quantity <= 0)
    return 0;
  if (unit === "g" || unit === "ml") {
    return (price / quantity) * 100; // Normalized to 100g or 100ml
  }
  return price / quantity; // Price per 1 unit (e.g. piece, pack)
}

function updateCalculatedPrice() {
  const price = parseFloat(document.getElementById("priceCost").value);
  const quantity = parseFloat(document.getElementById("priceQuantity").value);
  const unit = document.getElementById("priceUnit").value;

  const normalized = calculateNormalizedPrice(price, quantity, unit);
  const feedbackEl = document.getElementById("priceCalcFeedback");
  if (normalized > 0) {
    const unitLabel = unit === "g" || unit === "ml" ? "100" + unit : "1" + unit;
    feedbackEl.textContent = `¥${normalized.toFixed(1).replace(/\.0$/, "")} / ${unitLabel}`;
  } else {
    feedbackEl.textContent = "¥0";
  }
}

function updateEditCalculatedPrice() {
  const price = parseFloat(document.getElementById("editPriceCost").value);
  const quantity = parseFloat(
    document.getElementById("editPriceQuantity").value,
  );
  const unit = document.getElementById("editPriceUnit").value;

  const normalized = calculateNormalizedPrice(price, quantity, unit);
  const feedbackEl = document.getElementById("editPriceCalcFeedback");
  if (normalized > 0) {
    const unitLabel = unit === "g" || unit === "ml" ? "100" + unit : "1" + unit;
    feedbackEl.textContent = `¥${normalized.toFixed(1).replace(/\.0$/, "")} / ${unitLabel}`;
  } else {
    feedbackEl.textContent = "¥0";
  }
}

// ========== State Operations ==========
function loadState() {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (parsed) {
        state.shops = parsed.shops || [];
        state.items = parsed.items || [];
        state.prices = (parsed.prices || []).map((p) => ({
          ...p,
          quantity: p.quantity !== undefined ? p.quantity : 1,
          unit: p.unit || "個",
          normalizedPrice:
            p.normalizedPrice !== undefined ? p.normalizedPrice : p.price,
        }));
        state.syncConfig = {
          ...state.syncConfig,
          ...(parsed.syncConfig || {}),
        };
      }
    } catch (e) {
      console.error("Failed to load local state", e);
    }
  } else {
    injectSampleData();
  }
}

function saveState() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  if (
    !isSyncing &&
    state.syncConfig &&
    state.syncConfig.id &&
    state.syncConfig.editKey
  ) {
    autoSyncUpload();
  }
}

function injectSampleData() {
  state.shops = [
    {
      id: "shop1",
      name: "イオンタウン",
      logoUrl:
        "https://images.unsplash.com/photo-1542838132-92c53300491e?w=100",
      memo: "イオンの大型ショッピングモール。生鮮食品が充実。",
      lat: 35.6812,
      lng: 139.7671,
    },
    {
      id: "shop2",
      name: "道の駅ひろば",
      logoUrl: "",
      memo: "新鮮な地元野菜が安く手に入る場所。",
      lat: 35.6962,
      lng: 139.7752,
    },
  ];
  state.items = [
    { id: "item1", name: "玉ねぎ", category: "野菜" },
    { id: "item2", name: "豚細切れ肉", category: "肉類" },
    { id: "item3", name: "牛乳", category: "乳製品" },
  ];
  state.prices = [
    {
      id: "p1",
      shopId: "shop1",
      itemId: "item1",
      price: 198,
      quantity: 3,
      unit: "個",
      normalizedPrice: 66,
      date: "2026-05-20",
      note: "3個袋入り",
    },
    {
      id: "p2",
      shopId: "shop2",
      itemId: "item1",
      price: 150,
      quantity: 4,
      unit: "個",
      normalizedPrice: 37.5,
      date: "2026-05-22",
      note: "直売所価格、大玉4個",
    },
    {
      id: "p3",
      shopId: "shop1",
      itemId: "item2",
      price: 512,
      quantity: 400,
      unit: "g",
      normalizedPrice: 128,
      date: "2026-05-21",
      note: "100g換算で128円",
    },
    {
      id: "p4",
      shopId: "shop2",
      itemId: "item2",
      price: 370,
      quantity: 250,
      unit: "g",
      normalizedPrice: 148,
      date: "2026-05-23",
      note: "100g換算で148円",
    },
    {
      id: "p5",
      shopId: "shop1",
      itemId: "item3",
      price: 218,
      quantity: 1,
      unit: "パック",
      normalizedPrice: 218,
      date: "2026-05-24",
      note: "1Lパック",
    },
  ];
  saveState();
}

// ========== Navigation ==========
function switchTab(tabId, btn) {
  activeTab = tabId;
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelectorAll(".tab-panel")
    .forEach((p) => p.classList.remove("active"));

  if (btn) {
    btn.classList.add("active");
  } else {
    const activeBtn = document.getElementById(`tab-${tabId}`);
    if (activeBtn) activeBtn.classList.add("active");
  }

  const panel = document.getElementById(`panel-${tabId}`);
  if (panel) panel.classList.add("active");

  if (tabId === "shops") {
    setTimeout(initShopsListMap, 100);
  }
}

// ========== Add/Edit Shops ==========
function openAddShopModal() {
  document.getElementById("shopForm").reset();
  document.getElementById("shopId").value = "";
  document.getElementById("modalShopTitle").textContent = "店舗を追加";
  document.getElementById("shopModal").classList.add("open");
  setTimeout(initShopFormMap, 150);
}

function closeShopModal() {
  document.getElementById("shopModal").classList.remove("open");
}

function initShopFormMap() {
  if (typeof L === "undefined") return;
  const container = document.getElementById("form-map");
  if (!container) return;

  if (!shopFormMap) {
    shopFormMap = L.map("form-map").setView([35.6812, 139.7671], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(shopFormMap);

    shopFormMap.on("click", (e) => {
      setFormCoordinates(e.latlng.lat, e.latlng.lng);
    });
  } else {
    shopFormMap.invalidateSize();
  }

  const lat = parseFloat(document.getElementById("shopLat").value);
  const lng = parseFloat(document.getElementById("shopLng").value);
  if (!isNaN(lat) && !isNaN(lng)) {
    const latlng = [lat, lng];
    shopFormMap.setView(latlng, 15);
    if (shopFormMarker) {
      shopFormMarker.setLatLng(latlng);
    } else {
      shopFormMarker = L.marker(latlng, { icon: mapIcon }).addTo(shopFormMap);
    }
  } else {
    if (shopFormMarker) {
      shopFormMap.removeLayer(shopFormMarker);
      shopFormMarker = null;
    }
  }
}

function setFormCoordinates(lat, lng) {
  document.getElementById("shopLat").value = lat.toFixed(6);
  document.getElementById("shopLng").value = lng.toFixed(6);

  const latlng = [lat, lng];
  if (shopFormMarker) {
    shopFormMarker.setLatLng(latlng);
  } else {
    shopFormMarker = L.marker(latlng, { icon: mapIcon }).addTo(shopFormMap);
  }
}

async function searchShopAddress() {
  const query = document.getElementById("shopAddressQuery").value.trim();
  if (!query) return;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
    );
    if (!res.ok) throw new Error("Search failed");
    const data = await res.json();
    if (data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      shopFormMap.setView([lat, lng], 15);
      setFormCoordinates(lat, lng);
    } else {
      alert("見つかりませんでした。より詳細な住所を入力してください。");
    }
  } catch (e) {
    console.error(e);
    alert("住所検索中にエラーが発生しました。");
  }
}

function saveShop() {
  const idInput = document.getElementById("shopId").value;
  const name = document.getElementById("shopName").value.trim();
  const logoUrl = document.getElementById("shopLogoUrl").value.trim();
  const memo = document.getElementById("shopMemo").value.trim();
  const latVal = parseFloat(document.getElementById("shopLat").value);
  const lngVal = parseFloat(document.getElementById("shopLng").value);

  if (!name) {
    alert("店名を入力してください。");
    return;
  }

  const lat = isNaN(latVal) ? null : latVal;
  const lng = isNaN(lngVal) ? null : lngVal;

  if (idInput) {
    const shop = state.shops.find((s) => s.id === idInput);
    if (shop) {
      shop.name = name;
      shop.logoUrl = logoUrl;
      shop.memo = memo;
      shop.lat = lat;
      shop.lng = lng;
    }
  } else {
    const newShop = {
      id: "shop_" + genId(),
      name,
      logoUrl,
      memo,
      lat,
      lng,
    };
    state.shops.push(newShop);
  }

  saveState();
  closeShopModal();
  renderAll();
}

function openEditShop(id) {
  const shop = state.shops.find((s) => s.id === id);
  if (!shop) return;

  document.getElementById("shopId").value = shop.id;
  document.getElementById("shopName").value = shop.name;
  document.getElementById("shopLogoUrl").value = shop.logoUrl || "";
  document.getElementById("shopMemo").value = shop.memo || "";
  document.getElementById("shopLat").value = shop.lat !== null ? shop.lat : "";
  document.getElementById("shopLng").value = shop.lng !== null ? shop.lng : "";
  document.getElementById("shopAddressQuery").value = "";

  document.getElementById("modalShopTitle").textContent = "店舗情報を編集";
  document.getElementById("shopModal").classList.add("open");
  setTimeout(initShopFormMap, 150);
}

function deleteShop(id) {
  if (
    !confirm(
      "本当にこの店舗を削除しますか？\n※関連する価格履歴もすべて削除されます。",
    )
  )
    return;

  state.shops = state.shops.filter((s) => s.id !== id);
  state.prices = state.prices.filter((p) => p.shopId !== id);

  saveState();
  renderAll();
}

function initShopsListMap() {
  if (typeof L === "undefined") return;
  const container = document.getElementById("list-map");
  if (!container) return;

  if (!shopsListMap) {
    shopsListMap = L.map("list-map").setView([35.6812, 139.7671], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(shopsListMap);
  } else {
    shopsListMap.invalidateSize();
  }

  shopsListMarkers.forEach((m) => shopsListMap.removeLayer(m));
  shopsListMarkers = [];

  const bounds = [];
  state.shops.forEach((shop) => {
    if (
      shop.lat !== null &&
      shop.lng !== null &&
      !isNaN(shop.lat) &&
      !isNaN(shop.lng)
    ) {
      const latlng = [shop.lat, shop.lng];
      const popupContent = `
        <div style="font-family:sans-serif;">
          <b style="font-size:0.9rem;">${esc(shop.name)}</b>
          ${shop.memo ? `<p style="font-size:0.75rem;margin:4px 0 0;color:#555;">${esc(shop.memo)}</p>` : ""}
        </div>
      `;
      const marker = L.marker(latlng, { icon: mapIcon })
        .addTo(shopsListMap)
        .bindPopup(popupContent);

      shopsListMarkers.push(marker);
      bounds.push(latlng);
    }
  });

  if (bounds.length > 0) {
    shopsListMap.fitBounds(bounds, { padding: [40, 40] });
  } else {
    shopsListMap.setView([35.6812, 139.7671], 11);
  }
}

// ========== Add/Edit Food Items ==========
function openAddItemModal() {
  document.getElementById("itemForm").reset();
  document.getElementById("itemId").value = "";
  document.getElementById("modalItemTitle").textContent = "🥬 食材を新規登録";
  document.getElementById("itemModal").classList.add("open");
}

function openEditItem(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;

  document.getElementById("itemId").value = item.id;
  document.getElementById("itemName").value = item.name;
  document.getElementById("itemCategory").value = item.category || "その他";

  document.getElementById("modalItemTitle").textContent = "🥬 食材を編集";
  document.getElementById("itemModal").classList.add("open");
}

function closeItemModal() {
  document.getElementById("itemModal").classList.remove("open");
}

function saveItem() {
  const idInput = document.getElementById("itemId").value;
  const name = document.getElementById("itemName").value.trim();
  const category =
    document.getElementById("itemCategory").value.trim() || "その他";

  if (!name) {
    alert("食材名を入力してください。");
    return;
  }

  if (idInput) {
    const item = state.items.find((i) => i.id === idInput);
    if (item) {
      item.name = name;
      item.category = category;
    }
  } else {
    // Check duplicate
    if (state.items.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      alert("この食材は既に登録されています。");
      return;
    }
    const newItem = {
      id: "item_" + genId(),
      name,
      category,
    };
    state.items.push(newItem);
  }

  saveState();
  closeItemModal();
  renderAll();
}

function deleteItem(id) {
  if (
    !confirm(
      "本当にこの食材を削除しますか？\n※関連する価格データもすべて削除されます。",
    )
  )
    return;

  state.items = state.items.filter((i) => i.id !== id);
  state.prices = state.prices.filter((p) => p.itemId !== id);

  saveState();
  renderAll();
}

// ========== Price Registry CRUD ==========
function submitPrice() {
  const itemId = document.getElementById("priceItemId").value;
  const shopId = document.getElementById("priceShopId").value;
  const priceVal = parseInt(document.getElementById("priceCost").value);
  const quantityVal = parseFloat(
    document.getElementById("priceQuantity").value,
  );
  const unitVal = document.getElementById("priceUnit").value;
  const date = document.getElementById("priceDate").value;
  const note = document.getElementById("priceNote").value.trim();

  if (!itemId) {
    alert("食材を選択してください。");
    return;
  }
  if (!shopId) {
    alert("店舗を選択してください。");
    return;
  }
  if (isNaN(priceVal) || priceVal <= 0) {
    alert("正しい価格を入力してください。");
    return;
  }
  if (isNaN(quantityVal) || quantityVal <= 0) {
    alert("正しい購入数量を入力してください。");
    return;
  }
  if (!date) {
    alert("日付を入力してください。");
    return;
  }

  const normalized = calculateNormalizedPrice(priceVal, quantityVal, unitVal);

  const newPrice = {
    id: "price_" + genId(),
    itemId,
    shopId,
    price: priceVal,
    quantity: quantityVal,
    unit: unitVal,
    normalizedPrice: normalized,
    date,
    note,
  };

  state.prices.push(newPrice);
  saveState();

  // Clear input
  document.getElementById("priceCost").value = "";
  document.getElementById("priceQuantity").value = "1";
  document.getElementById("priceUnit").value = "個";
  document.getElementById("priceNote").value = "";
  document.getElementById("priceCalcFeedback").textContent = "¥0";

  renderAll();

  const statusEl = document.getElementById("priceRegisterStatus");
  statusEl.textContent = "価格を登録しました。";
  statusEl.style.color = "var(--color-primary)";
  setTimeout(() => {
    statusEl.textContent = "";
  }, 2500);
}

function openEditPrice(id) {
  const p = state.prices.find((x) => x.id === id);
  if (!p) return;

  document.getElementById("editPriceId").value = p.id;

  const itemSel = document.getElementById("editPriceItemId");
  itemSel.innerHTML = state.items
    .map((i) => `<option value="${i.id}">${esc(i.name)}</option>`)
    .join("");
  itemSel.value = p.itemId;

  const shopSel = document.getElementById("editPriceShopId");
  shopSel.innerHTML = state.shops
    .map((s) => `<option value="${s.id}">${esc(s.name)}</option>`)
    .join("");
  shopSel.value = p.shopId;

  document.getElementById("editPriceCost").value = p.price;
  document.getElementById("editPriceQuantity").value =
    p.quantity !== undefined ? p.quantity : 1;
  document.getElementById("editPriceUnit").value = p.unit || "個";
  document.getElementById("editPriceDate").value = p.date;
  document.getElementById("editPriceNote").value = p.note || "";

  updateEditCalculatedPrice();

  document.getElementById("priceEditModal").classList.add("open");
}

function closePriceEditModal() {
  document.getElementById("priceEditModal").classList.remove("open");
}

function savePriceEdit() {
  const id = document.getElementById("editPriceId").value;
  const p = state.prices.find((x) => x.id === id);
  if (!p) return;

  const itemId = document.getElementById("editPriceItemId").value;
  const shopId = document.getElementById("editPriceShopId").value;
  const priceCost = parseInt(document.getElementById("editPriceCost").value);
  const quantity = parseFloat(
    document.getElementById("editPriceQuantity").value,
  );
  const unit = document.getElementById("editPriceUnit").value;
  const date = document.getElementById("editPriceDate").value;
  const note = document.getElementById("editPriceNote").value.trim();

  if (
    !itemId ||
    !shopId ||
    isNaN(priceCost) ||
    priceCost <= 0 ||
    isNaN(quantity) ||
    quantity <= 0 ||
    !date
  ) {
    alert("入力内容を確認してください。");
    return;
  }

  p.itemId = itemId;
  p.shopId = shopId;
  p.price = priceCost;
  p.quantity = quantity;
  p.unit = unit;
  p.normalizedPrice = calculateNormalizedPrice(priceCost, quantity, unit);
  p.date = date;
  p.note = note;

  saveState();
  closePriceEditModal();
  renderAll();

  if (currentDetailsItemId) {
    openItemDetails(currentDetailsItemId);
  }
}

function deletePrice(id) {
  if (!confirm("この価格レコードを削除しますか？")) return;
  state.prices = state.prices.filter((p) => p.id !== id);
  saveState();
  renderAll();

  if (currentDetailsItemId) {
    openItemDetails(currentDetailsItemId);
  }
}

// ========== Render UI Elements ==========
function renderAll() {
  renderShops();
  renderItems();
  renderRecentPrices();
}

function renderShops() {
  const priceShopSelect = document.getElementById("priceShopId");
  const savedShopId = priceShopSelect.value;
  priceShopSelect.innerHTML =
    '<option value="">-- 店舗を選択 --</option>' +
    state.shops
      .map((s) => `<option value="${s.id}">${esc(s.name)}</option>`)
      .join("");
  if (savedShopId && state.shops.some((s) => s.id === savedShopId)) {
    priceShopSelect.value = savedShopId;
  }

  const listContainer = document.getElementById("shopsList");
  if (state.shops.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏪</div>
        <p>店舗が登録されていません。「店舗を追加」ボタンから登録してください。</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = state.shops
    .map((shop) => {
      const logoHtml = shop.logoUrl
        ? `<img src="${esc(shop.logoUrl)}" class="shop-logo-img" alt="${esc(shop.name)}" onerror="this.outerHTML='<span class=\\'shop-logo-fallback\\'>🏪</span>'" />`
        : `<span class="shop-logo-fallback">🏪</span>`;

      const locationString =
        shop.lat !== null && shop.lng !== null
          ? `<span style="color:#10b981;font-weight:600;">📍 地図設定済</span>`
          : `<span style="color:var(--color-text-muted);">📍 位置未設定</span>`;

      return `
      <div class="shop-card">
        <div class="shop-logo-container">${logoHtml}</div>
        <div class="shop-info">
          <h3 class="shop-name">${esc(shop.name)}</h3>
          <p class="shop-memo">${esc(shop.memo || "メモなし")}</p>
          <div style="font-size:0.72rem;margin-top:6px;display:flex;justify-content:space-between;align-items:center;">
            ${locationString}
            <div style="display:flex;gap:4px;">
              <button class="btn-icon" title="編集" onclick="openEditShop('${shop.id}')">✎</button>
              <button class="btn-icon danger" title="削除" onclick="deleteShop('${shop.id}')">🗑</button>
            </div>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

function renderItems() {
  const priceItemSelect = document.getElementById("priceItemId");
  const savedItemId = priceItemSelect.value;
  priceItemSelect.innerHTML =
    '<option value="">-- 食材を選択 --</option>' +
    state.items
      .map((i) => `<option value="${i.id}">${esc(i.name)}</option>`)
      .join("");
  if (savedItemId && state.items.some((i) => i.id === savedItemId)) {
    priceItemSelect.value = savedItemId;
  }

  const query = document
    .getElementById("itemSearch")
    .value.trim()
    .toLowerCase();
  const categoryFilter = document.getElementById("categoryFilter").value;
  const gridContainer = document.getElementById("itemsGrid");

  let filtered = state.items;
  if (query) {
    filtered = filtered.filter((i) => i.name.toLowerCase().includes(query));
  }
  if (categoryFilter) {
    filtered = filtered.filter((i) => i.category === categoryFilter);
  }

  const categoriesSet = new Set(
    state.items.map((i) => i.category).filter(Boolean),
  );
  const savedCatFilter = document.getElementById("categoryFilter").value;
  document.getElementById("categoryFilter").innerHTML =
    '<option value="">すべてのカテゴリ</option>' +
    Array.from(categoriesSet)
      .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
      .join("");
  document.getElementById("categoryFilter").value = savedCatFilter;

  if (filtered.length === 0) {
    gridContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">🥬</div>
        <p>${state.items.length === 0 ? "比較する食材がありません。「食材を追加」ボタンから登録してください。" : "検索条件に合う食材が見つかりませんでした。"}</p>
      </div>
    `;
    return;
  }

  gridContainer.innerHTML = filtered
    .map((item) => {
      const itemPrices = state.prices.filter((p) => p.itemId === item.id);

      let lowestPriceHtml = "";
      let avgPriceHtml = "";
      let lowestVal = Infinity;
      let mainUnit = "個";

      if (itemPrices.length > 0) {
        const normalizedPricesVals = itemPrices.map((p) => p.normalizedPrice);
        lowestVal = Math.min(...normalizedPricesVals);
        const lowestRecord = itemPrices.find(
          (p) => p.normalizedPrice === lowestVal,
        );
        const shop = state.shops.find((s) => s.id === lowestRecord.shopId);

        mainUnit = lowestRecord.unit || "個";
        const unitLabel =
          mainUnit === "g" || mainUnit === "ml"
            ? "100" + mainUnit
            : "1" + mainUnit;

        lowestPriceHtml = `<span style="font-weight:800;color:#10b981;">¥${lowestVal.toFixed(1).replace(/\.0$/, "")}</span> <span style="font-size:0.72rem;color:var(--color-text-muted);font-weight:normal;">/${unitLabel} (${esc(shop ? shop.name : "不明")})</span>`;

        const sum = normalizedPricesVals.reduce((a, b) => a + b, 0);
        const avgVal = sum / itemPrices.length;
        avgPriceHtml = `¥${Math.round(avgVal)} <span style="font-size:0.72rem;color:var(--color-text-muted);font-weight:normal;">/${unitLabel}</span>`;
      } else {
        lowestPriceHtml = `<span style="color:var(--color-text-muted);font-weight:normal;font-size:0.8rem;">記録なし</span>`;
        avgPriceHtml = `<span style="color:var(--color-text-muted);font-weight:normal;font-size:0.8rem;">記録なし</span>`;
      }

      const shopPricesRows = state.shops
        .map((shop) => {
          const shopItemPrices = itemPrices.filter((p) => p.shopId === shop.id);
          if (shopItemPrices.length === 0) {
            return `
          <div class="shop-price-row">
            <span class="shop-price-name">${esc(shop.name)}</span>
            <span class="shop-price-val" style="color:var(--color-text-muted);font-weight:normal;">-</span>
          </div>
        `;
          }

          shopItemPrices.sort((a, b) => b.date.localeCompare(a.date));
          const latest = shopItemPrices[0];
          const isLowest = latest.normalizedPrice === lowestVal;
          const latestUnitLabel =
            latest.unit === "g" || latest.unit === "ml"
              ? "100" + latest.unit
              : "1" + latest.unit;

          return `
        <div class="shop-price-row">
          <span class="shop-price-name">${esc(shop.name)}</span>
          <span class="shop-price-val ${isLowest ? "is-lowest" : ""}">
            ¥${latest.normalizedPrice.toFixed(1).replace(/\.0$/, "")}/${latestUnitLabel}
            <span style="font-size:0.65rem;color:var(--color-text-muted);font-weight:normal;margin-left:2px;">(¥${latest.price}/${latest.quantity}${latest.unit})</span>
          </span>
        </div>
      `;
        })
        .join("");

      return `
      <div class="item-card">
        <div class="item-header">
          <h3 class="item-name">${esc(item.name)}</h3>
          <span class="item-category">${esc(item.category)}</span>
        </div>
        <div class="stats-row">
          <div class="stat-box">
            <span class="lbl">底値 (最安)</span>
            <span class="val lowest">${lowestPriceHtml}</span>
          </div>
          <div class="stat-box">
            <span class="lbl">平均単価</span>
            <span class="val">${avgPriceHtml}</span>
          </div>
        </div>

        <div class="shop-prices-list">
          <div style="font-size:0.72rem;font-weight:700;color:var(--color-text-muted);margin-bottom:4px;border-bottom:1px solid #f1f5f9;padding-bottom:2px;">最新の価格</div>
          ${shopPricesRows || `<div style="font-size:0.75rem;color:var(--color-text-muted);padding:8px 0;text-align:center;">店舗が登録されていません</div>`}
        </div>

        <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="openItemDetails('${item.id}')">
            📊 履歴・グラフ
          </button>
          <button class="btn-icon" title="編集" onclick="openEditItem('${item.id}')">✎</button>
          <button class="btn-icon danger" title="削除" onclick="deleteItem('${item.id}')">🗑</button>
        </div>
      </div>
    `;
    })
    .join("");
}

function renderRecentPrices() {
  const container = document.getElementById("recentPricesList");
  if (state.prices.length === 0) {
    container.innerHTML = `<div style="font-size:0.85rem;color:var(--color-text-muted);text-align:center;padding:12px 0;">まだ価格データが登録されていません</div>`;
    return;
  }

  const sorted = [...state.prices]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 10);

  container.innerHTML = `
    <table class="price-table">
      <thead>
        <tr>
          <th>日付</th>
          <th>食材</th>
          <th>単価</th>
          <th>パック価格</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${sorted
          .map((p) => {
            const item = state.items.find((i) => i.id === p.itemId);
            const shop = state.shops.find((s) => s.id === p.shopId);
            const unitLabel =
              p.unit === "g" || p.unit === "ml" ? "100" + p.unit : "1" + p.unit;
            return `
            <tr>
              <td>${esc(p.date.substring(5))}</td>
              <td>
                <b>${esc(item ? item.name : "不明")}</b><br>
                <span style="font-size:0.7rem;color:var(--color-text-muted);">${esc(shop ? shop.name : "不明")}</span>
              </td>
              <td style="color:var(--color-primary);font-weight:700;">
                ¥${p.normalizedPrice.toFixed(1).replace(/\.0$/, "")}/${unitLabel}
              </td>
              <td style="font-size:0.75rem;color:var(--color-text-muted);">
                ¥${p.price} <span style="font-size:0.65rem;">(${p.quantity}${p.unit})</span>
              </td>
              <td>
                <div style="display:flex;gap:2px;">
                  <button class="btn-icon" style="padding:2px;" title="編集" onclick="openEditPrice('${p.id}')">✎</button>
                  <button class="btn-icon danger" style="padding:2px;" title="削除" onclick="deletePrice('${p.id}')">🗑</button>
                </div>
              </td>
            </tr>
          `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

// ========== Detail Modal & Charts ==========
function openItemDetails(itemId) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;

  currentDetailsItemId = itemId;
  document.getElementById("modalDetailsTitle").textContent =
    `🥬 ${esc(item.name)} の価格履歴`;

  const itemPrices = state.prices
    .filter((p) => p.itemId === itemId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const listContainer = document.getElementById("detailsPricesList");
  if (itemPrices.length === 0) {
    listContainer.innerHTML = `<div style="text-align:center;padding:16px 0;color:var(--color-text-muted);">まだこの食材の価格データはありません</div>`;
  } else {
    listContainer.innerHTML = `
      <table class="price-table">
        <thead>
          <tr>
            <th>日付</th>
            <th>店舗</th>
            <th>比較単価</th>
            <th>実際価格</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${itemPrices
            .map((p) => {
              const shop = state.shops.find((s) => s.id === p.shopId);
              const unitLabel =
                p.unit === "g" || p.unit === "ml"
                  ? "100" + p.unit
                  : "1" + p.unit;
              return `
              <tr>
                <td>${esc(p.date)}</td>
                <td>
                  <b>${esc(shop ? shop.name : "不明")}</b>
                  ${p.note ? `<br><span style="font-size:0.7rem;color:var(--color-text-muted);">${esc(p.note)}</span>` : ""}
                </td>
                <td style="color:var(--color-primary);font-weight:700;">
                  ¥${p.normalizedPrice.toFixed(1).replace(/\.0$/, "")}/${unitLabel}
                </td>
                <td style="font-size:0.75rem;color:var(--color-text-muted);">
                  ¥${p.price} <span style="font-size:0.65rem;">(${p.quantity}${p.unit})</span>
                </td>
                <td>
                  <div style="display:flex;gap:2px;">
                    <button class="btn-icon" style="padding:2px;" title="編集" onclick="openEditPrice('${p.id}')">✎</button>
                    <button class="btn-icon danger" style="padding:2px;" title="削除" onclick="deletePrice('${p.id}')">🗑</button>
                  </div>
                </td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  document.getElementById("itemDetailsModal").classList.add("open");

  setTimeout(() => {
    renderPriceTrendChart(itemId);
  }, 100);
}

function closeItemDetailsModal() {
  document.getElementById("itemDetailsModal").classList.remove("open");
  currentDetailsItemId = null;
  if (detailsChartInstance) {
    detailsChartInstance.destroy();
    detailsChartInstance = null;
  }
}

const COLORS_PALETTE = [
  "#4f46e5",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];
function getRandomColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % COLORS_PALETTE.length;
  return COLORS_PALETTE[idx];
}

function renderPriceTrendChart(itemId) {
  if (typeof Chart === "undefined") return;
  const container = document.getElementById("detailsChartContainer");
  if (!container) return;

  if (detailsChartInstance) {
    detailsChartInstance.destroy();
    detailsChartInstance = null;
  }

  const itemPrices = state.prices.filter((p) => p.itemId === itemId);
  if (itemPrices.length === 0) {
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-muted);font-size:0.85rem;">データ不足のためチャートを表示できません</div>`;
    return;
  }

  container.innerHTML = `<canvas id="detailsChart" style="width:100%;height:100%;"></canvas>`;

  const shopIds = [...new Set(itemPrices.map((p) => p.shopId))];
  const uniqueDates = [...new Set(itemPrices.map((p) => p.date))].sort();

  const datasets = shopIds.map((sid) => {
    const shop = state.shops.find((s) => s.id === sid);
    const shopPrices = itemPrices
      .filter((p) => p.shopId === sid)
      .sort((a, b) => a.date.localeCompare(b.date));

    const dataPoints = uniqueDates.map((date) => {
      const p = shopPrices.find((sp) => sp.date === date);
      return p ? p.normalizedPrice : null;
    });

    const color = getRandomColor(sid);
    return {
      label: shop ? shop.name : "不明な店舗",
      data: dataPoints,
      borderColor: color,
      backgroundColor: color + "1a",
      borderWidth: 2.5,
      pointBackgroundColor: color,
      pointRadius: 4,
      tension: 0.15,
      spanGaps: true,
    };
  });

  const ctx = document.getElementById("detailsChart").getContext("2d");
  detailsChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: uniqueDates.map((d) => d.substring(5)),
      datasets: datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            font: { family: "sans-serif", size: 11, weight: "600" },
          },
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          titleFont: { size: 11 },
          bodyFont: { size: 12 },
          callbacks: {
            title: function (context) {
              const idx = context[0].dataIndex;
              return uniqueDates[idx];
            },
            label: function (context) {
              return ` ${context.dataset.label}: ¥${context.parsed.y.toFixed(1).replace(/\.0$/, "")}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 } },
        },
        y: {
          beginAtZero: false,
          grid: { color: "#f1f5f9" },
          ticks: {
            font: { size: 10 },
            callback: function (value) {
              return "¥" + value;
            },
          },
        },
      },
    },
  });
}

// ========== Cloud Sync Setup ==========
function toggleSyncServer() {}

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

function copySyncToken() {
  const token = document.getElementById("syncToken").value.trim();
  if (!token) {
    alert("トークンを入力または作成して、同期させてください");
    return;
  }
  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(token)
      .then(() => alert("コピーしました：\n" + token))
      .catch(() => prompt("以下のトークンをコピーしてください:", token));
  } else {
    prompt("以下のトークンをコピーしてください:", token);
  }
}

function saveSyncConfig() {
  const token = document.getElementById("syncToken").value.trim();
  const { id, key } = parseSyncToken(token);

  let serverVersion = "v2";
  const rads = document.getElementsByName("syncServer");
  rads.forEach((r) => {
    if (r.checked) serverVersion = r.value;
  });

  state.syncConfig = {
    id: id || token,
    editKey: key,
    proxyUrl: document.getElementById("syncProxyUrl").value.trim(),
    serverVersion,
    autoDownload: document.getElementById("syncAutoDL").checked,
  };

  saveState();

  const statusEl = document.getElementById("syncStatus");
  statusEl.textContent = "同期設定を保存しました。";
  statusEl.style.color = "var(--color-primary)";
}

function getSyncEndpoint(idStr = null) {
  const proxyUrl =
    state.syncConfig.proxyUrl || "https://tools.ainznino.workers.dev";
  const serverVersion = state.syncConfig.serverVersion || "v2";
  const baseUrl = proxyUrl
    ? proxyUrl.replace(/\/$/, "")
    : "https://jsonhosting.com";

  const path = serverVersion === "v2" ? "/api/v2/data" : "/api/json";
  if (idStr) return `${baseUrl}${path}/${idStr}`;
  return `${baseUrl}${path}`;
}

async function syncUpload() {
  const tokenInput = document.getElementById("syncToken");
  const proxyInput = document.getElementById("syncProxyUrl");
  const tokenStr = tokenInput.value.trim();
  const { id, key: editKey } = parseSyncToken(tokenStr);
  const statusEl = document.getElementById("syncStatus");

  statusEl.textContent = "データをアップロード中...";
  statusEl.style.color = "var(--color-primary)";

  try {
    const payload = JSON.stringify({
      shops: state.shops,
      items: state.items,
      prices: state.prices,
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
      if (!res.ok) throw new Error("アップロードに失敗しました");
      statusEl.textContent =
        "同期完了！アップロードしました (" +
        new Date().toLocaleTimeString() +
        ")";
    } else {
      const res = await fetch(getSyncEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (!res.ok) throw new Error("新規作成に失敗しました");
      const data = await res.json();
      tokenInput.value = `${data.id}:${data.editKey}`;

      let serverVersion = "v2";
      const rads = document.getElementsByName("syncServer");
      rads.forEach((r) => {
        if (r.checked) serverVersion = r.value;
      });

      state.syncConfig = {
        id: data.id,
        editKey: data.editKey,
        proxyUrl: proxyInput.value.trim(),
        serverVersion,
        autoDownload: document.getElementById("syncAutoDL").checked,
      };

      saveState();
      statusEl.textContent =
        "新規の同期トークンを作成し、データをアップロードしました！";
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
      statusEl.textContent = "同期 ID/トークンを入力してください";
      statusEl.style.color = "var(--color-danger)";
    }
    return;
  }

  if (!silent) {
    statusEl.textContent = "データをダウンロード中...";
    statusEl.style.color = "var(--color-primary)";
  }

  try {
    const res = await fetch(getSyncEndpoint(id) + `?t=${Date.now()}`);
    if (!res.ok) throw new Error("ダウンロードに失敗しました");
    const responseData = await res.json();
    const data = responseData.content;

    if (data && (data.shops || data.items || data.prices)) {
      isSyncing = true;
      state.shops = data.shops || [];
      state.items = data.items || [];
      state.prices = (data.prices || []).map((p) => ({
        ...p,
        quantity: p.quantity !== undefined ? p.quantity : 1,
        unit: p.unit || "個",
        normalizedPrice:
          p.normalizedPrice !== undefined ? p.normalizedPrice : p.price,
      }));
      saveState();
      isSyncing = false;
      renderAll();
      if (!silent) {
        statusEl.textContent =
          "同期完了！データをダウンロードしました (" +
          new Date().toLocaleTimeString() +
          ")";
      }
    } else {
      throw new Error("データ形式が正しくありません");
    }
  } catch (err) {
    console.error(err);
    if (!silent) {
      statusEl.textContent = "エラー: " + err.message;
      statusEl.style.color = "var(--color-danger)";
    }
  }
}

// ========== Helpers & Init ==========
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(str) {
  return (str || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.addEventListener("load", () => {
  initLeafletIcons();
  loadState();

  document.getElementById("priceDate").value = TODAY;

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

    const serverVer = state.syncConfig.serverVersion || "v2";
    const rads = document.getElementsByName("syncServer");
    rads.forEach((r) => {
      r.checked = r.value === serverVer;
    });
  }

  renderAll();

  if (
    state.syncConfig &&
    state.syncConfig.id &&
    state.syncConfig.autoDownload
  ) {
    syncDownload(true);
  }
});

// Auto-upload function called on modifications
let autoUploadTimeout = null;
function autoSyncUpload() {
  if (autoUploadTimeout) clearTimeout(autoUploadTimeout);
  autoUploadTimeout = setTimeout(async () => {
    const id = state.syncConfig.id;
    const editKey = state.syncConfig.editKey;
    if (!id || !editKey) return;

    try {
      const payload = JSON.stringify({
        shops: state.shops,
        items: state.items,
        prices: state.prices,
      });
      await fetch(getSyncEndpoint(id), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Edit-Key": editKey,
        },
        body: payload,
      });
      console.log("Auto-uploaded state successfully");
    } catch (e) {
      console.error("Auto-upload state failed", e);
    }
  }, 3000);
}
