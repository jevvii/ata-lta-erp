# Side-Panel Redesign Specification
## Notion-inspired, system-wide detail & form panel for ATA & LTA ERP

**Date:** 2026-07-03  
**Scope:** All forms and detail views that currently use `SidePaneInstance.open(...)` or `openFormPanel(...)` in the ERP.  
**Constraint:** No Playwright test runs; all work must remain uncommitted.

---

## 1. Executive Summary

The ERP already has a global right-side panel (`SidePane` in `js/utils.js`) used for both **record previews** (task details) and **data-entry forms** (clients, work requests, invoices, expenses, transmittals, templates). The current implementation is visually close to Notion but lacks Notion’s core interaction model: users cannot choose *how* they want to open a record — side peek, center peek, full page, or new tab — and the system does not remember that preference.

This spec redesigns the panel so that:

1. **Every form and detail view can be opened in four modes** matching the user-provided image: Side peek, Center peek, Full page, and New tab, plus a per-context default that users can edit.
2. **The panel stays non-modal in Side peek** so the source list remains usable (true Notion behavior), while Center peek becomes a focused, accessible modal dialog.
3. **All forms keep their current Notion-style title icon + sticky footer** (an ERP "ease of use" addition over vanilla Notion), but gain a consistent header with breadcrumbs, view-mode menu, resize handle, and keyboard shortcuts.
4. **The migration is backward-compatible**: existing `openFormPanel(...)` and `SidePaneInstance.open(...)` calls continue to work; new options are optional and default to Side peek or a persisted preference.
5. **Known bug and vulnerability risks are closed**, not carried forward.

---

## 2. Current State Audit

### 2.1 Files that own the panel

| File | Role |
|------|------|
| `js/utils.js:529` | `class SidePane` — singleton, DOM creation, open/close, click-outside, ESC. |
| `js/utils.js:702` | `openFormPanel(...)` — wraps a rendered form with Notion-style title + sticky footer. |
| `js/utils.js:761` | `closeFormPanelAndRoute(...)` — closes panel and optionally reloads the page. |
| `css/styles.css:8100` | `.side-pane-*` styles, toggle sections, form-in-panel overrides, embed popover. |
| `js/app.js:412` | `handleRoute()` closes the side pane on every route change. |

### 2.2 Call sites that open the panel

| Module | File | Lines | Usage |
|--------|------|-------|-------|
| Clients | `js/clients.js` | 240, 458, 584 | `openFormPanel` for Add/Edit Client. |
| Workflow | `js/workflow.js` | 1794, 2161, 8054, 8093, 3285, others | `openFormPanel` for Work Request / retainer template forms; direct `SidePaneInstance.open` for **task detail side pane**. |
| Billing | `js/billing.js` | 1069, 2550, 2626 | `openFormPanel` for invoice form and billing template form. |
| Disbursement | `js/disbursement.js` | 36, 255, 2188 | `openFormPanel` for expense form; manual side-pane content for disbursement template form. |
| Transmittal | `js/transmittal.js` | 598, 854 | `openFormPanel` for transmittal create/edit. |

### 2.3 What works today

- Single shared DOM element (`#global-side-pane`) appended to `<body>`.  
- Animated slide-in from the right (`transform: translateX(100%) → 0`).  
- Notion-style title icon, collapsible sections, and properties grid for task details.  
- `activeElement` outline on the source row/card so users know which record is open.  
- ESC closes the panel.  
- Expand-to-full-page callback is supported but only used when callers pass `onExpand`.

### 2.4 Gaps vs. Notion (and vs. the requested image)

| Gap | Risk / UX Impact |
|-----|------------------|
| Only one width (50vw) and no resize handle. | Users with wide monitors waste space; users on small laptops get cramped forms. |
| No Center peek mode. | Long forms in a side drawer force horizontal scrolling; quick edits steal too much context. |
| No Full-page or New-tab escape hatch. | Users cannot open a record in the main canvas or in a second browser tab for side-by-side comparison. |
| No per-module view default. | Users repeatedly have to resize or re-route manually. |
| Click-outside whitelist is a hardcoded class list. | New card/row styles accidentally close the pane; conversely, clicks inside custom popovers (date picker, dropdown) are manually excluded. |
| No focus management or ARIA roles. | Center-peek forms are inaccessible to keyboard / screen-reader users. |
| `closeFormPanelAndRoute(msgConfig)` does `location.reload()`. | Loses background scroll position, filter state, and pending edits; heavy for a toast notification. |
| `SidePane.open` accepts raw HTML strings. | Any future caller passing user input creates an XSS surface. |
| Forms manually duplicate header bars and footers. | `renderForm()` often builds a `form-header-bar` that `openFormPanel` then hides via CSS `display:none !important`. |

