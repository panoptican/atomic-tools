/**
 * Shared light/dark theme for Atomic Tools pages.
 * mode: "dataset" sets documentElement.dataset.theme ("light"|"dark")
 * mode: "class" toggles a class on documentElement (default "dark")
 *
 * Every page stores the choice under one key so it follows you between tools.
 * options.storageKey is the page's old per-tool key, read once as a fallback so
 * nobody loses a choice made before the theme was shared.
 */
(function (global) {
  'use strict';

  var SHARED_KEY = 'atomic-tools-theme';

  function getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  }

  function isTheme(value) {
    return value === 'dark' || value === 'light';
  }

  function readStored(legacyKey) {
    var stored = getItem(SHARED_KEY);
    if (isTheme(stored)) return stored;
    var legacy = legacyKey ? getItem(legacyKey) : null;
    if (isTheme(legacy)) {
      setItem(SHARED_KEY, legacy);
      return legacy;
    }
    return null;
  }

  function systemPrefersDark() {
    return global.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function resolveTheme(options) {
    return readStored(options.storageKey) || (systemPrefersDark() ? 'dark' : 'light');
  }

  function applyTheme(theme, options) {
    var root = document.documentElement;
    if (options.mode === 'class') {
      root.classList.toggle(options.className || 'dark', theme === 'dark');
      return;
    }
    root.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  }

  function isDark(options) {
    if (options.mode === 'class') {
      return document.documentElement.classList.contains(options.className || 'dark');
    }
    return document.documentElement.dataset.theme === 'dark';
  }

  function applyBeforePaint(options) {
    applyTheme(resolveTheme(options || {}), options || {});
  }

  /* Pages without a toggle (index, 404, Nothing) still call bind so they follow
     the system theme live; the toggle wiring is skipped when there is none. */
  function bind(options) {
    var toggle = options.toggleId ? document.getElementById(options.toggleId) : null;

    function syncToggleLabel() {
      var dark = isDark(options);
      if (toggle) {
        var label = dark ? 'Switch to light mode' : 'Switch to dark mode';
        toggle.setAttribute('aria-label', label);
        toggle.setAttribute('title', label);
      }
      if (options.onChange) options.onChange(dark);
    }

    syncToggleLabel();

    if (toggle) {
      toggle.addEventListener('click', function () {
        var next = isDark(options) ? 'light' : 'dark';
        applyTheme(next, options);
        setItem(SHARED_KEY, next);
        syncToggleLabel();
      });
    }

    global.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (readStored(options.storageKey)) return;
      applyTheme(e.matches ? 'dark' : 'light', options);
      syncToggleLabel();
    });

    // Another tab changed the theme: match it.
    global.addEventListener('storage', function (e) {
      if (e.key !== SHARED_KEY || !isTheme(e.newValue)) return;
      applyTheme(e.newValue, options);
      syncToggleLabel();
    });
  }

  global.AtomicTheme = {
    applyBeforePaint: applyBeforePaint,
    bind: bind,
    isDark: isDark
  };
})(window);
