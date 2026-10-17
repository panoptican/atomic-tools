// Story Editor Module
const StoryEditor = (function() {
  // State
  let storyText = '';
  let lastCursorPos = null; // Track last known cursor position

  // DOM Elements
  let textareaEl;

  // Update internal state from textarea
  function syncFromTextarea() {
    storyText = textareaEl.value;
    if (typeof BlankList !== 'undefined') {
      BlankList.render();
    }
    // Let features (e.g. editor highlighting) follow every change, typed or not
    document.dispatchEvent(new CustomEvent('madlib:storychange', { detail: { story: storyText } }));
    // Trigger auto-save
    if (typeof DraftManager !== 'undefined') {
      DraftManager.save();
    }
  }

  // Track cursor position and let the toolbar reflect the current selection
  function saveCursorPosition() {
    if (!textareaEl) return;
    lastCursorPos = {
      start: textareaEl.selectionStart,
      end: textareaEl.selectionEnd
    };
    if (typeof BlankToolbar !== 'undefined') {
      BlankToolbar.updateLabel(getSelectedText());
    }
  }

  function getSelectedText() {
    if (!lastCursorPos || lastCursorPos.start === lastCursorPos.end) return '';
    return storyText.slice(lastCursorPos.start, lastCursorPos.end);
  }

  // Get the current story text
  function getStory() {
    return storyText;
  }

  // Set the story text (for loading from URL/storage)
  function setStory(text) {
    storyText = text || '';
    lastCursorPos = null;
    if (textareaEl) {
      textareaEl.value = storyText;
      syncFromTextarea();
    }
  }

  // Get textarea element
  function getTextarea() {
    return textareaEl;
  }

  // Replace a range through the browser's editing commands so Cmd+Z still works.
  // Falls back to setRangeText where execCommand is unavailable.
  function replaceRange(start, end, text) {
    const before = textareaEl.value;
    const expected = before.slice(0, start) + text + before.slice(end);
    textareaEl.focus();
    textareaEl.setSelectionRange(start, end);
    try {
      if (start !== end || text) {
        document.execCommand(text === '' ? 'delete' : 'insertText', false, text);
      }
    } catch (e) {
      // Ignore; the check below falls back
    }
    if (textareaEl.value !== expected) {
      textareaEl.value = before;
      textareaEl.setRangeText(text, start, end, 'end');
    }
    // execCommand fires input; the fallback doesn't, so sync either way
    syncFromTextarea();
  }

  // Replace the whole story as one undoable edit, then place the cursor
  function replaceStory(nextStory, cursor) {
    if (nextStory === storyText) return;
    replaceRange(0, textareaEl.value.length, nextStory);
    const pos = Math.min(cursor == null ? nextStory.length : cursor, nextStory.length);
    textareaEl.setSelectionRange(pos, pos);
    saveCursorPosition();
  }

  // Where an insert should go: the last selection, trimmed of surrounding spaces
  // (double-click often grabs a trailing space), or the end of the story.
  function insertionRange() {
    if (!lastCursorPos) {
      return { start: storyText.length, end: storyText.length };
    }
    let { start, end } = lastCursorPos;
    while (end > start && /\s/.test(storyText[end - 1])) end--;
    while (start < end && /\s/.test(storyText[start])) start++;
    return { start, end };
  }

  // Pad an inserted token with spaces so it doesn't glue onto neighbouring words
  function padForInsert(text, start, end) {
    const before = storyText[start - 1];
    const after = storyText[end];
    const padBefore = before && !/\s/.test(before) && !/[(“"']/.test(before) ? ' ' : '';
    const padAfter = after && !/[\s.,!?;:)”"'’…-]/.test(after) ? ' ' : '';
    return padBefore + text + padAfter;
  }

  // Insert text at the cursor (replacing any selection), or append if no cursor
  function insertAtCursor(text) {
    if (!textareaEl) return;
    const { start, end } = insertionRange();
    const padded = start === end ? padForInsert(text, start, end) : text;
    replaceRange(start, end, padded);
    const pos = start + padded.length;
    textareaEl.setSelectionRange(pos, pos);
    saveCursorPosition();
  }

  // Select a range in the story (used to jump to a blank)
  function selectRange(start, end) {
    textareaEl.focus();
    textareaEl.setSelectionRange(start, end);
    saveCursorPosition();
  }

  // Initialize
  function init() {
    textareaEl = document.getElementById('story-editor');

    // Sync state on input
    textareaEl.addEventListener('input', syncFromTextarea);

    // Track cursor position on various events
    ['blur', 'keyup', 'mouseup', 'select', 'input', 'focus'].forEach(type => {
      textareaEl.addEventListener(type, saveCursorPosition);
    });
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === textareaEl) saveCursorPosition();
    });

    // Initial sync
    syncFromTextarea();
  }

  // Public API
  return {
    init,
    getStory,
    setStory,
    getTextarea,
    insertAtCursor,
    insertionRange,
    padForInsert,
    replaceStory,
    selectRange
  };
})();

