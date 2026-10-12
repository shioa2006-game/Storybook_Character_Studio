import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

// Deliberately narrow authoring contract: local static ESM only. Copy the
// transitive module graph without rewriting paths or introducing a bundler.
export async function moduleFiles(root, entries, allowedCharacterFolders) {
  root=await realpath(root);const files=new Set();
  async function visit(relative) {
    const absolute=await realpath(path.resolve(root,relative));
    const rel=path.relative(root,absolute).split(path.sep).join('/');
    if(rel.startsWith('../')||path.isAbsolute(rel))throw new Error(`依存がリポジトリ外です: ${relative}`);
    if(!rel.startsWith('src/')&&!rel.startsWith('characters/'))throw new Error(`ゲームに持ち出せない依存です: ${rel} (src/ または characters/ に配置してください)`);
    if(rel.startsWith('characters/')&&!allowedCharacterFolders.some(folder=>rel.startsWith(folder+'/'))&&!rel.startsWith('characters/shared/'))throw new Error(`未選択キャラクターへの依存です: ${rel}。共通部品は characters/shared/ へ分離してください`);
    if(files.has(rel))return;files.add(rel);
    if(!/\.(m?js)$/.test(rel))throw new Error(`依存はJavaScript ES Moduleにしてください: ${rel}`);
    const text=await readFile(absolute,'utf8');
    const code=text.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
    if(/\bimport\s*\(/.test(code)||/\brequire\s*\(/.test(code))throw new Error(`${rel}: dynamic import / require は持ち出しに未対応です。静的importを使用してください`);
    const pattern=/(?:^|[;\n])\s*(?:import\s+(?:[\w$*{},\s]+?\s+from\s*)?|export\s+(?:\*\s*(?:as\s+\w+\s*)?|\{[^}]*\}\s*)from\s*)['"]([^'"]+)['"]/g;
    for(const match of code.matchAll(pattern)) {
      const spec=match[1];if(!spec.startsWith('./')&&!spec.startsWith('../'))throw new Error(`${rel}: ローカル相対importのみ対応しています: ${spec}`);
      if(/[?#]/.test(spec))throw new Error(`${rel}: importのクエリやハッシュには未対応です: ${spec}`);
      await visit(path.posix.join(path.posix.dirname(rel),spec));
    }
  }
  for(const entry of entries)await visit(entry);
  return [...files].sort();
}
