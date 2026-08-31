/* ============================================================
   TASKVAULT ENGINE 3D — dependency-free WebGL shooter engine
   • Batched static geometry, baked sun lighting, distance fog
   • Procedural canvas textures (walls, ground, props, soldier atlas)
   • Humanoid soldiers: walk / run / crouch / jump / aim / death
   • Hitscan + tracers, grenades, explosions, particles
   • Battle Royale shrinking zone · TDM / FFA with respawns
   • Bot AI: BFS pathfinding, LOS memory, strafe, retreat, zone sense
   Bot difficulty is scaled by TVG.ddaFactor() toward a 40% win rate.
   ============================================================ */
(function (w) {
'use strict';

const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* ================= MATH ================= */
const M4 = {
  persp(fov, asp, n, f) {
    const t = 1 / Math.tan(fov / 2), nf = 1 / (n - f);
    return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]);
  },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  },
  view(ex, ey, ez, pitch, yaw) {
    /* camera basis matching game axes: forward = (cy·cp, sp, sy·cp),
       right = (-sy, 0, cy), up completes. Rows: right, up, back. */
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const R = [-sy, 0, cy];
    const U = [-cy * sp, cp, -sy * sp];
    const B = [-cy * cp, -sp, -sy * cp];
    return new Float32Array([
      R[0], U[0], B[0], 0,
      R[1], U[1], B[1], 0,
      R[2], U[2], B[2], 0,
      -(R[0] * ex + R[1] * ey + R[2] * ez), -(U[0] * ex + U[1] * ey + U[2] * ez), -(B[0] * ex + B[1] * ey + B[2] * ez), 1
    ]);
  }
};
function sRand(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/* ================= PROCEDURAL TEXTURES ================= */
function texCanvas(size, fn) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  fn(c.getContext('2d'), size);
  return c;
}
function noiseOver(x, s, n, alpha, dark) {
  for (let i = 0; i < n; i++) {
    const v = Math.random();
    x.fillStyle = dark ? `rgba(0,0,0,${(alpha * v).toFixed(3)})` : `rgba(255,255,255,${(alpha * v).toFixed(3)})`;
    x.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}
function camoFill(x, s, base, spots) {
  x.fillStyle = base; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 80; i++) {
    x.fillStyle = spots[(Math.random() * spots.length) | 0];
    x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, 3 + Math.random() * 7, 2 + Math.random() * 5, Math.random() * 3, 0, TAU); x.fill();
  }
}
const TEXGEN = {
  concrete() {
    return texCanvas(128, (x, s) => {
      x.fillStyle = '#8b887f'; x.fillRect(0, 0, s, s);
      x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 2;
      x.strokeRect(1, 1, s - 2, s - 2);
      x.beginPath(); x.moveTo(s / 2, 0); x.lineTo(s / 2, s); x.stroke();
      for (let i = 0; i < 4; i++) {
        const g = x.createRadialGradient(Math.random() * s, Math.random() * s, 2, Math.random() * s, Math.random() * s, 26);
        g.addColorStop(0, 'rgba(0,0,0,.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(0, 0, s, s);
      }
      noiseOver(x, s, 500, .10, true); noiseOver(x, s, 200, .07, false);
    });
  },
  metal() {
    return texCanvas(128, (x, s) => {
      x.fillStyle = '#757a80'; x.fillRect(0, 0, s, s);
      x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 3;
      x.strokeRect(2, 2, s - 4, s - 4);
      x.fillStyle = 'rgba(255,255,255,.22)';
      for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(10 + (i % 4) * 36, 10 + ((i / 4) | 0) * 108, 2.4, 0, TAU); x.fill(); }
      for (let i = 0; i < 40; i++) {
        x.fillStyle = Math.random() > .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)';
        x.fillRect(0, Math.random() * s, s, 1);
      }
      noiseOver(x, s, 200, .08, true);
    });
  },
  container(hue) {
    return texCanvas(128, (x, s) => {
      x.fillStyle = `hsl(${hue},34%,42%)`; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 16; i++) {
        const g = x.createLinearGradient(i * 8, 0, i * 8 + 8, 0);
        g.addColorStop(0, 'rgba(0,0,0,.30)'); g.addColorStop(.5, 'rgba(255,255,255,.10)'); g.addColorStop(1, 'rgba(0,0,0,.30)');
        x.fillStyle = g; x.fillRect(i * 8, 0, 8, s);
      }
      for (let i = 0; i < 10; i++) {
        x.fillStyle = 'rgba(92,58,30,.28)';
        x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, 3 + Math.random() * 8, 2 + Math.random() * 6, Math.random() * 3, 0, TAU); x.fill();
      }
      noiseOver(x, s, 400, .12, true);
    });
  },
  crate() {
    return texCanvas(128, (x, s) => {
      x.fillStyle = '#9A7444'; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 6; i++) {
        x.fillStyle = `rgb(${140 + Math.random() * 30 | 0},${100 + Math.random() * 24 | 0},${58 + Math.random() * 18 | 0})`;
        x.fillRect(0, i * s / 6 + 1, s, s / 6 - 2);
      }
      x.strokeStyle = 'rgba(60,38,16,.8)'; x.lineWidth = 5;
      x.strokeRect(3, 3, s - 6, s - 6);
      x.beginPath(); x.moveTo(4, 4); x.lineTo(s - 4, s - 4); x.moveTo(s - 4, 4); x.lineTo(4, s - 4); x.stroke();
      noiseOver(x, s, 300, .10, true);
    });
  },
  adobe() {
    return texCanvas(128, (x, s) => {
      x.fillStyle = '#c99e63'; x.fillRect(0, 0, s, s);
      const bh = s / 6;
      for (let r = 0; r < 6; r++) {
        x.fillStyle = `rgb(${190 + Math.random() * 26 | 0},${150 + Math.random() * 22 | 0},${92 + Math.random() * 20 | 0})`;
        x.fillRect(0, r * bh + 2, s, bh - 4);
      }
      x.fillStyle = 'rgba(120,86,48,.55)';
      x.fillRect(0, 0, 6, s); x.fillRect(s - 6, 0, 6, s); x.fillRect(0, s - 10, s, 10);
      noiseOver(x, s, 400, .12, true);
    });
  },
  stone() {
    return texCanvas(128, (x, s) => {
      x.fillStyle = '#6f6a5e'; x.fillRect(0, 0, s, s);
      const rows = 6, bh = s / rows;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * 11; let c = -1;
        while (c * 22 + off < s + 22) {
          const bw = 16 + Math.random() * 12;
          x.fillStyle = `rgb(${95 + Math.random() * 36 | 0},${90 + Math.random() * 32 | 0},${75 + Math.random() * 28 | 0})`;
          x.fillRect(c * 22 + off + 1.5, r * bh + 1.5, bw, bh - 3);
          c++;
        }
      }
      noiseOver(x, s, 500, .16, true);
    });
  },
  bark() {
    return texCanvas(64, (x, s) => {
      x.fillStyle = '#5c4629'; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 30; i++) {
        x.strokeStyle = `rgba(${40 + Math.random() * 30 | 0},${28 + Math.random() * 22 | 0},14,.7)`;
        x.lineWidth = 1 + Math.random() * 2;
        x.beginPath(); x.moveTo(Math.random() * s, 0); x.lineTo(Math.random() * s, s); x.stroke();
      }
    });
  },
  foliage() {
    return texCanvas(64, (x, s) => {
      x.fillStyle = '#3f6b34'; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 260; i++) {
        x.fillStyle = `rgba(${40 + Math.random() * 50 | 0},${95 + Math.random() * 70 | 0},${35 + Math.random() * 40 | 0},.85)`;
        x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 4, 0, TAU); x.fill();
      }
    });
  },
  sandbag() {
    return texCanvas(64, (x, s) => {
      x.fillStyle = '#a89468'; x.fillRect(0, 0, s, s);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        x.fillStyle = `rgb(${165 + Math.random() * 24 | 0},${145 + Math.random() * 20 | 0},${100 + Math.random() * 18 | 0})`;
        x.beginPath(); x.ellipse(c * 22 + 11 + (r % 2) * 8, r * 16 + 8, 12, 7, 0, 0, TAU); x.fill();
      }
      noiseOver(x, s, 160, .12, true);
    });
  },
  ground(kind) {
    return texCanvas(256, (x, s) => {
      const pal = {
        concrete: ['#7d7a74', '#6e6b66'], asphalt: ['#4c4c50', '#434347'],
        sand: ['#cfa768', '#c2985c'], grass: ['#5a7c3f', '#4c6d35'],
        dirt: ['#8a6b47', '#7a5d3d'], steel: ['#5d6066', '#52555b']
      }[kind] || ['#7d7a74', '#6e6b66'];
      x.fillStyle = pal[0]; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 900; i++) {
        x.fillStyle = Math.random() > .5 ? pal[0] : pal[1];
        x.globalAlpha = .2 + Math.random() * .5;
        x.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 8, 2 + Math.random() * 8);
      }
      x.globalAlpha = 1;
      if (kind === 'concrete' || kind === 'asphalt' || kind === 'steel') {
        x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 2;
        x.strokeRect(0, 0, s, s);
        x.beginPath(); x.moveTo(s / 2, 0); x.lineTo(s / 2, s); x.moveTo(0, s / 2); x.lineTo(s, s / 2); x.stroke();
      }
      if (kind === 'grass') {
        for (let i = 0; i < 400; i++) {
          x.strokeStyle = `rgba(${60 + Math.random() * 50 | 0},${110 + Math.random() * 60 | 0},${40 + Math.random() * 30 | 0},.5)`;
          x.beginPath(); const px = Math.random() * s, py = Math.random() * s;
          x.moveTo(px, py); x.lineTo(px + Math.random() * 3 - 1.5, py - 3 - Math.random() * 4); x.stroke();
        }
      }
      if (kind === 'sand') {
        for (let i = 0; i < 60; i++) {
          x.fillStyle = 'rgba(160,120,70,.18)';
          x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, 8 + Math.random() * 18, 3 + Math.random() * 6, 0, 0, TAU); x.fill();
        }
      }
      noiseOver(x, s, 500, .10, true);
    });
  }
};

/* soldier atlas regions [u0,v0,u1,v1] (v from top; flipped on upload) */
const ATLAS = {
  skin: [.00, .00, .24, .24], shirtA: [.26, .00, .50, .24], shirtB: [.52, .00, .76, .24],
  pantsA: [.78, .00, 1, .24], pantsB: [.00, .26, .24, .50], vest: [.26, .26, .50, .50],
  helmetA: [.52, .26, .76, .50], helmetB: [.78, .26, 1, .50], boot: [.00, .52, .24, .76],
  gun: [.26, .52, .76, .70], gear: [.78, .52, 1, .76]
};
function soldierAtlas(teamHue, foe) {
  return texCanvas(256, (x, s) => {
    const reg = (r, fn) => { x.save(); x.beginPath(); x.rect(r[0] * s, r[1] * s, (r[2] - r[0]) * s, (r[3] - r[1]) * s); x.clip(); fn(); x.restore(); };
    const spots = ['rgba(20,26,18,.5)', 'rgba(90,96,70,.45)', 'rgba(0,0,0,.35)'];
    reg(ATLAS.skin, () => { x.fillStyle = '#c58e63'; x.fillRect(0, 0, s, s); noiseOver(x, s, 150, .08, true); });
    reg(ATLAS.shirtA, () => camoFill(x, s, foe ? `hsl(${teamHue},30%,44%)` : `hsl(${teamHue},36%,38%)`, spots));
    reg(ATLAS.shirtB, () => camoFill(x, s, foe ? '#8a4a3c' : '#3f5a8a', ['rgba(0,0,0,.4)', 'rgba(255,255,255,.12)']));
    reg(ATLAS.pantsA, () => camoFill(x, s, '#4c5238', ['rgba(0,0,0,.45)', 'rgba(120,118,86,.4)']));
    reg(ATLAS.pantsB, () => camoFill(x, s, '#3a4030', ['rgba(0,0,0,.45)']));
    reg(ATLAS.vest, () => {
      x.fillStyle = '#2e3226'; x.fillRect(0, 0, s, s);
      x.fillStyle = '#22261c'; x.fillRect(96, 40, 64, 176);
      x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(96, 40, 64, 10);
      x.fillStyle = '#3c4230';
      for (let i = 0; i < 3; i++) {
        x.fillRect(30 + i * 70, 90, 46, 40);
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(30 + i * 70, 124, 46, 6); x.fillStyle = '#3c4230';
      }
    });
    reg(ATLAS.helmetA, () => {
      x.fillStyle = '#454b34'; x.fillRect(0, 0, s, s); noiseOver(x, s, 300, .18, true);
      x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, 0, s, 26);
    });
    reg(ATLAS.helmetB, () => {
      x.fillStyle = foe ? '#7d3b30' : '#31456e'; x.fillRect(0, 0, s, s); noiseOver(x, s, 260, .2, true);
      x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, 0, s, 26);
    });
    reg(ATLAS.boot, () => {
      x.fillStyle = '#26221c'; x.fillRect(0, 0, s, s);
      x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(0, 0, s, 20);
      x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, s - 24, s, 24);
    });
    reg(ATLAS.gun, () => {
      x.fillStyle = '#23262a'; x.fillRect(0, 0, s, s);
      x.fillStyle = 'rgba(255,255,255,.09)'; x.fillRect(0, 20, s, 8);
      x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(0, 78, s, 12);
      for (let i = 0; i < 12; i++) { x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(14 + i * 20, 60, 8, 10); }
    });
    reg(ATLAS.gear, () => {
      x.fillStyle = '#38402c'; x.fillRect(0, 0, s, s);
      x.fillStyle = 'rgba(0,0,0,.4)';
      for (let i = 0; i < 4; i++) x.fillRect(0, 30 + i * 55, s, 10);
      x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(0, 0, s, 16);
    });
  });
}

