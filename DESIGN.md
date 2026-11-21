---
name: GlanceLab Admin
description: A near-black shell over a hue-free canvas, where a study is drawn as a run-of-show of solid colour tiles.
colors:
  shell: "#141414"
  shell-raised: "#1c1c1f"
  shell-line: "#2e2e35"
  violet: "#b664ff"
  indigo: "#444ce7"
  indigo-soft: "#7f86f1"
  indigo-dark-theme: "#5b63f0"
  mint: "#59fda0"
  mint-ink-light: "#0a7a45"
  amber: "#ffce3a"
  amber-ink-light: "#7a5200"
  destructive-light: "#c62828"
  destructive-dark: "#ff7a7a"
  canvas-light: "#f2f2f2"
  card-light: "#ffffff"
  muted-light: "#e8e8e8"
  muted-text-light: "#5c5c5c"
  border-light: "#d6d6d6"
  input-border-light: "#b8b8b8"
  mat-light: "#e2e2e2"
  canvas-dark: "#141414"
  card-dark: "#1c1c1f"
  muted-dark: "#26262b"
  muted-text-dark: "#a9adba"
  border-dark: "#2e2e35"
  input-border-dark: "#4a4a55"
  mat-dark: "#2b2b2b"
  text-on-dark: "#f8fafc"
  text-on-light: "#141414"
typography:
  display:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 300
    lineHeight: 1.1
  headline:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 300
  title:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 300
  body:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  data:
    fontFamily: "Noto Sans Mono Variable, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    fontFeature: "tabular-nums"
  label:
    fontFamily: "Noto Sans Mono Variable, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.08em"
rounded:
  none: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.indigo}"
    textColor: "#ffffff"
    typography: "{typography.data}"
    rounded: "{rounded.none}"
    height: "36px"
    padding: "0 14px"
  button-solid:
    backgroundColor: "{colors.indigo}"
    textColor: "#ffffff"
    rounded: "{rounded.none}"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.muted-light}"
    textColor: "{colors.text-on-light}"
    rounded: "{rounded.none}"
    height: "36px"
  button-destructive:
    textColor: "{colors.destructive-light}"
    rounded: "{rounded.none}"
    height: "36px"
  variant-tile:
    backgroundColor: "{colors.indigo}"
    textColor: "#ffffff"
    typography: "{typography.data}"
    rounded: "{rounded.none}"
    size: "28px"
  image-mat:
    backgroundColor: "{colors.mat-light}"
    rounded: "{rounded.none}"
  step-card:
    backgroundColor: "{colors.card-light}"
    textColor: "{colors.text-on-light}"
    rounded: "{rounded.none}"
  top-bar:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.text-on-dark}"
    height: "56px"
---

# Design System: GlanceLab Admin

## Overview

**Creative North Star: "The Run-of-Show"**

A study is a timed sequence, and the admin draws it that way: a numbered rail of steps with their durations, and each ad variant a solid flat colour square that follows it across every screen. The shell is a near-black frame with square corners and a monospace voice for anything measured; the canvas inside it is plain grey so that the ad images, the thing being judged, are the only colour that is not a brand signal.

The system is for one non-technical researcher on long laptop sessions. Task comes first: labels are sentences at reading size in the sans, mono is reserved for buttons, table heads, section labels and measured values. Decoration is rationed to two places (the aurora field) and everything else is flat, ruled and square.

**Key Characteristics:**
- Two themes of the canvas (light default, dark); the shell is dark in both.
- Square corners everywhere; borders, not shadows, separate surfaces.
- Light-weight grotesk headings, mono buttons and data.
- Violet-to-indigo gradient marks the one primary action; mint means live or done.
- Hue-free greys under every image.

## Colors

A dark shell, a neutral canvas, one violet-indigo brand pair, mint for live, and a saturated flat tile palette for variants.

### Primary
- **Indigo** (`{colors.indigo}`): solid primary, focus ring, selection, caret, dragging-card border. In the dark theme it lifts to Indigo Lit (`{colors.indigo-dark-theme}`); ring becomes Indigo Soft (`{colors.indigo-soft}`).
- **Violet** (`{colors.violet}`): the start of the primary gradient (`linear-gradient(45deg, violet, indigo)`) and of the active-nav underline; also variant tile five.

