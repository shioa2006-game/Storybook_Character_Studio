# character-studio リポジトリ整理記録

実施日: 2026-10-12。全体バックアップ取得後の削除・移動・編集の許可に基づく整理です。

## 方針と維持したもの

キャラクターの制作原本、閲覧アプリ、ゲーム用出力ツールを中心に整理しました。`package.json` とREADME上のプロジェクト名は `character-studio` に統一しています。整理後にフォルダを移動したため、現在の作業フォルダは `C:\DevelopmentEnvironment\Storybook_Character_Studio` です。

Inkstoneの `src/` 29ファイルと重装戦士の最終造形は維持しました。ギャラリー・詳細画面・キャラクターを変更できる8×8ダンジョンも維持しています。キャラクターの描画原本は引き続き `characters/warrior/character.js` の1か所です。

## 移動・統合

| 以前 | 現在・役割 |
|---|---|
| `game/verification/game.test.mjs`、`studio/verification/tools.test.mjs` | `tests/node/` に自動テストを集約 |
| ルート `check.html` と対応する検証JS | `tests/browser/warrior.html`、`warrior-checks.js` |
| `studio/verification/` 内の検証HTML | `tests/browser/` に描画・レスポンシブ・負荷検証を集約 |
| 造形比較の基準ソース、エンジンのハッシュ記録 | `tests/fixtures/`。ハッシュ記録のパスは相対パス化 |
| `CHARACTER_STUDIO_REPORT.md` と検証画像・JSON | `docs/reports/` と `assets/studio/` |
| `WARRIOR_EXPERIMENT_REPORT.md`、戦士制作時の比較資料 | `docs/archive/warrior/REPORT.md` と同フォルダ内の資料 |
| `start-demo` に依存していたStudio起動 | `start-studio.bat` と `tools/start-studio.mjs` に統合 |
| 出力先 `exported-game-kit/` | 今後は `exports/game-kit/` を既定に使用 |

48ファイルを移動しました。import、HTMLの参照、Markdownのリンクを移動先に合わせて更新しています。歴史的な報告書の本文にある当時のパスや測定結果は、制作記録として残し、冒頭にその旨を明記しました。

## 削除したもの

- 再生成可能な旧 `exported-game-kit/` 一式（37ファイル）。
- 起動を統合して不要になった `start-demo.bat`、`tools/start-demo.mjs`。
- 戦士制作の途中画像4枚: `initial-sheet.jpg`、`attack-038-initial.jpg`、`attack-055.jpg`、`warrior-attack-windup.jpg`。
- 仮登録確認の画像 `registration-check.jpg`。
- 移動後に空になった旧検証フォルダ。

最終比較画像、測定JSON、比較ページ、報告書は資料として保管しています。今回の動作確認用に再生成したキットも確認後に除去し、必要時に生成する運用にしました。`exports/` はGit管理対象外です。

## 意図して残したファイル

- `game/characters/warrior.js`: 旧importの互換窓口。現行テストや比較資料にも利用されています。描画コードの複製ではありません。
- `characters/catalog.generated.js`: 静的ホスティングで必要な生成済みカタログ。
- 過去の戦士描画ソース: 現在の制作原本ではなく、造形維持テスト・修正前後比較の資料です。

## 検証結果

- Node自動テスト: **20/20成功**。移動・衝突・状態管理、カタログ追加・重複検出、選択エクスポート、依存解決、重装戦士の造形維持を確認しました。
- 追加した保全テストで `src/` **29ファイルのSHA-256が基準と一致**。共通描画ライブラリは変更していません。
- 移動後の戦士ブラウザ検証: **51成功、0失敗**。
- 移動後の全キャラクター描画検証: **PASS**。剣士 Live 320 / Cached 160、弓使い 368 / 184、骸骨 32 / 16、戦士 480 / 240サンプルを確認。空白0、LiveのframeBox外はみ出し0、全キャラクターでdispose後のキャッシュ解放を確認しました。
- 既存サーバー利用中の起動: `node tools/start-studio.mjs` が8081番のStudioを認識して再利用することを確認しました。今回バッチファイルのダブルクリック操作は再実施していません。
- `node tools/export-game.mjs --characters warrior,archer` により新既定パスへ出力。実ブラウザーでキットの読み込み、キャラクター切り替え、Cached表示を確認し、コンソールエラー0でした。今回はStudioの静的サーバーから出力フォルダを開いて確認しています。別ディレクトリでの独立起動は以前のStudio制作報告の検証記録を参照してください。
- ダンジョンと移動後の頭部比較ページの読み込みを実ブラウザーで確認しました。

今回UIの見た目・キャラクター造形は変更していません。視認性・200%ズーム・操作の全組み合わせを新たに主観評価したものではありません。

## 今後の使い方

1. `start-studio.bat` または `npm start` で起動します。
2. `characters/` に制作原本を追加し、`npm run catalog:sync` でカタログへ反映します。
3. ギャラリー、ダンジョン、`tests/browser/` と `npm test` で検証します。
4. 必要なキャラクターを `exports/` へ出力し、ゲーム側へコピーします。出力先を第二の制作原本として編集しません。

現在の手順は [README](../../README.md)、[制作ガイド](../STUDIO_GUIDE.md)、[持ち出しガイド](../EXPORT_GUIDE.md)を参照してください。