/* ================= SHADERS ================= */
const VS_MAIN = `
attribute vec3 aPos; attribute vec2 aUV; attribute float aShade;
uniform mat4 uVP; uniform vec3 uEye;
varying vec2 vUV; varying float vShade; varying float vDist;
void main(){ vUV=aUV; vShade=aShade; vDist=distance(aPos,uEye); gl_Position=uVP*vec4(aPos,1.0); }`;
const FS_MAIN = `
precision mediump float;
varying vec2 vUV; varying float vShade; varying float vDist;
uniform sampler2D uTex; uniform vec3 uSunCol; uniform vec3 uAmbCol; uniform vec3 uFogCol;
uniform float uFogD; uniform float uAlpha;
uniform vec3 uFlashPos; uniform vec3 uFlashCol; uniform float uFlashI;
void main(){
  vec4 c = texture2D(uTex, vUV);
  vec3 lit = c.rgb * (uAmbCol + uSunCol * vShade);
  float fl = uFlashI / (1.0 + vDist * vDist * 0.4);
  lit += c.rgb * uFlashCol * fl * 2.0;
  float fog = clamp(1.0 - exp(-uFogD * uFogD * vDist * vDist), 0.0, 1.0);
  gl_FragColor = vec4(mix(lit, uFogCol, fog), c.a * uAlpha);
}`;
const VS_SKY = `
attribute vec2 aCorner; varying vec2 vXY;
void main(){ vXY=aCorner; gl_Position=vec4(aCorner,0.9999,1.0); }`;
const FS_SKY = `
precision mediump float;
varying vec2 vXY;
uniform vec3 uFwd; uniform vec3 uRight; uniform vec3 uUp;
uniform float uTanF; uniform float uAspect; uniform vec3 uSunDir;
uniform vec3 uTop; uniform vec3 uHorizon; uniform float uTime;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x), mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x), f.y);
}
float fbm(vec2 p){
  float v=0.0, a=0.5;
  for(int i=0;i<4;i++){ v+=a*vnoise(p); p*=2.03; a*=0.5; }
  return v;
}
void main(){
  vec3 dir = normalize(uFwd + uRight*(vXY.x*uTanF*uAspect) + uUp*(vXY.y*uTanF));
  float h = max(dir.y, 0.0);
  vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
  float sun = max(dot(dir, uSunDir), 0.0);
  col += vec3(1.0,0.86,0.6) * (pow(sun, 900.0)*1.2 + pow(sun, 40.0)*0.28 + pow(sun,6.0)*0.12);
  if (dir.y > 0.02) {
    vec2 cp = dir.xz / (dir.y + 0.12) * 1.4 + vec2(uTime*0.006, uTime*0.002);
    float cl = fbm(cp*2.0);
    float cover = smoothstep(0.52, 0.78, cl) * smoothstep(0.0, 0.24, dir.y);
    col = mix(col, mix(vec3(0.98,0.97,0.95), vec3(0.75,0.78,0.84), cl), cover*0.75);
  }
  gl_FragColor = vec4(col, 1.0);
}`;
const VS_PART = `
attribute vec3 aPos; attribute vec4 aCol;
uniform mat4 uVP; varying vec4 vCol;
void main(){ vCol=aCol; gl_Position=uVP*vec4(aPos,1.0); }`;
const FS_PART = `
precision mediump float; varying vec4 vCol;
void main(){ gl_FragColor = vCol; }`;

function compile(gl, vs, fs) {
  const p = gl.createProgram();
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  };
  sh(gl.VERTEX_SHADER, vs); sh(gl.FRAGMENT_SHADER, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

/* ================= AUDIO (synth, zero assets) ================= */
function makeSFX(settings) {
  let AC = null;
  const ac = () => {
    if (!settings.sound) return null;
    if (!AC) { try { AC = new (w.AudioContext || w.webkitAudioContext)(); } catch (e) { return null; } }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  };
  const noiseBuf = (c, dur) => {
    const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  };
  const click = (c, f, v) => {
    if (!c) return;
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.05);
  };
  return {
    unlock: () => ac(),
    shot() {
      const c = ac(); if (!c) return; const t = c.currentTime;
      let n = c.createBufferSource(); n.buffer = noiseBuf(c, 0.16);
      let f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.6;
      f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(520, t + 0.12);
      let g = c.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      n.connect(f); f.connect(g); g.connect(c.destination); n.start(t); n.stop(t + 0.16);
      let o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      let g2 = c.createGain(); g2.gain.setValueAtTime(0.55, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g2); g2.connect(c.destination); o.start(t); o.stop(t + 0.16);
    },
    enemyShot(dist) {
      const c = ac(); if (!c) return; const t = c.currentTime;
      const vol = Math.max(0.04, 0.3 - dist * 0.02);
      const n = c.createBufferSource(); n.buffer = noiseBuf(c, 0.12);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100;
      const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      n.connect(f); f.connect(g); g.connect(c.destination); n.start(t); n.stop(t + 0.13);
    },
    step(run) {
      const c = ac(); if (!c) return; const t = c.currentTime;
      const n = c.createBufferSource(); n.buffer = noiseBuf(c, 0.07);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = run ? 680 : 420;
      const g = c.createGain(); g.gain.setValueAtTime(run ? 0.24 : 0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      n.connect(f); f.connect(g); g.connect(c.destination); n.start(t); n.stop(t + 0.08);
    },
    hurt() {
      const c = ac(); if (!c) return; const t = c.currentTime;
      const o = c.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(65, t + 0.1);
      const g = c.createGain(); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.13);
    },
    kill() {
      const c = ac(); if (!c) return; const t = c.currentTime;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(620, t); o.frequency.setValueAtTime(940, t + 0.055);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.22);
    },
    reloadIn() { const c = ac(); if (c) click(c, 1100, .16); setTimeout(() => { const c2 = ac(); if (c2) click(c2, 850, .14); }, 200); },
    reloadOut() { const c = ac(); if (c) click(c, 1400, .18); setTimeout(() => { const c2 = ac(); if (c2) click(c2, 1000, .15); }, 160); },
    empty() { const c = ac(); if (c) click(c, 720, .12); },
    whoosh() {
      const c = ac(); if (!c) return; const t = c.currentTime;
      const n = c.createBufferSource(); n.buffer = noiseBuf(c, 0.14);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(360, t); f.frequency.exponentialRampToValueAtTime(2200, t + 0.13);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      n.connect(f); f.connect(g); g.connect(c.destination); n.start(t); n.stop(t + 0.15);
    },
    explosion() {
      const c = ac(); if (!c) return; const t = c.currentTime;
      const n = c.createBufferSource(); n.buffer = noiseBuf(c, 0.5);
      const f = c.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(3600, t); f.frequency.exponentialRampToValueAtTime(90, t + 0.5);
      const g = c.createGain(); g.gain.setValueAtTime(0.85, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      n.connect(f); f.connect(g); g.connect(c.destination); n.start(t); n.stop(t + 0.52);
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.35);
      const g2 = c.createGain(); g2.gain.setValueAtTime(0.6, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g2); g2.connect(c.destination); o.start(t); o.stop(t + 0.42);
    },
    jump() {
      const c = ac(); if (!c) return; const t = c.currentTime;
      const n = c.createBufferSource(); n.buffer = noiseBuf(c, 0.13);
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 620;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      n.connect(f); f.connect(g); g.connect(c.destination); n.start(t); n.stop(t + 0.14);
    },
    land() {
      const c = ac(); if (!c) return; const t = c.currentTime;
      const n = c.createBufferSource(); n.buffer = noiseBuf(c, 0.09);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
      const g = c.createGain(); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      n.connect(f); f.connect(g); g.connect(c.destination); n.start(t); n.stop(t + 0.1);
    }
  };
}

/* ================= MAP STYLES ================= */
const MAP_STYLE = {
  warehouse: { wall: 'concreteTex', struct: 'metalTex', cover: 'crateTex', ground: 'concrete', sky: ['#7fa8c9', '#d8e2ea'], sun: [.35, .75, .55], fog: .030, props: 'indoor' },
  military: { wall: 'concreteTex', struct: 'metalTex', cover: 'sandbagTex', ground: 'asphalt', sky: ['#6f9ec4', '#dfe8ee'], sun: [.4, .7, .5], fog: .026, props: 'military' },
  desert: { wall: 'adobeTex', struct: 'adobeTex', cover: 'crateTex', ground: 'sand', sky: ['#8fb6d8', '#f3dfb8'], sun: [.5, .62, .35], fog: .022, props: 'desert' },
  port: { wall: 'containerTexA', struct: 'containerTexB', cover: 'crateTex', ground: 'asphalt', sky: ['#7292ac', '#d5dee4'], sun: [-.4, .68, .45], fog: .028, props: 'port' },
  jungle: { wall: 'stoneTex', struct: 'stoneTex', cover: 'sandbagTex', ground: 'grass', sky: ['#8fb48e', '#e2ecda'], sun: [.25, .8, .35], fog: .036, props: 'jungle' },
  trainyard: { wall: 'metalTex', struct: 'metalTex', cover: 'crateTex', ground: 'dirt', sky: ['#9a8ea0', '#e8dcd8'], sun: [-.3, .7, .55], fog: .026, props: 'trains' }
};

/* ================= WORLD BUILDER ================= */
function buildWorld(E, mapId, S) {
  const style = MAP_STYLE[mapId] || MAP_STYLE.warehouse;
  const sd = style.sun, sl = Math.hypot(sd[0], sd[1], sd[2]);
  E.setSun([sd[0] / sl, sd[1] / sl, sd[2] / sl]);       // bake lighting direction FIRST
  const rnd = sRand(mapId.split('').reduce((a, c) => a + c.charCodeAt(0) * 31, 7));
  E.beginBatch();
  E.groundQuad(style.ground + 'Tex', -2, -2, S + 2, S + 2, 0.35);
  E.groundQuad(style.ground + 'Tex', -40, -40, S + 40, S + 40, 0.05);

  const layout = E.layout;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const ch = layout[y][x];
    const px = x + 0.5, pz = y + 0.5;
    if (ch === '.') {
      const r = rnd();
      const nearSpawn = (x < 4 && y > S - 5) || (x > S - 5 && y < 4);
      if (nearSpawn) continue;
      if (style.props === 'indoor' && r < 0.10) {
        E.box('crateTex', px, 0, pz, 0.9, 0.9, 0.9, 1);
        if (r < 0.04) E.box('crateTex', px + 0.06, 0.9, pz - 0.05, 0.7, 0.7, 0.7, 1);
        E.collider(px, pz, 0.55);
      } else if (style.props === 'military' && r < 0.09) {
        E.box('sandbagTex', px, 0, pz, 1.5, 0.75, 0.62, 1);
        E.box('sandbagTex', px, 0.75, pz, 1.3, 0.4, 0.55, 1, 0.9);
        E.collider(px, pz, 0.72);
      } else if (style.props === 'desert' && r < 0.07) {
        E.box('crateTex', px, 0, pz, 1.0, 1.1, 1.0, 1);
        E.collider(px, pz, 0.6);
      } else if (style.props === 'port' && r < 0.08) {
        E.box('crateTex', px, 0, pz, 1.1, 1.1, 1.1, 1);
        if (r < 0.035) E.box('metalTex', px, 1.1, pz, 0.8, 0.6, 0.8, 1, 0.9);
        E.collider(px, pz, 0.62);
      } else if (style.props === 'jungle' && r < 0.16) {
        E.box('barkTex', px, 0, pz, 0.42, 2.6, 0.42, 2);
        E.box('foliageTex', px, 2.3, pz, 2.4, 1.3, 2.4, 1, .96);
        E.box('foliageTex', px + (r * 2 - 1) * .5, 3.3, pz - (r - .5), 1.6, 1.0, 1.6, 1, .9);
        E.collider(px, pz, 0.35);
      } else if (style.props === 'trains' && r < 0.05) {
        E.box('metalTex', px, 0.15, pz, 1.5, 2.4, 4.4, 1);
        E.collider(px, pz, 0.9);
      }
      continue;
    }
    const h = ch === '#' ? 3.4 : ch === '=' ? 2.3 : 1.15;
    if (ch === 'x') {
      E.box('sandbagTex', px, 0, pz, 1.02, h, 1.02, 1);
    } else {
      const uvS = Math.max(1, Math.round(h / 1.15));
      E.box(ch === '#' ? style.wall : style.struct, px, 0, pz, 1.0, h, 1.0, uvS);
      if (ch === '=') E.box(style.struct, px, h, pz, 1.06, 0.14, 1.06, 1, 0.7);
    }
  }
  /* far skyline for depth */
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * TAU, d = 30 + rnd() * 26;
    const bx = Math.cos(a) * d + S / 2, bz = Math.sin(a) * d + S / 2;
    const bh = 3 + rnd() * 12, bw = 3 + rnd() * 6;
    E.box(style.wall, bx, 0, bz, bw, bh, bw, Math.max(1, bh / 3 | 0), 0.82);
  }
  E.endBatch();
  return style;
}

