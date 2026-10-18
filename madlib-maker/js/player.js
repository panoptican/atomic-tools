// Player Mode Module
const PlayerMode = (function() {
  const UNTITLED = 'Untitled madlib';

  // State
  let prompts = [];
  let story = '';
  let title = '';
  let subtitle = '';
  let answers = {};
  let inputMode = 'sequential'; // 'sequential' or 'all-at-once'
  let currentPromptIndex = 0;
  let isActive = false;
  let isPreviewMode = false;

  // DOM Elements
  let creatorEl;
  let playerContainerEl;
  let introScreen;
  let sequentialScreen;
  let allAtOnceScreen;
  let revealScreen;

  // Intro screen elements
  let titleEl;
  let subtitleEl;
  let toggleBtns;
  let startBtn;

  // Sequential screen elements
  let progressEl;
  let labelEl;
  let inputEl;
  let prevBtn;
  let nextBtn;

  // All-at-once screen elements
  let formEl;
  let submitBtn;

  // Reveal screen elements
  let revealTitleEl;
  let copyBtn;
  let shareStoryBtn;
  let replayBtn;
  let playAgainBtn;
  let createOwnBtn;

  // Show a specific screen, hide others
  function showScreen(screenName) {
    introScreen.style.display = screenName === 'intro' ? 'flex' : 'none';
    sequentialScreen.style.display = screenName === 'sequential' ? 'flex' : 'none';
    allAtOnceScreen.style.display = screenName === 'all-at-once' ? 'flex' : 'none';
    revealScreen.style.display = screenName === 'reveal' ? 'flex' : 'none';
    if (screenName !== 'reveal') Reveal.stop();
  }

  // Update intro screen with title and subtitle
  function renderIntro() {
    titleEl.textContent = title || UNTITLED;
    subtitleEl.textContent = subtitle || '';

    // Update page title
    document.title = title || UNTITLED;
  }

  // Update toggle button states
  function updateToggleButtons() {
    toggleBtns.forEach(btn => {
      if (btn.dataset.mode === inputMode) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  }

  // Placeholder for an answer field: questions get a neutral one
  function placeholderFor(prompt) {
    return prompt.question ? 'Your answer…' : `Enter ${withArticle(prompt.type)}…`;
  }

  // Render current prompt in sequential mode
  function renderSequentialPrompt() {
    if (prompts.length === 0) return;

    const current = prompts[currentPromptIndex];
    progressEl.textContent = `${currentPromptIndex + 1} of ${prompts.length}`;
    labelEl.textContent = MadlibFormat.promptText(current);
    labelEl.classList.toggle('is-question', !!current.question);
    inputEl.placeholder = placeholderFor(current);
    inputEl.value = answers[current.key] || '';

    // Update navigation buttons
    prevBtn.disabled = currentPromptIndex === 0;

    // Change next button text on last prompt
    if (currentPromptIndex === prompts.length - 1) {
      nextBtn.textContent = 'See my story';
    } else {
      nextBtn.textContent = 'Next';
    }

    // Focus input
    inputEl.focus();
  }

  // Render all-at-once form
  function renderAllAtOnceForm() {
    formEl.innerHTML = '';

    prompts.forEach((prompt, i) => {
      const fieldDiv = document.createElement('div');
      fieldDiv.className = 'form-field';

      const inputId = `input-${i}`;
      const label = document.createElement('label');
      label.setAttribute('for', inputId);
      label.innerHTML = `<span class="form-field-num">${i + 1}</span> ${escapeHtml(MadlibFormat.promptText(prompt))}`;

      const input = document.createElement('input');
      input.type = 'text';
      input.id = inputId;
      input.dataset.key = prompt.key;
      input.placeholder = placeholderFor(prompt);
      input.autocomplete = 'off';
      input.value = answers[prompt.key] || '';

      // Sync answer on input
      input.addEventListener('input', () => {
        answers[prompt.key] = input.value;
      });

      fieldDiv.appendChild(label);
      fieldDiv.appendChild(input);
      formEl.appendChild(fieldDiv);

      // "Stuck?" suggestions (js/suggest.js)
      if (typeof MadlibSuggest !== 'undefined') MadlibSuggest.attach(input, () => prompt);
    });
  }

  // The finished madlib as features consume it (see MadlibFormat.finish)
  function getResult() {
    return MadlibFormat.finish({ title, subtitle, story, answers });
  }

  // Play the story back. `source` says how the reveal started:
  // 'play' (a player link), 'preview' (the creator testing), 'story' (a story link)
  // or 'replay'. When the whole story is shown, a `madlib:revealdone` event fires
  // on document with { result, source }.
  function showReveal(source) {
    revealTitleEl.textContent = title || UNTITLED;
    showScreen('reveal');
    const result = getResult();
    Reveal.start(result, () => {
      document.dispatchEvent(new CustomEvent('madlib:revealdone', { detail: { result, source } }));
    });
  }

  function freshSource() {
    return isPreviewMode ? 'preview' : 'play';
  }

  // Handle start button click
  function handleStart() {
    if (prompts.length === 0) {
      URLManager.showToast('This madlib has no blanks to fill. Ask whoever sent it for a new link.', true);
      return;
    }

    if (inputMode === 'sequential') {
      currentPromptIndex = 0;
      showScreen('sequential');
      renderSequentialPrompt();
    } else {
      renderAllAtOnceForm();
      showScreen('all-at-once');
      // Focus first input
      const firstInput = formEl.querySelector('input');
      if (firstInput) firstInput.focus();
    }
  }

  // Handle toggle button click
  function handleToggle(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode) {
      inputMode = mode;
      updateToggleButtons();
    }
  }

  // Handle next button in sequential mode
  function handleNext() {
    // Save current answer
    const current = prompts[currentPromptIndex];
    answers[current.key] = inputEl.value;

    if (currentPromptIndex < prompts.length - 1) {
      currentPromptIndex++;
      renderSequentialPrompt();
    } else {
      showReveal(freshSource());
    }
  }

  // Handle prev button in sequential mode
  function handlePrev() {
    // Save current answer
    const current = prompts[currentPromptIndex];
    answers[current.key] = inputEl.value;

    if (currentPromptIndex > 0) {
      currentPromptIndex--;
      renderSequentialPrompt();
    }
  }

  // Handle enter key in sequential mode
  function handleInputKeydown(e) {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      handleNext();
    }
  }

  // Handle submit all button
  function handleSubmitAll() {
    // Collect all answers from form inputs
    formEl.querySelectorAll('input').forEach(input => {
      answers[input.dataset.key] = input.value;
    });

    showReveal(freshSource());
  }

  // Handle copy story button
  async function handleCopyStory() {
    const success = await URLManager.copyToClipboard(getResult().plainText);
    if (success) {
      URLManager.showToast('Story copied');
    } else {
      URLManager.showToast("Couldn’t copy the story. Select the text and copy it instead.", true);
    }
  }

  // Handle share story link button
  async function handleShareStoryLink() {
    const dataToShare = {
      v: MadlibFormat.VERSION,
      title,
      subtitle,
      story,
      answers
    };
    const url = await URLManager.generateStoryURL(dataToShare);
    if (!url) {
      URLManager.showToast("Couldn’t make the story link. Try again, or use Copy story instead.", true);
      return;
    }

    // js/share.js offers the phone's share sheet; otherwise copy the link
    if (typeof MadlibShare !== 'undefined') {
      await MadlibShare.shareLink({ url, title: title || UNTITLED, text: 'Read my madlib' });
      return;
    }
    const success = await URLManager.copyToClipboard(url);
    if (success) {
      URLManager.showToast('Story link copied');
    } else {
      URLManager.showToast("Couldn’t copy the story link. Try again, or use Copy story instead.", true);
    }
  }

  // Handle play again button
  function handlePlayAgain() {
    // Reset answers but keep the story
    answers = {};
    currentPromptIndex = 0;

    // Go back to intro; the clicked button is now hidden, so focus Start
    renderIntro();
    showScreen('intro');
    startBtn.focus();
  }

  function handleCreateOwn() {
    // Navigate to creator mode with a fresh madlib
    window.location.href = window.location.pathname;
  }

  // Activate player mode with data
  // isPreview: if true, don't hide the creator container (ModeManager handles that)
  // isStoryView: if true, show completed story directly (for #story= URLs)
  function activate(rawData, isPreview = false, isStoryView = false) {
    const data = MadlibFormat.migrate(rawData);
    if (!data) return false;

    // Store data
    story = data.story || '';
    prompts = MadlibFormat.parse(story).prompts;
    title = data.title || '';
    subtitle = data.subtitle || '';
    answers = data.answers ? { ...data.answers } : {};
    currentPromptIndex = 0;
    isActive = true;
    isPreviewMode = isPreview;

    ColorThemeManager.clear();

    // For preview mode, don't hide the container (ModeManager handles section visibility)
    if (!isPreview) {
      creatorEl.style.display = 'none';
    }
    playerContainerEl.style.display = 'flex';
    // A creator's preview sits on a sheet of paper; player links stay bare
    playerContainerEl.classList.toggle('is-preview', isPreview);

    // If story view mode, play the completed story back
    if (isStoryView && data.answers) {
      document.title = title || UNTITLED;
      showReveal('story');
    } else {
      // Otherwise show intro screen for interactive play
      renderIntro();
      showScreen('intro');
    }

    return true;
  }

  // Deactivate player mode
  function deactivate() {
    isActive = false;
    Reveal.stop();
    playerContainerEl.style.display = 'none';
    creatorEl.style.display = '';

    // Reset player state for next activation
    answers = {};
    currentPromptIndex = 0;
  }

  // Initialize
  function init() {
    // Get main containers
    creatorEl = document.querySelector('.container');
    playerContainerEl = document.getElementById('player-container');
    // Get screens
    introScreen = document.getElementById('player-intro');
    sequentialScreen = document.getElementById('player-sequential');
    allAtOnceScreen = document.getElementById('player-all-at-once');
    revealScreen = document.getElementById('player-reveal');

    // Get intro elements
    titleEl = document.getElementById('player-title');
    subtitleEl = document.getElementById('player-subtitle');
    toggleBtns = document.querySelectorAll('.player-tab');
    startBtn = document.getElementById('start-btn');

    // Get sequential elements
    progressEl = document.getElementById('prompt-progress');
    labelEl = document.getElementById('prompt-label');
    inputEl = document.getElementById('prompt-input');
    prevBtn = document.getElementById('prev-btn');
    nextBtn = document.getElementById('next-btn');

    // Get all-at-once elements
    formEl = document.getElementById('all-inputs-form');
    submitBtn = document.getElementById('submit-all-btn');

    // Get reveal elements
    revealTitleEl = document.getElementById('reveal-title');
    copyBtn = document.getElementById('copy-story-btn');
    shareStoryBtn = document.getElementById('share-story-btn');
    replayBtn = document.getElementById('replay-btn');
    playAgainBtn = document.getElementById('play-again-btn');
    createOwnBtn = document.getElementById('create-own-btn');

    Reveal.init();

    // Set up event listeners
    startBtn.addEventListener('click', handleStart);

    toggleBtns.forEach(btn => {
      btn.addEventListener('click', handleToggle);
    });

    prevBtn.addEventListener('click', handlePrev);
    nextBtn.addEventListener('click', handleNext);
    inputEl.addEventListener('keydown', handleInputKeydown);
    if (typeof MadlibSuggest !== 'undefined') {
      MadlibSuggest.attach(inputEl, () => prompts[currentPromptIndex]);
    }

    submitBtn.addEventListener('click', handleSubmitAll);

    copyBtn.addEventListener('click', handleCopyStory);
    shareStoryBtn.addEventListener('click', handleShareStoryLink);
    replayBtn.addEventListener('click', () => showReveal('replay'));
    playAgainBtn.addEventListener('click', handlePlayAgain);
    createOwnBtn.addEventListener('click', handleCreateOwn);
  }

  // Public API
  return {
    init,
    activate,
    deactivate,
    getResult,
    isActive: () => isActive
  };
})();
