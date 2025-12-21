const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// Extract the STATIC_WORDS array
const match = html.match(/const STATIC_WORDS = \[([\s\S]*?)\];/);
if (!match) {
  console.log('Could not find STATIC_WORDS array');
  process.exit(1);
}

// Parse the words
const wordsText = match[1];
const words = wordsText.match(/"[^"]+"/g).map(w => w.replace(/"/g, ''));

console.log('=== Full Word List Analysis ===');
console.log('Total words in array:', words.length);

// Check for duplicates
const uniqueWords = new Set(words);
console.log('Unique words:', uniqueWords.size);
console.log('Duplicate count:', words.length - uniqueWords.size);

// Find duplicates
const wordCounts = {};
words.forEach(word => {
  wordCounts[word] = (wordCounts[word] || 0) + 1;
});

const duplicates = Object.entries(wordCounts).filter(([word, count]) => count > 1);
console.log('\nWords that appear multiple times:');
duplicates.slice(0, 20).forEach(([word, count]) => {
  console.log(`  ${word}: ${count} times`);
});

if (duplicates.length > 20) {
  console.log(`  ... and ${duplicates.length - 20} more`);
}

// Simulate the deduplication logic from the app
const wordList = new Map();
const seen = new Set();
words.forEach((word, index) => {
  const w = word.toUpperCase();
  if (!seen.has(w)) {
    seen.add(w);
    wordList.set(w, { game: index, date: null });
  }
});

console.log('\n=== After Deduplication (as in app) ===');
console.log('Words in Map:', wordList.size);

// Test some known Wordle words
console.log('\n=== Testing Known Wordle Solutions ===');
const testWords = ['cigar', 'rebut', 'sissy', 'humph', 'awake', 'audio', 'sweet', 'crane', 'slate'];
testWords.forEach(word => {
  const upper = word.toUpperCase();
  const found = wordList.get(upper);
  console.log(`  ${upper}: ${found ? '✓ Found (game #' + found.game + ')' : '✗ Not found'}`);
});

// Test some non-solutions
console.log('\n=== Testing Non-Solutions ===');
const nonSolutions = ['tests', 'hello', 'zzzzz', 'xxxxx'];
nonSolutions.forEach(word => {
  const upper = word.toUpperCase();
  const found = wordList.get(upper);
  console.log(`  ${upper}: ${found ? '✗ Incorrectly found' : '✓ Correctly not found'}`);
});
