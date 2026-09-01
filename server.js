<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Room Match — TaskVault</title>
<link rel="icon" href="https://res.cloudinary.com/dq7fpxfbc/image/upload/v1775059285/logo_oo5yat.jpg" type="image/jpeg">
<link href="https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<link href="assets/game.css?v=12" rel="stylesheet">
<style>
body { background: #120D08; }
.rm { flex: 1; display: flex; flex-direction: column; gap: 12px; padding: 18px 16px 26px; max-width: 460px; margin: 0 auto; width: 100%; }
.tabs { display: flex; gap: 8px; }
.tab { flex: 1; padding: 12px 8px; border-radius: 13px; background: rgba(255,255,255,.05); border: 1.5px solid transparent; color: var(--text-light); font: 700 12px Poppins; text-align: center; cursor: pointer; transition: .15s; }
.tab.on { background: rgba(255,179,92,.12); border-color: var(--orange-main); color: var(--orange-main); }
.card { background: var(--silk-bg); border-radius: 15px; padding: 15px; display: flex; flex-direction: column; gap: 11px; }
.lbl { font: 700 10.5px Poppins; color: var(--text-light); letter-spacing: .4px; }
.modes { display: flex; gap: 8px; }
.mode { flex: 1; padding: 10px 4px; border-radius: 11px; background: #fff; border: 1.5px solid #EAE7E1; text-align: center; cursor: pointer; }
.mode h5 { font: 800 13px Poppins; color: var(--text-dark); }
.mode small { font: 600 8.5px Poppins; color: var(--text-light); }
.mode.on { border-color: var(--orange-main); background: #FFF7EC; }
.mode.on h5 { color: var(--orange-main); }
select, input { width: 100%; padding: 12px; border-radius: 11px; border: 1.5px solid #EAE7E1; background: #fff; font: 600 13px Poppins; color: var(--text-dark); outline: none; font-family: inherit; }
input:focus, select:focus { border-color: var(--orange-main); }
.fee { display: flex; align-items: center; gap: 8px; font: 600 10.5px Poppins; color: var(--text-light); background: rgba(0,0,0,.04); border-radius: 9px; padding: 8px 10px; }
.fee i { color: var(--orange-main); }
.btn-room { padding: 14px; border: 0; border-radius: 12px; background: var(--gradient-orange); color: #fff; font: 800 13px Poppins; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
.btn-room:active { transform: scale(.98); }
.btn-room[disabled] { opacity: .5; pointer-events: none; }
.wait { display: none; flex-direction: column; gap: 13px; align-items: center; }
.rid { font: 800 30px Poppins; letter-spacing: 4px; color: var(--text-dark); }
.rid small { display: block; text-align: center; font: 700 9px Poppins; letter-spacing: 1.5px; color: var(--text-light); margin-bottom: 3px; }
.codechip { display: flex; align-items: center; gap: 10px; background: #FFF7EC; border: 1.5px dashed var(--orange-main); border-radius: 11px; padding: 9px 16px; font: 800 18px Poppins; letter-spacing: 6px; color: var(--orange-main); }
.cpy { border: 0; background: rgba(0,0,0,.06); border-radius: 8px; width: 28px; height: 28px; cursor: pointer; color: var(--text-dark); font-size: 13px; }
.slots { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; width: 100%; }
.slot { display: flex; align-items: center; gap: 8px; background: #fff; border-radius: 10px; padding: 9px 10px; border: 1.5px solid #EAE7E1; }
.slot .av { width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font: 800 10px Poppins; color: #fff; flex-shrink: 0; }
.slot .nm { font: 700 10.5px Poppins; color: var(--text-dark); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slot .nm small { display: block; font: 600 8px Poppins; color: var(--text-light); }
.slot.empty { border-style: dashed; opacity: .6; }
.dotp { width: 7px; height: 7px; border-radius: 50%; background: var(--orange-main); animation: blink 1.1s infinite; }
@keyframes blink { 50% { opacity: .25; } }
.status { font: 700 11px Poppins; color: var(--text-light); display: flex; align-items: center; gap: 8px; }
.err { font: 600 11px Poppins; color: #C0392B; background: #FDEDEB; border-radius: 9px; padding: 9px 11px; display: none; }
</style>
</head>
<body>

<div class="app">
  <header class="topbar">
    <a href="game-hub.html" class="icon-btn ghost"><i class="ri-arrow-left-s-line"></i></a>
    <div class="titles"><h3>Room Match</h3><p>Play friends · live P2P</p></div>
    <a href="store.html" class="wallet-row" id="walletLink" data-wallet style="text-decoration:none"></a>
  </header>

  <div class="rm">
    <div class="err" id="errBox"></div>

    <div class="tabs" id="tabs">
      <div class="tab on" data-t="create"><i class="ri-add-circle-line"></i> Create Room</div>
      <div class="tab" data-t="join"><i class="ri-login-circle-line"></i> Join Room</div>
    </div>

    <!-- CREATE -->
    <div id="pCreate" class="card">
      <div>
        <div class="lbl">GAME SIZE</div>
        <div class="modes" id="modes" style="margin-top:6px">
          <div class="mode on" data-m="1v1"><h5>1v1</h5><small>DUEL</small></div>
          <div class="mode" data-m="2v2"><h5>2v2</h5><small>SQUADS</small></div>
          <div class="mode" data-m="4v4"><h5>4v4</h5><small>TEAM</small></div>
        </div>
      </div>
      <div>
        <div class="lbl">LOCATION</div>
        <select id="mapSel" style="margin-top:6px"></select>
      </div>
      <div class="fee"><i class="ri-copper-coin-fill"></i><span>Entry <b>$0.10</b> per player · winners get <b>$0.20</b> each · 3 lives · 5 min</span></div>
      <button class="btn-room" id="createBtn"><i class="ri-flashlight-fill"></i> CREATE ROOM — $0.10</button>
    </div>

    <!-- JOIN -->
    <div id="pJoin" class="card" style="display:none">
      <div>
        <div class="lbl">ROOM ID</div>
        <input id="inRid" placeholder="ABC-XYZ" maxlength="7" autocapitalize="characters" style="margin-top:6px;letter-spacing:3px;font-weight:800;text-transform:uppercase">
      </div>
      <div>
        <div class="lbl">ROOM CODE</div>
        <input id="inCode" placeholder="4-digit code" inputmode="numeric" maxlength="4" style="margin-top:6px;letter-spacing:6px;font-weight:800;text-align:center">
      </div>
      <div class="fee"><i class="ri-copper-coin-fill"></i><span>Entry <b>$0.10</b> to join · winners get <b>$0.20</b> each</span></div>
      <button class="btn-room" id="joinBtn"><i class="ri-sword-fill"></i> JOIN ROOM — $0.10</button>
    </div>

    <!-- WAITING -->
    <div id="pWait" class="card wait">
      <div class="rid"><small>ROOM ID</small><span id="wRid">—</span></div>
      <div class="codechip"><span id="wCode">····</span><button class="cpy" id="cpyCode" title="Copy code"><i class="ri-file-copy-line"></i></button></div>
      <div class="status"><span class="dotp"></span><span id="wStatus">Waiting for players…</span></div>
      <div class="slots" id="wSlots"></div>
      <button class="btn-room" id="leaveBtn" style="background:#EAE7E1;color:var(--text-dark)"><i class="ri-close-circle-line"></i> Leave room</button>
    </div>
  </div>
</div>

<div id="toast" class="toast"></div>
<script src="assets/game.js?v=12"></script>
<script src="assets/p2p.js?v=12"></script>
<script>
/* ============ Room Match — create or join, fee per player ============ */
const errBox = document.getElementById('errBox');
const showErr = msg => { errBox.textContent = msg; errBox.style.display = 'block'; setTimeout(() => errBox.style.display = 'none', 5200); };
const me = () => TVG.state.player.name;   /* re-read: may be uniquified at room time */

/* identity: signed-in players ARE their Firestore account (uid + real username).
   Guests who never signed in and still carry the default name get a one-time
   unique suffix so two devices can't collide as the same player. */
async function identityReady() {
  for (let i = 0; i < 24; i++) { if (TVG.uid && TVG.uid()) break; await new Promise(rs => setTimeout(rs, 125)); }
  if (!(TVG.uid && TVG.uid()) && TVG.state.player.name === 'Tasker123') {
    const NC2 = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let suf = '';
    for (let i = 0; i < 3; i++) suf += NC2[(Math.random() * NC2.length) | 0];
    TVG.state.player.name = 'Tasker-' + suf;
    TVG.save();
  }
}

/* map picker (level-gated like the rest of the app) */
const mapSel = document.getElementById('mapSel');
TVG.MAPS.forEach(mp => {
  const locked = TVG.state.player.level < mp.minLvl;
  mapSel.insertAdjacentHTML('beforeend',
    '<option value="' + mp.id + '"' + (locked ? ' disabled' : '') + '>' + mp.name + ' · ' + mp.tag + (locked ? ' (lvl ' + mp.minLvl + ')' : '') + '</option>');
});

/* tabs */
let tab = 'create';
document.getElementById('tabs').addEventListener('click', e => {
  const t = e.target.closest('.tab'); if (!t) return;
  tab = t.dataset.t;
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
  document.getElementById('pCreate').style.display = tab === 'create' ? 'flex' : 'none';
  document.getElementById('pJoin').style.display = tab === 'join' ? 'flex' : 'none';
});

/* mode picker */
let mode = '1v1';
document.getElementById('modes').addEventListener('click', e => {
  const m = e.target.closest('.mode'); if (!m) return;
  mode = m.dataset.m;
  document.querySelectorAll('.mode').forEach(x => x.classList.toggle('on', x === m));
});

/* ---- fee: everyone who enters a room pays $0.10 · refunded if the room never plays ---- */
let FEE_PAID = false, REFUNDED = false;
function refundEntry() {
  if (!FEE_PAID || REFUNDED || started) return;
  REFUNDED = true;
  TVG.adjustCash(0.10);
  TVG.toast('Room cancelled — $0.10 entry refunded', 'info');
}
function payEntry() {
  const r = TVG.chargeEntry();
  if (!r.ok) { showErr(r.msg); setTimeout(() => location.href = 'deposit.html', 1400); return false; }
  return true;
}

const TEAMC = { A: '#F5A524', B: '#7C3AED' };
function renderSlots(players, slots) {
  const el = document.getElementById('wSlots');
  el.innerHTML = '';
  for (let i = 0; i < (slots || players.length); i++) {
    const p = players[i];
    el.insertAdjacentHTML('beforeend', p
      ? '<div class="slot"><div class="av" style="background:' + (TEAMC[p.team] || '#999') + '">' + TVG.initials(p.name) + '</div>' +
        '<div class="nm">' + p.name + (p.name === me() ? ' (YOU)' : '') + '<small>' + (p.slot === 0 ? 'HOST · TEAM ' + p.team : 'TEAM ' + p.team) + '</small></div></div>'
      : '<div class="slot empty"><div class="av" style="background:#EAE7E1;color:#B3ACA4"><i class="ri-user-add-line"></i></div><div class="nm">Open slot<small>WAITING</small></div></div>');
  }
}

let ROOM = null, unWatch = null, started = false;
function enterWaiting(roomId, code, mode, map, mySlot) {
  ROOM = { roomId, code, mode, map, mySlot };
  document.getElementById('pCreate').style.display = 'none';
  document.getElementById('pJoin').style.display = 'none';
  document.getElementById('pWait').style.display = 'flex';
  document.getElementById('wRid').textContent = roomId;
  document.getElementById('wCode').textContent = code || '····';
  if (!code) document.getElementById('wCode').parentElement.style.display = 'none';   // joiners don't see the code
  unWatch = TVGP2P.watchRoom(roomId, r => {
    if (!r.ok || started) return;
    renderSlots(r.players || [], { '1v1': 2, '2v2': 4, '4v4': 8 }[mode] || 2);
    document.getElementById('wStatus').textContent =
      r.status === 'starting' ? 'Room full — starting!' :
      ((r.players || []).length) + ' / ' + ({ '1v1': 2, '2v2': 4, '4v4': 8 }[mode] || 2) + ' players — share the ID & code';
  });
  /* when the room fills, everyone gets the roster and drops into the match */
  TVGP2P.waitStart(roomId).then(r => {
    if (started) return;
    if (!r.ok || !r.roster || r.roster.length < 2) { refundEntry(); showErr('Room closed before it filled.'); leave(); return; }
    if (started && ROOM && ROOM.mySlot === 0) setTimeout(() => { try { TVGP2P.killRoom(ROOM.roomId); } catch (e) {} }, 1000);   /* stale doc sweep */
    started = true;
    try { if (unWatch) unWatch(); } catch (e) {}
    const roster = r.roster.slice().sort((a, b) => a.slot - b.slot);
    TVG.state.match = {
      flow: 'room', type: mode, size: { '1v1': 1, '2v2': 2, '4v4': 4 }[mode] || 1,
      gameMode: 'Room Duel', map: map || 'warehouse',
      feePaid: true, vsBots: false,
      room: { roomId, roster, mySlot },
      roster: roster.map(p => p.name),
      teamA: roster.filter(p => p.team === 'A').map(p => p.name),
      teamB: roster.filter(p => p.team === 'B').map(p => p.name)
    };
    TVG.save();
    location.href = 'match.html?v=12';            /* versioned: a stale cached match.html would boot bots instead of the room */
  });
}
function leave() {
  refundEntry();                              /* leaving before the match starts returns the fee */
  started = true;
  try { if (unWatch) unWatch(); } catch (e) {}
  if (ROOM && ROOM.mySlot === 0) TVGP2P.killRoom(ROOM.roomId);
  else if (ROOM) TVGP2P.leaveRoom(ROOM.roomId, me());   /* guest: free the slot for someone else */
  location.href = 'game-hub.html';
}
document.getElementById('leaveBtn').onclick = leave;

/* create: pay $0.10 → register the room */
document.getElementById('createBtn').onclick = async () => {
  if (typeof TVGP2P === 'undefined') { showErr('assets/p2p.js failed to load — clear your cache'); return; }
  await identityReady();
  const btn = document.getElementById('createBtn');
  btn.disabled = true; btn.textContent = 'Creating…';
  const r = await TVGP2P.createRoom({ mode, map: mapSel.value });
  btn.disabled = false; btn.innerHTML = '<i class="ri-flashlight-fill"></i> CREATE ROOM — $0.10';
  if (!r.ok) { showErr(r.why === 'no-firebase' ? 'Could not reach the room service — check your connection.' : 'Could not create the room.'); return; }
  if (!payEntry()) return;                       /* fee only after the room exists */
  FEE_PAID = true;
  TVG.toast('Room created — $0.10 entry paid', 'success');
  enterWaiting(r.roomId, r.code, r.mode || mode, r.map || mapSel.value, 0);
};

/* join: check balance → join → pay $0.10 */
document.getElementById('joinBtn').onclick = async () => {
  const rid = document.getElementById('inRid').value.trim();
  const code = document.getElementById('inCode').value.trim();
  if (rid.length < 6) { showErr('Enter the 6-character Room ID (like KTV-9XZ).'); return; }
  if (code.length !== 4) { showErr('Enter the 4-digit room code.'); return; }
  if (TVG.state.wallet.cash < 0.10) { showErr('Entry is $0.10 — deposit to join.'); setTimeout(() => location.href = 'deposit.html', 1400); return; }
  await identityReady();
  const btn = document.getElementById('joinBtn');
  btn.disabled = true; btn.textContent = 'Joining…';
  let r = await TVGP2P.joinRoom(rid, code);
  if (r.why === 'name-taken') {              /* same display name, different account — become unique, retry once */
    const NC3 = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let suf = '';
    for (let i = 0; i < 2; i++) suf += NC3[(Math.random() * NC3.length) | 0];
    TVG.state.player.name = TVG.state.player.name + '-' + suf;
    TVG.save();
    r = await TVGP2P.joinRoom(rid, code);
  }
  if (!r.ok) {
    btn.disabled = false; btn.innerHTML = '<i class="ri-sword-fill"></i> JOIN ROOM — $0.10';
    showErr(r.why === 'not-found' ? 'Room not found — check the ID.' :
            r.why === 'wrong-code' ? 'Wrong room code.' :
            r.why === 'full' || r.why === 'Room already full or closed' ? 'That room is already full.' :
            r.why === 'already-in' ? 'Someone with your name is in that room — rejoining should work now.' :
            r.why === 'no-firebase' ? 'Could not reach the room service — check your connection.' :
            'Could not join: ' + r.why);
    return;
  }
  if (r.rejoin) {
    FEE_PAID = true;
    TVG.toast('Room found — rejoining ' + r.roomId, 'success');   /* same player returning: no double fee */
  } else {
    if (!payEntry()) return;                     /* fee once the seat is ours */
    FEE_PAID = true;
    TVG.toast('Room found! Joined ' + r.roomId + ' — $0.10 entry paid', 'success');
  }
  enterWaiting(r.roomId, null, r.mode || '1v1', r.map || 'warehouse', r.slot);
};

/* copy helpers */
const cpy = (txt, okMsg) => {
  try { navigator.clipboard.writeText(txt).then(() => TVG.toast(okMsg, 'success'), () => {}); } catch (e) {}
};
document.getElementById('cpyCode').onclick = () => cpy(document.getElementById('wCode').textContent, 'Code copied');
</script>
<script>(function(){function c(){var b=a.contentDocument||(a.contentWindow&&a.contentWindow.document);if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'a3456dfe2834288f',t:'MTc4ODI3NzgxNg=='};var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();</script></body>
</html>
