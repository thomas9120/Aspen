# Aspen Code Review Findings

Review date: 2026-07-10 (branch: `experimental`)

Status legend: [ ] open · [x] fixed

## Bugs

### 1. "Re-roll GM" leaves the old response on screen — `index.html` (`regenerateGmResponse`) [HIGH VALUE / LOW RISK]
- [x] Fixed
- `regenerateGmResponse()` pops the last GM entry from `state.gameLog` and appends the new one, but never removes the old entry's DOM node. The stale narration stays visible alongside the replacement, and both carry the same `data-log-index`, so edit buttons target the wrong entry.
- The pop also happens *before* the API call, so a failed request permanently loses the original GM text.
- **Fix:** pop only on success and re-render the log (`renderLog()`), matching `undoLastRound`.

### 2. Stray word "erotic" in the resolution prompt — `index.html` (resolution system prompt)
- [ ] Open — needs owner confirmation
- The GM resolution system prompt lists scene tones as "calm, dramatic, comedic, mysterious, **erotic**, or dangerous." The word appears nowhere else (not in the narrative prompt, AGENTS.md, or docs) and nudges every round-resolution the model writes.
- **Fix:** remove the word, or document it if intentional.

### 3. Many settings silently don't persist — `index.html` [HIGH VALUE / LOW RISK]
- [x] Fixed
- Only `apiUrl`, `userName`, `aiName`, `scenarioGoal` have input listeners. API key, model, both manual-review toggles, handicap controls, dual-endpoint fields, and all sampler sliders are only saved when something else calls `saveSettings()`. "Enter API key → refresh page" loses the key.
- **Fix:** attach `change`/`input` listeners (calling `saveSettings()`) to all sidebar settings controls.

### 4. Escape strands the round in a half-canceled state — `index.html` (document keydown handler)
- [ ] Open
- Escape while the AI review modal is open closes it and sets phase to `user`, but leaves `state.pendingAction` populated (including `aiDraft`); the pending-round panel keeps showing the draft and the user's logged declaration is never resolved. GM review modal can't be dismissed with Escape at all (inconsistent).
- **Fix:** fully cancel the round (clear `pendingAction`) or don't allow Escape to dismiss; make both modals behave the same.

### 5. Story summary prompt grows without bound — `index.html` (`buildStorySummaryPrompt`)
- [ ] Open
- Sends *all* entries older than the last 12 every time, including entries already merged into the summary on previous updates. Long sessions will overflow the backend context — on the feature meant to save context.
- **Fix:** track a "summarized through index N" marker in state/saves and only send new older entries.

### 6. Sidebar actions aren't locked during requests — `index.html` (`setBusy`)
- [ ] Open
- `setBusy()` only disables `#inputBar`. Start/Restart, Undo Round, Re-roll GM, and Update Summary remain clickable mid-request, causing overlapping LLM calls and state races (e.g., restart mid-AI-turn appends the stale AI action into the fresh game).
- **Fix:** guard game-mutating sidebar actions behind the busy flag.

### 7. Rolls render differently live vs. after reload — `index.html` (`sendUserAction` / `resolveAiAction` vs `renderLog`) [HIGH VALUE / LOW RISK]
- [x] Fixed
- Fresh entries show raw `[Roll: 14]` inline in text (no `meta` arg passed to `appendLog`); after Undo/Import Save, `renderLog()` strips it and renders the styled roll tag instead.
- **Fix:** pass `rollMeta` as the `meta` argument and strip the roll text for display, matching `renderLog`.

## Security

### 8. Export Save leaks API keys — `index.html` (`exportSave` / `serializeSettings`) [HIGH VALUE / LOW RISK]
- [x] Fixed
- `exportSave()` writes `api_key` and `ai_api_key` into the downloaded JSON. Save files are commonly shared.
- **Fix:** blank the keys on export; they're restored from localStorage on the same machine.

### 9. XSS in both creator pages — `character-creator_v1.html`, `scenario-creator.html` (preview panes) [HIGH VALUE / LOW RISK]
- [x] Fixed
- Preview panes do `previewContent.innerHTML = '<pre>' + JSON.stringify(card) + '</pre>'` with no escaping. Loading a card whose text contains `</pre><img src=x onerror=...>` executes attacker HTML/JS. Character cards are community-shared files, so this is a realistic vector.
- **Fix:** escape the interpolated content (or build the `<pre>` with `textContent`).

## Easy wins

### 10. No request timeout or cancel — `index.html` (`callLLM`) [HIGH VALUE / LOW RISK]
- [x] Fixed (timeout added; cancel button still a future idea)
- No `AbortController`; a hung local backend leaves the UI busy forever.
- **Fix:** add a timeout via `AbortController`; optionally a cancel button later.

### 11. `min_p` / `repetition_penalty` always sent — `index.html` (`callLLM`)
- [ ] Open
- The real OpenAI API rejects unknown arguments, so "any OpenAI-compatible endpoint" breaks against api.openai.com.
- **Fix:** omit them at their "off" values (min_p 0, repetition_penalty 1.0), like `top_k: 0` is handled.

### 12. `first_message` / `example_dialogue` imported but never used in prompts — `index.html`
- [ ] Open
- **Fix idea:** use `first_message` as the AI player's opening line; include example dialogue as few-shot flavor in `buildAiPrompt` — or drop from import docs.

### 13. Regenerating a resolution uses the narrative prompt — `index.html` (`regenerateGmResponse`)
- [ ] Open
- Re-roll GM after a round resolution rebuilds via `buildGmNarrativePrompt`, losing the dice-scale instructions.
- **Fix:** detect that the popped entry resolved a round and rebuild via `buildRoundResolutionPrompt`.

### 14. Dead code in character creator — `character-creator_v1.html`
- [ ] Open
- `drawCharacterCard` / `drawTextContent` are never called (`exportPNG` uses `drawCharacterCardText`).
- Also: the "SillyTavern JSON" output sets `spec: 'chara_card_v2'` but keeps fields flat instead of nesting under `data`, so it isn't spec-compliant, and the loader can't read real V2 (nested `data`) cards.

### 15. Docs mismatch: external font dependency — `index.html` / `AGENTS.md`
- [ ] Open
- AGENTS.md says "No external CDN dependencies," but `index.html` `@import`s Crimson Text from Google Fonts (silent failure offline).

### 16. GM and user share the same role icon — `index.html` (`renderEntry`)
- [ ] Open
- Both use `&#9876;` (⚔). Probably intended to differ.

### 17. Import Save mid-round sets phase to `user` — `index.html` (`importSave`)
- [ ] Open
- If the save ends on a user/AI declaration, that round can never resolve. Imported game log also isn't persisted to localStorage (refresh loses story; only settings persist).
