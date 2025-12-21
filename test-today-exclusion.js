// Test script to verify today's solution is excluded from the checker
console.log('=== Testing Today\'s Solution Exclusion ===\n');

// Simulate the getTodayGameNumber function
function getTodayGameNumber() {
  // Wordle #1 was June 19, 2021
  const startDate = new Date('2021-06-19T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = today - startDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays + 1; // Wordle #1 was day 0
}

// Test the calculation
const todayGameNumber = getTodayGameNumber();
console.log(`Today's date: ${new Date().toISOString().split('T')[0]}`);
console.log(`Today's Wordle game number: #${todayGameNumber}\n`);

// Create a sample wordList with some entries including "today's" solution
const wordList = new Map();
wordList.set('CIGAR', { game: 1, date: '2021-06-19' });
wordList.set('SLATE', { game: 100, date: null });
wordList.set('CRANE', { game: 200, date: null });

// Add a word that matches today's game number for testing
wordList.set('TODAY', { game: todayGameNumber, date: new Date().toISOString().split('T')[0] });
wordList.set('OTHER', { game: todayGameNumber - 1, date: null });

console.log('Sample wordList created with:');
wordList.forEach((data, word) => {
  console.log(`  ${word}: game #${data.game}${data.game === todayGameNumber ? ' <- TODAY\'S SOLUTION' : ''}`);
});
console.log('');

// Test function that mimics the checker logic
function checkWord(word) {
  const found = wordList.get(word);
  const isTodaySolution = found && found.game === todayGameNumber;

  return {
    word,
    found: !!found,
    isTodaySolution: isTodaySolution || false,
    shouldShow: !!(found && !isTodaySolution)
  };
}

// Run tests
const testCases = [
  { word: 'CIGAR', expectedShow: true, description: 'Past solution (game #1)' },
  { word: 'TODAY', expectedShow: false, description: 'Today\'s solution (should be hidden)' },
  { word: 'OTHER', expectedShow: true, description: 'Yesterday\'s solution' },
  { word: 'NOTINLIST', expectedShow: false, description: 'Not in wordList' }
];

console.log('=== Test Results ===\n');

let passed = 0;
let failed = 0;

testCases.forEach(test => {
  const result = checkWord(test.word);
  const success = result.shouldShow === test.expectedShow;
  const status = success ? '✓ PASS' : '✗ FAIL';

  if (success) passed++;
  else failed++;

  console.log(`${status}: ${test.word} - ${test.description}`);
  console.log(`  Found: ${result.found}, Is Today's Solution: ${result.isTodaySolution}, Should Show: ${result.shouldShow}`);
  console.log(`  Expected Show: ${test.expectedShow}\n`);
});

console.log('=== Summary ===');
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);

if (failed === 0) {
  console.log('\n✓ All tests passed! Today\'s solution is properly excluded.');
} else {
  console.log('\n✗ Some tests failed. Check the logic.');
}
