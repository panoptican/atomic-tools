// Madlib Library Module (saved madlibs in localStorage, no DOM)
const MadlibLibrary = (function() {
  const STORAGE_KEY = 'madlib-library';
  const ACTIVE_KEY = 'madlib-library-active';
  const LEGACY_DRAFT_KEY = 'madlib-creator-draft';
  const CORRUPT_PREFIX = 'madlib-library-corrupt-';

  // Set when stored data couldn't be parsed and couldn't be backed up either:
  // writing then would destroy the only copy, so all writes are refused.
  let writesBlocked = false;
  let lastStamp = 0;

  function storage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (e) {
      return null;
    }
  }

  function getItem(key) {
    try {
      const store = storage();
      return store ? store.getItem(key) : null;
    } catch (e) {
      return null;
    }
  }

  function setItem(key, value) {
    try {
      const store = storage();
      if (!store) return false;
      store.setItem(key, value);
      return true;
    } catch (e) {
      console.error('Failed to write madlib library:', e);
      return false;
    }
  }

  function removeItem(key) {
    try {
      const store = storage();
      if (store) store.removeItem(key);
    } catch (e) {
      // Nothing to do
    }
  }

  function newId() {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch (e) {
      // Fall through (e.g. insecure context)
    }
    return 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  // Strictly increasing timestamps keep "newest first" stable within one millisecond
  function stamp() {
    lastStamp = Math.max(Date.now(), lastStamp + 1);
    return lastStamp;
  }

  function str(value) {
    return typeof value === 'string' ? value : '';
  }

  function normalize(entry) {
    const now = Date.now();
    return {
      id: str(entry.id) || newId(),
      title: str(entry.title),
      subtitle: str(entry.subtitle),
      story: str(entry.story),
      createdAt: Number(entry.createdAt) || now,
      updatedAt: Number(entry.updatedAt) || now
    };
  }

  // Import the old single draft as the first entry (first use only)
  function migrateLegacyDraft() {
    const raw = getItem(LEGACY_DRAFT_KEY);
    if (!raw) return [];
    let draft;
    try {
      draft = JSON.parse(raw);
    } catch (e) {
      return [];
    }
    if (!draft || typeof draft !== 'object') return [];
    if (typeof MadlibFormat !== 'undefined' && typeof MadlibFormat.migrate === 'function') {
      draft = MadlibFormat.migrate(draft) || draft;
    }
    if (!str(draft.story).trim() && !str(draft.title).trim()) return [];

    const now = stamp();
    const entry = normalize({
      title: draft.title,
      subtitle: draft.subtitle,
      story: draft.story,
      createdAt: now,
      updatedAt: now
    });
    if (setItem(STORAGE_KEY, JSON.stringify([entry]))) setItem(ACTIVE_KEY, entry.id);
    return [entry];
  }

  // Keep unreadable data under a separate key before anything replaces it
  function handleCorrupt(raw) {
    const backupKey = CORRUPT_PREFIX + Date.now();
    if (setItem(backupKey, raw)) {
      console.error('Madlib library was unreadable; backed up to ' + backupKey);
      if (!setItem(STORAGE_KEY, '[]')) writesBlocked = true;
    } else {
      console.error('Madlib library was unreadable and could not be backed up; saving is paused.');
      writesBlocked = true;
    }
  }

  function readAll() {
    const raw = getItem(STORAGE_KEY);
    if (raw === null) return writesBlocked ? [] : migrateLegacyDraft();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      handleCorrupt(raw);
      return [];
    }
    if (!Array.isArray(parsed)) {
      handleCorrupt(raw);
      return [];
    }
    return parsed
      .filter(item => item && typeof item === 'object' && typeof item.id === 'string' && item.id)
      .map(normalize);
  }

  function writeAll(entries) {
    if (writesBlocked) return false;
    return setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function copy(entry) {
    return entry ? Object.assign({}, entry) : null;
  }

  // Newest-updated first
  function list() {
    return readAll()
      .sort((a, b) => (b.updatedAt - a.updatedAt) || (b.createdAt - a.createdAt))
      .map(copy);
  }

  function get(id) {
    if (!id) return null;
    return copy(readAll().find(entry => entry.id === id));
  }

  // Insert or update; returns the stored entry, or null if it couldn't be written
  function save(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const entries = readAll();
    const now = stamp();
    const index = entry.id ? entries.findIndex(item => item.id === entry.id) : -1;
    const existing = index === -1 ? null : entries[index];
    const next = normalize({
      id: entry.id,
      title: entry.title,
      subtitle: entry.subtitle,
      story: entry.story,
      createdAt: existing ? existing.createdAt : (entry.createdAt || now),
      updatedAt: now
    });
    if (index === -1) {
      entries.unshift(next);
    } else {
      entries[index] = next;
    }
    return writeAll(entries) ? copy(next) : null;
  }

  // Returns the removed entry and its position (for restore), or null
  function remove(id) {
    const entries = readAll();
    const index = entries.findIndex(item => item.id === id);
    if (index === -1) return null;
    const removed = entries.splice(index, 1)[0];
    if (!writeAll(entries)) return null;
    if (getItem(ACTIVE_KEY) === id) removeItem(ACTIVE_KEY);
    return { entry: copy(removed), index };
  }

  // Put a removed entry back exactly as it was (undo)
  function restore(entry, index) {
    if (!entry || !entry.id) return null;
    const entries = readAll();
    if (entries.some(item => item.id === entry.id)) return get(entry.id);
    const restored = normalize(entry);
    const at = Math.max(0, Math.min(Number(index) || 0, entries.length));
    entries.splice(at, 0, restored);
    return writeAll(entries) ? copy(restored) : null;
  }

  function getActiveId() {
    readAll(); // runs the first-use migration, which may set the active id
    return getItem(ACTIVE_KEY) || null;
  }

  function setActiveId(id) {
    if (writesBlocked) return;
    if (id) {
      setItem(ACTIVE_KEY, id);
    } else {
      removeItem(ACTIVE_KEY);
    }
  }

  function canSave() {
    return !writesBlocked;
  }

  return {
    list,
    get,
    save,
    remove,
    restore,
    getActiveId,
    setActiveId,
    canSave
  };
})();
