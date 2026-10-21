// Entry documents remain the source of truth; totals never cross round boundaries.
export function aggregateEntries(entries) {
  const users = new Map();
  for (const entry of entries || []) {
    if (!entry) continue;
    const key = String(entry.userId ?? entry.id ?? '');
    if (!key) continue;
    const raw = typeof entry.score === 'string' && entry.score.trim() !== '' ? Number(entry.score) : entry.score;
    const score = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    const previous = users.get(key);
    users.set(key, previous
      ? {...previous, score: previous.score + score, entryCount: previous.entryCount + 1}
      : {...entry, userId: entry.userId ?? key, score, entryCount: 1});
  }
  return [...users.values()].sort((a, b) => b.score - a.score || String(a.userId || '').localeCompare(String(b.userId || '')));
}
export function periodIndex(date, type) {
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
  return type === 'daily' ? day : type === 'weekly' ? Math.floor((day + 3) / 7) : date.getUTCFullYear() * 12 + date.getUTCMonth();
}
export function streakCount(dates, type, now = new Date()) {
  const periods = new Set(dates.map(d => periodIndex(d, type)));
  let cursor = periodIndex(now, type);
  if (!periods.has(cursor)) cursor--;
  let count = 0;
  while (periods.has(cursor--)) count++;
  return count;
}
