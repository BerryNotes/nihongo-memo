const fs = require('fs');
const path = require('path');

function loadJSON(filename) {
  const filePath = path.join(__dirname, '..', 'data', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Build decks from raw data
const DataLoader = {
  _kana: null,
  _katakanaWords: null,
  _vocabulary: null,

  get kana() {
    if (!this._kana) this._kana = loadJSON('kana.json');
    return this._kana;
  },

  get katakanaWords() {
    if (!this._katakanaWords) this._katakanaWords = loadJSON('katakana-words.json');
    return this._katakanaWords;
  },

  get vocabulary() {
    if (!this._vocabulary) this._vocabulary = loadJSON('vocabulary.json');
    return this._vocabulary;
  },

  // Build all available decks
  getDecks() {
    const decks = [];

    // Hiragana deck
    const hiraCards = this.kana.hiragana.map(k => ({
      key: `hira-${k.romaji}`,
      front: k.kana,
      frontSub: 'Hiragana',
      back: k.romaji,
      pronunciation: k.romaji,
      notes: `Group: ${k.group}`,
      english: k.romaji,
      romaji: k.romaji,
      japanese: k.kana
    }));
    decks.push({
      id: 'hiragana',
      name: 'Hiragana',
      description: 'Learn the basic hiragana characters',
      cards: hiraCards
    });

    // Katakana deck
    const kataCards = this.kana.katakana.map(k => ({
      key: `kata-${k.romaji}`,
      front: k.kana,
      frontSub: 'Katakana',
      back: k.romaji,
      pronunciation: k.romaji,
      notes: `Group: ${k.group}`,
      english: k.romaji,
      romaji: k.romaji,
      japanese: k.kana
    }));
    decks.push({
      id: 'katakana',
      name: 'Katakana',
      description: 'Learn the basic katakana characters',
      cards: kataCards
    });

    // Dakuten & Handakuten deck
    const dakutenCards = this.kana.dakuten.map(k => ({
      key: `daku-${k.type}-${k.romaji}`,
      front: k.kana,
      frontSub: `${k.type === 'hiragana' ? 'Hiragana' : 'Katakana'} (dakuten)`,
      back: k.romaji,
      pronunciation: k.romaji,
      notes: `Group: ${k.group}`,
      english: k.romaji,
      romaji: k.romaji,
      japanese: k.kana
    }));
    decks.push({
      id: 'dakuten',
      name: 'Dakuten & Handakuten',
      description: 'Voiced and semi-voiced kana variations (ga, za, da, ba, pa...)',
      cards: dakutenCards
    });

    // Combination Kana deck
    const comboCards = this.kana.combo.map(k => ({
      key: `combo-${k.type}-${k.romaji}`,
      front: k.kana,
      frontSub: `${k.type === 'hiragana' ? 'Hiragana' : 'Katakana'} (combo)`,
      back: k.romaji,
      pronunciation: k.romaji,
      notes: '',
      english: k.romaji,
      romaji: k.romaji,
      japanese: k.kana
    }));
    decks.push({
      id: 'combo-kana',
      name: 'Combination Kana',
      description: 'Kana combinations (kya, sha, cho...)',
      cards: comboCards
    });

    // Katakana Loan Words deck
    const loanCards = this.katakanaWords.map(w => ({
      key: `loan-${w.english}`,
      front: w.katakana,
      frontSub: 'Katakana Loan Word',
      back: w.english,
      pronunciation: w.romaji,
      notes: w.notes || '',
      english: w.english,
      romaji: w.romaji,
      japanese: w.katakana
    }));
    decks.push({
      id: 'katakana-words',
      name: 'Katakana Loan Words',
      description: 'English-derived words written in katakana',
      cards: loanCards
    });

    // Vocabulary decks grouped by day ranges
    const vocab = this.vocabulary;
    const dayRanges = [
      { start: 1, end: 10, label: 'Days 1-10', desc: 'Question words, greetings, meeting people, pronouns' },
      { start: 11, end: 20, label: 'Days 11-20', desc: 'Family, existence, demonstratives, particles' },
      { start: 21, end: 30, label: 'Days 21-30', desc: 'Verb basics, conjugation forms' },
      { start: 31, end: 40, label: 'Days 31-40', desc: 'Tenses, commands, likes and dislikes' },
      { start: 41, end: 50, label: 'Days 41-50', desc: 'Intermediate grammar vocabulary' },
      { start: 51, end: 60, label: 'Days 51-60', desc: 'Adjectives, adverbs, comparisons' },
      { start: 61, end: 70, label: 'Days 61-70', desc: 'Numbers, counting, dates, time' },
      { start: 71, end: 80, label: 'Days 71-80', desc: 'Advanced vocabulary' },
      { start: 81, end: 90, label: 'Days 81-90', desc: 'Honorific speech, review vocabulary' },
    ];

    dayRanges.forEach(range => {
      const words = vocab.filter(w => w.day >= range.start && w.day <= range.end);
      const cards = words.map(w => ({
        key: `vocab-d${w.day}-${w.romaji}`,
        front: w.hiragana,
        frontSub: `Day ${w.day} - ${w.category || ''}`,
        back: w.english,
        pronunciation: w.romaji,
        notes: w.notes || '',
        english: w.english,
        romaji: w.romaji,
        japanese: w.hiragana
      }));
      decks.push({
        id: `vocab-${range.start}-${range.end}`,
        name: `Vocabulary: ${range.label}`,
        description: range.desc,
        cards
      });
    });

    // Full vocabulary deck
    const allVocabCards = vocab.map(w => ({
      key: `vocab-d${w.day}-${w.romaji}`,
      front: w.hiragana,
      frontSub: `Day ${w.day} - ${w.category || ''}`,
      back: w.english,
      pronunciation: w.romaji,
      notes: w.notes || '',
      english: w.english,
      romaji: w.romaji,
      japanese: w.hiragana
    }));
    decks.push({
      id: 'vocab-all',
      name: 'All Vocabulary',
      description: 'All 90 days of vocabulary combined',
      cards: allVocabCards
    });

    return decks;
  }
};
