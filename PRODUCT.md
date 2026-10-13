# Still Teleprompter

<!-- impeccable:product-schema 1 -->

## Platform
web

Windows desktop utility, rendered with React in Tauri v2. The web preview cannot provide native window or capture features.

## Stack
Tauri v2, React, TypeScript and Rust. V2 adds an independent local Python process running SenseVoice through sherpa-onnx/ONNX Runtime, with deterministic script alignment in a Web Worker.

## Users
Presenters delivering long Microsoft Teams presentations while switching between PowerPoint, browsers and other applications.

## Product Purpose
Keep a script visible, readable and easy to navigate without interrupting a presentation. Presenters can read manually, explicitly start local speech following, or scroll at a configured pace; manual intervention always takes priority.

## Capabilities and Constraints

V2 extends Still 1.0.2; the current implementation is **2.0.0-beta.2**. It retains the existing script and block IDs, local saving, paste/TXT/Markdown/DOCX import, structured sections, spoken text and presenter cues, bookmarks, search, persistent reading position, appearance presets and controls, configurable global hotkeys, and Chinese/English interface preferences. Existing workspaces keep schema version 1; migration adds missing Auto Follow/Timed settings and the pause/resume hotkey without rebuilding scripts.

The Windows reading window retains its native no-focus reading mode and capture exclusion. Capture exclusion is requested by default and reports Windows API status; that status does not establish invisibility in every Teams sharing or recording path. Native window features, global hotkeys and the local speech engine require the Windows desktop application. The browser is a UI preview and reports the speech-engine limitation.

Reading modes and Auto Follow behavior:

- **Manual:** recognition and microphone capture are stopped. Manual scrolling, navigation and search remain available.
- **Timed:** explicitly start scrolling at a saved pace, default 240 and allowed 60–1200 characters/minute. It uses neither the microphone nor ASR and also runs in the browser preview.
- **Auto:** choosing the mode does not start microphone capture. Start is explicit, including after relaunch with a saved Auto preference. Selecting the already selected mode has no effect on an active session.
- **Following and holding:** local recognition is aligned to spoken blocks. Uncertain, short, ambiguous or off-script speech holds the reading position. Recovery searches more widely only after repeated local failures and requires stronger confirmation before a distant move; it does not interpret semantic paraphrases through an LLM or embeddings.
- **Auto paused:** automatic alignment and scrolling stop while the microphone and recognition remain active. Manual scrolling, keyboard scrolling, search, chapter navigation and opening an editing/settings panel pause following. Returning to reading does not resume it. Explicit Resume clears old audio and rejects stale recognition/alignment results before matching from the current reading position.
- **Stop or leave Auto:** the speech process and microphone stream close. Errors expose a retry path; a disconnected device requires refresh/reselection and another explicit start.

Timed counts Unicode letters and numbers in spoken text: each English letter is one character; spaces, punctuation, headings and presenter cues do not count. It maps each paragraph's average pace to its measured height and intervening layout gaps, using one animation loop. It does not track or highlight individual spoken characters. Resize remeasures and rebases from the current viewport. Manual actions, search, navigation, changes to pace/appearance and hidden/minimized pages pause it; Resume starts from the current position. Mode changes and relaunch require Start again. At the end it stops and explains how to navigate up and Start at the passage to reread; no countable spoken text disables Start.

Settings provide microphone selection/refresh and an advanced section for local runtime/model paths, recognition window, update interval, confidence threshold and optional timing/confidence diagnostics. Device and recognition parameters are disabled during an active Auto session, including pause; stop before changing them. Timed settings accept a whole-number pace on Enter or blur and explain the counting rule. The shared **Pause / resume scrolling** hotkey (default Ctrl+Alt+Space) controls already started Auto or Timed scrolling; it does not start an inactive session.

Recognition runs locally with bounded in-memory audio and serial inference. Shared microphone capture is implemented, but coexistence with Teams and different device classes still needs acceptance testing. Audio and recognition text are neither saved nor uploaded. Diagnostics display metrics, not audio or recognized text. No LLM, accounts or cloud API is used.

## Brand Commitments
Apple-inspired minimalism, restrained typography, generous spacing, subtle rounded corners. No emojis or unnecessary decoration. Reading and editing/settings are separate surfaces.

## Evidence on Hand

The supplied requirements are `Windows Desktop Teleprompter — V1.txt` and `Teleprompter V2 — Auto Follow Mode.txt`. The user-requested third Timed mode supersedes the original V2 brief's two-mode limit. Still is the established implementation name. The existing application, `src/styles.css`, reading presets and components provide the incumbent visual system.

Validation status is recorded in [docs/V2-VALIDATION.md](docs/V2-VALIDATION.md), with remaining acceptance steps in [docs/V2-MANUAL-TESTING.md](docs/V2-MANUAL-TESTING.md). Native microphone capture and real offline inference have passed separate checks. Beta.2 has passed 56 frontend tests, TypeScript checks and a Windows release build. Actual browser Timed running/paused/finished states and the saved 240 pace in 340px settings have been verified. These checks do not establish natural-speech end-to-end following, native shortcut delivery, long native timing or actual meeting behavior.

The beta.2 finish review resolved three material findings and reached a ship disposition for the frontend Timed extension; it is not full native acceptance. The earlier Auto review resolved same-mode selection and paused microphone copy. Its paused-control screenshot was a clearly marked synthetic fixture; the beta.2 Timed browser captures are actual scrolling states and do not provide live speech-following evidence.

V2 remains beta pending natural Chinese/English/mixed-speech end-to-end reading, accuracy/latency and distant-jump acceptance, Teams microphone coexistence, two-hour operation, long native Timed runs, native control/hotkey and capture-exclusion regression, and distribution checks. Do not present target accuracy, typical latency, meeting compatibility or sustained timing/stability as measured product claims.

## Product Principles
Reading is the primary surface. Manual actions always win. Preserve imported originals and existing reading state. Microphone activation is explicit; pause and stop must communicate their different effects. Prefer holding the current position over an uncertain jump. State native failures and unverified acceptance clearly. Prioritize a runnable Windows application.
