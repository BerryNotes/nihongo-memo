// Auth API — register, login, logout
// Uses Web Crypto for password hashing (no dependencies)

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: encoder.encode(salt),
    iterations: 100000,
    hash: 'SHA-256'
  }, keyMaterial, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

function generateId() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

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

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  const body = await request.json();
  const action = body.action;

  if (action === 'register') {
    const { email, username, password } = body;

    // Validation
    if (!email || !username || !password) return jsonResponse({ error: 'All fields required' }, 400);
    if (password.length < 8) return jsonResponse({ error: 'Password must be at least 8 characters' }, 400);
    if (username.length < 3) return jsonResponse({ error: 'Username must be at least 3 characters' }, 400);
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return jsonResponse({ error: 'Invalid email' }, 400);
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return jsonResponse({ error: 'Username can only contain letters, numbers, _ and -' }, 400);

    // Check existing
    const existing = await db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').bind(email, username).first();
    if (existing) return jsonResponse({ error: 'Email or username already taken' }, 409);

    // Hash password
    const salt = generateId().slice(0, 16);
    const hash = await hashPassword(password, salt);
    const passwordHash = salt + ':' + hash;

    // Create user
    await db.prepare('INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)').bind(email, username, passwordHash).run();
    const user = await db.prepare('SELECT id, username, email FROM users WHERE email = ?').bind(email).first();

    // Create session
    const sessionId = generateId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = request.headers.get('User-Agent') || '';
    await db.prepare('INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)').bind(sessionId, user.id, expiresAt, ip, ua).run();

    return jsonResponse({ ok: true, session: sessionId, user: { id: user.id, username: user.username, email: user.email } });
  }

  if (action === 'login') {
    const { email, password } = body;
    if (!email || !password) return jsonResponse({ error: 'Email and password required' }, 400);

    const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (!user) return jsonResponse({ error: 'Invalid email or password' }, 401);

    // Check if locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return jsonResponse({ error: 'Account locked. Try again later.' }, 423);
    }

    // Verify password
    const [salt, storedHash] = user.password_hash.split(':');
    const inputHash = await hashPassword(password, salt);

    if (inputHash !== storedHash) {
      // Increment failed attempts
      const attempts = (user.failed_attempts || 0) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
      await db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').bind(attempts, lockUntil, user.id).run();
      return jsonResponse({ error: 'Invalid email or password' }, 401);
    }

    // Reset failed attempts
    await db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = datetime(\'now\') WHERE id = ?').bind(user.id).run();

    // Create session
    const sessionId = generateId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = request.headers.get('User-Agent') || '';
    await db.prepare('INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)').bind(sessionId, user.id, expiresAt, ip, ua).run();

    return jsonResponse({ ok: true, session: sessionId, user: { id: user.id, username: user.username, email: user.email } });
  }

  if (action === 'logout') {
    const session = body.session;
    if (session) await db.prepare('DELETE FROM sessions WHERE id = ?').bind(session).run();
    return jsonResponse({ ok: true });
  }

  if (action === 'verify') {
    const session = body.session;
    if (!session) return jsonResponse({ error: 'No session' }, 401);
    const row = await db.prepare('SELECT s.*, u.username, u.email FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > datetime(\'now\')').bind(session).first();
    if (!row) return jsonResponse({ error: 'Invalid session' }, 401);
    return jsonResponse({ ok: true, user: { id: row.user_id, username: row.username, email: row.email } });
  }

  return jsonResponse({ error: 'Unknown action' }, 400);
}
