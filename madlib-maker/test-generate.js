// Tests for turning a model's answer into a madlib (js/generate-format.js).
// Run: node --test madlib-maker/test-generate.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load the browser scripts the way the page does: plain scripts sharing globals
const context = vm.createContext({ console });
for (const file of ['js/core.js', 'js/generate-format.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context, { filename: file });
}
const { MadlibFormat, MadlibGenerateFormat: Format } = vm.runInContext(
  '({ MadlibFormat, MadlibGenerateFormat })', context
);

// Build a model answer from [text, blank] pairs; blank is [type, question, reuse] or null
function answer(pairs, title = 'Pirate School', subtitle = '') {
  return JSON.stringify({
    title,
    subtitle,
    segments: pairs.map(([text, blank]) => ({
      text,
      blank: blank ? { type: blank[0], question: blank[1], reuse: blank[2] || null } : null
    }))
  });
}

// n blanks, all fine, cycling through a few types
function validPairs(n) {
  const types = ['noun', 'adjective', 'plural noun', 'verb', 'animal'];
  const pairs = [];
  for (let i = 0; i < n; i++) {
    pairs.push([`Part ${i + 1} has a `, [types[i % types.length], `Thing number ${i + 1}?`]]);
  }
  pairs.push(['. The end.', null]);
  return pairs;
}

// Results come from the vm sandbox, whose arrays aren't the test's Array, so
// copy them into plain values before deepEqual compares them
function run(text, options = {}) {
  const result = Format.process(text, { prompt: 'A pirate goes to school', length: 'medium', ...options });
  return JSON.parse(JSON.stringify(result));
}

test('a valid answer for each length assembles with no errors', () => {
  for (const [length, count] of [['short', 6], ['medium', 10], ['long', 15]]) {
    const result = run(answer(validPairs(count)), { length });
    assert.deepEqual(result.errors, [], length);
    assert.equal(result.blankCount, count, length);
    assert.equal(MadlibFormat.parse(result.story).prompts.length, count, length);
    assert.equal(result.title, 'Pirate School');
  }
});

test('blanks become story tokens with their questions', () => {
  const result = run(answer([
    ['A ', ['adjective', 'Something squishy?']],
    [' parrot ate my ', ['noun', 'An object in a kitchen?']],
    ['.', null]
  ]), { length: 'short' });
  assert.equal(result.story, 'A {adjective|Something squishy?} parrot ate my {noun|An object in a kitchen?}.');
});

test('a synonym type is normalized', () => {
  const pairs = validPairs(10);
  pairs[0][1][0] = 'adj';
  pairs[1][1][0] = 'Plural Nouns';
  const result = run(answer(pairs));
  assert.deepEqual(result.errors, []);
  const types = MadlibFormat.parse(result.story).prompts.map(p => p.type);
  assert.equal(types[0], 'adjective');
  assert.equal(types[1], 'plural noun');
});

test('an unknown type is an error, but the story still parses', () => {
  const pairs = validPairs(10);
  pairs[3][1][0] = 'flibbertigibbet';
  const result = run(answer(pairs));
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Blank 4/);
  assert.match(result.errors[0], /flibbertigibbet/);
  assert.equal(MadlibFormat.parse(result.story).prompts.length, 10);
});

test('an empty question is an error', () => {
  const pairs = validPairs(10);
  pairs[2][1][1] = '   ';
  const result = run(answer(pairs));
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Blank 3 has no question/);
});

test('a question gets a missing "?" and long questions are cut at a word', () => {
  const long = 'A very long question that keeps going and going well past the point where anyone would read it all, and then some more words after that';
  const pairs = validPairs(10);
  pairs[0][1][1] = 'Something squishy';
  pairs[1][1][1] = long;
  const result = run(answer(pairs));
  assert.deepEqual(result.errors, []);
  const questions = MadlibFormat.parse(result.story).prompts.map(p => p.question);
  assert.equal(questions[0], 'Something squishy?');
  assert.ok(questions[1].length <= 100, questions[1]);
  assert.ok(questions[1].endsWith('?'), questions[1]);
  assert.ok(!/\s\?$/.test(questions[1]), 'no space before the "?"');
  assert.ok(long.startsWith(questions[1].slice(0, -1).replace(/[,]$/, '')));
});

test('a form hint in parentheses ends the question without an extra "?"', () => {
  const pairs = validPairs(10);
  pairs[0][1] = ['verb ending in -ing', 'A way you move across the room (ending in -ing)'];
  pairs[1][1] = ['past tense verb', 'Something you do with a ball? (past tense, like "kicked")'];
  const result = run(answer(pairs));
  assert.deepEqual(result.errors, []);
  const questions = MadlibFormat.parse(result.story).prompts.map(p => p.question);
  assert.equal(questions[0], 'A way you move across the room (ending in -ing)');
  assert.equal(questions[1], 'Something you do with a ball? (past tense, like "kicked")');
});

test('the request asks for the length in words and blanks', () => {
  for (const [length, size] of Object.entries(Format.LENGTHS)) {
    const message = Format.userMessage({ prompt: 'Pirates', length, retryErrors: [] });
    assert.ok(message.includes(`${size.words} words`), message);
    assert.ok(message.includes(`${size.target}`), message);
  }
});

