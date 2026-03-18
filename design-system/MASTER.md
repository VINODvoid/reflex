# REFLEX — Master Design System

---

## App Identity

**Name:** REFLEX
**Purpose:** Mobile-first DeFi position monitor — watches lending protocol positions and fires push notifications before liquidation.
**Primary User:** Active DeFi participants: yield farmers, leveraged traders, protocol power users. Financially literate, used to dense information, but working on their phone.
**Emotional Goal:** Great · Minimal · Informative
The user should feel like they are holding a precision instrument — not an app. Confident. Calm. In control.

---

## Design Philosophy

REFLEX borrows its visual language from Apple's product design: extreme restraint, negative space used as punctuation, and typography that does the heavy lifting. Nothing decorative. Nothing decorative pretending to be functional. Every element either communicates data or creates breathing room — there is no third option.

This is not a "crypto app." It is a financial monitoring tool that happens to run on DeFi. The aesthetic reflects the seriousness of the stakes: your positions can be liquidated. The UI should feel like it already knows that.

The one indulgence: motion. Transitions are fluid and expressive — not to show off, but because confident motion communicates stability.

---

## Color System

### Light Mode (Primary)

| Token | Hex | CSS Variable | Purpose |
|-------|-----|--------------|---------|
| `bgPrimary` | `#FFFFFF` | `--bg-primary` | Screen backgrounds |
| `bgSecondary` | `#F5F5F7` | `--bg-secondary` | Grouped section backgrounds |
| `surface` | `#FFFFFF` | `--surface` | Card backgrounds |
| `surfaceElevated` | `#FFFFFF` | `--surface-elevated` | Modals, sheets |
| `border` | `#D2D2D7` | `--border` | Dividers, input borders |
| `borderSubtle` | `#E8E8ED` | `--border-subtle` | Card borders, subtle separators |
| `textPrimary` | `#1D1D1F` | `--text-primary` | Primary content |
| `textSecondary` | `#6E6E73` | `--text-secondary` | Supporting text, metadata |
| `textTertiary` | `#AEAEB2` | `--text-tertiary` | Placeholder, disabled |
| `accent` | `#0066CC` | `--accent` | CTAs, active states, links |
| `accentSoft` | `#EBF3FF` | `--accent-soft` | Accent backgrounds, chips |
| `accentPress` | `#0051A3` | `--accent-press` | Pressed state for accent |
| `success` | `#1A7F47` | `--success` | Safe health factors |
| `successSoft` | `#E8F5EE` | `--success-soft` | Safe HF background tint |
| `warning` | `#B8690A` | `--warning` | Caution range |
| `warningSoft` | `#FFF7E6` | `--warning-soft` | Warning background tint |
| `danger` | `#C0392B` | `--danger` | At-risk positions, errors |
| `dangerSoft` | `#FDEDEC` | `--danger-soft` | Danger background tint |

### Dark Mode

| Token | Hex | CSS Variable | Purpose |
|-------|-----|--------------|---------|
| `bgPrimary` | `#000000` | `--bg-primary` | Screen backgrounds |
| `bgSecondary` | `#1C1C1E` | `--bg-secondary` | Grouped section backgrounds |
| `surface` | `#1C1C1E` | `--surface` | Card backgrounds |
| `surfaceElevated` | `#2C2C2E` | `--surface-elevated` | Modals, sheets |
| `border` | `#38383A` | `--border` | Dividers |
| `borderSubtle` | `#2C2C2E` | `--border-subtle` | Subtle separators |
| `textPrimary` | `#F5F5F7` | `--text-primary` | Primary content |
| `textSecondary` | `#AEAEB2` | `--text-secondary` | Supporting text |
| `textTertiary` | `#636366` | `--text-tertiary` | Placeholder, disabled |
| `accent` | `#0A84FF` | `--accent` | CTAs, active states |
| `accentSoft` | `#001E3D` | `--accent-soft` | Accent backgrounds |
| `accentPress` | `#38A3FF` | `--accent-press` | Pressed accent |
| `success` | `#30D158` | `--success` | Safe health factors |
| `successSoft` | `#0A2E14` | `--success-soft` | Safe background tint |
| `warning` | `#FF9F0A` | `--warning` | Caution range |
| `warningSoft` | `#2E1A00` | `--warning-soft` | Warning background tint |
| `danger` | `#FF453A` | `--danger` | At-risk positions |
| `dangerSoft` | `#2E0A08` | `--danger-soft` | Danger background tint |

