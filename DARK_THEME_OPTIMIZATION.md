# Dark Theme Optimization — ATA & LTA ERP

## Goal
Polish the existing black/Notion-inspired dark theme so every element is readable, synergizes with the rest of the page, and follows modern ERP/UI UX practices. The base canvas (`#191919`) and the purple primary accent (`#d4b8ff`) were kept as requested.

## Research summary
The optimization is grounded in four modern dark-mode principles that are especially relevant to accounting/ERP dashboards:

1. **Avoid pure white on pure black.** Notion’s own dark text is a warm near-white (`#FFFCEF`) on a near-black canvas (`#191919`). Pure `#FFFFFF` creates excessive contrast and halation, which is fatiguing during long sessions.
2. **Use lifted surfaces for elevation.** Cards, sidebars, and panels should be visibly lighter than the canvas so they don’t blend into one flat plane. Notion uses `#252525` / `#2F2F2F` for surfaces; SAP Quartz Dark and modern B2B dashboards do the same.
3. **Borders need real separation.** Subtle borders that match the surface color make inputs and cards disappear. A slightly warmer, lighter border (`#4A4A4A`) gives structure without adding visual weight.
4. **Dark-mode buttons should look dark-themed, not inverted.** Light grey secondary buttons (`#D4D4D8`) look like light-mode leftovers. Colored primary/success/warning/danger buttons need dark text for contrast, but ghost/outline/link buttons should remain in the dark palette.

