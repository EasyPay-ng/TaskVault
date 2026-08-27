/* ============================================================
   TASKVAULT GAME — ART LIBRARY
   Hand-built inline SVG weapon & operator artwork.
   Shared <defs> injected once; items reference by fragment id.
   ============================================================ */
(function (w) {
  'use strict';

  /* ---------- GLOBAL DEFS (injected once) ---------- */
  const DEFS = `
<svg id="tvg-defs" width="0" height="0" style="position:absolute;pointer-events:none" aria-hidden="true"><defs>

  <linearGradient id="mGun" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#5A5F66"/>
    <stop offset="18%"  stop-color="#3A3E44"/>
    <stop offset="42%"  stop-color="#24272B"/>
    <stop offset="58%"  stop-color="#2C3035"/>
    <stop offset="82%"  stop-color="#17191C"/>
    <stop offset="100%" stop-color="#0E1012"/>
  </linearGradient>

  <linearGradient id="mSteel" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#E8ECEF"/>
    <stop offset="22%"  stop-color="#AEB6BD"/>
    <stop offset="48%"  stop-color="#79838C"/>
    <stop offset="62%"  stop-color="#98A2AA"/>
    <stop offset="100%" stop-color="#4C545B"/>
  </linearGradient>

  <linearGradient id="mPoly" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#43484E"/>
    <stop offset="30%"  stop-color="#2A2E33"/>
    <stop offset="70%"  stop-color="#1D2024"/>
    <stop offset="100%" stop-color="#101215"/>
  </linearGradient>

  <linearGradient id="mWood" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#B9793F"/>
    <stop offset="30%"  stop-color="#965A28"/>
    <stop offset="70%"  stop-color="#7A481E"/>
    <stop offset="100%" stop-color="#553114"/>
  </linearGradient>

  <linearGradient id="mTan" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#D8C09A"/>
    <stop offset="35%"  stop-color="#BFA279"/>
    <stop offset="72%"  stop-color="#9E845E"/>
    <stop offset="100%" stop-color="#7A6544"/>
  </linearGradient>

  <linearGradient id="mOlive" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#6E7A52"/>
    <stop offset="35%"  stop-color="#525C3A"/>
    <stop offset="75%"  stop-color="#3E462B"/>
    <stop offset="100%" stop-color="#2A301C"/>
  </linearGradient>

  <linearGradient id="mBrass" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#F2D48A"/>
    <stop offset="40%"  stop-color="#C9A44E"/>
    <stop offset="100%" stop-color="#8A6B23"/>
  </linearGradient>

  <linearGradient id="mGlass" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%"   stop-color="#BFE6FF" stop-opacity=".95"/>
    <stop offset="45%"  stop-color="#4B8FBF" stop-opacity=".8"/>
    <stop offset="100%" stop-color="#12293B" stop-opacity=".9"/>
  </linearGradient>

  <linearGradient id="mSkin" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#C99C74"/><stop offset="100%" stop-color="#8E6642"/>
  </linearGradient>

  <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#fff" stop-opacity=".38"/>
    <stop offset="45%"  stop-color="#fff" stop-opacity=".06"/>
    <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>

  <radialGradient id="rimLight" cx="30%" cy="18%" r="85%">
    <stop offset="0%"   stop-color="#fff" stop-opacity=".30"/>
    <stop offset="55%"  stop-color="#fff" stop-opacity=".04"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".18"/>
  </radialGradient>

  <radialGradient id="groundShadow" cx="50%" cy="50%" r="50%">
    <stop offset="0%"   stop-color="#3A2412" stop-opacity=".45"/>
    <stop offset="65%"  stop-color="#3A2412" stop-opacity=".16"/>
    <stop offset="100%" stop-color="#3A2412" stop-opacity="0"/>
  </radialGradient>

  <filter id="softDrop" x="-30%" y="-30%" width="160%" height="170%">
    <feDropShadow dx="0" dy="3" stdDeviation="3.2" flood-color="#4A2C10" flood-opacity=".38"/>
  </filter>

  <filter id="innerDark" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="1" stdDeviation="0.7" flood-color="#000" flood-opacity=".5"/>
  </filter>

</defs></svg>`;

  function ensureDefs() {
    if (!document.getElementById('tvg-defs')) {
      const d = document.createElement('div');
      d.innerHTML = DEFS;
      document.body.appendChild(d.firstElementChild);
    }
  }

  /* ---------- helpers ---------- */
  const grain = (x, y, w, h, n) => {
    let s = '';
    for (let i = 1; i < n; i++) {
      const yy = y + (h / n) * i;
      s += `<line x1="${x + 2}" y1="${yy}" x2="${x + w - 2}" y2="${yy}" stroke="#000" stroke-opacity=".13" stroke-width=".7"/>`;
    }
    return s;
  };
  const ribs = (x, y, w, h, n, op) => {
    let s = '';
    for (let i = 0; i < n; i++) {
      const xx = x + (w / n) * i + 1;
      s += `<rect x="${xx}" y="${y}" width="${Math.max(1, w / n - 2)}" height="${h}" fill="#000" fill-opacity="${op || .22}" rx="1"/>`;
    }
    return s;
  };

  /* ============================================================
     WEAPONS — viewBox 0 0 240 110
     ============================================================ */
  const W = {};

  W.ak47 = () => `
    <g filter="url(#softDrop)">
      <rect x="16" y="47" width="58" height="7"  rx="2" fill="url(#mSteel)"/>
      <rect x="16" y="47" width="58" height="2.4" rx="1" fill="#fff" fill-opacity=".28"/>
      <path d="M26 47 L26 38 L31 38 L31 47Z" fill="url(#mGun)"/>
      <rect x="60" y="40" width="16" height="9" rx="2" fill="url(#mGun)"/>
      <rect x="70" y="38" width="34" height="11" rx="3" fill="url(#mWood)"/>
      ${grain(70, 38, 34, 11, 3)}
      <rect x="66" y="51" width="42" height="15" rx="4" fill="url(#mWood)"/>
      ${grain(66, 51, 42, 15, 4)}
      <rect x="66" y="51" width="42" height="3" rx="1.5" fill="#fff" fill-opacity=".16"/>
      <rect x="104" y="40" width="66" height="25" rx="3" fill="url(#mGun)"/>
      <rect x="104" y="40" width="66" height="4" rx="2" fill="#fff" fill-opacity=".13"/>
      <rect x="150" y="38" width="20" height="5" rx="2" fill="url(#mGun)"/>
      <path d="M114 64 q4 20 10 27 q10 5 20 1 q-6 -12 -6 -28 Z" fill="url(#mGun)"/>
      <path d="M116 66 q4 18 9 24" stroke="#fff" stroke-opacity=".14" stroke-width="2" fill="none"/>
      <path d="M148 64 L168 64 L162 94 L146 94 Z" fill="url(#mPoly)"/>
      <path d="M150 66 L156 66 L152 90 L148 90Z" fill="#fff" fill-opacity=".08"/>
      <path d="M136 65 q10 10 12 0" stroke="url(#mGun)" stroke-width="3" fill="none"/>
      <path d="M168 44 L228 36 L232 44 L232 56 L206 62 L168 62 Z" fill="url(#mWood)"/>
      ${grain(172, 42, 56, 18, 4)}
      <path d="M168 44 L228 36 L229 40 L168 48Z" fill="#fff" fill-opacity=".18"/>
      <rect x="160" y="36" width="9" height="4" rx="1" fill="url(#mGun)"/>
    </g>`;

  W.m4a1 = () => `
    <g filter="url(#softDrop)">
      <rect x="14" y="47" width="62" height="6" rx="2" fill="url(#mGun)"/>
      <rect x="14" y="47" width="62" height="2" rx="1" fill="#fff" fill-opacity=".2"/>
      <rect x="12" y="45" width="10" height="10" rx="2" fill="url(#mGun)"/>
      <rect x="62" y="40" width="46" height="16" rx="4" fill="url(#mPoly)"/>
      ${ribs(64, 42, 42, 12, 7, .3)}
      <rect x="62" y="40" width="46" height="3" rx="1.5" fill="#fff" fill-opacity=".14"/>
      <path d="M78 38 L82 30 L86 38Z" fill="url(#mGun)"/>
      <rect x="60" y="34" width="112" height="6" rx="2" fill="url(#mGun)"/>
      ${ribs(62, 35, 106, 4, 22, .35)}
      <rect x="108" y="40" width="62" height="24" rx="3" fill="url(#mPoly)"/>
      <rect x="108" y="40" width="62" height="4" rx="2" fill="#fff" fill-opacity=".12"/>
      <circle cx="150" cy="50" r="4" fill="#0C0E10"/>
      <rect x="120" y="63" width="18" height="30" rx="3" fill="url(#mPoly)"/>
      ${ribs(121, 66, 16, 24, 5, .28)}
      <path d="M146 63 L166 63 L160 92 L144 92Z" fill="url(#mPoly)"/>
      <path d="M136 64 q10 10 10 0" stroke="url(#mGun)" stroke-width="3" fill="none"/>
      <rect x="170" y="44" width="14" height="16" rx="2" fill="url(#mPoly)"/>
      <path d="M184 42 L222 42 L226 48 L226 58 L184 62Z" fill="url(#mPoly)"/>
      <rect x="186" y="46" width="34" height="3" rx="1.5" fill="#fff" fill-opacity=".1"/>
      <rect x="196" y="34" width="6" height="10" rx="2" fill="url(#mGun)"/>
    </g>`;

  W.mp5 = () => `
    <g filter="url(#softDrop)">
      <rect x="26" y="46" width="42" height="9" rx="4" fill="url(#mGun)"/>
      <circle cx="30" cy="50.5" r="5" fill="#0B0D0F"/>
      <circle cx="30" cy="50.5" r="2.4" fill="#000"/>
      <rect x="42" y="41" width="6" height="6" rx="1" fill="url(#mGun)"/>
      <rect x="62" y="40" width="34" height="18" rx="5" fill="url(#mPoly)"/>
      ${ribs(64, 43, 30, 12, 5, .3)}
      <rect x="90" y="36" width="72" height="24" rx="4" fill="url(#mPoly)"/>
      <rect x="90" y="36" width="72" height="4" rx="2" fill="#fff" fill-opacity=".14"/>
      <rect x="96" y="30" width="46" height="7" rx="3" fill="url(#mGun)"/>
      <circle cx="104" cy="33" r="2.6" fill="#0B0D0F"/>
      <path d="M102 60 q3 18 7 28 l16 2 q-6 -14 -6 -30Z" fill="url(#mPoly)"/>
      ${grain(104, 64, 14, 22, 4)}
      <path d="M132 59 L152 59 L147 88 L131 88Z" fill="url(#mPoly)"/>
      <path d="M122 60 q9 9 10 0" stroke="url(#mGun)" stroke-width="3" fill="none"/>
      <rect x="162" y="42" width="52" height="8" rx="3" fill="url(#mGun)"/>
      <rect x="206" y="36" width="12" height="22" rx="3" fill="url(#mPoly)"/>
    </g>`;

  W.awp = () => `
    <g filter="url(#softDrop)">
      <rect x="8" y="49" width="76" height="6" rx="3" fill="url(#mSteel)"/>
      <rect x="8" y="49" width="76" height="2" rx="1" fill="#fff" fill-opacity=".35"/>
      <rect x="8" y="46" width="12" height="12" rx="3" fill="url(#mGun)"/>
      <rect x="76" y="44" width="40" height="16" rx="4" fill="url(#mOlive)"/>
      <rect x="112" y="40" width="70" height="22" rx="4" fill="url(#mOlive)"/>
      <rect x="112" y="40" width="70" height="4" rx="2" fill="#fff" fill-opacity=".16"/>
      ${grain(114, 44, 66, 16, 3)}
      <rect x="104" y="26" width="84" height="13" rx="6" fill="url(#mGun)"/>
      <rect x="104" y="27" width="84" height="3" rx="1.5" fill="#fff" fill-opacity=".2"/>
      <ellipse cx="106" cy="32.5" rx="5" ry="7" fill="url(#mGlass)"/>
      <ellipse cx="186" cy="32.5" rx="4.5" ry="6.5" fill="url(#mGlass)"/>
      <rect x="138" y="24" width="14" height="17" rx="3" fill="url(#mGun)"/>
      <rect x="118" y="62" width="16" height="20" rx="3" fill="url(#mOlive)"/>
      <path d="M150 61 L168 61 L163 88 L148 88Z" fill="url(#mOlive)"/>
      <path d="M140 62 q9 9 10 0" stroke="url(#mGun)" stroke-width="3" fill="none"/>
      <path d="M182 42 L228 42 L232 50 L228 62 L182 62Z" fill="url(#mOlive)"/>
      <rect x="196" y="46" width="26" height="4" rx="2" fill="#000" fill-opacity=".22"/>
      <rect x="176" y="36" width="18" height="5" rx="2" fill="url(#mGun)"/>
      <rect x="60" y="55" width="5" height="22" rx="2" fill="url(#mGun)" transform="rotate(14 62 60)"/>
    </g>`;

  W.scarh = () => `
    <g filter="url(#softDrop)">
      <rect x="14" y="47" width="54" height="6" rx="2" fill="url(#mGun)"/>
      <rect x="12" y="44" width="10" height="12" rx="2" fill="url(#mGun)"/>
      <rect x="56" y="40" width="52" height="17" rx="4" fill="url(#mTan)"/>
      ${ribs(58, 43, 48, 11, 8, .18)}
      <rect x="56" y="40" width="52" height="3" rx="1.5" fill="#fff" fill-opacity=".22"/>
      <rect x="54" y="33" width="118" height="7" rx="2" fill="url(#mGun)"/>
      ${ribs(56, 34, 112, 5, 24, .3)}
      <rect x="106" y="40" width="66" height="25" rx="3" fill="url(#mTan)"/>
      <rect x="106" y="40" width="66" height="4" rx="2" fill="#fff" fill-opacity=".2"/>
      <rect x="118" y="64" width="20" height="30" rx="3" fill="url(#mPoly)"/>
      ${ribs(119, 67, 18, 24, 5, .26)}
      <path d="M146 64 L166 64 L160 92 L144 92Z" fill="url(#mPoly)"/>
      <path d="M136 65 q9 9 10 0" stroke="url(#mGun)" stroke-width="3" fill="none"/>
      <path d="M172 42 L224 42 L230 50 L230 58 L172 62Z" fill="url(#mTan)"/>
      <rect x="182" y="46" width="34" height="4" rx="2" fill="#000" fill-opacity=".16"/>
      <rect x="188" y="32" width="7" height="11" rx="2" fill="url(#mPoly)"/>
    </g>`;

  W.glock18 = () => `
    <g filter="url(#softDrop)" transform="translate(24,4)">
      <rect x="40" y="38" width="112" height="22" rx="4" fill="url(#mPoly)"/>
      <rect x="40" y="38" width="112" height="4" rx="2" fill="#fff" fill-opacity=".15"/>
      ${ribs(126, 43, 24, 14, 6, .38)}
      <rect x="36" y="44" width="8" height="9" rx="2" fill="url(#mGun)"/>
      <circle cx="41" cy="48.5" r="3" fill="#0A0C0E"/>
      <rect x="52" y="34" width="5" height="5" rx="1" fill="url(#mGun)"/>
      <rect x="140" y="33" width="9" height="6" rx="1" fill="url(#mGun)"/>
      <path d="M104 60 L150 60 L142 104 L112 104 Z" fill="url(#mPoly)"/>
      ${ribs(112, 68, 30, 30, 7, .22)}
      <path d="M106 62 L114 62 L110 100 L104 100Z" fill="#fff" fill-opacity=".07"/>
      <path d="M88 60 q12 12 16 0" stroke="url(#mPoly)" stroke-width="5" fill="none"/>
      <rect x="96" y="60" width="4" height="10" rx="1.5" fill="url(#mGun)"/>
      <rect x="58" y="60" width="34" height="7" rx="2" fill="url(#mPoly)"/>
    </g>`;

  W.deagle = () => `
    <g filter="url(#softDrop)" transform="translate(22,2)">
      <rect x="34" y="34" width="122" height="26" rx="4" fill="url(#mSteel)"/>
      <rect x="34" y="34" width="122" height="5" rx="2.5" fill="#fff" fill-opacity=".4"/>
      <rect x="40" y="30" width="102" height="6" rx="2" fill="url(#mSteel)"/>
      ${ribs(42, 31, 98, 4, 20, .22)}
      <rect x="30" y="40" width="10" height="12" rx="2" fill="#3B4248"/>
      <circle cx="36" cy="46" r="3.6" fill="#0A0C0E"/>
      <rect x="146" y="28" width="10" height="7" rx="1" fill="#3B4248"/>
      <path d="M108 60 L154 60 L146 106 L116 106Z" fill="url(#mPoly)"/>
      ${ribs(118, 70, 28, 30, 6, .26)}
      <path d="M92 60 q12 13 16 0" stroke="url(#mSteel)" stroke-width="5" fill="none"/>
      <rect x="100" y="60" width="4" height="11" rx="1.5" fill="#2B3036"/>
      <rect x="60" y="60" width="34" height="8" rx="2" fill="url(#mSteel)"/>
      <rect x="64" y="62" width="26" height="2" rx="1" fill="#fff" fill-opacity=".3"/>
    </g>`;

  W.frag = () => `
    <g filter="url(#softDrop)" transform="translate(76,6)">
      <ellipse cx="46" cy="60" rx="30" ry="34" fill="url(#mOlive)"/>
      <ellipse cx="46" cy="60" rx="30" ry="34" fill="url(#rimLight)"/>
      <g stroke="#000" stroke-opacity=".34" stroke-width="1.6" fill="none">
        <path d="M18 44 h56"/><path d="M16 58 h60"/><path d="M18 72 h56"/><path d="M24 84 h44"/>
        <path d="M32 28 v66"/><path d="M46 26 v70"/><path d="M60 28 v66"/>
      </g>
      <ellipse cx="36" cy="42" rx="12" ry="9" fill="#fff" fill-opacity=".16"/>
      <rect x="34" y="18" width="24" height="12" rx="3" fill="url(#mSteel)"/>
      <rect x="34" y="18" width="24" height="4" rx="2" fill="#fff" fill-opacity=".4"/>
      <path d="M58 20 q16 4 12 26 l-6 -1 q4 -18 -8 -20Z" fill="url(#mSteel)"/>
      <circle cx="28" cy="20" r="7" fill="none" stroke="url(#mBrass)" stroke-width="3.4"/>
    </g>`;

  W.flash = () => `
    <g filter="url(#softDrop)" transform="translate(80,6)">
      <rect x="22" y="30" width="48" height="62" rx="10" fill="url(#mGun)"/>
      <rect x="22" y="30" width="48" height="62" rx="10" fill="url(#rimLight)"/>
      <rect x="26" y="34" width="12" height="54" rx="6" fill="#fff" fill-opacity=".12"/>
      <g fill="#0A0C0E" fill-opacity=".85">
        <circle cx="36" cy="46" r="3.4"/><circle cx="56" cy="46" r="3.4"/>
        <circle cx="36" cy="62" r="3.4"/><circle cx="56" cy="62" r="3.4"/>
        <circle cx="36" cy="78" r="3.4"/><circle cx="56" cy="78" r="3.4"/>
      </g>
      <rect x="32" y="18" width="28" height="13" rx="3" fill="url(#mSteel)"/>
      <rect x="32" y="18" width="28" height="4" rx="2" fill="#fff" fill-opacity=".42"/>
      <path d="M60 20 q15 6 11 26 l-6 -1 q4 -17 -7 -20Z" fill="url(#mSteel)"/>
      <circle cx="26" cy="20" r="7" fill="none" stroke="url(#mBrass)" stroke-width="3.4"/>
    </g>`;

  W.knife = () => `
    <g filter="url(#softDrop)" transform="rotate(-16 120 60)">
      <path d="M28 52 L128 40 q22 2 26 12 q-6 10 -26 12 L28 62 Z" fill="url(#mSteel)"/>
      <path d="M30 53 L126 42 q18 2 22 10 L30 57Z" fill="#fff" fill-opacity=".38"/>
      <path d="M40 60 L120 52 q14 1 16 4 L40 63Z" fill="#000" fill-opacity=".18"/>
      <g stroke="#000" stroke-opacity=".3" stroke-width="1.4">
        <path d="M46 47 l0 4"/><path d="M54 46 l0 4"/><path d="M62 45 l0 4"/><path d="M70 45 l0 4"/>
      </g>
      <rect x="140" y="38" width="9" height="30" rx="2" fill="url(#mGun)"/>
      <rect x="148" y="43" width="62" height="20" rx="8" fill="url(#mPoly)"/>
      ${ribs(152, 45, 54, 16, 8, .3)}
      <rect x="148" y="43" width="62" height="4" rx="2" fill="#fff" fill-opacity=".12"/>
      <circle cx="206" cy="53" r="3" fill="#0A0C0E"/>
    </g>`;

  W.machete = () => `
    <g filter="url(#softDrop)" transform="rotate(-14 120 60)">
      <path d="M20 44 L146 34 q20 4 22 20 q-4 14 -24 16 L20 62 Z" fill="url(#mSteel)"/>
      <path d="M22 45 L144 36 q16 3 19 14 L22 52Z" fill="#fff" fill-opacity=".34"/>
      <path d="M30 60 L140 52 q14 2 16 6 L30 64Z" fill="#000" fill-opacity=".2"/>
      <circle cx="60" cy="52" r="3" fill="#0A0C0E" fill-opacity=".5"/>
      <circle cx="86" cy="50" r="3" fill="#0A0C0E" fill-opacity=".5"/>
      <rect x="166" y="34" width="8" height="34" rx="2" fill="url(#mGun)"/>
      <rect x="173" y="40" width="52" height="22" rx="9" fill="url(#mWood)"/>
      ${grain(176, 42, 46, 18, 4)}
      <rect x="173" y="40" width="52" height="4" rx="2" fill="#fff" fill-opacity=".16"/>
    </g>`;

  /* ============================================================
     OPERATORS — viewBox 0 0 200 200, hue-driven kit colour
     ============================================================ */
  function hsl(h, sa, l) {
    sa /= 100; l /= 100;
    const k = n => (n + h/30) % 12;
    const f = n => l - sa * Math.min(l, 1-l) * Math.max(-1, Math.min(Math.min(k(n)-3, 9-k(n)), 1));
    const t = n => Math.round(255 * f(n)).toString(16).padStart(2,'0');
    return '#' + t(0) + t(8) + t(4);
  }

  let uid = 0;
  function operator(hue, opts) {
    opts = opts || {};
    const sat  = opts.sat != null ? opts.sat : 34;
    const id   = 'op' + (++uid);
    const kitL = hsl(hue, sat, 62);
    const kitM = hsl(hue, sat, 48);
    const kitD = hsl(hue, sat, 34);
    const kitX = hsl(hue, sat, 24);
    const acc  = opts.acc || hsl((hue + 20) % 360, 52, 52);
    const visor = opts.visor || '#8FDCFF';
    const head = opts.head || 'combat';
    const bulk = opts.bulk || 1;

    /* ---- head gear variants ---- */
    let gear = '';
    if (head === 'combat') {
      gear = `
        <path d="M64 84 q0 -42 36 -42 q36 0 36 42 q0 6 -4 8 l-64 0 q-4 -2 -4 -8Z" fill="url(#g${id})"/>
        <path d="M67 78 q6 -32 33 -34 q-21 9 -25 36Z" fill="#fff" fill-opacity=".26"/>
        <rect x="62" y="82" width="76" height="9" rx="4" fill="${kitX}"/>
        <rect x="62" y="82" width="76" height="2.6" rx="1.3" fill="#fff" fill-opacity=".22"/>
        <rect x="92" y="44" width="16" height="12" rx="3" fill="${kitX}"/>
        <rect x="96" y="38" width="8" height="8" rx="2" fill="${acc}"/>`;
    } else if (head === 'cap') {
      gear = `
        <path d="M68 82 q0 -34 32 -34 q32 0 32 34 l-64 0Z" fill="url(#g${id})"/>
        <path d="M70 76 q6 -26 30 -28 q-19 9 -22 30Z" fill="#fff" fill-opacity=".28"/>
        <path d="M64 80 q36 -8 74 2 q2 7 -6 8 l-64 0 q-6 -3 -4 -10Z" fill="${kitD}"/>
        <path d="M100 48 q-4 -12 6 -14 q-2 8 2 13Z" fill="${acc}"/>`;
    } else if (head === 'hood') {
      gear = `
        <path d="M58 96 q-2 -56 42 -56 q44 0 42 56 q-8 8 -20 6 q6 -34 -22 -34 q-28 0 -22 34 q-12 2 -20 -6Z" fill="url(#g${id})"/>
        <path d="M62 90 q0 -44 34 -46 q-24 12 -24 48Z" fill="#fff" fill-opacity=".2"/>
        <path d="M74 76 q26 -8 52 0 l0 12 q-26 -9 -52 0Z" fill="${kitX}"/>`;
    } else if (head === 'heavy') {
      gear = `
        <path d="M58 88 q0 -48 42 -48 q42 0 42 48 q0 7 -5 9 l-74 0 q-5 -2 -5 -9Z" fill="url(#g${id})"/>
        <path d="M62 80 q7 -36 38 -38 q-25 10 -30 40Z" fill="#fff" fill-opacity=".24"/>
        <rect x="54" y="84" width="92" height="11" rx="5" fill="${kitX}"/>
        <path d="M70 92 q30 -6 60 0 l0 22 q-30 8 -60 0Z" fill="${kitD}"/>
        <rect x="76" y="98" width="48" height="9" rx="3" fill="#14171A"/>
        <rect x="79" y="100" width="42" height="5" rx="2.5" fill="${visor}" fill-opacity=".8"/>
        <g stroke="${kitX}" stroke-width="3">
          <path d="M88 107 v8"/><path d="M100 107 v8"/><path d="M112 107 v8"/>
        </g>`;
    } else if (head === 'gasmask') {
      gear = `
        <path d="M64 84 q0 -42 36 -42 q36 0 36 42 q0 6 -4 8 l-64 0 q-4 -2 -4 -8Z" fill="url(#g${id})"/>
        <path d="M67 78 q6 -32 33 -34 q-21 9 -25 36Z" fill="#fff" fill-opacity=".26"/>
        <path d="M72 86 q28 -10 56 0 l0 18 q-6 22 -28 22 q-22 0 -28 -22Z" fill="#1B1F22"/>
        <circle cx="85" cy="96" r="10" fill="${visor}" fill-opacity=".85"/>
        <circle cx="115" cy="96" r="10" fill="${visor}" fill-opacity=".85"/>
        <circle cx="81" cy="92" r="3.4" fill="#fff" fill-opacity=".7"/>
        <circle cx="111" cy="92" r="3.4" fill="#fff" fill-opacity=".7"/>
        <ellipse cx="100" cy="118" rx="14" ry="11" fill="#2A2F33"/>
        <circle cx="100" cy="118" r="6" fill="${acc}" fill-opacity=".9"/>
        <circle cx="100" cy="118" r="2.6" fill="#0E1113"/>`;
    } else if (head === 'crown') {
      gear = `
        <path d="M64 84 q0 -42 36 -42 q36 0 36 42 q0 6 -4 8 l-64 0 q-4 -2 -4 -8Z" fill="url(#g${id})"/>
        <path d="M67 78 q6 -32 33 -34 q-21 9 -25 36Z" fill="#fff" fill-opacity=".32"/>
        <rect x="62" y="82" width="76" height="9" rx="4" fill="#8A6B23"/>
        <rect x="62" y="82" width="76" height="2.6" rx="1.3" fill="#FFE9A8" fill-opacity=".65"/>
        <path d="M76 46 L84 30 L92 44 L100 26 L108 44 L116 30 L124 46 Z" fill="url(#mBrass)"/>
        <circle cx="100" cy="34" r="3.4" fill="#FFF3CE"/>`;
    }

    /* face: gasmask & heavy hide it */
    const faceHidden = (head === 'gasmask' || head === 'heavy');
    const face = faceHidden ? '' : `
        <ellipse cx="100" cy="88" rx="30" ry="33" fill="${kitX}"/>
        <ellipse cx="100" cy="93" rx="24" ry="22" fill="url(#mSkin)"/>
        <path d="M74 101 q26 20 52 0 q-6 25 -26 25 q-20 0 -26 -25Z" fill="${kitX}"/>
        <path d="M70 87 q30 -9 60 0 l0 15 q-30 10 -60 0Z" fill="#191D20"/>
        <ellipse cx="85" cy="94" rx="12.5" ry="8.5" fill="url(#v${id})"/>
        <ellipse cx="115" cy="94" rx="12.5" ry="8.5" fill="url(#v${id})"/>
        <ellipse cx="81" cy="91" rx="4.2" ry="2.6" fill="#fff" fill-opacity=".62"/>
        <ellipse cx="111" cy="91" rx="4.2" ry="2.6" fill="#fff" fill-opacity=".62"/>`;

    const shoulder = 22 * bulk;

    return `
      <defs>
        <linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${kitL}"/>
          <stop offset="48%" stop-color="${kitM}"/>
          <stop offset="100%" stop-color="${kitD}"/>
        </linearGradient>
        <linearGradient id="t${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${kitM}"/>
          <stop offset="60%" stop-color="${kitD}"/>
          <stop offset="100%" stop-color="${kitX}"/>
        </linearGradient>
        <linearGradient id="v${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${visor}" stop-opacity=".98"/>
          <stop offset="58%" stop-color="${visor}" stop-opacity=".42"/>
          <stop offset="100%" stop-color="#0C1A22" stop-opacity=".9"/>
        </linearGradient>
      </defs>

      <ellipse cx="100" cy="190" rx="${52*bulk}" ry="10" fill="url(#groundShadow)"/>

      <g filter="url(#softDrop)">
        <path d="M${52-shoulder+22} 198 q0 -54 ${shoulder} -68 q14 -9 26 -9 q12 0 26 9 q${shoulder} 14 ${shoulder} 68 Z"
              fill="url(#t${id})"/>
        <path d="M${52-shoulder+22} 198 q0 -54 ${shoulder} -68 q6 -4 11 -6 l0 74 Z" fill="#fff" fill-opacity=".13"/>

        <path d="M68 140 q32 -13 64 0 l0 48 q-32 10 -64 0 Z" fill="${kitX}"/>
        <path d="M68 140 q32 -13 64 0 l0 8 q-32 -11 -64 0Z" fill="#fff" fill-opacity=".16"/>
        <rect x="75" y="152" width="21" height="16" rx="3" fill="${kitD}"/>
        <rect x="104" y="152" width="21" height="16" rx="3" fill="${kitD}"/>
        <rect x="75" y="152" width="21" height="4" rx="2" fill="#fff" fill-opacity=".2"/>
        <rect x="104" y="152" width="21" height="4" rx="2" fill="#fff" fill-opacity=".2"/>
        <rect x="86" y="174" width="28" height="10" rx="3" fill="${acc}"/>
        <rect x="86" y="174" width="28" height="3" rx="1.5" fill="#fff" fill-opacity=".3"/>

        <rect x="90" y="114" width="20" height="24" rx="6" fill="url(#mSkin)"/>
        <rect x="90" y="114" width="20" height="9" fill="#000" fill-opacity=".26"/>

        ${face}
        ${gear}

        <path d="M134 96 q11 3 9 15" stroke="${kitX}" stroke-width="4" fill="none" stroke-linecap="round"/>
        <circle cx="143" cy="113" r="4.2" fill="${acc}"/>
      </g>`;
  }

  const CHAR_ART = {
    ranger:     () => operator(28,  { head:'combat',  sat:30, visor:'#9FE0FF' }),
    scout:      () => operator(150, { head:'cap',     sat:38, visor:'#A8FFD4', bulk:.92 }),
    ghost:      () => operator(214, { head:'hood',    sat:32, visor:'#CDEBFF' }),
    juggernaut: () => operator(276, { head:'heavy',   sat:30, visor:'#E6CDFF', bulk:1.22 }),
    viper:      () => operator(96,  { head:'gasmask', sat:40, visor:'#DCFF8F' }),
    phantom:    () => operator(44,  { head:'crown',   sat:52, visor:'#FFE3A0', acc:'#D9A93A' })
  };

  /* ---------- PUBLIC RENDERERS ---------- */
  function weaponSVG(id, cls) {
    ensureDefs();
    const body = W[id] || W.ak47;
    return `<svg class="art art-weapon ${cls || ''}" viewBox="0 0 240 110" preserveAspectRatio="xMidYMid meet">
      <ellipse cx="122" cy="98" rx="86" ry="9" fill="url(#groundShadow)"/>
      ${body()}
    </svg>`;
  }

  function characterSVG(id, cls) {
    ensureDefs();
    const body = CHAR_ART[id] || CHAR_ART.ranger;
    return `<svg class="art art-char ${cls || ''}" viewBox="0 0 200 200" preserveAspectRatio="xMidYMax meet">${body()}</svg>`;
  }

  w.TVGArt = { weaponSVG, characterSVG, ensureDefs, operator };
  document.addEventListener('DOMContentLoaded', ensureDefs);
})(window);
