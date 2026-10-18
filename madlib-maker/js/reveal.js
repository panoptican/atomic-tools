// Reveal Module — shows the finished story all at once, with optional read-aloud
const Reveal = (function() {
  let outputEl;
  let doneActionsEl;
  let readAloudBtn;

  let stepTexts = [];   // plain text of each sentence, for read-aloud
  let readAloud = false;

  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Render the whole story, with one entrance for all of it
  function render(result) {
    stepTexts = [];

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
        const br = step.lineBreakBefore ? '<br>' : '';
        return `${i > 0 && !br ? ' ' : ''}<span class="story-step is-entering">${br}${pieces}</span>`;
      }).join('');
      return `<p>${inner}</p>`;
    }).join('');

    outputEl.innerHTML = html;
  }

  function speakAll() {
    if (!canSpeak || !readAloud) return;
    stepTexts.forEach(text => {
      if (text) window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    });
  }

  function stopSpeaking() {
    if (canSpeak) window.speechSynthesis.cancel();
  }

  // Show the story from a MadlibFormat.finish() result. `done` runs right
  // after, since the whole story is on screen at once.
  function start(result, done) {
    stopSpeaking();
    render(result);
    doneActionsEl.hidden = false;
    speakAll();
    if (done) done();
  }

  function stop() {
    stopSpeaking();
  }

  function toggleReadAloud() {
    readAloud = !readAloud;
    readAloudBtn.setAttribute('aria-pressed', String(readAloud));
    readAloudBtn.classList.toggle('active', readAloud);
    stopSpeaking();
    speakAll();
  }

  // Tap a word to see what was asked for
  function handleOutputClick(e) {
    const word = e.target.closest('.story-word');
    if (!word) return;
    const open = word.getAttribute('aria-pressed') !== 'true';
    word.setAttribute('aria-pressed', String(open));
    word.classList.toggle('is-open', open);
  }

  function init() {
    outputEl = document.getElementById('story-output');
    doneActionsEl = document.getElementById('reveal-actions');
    readAloudBtn = document.getElementById('read-aloud-btn');

    outputEl.addEventListener('click', handleOutputClick);
    outputEl.addEventListener('animationend', e => e.target.classList.remove('is-entering'));

    if (canSpeak) {
      readAloudBtn.addEventListener('click', toggleReadAloud);
    } else {
      readAloudBtn.hidden = true;
    }
  }

  return { init, start, stop };
})();
