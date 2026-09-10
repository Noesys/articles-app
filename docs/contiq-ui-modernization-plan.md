# Contiq UI Modernization Plan

> **Design Read:** Contiq is an **admin / product app** (articles scoring, Users DataGrid, insights)—not a landing page. Target language: Linear / Notion / Stripe Dashboard / Vercel admin, on existing **shadcn + ReUI DataGrid**, preserving Contiq brand (Geist, slate, indigo).

**Honesty (tasteskill §13):** No heroes, bento, marquees, or marketing choreography. Elevate post-antd→ReUI surfaces that still feel basic.

---

## Progress

| Phase | Status | Notes |
|---|---|---|
| **A** — Tokens + spacing/type/radius/border | [x] Complete | Tokens + high-leverage primitives |
| **B** — Shell (headers, page chrome, filters) | [ ] Not started | |
| **C** — DataGrid system polish | [ ] Not started | Keep soft slate borders (`9cb80bf`) |
| **D** — Forms, dialogs, selects, toasts | [ ] Not started | Dialogs may use `rounded-md` |
| **E** — Micro-interactions (no route fade) | [ ] Not started | Component-level only |
| **F** — Empty/loading/error + a11y | [ ] Not started | |
| **G** — Verification + deploy | [ ] Not started | Deploy after review |

---

## 1. Dials

| Dial | Value | Why |
|---|---|---|
| `DESIGN_VARIANCE` | **4** | Predictable shell, left-aligned titles, consistent filter rows |
| `MOTION_INTENSITY` | **4** | Hover, focus, dialog enter/exit only—no scroll-hijack or loops |
| `VISUAL_DENSITY` | **7** | Data-first: dense tables, tight filter bars, readable cells |

---

## 2. Locked decisions

| Decision | Lock |
|---|---|
| **Primary** | Contiq **indigo** globally (`--primary` → indigo-600 family) |
| **Border radius** | Normalize to **`sm`** (`rounded-sm` / `--radius-sm`) across the board |
| **Dialog radius** | One step up (`rounded-md`) **only** when hierarchy needs it; default everything else to sm |
| **Borders** | Soft slate (`border-slate-200` / `--border: #e2e8f0`)—no black/`currentColor` regression; no random slate-300/400 mix |
| **Table headers** | **Sentence-case semibold** (`text-sm font-semibold text-slate-700`) |
| **Route fade** | **Off** (hard cuts); component-level motion only |
| **Brand** | Contiq logo, Geist, indigo accent—no AI-purple wash |
| **DataGrid borders** | Soft slate lock from `9cb80bf` must hold |

---

## 3. Radius + border normalization matrix

| Component | Radius | Border color |
|---|---|---|
| Button (shadcn + admin) | `rounded-sm` | transparent / `border-border` (outline) |
| Input / Textarea | `rounded-sm` | `border-input` → soft slate (`--border` / `#e2e8f0`) |
| Select trigger | `rounded-sm` | `border-input` → soft slate |
| Select content / popover | `rounded-sm` | ring/border soft slate |
| Badge (shadcn) | `rounded-sm` | transparent / `border-border` |
| Badge (admin status) | `rounded-sm` (status chips; **not** `rounded-full`) | ring inset semantic |
| Card / panel | `rounded-sm` | `border-slate-200` |
| DataGrid container | `rounded-sm` | `border-slate-200` / `--border` |
| DataGrid cells | n/a | `--border` `#e2e8f0` (forced; never `currentColor`) |
| Pagination active page | `rounded-sm` | soft slate fill, not black pill |
| Nav active pill | `rounded-sm` | indigo fill |
| Dialog / modal | `rounded-md` (hierarchy exception) | `ring-slate-200` / soft border |
| Avatar / progress track | `rounded-full` (shape requires it) | soft where bordered |
| Toast | `rounded-sm` | soft slate |

**Radius tokens (Phase A):**

```
--radius-sm: 0.375rem;   /* primary scale — prefer rounded-sm */
--radius: 0.375rem;      /* base = sm so legacy rounded-* calcs stay tight */
--radius-md: 0.5rem;     /* dialogs / hierarchy only */
--radius-lg: 0.5rem;
--radius-xl: 0.625rem;
```

