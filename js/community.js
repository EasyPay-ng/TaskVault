import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js';
import { getFirestore, doc, collection, query, where, onSnapshot, getDocs, getDoc, setDoc, addDoc, runTransaction, serverTimestamp, increment } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';
import { streakCount, periodIndex } from './engagement-core.mjs';
const app = initializeApp({apiKey:'AIzaSyAv6QCpopa0Q77AVTyjU5cqJEIKIE9OVTs',authDomain:'taskvault-412a0.firebaseapp.com',projectId:'taskvault-412a0'});
const db = getFirestore(app), auth = getAuth(app), page = document.body.dataset.page;
const $ = id => document.getElementById(id);
const types = ['daily','weekly','monthly'];
let user, settings = {}, dates = [], reviewedUid;
const notice = text => $('notice').textContent = text;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function action(fn) { return async event => { event?.preventDefault(); const button = event?.submitter || (event?.target?.tagName === 'BUTTON' ? event.target : null); if(button) button.disabled = true; try { await fn(event); } catch(e) { notify(e.message,'err'); } finally { if(button) button.disabled = false; } }; }
function watch(ref, fn) { return onSnapshot(ref, fn, e => notify(e.message,'err')); }
const checkins = uid => collection(db, 'streakMembers', uid, 'checkins');
const extractDates = snap => snap.docs.map(d => d.data().createdAt?.toDate()).filter(Boolean);

