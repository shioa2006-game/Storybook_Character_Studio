# Inkstone アーキテクチャ

## 1. モジュール構成

```
src/
├─ index.js              ゲーム向けの公開 API (createRenderer など)。新しいゲームはここだけを import する
├─ authoring.js          制作者向けの描画部品 (新しい職業・小物を描くときに import する)
├─ core/                 描画の基本技術 (ゲームにもダンジョンにも依存しない)
│  ├─ random.js            シード付き乱数 (mulberry32)。状態の保存・復元
│  ├─ settings.js          描画設定 DRAW (線幅・線のゆらぎ・足の接地補正) と isolateDrawing
│  ├─ geometry.js          アイソメ投影 iso / ベクトル / 楕円・凸包などの幾何
│  ├─ palette.js           色 PAL
│  ├─ ink.js               手描き表現: 揺らぎ線・角丸・塗り・二度描き・点描・ハッチング・紙・ひび
│  └─ paint.js             色の濃淡の塗り paint (同色の濃い陰 + 点描 + 輪郭)・線の太さの階層 LW・先細りの形
├─ dungeon/              部屋と建築物
│  ├─ stone.js             石ブロック・石の積み方・壁から浮き出た石・石の円柱・接地影
│  ├─ architecture.js      壁・床・縁石・アーチ扉・階段・高台・崩れ・松明 (光・金具・炎)・外枠
│  ├─ props.js             宝箱・木箱・樽・石柱・石の山・金貨・瓦礫、占有範囲、小物の種類の表 PROP_TYPES
│  └─ room.js              部屋データの正規化 (normalizeRoom)、背景の描画、前後関係に参加する物体の一覧
├─ characters/           キャラクター
│  ├─ rig.js               共通人体リグ: 4方向の体の座標・rigFrame・walkFeet・ik2・bodyLayerKey・renderRig・接地補正
│  ├─ painting.js          人物の立体部品: ミトン形の手・太さのある脚とブーツ
│  ├─ swordsman.js         剣士 (姿勢・顔・フード・剣・盾・組み立て・定義)
│  ├─ archer-pose.js       弓使いの姿勢・弓と弦の幾何・矢の形
│  ├─ archer-parts.js      弓使いの部品 (髪・顔・胴着・ケープ・矢筒・弓)
│  ├─ archer.js            弓使いの組み立て (描画順の補正) と定義
│  ├─ skeleton.js          骸骨 (専用骨格寸法・共通投影による4方向の待機・歩行・攻撃) と定義
│  └─ registry.js          キャラクター登録簿 (検査・登録・取得)・コマ割り
└─ rendering/            描画とキャッシュ
   ├─ camera.js            カメラ (倍率・平行移動・DPR)・部屋に合わせる・座標変換
   ├─ sprites.js           オフスクリーンのスプライト (デバイス画素に揃える)・キャラのコマ
   ├─ depth-sort.js        床上の占有範囲による前後関係の位相ソート
   ├─ scene.js             静的なシーン (背景1枚 + 小物スプライト) の生成と破棄
   ├─ cache.js             Cached Frames のコマのストア (共有・作り直し・破棄・統計)
   ├─ effects.js           足元の影・飛んでいる矢・当たりの火花
   ├─ overlays.js          床の表示 (ハイライト・点線・点・選択の印・前後関係のデバッグ)・プレビューのタイル
   ├─ renderer.js          Renderer (部屋とキャラクターの描画。ゲーム画面用)
   └─ character-view.js    CharacterView (1体の確認用の描画)
```

ゲームの規則 (経路探索・占有・攻撃判定・射線・矢の当たり・ターン・入力の解釈) は `src/` にはありません。
統合デモでは `examples/js/integration/game.js` にあります。

## 2. 依存関係

矢印は「import する側 → される側」。循環はありません。

```
index.js ──► rendering/renderer.js, rendering/character-view.js, characters/registry.js, dungeon/room.js, dungeon/props.js
rendering/renderer.js ──► camera, depth-sort, cache, scene, effects, overlays, characters/registry, characters/rig, dungeon/room, dungeon/architecture, core/*
rendering/cache.js ──► sprites, effects, characters/registry, characters/rig
rendering/scene.js ──► camera, sprites, dungeon/room, core/ink
characters/registry.js ──► swordsman, archer, skeleton
characters/{swordsman, archer*, skeleton}.js ──► characters/rig, characters/painting, core/*
dungeon/{room, props, architecture}.js ──► dungeon/stone, core/*
core/{ink, paint}.js ──► core/random, core/geometry, core/palette, core/settings
```

`core/` は何にも依存しない層、`dungeon/` と `characters/` は `core/` だけに依存する層、`rendering/` はその上の層です。

## 3. 描画の流れ (1フレーム)

`renderer.render(frame)` の中で、次の順に描きます (実験C〜Eのダンジョン画面と同じ順序・同じ計算)。

1. 描画設定 (線幅・ゆらぎ・接地補正) と乱数状態を、この Renderer のものに切り替える
2. 背景 (静的なシーン) を貼る
3. `floorOverlay` フック (ゲームが床の表示を描く。マスのハイライト・射線・経路など)
4. 全ユニットの足元の影
5. 松明の炎 (`timeSeconds` で揺れる)
6. 前後関係ソート (小物・ユニット・飛んでいる矢を、床上の占有範囲で並べる) の順に描く
7. 透視表示: 小物の陰に隠れたユニットを半透明で重ねる
8. エフェクト (当たりの火花)
9. `topOverlay` フック (選択の印など)、デバッグ表示
10. 描画設定と乱数状態を元に戻す

## 4. ワールド座標と画面座標

