# Work Request Task List View: Technical and Design Context

This document captures the entire functional scope, UI layout, validation rules, and interactive states of the **Work Request (WR) Task List View** as implemented in [js/workflow.js](file:///home/javvii/FreelanceProject/Project4/js/workflow.js) and [css/styles.css](file:///home/javvii/FreelanceProject/Project4/css/styles.css). Use this context to explore redesign approaches without losing current functional requirements.

---

## 1. Page Header & Stage Tracking
At the top of the detail page, the following metadata and indicators are displayed:
- **Sub-Header Metadata**: Displays key fields: Client Name, WR Status, Priority (Normal, Low Priority, Priority, Urgent).
- **Financial Status Badge**: Rendered via `getFinanceBadgeForWr(wr)`.
- **Documents Status Badge**: Rendered via `getDocBadgeForWr(wr)`.
- **Modern Progress Bar**: A horizontal step-based path tracker (`modern-progress-wrapper`) indicating the current stage:
  `Work Request (Draft) ➔ Pre-processing ➔ Processing ➔ Billing ➔ Disbursement ➔ Documentation (Completed / Cancelled)`
  The active step track is colored dynamically based on the Work Request's active status.

---

## 2. End-of-Day (EOD) Time Log Reminder Banner
Displays automatically to the **Work Request Owner** (either the assignee or the requester) if:
- The local time in Manila is 5:00 PM (17:00) or later.
- The Work Request is active (not `Cancelled`).
- There are incomplete checklist items assigned to ground workers that have no hours logged for today.
### Actions:
- **Log Time Now**: Triggers the "Add Time Log" modal for the first missing checklist item.
- **Request all missing logs**: Generates an email template listing all missing items/assignees, copies it to the clipboard, and displays a success notification.

---

## 3. Toolbar Controls
The toolbar (`task-view-toolbar`) facilitates sorting, grouping, filtering, and creation:
- **Grouping (groupBy)**:
  - **Phase**: Groups tasks under a header representing the active phase (e.g., "Draft Tasks", "Billing Tasks").
  - **Assignee**: Groups tasks by their primary assignee name, with a dedicated group for "Unassigned" tasks.
  - **Flat List**: Renders all tasks in a single combined list sorted by `Priority (Urgent ➔ Low)` ➔ `Due Date` ➔ `Completed status at the bottom`.
- **Group Headers**: Display the group name, task count, checklist progress (e.g., `4/10 items done`), and total logged hours for that group.
- **Filter Chips (activeFilters)**:
  - **Missing logs**: Filters for tasks or nested checklist items assigned to ground workers that lack time entries for today.
  - **Blocked**: Filters for tasks with incomplete predecessors or checklist items with uncompleted prerequisites.
  - **Incomplete checklist**: Filters for tasks with checklist items where completion is $< 100\%$.
  - **Mine**: Filters for tasks where the logged-in user is the primary assignee, a co-assignee, or assigned to individual checklist items.
- **Add Task Button**: Opens the `Add New Task` modal.

---

## 4. Phase Transition & Routing Panel
Directly inside the group headers/top panel, routing controls display the Work Request's eligibility to advance:
- **Ready to Route Banner**: Displays a green confirmation panel (`Ready to route`) and enables the **"Route to [Next Phase]"** button if all automated rules for the next status transition are met.
- **Routing Blocked Panel**: If requirements are missing, displays a warning block listing the blocking items.
- **Actionable Hints ("Go" Navigation)**: Each block listed under the missing requirements contains a diagnostic hint and a "Go" button to jump directly to the relevant view (e.g., `#billing` or `#disbursement`).
- **Cancel Button**: A managerial action to cancel the Work Request entirely (available if role is `Admin`/`Manager` and status is not terminal).

---

## 5. Bulk Actions Bar
Appears at the top of the list (`bulk-action-bar`) when one or more task row checkboxes are checked. It shows the selected count and supports:
- **Request Logs**: Compiles a single combined daily time log email template for all selected tasks and copies it to the clipboard.
- **Assign to...**: A searchable autocomplete dropdown and an "Assign" button to update the primary assignee of all selected tasks (overwriting existing assignees and clearing co-assignees).
- **Mark Done**: Attempts to bulk-update selected tasks to `Completed`. Displays a summary banner showing the number of successful updates and detailed errors for failed ones.
- **Log Time**: Opens a bulk time log entry form. Once saved, it adds the logged entry to all selected tasks (automatically skipping tasks where the worker has already logged hours for that date).
- **Clear**: Unchecks all checked rows and hides the bulk bar.

---

## 6. Task List Table Columns
Each task group renders a tabular list of tasks (`task-table-v2`):
1. **Selection Column**: Contains a checkbox to select the row for bulk operations.
2. **Task Title Column**:
   - Contains an accordion toggle caret (`›` / `🗎`).
   - Displays the task title (strikes through when `Completed`).
   - Lists sub-labels for blocking predecessors/dependencies (e.g., `Blocking dependencies: Task A, Task B`).
3. **Assigned To Column**:
   - If the Work Request is in a **Draft** status: Renders a searchable ground worker input dropdown and an editable co-assignee picker.
   - If the Work Request is in **Active/Locked** status: Displays avatars for the primary assignee and the first two co-assignees, followed by an overflow indicator (e.g., `+2` with a tooltip showing other names).
   - Renders the editable co-assignee list + dropdown inline underneath if the WR status is `Draft`.
4. **Due Date**: Displays the formatted due date or `N/A`.
5. **Status Column**:
   - Renders a colored dropdown select for task statuses: `Draft`, `Assigned`, `In Progress`, `For Review`, `Completed`, `Cancelled`.
   - **Validation Rules**:
     - Disables statuses not allowed in the current phase or role.
     - Blocks terminal statuses (`Completed` and `For Review`) if any checklist items are incomplete.
     - Prompts a confirmation modal if moving to `Completed` or `Cancelled`.
6. **Linked Records**:
   - Displays badges linking to invoices/billings (`📄 Invoice#`) and expenses (`💸 Category`). Clicking them navigates to Billing/Disbursement views.
   - If the task is routing-critical (e.g., task title contains keywords like "invoice", "disburse", "payment") and has no linked records, it shows yellow warning links: `⚠ Link invoice required` or `⚠ Link expense required` which open the association modal.
7. **Checklist Column**: Displays an SVG progress ring (percentage filled, green) along with a text label `done/total` and a tooltip list of remaining items.
8. **Time**: Displays total accumulated hours (`task-level hours + checklist-item hours`) or `N/A`.
9. **Actions**:
   - **Request Log**: Copies a quick time-request template for that specific task to the clipboard.
   - **Log Time**: Opens the time log dialog.

---

## 7. Accordion Task Details Panel
Clicking a task row expands a details panel with a two-pane layout:

### A. Left Pane: Requirements Checklist
- **Interactive Checklist Rows**:
  - **Status Checkbox**: Toggles item completion.
  - **Prerequisite Blocking**: If an item depends on another, it displays a lock icon `🔒 Waiting for: [Prerequisite Item Text]`, has an opacity overlay, and disables its checkbox.
  - **Ground Worker Assignment**: A searchable inline employee dropdown for each checklist row.
  - **Logged Hours Badge**: A blue pill showing the sum of logged hours for that checklist item.
  - **Log Time Button**: Opens the time log dialog pre-configured for this checklist item.
  - **Delete Item Button (`×`)**:
    - If no logs exist, it removes the item immediately.
    - If logs exist, it shows a confirmation modal: **"Reassign to task"** (migrates the time logs to the parent task before removing the item) or **"Delete logs & item"** (purges both).
- **Checklist Builder Row**: Text input field, prerequisite selection dropdown, and an "Add" button to append new items.

### B. Right Pane: Documents, History, & Map
- **Attached Documents Section**:
  - Displays list of uploaded attachments (scans).
  - Only **Documentation Staff** can upload scanned documents (restricted when archived).
  - Only **Admins** can click document names to view them in an interactive iframe modal.
  - Non-admins see document names and upload dates but cannot open the files.
  - Admins and Documentation Staff can delete attachments.
  - **Document Comments Thread**:
    - Under each document, users can toggle a comment panel.
    - Admins can add, edit, and delete comments on documents. Non-admins have read-only access to comments.
- **Time Log History Section**:
  - Groups logs into **Task-level logs** and **Checklist item-level logs**.
  - Shows worker name, date, start/end times, activity description, and total hours.
- **Dependency Mini-Map Section**:
  - Displays a detailed visual sequence list of both task-level predecessors and checklist-item dependencies.

---

## 8. Related Financials & Documents Panel
Renders at the very bottom of the page (`Related Financials & Documents`):
- **Invoices / Billings Card**: Lists linked invoices. Displays badge color coding: `Draft` (gray), `Pending` (yellow), `Sent` (light blue), `Approved` (blue), and `Paid` (green). Contains a button to **"+ Generate Billing"**.
- **Expenses / Disbursements Card**: Lists linked disbursements with category, date, and status badges.
- **Transmittals Card**: Lists tracking numbers, dispatch dates, and acknowledgment statuses.

---

## 9. Key Modals and Interactive Dialogs
- **Add Task Modal**: Fields for Standard Task Template, Task Title, Checklist Items Builder (with checklist-level prerequisites and checklist assignees), Task Assignee, Co-Assignees (chips), Due Date, Priority, and Task-level Dependencies dropdown.
- **Link Financial Record Modal**: Allows linking a billing invoice or expense disbursement directly to a task. Populates available options based on the client.
- **Add Time Log Modal**: Fields for Worker Name, Date (defaults to Manila today), Start/End Time, Note, and read-only auto-calculated hours rounded to the nearest 15 minutes. Contains a duplicate logging block preventing a worker from entering multiple logs on the same date for the same scope.