---

## 3. Design Principles (Notion + ERP ease-of-use)

1. **Context first.** Side peek keeps the source list visible and interactive; the panel is a secondary, non-modal surface.
2. **Escalation paths.** Every record must be openable in a larger surface: Center peek for focused edits, Full page for deep work, New tab for parallel comparison.
3. **User owns the default.** The last explicit mode choice for a context becomes the default, persisted per user + entity.
4. **Keyboard parity.** `Esc` closes, `Cmd/Ctrl + Enter` submits the primary action, `Cmd/Ctrl + .` cycles view modes, `Cmd/Ctrl + Shift + Enter` opens in a new tab.
5. **Backward compatibility.** Existing callers do not break; new behavior is opt-in via a richer options object.
6. **No full-page reload for routine save/cancel.** Soft navigation + toast where possible; reload only when truly required by legacy state sync.

---

## 4. Proposed Architecture

### 4.1 View modes

| Mode | Visual | Backdrop | Focus trap | Behavior |
|------|--------|----------|------------|----------|
| `side-peek` | Right drawer, width variable (default 50vw, min 420px, max 85vw) | None / very subtle shadow only | No | Source list remains interactive. Resize handle on left edge. |
| `center-peek` | Centered panel, max-width 720px, max-height 85vh, rounded corners | Visible dimmed overlay (`pointer-events:auto` on overlay) | Yes | Blocks background; ESC closes; focus returns to trigger. |
| `full-page` | No panel; main canvas shows the form/detail route | N/A | N/A | Closes panel, navigates to `#module/form/:id` or `#module/detail/:id`, `App.handleRoute()` renders full-page. |
| `new-tab` | Same as full-page, but in a new browser tab | N/A | N/A | Opens `window.open(location.href)` (same origin) with `noopener,noreferrer`; target tab renders full-page. |

### 4.2 View context

Every pane opening is tagged with a `viewContext` string, e.g.:

- `client-form`
- `work-request-form`
- `invoice-form`
- `expense-form`
- `transmittal-form`
- `billing-template-form`
- `disbursement-template-form`
- `task-detail`

The context is used to:

1. Look up the user’s persisted default mode: `localStorage.getItem('erp_pane_default_<viewContext>')`.
2. Label the "Edit view default" menu item: *"Set default for task detail"*.
3. Scope analytics / smoke-test selectors if needed later.

### 4.3 Default resolution order

When a caller does **not** pass `mode`:

1. If `viewContext` is provided and a valid persisted default exists, use it.
2. Otherwise fall back to `side-peek`.

When the user changes mode via the menu, the panel switches immediately. If they choose **Edit view default**, that mode is persisted for the current `viewContext` and applies to future opens.

### 4.4 New-tab deep linking

For `new-tab`, the URL opened is simply the current `location.href` (same hash). The new tab already renders the module in full-page mode because `App.handleRoute()` reads `view === 'form' / 'detail'` from the hash. No extra query parameter is required for forms/details that already have routes.

For **task detail** (which has no dedicated route), selecting New tab will open `#operations/detail/<wrId>` and scroll/highlight the task row.

---

## 5. API Changes

### 5.1 `SidePane` class (`js/utils.js`)

```js
const PaneMode = {
  SIDE_PEEK: 'side-peek',
  CENTER_PEEK: 'center-peek',
  FULL_PAGE: 'full-page',
  NEW_TAB: 'new-tab'
};

class SidePane {
  open({
    title,
    content,
    mode,                 // 'side-peek' | 'center-peek' | 'full-page' | 'new-tab'
    viewContext,          // e.g. 'task-detail'
    recordId,             // for active-element sync
    triggerElement,       // source row/card
    fullPageRoute,        // hash to navigate to for full-page / new-tab
    newTabRoute,          // optional override for new-tab URL
    onClose,
    onExpand              // kept for compatibility; equivalent to full-page
  }) { ... }

  close() { ... }
  isOpen() { ... }
  setMode(mode) { ... }        // switches an already-open pane between side-peek / center-peek
  getMode() { ... }
  getViewContext() { ... }
}
```

