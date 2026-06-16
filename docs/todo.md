# Aspen TODO

## Story Summary Memory

### Phase 2: Manual Summary Update (Done)

- Added an **Update Summary** button near the Story Summary textarea.
- Uses the GM endpoint to summarize older history into `state.storySummary`.
- Summarizes only entries older than the recent context window.
- Sends the summarizer:
  - Existing Story Summary
  - Older `gameLog` entries not included in the latest 12-entry context window
  - Scenario Goal, if present
- Asks for compact continuity notes, not prose.
- Preserves user editability after the summary is generated.
- Shows loading, success, and error states with existing toast/status patterns.
- Keeps full `gameLog` unchanged and fully exportable.

Suggested summary instruction:

```text
Summarize the older scene history for future RPG continuity.
Keep: major events, current location, active NPCs, unresolved clues, promises, injuries/status effects, inventory-relevant discoveries, relationship changes, tone, and scenario goal progress.
Do not invent new events.
Do not write dialogue for user characters.
Use concise bullet points.
```

### Phase 3: Optional Auto-Summary

- Add an optional **Auto-update summary** toggle after manual summary feels reliable.
- Trigger summary updates only when enough older entries exist outside the recent window.
- Avoid running summary during every turn; use a round/message threshold.
- Make auto-summary transparent with a brief status/toast when it runs.
- Never block the user from editing Story Summary manually.
- Keep manual **Update Summary** available even when auto-summary is off.

### Tests To Add

- Auto-summary, if added, respects the threshold and does not fire during every round.

### Tests Added

- Manual summary prompt sends only older entries, not the latest 12.
- Existing Story Summary is included in the summarizer prompt.
- Generated summary updates state, textarea, localStorage, and save export.
- Summary failure leaves the existing Story Summary unchanged.
