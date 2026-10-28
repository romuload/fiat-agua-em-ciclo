const NARRATION_META={"duration":67.81560090702948,"chapters":[{"start":0,"duration":16.040907029478458,"end":16.040907029478458},{"start":16.040907029478458,"duration":12.773877551020409,"end":28.814784580498866},{"start":28.814784580498866,"duration":14.236734693877551,"end":43.05151927437642},{"start":43.05151927437642,"duration":15.281632653061225,"end":58.33315192743764},{"start":58.33315192743764,"duration":9.482448979591837,"end":67.81560090702948}]};const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const stages=[["Fábrica e tratamento", "Da fábrica ao tratamento.", "Depois de utilizada na produção, a água segue para tratamento. Na etapa química, as impurezas se agrupam e se depositam no fundo do tanque. No tratamento biológico, microrganismos ajudam a decompor a matéria orgânica, com o oxigênio fornecido pela aeração."], ["Purificação", "Cada etapa prepara um novo destino.", "Ao longo do tratamento, a água perde parte das substâncias que carregava. As partículas se separam, e a água segue para as próximas etapas de limpeza. Cada etapa prepara a água para um novo destino."], ["Membranas e reúso", "Filtração para um novo ciclo.", "Na filtração, a água atravessa membranas que retêm impurezas. Depois de atingir a qualidade necessária para o uso previsto, ela pode voltar a abastecer processos industriais, reduzindo a necessidade de captar mais água."], ["Retorno e destinação", "Armazenar, retornar e acompanhar.", "A água destinada ao reúso fica armazenada até retornar à produção. Outra parcela pode seguir para a rede pública, conforme as condições exigidas. O acompanhamento da qualidade e os bioindicadores ajudam a avaliar o desempenho do sistema."], ["Visão do ciclo", "Tecnologia a serviço da água.", "Tratar, acompanhar e reutilizar: assim, a indústria aproveita melhor a água. Tecnologia e eficiência a serviço da responsabilidade ambiental."]];
const W=1672,H=941,MAX=4.2;
const bounds={factory:[15,20,630,393],chem:[735,173,247,182],bio:[735,365,248,168],filter:[1096,140,293,249],membrane:[1375,178,292,258],storage:[130,531,180,294],lake:[570,688,865,232],network:[976,505,85,115]};
const names={factory:'FÁBRICA',chem:'TRATAMENTO QUÍMICO',bio:'TRATAMENTO BIOLÓGICO',filter:'FILTRAÇÃO',membrane:'MEMBRANAS',storage:'RESERVATÓRIO',lake:'LAGO E BIOINDICADORES',network:'DESTINAÇÃO À REDE PÚBLICA'};
const home={x:W/2,y:H/2,z:1};let cam={...home},target={...home},manual=false,focus=null;
let t=0,playing=false,last=0,frame=0,visible=true,chapter=-1,spoken=-1,labelsVisible=true,audioOn=false,voiceOn=true,ctx,master,beat=-1,wordOverride='',wordUntil=0,oldTime=-1;
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),pipes=all('.pipeline'),drops=all('.water-drop'),sediments=all('.sediment'),bubbles=all('.bubble');
const routeCache=new Map(all('.flow-path').map(p=>[p.id,{path:p,len:p.getTotalLength()}]));
const stage=$('.stage'),scene=$('#scene');
function boxView(id){const [x,y,w,h]=bounds[id];return {x:x+w/2,y:y+h/2,z:Math.min(MAX,W/(w*1.08),H/(h*1.08))}}
cam=boxView('factory');target={...cam};
let currentShot='factory';
function blend(a,b,q){return {x:a.x+(b.x-a.x)*q,y:a.y+(b.y-a.y)*q,z:Math.exp(Math.log(a.z)+(Math.log(b.z)-Math.log(a.z))*q)}}
const narration=$('#professional-narration'),META=NARRATION_META,DURATION=META.duration;
let hasStarted=false,startPending=false,startSerial=0,resumeWhenVisible=false;
const startGate=$('#audio-start-gate');
function chapterAt(time){let i=0;for(let j=1;j<META.chapters.length;j++)if(time>=META.chapters[j].start)i=j;return i}
function visualAt(time){const i=chapterAt(time),c=META.chapters[i];return Math.min(60,i*12+clamp((time-c.start)/c.duration)*12)}
function timeAtVisual(v){if(v>=60)return DURATION;const i=Math.min(4,Math.floor(v/12)),c=META.chapters[i];return c.start+((v-i*12)/12)*c.duration}
function fmt(time){time=Math.max(0,Math.floor(time));return String(Math.floor(time/60)).padStart(2,'0')+':'+String(time%60).padStart(2,'0')}
$('#timeline').max=DURATION;$('#timeline').step='.01';
all('.chapter').forEach((b,i)=>b.querySelector('span').textContent=`0${i+1} / ${fmt(META.chapters[i].start)}`);
narration.volume=1;narration.muted=false;
function hideGate(){startGate.hidden=true;document.querySelector('main').inert=false;$('#start-with-audio').disabled=false}
function showGate(message='O navegador pede um toque para liberar a voz.'){startGate.hidden=false;document.querySelector('main').inert=true;$('#start-with-audio').focus({preventScroll:true});$('#audio-gate-note').textContent=message;$('#start-with-audio').disabled=false;$('#play').textContent='▶ Iniciar com voz'}
async function startPlayback(){
 const request=++startSerial;startPending=true;manual=false;focus=null;hasStarted=true;oldTime=-1;hideGate();
 if(t>=DURATION-.015){t=0;narration.currentTime=0}
 else if(Math.abs(narration.currentTime-t)>.09)narration.currentTime=t;
 if(t<.025){cam=boxView('factory');target={...cam};render(.016)}
 narration.muted=!voiceOn;
 try{const promise=narration.play();if(promise)await promise;if(request!==startSerial)return;playing=true;startPending=false;last=0;$('#play').textContent='Ⅱ Pausar';if(audioOn){sound();if(master)master.gain.value=.035}render(.016);run()}
 catch(error){if(request!==startSerial)return;playing=false;startPending=false;t=narration.currentTime||t;oldTime=-1;render(.016);run();if(error.name==='NotAllowedError')showGate();else if(error.name!=='AbortError')showGate('Não foi possível iniciar o áudio. Toque para tentar novamente.')}
}
function pause(){++startSerial;startPending=false;playing=false;narration.pause();t=Math.min(DURATION,narration.currentTime||t);oldTime=-1;$('#play').textContent='▶ Continuar';if(master)master.gain.value=0;render(.016);run()}
function setTime(value){const keepPlaying=playing||startPending;++startSerial;startPending=false;t=Math.max(0,Math.min(DURATION-.005,value));narration.currentTime=t;manual=false;focus=null;oldTime=-1;beat=-1;render(.016);run();if(keepPlaying)startPlayback()}
function finishPlayback(){playing=false;startPending=false;t=DURATION;oldTime=-1;$('#play').textContent='↺ Repetir';if(master)master.gain.value=0;render(.016);run()}
narration.addEventListener('ended',finishPlayback);
narration.addEventListener('error',()=>{if(hasStarted){pause();showGate('Não foi possível carregar a narração. Toque para tentar novamente.')}});
narration.addEventListener('timeupdate',()=>{if(playing){t=Math.min(DURATION,narration.currentTime);oldTime=-1;run()}});
$('#start-with-audio').onclick=()=>{ $('#start-with-audio').disabled=true;startPlayback() };

