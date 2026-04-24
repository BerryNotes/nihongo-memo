function loadJSON(filename) {
  // Try Node.js fs (Electron)
  if (typeof require !== 'undefined') {
    try {
      var fs = require('fs');
      var path = require('path');
      var candidates = [
        path.join(__dirname, '..', 'data', filename),
        path.join(__dirname, '..', '..', 'src', 'data', filename),
        path.join(process.cwd(), 'src', 'data', filename)
      ];
      for (var i = 0; i < candidates.length; i++) {
        try { return JSON.parse(fs.readFileSync(candidates[i], 'utf-8')); }
        catch (e) { continue; }
      }
    } catch (e) {}
  }
  // Fallback: synchronous XHR (Tauri / browser)
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'data/' + filename, false);
  xhr.send();
  if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
  throw new Error('Could not load ' + filename);
}

const DataLoader = {
  _kana: null, _katakanaWords: null, _vocabulary: null,
  get kana() { if (!this._kana) this._kana = loadJSON('kana.json'); return this._kana; },
  get katakanaWords() { if (!this._katakanaWords) this._katakanaWords = loadJSON('katakana-words.json'); return this._katakanaWords; },
  get vocabulary() { if (!this._vocabulary) this._vocabulary = loadJSON('vocabulary-organized.json'); return this._vocabulary; },

  getUnits: function() {
    const allVocabRaw = this.vocabulary;
    const kana = this.kana;
    const loanWords = this.katakanaWords;

    function makeKanaCards(list, type) {
      return list.map(k => ({
        key: type.toLowerCase().replace(/\s/g, '-') + '-' + k.romaji + (k.type || ''),
        front: k.kana, frontSub: type,
        back: k.romaji, pronunciation: k.romaji,
        notes: k.group ? 'Group: ' + k.group : '',
        english: k.romaji, romaji: k.romaji, japanese: k.kana
      }));
    }

    function chunk(arr, n) {
      const result = [];
      const size = Math.ceil(arr.length / n);
      for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
      return result;
    }

    // Build the kana teaching schedule (which kana chars are taught on which day)
    const hiraChunks = chunk(kana.hiragana, 10);
    const kataChunks = chunk(kana.katakana, 10);
    const dakuChunks = chunk(kana.dakuten, 10);
    const comboChunks = chunk(kana.combo, 12);
    const loanChunks = chunk(loanWords, 10);

    // Build per-day kana data
    const dayKana = [];
    for (let day = 1; day <= 90; day++) {
      let kanaCards = [], kanaLabel = '', kanaChars = [];

      if (day <= 10 && hiraChunks[day - 1]) {
        kanaCards = makeKanaCards(hiraChunks[day - 1], 'Hiragana');
        kanaLabel = 'Hiragana';
        kanaChars = hiraChunks[day - 1].map(k => k.kana);
      } else if (day >= 11 && day <= 20 && kataChunks[day - 11]) {
        kanaCards = makeKanaCards(kataChunks[day - 11], 'Katakana');
        kanaLabel = 'Katakana';
        kanaChars = kataChunks[day - 11].map(k => k.kana);
      } else if (day >= 21 && day <= 30 && dakuChunks[day - 21]) {
        kanaCards = makeKanaCards(dakuChunks[day - 21], 'Dakuten');
        kanaLabel = 'Dakuten';
        kanaChars = dakuChunks[day - 21].map(k => k.kana);
      } else if (day >= 31 && day <= 42 && comboChunks[day - 31]) {
        kanaCards = makeKanaCards(comboChunks[day - 31], 'Combo');
        kanaLabel = 'Combo Kana';
        kanaChars = comboChunks[day - 31].map(k => k.kana);
      } else if (day >= 43 && day <= 52 && loanChunks[day - 43]) {
        kanaCards = loanChunks[day - 43].map(w => ({
          key: 'loan-' + w.english,
          front: w.katakana, frontSub: 'Loan Word',
          back: w.english, pronunciation: w.romaji,
          notes: w.notes || '',
          english: w.english, romaji: w.romaji, japanese: w.katakana
        }));
        kanaLabel = 'Loan Words';
        kanaChars = loanChunks[day - 43].map(w => {
          // Extract individual katakana chars from loan words
          return w.katakana.split('');
        }).flat();
      }

      dayKana.push({ kanaCards, kanaLabel, kanaChars });
    }

    // Unit theme order — each unit focuses on ONE vocab category
    const unitThemes = [
      'Greetings & Basics',
      'People',
      'Family',
      'Food & Drink',
      'Body',
      'Animals',
      'Home & Objects',
      'Nature & Weather',
      'Colors',
      'Numbers & Counting',
      'Time & Days',
      'Directions & Places',
      'Occupations',
      'Clothing',
      'Transport',
      'Feelings & Emotions',
      'Society',
      'Verbs',
      'Adjectives',
      'Grammar',
      'Abstract',
      'General'
    ];

    // Build all vocab cards grouped by section
    const vocabBySection = {};
    allVocabRaw.forEach(w => {
      if (w.hiragana.length < 2 || w.romaji.length < 2) return;
      const sec = w.section || 'General';
      if (!vocabBySection[sec]) vocabBySection[sec] = [];
      vocabBySection[sec].push({
        key: 'vocab-' + w.romaji + '-' + w.hiragana,
        front: w.hiragana, frontSub: sec,
        back: w.english, pronunciation: w.romaji,
        notes: w.notes || '', section: sec,
        english: w.english, romaji: w.romaji, japanese: w.hiragana
      });
    });

    // Build kana cumulative set for filtering
    const allKanaCharsSoFar = new Set();
    ['っ', 'ッ', 'ー', '・', '、', '。', ' ', '\u3000'].forEach(c => allKanaCharsSoFar.add(c));

    // Group kana into 7-day chunks
    const kanaChunks = [];
    for (let u = 0; u * 7 < dayKana.length; u++) {
      const start = u * 7;
      const end = Math.min(start + 7, dayKana.length);
      const days = dayKana.slice(start, end);
      let cards = [], labels = new Set();
      days.forEach(d => {
        cards = cards.concat(d.kanaCards);
        if (d.kanaLabel) labels.add(d.kanaLabel);
        d.kanaChars.forEach(ch => allKanaCharsSoFar.add(ch));
      });
      cards.forEach(c => c.japanese.split('').forEach(ch => allKanaCharsSoFar.add(ch)));
      kanaChunks.push({ cards, labels: Array.from(labels), start: start + 1, end: Math.min(start + 7, 90) });
    }

    // Now build units: pair kana chunks with themed vocab
    const units = [];
    const numUnits = Math.max(kanaChunks.length, unitThemes.length);

    for (let u = 0; u < numUnits; u++) {
      const kanaChunk = kanaChunks[u] || { cards: [], labels: [], start: 0, end: 0 };
      const theme = unitThemes[u] || 'General';
      const themeVocab = vocabBySection[theme] || [];

      // Filter vocab: only words whose kana are all learned by this point
      // Rebuild cumulative kana set up to this unit
      const kanaKnown = new Set(['っ', 'ッ', 'ー', '・', '、', '。', ' ', '\u3000']);
      for (let k = 0; k <= u && k < kanaChunks.length; k++) {
        kanaChunks[k].cards.forEach(c => c.japanese.split('').forEach(ch => kanaKnown.add(ch)));
      }

      const eligibleVocab = themeVocab.filter(card => {
        return card.japanese.split('').every(ch => kanaKnown.has(ch));
      });

      const newKanaCards = kanaChunk.cards;
      const newVocabCards = eligibleVocab.slice(0, 40);
      const newCards = newKanaCards.concat(newVocabCards);

      if (newCards.length === 0) continue;

      const parts = [];
      if (newKanaCards.length > 0) parts.push(kanaChunk.labels.join(', ') + ' (' + newKanaCards.length + ')');
      if (newVocabCards.length > 0) parts.push(theme + ' (' + newVocabCards.length + ')');

      const dayRange = kanaChunk.start > 0 ? 'Days ' + kanaChunk.start + '-' + kanaChunk.end : '';

      units.push({
        index: units.length,
        id: 'unit-' + (units.length + 1),
        name: 'Unit ' + (units.length + 1),
        subtitle: dayRange,
        theme: theme,
        summary: parts.join(' + '),
        newKanaCards,
        newVocabCards,
        newCards,
        kanaLabels: kanaChunk.labels
      });
    }

    return units;
  }
};
