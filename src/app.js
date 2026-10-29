import {createEngine,NAMES} from './scene3d.js';
const NARRATION_META={"duration":67.81560090702948,"chapters":[{"start":0,"duration":16.040907029478458,"end":16.040907029478458},{"start":16.040907029478458,"duration":12.773877551020409,"end":28.814784580498866},{"start":28.814784580498866,"duration":14.236734693877551,"end":43.05151927437642},{"start":43.05151927437642,"duration":15.281632653061225,"end":58.33315192743764},{"start":58.33315192743764,"duration":9.482448979591837,"end":67.81560090702948}]};
const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],clamp=x=>Math.max(0,Math.min(1,x));
const stages=[["Fábrica e tratamento","Da fábrica ao tratamento.","Depois de utilizada na produção, a água segue para tratamento. Na etapa química, as impurezas se agrupam e se depositam no fundo do tanque. No tratamento biológico, microrganismos ajudam a decompor a matéria orgânica, com o oxigênio fornecido pela aeração."],["Purificação","Cada etapa prepara um novo destino.","Ao longo do tratamento, a água perde parte das substâncias que carregava. As partículas se separam, e a água segue para as próximas etapas de limpeza. Cada etapa prepara a água para um novo destino."],["Membranas e reúso","Filtração para um novo ciclo.","Na filtração, a água atravessa membranas que retêm impurezas. Depois de atingir a qualidade necessária para o uso previsto, ela pode voltar a abastecer processos industriais, reduzindo a necessidade de captar mais água."],["Retorno e destinação","Armazenar, retornar e acompanhar.","A água destinada ao reúso fica armazenada até retornar à produção. Outra parcela pode seguir para a rede pública, conforme as condições exigidas. O acompanhamento da qualidade e os bioindicadores ajudam a avaliar o desempenho do sistema."],["Visão do ciclo","Tecnologia a serviço da água.","Tratar, acompanhar e reutilizar: assim, a indústria aproveita melhor a água. Tecnologia e eficiência a serviço da responsabilidade ambiental."]];
const SHOT_NAMES={factory_open:'FÁBRICA',factory:'FÁBRICA',chem:'TRATAMENTO QUÍMICO',chem_macro:'PURIFICAÇÃO',bio:'TRATAMENTO BIOLÓGICO',tanks_pull:'TRATAMENTO',filter:'FILTRAÇÃO',membrane:'MEMBRANAS',storage:'RESERVATÓRIO',factory_reuse:'RETORNO À PRODUÇÃO',network:'DESTINAÇÃO À REDE PÚBLICA',lake:'LAGO E BIOINDICADORES',overview:'FLUXO COMPLETO'};
const META=NARRATION_META,DURATION=META.duration;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile=matchMedia('(max-width:650px), (pointer:coarse)').matches;
const stage=$('.stage'),canvas=$('#gl'),narration=$('#professional-narration'),startGate=$('#audio-start-gate');
let engine=null,t=0,playing=false,hasStarted=false,startPending=false,startSerial=0,resumeWhenVisible=false,chapter=-1,labelsVisible=true,audioOn=false,voiceOn=true,ctx,master,beat=-1,focus=null,hover=null,visible=true,frame=0,last=0,lastUI=-1;

function chapterAt(time){let i=0;for(let j=1;j<META.chapters.length;j++)if(time>=META.chapters[j].start)i=j;return i}
function visualAt(time){const i=chapterAt(time),c=META.chapters[i];return Math.min(60,i*12+clamp((time-c.start)/c.duration)*12)}
function fmt(time){time=Math.max(0,Math.floor(time));return String(Math.floor(time/60)).padStart(2,'0')+':'+String(time%60).padStart(2,'0')}
$('#timeline').max=DURATION;$('#timeline').step='.01';
all('.chapter').forEach((b,i)=>b.querySelector('span').textContent=`0${i+1} / ${fmt(META.chapters[i].start)}`);
narration.volume=1;narration.muted=false;

