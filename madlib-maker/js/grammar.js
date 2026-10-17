// Small grammar fixes applied to a finished story: a/an agreement and sentence-start capitals.
// Only text around blanks changes; the blanks themselves are left as they are.
const MadlibGrammar = (function() {
  // Vowel-letter words that take "a" (uni-, use-, one-), and consonant words that take "an"
  const A_EXCEPTIONS = /^(uni|use|usu|eu|one|once)/i;
  const AN_EXCEPTIONS = /^(hour|honest|honor|heir)/i;
  // The article right before a blank: a whole word, separated from the blank only by spaces.
  // Groups: 1 = character before the word (or start), 2 = the word, 3 = the spaces.
  const ARTICLE_BEFORE_RE = /(^|[^A-Za-z0-9])(a|an)( +)$/i;
  // Trailing spaces and opening quotes/brackets between a sentence end and the blank
  const OPENERS_RE = /[\s"'‘“(\[]*$/;
  // A sentence end, optionally followed by closing quotes or brackets
  const SENTENCE_END_RE = /[.!?…]["'”’)\]]*$/;

  // "a" or "an" for the word that follows; null when the word doesn't start with a letter
  function articleFor(word) {
    if (!/^[a-z]/i.test(word)) return null;
    if (AN_EXCEPTIONS.test(word)) return 'an';
    if (A_EXCEPTIONS.test(word)) return 'a';
    return /^[aeiou]/i.test(word) ? 'an' : 'a';
  }

  // Keep the original article's capitalisation: "A" → "An", "AN" → "A", "a" → "an"
  function matchCase(article, original) {
    if (original.length > 1 && original === original.toUpperCase()) return article.toUpperCase();
    if (original[0] === original[0].toUpperCase()) return article[0].toUpperCase() + article.slice(1);
    return article;
  }

  // True when the blank starts a sentence: story start, first thing on a line,
  // or after . ! ? … (allowing closing and opening quotes or brackets in between)
  function startsSentence(before) {
    const opener = OPENERS_RE.exec(before)[0];
    if (opener.indexOf('\n') !== -1) return true;
    const rest = before.slice(0, before.length - opener.length);
    return !rest || SENTENCE_END_RE.test(rest);
  }

  // Apply [{start, end, text}] edits to a string (edits must not overlap)
  function applyEdits(text, edits) {
    return [...edits]
      .sort((a, b) => b.start - a.start)
      .reduce((result, edit) => result.slice(0, edit.start) + edit.text + result.slice(edit.end), text);
  }

  // Returns the story with article words fixed, and the values with sentence-start capitals.
  // Blanks left empty ('___') are skipped, so their articles stay as written.
  function prepare(story, tokens, values) {
    const text = story || '';
    const edits = [];
    const newValues = values.slice();

    tokens.forEach(token => {
      const value = values[token.index];
      if (!value || value === '___') return;
      const before = text.slice(0, token.start);

      const article = ARTICLE_BEFORE_RE.exec(before);
      if (article) {
        const word = article[2];
        const fixed = articleFor(value);
        const replacement = fixed ? matchCase(fixed, word) : word;
        if (replacement !== word) {
          const start = before.length - article[3].length - word.length;
          edits.push({ start, end: start + word.length, text: replacement });
        }
      }

      if (startsSentence(before)) {
        newValues[token.index] = value.charAt(0).toUpperCase() + value.slice(1);
      }
    });

    return { story: applyEdits(text, edits), values: newValues };
  }

  return { prepare };
})();
