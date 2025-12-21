// Test script to verify the Wordle checker logic
const STATIC_WORDS = [
  "cigar","rebut","sissy","humph","awake","blush","focal","evade","naval","serve",
  "heath","dwarf","model","karma","stink","grade","quiet","bench","abate","feint",
  "major","death","fresh","crust","stool","colon","abase","marry","react","batty",
  "pride","floss","helix","croak","staff","paper","unfed","whelp","trawl","outdo",
  "adobe","crazy","sower","repay","digit","crate","cluck","spike","mimic","pound",
  "audio","sweet","world","robot","train"
];

// Simulate the initialization logic
const wordList = new Map();
const seen = new Set();

STATIC_WORDS.forEach((word, index) => {
  const w = word.toUpperCase();
  if (!seen.has(w)) {
    seen.add(w);
    wordList.set(w, { game: index, date: null });
  }
});

console.log('=== Wordle Checker Test ===\n');
console.log(`Total words loaded: ${wordList.size}\n`);

// Test cases
const testWords = [
  { word: 'CIGAR', shouldExist: true, description: 'First Wordle solution' },
  { word: 'AUDIO', shouldExist: true, description: 'Known solution' },
  { word: 'WORLD', shouldExist: true, description: 'Known solution' },
  { word: 'ROBOT', shouldExist: true, description: 'Known solution' },
  { word: 'TESTS', shouldExist: false, description: 'Not a solution' },
  { word: 'ZZZZZ', shouldExist: false, description: 'Invalid word' },
  { word: 'MODEL', shouldExist: true, description: 'Known solution' }
];

let passed = 0;
let failed = 0;

testWords.forEach(test => {
  const found = wordList.get(test.word);
  const exists = !!found;
  const result = exists === test.shouldExist ? '✓ PASS' : '✗ FAIL';

  if (exists === test.shouldExist) {
    passed++;
  } else {
    failed++;
  }

  console.log(`${result}: "${test.word}" - ${test.description}`);
  if (found) {
    console.log(`  → Found in wordList (game #${found.game})`);
  } else {
    console.log(`  → Not found in wordList`);
  }
  console.log('');
});

console.log('=== Test Summary ===');
console.log(`Passed: ${passed}/${testWords.length}`);
console.log(`Failed: ${failed}/${testWords.length}`);

// Check for duplicates in the original list
const duplicates = STATIC_WORDS.filter((word, index) =>
  STATIC_WORDS.indexOf(word) !== index
);
console.log(`\nDuplicates in STATIC_WORDS array: ${duplicates.length}`);
if (duplicates.length > 0) {
  console.log('Sample duplicates:', duplicates.slice(0, 5));
}
