# ゲームへの持ち出し

## 出力する

```sh
node tools/sync-catalog.mjs
node tools/export-game.mjs --characters warrior,archer
# 別の出力先
node tools/export-game.mjs --characters warrior --out ./exports/warrior-v2
```

IDは `swordsman`、`archer`、`skeleton`、`warrior`。将来追加したIDも自動的に使えます。指定がない場合・未知ID・重複IDは理由付きエラーになります。エクスポートは最新の定義を発見・検査してから行います。出力先が既に存在する場合は上書きしません。別の新規フォルダを指定してください。

```text
exports/game-kit/
  src/                     共通ライブラリ一式
  characters/
    warrior/character.js   選択した追加キャラクター
    shared/...             実際にimportされる共有部品（ある場合）
    register.js            選択した定義の配列と登録関数
  index.html / main.js      独立したRendererの部屋サンプル
  tools/serve.mjs           既存と同じ静的サーバー
  package.json
  export-manifest.json      選択IDと追加依存ファイル
  USE_IN_GAME.md
```

キットを別フォルダ・別リポジトリへコピーし、次を実行します。

```sh
cd exports/game-kit
node tools/serve.mjs 8091
```

<http://127.0.0.1:8091/> でキャラクター・向き・動作・Live/Cachedを確認します。元のStudioを起動する必要はありません。StudioのUI、過去の画像や検証ファイルは含まれません。

## 既存ゲームへ組み込む

`src/` と `characters/` の相対位置を保ってコピーします。他のアセットと衝突する場合は、両方を `vendor/inkstone/` など同じ親フォルダに入れてください。

```js
import { createRenderer } from './src/index.js';
import { characters, registerCharacters } from './characters/register.js';

const renderer = createRenderer({
  canvas: document.querySelector('canvas'),
  width: 1000, height: 620, dpr: 1,
  characters: [], mode: 'live',
  room: { id: 'my-room', width: 6, depth: 6 },
});
registerCharacters(renderer);
renderer.fitToRoom({ margin: 24 });
renderer.render({ timeSeconds: 0, units: [{
  id: 'player', character: characters[0].id,
  x: 3.5, y: 3.5, direction: 'SW', action: 'idle', actionTime: 0,
}] });

renderer.setMode('cached');
renderer.prepareCaches([characters[0].id]); // 初回同期生成を任意のタイミングで
// ゲームループでactionTimeを更新してrenderを繰り返す
// 歩行のactionTime = 移動距離 × renderer.walkSecondsPerTile
// 終了時: renderer.dispose();
```

経路探索、入力、当たり判定、攻撃終了後の状態管理はゲーム側の担当です。骸骨は4方向の待機・歩行・攻撃に対応します。攻撃は1.2秒です。剣・盾の持ち手を保つため `direction` を指定し、`unit.mirror` は使いません。

## 依存の扱い

- 共通 `src/` は全体を未改変でコピーします。公開indexと登録モジュールが内蔵3体を静的importするため、未選択の内蔵キャラのソースも含まれます。ただし登録する配列には選択したIDだけが入ります。
- 追加キャラは選択した `character.js` と、その静的相対import / re-exportの推移的な依存だけをコピーします。importパスは書き換えず、同じフォルダ構造を保存します。
- 選択していない追加キャラへの依存はエラー。再利用部品は `characters/shared/` に分離します。
- ブラウザー用JavaScript ES Modulesの相対パスと明示的な拡張子を使用してください。解析は意図的に小さな制作規約に限定しています。動的import、require、npmのbare import、外部URL、query付きimport、コード外の画像・fetch依存は今回の持ち出し対象外です。画像等を使う機能は追加していません。
- 登録スクリプトは信頼済みのローカル定義をNode.jsでimportします。ブラウザーAPIの呼び出しはdraw関数内に置き、トップレベルでdocumentを参照しないでください。

## 更新時

出力はスナップショットです。Studio側のキャラクター変更はコピー先へ自動反映されません。再エクスポートし、ゲーム側の変更と比較して導入してください。エクスポート先を第二のキャラクター制作原本にしないでください。

ライブラリ更新時は `src/` の版を揃え、単一ファイルだけを混ぜないでください。登録API、造形、方向・動作、コマ割り、frameBox、通常サイズ、奥行き・遮蔽を再検証します。コピー先のimport・環境差を確認するまで更新完了と判断しないでください。
