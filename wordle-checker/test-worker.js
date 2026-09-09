import assert from 'node:assert/strict';
import { fetchWordList, getLatestDataDate, validateWordList } from './worker.js';

const originalFetch = globalThis.fetch;

function sourcePage(results, total = results.length) {
  return new Response(JSON.stringify({ results, total }));
}

try {
  const valid = {
    CIGAR: { game: 1, date: '2021-06-19' },
    REBUT: { game: 2, date: '2021-06-20' }
  };

  validateWordList(valid, 2);
  assert.equal(getLatestDataDate(valid), '2021-06-20');
  assert.throws(() => validateWordList({}, null), /empty/);
  assert.throws(() => validateWordList({ CIGAR: { game: -1 } }), /invalid entry/);
  assert.throws(() => validateWordList({ CIGAR: { game: 1, date: '2021-02-30' } }), /invalid date/);
  assert.throws(() => validateWordList({
    CIGAR: { game: 1 },
    REBUT: { game: 1 }
  }), /conflicting answers/);

  const testWord = index => {
    let suffix = '';
    for (let remaining = index; remaining > 0; remaining = Math.floor(remaining / 26)) {
      suffix = String.fromCharCode(65 + (remaining % 26)) + suffix;
    }
    return `A${suffix.padStart(4, 'A')}`;
  };
  const firstBatch = Array.from({ length: 50 }, (_, index) => ({
    answer: testWord(index),
    game: index + 1,
    date: ''
  }));
  firstBatch[0] = { answer: 'REBUT', game: 0, date: '2021-06-19' };

  globalThis.fetch = async url => {
    const page = new URL(url).searchParams.get('page');
    if (page === '1') return sourcePage(firstBatch, 51);
    if (page === '2') return sourcePage([
      { answer: 'REBUT', game: 51, date: '2021-08-08' }
    ], 51);
    throw new Error(`unexpected page ${page}`);
  };

  const fetched = await fetchWordList();
  assert.equal(Object.keys(fetched).length, 50);
  assert.deepEqual(fetched.REBUT, { game: 51, date: '2021-08-08' });

  globalThis.fetch = async url => {
    const page = new URL(url).searchParams.get('page');
    if (page === '1') return sourcePage(firstBatch, 51);
    return new Response('upstream unavailable', { status: 503 });
  };
  await assert.rejects(fetchWordList(), /HTTP 503 on page 2/);

  console.log('Worker validation tests passed');
} finally {
  globalThis.fetch = originalFetch;
}