// Blank Toolbar Module — turns the selected word (or the cursor) into a blank
const BlankToolbar = (function() {
  let labelEl;
  let customInput;

  function updateLabel(selectedText) {
    if (!labelEl) return;
    const word = (selectedText || '').trim().replace(/\s+/g, ' ');
    if (word) {
      const shown = word.length > 28 ? `${word.slice(0, 27)}…` : word;
      labelEl.textContent = `Turn “${shown}” into`;
    } else {
      labelEl.textContent = 'Add a blank';
    }
  }

  function addBlank(type) {
    const clean = MadlibFormat.cleanType(type);
    if (!clean) return;
    StoryEditor.insertAtCursor(MadlibFormat.tokenText(clean));
  }

  function init() {
    labelEl = document.getElementById('blank-toolbar-label');
    customInput = document.getElementById('custom-label-input');
    const toolbar = document.getElementById('blank-toolbar');

    // Keep the textarea's selection visible while clicking a type
    toolbar.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('mousedown', e => e.preventDefault());
      btn.addEventListener('click', () => addBlank(btn.dataset.type));
    });

    document.getElementById('custom-blank-form').addEventListener('submit', e => {
      e.preventDefault();
      if (!customInput.value.trim()) return;
      addBlank(customInput.value);
      customInput.value = '';
    });

    updateLabel('');
  }

  return { init, updateLabel };
})();

