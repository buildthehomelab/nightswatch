---
name: Nightswatch
description: A watchful, spare homelab status dashboard — silence is the default.
colors:
  surface-base:          "#1f1633"
  surface-raised:        "#2a2040"
  surface-deep:          "#150f23"
  surface-light:         "#fefeff"
  surface-light-raised:  "#f5f2ff"
  text-primary:          "#ffffff"
  text-secondary:        "#e5e7eb"
  text-muted:            "#79628c"
  text-on-light:         "#1f1633"
  severity-crit:         "#fa7faa"
  severity-warn:         "#ffb287"
  severity-ok:           "#c2ef4e"
  severity-crit-light:   "#a83060"
  severity-warn-light:   "#b86820"
  severity-ok-light:     "#527a10"
  accent:                "#6a5fc1"
  action-fill:           "#79628c"
  action-stroke:         "#584674"
  action-text:           "#fefeff"
typography:
  display:
    fontFamily: '"Barlow Condensed", ui-sans-serif, system-ui, sans-serif'
    fontSize: "80px"
    fontWeight: 800
    lineHeight: 1.0
    letterSpacing: "0.5px"
  headline:
    fontFamily: '"Rubik", ui-sans-serif, system-ui, sans-serif'
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.15px"
  body:
    fontFamily: '"Rubik", ui-sans-serif, system-ui, sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: '"Rubik", ui-sans-serif, system-ui, sans-serif'
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.08em"
  data:
    fontFamily: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace'
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  pill: "9999px"
  lg:   "10px"
  md:   "8px"
  sm:   "4px"
  xs:   "3px"
spacing:
  page-x:        "48px"
  page-y-top:    "56px"
  page-y-bottom: "72px"
  section:       "48px"
  issue-gap:     "16px"
  page-x-mobile: "24px"
components:
  issue-row:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "0"
    padding: "18px 0"
  issue-row-hover:
    backgroundColor: "{colors.surface-raised}"
    padding: "18px 16px"
  issue-row-crit:
    backgroundColor: "rgba(250,127,170,0.045)"
  severity-badge-crit:
    backgroundColor: "rgba(250,127,170,0.15)"
    textColor: "{colors.severity-crit}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  severity-badge-warn:
    backgroundColor: "rgba(255,178,135,0.15)"
    textColor: "{colors.severity-warn}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  filter-chip:
    backgroundColor: "transparent"
    textColor: "inherit"
    rounded: "{rounded.sm}"
    padding: "1px 4px"
  filter-chip-active-crit:
    backgroundColor: "rgba(250,127,170,0.12)"
    textColor: "{colors.severity-crit}"
  action-button:
    backgroundColor: "{colors.action-fill}"
    textColor: "{colors.action-text}"
    rounded: "{rounded.pill}"
    padding: "5px 14px"
  action-button-hover:
    backgroundColor: "{colors.action-fill}"
  ghost-button:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
---

# Design System: Nightswatch

## 1. Overview: The Order Holds

**Creative North Star: "The Order Holds"**

The Nightswatch design system is governed by a single discipline: the interface speaks only when the threat is real. In a healthy state the page shows nothing but a spare hero phrase. In crisis, ranked severity controls every element of hierarchy. No decoration competes with signal.

The aesthetic is military-quiet: a deep purple foundation used not as a style choice but because a fortified, near-colorless ground lets alarm signals read at maximum contrast. Color is a fire alarm, not a paint job. The three severity roles — crimson, amber, acid lime — function as the only persistent warmth in the system. They earn their saturation by meaning.

This system explicitly rejects the Grafana widget soup (visual noise treated as a proxy for data density), the modern SaaS cream aesthetic (rounded card stacks, marketing softness, pastel fills), and the Home Assistant tile grid pattern (icon-heavy consumer layouts, friendly pill buttons everywhere). The interface is an instrument, calibrated to glance-legibility at 2am. Every pixel is deliberate.

**Key Characteristics:**
- Silence is signal: the empty healthy state is a first-class design surface, not a failure state
- Severity speaks first: crit / warn / info hierarchy legible in under one second
- Earned color: color appears only where it carries operational meaning
- Instrument-grade precision: every element sized and placed with intent, not convention
- Night-watch legibility: high contrast, information-dense but not cluttered

