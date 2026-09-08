const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../assets/engine3d.js'), 'utf8');

// Execute the palette declaration and tint assignments in their source order.
// This reproduces the original TDZ without needing a browser/WebGL context.
const initialization = source.match(
  /const SOLDIER_COL = \{[\s\S]*?\n  \};|SOLDIER_COL\.(?:shirtB_ally|helmetB_ally) = [^;]+;/g
);

for (const hue of [210, 8, 120]) {
  test(`soldier palette initializes before applying ally hue ${hue}`, () => {
    assert.equal(initialization.length, 3);
    const calls = [];
    const palette = vm.runInNewContext(
      initialization.join('\n') + '\nSOLDIER_COL;',
      {
        allyHue: hue,
        hsl2rgb: (...args) => { calls.push(args); return args; }
      }
    );
    assert.deepEqual(calls, [[hue, 34, 32], [hue, 30, 24]]);
    assert.deepEqual(palette.shirtB_ally, [hue, 34, 32]);
    assert.deepEqual(palette.helmetB_ally, [hue, 30, 24]);
    assert.deepEqual(Array.from(palette.shirtB_foe), [138, 74, 60]);
    assert.deepEqual(Array.from(palette.helmetB_foe), [125, 59, 48]);
  });
}
