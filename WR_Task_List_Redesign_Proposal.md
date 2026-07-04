# Work Request Task List View — Redesign Proposal

> **Goal:** Restructure the Work Request detail task list so that tasks, requirement-checklist items, per-item assignees, and per-item time logs are presented as one coherent, scannable, action-oriented surface that matches the existing flat green/blue/slate card aesthetic.

## 1. Current state audit

### What already works
| Feature | Location | Notes |
|---|---|---|
| `groundWorkers` registry + auto-registration | `js/data.js`, `js/workflow.js` | New employees are registered when typed into the typable dropdown. |
| Per-task checklist with per-item assignee | `js/workflow.js:2581-2668` | Checklist items live inside the accordion detail row and each has a `createGroundWorkerDropdown`. |
| Task-level status completion guard | `js/workflow.js:3623-3632` | `Completed`/`For Review` are blocked if any checklist item is incomplete. |
| Typable employee assignee | `js/workflow.js:30-92` | `createGroundWorkerDropdown` behaves like the filter-tray combobox. |
| Request Log (email draft) | `js/workflow.js:2132-2149` | Copies a time-log request email to the clipboard for ground-worker tasks. |
| EOD reminder banner | `js/workflow.js:1931-1964` | Shows at 5 PM Manila time for WR owners when ground-worker tasks are missing today's log. |
| Modern progress bar | `js/workflow.js:3389-3443` | 6-stage pipeline indicator already matches the proposed header style. |

### Gaps the redesign must close
1. **Checklist items are buried.** They only appear inside the accordion detail row, so a manager cannot see at a glance which requirement items are done, who owns them, or how much time they consumed.
2. **Time logs are task-level only.** The current schema stores `timeLogs` on the task. The client sample (`Sample-for-ERP.xlsx`) implies that sub-items under a task (e.g., SEC payment, City Hall permit) should each carry their own time attribution.
3. **No checklist dependency support.** The sample shows "BIR application — dependent on *". Currently only whole-task predecessors (`t.predecessors`) exist.
4. **No visible checklist progress on the parent row.** A task can look "In Progress" while its checklist is 0 % or 100 % done.
5. **EOD banner only looks at task-level logs.** If a checklist item is missing a log but the parent task has one, the reminder will not fire.
6. **Bulk actions are absent.** Managers cannot select several items and request logs, assign, or mark done in one action.
7. **No grouping by assignee.** The Excel sample lists tasks grouped by employee; the current UI groups everything under a single "General Tasks" card.

## 2. Design principles

1. **Progressive disclosure, not hidden data.** Show the most important state (task, owner, status, progress, time) in the main row; reveal checklist items, logs, and documents one click away.
2. **Group by how people work.** Support grouping by *phase/dependency chain* and by *assignee*, because accounting supervisors think in terms of "what is Juan working on?" and "what is blocking BIR?"
3. **Time is a first-class citizen.** Every checklist row exposes an action to log time; parent rows roll up the total.
4. **Actions in context.** Status changes, log requests, document uploads, and assignment happen inline or in the expanded row rather than forcing a full-page reload.
5. **Match the existing palette.** White cards on a `#f8fafc` slate background; semantic colors from the current design system: green `#10b981` for complete/ok, amber `#f59e0b` for warning/in-progress, blue `#3b82f6` for active/assigned, red `#ef4444` for blocked/error.
6. **Guardrails, not dead ends.** When a status change is blocked, show exactly which checklist items are incomplete and offer a direct link to open that row.

## 3. Recommended layout architecture

### 3.1 Page structure
Keep the current single-page WR detail (do not introduce a true side-by-side master-detail split, because the app already navigates via hash routes). Adopt the *card-grouped table* pattern already used in `renderDetail()`:

```
┌─ WR Header (breadcrumb, client, status badge) ─────────────┐
├─ Modern progress bar (existing) ───────────────────────────┤
├─ Sub-header info + finance/document badges (existing) ─────┤
├─ EOD reminder banner (improved; see §5.4) ───────────────────┤
├─ Routing blocker panel (existing, enhanced with checklist) ──┤
├─ Task view toolbar (new) ──────────────────────────────────┤
├─ Task group card(s) ───────────────────────────────────────┤
│   ┌─ group header: assignee or phase name + count + totals ─┐
│   │  table: Task | Assignee | Due | Status | Checklist |    │
│   │        Linked | Time | ...                              │
│   │  expandable sub-row: checklist + documents + logs       │
│   └─────────────────────────────────────────────────────────┘
├─ Related financials & documents panel (existing) ────────────┤
└─ Task activity comments (existing) ──────────────────────────┘
```

### 3.2 Task view toolbar (new)
A compact toolbar above the first card:

- **Group by** toggle: `Phase` (default) | `Assignee` | `Flat list`
- **Filter chips**: `Missing logs`, `Blocked`, `Incomplete checklist`, `Mine`
- **Bulk action bar** (appears only when checklist rows are selected): `Request Logs`, `Assign`, `Mark Done`, `Log Time`
- **Add Task** primary button (opens existing `showAddTaskModal`)

## 4. Component arrangement

