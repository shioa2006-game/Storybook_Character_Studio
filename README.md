# character-studio

Inkstone Character Studio — 手描きCanvas 2Dのキャラクターを制作・蓄積・確認し、ゲーム用コードとして持ち出す工房です。外部画像・外部ライブラリ・クラウドサービスは不要です。

## 起動する

Node.js 18以上。パッケージのインストールは不要です。

- Windows: **`start-studio.bat`** をダブルクリック。カタログを更新し、ローカルサーバーとブラウザーを起動します。
- ターミナル: **`npm start`** → 表示されたURLを開きます（通常は <http://127.0.0.1:8081/>）。終了はCtrl+C。
- 配信元フォルダが一致するStudioだけを再利用します。旧版や別フォルダのサーバーが使用中のポートは避け、8081〜8090の空きポートで起動します。`start-studio.bat` は選ばれたURLを自動で開きます。

トップページはキャラクターギャラリーです。詳細画面で方向・動作・再生・位相・拡大/通常サイズ・Live/Cachedを確認します。「ダンジョンで見る」から選択したキャラクターを8×8の部屋で操作できます。

骸骨は4方向（NW / NE / SW / SE）の待機・歩行・右手剣による攻撃に対応。ダンジョンでは移動中に歩行し、Spaceまたは攻撃ボタンで1.2秒の斬撃を再生します。通常サイズは倍率1.25×で、部屋を縮小するカメラ倍率とは別です。

## キャラクターを追加する

1. `characters/<slug>/character.js` にInkstone定義 `character` と表示情報 `studio` をnamed exportします。
2. `node tools/sync-catalog.mjs` を実行します。
3. ギャラリー・ダンジョン・描画検証ページで確認します。
4. 定義と `characters/catalog.generated.js` を一緒に保存します。

UIコードを編集する必要はありません。[制作手順とAIへの指示テンプレート](docs/STUDIO_GUIDE.md)を参照してください。

人間型は「灰燼の衛士」を基準に約2.2頭身で制作します。羽飾り・武器・影を除く寸法と比較方法は制作ガイドに記載しています。

## ゲーム用コードを出力する

```sh
node tools/export-game.mjs --characters warrior,archer
```

**`exports/game-kit/`** に共通 `src/`、選択した追加キャラクター、登録コード、起動サンプル、説明書を生成します。既存出力は上書きしません。別の出力には `--out ./exports/my-game` を指定します。出力フォルダは保守用の原本ではなく、その時点のコピーです。

```sh
cd exports/game-kit
node tools/serve.mjs 8091
```

<http://127.0.0.1:8091/> を開きます。キットは元のStudioに依存しません。[持ち出しガイド](docs/EXPORT_GUIDE.md)を参照してください。

## フォルダの役割

| 場所 | 内容 |
|---|---|
| `src/` | Inkstoneの共通描画ライブラリ。原則変更しない |
| `characters/` | 追加キャラクターの原本と共通カタログ |
| `studio/` | ギャラリーと詳細画面 |
| `game/` | カタログ共通の8×8ダンジョン、入力・経路探索 |
| `tools/` | 起動、静的サーバー、登録情報生成、ゲーム用出力 |
| `tests/node/` | ゲーム・登録・エクスポートの自動テスト |
| `tests/browser/` | 実ブラウザーで実行する描画・遮蔽・レイアウト検証 |
| `tests/fixtures/` | 造形維持テストの比較資料、エンジンのハッシュ基準 |
| `docs/` | 現在のAPI・制作・出力ガイド |
| `docs/reports/` | Studio制作報告と画像・測定記録 |
| `docs/archive/` | 過去の戦士制作実験。通常のアプリから読み込まない |
| `exports/` | 必要時に生成するゲーム用キット。Git管理対象外 |

`game/characters/warrior.js` は旧importを維持する互換窓口です。描画ソースは `characters/warrior/character.js` の1つだけを編集します。`catalog.generated.js` は静的配信にも必要なので削除しません。

## 検証する

```sh
npm test
npm run catalog:check
```

サーバー起動後、次のページで検証できます。

- [全キャラクターの描画範囲とLive/Cached](tests/browser/check.html)
- [戦士の装備・関節・部屋の遮蔽](tests/browser/warrior.html)
- [画面幅・拡大相当の再配置](tests/browser/responsive.html)
- [40カード時の遅延描画](tests/browser/performance.html)

[Studio制作・検証報告](docs/reports/CHARACTER_STUDIO_REPORT.md) / [リポジトリ整理記録](docs/reports/REPOSITORY_CLEANUP.md) / [過去の戦士制作実験](docs/archive/warrior/REPORT.md)

## 静的配信と保守

相対URLとハッシュルーティングを使用します。静的配信時は生成済みカタログを含めてください。日常のアプリには `index.html`、`src/`、`characters/`、`studio/`、`game/` と参照するガイドが必要です。テスト・過去資料・ゲーム用キットを配信する必要はありません。

制作コードの原本に出力先のファイルを逆コピーしないでください。共通ライブラリを意図して更新するときは全体を同じ版にそろえ、テストと `tests/fixtures/src-baseline.json` の基準を確認してください。