/* ---------- notice pill (admin console) / plain banner (member pages) ---------- */
const isAdminPage = page === 'admin-community';
function notify(text, kind) {
  const el = $('notice'); if(!el) return;
  if(!isAdminPage) { el.textContent = text; return; }
  el.textContent = ''; el.classList.remove('hidden','ok','err');
  if(kind === 'ok' || kind === 'err') el.classList.add(kind);
  const dot = document.createElement('span'); dot.className = 'dot';
  el.append(dot, document.createTextNode(' ' + text));
}
const timeAgo = ts => {
  if(!ts) return '—';
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if(s < 60) return s + 's ago';
  if(s < 3600) return Math.floor(s / 60) + 'm ago';
  if(s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
};
const fmtDate = d => d ? d.toUTCString().slice(5, 16) : '—';
function periodLabel(type, period) {
  if(type === 'daily') return fmtDate(new Date(period * 86400000));
  if(type === 'weekly') { const day = period * 7 - 3; return 'wk of ' + fmtDate(new Date(day * 86400000)); }
  const y = Math.floor(period / 12), m = period % 12;
  return new Date(Date.UTC(y, m, 1)).toUTCString().slice(8, 11) + ' ' + y;
}
const naira = n => '₦' + Number(n || 0).toLocaleString('en-NG', {minimumFractionDigits: 0, maximumFractionDigits: 2});

/* ==========================================================================
   MEMBER PAGES (streaks.html / support.html) — unchanged behaviour
   ========================================================================== */
function renderStreaks() {
  $('streaks').innerHTML = types.map(type => `<article><h2>${type}</h2><strong>${streakCount(dates,type)} consecutive ${type === 'daily' ? 'days' : type === 'weekly' ? 'weeks' : 'months'}</strong><p>${settings[type] === true ? 'Active · manual rewards' : 'Inactive · rewards paused'}</p></article>`).join('');
  $('checkin').disabled = !types.some(type => settings[type] === true) || dates.some(d => periodIndex(d,'daily') === periodIndex(new Date(),'daily'));
}
function setupSupport(admin) {
  if(!admin) $('ticketForm').onsubmit = action(async event => {
    const form = event.target, subject = form.subject.value.trim(), body = form.body.value.trim();
    if(!subject || !body) throw Error('Subject and message are required.');
    await addDoc(collection(db,'supportTickets'),{userId:user.uid,subject,body,status:'open',createdAt:serverTimestamp()});
    form.reset(); notice('Ticket opened. Replies appear here.');
  });
  const tickets = collection(db,'supportTickets');
  watch(admin ? tickets : query(tickets,where('userId','==',user.uid)), snap => {
    $('tickets').replaceChildren();
    if(snap.empty) $('tickets').textContent = 'No tickets yet.';
    snap.docs.sort((a,b) => (b.data().createdAt?.toMillis() || 0) - (a.data().createdAt?.toMillis() || 0)).forEach(ticket => {
      const data = ticket.data(), article = document.createElement('article');
      article.innerHTML = `<h3>${escape(data.subject)}</h3><small>${escape(data.status)} · ${escape(ticket.id)}${admin ? ' · '+escape(data.userId) : ''}</small><p class="message">${escape(data.body)}</p><button>View conversation</button>`;
      article.querySelector('button').onclick = action(async event => {
        event.target.remove();
        const messages = document.createElement('div'); article.append(messages);
        watch(collection(db,'supportTickets',ticket.id,'messages'), replies => {
          messages.innerHTML = replies.docs.sort((a,b) => (a.data().createdAt?.toMillis() || 0) - (b.data().createdAt?.toMillis() || 0)).map(d => `<div class="message"><strong>${d.data().role === 'admin' ? 'Support' : 'You / member'}</strong><br>${escape(d.data().body)}</div>`).join('');
        });
        const form = document.createElement('form');
        form.innerHTML = '<label>Reply<textarea name="body" required maxlength="3000"></textarea></label><button>Send reply</button>';
        form.onsubmit = action(async () => {
          const body = form.body.value.trim(); if(!body) throw Error('Write a reply.');
          await addDoc(collection(db,'supportTickets',ticket.id,'messages'),{senderId:user.uid,role:admin?'admin':'user',body,createdAt:serverTimestamp()});
          form.reset(); notice('Reply sent.');
        }); article.append(form);
        if(admin) {
          const button = document.createElement('button'); button.textContent = data.status === 'closed' ? 'Reopen ticket' : 'Close ticket';
          button.onclick = action(async () => setDoc(doc(db,'supportTickets',ticket.id),{status:data.status === 'closed'?'open':'closed'},{merge:true})); article.append(button);
        }
      });
      $('tickets').append(article);
    });
  });
}

/* ==========================================================================
   ADMIN CONSOLE (admin-community.html)
   ========================================================================== */
let ticketsAll = [], rewardsAll = [], ticketFilter = 'all', ticketQuery = '';
const expanded = new Set();
const threadSubs = new Map();

function setupAdminConsole() {
  /* ---- streak availability switches ---- */
  const SWITCH_META = {
    daily:{ic:'ri-sun-line', cls:'orange', d:'Consecutive UTC days with a check-in'},
    weekly:{ic:'ri-calendar-2-line', cls:'blue', d:'Consecutive weeks (weeks start Monday)'},
    monthly:{ic:'ri-calendar-month-line', cls:'purple', d:'Consecutive calendar months'}
  };
  watch(doc(db,'communitySettings','streaks'), snap => {
    settings = snap.exists() ? snap.data() : {};
    const host = $('settings');
    host.replaceChildren(...types.map(type => {
      const on = settings[type] === true, m = SWITCH_META[type];
      const row = document.createElement('div');
      row.className = 'switch' + (on ? ' on' : '');
      row.innerHTML = `<div class="ic ${m.cls}" style="background:var(--${m.cls === 'orange' ? 'orange-soft' : m.cls + '-light'});color:var(--${m.cls === 'orange' ? 'orange-dark' : m.cls === 'blue' ? 'blue' : 'purple'})"><i class="${m.ic}"></i></div>
        <div class="t"><b>${type} streak <span class="led"></span></b><span>${m.d}</span></div>
        <button class="tgl ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${type} streak active"></button>`;
      row.querySelector('.tgl').onclick = action(async () => {
        await setDoc(doc(db,'communitySettings','streaks'),{[type]:!on},{merge:true});
        notify(`${type} streak program ${!on ? 'activated' : 'paused'}.`, 'ok');
      });
      return row;
    }));
    const active = types.filter(t => settings[t] === true).length;
    $('stProg').textContent = active + '/3';
    renderStats();
  });

  /* ---- support inbox ---- */
  $('ticketFilter').querySelectorAll('button').forEach(b => b.onclick = () => {
    ticketFilter = b.dataset.f;
    $('ticketFilter').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    renderInbox();
  });
  $('ticketSearch').oninput = e => { ticketQuery = e.target.value.trim().toLowerCase(); renderInbox(); };
  watch(collection(db,'supportTickets'), snap => {
    ticketsAll = snap.docs.map(d => ({id:d.id, ...d.data()}))
      .sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    renderInbox(); renderStats();
  });

  /* ---- reward ledger ---- */
  watch(collection(db,'streakRewards'), snap => {
    rewardsAll = snap.docs.map(d => ({id:d.id, ...d.data()}))
      .sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    renderLedger(); renderStats();
  });

  /* ---- manual review & payout ---- */
  $('member').oninput = () => { reviewedUid = null; $('rewardForm').hidden = true; $('review').innerHTML = ''; };
  $('reviewForm').onsubmit = action(async () => {
    const uid = $('member').value.trim();
    if(!uid) throw Error('Enter a member UID.');
    const snap = await getDocs(checkins(uid));
    dates = extractDates(snap); reviewedUid = uid;
    renderReview(uid);
    $('rewardForm').hidden = false;
  });
  $('rewardForm').onsubmit = action(async () => {
    if(!reviewedUid || reviewedUid !== $('member').value.trim()) throw Error('Review this member first.');
    const uid = reviewedUid, type = $('rewardType').value, amount = Number($('amount').value);
    if(!Number.isFinite(amount) || amount <= 0) throw Error('Enter a positive amount.');
    const freshDates = extractDates(await getDocs(checkins(uid)));
    if(!streakCount(freshDates,type)) throw Error('No current streak for this type.');
    const period = periodIndex(new Date(),type);
    if(!confirm(`Pay ${naira(amount)} to ${uid} for ${type} streak (${streakCount(freshDates,type)} in a row)?`)) return;
    await runTransaction(db, async tx => {
      const reward = doc(db,'streakRewards',`${uid}_${type}_${period}`), member = doc(db,'users',uid);
      const [existing, config, profile] = await Promise.all([tx.get(reward),tx.get(doc(db,'communitySettings','streaks')),tx.get(member)]);
      if(existing.exists()) throw Error('This period has already been rewarded.');
      if(config.data()?.[type] !== true) throw Error('This streak type is inactive.');
      if(!profile.exists()) throw Error('Member not found.');
      tx.set(reward,{userId:uid,type,period,amount,streak:streakCount(freshDates,type),adminId:user.uid,createdAt:serverTimestamp()});
      tx.update(member,{balance:increment(amount),updatedAt:serverTimestamp()});
    });
    notify(`Reward of ${naira(amount)} paid to ${uid.slice(0,8)}… for the ${type} streak.`, 'ok');
    dates = freshDates; renderReview(uid);
  });
}

function renderStats() {
  const open = ticketsAll.filter(t => t.status !== 'closed').length;
  $('stOpen').textContent = ticketsAll.length ? open : '0';
  $('stOpenSub').textContent = open === 1 ? '1 conversation waiting' : open + ' conversations waiting';
  $('stClosed').textContent = ticketsAll.length - open;
  const total = rewardsAll.reduce((s,r) => s + Number(r.amount || 0), 0);
  $('stPaid').textContent = naira(total);
  $('stPaidSub').textContent = rewardsAll.length + (rewardsAll.length === 1 ? ' payment' : ' payments');
}

function renderInbox() {
  threadSubs.forEach(un => un()); threadSubs.clear();
  const host = $('tickets');
  const q = ticketQuery;
  const rows = ticketsAll.filter(t => {
    if(ticketFilter === 'open' && t.status === 'closed') return false;
    if(ticketFilter === 'closed' && t.status !== 'closed') return false;
    if(!q) return true;
    return (t.subject || '').toLowerCase().includes(q) || (t.userId || '').toLowerCase().includes(q) || (t.body || '').toLowerCase().includes(q);
  });
  $('inboxCount').textContent = rows.length + (rows.length === 1 ? ' ticket' : ' tickets');
  host.replaceChildren();
  if(!rows.length) {
    host.innerHTML = '<div class="empty"><i class="ri-mail-open-line"></i>No tickets match this view.<br>New member tickets appear here in real time.</div>';
    return;
  }
  rows.forEach(t => {
    const isOpen = t.status !== 'closed';
    const card = document.createElement('div');
    card.className = 'ticket' + (expanded.has(t.id) ? ' opened' : '');
    const initials = (t.userId || '??').slice(0,2).toUpperCase();
    card.innerHTML = `
      <div class="head">
        <div class="ava">${escape(initials)}</div>
        <div class="t1">
          <div class="subj">${escape(t.subject || '(no subject)')} <span class="pill ${isOpen ? 'open' : 'closed'}">${isOpen ? 'open' : 'closed'}</span></div>
          <div class="meta"><code>${escape(t.userId || 'unknown')}</code><span><i class="ri-time-line"></i> ${timeAgo(t.createdAt?.toMillis())}</span><span>${fmtDate(t.createdAt?.toDate())}</span></div>
          <div class="prev">${escape(t.body || '')}</div>
        </div>
        <i class="ri-arrow-down-s-line chev"></i>
      </div>`;
    const body = document.createElement('div');
    card.append(body);
    card.querySelector('.head').onclick = () => {
      if(expanded.has(t.id)) expanded.delete(t.id); else expanded.add(t.id);
      renderInbox();
    };
    if(expanded.has(t.id)) mountThread(body, t);
    host.append(card);
  });
}

function mountThread(host, t) {
  const thread = document.createElement('div');
  thread.className = 'thread';
  thread.innerHTML = '<div class="msgs" style="display:flex;flex-direction:column;gap:10px"></div>';
  const msgs = thread.firstElementChild;
  const first = document.createElement('div');
  first.className = 'msg user';
  first.innerHTML = `<span class="who"><i class="ri-user-3-line"></i> Member opening message</span>${escape(t.body || '')}<span class="when">${timeAgo(t.createdAt?.toMillis())}</span>`;
  msgs.append(first);
  const replies = document.createElement('div');
  replies.style.cssText = 'display:flex;flex-direction:column;gap:10px';
  msgs.append(replies);
  const un = watch(collection(db,'supportTickets',t.id,'messages'), snap => {
    const docs = snap.docs.sort((a,b) => (a.data().createdAt?.toMillis() || 0) - (b.data().createdAt?.toMillis() || 0));
    replies.replaceChildren(...docs.map(d => {
      const m = d.data(), el = document.createElement('div');
      el.className = 'msg ' + (m.role === 'admin' ? 'admin' : 'user');
      el.innerHTML = `<span class="who">${m.role === 'admin' ? '<i class="ri-headphone-line"></i> Support' : '<i class="ri-user-3-line"></i> Member'}</span>${escape(m.body || '')}<span class="when">${timeAgo(m.createdAt?.toMillis())}</span>`;
      return el;
    }));
  });
  threadSubs.set(t.id, un);
  const composer = document.createElement('form');
  composer.className = 'composer';
  composer.innerHTML = '<textarea name="body" maxlength="3000" placeholder="Reply as support…"></textarea><button class="btn small" type="submit"><i class="ri-send-plane-2-fill"></i> Send</button>';
  composer.onsubmit = action(async () => {
    const b = composer.body.value.trim(); if(!b) throw Error('Write a reply first.');
    await addDoc(collection(db,'supportTickets',t.id,'messages'),{senderId:user.uid,role:'admin',body:b,createdAt:serverTimestamp()});
    composer.reset(); notify('Reply sent to member.', 'ok');
  });
  const actions = document.createElement('div');
  actions.className = 'threadActions';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn small ' + (t.status === 'closed' ? 'ghost' : 'danger');
  toggle.innerHTML = t.status === 'closed' ? '<i class="ri-refresh-line"></i> Reopen ticket' : '<i class="ri-check-double-line"></i> Close ticket';
  toggle.onclick = action(async () => {
    await setDoc(doc(db,'supportTickets',t.id),{status:t.status === 'closed' ? 'open' : 'closed'},{merge:true});
    notify('Ticket ' + (t.status === 'closed' ? 'reopened.' : 'closed.'), 'ok');
  });
  actions.append(toggle);
  thread.append(composer, actions);
  host.append(thread);
}

function renderReview(uid) {
  const now = new Date(), today = periodIndex(now,'daily');
  const set = new Set(dates.map(d => periodIndex(d,'daily')));
  let heat = '';
  for(let i = 13; i >= 0; i--) heat += `<i class="${set.has(today - i) ? 'f' : ''} ${i === 0 ? 'today' : ''}" title="${fmtDate(new Date((today - i) * 86400000))}"></i>`;
  const last = dates.length ? new Date(Math.max(...dates.map(d => +d))) : null;
  $('review').innerHTML = `
    <div class="reviewBox">
      <div class="uid"><span>Reviewing <code>${escape(uid)}</code></span><span>Last check-in: <b>${last ? fmtDate(last) + ' (' + timeAgo(+last) + ')' : 'never'}</b></span></div>
      <div class="chips">
        ${types.map(t => `<div class="chip ${t[0]}"><div class="n">${streakCount(dates,t)}</div><div class="l">${t} in a row</div></div>`).join('')}
      </div>
      <div class="heat">${heat}</div>
      <div class="heatLbl">Last 14 UTC days · outlined square is today</div>
    </div>`;
}

function renderLedger() {
  const tbody = $('ledger').querySelector('tbody');
  $('ledgerTotal').textContent = naira(rewardsAll.reduce((s,r) => s + Number(r.amount || 0), 0));
  if(!rewardsAll.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray-400);padding:26px">No manual rewards paid yet.</td></tr>';
    return;
  }
  tbody.innerHTML = rewardsAll.map(r => `
    <tr>
      <td><code>${escape((r.userId || '?').slice(0,10))}…</code></td>
      <td><span class="typeTag ${escape(r.type || '')}">${escape(r.type || '?')}</span></td>
      <td>${Number(r.streak || 0)} · ${escape(periodLabel(r.type, r.period))}</td>
      <td class="amt">${naira(r.amount)}</td>
      <td title="${escape(r.id)}">${timeAgo(r.createdAt?.toMillis())}</td>
    </tr>`).join('');
}

