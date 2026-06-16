const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFunctions } = require('./helpers/aspenTestUtils');

test('GM narrative prompt forbids writing user character dialogue', () => {
  const state = {
    settings: {
      userName: 'Arin',
      aiName: 'Elara'
    },
    scenario: {
      description: 'A haunted archive.',
      world_info: 'Ink remembers what people forget.',
      starting_scene: 'Rain taps against stained glass.',
      scenario_goal: 'Find the missing ledger.'
    },
    userCard: {
      summary: 'A careful investigator.'
    },
    aiCard: {
      summary: 'A sharp-eyed companion.'
    },
    gameLog: []
  };
  const context = loadFunctions(['buildGmNarrativePrompt'], {
    state,
    formatHistory() {
      return state.gameLog.map(entry => `[${entry.role}] ${entry.content}`).join('\n\n');
    }
  });

  const prompt = context.buildGmNarrativePrompt();

  assert.equal(prompt.length, 2);
  assert.match(prompt[0].content, /Do not write dialogue for user characters/);
  assert.match(prompt[1].content, /Do not write actions or dialogue for the player characters/);
  assert.match(prompt[1].content, /Do not write dialogue for user characters/);
});

test('round resolution prompt includes both actors and adjusted roll metadata', () => {
  const state = {
    settings: {
      userName: 'Arin',
      aiName: 'Elara'
    },
    gameLog: [
      { role: 'gm', content: 'The door groans open.' },
      { role: 'user', content: 'I raise my torch. [Roll: 12]' }
    ]
  };
  const context = loadFunctions(['formatRoundRoll', 'buildRoundResolutionPrompt'], {
    state,
    formatHistory() {
      return state.gameLog.map(entry => `[${entry.role}] ${entry.content}`).join('\n\n');
    }
  });

  const prompt = context.buildRoundResolutionPrompt({
    user: {
      name: 'Arin',
      action: 'I force the lock.',
      roll: 12,
      rollMeta: 'Roll: 12 (raw 15, -3)'
    },
    ai: {
      name: 'Elara',
      action: 'I watch the hallway.',
      roll: 18,
      rollMeta: 'Roll: 18'
    }
  });

  assert.equal(prompt.length, 2);
  assert.equal(prompt[0].role, 'system');
  assert.match(prompt[0].content, /Dice Roll Scale/);
  assert.equal(prompt[1].role, 'user');
  assert.match(prompt[1].content, /\[ROUND ACTIONS TO RESOLVE\]/);
  assert.match(prompt[1].content, /Arin: I force the lock\.\nRoll: 12 \(raw 15, -3\)/);
  assert.match(prompt[1].content, /Elara: I watch the hallway\.\nRoll: 18/);
  assert.match(prompt[1].content, /Narrate the direct outcome of both declared actions/);
  assert.match(prompt[1].content, /Do not write dialogue for user characters/);
});
