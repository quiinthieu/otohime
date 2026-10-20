# Research: dropdowns open the system-native menu (pm-198)

**Verdict: confirmed at ec39dad. The site has three `<select>` fields. Their closed box is already drawn in the page's style; what looks foreign is the open popup, which classic CSS cannot touch. Fix it with CSS customizable select (`appearance: base-select`) in two stylesheets, no JavaScript and no new component. Proven on the job pod with headless Chromium 156.**

## The three dropdowns

| Where | File | Classes today | Page style |
| --- | --- | --- | --- |
| Colour, add-channel form on /music (owners) | `components/add-channel-form.tsx:37` | `select.field` | site paper/ink, light or dark |
| Role, /admin/users/[id] (admins) | `components/user-actions.tsx:77` | `select.field` | site paper/ink, light or dark |
| Genre, the Vinyl crate on /vinyl | `app/(vinyl)/_components/crate.tsx:42` | `.crate-filters select` | Vinyl's own dark stylesheet |

No `<datalist>`, combobox, menu, date or colour inputs exist; these three are the whole scope.

## What is actually native

`app/(site)/globals.css` already styles the closed control: `select.field { appearance: none; ... }` with a two-gradient chevron, paper background, ink border and 10 px radius. The Vinyl rule (`vinyl.css` line 88) gives the closed box the card colour and line border but leaves the native arrow.

The popup list that opens on click is a separate OS widget. Measured in the fixture: it paints `rgb(255,255,255)` in light and `rgb(18,18,18)` in dark with the OS blue highlight and square corners (`/shared/artifacts/select-today-light.png`), on a page whose paper is `#f2efe7` / `#1c1915` and whose accent is yellow. That is the mismatch the idea describes. `background`, `border-radius`, `font` and `color-scheme` on `<select>` or `<option>` do not reach it in any browser.

## The fix: customizable select, as a progressive enhancement

Browsers now let a page take over the popup with `appearance: base-select` on the select **and** its `::picker(select)` pseudo-element. The picker becomes a top-layer popover anchored under the box; `<option>` becomes an ordinary styleable element with `:hover`, `:focus-visible`, `:checked` and a `::checkmark` pseudo. Keyboard, type-ahead, form submission, `onChange`, labels and screen-reader semantics are unchanged because the element is still a `<select>`.

Support, from `@mdn/browser-compat-data` on the pod:

| Feature | Chrome / Edge / Android Chrome | Safari / iOS | Firefox |
| --- | --- | --- | --- |
| `appearance: base-select` | 135 | 27 | 149, behind two prefs (not shipped) |
| `::picker(select)`, `::checkmark`, `::picker-icon` | 135 (icon and checkmark 133) | 27 | no |

Inside `@supports (appearance: base-select)` the rules are invisible to Firefox, which keeps the native popup it has today. Nothing is removed from any browser.

Proposed rules for `app/(site)/globals.css`, after the existing `select.field` block:

```css
@supports (appearance: base-select) {
  select.field,
  select.field::picker(select) {
    appearance: base-select;
  }

  /* the gradient chevron on the box stays; hide the UA's icon */
  select.field::picker-icon {
    display: none;
  }

  select.field::picker(select) {
    margin-top: 4px;
    padding: 4px;
    border: 1px solid var(--ink);
    border-radius: 10px;
    background: var(--paper);
    color: var(--ink);
    box-shadow: 2px 2px 0 var(--ink);
  }

  select.field option {
    padding: 5px 10px;
    border-radius: 6px;
    cursor: pointer;
  }

  select.field option:hover,
  select.field option:focus-visible {
    background: var(--paper-2);
    outline: 0;
  }

  select.field option:checked {
    background: var(--yellow);
    color: var(--on-swatch);
  }

  select.field option::checkmark {
    display: none;
  }
}
```

The picked option wears yellow with `--on-swatch` ink, the same pairing as `.badge[data-role="owner"]` and `::selection`; the hard 2 px shadow is the `.chip:hover` lift. The picker pseudo-element inherits from the select, so `light-dark()` resolves per theme without extra rules (measured: picker `rgb(242,239,231)` in light, `rgb(28,25,21)` in dark).