### 5.2 `openFormPanel` helper

```js
function openFormPanel({
  icon,
  title,
  formContent,
  formId,
  actions,
  mode,
  viewContext,        // required for default persistence
  fullPageRoute,      // e.g. '#clients/form/new'
  newTabRoute         // optional
}) { ... }
```

`openFormPanel` still wraps the form with the Notion-style title section and sticky footer. The footer primary action is moved to the **right** (Notion/ERP convention), with Cancel on the left.

### 5.3 `closeFormPanelAndRoute` (backward-compatible)

Signature remains the same, but internally:

- If `messageConfig` is provided and the current module already supports soft toast + `App.handleRoute()`, prefer that over `location.reload()`.
- If a full-page reload is unavoidable, save background scroll position in `sessionStorage` and restore it after reload.

---

## 6. CSS Changes

### 6.1 Mode modifiers

```css
.side-pane {
  --pane-width: 50vw;
  position: fixed;
  top: 0;
  right: 0;
  width: var(--pane-width);
  height: 100vh;
  z-index: 1000;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              width 0.2s ease;
}

.side-pane--side-peek {
  transform: translateX(100%);
}
.side-pane--side-peek.open {
  transform: translateX(0);
}

.side-pane--center-peek {
  left: 50%;
  right: auto;
  top: 7vh;
  transform: translate(-50%, -20px);
  width: min(720px, 92vw);
  height: auto;
  max-height: 86vh;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  opacity: 0;
  pointer-events: none;
}
.side-pane--center-peek.open {
  transform: translate(-50%, 0);
  opacity: 1;
  pointer-events: auto;
}

.side-pane-overlay {
  display: block;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.25);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 999;
}
.side-pane-overlay.open {
  opacity: 1;
  pointer-events: auto;
}
/* side-peek does NOT use the dimmed overlay */
.side-pane--side-peek ~ .side-pane-overlay,
body:has(.side-pane--side-peek.open) .side-pane-overlay.open {
  opacity: 0;
  pointer-events: none;
}
```

### 6.2 Header with view-mode menu

```css
.side-pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  flex-shrink: 0;
  gap: 8px;
}
.side-pane-header-left { display:flex; align-items:center; gap:6px; }
.side-pane-header-right { display:flex; align-items:center; gap:6px; }

.side-pane-view-menu-btn { /* icon-only button */ }
.side-pane-view-menu {
  position: absolute;
  top: 44px;
  right: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  padding: 6px;
  min-width: 200px;
  z-index: 1001;
}
```

### 6.3 Resize handle (side-peek only)

```css
.side-pane-resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: col-resize;
  z-index: 1002;
  background: transparent;
}
.side-pane-resize-handle:hover,
.side-pane-resize-handle.active {
  background: rgba(47, 111, 235, 0.25);
}
```

### 6.4 Forms in center-peek

In `center-peek` the body should not have bottom padding for a sticky footer because the panel has rounded corners and max-height; the footer can remain sticky inside the panel.

---

## 7. Module-by-Module Migration

### 7.1 `js/utils.js` — core panel

- Add `PaneMode` constants and `getPaneDefault(viewContext)` / `setPaneDefault(viewContext, mode)` helpers.
- Refactor `SidePane`:
  - Accept `mode`, `viewContext`, `recordId`, `triggerElement`, `fullPageRoute`, `newTabRoute`.
  - Resolve mode from persisted default if omitted.
  - For `full-page` / `new-tab`, do not render the panel; route instead.
  - Build header with close, view-menu, and title breadcrumb.
  - Render view-mode popover with the five items from the image.
  - Implement resize handle + persisted width per context.
  - Implement center-peek focus trap and focus return.
  - Replace hardcoded click-outside class whitelist with `data-pane-trigger="true"` or `closest('[data-pane-trigger]')`.
- Update `openFormPanel` to pass new options.
- Update `closeFormPanelAndRoute` to avoid reload where possible.

### 7.2 `js/app.js`

- `handleRoute()` already closes the pane; keep that.
- Add a post-route helper to scroll to a task row when a pane opens from task detail in full-page/new-tab.

### 7.3 `js/clients.js`

- `showForm(clientId)`:
  - `viewContext: 'client-form'`
  - `fullPageRoute: isNew ? '#clients/form/new' : '#clients/form/' + clientId`
  - Remove the duplicate `form-header-bar` from `renderForm` (optional cleanup).

