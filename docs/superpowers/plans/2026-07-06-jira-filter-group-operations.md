# Plan: Jira-style compact filter + group-by for Operations board/list views

## Goals
1. Replace the current Operations `.filters-bar` with a compact Jira-style **Filter** button + dropdown (two-pane category/value picker, active-filter badge, clear action).
2. Add a **Group** dropdown on the left side of the same toolbar row with options **None / Assignee / Client**.
3. Keep the existing **view-mode toggle** (Table / Board / List) on the right side of the same row.
4. Remove the previous full-width filter row so the whole toolbar is one compact sticky row.
5. When grouped by **Assignee** or **Client** in Board view, render columns as groups and show **phase label headings** inside each column that stick while scrolling, with lower headers pushing/replacing the current sticky header (Jira-style stacked headers).

## Reference interpretation
- Image #1/#2 show a compact **Filter** button with a count badge. Clicking it opens a two-pane dropdown: left pane lists filter categories (**Assignee, Status, Client, Fund**), right pane shows a searchable checkbox list for the selected category with a per-category clear action and footer count.
- Image #3 shows a **Group** button dropdown with options **None, Assignee, Client** and a checkmark on the active option.
- The existing system-wide Operations filters are Priority, Employee, Client, Due Date range, and Status. These map to the reference as:
  - **Assignee** → primary WR owner + task assignees.
  - **Status** → WR status.
  - **Client** → linked client.
  - **Fund** → fund source of linked disbursements (`fundSource` / `Client Fund` / `Firm Fund`).
- Due date filtering will move into the Filter dropdown as well (a simple date-range picker in the right pane when a "Due date" category is selected) or, to keep the first iteration focused, be retained as a compact pair of date inputs inside the new toolbar row. For this plan we keep it inline to avoid over-building the dropdown.

## Files to modify
- `js/workflow.js` — replace the Operations `renderList()` filter bar with the compact toolbar; add the Jira-style filter dropdown component; add group-by state and pass it to `refreshBoard()`; update `refreshBoard()` to support grouped columns with phase sections.
- `js/kanban.js` — extend `KanbanBoard.render()` to optionally render per-column sections (sticky phase sub-headers) when a column provides a `sections` array.
- `css/styles.css` — add styles for the compact toolbar row, Jira filter dropdown, Group dropdown, and sticky phase section headers inside grouped board columns.

## Implementation approach

### 1. Compact toolbar row (Operations list view)
In `Workflow.renderList()`:
- Remove the old `.filters-bar` containing Priority/Employee/Client/Date/Status selects.
- Create a single `.toolbar-sticky-container` row laid out as:
  - **Left**: `Group` dropdown button (None / Assignee / Client).
  - **Center-left**: `Filter` button with an active-filter count badge. A `Clear filters` text button appears only when filters are active.
  - **Right**: existing compact `view-mode-toggle` (Table / Board / List).
- Persist group-by selection in `sessionStorage` via a new helper `App.getGroupBy('operations')` / `App.setGroupBy('operations')`.

### 2. Jira-style filter dropdown
Build an inline dropdown component in `js/workflow.js` (no new global component unless it proves reusable):
- Left pane lists categories: **Assignee, Status, Client, Fund**.
- Right pane renders:
  - A search input.
  - Checkbox items for every distinct value in the current entity scope.
  - An "Unassigned" option for Assignee.
  - Footer showing selected count and a `Clear` link for the active category.
- A bottom `Clear all` link clears every active filter.
- Active filters are stored in an object `{ assignee: Set, status: Set, client: Set, fund: Set }`. The badge on the Filter button shows the total selected count.
- Value derivation:
  - **Assignee**: all users in scope + any `assigneeName` found on WR tasks + an explicit "Unassigned" option.
  - **Status**: `Draft, Pre-processing, Processing, Billing, Disbursement, Completed`.
  - **Client**: clients in the active entity scope.
  - **Fund**: distinct resolved fund sources from disbursements linked to WRs in scope (`Firm Fund`, `Client Fund`, plus any custom `fundSource`).
- The `refresh()` function applies the active filter object instead of the old individual selects.

### 3. Group-by dropdown
- A simple button dropdown with options **None**, **Assignee**, **Client**.
- Selecting an option closes the dropdown and re-renders the board.
- The selected option shows a checkmark and is persisted per module.

### 4. Board grouping with sticky phase headers
Update `Workflow.refreshBoard()`:
- Read `groupBy` from the toolbar state.
- If `groupBy === 'none'`, keep the existing phase-column board.
- If `groupBy === 'assignee'` or `'client'`:
  - Compute distinct groups from the filtered WRs.
  - Build a Kanban board where each column = one group (assignee/client).
  - Within each column, pass a `sections` array to `KanbanBoard.render()` keyed by phase (`Draft`, `Pre-processing`, `Processing`, `Billing/Disbursement`, `Completed`).
  - Each section renders its own cards and a sticky phase header.
  - Column headers show the group name + WR count; drag-and-drop is disabled in grouped mode for this iteration to keep scope manageable.

Extend `KanbanBoard.render()`:
- Accept an optional `sections` array on a column config.
- When present, render the column header as usual, then inside `.board-cards-scroll` render each section with a `.board-phase-section` wrapper and a `.board-phase-header` sticky header.
- Empty sections are skipped unless they are the only section (in which case show a compact empty state).

### 5. Sticky header behavior
Add CSS for grouped columns:
```css
.board-phase-section { margin-bottom: var(--space-3); }
.board-phase-header {
  position: sticky;
  top: calc(var(--operations-title-bar-height, 48px) + var(--operations-tab-nav-height, 45px) + var(--operations-toolbar-height, 0px) + var(--board-column-header-height, 56px));
  z-index: 30;
  background: var(--color-bg-light);
  padding: 8px 12px;
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
}
```
Because all phase headers share the same `top`, they naturally stack and push the previous header up as the user scrolls, matching Jira's swimlane headers.
Set a default `--board-column-header-height: 56px` and adjust for other modules if the grouped board is later adopted elsewhere.

### 6. Table and List views with grouping
- For the first iteration, grouping only affects the **Board** view. Table/List views ignore `groupBy` and continue to render a flat list (same as current behavior). This keeps the change focused and avoids reworking the table/list renderers.

### 7. Persistence
- Active filters object is saved to `sessionStorage` under `erp_filters_operations_v2` so the dropdown restores on reload.
- Group-by selection is saved to `sessionStorage` under `erp_group_operations`.
- A future `App.clearSavedFilters('operations')` call clears both.

## Verification
- Open Operations → Board view. Confirm the toolbar is one row with Group, Filter (badge), Clear filters, and view toggle.
- Open the Filter dropdown: categories list on left, values on right, search works, checkboxes apply, badge updates.
- Select Group by Assignee: board columns become assignees; inside each column cards are grouped by phase with sticky phase headers.
- Scroll a grouped column: confirm lower phase headers push the current sticky header up and replace it.
- Switch to Table/List: view renders correctly and group-by is ignored.
- Click Clear filters: badge disappears and all results return.

## Risks / notes
- The **Fund** filter for Work Requests is derived from linked disbursements. If a WR has no linked disbursements, it will not match any Fund filter. If this is not the intended semantics we can replace "Fund" with "Priority" in a follow-up.
- Drag-and-drop in grouped board mode is disabled in this iteration because mapping WR status changes across group columns is ambiguous.
- The sticky `top` offset for phase headers assumes the measured column header height stays close to 56px. If header content changes, the CSS variable should be updated via `App.updateStickyOffsets`.
