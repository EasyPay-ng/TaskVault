/* ============================================================
   TASKVAULT GAME — shared state + helpers
   Local-first. Swap TVG.save/load for Firestore later.
   ============================================================ */
(function (w) {
  'use strict';

  const KEY = 'tv_game_state_v2';

  /* ---- economy constants (single source of truth) ---- */
  const ENTRY_FEE = 0.10;    // $ charged from balance to enter a match
  const WIN_REWARD = 0.30;   // $ paid to the winner of a real-player match

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
      accuracy: 62
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
    missionProgress: {}
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

  const GAME_MODES = ['Team Deathmatch', 'Domination', 'Search & Destroy', 'Free For All'];

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

  // migrate away the old demo seed balance (was $12,450) — the real balance
  // now comes from Firestore; a stale demo figure must never reach it.
  if (state.wallet && state.wallet.cash >= 1000) { state.wallet.cash = 0; }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function reset() { state = JSON.parse(JSON.stringify(DEFAULTS)); save(); }

  /* ---------------- FIREBASE WALLET SYNC (real TaskVault balance) ---------------- */
  /* The dashboard reads users/{uid}.balance from Firestore for the signed-in user
     (email / Google login). The game mirrors that same balance into state.wallet.cash
     so every page shows one shared number. Falls back to localStorage when offline. */
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAv6QCpopa0Q77AVTyjU5cqJEIKIE9OVTs",
    authDomain: "taskvault-412a0.firebaseapp.com",
    projectId: "taskvault-412a0",
    storageBucket: "taskvault-412a0.firebasestorage.app",
    messagingSenderId: "420716701831",
    appId: "1:420716701831:web:c987d91f7f4c8684eb7022"
  };

  let fb = null, fbReady = false, fbStarted = false;
  const fbWait = [];

  function fbLoadSDK() {
    if (fbStarted) return; fbStarted = true;
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

  function fbInit() {
    try {
      if (!w.firebase.apps || !w.firebase.apps.length) w.firebase.initializeApp(FIREBASE_CONFIG);
    } catch (e) { return; }
    const auth = w.firebase.auth();
    const db = w.firebase.firestore();
    auth.onAuthStateChanged(user => {
      if (user) { fb = { auth, db, uid: user.uid }; fbFetch(); }
      else {
        // no signed-in user (app uses email / Google sign-in) — keep the local
        // fallback and skip remote sync; the app's own auth guard handles login.
        fbReady = true;
        fbWait.forEach(f => f(state.wallet.cash)); fbWait.length = 0;
      }
    });
  }

  function fbFetch() {
    if (!fb) return;
    fb.db.collection('users').doc(fb.uid).get()
      .then(doc => {
        if (doc.exists) {
          const b = doc.data().balance;
          if (typeof b === 'number') state.wallet.cash = b;
          save();
        } else {
          // new user — start at $0.00, matching the dashboard's newProfile.
          // Never seed the real balance with the demo fallback cash.
          fb.db.collection('users').doc(fb.uid).set({
            balance: 0.00, plan: null, lastClaimDate: null,
            createdAt: w.firebase.firestore.FieldValue.serverTimestamp()
          }).catch(() => {});
          state.wallet.cash = 0.00; save();
        }
      })
      .catch(() => {})
      .then(() => { fbReady = true; fbWait.forEach(f => f(state.wallet.cash)); fbWait.length = 0; });
  }

  function fbPush() {
    if (!fb) return;
    fb.db.collection('users').doc(fb.uid).set({ balance: state.wallet.cash }, { merge: true }).catch(() => {});
  }

  function setCash(v) {
    state.wallet.cash = Math.round(+v * 100) / 100;
    save(); fbPush();
    return state.wallet.cash;
  }
  function adjustCash(d) { return setCash(state.wallet.cash + (+d || 0)); }
  function onWallet(fn) {
    if (fbReady) fn(state.wallet.cash);
    else fbWait.push(fn);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fbLoadSDK);
  else fbLoadSDK();

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
    save();
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
    state, save, reset, DEFAULTS, ENTRY_FEE, WIN_REWARD,
    CHARACTERS, WEAPONS, MAPS, MODES, GAME_MODES, MISSIONS, BOT_NAMES,
    fmt, money, rnd, pick, shuffle, initials,
    weapon, character, map, owns, buy, buyAmmo, addRewards, bumpMission,
    toast, renderWallet, mapArt,
    setCash, adjustCash, onWallet
  };

  document.addEventListener('DOMContentLoaded', () => renderWallet());
})(window);