### 7.4 `js/workflow.js`

- WR forms via `openFormPanel`:
  - `viewContext: 'work-request-form'`
  - `fullPageRoute: '#operations/form/' + (this.editingId || 'new')`
- Retainer template forms:
  - `viewContext: 'retainer-template-form'`
  - `fullPageRoute: '#operations/templateForm/' + (this.templateEditingId || 'new')` — may need a new route in `app.js`.
- Task detail side pane:
  - `viewContext: 'task-detail'`
  - `recordId: task.id`
  - `fullPageRoute: '#operations/detail/' + wr.id` (with task highlight).
  - `triggerElement` already passed.

### 7.5 `js/billing.js`

- Invoice form: `viewContext: 'invoice-form'`, `fullPageRoute: '#billing/form/' + (invoiceId || 'new')`.
- Billing template form: `viewContext: 'billing-template-form'`, full-page route may require a new hash segment.

### 7.6 `js/disbursement.js`

- Expense form: `viewContext: 'expense-form'`, `fullPageRoute: '#disbursement/form/' + (disbId || 'new')`.
- Disbursement template form currently uses manual pane content; migrate to `openFormPanel` or pass the same `viewContext` + full-page route.

### 7.7 `js/transmittal.js`

- Transmittal form: `viewContext: 'transmittal-form'`, `fullPageRoute: '#transmittal/form/' + (txId || 'new')`.

---

## 8. Vulnerability & Bug Risk Register

| Risk | Current Evidence | Mitigation in redesign |
|------|------------------|------------------------|
| **XSS via string content** | `SidePane.open` sets `this.body.innerHTML = content` if string (`utils.js:653`). | Reject string `content`; require `HTMLElement` or `DocumentFragment`. Provide an explicit `unsafeHtml` escape hatch for legacy code and audit it. |
| **Hardcoded click-outside whitelist** | `utils.js:579-595` lists classes like `.board-card`, `.list-item`, `.task-row`. New card/row styles break this. | Use `data-pane-trigger="true"` on any element that should keep the pane open. Update existing triggers to add the attribute. |
| **Event listener leaks** | Every form creates buttons with inline `addEventListener`; pane innerHTML is wiped on close but closures may retain DOM references. | On `close()`, call a caller-supplied `onClose` and provide a `destroy()` hook so complex forms can remove listeners / observers. |
| **Full-page reload on save/cancel** | `closeFormPanelAndRoute(hash, msgConfig)` calls `triggerSyncReload` → `location.reload()` (`utils.js:743`). | Prefer `App.handleRoute()` + toast. Reload only when a module explicitly requires it, and restore scroll position. |
| **No focus trap / restoration** | Center-peek does not exist; existing panel is non-modal and does not manage focus. | Center-peek traps focus, returns focus to `triggerElement` on close, and sets `aria-modal="true"`. Side-peek uses `role="region"` + `aria-labelledby`. |
| **Duplicate IDs** | Multiple forms use `#client-form`, `#invoice-form`, etc. If two instances existed simultaneously (new tab), IDs would clash. | New tab opens a separate document, so no clash. Within one document, ensure old pane DOM is destroyed before new open. Add runtime warning if duplicate IDs detected. |
| **Unvalidated localStorage defaults** | New persistence feature reads from `localStorage`. | Whitelist valid modes; ignore unknown values; store under `erp_pane_default_<context>`; sanitize context string. |
| **Race conditions on rapid open/close** | `open()` calls `close()` synchronously and then rewrites `innerHTML`; CSS transition may still be running. | Add an `isAnimating` lock and `requestAnimationFrame`/`transitionend` gating. Debounce rapid clicks. |
| **Mobile layout** | Current pane becomes 100vw below 900px with no modal behavior. | Side-peek becomes full-width sheet; Center-peek becomes full-screen modal with safe insets. |
| **New-tab security** | `window.open` with user-controlled URL could be abused. | Only open same-origin URLs constructed from known route patterns; use `noopener,noreferrer`. |

---

## 9. Implementation Phases

### Phase 1 — Core refactor (this session)

1. Update `js/utils.js`:
   - `PaneMode`, default persistence helpers, new `SidePane` class.
   - New `openFormPanel` signature.
2. Update `css/styles.css`:
   - Mode modifiers, header view menu, resize handle, center-peek overlay.
