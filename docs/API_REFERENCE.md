# Inkstone API リファレンス (v0.1.0)

```js
import { createRenderer, createCharacterView, /* … */ } from './src/index.js';
```

## 1. 公開されているもの (`src/index.js`)

| 名前 | 種類 | 内容 |
|---|---|---|
| `createRenderer(options)` | 関数 | 部屋とキャラクターを描く Renderer を作る (§2) |
| `createCharacterView(options)` | 関数 | キャラクター1体の確認用の描画 (§7) |
| `createCharacterRegistry(defs?)` | 関数 | キャラクター登録簿を作る (§6) |
| `validateCharacter(def)` | 関数 | キャラクター定義を検査する (不足があればエラー) |
| `BUILTIN_CHARACTERS` | 配列 | 組み込みのキャラクター定義 `[swordsman, archer, skeleton]` |
| `swordsman` / `archer` / `skeleton` | 定義 | 組み込みのキャラクター定義 (§5) |
| `ARCHER_ATTACK_KEYS` | 配列 | 弓使いの射撃のコマ割り (20コマ、離れ 0.75 を含む) |
| `frameKeysOf(actionSpec)` | 関数 | 動作のコマ割り (各コマの開始位相) |
| `walkSecondsPerTile(scale)` | 関数 | 1マス歩く間に進めるアニメ時間 (秒)。足を滑らせないため |
| `normalizeRoom(roomData)` | 関数 | 部屋データを内部形式へ (検査を含む。通常は直接使わない) |
| `ROOM_DEFAULTS` | 定数 | 部屋データの既定値 |
| `PROP_TYPES` | 表 | 小物の種類 (描画関数・既定の寸法・高さ・表示名) |
| `DIRECTIONS` / `ACTIONS_LIST` | 定数 | 向き (NW/NE/SW/SE とワールドの軸) / 人型の動作 (idle/walk/attack) |
| `PALETTE` | 定数 | 色 (床の表示の色 `tileAlly` / `tileEnemy` など) |
| `TILE_WIDTH` / `TILE_HEIGHT` / `HEIGHT_UNIT` | 定数 | 1マスの画面上の幅 150px・高さ 84px、高さ1 = 66px |
| `VERSION` | 文字列 | ライブラリの版 |

新しい職業・小物を「描く」ための部品 (線・塗り・リグ・石材など) は `src/authoring.js` にあります (`docs/CHARACTER_GUIDE.md`)。

## 2. Renderer の生成と破棄

```js
const renderer = createRenderer({
  canvas,               // 必須。描画先の <canvas>
  mode: 'cached',       // 'live' (既定) | 'cached'
  width: 1200,          // 論理サイズ (CSS px)。キャンバスの実画素は width × dpr にする
  height: 760,
  dpr: 2,               // 既定: min(2, devicePixelRatio)
  characterScale: 1.25, // キャラの表示倍率 (既定 1.25 = 実験A〜Eの「通常ゲームサイズ」)
  footOffset: 6,        // 足元を下げる描画だけの補正 (ワールド px)
  lineBoil: true,       // 線のゆらぎ (キャラの線を 5fps で描き直す)
  footFix: true,        // 足の接地補正 (滑り防止)
  xray: true,           // 柱などの陰のキャラを半透明で重ねる
  characters: [...],    // 最初に登録するキャラクター定義 (既定: 剣士・弓使い・骸骨)
  room: { ... },        // 最初の部屋 (setRoom と同じ)
});
renderer.dispose();     // キャッシュと背景の画像を解放。以後の呼び出しはエラー
```

- キャンバスの **CSS 上の大きさ** はアプリ側で決めてください (Renderer は実画素の大きさだけを設定します)。
- 1ページに複数の Renderer を作れます。カメラ・シーン・キャッシュ・設定・登録簿はインスタンスごとに独立しています。

## 3. 部屋

```js
renderer.setRoom(roomData);   // 部屋を設定し、カメラを部屋に合わせ (fitToRoom 中なら)、背景と小物を描き直す
renderer.room                 // 内部形式の部屋 (読み取り専用として扱う)
```

### 部屋データ (RoomData)

