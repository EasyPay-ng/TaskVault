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
function action(fn) { return async event => { event?.preventDefault(); const button = event?.submitter || (event?.target?.tagName === 'BUTTON' ? event.target : null); if(button) button.disabled = true; try { await fn(event); } catch(e) { notice(e.message); } finally { if(button) button.disabled = false; } }; }
function watch(ref, fn) { onSnapshot(ref, fn, e => notice(e.message)); }
const checkins = uid => collection(db, 'streakMembers', uid, 'checkins');
const extractDates = snap => snap.docs.map(d => d.data().createdAt?.toDate()).filter(Boolean);
function renderStreaks() {
  $('streaks').innerHTML = types.map(type => `<article><h2>${type}</h2><strong>${streakCount(dates,type)} consecutive ${type === 'daily' ? 'days' : type === 'weekly' ? 'weeks' : 'months'}</strong><p>${settings[type] === true ? 'Active · manual rewards' : 'Inactive · rewards paused'}</p></article>`).join('');
  $('checkin').disabled = !types.some(type => settings[type] === true) || dates.some(d => periodIndex(d,'daily') === periodIndex(new Date(),'daily'));
}
onAuthStateChanged(auth, current => {
  if (!current) { location.href = 'login.html'; return; }
  user = current;
  const admin = ['beniwealth70@gmail.com','baasituoppor01@gmail.com'].includes(user.email);
  if (page === 'admin-community' && !admin) { document.querySelector('main').textContent = 'Admin access required.'; return; }
  notice('Ready');
  watch(doc(db,'communitySettings','streaks'), snap => {
    settings = snap.exists() ? snap.data() : {};
    if(page === 'streaks') renderStreaks();
    if(page === 'admin-community') {
      $('settings').replaceChildren(...types.map(type => {
        const label = document.createElement('label'), input = document.createElement('input');
        input.type = 'checkbox'; input.checked = settings[type] === true;
        input.onchange = action(async () => { await setDoc(doc(db,'communitySettings','streaks'),{[type]:input.checked},{merge:true}); notice('Availability saved.'); });
        label.append(input, ` ${type} active`); return label;
      }));
    }
  });
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
  if(page === 'admin-community') setupRewards();
  if(page !== 'streaks') setupSupport(admin && page === 'admin-community');
});
function setupRewards() {
  $('member').oninput = () => { reviewedUid = null; $('rewardForm').hidden = true; };
  $('reviewForm').onsubmit = action(async () => {
    const uid = $('member').value.trim();
    const snap = await getDocs(checkins(uid));
    dates = extractDates(snap); reviewedUid = uid;
    $('review').textContent = types.map(t => `${t}: ${streakCount(dates,t)}`).join(' · ');
    $('rewardForm').hidden = false;
  });
  $('rewardForm').onsubmit = action(async () => {
    if(!reviewedUid || reviewedUid !== $('member').value.trim()) throw Error('Review this member first.');
    const uid = reviewedUid, type = $('rewardType').value, amount = Number($('amount').value);
    if(!Number.isFinite(amount) || amount <= 0) throw Error('Enter a positive amount.');
    const freshDates = extractDates(await getDocs(checkins(uid)));
    if(!streakCount(freshDates,type)) throw Error('No current streak for this type.');
    const period = periodIndex(new Date(),type);
    if(!confirm(`Pay ₦${amount} to ${uid} for ${type} streak?`)) return;
    await runTransaction(db, async tx => {
      const reward = doc(db,'streakRewards',`${uid}_${type}_${period}`), member = doc(db,'users',uid);
      const [existing, config, profile] = await Promise.all([tx.get(reward),tx.get(doc(db,'communitySettings','streaks')),tx.get(member)]);
      if(existing.exists()) throw Error('This period has already been rewarded.');
      if(config.data()?.[type] !== true) throw Error('This streak type is inactive.');
      if(!profile.exists()) throw Error('Member not found.');
      tx.set(reward,{userId:uid,type,period,amount,streak:streakCount(freshDates,type),adminId:user.uid,createdAt:serverTimestamp()});
      tx.update(member,{balance:increment(amount),updatedAt:serverTimestamp()});
    });
    notice('Reward paid and recorded.');
  });
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
