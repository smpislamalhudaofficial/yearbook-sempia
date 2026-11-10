import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const apps = path.join(root, 'apps-script');
const jsDir = path.join(root, 'assets', 'js');
const read = (file) => fs.readFileSync(file, 'utf8');

new Function(read(path.join(apps, 'Code.gs')));
for (const file of ['api.js', 'compression.js', 'app.js', 'admin.js', 'config.js']) new Function(read(path.join(jsDir, file)));

const code = read(path.join(apps, 'Code.gs'));
for (const api of ['doGet', 'doPost', 'dispatchAction_', 'setupProject', 'setupDatabase_', 'adminDashboard_', 'submitProfile_']) {
  assert.match(code, new RegExp(`function\\s+${api}\\s*\\(`), `Missing function ${api}`);
}
assert.match(code, /setXFrameOptionsMode\(HtmlService\.XFrameOptionsMode\.ALLOWALL\)/);
assert.match(code, /window\.top\.postMessage/);
assert.match(code, /FRONTEND_ORIGIN/);
assert.match(code, /MAX_PHOTO_BYTES:\s*2\s*\*\s*1024\s*\*\s*1024/);
assert.match(code, /social_accounts/);
assert.match(code, /access_code/);
assert.match(code, /function getSettingValue_\(/);
assert.match(code, /function ensureDefaultAdminPassword_\(/);
assert.match(code, /ADMIN_PASSWORD", "sempia1234"/);
assert.match(code, /getSettingValue_\("ADMIN_PASSWORD"\)/);
assert.ok(!code.includes('ADMIN_PASSWORD_SHA256'));
assert.ok(!code.includes('ADMIN_SALT'));
assert.ok(!fs.existsSync(path.join(root, 'scripts', 'generate-admin-hash.py')));
assert.match(code, /category === "student" && !base64/);
assert.match(code, /status:\s*"not_submitted"/);
assert.ok(!code.includes('WORKER_SHARED_SECRET'));
assert.ok(!code.includes('ContentService'));
assert.ok(!fs.existsSync(path.join(apps, 'Bridge.html')));
assert.ok(!fs.existsSync(path.join(root, 'cloudflare-worker')));

const index = read(path.join(root, 'index.html'));
const admin = read(path.join(root, 'admin.html'));
assert.ok(index.includes('./assets/js/api.js') && index.includes('./assets/js/app.js'));
assert.ok(admin.includes('./assets/js/api.js') && admin.includes('./assets/js/admin.js'));
assert.ok(index.includes('data-category="student"') && index.includes('data-category="teacher"'));
assert.ok(index.includes('id="socialSection"'));
assert.ok(index.includes('id="photoSection"'));
assert.ok(index.includes('id="accessCodeField"'));
assert.ok(admin.includes('value="not_submitted"'));
assert.ok(!index.includes('gasBridge') && !admin.includes('gasBridge'));
assert.ok(read(path.join(jsDir, 'config.js')).includes('GAS_WEB_APP_URL'));

// Smoke-test API transport: a hidden iframe + form POST is created with a nonce.
const listeners = {};
const created = [];
function element(tag) {
  return {
    tagName: tag, style: {}, children: [], parentNode: null, attributes: {},
    append(...items) { this.children.push(...items); items.forEach((x) => { x.parentNode = this; }); },
    setAttribute(k, v) { this.attributes[k] = v; },
    submit() { this.submitted = true; },
    removeChild(item) { this.children = this.children.filter((x) => x !== item); item.parentNode = null; }
  };
}
const body = element('body');
body.append = (...items) => { body.children.push(...items); items.forEach((x) => { x.parentNode = body; created.push(x); }); };
const fakeWindow = {
  YEARBOOK_CONFIG: { GAS_WEB_APP_URL: 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec' },
  addEventListener(type, fn) { listeners[type] = fn; },
  setTimeout, clearTimeout,
  crypto: { randomUUID: () => '12345678-1234-1234-1234-123456789abc' }
};
const sandbox = { window: fakeWindow, document: { createElement: element, body }, URL, Map, Promise, Error, Date, Math, Uint8Array, setTimeout, clearTimeout };
const apiSource = read(path.join(jsDir, 'api.js'));
new Function(apiSource);
// Use a small DOM mock for the request flow.
const vm = await import('node:vm');
vm.runInNewContext(apiSource, sandbox);
const requestPromise = fakeWindow.YearbookAPI.call('ping', { sample: true });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(created.length, 2, 'iframe and form should be appended');
const iframe = created.find((x) => x.tagName === 'iframe');
const form = created.find((x) => x.tagName === 'form');
assert.equal(form.submitted, true);
assert.equal(form.method, 'POST');
assert.equal(form.action, 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec');
assert.equal(form.target, iframe.name);
const nonceInput = form.children.find((x) => x.name === 'nonce');
assert.ok(nonceInput && nonceInput.value.length >= 16);
listeners.message({ origin: 'https://script.googleusercontent.com', data: { channel: 'YEARBOOK_SEMPIA_POST_V1', nonce: nonceInput.value, ok: true, data: { ok: true } } });
assert.deepEqual(await requestPromise, { ok: true });

// Exercise the roster/profile merge: names with no submission must appear as not_submitted.
const rosterRows = {
  SISWA: [
    { person_id: 'S001', full_name: 'Alya', class_name: 'IX-A', is_active: true },
    { person_id: 'S002', full_name: 'Bima', class_name: 'IX-A', is_active: true }
  ],
  GURU: [{ person_id: 'G001', full_name: 'Bu Rani', class_name: '', is_active: true }],
  PROFIL_SISWA: [{ person_id: 'S001', full_name: 'Alya', class_name: 'IX-A', status: 'pending', photo_file_id: 'photo-1' }],
  PROFIL_GURU: []
};
const backendContext = {};
vm.runInNewContext(code, backendContext);
backendContext.rows_ = (name) => rosterRows[name] || [];
const dashboard = backendContext.adminDashboard_();
assert.equal(dashboard.stats.total, 3);
assert.equal(dashboard.stats.students, 2);
assert.equal(dashboard.stats.teachers, 1);
assert.equal(dashboard.stats.submitted, 1);
assert.equal(dashboard.stats.notSubmitted, 2);
assert.equal(dashboard.profiles.find((x) => x.personId === 'S002').status, 'not_submitted');
assert.equal(dashboard.profiles.find((x) => x.personId === 'G001').status, 'not_submitted');

// Admin password is seeded once, editable in PENGATURAN, and not reset by setup.
const settingRows = [];
const settingsSheet = {
  getLastRow: () => settingRows.length + 1,
  getRange: () => ({ getDisplayValues: () => settingRows.map((row) => [String(row[0]), String(row[1])]) }),
  appendRow: (row) => settingRows.push(row)
};
backendContext.sheet_ = (name) => {
  assert.equal(name, 'PENGATURAN');
  return settingsSheet;
};
backendContext.ensureDefaultAdminPassword_();
assert.equal(JSON.stringify(settingRows), JSON.stringify([['ADMIN_PASSWORD', 'sempia1234']]));
backendContext.ensureDefaultAdminPassword_();
assert.equal(settingRows.length, 1, 'setup must not duplicate the password setting');

const cacheValues = new Map();
const scriptCache = {
  get: (key) => cacheValues.has(key) ? cacheValues.get(key) : null,
  put: (key, value) => cacheValues.set(key, String(value)),
  remove: (key) => cacheValues.delete(key)
};
backendContext.CacheService = { getScriptCache: () => scriptCache };
backendContext.loginThrottleKey_ = () => 'unit-test';
backendContext.Utilities = { getUuid: () => '1234567890abcdef1234567890abcdef' };
backendContext.passwordFingerprint_ = (password) => 'fingerprint:' + password;
const firstLogin = backendContext.adminLogin_('sempia1234');
backendContext.requireAdmin_(firstLogin.token);
settingRows[0][1] = 'admin-baru-2026';
backendContext.ensureDefaultAdminPassword_();
assert.equal(settingRows[0][1], 'admin-baru-2026', 'setup must preserve a password changed in the sheet');
assert.throws(() => backendContext.requireAdmin_(firstLogin.token), /Password admin telah berubah/);
assert.throws(() => backendContext.adminLogin_('sempia1234'), /Password admin salah/);
const secondLogin = backendContext.adminLogin_('admin-baru-2026');
assert.ok(secondLogin.token, 'new spreadsheet password should authenticate');

console.log('YEARBOOK SEMPIA v4.1 static checks: PASS');
console.log('Apps Script syntax, POST bridge, form fields, photo validation, roster merge, spreadsheet password setup/change, and no-Worker checks passed.');