3. Update `js/app.js`:
   - Keep pane-close-on-route; add task-highlight scroll helper.
4. Update one representative caller from each module to exercise the new API.

### Phase 2 — Caller migration

- Migrate every `openFormPanel` and `SidePaneInstance.open` call to pass `viewContext` and `fullPageRoute`.
- Remove duplicate `form-header-bar` elements from form renderers where `openFormPanel` hides them.

### Phase 3 — Hardening

- Close the XSS, click-outside, focus-trap, and reload risks listed in §8.
- Add keyboard shortcuts.
- Add runtime duplicate-ID warning.

### Phase 4 — QA

- Manual smoke tests per module.
- Accessibility keyboard walk-through.
- Responsive checks.
- **Do not run Playwright per user instruction.**

---

## 10. Appendix: Iconography for the View Menu

Match the user-provided image with these SVG icons:

| Item | Icon | Notes |
|------|------|-------|
| Side peek | Monitor with right-side panel | Default for table/board/list. |
| Center peek | Monitor with centered panel | Default for gallery/calendar. |
| Full page | Monitor fullscreen | Opens in main canvas. |
| New tab | Folder / tab icon | Opens same route in new browser tab. |
| Edit view default | Sliders / toggles icon | Persists current mode as default for this `viewContext`. |

---

## 11. Appendix: Quick Code Sketch

```js
// utils.js
function getPaneDefault(viewContext) {
  const valid = Object.values(PaneMode);
  try {
    const stored = localStorage.getItem(`erp_pane_default_${viewContext}`);
    return valid.includes(stored) ? stored : null;
  } catch (e) { return null; }
}

function setPaneDefault(viewContext, mode) {
  try {
    localStorage.setItem(`erp_pane_default_${viewContext}`, mode);
  } catch (e) { /* ignore quota errors */ }
}
```

```js
// Example caller update in clients.js
openFormPanel({
  icon: '🏢',
  title: isNew ? 'Add Client' : (client?.name || 'Edit Client'),
  formContent: formContainer,
  formId: 'client-form',
  viewContext: 'client-form',
  fullPageRoute: isNew ? '#clients/form/new' : `#clients/form/${clientId}`,
  actions: [ ... ]
});
```

---

## 12. Decision Log

- **Keep sticky footer in Side/Center peek:** Yes. Notion pages do not use footers, but ERP data-entry forms benefit from always-visible primary/cancel actions. This is our explicit "ease of use" addition.
- **Backdrop for Side peek:** No. Notion keeps the database visible and interactive; a dimmed overlay would incorrectly imply modality.
- **New tab opens same hash, no extra params:** Yes, because `#module/form/:id` and `#module/detail/:id` already render full-page. Task detail falls back to WR detail + scroll.
- **Persist defaults per `viewContext`, not per module:** Yes. Users may want invoices in Center peek but task details in Side peek.
- **Do not run Playwright or commit:** Per user instruction.

---

## 13. Implementation Status (2026-07-03 session)

Implemented without committing:

1. **Core `js/utils.js` refactor**
   - `PaneMode` constants + `getPaneDefault`/`setPaneDefault` persistence.
   - New `SidePane` class with side-peek, center-peek, full-page, new-tab behavior.
   - View-mode menu matching the user image.
   - Resize handle + persisted width.
   - Center-peek focus trap + focus restoration.
   - Click-outside `_ignoreNextClick` guard so trigger buttons don't immediately close the pane.
   - String-content XSS guard: `SidePane.open` now rejects raw strings.
2. **CSS additions in `css/styles.css`**
   - Mode modifiers, center-peek overlay, resize handle, view menu styling, responsive rules.
3. **Caller migration**
   - `clients.js`, `workflow.js` (WR forms + task detail + retainer templates), `billing.js`, `disbursement.js`, `transmittal.js` all now pass `viewContext`.
   - `app.js` route handler extended for `#operations/templateForm/:id`.
4. **Known remaining gaps**
   - Billing template and disbursement template forms have no dedicated full-page route yet; side/center peek works, but selecting Full page / New tab from their menu logs a warning.
   - `closeFormPanelAndRoute` still uses `location.reload()` when `messageConfig` is supplied; soft-navigation improvement is documented in §8 but not implemented to avoid breaking existing smoke-test assumptions.
   - `data-pane-trigger` attribute is supported by the panel but not yet applied to every trigger element; legacy class whitelist still covers current triggers.
