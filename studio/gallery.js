import { createCharacterView } from '../src/index.js';
export function mountGallery(root, catalog) {
  root.innerHTML = `<section class="intro"><div><h1>キャラクターギャラリー</h1><p>手描きの仲間たちを、じっくり眺める。<br>気になるキャラクターを選んで、向きや動きを確かめましょう。</p></div><span class="count">${catalog.length} 体のキャラクター</span></section><div class="gallery"></div><details><summary>制作・再利用について</summary><p>新しい仲間はコードから制作し、カタログへ登録します。ゲームへは必要なキャラクターと描画ライブラリを持ち出せます。</p><div class="dev-links"><a href="./docs/STUDIO_GUIDE.md">キャラクターを追加する</a><a href="./docs/EXPORT_GUIDE.md">ゲームへ持ち出す</a></div><p class="small" id="gallery-metrics"></p></details>`;
  const grid = root.querySelector('.gallery');let rendered = 0, drawMs = 0;
  const observer = new IntersectionObserver(entries => {
    for (const target of entries) {
      if (!target.isIntersecting) continue;
      const canvas = target.target, entry = catalog[Number(canvas.dataset.index)], box = entry.definition.frameBox;
      const scale = Math.min(2.05, 300/(box.x1-box.x0), 276/(box.y1-box.y0)), start = performance.now();
      const view = createCharacterView({canvas,width:360,height:310,dpr:1,scale,characters:[entry.definition],lineBoil:false,footFix:true,lineScale:.85});
      view.render({character:entry.id,direction:entry.preview.direction || 'SE',action:'idle',actionTime:entry.preview.phase*entry.definition.actions.idle.period,originX:180-(box.x0+box.x1)*scale/2,originY:155-(box.y0+box.y1)*scale/2,tile:false,background:'#ece8dd',projectile:false});
      view.dispose();drawMs+=performance.now()-start;rendered++;observer.unobserve(canvas);
      root.querySelector('#gallery-metrics').textContent=`表示済み ${rendered} / ${catalog.length} 体・描画計 ${drawMs.toFixed(1)} ms。静止画のみ。アニメーションキャッシュ 0 枚。`;
    }
  },{rootMargin:'120px'});
  catalog.forEach((entry,i)=>{
    const card=document.createElement('a');card.className='character-card';card.href=`#character/${encodeURIComponent(entry.id)}`;
    const art=document.createElement('div');art.className='card-art';const canvas=document.createElement('canvas');canvas.dataset.index=i;canvas.setAttribute('aria-label',`${entry.name}の待機姿`);art.append(canvas);
    const body=document.createElement('div');body.className='card-body';const category=document.createElement('p');category.className='category';category.textContent=entry.category;const title=document.createElement('h2');title.textContent=entry.name;const description=document.createElement('p');description.textContent=entry.description;const more=document.createElement('span');more.className='card-link';more.textContent='詳しく見る →';body.append(category,title,description,more);card.append(art,body);grid.append(card);observer.observe(canvas);
  });
  return ()=>{observer.disconnect();grid.querySelectorAll('canvas').forEach(c=>{c.width=0;c.height=0;});};
}