Sources consulted:
- [Notion Design System — ColorFYI](https://colorfyi.com/blog/notion-brand-colors/)
- [Notion Colors Hex Codes — Matthias Frank](https://matthiasfrank.de/en/notion-colors/)
- [Designing for Dark Mode in B2B Contexts — Empirium](https://empirium.io/blog/dark-mode-b2b-design)
- [SAP Fiori Quartz Dark Colors](https://www.sap.com/design-system/fiori-design-web/v1-84/foundations/visual/colors/quartz-dark-colors)
- [Dark Mode Design Guide: Color, Type, A11y — Mantlr](https://mantlr.com/blog/dark-mode-design-guide-color-typography-accessibility)
- [How to Build an Accessible Dark Mode Color Palette — Theme & Color](https://themeandcolor.com/blog/accessible-dark-mode-color-palette)

## What changed

### 1. Global dark palette (`[data-theme="dark"]`)
| Token | Before | After | Rationale |
|-------|--------|-------|-----------|
| `--color-bg` | `#191919` | `#191919` | Kept as the Notion black base. |
| `--color-surface` | `#202020` | `#252525` | Surfaces now lift off the canvas. |
| `--color-bg-muted` | `#262626` | `#2F2F2F` | Clearer hover/elevated states. |
| `--color-text` | `#ffffff` | `#f4f4f5` | Warm off-white; less eye strain. |
| `--color-text-muted` | `#9ca3af` | `#a1a1aa` | Warmer grey that matches the neutral palette. |
| `--color-border` | `#2f2f2f` | `#4a4a4a` | Borders are now visible on dark surfaces. |
| `--color-primary` | `#d4b8ff` | `#d4b8ff` | Kept. |
| `--color-primary-dark` | `#b388ff` | `#b388ff` | Kept. |
| `--color-primary-alpha` | `rgba(212,184,255,.12)` | `rgba(212,184,255,.14)` | Slightly stronger focus/hover glows. |

New utility tokens added to both `:root` and the dark theme: `--color-bg-hover` and `--color-primary-light`. These fix previously undefined fallback values that rendered as light-mode colors in dark mode (e.g. `.multi-select-option:hover`, `.template-dropdown-item.active`).

### 2. Buttons
- Removed the blanket `color: #000000` on `.btn` that was making `.btn-link` nearly invisible and ghost buttons look mismatched.
- Primary / success / warning / danger buttons keep dark text (`#191919`) for contrast against the light purple/green/yellow/red backgrounds.
- Secondary buttons now use dark surfaces: `bg-muted` background, `border` border, light text.
- Ghost buttons are transparent with primary text and a subtle primary-alpha hover.
- Link buttons use the primary color and underline on hover (previously they were black on dark).
- Modal cancel buttons follow the same secondary styling.

### 3. Cards, boards, tables, lists
- Replaced hardcoded greys (`#525252`, `#404040`, `#262626`, `#2f2f2f`, `#9ca3af`, `#ffffff`) with CSS variables so colors stay consistent as the palette evolves.
- Board column headers, table headers, task rows, list items, and card V2 elements now reference `--color-bg-muted`, `--color-border`, and `--color-text-muted`.
- Table hover rows use `--color-bg-muted`.

### 4. Side pane & redesign views
- The scoped `.side-pane` dark variables were aligned with the global palette (`#252525` surface, `#f4f4f5` text, `#4a4a4a` border).
- Local redesign tokens (`--bg`, `--surface`, `--fg`, `--border`, etc.) inside `.project-detail-v2` and `.side-pane` are now overridden in dark mode so the redesign pages stay consistent.
- Side-pane form fields, notion title inputs, file upload, dropdown carets, and view menus were switched from hardcoded `#191919`/`#ffffff`/`#2f2f2f` to the new variables.

### 5. Badges, lifecycle, chips, calendars, misc components
Added dark overrides for components that shipped hardcoded light-palette values:
- Entity badges (`badge-ata`, `badge-lta`, `badge-recurring`).
- Phase badges (`badge-draft`, `badge-preprocessing`, `badge-processing`, `badge-billing`, `badge-disbursement`, `badge-neutral`).
- Document lifecycle badges.
- DMS `doc-type-badge-*`.
- KPI LTA icon background.
- Co-assignee chips and assignee avatar initials.
- Calendar entity badges.
- Multi-select menus and searchable dropdowns.
- Modal message icon/text colors.
- Month/date picker header (dark text on light primary).
- Stage dots and progress steps.
- Nav notification badge.
- Calendar selected day, activity segments, redesigned calendar buttons.
- WR task detail panes, checklist rows, time logs.

## Preview
A standalone preview page was created at `dark-mode-preview.html` so you can open it in a browser, toggle `data-theme="dark"` on the root element, and inspect the components without starting the full app.

### 6. Critical JS inline styles
Several dynamically-rendered components used hardcoded light-mode inline styles that overrode the CSS variables. The highest-impact ones were converted to use CSS variables so they adapt to dark mode:
- **Pending-request banners** in `billing.js`, `transmittal.js`, and `disbursement.js` — removed the light-yellow gradient, replaced with `var(--color-bg-muted)` background and `var(--color-warning)` border.
- **Dashboard EOD reminder banner** (`dashboard.js`) — switched to muted background and warning border.
- **Transmittal letter preview** (`transmittal.js`) — replaced `#fff`/`#000` with `var(--color-surface)`/`var(--color-text)`.
- **Pending-for-release panel** (`disbursement.js`) — replaced warm pastel fills with theme variables.
- **Invoice rejection/pending banners** (`billing.js`) — now use `var(--color-bg-muted)` + semantic color borders.
- **Client accordion** (`clients.js`) — accordion content background and heading color now use theme variables.
- **Pending change request cards/tables** (`users.js`) — removed `background: white`/`#e2e8f0` borders and replaced text colors with `var(--color-text)` / `var(--color-text-muted)`.
- **Reports avatar border** (`reports.js`) — uses `var(--color-surface)` instead of `#fff`.

### 7. Operations table view & system-wide Board view polish
After the first pass, the Operations **Table** view was still rendering work-request titles with a hardcoded `#1e293b` inline color, making them invisible in dark mode. That was fixed by switching to `var(--color-text)` and converting the inline "Awaiting Approval" badges, blocker chips, and routing chips to use theme variables.

For the **Board** view, the dashed "+ Add …" cards in Operations and Billing were using `#94a3b8` (a light-mode slate) that blended into dark columns; they now use `var(--color-text-muted)` and transparent backgrounds. Subtitles and linked-work-request boxes across Operations, Billing, Disbursement, and Transmittal board cards were also converted from `#64748b`/`#1e293b`/`#1e40af` hardcoded values to `var(--color-text-muted)` / `var(--color-text)` / `var(--color-primary)` so they remain readable and harmonious. Board-card hover borders now lighten on hover instead of darkening.

## Notes
- No commits were made; all changes remain in `workspace-agentB`.
- The Playwright plugin was not used.
- Light mode was intentionally left untouched except for adding the two missing utility tokens (`--color-bg-hover`, `--color-primary-light`).
