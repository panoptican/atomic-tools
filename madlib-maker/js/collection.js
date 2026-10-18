// My stories: every finished story is saved on this device so it can be reread later
const MadlibCollection = (function() {
  const STORAGE_KEY = 'madlib-stories';
  const MAX_ENTRIES = 200;
  const UNTITLED = 'Untitled madlib';

  let dialog = null;
  let titleEl = null;
  let bodyEl = null;
  let saveErrorShown = false;
  let pendingUndo = null; // { message, undo } for the last delete, until the dialog closes

  function readAll() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(e => e && typeof e.story === 'string') : [];
    } catch (e) {
      return [];
    }
  }

  function writeAll(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      if (!saveErrorShown) {
        saveErrorShown = true;
        URLManager.showToast("Couldn’t update My stories. This browser’s storage is full or turned off, so use Copy story to keep a copy.", true);
      }
      return false;
    }
  }

  function getAll() {
    return readAll();
  }

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function save(result) {
    if (!result || typeof result.story !== 'string') return;
    const answers = result.answers || {};
    const list = readAll();
    const sig = JSON.stringify([result.story, answers]);
    if (list.some(e => JSON.stringify([e.story, e.answers || {}]) === sig)) return;

    list.unshift({
      id: makeId(),
      savedAt: new Date().toISOString(),
      title: result.title || '',
      subtitle: result.subtitle || '',
      story: result.story,
      answers
    });
    if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
    if (writeAll(list)) {
      URLManager.showToast('Saved to My stories');
    }
  }

  // Dates ------------------------------------------------------------------

  function formatDate(iso, long) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const now = new Date();
    const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d);
    if (d.toDateString() === now.toDateString()) return 'Today, ' + time;
    const opts = d.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' };
    const date = new Intl.DateTimeFormat(undefined, opts).format(d);
    return long ? date + ', ' + time : date;
  }

  // Dialog -----------------------------------------------------------------

  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.className = 'mm-dialog mc-dialog';
    dialog.setAttribute('aria-labelledby', 'mc-title');

    const header = document.createElement('div');
    header.className = 'mm-dialog-header';
    titleEl = document.createElement('h2');
    titleEl.className = 'mm-dialog-title';
    titleEl.id = 'mc-title';
    titleEl.textContent = 'My stories';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'mm-dialog-close';
    close.textContent = 'Close';
    close.addEventListener('click', () => dialog.close());
    header.append(titleEl, close);

    bodyEl = document.createElement('div');
    bodyEl.className = 'mm-dialog-body mc-body';

    dialog.append(header, bodyEl);
    // Backdrop clicks land on the dialog element itself
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    // A delete made in the dialog can still be undone from the toast
    dialog.addEventListener('close', () => {
      if (!pendingUndo) return;
      const { message, undo } = pendingUndo;
      pendingUndo = null;
      URLManager.showToast(message, false, { label: 'Undo', onClick: undo });
    });
    document.body.appendChild(dialog);
  }

  function open() {
    ensureDialog();
    renderList();
    if (!dialog.open) dialog.showModal();
  }

  // The header always reads "My stories"; the story view shows its own title in the body
  function setView(title, node) {
    bodyEl.replaceChildren(node);
    bodyEl.scrollTop = 0;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // Re-rendering replaces the focused button, so the list puts focus back where
  // the user was: on a story's row, or on Undo right after a delete
  function renderList(focusId) {
    const list = readAll();
    const wrap = el('div', 'mc-list-view');
    let focusTarget = null;

    if (pendingUndo) {
      // Same inline status as My madlibs (css/library.css)
      const status = el('p', 'library-status');
      const text = el('span', 'library-status-text', pendingUndo.message);
      text.id = 'mc-status-text';
      const undoBtn = el('button', 'library-status-action', 'Undo');
      undoBtn.type = 'button';
      undoBtn.setAttribute('aria-describedby', text.id);
      undoBtn.addEventListener('click', () => {
        const restoredId = pendingUndo.undo();
        pendingUndo = null;
        renderList(restoredId);
      });
      status.append(text, undoBtn);
      wrap.appendChild(status);
      if (focusId === 'undo') focusTarget = undoBtn;
    }

    if (!list.length) {
      wrap.appendChild(el('p', 'mm-empty', 'No stories yet. Finish a madlib and it’ll be saved here.'));
    } else {
      const ul = el('ul', 'mc-list');
      list.forEach(entry => {
        const li = document.createElement('li');
        const row = el('button', 'mc-row');
        row.type = 'button';
        const top = el('span', 'mc-row-top');
        top.append(
          el('span', 'mc-row-title', entry.title || UNTITLED),
          el('span', 'mc-row-date', formatDate(entry.savedAt, false))
        );
        let excerpt = '';
        try { excerpt = MadlibFormat.finish(entry).plainText.replace(/\s+/g, ' '); } catch (e) { /* ignore */ }
        row.append(top, el('span', 'mc-row-excerpt', excerpt));
        row.addEventListener('click', () => renderStory(entry.id));
        if (entry.id === focusId) focusTarget = row;
        li.appendChild(row);
        ul.appendChild(li);
      });
      wrap.appendChild(ul);
    }

    wrap.appendChild(el('p', 'mc-footnote', 'Stories are saved only in this browser.'));
    setView('My stories', wrap);
    if (focusTarget) focusTarget.focus();
  }

  function actionButton(label, onClick, extra) {
    const btn = el('button', 'mc-btn' + (extra ? ' ' + extra : ''), label);
    btn.type = 'button';
    btn.addEventListener('click', onClick);
    return btn;
  }

  function renderStory(id) {
    const entry = readAll().find(e => e.id === id);
    if (!entry) { renderList(); return; }
    let result;
    try {
      result = MadlibFormat.finish(entry);
    } catch (e) {
      renderList();
      return;
    }

    const wrap = el('div', 'mc-story-view');
    const back = actionButton('← All stories', () => renderList(id), 'mc-back');
    wrap.appendChild(back);

    const head = el('div', 'mc-story-head');
    head.appendChild(el('h3', 'mc-story-title', entry.title || UNTITLED));
    if (entry.subtitle) head.appendChild(el('p', 'mc-story-subtitle', entry.subtitle));
    head.appendChild(el('p', 'mc-story-date', formatDate(entry.savedAt, true)));
    wrap.appendChild(head);

    const text = el('div', 'mc-story-text');
    result.paragraphs.forEach(steps => {
      const p = document.createElement('p');
      steps.forEach((step, i) => {
        if (i > 0) p.appendChild(step.lineBreakBefore ? document.createElement('br') : document.createTextNode(' '));
        step.runs.forEach(run => {
          if (run.answer !== undefined) {
            const w = el('span', 'mc-word', run.answer);
            if (run.type) w.title = run.question || run.type;
            p.appendChild(w);
          } else {
            p.appendChild(document.createTextNode(run.text));
          }
        });
      });
      text.appendChild(p);
    });
    wrap.appendChild(text);

    const actions = el('div', 'mc-actions');
    actions.appendChild(actionButton('Copy story', async () => {
      const ok = await URLManager.copyToClipboard(result.plainText);
      URLManager.showToast(ok ? 'Story copied' : "Couldn’t copy the story. Select the text and copy it instead.", !ok);
    }));
    if (typeof MadlibShare !== 'undefined') {
      actions.appendChild(actionButton('Save as image', () => MadlibShare.saveImage(result)));
    }
    if (typeof MadlibPrint !== 'undefined') {
      actions.appendChild(actionButton('Print', () => {
        dialog.close();
        MadlibPrint.printStory(result);
      }));
    }
    actions.appendChild(actionButton('Delete', () => removeEntry(id), 'mc-btn-danger'));
    wrap.appendChild(actions);

    setView(entry.title || 'My stories', wrap);
    back.focus();
  }

  function removeEntry(id) {
    const list = readAll();
    const index = list.findIndex(e => e.id === id);
    if (index === -1) return;
    const [removed] = list.splice(index, 1);
    if (!writeAll(list)) return;
    // Undo stays in the dialog until it closes, then moves to a toast that stays
    // until dismissed; nothing about it runs on a timer
    pendingUndo = {
      message: `Deleted “${removed.title || UNTITLED}”.`,
      undo: () => {
        const current = readAll();
        if (!current.some(e => e.id === removed.id)) {
          current.splice(Math.min(index, current.length), 0, removed);
          writeAll(current);
        }
        return removed.id;
      }
    };
    renderList('undo');
  }

  // Wiring -----------------------------------------------------------------

  function init() {
    ['stories-btn', 'my-stories-btn'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.hidden = false;
      btn.addEventListener('click', open);
    });

    document.addEventListener('madlib:revealdone', (e) => {
      const detail = e.detail || {};
      if (detail.source === 'replay') return;
      save(detail.result);
    });
  }

  return { init, getAll };
})();