### Secondary
- **Mint** (`{colors.mint}`): published/live square, success, target-box outline, the cross in the wordmark. Its text form is Mint Ink (`{colors.mint-ink-light}`) on the light canvas and mint itself on dark.
- **Amber** (`{colors.amber}`): warnings; text form Amber Ink (`{colors.amber-ink-light}`) on light, amber itself on dark.

### Neutral
- **Shell** (`{colors.shell}`), **Shell Raised** (`{colors.shell-raised}`), **Shell Line** (`{colors.shell-line}`): top bar, study bar, login, studies header. The `.shell` class redefines the tokens, so any control placed inside renders in its dark form even when the canvas is light.
- **Light canvas:** page `{colors.canvas-light}`, cards `{colors.card-light}`, muted fills `{colors.muted-light}`, muted text `{colors.muted-text-light}`, borders `{colors.border-light}`, input borders `{colors.input-border-light}`.
- **Dark canvas:** page `{colors.canvas-dark}`, cards `{colors.card-dark}`, muted fills `{colors.muted-dark}`, muted text `{colors.muted-text-dark}`, borders `{colors.border-dark}`, input borders `{colors.input-border-dark}`.
- **Image mat** (`{colors.mat-light}` light, `{colors.mat-dark}` dark): the grey behind every ad image.
- **Destructive:** `{colors.destructive-light}` on light, `{colors.destructive-dark}` on dark.

### Variant tile palette
In creation order: indigo `#444ce7` (white text), yellow `#ffce3a`, mint `#59fda0`, coral `#ff6b5e`, violet `#b664ff`, orange `#ff9a2e`, magenta `#ff6ff2` (all dark text `#141414`), teal `#2a7c95` (white text); wraps after eight. A variant keeps its colour on every screen.

### Named Rules
**The Hue-Free Canvas Rule.** Canvas greys and the image mat carry no tint, in either theme. Ad colours must be judged against neutral. Never warm, cool or brand-tint them.
**The Shell Is Always Dark Rule.** Top bar, study bar, login and studies header are dark in both themes. Put them under `.shell`; do not hand-colour inside.
**The One Gradient Rule.** The violet-to-indigo gradient is for the primary action and the active-nav underline only. Mint is only for live or done.

## Typography

**Display / Body Font:** Hanken Grotesk Variable (fallback ui-sans-serif, system-ui)
**Label / Mono Font:** Noto Sans Mono Variable (fallback ui-monospace, SF Mono, Menlo)

Both are self-hosted through @fontsource; nothing loads from a CDN. Root size is 15px.

**Character:** a light geometric grotesk for headings, set against a monospace that carries instruments and buttons.

### Hierarchy
- **Display** (300, 3rem on wide screens, 2.25rem on phones, 1.1): login headline only.
- **Headline** (300, 1.875rem, studies/images/settings; 2.25rem on the studies header): page titles. Editor title 1.5rem.
- **Title** (300, 1.25-1.5rem): section headings, empty states. Dialog titles are 1.125rem at 400.
- **Body** (400, 15px, 1.5): sans, field labels included, never mono.
- **Data** (mono, tabular numerals, typically 12px): ms, px, IDs, counts, durations, usernames (`.data`).
- **Label** (mono, 11px, 0.08em tracking, uppercase, muted): table heads and section labels (`.label-mono`).
- **Button** (mono, 13px, weight 500).

### Named Rules
**The Measured-Value Rule.** Anything measured is mono with tabular digits; anything a reader reads is sans.

## Layout

Standard app shell: sticky 56px top bar, then a page. Editor at desktop: a sticky run-of-show rail (280px as built) beside a column up to 720px, in a container up to 72rem (`max-w-6xl`), centred; below `lg` it is one column. Studies, images and responses use `max-w-6xl`; settings `max-w-3xl`. Page padding 16px on phones, 24px from `sm`; vertical rhythm of 32px between regions and 8-16px inside. Rail rows are a grid of number, icon, summary, duration separated by hairlines. On phones the wordmark drops to its mark and navigation stays.

