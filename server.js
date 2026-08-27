/* ============================================================
   TASKVAULT GAME SERVER
   Static file host + WebSocket matchmaking & match relay.
   Same origin serves the pages and /ws, so the browser can use
   a relative wss:// URL and never needs to know the host.
   ============================================================ */
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');
const { WebSocketServer } = require('ws');
const Maps = require('../assets/maps.js');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;

/* ---------------- STATIC ---------------- */
const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',   '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml',
  '.ico':'image/x-icon', '.md':'text/markdown; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(url.parse(req.url).pathname);
  if (p === '/') p = '/dashboard.html';
  if (p === '/health') {
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ ok:true, online: clients.size, queues: queueSummary() }));
  }
  const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, {'Content-Type':'text/plain'}); return res.end('404'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

/* ---------------- STATE ---------------- */
const wss = new WebSocketServer({ server, path: '/ws' });

const clients = new Map();   // ws -> player
const queues  = new Map();   // key -> [player]
const matches = new Map();   // id -> match

const QUEUE_MS   = 5 * 60 * 1000;   // 5 minute search window
const BOT_OFFER  = 25 * 1000;       // offer bot fill after 25s
const TICK_MS    = 50;              // 20 Hz relay
const MATCH_SECS = 300;

let nextId = 1;
const uid = () => 'p' + (nextId++);
const now = () => Date.now();

function send(ws, type, data) {
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify({ ...data, type })); } catch (e) {}
  }
}
function queueKey(q) { return `${q.type}|${q.map}|${q.gameMode}`; }
function queueSummary() {
  const o = {};
  for (const [k, arr] of queues) o[k] = arr.length;
  return o;
}

/* ---------------- MATCHMAKING ---------------- */
function enqueue(p, prefs) {
  dequeue(p);
  p.prefs = prefs;
  p.queuedAt = now();
  const key = queueKey(prefs);
  if (!queues.has(key)) queues.set(key, []);
  queues.get(key).push(p);
  p.queueKey = key;
  broadcastQueue(key);
  tryForm(key);
}

function dequeue(p) {
  if (!p.queueKey) return;
  const arr = queues.get(p.queueKey);
  if (arr) {
    const i = arr.indexOf(p);
    if (i >= 0) arr.splice(i, 1);
    if (!arr.length) queues.delete(p.queueKey);
    else broadcastQueue(p.queueKey);
  }
  p.queueKey = null;
}

function broadcastQueue(key) {
  const arr = queues.get(key) || [];
  const need = arr.length ? arr[0].prefs.size * 2 : 0;
  arr.forEach(p => send(p.ws, 'queue', {
    found: arr.length,
    need,
    waited: Math.floor((now() - p.queuedAt) / 1000),
    limit: QUEUE_MS / 1000,
    names: arr.map(x => x.name),
    canBots: (now() - p.queuedAt) > BOT_OFFER
  }));
}

function tryForm(key) {
  const arr = queues.get(key);
  if (!arr || !arr.length) return;
  const need = arr[0].prefs.size * 2;
  if (arr.length < need) return;
  const group = arr.splice(0, need);
  if (!arr.length) queues.delete(key);
  group.forEach(p => { p.queueKey = null; });
  startMatch(group, group[0].prefs, 0);
}

/* fill the remaining slots with bots and start now */
function startWithBots(p) {
  if (!p.queueKey) return;
  const key = p.queueKey;
  const arr = queues.get(key) || [];
  const need = p.prefs.size * 2;
  const group = arr.splice(0, Math.min(need, arr.length));
  if (!arr.length) queues.delete(key); else broadcastQueue(key);
  group.forEach(x => { x.queueKey = null; });
  startMatch(group, p.prefs, need - group.length);
}

/* queue watchdog: tick the countdown, expire at 5 minutes */
setInterval(() => {
  for (const [key, arr] of [...queues]) {
    broadcastQueue(key);
    for (const p of [...arr]) {
      if (now() - p.queuedAt > QUEUE_MS) {
        send(p.ws, 'queueTimeout', {});
        dequeue(p);
      }
    }
  }
}, 1000);

