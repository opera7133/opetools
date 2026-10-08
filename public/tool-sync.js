// Shared cloud synchronization for foods and retail. Each tool has its own token/endpoint.
class OpetoolsSync {
  constructor(kind, getState, persist, apply, render) {
    Object.assign(this, { kind, getState, persist, apply, render });
    this.chain = Promise.resolve();
    this.timer = null;
  }
  status(message, failed = false) {
    const element = document.getElementById('syncStatus');
    if (element) { element.textContent = message; element.style.color = failed ? 'var(--color-danger)' : 'var(--color-primary)'; }
  }
  endpoint(config, id = config.id) {
    const base = (config.proxyUrl || 'https://tools.ainznino.workers.dev').replace(/\/$/, '');
    const path = config.serverVersion === 'v1' ? '/api/json' : this.kind === 'foods' ? '/api/v2/data' : '/api/v2/retail';
    return base + path + (id ? '/' + encodeURIComponent(id) : '');
  }
  config() {
    const old = this.getState().syncConfig;
    const token = document.getElementById('syncToken').value.trim();
    const parsed = parseSyncToken(token);
    const config = { id: parsed.id, editKey: parsed.key, proxyUrl: document.getElementById('syncProxyUrl').value.trim(), serverVersion: document.querySelector('input[name="syncServer"]:checked')?.value || 'v2', autoDownload: document.getElementById('syncAutoDL')?.checked || false };
    if (config.id === old.id && config.proxyUrl === old.proxyUrl && config.serverVersion === (old.serverVersion || 'v2')) config.revision = old.revision;
    return config;
  }
  saveConfig() {
    this.getState().syncConfig = this.config(); this.persist(); this.status('同期設定を保存しました。');
  }
  async request(config, method, payload) {
    const response = await fetch(this.endpoint(config), { method, headers: { 'Content-Type': 'application/json', 'X-Edit-Key': config.editKey || '' }, body: payload ? JSON.stringify(payload) : undefined, signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }
  payload() {
    const s = this.getState();
    return this.kind === 'foods' ? { schemaVersion: 2, foods: s.foods, records: s.records, revision: s.syncConfig.revision } : { schemaVersion: 2, shops: s.shops, items: s.items, prices: s.prices, revision: s.syncConfig.revision };
  }
  autoUpload() {
    const s = this.getState();
    if (!s.syncConfig.id || !s.syncConfig.editKey) return;
    this.status('端末に保存済み・同期待ち');
    clearTimeout(this.timer); this.timer = setTimeout(() => this.upload(true), 1500);
  }
  upload(silent = false, createCopy = false) {
    const task = this.chain.then(() => this.performUpload(silent, createCopy));
    this.chain = task.catch(() => {}); return task;
  }
  async performUpload(silent, createCopy) {
    const s = this.getState();
    if (!silent) s.syncConfig = this.config();
    const config = { ...s.syncConfig };
    const connection = JSON.stringify(s.syncConfig);
    if (createCopy) { config.id = ''; config.editKey = ''; config.serverVersion = 'v2'; }
    if (silent && !config.id) return;
    try {
      if (config.id && config.serverVersion !== 'v1' && config.revision === undefined) throw new Error('既存トークンは先にクラウドから読み込み、現在のデータを確認してください。');
      const change = s.syncChange || 0;
      const payload = this.payload(); if (createCopy) delete payload.revision;
      const data = await this.request(config, config.id ? 'PATCH' : 'POST', payload);
      // Do not attach an in-flight response to another connection selected meanwhile.
      if (JSON.stringify(s.syncConfig) !== connection) { this.status('接続先が変更されたため、保存結果を反映していません。', true); return; }
      s.syncConfig = { ...config, id: config.id || data.id, editKey: config.editKey || data.editKey || data.key, revision: data.revision };
      s.syncDirty = (s.syncChange || 0) !== change;
      this.persist();
      document.getElementById('syncToken').value = `${s.syncConfig.id}:${s.syncConfig.editKey}`;
      if (createCopy) document.querySelector('input[name="syncServer"][value="v2"]').checked = true;
      this.status(s.syncDirty ? '端末に保存済み・追加変更の同期待ち' : 'クラウドに保存済み');
      if (s.syncDirty) this.autoUpload();
    } catch (e) { this.status('同期失敗: ' + e.message + '（端末のデータは残っています）', true); }
  }
  async download(silent = false) {
    const s = this.getState();
    if (s.syncDirty) {
      if (silent) { this.status('未同期の変更があるため、自動ダウンロードを止めました。', true); return; }
      if (!confirm('端末に未同期の変更があります。先にバックアップしてください。クラウドの内容で置き換えますか？')) return;
    }
    if (!silent) s.syncConfig = this.config();
    const config = { ...s.syncConfig }; const change = s.syncChange || 0;
    if (!config.id || !config.editKey) { this.status('同期トークンを入力してください。', true); return; }
    try {
      const data = await this.request(config, 'GET');
      if ((s.syncChange || 0) !== change || s.syncConfig.id !== config.id || s.syncConfig.proxyUrl !== config.proxyUrl) throw new Error('読み込み中に端末が更新されました。もう一度確認してね。');
      const fields = this.kind === 'foods' ? ['foods','records'] : ['shops','items','prices'];
      if (!data.content || fields.some(key => !Array.isArray(data.content[key]))) throw new Error('データ形式が正しくありません。');
      this.apply(data.content); s.syncConfig.revision = data.revision; s.syncDirty = false;
      this.persist(); this.render(); this.status('クラウドから読み込みました。');
    } catch (e) { this.status('読み込み失敗: ' + e.message, true); }
  }
}
function parseSyncToken(token) {
  if (!token) return { id: '', key: '' };
  if (token.startsWith('{')) { try { const t = JSON.parse(token); return { id: t.id || '', key: t.editKey || t.key || '' }; } catch { return { id: '', key: '' }; } }
  const [id, ...rest] = token.split(token.includes(':') ? ':' : '_'); return { id, key: rest.join(token.includes(':') ? ':' : '_') };
}
function copySyncToken() { const token = document.getElementById('syncToken').value.trim(); if (token) navigator.clipboard.writeText(token).catch(() => prompt('このトークンをコピーしてね', token)); }
function toggleSyncServer() {}
function saveSyncConfig() { toolSync.saveConfig(); }
function syncUpload(silent = false) { return toolSync.upload(silent); }
function syncDownload(silent = false) { return toolSync.download(silent); }
function getSyncEndpoint(id = null) { return toolSync.endpoint(state.syncConfig, id); }
function createCloudCopy() { if (confirm('端末の現在のデータから、新しいv2同期トークンを作ります。旧トークンは変更しません。')) return toolSync.upload(false, true); }