function hideGate(){startGate.hidden=true;document.querySelector('main').inert=false;$('#start-with-audio').disabled=false}
function showGate(message='O navegador pede um toque para liberar a voz.'){startGate.hidden=false;document.querySelector('main').inert=true;$('#start-with-audio').focus({preventScroll:true});$('#audio-gate-note').textContent=message;$('#start-with-audio').disabled=false;$('#play').textContent='▶ Iniciar com voz'}
async function startPlayback(){
 const request=++startSerial;startPending=true;focus=null;hasStarted=true;engine&&engine.clearManual();hideGate();
 if(t>=DURATION-.015){t=0;narration.currentTime=0}else if(Math.abs(narration.currentTime-t)>.09)narration.currentTime=t;
 narration.muted=!voiceOn;
 try{const p=narration.play();if(p)await p;if(request!==startSerial)return;playing=true;startPending=false;$('#play').textContent='Ⅱ Pausar';if(audioOn){sound();if(master)master.gain.value=.035}run()}
 catch(error){if(request!==startSerial)return;playing=false;startPending=false;t=narration.currentTime||t;run();if(error.name==='NotAllowedError')showGate();else if(error.name!=='AbortError')showGate('Não foi possível iniciar o áudio. Toque para tentar novamente.')}
}
function pause(){++startSerial;startPending=false;playing=false;narration.pause();t=Math.min(DURATION,narration.currentTime||t);$('#play').textContent='▶ Continuar';if(master)master.gain.value=0;run()}
function setTime(value){const keep=playing||startPending;++startSerial;startPending=false;t=Math.max(0,Math.min(DURATION-.005,value));narration.currentTime=t;focus=null;beat=-1;engine&&engine.clearManual();run();if(keep)startPlayback()}
function finishPlayback(){playing=false;startPending=false;t=DURATION;$('#play').textContent='↺ Repetir';if(master)master.gain.value=0;run()}
narration.addEventListener('ended',finishPlayback);
narration.addEventListener('error',()=>{if(hasStarted){pause();showGate('Não foi possível carregar a narração. Toque para tentar novamente.')}});
$('#start-with-audio').onclick=()=>{$('#start-with-audio').disabled=true;startPlayback()};

// Trilha sintetizada opcional (mesma lógica do projeto original)
function sound(){if(!ctx){ctx=new AudioContext();master=ctx.createGain();master.gain.value=.035;master.connect(ctx.destination)}ctx.resume()}
function tone(freq,duration,vol,type='sine'){if(!ctx||!audioOn||!playing)return;const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(vol,ctx.currentTime+.03);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);o.connect(g);g.connect(master);o.start();o.stop(ctx.currentTime+duration)}
function audioStep(){const m=visualAt(t);const b=Math.floor(m*2);if(b===beat)return;beat=b;const grow=Math.min(1,Math.max(0,(m-20)/4));tone([130.81,164.81,196,261.63][Math.floor(b/8)%4],.95,.12+grow*.16);if(m>=24){tone([523.25,659.25,783.99,987.77][b%4],.28,.08);if(b%2===0)tone(55,.18,.55)}}

