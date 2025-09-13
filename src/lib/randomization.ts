import seedrandom from "seedrandom";

export function shuffle<T>(arr: T[], seed: string): T[] {
  const rng = seedrandom(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
