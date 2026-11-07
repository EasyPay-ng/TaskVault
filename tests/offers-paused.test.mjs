import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const offers = read('offers.html');

test('offers shows an unconditional pause notice, even without JavaScript', () => {
  assert.match(offers, /<h1[^>]*>Offers temporarily unavailable<\/h1>/);
  assert.match(offers, /paused for all users/);
  assert.doesNotMatch(offers, /<script\b|<iframe\b|bitcotasks\.com|onclick\s*=/i);
  assert.doesNotMatch(offers, /startOfferwall|reloadOfferwall|openFullOfferwall/);
});

test('paused offers preserves dashboard and history navigation', () => {
  assert.match(offers, /href="dashboard\.html"/);
  assert.match(offers, /href="offer-history\.html"/);
});

test('dashboard and menu label offers as paused and link to the notice', () => {
  for (const file of ['dashboard.html', 'menu.html']) {
    assert.match(read(file), /<a href="offers\.html"[^>]*>[\s\S]*?Offers \(Paused\)[\s\S]*?<\/a>/);
  }
});