## Elevation & Depth

Flat. Surfaces are separated by 1px borders and tonal steps (canvas, card, shell-raised), not shadows. The one shadow in the step card is a soft lifted drop (`0 12px 32px -12px rgb(0 0 0 / 0.45)`) while a card is being dragged, with an indigo border. The aurora is the only atmospheric effect.

### Named Rules
**The Flat-At-Rest Rule.** Nothing casts a shadow at rest. Depth appears only while dragging or in overlays.
**The Aurora Boundary Rule.** The aurora field (soft violet, teal, orange and indigo radial washes over a faint 72px perspective grid on `#17171d`) appears only on the login screen and the studies header band. Never on the editor, tables, dialogs or cards.

## Shapes

Square. All radii are 0, set in the theme, so shadcn components inherit it. Borders are 1px in the border token; the focus ring is a 2px indigo outline with 2px offset. Status marks are small squares (8px), variant tiles are squares (28px, or 20px small).

### Named Rules
**The Square Rule.** No rounded corners, pills or circles on surfaces, buttons, tiles or badges.

## Components

### Buttons
- **Shape:** square, height 36px (default), 24/32/44px other sizes, mono 13px medium.
- **Primary (default):** violet-to-indigo gradient, white text; hover brightens (115%). One per screen (Publish in the editor).
- **Solid:** flat indigo. **Outline / Secondary / Ghost:** border or muted fill, hover to muted. **Destructive:** tinted red fill with red text. **Link:** indigo, underline on hover.
- **States:** 150ms transitions, 1px press translation, 50% opacity disabled, 2px indigo focus outline.

### Variant tile
A flat colour square with the variant's letter (A, B, C...) in mono semibold. Colour follows position; the name sits beside it.

### Status badge
Mono 12px text with an 8px square: filled mint = Live, hollow outline = Draft, filled muted = Closed.

### Navigation
Dark 56px bar: wordmark (light-weight sans plus a fixation-cross mark with a mint cross), three links (Studies, Images, Settings) at 14px, muted until hover, active gets a 2px gradient underline. Right side: username in mono, theme toggle, log out.

### Run-of-show rail
Label "Run of show", ruled numbered list (mono two-digit index, step icon, summary clamped to two lines, mono duration or "own pace"), then totals "On a fixed clock" and "At their own pace".

### Step card
Card-coloured, 1px border, 48px header row with drag handle, icon, actions; border turns indigo while dragged. Consent card is locked.

### Image slot
4:3 box on the image mat; the image is contained at its own aspect ratio; target box is a 2px mint outline with 20% mint fill and a black hairline; "Change" overlay appears on hover or focus.

## Do's and Don'ts

### Do:
- **Do** keep canvas, mats and image surrounds hue-free grey.
- **Do** put new dark-bar surfaces inside `.shell`.
- **Do** set every measured value in `.data`.
- **Do** use the variant tile colour for a variant wherever it appears.
- **Do** keep all radii at 0.
- **Do** use mint only for live or done.

### Don't:
- **Don't** put the aurora anywhere but the login screen and studies header band.
- **Don't** tint the canvas or image mat "to warm it up".
- **Don't** use more than one gradient button per screen.
- **Don't** stack white rounded cards on lilac.
- **Don't** load fonts or assets from a CDN.

## Participant app (separate surface)

`frontend/participant/src/style.css` is its own rule set and is not part of the admin world. It is deliberately plain and must stay undecorated: system font stack, neutral greys (page `#f3f3f1`, ink `#1d1f21`, soft ink `#5c6166`, line `#d3d5d7`), one quiet slate accent (`#2f3a45`), danger `#8f2a2a`, focus blue `#1a5fb4`, 17px body, 640px page column, 10px radius on controls. No brand colour, gradient, aurora, mono voice, animation or decoration that could compete with the stimulus. Do not carry admin tokens into it.