### 4.1 Grouped task cards
Re-use `.task-group-v2` but render one card per group instead of a single "General Tasks" card. Each group header shows:

- Group title (employee name or pipeline phase)
- Task count
- Aggregate checklist completion: "12/16 items done"
- Aggregate logged hours for the group
- Optional: overdue count

### 4.2 Parent task row columns
| Column | Content |
|---|---|
| **Task** | Caret expander + checkbox + title + dependency hint + overdue flag |
| **Assigned To** | Typable employee dropdown in `Draft`; read-only avatar+name otherwise |
| **Due Date** | `formatDate(t.dueDate)` |
| **Status** | Existing colored status dropdown, but disable `Completed`/`For Review` with a tooltip if checklist is incomplete |
| **Checklist** | Mini progress widget: `3/5 ✓` + circular progress bar + hover tooltip listing remaining items |
| **Linked Records** | Existing invoice/disbursement badges |
| **Time** | Total actual hours rolled up from checklist item logs (or existing task logs) |
| **Actions** | `Request Log` (for ground-worker tasks), `Log Time`, overflow menu |

### 4.3 Expandable sub-row redesign
Replace the current 8-column accordion with a two-pane layout inside the expanded row:

```
┌─ Left pane: Requirements Checklist ─────────────┐ ┌─ Right pane: Details ──────────────┐
│  ☐ Item text                    [assignee] [time] │  Attached Documents (existing)       │
│  ☑ Item text                    [assignee] [time] │  Time Log history                    │
│  ☐ Item text (blocked)          [assignee] [time] │  Comments                            │
│  + Add item                                       │  Dependency mini-map                 │
└───────────────────────────────────────────────────┘ └────────────────────────────────────┘
```

Each checklist row contains:
- Checkbox (disabled if dependency not satisfied)
- Item text
- Typable assignee dropdown (`createGroundWorkerDropdown`, `maxWidth: 160px`)
- Time pill showing cumulative hours for that item
- **Start / Log** button: opens the time-log modal pre-filled with the checklist item id
- Delete button (with soft-delete protection if logs exist)

### 4.4 Time logging per checklist item
The existing `showAddTimeLogModal(taskId)` should be extended to accept an optional `checklistItemId`:

- If a `checklistItemId` is passed, the log is attached to that item.
- If none is passed, the log attaches to the task itself (current behavior).
- The modal pre-fills the worker name from the checklist item assignee if present.
- The guard "same worker cannot log twice on same day for this task" becomes per `(taskId, checklistItemId, workerName, date)`.

Parent task time is computed as `sum(task.timeLogs) + sum(each checklist item logs)`. This avoids double-counting because task-level logs are only created when no checklist item is specified.

### 4.5 Dependency visualization
Introduce a lightweight checklist-level dependency model:

- Each checklist item gains `dependsOn: string | null` referencing another checklist item id in the same task.
- In the UI, dependent items are rendered greyed out with a `🔒` icon and the text "Waiting for: [prerequisite text]".
- The checkbox is disabled until the prerequisite is completed.
- If a prerequisite is later unchecked, the dependent item reverts to `completed: false` automatically.

For task-level dependencies, keep the existing `predecessors` array but surface it as a small dependency chain above the task title (already partially implemented at `js/workflow.js:2115-2127`).

## 5. Detailed interactions and edge cases

### 5.1 Assignee edge cases
| Scenario | Behavior |
|---|---|
| Checklist item has no assignee | Show grey-ghost placeholder; allow any logged-in user to start a timer and auto-assign themselves. |
| New employee typed in dropdown | Auto-register in `groundWorkers` on commit (already implemented). |
| Parent task assignee changes | Offer a one-time prompt: "Apply new assignee to all unassigned checklist items?" No silent mass reassignment. |
| Assignee deleted from registry | Keep the saved `assigneeName` string as fallback; show a small warning badge. |

### 5.2 Checklist completion edge cases
| Scenario | Behavior |
|---|---|
| User checks an item with a dependent item already checked | The dependent item stays checked because its prerequisite was, at some point, satisfied. If the prerequisite is unchecked, the dependent becomes unchecked automatically. |
| User tries to mark parent `Completed` while checklist incomplete | Status dropdown rejects the change and shows a tooltip: "3 of 5 requirement items incomplete." Clicking the tooltip expands the row. |
| User deletes a checklist item that has time logs | Show a destructive modal with two options: (a) **Reassign logs to parent task** (recommended), (b) **Delete logs and item**. Soft-delete is preferred. |
| User unchecks a completed item | Logged time is preserved (accounting firms need actual cost data). Show a non-blocking toast confirmation. |
| Zero-duration log | Discard entry and show "Log too short to record." |
| Log crosses midnight | Split into two daily entries at 11:59 PM / 12:00 AM Manila time for daily reports. |

### 5.3 Status transition edge cases
| Scenario | Behavior |
|---|---|
| Task status is `Assigned` but checklist has incomplete items | Allow moving to `In Progress`; only `Completed` and `For Review` are blocked. |
| WR phase is `Pre-processing` and only requirement tasks exist | Requirement tasks can advance to `Completed` only when their own checklist is done; other tasks remain capped at `Assigned` (current logic already does this). |
| WR phase advances while checklist items are still pending | Phase transition logic already checks requirement-task completion; extend it to also verify no checklist item in any requirement task is incomplete. |