/* ================= SOLDIER MESHER =================
   CPU-transformed, CPU-lit boxes. ~15 boxes per soldier. */
const SCRATCH = new Float32Array(6 * 6 * 120);   // 120 boxes capacity

/* partBox: box with dims (sx,sy,sz), rotated by yaw then pitch, offset (ox,oy,oz)
   from pivot (cx,cy,cz); uv = atlas region; ao = ambient multiplier.
   Returns new float write index. */
function partBox(arr, n, cx, cy, cz, yaw, pitch, ox, oy, oz, sx, sy, sz, uv, sun, ao) {
  const cyw = Math.cos(yaw), syw = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const X = [cyw, 0, -syw], Y = [syw * sp, cp, cyw * sp], Z = [syw * cp, -sp, cyw * cp];
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const P = (lx, ly, lz) => [
    cx + X[0] * lx + Y[0] * ly + Z[0] * lz,
    cy + X[1] * lx + Y[1] * ly + Z[1] * lz,
    cz + X[2] * lx + Y[2] * ly + Z[2] * lz
  ];
  const u0 = uv[0], v0 = uv[1], u1 = uv[2], v1 = uv[3];
  const su = (u1 - u0) * Math.min(1, Math.abs(sx) * 0.5);
  const sv = (v1 - v0) * Math.min(1, Math.abs(sy) * 0.5);
  const FACES = [
    [0, 0, 1, -hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz, 1],
    [1, 0, 0, hx, -hy, -hz, hx, -hy, hz, hx, hy, hz, hx, hy, -hz, 1],
    [0, 0, -1, hx, -hy, -hz, -hx, -hy, -hz, -hx, hy, -hz, hx, hy, -hz, 1],
    [-1, 0, 0, -hx, -hy, hz, -hx, -hy, -hz, -hx, hy, -hz, -hx, hy, hz, 1],
    [0, 1, 0, -hx, hy, hz, hx, hy, hz, hx, hy, -hz, -hx, hy, -hz, 0.35]
  ];
  for (let f = 0; f < 5; f++) {
    const F = FACES[f];
    const nx = X[0] * F[0] + Y[0] * F[1] + Z[0] * F[2];
    const ny = X[1] * F[0] + Y[1] * F[1] + Z[1] * F[2];
    const nz = X[2] * F[0] + Y[2] * F[1] + Z[2] * F[2];
    const lam = (Math.max(0, nx * sun[0] + ny * sun[1] + nz * sun[2]) * 0.8 + 0.2) * ao;
    const A = P(F[3], F[4], F[5]), B = P(F[6], F[7], F[8]), C = P(F[9], F[10], F[11]), D = P(F[12], F[13], F[14]);
    const fu = F[15] ? su : su * 0.4;
    const put = (p, u, v) => { arr[n++] = p[0]; arr[n++] = p[1]; arr[n++] = p[2]; arr[n++] = u; arr[n++] = v; arr[n++] = lam; };
    put(A, u0, v0); put(B, u0 + fu, v0); put(C, u0 + fu, v0 + sv);
    put(A, u0, v0); put(C, u0 + fu, v0 + sv); put(D, u0, v0 + sv);
  }
  return n;
}

function meshSoldier(arr, n, a, sun) {
  const dead = a.deadT > 0;
  const ph = a.animPh || 0;
  const speed = a.animSpd || 0;
  const swing = dead ? 0 : Math.sin(ph) * (speed > 1.5 ? 0.72 : speed > 0.4 ? 0.5 : 0.05);
  const counter = -swing * 0.8;
  const crouch = a.crouch && !dead;
  const fallK = dead ? Math.min(1, a.deadT * 2.6) : 0;
  const baseY = a.y3 + (dead ? 0.1 : 0);
  const fy = a.a3;                 // facing angle (movement convention)
  const yaw = PI / 2 - fy;         // render yaw: local +Z box axis points along facing
  const CF = Math.cos(fy), SF = Math.sin(fy);
  const sink = crouch ? 0.34 : 0;
  const hipY = baseY + 0.86 - sink - (dead ? 0.5 * fallK : 0);
  const shY = baseY + 1.48 - sink * 1.2 - (dead ? 0.45 * fallK : 0);
  const headY = baseY + 1.62 - sink * 1.3 - (dead ? 0.4 * fallK : 0);
  const bob = Math.abs(Math.sin(ph)) * 0.03 * (speed > 0.3 ? 1 : 0);
  const shirt = a.foe ? ATLAS.shirtA : ATLAS.shirtB;

  const legL = 0.86 - sink;
  n = partBox(arr, n, a.x3, hipY + bob, a.z3, yaw, swing, 0, -legL / 2, 0, 0.2, legL, 0.23, ATLAS.pantsA, sun, 1);
  n = partBox(arr, n, a.x3, hipY + bob, a.z3, yaw, counter, 0.02, -legL / 2, 0, 0.2, legL, 0.23, ATLAS.pantsA, sun, 1);
  if (!dead) {
    /* boots track the leg swing */
    const sw = Math.sin(ph) * (speed > 0.3 ? 1 : 0);
    n = partBox(arr, n, a.x3 + CF * (0.11 + sw * 0.2), baseY + 0.07 + sw * 0.1, a.z3 + SF * (0.11 + sw * 0.2), yaw, 0, 0, 0, 0, 0.22, 0.14, 0.33, ATLAS.boot, sun, 1);
    n = partBox(arr, n, a.x3 - CF * (0.11 + sw * 0.2), baseY + 0.07 - sw * 0.1, a.z3 - SF * (0.11 + sw * 0.2), yaw, 0, 0, 0, 0, 0.22, 0.14, 0.33, ATLAS.boot, sun, 1);
  }
  n = partBox(arr, n, a.x3, shY - 0.31 + bob, a.z3, yaw, 0, 0, 0.05, 0, 0.46, 0.64, 0.27, shirt, sun, 1);
  n = partBox(arr, n, a.x3, shY - 0.26 + bob, a.z3, yaw, 0, 0, 0.04, 0.005, 0.42, 0.44, 0.3, ATLAS.vest, sun, 1.05);
  n = partBox(arr, n, a.x3, shY - 0.33 + bob, a.z3, yaw, 0, 0, -0.14, 0, 0.36, 0.4, 0.18, ATLAS.gear, sun, 0.9);
  const hb = bob * 1.2;
  n = partBox(arr, n, a.x3, headY + hb, a.z3, yaw, 0, 0, 0.02, 0, 0.21, 0.24, 0.22, ATLAS.skin, sun, 1);
  n = partBox(arr, n, a.x3, headY + hb, a.z3, yaw, 0, 0, 0.02, 0.02, 0.25, 0.13, 0.25, ATLAS.helmetA, sun, 1.06);
  n = partBox(arr, n, a.x3, headY + hb, a.z3, yaw, 0, 0, 0.02, 0.06, 0.24, 0.09, 0.24, ATLAS.helmetB, sun, 1);
  const aimP = (a.aimP || 0);
  const armY = shY - 0.08 + bob;
  /* arms reach toward the rifle grip / handguard (offsets along facing) */
  n = partBox(arr, n, a.x3 + CF * 0.28, armY, a.z3 + SF * 0.28, yaw, -1.15 + aimP, 0, -0.12, 0.12, 0.09, 0.5, 0.09, shirt, sun, 1);
  n = partBox(arr, n, a.x3 + CF * 0.44 - SF * 0.24, armY, a.z3 + SF * 0.44 + CF * 0.24, yaw, -1.35 + aimP, 0, -0.1, 0, 0.09, 0.55, 0.09, shirt, sun, 1);
  const gx = a.x3 + CF * 0.34, gz = a.z3 + SF * 0.34;
  const gy = armY + 0.1 + aimP * 0.15;
  n = partBox(arr, n, gx, gy, gz, yaw, aimP * 0.5, 0, 0, 0, 0.05, 0.07, 0.72, ATLAS.gun, sun, 1.1);
  n = partBox(arr, n, gx, gy, gz, yaw, aimP * 0.5, 0.16, -0.02, 0, 0.07, 0.09, 0.09, ATLAS.skin, sun, 1);
  n = partBox(arr, n, gx, gy, gz, yaw, aimP * 0.5, -0.2, -0.03, 0.02, 0.07, 0.09, 0.09, ATLAS.skin, sun, 1);
  return n;
}

