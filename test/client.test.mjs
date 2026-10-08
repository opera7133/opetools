import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

function app(kind) {
  const nodes = new Map(); const storage = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', innerHTML: '', checked: false, dataset: {}, style: {}, classList: { add(){}, remove(){} }, querySelectorAll(){ return []; }, addEventListener(){}, appendChild(){}, replaceChildren(){} });
    return nodes.get(id);
  }
  const ctx = vm.createContext({ console, Response, AbortSignal, crypto: webcrypto, URL, queueMicrotask, setTimeout: () => 1, clearTimeout(){}, setInterval(){}, alert(){}, confirm: () => true,
    window: { addEventListener(){} }, navigator: {}, document: { getElementById: node, querySelectorAll: () => [], querySelector: () => ({ value: 'v2', checked: true }), createElement: () => node('created'), addEventListener(){} },
    localStorage: { setItem: (k,v) => storage.set(k,v), getItem: k => storage.get(k) || null },
  });
  if (kind !== 'attendance') vm.runInContext(readFileSync(new URL('../public/tool-sync.js', import.meta.url), 'utf8'), ctx);
  vm.runInContext(readFileSync(new URL(`../public/${kind}.js`, import.meta.url), 'utf8'), ctx);
  vm.runInContext('renderAll = () => {};', ctx);
  if (kind === 'attendance') vm.runInContext('renderNotificationSettings = () => {};', ctx);
  return { ctx, nodes, storage, run: code => vm.runInContext(code, ctx), node };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('downloaded attendance persists across reload and authenticates GET', async () => {
  const a = app('attendance');
  a.run("state.syncConfig = { id: 'u', editKey: 'k', serverVersion: 'v2', proxyUrl: 'https://example.com' };");
  a.ctx.fetch = async (_url, options) => { assert.equal(options.headers['X-Edit-Key'], 'k'); return Response.json({ content: { timetables: {}, records: { '2026-10-08': { 3: { className: '情報', code: '000123', revision: 1 } } } }, revision: 2 }); };
  await a.run('syncDownload(true)');
  assert.equal(JSON.parse(a.storage.get('opetools_attendance_state')).records['2026-10-08'][3].code, '000123');
  a.run('state.records = {}; loadState();'); assert.equal(a.run("state.records['2026-10-08'][3].code"), '000123');
});
test('pending local entries survive a cloud download', async () => {
  const a = app('attendance');
  a.run("state.syncConfig = { id: 'u', editKey: 'k', serverVersion: 'v2' }; state.pendingRecords = { '2026-10-08/3': { datasetId: 'u', date: '2026-10-08', periodId: 3, className: '情報', code: 'local', revision: 1 } };");
  a.ctx.fetch = async () => Response.json({ content: { timetables: {}, records: {} }, revision: 0 });
  await a.run('syncDownload(true)'); assert.equal(a.run("state.records['2026-10-08'][3].code"), 'local');
  assert.equal(a.run("state.pendingRecords['2026-10-08/3'].revision"), 1);
});
test('declining a shared-code correction does not send it', async () => {
  const a = app('attendance'); const calls = [];
  a.ctx.confirm = () => false;
  a.run("state.syncConfig = { id: 'u', editKey: 'k', serverVersion: 'v2' }; state.courseIds = { 情報: 'shared' }; state.pendingRecords = { entry: { datasetId: 'u', date: '2026-10-08', periodId: 3, className: '情報', code: 'local', revision: 0 } };");
  a.ctx.fetch = async (url, options) => { calls.push(options.method || 'GET'); return Response.json({ content: { records: {} }, notifications: [{ course_id: 'shared', date: '2026-10-08', code: 'other', revision: 1 }] }); };
  await a.run('retryAttendanceRecords()'); assert.ok(calls.every(method => method === 'GET')); assert.equal(a.run('state.pendingRecords.entry.paused'), true);
});
test('network errors retain an attendance entry for later retry', async () => {
  const a = app('attendance'); a.ctx.fetch = async () => { throw new Error('offline'); };
  a.run("state.syncConfig = { id: 'u', editKey: 'k', serverVersion: 'v2' }; flushingRecords = true; setAttendanceCode('2026-10-08', 3, '情報', ' 00123 '); flushingRecords = false;");
  await a.run('flushAttendanceRecords()'); assert.equal(a.run("state.pendingRecords['2026-10-08/3'].code"), '00123');
  assert.match(a.node('syncStatus').textContent, /未同期/);
});
test('backups omit credentials and pending transmission data', () => {
  const a = app('attendance'); a.run("state.syncConfig = { id: 'secret-id', editKey: 'secret-key', revision: 1 }; state.pendingRecords = { test: {} };");
  const payload = plain(a.run('attendancePayload(true)')); assert.equal(payload.syncConfig, undefined); assert.equal(payload.pendingRecords, undefined);
});
test('history safely handles quotes, HTML, and regex punctuation', () => {
  const a = app('attendance'); a.node('historySearch').value = '['; a.node('historyFilterQuarter').value = 'all';
  a.run("state.records = { '2026-10-08': { 3: { className: `[O'Reilly <img>]`, code: '0123' } } }; renderHistory();");
  assert.match(a.node('created').innerHTML, /&lt;img&gt;/); assert.ok(!a.node('created').innerHTML.includes('onclick='));
});
test('legacy attendance configs continue to use v1', () => {
  const a = app('attendance'); a.storage.set('opetools_attendance_state', JSON.stringify({ timetables: {}, records: {}, syncConfig: { id: 'old', editKey: 'k' } }));
  a.run('loadState()'); assert.equal(a.run('state.syncConfig.serverVersion'), 'v1'); assert.match(a.run("getSyncEndpoint('old')"), /\/api\/json\/old$/);
});
test('inventory migration preserves current remaining and deletion restores consumed stock', () => {
  const a = app('foods'); a.run("autoSyncUpload = () => {}; state.foods = [{ id: 'f', quantity: 1000, remaining: 700, price: 300, unit: 'g' }]; state.records = [{ id: 'r', ingredients: [{ foodId: 'f', usage: 300, usageType: 'amount' }] }]; initializeInventory();");
  assert.equal(a.run('state.foods[0].inventoryBase'), 1000); a.run("deleteRecord('r')"); assert.equal(a.run('state.foods[0].remaining'), 1000);
});
test('prep deletion refuses to remove an output already consumed', () => {
  const a = app('foods'); a.run("state.foods = [{ id: 'prep', quantity: 2, remaining: 1 }]; state.records = [{ id: 'make', outputFoodId: 'prep' }, { id: 'eat', ingredients: [{ foodId: 'prep', usage: 1 }] }]; deleteRecord('make');");
  assert.equal(a.run('state.records.length'), 2);
});
test('retail comparisons separate units and latest minimum from historical bottom', () => {
  const a = app('retail');
  a.run("state.shops = [{ id:'s',name:'店' }]; state.items = [{ id:'i',name:'米' }]; state.prices = [{itemId:'i',shopId:'s',price:200,quantity:100,unit:'g',normalizedPrice:200,date:'2026-10-08'}, {itemId:'i',shopId:'s',price:1,quantity:1,unit:'個',normalizedPrice:1,date:'2026-10-08'}, {itemId:'i',shopId:'s',price:100,quantity:100,unit:'g',normalizedPrice:100,date:'2026-10-01'}]; renderItems();");
  const html = a.node('itemsGrid').innerHTML; assert.match(html, /比較単位/); assert.match(html, /過去の底値/); assert.match(html, /¥100/); assert.match(html, /¥200/); assert.ok(!html.includes('¥1<'));
});
test('failed retail uploads display an error and keep dirty data', async () => {
  const a = app('retail'); a.run("state.syncConfig = { id:'u', editKey:'k', serverVersion:'v2', proxyUrl:'https://example.com', revision:0 }; state.syncDirty = true;");
  a.ctx.fetch = async () => Response.json({ error: 'conflict' }, { status:409 });
  await a.run('syncUpload(true)'); assert.equal(a.run('state.syncDirty'), true); assert.match(a.node('syncStatus').textContent, /同期失敗/);
});
test('automatic download never discards dirty retail data', async () => {
  const a = app('retail'); a.run("state.syncDirty = true; state.items = [{id:'local'}];"); a.ctx.fetch = async () => { throw new Error('should not fetch'); };
  await a.run('syncDownload(true)'); assert.equal(a.run('state.items[0].id'), 'local'); assert.match(a.node('syncStatus').textContent, /止めました/);
});

