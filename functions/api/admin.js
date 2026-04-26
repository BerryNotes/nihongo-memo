// Admin API — restricted to admin users only

const ADMIN_USERNAMES = ['Peter']; // Add admin usernames here

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

function generateToken() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store'
    }
  });
}

async function getAdmin(db, sessionId) {
  if (!sessionId || !/^[a-f0-9]{64}$/.test(sessionId)) return null;
  const row = await db.prepare(
    "SELECT s.user_id, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > datetime('now')"
  ).bind(sessionId).first();
  if (!row || !ADMIN_USERNAMES.includes(row.username)) return null;
  return row;
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const body = await request.json();
    const action = body.action;

    // Admin login (uses same user table but checks admin list)
    if (action === 'login') {
      const { username, password } = body;
      if (!username || !password) return json({ error: 'Required' }, 400);
      if (!ADMIN_USERNAMES.includes(username)) return json({ error: 'Not admin' }, 403);

      const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
      if (!user) return json({ error: 'Invalid credentials' }, 401);

      const [salt, storedHash] = user.password_hash.split(':');
      const inputHash = await hashPassword(password, salt);
      if (!timingSafeEqual(inputHash, storedHash)) return json({ error: 'Invalid credentials' }, 401);

      const sid = generateToken();
      const exp = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4 hour admin sessions
      const ip = request.headers.get('CF-Connecting-IP') || '';
      await db.prepare('INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)').bind(sid, user.id, exp, ip, 'admin').run();

      return json({ ok: true, session: sid });
    }

    // All other actions require admin session
    const admin = await getAdmin(db, body.session);
    if (!admin) return json({ error: 'Not admin' }, 403);

    // Stats
    if (action === 'stats') {
      const users = await db.prepare('SELECT COUNT(*) as c FROM users').first();
      const sessions = await db.prepare('SELECT COUNT(*) as c FROM sessions').first();
      const progress = await db.prepare('SELECT COUNT(*) as c FROM progress').first();
      const rate = await db.prepare('SELECT COUNT(*) as c FROM rate_limits').first();
      return json({
        ok: true,
        users: users.c,
        sessions: sessions.c,
        progress: progress.c,
        rateLimit: rate.c
      });
    }

    // List users
    if (action === 'users') {
      const rows = await db.prepare(`
        SELECT u.id, u.username, u.email, u.created_at, u.last_login, u.failed_attempts, u.locked_until,
               (SELECT COUNT(*) FROM progress p WHERE p.user_id = u.id) as progress_count
        FROM users u ORDER BY u.id
      `).all();
      const users = rows.results.map(u => ({
        ...u,
        is_admin: ADMIN_USERNAMES.includes(u.username)
      }));
      return json({ ok: true, users: users });
    }

    // Edit user
    if (action === 'editUser') {
      const { userId, username, email, password } = body;
      if (!userId) return json({ error: 'User ID required' }, 400);

      if (username) {
        await db.prepare('UPDATE users SET username = ? WHERE id = ?').bind(username, userId).run();
      }
      if (email) {
        await db.prepare('UPDATE users SET email = ? WHERE id = ?').bind(email, userId).run();
      }
      if (password) {
        const salt = generateToken().slice(0, 32);
        const hash = await hashPassword(password, salt);
        await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(salt + ':' + hash, userId).run();
      }
      return json({ ok: true });
    }

    // Delete user
    if (action === 'deleteUser') {
      const { userId } = body;
      if (!userId) return json({ error: 'User ID required' }, 400);
      // Don't allow deleting admin
      const user = await db.prepare('SELECT username FROM users WHERE id = ?').bind(userId).first();
      if (user && ADMIN_USERNAMES.includes(user.username)) return json({ error: 'Cannot delete admin' }, 403);

      await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
      await db.prepare('DELETE FROM progress WHERE user_id = ?').bind(userId).run();
      await db.prepare('DELETE FROM exam_passes WHERE user_id = ?').bind(userId).run();
      await db.prepare('DELETE FROM streak WHERE user_id = ?').bind(userId).run();
      await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
      return json({ ok: true });
    }

    // Unlock user
    if (action === 'unlockUser') {
      const { userId } = body;
      await db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').bind(userId).run();
      return json({ ok: true });
    }

    // Clear rate limits
    if (action === 'clearRateLimits') {
      await db.prepare('DELETE FROM rate_limits').run();
      return json({ ok: true });
    }

    // Purge expired sessions
    if (action === 'purgeSessions') {
      await db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);

  } catch (err) {
    return json({ error: 'Server error: ' + err.message }, 500);
  }
}