| キー | 既定値 | 内容 |
|---|---|---|
| `id` | `''` | 石の割り付け・床のひびなどの乱数の種。同じ id なら同じ石組み |
| `width`, `depth` | 6, 6 | 床のマス数 (x 方向, y 方向) |
| `wallHeight` | 3.24 | 壁の高さ (ワールド単位。1 = 66px) |
| `courseHeight` | 0.54 | 石積み1段の高さ |
| `wallThickness`, `rim`, `slab` | 0.6, 0.55, 0.7 | 壁の厚み・手前の縁石の幅・床の厚み |
| `floor` | `{ crack: 0.35, chip: 0.25 }` | 床のマスごとのひび・角の欠けの確率 |
| `doors` | `[]` | `{ wall: 'left' \| 'right', at, halfWidth = 0.64, spring = 1.3, ring = 0.3, depth = 0.3 }` (at = 壁に沿った中心の位置) |
| `torches` | `[]` | `{ wall, at, height = 1.95, glow = 1 }` |
| `objects` | `[]` | 前後関係に参加する小物 `{ type, cell: [i, j], at?: [dx, dy], z?, label?, id?, ...寸法 }` (§3.1) |
| `decor` | `[]` | 背景に焼き込む小物 (キャラの後ろに回らない床の瓦礫など) `{ type, x, y, ...寸法 }` |
| `stairs` | `[]` | `{ wall, a0, a1, len, steps, depth, rise }` 壁へ向かって上る階段 |
| `dais` | `[]` | `{ x0, x1, y0, y1, h }` 壁際の2段の石の台 |
| `breach` | `null` | `{ x0, x1, h }` 手前の縁石の崩れ |

`left` は x = 0 の壁 (左奥)、`right` は y = 0 の壁 (右奥) です。省略可能な名前は実験A〜Eの短い名前 (`W`, `D`, `H` …) でも受け付けます。

#### 3.1 小物 (`PROP_TYPES`)

| type | 既定の寸法 | 内容 |
|---|---|---|
| `column` | `h: 2.4, broken: false` | 石柱 (`broken: true` で上端が折れた柱) |
| `chest` | `at: [0, -0.06], w: 0.82, d: 0.52, h: 0.3, lid: 0.2, z: 0` | 宝箱 (長辺が x 方向) |
| `barrel` | `at: [0, -0.05], r: 0.36, h: 1.0` | 樽 |
| `crate` | `s: 0.62` | 木箱 |
| `stones` | `boxes: [[x0,x1,y0,y1,z0,z1], …]` | 石の山 (マス中心からの相対の箱) |
| `coins` | `n: 14` | 金貨の小山 |
| `rubble` | `s: 0.14` | 瓦礫 (通常は decor に置く) |

位置は `cell` のマス中心 + `at`。`z` を指定すると高台の上などに置けます。追加の方法は `docs/ROOM_GUIDE.md`。

**通れるかどうか** (どのマスを占有するか) は描画エンジンは扱いません。ゲーム側で `objects` の `cell` などから決めてください。

## 4. 描画 (1フレーム)

```js
const info = renderer.render({
  timeSeconds,          // 画面全体の演出の時刻 (秒): 松明の炎など
  units: [Unit, ...],
  projectiles: [Projectile, ...],   // 省略可
  effects: [Effect, ...],           // 省略可
  floorOverlay: (ctx, api) => {},   // 省略可: 背景の直後 (床の上・キャラの下) に描く
  topOverlay: (ctx, api) => {},     // 省略可: 最後に描く
  debug: false,                     // 前後関係のデバッグ表示
});
// info = { totalMs, characterMs, order: [描画順の名前], occluded: [透視表示したユニット], warnings: [] }
```

### Unit

| キー | 必須 | 内容 |
|---|---|---|
| `id` | | 名前 (描画順・透視の一覧に出る) |
| `character` | ✔ | 登録されたキャラクターの id (`'swordsman'` など) |
| `x`, `y` | ✔ | 床の上のワールド座標。マス (i, j) の中心は `(i + 0.5, j + 0.5)`。移動中は連続値 |
| `direction` | ✔ (向きのあるキャラ) | `'NW'` (−x) / `'NE'` (−y) / `'SW'` (+y) / `'SE'` (+x) |
| `action` | | `'idle'` (既定) / `'walk'` / `'attack'`。定義にない動作は idle で描き、`info.warnings` に記録 |
| `actionTime` | | その動作を始めてからの秒数 (既定 0) |
| `mirror` | | 左右反転。骸骨の方向切替には使用せず `direction` を指定する（装備の持ち手を維持） |
| `shakeX` | | 描画だけの横揺れ (ワールド px。被弾の演出など) |
| `xray` | | `false` で透視表示の対象外 (既定 true) |
| `footprint` | | 前後関係用の床上の範囲 `{x0,x1,y0,y1}` (既定: 位置の ±0.28) |

