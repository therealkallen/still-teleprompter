---
name: Still Teleprompter
description: A quiet floating reading window with Manual, local Auto Follow and Timed scrolling.
colors:
  accent: "#b1c9b8"
  panel: "#25282b"
  control: "#303438"
  muted: "#b0b7b1"
  line: "#3d4242"
  ui-text: "#e9ebe7"
  input: "#1e2123"
  warning: "#e9bf92"
  dark-reading-bg: "#202225"
  dark-reading-text: "#f3f1ec"
  light-reading-bg: "#f5f4ef"
  light-reading-text: "#292d2b"
  transparent-reading-bg: "#151719"
  transparent-reading-text: "#ffffff"
typography:
  body:
    fontFamily: "Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "28px"
    lineHeight: 1.7
  title:
    fontFamily: "Segoe UI Variable, Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Segoe UI Variable, Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "12px"
rounded:
  window: "12px"
  control: "7px"
  icon: "6px"
  floating-controls: "10px"
  search: "8px"
spacing:
  compact: "4px"
  control-gap: "8px"
  toolbar: "12px"
  narrow-panel: "16px"
  panel: "24px"
  reading-inset: "32px"
components:
  button:
    backgroundColor: "{colors.control}"
    textColor: "{colors.ui-text}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
    typography: "{typography.label}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#202b23"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  input:
    backgroundColor: "{colors.input}"
    textColor: "#f1f2ef"
    rounded: "{rounded.control}"
    padding: "10px"
---

# Still design

## Overview

The supplied brief fixes the visual direction: a quiet, Apple-inspired floating reading window. A charcoal reading surface, warm white text, restrained sage accents and familiar Windows typography keep the script central. V2 extends this incumbent system with Auto Follow and Timed controls; it does not introduce a new identity.

Reading is the Read surface; editing, navigation and preferences are Operate surfaces. Large script text dominates the compact utility window. The main toolbar and floating manual controls fade after pointer inactivity, then become visible on pointer activity, hover or keyboard focus. The reading-mode strip stays visible while reading so scrolling state, Auto microphone state and the next action remain available.

**The Reading First Rule.** Add status and controls around the script without turning the reading surface into a dashboard. Use concise state text, one shared line-icon style and no emojis or unnecessary decoration.

## Colors

### Primary

Sage is the single accent. It marks focus, primary actions, bookmarks, progress, confirmed capture status and active following/scrolling. It should help presenters locate the relevant control or state without competing with spoken text.

### Neutral

Charcoal reading colors form the default preset; warm paper and white-on-transparent presets remain available. Reading background opacity and text opacity are independent settings. Preset colors are starting values, not a restriction on the presenter's appearance controls.

Settings and editing use the solid panel surface, darker input wells and subtle divider lines. Muted neutral text carries help and secondary labels. Warning amber carries speech errors, native limitations and capture failures; pair color with meaningful text or an accessible label.

**The Solid Controls Rule.** Reading transparency must not reduce the legibility of settings, navigation or editing controls. Their surfaces use their own solid colors.

## Typography

Use Segoe UI Variable/Segoe UI with Microsoft YaHei and sans-serif fallbacks for the interface. The default script uses Segoe UI; the existing appearance selector also offers Arial, Georgia, Microsoft YaHei and SimSun.

- Spoken text starts at the body token size and line height; presenters can adjust it. The transparent preset starts at 30px with a 1.8 line height.
- Panel and toolbar titles use the title token. Standard control labels use the label token; reading-mode controls and help text use 11px, and footer details use 10px.
- Section headings and presenter cues are smaller than spoken text (0.64em). Section headings use semibold weight; cues have configurable color, italic styling and visibility.
- Numeric progress, range values and diagnostic metrics use tabular numerals. Long script text and diagnostic details wrap rather than widening the window.

Keep paragraph entry free of decorative animation. Smooth scrolling is the signature reading interaction; reduced-motion preference removes control transitions/animations and smooth jumps. Explicitly started Timed scrolling retains its configured pace.

## Layout

The initial viewport is a 480 × 640 utility window. A 52px toolbar sits above the reading surface and a 30px footer carries section/title, save state and progress. The reading-only mode strip has a minimum height of 36px. Panels occupy the same window between toolbar and footer, preserving the existing focus and capture-protection model.

The script has generous margins: 32px at the sides, 60px above and trailing space so the final passage can reach the eye-line. Manual mode retains the marker near the top of the reader; Auto and Timed place it at 38% of the reader height. Auto targets that line; Timed maps paragraph pace to actual rendered height and gaps. Manual navigation remains available in both.

