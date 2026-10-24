# QuizPulse — face-to-face quiz

One-device, 2–4-player Japanese buzzer quiz web app.

- Four touch areas across two opposing sides, with mirrored question text.
- At the start of every new question, both sides first display **「問題」 for 1.1 seconds**, then begin synchronized character-by-character question reveal. Buzzing is disabled during the cue.
- 9,000-question dataset; three difficulties and nine categories.
- Two-step answer ownership: buzz first, then only the winner can press **回答開始** on the same button within **3 seconds**.
- The subsequent one-character four-choice input has a **5-second time limit per character**, refreshed after every valid nonfinal character. All 9,000 questions have pre-registered accepted input strings, including kana, numerals, Latin letters and symbols. There is no manual-adjudication fallback. The answer packs are stored in nine lightweight JSON files and only the selected difficulty's three packs load.
- If confirmation expires, that player cannot buzz again on the current question; remaining players can continue. No score penalty for missing confirmation. Answer mistakes or answer-time expiry have the existing −5-point penalty.
- The selected player's side is the only side allowed to enter an answer. Player 1–4 keyboard keys follow the same two-step flow.
- No internet-based multiplayer is part of this one-device mode.
- Registered alternate answers are recognized through their allowed readings, not guessed by a generic reading converter. Source answer readings have been matched to 9,000 existing IDs. External factual audits of every accepted alias are not complete.

Run via a static HTTP server or GitHub Pages. Direct file:// access may not load question packs.

**Verification:** UI state transition tests cover confirmation, wrong-player prevention, timeout, kana input, keyboard and mobile/tablet viewport emulation. Physical devices remain unverified.
