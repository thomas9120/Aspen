# Aspen — Agent Documentation

## Overview

Aspen is a lightweight, single-file web interface for running AI-driven RPG scenarios. It connects to any OpenAI API-compatible endpoint (with out-of-the-box presets for llama.cpp and koboldcpp) and orchestrates a turn-based game between a human user, an AI player, and a Game Master (GM).

The interface is intentionally minimal and portable. The entire UI lives in `index.html` with zero build steps and no external dependencies. Users open the file in a browser, configure their API endpoint, import character cards and scenarios, and play.

---

## File Structure

```
Aspen/
├── index.html          (The entire application: HTML, CSS, JS)
├── AGENTS.md           (This file — architecture and dev reference)
├── cards/              (Character card JSONs for import)
├── scenarios/          (Scenario / world JSONs for import)
└── saves/              (Exported game session JSONs)
```

Because `index.html` is loaded via `file://` protocol, it cannot directly read the local filesystem. All imports (cards, scenarios, saves) use the browser's native `<input type="file">` API. This keeps the project zero-server and fully portable.

---

## Core Game Loop

The game proceeds in discrete turns. Each full round consists of the following phases:

1. **GM Phase (Narrative)**
   - The GM LLM receives the world info, character summaries, and the full scene history.
   - It narrates the current scene and sets the stage for player actions.

2. **User Player Phase**
   - The user types their character's action or dialogue.
   - The frontend rolls a d20.
   - The action text + roll result are added to the scene log as a pending round declaration.

3. **AI Player Phase**
   - The AI Player LLM (or the same LLM in a different persona) receives the updated scene history, including the user's pending declaration, and its character card.
   - It generates a concise action or line of dialogue.
   - If **Manual Review** is enabled, the UI pauses and shows the generated action in an editable text box. The user can edit it and click **"Confirm Roll"** to proceed.
   - The frontend rolls a d20.
   - The action text + roll result are added to the scene log as the AI player's pending round declaration.

4. **GM Resolution Phase**
   - The GM LLM receives the full scene history plus both player declarations and roll results for the round.
   - It resolves both actions together in whatever order makes sense for the scene.
   - It moves the scenario forward and opens the next player choice.

5. **Loop**
   - The cycle returns to the User Player Phase.

**Important:** Every API call is stateless. The frontend maintains a clean internal `gameLog` and reconstructs the full prompt for each role on every request. This prevents context contamination when using a single LLM for multiple roles.

---

## LLM Configuration Modes

### Single-LLM Mode (Default)
- One API endpoint serves all roles.
- Separate prompts with distinct system personas are sent in independent requests.
- Because there is no server-side conversation memory, the LLM has no knowledge of the previous role's system instructions.

### Dual-LLM Mode
- A toggle in Settings enables a second API endpoint specifically for the AI Player.
- The GM uses Endpoint A, the AI Player uses Endpoint B.
- The User Player is always the human; no LLM is used for the user.

### API Presets
- **llama.cpp:** `http://localhost:8080/v1`
- **koboldcpp:** `http://localhost:5001/v1`
- Custom URL/Key/Model fields are always available.

---

## Prompt Architecture (Stateless)

### Why Stateless?
When using a single LLM for both GM and Player, relying on server-side chat history risks metagaming and role bleed. By sending the full curated history in every request and never using conversation IDs, we guarantee a clean slate for each role.

### Internal Game Log Format
```javascript
gameLog = [
  { role: "gm",    content: "The torches flicker in the damp crypt..." },
  { role: "user",  content: "I try to pick the lock. [Roll: 14]" },
  { role: "gm",    content: "The lock clicks open. Beyond it..." },
  { role: "ai",    content: "I draw my sword and step forward. [Roll: 18]" },
  { role: "gm",    content: "Your blade gleams in the torchlight..." }
]
```