function currentShot(){if(!engine)return 'factory';const tl=engine.timeline;let i=0;for(let k=1;k<tl.length;k++)if(t>=tl[k].at)i=k;return tl[i].shot}
function updateUI(){
 const i=chapterAt(t);
 if(chapter!==i){chapter=i;$('#phaseLabel').textContent=stages[i][0].toUpperCase();$('#heading').textContent=stages[i][1];$('#description').textContent=stages[i][2];all('.chapter').forEach((b,j)=>{b.classList.toggle('active',j===i);b.setAttribute('aria-current',j===i?'step':'false')})}
 if(t!==lastUI){$('#timeline').value=t;$('#time').textContent=`${fmt(t>=DURATION?Math.ceil(DURATION):t)} / ${fmt(Math.ceil(DURATION))}`;lastUI=t}
 const v=visualAt(t),stored=Math.min(1,Math.max(0,(v-36)/6));
 $('#readout').textContent=i===3?`RESERVATÓRIO · ${Math.round(stored*stored*(3-2*stored)*100)}% ILUSTRATIVO`:`ETAPA 0${i+1} / 05 · ${playing?'EM MOVIMENTO':'PAUSADO'}`;
 const manual=engine&&engine.manual;stage.classList.toggle('is-cine',!!(playing&&!manual&&!reduced));
 $('#focus-name').textContent=(manual?(focus?NAMES[focus]:'EXPLORAÇÃO LIVRE'):SHOT_NAMES[currentShot()]||'FLUXO COMPLETO')+' · CÂMERA CINEMATOGRÁFICA';
 if(engine){const z=engine.zoomLevel;$('#zoom-value').textContent=Math.round(z*100)+'%';$('#zoom-out').disabled=z<=1.02;$('#zoom-in').disabled=z>=10}
 const voiceLocal=t-META.chapters[i].start;const word=i===4?(voiceLocal<5.67?'':voiceLocal<6.45?'Tecnologia':voiceLocal<7.85?'Eficiência':voiceLocal<META.chapters[4].duration?'Responsabilidade ambiental':''):'';
 const w=$('#word');if(w.textContent!==word){w.textContent=word;w.classList.remove('pop');void w.offsetWidth;if(word)w.classList.add('pop')}w.style.opacity=word?'1':'0';
 audioStep();
}
function loop(now){frame=0;const dt=last?Math.min(window.__ETA_DT_MAX||.05,(now-last)/1000):.016;last=now;if(playing)t=Math.min(DURATION,narration.currentTime);
 updateUI();
 if(engine)engine.render(dt,{t,visual:visualAt(t),chapter:chapterAt(t),overview:!hasStarted&&t===0,labels:labelsVisible,hover});
 if(visible&&!document.hidden)frame=requestAnimationFrame(loop)}
function run(){if(!frame){last=0;frame=requestAnimationFrame(loop)}}

function explore(id){pause();focus=id;engine&&engine.setManual(id);run()}
function overview(){pause();focus=null;engine&&engine.setManual('overview');run()}
function zoom(f){pause();focus=null;engine&&engine.zoom(f);run()}
$('#play').onclick=()=>{resumeWhenVisible=false;if(playing||startPending)pause();else startPlayback()};
$('#timeline').oninput=e=>setTime(+e.target.value);all('.chapter').forEach((b,i)=>b.onclick=()=>setTime(META.chapters[i].start));
$('#reset').onclick=()=>{pause();hasStarted=false;focus=null;t=0;narration.currentTime=0;engine&&engine.clearManual();hideGate();$('#play').textContent='▶ Iniciar com voz';run()};
$('#overview').onclick=overview;$('#zoom-in').onclick=()=>zoom(1.3);$('#zoom-out').onclick=()=>zoom(1/1.3);
$('#labels').onclick=()=>{labelsVisible=!labelsVisible;$('#labels').setAttribute('aria-pressed',labelsVisible);$('#labels').textContent=labelsVisible?'Legendas visíveis':'Mostrar legendas';run()};
$('#audio').textContent='Trilha desligada';$('#audio').onclick=()=>{audioOn=!audioOn;if(audioOn)sound();if(master)master.gain.value=audioOn&&playing?.035:0;$('#audio').setAttribute('aria-pressed',audioOn);$('#audio').textContent=audioOn?'♪ Trilha ligada':'Trilha desligada'};
$('#voice').setAttribute('aria-pressed','true');$('#voice').textContent='Voz ligada';$('#voice').onclick=()=>{voiceOn=!voiceOn;narration.muted=!voiceOn;$('#voice').setAttribute('aria-pressed',voiceOn);$('#voice').textContent=voiceOn?'Voz ligada':'Voz desligada'};
$('#labels3d').addEventListener('click',e=>{const b=e.target.closest('[data-focus]');if(!b)return;const id=b.dataset.focus;if(focus===id)overview();else explore(id)});