/* ---------------- MATCH ---------------- */
const BOT_NAMES = ['ShooterKing','ProGamer','HeadShotX','FireLegend','NoScope','SilentK',
                   'RushB','Vortex','Blaze','Nightowl','Reaper','Falcon','Kaiju','Havoc'];

function startMatch(group, prefs, botCount) {
  const id = 'm' + (nextId++);
  const grid = Maps.toGrid(prefs.map);

  const slots = [];
  group.forEach((p, i) => slots.push({ kind:'human', player:p, name:p.name, idx:i }));
  const used = new Set(group.map(g => g.name));
  for (let i = 0; i < botCount; i++) {
    let n; do { n = BOT_NAMES[Math.floor(Math.random()*BOT_NAMES.length)]; } while (used.has(n));
    used.add(n);
    slots.push({ kind:'bot', name:n, idx: group.length + i });
  }

  const half = prefs.size;
  slots.forEach((s, i) => { s.team = i < half ? 'A' : 'B'; });

  const match = {
    id, prefs, grid,
    slots,
    entities: {},
    score: { A: 0, B: 0 },
    target: prefs.size === 1 ? 15 : prefs.size === 2 ? 25 : 40,
    endsAt: now() + MATCH_SECS * 1000,
    started: now(),
    over: false
  };

  slots.forEach(s => {
    const sp = Maps.spawn(prefs.map, s.team);
    const jitter = () => (Math.random() - 0.5) * 1.2;
    match.entities[s.name] = {
      name: s.name, team: s.team, kind: s.kind, wasHuman: s.kind === 'human',
      x: sp.x + jitter(), y: sp.y + jitter(), a: s.team === 'A' ? -0.8 : 2.4,
      hp: 100, kills: 0, deaths: 0, dead: false, respawn: 0,
      cd: 0.8 + Math.random(), dir: Math.random() * 6.28
    };
    if (s.kind === 'human') {
      s.player.matchId = id;
      s.player.team = s.team;
    }
  });

  matches.set(id, match);

  slots.filter(s => s.kind === 'human').forEach(s => {
    send(s.player.ws, 'matchFound', {
      matchId: id,
      map: prefs.map, gameMode: prefs.gameMode, matchType: prefs.type,
      target: match.target,
      you: s.name, team: s.team,
      teamA: slots.filter(x => x.team === 'A').map(x => ({ name:x.name, bot: x.kind==='bot' })),
      teamB: slots.filter(x => x.team === 'B').map(x => ({ name:x.name, bot: x.kind==='bot' })),
      duration: MATCH_SECS
    });
  });

  console.log(`[match ${id}] ${prefs.type} on ${prefs.map} — ` +
              `${group.length} human, ${botCount} bot`);
}

function matchOf(p) { return p.matchId ? matches.get(p.matchId) : null; }

function broadcastMatch(m, type, data, except) {
  m.slots.forEach(s => {
    if (s.kind !== 'human' || s.player === except) return;
    send(s.player.ws, type, data);
  });
}

/* ---- bot simulation + state relay ---- */
function solidAt(grid, x, y) {
  const gx = x | 0, gy = y | 0;
  if (gx < 0 || gy < 0 || gx >= 24 || gy >= 24) return true;
  return grid[gy][gx] > 0;
}
function los(grid, a, b) {
  const steps = 26, dx = (b.x-a.x)/steps, dy = (b.y-a.y)/steps;
  for (let i = 1; i < steps; i++) if (solidAt(grid, a.x+dx*i, a.y+dy*i)) return false;
  return true;
}

