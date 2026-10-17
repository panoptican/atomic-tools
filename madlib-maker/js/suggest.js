// Suggest Module: a "Stuck?" dice button that fills an answer field with a random word
const MadlibSuggest = (function() {
  // Kid-friendly word bank, keyed by normalised prompt type. No articles, so
  // "a {place}" and "the {place}" both read fine.
  const WORDS = {
    'noun': ['banana', 'spaceship', 'pickle', 'sock', 'waffle', 'rainbow', 'bathtub', 'pillow', 'dinosaur', 'trampoline', 'teapot', 'doorknob', 'noodle', 'moon', 'bubble', 'cupcake', 'flashlight', 'potato', 'wig', 'kazoo', 'toaster'],
    'plural noun': ['pickles', 'socks', 'waffles', 'rainbows', 'bathtubs', 'pillows', 'dinosaurs', 'trampolines', 'teapots', 'noodles', 'bubbles', 'cupcakes', 'potatoes', 'wigs', 'kazoos', 'toasters', 'hamsters', 'giraffes', 'spoons', 'marshmallows', 'sandwiches', 'robots'],
    'verb': ['tickle', 'wiggle', 'juggle', 'bounce', 'hiccup', 'sneeze', 'giggle', 'flip', 'boogie', 'dance', 'pounce', 'wobble', 'slurp', 'zoom', 'hop', 'spin', 'twirl', 'snore', 'squeak', 'gobble', 'burp', 'stomp', 'wave', 'tiptoe'],
    'verb ing': ['tickling', 'wiggling', 'juggling', 'bouncing', 'hiccuping', 'sneezing', 'giggling', 'flipping', 'dancing', 'pouncing', 'wobbling', 'slurping', 'zooming', 'hopping', 'spinning', 'twirling', 'snoring', 'squeaking', 'gobbling', 'burping', 'stomping', 'waving', 'tiptoeing', 'skipping'],
    'past tense verb': ['tickled', 'wiggled', 'juggled', 'bounced', 'hiccuped', 'sneezed', 'giggled', 'flipped', 'boogied', 'danced', 'pounced', 'wobbled', 'slurped', 'zoomed', 'hopped', 'spun', 'twirled', 'snored', 'squeaked', 'gobbled', 'burped', 'stomped', 'waved', 'tiptoed'],
    'adjective': ['wiggly', 'squishy', 'fluffy', 'sparkly', 'grumpy', 'bouncy', 'soggy', 'ticklish', 'gigantic', 'teeny', 'slimy', 'wobbly', 'fancy', 'crunchy', 'stinky', 'sticky', 'dizzy', 'bumpy', 'jiggly', 'ginormous', 'sneezy', 'crispy', 'glittery'],
    'adverb': ['sneakily', 'loudly', 'backwards', 'gracefully', 'sleepily', 'silently', 'wildly', 'slowly', 'dramatically', 'politely', 'bravely', 'sideways', 'grumpily', 'quickly', 'excitedly', 'carefully', 'proudly', 'suspiciously', 'happily'],
    'name': ['Gerald', 'Waffles', 'Princess Pickle', 'Captain Bubbles', 'Mabel', 'Nugget', 'Zelda', 'Bartholomew', 'Stinky Pete', 'Fifi', 'Doctor Giggles', 'Otis', 'Penelope', 'Sir Sneezes', 'Juniper', 'Rufus', 'Olive', 'Timmy Twinkle', 'Luna', 'Ziggy'],
    'place': ['moon', 'bathtub', 'grocery store', 'zoo', 'volcano', 'school bus', 'castle', 'dentist office', 'birthday party', 'jungle', 'outer space', 'bottom of the pool', 'pizza shop', 'library', 'cereal box', 'attic', 'ice cream truck', 'candy factory', 'playground', 'sandcastle', 'bathroom sink'],
    'animal': ['penguin', 'hippo', 'sloth', 'walrus', 'goose', 'llama', 'octopus', 'flamingo', 'platypus', 'warthog', 'raccoon', 'koala', 'pufferfish', 'hedgehog', 'chicken', 'crocodile', 'camel', 'beaver', 'moose', 'aardvark', 'gorilla', 'narwhal'],
    'food': ['pickles', 'pancakes', 'meatballs', 'spaghetti', 'broccoli', 'jellybeans', 'mashed potatoes', 'tacos', 'pudding', 'ketchup', 'sushi', 'cheese', 'pizza', 'bananas', 'gummy worms', 'waffles', 'popcorn', 'mustard', 'applesauce', 'ice cream', 'cookies'],
    'color': ['purple', 'neon green', 'sparkly gold', 'bright orange', 'lime green', 'hot pink', 'sky blue', 'turquoise', 'magenta', 'chocolate brown', 'bubblegum pink', 'lavender', 'mint green', 'fire engine red', 'banana yellow', 'midnight blue', 'glow in the dark green', 'rainbow'],
    'number': ['seven', 'forty two', 'one hundred', 'nine', 'zillion', 'eleven', 'zero', 'three', 'twelve', 'one million', 'sixty four', 'fourteen', 'two hundred', 'eight', 'ninety nine', 'gazillion', 'one', 'thirty six', 'five', 'twenty'],
    'body part': ['elbow', 'nose', 'knee', 'belly button', 'toe', 'ear', 'eyebrow', 'ankle', 'tummy', 'pinky finger', 'kneecap', 'armpit', 'thumb', 'chin', 'nostril', 'eyelash', 'wrist', 'shin', 'heel', 'tongue', 'earlobe'],
    'exclamation': ['Yikes', 'Wowza', 'Hooray', 'Yippee', 'Whoopsie', 'Gadzooks', 'Abracadabra', 'Bingo', 'Ta da', 'Kaboom', 'Zoinks', 'Woohoo', 'Jeepers', 'Eek', 'Hubba hubba', 'Holy guacamole', 'Bananas', 'Boing', 'Goodness gracious'],
    'sound': ['boing', 'splat', 'honk', 'crunch', 'zoom', 'achoo', 'slurp', 'ribbit', 'meow', 'moo', 'oink', 'kerplunk', 'squeak', 'whoosh', 'bzzzt', 'thwack', 'ploop', 'vroom', 'quack', 'beep', 'glug glug', 'pop', 'snort'],
    'silly word': ['bloop', 'snorkelbop', 'flibberwomp', 'zibbity', 'gribbleflop', 'wobblepop', 'kazoodle', 'sploofy', 'blorpnik', 'nonkabob', 'fizzwuzzle', 'splurgeon', 'snazzlefrump', 'bingadoodle', 'wigglesnort', 'plimpfoot', 'dandeloopy', 'zorpity', 'flumpadoo', 'grumblesnoot', 'boopadoop', 'kablooey'],
    'vehicle': ['tricycle', 'skateboard', 'unicycle', 'scooter', 'hot air balloon', 'bulldozer', 'rocket', 'tractor', 'canoe', 'wheelbarrow', 'submarine', 'go kart', 'fire truck', 'pogo stick', 'roller skates', 'school bus', 'helicopter', 'tugboat', 'steamroller', 'hovercraft', 'shopping cart', 'jet ski', 'monster truck'],
    'job': ['astronaut', 'dentist', 'pirate', 'clown', 'ninja', 'firefighter', 'chef', 'magician', 'wizard', 'mail carrier', 'zookeeper', 'ballerina', 'superhero', 'veterinarian', 'cowboy', 'knight', 'baker', 'beekeeper', 'banana inspector', 'bus driver', 'lifeguard'],
    'emotion': ['giggly', 'grumpy', 'bored', 'jealous', 'sleepy', 'hangry', 'silly', 'confused', 'excited', 'shy', 'surprised', 'dramatic', 'proud', 'nervous', 'cranky', 'joyful', 'bouncy', 'puzzled', 'scared', 'thrilled'],
    'clothing': ['pajamas', 'mittens', 'bow tie', 'cape', 'tutu', 'swim goggles', 'sandals', 'sweater', 'baseball cap', 'rain boots', 'fuzzy slippers', 'tuxedo', 'bathrobe', 'socks', 'bunny ear headband', 'overalls', 'onesie', 'sunglasses', 'unicorn onesie', 'poncho', 'raincoat']
  };

  // Common spellings and phrasings that mean one of the WORDS keys
  const SYNONYMS = {
    'adj': 'adjective',
    'adjectives': 'adjective',
    'describing word': 'adjective',
    'adv': 'adverb',
    'adverbs': 'adverb',
    'nouns': 'noun',
    'plural nouns': 'plural noun',
    'plural': 'plural noun',
    'verbs': 'verb',
    'ing verb': 'verb ing',
    'verb ing form': 'verb ing',
    'verbing': 'verb ing',
    'past verb': 'past tense verb',
    'verb past tense': 'past tense verb',
    'past tense': 'past tense verb',
    'person': 'name',
    'friend': 'name',
    'names': 'name',
    'first name': 'name',
    'proper noun': 'name',
    'colour': 'color',
    'colours': 'color',
    'colors': 'color',
    'animals': 'animal',
    'foods': 'food',
    'places': 'place',
    'numbers': 'number',
    'body parts': 'body part',
    'body': 'body part',
    'exclamations': 'exclamation',
    'sounds': 'sound',
    'silly': 'silly word',
    'silly words': 'silly word',
    'vehicles': 'vehicle',
    'jobs': 'job',
    'occupation': 'job',
    'emotions': 'emotion',
    'feeling': 'emotion',
    'clothes': 'clothing'
  };

  // Used when a type matches nothing else; checked in order, so 'adverb' comes before 'verb'
  const KEYWORDS = [
    ['animal', 'animal'], ['food', 'food'], ['snack', 'food'], ['color', 'color'],
    ['place', 'place'], ['location', 'place'], ['name', 'name'], ['number', 'number'],
    ['body', 'body part'], ['sound', 'sound'], ['exclam', 'exclamation'], ['vehicle', 'vehicle'],
    ['job', 'job'], ['occupation', 'job'], ['emotion', 'emotion'], ['feel', 'emotion'],
    ['cloth', 'clothing'], ['adjective', 'adjective'], ['adverb', 'adverb'], ['verb', 'verb'], ['noun', 'noun']
  ];

  // Turn a free-text prompt type into a WORDS key
  function bankKeyFor(type) {
    const t = String(type || '').toLowerCase()
      .replace(/[^a-z\s-]/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (WORDS[t]) return t;
    if (SYNONYMS[t]) return SYNONYMS[t];

    const words = t.split(' ');
    if (words.includes('plural')) return 'plural noun';
    if (words.includes('verb') && words.includes('ing')) return 'verb ing';
    if (words.includes('verb') && (words.includes('past') || words.includes('tense'))) return 'past tense verb';

    const hit = KEYWORDS.find(([keyword]) => t.includes(keyword));
    return hit ? hit[1] : 'silly word';
  }

  // Random word for the type, never the one we just offered for this field
  function pickWord(type, previous) {
    const choices = WORDS[bankKeyFor(type)].filter(word => word !== previous);
    return choices[Math.floor(Math.random() * choices.length)];
  }

  // Restart the die's roll animation (skipped for reduced motion)
  function roll(button) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    button.classList.remove('is-rolling');
    void button.offsetWidth; // force a reflow so the animation restarts
    button.classList.add('is-rolling');
    button.addEventListener('animationend', () => button.classList.remove('is-rolling'), { once: true });
  }

  function init() {}

  // Add the die button beside an answer input. getPrompt() returns the prompt
  // on screen right now, so it is read at click time.
  function attach(inputEl, getPrompt) {
    if (!inputEl || inputEl.dataset.suggest) return;
    inputEl.dataset.suggest = 'on';

    // Wrap the input so the button sits in the same row, at the input's place in the layout
    const row = document.createElement('div');
    row.className = 'suggest-field';
    inputEl.parentNode.insertBefore(row, inputEl);
    row.appendChild(inputEl);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'suggest-btn';
    button.setAttribute('aria-label', 'Suggest a word');
    button.title = 'Stuck? Get a random word';
    button.innerHTML = `
      <svg class="suggest-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/>
        <circle cx="16" cy="16" r="1.4" fill="currentColor" stroke="none"/>
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>
        <circle cx="8" cy="16" r="1.4" fill="currentColor" stroke="none"/>
        <circle cx="16" cy="8" r="1.4" fill="currentColor" stroke="none"/>
      </svg>
      <span class="suggest-sr">Suggest a word</span>`;

    let lastWord = '';
    button.addEventListener('click', () => {
      const prompt = getPrompt();
      if (!prompt) return;

      lastWord = pickWord(prompt.type, lastWord);
      inputEl.value = lastWord;
      // Lets player.js save the answer, as if it was typed
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.focus();
      inputEl.select();
      roll(button);
    });

    row.appendChild(button);
  }

  return { init, attach };
})();
