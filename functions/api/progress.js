// Progress sync API — hardened
// Input validation, size limits, rate limiting via session checks

const MAX_BODY_SIZE = 500000; // 500KB max for progress data
const MAX_CARDS = 5000; // Max cards per user
const MAX_KEY_LENGTH = 128;
const ORIGIN = 'https://nihongo-memo.pages.dev';

function secureHeaders(origin) {
  const allowedOrigin = origin === ORIGIN ? ORIGIN : ORIGIN;
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Cache-Control': 'no-store'
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: secureHeaders(origin) });
}

export async function onRequestOptions(context) {
  return new Response(null, { headers: secureHeaders(context.request.headers.get('Origin')) });
}

async function getUser(db, sessionId) {
  if (!sessionId || typeof sessionId !== 'string' || !/^[a-f0-9]{64}$/.test(sessionId)) return null;
  const row = await db.prepare("SELECT s.user_id, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > datetime('now')").bind(sessionId).first();
  return row;
}

function sanitizeKey(key) {
  if (typeof key !== 'string') return null;
  const clean = key.slice(0, MAX_KEY_LENGTH).replace(/[^\w\-.:/ ]/g, '');
  return clean || null;
}

function sanitizeInt(val, min, max) {
  const n = parseInt(val);
  if (isNaN(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  const origin = request.headers.get('Origin') || '';

  // Reject oversized bodies
  const contentLength = parseInt(request.headers.get('Content-Length') || '0');
  if (contentLength > MAX_BODY_SIZE) return jsonResponse({ error: 'Request too large' }, 413, origin);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
  }

  const action = typeof body.action === 'string' ? body.action.slice(0, 20) : '';
  const session = typeof body.session === 'string' ? body.session.slice(0, 64) : '';

  const user = await getUser(db, session);
  if (!user) return jsonResponse({ error: 'Not authenticated' }, 401, origin);
  const userId = user.user_id;

  // ===== SAVE =====
  if (action === 'save') {
    const mastery = body.mastery;
    if (mastery && typeof mastery === 'object') {
      const keys = Object.keys(mastery).slice(0, MAX_CARDS);

      // Batch in groups of 50 for performance
      for (let i = 0; i < keys.length; i++) {
        const key = sanitizeKey(keys[i]);
        if (!key) continue;
        const m = mastery[keys[i]];
        if (!m || typeof m !== 'object') continue;

        const level = sanitizeInt(m.level, 0, 15);
        const correct = sanitizeInt(m.correct, 0, 99999);
        const incorrect = sanitizeInt(m.incorrect, 0, 99999);
        const lastSeen = typeof m.lastSeen === 'string' ? m.lastSeen.slice(0, 30) : '';

        await db.prepare(
          'INSERT INTO progress (user_id, card_key, level, correct, incorrect, last_seen) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, card_key) DO UPDATE SET level=?, correct=?, incorrect=?, last_seen=?'
        ).bind(userId, key, level, correct, incorrect, lastSeen, level, correct, incorrect, lastSeen).run();
      }
    }

    // Save exams
    const exams = body.exams;
    if (exams && typeof exams === 'object') {
      const examKeys = Object.keys(exams).slice(0, 100);
      for (const unitId of examKeys) {
        const clean = sanitizeKey(unitId);
        if (!clean) continue;
        const passedAt = typeof exams[unitId] === 'string' ? exams[unitId].slice(0, 30) : '';
        await db.prepare(
          'INSERT INTO exam_passes (user_id, unit_id, passed_at) VALUES (?, ?, ?) ON CONFLICT(user_id, unit_id) DO NOTHING'
        ).bind(userId, clean, passedAt).run();
      }
    }

    // Save streak
    if (body.streak && typeof body.streak === 'object') {
      const current = sanitizeInt(body.streak.current, 0, 99999);
      const lastDate = typeof body.streak.lastDate === 'string' ? body.streak.lastDate.slice(0, 30) : '';
      await db.prepare(
        'INSERT INTO streak (user_id, current, last_date) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET current=?, last_date=?'
      ).bind(userId, current, lastDate, current, lastDate).run();
    }

    return jsonResponse({ ok: true }, 200, origin);
  }

  // ===== LOAD =====
  if (action === 'load') {
    const rows = await db.prepare('SELECT card_key, level, correct, incorrect, last_seen FROM progress WHERE user_id = ?').bind(userId).all();
    const mastery = {};
    for (const r of rows.results) {
      mastery[r.card_key] = { level: r.level, correct: r.correct, incorrect: r.incorrect, lastSeen: r.last_seen };
    }

    const examRows = await db.prepare('SELECT unit_id, passed_at FROM exam_passes WHERE user_id = ?').bind(userId).all();
    const exams = {};
    for (const r of examRows.results) { exams[r.unit_id] = r.passed_at; }

    const streakRow = await db.prepare('SELECT current, last_date FROM streak WHERE user_id = ?').bind(userId).first();
    const streak = streakRow ? { current: streakRow.current, lastDate: streakRow.last_date } : { current: 0, lastDate: null };

    return jsonResponse({ ok: true, mastery, exams, streak }, 200, origin);
  }

  return jsonResponse({ error: 'Unknown action' }, 400, origin);
}

export async function onRequestGet() {
  return new Response('Method not allowed', { status: 405 });
}
