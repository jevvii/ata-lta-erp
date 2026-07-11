const { JSDOM } = require('jsdom');
const path = require('path');

async function waitFor(condition, timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (condition()) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
}

async function run() {
  const file = path.resolve(__dirname, 'index.html');
  const dom = await JSDOM.fromFile(file, {
    url: 'http://127.0.0.1:8091/index.html',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true
  });
  const { window } = dom;
  const { document, location } = window;

  global.document = document;
  global.window = window;

  // Wait for all scripts to execute and DB to seed
  await waitFor(() => window.eval('typeof App !== "undefined" && typeof DB !== "undefined" && typeof Auth !== "undefined" && DB.getAll("users").length > 0'), 5000);

  const ok = window.eval('Auth.login("admin@ata-lta.ph", "password123")');
  if (!ok) throw new Error('Login failed');

  window.App.init();
  await waitFor(() => !document.getElementById('app-shell').classList.contains('hidden'), 2000);

  const results = [];
  function check(label, predicate, detail = '') {
    const passed = !!predicate();
    results.push({ label, passed, detail });
    console.log(`${passed ? '✅' : '❌'} ${label}${detail ? ': ' + detail : ''}`);
    return passed;
  }

  function route(hash, expectedText) {
    location.hash = hash;
    window.App.handleRoute();
    const body = document.body.innerHTML;
    return check(`Route ${hash}`, () => body.includes('breadcrumb-base') && (expectedText ? body.includes(expectedText) : true));
  }

  route('#clients/form/new', 'Add Client');
  check('Client form view switcher', () => document.querySelector('.form-view-switcher'));
  check('Client form save button', () => document.querySelector('button[form="client-form"]'));

  route('#admin/users/form/new', 'Add User');
  check('User form view switcher', () => document.querySelector('.form-view-switcher'));

  route('#billing/form/new', 'New Invoice');
  check('Billing form view switcher', () => document.querySelector('.form-view-switcher'));
  check('Billing form no duplicate header', () => document.querySelectorAll('.form-header-bar').length === 0);

  route('#disbursement/form/new', 'New Expense');
  check('Disbursement form view switcher', () => document.querySelector('.form-view-switcher'));
  check('Disbursement form no duplicate header', () => document.querySelectorAll('.form-header-bar').length === 0);

  route('#transmittal/form/new', 'New Transmittal');
  check('Transmittal form view switcher', () => document.querySelector('.form-view-switcher'));
  check('Transmittal form no duplicate header', () => document.querySelectorAll('.form-header-bar').length === 0);

  route('#operations/form/new', 'New Work Request');
  check('Operations form view switcher', () => document.querySelector('.form-view-switcher'));

  // Edit routes reuse the same full-page breadcrumb layout
  const firstClient = window.eval('DB.getAll("clients")[0]');
  if (firstClient) {
    route(`#clients/form/${firstClient.id}`, firstClient.name || 'Edit Client');
    check('Client edit view switcher', () => document.querySelector('.form-view-switcher'));
    check('Client edit save button', () => document.querySelector('button[form="client-form"]'));
  }

  const firstUser = window.eval('DB.getAll("users")[0]');
  if (firstUser) {
    route(`#admin/users/form/${firstUser.id}`, firstUser.name || 'Edit User');
    check('User edit view switcher', () => document.querySelector('.form-view-switcher'));
    check('User edit save button', () => document.querySelector('button[form="user-form"]'));
  }

  // Client/user forms should not show the old internal header bar in full-page mode
  check('Client form no duplicate header', () => document.querySelectorAll('.form-header-bar').length === 0);
  check('User form no duplicate header', () => document.querySelectorAll('.form-header-bar').length === 0);

  // Pending detail full-page view
  const firstPending = window.eval('DB.getAll("pendingChanges")[0]');
  if (firstPending) {
    route(`#admin/pending/${firstPending.id}`, firstPending.title || 'Submission');
    check('Pending detail view switcher', () => document.querySelector('.form-view-switcher'));
    check('Pending detail has approve/reject or withdraw', () => document.querySelector('.btn.btn-success') || document.querySelector('.btn.btn-secondary'));
  }

  // Template full-page forms
  route('#billing/templateForm/new', 'New Billing Template');
  check('Billing template view switcher', () => document.querySelector('.form-view-switcher'));

  route('#disbursement/templateForm/new', 'New Disbursement Template');
  check('Disbursement template view switcher', () => document.querySelector('.form-view-switcher'));

  route('#operations/templateForm/new', 'New Retainer Template');
  check('Retainer template view switcher', () => document.querySelector('.form-view-switcher'));

  const firstWr = window.eval('DB.getAll("workRequests")[0]');
  if (firstWr) {
    route(`#operations/addTask/${firstWr.id}`, 'Add Task');
    check('Add task view switcher', () => document.querySelector('.form-view-switcher'));
  }

  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