### GM Prompt Template
```
[SYSTEM]
You are the Game Master (GM) of a tabletop RPG and an active guide for the scenario. You describe the world, control NPCs, set the scene, and keep momentum toward the Scenario Goal when one exists. Preserve the scene's current tone, whether calm, dramatic, comedic, mysterious, or dangerous. Introduce meaningful developments such as new information, NPC responses, environmental changes, emotional beats, choices, opportunities, or natural consequences. You do NOT control the Player characters. Be vivid and concise.

[WORLD INFO]
{scenario_description}

[CHARACTERS]
User Player: {user_name} — {user_card_summary}
AI Player: {ai_name} — {ai_card_summary}

[SCENARIO GOAL] (optional — only included if set)
The central tension or objective right now is: {scenario_goal}

[SCENE HISTORY]
{formatted_history}

[INSTRUCTION]
Describe what has changed since the last turn and frame the current scene vividly. Keep the Scenario Goal alive in the narrative if one is provided. Move the scenario forward by at least one meaningful beat: reveal new information, show an NPC response, shift the mood, change the environment, offer an opportunity, introduce a natural consequence, or bring the Scenario Goal closer or farther away. Match the scene's current tone; calm scenes can remain calm. End with a clear next opening for player choice. Do not write actions for the players.
```

### AI Player Prompt Template
```
[SYSTEM]
You are roleplaying as {ai_name}.
Personality: {ai_personality}.
You are a PLAYER, not the GM. You only control your own character's thoughts, speech, and actions.
You do NOT know anything the GM hasn't explicitly told you. You do NOT narrate the world.

[SCENE HISTORY]
{formatted_history}

[INSTRUCTION]
Based ONLY on the scene history above, what does {ai_name} do or say next? Respond with a single concise action or line of dialogue. Do not narrate the environment or other characters.
```

### Resolution Prompt Template
```
[SYSTEM]
You are the Game Master. Resolve the current round based on the scene history, both player declarations, and their dice rolls. Preserve the scene's current tone, whether calm, dramatic, comedic, mysterious, or dangerous.

[SCENE HISTORY]
{formatted_history}

[ROUND ACTIONS TO RESOLVE]
{user_name}: {user_action_text}
{user_roll_or_no_roll}

{ai_name}: {ai_action_text}
{ai_roll_or_no_roll}

[INSTRUCTION]
Narrate the direct outcome of both declared actions in an order that makes sense for the scene. Treat these as the players' decisions for this round; do not ask for more input before resolving them. After resolving the round, always move the scenario forward by at least one meaningful beat: reveal new information, show an NPC response, shift the mood, change the environment, offer an opportunity, introduce a natural consequence, or bring the Scenario Goal closer or farther away. Match the scene's current tone; calm scenes can remain calm. End with a clear next opening for player choice, such as a question, opportunity, reaction, clue, invitation, complication, or changed circumstance. Do not merely describe the aftermath and wait. Do not write new actions for the player characters beyond resolving what they already declared.
```

---

## JSON Schemas

### Character Card
Supports a lightweight custom format and existing community formats (TavernAI V2 / SillyTavern).

**Custom Aspen Format:**
```json
{
  "format": "aspen-character-v1",
  "name": "Elara Moonwhisper",
  "summary": "A rogue elven archer with a sharp tongue.",
  "personality": "Cynical, loyal to friends, hates authority.",
  "first_message": "*adjusts her quiver* Keep up, or you'll get left behind.",
  "example_dialogue": [
    "{{user}}: Who are you?",
    "{{char}}: Someone who'd rather not be here. But since I am... let's get paid."
  ]
}
```

**TavernAI V2 (SillyTavern) Import:**
When importing a `.json` with `data.name`, `data.description`, `data.personality`, `data.first_mes`, and `data.mes_example`, the app maps those fields to the internal Aspen schema.

### Scenario / World JSON
```json
{
  "format": "aspen-scenario-v1",
  "title": "The Sunken Spire",
  "description": "A coastal town has been plagued by strange lights beneath the waves. The old lighthouse keeper swears he saw a spire rise from the deep...",
  "world_info": "Magic is rare. The sea is unpredictable. Pirates patrol the eastern routes.",
  "starting_scene": "You stand on the cliffs above the harbor. The storm is rolling in.",
  "scenario_goal": "Investigate the sunken spire and uncover why the lights beneath the waves have returned before the storm seals the harbor."
}
```

