// App state
const App = {
  decks: [],
  currentDeck: null,
  currentCards: [],
  currentIndex: 0,
  currentMode: null,
  sessionCorrect: 0,
  sessionTotal: 0,

  init() {
    this.decks = DataLoader.getDecks();
    this.bindNavigation();
    this.bindQuickStart();
    this.bindFlashcard();
    this.bindSelfQuiz();
    this.bindTypingQuiz();
    this.bindStats();
    this.updateDashboard();
    this.showView('dashboard');
  },

  // Navigation
  bindNavigation() {
    document.querySelectorAll('[data-view]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.showView(link.dataset.view);
      });
    });

    document.querySelectorAll('[data-back]').forEach(btn => {
      btn.addEventListener('click', () => this.showView(btn.dataset.back));
    });
  },

  showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(`view-${viewId}`);
    if (view) view.classList.add('active');

    document.querySelectorAll('.nav-links a').forEach(a => {
      a.classList.toggle('active', a.dataset.view === viewId);
    });

    if (viewId === 'dashboard') this.updateDashboard();
    if (viewId === 'decks') this.renderDecks();
    if (viewId === 'stats') this.renderStats();
  },

  // Dashboard
  updateDashboard() {
    const stats = Storage.getStats();
    const streak = Storage.getStreak();
    let totalWords = 0;
    this.decks.forEach(d => totalWords += d.cards.length);

    document.getElementById('stat-total-words').textContent = totalWords;
    document.getElementById('stat-mastered').textContent = stats.mastered;
    document.getElementById('stat-accuracy').textContent = stats.accuracy + '%';
    document.getElementById('stat-streak').textContent = streak.current;
  },

  // Quick Start
  bindQuickStart() {
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        switch (action) {
          case 'flashcard-kana':
            this.startReview('hiragana', 'flashcard');
            break;
          case 'flashcard-vocab':
            this.startReview('vocab-1-10', 'flashcard');
            break;
          case 'self-quiz':
            this.openDeckForMode('self-quiz');
            break;
          case 'typing-quiz':
            this.openDeckForMode('typing-en-to-jp');
            break;
        }
      });
    });
  },

  openDeckForMode(mode) {
    // Show deck selection then start with first vocab deck
    this.showView('decks');
  },

  // Decks
  renderDecks() {
    const container = document.getElementById('deck-list');
    container.innerHTML = '';

    this.decks.forEach(deck => {
      const wordKeys = deck.cards.map(c => c.key);
      const progress = Storage.getDeckProgress(wordKeys);

      const card = document.createElement('div');
      card.className = 'deck-card';
      card.innerHTML = `
        <h4>${deck.name}</h4>
        <div class="deck-count">${deck.cards.length} cards</div>
        <p style="font-size:13px;color:var(--text-muted);margin-top:6px">${deck.description}</p>
        <div class="deck-progress">
          <div class="deck-progress-fill" style="width: ${progress}%"></div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${progress}% mastered</div>
      `;
      card.addEventListener('click', () => this.showDeckDetail(deck));
      container.appendChild(card);
    });
  },

  showDeckDetail(deck) {
    this.currentDeck = deck;
    document.getElementById('deck-detail-title').textContent = deck.name;
    document.getElementById('deck-detail-desc').textContent = deck.description;

    // Word list
    const wordList = document.getElementById('deck-word-list');
    wordList.innerHTML = '';
    deck.cards.slice(0, 50).forEach(card => {
      const item = document.createElement('div');
      item.className = 'word-item';
      item.innerHTML = `
        <div>
          <span class="word-japanese">${card.japanese}</span>
          <span class="word-romaji">${card.romaji}</span>
        </div>
        <span class="word-english">${card.english}</span>
      `;
      wordList.appendChild(item);
    });
    if (deck.cards.length > 50) {
      const more = document.createElement('div');
      more.style.cssText = 'padding:12px;text-align:center;color:var(--text-muted);font-size:13px';
      more.textContent = `...and ${deck.cards.length - 50} more`;
      wordList.appendChild(more);
    }

    // Mode buttons
    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.onclick = () => this.startReview(deck.id, btn.dataset.mode);
    });

    this.showView('deck-detail');
  },

  // Start a review session
  startReview(deckId, mode) {
    const deck = this.decks.find(d => d.id === deckId);
    if (!deck || deck.cards.length === 0) return;

    this.currentDeck = deck;
    this.currentMode = mode;
    this.currentCards = this.shuffleArray([...deck.cards]);
    this.currentIndex = 0;
    this.sessionCorrect = 0;
    this.sessionTotal = 0;

    Storage.updateStreak();

    if (mode === 'flashcard') {
      this.showView('flashcard');
      this.renderFlashcard();
    } else if (mode === 'self-quiz') {
      this.showView('self-quiz');
      this.renderSelfQuiz();
    } else if (mode === 'typing-en-to-jp' || mode === 'typing-jp-to-en') {
      this.showView('typing-quiz');
      this.renderTypingQuiz();
    }
  },

  // Flashcard Mode
  bindFlashcard() {
    const card = document.getElementById('flashcard');
    card.addEventListener('click', () => card.classList.toggle('flipped'));

    document.getElementById('flash-prev').addEventListener('click', () => {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.renderFlashcard();
      }
    });

    document.getElementById('flash-next').addEventListener('click', () => {
      if (this.currentIndex < this.currentCards.length - 1) {
        this.currentIndex++;
        this.renderFlashcard();
      }
    });

    document.getElementById('flashcard-back').addEventListener('click', () => {
      this.endSession();
    });
  },

  renderFlashcard() {
    const card = this.currentCards[this.currentIndex];
    const flashcard = document.getElementById('flashcard');
    flashcard.classList.remove('flipped');

    document.getElementById('flash-front-main').textContent = card.front;
    document.getElementById('flash-front-sub').textContent = card.frontSub;
    document.getElementById('flash-back-main').textContent = card.back;
    document.getElementById('flash-back-pronunciation').textContent = card.pronunciation;
    document.getElementById('flash-back-notes').textContent = card.notes;
    document.getElementById('flashcard-counter').textContent =
      `${this.currentIndex + 1} / ${this.currentCards.length}`;
  },

  // Self-Graded Quiz Mode
  bindSelfQuiz() {
    document.getElementById('selfquiz-reveal').addEventListener('click', () => {
      document.getElementById('selfquiz-answer').classList.remove('hidden');
      document.getElementById('selfquiz-reveal').classList.add('hidden');
      document.getElementById('selfquiz-grade').classList.remove('hidden');
    });

    document.getElementById('selfquiz-pass').addEventListener('click', () => {
      this.recordQuizResult(true);
      this.nextSelfQuiz();
    });

    document.getElementById('selfquiz-fail').addEventListener('click', () => {
      this.recordQuizResult(false);
      this.nextSelfQuiz();
    });

    document.getElementById('selfquiz-back').addEventListener('click', () => {
      this.endSession();
    });
  },

  renderSelfQuiz() {
    if (this.currentIndex >= this.currentCards.length) {
      this.endSession();
      return;
    }

    const card = this.currentCards[this.currentIndex];
    // Randomly show Japanese or English side
    const showJapanese = Math.random() > 0.5;

    if (showJapanese) {
      document.getElementById('selfquiz-prompt').textContent = card.japanese;
      document.getElementById('selfquiz-sub').textContent = `What does this mean? (${card.pronunciation})`;
      document.getElementById('selfquiz-answer-main').textContent = card.english;
    } else {
      document.getElementById('selfquiz-prompt').textContent = card.english;
      document.getElementById('selfquiz-sub').textContent = 'What is this in Japanese?';
      document.getElementById('selfquiz-answer-main').textContent = card.japanese;
    }

    document.getElementById('selfquiz-answer-pronunciation').textContent = card.pronunciation;
    document.getElementById('selfquiz-answer-notes').textContent = card.notes;
    document.getElementById('selfquiz-counter').textContent =
      `${this.currentIndex + 1} / ${this.currentCards.length}`;

    // Reset UI
    document.getElementById('selfquiz-answer').classList.add('hidden');
    document.getElementById('selfquiz-reveal').classList.remove('hidden');
    document.getElementById('selfquiz-grade').classList.add('hidden');
  },

  nextSelfQuiz() {
    this.currentIndex++;
    this.renderSelfQuiz();
  },

  // Typing Quiz Mode
  bindTypingQuiz() {
    const input = document.getElementById('typing-input');
    const submitBtn = document.getElementById('typing-submit');

    submitBtn.addEventListener('click', () => this.checkTypingAnswer());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.checkTypingAnswer();
    });

    document.getElementById('typing-next').addEventListener('click', () => {
      this.currentIndex++;
      this.renderTypingQuiz();
    });

    document.getElementById('typing-back').addEventListener('click', () => {
      this.endSession();
    });
  },

  renderTypingQuiz() {
    if (this.currentIndex >= this.currentCards.length) {
      this.endSession();
      return;
    }

    const card = this.currentCards[this.currentIndex];
    const isEnToJp = this.currentMode === 'typing-en-to-jp';

    if (isEnToJp) {
      document.getElementById('typing-prompt').textContent = card.english;
      document.getElementById('typing-sub').textContent = 'Type the romaji pronunciation';
    } else {
      document.getElementById('typing-prompt').textContent = card.japanese;
      document.getElementById('typing-sub').textContent = `Type the English meaning (${card.pronunciation})`;
    }

    document.getElementById('typing-counter').textContent =
      `${this.currentIndex + 1} / ${this.currentCards.length}`;

    // Reset UI
    document.getElementById('typing-input').value = '';
    document.getElementById('typing-input').classList.remove('hidden');
    document.getElementById('typing-submit').classList.remove('hidden');
    document.getElementById('typing-result').classList.add('hidden');
    document.getElementById('typing-input').focus();
  },

  checkTypingAnswer() {
    const card = this.currentCards[this.currentIndex];
    const input = document.getElementById('typing-input');
    const userAnswer = input.value.trim().toLowerCase();
    const isEnToJp = this.currentMode === 'typing-en-to-jp';

    let correctAnswer, displayCorrect;
    if (isEnToJp) {
      correctAnswer = card.romaji.toLowerCase();
      displayCorrect = `${card.romaji} (${card.japanese})`;
    } else {
      correctAnswer = card.english.toLowerCase();
      displayCorrect = card.english;
    }

    // Flexible matching: check if the answer contains the core word
    const isCorrect = this.fuzzyMatch(userAnswer, correctAnswer);

    this.recordQuizResult(isCorrect);

    const statusEl = document.getElementById('typing-status');
    statusEl.textContent = isCorrect ? 'Correct!' : 'Incorrect';
    statusEl.className = `result-status ${isCorrect ? 'correct' : 'incorrect'}`;

    document.getElementById('typing-correct').textContent = `Answer: ${displayCorrect}`;
    document.getElementById('typing-notes').textContent = card.notes || '';

    input.classList.add('hidden');
    document.getElementById('typing-submit').classList.add('hidden');
    document.getElementById('typing-result').classList.remove('hidden');
  },

  fuzzyMatch(userAnswer, correctAnswer) {
    if (!userAnswer) return false;
    // Exact match
    if (userAnswer === correctAnswer) return true;
    // Strip spaces, hyphens, special chars for comparison
    const clean = s => s.replace(/[^a-z0-9]/g, '');
    if (clean(userAnswer) === clean(correctAnswer)) return true;
    // Check if the correct answer contains slashes (multiple accepted answers)
    if (correctAnswer.includes('/')) {
      const parts = correctAnswer.split('/').map(s => s.trim().toLowerCase());
      if (parts.some(p => clean(userAnswer) === clean(p))) return true;
    }
    // Allow partial match for longer phrases
    if (correctAnswer.includes(' ') && userAnswer.includes(correctAnswer.split(' ')[0])) return true;
    return false;
  },

  // Record result
  recordQuizResult(isCorrect) {
    const card = this.currentCards[this.currentIndex];
    Storage.recordReview(card.key, isCorrect);
    this.sessionTotal++;
    if (isCorrect) this.sessionCorrect++;
  },

  // End session
  endSession() {
    if (this.sessionTotal > 0 && this.currentDeck) {
      Storage.recordSession(
        this.currentMode,
        this.currentDeck.name,
        this.sessionCorrect,
        this.sessionTotal
      );
    }
    this.updateDashboard();
    this.showView('dashboard');
  },

  // Stats view
  bindStats() {
    document.getElementById('reset-stats').addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
        Storage.resetAll();
        this.renderStats();
        this.updateDashboard();
      }
    });
  },

  renderStats() {
    const stats = Storage.getStats();
    document.getElementById('stats-total-reviews').textContent = stats.totalReviews;
    document.getElementById('stats-overall-accuracy').textContent = stats.accuracy + '%';
    document.getElementById('stats-words-seen').textContent = stats.totalWords;
    document.getElementById('stats-mastered').textContent = stats.mastered;

    // Recent sessions
    const sessions = Storage.getSessions();
    const sessionList = document.getElementById('recent-sessions');
    sessionList.innerHTML = '';

    if (sessions.length === 0) {
      sessionList.innerHTML = '<p style="color:var(--text-muted);font-size:14px">No sessions yet. Start studying!</p>';
    } else {
      sessions.slice(0, 15).forEach(s => {
        const item = document.createElement('div');
        item.className = 'session-item';
        const date = new Date(s.date);
        const modeNames = {
          flashcard: 'Flashcards',
          'self-quiz': 'Self-Graded',
          'typing-en-to-jp': 'Typing (EN→JP)',
          'typing-jp-to-en': 'Typing (JP→EN)'
        };
        item.innerHTML = `
          <span class="session-date">${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span class="session-mode">${modeNames[s.mode] || s.mode} - ${s.deck}</span>
          <span class="session-score">${s.correct}/${s.total}</span>
        `;
        sessionList.appendChild(item);
      });
    }

    // Hardest words
    const hardest = Storage.getHardestWords();
    const hardestList = document.getElementById('hardest-words');
    hardestList.innerHTML = '';

    if (hardest.length === 0) {
      hardestList.innerHTML = '<p style="color:var(--text-muted);font-size:14px">Not enough data yet.</p>';
    } else {
      hardest.forEach(w => {
        // Try to find the word in decks
        let wordInfo = null;
        for (const deck of this.decks) {
          const found = deck.cards.find(c => c.key === w.key);
          if (found) { wordInfo = found; break; }
        }
        if (!wordInfo) return;

        const item = document.createElement('div');
        item.className = 'word-item';
        const pct = Math.round((1 - w.ratio) * 100);
        item.innerHTML = `
          <div>
            <span class="word-japanese">${wordInfo.japanese}</span>
            <span class="word-romaji">${wordInfo.romaji}</span>
          </div>
          <span class="word-english">${wordInfo.english} (${pct}% correct)</span>
        `;
        hardestList.appendChild(item);
      });
    }
  },

  // Utility
  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