Proposed rules for `app/(vinyl)/vinyl.css`, after the `.crate-filters select` rule:

```css
@supports (appearance: base-select) {
  .crate-filters select,
  .crate-filters select::picker(select) { appearance: base-select; }
  .crate-filters select::picker-icon { color: var(--muted); }
  .crate-filters select::picker(select) {
    margin-top: 4px;
    padding: 4px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    color: var(--ink);
  }
  .crate-filters option { padding: 6px 10px; border-radius: 6px; }
  .crate-filters option:hover,
  .crate-filters option:focus-visible { background: var(--raised); outline: 0; }
  .crate-filters option:checked { background: var(--accent); color: var(--bg); font-weight: 700; }
  .crate-filters option::checkmark { display: none; }
}
```

The checked colour matches `.badges .on-platter` (accent on bg, bold). Vinyl's stylesheet uses one-line rules; keep that voice.

No TSX changes are needed. Do **not** add `<button><selectedcontent>` inside the selects: it is only needed for rich option content, React 19 does not know the `selectedcontent` element, and MDN warns the pattern causes hydration failures with SSR.

## Proof on the pod

Fixture `/tmp/probe/fixture.html` copies the tokens and select rules from both stylesheets verbatim and adds the blocks above under a `.proposed` class; `/tmp/probe/probe.mjs` (Playwright 1.64, `chromium --only-shell`, Chromium 156.0.8078.4) opens each select in both themes, screenshots the open picker, then presses ArrowDown and Enter.

| Select / theme | computed `appearance` | picker opens | picker background | ArrowDown+Enter |
| --- | --- | --- | --- | --- |
| today / light | none | yes (native) | rgb(255,255,255) | yellow → coral |
| site / light | base-select | yes | rgb(242,239,231) = `--paper` | yellow → coral |
| site / dark | base-select | yes | rgb(28,25,21) = `--paper` | coral → mint |
| vinyl / dark | base-select | yes | rgb(42,35,30) = `--card` | All → Jazz |

Screenshots: `/shared/artifacts/select-today-light.png` (the native popup, white with OS blue), `select-site-light.png`, `select-site-dark.png` (paper picker, yellow pick, ink border and hard shadow), `select-vinyl-dark.png` (card picker, accent pick).

## Alternatives rejected

- **A custom listbox component (button + popover + `role="listbox"`).** Re-implements arrow keys, type-ahead, Home/End, Esc, outside click, focus return and form participation for three fields, and drops the free native behaviour on iOS. Larger diff, real a11y risk, and a second thing to keep in step with `.field`.
- **`color-scheme` only.** Already set on `:root`; it tints the native popup light or dark but cannot change its white/black surface, square corners, blue highlight or font.
- **Replacing the selects with radio chips.** Colour has five options and could become the existing `.swatch` radios, but Role and Genre grow; out of scope for "fix the style".

## Suggested task shape

One SWE task touching `app/(site)/globals.css` and `app/(vinyl)/vinyl.css` only. Verification without a person:

- A Playwright probe on `next start` (Vinyl needs no sign-in; for /music and the admin page the e2e harness `scripts/e2e-local.sh` already creates owner and admin cookies) at 420×600: click each select, assert `select.matches(':open')`, assert `getComputedStyle(select, '::picker(select)').backgroundColor` equals the page's `--paper` (site, both `data-theme` values) or `--card` (Vinyl), press ArrowDown and Enter, assert the value advanced and the picker closed. Headless shell is Chromium 156, so the rules apply.
- A guard that the rules sit inside `@supports (appearance: base-select)` (grep in the walk script is enough), so Firefox keeps today's behaviour.
- `scripts/walk-vinyl.sh` still passes: its CSS rules read `vinyl.css` by selector and the new block adds no rule naming the player host.
- `npm run lint && npm run typecheck && npm test` green.

The probe and fixture used here are reusable as the verification's starting point.