### Save Game JSON
```json
{
  "format": "aspen-save-v1",
  "exported_at": "2026-05-12T12:00:00Z",
  "settings": {
    "api_url": "http://localhost:8080/v1",
    "api_key": "",
    "model": "",
    "dual_llm_enabled": false,
    "ai_api_url": "",
    "ai_api_key": "",
    "ai_model": "",
    "ai_auto_mode": true,
    "temperature": 0.8,
    "top_p": 0.95,
    "min_p": 0.05,
    "top_k": 40,
    "repetition_penalty": 1.1,
    "max_tokens": 1024,
    "user_name": "Arin",
    "ai_name": "Elara"
  },
  "scenario": { ... },
  "user_card": { ... },
  "ai_card": { ... },
  "game_log": [ ... ]
}
```

---

## UI Layout (index.html)

### Left Sidebar (Collapsible on mobile)
- **Settings Panel**
  - API URL, API Key, Model
  - Preset dropdown: llama.cpp / koboldcpp / Custom
  - Dual-LLM toggle (reveals second API block)
  - AI Player: Auto / Manual toggle
  - **Sampler Settings** (collapsible): Temperature, Top-P, Min-P, Top-K, Repeat Penalty, Max Tokens — each with a range slider and number input, synced bidirectionally. Parameters with a "disabled" value show a hint (e.g., "0 = off" for Min-P, "1.0 = off" for Repeat Penalty). Map directly to the API request body. Top-K is omitted from the request when set to 0.
  - Character Name inputs (User + AI)
- **Scenario Goal**
  - Editable textarea for the current objective / conflict. Lives in `state.scenario.scenario_goal` and is injected into GM prompts when present.
- **Import / Export**
  - Import Character Card (file picker)
  - Import Scenario (file picker)
  - Export Save (downloads JSON)
  - Import Save (file picker)

### Main Stage
- **Top Bar**
  - Connection/status text, dice roll chip, roll history, Story/Compact density toggle, expandable story search, and Start/Restart.
- **Play HUD** (collapsible below the phase tracker)
  - Turn phase tracker remains visible when collapsed: GM Scene, Your Action, AI Action, Resolution.
  - Expanded details show character presence cards and the pending/current round summary.
- **Scene Log** (scrollable, auto-scrolls to bottom)
  - GM entries styled with a parchment/dark theme
  - User entries right-aligned
  - AI entries left-aligned with distinct color

### Bottom Input Bar
- **User Action Input** (text area)
- **Roll d20 & Send** button
- **Skip / Pass Turn** button (optional)

### AI Review Modal (appears when Manual Review is ON)
- Shows the AI-generated action
- Editable text area
- **Confirm Roll** button
- **Re-roll Action** button (regenerate from LLM)

---

## State Management

All application state lives in a single JavaScript object:

```javascript
const state = {
  settings: {
    ...,
    temperature: 0.8,
    topP: 0.95,
    minP: 0.05,
    topK: 40,
    repeatPenalty: 1.1,
    maxTokens: 1024,
    ...
  },
  scenario: null,
  userCard: null,
  aiCard: null,
  gameLog: [],
  turnPhase: 'gm', // 'gm' | 'user' | 'ai' | 'ai_review' | 'resolution'
  lastRoll: null,
  pendingAction: null, // null or { user: { name, action, roll, rollMeta }, ai: { name, action, roll, rollMeta } }
  sessionNotes: '',
  logDensity: 'story',
  logSearch: '',
  sidebarCollapsed: false,
  hudCollapsed: false,
  rollHistory: []
};
```

No external state management library is used. Everything is vanilla JS.

---

## Development Notes

- **No build step.** Edit `index.html` directly.
- **No external CDN dependencies.** All CSS and JS are inline.
- **Testing:** Open `index.html` in a browser. If testing API calls, a local CORS-enabled server (like llama.cpp or koboldcpp) must be running.
- **Documentation:** Any architectural changes must be reflected in this `AGENTS.md` file.

---

## Open Questions / Future Ideas

- Should we support more dice configurations (e.g., 2d6, percentile)?
- Should the GM be allowed to request specific skill checks (e.g., "Roll a d20 for Athletics")?
- Could we add a "Party" mode with more than one AI Player?
- Should we support image generation APIs for scene illustrations?
