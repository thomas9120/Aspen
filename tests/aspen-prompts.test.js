const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFunctions } = require('./helpers/aspenTestUtils');

function makeLongLog(count = 15) {
  return Array.from({ length: count }, (_, index) => ({
    role: index % 3 === 0 ? 'gm' : index % 3 === 1 ? 'user' : 'ai',
    content: `history entry ${String(index + 1).padStart(2, '0')}`
  }));
}

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
  const context = loadFunctions(['formatHistory', 'formatRecentHistory', 'buildGmNarrativePrompt'], {
    state,
    CONTEXT_HISTORY_LIMIT: 12
  });

  const prompt = context.buildGmNarrativePrompt();

  assert.equal(prompt.length, 2);
  assert.match(prompt[0].content, /Do not write dialogue for user characters/);
  assert.match(prompt[1].content, /Do not write actions or dialogue for the player characters/);
  assert.match(prompt[1].content, /Do not write dialogue for user characters/);
});

test('GM narrative prompt includes only the newest 12 history entries in order', () => {
  const state = {
    settings: {
      userName: 'Arin',
      aiName: 'Elara'
    },
    scenario: null,
    userCard: null,
    aiCard: null,
    gameLog: makeLongLog(15)
  };
  const context = loadFunctions(['formatHistory', 'formatRecentHistory', 'buildGmNarrativePrompt'], {
    state,
    CONTEXT_HISTORY_LIMIT: 12
  });

  const prompt = context.buildGmNarrativePrompt();
  const content = prompt[1].content;

  assert.doesNotMatch(content, /history entry 01/);
  assert.doesNotMatch(content, /history entry 02/);
  assert.doesNotMatch(content, /history entry 03/);
  assert.match(content, /history entry 04/);
  assert.match(content, /history entry 15/);
  assert.ok(content.indexOf('history entry 04') < content.indexOf('history entry 15'));
});

test('GM narrative prompt includes story summary before recent scene history', () => {
  const state = {
    settings: {
      userName: 'Arin',
      aiName: 'Elara'
    },
    scenario: null,
    userCard: null,
    aiCard: null,
    storySummary: 'The party escaped the archive and owes Mira a favor.',
    gameLog: makeLongLog(15)
  };
  const context = loadFunctions(['formatHistory', 'formatRecentHistory', 'buildGmNarrativePrompt'], {
    state,
    CONTEXT_HISTORY_LIMIT: 12
  });

  const prompt = context.buildGmNarrativePrompt();
  const content = prompt[1].content;

  assert.match(content, /\[STORY SO FAR\]\nThe party escaped the archive and owes Mira a favor\./);
  assert.ok(content.indexOf('[STORY SO FAR]') < content.indexOf('[SCENE HISTORY]'));
  assert.doesNotMatch(content, /history entry 01/);
  assert.match(content, /history entry 04/);
});

test('story summary prompt merges existing summary with only older history', () => {
  const state = {
    settings: {
      userName: 'Arin',
      aiName: 'Elara'
    },
    scenario: {
      scenario_goal: 'Find the missing ledger.'
    },
    storySummary: '- Mira owes the party a favor.',
    gameLog: makeLongLog(18)
  };
  const context = loadFunctions(['formatHistory', 'getSummarizableHistoryEntries', 'buildStorySummaryPrompt'], {
    state,
    CONTEXT_HISTORY_LIMIT: 12
  });

  const olderEntries = context.getSummarizableHistoryEntries();
  const prompt = context.buildStorySummaryPrompt();
  const content = prompt[1].content;

  assert.equal(olderEntries.length, 6);
  assert.match(content, /\[EXISTING STORY SUMMARY\]\n- Mira owes the party a favor\./);
  assert.match(content, /\[SCENARIO GOAL\]\nFind the missing ledger\./);
  assert.match(content, /history entry 01/);
  assert.match(content, /history entry 06/);
  assert.doesNotMatch(content, /history entry 07/);
  assert.doesNotMatch(content, /history entry 18/);
  assert.match(content, /Return only the updated story summary/);
});

