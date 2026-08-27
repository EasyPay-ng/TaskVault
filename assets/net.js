/* ============================================================
   TASKVAULT GAME — NETWORK CLIENT
   Same-origin WebSocket. Never hardcodes a host, so it works
   through the preview proxy and in production alike.
   ============================================================ */
(function (w) {
  'use strict';

  const listeners = {};
  let ws = null, ready = false, authed = false;
  let reconnectTries = 0, intentionalClose = false;
  let pingTimer = null, latency = 0;

  function urlFor() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + location.host + '/ws';
  }

  function on(type, fn) {
    (listeners[type] = listeners[type] || []).push(fn);
    return () => off(type, fn);
  }
  function off(type, fn) {
    const a = listeners[type]; if (!a) return;
    const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
  }
  function emit(type, data) {
    (listeners[type] || []).forEach(f => { try { f(data); } catch (e) { console.error(e); } });
    (listeners['*'] || []).forEach(f => f(type, data));
  }

  function connect(name) {
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) {
      if (!authed && name) send('auth', { name });
      return;
    }
    intentionalClose = false;
    try { ws = new WebSocket(urlFor()); }
    catch (e) { emit('neterror', { msg: 'Cannot open socket' }); return; }

    ws.onopen = () => {
      ready = true; reconnectTries = 0;
      emit('open', {});
      send('auth', { name: name || (w.TVG && TVG.state.player.name) || 'Player' });
      clearInterval(pingTimer);
      pingTimer = setInterval(() => send('ping', { t: Date.now() }), 4000);
    };

    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.type === 'pong') { latency = Date.now() - m.t; emit('latency', { ms: latency }); return; }
      if (m.type === 'authed') {
        authed = true;
        if (w.TVG) { TVG.state.player.netName = m.name; TVG.save(); }
      }
      emit(m.type, m);
    };

    ws.onclose = () => {
      ready = false; authed = false;
      clearInterval(pingTimer);
      emit('close', {});
      if (!intentionalClose && reconnectTries < 5) {
        const delay = Math.min(4000, 400 * Math.pow(2, reconnectTries++));
        setTimeout(() => connect(name), delay);
      }
    };

    ws.onerror = () => emit('neterror', { msg: 'Socket error' });
  }

  function send(type, data) {
    if (!ws || ws.readyState !== 1) return false;
    try { ws.send(JSON.stringify({ type, ...(data || {}) })); return true; }
    catch (e) { return false; }
  }

  function close() { intentionalClose = true; clearInterval(pingTimer); if (ws) ws.close(); }

  w.TVGNet = {
    connect, send, close, on, off,
    get ready()   { return ready; },
    get authed()  { return authed; },
    get latency() { return latency; },
    get online()  { return ws && ws.readyState === 1; }
  };
})(window);