```
ワールド (x, y, z)      床のマス (i, j) は x ∈ [i, i+1), y ∈ [j, j+1)。z は高さ (1 = 66px)
   │ iso()            x は画面の右下へ、y は左下へ。1マス = 画面上 150 × 84 px
ワールド px
   │ カメラ (s, tx, ty)  論理 = (tx, ty) + s × ワールド px
論理座標 (CSS px)        キャンバスの見た目の大きさ (既定 1200 × 760)
   │ × dpr
デバイス座標 (実画素)
```

- ユニットの論理位置 (x, y) はゲームが決めます。描画だけの補正 (足元を 6px 下げる `footOffset`・キャラの倍率 `characterScale`) は Renderer の設定で、論理位置は変えません。
- `renderer.worldToScreen(x, y, z)` / `screenToWorld(px, py)` / `eventToWorld(event)` で変換します。

## 5. 静的な描画と動的な描画

| 種類 | 何を | いつ描くか |
|---|---|---|
| 背景 (1枚) | 紙・壁・扉・松明の金具と光・床・縁石・崩れ・床の瓦礫・外枠 | 部屋・カメラ・キャンバスの大きさ・DPR が変わったとき |
| 小物スプライト | 石柱・宝箱・樽・木箱・高台・階段など (1つずつ) | 同上 (毎フレーム前後関係ソートに参加して貼る) |
| 動的 | キャラ・影・炎・矢・火花・床の表示 | 毎フレーム |

キャラが後ろへ回り込めない部分だけを背景に焼き込み、回り込める物体はスプライトにして毎フレーム並べ替えます。

## 6. Live Vector と Cached Frames

| | Live Vector | Cached Frames |
|---|---|---|
| キャラの描き方 | 毎フレーム、ベクターで描く | あらかじめ作ったコマ画像を貼る |
| 時刻 | 連続 (どの瞬間も描ける) | コマ割り (待機16・歩行10・攻撃14 / 射撃20 コマ) の最も近い前のコマ |
| CPU 時間 (12体) | 剣士 約5.5ms・弓使い 約7ms (実験Eの計測) | 約0.1ms |
| 生成の手間 | なし | 職業ごとに 0.07〜0.16 秒の同期処理 (初回のみ) |

**Cached Frames は描画結果を保持するだけで、姿勢を決めません。** どのコマを貼るかは、定義の動作 (周期・コマ割り) とゲームから渡された `actionTime` だけで決まります。

## 7. キャッシュの生成・共有・破棄

- **ストアは Renderer ごとに1つ** (`rendering/cache.js`)。同じ Renderer の中では、**同じ職業のユニットは何体でも1組のコマを共有** します (弓使い12体でも184コマ)。
- コマは次のものに依存し、どれかが変わると次に使うときにその職業のコマを作り直します (古いコマは解放)。
  - 倍率 k = キャラの倍率 × カメラ倍率 × DPR (`setCamera` / `fitToRoom` / `resize` で変わる)
  - 描画設定 (線幅・線のゆらぎ・足の接地補正。`setOptions`)
  - キャラクター定義そのもの (`registerCharacter` で同じ id を置き換えたとき)
- 生成は同期処理で、その間は画面が止まります。`renderer.prepareCaches()` を読み込み中に呼ぶと、ゲーム中の停止を避けられます。生成時間は `getDiagnostics().syncPauses` に記録されます。
- `disposeCaches(ids)` で破棄、`dispose()` で Renderer ごと破棄します。
- 容量の `bytesRGBA` は幅 × 高さ × 4 の **理論値** です。ブラウザが実際に使うメモリ (GPU 側の複製・管理領域) とは異なります (実測は報告書を参照)。

## 8. 状態の分離 (複数の Renderer・ほかのコードとの共存)

- カメラ・シーン・キャッシュ・描画設定・キャラクター登録簿・透視用の作業キャンバスは **Renderer インスタンスの中** にあります。
- 描画関数が読む共有の値は2つだけです: 描画設定 `DRAW` (core/settings.js) と乱数の状態 (core/random.js)。
  Renderer / CharacterView は描画の入口で自分の値を書き込み、終わったら元に戻します (`isolateDrawing`)。JavaScript の描画は同期処理なので、途中で別の Renderer が割り込むことはありません。
- 乱数はライブラリ内部のもので、`Math.random` やゲーム側の乱数には触れません。
- ライブラリは `window` に名前を追加しません (テスト `tests/new_game/` で確認)。

## 9. ゲーム側との責務分担

| 描画エンジン (src/) | ゲーム (例: examples/js/integration/) |
|---|---|
| 投影・カメラ・倍率・DPR | どのマスに誰がいるか・移動の経路 (BFS)・移動の可否 |
| 部屋・小物・キャラ・影・炎・矢・火花の絵 | ターン・攻撃できるか・射程・射線・命中・HP・ダメージ |
| 前後関係・透視表示 | 敵の AI・勝敗・進行状態 |
| Live / Cached の切り替え、キャッシュの生成・破棄 | 入力の解釈 (クリック → 移動 / 攻撃) |
| 床の表示の道具 (ハイライト・点線・点・印) | 床の表示の内容 (どのマスに何を出すか) |
| 歩行のアニメ時間の換算 (`walkSecondsPerTile`) | 歩いた距離・動作の開始時刻 (`actionTime` を作る) |
| 矢の絵 (どこまで飛んだかを受け取って描く) | 矢がどこまで飛ぶか・いつ刺さるか・何に当たるか |

ゲームは毎フレーム「誰がどこで何をしているか」(units)・「矢がどこまで飛んだか」(projectiles)・「演出をどこまで再生したか」(effects) を渡すだけです。
