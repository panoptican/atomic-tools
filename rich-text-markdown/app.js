/**
 * Markdown ↔ Rich Text — UI wiring (uses RtmConverter).
 */
(function () {
  'use strict';

  var C = window.RtmConverter;
  var convertersReady = C && C.ready();

  var state = {
    direction: null,
    outputMarkdown: '',
    outputHtml: '',
    copyStatus: 'idle'
  };
  var statusTimeout = null;
  var typingTimeout = null;

  var inputArea = document.getElementById('inputArea');
  var clearBtn = document.getElementById('clearBtn');
  var directionBadge = document.getElementById('directionBadge');
  var badgeText = document.getElementById('badgeText');
  var swapHint = document.getElementById('swapHint');
  var outputSection = document.getElementById('outputSection');
  var outputLabel = document.getElementById('outputLabel');
  var outputBox = document.getElementById('outputBox');
  var hintText = document.getElementById('hintText');
  var statusNote = document.getElementById('statusNote');

  var BADGE_ICONS = {
    hash: 'badgeIconHash',
    type: 'badgeIconType',
    check: 'badgeIconCheck',
    error: 'badgeIconError',
    swap: 'badgeIconSwap'
  };

  function hideAllBadgeIcons() {
    Object.keys(BADGE_ICONS).forEach(function (key) {
      document.getElementById(BADGE_ICONS[key]).classList.add('hidden');
    });
  }

  function showBadgeIcon(name) {
    document.getElementById(BADGE_ICONS[name]).classList.remove('hidden');
  }

  function updateBadge() {
    hideAllBadgeIcons();
    directionBadge.className = 'direction-badge';
    directionBadge.removeAttribute('data-interactive');
    swapHint.classList.add('hidden');

    if (state.copyStatus === 'error') {
      directionBadge.classList.add('error');
      showBadgeIcon('error');
      badgeText.textContent = 'Copy failed \u2014 tap to retry';
      directionBadge.setAttribute('data-interactive', '');
      directionBadge.setAttribute('aria-label', 'Copy failed. Click to retry.');
      return;
    }

    if (state.copyStatus === 'copied') {
      directionBadge.classList.add('copied');
      showBadgeIcon('check');
      badgeText.textContent = 'Copied to clipboard';
      return;
    }

    if (state.direction === 'html-to-md') {
      directionBadge.classList.add('active');
      directionBadge.setAttribute('data-interactive', '');
      swapHint.classList.remove('hidden');
      showBadgeIcon('hash');
      showBadgeIcon('swap');
      badgeText.textContent = 'Rich Text \u2192 Markdown';
      directionBadge.setAttribute(
        'aria-label',
        'Rich Text to Markdown. Click to swap to Markdown editing.'
      );
      return;
    }

    if (state.direction === 'md-to-html') {
      directionBadge.classList.add('active');
      showBadgeIcon('type');
      badgeText.textContent = 'Markdown \u2192 Rich Text';
      directionBadge.setAttribute('aria-label', 'Markdown to Rich Text.');
      return;
    }

    directionBadge.classList.add('idle');
    badgeText.textContent = 'Paste or type to begin';
    directionBadge.setAttribute('aria-label', 'Conversion direction. Paste or type to begin.');
  }

  function updateOutput() {
    var hasOutput =
      state.direction === 'html-to-md' ? !!state.outputMarkdown : !!state.outputHtml;
    clearBtn.classList.toggle('hidden', !inputArea.value);
    outputSection.classList.toggle('hidden', !hasOutput);
    hintText.classList.toggle('hidden', hasOutput || !convertersReady);
    statusNote.classList.toggle('hidden', convertersReady);
    if (!convertersReady) {
      statusNote.textContent =
        'Conversion libraries are unavailable. Reload when you are back online.';
    }

    if (hasOutput) {
      if (state.direction === 'html-to-md') {
        outputLabel.textContent = 'Markdown';
        outputBox.className = 'output-box';
        outputBox.textContent = state.outputMarkdown;
      } else {
        outputLabel.textContent = 'Rich Text';
        outputBox.className = 'output-box preview-content';
        outputBox.innerHTML = state.outputHtml;
      }
    }
    updateBadge();
  }

  function showConversionError(message) {
    state.outputMarkdown = '';
    state.outputHtml = '';
    state.copyStatus = 'error';
    statusNote.textContent =
      message || 'Conversion failed. Clear the input or try a smaller paste.';
    statusNote.classList.remove('hidden');
    outputSection.classList.add('hidden');
    hintText.classList.add('hidden');
    updateBadge();
  }

  async function autoCopy(dir, mdResult, htmlResult) {
    var ok = false;
    if (dir === 'html-to-md' && mdResult) ok = await C.copyMd(mdResult);
    else if (dir === 'md-to-html' && htmlResult) ok = await C.copyRich(htmlResult);

    state.copyStatus = ok ? 'copied' : 'error';
    updateBadge();

    if (statusTimeout) clearTimeout(statusTimeout);
    statusTimeout = setTimeout(function () {
      state.copyStatus = 'idle';
      updateBadge();
    }, 2500);
  }

  async function manualCopy() {
    await autoCopy(state.direction, state.outputMarkdown, state.outputHtml);
  }

  function clearAll() {
    inputArea.value = '';
    state.direction = null;
    state.outputMarkdown = '';
    state.outputHtml = '';
    state.copyStatus = 'idle';
    statusNote.textContent = '';
    updateOutput();
    inputArea.focus();
  }

  window.clearAll = clearAll;
  window.manualCopy = manualCopy;

  function swapDirection() {
    if (state.direction !== 'html-to-md') return;

    var mdText = state.outputMarkdown;
    if (!mdText.trim() || !inputArea.value.trim()) return;

    inputArea.value = mdText;
    state.direction = 'md-to-html';
    try {
      state.outputHtml = C.convertMdToHtml(mdText);
    } catch (err) {
      showConversionError(err.message);
      return;
    }
    state.outputMarkdown = '';
    state.copyStatus = 'idle';
    updateOutput();
    autoCopy('md-to-html', '', state.outputHtml);
    inputArea.focus();
  }

  function onBadgeActivate() {
    if (state.copyStatus === 'error') {
      manualCopy();
      return;
    }
    if (state.direction === 'html-to-md' && inputArea.value.trim()) {
      swapDirection();
    }
  }

  directionBadge.addEventListener('click', function (e) {
    e.preventDefault();
    onBadgeActivate();
  });

  directionBadge.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onBadgeActivate();
    }
  });

  inputArea.addEventListener('paste', function (e) {
    if (!convertersReady) {
      showConversionError('Conversion libraries are unavailable. Reload when you are back online.');
      return;
    }
    var htmlData = e.clipboardData.getData('text/html');
    var textData = e.clipboardData.getData('text/plain');
    var det = C.detectDirection(htmlData, textData);

    if (det === 'html-to-md' && htmlData) {
      e.preventDefault();
      inputArea.value = htmlData;
      state.direction = det;
      try {
        state.outputMarkdown = C.convertHtmlToMd(htmlData);
      } catch (err) {
        showConversionError(err.message);
        return;
      }
      state.outputHtml = '';
      state.copyStatus = 'idle';
      updateOutput();
      autoCopy(det, state.outputMarkdown, '');
    } else if (det === 'md-to-html' && textData) {
      e.preventDefault();
      inputArea.value = textData;
      state.direction = det;
      try {
        state.outputHtml = C.convertMdToHtml(textData);
      } catch (err) {
        showConversionError(err.message);
        return;
      }
      state.outputMarkdown = '';
      state.copyStatus = 'idle';
      updateOutput();
      autoCopy(det, '', state.outputHtml);
    }
  });

  inputArea.addEventListener('input', function () {
    if (!convertersReady) {
      showConversionError('Conversion libraries are unavailable. Reload when you are back online.');
      return;
    }
    var val = inputArea.value;
    var dir = state.direction || 'md-to-html';
    if (!state.direction) state.direction = dir;

    if (!val.trim()) {
      state.outputMarkdown = '';
      state.outputHtml = '';
      state.copyStatus = 'idle';
      updateOutput();
      return;
    }

    if (dir === 'html-to-md') {
      try {
        state.outputMarkdown = C.convertHtmlToMd(val);
      } catch (err) {
        showConversionError(err.message);
        return;
      }
      state.outputHtml = '';
    } else {
      try {
        state.outputHtml = C.convertMdToHtml(val);
      } catch (err) {
        showConversionError(err.message);
        return;
      }
      state.outputMarkdown = '';
    }
    state.copyStatus = 'idle';
    updateOutput();

    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(function () {
      try {
        if (dir === 'html-to-md') autoCopy(dir, C.convertHtmlToMd(val), '');
        else autoCopy(dir, '', C.convertMdToHtml(val));
      } catch (err) {
        showConversionError(err.message);
      }
    }, 600);
  });

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      manualCopy();
    }
  });

  AtomicTheme.bind({
    storageKey: 'rtm-theme',
    mode: 'class',
    className: 'dark',
    toggleId: 'themeToggle'
  });

  updateOutput();
})();
