import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateEntries, streakCount, periodIndex } from '../js/engagement-core.mjs';
test('repeated entries add together without mutating entry documents', () => {
 const entries = [{userId:'a',score:10},{userId:'b',score:25},{userId:'a',score:20},{userId:'a',score:0}];
 assert.deepEqual(aggregateEntries(entries).map(e => [e.userId,e.score,e.entryCount]), [['a',30,3],['b',25,1]]);
 assert.equal(entries[0].score,10);
 assert.equal(aggregateEntries([{userId:'a',score:5}])[0].score,5);
});
test('totals are deterministic and reject invalid scores', () => {
 assert.deepEqual(aggregateEntries([{userId:'b',score:NaN},{userId:'a',score:-5}]).map(e => e.userId), ['a','b']);
});
test('daily check-ins deduplicate and reset after a missed day', () => {
 const now = new Date('2026-10-21T12:00:00Z');
 assert.equal(streakCount(['2026-10-20','2026-10-20','2026-10-19'].map(d=>new Date(d)),'daily',now),2);
 assert.equal(streakCount([new Date('2026-10-19')],'daily',now),0);
});
test('weekly periods start Monday, monthly handles year boundaries', () => {
 assert.equal(periodIndex(new Date('2026-10-19'),'weekly'),periodIndex(new Date('2026-10-25'),'weekly'));
 assert.notEqual(periodIndex(new Date('2026-10-18'),'weekly'),periodIndex(new Date('2026-10-19'),'weekly'));
 assert.equal(streakCount([new Date('2025-12-15'),new Date('2026-01-01')],'monthly',new Date('2026-01-20')),2);
});
test('aggregateEntries tolerates missing userId, null entries, and numeric string scores', () => {
 const rows = aggregateEntries([
   null,
   { id: 'orphan-1', score: 0 },
   { userId: 'u1', score: '150' },
   { userId: 'u1', score: 50 },
   { id: 'orphan-2', score: 0 },
 ]);
 assert.equal(rows[0].userId, 'u1');
 assert.equal(rows[0].score, 200);
 assert.equal(rows.length, 3);
});