test('manual story summary update writes generated summary to state and textarea', async () => {
  const state = {
    settings: {
      userName: 'Arin',
      aiName: 'Elara'
    },
    scenario: {
      scenario_goal: 'Find the missing ledger.'
    },
    storySummary: '- Old summary.',
    gameLog: makeLongLog(18)
  };
  const btn = { disabled: false, textContent: 'Update Summary' };
  const storySummaryEl = { value: '' };
  const toasts = [];
  const statuses = [];
  let persisted = false;
  let promptSeen = null;
  const context = loadFunctions(['formatHistory', 'getSummarizableHistoryEntries', 'buildStorySummaryPrompt', 'updateStorySummary'], {
    state,
    storySummaryEl,
    CONTEXT_HISTORY_LIMIT: 12,
    $(id) {
      return id === 'updateSummaryBtn' ? btn : null;
    },
    saveSettings() {},
    persistSettings() {
      persisted = true;
    },
    setStatus(message) {
      statuses.push(message);
    },
    showToast(message, type) {
      toasts.push({ message, type });
    },
    async callLLM(prompt) {
      promptSeen = prompt;
      return '- Updated summary.';
    }
  });

  await context.updateStorySummary();

  assert.equal(state.storySummary, '- Updated summary.');
  assert.equal(storySummaryEl.value, '- Updated summary.');
  assert.equal(btn.disabled, false);
  assert.equal(btn.textContent, 'Update Summary');
  assert.equal(persisted, true);
  assert.deepEqual(toasts.at(-1), { message: 'Story summary updated.', type: 'success' });
  assert.equal(statuses.at(-1), 'Story summary updated.');
  assert.match(promptSeen[1].content, /history entry 01/);
  assert.doesNotMatch(promptSeen[1].content, /history entry 07/);
});

test('manual story summary update leaves existing summary unchanged on failure', async () => {
  const state = {
    settings: {
      userName: 'Arin',
      aiName: 'Elara'
    },
    scenario: null,
    storySummary: '- Keep this summary.',
    gameLog: makeLongLog(18)
  };
  const btn = { disabled: false, textContent: 'Update Summary' };
  const storySummaryEl = { value: '- Keep this summary.' };
  const toasts = [];
  const context = loadFunctions(['formatHistory', 'getSummarizableHistoryEntries', 'buildStorySummaryPrompt', 'updateStorySummary'], {
    state,
    storySummaryEl,
    CONTEXT_HISTORY_LIMIT: 12,
    $(id) {
      return id === 'updateSummaryBtn' ? btn : null;
    },
    saveSettings() {},
    persistSettings() {
      throw new Error('Should not persist on failed summary.');
    },
    setStatus() {},
    showToast(message, type) {
      toasts.push({ message, type });
    },
    async callLLM() {
      throw new Error('offline');
    }
  });

  await context.updateStorySummary();

  assert.equal(state.storySummary, '- Keep this summary.');
  assert.equal(storySummaryEl.value, '- Keep this summary.');
  assert.equal(btn.disabled, false);
  assert.equal(btn.textContent, 'Update Summary');
  assert.deepEqual(toasts.at(-1), { message: 'Summary update failed: offline', type: 'error' });
});

