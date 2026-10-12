import { catalog, findCharacter } from '../characters/catalog.js';
import { mountGallery } from './gallery.js';
import { mountViewer } from './viewer.js';
const root=document.querySelector('main');let dispose=()=>{};
document.querySelector('.skip-link').addEventListener('click',e=>{e.preventDefault();root.focus();root.scrollIntoView({block:'start'});});
function showError(error){const output=document.querySelector('#app-error');output.hidden=false;output.textContent=`表示できませんでした: ${error.message||error}`;}
function route(){dispose();dispose=()=>{};document.querySelector('#app-error').hidden=true;try{
  const match=location.hash.match(/^#character\/(.+)$/),entry=match?findCharacter(decodeURIComponent(match[1])):null;
  if(match&&!entry)throw new Error('指定されたキャラクターは登録されていません。一覧へ戻って選び直してください。');
  dispose=entry?mountViewer(root,entry):mountGallery(root,catalog);document.title=entry?`${entry.name} | Inkstone Character Studio`:'Inkstone Character Studio';window.scrollTo(0,0);root.focus({preventScroll:true});
}catch(error){root.innerHTML='<a class="button" href="#gallery">キャラクター一覧へ戻る</a>';showError(error);}}
window.addEventListener('hashchange',route);window.addEventListener('error',e=>showError(e.error||e.message));window.addEventListener('unhandledrejection',e=>showError(e.reason));window.addEventListener('pagehide',e=>{if(!e.persisted)dispose();});route();