### アニメーション時刻の指定

- 待機・攻撃: `actionTime` = 動作を始めてからの経過秒数。攻撃の長さは定義の `actions.attack.period` (剣士 1.15 秒・弓使い 1.7 秒)。攻撃が終わったら待機へ戻すのはゲームの仕事です。
- 歩行: `actionTime` = **歩いた距離 (マス) × `renderer.walkSecondsPerTile`** にすると、画面上で足が床を滑りません (経過時間で進めると移動速度と足の動きがずれます)。
- 弓使いの矢を放つ瞬間: 攻撃の位相 `archer.actions.attack.releaseAt` (0.75) × 周期。そのときにゲーム側で矢を生成し、以後は `projectiles` として渡します。
- `timeSeconds` はキャラの動作とは独立した「画面の時刻」です (炎の揺れ。ゲームの一時停止中も進めてよい)。

### Projectile (飛んでいる矢)

| キー | 内容 |
|---|---|
| `character` | 放ったキャラの id (矢の形・放つ位置は定義の `projectile` から) |
| `x`, `y` | 放った瞬間の射手の位置 |
| `direction` | 放った向き |
| `distance` | 進んだマス数 (ゲームが時間 × 速さで決める。統合デモは 9 マス/秒) |
| `stuck` | 刺さって止まったか |
| `stuckFor` | 刺さってからの秒数 (刺さった瞬間の衝撃線は 0.18 秒) |
| `embedded` | 刺さる (true, 既定) / 手前へ飛び去る (false) |

### Effect

| type | キー | 内容 |
|---|---|---|
| `hitSpark` | `x`, `y`, `progress` (0〜1) | 当たりの火花 (ユニットの胸のあたり) |

### 描画フックの `api`

`ctx` にはカメラの変換が設定済みです (ワールド px で描けます)。

| 名前 | 内容 |
|---|---|
| `api.highlightTile(i, j, fill, edge)` | マスのハイライト (`PALETTE.tileAlly` / `tileEnemy` など) |
| `api.dashedCell(i, j, color, width)` | マスの点線の枠 |
| `api.dot(x, y, rx, ry, color)` | 床の上の小さな楕円 (経路・射線) |
| `api.marker(x, y, bob, color)` | ユニットの頭上の三角の印 |
| `api.depthDebug()` | 前後関係のデバッグ表示 (topOverlay のみ) |
| `api.cellPoly(i, j, inset)` | マスの四隅のワールド px |
| `api.iso(x, y, z)` | ワールド → ワールド px |
| `api.order`, `api.timeSeconds`, `api.camera`, `api.characterScale`, `api.footOffset`, `api.palette` | 参照用 |

## 5. キャラクター定義 (CharacterDefinition)

```js
{
  id: 'archer', label: '弓使い', kind: 'humanoid',       // kind は説明用 ('humanoid' | 'sprite')
  directional: true,                                     // false = 向きなし (mirror だけ)
  draw(ctx, x, y, direction, action, time, scale, opts), // (x, y) = 足元。opts.shadow === false なら影を描かない
  actions: {
    idle:   { period: 2.856, frames: 16 },               // 等間隔のコマ数
    walk:   { period: 0.714, frames: 10 },
    attack: { period: 1.7, keys: [0, 0.07, …], once: true, releaseAt: 0.75 },   // 不等間隔のコマ割り
  },
  frameBox: { x0: -74, x1: 74, y0: -124, y1: 20 },       // Cached Frames の1コマの範囲 (ローカル px)
  projectile: { type: 'arrow', releaseAt, origin(direction) → { nock: {x, y}, f: [fx, fy] }, draw(ctx, p, d, len, lw), length },
  equipment: { leftHand: 'bow', rightHand: 'string', back: 'quiver' },   // 説明用
}
```

