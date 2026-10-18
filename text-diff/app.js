import { LANGUAGES, detectLanguage } from './language.js';

// Loaded with import() at the end of this file rather than a static import, so
// the panes, counts and buttons still work, and say so, when esm.sh is unreachable.
const LIBRARY_URL = 'https://esm.sh/@pierre/diffs@1.3.5';
const LOAD_ERROR = "Couldn't load the diff viewer. Check your connection, then reload the page.";
const RENDER_ERROR = "Couldn't show this diff. Reload the page and paste again.";

const originalInput = document.getElementById('originalInput');
const changedInput = document.getElementById('changedInput');
const originalCount = document.getElementById('originalCount');
const changedCount = document.getElementById('changedCount');
const diffMount = document.getElementById('diffMount');
const placeholder = document.getElementById('placeholder');
const statusNote = document.getElementById('statusNote');
const swapAside = document.getElementById('swapAside');
const languageSelect = document.getElementById('languageSelect');

const splitBtn = document.getElementById('splitBtn');
const unifiedBtn = document.getElementById('unifiedBtn');
const wrapBtn = document.getElementById('wrapBtn');
const contextBtn = document.getElementById('contextBtn');
const swapBtn = document.getElementById('swapBtn');
const clearBtn = document.getElementById('clearBtn');
const clearLabel = document.getElementById('clearLabel');
const clearIcon = document.getElementById('clearIcon');
const undoIcon = document.getElementById('undoIcon');

const STORAGE_KEY = 'text-diff-prefs';

const prefs = loadPrefs();
let FileDiff = null;
let libraryFailed = false;
let instance = null;
// Side by side stops fitting when the panes stack; below that the diff is
// always unified and the View switch is hidden (CSS), keeping the saved choice.
const narrowScreen = window.matchMedia('(max-width: 720px)');
let identicalSwaps = 0;
// What Clear removed, kept until the next edit so the button can undo it.
// (Setting .value directly wipes the textareas' own undo history.)
let clearedTexts = null;
let swapAsideShown = false;
try {
  swapAsideShown = sessionStorage.getItem('text-diff-swap-aside') === 'shown';
} catch (e) {
  /* If storage is unavailable, remember only until the page closes. */
}

function loadPrefs() {
  const defaults = { diffStyle: 'split', wrap: false, fullContext: true, language: 'auto' };
  try {
    return Object.assign(defaults, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch (e) {
    return defaults;
  }
}

function savePrefs() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    /* private mode — preferences just don't persist */
  }
}

function currentThemeType() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

// Inside the diff's shadow root, page styles don't reach. This matches the
// page's focus ring on the expand controls made focusable below, and fixes
// light-mode contrast the theme misses: the -/+ counts (same colors as the line
// numbers in index.html) and the theme's comment gray, #66707B, which falls to
// 4.1:1 on changed lines. Tokens carry their color inline, so the comment rule
// matches that value; dark mode keeps the theme's colors.
const DIFF_CSS = `
  [data-expand-button]:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
  [data-additions-count] { color: light-dark(#116329, #5ecc71); }
  [data-deletions-count] { color: light-dark(#a40e26, #ff6762); }
  [style*="--diffs-token-light:#66707B" i] { color: light-dark(#59636e, var(--diffs-token-dark)); }
`;

function diffOptions() {
  return {
    // The high-contrast GitHub themes keep syntax colors at 4.5:1 or better on
    // the tinted change lines; the pierre themes dropped to 1.8:1
    theme: { dark: 'github-dark-high-contrast', light: 'github-light-high-contrast' },
    themeType: currentThemeType(),
    diffStyle: narrowScreen.matches ? 'unified' : prefs.diffStyle,
    unsafeCSS: DIFF_CSS,
    overflow: prefs.wrap ? 'wrap' : 'scroll',
    expandUnchanged: prefs.fullContext,
    lineDiffType: 'word-alt',
    hunkSeparators: 'line-info-basic'
  };
}

const autoOption = new Option('Auto', 'auto');
languageSelect.append(autoOption, ...LANGUAGES.map((lang) => new Option(lang.label, lang.id)));