### 5.4 EOD reminder improvements
Change the banner trigger from task-level to item-level:

- Show the banner if **any checklist item assigned to a ground worker** has no log for today and the parent task is not `Completed`/`Cancelled`.
- Clicking "Log Time Now" opens the modal for the first missing item (not just the first task).
- Add a secondary link: "Request all missing logs" which copies a bulk email draft for the WR owner.

### 5.5 Request Log improvements
| Scenario | Behavior |
|---|---|
| Single task request | Keep the per-row "Request Log" button; copy an email draft. |
| Bulk request | In toolbar bulk mode, generate one combined email listing all selected tasks/items. |
| Checklist item request | When opened from a checklist row, the email subject names the specific item: `Time Log Request: [Task] — [Item]`. |

## 6. Data model changes

### 6.1 `tasks` checklist schema
Extend the checklist item shape (schema version bump to `12`):

```typescript
interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  assigneeId: string | null;      // registered user id, if any
  assigneeName: string | null;    // free-text name (ground worker or staff)
  dependsOn: string | null;       // id of another checklist item in the same task
  timeLogs: TimeLogEntry[];       // NEW: per-item time logs
}
```

### 6.2 Time log entry
```typescript
interface TimeLogEntry {
  id: string;
  userId: string;        // logged-in system user
  workerName: string;    // employee/ground worker name
  checklistItemId?: string | null;
  startTime: string;
  endTime: string;
  date: string;
  note: string;
  hours: number;
}
```

### 6.3 Migration (`migrateV11ToV12`)
- For each existing `task.checklist` item, add `dependsOn: null` and `timeLogs: []`.
- Existing `task.timeLogs` remain at the task level so history is preserved.
- Add a unique `id` to any checklist item that lacks one (the current code already generates ids in some places but not in `showAddTaskModal`).

### 6.4 Indexes / helper queries
- `DB.getWhere('tasks', t => t.workRequestId === wrId)` is already used; no new indexes are required for localStorage.
- Add helper functions in `js/utils.js` or `js/workflow.js`:
  - `getTaskTotalHours(task)`
  - `getChecklistItemTotalHours(item)`
  - `isChecklistBlocked(item, taskChecklist)`
  - `getIncompleteChecklistNames(task)`

## 7. Implementation phases

### Phase A — Data & checklist dependency foundation
1. Bump schema to `12`, write `migrateV11ToV12`.
2. Add `dependsOn` and `timeLogs` to checklist items.
3. Update `showAddTaskModal` to generate stable ids and allow setting a prerequisite item.
4. Add helper functions for time rollups and dependency checks.

### Phase B — Expandable sub-row redesign
1. Rebuild the accordion details layout as a two-pane checklist + info panel.
2. Render checklist rows with disabled states for blocked items.
3. Add inline "Log Time" button per checklist item.
4. Add per-item time log history in the right pane.

### Phase C — Parent row progress and status guardrails
1. Add a checklist progress mini-widget to each parent row.
2. Disable `Completed`/`For Review` in the status dropdown when checklist items are incomplete, with a tooltip.
3. Enhance the routing blocker panel to mention incomplete checklist items by name.

### Phase D — Grouping, filtering, and bulk actions
1. Implement group-by toggle: phase, assignee, flat.
2. Add filter chips.
3. Add row-selection checkboxes and a contextual bulk-action toolbar.
4. Add bulk "Request Logs" and bulk "Log Time" flows.

### Phase E — EOD banner and edge-case polish
1. Move EOD check from task-level to checklist-item-level.
2. Implement soft-delete protection for checklist items with logs.
3. Implement midnight split and zero-duration discard.
4. Add empty-state guidance when a WR has no tasks.

## 8. Research grounding

This proposal draws on NotebookLM deep-research findings from 47 accounting/workflow/time-tracking sources:

- **Master-detail + expandable rows** keep dense ERP data scannable without navigation churn [Microsoft master-detail pattern; shadcn/ui Expandable Sub-Rows; Cloudscape nested resources].
- **Progressive disclosure** via chevron expansion reduces cognitive load for feature-rich interfaces [UXPin, Born Digital].
- **Inline time logging** (start/stop buttons, manual entry) is critical for adoption; friction kills compliance [Eleken, Toggl, Scoro].
- **Sub-task time roll-ups** to parent tasks is the expected model in practice-management tools [Asana time tracking help].
- **Bulk actions and contextual toolbars** are standard for enterprise data tables [Pencil & Paper data table UX, NN/g batch actions].
- **Contextual help/tooltips** prevent support load and reduce errors in complex enterprise workflows [8 Enterprise UX best practices].
- **Empty states as onboarding** significantly improves first-time value [Born Digital onboarding UX].

## 9. Recommended next step

Approve Phase A (schema + dependency model). Once the data layer is stable, Phase B can be implemented and verified with the existing jsdom unit-test pattern before touching grouping/bulk actions in Phases C–E.
