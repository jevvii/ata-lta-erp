# Plan: Improve Dark-Mode Error Modals, Cancel Button Visibility, and Empty States

## Goals
1. Improve dark-mode colors of **all error modals** (danger/alert modals).
2. Improve **cancel button visibility** in the Work Request task-list view (operations table/list actions).
3. Improve empty state of the **system-wide board view** (operations board columns when no WRs match).
4. Improve all other empty states like **Related Financials & Documents** within the WR task-list detail view.
5. Fix empty states of **table, board, and list views** of the WR task-list view to handle the **no-results state from quick filter options** in the toolbar.
6. Ground all changes in **Notion-inspired modern ERP UI/UX** research.

## Research summary
- **Notion-style empty states** are minimal, text-only, and neutral. Filter/search empty states should never use illustrations or celebratory copy ([Northbase](https://www.northbase.design/patterns/empty-states), [DEV Community](https://dev.to/137foundry/why-the-empty-states-in-a-data-table-deserve-three-separate-designs-instead-of-one-generic-message-1il4)).
- **Filtered-empty vs. zero-state** need separate designs: filtered-empty should mention active filters and offer a "Clear filters" CTA; zero-state explains what goes here and offers a primary "Create" CTA ([Prism](https://prism-design.supernova-docs.io/latest/patterns/system-behavior/empty-states-9pR3nPit), [shadcn](https://www.shadcn.io/blocks/empty-state-no-filter-results)).
- **Dark-mode error modals**: avoid pure red text on dark surfaces (halation); use pale red tinted surface (`#450a0a` / `#7f1d1d`) with soft red icon/border (`#fca5a5` / `#fecaca`) and keep body text warm off-white (`#f4f4f5`) for readability ([RedHat](https://github.com/RedHat-UX/red-hat-design-system/blob/main/docs/foundations/color/accessibility.md), [Zepixo](https://www.zepixo.com/blog/how-to-build-an-accessible-color-system)).
- **Cancel button visibility**: secondary/cancel buttons in dark mode must have enough contrast against the modal surface; use a slightly lighter muted background (`--color-bg-muted`) with a visible border and warm text.

## Files to modify
- `css/styles.css` — new shared `.empty-state-v2` component, improved dark-mode modal danger styles, improved cancel button contrast, board/list/table empty-state dark polish.
- `js/workflow.js` — replace inline plain-text empty states with the new shared component; add "no results from filters" handling in WR task table/board/list/checklist views; improve cancel button styling/visibility in operations table; improve Related Financials & Documents empty states.
- `dark-mode-preview.html` — add error-modal and empty-state previews so the changes can be verified without running the full app.

## Implementation approach

### 1. Error modals (CSS)
- Introduce semantic tokens for error surfaces in dark mode: `--color-danger-bg: #450a0a`, `--color-danger-text: #fca5a5`, `--color-danger-border: #7f1d1d`.
- Style `.modal-message-wrapper.type-danger` in dark mode with:
  - tinted background (`var(--color-danger-bg)`),
  - soft border,
  - warm off-white body text (`var(--color-text)`),
  - softer red icon/border (`var(--color-danger-text)`).
- Keep the light-mode styling unchanged.

### 2. Cancel button visibility (CSS + JS)
- Ensure `.btn-secondary` / `.modal-btn-cancel` in dark mode sits clearly above modal/surface backgrounds (background `--color-bg-muted`, border `--color-border`, text `--color-text`; hover lifts to `--color-border` background).
- In `js/workflow.js` operations table/list actions, change the plain `btn-danger` cancel button for pending WRs to a more visible pattern: use `btn-secondary` with a danger text color, or add an icon and ensure it doesn't clash with nearby secondary buttons. This keeps destructive action visible without making the row look like a row of identical grey buttons.

### 3. Shared empty-state component (CSS)
Create `.empty-state-v2` with two variants:
- **Zero state**: subtle icon/illustration (monochrome), headline, body, primary CTA.
- **Filtered-empty state**: small search/filter icon, "No results" headline, body naming active filters, "Clear filters" text/link CTA.
Dark-mode overrides will use `--color-bg-muted`, `--color-border`, and `--color-text-muted` for a Notion-style muted surface.

### 4. System-wide board view empty state (JS)
In `Workflow.refreshBoard()`:
- When the whole board has no WRs after filters, show a centered `.empty-state-v2.filtered-empty` with a "Clear filters" action that calls `App.clearSavedFilters('operations')` and re-renders.
- When individual columns are empty, keep the current minimal "No work requests" message but style it consistently with the new component.

### 5. WR task-list view empty states (JS)
In the detail task-list renderer (`renderDetail` → `renderGroups`):
- Detect whether tasks exist but the current combination of search, employee filter, and quick filter chips yields zero results.
- For **table view** and **grouped table view**: if `filteredTasks.length === 0`, replace the group loop with `.empty-state-v2.filtered-empty` and a "Clear filters" CTA.
- For **board view**: if `filteredTasks.length === 0`, show a single board-level `.empty-state-v2.filtered-empty` instead of six empty columns.
- For **list view**: if `filteredTasks.length === 0`, show `.empty-state-v2.filtered-empty`.
- For **checklist view**: already has a basic empty state; upgrade it to `.empty-state-v2.filtered-empty` when filters are active, otherwise `.empty-state-v2.zero-state`.

### 6. Related Financials & Documents empty state (JS)
Replace the plain `<p class="empty-state">` messages with the new `.empty-state-v2.zero-state` style, preserving the card grid layout. Add tiny monochrome icons per column (invoice, expense, transmittal) to aid scannability while staying Notion-minimal.

### 7. Verification
- Update `dark-mode-preview.html` with a new section containing:
  - an error modal example,
  - a filtered-empty state example,
  - a zero-state example,
  - a Related Financials empty-state example.
- Open the preview page in a browser to confirm dark-mode readability.

## Out of scope
- No Playwright plugin usage.
- No commits.
- Light-mode styles remain functionally unchanged (only adding shared component classes).

## Success criteria
- [ ] Dark-mode error modals are readable, with softer red accents and warm body text.
- [ ] Cancel/secondary buttons in dark mode have visible borders and readable text.
- [ ] Operations board view shows a helpful empty state when filters produce no WRs.
- [ ] WR task-list table/board/list/checklist views distinguish "no tasks at all" from "filters returned no results".
- [ ] Related Financials & Documents empty states are consistent and visually polished.
- [ ] All changes remain in `workspace-agentB` and are previewable in `dark-mode-preview.html`.
