import seed from '@/data/bookmarks-seed.json';

type SeedGroup = { name: string; pinned: boolean; subs: { name: string | null; items: { n: string; u: string; note: string }[] }[] };

/** Which starter board each seed group goes on. Groups not listed land on the first board. */
const BOARD_MAP: [string, string[]][] = [
  ['Design', ['Design News & Publications', 'Typography', 'Inspiration Archives', 'Studios & Designers', 'Interviews & Talks', 'Visual Assets & Icons', 'Contests', 'Books & Publishing']],
  ['Making', ['Materials', '3D Assets', 'Rendering', 'Sketching', '3D Modeling', 'Photography & Lighting', 'Manufacturing & Hardware']],
  ['Computational', ['AI & Generative Tools', 'Computational Resources', 'UI Components']],
];

/** The payload for the seed_bookmarks database function. */
export function starterBoards() {
  const boards = BOARD_MAP.map(([name]) => ({ name, groups: [] as SeedGroup[] }));
  for (const g of seed as SeedGroup[]) {
    const i = BOARD_MAP.findIndex(([, names]) => names.includes(g.name));
    boards[Math.max(0, i)].groups.push(g);
  }
  return boards;
}
