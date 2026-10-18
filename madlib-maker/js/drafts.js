// Draft Manager Module (auto-saves the madlib being edited into MadlibLibrary)
const DraftManager = (function() {
  const DEBOUNCE_DELAY = 500;
  const UNTITLED = 'Untitled madlib';

  let saveTimeout = null;
  let isEnabled = true; // Can be disabled for player-only mode

  // Which library entry this tab is editing. Held per tab, so two open tabs
  // never write into each other's madlib; the stored active id is only used
  // to reopen the last madlib on the next visit.
  let activeId = null;
  // The active entry's updatedAt as this tab last saw it, to notice saves from other tabs
  let knownUpdatedAt = null;

  // True while the page was opened from an edit/short link: the first real save
  // goes to a new entry instead of overwriting the madlib that was active.
  let fromLink = false;

  let storageWarned = false;

  // Dialog state
  let dialogEl = null;
  let listEl = null;
  let statusEl = null;
  let pendingUndo = null; // { message, undo } for the last delete in the dialog

  function hasLibrary() {
    return typeof MadlibLibrary !== 'undefined';
  }

  // Collect current state for saving
  function collectState() {
    return {
      v: MadlibFormat.VERSION,
      title: MetadataManager.getRawTitle(),
      subtitle: MetadataManager.getSubtitle(),
      story: StoryEditor.getStory()
    };
  }

  function isEmpty(state) {
    return !state.title.trim() && !state.story.trim();
  }

  function sameContent(a, b) {
    return a.title === b.title && a.subtitle === b.subtitle && a.story === b.story;
  }

  function remember(entry) {
    knownUpdatedAt = entry ? entry.updatedAt : null;
  }

  function setActive(id) {
    activeId = id || null;
    MadlibLibrary.setActiveId(activeId);
    remember(activeId ? MadlibLibrary.get(activeId) : null);
  }

  function warnStorage() {
    if (storageWarned) return;
    storageWarned = true;
    URLManager.showToast("Couldn't save your madlib. This browser's storage is full or turned off, so use Copy editor link to keep a copy.", true);
  }

  // Save to the library (internal, immediate)
  function doSave() {
    saveTimeout = null;
    if (!isEnabled || !hasLibrary()) return;

    const state = collectState();

    if (fromLink) {
      if (isEmpty(state)) return;
      fromLink = false;
      // Reopening a link to a madlib that's already saved reuses that entry
      const match = MadlibLibrary.list().find(entry => sameContent(entry, state));
      if (match) {
        setActive(match.id);
        return;
      }
      activeId = null;
    }

    const current = activeId ? MadlibLibrary.get(activeId) : null;
    if (current && sameContent(current, state)) return;
    if (!activeId && isEmpty(state)) return;

    // Another tab saved this madlib since this tab loaded it: keep both versions
    // rather than overwriting theirs with ours
    let saveId = activeId;
    if (current && knownUpdatedAt && current.updatedAt !== knownUpdatedAt) {
      saveId = null;
      URLManager.showToast('This madlib changed in another tab, so your edits were saved as a separate copy');
    }

    const saved = MadlibLibrary.save({
      id: saveId || undefined,
      title: state.title,
      subtitle: state.subtitle,
      story: state.story
    });
    if (!saved) {
      warnStorage();
      return;
    }
    if (saved.id !== activeId) setActive(saved.id);
    remember(saved);
    if (dialogEl && dialogEl.open) renderList();
  }

  // Save with debounce (public API)
  function save() {
    if (!isEnabled) return;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(doSave, DEBOUNCE_DELAY);
  }

  // Write any pending change now (before switching madlibs or leaving the page)
  function flush() {
    if (!saveTimeout) return;
    clearTimeout(saveTimeout);
    doSave();
  }

  function cancelPending() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  // The madlib being edited, as stored
  function load() {
    if (!hasLibrary() || !activeId) return null;
    return MadlibLibrary.get(activeId);
  }

  function hasDraft() {
    return load() !== null;
  }

  // Stop editing the active entry. Nothing is deleted: it stays in the library.
  function clear() {
    cancelPending();
    if (hasLibrary()) setActive(null);
  }

  // Library entries are always current-format; say so, so loading never re-migrates them
  function asCurrentFormat(entry) {
    return { v: MadlibFormat.VERSION, title: entry.title, subtitle: entry.subtitle, story: entry.story };
  }

  // Restore the active entry to the editor
  function restore() {
    const entry = load();
    if (!entry) return false;
    fromLink = false;
    cancelPending();
    return URLManager.loadData(asCurrentFormat(entry));
  }

  // Reset editor to blank slate
  function resetEditor() {
    MetadataManager.setTitle('');
    MetadataManager.setSubtitle('');
    StoryEditor.setStory('');
    ColorThemeManager.clear();
  }

  function showCreator() {
    if (ModeManager.getMode() === 'preview') ModeManager.switchToCreator();
  }

  // Load a library entry into the editor and make it the one being edited
  function openEntry(id) {
    flush();
    const entry = MadlibLibrary.get(id);
    if (!entry) return false;
    fromLink = false;
    setActive(entry.id); // before loading, so the load's auto-save finds no change
    const ok = URLManager.loadData(asCurrentFormat(entry));
    cancelPending();
    showCreator();
    return ok;
  }

  // Handle "New madlib": keep everything, just start a blank one
  function handleNewMadlib() {
    if (!isEnabled || !hasLibrary()) return;
    flush();
    const previous = { id: activeId, data: collectState() };
    fromLink = false;
    setActive(null);
    resetEditor();
    cancelPending();
    showCreator();

    if (!previous.id && isEmpty(previous.data)) {
      URLManager.showToast('Started a new madlib');
      return;
    }
    URLManager.showToast('Started a new madlib', false, {
      label: 'Undo',
      onClick: () => {
        if (previous.id && MadlibLibrary.get(previous.id)) {
          openEntry(previous.id);
        } else {
          // Not in the library (e.g. it was deleted): put the text back as a new entry
          flush();
          setActive(null);
          URLManager.loadData(asCurrentFormat(previous.data));
          showCreator();
        }
      }
    });
  }

  // Enable/disable auto-save (disable for player mode)
  function setEnabled(enabled) {
    isEnabled = enabled;
    if (!enabled) cancelPending();
  }

  // --- "My madlibs" dialog -------------------------------------------------

  function excerpt(story) {
    let text = story || '';
    try {
      const tokens = MadlibFormat.parse(text).tokens;
      let out = '';
      let pos = 0;
      tokens.forEach(token => {
        out += text.slice(pos, token.start) + '[' + token.type + ']';
        pos = token.end;
      });
      text = out + text.slice(pos);
    } catch (e) {
      // Show the raw text
    }
    return text.replace(/\s+/g, ' ').trim().slice(0, 240);
  }

  function blankCount(story) {
    try {
      return MadlibFormat.parse(story || '').prompts.length;
    } catch (e) {
      return 0;
    }
  }

  function formatDate(time) {
    const date = new Date(time);
    const now = new Date();
    try {
      if (date.toDateString() === now.toDateString()) {
        return 'today, ' + new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date);
      }
      const options = { month: 'short', day: 'numeric' };
      if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric';
      return new Intl.DateTimeFormat(undefined, options).format(date);
    } catch (e) {
      return date.toLocaleDateString();
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function actionButton(label, action, id, extraClass) {
    const btn = el('button', 'library-action' + (extraClass ? ' ' + extraClass : ''), label);
    btn.type = 'button';
    btn.dataset.action = action;
    btn.dataset.id = id;
    return btn;
  }

  function renderList() {
    if (!listEl) return;
    const entries = MadlibLibrary.list();
    listEl.textContent = '';

    if (!entries.length) {
      const empty = el('p', 'mm-empty', 'No saved madlibs yet. Anything you write is saved here automatically.');
      listEl.appendChild(empty);
      return;
    }

    const ul = el('ul', 'library-list');
    entries.forEach(entry => {
      const title = entry.title.trim() || UNTITLED;
      const li = el('li', 'library-item' + (entry.id === activeId ? ' is-active' : ''));

      const main = el('div', 'library-main');
      const head = el('div', 'library-head');
      head.appendChild(el('span', 'library-title', title));
      if (entry.id === activeId) head.appendChild(el('span', 'library-badge', 'Editing'));
      main.appendChild(head);

      const count = blankCount(entry.story);
      const meta = (count === 1 ? '1 blank' : count + ' blanks') + ' · Edited ' + formatDate(entry.updatedAt);
      main.appendChild(el('p', 'library-meta', meta));

      const text = excerpt(entry.story);
      if (text) main.appendChild(el('p', 'library-excerpt', text));
      li.appendChild(main);

      const actions = el('div', 'library-actions');
      const open = actionButton('Open', 'open', entry.id, 'library-action-primary');
      open.setAttribute('aria-label', 'Open ' + title);
      const dup = actionButton('Duplicate', 'duplicate', entry.id);
      dup.setAttribute('aria-label', 'Duplicate ' + title);
      const del = actionButton('Delete', 'delete', entry.id, 'library-action-danger');
      del.setAttribute('aria-label', 'Delete ' + title);
      actions.append(open, dup, del);
      li.appendChild(actions);

      ul.appendChild(li);
    });
    listEl.appendChild(ul);
  }

  // Inline status inside the dialog (the page toast sits behind the modal)
  function setStatus(message, undo) {
    pendingUndo = undo ? { message, undo } : null;
    statusEl.textContent = '';
    statusEl.hidden = !message;
    if (!message) return;
    statusEl.appendChild(el('span', 'library-status-text', message));
    if (undo) {
      const btn = el('button', 'library-status-action', 'Undo');
      btn.type = 'button';
      btn.addEventListener('click', () => {
        const restoredId = undo();
        setStatus('');
        renderList();
        if (restoredId) focusEntry(restoredId, 'open');
      });
      statusEl.appendChild(btn);
    }
  }

  // Re-rendering the list replaces the focused button; put focus back on the
  // same entry so keyboard users keep their place in the dialog
  function focusEntry(id, action) {
    const btn = Array.from(listEl.querySelectorAll('.library-action'))
      .find(b => b.dataset.id === id && b.dataset.action === action);
    if (btn) btn.focus();
  }

  function deleteEntry(id) {
    flush();
    const result = MadlibLibrary.remove(id);
    if (!result) {
      setStatus("Couldn't delete that madlib. Reload the page and try again.");
      return;
    }
    const wasActive = result.entry.id === activeId;
    if (wasActive) {
      // The text stays in the editor; the next edit saves it as a new entry
      fromLink = false;
      activeId = null;
    }
    const title = result.entry.title.trim() || UNTITLED;
    setStatus('Deleted “' + title + '”.', () => {
      MadlibLibrary.restore(result.entry, result.index);
      if (wasActive && !activeId) setActive(result.entry.id);
      return result.entry.id;
    });
    renderList();
    statusEl.querySelector('.library-status-action').focus();
  }

  function duplicateEntry(id) {
    flush();
    const entry = MadlibLibrary.get(id);
    if (!entry) return;
    const copy = MadlibLibrary.save({
      title: 'Copy of ' + (entry.title.trim() || UNTITLED),
      subtitle: entry.subtitle,
      story: entry.story
    });
    if (!copy) {
      warnStorage();
      return;
    }
    setStatus('Duplicated “' + (entry.title.trim() || UNTITLED) + '”.');
    renderList();
    focusEntry(id, 'duplicate');
  }

  function handleListClick(e) {
    const btn = e.target.closest('.library-action');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'open') {
      if (openEntry(id)) closeDialog();
    } else if (action === 'duplicate') {
      duplicateEntry(id);
    } else if (action === 'delete') {
      deleteEntry(id);
    }
  }

  function buildDialog() {
    dialogEl = el('dialog', 'mm-dialog library-dialog');
    dialogEl.setAttribute('aria-labelledby', 'library-dialog-title');

    const header = el('div', 'mm-dialog-header');
    const title = el('h2', 'mm-dialog-title', 'My madlibs');
    title.id = 'library-dialog-title';
    const close = el('button', 'mm-dialog-close', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => closeDialog());
    header.append(title, close);

    const body = el('div', 'mm-dialog-body');
    const toolbar = el('div', 'library-toolbar');
    const newBtn = el('button', 'library-new-btn', 'New madlib');
    newBtn.type = 'button';
    newBtn.addEventListener('click', () => {
      closeDialog(true);
      handleNewMadlib();
    });
    toolbar.appendChild(newBtn);

    statusEl = el('p', 'library-status');
    statusEl.setAttribute('role', 'status');
    statusEl.hidden = true;

    listEl = el('div', 'library-results');
    listEl.addEventListener('click', handleListClick);

    const note = el('p', 'library-note', 'Madlibs are saved only in this browser.');
    body.append(toolbar, statusEl, listEl, note);

    dialogEl.append(header, body);
    dialogEl.addEventListener('close', () => {
      // A delete made in the dialog can still be undone from the toast
      if (pendingUndo) {
        const undo = pendingUndo.undo;
        URLManager.showToast(pendingUndo.message, false, { label: 'Undo', onClick: undo });
      }
      setStatus('');
    });
    document.body.appendChild(dialogEl);
  }

  function openDialog() {
    if (!hasLibrary()) return;
    flush();
    if (!dialogEl) buildDialog();
    setStatus('');
    renderList();
    if (typeof dialogEl.showModal === 'function') {
      dialogEl.showModal();
    } else {
      dialogEl.setAttribute('open', '');
    }
  }

  function closeDialog(skipUndoToast) {
    if (!dialogEl) return;
    if (skipUndoToast) pendingUndo = null;
    if (typeof dialogEl.close === 'function' && dialogEl.open) {
      dialogEl.close();
    } else {
      dialogEl.removeAttribute('open');
      setStatus('');
    }
  }

  // Initialize
  function init() {
    // Drop any save queued before startup (e.g. MetadataManager's initial sync)
    cancelPending();

    if (hasLibrary()) {
      activeId = MadlibLibrary.getActiveId();
      if (activeId && !MadlibLibrary.get(activeId)) activeId = null;
      remember(activeId ? MadlibLibrary.get(activeId) : null);
      const hash = window.location.hash || '';
      fromLink = hash.indexOf('#edit=') === 0 || hash.indexOf('#s=') === 0;
    }

    const newBtn = document.getElementById('new-madlib-btn');
    if (newBtn) {
      newBtn.addEventListener('click', handleNewMadlib);
    }

    const libraryBtn = document.getElementById('library-btn');
    if (libraryBtn && hasLibrary()) {
      libraryBtn.hidden = false;
      libraryBtn.setAttribute('aria-haspopup', 'dialog');
      libraryBtn.addEventListener('click', openDialog);
    }

    // Don't lose the last half-second of typing when the tab closes
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  // Public API
  return {
    init,
    save,
    load,
    hasDraft,
    clear,
    restore,
    resetEditor,
    setEnabled
  };
})();
