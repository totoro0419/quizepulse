# QuizPulse — face-to-face quiz

One-device, 2–4-player Japanese buzzer quiz web app.

- Up to four physical buttons on one screen, two facing each direction
- Mirrored question display for opposite players, using one shared reveal timer
- 9,000 question dataset, three difficulties and nine subject categories
- Spoken answers with local manual adjudication and scorekeeping
- No online multiplayer or remote server required for this local mode

Run with a static HTTP server to make `fetch('./data/...')` work. Publish this repository using GitHub Pages (main branch root) after uploading all app assets and question packs. Opening `index.html` via `file://` is not supported by all browsers.

**Testing:** Browser-based viewport and basic gameplay tests were run locally. Smartphone touch testing and GitHub Pages deployment are independent verifications.