// Every shot is a close-up. Only the last chapter opens to the complete circuit.
function tour(){
 const i=chapterAt(t),c=META.chapters[i],local=t-c.start;
 const shot=id=>{currentShot=id;return boxView(id)};
 const transition=(from,to,start,duration)=>blend(boxView(from),boxView(to),smooth((local-start)/duration));
 if(i===0){
  if(local<4.65)return shot('factory');
  if(local<5.55){currentShot='chem';return transition('factory','chem',4.65,.9)}
  if(local<9.55)return shot('chem');
  if(local<10.45){currentShot='bio';return transition('chem','bio',9.55,.9)}
  return shot('bio');
 }
 if(i===1)return shot('chem');
 if(i===2){
  if(local<2.35)return shot('filter');
  if(local<3.35){currentShot='membrane';return transition('filter','membrane',2.35,1)}
  return shot('membrane');
 }
 if(i===3){
  if(local<4.1)return shot('storage');
  if(local<5.05){currentShot='factory';return transition('storage','factory',4.1,.95)}
  if(local<7.35)return shot('factory');
  if(local<8.3){currentShot='network';return transition('factory','network',7.35,.95)}
  if(local<10.25)return shot('network');
  if(local<11.35){currentShot='lake';return transition('network','lake',10.25,1.1)}
  return shot('lake');
 }
 currentShot='complete';return blend(boxView('lake'),home,smooth(local/2.3));
}
function sound(){if(!ctx){ctx=new AudioContext();master=ctx.createGain();master.gain.value=.035;master.connect(ctx.destination)}ctx.resume()}
function tone(freq,duration,vol,type='sine'){if(!ctx||!audioOn||!playing)return;const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(vol,ctx.currentTime+.03);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);o.connect(g);g.connect(master);o.start();o.stop(ctx.currentTime+duration)}
function audioStep(){const musicTime=visualAt(t);const b=Math.floor(musicTime*2);if(b===beat)return;beat=b;const grow=smooth((musicTime-20)/4);tone([130.81,164.81,196,261.63][Math.floor(b/8)%4],.95,.12+grow*.16);if(musicTime>=24){tone([523.25,659.25,783.99,987.77][b%4],.28,.08);if(b%2===0)tone(55,.18,.55)}}
function render(dt=.016){const v=visualAt(t),i=chapterAt(t),local=v-i*12,overview=t===0&&!hasStarted;
if(chapter!==i){chapter=i;$('#phaseLabel').textContent=stages[i][0].toUpperCase();$('#heading').textContent=stages[i][1];$('#description').textContent=stages[i][2];all('.chapter').forEach((b,j)=>{b.classList.toggle('active',j===i);b.setAttribute('aria-current',j===i?'step':'false')});}
if(t!==oldTime){
const assembly=1;$('#filtration-reveal').setAttribute('opacity',1);$('#factory-reveal').setAttribute('y',414*(1-assembly));$('#factory-reveal').setAttribute('height',414*assembly);
const purity=smooth((v-12)/9);$('#chem-turbidity').setAttribute('opacity',overview?0:.75*(1-purity)*smooth((v-2)/3));
sediments.forEach((el,j)=>{const q=(v*.09+j*.13)%1;el.setAttribute('transform',`translate(0 ${reduced.matches?0:q*12})`);el.setAttribute('opacity',overview?0:(1-purity)*.68*smooth((v-2)/5))});
bubbles.forEach((el,j)=>{const q=(v*.22+j*.13)%1;el.setAttribute('transform',`translate(${reduced.matches?0:Math.sin(v+j)*1.5} ${reduced.matches?0:9-q*19})`);el.setAttribute('opacity',overview?0:smooth((v-5)/5)*(1-q)*.55)});
const stored=overview?1:smooth((v-36)/6),level=704-stored*108;$('#storage-level').setAttribute('y',level);$('#storage-level').setAttribute('opacity',overview?0:.14);$('#storage-surface').setAttribute('d',`M155 ${level}Q220 ${level+22}285 ${level}`);$('#storage-surface').setAttribute('opacity',i===3?.62:0);
const sy=213+smooth(local/10)*47;$('#purification-scan').setAttribute('d',`M770 ${sy}H944`);$('#purification-scan').setAttribute('opacity',i===1?Math.sin(Math.PI*clamp(local/12))*.8:0);
pipes.forEach(el=>el.querySelector('.flow-path').style.opacity=!overview?smooth((v-Number(el.dataset.at))/2)*.36:0);
drops.forEach(el=>{const r=routeCache.get(el.dataset.route),speed=el.dataset.route==='flow-storage-in'?.055:.14;const p=r.path.getPointAtLength(((v*speed+Number(el.dataset.phase))%1)*r.len);el.setAttribute('cx',p.x);el.setAttribute('cy',p.y);el.style.opacity=!overview&&!reduced.matches&&v>Number(el.closest('.pipeline').dataset.at)?1:0});
$('#timeline').value=t;$('#time').textContent=`${fmt(t>=DURATION?Math.ceil(DURATION):t)} / ${fmt(Math.ceil(DURATION))}`;$('#readout').textContent=i===3?`RESERVATÓRIO · ${Math.round(stored*100)}% ILUSTRATIVO`:`ETAPA 0${i+1} / 05 · ${playing?'EM MOVIMENTO':'PAUSADO'}`;oldTime=t;
}
if(!manual)target=tour();const a=reduced.matches?1:1-Math.exp(-dt/.36);cam.x+=(target.x-cam.x)*a;cam.y+=(target.y-cam.y)*a;cam.z=Math.exp(Math.log(cam.z)+(Math.log(target.z)-Math.log(cam.z))*a);
const tx=W/2-cam.x*cam.z,ty=H/2-cam.y*cam.z;$('#camera').setAttribute('transform',`matrix(${cam.z} 0 0 ${cam.z} ${tx} ${ty})`);$('#zoom-value').textContent=Math.round(cam.z*100)+'%';$('#zoom-in').disabled=target.z>=MAX-.001;$('#zoom-out').disabled=target.z<=1.001;$('#annotations').style.opacity=labelsVisible&&cam.z<1.15?1:0;$('#focus-name').textContent=(focus?names[focus]:!manual?(currentShot==='complete'?'FLUXO COMPLETO':names[currentShot]):cam.z>1.1?'EXPLORAÇÃO':'VISÃO GERAL')+' · ESCALA UNIFORME';
const pulse=playing&&audioOn&&v>=24&&!reduced.matches?Math.pow(Math.max(0,Math.cos(t*Math.PI*4)),6)*.065:0;$('#water-effects').style.filter=`brightness(${1+pulse})`;
const voiceLocal=t-META.chapters[i].start;let word=i===4?(voiceLocal<5.67?'':voiceLocal<6.45?'Tecnologia':voiceLocal<7.85?'Eficiência':voiceLocal<META.chapters[4].duration?'Responsabilidade ambiental':''):'';$('#word').textContent=word;$('#word').style.opacity=word?'1':'0';audioStep();return Math.abs(cam.x-target.x)>.03||Math.abs(cam.y-target.y)>.03||Math.abs(cam.z-target.z)>.0001}
function loop(now){frame=0;const dt=last?Math.min(.05,(now-last)/1000):.016;last=now;if(playing)t=Math.min(DURATION,narration.currentTime);const moving=render(dt);if(visible&&!document.hidden&&(playing||moving))frame=requestAnimationFrame(loop)}
function run(){if(!frame){last=0;frame=requestAnimationFrame(loop)}}
function explore(id){pause();manual=true;focus=id;target=boxView(id);render(.016);run()}
function overview(){pause();manual=true;focus=null;target={...home};render(.016);run()}
function zoom(factor){pause();manual=true;focus=null;target={...target,z:Math.max(1,Math.min(MAX,target.z*factor))};if(target.z===1)target={...home};render(.016);run()}
$('#play').onclick=()=>{resumeWhenVisible=false;if(playing||startPending)pause();else startPlayback()};
$('#timeline').oninput=e=>setTime(+e.target.value);all('.chapter').forEach((b,i)=>b.onclick=()=>setTime(META.chapters[i].start));
$('#reset').onclick=()=>{pause();hasStarted=false;manual=false;focus=null;t=0;narration.currentTime=0;oldTime=-1;cam=boxView('factory');target={...cam};hideGate();$('#play').textContent='▶ Iniciar com voz';render(.016);run()};
$('#overview').onclick=overview;$('#zoom-in').onclick=()=>zoom(1.25);$('#zoom-out').onclick=()=>zoom(1/1.25);
$('#labels').onclick=()=>{labelsVisible=!labelsVisible;$('#labels').setAttribute('aria-pressed',labelsVisible);$('#labels').textContent=labelsVisible?'Legendas visíveis':'Mostrar legendas';render(.016);run()};
$('#audio').textContent='Trilha desligada';$('#audio').onclick=()=>{audioOn=!audioOn;if(audioOn)sound();if(master)master.gain.value=audioOn&&playing?.035:0;$('#audio').setAttribute('aria-pressed',audioOn);$('#audio').textContent=audioOn?'♪ Trilha ligada':'Trilha desligada'};
$('#voice').setAttribute('aria-pressed','true');$('#voice').textContent='Voz ligada';$('#voice').onclick=()=>{voiceOn=!voiceOn;narration.muted=!voiceOn;$('#voice').setAttribute('aria-pressed',voiceOn);$('#voice').textContent=voiceOn?'Voz ligada':'Voz desligada'};
let gesture=null,suppressClick=false;
scene.addEventListener('pointerdown',e=>{if(e.button!==0||cam.z<=1.01)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,base:{...cam},moved:false};});
scene.addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.hypot(dx,dy)<5&&!gesture.moved)return;if(!gesture.moved){gesture.moved=true;pause();manual=true;focus=null;scene.setPointerCapture(e.pointerId);stage.classList.add('dragging')};const scale=scene.getScreenCTM().a;target={x:Math.max(0,Math.min(W,gesture.base.x-dx/(scale*gesture.base.z))),y:Math.max(0,Math.min(H,gesture.base.y-dy/(scale*gesture.base.z))),z:gesture.base.z};cam={...target};render(.016);run()});
function endGesture(e){if(!gesture||gesture.id!==e.pointerId)return;suppressClick=gesture.moved;gesture=null;stage.classList.remove('dragging');if(scene.hasPointerCapture(e.pointerId))scene.releasePointerCapture(e.pointerId);setTimeout(()=>suppressClick=false,0)}
scene.addEventListener('pointerup',endGesture);scene.addEventListener('pointercancel',endGesture);
all('.hotspot').forEach(el=>{el.onclick=()=>{if(suppressClick)return;if(focus===el.dataset.focus)overview();else explore(el.dataset.focus)};el.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();explore(el.dataset.focus)}}});
scene.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();zoom(e.deltaY<0?1.12:1/1.12)},{passive:false});
stage.onkeydown=e=>{if(e.code==='Space'){e.preventDefault();$('#play').click()}else if(e.key==='ArrowRight'){e.preventDefault();setTime(META.chapters[Math.min(4,chapterAt(t)+1)].start)}else if(e.key==='ArrowLeft'){e.preventDefault();setTime(META.chapters[Math.max(0,chapterAt(t)-1)].start)}else if(e.key==='Escape'){e.preventDefault();overview()}else if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.25)}else if(e.key==='-'){e.preventDefault();zoom(1/1.25)}else if(e.key==='Home'){e.preventDefault();overview()}};
document.addEventListener('visibilitychange',()=>{if(document.hidden){resumeWhenVisible=playing;if(playing)pause();if(ctx)ctx.suspend()}else{if(resumeWhenVisible&&visible){resumeWhenVisible=false;startPlayback()}run()}});
new IntersectionObserver(es=>{visible=es.at(-1).isIntersecting;if(visible){if(resumeWhenVisible&&!document.hidden){resumeWhenVisible=false;startPlayback()}run()}else if(playing){resumeWhenVisible=true;pause()}}).observe(stage);
let introStarted=false;function afterIntro(){if(introStarted)return;introStarted=true;startPlayback()}
window.addEventListener('fiat:intro-complete',afterIntro,{once:true});if(window.__fiatIntroReady)setTimeout(afterIntro,0);
window.waterDemo={seek:setTime,focus:explore,overview,zoom,pause,play:startPlayback,get time(){return t},get visualTime(){return visualAt(t)},get duration(){return DURATION},get chapters(){return META.chapters.map(c=>({start:c.start,duration:c.duration}))},get playing(){return playing},get camera(){return {...cam}},get target(){return {...target}},get focusName(){return focus},get audioTime(){return narration.currentTime},get blocked(){return !startGate.hidden}};render(1);run();