test('clear story summary requires confirmation before clearing state and textarea', async () => {
  const state = {
    storySummary: '- Keep this until confirmed.'
  };
  const storySummaryEl = { value: '- Keep this until confirmed.' };
  const toasts = [];
  const statuses = [];
  let persisted = 0;
  let confirmResult = false;
  const context = loadFunctions(['clearStorySummary'], {
    state,
    storySummaryEl,
    async showConfirm() {
      return confirmResult;
    },
    persistSettings() {
      persisted++;
    },
    showToast(message, type) {
      toasts.push({ message, type });
    },
    setStatus(message) {
      statuses.push(message);
    }
  });

  await context.clearStorySummary();

  assert.equal(state.storySummary, '- Keep this until confirmed.');
  assert.equal(storySummaryEl.value, '- Keep this until confirmed.');
  assert.equal(persisted, 0);

  confirmResult = true;
  await context.clearStorySummary();

  assert.equal(state.storySummary, '');
  assert.equal(storySummaryEl.value, '');
  assert.equal(persisted, 1);
  assert.deepEqual(toasts.at(-1), { message: 'Story summary cleared.', type: 'success' });
  assert.equal(statuses.at(-1), 'Story summary cleared.');
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
  const context = loadFunctions(['formatHistory', 'formatRecentHistory', 'formatRoundRoll', 'buildRoundResolutionPrompt'], {
    state,
    CONTEXT_HISTORY_LIMIT: 12
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

test('round resolution trims old history but keeps pending round actions', () => {
  const state = {
    settings: {
      userName: 'Arin',
      aiName: 'Elara'
    },
    gameLog: makeLongLog(18)
  };
  const context = loadFunctions(['formatHistory', 'formatRecentHistory', 'formatRoundRoll', 'buildRoundResolutionPrompt'], {
    state,
    CONTEXT_HISTORY_LIMIT: 12
  });

  const prompt = context.buildRoundResolutionPrompt({
    user: {
      name: 'Arin',
      action: 'I open the silver door.',
      roll: 20,
      rollMeta: 'Roll: 20'
    },
    ai: {
      name: 'Elara',
      action: 'I cover the hallway.',
      roll: 8,
      rollMeta: 'Roll: 8'
    }
  });
  const content = prompt[1].content;

  assert.doesNotMatch(content, /history entry 01/);
  assert.doesNotMatch(content, /history entry 06/);
  assert.match(content, /history entry 07/);
  assert.match(content, /history entry 18/);
  assert.ok(content.indexOf('history entry 07') < content.indexOf('history entry 18'));
  assert.match(content, /Arin: I open the silver door\.\nRoll: 20/);
  assert.match(content, /Elara: I cover the hallway\.\nRoll: 8/);
});

test('round resolution includes story summary without replacing pending actions', () => {
  const state = {
    settings: {
      userName: 'Arin',
      aiName: 'Elara'
    },
    storySummary: 'The silver door belongs to the old lighthouse keeper.',
    gameLog: makeLongLog(18)
  };
  const context = loadFunctions(['formatHistory', 'formatRecentHistory', 'formatRoundRoll', 'buildRoundResolutionPrompt'], {
    state,
    CONTEXT_HISTORY_LIMIT: 12
  });

  const prompt = context.buildRoundResolutionPrompt({
    user: {
      name: 'Arin',
      action: 'I open the silver door.',
      roll: 20,
      rollMeta: 'Roll: 20'
    },
    ai: {
      name: 'Elara',
      action: 'I cover the hallway.',
      roll: 8,
      rollMeta: 'Roll: 8'
    }
  });
  const content = prompt[1].content;

  assert.match(content, /\[STORY SO FAR\]\nThe silver door belongs to the old lighthouse keeper\./);
  assert.ok(content.indexOf('[STORY SO FAR]') < content.indexOf('[SCENE HISTORY]'));
  assert.match(content, /Arin: I open the silver door\.\nRoll: 20/);
  assert.match(content, /Elara: I cover the hallway\.\nRoll: 8/);
});

test('AI prompt uses the same recent history window', () => {
  const state = {
    settings: {
      userName: 'Arin',
      aiName: 'Elara'
    },
    aiCard: {
      personality: 'Dry humor.'
    },
    gameLog: makeLongLog(14)
  };
  const context = loadFunctions(['formatHistory', 'formatRecentHistory', 'buildAiPrompt'], {
    state,
    CONTEXT_HISTORY_LIMIT: 12
  });

  const prompt = context.buildAiPrompt();
  const content = prompt[1].content;

  assert.doesNotMatch(content, /history entry 01/);
  assert.doesNotMatch(content, /history entry 02/);
  assert.match(content, /history entry 03/);
  assert.match(content, /history entry 14/);
  assert.ok(content.indexOf('history entry 03') < content.indexOf('history entry 14'));
});

test('AI prompt includes story summary before recent scene history', () => {
  const state = {
    settings: {
      userName: 'Arin',
      aiName: 'Elara'
    },
    aiCard: {
      personality: 'Dry humor.'
    },
    storySummary: 'Elara distrusts Mira but agreed to protect her.',
    gameLog: makeLongLog(14)
  };
  const context = loadFunctions(['formatHistory', 'formatRecentHistory', 'buildAiPrompt'], {
    state,
    CONTEXT_HISTORY_LIMIT: 12
  });

  const prompt = context.buildAiPrompt();
  const content = prompt[1].content;

  assert.match(content, /\[STORY SO FAR\]\nElara distrusts Mira but agreed to protect her\./);
  assert.ok(content.indexOf('[STORY SO FAR]') < content.indexOf('[SCENE HISTORY]'));
  assert.doesNotMatch(content, /history entry 01/);
  assert.match(content, /history entry 03/);
});