---

## Typography

**Display Font:** Syne (700 Bold, 800 ExtraBold)
Geometric grotesque with angular character. Used by premium fintech and crypto products. Feels technical, designed, and authoritative without being cold.

**Body Font:** Syne (400 Regular, 500 Medium, 600 SemiBold)
One family, multiple weights — creates strong visual hierarchy with zero cognitive overhead.

**Mono Font:** JetBrains Mono (400 Regular, 600 SemiBold)
All numerical data: health factors, USD values, wallet addresses, chain IDs.

### Font Install
```bash
cd apps/mobile
bun add @expo-google-fonts/syne @expo-google-fonts/jetbrains-mono expo-font
```

### Scale

| Token | Font | Weight | Size | Line Height | Letter Spacing | Use |
|-------|------|--------|------|-------------|---------------|-----|
| `display` | Syne | 800 | 48px | 52px | -1.5px | Hero screens, splash |
| `h1` | Syne | 700 | 34px | 40px | -0.8px | Screen titles |
| `h2` | Syne | 700 | 28px | 34px | -0.4px | Section headings |
| `h3` | Syne | 600 | 22px | 28px | -0.2px | Card headings |
| `h4` | Syne | 600 | 18px | 24px | 0 | Sub-section labels |
| `body` | Syne | 400 | 16px | 24px | 0 | Primary body text |
| `bodySmall` | Syne | 400 | 14px | 20px | 0 | Secondary body |
| `label` | Syne | 600 | 12px | 16px | +0.5px | Form labels, caps |
| `caption` | Syne | 400 | 11px | 16px | +0.3px | Metadata, timestamps |
| `dataLarge` | JetBrains Mono | 600 | 28px | 34px | -0.5px | Big numbers (HF, totals) |
| `dataMedium` | JetBrains Mono | 400 | 16px | 22px | 0 | Position values |
| `dataSmall` | JetBrains Mono | 400 | 13px | 18px | 0 | Addresses, chain IDs |

---

## Spacing System

Base unit: **8px**

| Token | Value | Use |
|-------|-------|-----|
| `xs` | 4px | Icon gaps, micro-spacing |
| `sm` | 8px | Internal component padding |
| `md` | 16px | Card padding, section gaps |
| `lg` | 24px | Screen horizontal padding |
| `xl` | 32px | Section separators |
| `2xl` | 48px | Large vertical rhythm |
| `3xl` | 64px | Hero section padding |

Screen horizontal padding: **24px** (not 16px — gives breathing room)

---

## Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `sharp` | 6px | Chips, tags, small badges |
| `card` | 16px | Position cards, form fields |
| `large` | 24px | Bottom sheets, modals |
| `xl` | 32px | Large feature cards |
| `pill` | 999px | Buttons (primary CTA style), toggle pills |

---

## Shadow & Elevation (Light Mode)

Dark mode uses border-based separation — no shadows.

| Level | Value | Use |
|-------|-------|-----|
| 1 (subtle) | `0 1px 4px rgba(0,0,0,0.06)` | Subtle card lift |
| 2 (card) | `0 4px 16px rgba(0,0,0,0.08)` | Position cards |
| 3 (float) | `0 8px 32px rgba(0,0,0,0.12)` | FABs, floating elements |
| 4 (modal) | `0 20px 60px rgba(0,0,0,0.18)` | Modals, bottom sheets |

---

## Motion

### Duration Tokens

