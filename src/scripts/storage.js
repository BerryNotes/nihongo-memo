// Local storage wrapper for progress tracking
const Storage = {
  KEYS: {
    PROGRESS: 'nihongo-progress',
    SESSIONS: 'nihongo-sessions',
    STREAK: 'nihongo-streak'
  },

  // Get all word progress data
  getProgress() {
    const data = localStorage.getItem(this.KEYS.PROGRESS);
    return data ? JSON.parse(data) : {};
  },

  // Get progress for a specific word by its unique key
  getWordProgress(wordKey) {
    const progress = this.getProgress();
    return progress[wordKey] || { correct: 0, incorrect: 0, lastSeen: null };
  },

  // Record a review result for a word
  recordReview(wordKey, isCorrect) {
    const progress = this.getProgress();
    if (!progress[wordKey]) {
      progress[wordKey] = { correct: 0, incorrect: 0, lastSeen: null };
    }
    if (isCorrect) {
      progress[wordKey].correct++;
    } else {
      progress[wordKey].incorrect++;
    }
    progress[wordKey].lastSeen = new Date().toISOString();
    localStorage.setItem(this.KEYS.PROGRESS, JSON.stringify(progress));
  },

  // Check if a word is mastered (5+ correct answers)
  isMastered(wordKey) {
    const wp = this.getWordProgress(wordKey);
    return wp.correct >= 5;
  },

  // Get overall stats
  getStats() {
    const progress = this.getProgress();
    const keys = Object.keys(progress);
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let mastered = 0;

    keys.forEach(key => {
      totalCorrect += progress[key].correct;
      totalIncorrect += progress[key].incorrect;
      if (progress[key].correct >= 5) mastered++;
    });

    const totalReviews = totalCorrect + totalIncorrect;
    const accuracy = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;

    return {
      totalWords: keys.length,
      mastered,
      accuracy,
      totalReviews,
      totalCorrect,
      totalIncorrect
    };
  },

  // Get hardest words (highest incorrect ratio)
  getHardestWords(limit = 10) {
    const progress = this.getProgress();
    return Object.entries(progress)
      .filter(([, p]) => p.correct + p.incorrect >= 2)
      .map(([key, p]) => ({
        key,
        correct: p.correct,
        incorrect: p.incorrect,
        ratio: p.incorrect / (p.correct + p.incorrect)
      }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, limit);
  },

  // Get deck progress percentage
  getDeckProgress(wordKeys) {
    const progress = this.getProgress();
    if (wordKeys.length === 0) return 0;
    const mastered = wordKeys.filter(k => progress[k] && progress[k].correct >= 5).length;
    return Math.round((mastered / wordKeys.length) * 100);
  },

  // Session tracking
  getSessions() {
    const data = localStorage.getItem(this.KEYS.SESSIONS);
    return data ? JSON.parse(data) : [];
  },

  recordSession(mode, deckName, correct, total) {
    const sessions = this.getSessions();
    sessions.unshift({
      date: new Date().toISOString(),
      mode,
      deck: deckName,
      correct,
      total
    });
    // Keep last 50 sessions
    if (sessions.length > 50) sessions.length = 50;
    localStorage.setItem(this.KEYS.SESSIONS, JSON.stringify(sessions));
  },

  // Streak tracking
  getStreak() {
    const data = localStorage.getItem(this.KEYS.STREAK);
    if (!data) return { current: 0, lastDate: null };
    return JSON.parse(data);
  },

  updateStreak() {
    const streak = this.getStreak();
    const today = new Date().toISOString().split('T')[0];

    if (streak.lastDate === today) return streak.current;

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (streak.lastDate === yesterday) {
      streak.current++;
    } else {
      streak.current = 1;
    }
    streak.lastDate = today;
    localStorage.setItem(this.KEYS.STREAK, JSON.stringify(streak));
    return streak.current;
  },

  // Reset all data
  resetAll() {
    localStorage.removeItem(this.KEYS.PROGRESS);
    localStorage.removeItem(this.KEYS.SESSIONS);
    localStorage.removeItem(this.KEYS.STREAK);
  }
};