// Auto names its guess in the menu, so a wrong guess is visible and one
// choice away from being fixed.
function findLanguage(id) {
  return LANGUAGES.find((lang) => lang.id === id) || LANGUAGES[0];
}

function resolveLanguage(oldText, newText) {
  const detected = findLanguage(detectLanguage(oldText + '\n' + newText));
  autoOption.textContent = oldText || newText ? 'Auto · ' + detected.label : 'Auto';
  return prefs.language === 'auto' ? detected : findLanguage(prefs.language);
}

function lineLabel(value) {
  if (!value) return '0 lines';
  const n = value.split('\n').length;
  return n === 1 ? '1 line' : n + ' lines';
}

function showStatus(message) {
  statusNote.textContent = message;
  statusNote.classList.toggle('hidden', !message);
}

function showPlaceholder(message) {
  if (instance) {
    instance.cleanUp();
    instance = null;
  }
  diffMount.replaceChildren();
  diffMount.classList.add('hidden');
  placeholder.classList.toggle('hidden', !message);
  placeholder.textContent = message;
}

// The library draws the collapsed-context expand controls as <div role="button">
// with no tabindex, name or key handling. Give each one all three as it appears.
const EXPAND_LABELS = {
  'data-expand-up': 'Show unmodified lines above',
  'data-expand-down': 'Show unmodified lines below'
};

function enhanceExpanders(root) {
  root.querySelectorAll('[data-expand-button]:not([tabindex])').forEach((btn) => {
    const direction = Object.keys(EXPAND_LABELS).find((attr) => btn.hasAttribute(attr));
    const count = btn.closest('[data-separator]')?.querySelector('[data-unmodified-lines]');
    btn.tabIndex = 0;
    btn.setAttribute('aria-label', direction
      ? EXPAND_LABELS[direction]
      : count ? 'Show ' + count.textContent.trim() : 'Show unmodified lines');
    btn.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      const index = [...root.querySelectorAll('[data-expand-button]')].indexOf(btn);
      btn.click();
      // Expanding removes the control; keep focus on the next one, if any
      requestAnimationFrame(() => {
        if (root.activeElement) return;
        const rest = root.querySelectorAll('[data-expand-button][tabindex]');
        if (rest.length) rest[Math.min(index, rest.length - 1)].focus();
      });
    });
  });
}

let observedRoot = null;
function watchExpanders() {
  const root = diffMount.firstElementChild?.shadowRoot;
  if (!root || root === observedRoot) return;
  observedRoot = root;
  enhanceExpanders(root);
  new MutationObserver(() => enhanceExpanders(root)).observe(root, { childList: true, subtree: true });
}

/**
 * FileDiff uses reference equality on the file objects to skip re-renders, so
 * each render passes freshly built objects.
 */
function render() {
  const oldText = originalInput.value;
  const newText = changedInput.value;

  originalCount.textContent = lineLabel(oldText);
  changedCount.textContent = lineLabel(newText);
  const lang = resolveLanguage(oldText, newText);

  if (libraryFailed) {
    showPlaceholder('');
    showStatus(LOAD_ERROR);
    return;
  }

  if (!oldText && !newText) {
    showPlaceholder('Paste text into both panes to see the diff.');
    showStatus('');
    return;
  }

  if (oldText === newText) {
    showPlaceholder('Both sides are identical.');
    showStatus('');
    return;
  }

  if (!FileDiff) {
    showPlaceholder('Loading the diff viewer…');
    showStatus('');
    return;
  }

  placeholder.classList.add('hidden');
  diffMount.classList.remove('hidden');

  // The name only titles the diff header; lang sets the highlighting
  const name = 'snippet.' + lang.ext;
  const payload = {
    oldFile: { name, contents: oldText, lang: lang.id },
    newFile: { name, contents: newText, lang: lang.id },
    containerWrapper: diffMount
  };

  try {
    if (!instance) {
      instance = new FileDiff(diffOptions());
    }
    instance.render(payload);
    watchExpanders();
    showStatus('');
  } catch (error) {
    console.error('Diff render failed:', error);
    showStatus(RENDER_ERROR);
  }
}

let renderTimer;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 180);
}

