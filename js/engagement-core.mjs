// Entry documents remain the source of truth; totals never cross round boundaries.
export function aggregateEntries(entries) {
  const users = new Map();
  for (const entry of entries) {
    const score = Number.isFinite(entry.score) ? Math.max(0, entry.score) : 0;
    const previous = users.get(entry.userId);
    users.set(entry.userId, previous
      ? {...previous, score: previous.score + score, entryCount: previous.entryCount + 1}
      : {...entry, score, entryCount: 1});
  }
  return [...users.values()].sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
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
