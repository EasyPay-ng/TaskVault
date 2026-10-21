import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const PAGES = [
  'game3.html',
  'game-lobby3.html',
  'game-history3.html',
  'game-lobby.html',
  'game-lobby2.html',
  'admin-game.html',
  'games.html',
  'game2.html',
  'game.html',
];

test('all game and lobby HTML pages have valid inline script syntax', () => {
  for (const file of PAGES) {
    const html = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    let idx = 0;
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const attrs = match[1] || '';
      const src = match[2] || '';
      if (!src.trim()) continue;
      if (/\btype\s*=\s*["']module["']/i.test(attrs)) {
        // Transform static imports to dummy declarations for syntax check in pure Node VM without --experimental-vm-modules
        const stripped = src.replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?/gm, '');
        new vm.Script(stripped, { filename: `${file}#module-${idx++}` });
      } else {
        new vm.Script(src, { filename: `${file}#script-${idx++}` });
      }
    }
  }
});

test('game3.html mobile touch-action allows overlay & boost shop vertical scrolling', () => {
  const html = fs.readFileSync(new URL('../game3.html', import.meta.url), 'utf8');
  const htmlBodyRule = html.match(/html,body\{[^}]+\}/);
  assert.ok(htmlBodyRule, 'expected html,body CSS rule');
  assert.ok(!htmlBodyRule[0].includes('touch-action:none'), 'html,body must not block child scrolling with touch-action:none');

  const canvasRule = html.match(/canvas#gl\{[^}]+\}/);
  assert.ok(canvasRule && canvasRule[0].includes('touch-action:none'), 'canvas#gl should capture gameplay touches');

  const ovRule = html.match(/\.ov\{[^}]+\}/);
  assert.ok(ovRule && ovRule[0].includes('touch-action:pan-y'), '.ov overlay must allow vertical touch scrolling');

  assert.ok(!html.includes("if(isTouch) $('sandboxWarn').classList.remove('hidden')"), 'touch devices must not be falsely shown sandbox mode warning');
});

test('game3.html audioInit handles exhausted AudioContext slots without aborting startRun', () => {
  const html = fs.readFileSync(new URL('../game3.html', import.meta.url), 'utf8');
  const audioFnMatch = html.match(/const A=\{[\s\S]*?function audioInit\(\)\{[\s\S]*?\n\}/);
  assert.ok(audioFnMatch, 'expected audioInit function');
  const ctx = {
    window: {
      AudioContext: function BrokenAudioContext() {
        throw new Error('DOMException: The number of hardware contexts provided (6) is greater than or equal to the maximum bound (6).');
      },
    },
  };
  const result = vm.runInNewContext(`${audioFnMatch[0]}; audioInit(); A.ctx;`, ctx);
  assert.equal(result, null);
});
