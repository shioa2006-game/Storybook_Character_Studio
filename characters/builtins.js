import { swordsman, archer, skeleton } from '../src/index.js';

// Metadata only: the drawing definitions remain owned by Inkstone.
export const builtins = [
  { definition: swordsman, studio: { name: '緑フードの若き剣士', category: '剣士', description: 'オリーブ色のフードと茶色の髪、生成りの服。右手の鉄剣と左腕の木の丸盾を携えた若い冒険者。' }, source: 'src/characters/swordsman.js', exportName: 'swordsman', builtin: true },
  { definition: archer, studio: { name: '金髪エルフの弓使い', category: '弓使い', description: '金髪と尖った耳、緑のフードとマントをまとったエルフ。左手の木製弓を構え、右手で矢をつがえて放ちます。' }, source: 'src/characters/archer.js', exportName: 'archer', builtin: true },
  { definition: skeleton, studio: { name: '骸骨の番兵', category: '敵・骸骨', description: '大きな象牙色の頭蓋骨と、右手の傷んだ剣、左腕の木の丸盾。4方向の待機・歩行・右手剣の斬撃に対応。' }, source: 'src/characters/skeleton.js', exportName: 'skeleton', builtin: true },
];
