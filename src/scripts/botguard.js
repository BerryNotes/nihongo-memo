// BotGuard — detects automation even in headed Playwright/Puppeteer
// Focuses on BEHAVIOR not browser properties

var BotGuard = {
  _events: [],
  _mouseMovements: 0,
  _keystrokes: 0,
  _scrolls: 0,
  _clicks: 0,
  _startTime: Date.now(),
  _interacted: false,

  init: function() {
    var self = this;

    // Track mouse movements (bots don't move mouse naturally)
    document.addEventListener('mousemove', function(e) {
      self._mouseMovements++;
      self._interacted = true;
      if (self._events.length < 20) {
        self._events.push({ t: Date.now() - self._startTime, x: e.clientX, y: e.clientY });
      }
    });

    // Track keystrokes (bots type instantly, humans have variable gaps)
    document.addEventListener('keydown', function() {
      self._keystrokes++;
      self._interacted = true;
    });

    // Track scroll
    document.addEventListener('scroll', function() {
      self._scrolls++;
      self._interacted = true;
    });

    // Track clicks
    document.addEventListener('click', function() {
      self._clicks++;
    });
  },

  // Analyze mouse movement patterns
  _analyzeMouseEntropy: function() {
    if (this._events.length < 5) return 0;
    // Real humans have irregular mouse paths with curves
    // Bots move in straight lines or teleport
    var totalAngleChange = 0;
    for (var i = 2; i < this._events.length; i++) {
      var dx1 = this._events[i-1].x - this._events[i-2].x;
      var dy1 = this._events[i-1].y - this._events[i-2].y;
      var dx2 = this._events[i].x - this._events[i-1].x;
      var dy2 = this._events[i].y - this._events[i-1].y;
      var angle1 = Math.atan2(dy1, dx1);
      var angle2 = Math.atan2(dy2, dx2);
      totalAngleChange += Math.abs(angle2 - angle1);
    }
    return totalAngleChange;
  },

  // Generate proof — server validates this
  generate: function() {
    var elapsed = Date.now() - this._startTime;
    var entropy = this._analyzeMouseEntropy();

    // Proof of work — takes ~50-200ms for humans, acceptable
    // Bots doing thousands of requests eat CPU
    var challenge = Date.now().toString(36) + Math.random().toString(36);
    var nonce = 0;
    function hash(s) {
      var h = 2166136261;
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return (h >>> 0).toString(16).padStart(8, '0');
    }
    while (nonce < 500000) {
      if (hash(challenge + ':' + nonce).startsWith('000')) break;
      nonce++;
    }

    return {
      f: (navigator.webdriver ? 1 : 0) |
         (navigator.plugins.length === 0 ? 2 : 0) |
         (/HeadlessChrome/i.test(navigator.userAgent) ? 4 : 0),
      mm: this._mouseMovements,
      ks: this._keystrokes,
      sc: this._scrolls,
      cl: this._clicks,
      me: Math.round(entropy * 100) / 100,
      el: elapsed,
      c: challenge,
      n: nonce,
      h: hash(challenge + ':' + nonce),
      sw: screen.width,
      sh: screen.height,
      hw: navigator.hardwareConcurrency || 0
    };
  },

  // Quick check — is this probably a bot?
  isSuspicious: function() {
    var elapsed = Date.now() - this._startTime;
    // No interaction at all after 1 second = suspicious
    if (elapsed > 1000 && !this._interacted) return true;
    // No mouse movement at all when submitting a form = suspicious
    if (this._mouseMovements < 2 && this._keystrokes < 3) return true;
    return false;
  }
};

// Start tracking immediately
BotGuard.init();