// Gestos: arrastar = orbitar, pinça/ctrl+roda = zoom, toque/clique = aproximar equipamento
const pts=new Map();let gesture=null,pinch=0;
canvas.addEventListener('pointerdown',e=>{if(!engine)return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});gesture={x:e.clientX,y:e.clientY,moved:false,id:e.pointerId};if(pts.size===2){const [a,b]=[...pts.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y)}});
canvas.addEventListener('pointermove',e=>{
 if(!engine)return;
 if(!pts.has(e.pointerId)){if(e.pointerType==='mouse'&&!(e.buttons)){const g=engine.pick(e.clientX,e.clientY);if(g!==hover){hover=g;canvas.style.cursor=g?'pointer':'grab'}}return}
 const prev=pts.get(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pts.size===2){const [a,b]=[...pts.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch){if(gesture&&!gesture.moved){gesture.moved=true;pause();focus=null}engine.zoom(d/pinch)}pinch=d;return}
 if(!gesture)return;const dx=e.clientX-prev.x,dy=e.clientY-prev.y;
 if(!gesture.moved&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)<6)return;
 if(!gesture.moved){gesture.moved=true;pause();focus=null;canvas.setPointerCapture(e.pointerId);stage.classList.add('dragging')}
 engine.orbit(dx,dy);run()});
function endPointer(e){pts.delete(e.pointerId);if(pts.size<2)pinch=0;if(!gesture||gesture.id!==e.pointerId)return;const moved=gesture.moved;gesture=null;stage.classList.remove('dragging');
 if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
 if(!moved&&e.type==='pointerup'&&engine){const g=engine.pick(e.clientX,e.clientY);if(g){if(focus===g)overview();else explore(g)}}}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('pointerleave',()=>{if(hover){hover=null;canvas.style.cursor='grab'}});
canvas.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();zoom(e.deltaY<0?1.12:1/1.12)},{passive:false});
stage.onkeydown=e=>{if(e.target.closest('.lbl'))return;if(e.code==='Space'){e.preventDefault();$('#play').click()}else if(e.key==='ArrowRight'){e.preventDefault();setTime(META.chapters[Math.min(4,chapterAt(t)+1)].start)}else if(e.key==='ArrowLeft'){e.preventDefault();setTime(META.chapters[Math.max(0,chapterAt(t)-1)].start)}else if(e.key==='Escape'||e.key==='Home'){e.preventDefault();overview()}else if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.3)}else if(e.key==='-'){e.preventDefault();zoom(1/1.3)}};
document.addEventListener('visibilitychange',()=>{if(document.hidden){resumeWhenVisible=playing;if(playing)pause();if(ctx)ctx.suspend()}else{if(resumeWhenVisible&&visible){resumeWhenVisible=false;startPlayback()}run()}});
new IntersectionObserver(es=>{visible=es.at(-1).isIntersecting;if(visible){if(resumeWhenVisible&&!document.hidden){resumeWhenVisible=false;startPlayback()}run()}else if(playing){resumeWhenVisible=true;pause()}}).observe(stage);

// Carregamento da cena 3D (o render estático fica como pôster e como alternativa sem WebGL)
const ready=(async()=>{
 try{
  engine=await createEngine({canvas,stage,labelsEl:$('#labels3d'),dataUrl:'./assets/scene_data.json',glbUrl:'./assets/scene.glb',reduced,mobile,
   onProgress:p=>{$('#loader-bar').style.width=Math.round(p*100)+'%'}});
  engine.render(.016,{t,visual:visualAt(t),chapter:chapterAt(t),overview:!hasStarted&&t===0,labels:labelsVisible,hover});
  stage.classList.add('is-ready');
 }catch(err){console.warn('Cena 3D indisponível; usando a ilustração estática.',err);stage.classList.add('is-fallback')}
})();
let introStarted=false;async function afterIntro(){if(introStarted)return;introStarted=true;await Promise.race([ready,new Promise(r=>setTimeout(r,9000))]);startPlayback()}
window.addEventListener('fiat:intro-complete',afterIntro,{once:true});if(window.__fiatIntroReady)setTimeout(afterIntro,0);
window.waterDemo={seek:setTime,focus:explore,overview,zoom,pause,play:startPlayback,get time(){return t},get visualTime(){return visualAt(t)},get duration(){return DURATION},get chapters(){return META.chapters.map(c=>({start:c.start,duration:c.duration}))},get playing(){return playing},get focusName(){return focus},get audioTime(){return narration.currentTime},get blocked(){return !startGate.hidden},get ready(){return !!engine},get engine(){return engine}};
run();