## 2. Colors: Starless Purple + Signal Fire

The palette is built on deliberate deprivation. Base surfaces suppress color to near-zero chroma; severity accents exist at full saturation. Their rarity is the mechanism. A screen with no color is a screen with no problems.

This is a dual-theme system. Dark mode is the canonical operator view. Light mode is the daytime variant. All severity roles maintain their operational meaning across both themes; only lightness adjusts for the ambient background.

### Primary (Surface Stack)

Dark theme (canonical):

- **Void Ground** (#1f1633): Page background in dark mode. Deep purple, near-zero chroma. The fortification all other content sits on.
- **Night Raised** (#2a2040): Elevated surface. Hover states, focused issue rows, expanded sections, settings panel.
- **Shadow Deep** (#150f23): Sunken panel. The expanded issue detail interior. Intentionally darker than base to create a well, not a lift.

Light theme (applied via `data-theme="light"`):
- **Pale Watch** (#fefeff): Page background in light mode. Near-white with a barely perceptible purple tint.
- **Faint Raised** (#f5f2ff): Elevated surface in light mode.

### Secondary (Text Hierarchy)

Dark:
- **Stark White** (#ffffff): Primary text. Maximum contrast against Void Ground.
- **Ghost** (#e5e7eb): Secondary text, metadata, supporting context.
- **Muted Orchid** (#79628c): Labels, captions, tertiary context. Also the action button fill and the ambient strip default text color.

Light: Primary text uses `#1f1633` (Void Ground reversed) -- the same color becomes the ink.

### Tertiary (Severity Signals)

- **Alarm Crimson** (dark #fa7faa / light #a83060): Critical severity. Severity badge, background tint on crit rows, masthead emphasis, pulsing dot. The alarm.
- **Ember Warning** (dark #ffb287 / light #b86820): Warning severity. Same roles, lower urgency.
- **All-Clear Lime** (dark #c2ef4e / light #527a10): Healthy state, rank progression, positive values. The only color the operator wants to see.

### Accent

- **Signal Violet** (#6a5fc1): Focus rings, keyboard navigation indicators, hyperlinks. Identical in both themes -- the stable landmark. Used on ≤5% of any screen.

### Named Rules

**The Signal Fire Rule.** Severity colors are alarm signals, not design accents. Crimson, amber, and lime are prohibited outside their operational roles. Using crit-red as a decorative highlight is a WCAG violation and a design violation simultaneously.

**The Rarity Corollary.** Signal Violet (accent) appears on ≤5% of any given screen. Its scarcity is what makes focus rings and active states immediately visible.

**The Reversal Rule.** Light mode is not a lighter version of dark mode. It is a structural inversion: --paper and --ink swap entirely. Severity roles hold constant in meaning; only their lightness adjusts for legibility on the inverted ground.

## 3. Typography

**Display Font:** Barlow Condensed (ui-sans-serif, system-ui, sans-serif)
**Body Font:** Rubik (ui-sans-serif, system-ui, sans-serif)
**Data Font:** JetBrains Mono (ui-monospace, SF Mono, Menlo, monospace)

**Character:** Barlow Condensed at 800 weight commands the page like a regimental header. Rubik provides warm operator legibility at dense sizes without softening into friendliness. JetBrains Mono marks data, timestamps, and log output as factual -- machine-generated, not editorial.

### Hierarchy

- **Display** (800 weight, 80px masthead / 72px hero, 52px/44px at ≤640px, line-height 1.0, tracking +0.5px): The masthead phrase and the healthy-state hero phrase. One instance per view. Commands the whole screen.
- **Headline** (600 weight, 18px, line-height 1.3, tracking -0.15px, Rubik): Issue title in the issue row. The primary operator-facing text. 1.25x ratio to body (18/15 = 1.2, supplemented by weight contrast).
- **Body** (400 weight, 15px, line-height 1.55, max-width 60ch, Rubik): Issue description in expanded detail panel. The only long-form prose in the system.
- **Label** (600 weight, 12px, uppercase, tracking +0.08-0.2em, Rubik): Section headers, severity badge text, ambient strip key labels, action button text. The system's instruction layer.
- **Data** (400 weight, 10.5-12px, line-height 1.6, tabular-nums, JetBrains Mono): Numeric values, timestamps, load averages, log entries. Signals that a value was measured, not written.

### Named Rules

**The Three-Font Rule.** Barlow Condensed owns display hierarchy. Rubik owns all prose and UI labels. JetBrains Mono owns all data, metrics, and log output. No other fonts enter the system.

**The Data Marker Rule.** Any value that originates from a machine (uptime, CPU temp, load average, timestamps, counts) uses JetBrains Mono. The font is the signal that the value is live, not editorial.

## 4. Elevation

Nightswatch uses tonal layering as its primary depth mechanism. Surfaces stack through lightness steps -- base to raised to deep -- and shadows appear only when content erupts into a new layer (expanded detail panels, ambient popovers). At rest, everything is flat.

### Shadow Vocabulary

- **Detail lift** (`box-shadow: rgba(0,0,0,0.1) 0px 10px 15px -3px` light / `rgba(22,15,36,0.9) 0px 4px 4px 9px` dark): The expanded issue detail inner panel. The one moment a surface needs to feel like it lifted off the page. Dark mode version uses an opaque tinted shadow to reinforce the depth well effect.
- **Popover halo** (`box-shadow: 0 2px 8px rgba(0,0,0,.1), 0 8px 32px rgba(0,0,0,.18), 0 1px 0 rgba(255,255,255,.04) inset`): Ambient strip popovers. Must float above the strip and feel fully detached.
- **Button press** (rest: `rgba(0,0,0,0.1) 0px 1px 3px 0px inset` / hover: `rgba(0,0,0,0.18) 0px 0.5rem 1.5rem`): Action buttons. Inset at rest reads as recessed/pressed; outward lift on hover reads as coming forward.

### Named Rules

**The Flat-By-Default Rule.** Every surface is flat at rest. Shadows are state responses, never decoration. If an element is not transitioning between states or floating above another layer, it has no shadow.

**The Tonal Depth Rule.** Depth at rest is surface-color, not lift. --paper to --paper-2 to --paper-deep is the full depth axis. Exhaust these three steps before reaching for any shadow.

## 5. Components

### Issue Row

The primary operator surface. The whole system converges here.

- **Shape:** No border-radius. Full-width flat row. The bottom border is a rule line, not a card edge.
- **Default:** Transparent background, `padding: 18px 0`. Border-bottom `1px solid var(--rule)`.
- **Hover / Focused:** Tints to `var(--paper-2)`; negative margin (-16px each side) with compensating padding creates an optical expansion effect without layout shift.
- **Critical tint:** `rgba(168,48,96,0.028)` light / `rgba(250,127,170,0.045)` dark. Severity infects the row surface at low opacity, perceptible without dominating.
- **Expanded detail:** `grid-template-rows: 0fr to 1fr` transition (compositor-only). Detail inner `border-color` shifts to `var(--crit)` for critical issues.
- **Keyboard focus ring:** `box-shadow: inset 0 0 0 1.5px var(--accent)` -- full-perimeter, never a side stripe.

### Severity Badge

- **Shape:** Full pill (`border-radius: 9999px`), `padding: 3px 9px`, uppercase, 10px Rubik, 600 weight, +0.2px tracking.
- **Crit:** Background `rgba(168,48,96,0.1)` / dark `rgba(250,127,170,0.15)`; text `var(--crit)`.
- **Warn:** Background `rgba(184,104,32,0.1)` / dark `rgba(255,178,135,0.15)`; text `var(--warn)`.
- **Info:** Background `rgba(106,95,193,0.08)` / dark `rgba(255,255,255,0.07)`; text `var(--ink-3)`.
- **Pulse dot:** 5px circle before label text. Crit issues animate: `opacity` 1 to 0.35 + `scale` 1 to 0.55 over 2s (`ease-in-out`, infinite). Warn and info dots are static.

### Filter Chips

- **Shape:** `border-radius: 4px`, `padding: 1px 4px`. Transparent at rest, no border.
- **Active:** Background tint at 8-12% opacity; text shifts to severity color. `aria-pressed` reflects state.
- **Touch:** At `pointer: coarse`, padding expands to `10px 8px` for minimum 44px touch area.
- **Focus:** `outline: 2px solid var(--accent)`, offset 2px.

### Action Button (Primary)

- **Shape:** Full pill (`border-radius: 9999px`), `padding: 5px 14px`.
- **Fill:** `background: #79628c`, `border: 1px solid #584674`, `color: #fefeff` (fixed -- does not invert with theme).
- **Text:** 12px Rubik, 700 weight, uppercase, tracking +0.2px.
- **Rest state:** Inset shadow `rgba(0,0,0,0.1) 0px 1px 3px inset` reads as recessed.
- **Hover:** Outward lift shadow `rgba(0,0,0,0.18) 0px 0.5rem 1.5rem`. No fill change.
- **Focus:** `outline: 2px solid var(--accent)`, offset 2px.

### Ghost Button (Secondary / Ignore)

- **Shape:** Full pill, `padding: 5px 12px`.
- **Fill:** Transparent; `border: 1px solid var(--rule-soft)`; `color: var(--ink-3)`.
- **Hover:** Color to `var(--ink)`; border to `var(--ink-3)`.
- **Purpose:** Destructive or low-commitment secondary actions (ignore, unignore). Visually subordinate; never competes with primary actions.

### Ambient Strip

- **Position:** `position: fixed`, full viewport width. Bottom by default, configurable to top.
- **Surface:** `background: var(--paper)`. `border-top: 1px solid var(--rule)`. `padding: 10px 48px`.
- **Type:** 12px Rubik, 500 weight. `.k` (key) in `--ink-3`, `.v` (value) in `--ink-2`. Severity values shift to their severity color.
- **Chips:** `role="button"`, `tabIndex="0"`, `onKeyDown` Enter/Space. Hover/focus expands hit area via negative-margin compensation. Popover opens on focus and hover; closes on blur/leave with 250ms delay.
- **Status dots:** 6px circles. `background: var(--ok)` (clear) / `var(--warn)` / `var(--crit)`. The most efficient state indicator in the system.

### Ambient Popover

- **Shape:** `border-radius: 10px`. `border: 1px solid var(--rule)`.
- **Surface:** `background: var(--paper)` + popover halo shadow.
- **Type:** JetBrains Mono 11.5px for values; Rubik 10px, uppercase, tracked for labels.
- **Entry animation:** `popIn` 100ms `cubic-bezier(.2,.8,.4,1)`: `translateY(4px) scale(0.97)` to identity.

## 6. Do's and Don'ts

### Do:

- **Do** use severity colors exclusively for their operational role: crimson = critical, amber = warning, lime = clear. No other use is permitted.
- **Do** design the healthy empty state with the same care as the critical state. Silence is correct operation.
- **Do** use `var(--paper-2)` (tonal raised surface) as the depth primitive before reaching for any shadow.
- **Do** use `inset 0 0 0 1.5px var(--accent)` as the keyboard focus ring. Full-perimeter, not a side stripe.
- **Do** apply `@media (prefers-reduced-motion: reduce)` globally; set duration to 0.01ms, iteration-count to 1.
- **Do** use `<time dateTime="ISO-8601">` for all timestamps and age values shown to operators.
- **Do** animate show/hide with `grid-template-rows: 0fr to 1fr` and compositor-only `opacity`/`visibility`. No `max-height` animation.
- **Do** mark all data-originated values with JetBrains Mono to distinguish measured from written.
- **Do** give every `role="button"` element explicit `onKeyDown` handlers for Enter and Space.

### Don't:

- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on any issue row, list item, callout, or card. Absolutely prohibited; rewrite with background tint or full-perimeter inset shadow.
- **Don't** use gradient text (`background-clip: text` with a gradient). A single solid color only; emphasis through weight or size.
- **Don't** use glassmorphism decoratively. Wallpaper blur on issue rows is conditional on user-supplied backgrounds, not a default aesthetic.
- **Don't** build a hero-metric template (big number + small label + supporting stats + gradient accent). That is the Grafana failure mode.
- **Don't** use icon-heavy tile grids. That is the Home Assistant failure mode.
- **Don't** use SaaS-cream backgrounds, rounded card stacks, or marketing softness. That is the Vercel/Notion failure mode.
- **Don't** add color for decoration. Every color application must have an operational justification.
- **Don't** show the empty healthy state as an error or an empty-state illustration. Calm is correct. Design it carefully.
- **Don't** use `title` attributes as the sole accessibility mechanism for threshold markers or chart annotations; the foot text must carry the same information.
