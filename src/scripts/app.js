var App = {
  units: [],
  currentUnit: null,
  currentCards: [],
  currentIndex: 0,
  currentMode: null,
  sessionCorrect: 0,
  sessionTotal: 0,
  isExam: false,
  // For learn flow
  teachCards: [],
  teachIndex: 0,
  learnNewCards: [],
  learnReviewCards: [],
  BATCH_SIZE: 5,
  isTeachingVocab: false,
  viewingUnitIndex: 0,

  init: function() {
    try { this.units = DataLoader.getUnits(); }
    catch (e) { console.error('Failed to load:', e); this.units = []; }
    Auth.init();
    this.bind();
    this.bindAuth();
    // If not logged in and online, show auth gate instead of home
    if (API_BASE && !Auth.isLoggedIn()) {
      this.showView('auth-gate');
    } else {
      this.showView('home');
    }
  },

  _wordDetails: null,

  getWordDetails: function(card) {
    if (!this._wordDetails) {
      try { this._wordDetails = loadJSON('word-details.json'); }
      catch(e) { this._wordDetails = {}; }
    }
    return this._wordDetails[card.romaji] || this._wordDetails[card.key] || null;
  },

  showWordModal: function(card) {
    var details = this.getWordDetails(card);
    document.getElementById('modal-char').textContent = card.japanese;
    document.getElementById('modal-rom').textContent = card.romaji;
    document.getElementById('modal-eng').textContent = card.english;
    document.getElementById('modal-section').textContent = card.section || card.frontSub || '';

    var notes = card.notes || '';
    if (details && details.description) notes = details.description;
    if (details && details.notes) notes += (notes ? '\n\n' : '') + details.notes;
    if (details && details.formality) notes += (notes ? '\n\n' : '') + 'Formality: ' + details.formality;
    document.getElementById('modal-notes').textContent = notes;

    var exEl = document.getElementById('modal-examples');
    exEl.innerHTML = '';
    if (details && details.examples && details.examples.length > 0) {
      var lbl = document.createElement('div');
      lbl.className = 'ex-label';
      lbl.textContent = 'Examples';
      exEl.appendChild(lbl);
      details.examples.forEach(function(ex) {
        var jp = document.createElement('div');
        jp.className = 'ex-jp';
        jp.textContent = ex.jp;
        exEl.appendChild(jp);
        if (ex.rom) {
          var rom = document.createElement('div');
          rom.className = 'ex-rom';
          rom.textContent = ex.rom;
          exEl.appendChild(rom);
        }
        var en = document.createElement('div');
        en.className = 'ex-en';
        en.textContent = ex.en;
        exEl.appendChild(en);
      });
    }

    document.getElementById('word-modal').classList.remove('hidden');
  },

  bind: function() {
    var self = this;

    // Modal close
    document.getElementById('modal-close').onclick = function() { document.getElementById('word-modal').classList.add('hidden'); };
    document.getElementById('word-modal').onclick = function(e) { if (e.target === this) this.classList.add('hidden'); };

    // Quiz help buttons
    document.getElementById('mc-help').onclick = function() {
      var c = self.currentCards[self.currentIndex];
      self.showWordModal(c);
      self._skipCurrentQuestion = true;
    };
    document.getElementById('typ-help').onclick = function() {
      var c = self.currentCards[self.currentIndex];
      self.showWordModal(c);
      self._skipCurrentQuestion = true;
    };

    document.getElementById('start-btn').onclick = function() { self.openCurrentUnit(); };
    document.getElementById('unit-back').onclick = function() { self.showView('home'); };
    document.getElementById('unit-prev').onclick = function() { self.switchUnit(-1); };
    document.getElementById('unit-next').onclick = function() { self.switchUnit(1); };
    document.getElementById('vocab-back').onclick = function() { self.openUnit(self.currentUnit); };
    document.getElementById('teach-exit').onclick = function() { self._bonusCards = null; self.openUnit(self.currentUnit); };
    document.getElementById('flash-exit').onclick = function() { self.exitSession(); };
    document.getElementById('sq-exit').onclick = function() { self.exitSession(); };
    document.getElementById('typ-exit').onclick = function() { self.exitSession(); };
    document.getElementById('mc-exit').onclick = function() { self.exitSession(); };
    document.getElementById('complete-home').onclick = function() { self.openUnit(self.currentUnit); };

    document.getElementById('teach-next').onclick = function() { self.nextTeach(); };
    document.getElementById('quiz-intro-start').onclick = function() { self.startLearnQuiz(); };

    document.getElementById('flashcard').onclick = function() { this.classList.toggle('flipped'); };
    document.getElementById('flash-prev').onclick = function() { if (self.currentIndex > 0) { self.currentIndex--; self.renderFlashcard(); } };
    document.getElementById('flash-next').onclick = function() { if (self.currentIndex < self.currentCards.length - 1) { self.currentIndex++; self.renderFlashcard(); } };
    document.getElementById('sq-reveal').onclick = function() {
      document.getElementById('sq-answer').classList.remove('hidden');
      this.classList.add('hidden');
      document.getElementById('sq-continue').classList.remove('hidden');
    };
    document.getElementById('sq-continue').onclick = function() { self.recordResult(true); self.nextSelfQuiz(); };

    // Arrow key navigation
    document.addEventListener('keydown', function(e) {
      var active = document.querySelector('.view.active');
      if (!active) return;
      var id = active.id;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (id === 'view-home') { self.switchUnit(1); }
        else if (id === 'view-flashcard') {
          if (self.currentIndex < self.currentCards.length - 1) { self.currentIndex++; self.renderFlashcard(); }
        } else if (id === 'view-teach') {
          self.nextTeach();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (id === 'view-home') { self.switchUnit(-1); }
        else if (id === 'view-flashcard') {
          if (self.currentIndex > 0) { self.currentIndex--; self.renderFlashcard(); }
        }
      } else if (e.key === ' ' || e.key === 'Enter') {
        // Don't capture space/enter when typing in an input
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        e.preventDefault();
        if (id === 'view-flashcard') {
          document.getElementById('flashcard').classList.toggle('flipped');
        } else if (id === 'view-self-quiz') {
          var reveal = document.getElementById('sq-reveal');
          var cont = document.getElementById('sq-continue');
          if (!reveal.classList.contains('hidden')) { reveal.click(); }
          else if (!cont.classList.contains('hidden')) { cont.click(); }
        }
      }
    });
    document.getElementById('typ-submit').onclick = function() { self.checkTyping(); };
    document.getElementById('typ-input').onkeydown = function(e) { if (e.key === 'Enter') self.checkTyping(); };
    document.getElementById('typ-next').onclick = function() {
      self.currentIndex++;
      if (self._returnToMC) {
        self._returnToMC = false;
        self.currentMode = self._savedMode || 'typing-en-to-jp';
        self.showView('mc');
        self.renderMC();
      } else {
        self.renderTyping();
      }
    };
  },

  bindAuth: function() {
    var self = this;
    var modal = document.getElementById('auth-modal');
    var isRegister = false;

    function showAuthModal(register) {
      isRegister = register;
      document.getElementById('auth-title').textContent = register ? 'Create Account' : 'Log In';
      document.getElementById('auth-submit').textContent = register ? 'Create Account' : 'Log In';
      document.getElementById('auth-email-field').className = register ? 'auth-field' : 'auth-field hidden';
      document.getElementById('auth-switch').innerHTML = register
        ? 'Already have an account? <button id="auth-switch-btn">Log in</button>'
        : 'No account? <button id="auth-switch-btn">Create one</button>';
      document.getElementById('auth-error').className = 'auth-error hidden';
      document.getElementById('auth-email-input').value = '';
      document.getElementById('auth-password-input').value = '';
      document.getElementById('auth-username-input').value = '';
      modal.classList.remove('hidden');
      document.getElementById('auth-switch-btn').onclick = function() { showAuthModal(!register); };
    }

    if (document.getElementById('auth-login-btn')) {
      document.getElementById('auth-login-btn').onclick = function() { showAuthModal(false); };
      document.getElementById('auth-register-btn').onclick = function() { showAuthModal(true); };
    }
    // Gate buttons
    if (document.getElementById('gate-login')) {
      document.getElementById('gate-login').onclick = function() { showAuthModal(false); };
      document.getElementById('gate-register').onclick = function() { showAuthModal(true); };
    }
    document.getElementById('auth-close').onclick = function() { modal.classList.add('hidden'); };
    modal.onclick = function(e) { if (e.target === modal) modal.classList.add('hidden'); };

    document.getElementById('auth-submit').onclick = async function() {
      var email = document.getElementById('auth-email-input').value.trim();
      var password = document.getElementById('auth-password-input').value;
      var errEl = document.getElementById('auth-error');

      var username = document.getElementById('auth-username-input').value.trim();
      var result;
      if (isRegister) {
        result = await Auth.register(email, username, password);
      } else {
        result = await Auth.login(username, password);
      }

      if (result && result.ok) {
        modal.classList.add('hidden');
        self.updateAuthUI();
        self.showView('home');
      } else {
        errEl.textContent = (result && result.error) || 'Something went wrong. Try again.';
        errEl.className = 'auth-error';
      }
    };

    document.getElementById('auth-logout-btn').onclick = function() {
      Auth.logout();
      self.updateAuthUI();
      if (API_BASE) self.showView('auth-gate');
    };

    // Allow enter to submit
    document.getElementById('auth-password-input').onkeydown = function(e) {
      if (e.key === 'Enter') document.getElementById('auth-submit').click();
    };

    this.updateAuthUI();
  },

  updateAuthUI: function() {
    if (Auth.isLoggedIn()) {
      document.getElementById('auth-bar').classList.add('hidden');
      document.getElementById('auth-user-bar').classList.remove('hidden');
      document.getElementById('auth-username').textContent = Auth.user.username;
    } else {
      document.getElementById('auth-bar').classList.remove('hidden');
      document.getElementById('auth-user-bar').classList.add('hidden');
    }
  },

  showView: function(id) {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].classList.remove('active');
    document.getElementById('view-' + id).classList.add('active');
    if (id === 'home') this.renderHome();
  },

  // ===== Unit helpers =====
  isUnitUnlocked: function(index) {
    if (index === 0) return true;
    return Storage.isExamPassed('unit-' + index);
  },

  getCurrentUnitIndex: function() {
    for (var i = 0; i < this.units.length; i++) {
      if (!this.isUnitUnlocked(i)) return Math.max(0, i - 1);
      if (!Storage.isExamPassed('unit-' + (i + 1))) return i;
    }
    return this.units.length - 1;
  },

  getCumulativeCards: function(unitIndex) {
    var all = [];
    for (var i = 0; i <= unitIndex; i++) all = all.concat(this.units[i].newCards);
    return all;
  },

  getKanaProgress: function(unit) {
    if (unit.newKanaCards.length === 0) return 100;
    var keys = unit.newKanaCards.map(function(c) { return c.key; });
    return Storage.getUnitProgress(keys);
  },

  getVocabProgress: function(unit) {
    if (unit.newVocabCards.length === 0) return 100;
    var keys = unit.newVocabCards.map(function(c) { return c.key; });
    return Storage.getUnitProgress(keys);
  },

  // ===== Home =====
  renderHome: function() {
    var stats = Storage.getStats();
    var streak = Storage.getStreak();
    document.getElementById('hs-mastered').textContent = stats.mastered;
    document.getElementById('hs-streak').textContent = streak.current;

    if (!this._homeInitialized) {
      this.viewingUnitIndex = this.getCurrentUnitIndex();
      this._homeInitialized = true;
    }
    this.renderHomeUnit();
  },

  renderHomeUnit: function() {
    var unit = this.units[this.viewingUnitIndex];
    if (!unit) return;
    var keys = unit.newCards.map(function(c) { return c.key; });
    var progress = Storage.getUnitProgress(keys);
    document.getElementById('home-unit-name').textContent = unit.name;
    document.getElementById('home-unit-sub').textContent = (unit.theme ? unit.theme : '') + (unit.summary ? ' \u2014 ' + unit.summary : '');
    document.getElementById('home-unit-pct').textContent = progress + '% mastered';
    document.getElementById('unit-prev').className = 'unit-arrow' + (this.viewingUnitIndex <= 0 ? ' disabled' : '');
    document.getElementById('unit-next').className = 'unit-arrow' + (this.viewingUnitIndex >= this.units.length - 1 ? ' disabled' : '');
  },

  switchUnit: function(dir) {
    var newIdx = this.viewingUnitIndex + dir;
    if (newIdx < 0 || newIdx >= this.units.length) return;
    var self = this;
    var box = document.getElementById('home-unit-box');
    var slideOut = dir > 0 ? 'slide-left' : 'slide-right';
    var slideIn = dir > 0 ? 'slide-right' : 'slide-left';
    box.classList.add(slideOut);
    setTimeout(function() {
      self.viewingUnitIndex = newIdx;
      self.renderHomeUnit();
      box.classList.remove(slideOut);
      box.classList.add(slideIn);
      box.offsetHeight;
      box.classList.remove(slideIn);
      box.classList.add('slide-in');
      setTimeout(function() { box.classList.remove('slide-in'); }, 200);
    }, 200);
  },

  // ===== Unit =====
  openCurrentUnit: function() {
    this.openUnit(this.units[this.viewingUnitIndex]);
  },

  openUnit: function(unit) {
    var self = this;
    this.currentUnit = unit;

    document.getElementById('unit-name').textContent = unit.name;
    document.getElementById('unit-subtitle').textContent = (unit.theme ? unit.theme + ' \u2014 ' : '') + unit.summary;

    var keys = unit.newCards.map(function(c) { return c.key; });
    var progress = Storage.getUnitProgress(keys);
    document.getElementById('unit-pct').textContent = progress + '%';

    var kanaP = this.getKanaProgress(unit);
    var vocabP = this.getVocabProgress(unit);
    var examPassed = Storage.isExamPassed('unit-' + (unit.index + 1));
    var kanaComplete = kanaP >= 100 || unit.newKanaCards.length === 0;
    var vocabComplete = vocabP >= 100 || unit.newVocabCards.length === 0;

    var kanaMastered = 0;
    var kanaIntroduced = 0;
    var allM = Storage.getAllMastery();
    unit.newKanaCards.forEach(function(c) {
      if (Storage.isMastered(c.key)) kanaMastered++;
      if (allM[c.key] && allM[c.key].level > 0) kanaIntroduced++;
    });
    var kanaNeverSeen = unit.newKanaCards.length - kanaIntroduced;

    // Phase 1: Kana
    var phaseKana = document.getElementById('phase-kana');
    phaseKana.className = 'phase-card' + (kanaComplete ? ' done' : ' active');
    document.getElementById('phase-kana-name').textContent = unit.newKanaCards.length > 0 ? 'Learn ' + unit.kanaLabels.join(' & ') : 'Kana';

    var kanaDetail = '';
    if (kanaComplete) {
      kanaDetail = unit.newKanaCards.length + ' characters mastered';
    } else {
      kanaDetail = kanaIntroduced + '/' + unit.newKanaCards.length + ' introduced, ' + kanaMastered + ' mastered';
    }
    document.getElementById('phase-kana-detail').textContent = kanaDetail;
    document.getElementById('phase-kana-status').textContent = kanaComplete ? 'Complete' : kanaP + '%';
    document.getElementById('phase-kana-status').className = 'phase-status' + (kanaComplete ? ' complete' : '');
    document.getElementById('phase-kana-bar').style.width = kanaP + '%';
    document.getElementById('phase-kana-bar').className = 'phase-bar-fill' + (kanaComplete ? ' complete' : '');

    if (unit.newKanaCards.length > 0) {
      phaseKana.onclick = function() { self.startKanaLearn(); };
      phaseKana.style.display = '';
    } else {
      phaseKana.style.display = 'none';
    }

    // Phase 2: Vocabulary (available from the start, uses only learned kana)
    var phaseVocab = document.getElementById('phase-vocab');
    phaseVocab.className = 'phase-card' + (vocabComplete ? ' done' : ' active');
    document.getElementById('phase-vocab-detail').textContent = unit.newVocabCards.length + ' words (using learned kana only)';
    document.getElementById('phase-vocab-status').textContent = vocabComplete ? 'Complete' : vocabP + '%';
    document.getElementById('phase-vocab-status').className = 'phase-status' + (vocabComplete ? ' complete' : '');
    document.getElementById('phase-vocab-bar').style.width = vocabP + '%';
    document.getElementById('phase-vocab-bar').className = 'phase-bar-fill' + (vocabComplete ? ' complete' : '');

    if (unit.newVocabCards.length > 0) {
      phaseVocab.onclick = function() { self.openVocab(); };
    } else { phaseVocab.onclick = null; }

    // Render full hiragana chart with learned/unlearned states
    this.renderFullKanaChart();

    this.showView('unit');
  },

  // ===== Full kana chart — transposed: long rows (vowels as rows, consonants as columns) =====
  renderFullKanaChart: function() {
    var container = document.getElementById('unit-kana-chart');
    container.innerHTML = '';

    // Based on actual mastery progress, not unit index
    var learnedKana = new Set();
    var allMastery = Storage.getAllMastery();
    for (var u = 0; u < this.units.length; u++) {
      this.units[u].newKanaCards.forEach(function(c) {
        if (allMastery[c.key] && allMastery[c.key].level > 0) learnedKana.add(c.romaji);
      });
    }

    try {
      var allHiragana = DataLoader.kana.hiragana;
      var lookup = {};
      allHiragana.forEach(function(k) { lookup[k.romaji] = k.kana; });

      // Columns: consonant groups. Rows: vowels (a, i, u, e, o)
      var cols = [
        { label: '', prefix: '' },
        { label: 'K', prefix: 'k' },
        { label: 'S', prefix: 's' },
        { label: 'T', prefix: 't' },
        { label: 'N', prefix: 'n' },
        { label: 'H', prefix: 'h' },
        { label: 'M', prefix: 'm' },
        { label: 'Y', prefix: 'y' },
        { label: 'R', prefix: 'r' },
        { label: 'W', prefix: 'w' },
        { label: 'N', prefix: 'nn' },
      ];
      var vowels = ['a', 'i', 'u', 'e', 'o'];

      // Irregular romaji mappings
      var grid = {
        'a': ['a','ka','sa','ta','na','ha','ma','ya','ra','wa','n'],
        'i': ['i','ki','shi','chi','ni','hi','mi','','ri','',''],
        'u': ['u','ku','su','tsu','nu','fu','mu','yu','ru','',''],
        'e': ['e','ke','se','te','ne','he','me','','re','',''],
        'o': ['o','ko','so','to','no','ho','mo','yo','ro','wo',''],
      };

      var title = document.createElement('h3');
      title.className = 'section-title';
      title.textContent = 'Hiragana';
      container.appendChild(title);

      var table = document.createElement('table');
      table.className = 'kana-grid';

      // Header row: consonant labels
      var thead = document.createElement('tr');
      var th0 = document.createElement('th'); th0.className = 'kg-header'; thead.appendChild(th0);
      cols.forEach(function(col) {
        var th = document.createElement('th'); th.className = 'kg-header'; th.textContent = col.label; thead.appendChild(th);
      });
      table.appendChild(thead);

      // One row per vowel
      vowels.forEach(function(v) {
        var tr = document.createElement('tr');
        var lbl = document.createElement('td'); lbl.className = 'kg-header'; lbl.textContent = v; tr.appendChild(lbl);
        grid[v].forEach(function(rom) {
          var td = document.createElement('td');
          if (rom && lookup[rom]) {
            td.className = 'kg-cell' + (learnedKana.has(rom) ? '' : ' unlearned');
            td.textContent = lookup[rom];
            td.title = rom;
          } else {
            td.className = 'kg-empty';
          }
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });

      container.appendChild(table);
    } catch (e) {}
  },

  // Group kana cards by consonant group
  getKanaGroups: function(cards) {
    var groups = [];
    var currentGroup = [];
    var currentPrefix = null;

    // Kana are ordered: vowels, k-row, s-row, t-row, n-row, h-row, m-row, y-row, r-row, w-row, n
    // Each group shares the same consonant. Group by looking at romaji prefix.
    cards.forEach(function(c) {
      var rom = c.romaji;
      // Get the consonant prefix (empty for vowels, first char for others)
      var prefix;
      if (rom.length === 1) prefix = '_vowel'; // a, i, u, e, o, n
      else if (rom.startsWith('sh')) prefix = 's';
      else if (rom.startsWith('ch')) prefix = 't';
      else if (rom.startsWith('ts')) prefix = 't';
      else if (rom.startsWith('fu')) prefix = 'h';
      else prefix = rom[0];

      if (prefix !== currentPrefix && currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      currentPrefix = prefix;
      currentGroup.push(c);
    });
    if (currentGroup.length > 0) groups.push(currentGroup);
    return groups;
  },

  // ===== Kana Learn Flow =====
  startKanaLearn: function() {
    var unit = this.currentUnit;
    var allMastery = Storage.getAllMastery();

    // Group ALL kana by consonant group first
    var allGroups = this.getKanaGroups(unit.newKanaCards);

    // Find the first group that has any unmastered members (level < 15)
    // and check if it needs teaching (has never-seen members)
    var currentGroup = null;
    var needsTeach = false;
    var completedCards = []; // cards from fully-learned groups

    for (var g = 0; g < allGroups.length; g++) {
      var group = allGroups[g];
      var groupDone = group.every(function(c) {
        return allMastery[c.key] && allMastery[c.key].level >= 3;
      });

      if (groupDone) {
        completedCards = completedCards.concat(group);
        continue;
      }

      currentGroup = group;
      needsTeach = group.some(function(c) {
        return !allMastery[c.key] || allMastery[c.key].level === 0;
      });
      break;
    }

    // Previous units' kana for review
    var prevCards = [];
    for (var u = 0; u < unit.index; u++) {
      prevCards = prevCards.concat(this.units[u].newKanaCards);
    }

    if (currentGroup && needsTeach) {
      // Teach the FULL group (including any already-seen members for reinforcement)
      this.learnNewCards = currentGroup;
      this.learnReviewCards = completedCards.concat(prevCards);
      this.teachCards = currentGroup;
      this.teachIndex = 0;
      this.isTeachingVocab = false;
      this.renderTeach();
      this.showView('teach');
    } else if (currentGroup) {
      // Group is partially learned but no never-seen — quiz it
      this.startRandomReview(currentGroup.concat(completedCards).concat(prevCards), false);
    } else {
      // All groups done — review everything
      this.startRandomReview(unit.newKanaCards.concat(prevCards), false);
    }
  },

  renderTeach: function() {
    if (this.isTeachingVocab) {
      this.renderTeachVocab();
    } else {
      var c = this.teachCards[this.teachIndex];
      document.getElementById('teach-label').textContent = 'New Character ' + (this.teachIndex + 1) + ' of ' + this.teachCards.length;
      document.getElementById('teach-char').textContent = c.japanese;
      document.getElementById('teach-rom').textContent = c.romaji;
      document.getElementById('teach-notes').textContent = c.notes || '';
      document.getElementById('teach-counter').textContent = (this.teachIndex + 1) + ' / ' + this.teachCards.length;
      document.getElementById('teach-next').textContent = this.teachIndex < this.teachCards.length - 1 ? 'Next' : 'Start Quiz';
    }
  },

  nextTeach: function() {
    // Handle bonus vocab teach flow (after quiz)
    if (this._bonusCards) {
      if (this._bonusIndex < this._bonusCards.length - 1) {
        this._bonusIndex++;
        this.renderBonusTeach();
      } else {
        this._bonusCards = null;
        this.showView('complete');
      }
      return;
    }

    if (this.teachIndex < this.teachCards.length - 1) {
      this.teachIndex++;
      this.renderTeach();
    } else {
      // Build quiz: new cards repeated 3x for kana, 2x for vocab + review
      var quizCards = [];
      var reps = this.isTeachingVocab ? 2 : 3;
      for (var r = 0; r < reps; r++) {
        var batch = this.learnNewCards.slice();
        this.shuffle(batch);
        quizCards = quizCards.concat(batch);
      }
      if (this.learnReviewCards.length > 0) {
        var reviewDeck = Storage.buildReviewDeck(this.learnReviewCards, Math.min(4, this.learnReviewCards.length));
        quizCards = quizCards.concat(reviewDeck);
      }
      var cap = this.isTeachingVocab ? 12 : 18;
      if (quizCards.length > cap) quizCards = quizCards.slice(0, cap);

      // Bonus vocab will be shown after quiz as teach, not quizzed

      var label = this.isTeachingVocab
        ? 'You just learned ' + this.learnNewCards.length + ' new words.'
        : 'You just learned ' + this.learnNewCards.length + ' new characters.';
      this.currentCards = quizCards;
      if (this.isTeachingVocab) {
        // Vocab — show preview
        document.getElementById('quiz-intro-text').textContent = quizCards.length + ' questions.';
        this.renderQuizPreview(quizCards);
        this._pendingMode = null;
        this.showView('quiz-intro');
      } else {
        // Kana — straight to quiz
        this._pendingMode = null;
        this.startLearnQuiz();
      }
    }
  },

  startLearnQuiz: function() {
    // Called from quiz-intro-start button — handles both teach flow and random review
    if (this._pendingMode) {
      // Random review flow
      var mode = this._pendingMode;
      this._pendingMode = null;
      this.currentIndex = 0;
      this.sessionCorrect = 0;
      this.sessionTotal = 0;
      Storage.updateStreak();
      if (mode === 'typing-en-to-jp') { this.showView('mc'); this.renderMC(); }
      else { this.showView('typing'); this.renderTyping(); }
      return;
    }

    // Teach-then-quiz flow
    var cards = this.currentCards;
    this.isExam = false;
    this.currentCards = this.shuffle(cards.slice());
    this.currentIndex = 0;
    this.sessionCorrect = 0;
    this.sessionTotal = 0;
    Storage.updateStreak();

    if (this.isTeachingVocab) {
      var modes = ['typing-en-to-jp', 'typing-jp-to-en', 'typing-en-to-jp'];
      var mode = modes[Math.floor(Math.random() * modes.length)];
      this.currentMode = mode;
      if (mode === 'typing-en-to-jp') { this.showView('mc'); this.renderMC(); }
      else { this.showView('typing'); this.renderTyping(); }
    } else {
      this.currentMode = 'typing-en-to-jp';
      this.showView('mc');
      this.renderMC();
    }
    this.isTeachingVocab = false;
  },

  // Get 2 never-seen vocab words to append to any quiz session
  getBonusVocab: function() {
    var unit = this.currentUnit;
    if (!unit) return [];
    var allMastery = Storage.getAllMastery();
    var unseen = [];
    unit.newVocabCards.forEach(function(c) {
      if (!allMastery[c.key] || allMastery[c.key].level === 0) unseen.push(c);
    });
    return unseen.slice(0, 2);
  },

  // ===== Vocabulary learning (gradual: teach 5, quiz, add more) =====
  openPracticeFor: function() {
    this.startVocabLearn();
  },

  startVocabLearn: function() {
    var unit = this.currentUnit;
    var allMastery = Storage.getAllMastery();

    // Split into: introduced (seen at least once) and never seen
    var introduced = [];
    var neverSeen = [];
    unit.newVocabCards.forEach(function(c) {
      if (allMastery[c.key] && allMastery[c.key].level > 0) introduced.push(c);
      else neverSeen.push(c);
    });

    // Check if all introduced words are at level 9+ (ready for new words)
    var allReady = introduced.length === 0 || introduced.every(function(c) {
      return allMastery[c.key] && allMastery[c.key].level >= 9;
    });

    // Previous units' vocab for review
    var prevCards = [];
    for (var u = 0; u < unit.index; u++) {
      prevCards = prevCards.concat(this.units[u].newVocabCards);
    }

    if (neverSeen.length > 0 && allReady) {
      // Introduce new batch
      this.learnNewCards = neverSeen.slice(0, this.BATCH_SIZE);
      this.learnReviewCards = introduced.concat(prevCards);
      this.teachCards = this.learnNewCards;
      this.teachIndex = 0;
      this.isTeachingVocab = true;
      this.renderTeachVocab();
      this.showView('teach');
    } else if (introduced.length > 0) {
      // All introduced but not all at level 9 yet — quiz on introduced words
      this.startRandomReview(introduced.concat(prevCards), false);
    } else {
      // Everything mastered — review all
      this.startRandomReview(unit.newVocabCards.concat(prevCards), false);
    }
  },

  renderTeachVocab: function() {
    var c = this.teachCards[this.teachIndex];
    document.getElementById('teach-label').textContent = 'New Word ' + (this.teachIndex + 1) + ' of ' + this.teachCards.length;
    document.getElementById('teach-char').textContent = c.japanese;
    document.getElementById('teach-rom').textContent = c.english;
    document.getElementById('teach-notes').textContent = c.notes || '';
    document.getElementById('teach-counter').textContent = (this.teachIndex + 1) + ' / ' + this.teachCards.length;
    document.getElementById('teach-next').textContent = this.teachIndex < this.teachCards.length - 1 ? 'Next' : 'Start Quiz';
  },

  openVocab: function() {
    var self = this;
    var unit = this.currentUnit;
    document.getElementById('vocab-title').textContent = unit.name + ' \u2014 Vocabulary';

    // Left: word list grouped by section
    var sections = document.getElementById('vocab-sections');
    sections.innerHTML = '';

    if (unit.newVocabCards.length > 0) {
      // Group by section
      var groups = {};
      var groupOrder = [];
      unit.newVocabCards.forEach(function(c) {
        var sec = c.section || 'General';
        if (!groups[sec]) { groups[sec] = []; groupOrder.push(sec); }
        groups[sec].push(c);
      });

      groupOrder.forEach(function(sec) {
        var header = document.createElement('div');
        header.className = 'vocab-group-title';
        header.textContent = sec + ' (' + groups[sec].length + ')';
        sections.appendChild(header);

        groups[sec].forEach(function(c) {
          var mastery = Storage.getMasteryLevel(c.key);
          var dots = '';
          var filled = Math.floor(mastery / 3);
          for (var d = 0; d < 5; d++) dots += '<span style="color:' + (d < filled ? 'var(--accent)' : 'var(--border)') + '">\u25CF</span>';
          var row = document.createElement('div');
          row.className = 'word-row clickable';
          row.innerHTML = '<div><span class="jp">' + c.japanese + '</span><span class="jp-rom">' + c.romaji + '</span></div><div><span class="en">' + c.english + '</span><span class="mastery-dots">' + dots + '</span></div>';
          (function(card) { row.onclick = function() { self.showWordModal(card); }; })(c);
          sections.appendChild(row);
        });
      });
    } else {
      sections.innerHTML = '<p class="muted">No vocabulary in this unit.</p>';
    }

    // Right: practice button
    var practiceList = document.getElementById('vocab-practice-list');
    practiceList.innerHTML = '';

    var vocabMastered = 0;
    var vocabIntroduced = 0;
    var vm = Storage.getAllMastery();
    unit.newVocabCards.forEach(function(c) {
      if (Storage.isMastered(c.key)) vocabMastered++;
      if (vm[c.key] && vm[c.key].level > 0) vocabIntroduced++;
    });
    var vocabNeverSeen = unit.newVocabCards.length - vocabIntroduced;
    var allAtNine = vocabIntroduced === 0 || unit.newVocabCards.every(function(c) {
      return !vm[c.key] || vm[c.key].level === 0 || vm[c.key].level >= 9;
    });
    var btnLabel = vocabNeverSeen > 0 && allAtNine
      ? 'Learn ' + Math.min(5, vocabNeverSeen) + ' new words'
      : vocabNeverSeen > 0
        ? 'Practice current words'
        : 'Review all words';

    var btn = document.createElement('button');
    btn.className = 'vocab-practice-btn';
    btn.innerHTML = '<div class="vpb-name">' + btnLabel + '</div><div class="vpb-count">' + vocabIntroduced + '/' + unit.newVocabCards.length + ' introduced, ' + vocabMastered + ' mastered</div>';
    btn.onclick = function() { self.startVocabLearn(); };
    practiceList.appendChild(btn);

    this.showView('vocab');
  },

  // ===== Exam =====
  startExam: function() {
    var cumCards = this.getCumulativeCards(this.currentUnit.index);
    this.isExam = true;
    this.startRandomReview(cumCards, true);
  },

  // ===== Generic random review =====
  startRandomReview: function(cards, isExam) {
    var modes = ['typing-en-to-jp', 'typing-jp-to-en', 'typing-en-to-jp'];
    var mode = modes[Math.floor(Math.random() * modes.length)];
    this.currentMode = mode;
    this.isExam = !!isExam;
    var maxCards = isExam ? Math.min(30, cards.length) : Math.min(12, cards.length);
    this.currentCards = Storage.buildReviewDeck(cards, maxCards);

    // Check if this has vocab cards
    var hasVocab = cards.some(function(c) {
      return c.key.indexOf('vocab') !== -1 || c.key.indexOf('wiki') !== -1;
    });

    // Only add bonus vocab to vocab quizzes
    if (hasVocab && !isExam) {
      // Vocab quiz — show preview
      document.getElementById('quiz-intro-text').textContent = this.currentCards.length + ' questions.';
      this.renderQuizPreview(this.currentCards);
      this._pendingMode = mode;
      this.showView('quiz-intro');
    } else {
      // Kana or exam — straight to quiz
      this.currentIndex = 0;
      this.sessionCorrect = 0;
      this.sessionTotal = 0;
      Storage.updateStreak();
      if (mode === 'typing-en-to-jp') { this.showView('mc'); this.renderMC(); }
      else { this.showView('typing'); this.renderTyping(); }
    }
  },

  // ===== Review rendering =====
  renderFlashcard: function() {
    var c = this.currentCards[this.currentIndex];
    document.getElementById('flashcard').classList.remove('flipped');
    document.getElementById('flash-front').textContent = c.front;
    document.getElementById('flash-front-sub').textContent = c.frontSub;
    document.getElementById('flash-back').textContent = c.back;
    document.getElementById('flash-back-pron').textContent = c.pronunciation;
    document.getElementById('flash-back-notes').textContent = c.notes || '';
    document.getElementById('flash-counter').textContent = (this.currentIndex + 1) + ' / ' + this.currentCards.length;
  },

  renderSelfQuiz: function() {
    if (this.currentIndex >= this.currentCards.length) { this.endSession(); return; }
    var c = this.currentCards[this.currentIndex];
    document.getElementById('sq-prompt').textContent = c.japanese;
    document.getElementById('sq-sub').textContent = '';
    document.getElementById('sq-answer-main').textContent = c.english;
    document.getElementById('sq-answer-pron').textContent = c.pronunciation;
    document.getElementById('sq-answer-notes').textContent = c.notes || '';
    document.getElementById('sq-counter').textContent = (this.currentIndex + 1) + ' / ' + this.currentCards.length;
    document.getElementById('sq-answer').classList.add('hidden');
    document.getElementById('sq-reveal').classList.remove('hidden');
    document.getElementById('sq-reveal').textContent = 'Tap to reveal';
    document.getElementById('sq-continue').classList.add('hidden');
  },

  nextSelfQuiz: function() { this.currentIndex++; this.renderSelfQuiz(); },

  // Multiple choice
  getMCPool: function(card) {
    // If it's a kana card, use only known kana as choices
    // If it's a vocab card, use known vocab as choices
    var isKana = card.key.indexOf('vocab') === -1 && card.key.indexOf('wiki') === -1;
    var pool = [];
    for (var u = 0; u <= this.currentUnit.index; u++) {
      if (isKana) {
        pool = pool.concat(this.units[u].newKanaCards);
      } else {
        pool = pool.concat(this.units[u].newVocabCards);
      }
    }
    return pool;
  },

  renderMC: function() {
    if (this.currentIndex >= this.currentCards.length) { this.endSession(); return; }
    var self = this;
    var c = this.currentCards[this.currentIndex];

    // For vocab cards at mastery 10+, switch to typing romaji instead of MC
    var isVocab = c.key.indexOf('vocab') !== -1 || c.key.indexOf('wiki') !== -1;
    if (isVocab && Storage.getMasteryLevel(c.key) >= 10) {
      // Render as typing question (show English, type romaji)
      document.getElementById('typ-prompt').textContent = c.english;
      document.getElementById('typ-sub').textContent = 'Type the romaji';
      document.getElementById('typ-counter').textContent = (this.currentIndex + 1) + ' / ' + this.currentCards.length;
      document.getElementById('typ-input').value = '';
      document.getElementById('typ-input-row').classList.remove('hidden');
      document.getElementById('typ-result').classList.add('hidden');
      // Temporarily switch mode for checkTyping
      this._savedMode = this.currentMode;
      this.currentMode = 'typing-en-to-jp';
      this._returnToMC = true;
      this.showView('typing');
      document.getElementById('typ-input').focus();
      return;
    }

    document.getElementById('mc-prompt').textContent = c.english;
    var isKana = !isVocab;
    document.getElementById('mc-sub').textContent = isKana ? 'Choose the correct character' : 'Choose the correct word';
    document.getElementById('mc-counter').textContent = (this.currentIndex + 1) + ' / ' + this.currentCards.length;
    document.getElementById('mc-help').className = 'quiz-help-btn' + (isVocab ? '' : ' hidden');

    var pool = this.getMCPool(c);
    var wrongs = [];
    for (var i = 0; i < pool.length; i++) {
      if (pool[i].key !== c.key && pool[i].japanese !== c.japanese) wrongs.push(pool[i]);
    }
    this.shuffle(wrongs);
    // Need at least 3 wrongs for 4 choices; if not enough, pad from all kana
    if (wrongs.length < 3) {
      var allKana = [];
      for (var u = 0; u < this.units.length; u++) allKana = allKana.concat(this.units[u].newKanaCards);
      this.shuffle(allKana);
      allKana.forEach(function(k) {
        if (wrongs.length < 3 && k.key !== c.key && k.japanese !== c.japanese) wrongs.push(k);
      });
    }
    var choices = [c].concat(wrongs.slice(0, 3));
    this.shuffle(choices);

    var container = document.getElementById('mc-choices');
    container.innerHTML = '';

    choices.forEach(function(ch) {
      var btn = document.createElement('button');
      btn.className = 'mc-choice';
      btn.textContent = ch.japanese;
      btn.onclick = function() { self.checkMC(ch, c, container); };
      container.appendChild(btn);
    });
  },

  checkMC: function(chosen, correct, container) {
    var self = this;
    var ok = chosen.key === correct.key;
    this.recordResult(ok);

    var btns = container.querySelectorAll('.mc-choice');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.add('disabled');
      if (btns[i].textContent === correct.japanese) {
        btns[i].classList.add('correct');
        btns[i].innerHTML = correct.japanese + '<span class="mc-romaji">' + correct.romaji + '</span>';
      } else if (btns[i].textContent === chosen.japanese && !ok) {
        btns[i].classList.add('wrong');
      }
    }

    // Auto-advance after 500ms
    setTimeout(function() {
      self.currentIndex++;
      self.renderMC();
    }, ok ? 500 : 1200);
  },

  renderTyping: function() {
    if (this.currentIndex >= this.currentCards.length) { this.endSession(); return; }
    var c = this.currentCards[this.currentIndex];
    var enToJp = this.currentMode === 'typing-en-to-jp';
    var isVocab = c.key.indexOf('vocab') !== -1 || c.key.indexOf('wiki') !== -1;
    document.getElementById('typ-prompt').textContent = enToJp ? c.english : c.japanese;
    document.getElementById('typ-sub').textContent = enToJp ? 'Type the romaji' : 'Type the English meaning';
    document.getElementById('typ-counter').textContent = (this.currentIndex + 1) + ' / ' + this.currentCards.length;
    document.getElementById('typ-help').className = 'quiz-help-btn' + (isVocab ? '' : ' hidden');
    document.getElementById('typ-input').value = '';
    document.getElementById('typ-input-row').classList.remove('hidden');
    document.getElementById('typ-result').classList.add('hidden');
    document.getElementById('typ-input').focus();
  },

  checkTyping: function() {
    var self = this;
    var c = this.currentCards[this.currentIndex];
    var answer = document.getElementById('typ-input').value.trim().toLowerCase();
    var enToJp = this.currentMode === 'typing-en-to-jp';
    var correct = enToJp ? c.romaji.toLowerCase() : c.english.toLowerCase();
    var display = enToJp ? c.romaji + ' (' + c.japanese + ')' : c.english;
    var ok = this.fuzzyMatch(answer, correct);
    this.recordResult(ok);

    var goNext = function() {
      self.currentIndex++;
      if (self._returnToMC) {
        self._returnToMC = false;
        self.currentMode = self._savedMode || 'typing-en-to-jp';
        self.showView('mc');
        self.renderMC();
      } else {
        self.renderTyping();
      }
    };

    if (ok) {
      var input = document.getElementById('typ-input');
      input.style.borderColor = 'var(--green)';
      input.style.background = 'rgba(74,124,89,0.1)';
      setTimeout(function() {
        input.style.borderColor = '';
        input.style.background = '';
        goNext();
      }, 500);
    } else {
      document.getElementById('typ-status').textContent = 'Incorrect';
      document.getElementById('typ-status').className = 'result-status incorrect';
      document.getElementById('typ-correct').textContent = 'Answer: ' + display;
      document.getElementById('typ-notes').textContent = c.notes || '';
      document.getElementById('typ-input-row').classList.add('hidden');
      document.getElementById('typ-result').classList.remove('hidden');
    }
  },

  fuzzyMatch: function(user, correct) {
    if (!user) return false;
    if (user === correct) return true;
    var clean = function(s) { return s.replace(/[^a-z0-9]/g, ''); };
    if (clean(user) === clean(correct)) return true;
    if (correct.indexOf('/') !== -1) {
      var parts = correct.split('/');
      for (var i = 0; i < parts.length; i++) {
        if (clean(user) === clean(parts[i].trim().toLowerCase())) return true;
      }
    }
    return false;
  },

  recordResult: function(ok) {
    if (this._skipCurrentQuestion) {
      this._skipCurrentQuestion = false;
      return; // Don't count this question
    }
    var c = this.currentCards[this.currentIndex];
    Storage.recordReview(c.key, ok);
    this.sessionTotal++;
    if (ok) this.sessionCorrect++;
  },

  renderQuizPreview: function(cards) {
    var preview = document.getElementById('quiz-preview');
    preview.innerHTML = '';

    // Deduplicate and show only vocab
    var seen = new Set();
    var vocabItems = [];
    cards.forEach(function(c) {
      if (seen.has(c.key)) return;
      seen.add(c.key);
      if (c.key.indexOf('vocab') !== -1 || c.key.indexOf('wiki') !== -1) vocabItems.push(c);
    });

    var self = this;
    vocabItems.forEach(function(c) {
      var chip = document.createElement('span');
      chip.className = 'qp-chip clickable';
      chip.innerHTML = c.japanese + '<span class="qp-sub">' + c.english + '</span>';
      (function(card) { chip.onclick = function() { self.showWordModal(card); }; })(c);
      preview.appendChild(chip);
    });
  },

  exitSession: function() {
    this.isExam = false;
    this._returnToMC = false;
    this._skipCurrentQuestion = false;
    this._pendingMode = null;
    this._savedMode = null;
    this.openUnit(this.currentUnit);
  },

  endSession: function() {
    this._returnToMC = false;
    this._skipCurrentQuestion = false;
    this._pendingMode = null;
    this._savedMode = null;
    if (this.sessionTotal > 0 && this.currentUnit) {
      var label = this.isExam ? this.currentUnit.name + ' Exam' : this.currentUnit.name;
      Storage.recordSession(this.currentMode, label, this.sessionCorrect, this.sessionTotal);
    }
    var pct = this.sessionTotal > 0 ? Math.round((this.sessionCorrect / this.sessionTotal) * 100) : 0;

    if (this.isExam) {
      if (pct >= 80) {
        Storage.passExam('unit-' + (this.currentUnit.index + 1));
        document.getElementById('complete-heading').textContent = 'Exam Passed!';
      } else {
        document.getElementById('complete-heading').textContent = 'Exam Failed';
      }
    } else {
      document.getElementById('complete-heading').textContent = 'Session Complete';
    }

    document.getElementById('complete-score').textContent = pct + '%';
    var detail = this.sessionCorrect + ' / ' + this.sessionTotal + ' correct';
    if (this.isExam && pct < 80) detail += ' \u2014 Need 80% to pass';
    if (this.isExam && pct >= 80) detail += ' \u2014 Next unit unlocked!';
    document.getElementById('complete-detail').textContent = detail;

    this.isExam = false;

    // Show 2 bonus unseen vocab words as a teach intro before complete screen
    var bonus = this.getBonusVocab();
    if (bonus.length > 0) {
      this._bonusCards = bonus;
      this._bonusIndex = 0;
      this._afterBonus = 'complete';
      this.renderBonusTeach();
      this.showView('teach');
    } else {
      this.showView('complete');
    }
    // Sync to cloud after session
    Storage.syncToCloud();
  },

  renderBonusTeach: function() {
    var c = this._bonusCards[this._bonusIndex];
    document.getElementById('teach-label').textContent = 'New Word Preview ' + (this._bonusIndex + 1) + ' of ' + this._bonusCards.length;
    document.getElementById('teach-char').textContent = c.japanese;
    document.getElementById('teach-rom').textContent = c.english;
    document.getElementById('teach-notes').textContent = c.romaji;
    document.getElementById('teach-counter').textContent = (this._bonusIndex + 1) + ' / ' + this._bonusCards.length;
    document.getElementById('teach-next').textContent = this._bonusIndex < this._bonusCards.length - 1 ? 'Next' : 'Done';
    // Mark as introduced (level 1)
    Storage.recordReview(c.key, true);
  },

  shuffle: function(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
};

document.addEventListener('DOMContentLoaded', function() { App.init(); });
