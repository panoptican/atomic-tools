/**
 * Shared light/dark theme for Atomic Tools pages.
 * mode: "dataset" sets documentElement.dataset.theme ("light"|"dark")
 * mode: "class" toggles a class on documentElement (default "dark")
 */
(function (global) {
  'use strict';

  function readStored(storageKey) {
    try {
      return localStorage.getItem(storageKey);
    } catch (e) {
      return null;
    }
  }

  function systemPrefersDark() {
    return global.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function resolveTheme(storageKey) {
    var stored = readStored(storageKey);
    if (stored === 'dark' || stored === 'light') return stored;
    return systemPrefersDark() ? 'dark' : 'light';
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
    applyTheme(resolveTheme(options.storageKey), options);
  }

  function bind(options) {
    var toggle = document.getElementById(options.toggleId);
    if (!toggle) return;

    function syncToggleLabel() {
      var dark = isDark(options);
      var label = dark ? 'Switch to light mode' : 'Switch to dark mode';
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('title', label);
      if (options.onChange) options.onChange(dark);
    }

    syncToggleLabel();

    toggle.addEventListener('click', function () {
      var next = isDark(options) ? 'light' : 'dark';
      applyTheme(next, options);
      try {
        localStorage.setItem(options.storageKey, next);
      } catch (e) {}
      syncToggleLabel();
    });

    global.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (readStored(options.storageKey)) return;
      applyTheme(e.matches ? 'dark' : 'light', options);
      syncToggleLabel();
    });
  }

  global.AtomicTheme = {
    applyBeforePaint: applyBeforePaint,
    bind: bind,
    isDark: isDark
  };
})(window);
