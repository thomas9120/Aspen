const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFunctions } = require('./helpers/aspenTestUtils');

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const defaultSettings = {
  apiUrl: 'http://localhost:8080/v1',
  apiKey: '',
  model: '',
  dualLlM: false,
  aiApiUrl: '',
  aiApiKey: '',
  aiModel: '',
  manualReview: false,
  temperature: 0.8,
  topP: 0.95,
  minP: 0.05,
  topK: 40,
  repeatPenalty: 1.1,
  maxTokens: 1024,
  userName: 'User',
  aiName: 'AI',
  userHandicap: false,
  userModifier: -3,
  aiHandicap: false,
  aiModifier: -3
};

test('dice rolls are random first, then handicaps adjust and clamp the final value', () => {
  const randomValues = [0, 0.999999, 0.7];
  const context = loadFunctions(['rollD20', 'applyHandicap'], {
    Math: {
      floor: Math.floor,
      min: Math.min,
      max: Math.max,
      random: () => randomValues.shift()
    },
    state: {
      settings: {
        userHandicap: false,
        userModifier: -3,
        aiHandicap: true,
        aiModifier: -19
      }
    }
  });

  assert.equal(context.rollD20(), 1);
  assert.equal(context.rollD20(), 20);
  const rawRoll = context.rollD20();
  assert.equal(rawRoll, 15);

  assert.deepEqual(plain(context.applyHandicap(rawRoll, true)), {
    final: 15,
    modified: false
  });
  assert.deepEqual(plain(context.applyHandicap(rawRoll, false)), {
    final: 1,
    modified: true,
    raw: 15,
    mod: -19
  });
});

test('settings normalize from old save keys and serialize back to save schema', () => {
  const context = loadFunctions(['normalizeSettings', 'serializeSettings'], {
    DEFAULT_SETTINGS: defaultSettings
  });

  const normalized = context.normalizeSettings({
    api_url: 'http://localhost:5001/v1',
    api_key: 'local-key',
    model: 'mistral',
    dual_llm_enabled: true,
    ai_api_url: 'http://localhost:8081/v1',
    ai_api_key: 'ai-key',
    ai_model: 'companion-model',
    ai_auto_mode: false,
    temperature: 0.65,
    top_p: 0.9,
    min_p: 0,
    top_k: 0,
    repetition_penalty: 1,
    max_tokens: 512,
    user_name: 'Arin',
    ai_name: 'Elara',
    user_handicap: true,
    user_modifier: -2,
    ai_handicap: true,
    ai_modifier: -4
  });

  assert.equal(normalized.apiUrl, 'http://localhost:5001/v1');
  assert.equal(normalized.dualLlM, true);
  assert.equal(normalized.manualReview, true);
  assert.equal(normalized.repeatPenalty, 1);
  assert.equal(normalized.userName, 'Arin');
  assert.equal(normalized.aiName, 'Elara');
  assert.equal(normalized.userHandicap, true);
  assert.equal(normalized.aiModifier, -4);

  const serialized = context.serializeSettings(normalized);
  assert.equal(serialized.api_url, 'http://localhost:5001/v1');
  assert.equal(serialized.dual_llm_enabled, true);
  assert.equal(serialized.ai_auto_mode, false);
  assert.equal(serialized.repetition_penalty, 1);
  assert.equal(serialized.user_handicap, true);
  assert.equal(serialized.ai_modifier, -4);
});

test('character card normalization accepts supported formats and rejects unknown objects', () => {
  const context = loadFunctions(['normalizeCharacterCard']);

  assert.deepEqual(plain(context.normalizeCharacterCard({
    format: 'aspen-character-v1',
    name: 'Mira',
    summary: 'A scout.',
    personality: 'Careful.',
    first_message: 'Ready.',
    example_dialogue: ['hi']
  })), {
    name: 'Mira',
    summary: 'A scout.',
    personality: 'Careful.',
    first_message: 'Ready.',
    example_dialogue: ['hi']
  });

  assert.deepEqual(plain(context.normalizeCharacterCard({
    data: {
      name: 'Elara',
      description: 'A rogue.',
      personality: 'Dry humor.',
      first_mes: 'Keep up.',
      mes_example: 'User: Hello\nElara: No.'
    }
  })), {
    name: 'Elara',
    summary: 'A rogue.',
    personality: 'Dry humor.',
    first_message: 'Keep up.',
    example_dialogue: ['User: Hello', 'Elara: No.']
  });

  assert.deepEqual(plain(context.normalizeCharacterCard({
    name: 'Bram',
    description: 'A guard.',
    first_message: 'Hold there.',
    example_dialogue: ['Bram: Stop.']
  })), {
    name: 'Bram',
    summary: 'A guard.',
    personality: '',
    first_message: 'Hold there.',
    example_dialogue: ['Bram: Stop.']
  });

  assert.equal(context.normalizeCharacterCard({ format: 'unknown' }), null);
});