/* ================= GAME FACTORY ================= */
function createGame(cfg) {
  const TVG = w.TVG, Maps = w.TVGMaps;
  const S = Maps.size();
  const layout = Maps.LAYOUTS[cfg.mapId] || Maps.LAYOUTS.warehouse;
  const gridH = layout.map(r => r.split('').map(c => c === '#' ? 3.4 : c === '=' ? 2.3 : c === 'x' ? 1.15 : 0));

  /* ---------- GL setup ---------- */
  const cv = cfg.cv;
  const gl = cv.getContext('webgl', { antialias: false, alpha: false })
          || cv.getContext('experimental-webgl')
          || null;
  const use2D = !gl;   // no WebGL? render the SAME 3D game in software on Canvas2D
  let pMain = null, pSky = null, pPart = null, L = null, SKYU = null, PA = null;
  let skyBuf = null, partBuf = null, dynBuf = null;
  if (gl) {
  pMain = compile(gl, VS_MAIN, FS_MAIN);
  pSky = compile(gl, VS_SKY, FS_SKY);
  pPart = compile(gl, VS_PART, FS_PART);
  L = {
    aPos: gl.getAttribLocation(pMain, 'aPos'), aUV: gl.getAttribLocation(pMain, 'aUV'),
    aShade: gl.getAttribLocation(pMain, 'aShade'), uVP: gl.getUniformLocation(pMain, 'uVP'),
    uEye: gl.getUniformLocation(pMain, 'uEye'), uTex: gl.getUniformLocation(pMain, 'uTex'),
    uSunCol: gl.getUniformLocation(pMain, 'uSunCol'), uAmbCol: gl.getUniformLocation(pMain, 'uAmbCol'),
    uFogCol: gl.getUniformLocation(pMain, 'uFogCol'), uFogD: gl.getUniformLocation(pMain, 'uFogD'),
    uAlpha: gl.getUniformLocation(pMain, 'uAlpha'), uFlashPos: gl.getUniformLocation(pMain, 'uFlashPos'),
    uFlashCol: gl.getUniformLocation(pMain, 'uFlashCol'), uFlashI: gl.getUniformLocation(pMain, 'uFlashI')
  };
  SKYU = {
    aCorner: gl.getAttribLocation(pSky, 'aCorner'),
    uFwd: gl.getUniformLocation(pSky, 'uFwd'), uRight: gl.getUniformLocation(pSky, 'uRight'),
    uUp: gl.getUniformLocation(pSky, 'uUp'), uTanF: gl.getUniformLocation(pSky, 'uTanF'),
    uAspect: gl.getUniformLocation(pSky, 'uAspect'), uSunDir: gl.getUniformLocation(pSky, 'uSunDir'),
    uTop: gl.getUniformLocation(pSky, 'uTop'), uHorizon: gl.getUniformLocation(pSky, 'uHorizon'),
    uTime: gl.getUniformLocation(pSky, 'uTime')
  };
  PA = { aPos: gl.getAttribLocation(pPart, 'aPos'), aCol: gl.getAttribLocation(pPart, 'aCol'), uVP: gl.getUniformLocation(pPart, 'uVP') };
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  }

  /* ---------- textures ---------- */
  const tex = {};
  const makeTex = (name, canvas) => {
    if (!gl) return;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D);
    tex[name] = t;
  };
  makeTex('concreteTex', TEXGEN.concrete());
  makeTex('metalTex', TEXGEN.metal());
  makeTex('containerTexA', TEXGEN.container(16));
  makeTex('containerTexB', TEXGEN.container(200));
  makeTex('crateTex', TEXGEN.crate());
  makeTex('adobeTex', TEXGEN.adobe());
  makeTex('stoneTex', TEXGEN.stone());
  makeTex('barkTex', TEXGEN.bark());
  makeTex('foliageTex', TEXGEN.foliage());
  makeTex('sandbagTex', TEXGEN.sandbag());
  ['concrete', 'asphalt', 'sand', 'grass', 'dirt', 'steel'].forEach(k => makeTex(k + 'Tex', TEXGEN.ground(k)));
  makeTex('soldierFoe', soldierAtlas(8, true));
  makeTex('soldierAlly', soldierAtlas(210, false));

  /* ---------- world geometry batching ---------- */
  const SUN = [0.35, 0.75, 0.55];
  const batches = {};
  let bb = null;
  const lamOf = n => (Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]) * 0.8 + 0.2);
  const B = (name) => bb[name] || (bb[name] = []);
  function box(texName, x, y, z, sx, sy, sz, uvS, ao) {
    if (!gl) { cpuBoxes.push({ t: texName, x, y, z, sx, sy, sz, ao: ao === undefined ? 1 : ao }); return; }
    const arr = B(texName);
    const hx = sx / 2, hz = sz / 2, u = uvS || 1, A = ao === undefined ? 1 : ao;
    const v0 = 0, v1 = u * Math.max(0.4, sy / 1.15);
    const F = (nx, ny, nz, quad, uu) => {
      const s = lamOf([nx, ny, nz]) * A;
      const q = quad;
      arr.push(
        q[0][0], q[0][1], q[0][2], 0, v0, s,
        q[1][0], q[1][1], q[1][2], uu, v0, s,
        q[2][0], q[2][1], q[2][2], uu, v1, s,
        q[0][0], q[0][1], q[0][2], 0, v0, s,
        q[2][0], q[2][1], q[2][2], uu, v1, s,
        q[3][0], q[3][1], q[3][2], 0, v1, s
      );
    };
    const y0 = y, y1 = y + sy;
    F(0, 0, 1, [[x - hx, y0, z + hz], [x + hx, y0, z + hz], [x + hx, y1, z + hz], [x - hx, y1, z + hz]], u * sx);
    F(1, 0, 0, [[x + hx, y0, z + hz], [x + hx, y0, z - hz], [x + hx, y1, z - hz], [x + hx, y1, z + hz]], u * sz);
    F(0, 0, -1, [[x + hx, y0, z - hz], [x - hx, y0, z - hz], [x - hx, y1, z - hz], [x + hx, y1, z - hz]], u * sx);
    F(-1, 0, 0, [[x - hx, y0, z - hz], [x - hx, y0, z + hz], [x - hx, y1, z + hz], [x - hx, y1, z - hz]], u * sz);
    F(0, 1, 0, [[x - hx, y1, z + hz], [x + hx, y1, z + hz], [x + hx, y1, z - hz], [x - hx, y1, z - hz]], u * sx);
    F(0, -1, 0, [[x - hx, y0, z - hz], [x + hx, y0, z - hz], [x + hx, y0, z + hz], [x - hx, y0, z + hz]], u * sx);
  }
  function groundQuad(texName, x0, z0, x1, z1, uv) {
    if (!gl) { cpuGrounds.push({ t: texName, x0, z0, x1, z1 }); return; }
    const arr = B(texName), s = 0.86;
    const uw = (x1 - x0) * uv, vw = (z1 - z0) * uv;
    arr.push(
      x0, 0, z1, 0, 0, s, x1, 0, z1, uw, 0, s, x1, 0, z0, uw, vw, s,
      x0, 0, z1, 0, 0, s, x1, 0, z0, uw, vw, s, x0, 0, z0, 0, vw, s
    );
  }
  const cols = [];
  const cpuBoxes = [];    // [{t:x,y,z,sx,sy,sz,ao}] — software renderer
  const cpuGrounds = [];  // [{t,x0,z0,x1,z1}]
  const worldAPI = {
    layout, grid: gridH,
    setSun(v) { SUN[0] = v[0]; SUN[1] = v[1]; SUN[2] = v[2]; },
    beginBatch() { bb = {}; },
    endBatch() {
      if (!gl) { bb = null; return; }
      Object.keys(bb).forEach(name => {
        const data = new Float32Array(bb[name]);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        batches[name] = { vbo, n: data.length / 6 };
      });
      bb = null;
    },
    box, groundQuad,
    collider(x, z, r) { cols.push({ x, z, r }); }
  };
  const style = buildWorld(worldAPI, cfg.mapId, S);

  if (gl) {
    skyBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    partBuf = gl.createBuffer();
    dynBuf = gl.createBuffer();
  }

  const sfx = makeSFX(cfg.settings);

  /* ---------- environment ---------- */
  const sunDir = SUN.slice();
  function hexToRGB(h, k) {
    return [parseInt(h.slice(1, 3), 16) / 255 * k, parseInt(h.slice(3, 5), 16) / 255 * k, parseInt(h.slice(5, 7), 16) / 255 * k];
  }
  const env = {
    sunDir, sunCol: [1.05, 0.97, 0.86], ambCol: [0.42, 0.45, 0.5],
    fogCol: hexToRGB(style.sky[1], 0.92), fogD: style.fog,
    flashPos: [0, 0, 0], flashCol: [1, 0.75, 0.4], flashI: 0
  };

  /* ---------- collision ---------- */
  const solidAt = (x, z) => x < 0 || z < 0 || x >= S || z >= S || gridH[z | 0][x | 0] > 0;
  function blocked(x, z, r) {
    if (x - r < 0.3 || z - r < 0.3 || x + r > S - 0.3 || z + r > S - 0.3) return true;
    if (solidAt(x - r, z - r) || solidAt(x + r, z - r) || solidAt(x - r, z + r) || solidAt(x + r, z + r)) return true;
    for (let i = 0; i < cols.length; i++) {
      const dx = cols[i].x - x, dz = cols[i].z - z, rr = cols[i].r + r;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    return false;
  }
  const wallHit = (x, z, y) => x < 0 || z < 0 || x >= S || z >= S || gridH[z | 0][x | 0] > y;

  /* ---------- player ---------- */
  const FFA = cfg.mode === 'ffa' || cfg.mode === 'br';
  const MYNAME = cfg.myName;
  const sp = Maps.spawn(cfg.mapId, 'A');
  const player = {
    name: MYNAME, team: 'A', x: sp.x, z: sp.y, a: -0.8, pitch: 0,
    hp: 100, ammo: 0, kills: 0, deaths: 0, hs: 0, shots: 0, hits: 0,
    reloading: false, jz: 0, vz: 0, crouch: false,   // jz = jump height
    x3: sp.x, z3: sp.y, y3: 0, a3: -0.8, animPh: 0, animSpd: 0, aimP: 0, foe: false
  };
  player.ammo = Math.min(cfg.gun.ammo, TVG.state.wallet.ammo | 0);
  TVG.state.wallet.ammo = (TVG.state.wallet.ammo | 0) - player.ammo;
  const reserve = () => TVG.state.wallet.ammo | 0;
  function refillMag() {
    const take = Math.min(cfg.gun.ammo - player.ammo, reserve());
    player.ammo += take; TVG.state.wallet.ammo -= take;
    return take;
  }
  const eyeY = () => 1.58 * (player.crouch ? 0.74 : 1) + player.jz;

  /* ---------- difficulty (base × DDA toward 40% win rate) ---------- */
  const base = Object.assign({ react: .3, acc: .5, sight: 12, speed: 1.5, dmgLo: 7, dmgHi: 15, strafe: .75, retreat: 35 }, cfg.diff);
  const F = cfg.dda || 1;
  const DIFF = {
    react: base.react / F, acc: Math.min(0.95, base.acc * F),
    sight: Math.min(22, base.sight * (0.85 + F * 0.15)),
    speed: base.speed * (0.92 + F * 0.08),
    dmgLo: Math.round(base.dmgLo * (0.85 + F * 0.15)),
    dmgHi: Math.round(base.dmgHi * (0.9 + F * 0.1)),
    strafe: Math.min(1.15, base.strafe * (0.85 + F * 0.15)),
    retreat: base.retreat
  };

  /* ---------- bots ---------- */
  const actors = [];
  function mkActor(name, team) {
    const s = Maps.spawn(cfg.mapId, team);
    let x = s.x, zz = s.y;
    if (cfg.mode === 'br') {
      for (let i = 0; i < 40; i++) {
        const tx = 2 + Math.random() * (S - 4), tz = 2 + Math.random() * (S - 4);
        if (!blocked(tx, tz, 0.35)) { x = tx; zz = tz; break; }
      }
    }
    return {
      name, team, x, z: zz, a: Math.random() * TAU, hp: 100, dead: false,
      cd: 0.8 + Math.random(), respawn: 0,
      path: null, pathGoal: null, repath: 0, lastSeen: null, memory: 0,
      react: DIFF.react, mode: null, retreat: 0, patrol: null,
      strafe: Math.random() < .5 ? -1 : 1, strafeFlip: 0,
      x3: x, z3: zz, y3: 0, a3: 0, animPh: Math.random() * 6, animSpd: 0, aimP: 0,
      deadT: 0, foe: true, crouch: false
    };
  }
  (cfg.teamB || []).forEach(n => actors.push(mkActor(n, 'B')));
  ((cfg.teamA || []).filter(n => n !== MYNAME)).forEach(n => {
    const a = mkActor(n, 'A'); a.foe = false; actors.push(a);
  });
  const foes = () => actors.filter(e => !e.dead && (FFA || e.team !== 'A'));
  const aliveCount = () => actors.filter(e => !e.dead).length + 1;

  /* ---------- match state ---------- */
  let scoreA = 0, scoreB = 0, time = cfg.mode === 'br' ? 360 : 300;
  const TARGET = cfg.mode === 'br' ? 0 : (cfg.size === 1 ? 15 : cfg.size === 2 ? 25 : 40);
  let running = true, ended = false, myPlace = 0;
  let shake = 0;

  /* ---------- BR zone ---------- */
  const zone = { cx: S / 2, cz: S / 2, r: S * 0.72, tr: S * 0.72, tcx: S / 2, tcz: S / 2, phase: 0, state: 'wait', next: 26, shrink: 0 };
  function stepZone(dt) {
    if (cfg.mode !== 'br') return;
    if (zone.state === 'wait') {
      zone.next -= dt;
      if (zone.next <= 0) {
        zone.state = 'shrink'; zone.shrink = 22;
        const k = 0.55, maxOff = Math.max(0, zone.r * (1 - k));
        zone.tr = zone.r * k;
        const a = Math.random() * TAU, d = Math.random() * maxOff * 0.8;
        zone.tcx = clamp(zone.cx + Math.cos(a) * d, zone.tr, S - zone.tr);
        zone.tcz = clamp(zone.cz + Math.sin(a) * d, zone.tr, S - zone.tr);
      }
    } else {
      const k = Math.min(1, dt / Math.max(0.001, zone.shrink));
      zone.r += (zone.tr - zone.r) * k;
      zone.cx += (zone.tcx - zone.cx) * k;
      zone.cz += (zone.tcz - zone.cz) * k;
      zone.shrink -= dt;
      if (zone.shrink <= 0) {
        zone.r = zone.tr; zone.cx = zone.tcx; zone.cz = zone.tcz;
        zone.state = 'wait'; zone.phase++;
        zone.next = zone.r < 3.5 ? 1e9 : 16 + Math.random() * 8;
      }
    }
    const dps = 4 + zone.phase * 3;
    if (Math.hypot(player.x - zone.cx, player.z - zone.cz) > zone.r) damagePlayer(dps * dt, null, true);
    actors.forEach(e => {
      if (e.dead) return;
      if (Math.hypot(e.x - zone.cx, e.z - zone.cz) > zone.r) {
        e.hp -= dps * dt;
        if (e.hp <= 0) killActor(e, null, false, true);
      }
    });
  }

  /* ---------- particles / tracers ---------- */
  const parts = [], tracers = [];
  function puff(x, y, z, col, n, spd, size, grav) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = Math.random() * spd;
      parts.push({
        x, y, z, vx: Math.cos(a) * v, vy: Math.random() * spd * 0.8, vz: Math.sin(a) * v,
        life: 0.4 + Math.random() * 0.5, tl: 0, size: size * (0.6 + Math.random() * 0.8),
        r: col[0], g: col[1], b: col[2], a: 0.85, grav: grav === undefined ? -1.2 : grav
      });
    }
  }
  function sparks(x, y, z, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = 2 + Math.random() * 5;
      parts.push({
        x, y, z, vx: Math.cos(a) * v, vy: Math.random() * 4, vz: Math.sin(a) * v,
        life: 0.15 + Math.random() * 0.25, tl: 0, size: 0.05, r: 1, g: 0.8, b: 0.45, a: 1, grav: -6
      });
    }
  }
  const blood = (x, y, z) => puff(x, y, z, [0.55, 0.06, 0.06], 6, 2.2, 0.09, -5);
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.tl += dt; if (p.tl >= p.life) { parts.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02 && p.grav < 0) { p.y = 0.02; p.vy = 0; p.vx *= 0.8; p.vz *= 0.8; }
    }
    for (let i = tracers.length - 1; i >= 0; i--) {
      tracers[i].life -= dt * 7;
      if (tracers[i].life <= 0) tracers.splice(i, 1);
    }
  }

  /* ---------- grenades ---------- */
  const nades = [];
  function stepNades(dt) {
    for (let i = nades.length - 1; i >= 0; i--) {
      const g = nades[i];
      g.fuse -= dt; g.vy -= 12 * dt;
      const nx = g.x + g.vx * dt, nz = g.z + g.vz * dt;
      if (wallHit(nx, g.z, g.y)) g.vx *= -0.45; else g.x = nx;
      if (wallHit(g.x, nz, g.y)) g.vz *= -0.45; else g.z = nz;
      g.y += g.vy * dt;
      if (g.y < 0.12) { g.y = 0.12; g.vy *= -0.4; g.vx *= 0.72; g.vz *= 0.72; }
      if (g.fuse <= 0) { explode(g.x, g.y, g.z, g.mine); nades.splice(i, 1); }
    }
  }
  function explode(x, y, z, mine) {
    sfx.explosion();
    env.flashPos = [x, y + 0.5, z]; env.flashI = 2.6;
    puff(x, y + 0.3, z, [0.32, 0.3, 0.28], 14, 4.5, 0.5, 0.6);
    sparks(x, y + 0.3, z, 16);
    parts.push({ x, y: y + 0.2, z, vx: 0, vy: 0.4, vz: 0, life: 0.5, tl: 0, size: 2.4, r: 1, g: 0.55, b: 0.2, a: 0.55, grav: 0 });
    const R = 3.2;
    if (mine) {
      foes().forEach(e => {
        const d = Math.hypot(e.x - x, e.z - z);
        if (d < R && losClear3(x, y, z, e.x3, 1.0, e.z3)) {
          e.hp -= Math.round(95 * (1 - d / R));
          if (e.hp <= 0) killActor(e, MYNAME, false);
        }
      });
    } else {
      const d = Math.hypot(player.x - x, player.z - z);
      if (d < R) damagePlayer(Math.round(80 * (1 - d / R)), null);
    }
    shake = Math.max(shake, 0.5);
  }

  /* ---------- LOS / pathing ---------- */
  function losClear3(x1, y1, z1, x2, y2, z2) {
    const steps = Math.ceil(Math.hypot(x2 - x1, z2 - z1) * 3) + 2;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (wallHit(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, y1 + (y2 - y1) * t)) return false;
    }
    return true;
  }
  function findPath(sx, sz, tx, tz) {
    const sx0 = sx | 0, sz0 = sz | 0;
    let tx0 = Math.round(tx), tz0 = Math.round(tz);
    if (solidAt(tx0, tz0)) {
      let best = null, bd = 1e9;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const cx = tx0 + dx, cz = tz0 + dz;
        if (cx < 1 || cz < 1 || cx >= S - 1 || cz >= S - 1 || solidAt(cx, cz)) continue;
        const dd = dx * dx + dz * dz;
        if (dd < bd) { bd = dd; best = [cx, cz]; }
      }
      if (!best) return null; tx0 = best[0]; tz0 = best[1];
    }
    if (sx0 === tx0 && sz0 === tz0) return [];
    const start = sz0 * S + sx0, goal = tz0 * S + tx0;
    const prev = new Int32Array(S * S).fill(-1);
    prev[start] = -2;
    const q = [start]; let head = 0, found = false;
    while (head < q.length && !found) {
      const c = q[head++], cx = c % S, cz = (c / S) | 0;
      const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let i = 0; i < 4; i++) {
        const nx = cx + D[i][0], nz = cz + D[i][1];
        if (nx < 0 || nz < 0 || nx >= S || nz >= S || solidAt(nx, nz)) continue;
        const nk = nz * S + nx;
        if (prev[nk] !== -1) continue;
        prev[nk] = c;
        if (nk === goal) { found = true; break; }
        q.push(nk);
      }
    }
    if (!found) return null;
    const path = []; let cur = goal;
    while (cur !== start && cur >= 0) { path.push([cur % S, (cur / S) | 0]); cur = prev[cur]; }
    path.reverse(); return path;
  }

  /* ---------- combat ---------- */
  let fireCd = 0, nadeCd = 0, meleeCd = 0, muzzle = 0;
  let recoil = 0, kickX = 0, kickY = 0, kickRot = 0, reloadAnim = 0;
  let bob = 0, stepAcc = 0, curVel = 0, playerVel = 0, swayX = 0, swayY = 0;

  function fire() {
    if (!running || player.reloading || fireCd > 0) return;
    if (player.ammo <= 0) { sfx.empty(); reload(); return; }
    player.ammo--; player.shots++;
    fireCd = Math.max(0.07, 1.1 - cfg.gun.fire / 100);
    muzzle = 1; recoil = -3.2; kickY = 14; kickX = -6; kickRot = 0.05;
    sfx.shot();
    const fx = player.x + Math.cos(player.a) * 0.5, fz = player.z + Math.sin(player.a) * 0.5;
    env.flashPos = [fx, eyeY(), fz]; env.flashI = 1.5;
    HUD.ammo();

    const spread = 0.012 + curVel * 0.006 + (player.crouch ? -0.004 : 0) + (player.jz > 0.05 ? 0.03 : 0);
    const a = player.a + (Math.random() - 0.5) * spread * 2;
    const pitch = player.pitch + (Math.random() - 0.5) * spread;
    const dx = Math.cos(a) * Math.cos(pitch), dz = Math.sin(a) * Math.cos(pitch), dy = Math.sin(pitch);

    let dist = 45, hitY = eyeY();
    let x = player.x, z = player.z, y = eyeY();
    for (let i = 0; i < 180; i++) {
      x += dx * 0.25; z += dz * 0.25; y += dy * 0.25;
      if (y <= 0.02) { dist = i * 0.25; hitY = 0.02; break; }
      if (wallHit(x, z, y)) {
        dist = i * 0.25; hitY = y;
        puff(x, y, z, [0.5, 0.46, 0.4], 3, 1.4, 0.07);
        sparks(x, y, z, 3);
        break;
      }
    }
    let best = null, bestD = dist, head = false, hy = 0;
    for (const e of foes()) {
      const rx = e.x3 - player.x, rz = e.z3 - player.z;
      const along = rx * dx + rz * dz;
      if (along < 0 || along > bestD + 0.5) continue;
      const cx = player.x + dx * along, cz = player.z + dz * along;
      const lateral = Math.hypot(e.x3 - cx, e.z3 - cz);
      const yy = eyeY() + dy * along;
      const ck = e.crouch ? 0.75 : 1;
      if (lateral < 0.34 && Math.abs(yy - (e.y3 + 0.95 * ck)) < 0.5) { best = e; bestD = along; head = false; hy = e.y3 + 0.95 * ck; }
      if (lateral < 0.18 && Math.abs(yy - (e.y3 + 1.62 * ck)) < 0.24) { best = e; bestD = along; head = true; hy = e.y3 + 1.62 * ck; }
    }
    tracers.push({ x1: fx, y1: eyeY() - 0.06, z1: fz, x2: player.x + dx * bestD, y2: best ? hy : hitY, z2: player.z + dz * bestD, life: 1, r: 1, g: 0.85, b: 0.55 });
    if (muzzle > 0.8) sparks(fx + Math.cos(a) * 0.15, eyeY() - 0.05, fz + Math.sin(a) * 0.15, 2);
    if (best) {
      player.hits++;
      const falloff = Math.max(0.45, 1 - bestD / (cfg.gun.range / 4));
      best.hp -= Math.round(cfg.gun.dmg * falloff * (head ? 1.9 : 1) * 0.55);
      blood(best.x3, hy, best.z3);
      HUD.hitmark();
      if (head) TVG.bumpMission('d4', 1);
      if (best.hp <= 0) killActor(best, MYNAME, head);
    }
  }

  function killActor(e, by, head, zoneKill) {
    if (e.dead) return;
    e.dead = true; e.deadT = 0.001;
    e.respawn = cfg.mode === 'br' ? 1e9 : 4 + Math.random() * 3;
    blood(e.x3, 1.1, e.z3);
    if (by === MYNAME) {
      player.kills++; if (head) player.hs++;
      scoreA++;
      sfx.kill();
      HUD.feed(MYNAME, e.name, head, zoneKill);
      TVG.bumpMission('d2', 1); TVG.bumpMission('w2', 1);
    } else if (by) {
      if (by.team === 'A') scoreA++; else scoreB++;
      HUD.feed(by.name, e.name, head);
    } else if (zoneKill) {
      HUD.feed(null, e.name, false, true);
      scoreB++;
    }
    HUD.score();
    checkEnd();
  }

  function damagePlayer(n, by, zoneKill) {
    if (ended) return;
    player.hp -= n;
    HUD.hp(); HUD.hurt();
    if (n > 3) { sfx.hurt(); kickY = Math.max(kickY, 5); kickRot = -0.02; }
    if (player.hp <= 0) {
      player.deaths++;
      if (cfg.mode === 'br') { myPlace = actors.filter(a => !a.dead).length + 1; endMatch(false, false); return; }
      scoreB++;
      HUD.feed(by ? by.name : null, MYNAME, false, !!zoneKill);
      respawnMe();
      checkEnd();
    }
  }

  function respawnMe() {
    const s = Maps.spawn(cfg.mapId, 'A');
    player.hp = 100;
    refillMag(); TVG.save();
    player.x = s.x + (Math.random() - 0.5) * 0.6;
    player.z = s.y + (Math.random() - 0.5) * 0.6;
    HUD.hp(); HUD.ammo();
  }

  function reload() {
    if (player.reloading || player.ammo === cfg.gun.ammo || !running) return;
    if (reserve() <= 0) {
      if (player.ammo <= 0) {
        HUD.reloadTxt('NO AMMO');
        TVG.toast('Out of ammo — buy bullets in the weapon shop', 'error');
      }
      return;
    }
    player.reloading = true;
    HUD.reloadTxt('RELOADING');
    reloadAnim = 1; sfx.reloadIn();
    setTimeout(() => {
      refillMag(); TVG.save();
      player.reloading = false;
      HUD.reloadTxt('READY'); HUD.ammo();
      sfx.reloadOut();
    }, 1500);
  }

  /* ---------- BOT AI ---------- */
  function botTarget(e) {
    if (!FFA && e.team === 'B') return player;
    let best = null, bd = 1e9;
    for (const o of actors) {
      if (o.dead || o === e) continue;
      if (!FFA && o.team === e.team) continue;
      const d = (o.x - e.x) ** 2 + (o.z - e.z) ** 2;
      if (d < bd) { bd = d; best = o; }
    }
    if (FFA && !ended) {
      const dp = (player.x - e.x) ** 2 + (player.z - e.z) ** 2;
      if (dp < bd) best = player;
    }
    return best;
  }
  function botDamage(e, t, dmg) {
    if (t === player) { damagePlayer(dmg, e); return; }
    t.hp -= dmg;
    if (t.hp <= 0) killActor(t, e, false);
  }
  function followPath(e, tx, tz, speed, dt) {
    e.repath -= dt;
    if (!e.path || e.repath <= 0 || (e.pathGoal && Math.hypot(tx - e.pathGoal[0], tz - e.pathGoal[1]) > 1.2)) {
      e.path = findPath(e.x, e.z, tx, tz);
      e.pathGoal = [tx, tz];
      e.repath = 0.5 + Math.random() * 0.4;
    }
    let gx = tx, gz = tz;
    if (e.path && e.path.length) { gx = e.path[0][0] + 0.5; gz = e.path[0][1] + 0.5; }
    const ang = Math.atan2(gz - e.z, gx - e.x);
    e.a = ang;
    const nx = e.x + Math.cos(ang) * speed * dt, nz = e.z + Math.sin(ang) * speed * dt;
    if (!blocked(nx, e.z, 0.3)) e.x = nx;
    if (!blocked(e.x, nz, 0.3)) e.z = nz;
    if (e.path && e.path.length && Math.hypot(gx - e.x, gz - e.z) < 0.35) e.path.shift();
  }
  function fireBot(e, t, dist, moving) {
    if (e.cd > 0) return;
    e.cd = 0.8 + Math.random() * 1.4;
    sfx.enemyShot(Math.hypot(e.x - player.x, e.z - player.z));
    const fx = e.x3 + Math.cos(e.a3) * 0.4, fz = e.z3 + Math.sin(e.a3) * 0.4;
    const tx = t === player ? player.x3 : t.x3, tz = t === player ? player.z3 : t.z3;
    tracers.push({ x1: fx, y1: 1.35, z1: fz, x2: tx, y2: 1.1 + (Math.random() - .5) * .3, z2: tz, life: 1, r: 1, g: 0.8, b: 0.5 });
    const dk = Math.max(0, 1 - dist / (DIFF.sight * 1.4));
    let acc = DIFF.acc * (0.5 + 0.5 * dk);
    if (moving) acc *= 0.72;
    acc *= 1 - Math.min(0.3, playerVel * 0.06);
    if (Math.random() < (t === player ? acc : acc * 0.55)) {
      botDamage(e, t, Math.round(TVG.rnd(DIFF.dmgLo, DIFF.dmgHi) * Math.max(0.5, 1 - dist / 25)));
    }
  }
  function stepBot(e, dt) {
    if (e.dead) {
      e.deadT += dt;
      e.respawn -= dt;
      if (e.respawn <= 0) {
        const s = Maps.spawn(cfg.mapId, e.team);
        e.x = s.x + (Math.random() - 0.5); e.z = s.y + (Math.random() - 0.5);
        e.hp = 100; e.dead = false; e.deadT = 0;
        e.path = null; e.lastSeen = null; e.memory = 0; e.react = DIFF.react;
        e.mode = null; e.strafe = Math.random() < .5 ? -1 : 1;
      }
      return;
    }
    e.cd -= dt;
    const outZone = cfg.mode === 'br' && Math.hypot(e.x - zone.cx, e.z - zone.cz) > zone.r * 0.85;
    const t = botTarget(e);
    const hasT = t && !(t === player ? ended : t.dead);
    const dist = hasT ? Math.hypot(t.x - e.x, t.z - e.z) : 1e9;
    const see = hasT && dist < DIFF.sight && losClear3(e.x, 1.5, e.z, t.x, 1.3, t.z);

    if (see) { e.lastSeen = { x: t.x, z: t.z }; e.memory = 4.5; }
    else { e.memory -= dt; if (e.memory <= 0) e.lastSeen = null; }
    if (see) e.react -= dt; else if (e.react < DIFF.react) e.react = DIFF.react;

    const speed = DIFF.speed * (outZone ? 1.3 : 1);
    if (outZone && !see) {
      followPath(e, zone.cx + (Math.random() - 0.5) * zone.r * 0.8, zone.cz + (Math.random() - 0.5) * zone.r * 0.8, speed, dt);
      e.a3 = e.a; e.aimP = 0; e.animSpd = 2;
    } else if (see && e.react <= 0) {
      e.a = Math.atan2(t.z - e.z, t.x - e.x);
      e.a3 = e.a; e.aimP = 0.15; e.animSpd = 2;
      if (e.hp < DIFF.retreat && Math.random() < 0.05) { e.mode = 'retreat'; e.retreat = 1.6; }
      if (e.mode === 'retreat') {
        const away = Math.atan2(e.z - t.z, e.x - t.x);
        followPath(e, e.x + Math.cos(away) * 5, e.z + Math.sin(away) * 5, speed, dt);
        e.retreat -= dt;
        if (e.retreat <= 0) e.mode = null;
        e.a3 = e.a;
        return;
      }
      e.strafeFlip -= dt;
      if (e.strafeFlip <= 0) { e.strafe = -e.strafe; e.strafeFlip = 0.6 + Math.random() * 1.3; }
      let rdir = 0;
      if (dist > 9) rdir = 1; else if (dist < 2.2) rdir = -1;
      const ang = Math.atan2(t.z - e.z, t.x - e.x);
      const perp = ang + PI / 2 * e.strafe;
      const mvx = e.x + (Math.cos(perp) * DIFF.strafe + Math.cos(ang) * rdir * 0.55) * speed * dt;
      const mvz = e.z + (Math.sin(perp) * DIFF.strafe + Math.sin(ang) * rdir * 0.55) * speed * dt;
      if (!blocked(mvx, e.z, 0.3)) e.x = mvx; else e.strafe = -e.strafe;
      if (!blocked(e.x, mvz, 0.3)) e.z = mvz; else e.strafe = -e.strafe;
      fireBot(e, t, dist, true);
    } else if (e.lastSeen) {
      followPath(e, e.lastSeen.x, e.lastSeen.z, speed, dt);
      e.a3 = e.a; e.aimP = 0; e.animSpd = 2;
    } else {
      if (!e.patrol) {
        for (let i = 0; i < 14; i++) {
          const cx = TVG.rnd(1, S - 2), cz = TVG.rnd(1, S - 2);
          if (!solidAt(cx, cz)) { e.patrol = [cx, cz]; break; }
        }
      }
      if (e.patrol) {
        followPath(e, e.patrol[0] + 0.5, e.patrol[1] + 0.5, speed * 0.55, dt);
        e.a3 = e.a; e.aimP = 0; e.animSpd = 1;
        if (e.path && !e.path.length) e.patrol = null;
      } else { e.animSpd = 0; e.a3 = e.a; }
    }
    e.x3 = e.x; e.z3 = e.z; e.y3 = 0;
    e.animPh += dt * (e.animSpd > 1.5 ? 11 : e.animSpd > 0.4 ? 7.5 : 1.2);
  }

  /* ---------- end ---------- */
  function checkEnd() {
    if (ended) return;
    if (cfg.mode === 'br') { if (aliveCount() <= 1) endMatch(true, false); return; }
    if (scoreA >= TARGET || scoreB >= TARGET) endMatch(scoreA >= TARGET, false);
  }
  function buildResult(won, forfeit) {
    const acc = player.shots ? Math.round(player.hits / player.shots * 100) : 0;
    return {
      won, forfeit: !!forfeit,
      scoreA: cfg.mode === 'br' ? player.kills : scoreA,
      scoreB: cfg.mode === 'br' ? 0 : scoreB,
      target: TARGET,
      kills: player.kills, deaths: player.deaths, headshots: player.hs,
      assists: TVG.rnd(1, 6), accuracy: acc,
      kd: player.deaths ? +(player.kills / player.deaths).toFixed(2) : player.kills,
      map: cfg.mapId, gameMode: cfg.gameMode,
      type: cfg.mode === 'br' ? 'BR' : cfg.typeLabel,
      online: false, vsBots: true,
      placement: cfg.mode === 'br' ? (won ? 1 : myPlace) : 0,
      lobbySize: cfg.mode === 'br' ? actors.length + 1 : ((cfg.teamA || []).length + (cfg.teamB || []).length),
      coins: 0,
      cash: won ? TVG.WIN_REWARD : 0,
      xp: forfeit ? 0 : (won ? 180 : 70) + player.kills * 6,
      duration: (cfg.mode === 'br' ? 360 : 300) - Math.floor(time)
    };
  }
  function endMatch(won, forfeit) {
    if (ended) return;
    ended = true; running = false;
    TVG.state.wallet.ammo = reserve() + player.ammo;
    const r = buildResult(won, forfeit);
    cfg.onEnd(r);
  }

  /* ---------- rendering ---------- */
  const FOV_BASE = PI / 3;
  let fov = FOV_BASE;
  const foeArr = new Float32Array(6 * 6 * 1500);
  const allyArr = new Float32Array(6 * 6 * 1500);
  const vmArr = new Float32Array(6 * 6 * 60);
  const partData = new Float32Array(6 * 7 * 900);
  const zoneArr = new Float32Array(48 * 6 * 7);

  function resize() {
    const g = cfg.settings.graphics;
    const scale = (g === 'high' ? 1 : g === 'low' ? 0.55 : 0.78) * (use2D ? 0.72 : 1);
    const dpr = Math.min(use2D ? 1.3 : 2, w.devicePixelRatio || 1);
    const cw = Math.max(1, Math.floor((cv.clientWidth || innerWidth) * dpr * scale));
    const ch = Math.max(1, Math.floor((cv.clientHeight || innerHeight) * dpr * scale));
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    if (gl) gl.viewport(0, 0, cw, ch);
    return [cw, ch];
  }

  function setMainUniforms(vp, eye, alpha) {
    gl.useProgram(pMain);
    gl.uniformMatrix4fv(L.uVP, false, vp);
    gl.uniform3fv(L.uEye, eye);
    gl.uniform3fv(L.uSunCol, env.sunCol);
    gl.uniform3fv(L.uAmbCol, env.ambCol);
    gl.uniform3fv(L.uFogCol, env.fogCol);
    gl.uniform1f(L.uFogD, env.fogD);
    gl.uniform1f(L.uAlpha, alpha);
    gl.uniform3fv(L.uFlashPos, env.flashPos);
    gl.uniform3fv(L.uFlashCol, env.flashCol);
    gl.uniform1f(L.uFlashI, env.flashI);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(L.uTex, 0);
  }
  function bindMainAttribs() {
    gl.enableVertexAttribArray(L.aPos);
    gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(L.aUV);
    gl.vertexAttribPointer(L.aUV, 2, gl.FLOAT, false, 24, 12);
    gl.enableVertexAttribArray(L.aShade);
    gl.vertexAttribPointer(L.aShade, 1, gl.FLOAT, false, 24, 20);
  }
  function drawVerts(vbo, arr, vertCount, texName, vp, eye) {
    if (!vertCount) return;
    setMainUniforms(vp, eye, 1);
    gl.bindTexture(gl.TEXTURE_2D, tex[texName]);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, arr.subarray(0, vertCount * 6), gl.DYNAMIC_DRAW);
    bindMainAttribs();
    gl.drawArrays(gl.TRIANGLES, 0, vertCount);
  }

  function meshActors() {
    const order = actors.slice().sort((a, b) =>
      ((b.x3 - player.x) ** 2 + (b.z3 - player.z) ** 2) - ((a.x3 - player.x) ** 2 + (a.z3 - player.z) ** 2));
    let nF = 0, nA = 0;
    for (const e of order) {
      if (Math.hypot(e.x3 - player.x, e.z3 - player.z) > 45) continue;
      if (e.dead && e.deadT > 3.5) continue;
      const n = meshSoldier(SCRATCH, 0, e, sunDir);
      if (e.foe) {
        if (nF + n > foeArr.length) continue;
        foeArr.set(SCRATCH.subarray(0, n), nF); nF += n;
      } else {
        if (nA + n > allyArr.length) continue;
        allyArr.set(SCRATCH.subarray(0, n), nA); nA += n;
      }
    }
    return { nFoe: nF / 6, nAlly: nA / 6 };
  }

  function billboards(camR, camU) {
    let n = 0;
    const cap = partData.length;
    for (const p of parts) {
      if (n > cap - 42) break;
      const k = 1 - p.tl / p.life;
      const s = p.size * (1 + (1 - k) * 1.4);
      const a = p.a * k;
      const crn = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      const vx = crn.map(([sx, sy]) => [
        p.x + (camR[0] * sx + camU[0] * sy) * s,
        p.y + (camR[1] * sx + camU[1] * sy) * s,
        p.z + (camR[2] * sx + camU[2] * sy) * s
      ]);
      const put = pt => {
        partData[n++] = pt[0]; partData[n++] = pt[1]; partData[n++] = pt[2];
        partData[n++] = p.r; partData[n++] = p.g; partData[n++] = p.b; partData[n++] = a;
      };
      put(vx[0]); put(vx[1]); put(vx[2]); put(vx[0]); put(vx[2]); put(vx[3]);
    }
    for (const t of tracers) {
      if (n > cap - 42) break;
      const dx = t.x2 - t.x1, dy = t.y2 - t.y1, dz = t.z2 - t.z1;
      const L2 = Math.hypot(dx, dy, dz) || 0.01;
      const ux = dx / L2, uy = dy / L2, uz = dz / L2;
      const px = uy * camR[2] - uz * camR[1], py = uz * camR[0] - ux * camR[2], pz = ux * camR[1] - uy * camR[0];
      const wd = 0.02 + t.life * 0.025;
      const al = Math.min(1, t.life) * 0.9;
      const put = (xx, yy, zz) => {
        partData[n++] = xx; partData[n++] = yy; partData[n++] = zz;
        partData[n++] = t.r; partData[n++] = t.g; partData[n++] = t.b; partData[n++] = al;
      };
      put(t.x1 + px * wd, t.y1 + py * wd, t.z1 + pz * wd);
      put(t.x2 + px * wd, t.y2 + py * wd, t.z2 + pz * wd);
      put(t.x2 - px * wd, t.y2 - py * wd, t.z2 - pz * wd);
      put(t.x1 + px * wd, t.y1 + py * wd, t.z1 + pz * wd);
      put(t.x2 - px * wd, t.y2 - py * wd, t.z2 - pz * wd);
      put(t.x1 - px * wd, t.y1 - py * wd, t.z1 - pz * wd);
    }
    return n / 7;
  }

  function zoneVerts(now) {
    let n = 0;
    const segs = 48, h = 14;
    for (let i = 0; i < segs; i++) {
      const a1 = (i / segs) * TAU, a2 = ((i + 1) / segs) * TAU;
      const x1 = zone.cx + Math.cos(a1) * zone.r, z1 = zone.cz + Math.sin(a1) * zone.r;
      const x2 = zone.cx + Math.cos(a2) * zone.r, z2 = zone.cz + Math.sin(a2) * zone.r;
      const band = 0.15 + 0.09 * Math.sin(a1 * 9 + now * 0.003);
      const put = (xx, yy, zz, al) => {
        zoneArr[n++] = xx; zoneArr[n++] = yy; zoneArr[n++] = zz;
        zoneArr[n++] = 0.25; zoneArr[n++] = 0.62; zoneArr[n++] = 1.0; zoneArr[n++] = al;
      };
      put(x1, 0, z1, 0.04); put(x2, 0, z2, 0.04); put(x2, h, z2, band);
      put(x1, 0, z1, 0.04); put(x2, h, z2, band); put(x1, h, z1, band);
    }
    return n / 7;
  }

  function viewModel() {
    let n = 0;
    const bobY = Math.abs(Math.cos(bob)) * 0.02;
    const bobX = Math.sin(bob) * 0.012;
    const dip = reloadAnim * reloadAnim * 0.24;
    const yaw = player.a, pitch = player.pitch;
    const sideX = Math.cos(yaw + PI / 2), sideZ = Math.sin(yaw + PI / 2);
    const ox = player.x + Math.cos(yaw) * 0.3 + sideX * (0.15 + bobX);
    const oz = player.z + Math.sin(yaw) * 0.3 + sideZ * (0.15 + bobX);
    const oy = eyeY() - 0.17 + bobY + dip;
    const gy = PI / 2 - yaw - 0.05 - kickRot;
    n = partBox(vmArr, n, ox, oy, oz, gy, -pitch, 0, 0, 0, 0.05, 0.085, 0.46, ATLAS.gun, sunDir, 1.12);
    n = partBox(vmArr, n, ox, oy, oz, gy, -pitch, 0, 0.012, 0.3, 0.046, 0.062, 0.3, ATLAS.gun, sunDir, 1.06);
    n = partBox(vmArr, n, ox, oy, oz, gy, -pitch, 0, 0.016, 0.52, 0.03, 0.036, 0.18, ATLAS.gun, sunDir, 1);
    n = partBox(vmArr, n, ox, oy, oz, gy, -pitch, 0.012, -0.085, 0.05, 0.036, 0.15, 0.06, ATLAS.gun, sunDir, 0.85);
    n = partBox(vmArr, n, ox, oy, oz, gy, -pitch, 0, -0.005, -0.3, 0.042, 0.075, 0.2, ATLAS.gun, sunDir, 0.9);
    n = partBox(vmArr, n, ox, oy, oz, gy, -pitch, 0.02, -0.05, -0.08, 0.06, 0.075, 0.1, ATLAS.skin, sunDir, 1);
    n = partBox(vmArr, n, ox, oy, oz, gy, -pitch, -0.01, -0.045, 0.3, 0.06, 0.075, 0.09, ATLAS.skin, sunDir, 1);
    return n / 6;
  }

  function drawParts(vp, count, blend) {
    if (!count) return;
    gl.useProgram(pPart);
    gl.uniformMatrix4fv(PA.uVP, false, vp);
    gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
    gl.bufferData(gl.ARRAY_BUFFER, (count === zoneVertCount && blend === 'zone' ? zoneArr : partData).subarray(0, count * 7), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(PA.aPos);
    gl.vertexAttribPointer(PA.aPos, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(PA.aCol);
    gl.vertexAttribPointer(PA.aCol, 4, gl.FLOAT, false, 28, 12);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, count);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
  let zoneVertCount = 0;

  const mctx = cfg.mini.getContext('2d');
  function drawMini() {
    const M = cfg.mini.width, s = M / S;
    mctx.clearRect(0, 0, M, M);
    mctx.fillStyle = 'rgba(24,28,24,.85)'; mctx.fillRect(0, 0, M, M);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const h = gridH[y][x];
      if (!h) continue;
      mctx.fillStyle = h > 2 ? 'rgba(150,138,112,.85)' : 'rgba(122,112,92,.5)';
      mctx.fillRect(x * s, y * s, s + 0.5, s + 0.5);
    }
    if (cfg.mode === 'br') {
      mctx.fillStyle = 'rgba(70,160,255,.12)';
      mctx.strokeStyle = 'rgba(80,180,255,.95)'; mctx.lineWidth = 1.6;
      mctx.beginPath(); mctx.arc(zone.cx * s, zone.cz * s, zone.r * s, 0, TAU); mctx.fill(); mctx.stroke();
    }
    actors.forEach(e => {
      if (e.dead) return;
      const isFoe = FFA || e.team === 'B';
      if (isFoe && Math.hypot(e.x - player.x, e.z - player.z) > 11) return;
      mctx.fillStyle = isFoe ? '#EF4444' : '#3B82F6';
      mctx.beginPath(); mctx.arc(e.x * s, e.z * s, 2.4, 0, TAU); mctx.fill();
    });
    mctx.fillStyle = '#FF8C42';
    mctx.beginPath(); mctx.arc(player.x * s, player.z * s, 3.2, 0, TAU); mctx.fill();
    mctx.strokeStyle = '#FF8C42'; mctx.lineWidth = 1.6;
    mctx.beginPath();
    mctx.moveTo(player.x * s, player.z * s);
    mctx.lineTo(player.x * s + Math.cos(player.a) * 8, player.z * s + Math.sin(player.a) * 8);
    mctx.stroke();
  }


  /* ================= SOFTWARE 3D RENDERER (Canvas2D, no WebGL) =================
     Same game, same geometry: world boxes, soldier meshes, particles, zone and
     the view model are projected on the CPU and painter-sorted, then filled as
     flat-shaded polygons. Looks like clean low-poly; needs zero WebGL. */
  const PAL = {
    concreteTex: [139, 136, 127], metalTex: [117, 122, 128], containerTexA: [138, 90, 69],
    containerTexB: [69, 103, 138], crateTex: [154, 116, 68], adobeTex: [201, 158, 99],
    stoneTex: [111, 106, 94], barkTex: [92, 70, 41], foliageTex: [63, 107, 52],
    sandbagTex: [168, 148, 104], asphaltTex: [76, 76, 80], sandTex: [207, 167, 104],
    grassTex: [90, 124, 63], dirtTex: [138, 107, 71], steelTex: [93, 96, 102]
  };
  const SOLDIER_COL = {
    skin: [197, 142, 99], pantsA: [76, 82, 56], pantsB: [58, 64, 48], vest: [46, 50, 38],
    helmetA: [69, 75, 52], boot: [38, 34, 28], gun: [35, 38, 42], gear: [56, 64, 44],
    shirtA_foe: [146, 81, 63], shirtA_ally: [62, 78, 99],
    shirtB_foe: [138, 74, 60], shirtB_ally: [63, 90, 138],
    helmetB_foe: [125, 59, 48], helmetB_ally: [49, 69, 110]
  };
  function regionKey(u, v) {
    for (const k in ATLAS) {
      const r = ATLAS[k];
      if (u >= r[0] && u <= r[2] && v >= r[1] && v <= r[3]) return k;
    }
    return 'gear';
  }
  function softLit(base, sh, dist, ao) {
    const A = [0.42, 0.45, 0.5], Su = [1.05, 0.97, 0.86];
    let r = base[0] / 255 * (A[0] + Su[0] * sh) * (ao || 1);
    let g = base[1] / 255 * (A[1] + Su[1] * sh) * (ao || 1);
    let b = base[2] / 255 * (A[2] + Su[2] * sh) * (ao || 1);
    const fog = 1 - Math.exp(-env.fogD * env.fogD * dist * dist);
    r += (env.fogCol[0] - r) * fog; g += (env.fogCol[1] - g) * fog; b += (env.fogCol[2] - b) * fog;
    return 'rgb(' + (r * 255 | 0) + ',' + (g * 255 | 0) + ',' + (b * 255 | 0) + ')';
  }
  const ctx2d = use2D ? cv.getContext('2d') : null;

  function render2D(now, W, H) {
    const asp = W / Math.max(1, H);
    const shx = (Math.random() - 0.5) * shake * 0.05;
    const shp = (Math.random() - 0.5) * shake * 0.04;
    const eye = [player.x, eyeY(), player.z];
    const vp = M4.mul(M4.persp(fov, asp, 0.05, 140), M4.view(eye[0], eye[1], eye[2], player.pitch + shp, player.a + shx));
    const cy = Math.cos(player.a), sy = Math.sin(player.a), cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
    const fwd = [cy * cp, sp, sy * cp];
    const right = [-sy, 0, cy];
    const up = [-cy * sp, cp, -sy * sp];
    const tanF = Math.tan(fov / 2);

    const PRJ = (px, py, pz) => {
      const x = vp[0] * px + vp[4] * py + vp[8] * pz + vp[12];
      const y = vp[1] * px + vp[5] * py + vp[9] * pz + vp[13];
      const ww = vp[3] * px + vp[7] * py + vp[11] * pz + vp[15];
      return [x, y, ww];
    };
    const SCR = p => [(p[0] / p[2] * 0.5 + 0.5) * W, (1 - (p[1] / p[2] * 0.5 + 0.5)) * H];
    const c2 = ctx2d;

    /* ---- sky + ground ---- */
    let hy = H * 0.5;
    const hpt = PRJ(eye[0] + fwd[0] * 400, eye[1], eye[2] + fwd[2] * 400);
    if (hpt[2] > 0.1) hy = clamp(SCR(hpt)[1], -H, H * 2);
    let grd = c2.createLinearGradient(0, 0, 0, Math.max(1, hy));
    grd.addColorStop(0, style.sky[0]); grd.addColorStop(1, style.sky[1]);
    c2.fillStyle = grd; c2.fillRect(0, 0, W, Math.max(0, hy));
    const spt = PRJ(eye[0] + sunDir[0] * 400, eye[1] + sunDir[1] * 400, eye[2] + sunDir[2] * 400);
    if (spt[2] > 1) {
      const ss = SCR(spt);
      const rg = c2.createRadialGradient(ss[0], ss[1], 0, ss[0], ss[1], H * 0.5);
      rg.addColorStop(0, 'rgba(255,240,205,.95)'); rg.addColorStop(0.25, 'rgba(255,220,160,.35)'); rg.addColorStop(1, 'rgba(255,200,140,0)');
      c2.fillStyle = rg; c2.fillRect(0, 0, W, Math.max(0, hy));
    }
    const gpal = PAL[style.ground + 'Tex'] || PAL.concreteTex;
    grd = c2.createLinearGradient(0, Math.max(1, hy), 0, H);
    grd.addColorStop(0, softLit(gpal, 0.35, 26, 1).replace('rgb', 'rgba').replace(')', ',1)'));
    grd.addColorStop(1, softLit(gpal, 0.9, 3, 1));
    c2.fillStyle = grd; c2.fillRect(0, Math.max(0, hy), W, H - Math.max(0, hy));
    /* arena floor + perspective grid */
    const corners = [[0, 0], [S, 0], [S, S], [0, S]].map(([gx, gz]) => PRJ(gx, 0, gz));
    if (corners.every(p => p[2] > 0.1)) {
      const cs = corners.map(SCR);
      c2.beginPath(); c2.moveTo(cs[0][0], cs[0][1]);
      for (let i = 1; i < 4; i++) c2.lineTo(cs[i][0], cs[i][1]);
      c2.closePath();
      c2.fillStyle = softLit(gpal, 0.86, 10, 1); c2.fill();
      c2.strokeStyle = 'rgba(0,0,0,.10)'; c2.lineWidth = 1;
      for (let g0 = 0; g0 <= S; g0 += 4) {
        let a1 = PRJ(g0, 0, 0), a2 = PRJ(g0, 0, S), b1 = PRJ(0, 0, g0), b2 = PRJ(S, 0, g0);
        if (a1[2] > 0.1 && a2[2] > 0.1) { const p1 = SCR(a1), p2 = SCR(a2); c2.beginPath(); c2.moveTo(p1[0], p1[1]); c2.lineTo(p2[0], p2[1]); c2.stroke(); }
        if (b1[2] > 0.1 && b2[2] > 0.1) { const p1 = SCR(b1), p2 = SCR(b2); c2.beginPath(); c2.moveTo(p1[0], p1[1]); c2.lineTo(p2[0], p2[1]); c2.stroke(); }
      }
    }

    /* ---- collect drawable polygons ---- */
    const items = [];
    const lam = n => Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]) * 0.8 + 0.2;

    for (const b of cpuBoxes) {
      const dx = b.x - player.x, dz = b.z - player.z;
      const dd = Math.hypot(dx, dz);
      if (dd > 42) continue;
      const hx = b.sx / 2, hz = b.sz / 2, y0 = b.y, y1 = b.y + b.sy;
      const C = [
        PRJ(b.x - hx, y0, b.z - hz), PRJ(b.x + hx, y0, b.z - hz), PRJ(b.x + hx, y1, b.z - hz), PRJ(b.x - hx, y1, b.z - hz),
        PRJ(b.x - hx, y0, b.z + hz), PRJ(b.x + hx, y0, b.z + hz), PRJ(b.x + hx, y1, b.z + hz), PRJ(b.x - hx, y1, b.z + hz)
      ];
      if (C.every(p => p[2] < 0.06)) continue;
      if (C.some(p => p[2] < 0.06)) continue;   // straddles the camera — skip
      const FACES = [
        [[4, 5, 6, 7], [0, 0, 1]], [[1, 0, 3, 2], [0, 0, -1]],
        [[5, 1, 2, 6], [1, 0, 0]], [[0, 4, 7, 3], [-1, 0, 0]], [[3, 7, 6, 2], [0, 1, 0]]
      ];
      const base = PAL[b.t] || PAL.concreteTex;
      for (const [ix, n] of FACES) {
        const s = SCR(C[ix[0]]);
        const pts = [s, SCR(C[ix[1]]), SCR(C[ix[2]]), SCR(C[ix[3]])];
        if (pts.some(p => p[0] < -60 || p[0] > W + 60 || p[1] < -60 || p[1] > H + 60)) {
          if (pts.every(p => (p[0] < 0) === (pts[0][0] < 0))) continue;
        }
        const depth = (C[ix[0]][2] + C[ix[1]][2] + C[ix[2]][2] + C[ix[3]][2]) / 4;
        items.push({ d: depth, pts, f: softLit(base, lam(n), depth, b.ao) });
      }
    }

    /* soldiers: reuse the same world-space triangle meshes */
    const counts2 = meshActors();
    const eatTris = (arr, nFloats, foe) => {
      for (let i = 0; i < nFloats; i += 18) {
        const p1 = PRJ(arr[i], arr[i + 1], arr[i + 2]);
        const p2 = PRJ(arr[i + 6], arr[i + 7], arr[i + 8]);
        const p3 = PRJ(arr[i + 12], arr[i + 13], arr[i + 14]);
        if (p1[2] < 0.06 || p2[2] < 0.06 || p3[2] < 0.06) continue;
        const depth = (p1[2] + p2[2] + p3[2]) / 3;
        const u = arr[i + 3], v = arr[i + 4], sh = arr[i + 5];
        const k = regionKey(u, v);
        let base;
        if (k === 'shirtA') base = foe ? SOLDIER_COL.shirtA_foe : SOLDIER_COL.shirtA_ally;
        else if (k === 'shirtB') base = foe ? SOLDIER_COL.shirtB_foe : SOLDIER_COL.shirtB_ally;
        else if (k === 'helmetB') base = foe ? SOLDIER_COL.helmetB_foe : SOLDIER_COL.helmetB_ally;
        else base = SOLDIER_COL[k] || SOLDIER_COL.gear;
        items.push({ d: depth, pts: [SCR(p1), SCR(p2), SCR(p3)], f: softLit(base, sh, depth, 1) });
      }
    };
    eatTris(foeArr, counts2.nFoe * 6, true);
    eatTris(allyArr, counts2.nAlly * 6, false);

    /* particles + tracers (world-space quads from billboards()) */
    const pn2 = billboards(right, up);
    for (let i = 0; i < pn2 * 7; i += 42) {
      const q = [];
      let ok = true, depth = 0;
      for (let j = 0; j < 6; j++) {
        const p = PRJ(partData[i + j * 7], partData[i + j * 7 + 1], partData[i + j * 7 + 2]);
        if (p[2] < 0.06) { ok = false; break; }
        depth += p[2] / 6; q.push(SCR(p));
      }
      if (!ok) continue;
      items.push({
        d: depth, pts: q,
        f: 'rgba(' + (partData[i + 3] * 255 | 0) + ',' + (partData[i + 4] * 255 | 0) + ',' + (partData[i + 5] * 255 | 0) + ',' + partData[i + 6].toFixed(3) + ')'
      });
    }

    /* BR zone wall */
    if (cfg.mode === 'br') {
      const zn2 = zoneVerts(now);
      for (let i = 0; i < zn2 * 7; i += 21) {
        const q = [];
        let ok = true, depth = 0;
        for (let j = 0; j < 3; j++) {
          const p = PRJ(zoneArr[i + j * 7], zoneArr[i + j * 7 + 1], zoneArr[i + j * 7 + 2]);
          if (p[2] < 0.06) { ok = false; break; }
          depth += p[2] / 3; q.push(SCR(p));
        }
        if (!ok) continue;
        items.push({
          d: depth, pts: q,
          f: 'rgba(' + (zoneArr[i + 3] * 255 | 0) + ',' + (zoneArr[i + 4] * 255 | 0) + ',' + (zoneArr[i + 5] * 255 | 0) + ',' + zoneArr[i + 6].toFixed(3) + ')'
        });
      }
    }

    /* grenades as dots */
    for (const g of nades) {
      const p = PRJ(g.x, g.y, g.z);
      if (p[2] > 0.1) {
        const s2 = SCR(p);
        const rpx = Math.max(1.5, (0.13 / p[2]) * (H / 2) / tanF);
        items.push({ d: p[2], pts: null, dot: [s2, rpx], f: '#1c1e22' });
      }
    }

    /* painter's algorithm: far → near */
    items.sort((a, b) => b.d - a.d);
    for (const it of items) {
      c2.fillStyle = it.f;
      if (it.dot) {
        c2.beginPath(); c2.arc(it.dot[0][0], it.dot[0][1], it.dot[1], 0, TAU); c2.fill();
        continue;
      }
      c2.beginPath();
      c2.moveTo(it.pts[0][0], it.pts[0][1]);
      for (let i = 1; i < it.pts.length; i++) c2.lineTo(it.pts[i][0], it.pts[i][1]);
      c2.closePath(); c2.fill();
    }

    /* first-person weapon on top (same mesh as GL) */
    const vn2 = viewModel();
    for (let i = 0; i < vn2 * 6; i += 18) {
      const p1 = PRJ(vmArr[i], vmArr[i + 1], vmArr[i + 2]);
      const p2 = PRJ(vmArr[i + 6], vmArr[i + 7], vmArr[i + 8]);
      const p3 = PRJ(vmArr[i + 12], vmArr[i + 13], vmArr[i + 14]);
      if (p1[2] < 0.02 || p2[2] < 0.02 || p3[2] < 0.02) continue;
      const k = regionKey(vmArr[i + 3], vmArr[i + 4]);
      const base = k === 'skin' ? SOLDIER_COL.skin : SOLDIER_COL.gun;
      c2.fillStyle = softLit(base, vmArr[i + 5], 0.5, 1);
      c2.beginPath();
      const s1 = SCR(p1), s2 = SCR(p2), s3 = SCR(p3);
      c2.moveTo(s1[0], s1[1]); c2.lineTo(s2[0], s2[1]); c2.lineTo(s3[0], s3[1]);
      c2.closePath(); c2.fill();
    }

    drawMini();
  }

  function render(now) {
    const [W, H] = resize();
    if (use2D) { render2D(now, W, H); return; }
    const asp = W / Math.max(1, H);
    const shx = (Math.random() - 0.5) * shake * 0.05;
    const shp = (Math.random() - 0.5) * shake * 0.04;
    const eye = [player.x, eyeY(), player.z];
    const vp = M4.mul(M4.persp(fov, asp, 0.05, 140), M4.view(eye[0], eye[1], eye[2], player.pitch + shp, player.a + shx));

    const cy = Math.cos(player.a), sy = Math.sin(player.a), cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
    const fwd = [cy * cp, sp, sy * cp];
    const right = [-sy, 0, cy];
    const up = [-cy * sp, cp, -sy * sp];

    gl.clearColor(env.fogCol[0], env.fogCol[1], env.fogCol[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* sky */
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(pSky);
    gl.uniform3fv(SKYU.uFwd, fwd); gl.uniform3fv(SKYU.uRight, right); gl.uniform3fv(SKYU.uUp, up);
    gl.uniform1f(SKYU.uTanF, Math.tan(fov / 2)); gl.uniform1f(SKYU.uAspect, asp);
    gl.uniform3fv(SKYU.uSunDir, sunDir);
    gl.uniform3fv(SKYU.uTop, hexToRGB(style.sky[0], 1));
    gl.uniform3fv(SKYU.uHorizon, [Math.min(1, env.fogCol[0] * 1.06), Math.min(1, env.fogCol[1] * 1.06), Math.min(1, env.fogCol[2] * 1.06)]);
    gl.uniform1f(SKYU.uTime, now * 0.001);
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
    gl.enableVertexAttribArray(SKYU.aCorner);
    gl.vertexAttribPointer(SKYU.aCorner, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);

    /* world batches */
    gl.useProgram(pMain);
    setMainUniforms(vp, eye, 1);
    Object.keys(batches).forEach(name => {
      const bch = batches[name];
      gl.bindTexture(gl.TEXTURE_2D, tex[name]);
      gl.bindBuffer(gl.ARRAY_BUFFER, bch.vbo);
      bindMainAttribs();
      gl.drawArrays(gl.TRIANGLES, 0, bch.n);
    });

    /* soldiers */
    const counts = meshActors();
    drawVerts(dynBuf, foeArr, counts.nFoe, 'soldierFoe', vp, eye);
    drawVerts(dynBuf, allyArr, counts.nAlly, 'soldierAlly', vp, eye);

    /* grenades */
    for (const g of nades) {
      const n = partBox(vmArr, 0, g.x, g.y, g.z, g.x * 2, g.y * 3, 0, 0, 0, 0.13, 0.13, 0.13, ATLAS.gun, sunDir, 1);
      drawVerts(dynBuf, vmArr, n / 6, 'soldierAlly', vp, eye);
    }

    /* zone */
    if (cfg.mode === 'br') {
      zoneVertCount = zoneVerts(now);
      drawParts(vp, zoneVertCount, 'zone');
    }

    /* particles + tracers */
    const pn = billboards(right, up);
    drawParts(vp, pn, 'alpha');

    /* first-person weapon always on top */
    gl.clear(gl.DEPTH_BUFFER_BIT);
    const vn = viewModel();
    drawVerts(dynBuf, vmArr, vn, 'soldierAlly', vp, eye);

    drawMini();
  }

  /* ---------- HUD bridge ---------- */
  const HUD = {
    ammo: () => cfg.hud.ammo(player.ammo, cfg.gun.ammo, reserve()),
    hp: () => cfg.hud.hp(Math.max(0, Math.round(player.hp))),
    score: () => cfg.hud.score(cfg.mode === 'br' ? aliveCount() : scoreA, scoreB),
    clock: t => cfg.hud.clock(t),
    alive: () => cfg.hud.alive && cfg.hud.alive(aliveCount(), Math.max(0, zone.next), zone.state,
      Math.hypot(player.x - zone.cx, player.z - zone.cz) > zone.r),
    reloadTxt: s => cfg.hud.reloadTxt(s),
    feed: (a, b, head, z) => cfg.feed(a, b, head, z),
    hitmark: cfg.hitmark,
    hurt: cfg.hurtFlash
  };
  HUD.ammo(); HUD.hp(); HUD.score();

  /* ---------- input state ---------- */
  const IN = { mv: { x: 0, y: 0 }, kx: 0, ky: 0, sprint: false, firing: false };

  /* ---------- main loop ---------- */
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (running) {
      const ix = IN.mv.x + IN.kx, iz = IN.mv.y + IN.ky;
      const moving = Math.abs(ix) > 0.1 || Math.abs(iz) > 0.1;
      const moveSpd = (IN.sprint ? 4.3 : 2.8) * (player.crouch ? 0.55 : 1);
      curVel += (moving ? moveSpd - curVel : -curVel) * Math.min(1, dt * 10);
      const spd = curVel * dt;
      if (moving) {
        const fw = -iz, st = ix;
        const nx = player.x + (Math.cos(player.a) * fw - Math.sin(player.a) * st) * spd;
        const nz = player.z + (Math.sin(player.a) * fw + Math.cos(player.a) * st) * spd;
        if (!blocked(nx, player.z, 0.3)) player.x = nx;
        if (!blocked(player.x, nz, 0.3)) player.z = nz;
        bob += dt * (IN.sprint ? 13 : 8);
        player.animSpd = IN.sprint ? 2 : 1;
        stepAcc += Math.abs(spd);
        if (stepAcc >= (IN.sprint ? 2.5 : 2.1)) { stepAcc = 0; sfx.step(IN.sprint); }
      } else player.animSpd = 0;
      player.animPh += dt * (player.animSpd > 1.5 ? 12 : player.animSpd > 0.3 ? 8 : 1.4);

      if (player.crouch) { player.jz = 0; player.vz = 0; }
      else {
        const wasAir = player.jz > 0.02;
        player.vz -= 9.5 * dt;
        player.jz += player.vz * dt;
        if (player.jz <= 0) { if (wasAir) sfx.land(); player.jz = 0; player.vz = 0; }
      }

      if (IN.firing) fire();
      fireCd -= dt; nadeCd -= dt; meleeCd -= dt;
      env.flashI = Math.max(0, env.flashI - dt * 8);
      recoil += (0 - recoil) * Math.min(1, dt * 14);
      shake = Math.max(0, shake - dt * 1.6);
      fov += (((IN.sprint && moving) ? FOV_BASE * 1.08 : FOV_BASE) - fov) * Math.min(1, dt * 8);
      swayX += (0 - swayX) * Math.min(1, dt * 7);
      swayY += (0 - swayY) * Math.min(1, dt * 7);
      kickX += (0 - kickX) * Math.min(1, dt * 11);
      kickY += (0 - kickY) * Math.min(1, dt * 11);
      kickRot += (0 - kickRot) * Math.min(1, dt * 11);
      reloadAnim = Math.max(0, reloadAnim - dt / 1.5);
      playerVel = curVel;

      player.x3 = player.x; player.z3 = player.z; player.y3 = 0; player.a3 = player.a; player.aimP = player.pitch;

      actors.forEach(e => stepBot(e, dt));
      stepNades(dt);
      stepParts(dt);
      stepZone(dt);

      time -= dt;
      HUD.clock(time);
      if (cfg.mode === 'br') HUD.alive();
      if (time <= 0) { time = 0; endMatch(cfg.mode === 'br' ? aliveCount() <= 1 : scoreA >= scoreB, false); }
    }
    render(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------- public API ---------- */
  return {
    fire, reload,
    jump() { if (!running || player.crouch || player.jz > 0.01) return; player.vz = 2.75; sfx.jump(); },
    setCrouch(on) { player.crouch = !!on; if (on) { player.z = 0; player.vz = 0; } },
    nade() {
      if (nadeCd > 0 || !running) return;
      nadeCd = 8;
      sfx.whoosh();
      nades.push({ x: player.x + Math.cos(player.a) * 0.4, y: 1.5, z: player.z + Math.sin(player.a) * 0.4, vx: Math.cos(player.a) * 8.5, vy: 3.4, vz: Math.sin(player.a) * 8.5, fuse: 2.1, mine: true });
      TVG.toast(TVG.weapon(TVG.state.equipped.grenade).name + ' thrown', 'info');
    },
    melee() {
      if (meleeCd > 0 || !running) return;
      meleeCd = 1.2; sfx.whoosh();
      const mw = TVG.weapon(TVG.state.equipped.melee);
      for (const e of foes()) {
        if (Math.hypot(e.x - player.x, e.z - player.z) < 1.6) {
          e.hp -= mw.dmg; blood(e.x3, 1.1, e.z3);
          if (e.hp <= 0) killActor(e, MYNAME, false);
          break;
        }
      }
    },
    look(dx, dy) {
      player.a += dx;
      player.pitch = clamp(player.pitch - dy, -1.15, 1.15);
    },
    setMove(x, y) { IN.mv.x = x; IN.mv.y = y; },
    setKeys(x, y) { IN.kx = x; IN.ky = y; },
    setSprint(v) { IN.sprint = v; },
    setFiring(v) { IN.firing = v; },
    end(forfeit) { endMatch(false, !!forfeit); },
    pause() { running = false; },
    resume() { if (!ended) { running = true; last = performance.now(); } },
    sfxUnlock: () => sfx.unlock(),
    get state() { return player; },
    renderer: use2D ? '2d-canvas' : 'webgl',
    debug: () => ({ actors, zone, score: [scoreA, scoreB], target: TARGET })
  };
}

w.TVG3D = { createGame, M4, TEXGEN, ATLAS, soldierAtlas, MAP_STYLE };

})(window);
