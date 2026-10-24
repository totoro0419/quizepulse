# QuizPulse — face-to-face quiz

One-device, 2–4-player Japanese buzzer quiz web app.

- Four touch areas across two opposing sides, with mirrored question text.
- At the start of every new question, both sides first display **「問題」 for 1.1 seconds**, then begin synchronized character-by-character question reveal. Buzzing is disabled during the cue.
- 9,000-question dataset; three difficulties and nine categories.
- One-tap buzzer: when a winner is determined (65 ms adjudication window), four-choice input opens immediately, without a second confirmation button.
- The subsequent one-character four-choice input has a **5-second time limit per character**, refreshed after every valid nonfinal character. All 9,000 questions have pre-registered accepted input strings, including kana, numerals, Latin letters and symbols. There is no manual-adjudication fallback. The answer packs are stored in nine lightweight JSON files and only the selected difficulty's three packs load.
- Incorrect answers or one-character timeout have the existing −5-point penalty, after which other players may buzz for the same question.
- A pair of players shares one 2×2 grid of answer choices per side. During an answer it moves to the winner's left/right seat in the corresponding rotated or unrotated half; lone player sides use a centered grid. Player 1–4 keyboard keys can buzz with a single press.
- No internet-based multiplayer is part of this one-device mode.
- Registered alternate answers are recognized through their allowed readings, not guessed by a generic reading converter. Source answer readings have been matched to 9,000 existing IDs. External factual audits of every accepted alias are not complete.

Run via a static HTTP server or GitHub Pages. Direct file:// access may not load question packs.

**Verification:** Code checks cover one-tap ownership, answer-side placement, 2×2 options and per-character timeout. Full browser device tests remain unverified for this revision. Physical devices remain unverified.

## PWA and offline play

QuizPulse can be installed on Android Chrome via the **アプリをインストール** button when the browser presents an install prompt. On iPhone/iPad, open the page in Safari and choose Share → **ホーム画面に追加**. The installed application opens directly in standalone mode.

The service worker is scoped to this repository's Pages path. On the first online visit it caches the app shell plus **all 18 question/answer JSON files (9,000 questions)**. The setup screen shows whether the offline set is complete, and can retry any missing files with **9,000問をオフライン保存**. An online first visit is necessary; offline availability depends on storage being retained by the browser.

Icons are generated from `tools/generate_pwa_icons.py` during the Pages build (using Python standard library, no external dependencies). The PNG icon files exist in the deployed Pages artifact. Whenever the UI or bank data changes, increment the `VERSION` in `sw.js` and the cache-busting query strings in `index.html` and `sw.js` together.

The PWA adds no backend, cloud variables, account system, or network multiplayer. Real-device installation and airplane-mode offline startup require independent testing.
