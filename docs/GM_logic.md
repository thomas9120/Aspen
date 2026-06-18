# GM Logic

This document explains how Aspen sequences the Game Master, user player, and AI player. The goal is to make the game feel like a tabletop round: the GM frames the scene, both players declare what they do, and then the GM resolves the combined outcome.

---

## Core Round Flow

Each round follows this order:

1. **GM frames the scene**
   - The GM describes the current situation.
   - The GM keeps the scenario goal present when one exists.
   - The GM opens a clear next choice for the players.

2. **User declares an action**
   - The user types an action or line of dialogue.
   - Aspen rolls a d20 for the user.
   - The user action and roll are added to `gameLog`.
   - The GM does **not** resolve the action yet.

3. **AI player declares an action**
   - The AI player sees the updated scene history, including the user's pending action.
   - The AI chooses its own action for the same round.
   - If Manual Review is enabled, the user can edit or regenerate the AI action.
   - Aspen rolls a d20 for the AI player.
   - The AI action and roll are added to `gameLog`.

4. **GM resolves the round**
   - The GM receives the full scene history plus both round declarations.
   - The GM resolves both actions together in the order that makes the most sense.
   - The GM moves the scenario forward with a tone-appropriate story beat.
   - The next round begins with the user player.

In short:

```text
GM scene -> User action + roll -> AI action + roll -> GM resolves both -> User action...
```

---

## Why Resolution Waits

The GM should not respond immediately after the user action because that makes the AI player react to an already-resolved scene. Instead, both players should commit to the round before the GM narrates the outcome.

This keeps the AI player from feeling skipped and lets the GM adjudicate the pair of actions as one scene beat.

---

## State During a Round

The permanent visible history stays in `state.gameLog`.

```javascript
state.gameLog = [
  { role: "gm", content: "The old bridge sways above the mist..." },
  { role: "user", content: "I test the ropes before crossing. [Roll: 14]" },
  { role: "ai", content: "I hold the lantern high and watch the far side. [Roll: 9]" },
  { role: "gm", content: "The ropes hold, but the lantern catches a silver mark..." }
];
```

The temporary in-progress round lives in `state.pendingAction` until the GM resolves it.

```javascript
state.pendingAction = {
  user: {
    name: "Arin",
    action: "I test the ropes before crossing.",
    roll: 14,
    rollMeta: "Roll: 14"
  },
  ai: {
    name: "Elara",
    action: "I hold the lantern high and watch the far side.",
    roll: 9,
    rollMeta: "Roll: 9"
  }
};
```

After the GM response is added to `gameLog`, `pendingAction` is cleared.

Prompt builders use the editable Story Summary plus only the latest 12 `gameLog` entries as scene history. The full `gameLog` remains visible in the UI and is preserved in saves. The manual **Update Summary** action summarizes only older entries outside the recent window.

---

## Prompt Responsibilities

### GM Narrative Prompt

Used when the GM frames or refreshes the scene.

The GM should:

- Act as a fair facilitator, not an adversary trying to defeat the players.
- Describe what has changed since the last turn.
- Keep the Scenario Goal alive when present.
- Balance tension with reward; do not escalate every turn.
- Let victories, clever choices, and earned advantages breathe.
- Match the current tone.
- Offer a clear next opening for player choice.
- Never write actions or dialogue for player characters.
- Do not write dialogue for user characters.

### AI Player Prompt

Used after the user has declared an action but before the GM resolves the round.

The AI should:

- Treat the user's action as a pending declaration.
- Choose its own action for the same round.
- Speak or act only for its own character.
- Avoid narrating the world or resolving outcomes.

### GM Round Resolution Prompt

Used after both player declarations and rolls are known.

The GM should:

- Act as a fair facilitator, not an adversary trying to defeat the players.
- Resolve both declared actions.
- Use each final adjusted d20 roll to determine that character's outcome quality.
- Respect successful rolls by producing meaningful progress, advantage, safety, discovery, leverage, avoided danger, or partial/complete success.
- Avoid canceling a strong roll with an equal or worse immediate setback.
- Keep failed-roll consequences proportional and rooted in the established fiction.
- Pick the order of resolution that makes sense for the scene.
- Move the scenario forward by one meaningful beat.
- Keep calm scenes calm and dramatic scenes dramatic.
- End with a clear next opening for player choice.
- Not invent new player-character actions or dialogue beyond the declarations already made.
- Not write dialogue for user characters.

---

## Skip / Pass Behavior

If the user clicks Skip, Aspen records a neutral user declaration:

```text
Passes for now.
```

The AI still takes its turn, then the GM resolves the round. This lets the AI act while the user character intentionally waits, observes, or holds position.

---

## Manual AI Review

Manual Review pauses the round after the AI drafts an action but before the AI roll and GM resolution.

The user can:

- Edit the AI action.
- Regenerate the AI action.
- Confirm the action.

Only after confirmation does Aspen roll for the AI and ask the GM to resolve both player declarations.

---

## Manual GM Review

Manual GM Review pauses before GM narration or round resolution is appended to the story log.

The user can:

- Edit the GM response.
- Regenerate the GM response from the same prompt.
- Confirm the response.

For round resolution, player and AI rolls have already happened before the GM draft is reviewed. Regenerating the GM response does not reroll or change those pending player declarations.

---

## Design Rules

- Every API call is stateless; prompts are rebuilt from local state each time.
- `gameLog` remains the source of visible history.
- GM and AI prompts receive Story Summary plus a recent context window, not the full saved/displayed log.
- `pendingAction` is temporary and should not be exported as part of save history.
- Handicap math is internal; visible story text and GM prompts should show only the final adjusted roll.
- The GM resolves rounds, not isolated player actions.
- The AI player acts before knowing the GM's outcome for the user's action.
- Prompt changes should preserve tone control so calm roleplay does not become artificially stressful.