test('kid mode tells the model players may be 3 or 4; grown-up mode does not', () => {
  assert.match(Format.systemPrompt(false), /3 or 4/);
  assert.doesNotMatch(Format.systemPrompt(true), /3 or 4/);
});

test('a reused name shares one answer, with the question on the first use only', () => {
  const pairs = validPairs(9);
  pairs.unshift(['Captain ', ['name', 'A silly name?', 'Captain Hero']]);
  pairs.push([' Goodbye, ', ['name', 'A silly name?', 'Captain Hero']]);
  pairs.push(['!', null]);
  const result = run(answer(pairs));
  assert.deepEqual(result.errors, []);
  assert.equal(result.blankCount, 10);
  assert.match(result.story, /^Captain \{name:Captain-Hero\|A silly name\?\}/);
  assert.match(result.story, /Goodbye, \{name:Captain-Hero\}!$/);
});

test('a reuse name used once is dropped', () => {
  const pairs = validPairs(10);
  pairs[0][1][2] = 'lonely';
  const result = run(answer(pairs));
  assert.deepEqual(result.errors, []);
  assert.ok(!result.story.includes(':lonely'));
});

test('a reuse name with two types is an error', () => {
  const pairs = validPairs(9);
  pairs.unshift(['', ['name', 'A name?', 'hero']]);
  pairs.push([' and ', ['animal', 'An animal?', 'hero']]);
  const result = run(answer(pairs));
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /"hero"/);
  assert.match(result.errors[0], /name/);
  assert.match(result.errors[0], /animal/);
});

test('braces in story text are removed so they cannot make extra blanks', () => {
  const pairs = validPairs(10);
  pairs[0][0] = 'A {sneaky} ';
  const result = run(answer(pairs));
  assert.deepEqual(result.errors, []);
  assert.ok(result.story.startsWith('A sneaky '));
  assert.equal(result.blankCount, 10);
});

test('too few or too many blanks is an error that names the range', () => {
  const few = run(answer(validPairs(3)));
  assert.equal(few.errors.length, 1);
  assert.match(few.errors[0], /3 blanks/);
  assert.match(few.errors[0], /7/);
  assert.match(few.errors[0], /13/);

  const many = run(answer(validPairs(14)));
  assert.equal(many.errors.length, 1);
  assert.match(many.errors[0], /14 blanks/);
});

test('truncated or invalid JSON is an error with no story', () => {
  const full = answer(validPairs(10));
  for (const text of [full.slice(0, full.length / 2), 'not json', '']) {
    const result = run(text);
    assert.equal(result.story, '');
    assert.equal(result.errors.length, 1);
  }
});

test('a response the model marked as cut off is an error even if it parses', () => {
  const result = run(answer(validPairs(10)), { truncated: true });
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /cut off/);
});

test('an empty story is an error', () => {
  const result = run(JSON.stringify({ title: 'x', subtitle: '', segments: [] }));
  assert.ok(result.errors.some(e => /empty/.test(e)));
  assert.equal(result.story, '');
});

test('a story over 4,000 characters is an error', () => {
  const pairs = validPairs(10);
  pairs[0][0] = 'word '.repeat(900);
  const result = run(answer(pairs));
  assert.ok(result.errors.some(e => /too long/.test(e)));
});

test('an empty title falls back to the prompt, trimmed to 60 characters', () => {
  const prompt = 'A pirate who is afraid of water starts at a school for very serious sailors';
  const result = run(answer(validPairs(10), '  '), { prompt });
  assert.equal(result.title, prompt.slice(0, 60).trim());
});

test('every problem is reported together', () => {
  const pairs = validPairs(3);
  pairs[0][1][1] = '';
  pairs[1][1][0] = 'gadget';
  const result = run(answer(pairs));
  assert.equal(result.errors.length, 3);
});

test('the schema allows exactly the common word types', () => {
  const schema = Format.schema();
  const blank = schema.properties.segments.items.properties.blank.anyOf
    .find(option => option.type === 'object');
  assert.deepEqual([...blank.properties.type.enum], [...MadlibFormat.COMMON_TYPES]);
});

test('normalizeType maps synonyms and rejects unknown types', () => {
  assert.equal(MadlibFormat.normalizeType('adj'), 'adjective');
  assert.equal(MadlibFormat.normalizeType('Colour'), 'color');
  assert.equal(MadlibFormat.normalizeType('verb ending in ing'), 'verb ending in -ing');
  assert.equal(MadlibFormat.normalizeType('verb ending in -ing'), 'verb ending in -ing');
  // Older stories wrote it as "verb ing"; the dice still need to match them
  assert.equal(MadlibFormat.normalizeType('verb ing'), 'verb ending in -ing');
  assert.equal(MadlibFormat.normalizeType('past tense'), 'past tense verb');
  assert.equal(MadlibFormat.normalizeType('type of snack'), 'food');
  assert.equal(MadlibFormat.normalizeType('flibbertigibbet'), null);
  assert.equal(MadlibFormat.normalizeType(''), null);
});
