const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8888';
const ADMIN_USER = { email: 'admin@ata-lta.ph', password: 'password123' };

async function runVerification() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  // Log in
  await page.goto(BASE);
  await page.fill('#email', ADMIN_USER.email);
  await page.fill('#password', ADMIN_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForSelector('#app-shell', { timeout: 5000 });

  // Run tests in browser context
  const results = await page.evaluate(() => {
    const testResults = [];

    function assert(label, condition, detail) {
      testResults.push({ label, passed: !!condition, detail });
      console.log(`[TEST] ${label}: ${condition ? 'PASSED' : 'FAILED'} (${detail})`);
    }

    try {
      // 1. Setup mock records
      const wrDraftId = 'wr-test-draft';
      const wrPreprocId = 'wr-test-preproc';
      const wrBillingId = 'wr-test-billing';
      const wrCompletedId = 'wr-test-completed';

      const taskDraftWrId = 't-test-draft-wr';
      const taskReqPreprocId = 't-test-req-preproc';
      const taskNonReqPreprocId = 't-test-nonreq-preproc';
      const taskBillingId = 't-test-billing-wr';
      const taskCompletedId = 't-test-completed-wr';

      // Insert Work Requests
      DB.insert('workRequests', { id: wrDraftId, title: 'Draft WR', status: 'Draft' });
      DB.insert('workRequests', { id: wrPreprocId, title: 'Pre-processing WR', status: 'Pre-processing' });
      DB.insert('workRequests', { id: wrBillingId, title: 'Billing WR', status: 'Billing' });
      DB.insert('workRequests', { id: wrCompletedId, title: 'Completed WR', status: 'Completed' });

      // Insert Tasks
      DB.insert('tasks', { id: taskDraftWrId, workRequestId: wrDraftId, title: 'Standard Task in Draft WR', status: 'Draft' });
      DB.insert('tasks', { id: taskReqPreprocId, workRequestId: wrPreprocId, title: 'Requirement gathering task', status: 'Draft' });
      DB.insert('tasks', { id: taskNonReqPreprocId, workRequestId: wrPreprocId, title: 'Regular coding task', status: 'Draft' });
      DB.insert('tasks', { id: taskBillingId, workRequestId: wrBillingId, title: 'Billing task', status: 'In Progress' });
      DB.insert('tasks', { id: taskCompletedId, workRequestId: wrCompletedId, title: 'Completed WR task', status: 'In Progress' });

      // ----------------------------------------------------
      // Case 1: Work Request is in Draft
      // Capped at Assigned. Allowed: Draft, Assigned, Cancelled.
      // ----------------------------------------------------
      const taskDraft = DB.getById('tasks', taskDraftWrId);
      const allowedDraft = Workflow.getValidNextStatuses(taskDraft);
      assert(
        'Case 1: getValidNextStatuses for Draft WR',
        allowedDraft.includes('Draft') && allowedDraft.includes('Assigned') && allowedDraft.includes('Cancelled') && !allowedDraft.includes('In Progress'),
        `Allowed statuses: ${JSON.stringify(allowedDraft)}`
      );

      const res1_invalid = Workflow.updateTaskStatus(taskDraftWrId, 'In Progress');
      assert(
        'Case 1: updateTaskStatus to In Progress (Invalid)',
        res1_invalid.error === 'Task status cannot be set to "In Progress" in the "Draft" phase.',
        `Result error: ${res1_invalid.error}`
      );

      const res1_valid = Workflow.updateTaskStatus(taskDraftWrId, 'Assigned');
      assert(
        'Case 1: updateTaskStatus to Assigned (Valid)',
        res1_valid.success === true,
        `Result: ${JSON.stringify(res1_valid)}`
      );

      // ----------------------------------------------------
      // Case 2: Work Request is in Pre-processing (Requirement task)
      // Capped at Completed. Full flow allowed.
      // ----------------------------------------------------
      let taskReq = DB.getById('tasks', taskReqPreprocId);
      let allowedReq = Workflow.getValidNextStatuses(taskReq);
      assert(
        'Case 2: getValidNextStatuses for Requirement Task (Draft)',
        allowedReq.includes('Assigned') && !allowedReq.includes('In Progress'),
        `Allowed statuses: ${JSON.stringify(allowedReq)}`
      );

      // Transition to Assigned
      let res2_assigned = Workflow.updateTaskStatus(taskReqPreprocId, 'Assigned');
      assert('Case 2: Transition to Assigned', res2_assigned.success === true, `Result: ${JSON.stringify(res2_assigned)}`);

      taskReq = DB.getById('tasks', taskReqPreprocId);
      allowedReq = Workflow.getValidNextStatuses(taskReq);
      assert(
        'Case 2: getValidNextStatuses for Requirement Task (Assigned)',
        allowedReq.includes('In Progress') && !allowedReq.includes('For Review'),
        `Allowed statuses: ${JSON.stringify(allowedReq)}`
      );

      // Transition to In Progress
      let res2_in_progress = Workflow.updateTaskStatus(taskReqPreprocId, 'In Progress');
      assert('Case 2: Transition to In Progress', res2_in_progress.success === true, `Result: ${JSON.stringify(res2_in_progress)}`);

      taskReq = DB.getById('tasks', taskReqPreprocId);
      allowedReq = Workflow.getValidNextStatuses(taskReq);
      assert(
        'Case 2: getValidNextStatuses for Requirement Task (In Progress)',
        allowedReq.includes('For Review') && !allowedReq.includes('Completed'),
        `Allowed statuses: ${JSON.stringify(allowedReq)}`
      );

      // Transition to For Review
      let res2_for_review = Workflow.updateTaskStatus(taskReqPreprocId, 'For Review');
      assert('Case 2: Transition to For Review', res2_for_review.success === true, `Result: ${JSON.stringify(res2_for_review)}`);

      taskReq = DB.getById('tasks', taskReqPreprocId);
      allowedReq = Workflow.getValidNextStatuses(taskReq);
      assert(
        'Case 2: getValidNextStatuses for Requirement Task (For Review)',
        allowedReq.includes('Completed'),
        `Allowed statuses: ${JSON.stringify(allowedReq)}`
      );

      // Transition to Completed
      let res2_completed = Workflow.updateTaskStatus(taskReqPreprocId, 'Completed');
      assert('Case 2: Transition to Completed', res2_completed.success === true, `Result: ${JSON.stringify(res2_completed)}`);

      // ----------------------------------------------------
      // Case 3: Work Request is in Pre-processing (Non-requirement task)
      // Capped at Assigned. Allowed: Draft, Assigned, Cancelled.
      // ----------------------------------------------------
      let taskNonReq = DB.getById('tasks', taskNonReqPreprocId);
      let allowedNonReq = Workflow.getValidNextStatuses(taskNonReq);
      assert(
        'Case 3: getValidNextStatuses for Non-Requirement Task (Draft)',
        allowedNonReq.includes('Draft') && allowedNonReq.includes('Assigned') && allowedNonReq.includes('Cancelled') && !allowedNonReq.includes('In Progress'),
        `Allowed statuses: ${JSON.stringify(allowedNonReq)}`
      );

      // Transition to Assigned
      let res3_assigned = Workflow.updateTaskStatus(taskNonReqPreprocId, 'Assigned');
      assert('Case 3: Transition to Assigned', res3_assigned.success === true, `Result: ${JSON.stringify(res3_assigned)}`);

      // Now it's in Assigned. Since it is capped at Assigned, it shouldn't be allowed to go to In Progress.
      taskNonReq = DB.getById('tasks', taskNonReqPreprocId);
      allowedNonReq = Workflow.getValidNextStatuses(taskNonReq);
      assert(
        'Case 3: getValidNextStatuses for Non-Requirement Task (Assigned)',
        allowedNonReq.includes('Draft') && allowedNonReq.includes('Assigned') && allowedNonReq.includes('Cancelled') && !allowedNonReq.includes('In Progress'),
        `Allowed statuses: ${JSON.stringify(allowedNonReq)}`
      );

      let res3_invalid = Workflow.updateTaskStatus(taskNonReqPreprocId, 'In Progress');
      assert(
        'Case 3: updateTaskStatus non-requirement task to In Progress (Invalid)',
        res3_invalid.error === 'Task status cannot be set to "In Progress" in the "Pre-processing" phase.',
        `Result error: ${res3_invalid.error}`
      );

      // ----------------------------------------------------
      // Case 4: Work Request is in Billing
      // Capped at its current status (In Progress). Cannot go to For Review or Completed.
      // ----------------------------------------------------
      const taskBilling = DB.getById('tasks', taskBillingId);
      const allowedBilling = Workflow.getValidNextStatuses(taskBilling);
      assert(
        'Case 4: getValidNextStatuses for Task in Billing WR',
        allowedBilling.includes('In Progress') && !allowedBilling.includes('For Review') && !allowedBilling.includes('Completed'),
        `Allowed statuses: ${JSON.stringify(allowedBilling)}`
      );

      const res4_invalid = Workflow.updateTaskStatus(taskBillingId, 'For Review');
      assert(
        'Case 4: updateTaskStatus to For Review (Invalid)',
        res4_invalid.error === 'Task status cannot be set to "For Review" in the "Billing" phase.',
        `Result error: ${res4_invalid.error}`
      );

      // ----------------------------------------------------
      // Case 5: Work Request is in Completed
      // Locked as immutable.
      // ----------------------------------------------------
      const taskCompleted = DB.getById('tasks', taskCompletedId);
      const allowedCompleted = Workflow.getValidNextStatuses(taskCompleted);
      assert(
        'Case 5: getValidNextStatuses for Task in Completed WR',
        allowedCompleted.length === 1 && allowedCompleted[0] === 'In Progress',
        `Allowed statuses: ${JSON.stringify(allowedCompleted)}`
      );

      const res5_invalid = Workflow.updateTaskStatus(taskCompletedId, 'Completed');
      assert(
        'Case 5: updateTaskStatus on Completed WR task (Invalid)',
        res5_invalid.error === 'Task status cannot be set to "Completed" in the "Completed" phase.',
        `Result error: ${res5_invalid.error}`
      );

      // ----------------------------------------------------
      // Clean up
      // ----------------------------------------------------
      DB.delete('workRequests', wrDraftId);
      DB.delete('workRequests', wrPreprocId);
      DB.delete('workRequests', wrBillingId);
      DB.delete('workRequests', wrCompletedId);

      DB.delete('tasks', taskDraftWrId);
      DB.delete('tasks', taskReqPreprocId);
      DB.delete('tasks', taskNonReqPreprocId);
      DB.delete('tasks', taskBillingId);
      DB.delete('tasks', taskCompletedId);

    } catch (e) {
      testResults.push({ label: 'Error inside evaluate', passed: false, detail: e.toString() });
    }

    return testResults;
  });

  await context.close();
  await browser.close();

  console.log('\n========== VERIFICATION RESULTS ==========');
  let failed = 0;
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.label} -- ${r.detail}`);
    if (!r.passed) failed++;
  }
  console.log(`==========================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('All verification checks passed successfully.');
    process.exit(0);
  }
}

runVerification().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
