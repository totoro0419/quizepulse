# QuizPulse — face-to-face quiz

One-device, 2–4-player Japanese buzzer quiz web app.

- Four touch areas across two opposing sides, with mirrored question text.
- 9,000-question dataset; three difficulties and nine categories.
- Two-step answer ownership: buzz first, then only the winner can press **回答開始** on the same button within **3 seconds**.
- The subsequent one-character four-choice input has a time limit scaled to the accepted kana reading (12–30 seconds). Questions without a verified kana reading retain a 10-second manual adjudication mode.
- If confirmation expires, that player cannot buzz again on the current question; remaining players can continue. No score penalty for missing confirmation. Answer mistakes or answer-time expiry have the existing −5-point penalty.
- The selected player's side is the only side allowed to enter an answer. Player 1–4 keyboard keys follow the same two-step flow.
- No internet-based multiplayer is part of this one-device mode.

Run via a static HTTP server or GitHub Pages. Direct file:// access may not load question packs.

**Verification:** UI state transition tests cover confirmation, wrong-player prevention, timeout, kana input, keyboard and mobile/tablet viewport emulation. Physical devices remain unverified.
