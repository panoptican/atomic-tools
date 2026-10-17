// Reveal Module — plays the finished story back by itself, one sentence at a time
const Reveal = (function() {
  // Reading pace for auto-advance: a pause per sentence plus time per word
  const BASE_DELAY = 1000;
  const PER_WORD_DELAY = 300;
  const MIN_DELAY = 2000;
  const MAX_DELAY = 10000;
  // Gap after read-aloud finishes a sentence, and a fallback in case the
  // speech engine never reports that it finished
  const AFTER_SPEECH_DELAY = 400;
  const SPEECH_FALLBACK_DELAY = 20000;

  let outputEl;
  let stepControlsEl;
  let doneActionsEl;
  let progressEl;
  let pauseBtn;
  let showAllBtn;
  let readAloudBtn;

  let steps = [];       // step <span> elements in reading order
  let stepTexts = [];   // plain text of each step, for read-aloud and pacing
  let shown = 0;
  let readAloud = false;
  let paused = false;
  let active = false;
  let timer = null;
  let speechGeneration = 0; // bumps on cancel so stale "end" events are ignored
  let pendingSpeech = 0;    // utterances queued in the current generation

  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let onDone = null;    // called once when the last sentence appears

  // Render the story with every step hidden, ready to play back
  function render(result) {
    stepTexts = [];
    let stepIndex = 0;

    const html = result.paragraphs.map(paragraph => {
      const inner = paragraph.map((step, i) => {
        const pieces = step.runs.map(run => {
          if (run.text !== undefined) return escapeHtml(run.text);
          // Tapping a word shows what was asked: the question if there was one
          const asked = escapeHtml(run.question || run.type);
          return `<button type="button" class="story-word" aria-pressed="false" title="${asked}">` +
            `<span class="story-word-text">${escapeHtml(run.answer)}</span>` +
            `<span class="story-word-type">${asked}</span>` +
            `</button>`;
        }).join('');
        stepTexts.push(step.text);
        // Line breaks live inside the step so hidden steps don't leave blank lines
        const br = step.lineBreakBefore ? '<br>' : '';
        return `${i > 0 && !br ? ' ' : ''}<span class="story-step" data-step="${stepIndex++}">${br}${pieces}</span>`;
      }).join('');
      return `<p>${inner}</p>`;
    }).join('');

    outputEl.innerHTML = html;
    steps = Array.from(outputEl.querySelectorAll('.story-step'));
  }

  function delayFor(text) {
    const words = text ? text.split(/\s+/).length : 0;
    return Math.min(MAX_DELAY, Math.max(MIN_DELAY, BASE_DELAY + words * PER_WORD_DELAY));
  }

  function speak(text) {
    if (!canSpeak || !readAloud || !text) return;
    const generation = speechGeneration;
    const utterance = new SpeechSynthesisUtterance(text);
    pendingSpeech++;
    utterance.onend = utterance.onerror = () => {
      if (generation !== speechGeneration) return;
      pendingSpeech = Math.max(0, pendingSpeech - 1);
      if (pendingSpeech === 0) scheduleNext();
    };
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    speechGeneration++;
    pendingSpeech = 0;
    if (canSpeak) window.speechSynthesis.cancel();
  }

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  // Queue the next sentence. While read-aloud is speaking, wait for it to finish.
  function scheduleNext() {
    clearTimer();
    if (!active || paused || shown >= steps.length) return;
    if (pendingSpeech > 0) {
      timer = setTimeout(next, SPEECH_FALLBACK_DELAY);
      return;
    }
    const delay = readAloud && canSpeak ? AFTER_SPEECH_DELAY : delayFor(stepTexts[shown - 1]);
    timer = setTimeout(next, delay);
  }

  function updateControls() {
    const done = shown >= steps.length;
    outputEl.classList.toggle('is-stepping', !done);
    stepControlsEl.hidden = done;
    doneActionsEl.hidden = !done;
    progressEl.textContent = `${shown} of ${steps.length}`;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    pauseBtn.setAttribute('aria-pressed', String(paused));
  }

  // Reveal steps up to (but not including) index `count`
  function showUpTo(count) {
    const from = shown;
    shown = Math.min(count, steps.length);
    for (let i = from; i < shown; i++) {
      steps[i].classList.add('is-shown', 'is-entering');
      steps[i].parentElement.classList.add('is-shown');
      speak(stepTexts[i]);
    }

    // The step controls are about to hide; don't strand keyboard focus on them
    const focusWasOnControls = stepControlsEl.contains(document.activeElement);
    updateControls();
    if (shown >= steps.length && focusWasOnControls) {
      const first = doneActionsEl.querySelector('button:not([hidden])');
      if (first) first.focus({ preventScroll: true });
    }
    if (shown >= steps.length && onDone) {
      const done = onDone;
      onDone = null;
      done();
    }

    // Keep the newest sentence and the controls in view as the story grows
    if (shown > from) {
      const target = shown >= steps.length ? doneActionsEl : stepControlsEl;
      target.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
    }
    scheduleNext();
  }

  function next() {
    if (shown < steps.length) showUpTo(shown + 1);
  }

  function showAll() {
    showUpTo(steps.length);
  }

  function togglePause() {
    paused = !paused;
    updateControls();
    if (paused) {
      clearTimer();
    } else {
      scheduleNext();
    }
  }

  // Start (or restart) the reveal from a MadlibFormat.finish() result.
  // A one-sentence story just appears. `done` runs once the whole story is shown.
  function start(result, done) {
    clearTimer();
    stopSpeaking();
    onDone = done || null;
    render(result);
    active = true;
    paused = false;
    shown = 0;
    updateControls();
    if (steps.length <= 1) {
      showAll();
    } else {
      showUpTo(1);
      pauseBtn.focus({ preventScroll: true });
    }
  }

  function stop() {
    active = false;
    onDone = null;
    clearTimer();
    stopSpeaking();
  }

  function toggleReadAloud() {
    readAloud = !readAloud;
    readAloudBtn.setAttribute('aria-pressed', String(readAloud));
    readAloudBtn.classList.toggle('active', readAloud);
    stopSpeaking();
    if (readAloud) {
      // Read what's on screen: the latest sentence while playing, everything when done
      if (shown >= steps.length) stepTexts.forEach(speak);
      else if (shown > 0) speak(stepTexts[shown - 1]);
    }
    scheduleNext();
  }

  // Skip ahead to the next sentence without waiting
  function skip() {
    if (shown >= steps.length) return;
    stopSpeaking();
    next();
  }

  function handleOutputClick(e) {
    const word = e.target.closest('.story-word');
    if (word) {
      // Tap a word to see what was asked for
      const open = word.getAttribute('aria-pressed') !== 'true';
      word.setAttribute('aria-pressed', String(open));
      word.classList.toggle('is-open', open);
      return;
    }
    // Tap the story to skip ahead
    skip();
  }

  function handleKeydown(e) {
    if (!active || shown >= steps.length) return;
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      skip();
    }
  }

  function init() {
    outputEl = document.getElementById('story-output');
    stepControlsEl = document.getElementById('reveal-step-controls');
    doneActionsEl = document.getElementById('reveal-actions');
    progressEl = document.getElementById('reveal-progress');
    pauseBtn = document.getElementById('reveal-pause-btn');
    showAllBtn = document.getElementById('reveal-all-btn');
    readAloudBtn = document.getElementById('read-aloud-btn');

    outputEl.addEventListener('click', handleOutputClick);
    outputEl.addEventListener('animationend', e => e.target.classList.remove('is-entering'));
    pauseBtn.addEventListener('click', togglePause);
    showAllBtn.addEventListener('click', () => {
      stopSpeaking();
      showAll();
    });
    document.addEventListener('keydown', handleKeydown);

    if (canSpeak) {
      readAloudBtn.addEventListener('click', toggleReadAloud);
    } else {
      readAloudBtn.hidden = true;
    }
  }

  return { init, start, stop };
})();
