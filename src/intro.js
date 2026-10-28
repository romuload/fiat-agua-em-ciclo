(()=>{
const root=document.documentElement,overlay=document.getElementById('fiat-intro'),main=document.querySelector('main');
if(!overlay)return;
let finished=false;
main.inert=true;main.setAttribute('aria-hidden','true');
function reveal(early=false){if(finished)return;finished=true;root.classList.remove('fi-intro-pending');main.inert=false;main.removeAttribute('aria-hidden');overlay.setAttribute('aria-hidden','true');overlay.inert=true;if(early)overlay.classList.add('is-leaving');window.setTimeout(()=>overlay.remove(),650);document.removeEventListener('keydown',escapeIntro);window.setTimeout(()=>{window.__fiatIntroReady=true;window.dispatchEvent(new CustomEvent('fiat:intro-complete'));},early?400:200);}
function escapeIntro(e){if(e.key==='Escape'){e.preventDefault();reveal(true)}}
document.getElementById('fiat-intro-skip').addEventListener('click',()=>reveal(true));document.addEventListener('keydown',escapeIntro);
const elapsed=performance.now()-(window.__fiatIntroStarted||performance.now());window.setTimeout(()=>reveal(false),Math.max(0,2850-elapsed));
window.setTimeout(()=>{if(!finished)reveal(true)},4200);
window.fiatIntro={skip:()=>reveal(true),get finished(){return finished}};
})();