// Blank List Module — the sidebar list of prompts, derived from the story
const BlankList = (function() {
  let wordListEl;
  let emptyStateEl;
  let prompts = [];

  function findPrompt(key) {
    return prompts.find(p => p.key === key);
  }

  function render() {
    if (!wordListEl) return;
    prompts = MadlibFormat.parse(StoryEditor.getStory()).prompts;

    wordListEl.querySelectorAll('.word-item').forEach(item => item.remove());
    emptyStateEl.style.display = prompts.length === 0 ? 'block' : 'none';

    prompts.forEach((prompt, i) => {
      const itemEl = document.createElement('div');
      const key = escapeHtml(prompt.key);
      const type = escapeHtml(prompt.type);
      const number = String(i + 1).padStart(2, '0');
      const reuse = prompt.name
        ? `<span class="word-origin">${escapeHtml(prompt.name)}${prompt.count > 1 ? ` · ${prompt.count}×` : ''}</span>`
        : '';
      itemEl.className = 'word-item';
      itemEl.innerHTML = `
        <div class="word-info">
          <button type="button" class="word-id" data-key="${key}" aria-label="Show blank ${i + 1} in the story">${number}</button>
          <button type="button" class="word-label" data-key="${key}" title="Click to rename" aria-label="Rename blank ${i + 1}, ${type}">${type}</button>
          ${reuse}
        </div>
        <button type="button" class="word-question${prompt.question ? '' : ' is-empty'}" data-key="${key}" aria-label="${prompt.question ? `Edit the question for blank ${i + 1}` : `Add a question for blank ${i + 1}`}">${prompt.question ? escapeHtml(prompt.question) : '+ Ask a question instead'}</button>
        <div class="word-actions">
          <button type="button" class="reuse-btn" data-key="${key}" title="Insert this same answer again at the cursor" aria-label="Reuse blank ${i + 1} at the cursor">Reuse</button>
          <button type="button" class="delete-btn" data-key="${key}" aria-label="Remove blank ${i + 1} from the story">Delete</button>
        </div>
      `;
      wordListEl.appendChild(itemEl);
    });
  }

  // Jump to the first place this blank appears
  function handleJump(key) {
    const prompt = findPrompt(key);
    if (!prompt) return;
    const token = prompt.tokens[0];
    StoryEditor.selectRange(token.start, token.end);
  }

  // Rename every occurrence of a blank, keeping its name
  function rename(key, newType) {
    const prompt = findPrompt(key);
    const type = MadlibFormat.cleanType(newType);
    if (!prompt || !type || type === prompt.type) return;
    const story = StoryEditor.getStory();
    const edits = prompt.tokens.map(t => ({ start: t.start, end: t.end, text: MadlibFormat.tokenText(type, t.name, t.question) }));
    StoryEditor.replaceStory(MadlibFormat.applyEdits(story, edits), StoryEditor.insertionRange().start);
  }

  // Insert another occurrence of a blank at the cursor. An unnamed blank gets a
  // name first so both occurrences share one answer.
  function reuse(key) {
    const prompt = findPrompt(key);
    if (!prompt) return;
    const story = StoryEditor.getStory();
    let name = prompt.name;
    const edits = [];

    if (!name) {
      const taken = new Set(prompts.filter(p => p.name).map(p => p.name.toLowerCase()));
      const base = MadlibFormat.slugify(prompt.type);
      let n = 1;
      while (taken.has(`${base}${n}`)) n++;
      name = `${base}${n}`;
      const token = prompt.tokens[0];
      edits.push({ start: token.start, end: token.end, text: MadlibFormat.tokenText(prompt.type, name, token.question) });
    }

    const range = StoryEditor.insertionRange();
    // Inserting inside the token being renamed would corrupt it; insert after it instead
    const overlapping = prompt.tokens.find(t => range.start < t.end && range.end > t.start);
    const insertAt = overlapping
      ? { start: overlapping.end, end: overlapping.end }
      : range;
    const insertText = range.start === range.end || overlapping
      ? StoryEditor.padForInsert(MadlibFormat.tokenText(prompt.type, name), insertAt.start, insertAt.end)
      : MadlibFormat.tokenText(prompt.type, name);
    edits.push({ start: insertAt.start, end: insertAt.end, text: insertText });

    // Cursor lands after the inserted token, accounting for earlier edits
    const shift = edits
      .filter(e => e.start < insertAt.start)
      .reduce((sum, e) => sum + e.text.length - (e.end - e.start), 0);
    StoryEditor.replaceStory(MadlibFormat.applyEdits(story, edits), insertAt.start + shift + insertText.length);
  }

  // Remove every occurrence of a blank, with an undo
  function remove(key) {
    const prompt = findPrompt(key);
    if (!prompt) return;
    const before = StoryEditor.getStory();
    const edits = prompt.tokens.map(t => {
      // Take one neighbouring space with the token so no double space is left behind
      let { start, end } = t;
      if (before[end] === ' ' && (start === 0 || before[start - 1] === ' ')) end++;
      else if (before[start - 1] === ' ' && /[\s.,!?;:]|^$/.test(before[end] || '')) start--;
      return { start, end, text: '' };
    });
    StoryEditor.replaceStory(MadlibFormat.applyEdits(before, edits), edits[0].start);

    const label = prompt.count > 1 ? `Removed ${prompt.count} “${prompt.type}” blanks` : `Removed “${prompt.type}”`;
    URLManager.showToast(label, false, {
      label: 'Undo',
      onClick: () => StoryEditor.replaceStory(before, prompt.tokens[0].end)
    });
  }

  // Set the question players see for a blank (empty removes it). The question
  // lives on the blank's first occurrence; any copies on later ones are dropped.
  function setQuestion(key, question) {
    const prompt = findPrompt(key);
    if (!prompt) return;
    const clean = MadlibFormat.cleanQuestion(question);
    if (clean === (prompt.question || '')) return;
    const story = StoryEditor.getStory();
    const edits = prompt.tokens.map((t, i) => ({
      start: t.start,
      end: t.end,
      text: MadlibFormat.tokenText(t.type, t.name, i === 0 ? clean : '')
    }));
    StoryEditor.replaceStory(MadlibFormat.applyEdits(story, edits), StoryEditor.insertionRange().start);
  }

  // Swap a sidebar button for an inline text field; Enter or blur saves, Escape cancels
  function startInlineEdit(btn, { value, className, ariaLabel, placeholder, onSave }) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = className;
    input.value = value;
    input.placeholder = placeholder || '';
    input.setAttribute('aria-label', ariaLabel);
    btn.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    function finish(save) {
      if (finished) return;
      finished = true;
      if (save) onSave(input.value);
      render();
    }

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finish(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    });
  }

  function handleClick(e) {
    const btn = e.target.closest('button');
    if (!btn || !wordListEl.contains(btn)) return;
    const key = btn.dataset.key;
    if (btn.classList.contains('word-id')) handleJump(key);
    else if (btn.classList.contains('word-label')) {
      startInlineEdit(btn, {
        value: findPrompt(key).type,
        className: 'word-label-edit',
        ariaLabel: 'Blank type',
        onSave: value => rename(key, value)
      });
    } else if (btn.classList.contains('word-question')) {
      startInlineEdit(btn, {
        value: findPrompt(key).question || '',
        className: 'word-question-edit',
        ariaLabel: 'Question players see',
        placeholder: 'e.g. Something squishy?',
        onSave: value => setQuestion(key, value)
      });
    }
    else if (btn.classList.contains('reuse-btn')) reuse(key);
    else if (btn.classList.contains('delete-btn')) remove(key);
  }

  function init() {
    wordListEl = document.getElementById('word-list');
    emptyStateEl = document.getElementById('empty-state');
    // Reuse inserts at the cursor, so don't let the click blur the story first
    wordListEl.addEventListener('mousedown', e => {
      if (e.target.closest('.reuse-btn')) e.preventDefault();
    });
    wordListEl.addEventListener('click', handleClick);
    render();
  }

  return {
    init,
    render,
    getPrompts: () => [...prompts]
  };
})();
