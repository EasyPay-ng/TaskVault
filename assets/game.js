/* ============================================================
   TASKVAULT GAME — shared state + helpers
   Server-backed economy: coins / gems / ammo / balance and the
   whole game profile live in Firestore on users/{uid}.
   localStorage is only an offline cache now.
   ============================================================ */
(function (w) {
  'use strict';

  const KEY = 'tv_game_state_v2';

  /* ---- economy constants (single source of truth) ---- */
  const ENTRY_FEE = 0.10;    // $ charged from balance to enter a match
  const WIN_REWARD = 0.20;   // $ paid to EACH member of the winning team (rooms only)
  const TARGET_WIN_RATE = 0.40;

  const DEFAULTS = {
    player: {
      name: 'Tasker123',
      tag: '#4417',
      level: 12,
      xp: 1250,
      xpMax: 2000,
      rank: 'Platinum III',
      rankTier: 'platinum',
      matches: 320,
      wins: 198,
      kd: 2.57,
      headshots: 41,
      accuracy: 62,
      recent: [],            // last match outcomes, 1 = win (drives difficulty)
      dda: 1                 // bot skill multiplier, nudged toward 40% win rate
    },
    wallet: { cash: 0.00, coins: 0, gems: 0, ammo: 0 },
    equipped: { character: 'ranger', primary: 'glock18', secondary: 'glock18', grenade: 'frag', melee: 'knife' },
    owned: {
      characters: ['ranger'],
      weapons: ['glock18', 'frag', 'knife']
    },
    settings: { sound: true, music: true, vibration: true, graphics: 'medium', lang: 'en', sensitivity: 55, difficulty: 'normal' },
    match: null,
    lastResult: null,
    missionProgress: {},
    topups: []
  };

  /* ---------------- CATALOG ---------------- */
  const CHARACTERS = [
    { id:'ranger', name:'Ranger',   rarity:'common', price:0,    cur:'coin', icon:'ri-user-3-fill',      hue:18,  desc:'Standard issue' },
    { id:'scout',  name:'Scout',    rarity:'common', price:2000, cur:'coin', icon:'ri-run-fill',         hue:150, desc:'+8% move speed' },
    { id:'ghost',  name:'Ghost',    rarity:'rare',   price:2500, cur:'coin', icon:'ri-ghost-2-fill',     hue:210, desc:'Quieter footsteps' },
    { id:'juggernaut', name:'Juggernaut', rarity:'epic', price:3000, cur:'coin', icon:'ri-shield-star-fill', hue:280, desc:'+20 armour' },
    { id:'viper',  name:'Viper',    rarity:'epic',   price:2500, cur:'coin', icon:'ri-poison-fill',      hue:100, desc:'Faster reload' },
    { id:'phantom',name:'Phantom',  rarity:'legend', price:280,  cur:'gem',  icon:'ri-sword-fill',       hue:45,  desc:'Legendary operator' }
  ];

  const WEAPONS = [
    { id:'ak47',   name:'AK-47',   slot:'primary',   rarity:'rare',   price:4520, cur:'coin', icon:'ri-crosshair-2-fill', dmg:85, fire:70, range:75, ctrl:55, ammo:30, desc:'High damage assault rifle' },
    { id:'m4a1',   name:'M4A1',    slot:'primary',   rarity:'rare',   price:4980, cur:'coin', icon:'ri-crosshair-2-fill', dmg:74, fire:80, range:78, ctrl:72, ammo:30, desc:'Balanced and forgiving' },
    { id:'mp5',    name:'MP5',     slot:'primary',   rarity:'common', price:3200, cur:'coin', icon:'ri-flashlight-fill',  dmg:58, fire:92, range:48, ctrl:80, ammo:35, desc:'Close quarters shredder' },
    { id:'awp',    name:'AWP',     slot:'primary',   rarity:'legend', price:6800, cur:'coin', icon:'ri-focus-3-line',     dmg:100,fire:18, range:98, ctrl:40, ammo:5,  desc:'One shot, one kill' },
    { id:'scarh',  name:'SCAR-H',  slot:'primary',   rarity:'epic',   price:240,  cur:'gem',  icon:'ri-crosshair-2-fill', dmg:90, fire:60, range:82, ctrl:50, ammo:20, desc:'Heavy battle rifle' },
    { id:'glock18',name:'Glock-18',slot:'secondary', rarity:'common', price:0,    cur:'coin', icon:'ri-focus-2-line',     dmg:38, fire:75, range:35, ctrl:70, ammo:17, desc:'Reliable sidearm' },
    { id:'deagle', name:'Desert Eagle', slot:'secondary', rarity:'epic', price:3400, cur:'coin', icon:'ri-focus-2-line', dmg:78, fire:30, range:52, ctrl:38, ammo:7, desc:'Hand cannon' },
    { id:'frag',   name:'Frag Grenade', slot:'grenade', rarity:'common', price:0, cur:'coin', icon:'ri-bomb-fill',       dmg:95, fire:10, range:30, ctrl:50, ammo:2, desc:'Standard explosive' },
    { id:'flash',  name:'Flashbang',    slot:'grenade', rarity:'rare',   price:1800, cur:'coin', icon:'ri-sun-fill',    dmg:5,  fire:10, range:28, ctrl:60, ammo:2, desc:'Blinds enemies 3s' },
    { id:'knife',  name:'Combat Knife', slot:'melee',   rarity:'common', price:0, cur:'coin', icon:'ri-knife-blood-fill', dmg:60, fire:60, range:8,  ctrl:90, ammo:0, desc:'Silent takedown' },
    { id:'machete',name:'Machete',      slot:'melee',   rarity:'rare',   price:2100, cur:'coin', icon:'ri-sword-fill',  dmg:78, fire:45, range:10, ctrl:80, ammo:0, desc:'Heavy swing' }
  ];

  const MAPS = [
    { id:'warehouse',  name:'Warehouse',    tag:'Indoor · Tight',  minLvl:1,  c1:'#8B7355', c2:'#5C4A38' },
    { id:'military',   name:'Military Base',tag:'Mixed · Medium',  minLvl:1,  c1:'#6B7F5E', c2:'#3E4A36' },
    { id:'desert',     name:'Desert Town',  tag:'Open · Long',     minLvl:1,  c1:'#D9A55B', c2:'#A97632' },
    { id:'port',       name:'Port Dock',    tag:'Mixed · Medium',  minLvl:5,  c1:'#5B7C99', c2:'#33506B' },
    { id:'jungle',     name:'Jungle Ruins', tag:'Cover · Tight',   minLvl:8,  c1:'#4F7A4A', c2:'#2C4A2A' },
    { id:'trainyard',  name:'Train Yard',   tag:'Open · Long',     minLvl:12, c1:'#7A6A72', c2:'#4A3E45' }
  ];

  const MODES = [
    { id:'1v1', name:'Duel',        sub:'1 Player vs 1 Player',  icon:'ri-user-3-fill',      cls:'blue',   size:1 },
    { id:'2v2', name:'Squad Duel',  sub:'2 Players vs 2 Players',icon:'ri-team-fill',        cls:'purple', size:2 },
    { id:'4v4', name:'Team Battle', sub:'4 Players vs 4 Players',icon:'ri-group-fill',       cls:'green',  size:4 }
  ];

  const GAME_MODES = ['Team Deathmatch', 'Domination', 'Search & Destroy', 'Free For All', 'Battle Royale'];

  const MISSIONS = {
    daily: [
      { id:'d1', name:'Play 3 Matches',      goal:3,  coin:100, xp:50, icon:'ri-gamepad-fill' },
      { id:'d2', name:'Get 10 Kills',        goal:10, coin:120, xp:60, icon:'ri-crosshair-2-fill' },
      { id:'d3', name:'Win 2 Matches',       goal:2,  coin:150, xp:70, icon:'ri-trophy-fill' },
      { id:'d4', name:'Headshot 5 Enemies',  goal:5,  coin:100, xp:40, icon:'ri-focus-3-line' }
    ],
    weekly: [
      { id:'w1', name:'Play 25 Matches',     goal:25, coin:800,  xp:400, icon:'ri-gamepad-fill' },
      { id:'w2', name:'Get 120 Kills',       goal:120,coin:1000, xp:500, icon:'ri-crosshair-2-fill' },
      { id:'w3', name:'Win 12 Matches',      goal:12, coin:1200, xp:600, icon:'ri-trophy-fill' }
    ],
    season: [
      { id:'s1', name:'Reach Diamond Rank',  goal:1,  coin:5000, xp:2500, icon:'ri-vip-diamond-fill' },
      { id:'s2', name:'Play 200 Matches',    goal:200,coin:8000, xp:4000, icon:'ri-gamepad-fill' },
      { id:'s3', name:'1000 Total Kills',    goal:1000,coin:10000,xp:5000, icon:'ri-skull-2-fill' }
    ]
  };

  const BOT_NAMES = ['ShadowStrike','NovaSniper','KingzKid','MysticFox','DarkViper','GhostRider',
                     'NightHawk','IronWolf','RapidFire','ToxicAce','CrimsonX','SilentAssassin',
                     'VortexK','BlazeFury','ZeroCool','PhantomZ','NeonRonin','BoltAction'];

  /* ---------------- STATE ---------------- */
  let state;
  try {
    state = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch (e) { state = JSON.parse(JSON.stringify(DEFAULTS)); }

  // lazily created collections (older saves may not have them)
  if (!Array.isArray(state.topups)) state.topups = [];

  // migrate away the old demo seed balance (was $12,450) — the real balance
  // now comes from Firestore; a stale demo figure must never reach it.
  if (state.wallet && state.wallet.cash >= 1000) { state.wallet.cash = 0; }



  /* ============================================================
     FIREBASE — full server-side game profile
     users/{uid}:
       balance          ($)  — existing TaskVault field, kept
       coins, gems, ammo     — NEW flat wallet fields
       game                 — { player, equipped, owned, missionProgress,
                                topups, stats }
       walletUpdatedAt / gameUpdatedAt — millis, last-writer-wins
     ============================================================ */
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAv6QCpopa0Q77AVTyjU5cqJEIKIE9OVTs",
    authDomain: "taskvault-412a0.firebaseapp.com",
    projectId: "taskvault-412a0",
    storageBucket: "taskvault-412a0.firebasestorage.app",
    messagingSenderId: "420716701831",
    appId: "1:420716701831:web:c987d91f7f4c8684eb7022"
  };

  let fb = null;                 // { auth, db, uid } once signed in
  let fbPhase = 'local';         // local → syncing → synced
  const syncListeners = [];

  /* snapshots of what the server last saw — used to detect local
     mutations (pages edit state.wallet directly) and stamp timestamps */
  let walletSnap = '', gameSnap = '';
  let walletMts = 0, gameMts = 0;
  let pushTimer = null, pushQueued = { wallet: false, game: false };

  const walletOf = s => JSON.stringify([s.wallet.cash, s.wallet.coins, s.wallet.gems, s.wallet.ammo]);
  const gameOf   = s => JSON.stringify([s.player, s.equipped, s.owned, s.missionProgress, s.topups]);

  function walletSection() {
    return {
      balance: Math.round(state.wallet.cash * 100) / 100,
      coins: Math.round(state.wallet.coins) || 0,
      gems: Math.round(state.wallet.gems) || 0,
      ammo: Math.round(state.wallet.ammo) || 0,
      walletUpdatedAt: walletMts
    };
  }
  function gameSection() {
    return {
      player: state.player,
      equipped: state.equipped,
      owned: state.owned,
      missionProgress: state.missionProgress,
      topups: state.topups.slice(0, 30),
      gameUpdatedAt: gameMts
    };
  }

  function fbLoadSDK() {
    if (w.__tvFbStarted) return; w.__tvFbStarted = true;
    if (w.firebase) { fbInit(); return; }
    const srcs = [
      'https://www.gstatic.com/firebasejs/10.5.0/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/10.5.0/firebase-auth-compat.js',
      'https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore-compat.js'
    ];
    let n = 0;
    srcs.forEach(src => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => { if (++n === srcs.length) fbInit(); };
      document.head.appendChild(s);
    });
  }

  function setPhase(p) {
    fbPhase = p;
    syncListeners.forEach(f => { try { f(p, fb && fb.uid); } catch (e) {} });
  }

  function fbInit() {
    let auth, db;
    try {
      if (!w.firebase.apps || !w.firebase.apps.length) w.firebase.initializeApp(FIREBASE_CONFIG);
      auth = w.firebase.auth(); db = w.firebase.firestore();
    } catch (e) { setPhase('local'); return; }
    auth.onAuthStateChanged(user => {
      if (user) {
        fb = { auth, db, uid: user.uid };
        setPhase('syncing');
        fbFetch();
      } else {
        // not signed in — the app's own auth guard handles login.
        // stay in local mode; nothing leaves the device.
        fb = null;
        setPhase('local');
      }
    });
  }

  function fbFetch() {
    fb.db.collection('users').doc(fb.uid).get()
      .then(doc => {
        const now = Date.now();
        if (doc.exists) {
          const d = doc.data();

          /* ---- wallet merge ----
             cash/balance: the website owns it (deposits) → server always wins.
             coins/gems/ammo: the game owns them → remote wins per-field when
             present; anything missing server-side is uploaded from local.     */
          if (typeof d.balance === 'number') state.wallet.cash = d.balance;
          let lacked = false;
          ['coins', 'gems', 'ammo'].forEach(k => {
            if (typeof d[k] === 'number') state.wallet[k] = d[k];
            else lacked = true;
          });
          const rWalletMts = d.walletUpdatedAt || 0;
          walletMts = Math.max(walletMts, rWalletMts);
          if (lacked || walletMts > rWalletMts) queuePush('wallet');   // push merged wallet up

          /* ---- game profile: last-writer-wins by timestamp ---- */
          if (d.game && typeof d.game.gameUpdatedAt === 'number') {
            if (gameMts > d.game.gameUpdatedAt) queuePush('game');
            else {
              state.player          = Object.assign({}, DEFAULTS.player, d.game.player);
              if (typeof d.username === 'string' && d.username) state.player.name = d.username;        /* real username from the site */
              else if (typeof d.displayName === 'string' && d.displayName) state.player.name = d.displayName;
              state.equipped        = Object.assign({}, DEFAULTS.equipped, d.game.equipped);
              state.owned           = Object.assign({}, DEFAULTS.owned, d.game.owned);
              state.missionProgress = d.game.missionProgress || {};
              state.topups          = Array.isArray(d.game.topups) ? d.game.topups : [];
              gameMts = d.game.gameUpdatedAt;
            }
          } else {
            if (!gameMts) gameMts = now;
            queuePush('game');
          }
          save();
        } else {
          // brand-new user doc — create it with the game fields included
          walletMts = now; gameMts = now;
          fb.db.collection('users').doc(fb.uid).set(Object.assign({
            balance: 0.00, plan: null, lastClaimDate: null,
            createdAt: w.firebase.firestore.FieldValue.serverTimestamp()
          }, walletSection(), { game: gameSection() })).catch(() => {});
          state.wallet.cash = 0.00;
          save();
        }
        walletSnap = walletOf(state); gameSnap = gameOf(state);
        setPhase('synced');
        renderWallet();
      })
      .catch(() => { setPhase('local'); });
  }

  function queuePush(which) {
    if (!fb) return;
    pushQueued[which] = true;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(flushPush, 1200);   // batch rapid changes into one write
  }

  function flushPush() {
    if (!fb) return;
    const patch = {};
    if (pushQueued.wallet) { Object.assign(patch, walletSection()); pushQueued.wallet = false; }
    if (pushQueued.game)   { patch.game = gameSection(); pushQueued.game = false; }
    if (Object.keys(patch).length) {
      fb.db.collection('users').doc(fb.uid).set(patch, { merge: true }).catch(() => {});
    }
  }
  // don't lose a queued write when the page closes
  addEventListener('pagehide', flushPush);
  addEventListener('visibilitychange', () => { if (document.hidden) flushPush(); });

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    if (!fb) return;
    const w2 = walletOf(state), g2 = gameOf(state);
    if (w2 !== walletSnap) { walletSnap = w2; walletMts = Date.now(); queuePush('wallet'); }
    if (g2 !== gameSnap)   { gameSnap   = g2; gameMts   = Date.now(); queuePush('game');   }
  }

  function reset() {
    state = JSON.parse(JSON.stringify(DEFAULTS));
    save();                                      // queues a full re-upload
    if (fb) queuePush('wallet'), queuePush('game');
  }

  /* ---- cash helpers (unchanged API) ---- */
  function setCash(v) {
    state.wallet.cash = Math.round(+v * 100) / 100;
    save();
    return state.wallet.cash;
  }
  function adjustCash(d) { return setCash(state.wallet.cash + (+d || 0)); }

  /* ---- wallet change listener — fires once sync settles, and on every
         push, so pages always show the server-backed number ---- */
  let lastBroadcast = null;
  function broadcast() {
    const v = state.wallet;
    const sig = v.cash + '|' + v.coins + '|' + v.gems;
    if (sig !== lastBroadcast) { lastBroadcast = sig; walletWaiters.forEach(f => f(v.cash)); }
  }
  const walletWaiters = [];
  function onWallet(fn) {
    walletWaiters.push(fn);
    if (fbPhase !== 'syncing') fn(state.wallet.cash);
  }
  setInterval(broadcast, 900);   // lightweight: pages poll the shared state

  /* ---------------- HELPERS ---------------- */
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function money(n) { return '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(a) { a = a.slice(); for (let i=a.length-1;i>0;i--){const j=rnd(0,i);[a[i],a[j]]=[a[j],a[i]];} return a; }
  function initials(n) { return (n||'U').replace(/[^A-Za-z0-9]/g,'').slice(0,2).toUpperCase(); }

  function weapon(id) { return WEAPONS.find(x => x.id === id); }
  function character(id) { return CHARACTERS.find(x => x.id === id); }
  function map(id) { return MAPS.find(x => x.id === id); }

  function owns(kind, id) { return (state.owned[kind] || []).includes(id); }

  function buy(kind, id, price, cur) {
    const bal = cur === 'gem' ? state.wallet.gems : state.wallet.coins;
    if (bal < price) return { ok: false, msg: 'Not enough ' + (cur === 'gem' ? 'gems' : 'coins') + ' — buy more in the store' };
    if (cur === 'gem') state.wallet.gems -= price; else state.wallet.coins -= price;
    if (!state.owned[kind]) state.owned[kind] = [];
    state.owned[kind].push(id);
    save();                                       // → Firestore push is queued automatically
    return { ok: true };
  }

  function buyAmmo(count, coinCost) {
    if (state.wallet.coins < coinCost) return { ok: false, msg: 'Not enough coins for ammo — top up in the store' };
    state.wallet.coins -= coinCost;
    state.wallet.ammo += count;
    save();
    return { ok: true };
  }

  function addRewards(coins, xp) {
    state.wallet.coins += coins;
    state.player.xp += xp;
    while (state.player.xp >= state.player.xpMax) {
      state.player.xp -= state.player.xpMax;
      state.player.level += 1;
      state.player.xpMax = Math.round(state.player.xpMax * 1.15);
    }
    save();
  }

  function bumpMission(id, by) {
    const p = state.missionProgress;
    p[id] = (p[id] || 0) + (by || 1);
    save();
  }

  /* ---------------- MATCH ECONOMY + DYNAMIC DIFFICULTY ----------------
     Entry $0.10 · Win $0.30 · target win rate 40%.
     After every match the rolling win rate (last 15) is compared to the
     target: win too much → bots sharpen; lose too much → bots ease off.
     dda is a plain multiplier on bot accuracy, reaction, damage & speed. */
  function recordOutcome(won) {
    const p = state.player;
    p.recent = Array.isArray(p.recent) ? p.recent : [];
    p.recent.push(won ? 1 : 0);
    if (p.recent.length > 15) p.recent.shift();
    if (p.recent.length >= 5) {
      const wr = p.recent.reduce((a, b) => a + b, 0) / p.recent.length;
      const err = wr - TARGET_WIN_RATE;
      if (err >  0.08)      p.dda = Math.min(1.6, (p.dda || 1) + 0.06);
      else if (err < -0.08) p.dda = Math.max(0.7, (p.dda || 1) - 0.06);
    }
    save();
  }
  function winRate() {
    const r = state.player.recent || [];
    return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null;
  }
  function ddaFactor() {
    const f = state.player.dda;
    return (typeof f === 'number' && isFinite(f)) ? Math.min(1.6, Math.max(0.7, f)) : 1;
  }
  /* charge the entry fee; returns {ok, msg} */
  function chargeEntry() {
    if (state.wallet.cash < ENTRY_FEE) {
      return { ok: false, msg: 'Need ' + money(ENTRY_FEE) + ' to enter — deposit to keep playing' };
    }
    adjustCash(-ENTRY_FEE);
    return { ok: true };
  }

  /* ---------------- TOAST ---------------- */
  function toast(msg, type) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast'; el.className = 'toast';
      document.body.appendChild(el);
    }
    el.className = 'toast ' + (type || 'info') + ' show';
    const icon = type === 'success' ? 'ri-checkbox-circle-fill'
               : type === 'error' ? 'ri-error-warning-fill' : 'ri-information-fill';
    el.innerHTML = '<i class="' + icon + '"></i><span>' + msg + '</span>';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = 'toast ' + (type||'info'); }, 2600);
  }

  /* ---------------- WALLET CHIPS ---------------- */
  function renderWallet(sel) {
    document.querySelectorAll(sel || '[data-wallet]').forEach(el => {
      el.innerHTML =
        '<span class="chip"><i class="ri-copper-coin-fill"></i>' + fmt(state.wallet.coins) + '</span>' +
        '<span class="chip gem"><i class="ri-vip-diamond-fill"></i>' + fmt(state.wallet.gems) + '</span>';
    });
  }

  /* ---------------- MAP ART (inline svg, no network) ---------------- */
  function mapArt(m) {
    const s = m.id.length * 7;
    return '<svg viewBox="0 0 200 84" preserveAspectRatio="none" style="width:100%;height:100%;display:block">' +
      '<defs><linearGradient id="g' + m.id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + m.c1 + '"/><stop offset="100%" stop-color="' + m.c2 + '"/>' +
      '</linearGradient></defs>' +
      '<rect width="200" height="84" fill="url(#g' + m.id + ')"/>' +
      '<circle cx="' + (150 + (s % 20)) + '" cy="18" r="9" fill="#fff" opacity=".18"/>' +
      '<rect x="' + (10 + s % 30) + '" y="42" width="34" height="42" fill="#000" opacity=".22"/>' +
      '<rect x="' + (58 + s % 24) + '" y="30" width="26" height="54" fill="#000" opacity=".30"/>' +
      '<rect x="' + (100 + s % 18) + '" y="50" width="40" height="34" fill="#000" opacity=".18"/>' +
      '<rect x="' + (152 + s % 12) + '" y="38" width="30" height="46" fill="#000" opacity=".26"/>' +
      '<rect y="76" width="200" height="8" fill="#000" opacity=".28"/>' +
      '</svg>';
  }

  /* ---------------- EXPORT ---------------- */
  w.TVG = {
    uid: () => (fb && fb.uid) || null,
    state, save, reset, DEFAULTS, ENTRY_FEE, WIN_REWARD,
    CHARACTERS, WEAPONS, MAPS, MODES, GAME_MODES, MISSIONS, BOT_NAMES,
    fmt, money, rnd, pick, shuffle, initials,
    weapon, character, map, owns, buy, buyAmmo, addRewards, bumpMission,
    toast, renderWallet, mapArt,
    recordOutcome, winRate, ddaFactor, chargeEntry, TARGET_WIN_RATE,
    setCash, adjustCash, onWallet,
    /* new: sync observability */
    onSync(fn) { syncListeners.push(fn); fn(fbPhase, fb && fb.uid); },
    get syncPhase() { return fbPhase; },
    get signedIn()  { return !!fb; },
    flushPush
  };

  walletSnap = walletOf(state); gameSnap = gameOf(state);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fbLoadSDK);
  else fbLoadSDK();

  document.addEventListener('DOMContentLoaded', () => renderWallet());
})(window);