function stepMatch(m, dt) {
  if (m.over) return;
  const ents = Object.values(m.entities);

  for (const e of ents) {
    if (e.dead) {
      e.respawn -= dt;
      if (e.respawn <= 0) {
        const sp = Maps.spawn(m.prefs.map, e.team);
        e.x = sp.x + (Math.random()-0.5)*1.2;
        e.y = sp.y + (Math.random()-0.5)*1.2;
        e.hp = 100; e.dead = false;
        broadcastMatch(m, 'respawn', { name: e.name, x: e.x, y: e.y });
      }
      continue;
    }
    if (e.kind !== 'bot') continue;

    // pick nearest visible enemy
    let tgt = null, best = 1e9;
    for (const o of ents) {
      if (o.dead || o.team === e.team) continue;
      const d = Math.hypot(o.x-e.x, o.y-e.y);
      if (d < best && d < 12 && los(m.grid, e, o)) { best = d; tgt = o; }
    }

    let ang;
    if (tgt) {
      e.a = Math.atan2(tgt.y-e.y, tgt.x-e.x);
      ang = e.a + (best < 3.5 ? Math.PI : (Math.random()-0.5)*0.9);
    } else {
      // no contact: push toward the middle of the map so fights actually happen
      if (Math.random() < 0.02) {
        const toC = Math.atan2(12 - e.y, 12 - e.x);
        e.dir = Math.random() < 0.6 ? toC + (Math.random()-0.5) : Math.random()*6.283;
      }
      ang = e.dir; e.a = ang;
    }
    const sp = 1.6*dt;
    const nx = e.x + Math.cos(ang)*sp, ny = e.y + Math.sin(ang)*sp;
    if (!solidAt(m.grid, nx, e.y)) e.x = nx; else e.dir = Math.random()*6.283;
    if (!solidAt(m.grid, e.x, ny)) e.y = ny; else e.dir = Math.random()*6.283;

    e.cd -= dt;
    if (e.cd <= 0 && tgt) {
      e.cd = 0.9 + Math.random()*1.5;
      const acc = 0.55 - Math.min(0.3, best/40);
      if (Math.random() < acc) applyDamage(m, tgt, 8 + Math.floor(Math.random()*10), e.name);
    }
  }

  if (now() > m.endsAt) endMatch(m, 'time');
}

function applyDamage(m, target, dmg, byName) {
  if (m.over || target.dead) return;
  target.hp -= dmg;
  broadcastMatch(m, 'hit', { name: target.name, hp: Math.max(0, target.hp), by: byName });
  if (target.hp <= 0) {
    target.dead = true;
    target.deaths++;
    target.respawn = 4 + Math.random()*2;
    const killer = m.entities[byName];
    if (killer && killer.team !== target.team) {
      killer.kills++;
      m.score[killer.team]++;
    }
    broadcastMatch(m, 'kill', {
      killer: byName, victim: target.name,
      score: m.score, kills: killer ? killer.kills : 0
    });
    if (m.score.A >= m.target || m.score.B >= m.target) endMatch(m, 'target');
  }
}

function endMatch(m, reason) {
  if (m.over) return;
  m.over = true;
  const stats = {};
  Object.values(m.entities).forEach(e => {
    stats[e.name] = { kills: e.kills, deaths: e.deaths, team: e.team };
  });
  m.slots.forEach(s => {
    if (s.kind !== 'human') return;
    const e = m.entities[s.name];
    send(s.player.ws, 'matchEnd', {
      reason, score: m.score, target: m.target,
      won: m.score[e.team] > m.score[e.team === 'A' ? 'B' : 'A'],
      you: { kills: e.kills, deaths: e.deaths },
      stats
    });
    s.player.matchId = null;
  });
  console.log(`[match ${m.id}] over (${reason}) ${m.score.A}-${m.score.B}`);
  setTimeout(() => matches.delete(m.id), 5000);
}

/* main tick */
let lastTick = now();
setInterval(() => {
  const t = now();
  const dt = Math.min(0.2, (t - lastTick) / 1000);
  lastTick = t;
  for (const m of matches.values()) {
    stepMatch(m, dt);
    if (m.over) continue;
    const snap = Object.values(m.entities).map(e => ({
      n: e.name, x: +e.x.toFixed(2), y: +e.y.toFixed(2), a: +e.a.toFixed(2),
      h: Math.max(0, e.hp), d: e.dead ? 1 : 0, t: e.team
    }));
    broadcastMatch(m, 'state', {
      ents: snap,
      score: m.score,
      left: Math.max(0, Math.round((m.endsAt - t) / 1000))
    });
  }
}, TICK_MS);

