// Progress sync API — save/load user progress to D1

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }
  });
}

async function getUser(db, sessionId) {
  if (!sessionId) return null;
  const row = await db.prepare('SELECT s.user_id, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > datetime(\'now\')').bind(sessionId).first();
  return row;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  const body = await request.json();
  const action = body.action;
  const session = body.session;

  const user = await getUser(db, session);
  if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);
  const userId = user.user_id;

  if (action === 'save') {
    // Save all mastery data
    const mastery = body.mastery || {};
    const keys = Object.keys(mastery);

    // Batch upsert
    for (const key of keys) {
      const m = mastery[key];
      await db.prepare(
        'INSERT INTO progress (user_id, card_key, level, correct, incorrect, last_seen) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, card_key) DO UPDATE SET level=?, correct=?, incorrect=?, last_seen=?'
      ).bind(userId, key, m.level, m.correct, m.incorrect, m.lastSeen, m.level, m.correct, m.incorrect, m.lastSeen).run();
    }

    // Save exams
    const exams = body.exams || {};
    for (const unitId of Object.keys(exams)) {
      await db.prepare(
        'INSERT INTO exam_passes (user_id, unit_id, passed_at) VALUES (?, ?, ?) ON CONFLICT(user_id, unit_id) DO NOTHING'
      ).bind(userId, unitId, exams[unitId]).run();
    }

    // Save streak
    if (body.streak) {
      await db.prepare(
        'INSERT INTO streak (user_id, current, last_date) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET current=?, last_date=?'
      ).bind(userId, body.streak.current, body.streak.lastDate, body.streak.current, body.streak.lastDate).run();
    }

    return jsonResponse({ ok: true });
  }

  if (action === 'load') {
    // Load all progress
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

    return jsonResponse({ ok: true, mastery, exams, streak });
  }

  return jsonResponse({ error: 'Unknown action' }, 400);
}