// Layout options are baked in at construction, so changing one rebuilds the
// instance rather than patching it in place.
function resetInstance() {
  if (instance) {
    instance.cleanUp();
    instance = null;
  }
  diffMount.replaceChildren();
}

function setDiffStyle(style) {
  prefs.diffStyle = style;
  splitBtn.setAttribute('aria-pressed', String(style === 'split'));
  unifiedBtn.setAttribute('aria-pressed', String(style === 'unified'));
  savePrefs();
  resetInstance();
  render();
}

function setToggle(button, key, value) {
  prefs[key] = value;
  button.setAttribute('aria-pressed', String(value));
  savePrefs();
  resetInstance();
  render();
}

function resetSwapAside() {
  identicalSwaps = 0;
  swapAside.classList.add('hidden');
}

function setUndoClear(texts) {
  clearedTexts = texts;
  clearLabel.textContent = texts ? 'Undo clear' : 'Clear';
  clearIcon.classList.toggle('hidden', !!texts);
  undoIcon.classList.toggle('hidden', !texts);
}

function onTextInput() {
  if (clearedTexts) setUndoClear(null);
  resetSwapAside();
  scheduleRender();
}

originalInput.addEventListener('input', onTextInput);
changedInput.addEventListener('input', onTextInput);

languageSelect.addEventListener('change', () => {
  prefs.language = languageSelect.value;
  savePrefs();
  render();
});

splitBtn.addEventListener('click', () => setDiffStyle('split'));
unifiedBtn.addEventListener('click', () => setDiffStyle('unified'));
wrapBtn.addEventListener('click', () => setToggle(wrapBtn, 'wrap', !prefs.wrap));
contextBtn.addEventListener('click', () => setToggle(contextBtn, 'fullContext', !prefs.fullContext));

swapBtn.addEventListener('click', () => {
  if (clearedTexts) setUndoClear(null);
  const held = originalInput.value;
  originalInput.value = changedInput.value;
  changedInput.value = held;
  render();

  if (!held.trim() || originalInput.value !== changedInput.value) {
    resetSwapAside();
    return;
  }
  if (!swapAsideShown && ++identicalSwaps === 3) {
    swapAside.classList.remove('hidden');
    swapAsideShown = true;
    try {
      sessionStorage.setItem('text-diff-swap-aside', 'shown');
    } catch (e) {
      /* The in-memory flag still limits this to one appearance. */
    }
  }
});

clearBtn.addEventListener('click', () => {
  if (clearedTexts) {
    originalInput.value = clearedTexts.original;
    changedInput.value = clearedTexts.changed;
    setUndoClear(null);
  } else {
    if (!originalInput.value && !changedInput.value) return;
    setUndoClear({ original: originalInput.value, changed: changedInput.value });
    originalInput.value = '';
    changedInput.value = '';
  }
  resetSwapAside();
  render();
  originalInput.focus();
});

// Restore saved preferences before the first render.
// Saved prefs from before the Language menu carry a filename instead.
delete prefs.filename;
if (prefs.language !== 'auto' && findLanguage(prefs.language).id !== prefs.language) {
  prefs.language = 'auto';
}
languageSelect.value = prefs.language;
splitBtn.setAttribute('aria-pressed', String(prefs.diffStyle === 'split'));
unifiedBtn.setAttribute('aria-pressed', String(prefs.diffStyle === 'unified'));
wrapBtn.setAttribute('aria-pressed', String(prefs.wrap));
contextBtn.setAttribute('aria-pressed', String(prefs.fullContext));

AtomicTheme.bind({
  storageKey: 'text-diff-theme',
  toggleId: 'themeToggle',
  mode: 'class',
  className: 'dark',
  onChange: (dark) => {
    if (instance) instance.setThemeType(dark ? 'dark' : 'light');
  }
});

narrowScreen.addEventListener('change', () => {
  resetInstance();
  render();
});

render();

import(LIBRARY_URL)
  .then((module) => {
    FileDiff = module.FileDiff;
  })
  .catch((error) => {
    console.error('Diff library failed to load:', error);
    libraryFailed = true;
  })
  .then(render);
