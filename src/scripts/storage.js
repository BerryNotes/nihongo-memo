// Mastery levels: 0-15
// 0 = never seen, 15 = fully mastered
// On correct: +1 (max 15)
// On incorrect: -2 (min 0)
// Mastered at level 15 (~15 correct answers needed)

var Storage = {
  KEYS: {
    MASTERY: 'nihongo-mastery',
    SESSIONS: 'nihongo-sessions',
    STREAK: 'nihongo-streak',
    EXAMS: 'nihongo-exams'
  },

  // Get all mastery data { key: { level, correct, incorrect, lastSeen } }
  getAllMastery: function() {
    var data = localStorage.getItem(this.KEYS.MASTERY);
    return data ? JSON.parse(data) : {};
  },

  getMastery: function(key) {
    var all = this.getAllMastery();
    return all[key] || { level: 0, correct: 0, incorrect: 0, lastSeen: null };
  },

  getMasteryLevel: function(key) {
    return this.getMastery(key).level;
  },

  recordReview: function(key, isCorrect) {
    var all = this.getAllMastery();
    if (!all[key]) all[key] = { level: 0, correct: 0, incorrect: 0, lastSeen: null };
    var m = all[key];
    if (isCorrect) {
      m.correct++;
      m.level = Math.min(15, m.level + 1);
    } else {
      m.incorrect++;
      m.level = Math.max(0, m.level - 2);
    }
    m.lastSeen = new Date().toISOString();
    localStorage.setItem(this.KEYS.MASTERY, JSON.stringify(all));
  },

  // Is a card mastered (level 5)?
  isMastered: function(key) {
    return this.getMasteryLevel(key) >= 15;
  },

  // Average mastery percentage across all cards (0-100)
  getUnitProgress: function(keys) {
    if (keys.length === 0) return 0;
    var all = this.getAllMastery();
    var totalLevel = 0;
    for (var i = 0; i < keys.length; i++) {
      if (all[keys[i]]) totalLevel += Math.min(15, all[keys[i]].level);
    }
    return Math.round((totalLevel / (keys.length * 15)) * 100);
  },

  // Build a weighted card list for review
  // Cards with lower mastery appear more often
  // Returns a shuffled array with repetitions based on weight
  buildReviewDeck: function(cards, maxCards) {
    var all = this.getAllMastery();
    var weighted = [];

    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var m = all[c.key] ? all[c.key].level : 0;
      // Weight: lower mastery = more copies. Level 0 = 5, level 15 = 1
      var copies = Math.max(1, 5 - Math.floor(m / 3));
      for (var j = 0; j < copies; j++) {
        weighted.push(c);
      }
    }

    // Shuffle
    for (var i = weighted.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = weighted[i]; weighted[i] = weighted[j]; weighted[j] = t;
    }

    // Deduplicate adjacent same cards, then cap
    var result = [];
    var lastKey = null;
    for (var i = 0; i < weighted.length; i++) {
      if (weighted[i].key !== lastKey) {
        result.push(weighted[i]);
        lastKey = weighted[i].key;
      }
    }

    // Cap at maxCards
    if (maxCards && result.length > maxCards) {
      result = result.slice(0, maxCards);
    }

    return result;
  },

  // Overall stats
  getStats: function() {
    var all = this.getAllMastery();
    var keys = Object.keys(all);
    var totalCorrect = 0, totalIncorrect = 0, mastered = 0;
    for (var i = 0; i < keys.length; i++) {
      var m = all[keys[i]];
      totalCorrect += m.correct;
      totalIncorrect += m.incorrect;
      if (m.level >= 15) mastered++;
    }
    var total = totalCorrect + totalIncorrect;
    return {
      totalWords: keys.length,
      mastered: mastered,
      accuracy: total > 0 ? Math.round((totalCorrect / total) * 100) : 0,
      totalReviews: total
    };
  },

  // Sessions
  getSessions: function() {
    var data = localStorage.getItem(this.KEYS.SESSIONS);
    return data ? JSON.parse(data) : [];
  },

  recordSession: function(mode, deckName, correct, total) {
    var sessions = this.getSessions();
    sessions.unshift({ date: new Date().toISOString(), mode: mode, deck: deckName, correct: correct, total: total });
    if (sessions.length > 50) sessions.length = 50;
    localStorage.setItem(this.KEYS.SESSIONS, JSON.stringify(sessions));
  },

  // Streak
  getStreak: function() {
    var data = localStorage.getItem(this.KEYS.STREAK);
    if (!data) return { current: 0, lastDate: null };
    return JSON.parse(data);
  },

  updateStreak: function() {
    var streak = this.getStreak();
    var today = new Date().toISOString().split('T')[0];
    if (streak.lastDate === today) return streak.current;
    var yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (streak.lastDate === yesterday) { streak.current++; }
    else { streak.current = 1; }
    streak.lastDate = today;
    localStorage.setItem(this.KEYS.STREAK, JSON.stringify(streak));
    return streak.current;
  },

  // Exam pass tracking
  isExamPassed: function(unitId) {
    var data = localStorage.getItem(this.KEYS.EXAMS);
    var exams = data ? JSON.parse(data) : {};
    return !!exams[unitId];
  },

  passExam: function(unitId) {
    var data = localStorage.getItem(this.KEYS.EXAMS);
    var exams = data ? JSON.parse(data) : {};
    exams[unitId] = new Date().toISOString();
    localStorage.setItem(this.KEYS.EXAMS, JSON.stringify(exams));
  },

  resetAll: function() {
    localStorage.removeItem(this.KEYS.MASTERY);
    localStorage.removeItem(this.KEYS.SESSIONS);
    localStorage.removeItem(this.KEYS.STREAK);
    localStorage.removeItem(this.KEYS.EXAMS);
  }
};