function userscript() {
  const values = new Map([['sync_token', 'personal:edit-key'], ['server_version', 'v2']]);
  const calls = [];
  const ctx = vm.createContext({ console, Response, AbortSignal, URL, alert(){}, confirm: () => true, prompt: () => null,
    GM_registerMenuCommand(){}, GM_getValue: (key, fallback) => values.has(key) ? values.get(key) : fallback, GM_setValue: (key,value) => values.set(key,value),
    document: { getElementById: () => null },
    fetch: async (url, options) => { calls.push({ url, options }); return Response.json(options?.method ? { success: true } : { content: { ...sampleAttendance(), courseIds: { '情報': 'shared' } }, revision: 3, notifications: [] }); },
  });
  let source = readFileSync(new URL('../kyomu.user.js', import.meta.url), 'utf8');
  source = source.replace('// ========== Event Interception & Page Init ==========', 'globalThis.hooks = { parsePeriods, uploadToOpetools, uploadTimetableToOpetools };\n// ========== Event Interception & Page Init ==========');
  vm.runInContext(source, ctx);
  return { ctx, calls, values, hooks: ctx.hooks };
}
function sampleAttendance() { return { schemaVersion:2, quarters:{ q3:{name:'後期',startDate:'2026-10-01',endDate:'2027-02-01'} }, periods:[{id:3,name:'3限',startTime:'13:00',endTime:'14:30'}], timetables:{q3:{4:{3:'情報'}}}, exceptions:[], records:{} }; }
test('UserScript parses full-width consecutive periods and rejects unreadable periods', async () => {
  const u = userscript(); assert.deepEqual(plain(u.hooks.parsePeriods('３～４')), [3,4]);
  await assert.rejects(u.hooks.uploadToOpetools('123','2026-10-08','不明','情報'), /時限/);
  assert.ok(!u.calls.some(c => c.options?.method === 'PUT'));
});
test('UserScript authenticates private reads and sends one code update for consecutive periods', async () => {
  const u = userscript(); await u.hooks.uploadToOpetools(' 001234 ','2026-10-08','３～４','情報');
  assert.equal(u.calls[0].options.headers['X-Edit-Key'], 'edit-key');
  assert.match(u.calls[1].url, /\/api\/v2\/attendance\/personal\/records$/);
  const payload = JSON.parse(u.calls[1].options.body); assert.equal(payload.periodId,3); assert.equal(payload.code,'001234'); assert.equal(payload.timetables,undefined);
});
test('UserScript timetable updates carry configuration revision and omit attendance history', async () => {
  const u = userscript(); await u.hooks.uploadTimetableToOpetools({q3:{4:{3:'更新科目'}}}, ['q3']);
  const payload = JSON.parse(u.calls[1].options.body); assert.equal(payload.revision,3); assert.equal(payload.records,undefined); assert.equal(payload.timetables.q3[4][3],'更新科目');
});
test('UserScript skips a shared correction when confirmation is declined', async () => {
  const u = userscript(); u.ctx.confirm = () => false;
  u.ctx.fetch = async (url,options) => { u.calls.push({url,options}); return Response.json({ content:{ ...sampleAttendance(),courseIds:{情報:'shared'} },notifications:[{course_id:'shared',date:'2026-10-08',code:'old',revision:1}] }); };
  await u.hooks.uploadToOpetools('new','2026-10-08','3','情報'); assert.equal(u.calls.length,1);
});
