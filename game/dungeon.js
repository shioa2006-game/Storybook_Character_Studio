/** The room is data consumed by Inkstone. Collision rules live in game.js. */
export const CHARACTER_SCALE = 1.25;
export const START_CELL = Object.freeze([4, 5]);

export const dungeon = {
  id: 'inkstone-russet-guard-v1',
  name: '赤羽の衛士 — 石造りの間',
  width: 8,
  depth: 8,
  wallHeight: 3.24,
  floor: { crack: 0.28, chip: 0.22 },
  doors: [{ wall: 'left', at: 4.5, halfWidth: 0.74, spring: 1.35 }],
  torches: [
    { wall: 'left', at: 6.8, height: 1.95, glow: 0.9 },
    { wall: 'right', at: 1.45, height: 1.95, glow: 0.9 },
    { wall: 'right', at: 6.55, height: 1.95, glow: 0.9 },
  ],
  objects: [
    { id: 'north-column', type: 'column', cell: [2, 2], h: 2.55, label: '奥の石柱' },
    { id: 'east-column', type: 'column', cell: [5, 3], h: 2.55, label: '右の石柱' },
    { id: 'treasure', type: 'chest', cell: [6, 1], label: '宝箱' },
    { id: 'supplies', type: 'crate', cell: [1, 6], s: 0.7, label: '木箱' },
    { id: 'barrel', type: 'barrel', cell: [1, 5], r: 0.34, label: '樽' },
  ],
  decor: [
    { type: 'rubble', x: 0.3, y: 1.4, s: 0.11 },
    { type: 'rubble', x: 7.6, y: 0.3, s: 0.1 },
  ],
};