/* ---------------- SOCKET ---------------- */
wss.on('connection', (ws) => {
  const p = { id: uid(), ws, name: null, matchId: null, queueKey: null };
  clients.set(ws, p);
  send(ws, 'hello', { id: p.id, online: clients.size });

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch (e) { return; }
    const m = matchOf(p);

    switch (msg.type) {
      case 'auth': {
        // names must be unique on the server
        let base = (msg.name || 'Player').slice(0, 16), n = base, i = 2;
        const taken = new Set([...clients.values()].map(c => c.name).filter(Boolean));
        while (taken.has(n)) n = base + i++;
        p.name = n;
        send(ws, 'authed', { name: n, online: clients.size });

        // page navigation drops the socket — hand the body back if a match is live
        for (const mm of matches.values()) {
          if (mm.over) continue;
          const ent = mm.entities[n];
          if (!ent || !ent.wasHuman) continue;
          const slot = mm.slots.find(x => x.name === n);
          if (!slot) continue;
          slot.kind = 'human';
          slot.player = p;
          ent.kind = 'human';
          p.matchId = mm.id;
          p.team = ent.team;
          send(ws, 'rejoin', {
            matchId: mm.id,
            map: mm.prefs.map, gameMode: mm.prefs.gameMode, matchType: mm.prefs.type,
            target: mm.target, you: n, team: ent.team,
            teamA: mm.slots.filter(x => x.team === 'A').map(x => ({ name:x.name, bot: x.kind==='bot' })),
            teamB: mm.slots.filter(x => x.team === 'B').map(x => ({ name:x.name, bot: x.kind==='bot' })),
            left: Math.max(0, Math.round((mm.endsAt - now())/1000)),
            score: mm.score
          });
          console.log(`[match ${mm.id}] ${n} reconnected`);
          break;
        }
        break;
      }
      case 'queue':
        if (!p.name) return;
        enqueue(p, {
          type: msg.matchType, size: msg.size,
          map: msg.map, gameMode: msg.gameMode
        });
        break;
      case 'cancelQueue': dequeue(p); break;
      case 'fillBots':    startWithBots(p); break;

      case 'move': {
        if (!m) return;
        const e = m.entities[p.name];
        if (!e || e.dead) return;
        // light sanity clamp — rejects teleporting
        const dx = msg.x - e.x, dy = msg.y - e.y;
        if (Math.hypot(dx, dy) < 2.5 && !solidAt(m.grid, msg.x, msg.y)) {
          e.x = msg.x; e.y = msg.y;
        }
        e.a = msg.a;
        break;
      }
      case 'shoot': {
        if (!m) return;
        const e = m.entities[p.name];
        if (!e || e.dead) return;
        broadcastMatch(m, 'shot', { name: p.name, x: e.x, y: e.y, a: e.a }, p);
        if (msg.target && m.entities[msg.target]) {
          const t = m.entities[msg.target];
          if (t.team !== e.team && los(m.grid, e, t)) {
            applyDamage(m, t, Math.max(5, Math.min(100, msg.dmg | 0)), p.name);
          }
        }
        break;
      }
      case 'leave':
        if (m) {
          const e = m.entities[p.name];
          if (e) { e.dead = true; e.respawn = 1e9; }
          broadcastMatch(m, 'playerLeft', { name: p.name }, p);
          p.matchId = null;
        }
        break;
      case 'ping': send(ws, 'pong', { t: msg.t }); break;
    }
  });

  ws.on('close', () => {
    dequeue(p);
    const m = matchOf(p);
    if (m) {
      const e = m.entities[p.name];
      if (e) { e.kind = 'bot'; }   // hand the body to the AI so the match survives
      broadcastMatch(m, 'playerLeft', { name: p.name, toBot: true }, p);
    }
    clients.delete(ws);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`TaskVault game server on 0.0.0.0:${PORT}  (static + /ws)`);
  console.log(`maps: ${Object.keys(Maps.LAYOUTS).join(', ')}`);
});