| Token | Value | Use |
|-------|-------|-----|
| `instant` | 100ms | State toggles, simple feedback |
| `fast` | 180ms | Micro-interactions, chip selections |
| `normal` | 300ms | Card transitions, navigation |
| `slow` | 480ms | Modal entrance, screen transitions |
| `onboarding` | 600ms | Onboarding slide transitions |

### Easing

| Name | Curve | Use |
|------|-------|-----|
| `spring` | `damping: 20, stiffness: 180` | Scale press, bounce |
| `easeOut` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrance animations |
| `easeIn` | `cubic-bezier(0.4, 0, 1, 1)` | Exit animations |
| `linear` | `linear` | Progress bars, spinners |

### What Animates

- **Yes:** Screen entrance (opacity + translateY), button press (scale 0.97), tab switch, card mount, modal open/close, page indicator dots, HF gauge fill
- **No:** Text content (no typewriter effect), icons on inactive state, background color transitions between screens

### Reduced Motion

All Animated durations should fall back to `0ms` when `AccessibilityInfo.isReduceMotionEnabled` returns true.

---

## Component Rules

### Primary Button
- Background: `accent`
- Text: white, Syne SemiBold 16px
- Border radius: `pill` (999px)
- Height: 56px
- Press: scale 0.97, duration `fast`, spring easing
- Full width in single-action contexts
- Min touch target: 56px height

### Secondary Button
- Background: `bgSecondary`
- Text: `textPrimary`, Syne Medium 16px
- Border: 1px `border`
- Border radius: `pill`
- Height: 56px

### Position Card
- Background: `surface`
- Border: 1px `borderSubtle`
- Border radius: `card` (16px)
- Padding: `md` (16px)
- Shadow: level 2 (light mode only)
- Health factor displayed in `dataLarge` with semantic color
- Protocol name in `label` style, uppercase, `textSecondary`

### Alert Card
- Same structure as position card
- Left border accent (4px) in semantic color based on direction/severity
- No shadow — use border instead

### Input Fields
- Background: `bgSecondary`
- Border: 1px `border`
- Border radius: `card` (16px)
- Padding: 16px horizontal, 14px vertical
- Text: `textPrimary`, Syne Regular 16px
- Focus: border color changes to `accent`, no glow/shadow

### Navigation Tabs
- Background: `bgPrimary` with top border `borderSubtle`
- Active icon + label: `accent`
- Inactive: `textTertiary`
- Label: Syne SemiBold 11px
- Height: 88px (includes safe area)

### Bottom Sheets / Modals
- Handle bar: 4px wide, 36px tall, `border`, radius pill
- Background: `surfaceElevated`
- Border radius top: `large` (24px)
- Scrim: `rgba(0,0,0,0.48)` (light) / `rgba(0,0,0,0.64)` (dark)

---

## Anti-Patterns (Never Do These)

1. **No gradients on backgrounds** — solid colors only. Gradients signal "crypto app casino."
2. **No purple as primary color** — overused in DeFi/Web3 to the point of meaninglessness.
3. **No card carousels with peek** — positions are a list, not a carousel.
4. **No floating action buttons with shadows larger than level 3**
5. **No text over images** — no hero images with text overlaid.
6. **No more than 2 font weights on one screen** — hierarchy through size, not weight variety.
7. **No inline icons inside body text** — icons are navigational or status, not decorative.
8. **No skeleton loaders with gradients** — use flat pulsing opacity only.
9. **No toast notifications stacked** — one at a time, bottom anchored.
10. **No rounded corners smaller than 6px** — looks cheap at small radius.
11. **No dense information on first visible load** — always show the most critical data first.
12. **No multiple CTAs competing on one screen** — one primary action per screen.

---

## Differentiation Statement

Most DeFi apps look like they were designed at 3am by someone who wanted the UI to feel as volatile as the market. REFLEX is the antithesis: it is calm, precise, and unambiguous. The typography is confident. The color palette is surgical — every color carries a specific meaning and is never decorative. The motion is deliberate: things slide in because they arrived, not because it's flashy. A user glancing at REFLEX for two seconds knows exactly how healthy their positions are. That's not a feature. That's the product.