組み込み: `swordsman` (160コマ)・`archer` (184コマ)・`skeleton` (4方向の待機・歩行・攻撃、合計216コマ)。追加の手順は `docs/CHARACTER_GUIDE.md`。

## 6. キャラクター登録

```js
renderer.registerCharacter(def);   // 検査して登録 (同じ id は置き換え。その id のキャッシュは次の描画で作り直す)
renderer.getCharacter('archer');   // 定義 (未登録ならエラー)
renderer.hasCharacter('mage');     // true / false
renderer.listCharacters();         // 登録順の定義の配列 (UI の一覧を作るのに使う)

const registry = createCharacterRegistry([swordsman, archer]);   // 単独の登録簿 (CharacterView で共有できる)
registry.register(def); registry.get(id); registry.list(); registry.has(id); registry.unregister(id);
```

登録簿は Renderer ごとに別々です (一方への登録はもう一方に影響しません)。

## 7. CharacterView (キャラクター1体の確認用)

```js
const view = createCharacterView({ canvas, width: 420, height: 470, scale: 2.9, mode: 'live', lineScale: 0.72, registry });
view.render({ character: 'archer', direction: 'SW', action: 'attack', actionTime: 1.2,
              originX, originY, tile: true, clear: true, clip: { x, y, w, h }, projectile: true });
view.setMode('cached'); view.setScale(1.5); view.setOptions({ lineBoil, footFix, lineScale }); view.resize(w, h, dpr);
view.getDiagnostics(); view.disposeCaches(); view.dispose();
```

`render` は Live のとき定義の `draw` が返す情報 (手・武器の位置など) を返します。`clip` と `clear: true` を組み合わせると、1枚のキャンバスに一覧を並べられます。

## 8. カメラと描画倍率

```js
renderer.fitToRoom({ margin: 26, maxScale: 1.1 });          // 部屋全体が収まるように (setRoom・resize のたびに合わせ直す)
renderer.setCamera({ scale: 1.2, centerX: 3, centerY: 3 }); // 手動: 倍率と、画面中央に来る床上の点
renderer.getCamera();                                       // { scale, tx, ty, dpr, width, height }
renderer.resize(width, height, dpr);                        // 論理サイズと DPR
renderer.worldToScreen(x, y, z = 0);                        // → 論理キャンバス座標 (CSS px)
renderer.screenToWorld(px, py);                             // → 床上の (x, y)
renderer.eventToWorld(mouseEvent);                          // キャンバスの CSS 上の大きさを考慮して床上の (x, y)
renderer.eventToScreen(mouseEvent);                         // → 論理キャンバス座標
renderer.characterScale; renderer.footOffset;               // キャラの当たり範囲を自分で計算するとき用
```

カメラを変えると背景と小物を描き直します (部屋の大きさにより約50〜90ms)。倍率または DPR が変わるとキャラのコマも次の描画で作り直します。

## 9. 方式・設定・キャッシュ

```js
renderer.setMode('live' | 'cached');
renderer.setOptions({ lineBoil, footFix, xray });   // 変えた設定に合わせて、コマは次に使うときに作り直す
renderer.getOptions();
renderer.prepareCaches(ids?);    // コマを今すぐ作る (既定: 登録済み全部)。→ { id: { frames, bytesRGBA, buildMs } }
renderer.disposeCaches(ids?);    // 破棄 (既定: 全部)
```

`prepareCaches` を呼ばずに Cached で描くと、最初に必要になったフレームで同期生成します (その間画面が止まる)。

## 10. 診断情報

```js
renderer.getDiagnostics();
// {
//   mode, options, camera, characterFrameScale,
//   lastFrame: { totalMs, characterMs, order, occluded, warnings },
//   scene: { buildMs, bgBytesRGBA, propBytesRGBA, props },
//   caches: { characters: { id: { frames, bytesRGBA, buildMs, frameW, frameH, k } }, totalFrames, totalBytesRGBA },
//   syncPauses: [{ id, ms, frames, at }],   // キャッシュの同期生成の記録 (直近50件)
//   memoryNote: 'bytesRGBA は幅×高さ×4 の理論値 …',
// }
```

`totalMs` は `render()` の中の CPU 時間です (GPU での塗りの時間は含みません)。
