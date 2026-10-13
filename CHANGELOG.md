# Changelog

## [2.0.0-beta.2] - 2026-10-14

- Added timed scrolling with a configurable 60–1200 characters per minute; English letters count individually. Manual actions pause scrolling, resuming keeps the current position, and the end of the script stops the timer.
- Added local SenseVoice automatic following with conservative text matching, microphone selection, explicit pause/resume/stop and no cloud speech service.
- Preserved saved scripts, imports, bookmarks, search, appearance, bilingual interface and Windows reading-window controls from 1.0.2.
- Published a Windows x64 portable package including the speech model, Python and inference runtime, with source and third-party licenses.
- This is a beta. Natural mixed speech, Teams microphone coexistence and long native sessions remain pending; see `docs/V2-VALIDATION.md`.
