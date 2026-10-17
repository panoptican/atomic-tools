// Shared helpers
// Escapes quotes too, so the result is safe inside attribute values as well as text
function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// "a noun" / "an adjective"
function withArticle(word) {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

// Madlib Format Module
// The story text is the single source of truth for blanks:
//   {noun}                     a new blank every time it appears
//   {name:hero}                a named blank; every {…:hero} shares one answer
//   {noun|Something squishy?}  a blank that asks players a question instead of
//                              naming the word type (works with names too)
// Answers are keyed by blank: "n:<name>" for named blanks, "i:<token index>" otherwise.
const MadlibFormat = (function() {
  const VERSION = 2;
  const TOKEN_RE = /\{([^{}:|\n]+?)(?::([A-Za-z0-9_-]+))?(?:\|([^{}\n]*))?\}/g;
  const LEGACY_TOKEN_RE = /\{([A-Za-z][A-Za-z0-9_-]*)\}/g;
  // Words whose trailing period doesn't end a sentence
  const ABBREVIATIONS = /\b(mr|mrs|ms|dr|st|jr|sr|vs|etc|prof|mt)\.$/i;

  // Strip characters that would break the token syntax
  function cleanType(type) {
    return String(type || '').replace(/[{}:|\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Questions may contain colons and punctuation, just not braces or line breaks
  function cleanQuestion(question) {
    return String(question || '').replace(/[{}\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function slugify(text) {
    return cleanType(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'word';
  }

  // Find every blank token in a story, plus the list of prompts in first-appearance order
  function parse(story) {
    const text = story || '';
    const tokens = [];
    const prompts = [];
    const promptsByKey = new Map();
    let match;

    TOKEN_RE.lastIndex = 0;
    while ((match = TOKEN_RE.exec(text)) !== null) {
      const type = cleanType(match[1]);
      if (!type) continue;

      const name = match[2] || null;
      const question = cleanQuestion(match[3]) || null;
      const index = tokens.length;
      const key = name ? `n:${name.toLowerCase()}` : `i:${index}`;
      const token = { start: match.index, end: match.index + match[0].length, raw: match[0], type, name, question, key, index };
      tokens.push(token);

      let prompt = promptsByKey.get(key);
      if (!prompt) {
        prompt = { key, type, name, question: null, count: 0, tokens: [] };
        promptsByKey.set(key, prompt);
        prompts.push(prompt);
      }
      // A named blank's question can sit on any of its occurrences; the first one wins
      if (!prompt.question && question) prompt.question = question;
      prompt.count++;
      prompt.tokens.push(token);
    }

    return { tokens, prompts };
  }

  function tokenText(type, name, question) {
    const q = cleanQuestion(question);
    return `{${type}${name ? `:${name}` : ''}${q ? `|${q}` : ''}}`;
  }

  // What players see for a blank: its question if it has one, else its word type
  function promptText(prompt) {
    return (prompt && (prompt.question || prompt.type)) || '';
  }

  // Apply [{start, end, text}] edits to a string (edits must not overlap)
  function applyEdits(text, edits) {
    return [...edits]
      .sort((a, b) => b.start - a.start)
      .reduce((result, edit) => result.slice(0, edit.start) + edit.text + result.slice(edit.end), text);
  }

  function humanizeLegacyId(id) {
    if (/^word\d+$/i.test(id)) return 'word';
    return id.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  }

  // Convert pre-v2 data (placeholder list + {id} references that shared one answer)
  // into v2 story syntax. Ids used more than once become named blanks.
  // Line endings from outside the textarea (links, old drafts) may be CRLF
  function normalizeNewlines(text) {
    return String(text || '').replace(/\r\n?/g, '\n');
  }

  function migrate(data) {
    if (!data || typeof data !== 'object') return null;
    const story = normalizeNewlines(data.story);
    if (data.v === VERSION) return { ...data, story };
    // Only pre-v2 data carries a placeholder list. Anything else without a version
    // (e.g. a saved library entry) is already v2; converting it would turn every
    // repeated {noun} into a shared {noun:noun}.
    if (!Array.isArray(data.placeholders)) return { ...data, story, v: VERSION };

    const labels = new Map(data.placeholders.map(p => [p.id, p.label]));
    const oldAnswers = data.answers || {};
    const counts = {};
    story.replace(LEGACY_TOKEN_RE, (m, id) => { counts[id] = (counts[id] || 0) + 1; return m; });

    // Rewrite each legacy {id}, remembering where it lands in the new story
    const converted = []; // { start, id }
    let nextStory = '';
    let last = 0;
    let match;
    LEGACY_TOKEN_RE.lastIndex = 0;
    while ((match = LEGACY_TOKEN_RE.exec(story)) !== null) {
      const id = match[1];
      const type = cleanType(labels.get(id) || humanizeLegacyId(id)) || 'word';
      nextStory += story.slice(last, match.index);
      converted.push({ start: nextStory.length, id });
      nextStory += counts[id] > 1 ? tokenText(type, id) : tokenText(type);
      last = match.index + match[0].length;
    }
    nextStory += story.slice(last);

    // Key answers by the new tokens. Braced text that wasn't a legacy blank
    // (e.g. "{some thing}") is a blank now too, so index by position, not count.
    const answers = {};
    const tokensByStart = new Map(parse(nextStory).tokens.map(t => [t.start, t]));
    converted.forEach(({ start, id }) => {
      const token = tokensByStart.get(start);
      if (token && Object.prototype.hasOwnProperty.call(oldAnswers, id)) {
        answers[token.key] = oldAnswers[id];
      }
    });

    const migrated = {
      v: VERSION,
      title: data.title || '',
      subtitle: data.subtitle || '',
      story: nextStory
    };
    if (data.answers) migrated.answers = answers;
    return migrated;
  }

  // Split a story into paragraphs → steps (sentences or lines) → pieces, for the reveal.
  // Returns { paragraphs: [[{ pieces, leading }]] } where pieces are {text} or {token}.
  function toSteps(story) {
    const text = story || '';
    const { tokens } = parse(text);
    const stream = [];

    function pushText(chunk) {
      chunk.split(/(\n[ \t]*\n\s*|\n)/).forEach(part => {
        if (!part) return;
        if (part.indexOf('\n') !== -1) {
          stream.push({ kind: /\n[ \t]*\n/.test(part) ? 'para' : 'line' });
          return;
        }
        const re = /[.!?…]+["'”’)\]]*\s+/g;
        let from = 0;
        let m;
        while ((m = re.exec(part)) !== null) {
          const until = m.index + m[0].length;
          const sentence = part.slice(from, until);
          stream.push({ kind: 'text', text: sentence });
          if (!ABBREVIATIONS.test(part.slice(0, m.index + 1))) stream.push({ kind: 'end' });
          from = until;
        }
        if (from < part.length) stream.push({ kind: 'text', text: part.slice(from) });
      });
    }

    let last = 0;
    tokens.forEach(token => {
      pushText(text.slice(last, token.start));
      stream.push({ kind: 'token', token });
      last = token.end;
    });
    pushText(text.slice(last));

    // Group the stream into paragraphs of steps. Each step also notes whether it
    // follows a line break inside its paragraph.
    const paragraphs = [];
    let paragraph = null;
    let step = null;
    let pendingLineBreak = false;

    function closeStep() {
      step = null;
    }

    stream.forEach(item => {
      if (item.kind === 'para') {
        closeStep();
        paragraph = null;
        pendingLineBreak = false;
      } else if (item.kind === 'line') {
        closeStep();
        if (paragraph) pendingLineBreak = true;
      } else if (item.kind === 'end') {
        closeStep();
      } else {
        // Whitespace between steps doesn't start a new step
        if (!step && item.kind === 'text' && !item.text.trim()) return;
        if (!paragraph) {
          paragraph = [];
          paragraphs.push(paragraph);
        }
        if (!step) {
          step = { pieces: [], lineBreakBefore: pendingLineBreak };
          pendingLineBreak = false;
          paragraph.push(step);
        }
        step.pieces.push(item.kind === 'token' ? { token: item.token } : { text: item.text });
      }
    });

    return paragraphs;
  }

  function displayValue(raw) {
    return raw != null && String(raw).trim() ? String(raw).trim() : '___';
  }

  // Fill a story with its answers. This is the one "finished madlib" shape that the
  // reveal, image, print and story collection all read:
  //   { title, subtitle, story, answers, plainText,
  //     paragraphs: [ [ step ] ], step = { lineBreakBefore, text, runs: [run] },
  //     run = { text } | { answer, type, question } }
  // `story` here has grammar fixes (a/an) applied when js/grammar.js provides them.
  function finish(data) {
    const source = data || {};
    const answers = source.answers || {};
    let story = source.story || '';
    let { tokens } = parse(story);
    let values = tokens.map(t => displayValue(answers[t.key]));

    if (typeof MadlibGrammar !== 'undefined' && MadlibGrammar.prepare) {
      try {
        const prepared = MadlibGrammar.prepare(story, tokens, values);
        const check = parse(prepared.story).tokens;
        // Grammar may only touch text around blanks, never the blanks themselves
        if (check.length === tokens.length && prepared.values.length === values.length) {
          story = prepared.story;
          values = prepared.values;
          tokens = check;
        }
      } catch (e) {
        console.error('Grammar fixes failed:', e);
      }
    }

    const questions = new Map(parse(story).prompts.map(p => [p.key, p.question]));
    const paragraphs = toSteps(story).map(paragraph => paragraph.map(step => {
      let text = '';
      const runs = step.pieces.map(piece => {
        if (piece.text !== undefined) {
          text += piece.text;
          return { text: piece.text };
        }
        const answer = values[piece.token.index];
        text += answer;
        return { answer, type: piece.token.type, question: questions.get(piece.token.key) || null };
      });
      return { lineBreakBefore: step.lineBreakBefore, text: text.trim(), runs };
    }));

    return {
      title: source.title || '',
      subtitle: source.subtitle || '',
      story,
      answers: { ...answers },
      plainText: applyEdits(story, tokens.map(t => ({ start: t.start, end: t.end, text: values[t.index] }))),
      paragraphs
    };
  }

  return { VERSION, parse, tokenText, promptText, applyEdits, cleanType, cleanQuestion, slugify, migrate, toSteps, finish };
})();