**Border lock:** `--border: #e2e8f0` (slate-200). Prefer `border-border` or `border-slate-200`. Avoid `border-slate-300` / `border-slate-400` unless intentional contrast (e.g. focus)—do not mix randomly.

---

## 4. Target tokens (Contiq)

| Token | Role | Value direction |
|---|---|---|
| `--background` / page canvas | App bg | `#f3f4f6` |
| `--foreground` | Primary text | slate-900 `#0f172a` |
| `--card` | Elevated panels | `#ffffff` |
| `--border` | Soft lines | `#e2e8f0` **lock** |
| `--muted` | Header wash | slate-50 |
| `--muted-foreground` | Meta / email | slate-500 |
| `--primary` | CTA | indigo-600 `#4f46e5` |
| `--primary-foreground` | CTA text | white |
| `--ring` | Focus | indigo family ~40% |
| `--info` | Informational | indigo/sky—**not** violet |
| `--shadow-card` | Table/panel | tinted slate stack |
| `--shadow-overlay` | Modals | deeper tinted stack |
| `--header-height` | Shell | `3.25rem`–`3.5rem` (≤64px) |
| `--page-pad-x` / `--page-pad-y` | Page chrome | `1rem` / `2rem` md+; `1.25–1.5rem` |
| `--section-gap` | Title → toolbar → content | `1.25rem` / `1.5rem` |
| `--ease-out-contiq` | Motion | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--duration-fast` | Hover / press | `120ms` |
| `--duration-med` | Dialog | `180–220ms` |

### Typography rhythm

| Role | Spec |
|---|---|
| Page title | `text-2xl`–`text-[1.75rem] font-semibold tracking-tight text-slate-900` |
| Page subtitle / count | `text-sm text-slate-500` |
| Table header | `text-sm font-semibold text-slate-700` (sentence-case) |
| Body cell | `text-sm text-slate-700` |
| Secondary cell | `text-xs text-slate-500` |
| Scores | `tabular-nums` |

---

## 5. Phased plan

Suggested PR order: `A → B → C → D → E → F → G`. **A must land first.**

---

### Phase A — Design tokens + global spacing / type / radius / border

**Effort: M** · **Status: complete**

**Scope:** Unify Contiq tokens; indigo primary; sm radius; soft borders; Geist on body; remove dead `.ant-*`; motion vars + `prefers-reduced-motion`; soften highest-leverage primitives.

#### Checklist

- [x] Write durable plan file (`docs/contiq-ui-modernization-plan.md`)
- [x] Update `:root` Contiq semantic tokens in `article-app/src/index.css` (primary indigo, soft `--border`, muted/foreground slate)
- [x] Set `--radius` / `--radius-sm` so utilities resolve to **sm**; document md exception for dialogs
- [x] Add tinted `--shadow-card` / `--shadow-overlay`
- [x] Add motion vars (`--ease-out-contiq`, `--duration-fast`, `--duration-med`)
- [x] Add layout rhythm vars (`--header-height`, `--page-pad-*`, `--section-gap`)
- [x] Force Geist on `body`; remove system-first font stack conflict
- [x] Map `--info` away from violet → indigo/sky
- [x] Keep DataGrid border locks soft slate (`[data-slot="data-grid"]`)
- [x] Remove dead `.ant-*` CSS overrides
- [x] Add `prefers-reduced-motion` base rules
- [x] Document token usage in CSS comment block
- [x] Align shadcn `button.tsx` to `rounded-sm` (primary inherits indigo via tokens)
- [x] Soften admin `Button.tsx` to `rounded-sm`
- [x] Soften `input.tsx` to `rounded-sm`
- [x] Soften `badge.tsx` (shadcn) to `rounded-sm`
- [x] Soften admin `Badge.tsx` status chips to `rounded-sm` (policy: no full-pill status)
- [x] Soften `select.tsx` trigger (and content) toward `rounded-sm`
- [x] `npm run build --workspace=article-app` passes
- [x] Commit plan + Phase A

**Acceptance**

- [x] Default Button reads Contiq indigo (not near-black)
- [x] DataGrid borders remain soft slate (no black regression)
- [x] Light theme only for v1 (dark tokens can stay dormant)
- [ ] WCAG AA spot-check on primary button & body text (verify in Phase G screenshots)

**Files:** `index.css`, `components/ui/button.tsx`, `input.tsx`, `badge.tsx`, `select.tsx`, `admin/components/ui/Button.tsx`, `admin/components/ui/Badge.tsx`, this plan

---

### Phase B — Shell (headers, page chrome, filters)

**Effort: M** · **Status: not started**

**Scope:** Unify admin + user headers; page title/subtitle rhythm; filter toolbars as one composition; consistent page padding via tokens.

#### Checklist

- [ ] AdminHeader: tighten logo sizing, nav spacing (less `justify-around` sprawl), indigo active = `rounded-sm`
- [ ] User Header: match admin shadow/border treatment
- [ ] Page chrome: shared title + optional subtitle/count pattern on All Articles, Users, Insights, Article Types, My Articles
- [ ] Apply `--page-pad-x` / `--page-pad-y` / `--section-gap` consistently
- [ ] Filter rows: cohesive toolbar (label rhythm, control heights, soft borders)—All Articles, Insights, Users
- [ ] Replace raw filter `<button>` toggles with shared Button variants where cheap
- [ ] Mobile menu: usable; light open animation deferred to Phase E if needed
- [ ] Keyboard focus visible on nav + filters

**Acceptance**

- [ ] Admin + user shell feel like one product
- [ ] Keyboard focus visible on nav + filters
- [ ] Mobile menu usable

**Risk:** Medium (many pages). Ship with visual checklist per route.

---

### Phase C — DataGrid system polish (all tables)

**Effort: L** · **Status: not started**

**Scope:** Elevate `contiq-data-grid.ts` as single source of table chrome; sentence-case semibold headers; soft borders; calm pagination; skeleton loading; unify cell patterns.

#### Checklist

- [ ] `contiq-data-grid.ts`: container `rounded-sm border-slate-200 shadow-card`; header wash + sentence-case semibold
- [ ] Reinforce soft border locks in `index.css` if needed
- [ ] Align Users, Articles, ScoringHistory, Insights, Article Types params, My Articles to tokens
- [ ] Pagination: rows-per-page always shows value; active page soft slate `rounded-sm` (not black)
- [ ] Skeleton loading for Users / Articles / Insights / ScoringHistory
- [ ] Cell patterns: avatar+name+email, status badge, `tabular-nums` scores, action hierarchy (ghost/outline)
- [ ] Row hover: `bg-slate-50/80` + `duration-fast`
- [ ] Avoid deep forks of ReUI `data-grid-table.tsx` unless necessary

**Acceptance**

- [ ] Side-by-side with ReUI reference: soft lines, header wash, calm pagination
- [ ] Border fix still holds under hover/sort/scroll
- [ ] No layout jump when loading→data

**Risk:** Medium–high (ReUI internals). Prefer classNames/layout props.

---

### Phase D — Forms, dialogs, selects, toasts

**Effort: M–L** · **Status: not started**

**Scope:** Form field rhythm; dialog `rounded-md` exception; selects/popovers match; Sonner Contiq styling; TipTap chrome align; Badge consolidation.

#### Checklist

- [ ] Form rhythm: label above, `gap-2`, helper/error below; indigo focus ring
- [ ] Dialog: opaque white, soft ring, footer slate-50; `rounded-md`; `--duration-med`
- [ ] Select / popover / autocomplete: sm radius, soft border/ring (Phase A started; finish parity)
- [ ] Sonner: slate border, indigo/success/danger icons
- [ ] Article Types parameter modal polish
- [ ] Consolidate admin Badge → shadcn Badge + Contiq semantic classes (or document dual use)
- [ ] TipTap: editor border/focus/toolbar align with tokens
- [ ] Article detail / create forms control parity
- [ ] Soften remaining `rounded-lg`/`rounded-xl` on form primitives (textarea, filter-select, empty icon)

**Acceptance**

- [ ] Form contrast AA
- [ ] Destructive confirms clear
- [ ] No placeholder-as-only-label on critical fields

**Risk:** Medium (editor regressions).

---

### Phase E — Micro-interactions (component-level only)

**Effort: M** · **Status: not started**

**Scope:** Product-appropriate motion. **No route fade** (locked). Honor `prefers-reduced-motion`.

#### Checklist

- [ ] Row hover transition (background only)
- [ ] Button `:active` press feedback tuned to `--duration-fast`
- [ ] Dialog/select enter/exit tuned to Contiq easing
- [ ] Accordion / Article Type expand: keep height transition; reduced-motion = instant
- [ ] Nav active: color/bg transition only
- [ ] **Do not** add route content fade / `PageFade`
- [ ] Verify `prefers-reduced-motion: reduce` disables non-essential motion

**Acceptance**

- [ ] Every animation has a one-line purpose
- [ ] Reduced-motion verified in OS setting
- [ ] No layout thrash on large tables

**Risk:** Low if transform/opacity only.

---

### Phase F — Empty / loading / error + a11y

**Effort: M** · **Status: not started**

#### Checklist

- [ ] Promote `EmptyState` on all list surfaces with CTA when actionable
- [ ] Shared inline error / alert for fetch failures
- [ ] Skeleton components for tables + key detail panels
- [ ] A11y: focus order, aria on icon-only actions, dialog labels, contrast
- [ ] Status never color-only
- [ ] Fix month-picker relative / current-dot bugs if still present
- [ ] Keyboard-only pass on top 5 routes

**Acceptance**

- [ ] Keyboard-only pass on top 5 routes
- [ ] Empty states explain next action
- [ ] No silent failures (toast or inline)

---

### Phase G — Verification + deploy

**Effort: S–M** · **Status: not started**

#### Checklist

- [ ] Visual QA checklist per admin + user route
- [ ] Regression: scoring, promote/deactivate, filters/URL, pagination, TipTap
- [ ] Confirm no black DataGrid border regression
- [ ] Confirm indigo primary everywhere expected
- [ ] Build + preview smoke
- [ ] Stakeholder sign-off on A–F screenshots
- [ ] Deploy per team process (only after review)

**Routes:** Admin Articles, Article Types, Users, Insights, My Article/create/detail; User My Articles/create/detail; auth edges.

---

## 6. Motion vocabulary

| Animates | How | Purpose |
|---|---|---|
| Button hover / press | color + `120ms`; active translate 1px | Feedback |
| Nav hover / active | bg/text `120–160ms` | Hierarchy |
| Table row hover | `background-color` only | Affordance |
| Dialog / select / popover | fade+zoom; `--duration-med` + Contiq ease | State |
| Accordion / Article Type expand | grid-rows / chevron | State |
| Toast enter/exit | Sonner + Contiq chrome | Feedback |
| Skeletons | restrained pulse/shimmer | Loading |

| Stays still | Why |
|---|---|
| **Route / page transitions** | **Locked off**—hard cuts |
| Page background / logo | Brand stability |
| Data cells while scrolling | Perf + clarity |
| Scroll reveals / marquees / magnetic UI | Wrong product type |

**`prefers-reduced-motion: reduce`:** disable shimmer/zoom extras; instant open/close; keep focus rings; allow simple color hover.

---

## 7. Out of scope / non-goals

- Landing heroes, bento, marquees, kinetic type, glassmorphism dashboards, custom cursors
- Switching to Fluent / Carbon / Material mid-stream
- Dark mode launch (tokens may remain dormant)
- IA / route renames, logo redesign, scoring prompt copy rewrite
- Replacing TipTap or ReUI DataGrid
- Backend / scoring algorithm changes
- Pixel-clone of ReUI demo data—match quality language only

---

## 8. Acceptance criteria (program-level)

- [ ] One accent: Contiq indigo; no AI-purple
- [ ] Radius = sm everywhere except dialogs (`md`) and true circles (avatar)
- [ ] Borders = soft slate-200; DataGrid never black
- [ ] Table headers = sentence-case semibold
- [ ] No route fade; component motion only + reduced-motion
- [ ] Density stays data-first (dial 7)
- [ ] Build passes; key flows regression-clean
- [ ] Deploy only after Phase G review

---

*Plan adapted from planning agent `d0c866d8` for **sm radius** + **border normalization** + locked defaults (indigo primary, sentence-case headers, no route fade). Update checkboxes as work proceeds.*
