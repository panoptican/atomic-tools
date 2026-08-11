import { FileDiff } from 'https://esm.sh/@pierre/diffs@1.3.5';

const originalInput = document.getElementById('originalInput');
const changedInput = document.getElementById('changedInput');
const originalCount = document.getElementById('originalCount');
const changedCount = document.getElementById('changedCount');
const diffMount = document.getElementById('diffMount');
const placeholder = document.getElementById('placeholder');
const statusNote = document.getElementById('statusNote');
const filenameInput = document.getElementById('filenameInput');

const splitBtn = document.getElementById('splitBtn');
const unifiedBtn = document.getElementById('unifiedBtn');
const wrapBtn = document.getElementById('wrapBtn');
const contextBtn = document.getElementById('contextBtn');
const swapBtn = document.getElementById('swapBtn');
const clearBtn = document.getElementById('clearBtn');

const STORAGE_KEY = 'text-diff-prefs';
const DEFAULT_FILENAME = 'snippet.txt';

const prefs = loadPrefs();
let instance = null;

function loadPrefs() {
  const defaults = { diffStyle: 'split', wrap: false, fullContext: true, filename: '' };
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

function diffOptions() {
  return {
    theme: { dark: 'pierre-dark', light: 'pierre-light' },
    themeType: currentThemeType(),
    diffStyle: prefs.diffStyle,
    overflow: prefs.wrap ? 'wrap' : 'scroll',
    expandUnchanged: prefs.fullContext,
    lineDiffType: 'word-alt',
    hunkSeparators: 'line-info-basic'
  };
}

function fileName() {
  return filenameInput.value.trim() || DEFAULT_FILENAME;
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

/**
 * FileDiff uses reference equality on the file objects to skip re-renders, so
 * each render passes freshly built objects.
 */
function render() {
  const oldText = originalInput.value;
  const newText = changedInput.value;

  originalCount.textContent = lineLabel(oldText);
  changedCount.textContent = lineLabel(newText);

  if (!oldText && !newText) {
    if (instance) {
      instance.cleanUp();
      instance = null;
    }
    diffMount.replaceChildren();
    diffMount.classList.add('hidden');
    placeholder.classList.remove('hidden');
    placeholder.textContent = 'Paste text into both panes to see the diff.';
    showStatus('');
    return;
  }

  if (oldText === newText) {
    if (instance) {
      instance.cleanUp();
      instance = null;
    }
    diffMount.replaceChildren();
    diffMount.classList.add('hidden');
    placeholder.classList.remove('hidden');
    placeholder.textContent = 'Both sides are identical.';
    showStatus('');
    return;
  }

  placeholder.classList.add('hidden');
  diffMount.classList.remove('hidden');

  const name = fileName();
  const payload = {
    oldFile: { name, contents: oldText },
    newFile: { name, contents: newText },
    containerWrapper: diffMount
  };

  try {
    if (!instance) {
      instance = new FileDiff(diffOptions());
    }
    instance.render(payload);
    showStatus('');
  } catch (error) {
    showStatus('Could not render the diff: ' + error.message);
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

originalInput.addEventListener('input', scheduleRender);
changedInput.addEventListener('input', scheduleRender);

filenameInput.addEventListener('input', () => {
  prefs.filename = filenameInput.value;
  savePrefs();
  scheduleRender();
});

splitBtn.addEventListener('click', () => setDiffStyle('split'));
unifiedBtn.addEventListener('click', () => setDiffStyle('unified'));
wrapBtn.addEventListener('click', () => setToggle(wrapBtn, 'wrap', !prefs.wrap));
contextBtn.addEventListener('click', () => setToggle(contextBtn, 'fullContext', !prefs.fullContext));

swapBtn.addEventListener('click', () => {
  const held = originalInput.value;
  originalInput.value = changedInput.value;
  changedInput.value = held;
  render();
});

clearBtn.addEventListener('click', () => {
  originalInput.value = '';
  changedInput.value = '';
  render();
  originalInput.focus();
});

// Restore saved preferences before the first render.
filenameInput.value = prefs.filename;
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

render();
