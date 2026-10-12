# キャラクター制作・登録ガイド

## 単一の追加方法

`characters/<slug>/character.js` を作り、`node tools/sync-catalog.mjs` を実行します。直下のサブフォルダだけを探索します。ブラウザーは探索せず、生成済みの静的ES Moduleを読み込みます。`catalog.generated.js` は手編集しません。

```js
import { rigFrame, renderRig } from '../../src/authoring.js';
// 実際の制作では共通リグ・描画関数を使用し、全動作を実装してください。
function drawCharacter(ctx, x, y, direction, action, time, scale, opts) { /* 制作する描画 */ }
export const character = {
  id: 'your-character', label: '表示名', kind: 'humanoid',
  draw: drawCharacter,
  actions: {
    idle: { period: 3, frames: 20 },
    walk: { period: 1 / 1.4, frames: 16 },
    attack: { period: 1.4, keys: [0, .2, .38, .5, .55, .7, .85, .99], once: true },
  },
  frameBox: { x0: -90, x1: 90, y0: -140, y1: 30 },
};
export const studio = {
  name: '表示名', category: '職業・種類', description: '短い紹介。',
  preview: { direction: 'SE', phase: 0 }, // 任意。待機の代表位相
};
```

この例は登録形式を示す未完成テンプレートです。そのまま完成品として登録しないでください。周期・コマ割り・範囲・描画関数はInkstoneのCharacterDefinitionをそのまま参照し、カタログ用に複製しません。

- `id`: 英小文字から始まる英小文字・数字・ハイフン。一意であること。内蔵IDとの重複もエラーになります。
- `studio.name / category / description`: 必須。描画仕様以外の最小限のメタデータです。
- `studio.preview`: 任意。方向ありの既定はSE、位相0。位相は0以上1未満。
- 方向ありはNW / NE / SW / SEの4方向を実装します。既存キャッシュが4方向を一括生成するため、一部方向だけの定義は登録時に拒否します。
- 方向なしは `directional: false`。`preview.direction` を明示する場合はnull。UIは方向操作を表示しません。動作は `actions` に実装済みのものだけを記載します。
- 骸骨の左右反転はRendererの `unit.mirror` で利用できます。StudioのCharacterViewには未公開なので、架空の4方向やミラー操作を追加していません。
- キャラクター固有の補助モジュールは同じフォルダ、複数キャラ共通の制作部品は `characters/shared/` に置き、相対パスの静的importを使います。依存情報は実際のimportグラフから収集します。
- 全キャラクターから共通の `game/index.html?character=<id>` へ移動できます。専用デモや `studio.demo` の指定は不要です。ダンジョンも同じカタログを参照します。歩行・攻撃は定義にある動作のみを使い、歩行なしの場合は待機姿勢で移動します。

## 標準作業

1. `ARCHITECTURE.md`、`API_REFERENCE.md`、`CHARACTER_GUIDE.md`、関連する実装を読みます。
2. キャラクターを上記の配置・exportsで制作します。原則 `src/` を変更しません。
3. 共通リグ、接地補正、IK、描画層を使い、必要な方向・動作を実装します。
4. `node tools/sync-catalog.mjs`。重複・不足はファイル名付きで修正します。失敗時は既存カタログを置き換えません。
5. ギャラリーを再読込し、カード→詳細→拡大→通常サイズ→方向・動作→全方向一覧を確認します。
6. Live/Cachedを比較し、攻撃の重要な位相、装備の左右、頭身、接地、背面を目視します。
7. `tests/browser/check.html` で全登録キャラクターの `frameBox` を全cache keyと中間位相で確認します。既存戦士の部屋・遮蔽検査は `tests/browser/warrior.html` です。登録時の形式検査だけでは画素のはみ出しを検出しません。
8. 小さいキットをエクスポートし、別フォルダから起動して確認します。
9. 定義・生成カタログ・検証結果を保存します。仮キャラクターは残しません。

ギャラリーは待機の静止画を画面近くで一度だけ描きます。詳細は1体だけを再生します。Cached初回は既存エンジンにより全方向・全動作を同期生成し、一瞬停止します。現在のエンジンは動作単位の部分生成に対応していません。一覧展開は1つのCharacterViewのキャッシュを共有し、セルごとの複製は行いません。戻る・閉じる・Liveへの切替で不要なキャッシュを解放します。

通常サイズは倍率1.25×、DPR1。実際のゲームはカメラのズームにより見た目の大きさが変わるため、最終確認はゲームのRendererでも行ってください。

## 制作AIへの指示テンプレート

> 添付資料を参考に、新しいキャラクター「［名前］」、ID「［id］」を制作してください。今回の制作範囲は［職業・特徴・必要な動作］です。
>
> まずdocs/ARCHITECTURE.md、API_REFERENCE.md、CHARACTER_GUIDE.md、STUDIO_GUIDE.mdと実際の公開APIを確認してください。既存src/と完成済みキャラクターは変更しないでください。
>
> characters/［slug］/character.jsにInkstone CharacterDefinitionをcharacterとしてnamed exportし、studioメタデータを追加してください。共通リグ、接地補正、手描き描画、登録・キャッシュを再利用し、別の描画エンジンは作らないでください。方向ありなら4方向すべて、対応動作のみを実装してください。補助モジュールは静的な相対importにしてください。
>
> node tools/sync-catalog.mjsでカタログを更新し、ギャラリーUIを直接書き換えず追加してください。拡大・通常サイズ、全方向・全動作、Live/Cached、装備の接続、frameBox、重要な攻撃位相を実ブラウザーで確認し、必要な修正を行ってください。
>
> 選択キャラクターをtools/export-game.mjsで持ち出し、独立したフォルダから起動確認してください。技術検証と美術評価は区別し、未確認事項と人間の主観評価の実施有無を報告してください。仮の定義や検証専用キャラクターはカタログに残さないでください。