/* ==========================================================================
   BOOT
   ========================================================================== */
onAuthStateChanged(auth, current => {
  if (!current) { location.href = 'login.html'; return; }
  user = current;
  const admin = ['beniwealth70@gmail.com','baasituoppor01@gmail.com'].includes(user.email);
  if (page === 'admin-community' && !admin) { document.querySelector('main').textContent = 'Admin access required.'; return; }
  if (isAdminPage) notify('Live · connected as ' + user.email, 'ok'); else notice('Ready');
  if (page === 'streaks' || page === 'support') {
    watch(doc(db,'communitySettings','streaks'), snap => {
      settings = snap.exists() ? snap.data() : {};
      if(page === 'streaks') renderStreaks();
    });
  }
  if(page === 'streaks') {
    watch(checkins(user.uid), snap => { dates = extractDates(snap); renderStreaks(); });
    $('checkin').onclick = action(async () => {
      const now = new Date();
      await setDoc(doc(db,'streakMembers',user.uid,'checkins',String(periodIndex(now,'daily'))),{createdAt:serverTimestamp(),day:periodIndex(now,'daily')});
      notice('Check-in recorded. Rewards are awarded manually.');
    });
    watch(query(collection(db,'streakRewards'),where('userId','==',user.uid)), snap => {
      $('rewards').innerHTML = snap.empty ? '<p>No rewards yet.</p>' : snap.docs.map(d => `<article>${escape(d.data().type)} · ₦${Number(d.data().amount).toLocaleString()} · paid</article>`).join('');
    });
  }
  if(page === 'admin-community' && admin) setupAdminConsole();
  if(page === 'support') setupSupport(false);
});
