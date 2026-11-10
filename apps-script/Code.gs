// Haseeb Mirza Mess Management - Apps Script backend (one copy per restaurant Sheet)
// Set the password in: Project Settings > Script properties > APP_PASSWORD
const TZ = 'Asia/Dubai';
const REQUIRE_PASSWORD = false;  // password OFF for now. To turn on: set true and add APP_PASSWORD in Script properties
const ss = () => SpreadsheetApp.getActiveSpreadsheet();
const iso = d => Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
const dt = s => new Date(s + 'T00:00:00+04:00');
const pad = (n, w) => String(n).padStart(w, '0');

function tbl(n) {
  const v = ss().getSheetByName(n).getDataRange().getValues(); v.shift();
  return v.filter(r => r[0] !== '').map(r => r.map(c => c instanceof Date ? iso(c) : c));
}
function add(n, a) { ss().getSheetByName(n).appendRow(a); }
function setting(k, v) {
  const s = ss().getSheetByName('Settings'), d = s.getRange('A2:B40').getValues();
  for (let i = 0; i < d.length; i++) if (d[i][0] === k) { if (v === undefined) return d[i][1]; s.getRange(i + 2, 2).setValue(v); return; }
}
const nextNo = (k, p) => { const n = Number(setting(k)); setting(k, n + 1); return p + pad(n, 4); };
const rowId = (n, p) => p + pad(tbl(n).length + 1, 4);
function endOf(s) {
  const [y, m, d] = s.split('-').map(Number), e = new Date(Date.UTC(y, m, d));
  if (e.getUTCDate() !== d) e.setUTCDate(0);
  e.setUTCDate(e.getUTCDate() - 1); return e.toISOString().slice(0, 10);
}
function wa(m) { m = String(m).replace(/\D/g, ''); return m.startsWith('0') ? '971' + m.slice(1) : m; }
function log(u, a, e, id, d) { add('AuditLog', [new Date(), u, a, e, id, d || '']); }

function load() {
  const S = {}; ss().getSheetByName('Settings').getRange('A2:B40').getValues().forEach(r => { if (r[0]) S[r[0]] = r[1]; });
  return { settings: S, plans: tbl('MealPlans').filter(r => /^P\d/.test(r[0])), customers: tbl('Customers'),
    subs: tbl('Subscriptions'), pays: tbl('Payments'), adjs: tbl('PaymentAdjustments') };
}
function balance(cid) {
  const c = tbl('Customers').find(r => r[0] === cid); if (!c) throw new Error('Customer not found');
  const ch = c[8] === 'Cancelled' ? 0 : tbl('Subscriptions').filter(s => s[1] === cid && s[9] !== 'Cancelled').reduce((t, s) => t + Number(s[7]), 0);
  const pd = tbl('Payments').filter(p => p[2] === cid).reduce((t, p) => t + Number(p[5]), 0) +
    tbl('PaymentAdjustments').filter(a => a[2] === cid).reduce((t, a) => t + Number(a[4]), 0);
  return ch - pd;
}
function newSub(q, cid) {
  const plan = tbl('MealPlans').find(p => p[0] === q.planId); if (!plan) throw new Error('Plan not found');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.start)) throw new Error('Bad date');
  const price = Number(q.price), paid = Number(q.paid || 0);
  if (!(price > 0)) throw new Error('Price required');
  if (paid < 0 || paid > price + Math.max(0, balance(cid))) throw new Error('Payment is more than the amount due');
  const sid = rowId('Subscriptions', 'S');
  add('Subscriptions', [sid, cid, plan[0], plan[1], q.service, dt(q.start), dt(endOf(q.start)), price, q.type, 'Active', new Date(), 'admin']);
  if (paid > 0) payRow(cid, sid, paid, q.start, q.key);
  return sid;
}
function payRow(cid, sid, amt, date, key) {
  add('Payments', [rowId('Payments', 'PAY'), nextNo('next_receipt_no', 'R'), cid, sid, dt(date), amt, 'Cash', '', new Date(), 'admin', key || '']);
}

const ACT = {
  add(q) {
    const cid = nextNo('next_customer_no', 'C');
    add('Customers', [cid, q.name, "'" + q.mobile, wa(q.mobile), '', q.loc, q.flat, q.map, 'Active', 'No', new Date(), '']);
    newSub(Object.assign({ type: 'New' }, q), cid); log('admin', 'Create customer', 'Customer', cid, q.name);
  },
  renew(q) { const sid = newSub(Object.assign({ type: 'Renewal' }, q), q.cid); log('admin', 'Renew', 'Subscription', sid, q.cid); },
  pay(q) {
    const amt = Number(q.amount); if (!(amt > 0)) throw new Error('Enter an amount');
    if (amt > balance(q.cid) + 0.001) throw new Error('Payment is more than the balance due');
    const subs = tbl('Subscriptions').filter(s => s[1] === q.cid);
    payRow(q.cid, subs.length ? subs[subs.length - 1][0] : '', amt, q.date, q.key); log('admin', 'Payment', 'Customer', q.cid, String(amt));
  },
  reverse(q) {
    if (!q.reason || q.reason.trim().length < 3) throw new Error('A written reason is required');
    const p = tbl('Payments').find(r => r[0] === q.pid); if (!p) throw new Error('Payment not found');
    if (tbl('PaymentAdjustments').some(a => a[1] === q.pid)) throw new Error('Already reversed');
    add('PaymentAdjustments', [rowId('PaymentAdjustments', 'ADJ'), q.pid, p[2], new Date(), -Number(p[5]), q.reason.trim(), new Date(), 'admin', q.key || '']);
    log('admin', 'Reverse payment', 'Payment', q.pid, q.reason);
  },
  status(q) {
    if (!['Active', 'Hold', 'Cancelled'].includes(q.status)) throw new Error('Bad status');
    const s = ss().getSheetByName('Customers'), d = s.getRange('A2:A').getValues().flat(), i = d.indexOf(q.cid);
    if (i < 0) throw new Error('Not found'); s.getRange(i + 2, 9).setValue(q.status); log('admin', 'Status ' + q.status, 'Customer', q.cid);
  },
  wa(q) { add('NotificationLog', [new Date(), q.cid, q.type, q.phone, 'Yes']); }
};

function run(q) {
  const P = PropertiesService.getScriptProperties(), C = CacheService.getScriptCache();
  if (q.a === 'login') {
    if (REQUIRE_PASSWORD) {
      const pw = P.getProperty('APP_PASSWORD');
      if (!pw || q.password !== pw) throw new Error('Wrong password');
    }
    const t = Utilities.getUuid(); C.put('t_' + t, '1', 21600); return { token: t };
  }
  if (!q.token || !C.get('t_' + q.token)) throw new Error('LOGIN');
  if (q.a === 'load') return load();
  const L = LockService.getScriptLock(); L.waitLock(20000);
  try {
    if (q.key && C.get('k_' + q.key)) return load();   // double-submit protection
    if (!ACT[q.a]) throw new Error('Unknown action');
    ACT[q.a](q); if (q.key) C.put('k_' + q.key, '1', 21600);
    return load();
  } finally { L.releaseLock(); }
}
function doPost(e) {
  let r; try { r = run(JSON.parse(e.postData.contents)); } catch (x) { r = { error: String(x.message || x) }; }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return ContentService.createTextOutput('Mess API is running'); }
