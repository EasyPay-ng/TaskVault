/* =====================================================================
   TaskVault P2P — real 1v1 duels over WebRTC, no game server.
   Firestore (the project you already run) is used ONLY to find an
   opponent and swap the one-time connection codes; after that the two
   browsers talk directly (host-authoritative duel).

   Pages:  matchmaking.html  →  TVGP2P.findOpponent()  (auto pairing)
           room.html         →  TVGP2P.createRoom/waitRoom/joinRoom (room codes)
           match.html        →  TVGP2P.connect()       (data channel)
   Fallback: any failure resolves "not found" → match vs bots as usual.
   Requires Firestore rules to allow read/write on tv_p2p_lobby/*:
     match /tv_p2p_lobby/{doc} { allow read, write: if true; }
     match /tv_p2p_lobby/{doc}/sig/{s} { allow read, write: if true; }
   (lobby docs auto-expire and are deleted by the pair or on timeout)
   ===================================================================== */
(function (w) {
  'use strict';
  const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  const now = () => Date.now();

  function fs() {                                   /* firestore once the SDK is up */
    for (let i = 0; i < 40; i++) {                  /* polled lazily by callers */
      if (w.firebase && w.firebase.apps && w.firebase.apps.length) {
        try { return w.firebase.firestore(); } catch (e) { return null; }
      }
    }
    return null;
  }
  function fsReady(timeout) {                       /* wait for game.js to load the SDK */
    return new Promise(res => {
      const t0 = now();
      (function poll() {
        if (w.firebase && w.firebase.apps && w.firebase.apps.length) {
          try { w.firebase.firestore(); return res(true); } catch (e) { /* fallthrough */ }
        }
        if (now() - t0 > (timeout || 4000)) return res(false);
        setTimeout(poll, 150);
      })();
    });
  }

  /* ---------------------------------------------------------------
     findOpponent({timeout, map, mode, name}) →
       { found:true, role:'host'|'guest', lobbyId, peerName }  or
       { found:false }
     First caller leaves an open lobby; second claims it. The claim
     (transaction) decides roles — no race, no server.
     --------------------------------------------------------------- */
  async function findOpponent(o) {
    o = o || {};
    const me = (w.TVG && TVG.state && TVG.state.player && TVG.state.player.name) || 'Player';
    if (!(await fsReady(o.fsTimeout || 4000))) return { found: false, why: 'no-firebase' };
    const db = fs(); if (!db) return { found: false, why: 'no-firebase' };
    const col = db.collection('tv_p2p_lobby');
    const cut = now() - 45000;                      /* ignore stale lobbies */

    /* 1 — try to join an existing open lobby */
    try {
      const snap = await col.where('status', '==', 'open').where('createdAt', '>', cut).limit(6).get();
      for (const doc of snap.docs) {
        if (doc.data().host === me) continue;       /* our own lobby */
        try {
          let claimed = false;
          await db.runTransaction(async tx => {
            const d = await tx.get(doc.ref);
            if (d.exists && d.data().status === 'open') {
              await tx.update(doc.ref, { status: 'pairing', guest: me, guestName: me, pairedAt: now() });
              claimed = true;
            }
          });
          if (claimed) return { found: true, role: 'guest', lobbyId: doc.id, peerName: doc.data().hostName || doc.data().host || 'Host' };
        } catch (e) { /* someone else claimed it first — next doc */ }
      }
    } catch (e) { return { found: false, why: 'query-' + (e.code || 'err') }; }

    /* 2 — no open lobby: open one and wait for a guest */
    const ref = await col.add({
      status: 'open', host: me, hostName: me, map: o.map || '', mode: o.mode || '1v1',
      createdAt: now(), createdAtSrv: w.firebase.firestore.FieldValue.serverTimestamp()
    });
    return new Promise(res => {
      const un = ref.onSnapshot(s => {
        const d = s.data();
        if (d && d.status === 'pairing') {
          un(); cleanup();
          res({ found: true, role: 'host', lobbyId: ref.id, peerName: d.guestName || d.guest || 'Challenger' });
        } else if (d && d.status === 'closed') { un(); cleanup(); res({ found: false, why: 'closed' }); }
      }, () => { un(); cleanup(); res({ found: false, why: 'listen' }); });
      const cleanup = () => { clearTimeout(timer); try { ref.delete(); } catch (e) {} };
      const timer = setTimeout(() => { un(); cleanup(); res({ found: false, why: 'timeout' }); }, o.timeout || 6500);
      w.__tvP2pCleanup = cleanup;                   /* page nav aborts it anyway */
    });
  }

  /* ---------------------------------------------------------------
     connect(lobbyId, role) → { send(obj), bind(fn), close(), ready }
     WebRTC handshake through lobbyId/sig: host posts the offer,
     guest answers, both trickle ICE. Resolves when the data channel
     is open; rejects on timeout (~12s).
     --------------------------------------------------------------- */
  function connect(lobbyId, role, coll) {
    return new Promise((resolve, reject) => {
      const db = fs(); if (!db) return reject(new Error('no-firebase'));
      const root = db.collection(coll || 'tv_p2p_lobby').doc(lobbyId);
      const sig = root.collection('sig');
      const pc = new (w.RTCPeerConnection || w.webkitRTCPeerConnection)({ iceServers: ICE });
      let chan, bound = null, open = false;
      const done = setTimeout(() => { if (!open) { try { pc.close(); } catch (e) {} reject(new Error('connect-timeout')); } }, 12000);
      const wire = c => {
        chan = c;
        c.onmessage = ev => { if (bound) { try { bound(JSON.parse(ev.data)); } catch (e) {} } };
        c.onopen = () => {
          open = true; clearTimeout(done);
          try { root.update({ status: 'closed' }); sig.doc('x').set({ done: 1 }).catch(() => {}); } catch (e) {}
          resolve({
            send: obj => { if (c.readyState === 'open') { try { c.send(JSON.stringify(obj)); } catch (e) {} } },
            bind: fn => { bound = fn; },
            close: () => { try { c.close(); } catch (e) {} try { pc.close(); } catch (e) {} },
            get open() { return c.readyState === 'open'; }
          });
        };
      };
      pc.onicecandidate = ev => {
        if (ev.candidate) sig.doc((role === 'host' ? 'h' : 'g') + '-ice-' + Math.random().toString(36).slice(2, 7))
          .set({ t: 'ice', v: ev.candidate.toJSON() }).catch(() => {});
      };
      if (role === 'host') {
        wire(pc.createDataChannel('duel', { ordered: false, maxRetransmits: 0 }));
        pc.createOffer().then(off => pc.setLocalDescription(off))
          .then(() => sig.doc('offer').set({ t: 'offer', v: pc.localDescription.toJSON() })).catch(reject);
        sig.onSnapshot(s => { s.docChanges().forEach(ch => {
          const d = ch.doc.data();
          if (d.t === 'answer' && pc.signalingState !== 'stable') pc.setRemoteDescription(d.v).catch(() => {});
          if (d.t === 'ice' && ch.doc.id[0] === 'g' && pc.remoteDescription) pc.addIceCandidate(d.v).catch(() => {});
        }); }, () => reject(new Error('sig-listen')));
      } else {
        sig.onSnapshot(s => { s.docChanges().forEach(ch => {
          const d = ch.doc.data();
          if (d.t === 'offer' && !pc.remoteDescription) {
            pc.setRemoteDescription(d.v)
              .then(() => pc.createAnswer()).then(ans => pc.setLocalDescription(ans))
              .then(() => sig.doc('answer').set({ t: 'answer', v: pc.localDescription.toJSON() })).catch(reject);
          }
          if (d.t === 'ice' && ch.doc.id[0] === 'h' && pc.remoteDescription) pc.addIceCandidate(d.v).catch(() => {});
        }); }, () => reject(new Error('sig-listen')));
        pc.ondatachannel = ev => wire(ev.channel);
      }
    });
  }

  /* ---------------------------------------------------------------
     PRIVATE ROOMS — the real game mode.
     Create a room (1v1 / 2v2 / 4v4 + map), share the Room ID + 4-digit
     code, friends join until the room fills, and the match auto-starts.
     Topology: star — the host simulates and holds one data channel per
     guest; guests talk only to the host.

     tv_p2p_rooms/{roomId}:
       status waiting → starting → closed · mode · slots · map
       codeHash (the code itself never leaves the creator's screen)
       players: [{ name, team: 'A'|'B', slot, joinedAt }]   (host = slot 0)
     Signaling per guest under the room doc: sig/p{slot}-offer|-answer|-ice
     --------------------------------------------------------------- */
  const RID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   /* no 0/O/1/I/L — readable out loud */
  const mkRid = () => {
    let s = '';
    for (let i = 0; i < 6; i++) s += RID_CHARS[(Math.random() * RID_CHARS.length) | 0];
    return s.slice(0, 3) + '-' + s.slice(3);
  };
  const mkCode = () => ('' + (1000 + ((Math.random() * 9000) | 0)));
  const hash = s => {
    let h = 5381;
    s = String(s || '').toUpperCase().trim();
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(16);
  };
  const normCode = c => String(c || '').toUpperCase().trim();
  const normRoom = r => String(r || '').toUpperCase().trim().replace(/[\s]/g, '').replace(/^TV/, '');
  const SLOTS = { '1v1': 2, '2v2': 4, '4v4': 8 };
  const myName = () => (w.TVG && TVG.state && TVG.state.player && TVG.state.player.name) || 'Player';
  const myId = () => (w.TVG && TVG.uid) ? (TVG.uid() || '') : '';   /* Firestore uid = true identity */

  function createRoom(o) {
    o = o || {};
    const mode = SLOTS[o.mode] ? o.mode : '1v1';
    const me = myName();
    const code = normCode(o.code || mkCode());
    return fsReady(o.fsTimeout || 4000).then(ok => {
      if (!ok) return { ok: false, why: 'no-firebase' };
      const roomId = mkRid();
      return fs().collection('tv_p2p_rooms').doc(roomId).set({
        status: 'waiting', mode, slots: SLOTS[mode], map: o.map || '',
        host: me, hostName: me, codeHash: hash(code),
        players: [{ uid: myId(), name: me, team: 'A', slot: 0, joinedAt: now() }],
        createdAt: now(), createdAtSrv: w.firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => ({ ok: true, roomId, code, mode, map: o.map || '' }));
    });
  }

  function joinRoom(roomId, code, o) {
    o = o || {};
    const me = myName();
    return fsReady(o.fsTimeout || 4000).then(ok => {
      if (!ok) return { ok: false, why: 'no-firebase' };
      const ref = fs().collection('tv_p2p_rooms').doc(normRoom(roomId));
      return fs().runTransaction(async tx => {
        const d = await tx.get(ref);
        if (!d.exists) throw new Error('Room not found — check the ID');
        const v = d.data();
        if (v.status !== 'waiting') throw new Error('Room already full or closed');
        if (now() - (v.createdAt || 0) > 10 * 60 * 1000) { await tx.delete(ref); throw new Error('Room expired'); }   /* self-cleaning */
        if (v.codeHash !== hash(code)) throw new Error('Wrong room code');
        const ps = v.players || [];
        if (ps.length >= (v.slots || 2)) throw new Error('Room already full');
        const muid = myId();
        const mine = ps.findIndex(x => (muid && x.uid === muid) || (!muid && !x.uid && x.name === me));
        if (mine >= 0) return { rejoin: true, slot: ps[mine].slot, mode: v.mode, map: v.map };   /* same player tapping Join again */
        if (ps.some(x => x.name === me)) throw new Error('name-taken');                          /* different account, same display name */
        const nA = ps.filter(x => x.team === 'A').length, nB = ps.filter(x => x.team === 'B').length;
        const team = nA <= nB ? 'A' : 'B';            /* auto-balance; host anchors team A */
        ps.push({ uid: muid, name: me, team, slot: ps.length, joinedAt: now() });
        const full = ps.length >= (v.slots || 2);
        await tx.update(ref, { players: ps, status: full ? 'starting' : 'waiting', guestName: me });
        return { mode: v.mode, map: v.map, slot: ps.length - 1 };
      }).then(r => ({ ok: true, roomId: normRoom(roomId), ...r }))
        .catch(e => ({ ok: false, why: String(e && e.message || e).replace('Firebase: ', '') }));
    });
  }

  /* everyone: resolve with the full roster the moment the room is full */
  function waitStart(roomId, o) {
    o = o || {};
    return new Promise(res => {
      if (!fs()) return res({ ok: false, why: 'no-firebase' });
      const ref = fs().collection('tv_p2p_rooms').doc(normRoom(roomId));
      const un = ref.onSnapshot(s => {
        const d = s.data();
        if (!d) return;
        if (d.status === 'starting' || d.status === 'closed') {
          un(); cleanup();
          res({ ok: d.status === 'starting', roster: d.players || [], mode: d.mode, map: d.map, why: d.status === 'starting' ? null : 'closed' });
        }
      }, () => { un(); cleanup(); res({ ok: false, why: 'listen' }); });
      const cleanup = () => clearTimeout(timer);
      const timer = setTimeout(() => { un(); res({ ok: false, why: 'timeout' }); }, o.timeout || 10 * 60 * 1000);
    });
  }

  /* live roster while filling (for the waiting screen) */
  function watchRoom(roomId, cb) {
    if (!fs()) { cb({ ok: false }); return () => {}; }
    const ref = fs().collection('tv_p2p_rooms').doc(normRoom(roomId));
    const un = ref.onSnapshot(s => cb({ ok: true, players: (s.data() || {}).players || [], status: (s.data() || {}).status } ), () => cb({ ok: false }));
    return un;
  }

  const killRoom = roomId => { if (fs()) { try { fs().collection('tv_p2p_rooms').doc(normRoom(roomId)).delete(); } catch (e) {} } };

  /* guest leaves while waiting: free the slot (fee is refunded by room.html) */
  function leaveRoom(roomId, name) {
    if (!fs()) return;
    const ref = fs().collection('tv_p2p_rooms').doc(normRoom(roomId));
    fs().runTransaction(async tx => {
      const d = await tx.get(ref);
      if (!d.exists) return;
      const v = d.data();
      const ps = (v.players || []).filter(x => x.name !== name);
      if (!ps.length) await tx.delete(ref);
      else await tx.update(ref, { players: ps, status: ps.length >= (v.slots || 2) ? v.status : 'waiting' });
    }).catch(() => {});
  }

  /* ---------------------------------------------------------------
     starMesh(roomId, roster, mySlot) → Promise<node>   (HARDENED)
     • TURN relay fallback (some mobile carriers block direct UDP)
     • session id: every signal doc carries sid — stale docs from a failed
       earlier attempt can never corrupt a fresh handshake
     • early ICE candidates are buffered until the remote description is set
     • guest retries its offer once with a version bump before giving up
     node: { send(m[, slot]), broadcast(m), bind(fn(m, fromSlot)), open, peers(), close() }
     --------------------------------------------------------------- */
  const ICE_FULL = ICE.concat([
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
  ]);

  function starMesh(roomId, roster, mySlot) {
    return new Promise((resolve, reject) => {
      const db = fs(); if (!db) return reject(new Error('no-firebase'));
      const sig = db.collection('tv_p2p_rooms').doc(normRoom(roomId)).collection('sig');
      const isHost = mySlot === 0;
      const chans = {}, pcs = [], unsubs = [];
      let bound = null, settled = false, SID = '', ver = 1;
      let timer = null;

      const finish = ok => {
        clearTimeout(timer);
        unsubs.forEach(u => { try { u(); } catch (e) {} });
        unsubs.length = 0;
        if (ok) resolve(mkNode());
        else {
          for (const k in chans) { try { chans[k].close(); } catch (e) {} }
          pcs.forEach(pc => { try { pc.close(); } catch (e) {} });
          reject(new Error('mesh-timeout'));
        }
      };
      const mkNode = () => ({
        send: (m, slot) => {
          const j = JSON.stringify(m);
          if (slot !== undefined) { const c2 = chans[slot]; if (c2 && c2.readyState === 'open') { try { c2.send(j); } catch (e) {} } }
          else for (const k in chans) { const c3 = chans[k]; if (c3.readyState === 'open') { try { c3.send(j); } catch (e) {} } }
        },
        broadcast(m) { this.send(m); },
        bind: fn => { bound = fn; },
        get open() { return Object.keys(chans).some(k => chans[k].readyState === 'open'); },
        peers: () => Object.keys(chans).filter(k => chans[k].readyState === 'open').map(Number),
        close() {
          settled = true;                                      /* stop retries */
          for (const k in chans) { try { chans[k].close(); } catch (e) {} }
          pcs.forEach(pc => { try { pc.close(); } catch (e) {} });
          cleanupMyDocs();
        }
      });
      const cleanupMyDocs = () => {
        try {
          sig.where('by', '==', mySlot).get().then(q => q.forEach(dd => dd.ref.delete().catch(() => {}))).catch(() => {});
        } catch (e) {}
      };
      const wire = (slot, c) => {
        chans[slot] = c;
        c.onmessage = ev => { if (bound) { try { bound(JSON.parse(ev.data), slot); } catch (e) {} } };
        c.onopen = () => {
          if (settled) return;
          const need = roster.length - 1;
          if (!isHost) { settled = true; finish(true); }
          else if (Object.keys(chans).filter(k => chans[k].readyState === 'open').length >= need) { settled = true; finish(true); }
        };
        c.onclose = () => { if (chans[slot] === c) delete chans[slot]; };
      };
      const mkPC = slot => {
        const pc = new (w.RTCPeerConnection || w.webkitRTCPeerConnection)({ iceServers: ICE_FULL });
        pcs.push(pc);
        pc.pendingIce = [];
        pc.remoteSet = false;
        pc.onicecandidate = ev => {
          if (ev.candidate) sig.doc('p' + mySlot + '-ice-' + Math.random().toString(36).slice(2, 7))
            .set({ v: ev.candidate.toJSON(), by: mySlot, sid: SID }).catch(() => {});
        };
        pc.addIce = cand => {
          if (!pc.remoteSet) pc.pendingIce.push(cand);
          else pc.addIceCandidate(cand).catch(() => {});
        };
        pc.drainIce = () => { pc.remoteSet = true; const q = pc.pendingIce.splice(0); q.forEach(c2 => pc.addIceCandidate(c2).catch(() => {})); };
        return pc;
      };

      const armTimeout = ms => { clearTimeout(timer); timer = setTimeout(() => {
        if (settled) return;
        if (!isHost && ver === 1) {                            /* guest: one fresh retry */
          ver = 2;
          try {
            const pc0 = pcs[0]; if (pc0) { try { pc0.close(); } catch (e) {} }
            pcs.length = 0;
            startGuest();
          } catch (e) { finish(false); }
          armTimeout(18000);
          return;
        }
        finish(false);
      }, ms); };

      const route = doc => {                                   /* one listener routes every signal doc */
        const id = doc.id, d = doc.data();
        if (!d || d.sid !== SID) return;                       /* stale session — ignore */
        if (isHost) {
          const m = /^p(\d+)-(offer|answer|ice-)/.exec(id);
          if (!m) return;
          const s = +m[1];
          if (m[2] === 'offer') hostAnswer(s, d);
        } else {
          if (id === 'p' + mySlot + '-answer' && pcs[0] && pcs[0].signalingState !== 'stable') {
            pcs[0].setRemoteDescription(d.v).then(() => pcs[0].drainIce()).catch(() => {});
          } else if (id.indexOf('p0-ice-') === 0 && pcs[0]) pcs[0].addIce(d.v);
        }
      };

      let lastOfferVer = {};
      function hostAnswer(s, d) {
        if (chans[s] && chans[s].readyState === 'open') return;
        if ((d.ver || 1) <= (lastOfferVer[s] || 0)) return;
        lastOfferVer[s] = d.ver || 1;
        const pc = mkPC(s);
        pc.ondatachannel = ev => wire(s, ev.channel);
        pc.setRemoteDescription(d.v)
          .then(() => { pc.drainIce(); return pc.createAnswer(); })
          .then(ans => pc.setLocalDescription(ans))
          .then(() => sig.doc('p' + s + '-answer').set({ v: pc.localDescription.toJSON(), by: mySlot, sid: SID, ver: d.ver || 1 }))
          .catch(() => {});
      }

      function startGuest() {
        const pc = mkPC(0);
        wire(0, pc.createDataChannel('duel-' + mySlot + '-' + ver, { ordered: false, maxRetransmits: 0 }));
        pc.createOffer().then(off => pc.setLocalDescription(off))
          .then(() => sig.doc('p' + mySlot + '-offer').set({ v: pc.localDescription.toJSON(), by: mySlot, sid: SID, ver }))
          .catch(() => {});
      }

      /* session id: host publishes, guests await (stale signaling is ignored) */
      if (isHost) {
        SID = 'S' + Math.random().toString(36).slice(2, 9);
        sig.doc('sess').set({ sid: SID, by: 0 }).catch(() => {});
        unsubs.push(sig.onSnapshot(s2 => s2.docChanges().forEach(ch2 => { if (ch2.type === 'added' || ch2.doc.id.indexOf('-offer') > 0) route(ch2.doc); }), () => {}));
        armTimeout(22000);
      } else {
        const t0 = now();
        const waitSess = setInterval(() => {
          sig.doc('sess').get().then(dd => {
            if (settled) { clearInterval(waitSess); return; }
            if (dd.exists && dd.data() && dd.data().sid) {
              clearInterval(waitSess);
              SID = dd.data().sid;
              unsubs.push(sig.onSnapshot(s2 => s2.docChanges().forEach(ch2 => { if (ch2.type === 'added' || ch2.doc.id.indexOf('-answer') > 0 || ch2.doc.id.indexOf('p0-ice') === 0) route(ch2.doc); }), () => {}));
              startGuest();
              armTimeout(22000);
            }
          }).catch(() => {});
          if (now() - t0 > 12000) { clearInterval(waitSess); finish(false); }
        }, 700);
      }
    });
  }

  w.TVGP2P = { findOpponent, connect, fsReady, createRoom, joinRoom, waitStart, watchRoom, killRoom, leaveRoom, starMesh };
})(window);
