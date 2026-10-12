import { swordsman, archer, skeleton } from '../src/index.js';

// Metadata only: the drawing definitions remain owned by Inkstone.
export const builtins = [
  { definition: swordsman, studio: { name: '緑フードの剣士', category: '剣士', description: '緑のフードと剣、木の盾。軽やかな足取りでダンジョンを探索する冒険者。' }, source: 'src/characters/swordsman.js', exportName: 'swordsman', builtin: true },
  { definition: archer, studio: { name: '弓使い', category: '弓使い', description: '弓と矢筒を携えた射手。構えから矢を放つ瞬間まで、繊細な動きを観察できます。' }, source: 'src/characters/archer.js', exportName: 'archer', builtin: true },
  { definition: skeleton, studio: { name: '骸骨の番兵', category: '敵・骸骨', description: '丸盾と小さな剣を持つ番兵。方向を持たない一枚絵型で、待機の動きに対応。' }, source: 'src/characters/skeleton.js', exportName: 'skeleton', builtin: true },
];