At widths below 380px, panel padding and script margins become narrower. Keep the existing 340px reading and settings layout usable: forms scroll vertically, labels can wrap, and compact status text can ellipsize while its full help remains accessible. Do not add a second window for routine settings.

## Elevation & Depth

Depth comes mainly from tonal layering, not ornamental effects. The window, panel, input and selected control each have a distinct surface tone. Quick search and notices use modest shadows to distinguish temporary overlays; regular settings sections use spacing and dividers. Do not add glass effects to the solid settings surface.

## Shapes

The window uses gently rounded corners from the window token. Standard buttons and fields use the control token; icon buttons, search and floating reading controls use their own observed radii. Thin borders define inputs and settings dividers. Preserve the small three-line sage brand mark and matching SVG line icons.

## Components

### Toolbar and manual reading controls

Use compact ghost icon buttons with tooltips and accessible action names. The toolbar exposes drag, capture status, search, navigation, editing, settings and window actions. Floating controls retain previous/next section, up/down scrolling and bookmark actions. Both reveal on hover or focus; open panels and search keep the toolbar visible. Capture status reports the Windows API result and links to settings, without claiming universal meeting invisibility.

### Reading-mode strip

Extend the same dark utility chrome with a compact Manual/Auto/Timed segmented selector, short status and start/pause/resume/stop actions. Auto uses the microphone icon; Timed uses a clock icon. Selected mode uses a tonal sage surface and `aria-pressed`; selecting it again must preserve the current session. In a narrow window, the status text may ellipsize while icons and action buttons remain visible.

Auto states distinguish not started, loading, following, waiting for a match, paused and speech error. Timed states distinguish not started, scrolling, paused, no spoken text and end of script. Active following/scrolling uses sage; errors use warning amber. Status has `role="status"`, with full explanatory text in its title and accessible label. Timed help includes the configured characters/minute and says it uses no microphone. Keep the state understandable without relying on color or animation.

**The Explicit Microphone Rule.** Mode selection is separate from Start. Auto paused copy must say that scrolling has stopped while the microphone keeps listening; Stop or leaving Auto closes it. If paused during loading, explain that listening continues after the model is ready. Timed never uses the microphone. Returning from a manual action requires explicit Resume in either active mode.

At the Timed end state, keep the existing Start action and explain that the presenter must navigate up to the desired spoken passage before starting again. Disable Start when no countable spoken text exists. The shared shortcut label is the mode-neutral “Pause / resume scrolling.”

### Settings and fields

Use vertically stacked, labelled fields and restrained section headings on the solid panel surface. Standard buttons have a quiet tonal background; primary actions use sage. Hover changes the control tone, and keyboard focus has a visible sage outline. Disabled controls visibly dim and retain their labels.

Auto Follow settings expose microphone selection and refresh first, with local-only privacy and pause/stop explanation nearby. Advanced runtime/model paths, recognition window, update interval, confidence threshold and optional metrics live inside a disclosure. Recognition parameters are disabled while active; keep Stop available before the presenter changes them. Browser and native errors use concise actionable warning text. Diagnostics show timing, confidence and sequence information rather than a transcript.

Timed settings reuse the same solid section and field styling, with a compact numeric pace input (100px wide). State characters/minute, the default 240 and whole-number range 60–1200. Explain that Unicode letters/numbers in spoken text count, each English letter is one character, and spaces/punctuation/headings/cues do not count. Commit on Enter or blur; invalid input shows an inline alert and `aria-invalid`. Describe this as paragraph-average pace, and keep explicit Start, current-position Resume and end-stop behavior clear.

### Navigation, search and feedback

Navigation keeps the existing list/segment language and sage bookmark controls. Quick search sits above the script as a compact overlay; matches use sage tint and the current match uses a stronger readable highlight. Save state and progress stay in the footer. Notices are temporary, readable overlays with a dismiss action, and errors expose recovery actions where supported.

## Do's and Don'ts

- Do extend the incumbent reading window, sage palette, typography and compact line icons when adding V2 controls.
- Do keep controls reachable by keyboard and reveal fading controls on focus.
- Do use accurate microphone and native-status text, including the distinction between paused and stopped.
- Do preserve manual navigation, visible presenter-cue distinctions and independent reading opacity settings.
- Don't introduce a new visual identity, decorative paragraph animation, emoji or dashboard density into reading.
- Don't let reading transparency affect the solid settings surface.
- Don't imply natural-speech accuracy, Teams compatibility or sustained performance from a screenshot or a synthetic control fixture; validation evidence belongs in PRODUCT.md and the validation documents.
