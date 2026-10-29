// FIAT · Água em Ciclo — motor 3D (Three.js)
// Direção de câmera, destaque de etapa, água em shader, fluxos, partículas e vida na cena.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const D2R=Math.PI/180, clamp01=x=>Math.max(0,Math.min(1,x)), lerp=(a,b,q)=>a+(b-a)*q, smooth=x=>{x=clamp01(x);return x*x*(3-2*x)};
const B=(x,y,z=0)=>new THREE.Vector3(x,z,-y); // Blender (Z-up) -> Three (Y-up)
function bezier(x1,y1,x2,y2){ // CSS-like cubic-bezier easing
 const cx=3*x1,bx=3*(x2-x1)-cx,ax=1-cx-bx,cy=3*y1,by=3*(y2-y1)-cy,ay=1-cy-by;
 const sx=t=>((ax*t+bx)*t+cx)*t,sy=t=>((ay*t+by)*t+cy)*t,dx=t=>(3*ax*t+2*bx)*t+cx;
 return x=>{if(x<=0)return 0;if(x>=1)return 1;let t=x;for(let i=0;i<6;i++){const e=sx(t)-x;const d=dx(t);if(Math.abs(e)<1e-5||!d)break;t-=e/d}return sy(clamp01(t))};
}
const EASE={cine:bezier(.62,0,.18,1),slowout:bezier(.3,0,.1,1),snap:bezier(.75,0,.12,1)};

// ---------- Roteiro de câmera (segundos da narração) ----------
// Cada plano: alvo, raio de enquadramento, azimute, elevação, lente (fov vertical), rolagem (dutch) e deriva no hold.
const SHOTS={
 factory_open:{t:B(-7.4,5.0,1.4),r:8.4,az:-36,el:46,fov:30,drift:4,push:.04,focus:'factory'},
 factory:{t:B(-7.4,5.0,1.7),r:5.0,az:14,el:27,fov:26,drift:5,push:.07,focus:'factory'},
 chem:{t:B(1.0,5.6,0.95),r:2.75,az:-10,el:54,fov:24,drift:7,push:.08,focus:'chem'},
 bio:{t:B(1.0,1.0,0.95),r:2.75,az:16,el:47,fov:24,drift:-7,push:.08,focus:'bio'},
 chem_macro:{t:B(0.9,5.45,1.2),r:1.75,az:22,el:28,fov:21,drift:-9,push:.1,focus:'chem',roll:-1.2},
 tanks_pull:{t:B(2.2,3.2,0.9),r:4.7,az:-4,el:40,fov:25,drift:6,push:.03,focus:'tanks'},
 filter:{t:B(8.0,4.6,2.0),r:3.3,az:-30,el:22,fov:24,drift:9,push:.08,focus:'filter',roll:1.0},
 membrane:{t:B(13.6,4.4,2.15),r:3.25,az:26,el:20,fov:24,drift:-8,push:.08,focus:'membrane',roll:-1.0},
 storage:{t:B(-11.0,-5.5,2.45),r:3.2,az:-16,el:14,fov:24,drift:8,push:.07,focus:'storage',roll:1.4},
 factory_reuse:{t:B(-9.8,-1.0,1.6),r:5.6,az:24,el:36,fov:26,drift:5,push:.05,focus:'reuse'},
 network:{t:B(4.4,0.1,0.5),r:3.2,az:24,el:40,fov:24,drift:-8,push:.1,focus:'network'},
 lake:{t:B(1.4,-7.5,0.35),r:5.8,az:-6,el:21,fov:24,drift:9,push:.06,focus:'lake'},
 overview:{t:B(1.6,-1.9,0.6),r:16.2,ry:8.6,az:-9,el:46,fov:28,drift:24,push:.02,focus:null},
 wide:{t:B(1.6,-1.9,0.6),r:16.2,ry:8.6,az:-9,el:46,fov:28,drift:0,push:0,focus:null}
};
// Transições: at = início do movimento, dur = duração; path = tubo seguido pela câmera; crane = arco de grua.
const TIMELINE=[
 {at:0,dur:0,shot:'factory_open'},
 {at:.35,dur:3.7,shot:'factory',ease:'slowout'},
 {at:4.3,dur:1.3,shot:'chem',path:'Tubo_Fabrica_Quimico',crane:.14},
 {at:9.7,dur:1.05,shot:'bio',crane:.1},
 {at:15.95,dur:1.5,shot:'chem_macro',crane:.12},
 {at:22.25,dur:2.3,shot:'tanks_pull',ease:'slowout'},
 {at:26.1,dur:2.5,shot:'filter',path:'Tubo_Quimico_Filtro1',crane:.16},
 {at:30.05,dur:1.15,shot:'membrane',path:'Tubo_Filtro1_Filtro2',crane:.08},
 {at:38.2,dur:4.7,shot:'storage',path:'Tubo_Retorno_Longo',crane:.42},
 {at:46.3,dur:1.35,shot:'factory_reuse',path:'Tubo_Reservatorio_Fabrica',crane:.1},
 {at:48.5,dur:1.6,shot:'network',crane:.22},
 {at:52.45,dur:1.7,shot:'lake',path:'Tubo_Lago',crane:.18},
 {at:58.3,dur:4.4,shot:'overview',crane:.22,ease:'slowout'}
];
// Ênfases curtas (punch-in) nas palavras-chave da fala, alinhadas às frases da narração.
const CUES=[3.15,6.05,7.3,9.55,11.3,15.25,21.15,27.6,29.15,31.05,38.9,44.3,45.7,49.6,55.05,64.0,64.78,66.18];
// Ativação dos fluxos de água (segundos)
const FLOW_AT={human:0,chemin:1.2,bioin:2.6,chemout:24.2,bioout:24.6,filtration:31.4,storagein:38.4,reuse:46.6,public:49.2,lake:53.1};

const GROUPS=[['network',/^Tubo_Descarte/],['factory',/^(Fabrica_|Caminhao_|Carro_|Caixa_|Trabalhador_|Placa_)/],['chem',/^Tanque_Quimico/],['bio',/^Tanque_Biologico/],
 ['filter',/^Filtro1_/],['membrane',/^Filtro2_/],['storage',/^(Reservatorio_|Torre_)/],['lake',/^(Lago_|Casa_|Peixe_)/],['pipes',/^(Tubo_|Luva_)/]];
const FOCUS_SETS={factory:['factory'],chem:['chem'],bio:['bio'],tanks:['chem','bio'],filter:['filter'],membrane:['membrane'],storage:['storage'],
 reuse:['factory','storage'],network:['network'],lake:['lake']};
export const NAMES={factory:'FÁBRICA',chem:'TRATAMENTO QUÍMICO',bio:'TRATAMENTO BIOLÓGICO',filter:'FILTRAÇÃO',membrane:'MEMBRANAS',storage:'RESERVATÓRIO',lake:'LAGO E BIOINDICADORES',network:'DESTINAÇÃO À REDE PÚBLICA'};
const LABELS=[
 {id:'factory',at:B(-7.2,5.6,4.4),lines:['FÁBRICA']},
 {id:'chem',at:B(2.95,6.5,1.55),lines:['TRATAMENTO QUÍMICO','+ DECANTAÇÃO']},
 {id:'bio',at:B(2.95,0.3,1.55),lines:['TRATAMENTO BIOLÓGICO','AERAÇÃO + DECANTAÇÃO']},
 {id:'filter',at:B(8.0,4.6,4.4),lines:['FILTRAÇÃO']},
 {id:'membrane',at:B(13.6,4.4,4.7),lines:['MEMBRANAS']},
 {id:'storage',at:B(-11.0,-5.5,5.3),lines:['TANQUES DE','ARMAZENAMENTO']},
 {id:'lake',at:B(-1.6,-6.2,0.8),lines:['LAGO COM','BIOINDICADORES']},
 {id:'network',at:B(5.0,-0.6,0.4),lines:['EFLUENTE TRATADO','REDE PÚBLICA']},
 {id:null,key:'human',at:B(-13.2,2.6,0.3),lines:['ÁGUA PARA','CONSUMO HUMANO']},
 {id:null,key:'reuse',at:B(-9.6,-1.6,1.4),lines:['RETORNO DE ÁGUA','PARA PRODUÇÃO']}
];

// ---------- Shaders ----------
const WATER_VS=`
uniform float uTime;uniform float uAmp;varying vec3 vW;varying vec3 vN;
void main(){vec4 w=modelMatrix*vec4(position,1.);
 float h=sin(w.x*2.3+uTime*1.3)*.5+sin(w.z*3.1-uTime*1.7)*.35+sin((w.x+w.z)*4.7+uTime*2.2)*.15;
 w.y+=h*uAmp;vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`;
const WATER_FS=`
uniform float uTime,uTurb,uScan,uBubbles,uInletAmt,uSpark,uDim,uGlow;uniform vec3 uDeep,uShallow,uMud,uLight,uFog;uniform vec2 uCenter,uRad,uInlet;
uniform float uFogNear,uFogFar;varying vec3 vW;varying vec3 vN;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float wave(vec2 p,float t){return sin(p.x*2.3+t*1.3)*.5+sin(p.y*3.1-t*1.7)*.35+sin((p.x+p.y)*4.7+t*2.2)*.15+sin(p.x*9.0-p.y*7.0+t*3.1)*.06;}
float rings(vec2 p,vec2 c,float t,float sp){float d=length(p-c);float r=fract(t*sp);return 0.;}
void main(){
 vec2 p=vW.xz;float t=uTime;float e=.02;
 float hx=wave(p+vec2(e,0.),t)-wave(p-vec2(e,0.),t);float hz=wave(p+vec2(0.,e),t)-wave(p-vec2(0.,e),t);
 vec3 n=normalize(vec3(-hx*1.4,2.*e*7.,-hz*1.4));
 // anéis de entrada de água
 vec2 q=p-uInlet;float dq=length(q);float ring=0.;
 for(int i=0;i<3;i++){float ph=fract(t*.55+float(i)/3.);float rr=ph*1.6;ring+=smoothstep(.07,0.,abs(dq-rr))*(1.-ph);}
 ring*=uInletAmt;
 // bolhas da aeração (células)
 float bub=0.;vec2 g=p*2.6;vec2 id=floor(g);vec2 f=fract(g)-.5;
 for(int j=0;j<4;j++){vec2 o=vec2(float(j%2),float(j/2));vec2 cid=id+o;vec2 ff=f-o;float hsh=h21(cid);float ph=fract(t*.8+hsh*7.);
  vec2 c=vec2(h21(cid+3.1),h21(cid+7.7))-.5;float d=length(ff-c*.6);bub+=smoothstep(.035,0.,abs(d-ph*.32))*(1.-ph)*step(.35,hsh);
  bub+=smoothstep(.06,.0,d)*smoothstep(.85,1.,1.-ph)*step(.35,hsh)*.6;}
 bub*=uBubbles;
 vec3 v=normalize(cameraPosition-vW);float fr=pow(1.-clamp(dot(n,v),0.,1.),3.);
 vec2 rel=(p-uCenter)/uRad;float edge=clamp(length(rel),0.,1.);
 vec3 col=mix(uShallow,uDeep,smoothstep(.0,1.,edge*.85+n.x*.2));
 col=mix(col,uMud,uTurb*(.75+.25*sin(p.x*3.+t*.4)*sin(p.y*2.-t*.3)));
 vec3 h=normalize(uLight+v);float spec=pow(max(dot(n,h),0.),140.)*1.6;
 float sp=step(.995-.004*uSpark,h21(floor(p*42.)+floor(t*6.)))*pow(max(dot(n,h),0.),18.)*uSpark;
 col+=vec3(.75,.95,1.)*(fr*.16+spec*.8)+vec3(1.)*sp*2.2;
 col+=vec3(.75,1.,1.)*(ring*.55+bub*.7)*(1.-uTurb*.6);
 // varredura de purificação
 float sc=smoothstep(.05,0.,abs(length(rel)-uScan))*step(0.,uScan);col+=vec3(.5,1.,1.)*sc*1.6;
 float lum=dot(col,vec3(.299,.587,.114));col=mix(col,mix(vec3(lum),col,.25)*vec3(.42,.5,.62),uDim);
 float fd=length(cameraPosition-vW);col=mix(col,uFog,smoothstep(uFogNear,uFogFar,fd));
 gl_FragColor=vec4(col,1.);}`;
const FLOW_VS=`attribute float aS;varying float vS;varying vec2 vUv2;void main(){vS=aS;vUv2=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const FLOW_FS=`uniform float uTime,uAmt,uSpeed;uniform vec3 uCol;varying float vS;varying vec2 vUv2;
void main(){float x=vS-uTime*uSpeed;float d=fract(x/1.25);float pulse=pow(1.-d,5.)+.18;float side=sin(vUv2.y*3.14159);
 gl_FragColor=vec4(uCol*pulse*side*uAmt*2.2,1.);}`;
const POST_FS=`uniform sampler2D tDiffuse;uniform vec2 uRes;uniform float uFocusY,uBand,uBlur,uVig,uGrain,uTime,uLift;varying vec2 vUv;
float rnd(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){float d=abs(vUv.y-uFocusY);float b=smoothstep(uBand,uBand+.38,d)*uBlur;vec2 px=1./uRes;vec3 c=texture2D(tDiffuse,vUv).rgb;
 if(b>.02){vec3 acc=c;for(int i=1;i<14;i++){float a=float(i)*2.39996;float r=sqrt(float(i)/13.)*b*7.;acc+=texture2D(tDiffuse,vUv+vec2(cos(a),sin(a))*r*px).rgb;}c=acc/14.;}
 vec2 dc=vUv-.5;float vig=smoothstep(1.05,.32,length(dc*vec2(1.,1.18)));c*=mix(1.,vig,uVig);
 c=mix(vec3(.012,.03,.05),vec3(1.),c)*(1.+uLift);c=c*c*(3.-2.*c)*.18+c*.82;
 c+=(rnd(vUv*uRes+fract(uTime)*91.)-.5)*uGrain;gl_FragColor=vec4(c,1.);}`;

function radialTexture(stops,size=256){const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');const r=g.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);stops.forEach(([o,col])=>r.addColorStop(o,col));g.fillStyle=r;g.fillRect(0,0,size,size);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}

export async function createEngine({canvas,stage,labelsEl,dataUrl,glbUrl,reduced,onProgress,mobile}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',alpha:false});
 renderer.setClearColor(0x0d1823,1);renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.0;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
 let dprCap=mobile?1.6:2;renderer.setPixelRatio(Math.min(devicePixelRatio,dprCap));
 const scene=new THREE.Scene();const BG=new THREE.Color(0x0e1a26);scene.background=BG;scene.fog=new THREE.Fog(BG,30,90);
 const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.32;
 const camera=new THREE.PerspectiveCamera(26,1,.1,400);

 // Luz: sol quente + céu frio + contraluz azul (rim) para separar volumes do fundo
 const hemi=new THREE.HemisphereLight(0xd7ecff,0x22313f,.62);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xfff0da,3.4);sun.position.set(-14,26,18);sun.castShadow=true;
 const sm=mobile?1024:2048;sun.shadow.mapSize.set(sm,sm);Object.assign(sun.shadow.camera,{left:-24,right:24,top:20,bottom:-20,near:1,far:80});sun.shadow.bias=-.0004;sun.shadow.normalBias=.03;sun.shadow.radius=4;
 scene.add(sun);scene.add(sun.target);
 const rim=new THREE.DirectionalLight(0x7fc8ff,1.3);rim.position.set(18,10,-22);scene.add(rim);

 // Chão escuro com halo central (recebe sombras)
 const ground=new THREE.Mesh(new THREE.CircleGeometry(70,96),new THREE.MeshStandardMaterial({map:radialTexture([[0,'#22384b'],[.35,'#172839'],[.7,'#0f1c28'],[1,'#0e1a26']]),roughness:1,metalness:0}));
 ground.rotation.x=-Math.PI/2;ground.position.set(2,-.015,1);ground.receiveShadow=true;scene.add(ground);

 const data=await (await fetch(dataUrl)).json();
 const draco=new DRACOLoader().setDecoderPath('./assets/vendor/three/addons/libs/draco/gltf/');
 const loader=new GLTFLoader().setDRACOLoader(draco);
 const gltf=await new Promise((res,rej)=>loader.load(glbUrl,res,e=>{if(e.total&&onProgress)onProgress(e.loaded/e.total)},rej));
 const root=gltf.scene;scene.add(root);

 // ---- materiais por grupo, com dim/brilho controláveis ----
 const groupU={};['factory','chem','bio','filter','membrane','storage','lake','network','pipes','other'].forEach(g=>groupU[g]={uDim:{value:0},uGlow:{value:0},uGlowColor:{value:new THREE.Color(0x7fe8ff)},dim:0,glow:0});
 const meshByGroup={};const matCache=new Map();const meshes=[];const wind={value:0};
 const patch=(mat,u,sway)=>{mat.onBeforeCompile=sh=>{sh.uniforms.uDim=u.uDim;sh.uniforms.uGlow=u.uGlow;sh.uniforms.uGlowColor=u.uGlowColor;
   if(sway){sh.uniforms.uWind=wind;sh.vertexShader='uniform float uWind;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
     vec4 wq=modelMatrix*vec4(transformed,1.);float hh=max(0.,wq.y-.35);transformed.x+=sin(uWind*1.6+wq.x*.6+wq.z*.4)*hh*hh*.022;transformed.z+=cos(uWind*1.3+wq.z*.7)*hh*hh*.016;`)}
   sh.fragmentShader='uniform float uDim;uniform float uGlow;uniform vec3 uGlowColor;\n'+sh.fragmentShader.replace('#include <dithering_fragment>',`#include <dithering_fragment>
   float lumD=dot(gl_FragColor.rgb,vec3(.299,.587,.114));vec3 dimC=mix(vec3(lumD),gl_FragColor.rgb,.25)*vec3(.4,.48,.6);gl_FragColor.rgb=mix(gl_FragColor.rgb,dimC,uDim);
   float rimF=pow(1.-clamp(dot(normalize(normal),normalize(vViewPosition)),0.,1.),2.4);gl_FragColor.rgb+=uGlowColor*rimF*uGlow;`)};
  mat.customProgramCacheKey=()=>sway?'eta-sway':'eta';};
 root.traverse(o=>{if(!o.isMesh)return;const n=o.name;let g='other';for(const [gid,re] of GROUPS)if(re.test(n)){g=gid;break}
  o.castShadow=!/Agua|Margem|Grama|Plataforma_Topo/.test(n);o.receiveShadow=true;o.userData.group=g;
  const src=o.material;const sway=/Arvore|Arbusto/.test(src.name);const key=g+'|'+src.uuid+(/Membrana/.test(n)?n:'');
  let m=matCache.get(key);if(!m){m=src.clone();patch(m,groupU[g],sway);matCache.set(key,m)}o.material=m;
  (meshByGroup[g]=meshByGroup[g]||[]).push(o);meshes.push(o);});
 const byName=n=>{let f=null;root.traverse(o=>{if(!f&&o.name.startsWith(n))f=o});return f};

 // ---- água: tanques e lago com shader próprio ----
 const fogU={uFog:{value:BG.clone()},uFogNear:{value:30},uFogFar:{value:90}};
 const sunDir=sun.position.clone().normalize();
 function water(mesh,opt){const u={uTime:{value:0},uAmp:{value:opt.amp},uTurb:{value:0},uScan:{value:-1},uBubbles:{value:0},uInletAmt:{value:0},uSpark:{value:opt.spark},
   uDim:groupU[mesh.userData.group].uDim,uGlow:{value:0},uDeep:{value:new THREE.Color(opt.deep)},uShallow:{value:new THREE.Color(opt.shallow)},uMud:{value:new THREE.Color(0x6e5f3e)},
   uLight:{value:sunDir},uCenter:{value:opt.center},uRad:{value:opt.rad},uInlet:{value:opt.inlet},...fogU};
  mesh.material=new THREE.ShaderMaterial({uniforms:u,vertexShader:WATER_VS,fragmentShader:WATER_FS});mesh.castShadow=false;return u;}
 const chemW=water(byName('Tanque_Quimico_Agua'),{amp:.012,spark:.6,deep:0x0a7884,shallow:0x2cc4c0,center:new THREE.Vector2(1,-5.6),rad:new THREE.Vector2(1.85,1.85),inlet:new THREE.Vector2(-.5,-5.6)});
 const bioW=water(byName('Tanque_Biologico_Agua'),{amp:.016,spark:.6,deep:0x0a7d86,shallow:0x34cfc6,center:new THREE.Vector2(1,-1),rad:new THREE.Vector2(1.85,1.85),inlet:new THREE.Vector2(-.5,-1)});
 const lakeW=water(byName('Lago_Agua'),{amp:0,spark:1,deep:0x0a5fb8,shallow:0x3fb4ff,center:new THREE.Vector2(.8,7.8),rad:new THREE.Vector2(4.8,2.6),inlet:new THREE.Vector2(2.1,5.5)});
 const waters=[chemW,bioW,lakeW];

 // ---- fluxos: faixa luminosa sobre o tubo + gotas brilhantes ----
 const toV=a=>B(a[0],a[1],a[2]);
 const routeDef={human:['Tubo_Consumo_Humano',true],chemin:['Tubo_Fabrica_Quimico'],bioin:['Tubo_Fabrica_Biologico'],chemout:['Tubo_Quimico_Filtro1'],bioout:['Tubo_Biologico_Filtro1'],
  filtration:['Tubo_Filtro1_Filtro2'],storagein:['Tubo_Retorno_Longo'],reuse:['Tubo_Reservatorio_Fabrica'],public:['Tubo_Descarte'],lake:['Tubo_Lago']};
 const flows={};const dropGeo=new THREE.SphereGeometry(.075,10,8);
 for(const [key,[name,rev]] of Object.entries(routeDef)){
  let pts=data.paths[name].map(toV);if(rev)pts=pts.reverse();if(key==='lake')pts.push(B(2.15,-5.45,.28));
  const r=(data.paths[name+'_r']||.3);
  // desloca para a face visível do tubo (topo nos trechos horizontais, frente nos verticais)
  const off=pts.map((p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];const d=b.clone().sub(a).normalize();
   return Math.abs(d.y)>.7?p.clone().add(new THREE.Vector3(0,0,r*.95)):p.clone().add(new THREE.Vector3(0,r*.93,0))});
  const path=new THREE.CurvePath();for(let i=0;i<off.length-1;i++)if(off[i].distanceTo(off[i+1])>1e-4)path.add(new THREE.LineCurve3(off[i],off[i+1]));
  const len=path.getLength();const segs=Math.max(8,Math.round(len*14));
  const geo=new THREE.TubeGeometry(path,segs,.055,6,false);
  const s=new Float32Array(geo.attributes.position.count);const ring=7;for(let i=0;i<=segs;i++)for(let j=0;j<ring;j++)s[i*ring+j]=i/segs*len;
  geo.setAttribute('aS',new THREE.BufferAttribute(s,1));
  const u={uTime:{value:0},uAmt:{value:0},uSpeed:{value:1.5},uCol:{value:new THREE.Color(0x56e6ff)}};
  const strip=new THREE.Mesh(geo,new THREE.ShaderMaterial({uniforms:u,vertexShader:FLOW_VS,fragmentShader:FLOW_FS,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
  strip.renderOrder=3;scene.add(strip);
  const n=Math.max(3,Math.round(len/1.35));const inst=new THREE.InstancedMesh(dropGeo,new THREE.MeshBasicMaterial({color:new THREE.Color(0xa9f6ff).multiplyScalar(2.4),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),n);
  inst.renderOrder=4;inst.frustumCulled=false;scene.add(inst);
  flows[key]={path,len,u,inst,n,amt:0,end:off[off.length-1]};}

 // ---- partículas genéricas (sprites) ----
 const puffTex=radialTexture([[0,'rgba(255,255,255,.95)'],[.4,'rgba(235,244,250,.45)'],[1,'rgba(235,244,250,0)']],128);
 const glowTex=radialTexture([[0,'rgba(200,250,255,1)'],[.25,'rgba(120,230,255,.6)'],[1,'rgba(120,230,255,0)']],64);
 function makePoints(n,tex,size,color,additive=true){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));g.setAttribute('aA',new THREE.BufferAttribute(new Float32Array(n),1));g.setAttribute('aSz',new THREE.BufferAttribute(new Float32Array(n).fill(1),1));
  const m=new THREE.ShaderMaterial({uniforms:{uTex:{value:tex},uSize:{value:size},uCol:{value:new THREE.Color(color)},uScale:{value:500}},transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,
   vertexShader:`attribute float aA;attribute float aSz;varying float vA;uniform float uSize,uScale;void main(){vA=aA;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=uSize*aSz*uScale/-mv.z;gl_Position=projectionMatrix*mv;}`,
   fragmentShader:`uniform sampler2D uTex;uniform vec3 uCol;varying float vA;void main(){vec4 t=texture2D(uTex,gl_PointCoord);gl_FragColor=vec4(uCol,1.)*t*vA;}`});
  const p=new THREE.Points(g,m);p.frustumCulled=false;p.renderOrder=5;scene.add(p);return p}
 const vapor=makePoints(26,puffTex,1.15,0xe8f2f8,false);
 const exhaust=makePoints(10,puffTex,.45,0x9aa6b0,false);
 const dust=makePoints(mobile?70:150,glowTex,.12,0x9fe7ff);
 const sediment=makePoints(46,glowTex,.09,0xd8bf86);
 const splash=makePoints(40,glowTex,.11,0xbdf8ff);
 const pointsAll=[vapor,exhaust,dust,sediment,splash];
 const rnd=(()=>{let s=7;return()=>(s=(s*16807)%2147483647)/2147483647})();
 const dustSeed=[...Array(dust.geometry.attributes.aA.count)].map(()=>[rnd()*36-16,rnd()*7+.4,rnd()*26-12,rnd()*6.28]);
 const sedSeed=[...Array(46)].map(()=>[rnd()*6.28,Math.sqrt(rnd())*1.55,rnd()]);
 const splSeed=[...Array(40)].map(()=>[rnd(),rnd()*6.28,rnd()]);

 // ---- nível do reservatório: visor + anel luminoso ----
 const stC=B(-11,-5.5);const stBot=1.92+.12,stTop=1.92+2.6-.14;
 const glassMat=new THREE.ShaderMaterial({uniforms:{uLevel:{value:0},uAmt:{value:0},uTime:{value:0}},transparent:true,depthWrite:false,
  vertexShader:`varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float uLevel,uAmt,uTime;varying vec2 vU;void main(){float f=step(vU.y,uLevel+sin(vU.x*12.+uTime*3.)*.006);vec3 c=mix(vec3(.05,.2,.35),vec3(.45,.95,1.),f);float edge=smoothstep(.0,.08,vU.x)*smoothstep(1.,.92,vU.x);gl_FragColor=vec4(c*(1.4+f*1.2),(.55+f*.4)*edge*uAmt);}`});
 const glass=new THREE.Mesh(new THREE.CylinderGeometry(1.372,1.372,stTop-stBot,24,1,true,-.32,.42),glassMat);glass.position.set(stC.x,(stTop+stBot)/2,stC.z);glass.renderOrder=6;scene.add(glass);
 const levelRing=new THREE.Mesh(new THREE.TorusGeometry(1.385,.025,8,96),new THREE.MeshBasicMaterial({color:new THREE.Color(0x8ff3ff).multiplyScalar(2.5),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
 levelRing.rotation.x=Math.PI/2;levelRing.position.set(stC.x,stBot,stC.z);scene.add(levelRing);

 // ---- anel de foco no chão (destaque da etapa ativa) ----
 const focusDisc=new THREE.Mesh(new THREE.RingGeometry(.86,1,96),new THREE.MeshBasicMaterial({color:new THREE.Color(0x6fe6ff),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
 focusDisc.rotation.x=-Math.PI/2;focusDisc.position.y=.03;focusDisc.renderOrder=2;scene.add(focusDisc);
 const focusGlow=new THREE.Mesh(new THREE.CircleGeometry(1,64),new THREE.MeshBasicMaterial({map:radialTexture([[0,'rgba(110,230,255,.55)'],[.6,'rgba(110,230,255,.12)'],[1,'rgba(110,230,255,0)']]),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
 focusGlow.rotation.x=-Math.PI/2;focusGlow.position.y=.025;scene.add(focusGlow);

 // ---- vida: peixes, trabalhador carregando caixa, caminhão, membranas, tubos verdes ----
 const fish=[0,1,2,3].map(i=>{const b=byName('Peixe_'+i),tl=byName('Peixe_Cauda_'+i);if(b&&tl){b.rotation.set(0,0,0);b.updateMatrixWorld(true);b.attach(tl)}return b?{o:b,tail:tl,tq:tl?tl.quaternion.clone():null,base:b.position.clone(),ph:i*1.7,rx:2.6-i*.35,rz:1.15-i*.12,sp:.32+i*.05,dir:i%2?1:-1}:null}).filter(Boolean);
 const worker=['Trabalhador_Corpo','Trabalhador_Cabeca','Trabalhador_Capacete'].map(byName).filter(Boolean);const workerBase=worker.map(o=>o.position.clone());
 const carryBox=byName('Caixa_5');const carryBase=carryBox?carryBox.position.clone():null;
 const truckParts=[];root.traverse(o=>{if(/^Caminhao_/.test(o.name)&&o.isMesh)truckParts.push(o)});const truckBase=truckParts.map(o=>o.position.clone());
 const membranes=[];root.traverse(o=>{if(/^Filtro2_Membrana_/.test(o.name)){o.material.emissive=new THREE.Color(0x46d8ff);o.material.emissiveIntensity=0;membranes.push(o)}});
 const greens=[];root.traverse(o=>{if(o.isMesh&&/TuboVerde/.test(o.name)){o.material.emissive=new THREE.Color(0x9cff3a);greens.push(o)}});
 const windows=[];root.traverse(o=>{if(o.isMesh&&/Fabrica_Janela|Casa_Janela/.test(o.name)){const m=o.material.clone();patch(m,groupU[o.userData.group],false);m.emissive=new THREE.Color(0xffc47a);m.emissiveIntensity=.35;o.material=m;windows.push(o)}});

 // ---- pós-processamento ----
 const rt=new THREE.WebGLRenderTarget(2,2,{type:THREE.HalfFloatType,samples:mobile?0:4});
 const composer=new EffectComposer(renderer,rt);composer.addPass(new RenderPass(scene,camera));
 const bloom=new UnrealBloomPass(new THREE.Vector2(256,256),.55,.55,1.0);composer.addPass(bloom);
 composer.addPass(new OutputPass());
 const post=new ShaderPass({uniforms:{tDiffuse:{value:null},uRes:{value:new THREE.Vector2(1,1)},uFocusY:{value:.5},uBand:{value:.2},uBlur:{value:0},uVig:{value:.55},uGrain:{value:.028},uTime:{value:0},uLift:{value:0}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:POST_FS});
 composer.addPass(post);

 // ---- direção de câmera ----
 let aspect=1;
 function poseOf(id){const s=SHOTS[id];const port=aspect<.95&&(id==='overview'||id==='wide');return {id,t:s.t.clone(),az:port?-4:s.az,el:port?64:s.el,fov:s.fov,r:s.r,ry:s.ry||s.r*.85,roll:s.roll||0,drift:s.drift||0,push:s.push||0,focus:s.focus}}
 function distFor(p){const v=p.fov*D2R;const h=2*Math.atan(Math.tan(v/2)*aspect);return Math.max(p.r/Math.tan(h/2),p.ry/Math.tan(v/2))}
 const pathOf=name=>name&&flows[Object.keys(routeDef).find(k=>routeDef[k][0]===name)];
 function blendPose(a,b,q,seg){const e=(EASE[seg&&seg.ease]||EASE.cine)(q);const p={...b,t:a.t.clone().lerp(b.t,e)};
  if(seg&&seg.path){const f=pathOf(seg.path);if(f){const pa=f.path.getPointAt(0),pb=f.path.getPointAt(1),pq=f.path.getPointAt(e);
   const w=Math.sin(Math.PI*e);p.t.lerp(pq.clone().add(a.t.clone().sub(pa).multiplyScalar(1-e)).add(b.t.clone().sub(pb).multiplyScalar(e)),w*.85)}}
  let daz=b.az-a.az;p.az=a.az+daz*e;p.el=lerp(a.el,b.el,e);p.fov=lerp(a.fov,b.fov,e);
  p.r=Math.exp(lerp(Math.log(a.r),Math.log(b.r),e));p.ry=Math.exp(lerp(Math.log(a.ry),Math.log(b.ry),e));p.roll=lerp(a.roll,b.roll,e);p.drift=lerp(a.drift,b.drift,e);p.push=lerp(a.push,b.push,e);
  const arc=Math.sin(Math.PI*e)*((seg&&seg.crane)||0);p.el+=arc*30;p.r*=1+arc*1.1;p.ry*=1+arc*1.1;
  // pequeno "overshoot" de dolly na chegada
  const os=1-.03*Math.sin(Math.PI*clamp01((q-.72)/.28));p.r*=os;p.ry*=os;
  p.focusA=a.focus;p.focusB=b.focus;p.focusQ=smooth((q-.25)/.6);return p}
 function tourPose(time){let i=0;for(let k=1;k<TIMELINE.length;k++)if(time>=TIMELINE[k].at)i=k;
  const seg=TIMELINE[i],prev=i?TIMELINE[i-1]:seg,next=TIMELINE[i+1];
  const holdStart=seg.at+seg.dur,holdEnd=next?next.at:holdStart+12;
  let p;if(seg.dur&&time<holdStart){const prevPose=holdPose(poseOf(prev.shot),1,prev,time);p=blendPose(prevPose,poseOf(seg.shot),(time-seg.at)/seg.dur,seg)}
  else{p=holdPose(poseOf(seg.shot),clamp01((time-holdStart)/Math.max(.001,holdEnd-holdStart)),seg,time);p.focusA=p.focusB=p.focus;p.focusQ=1}
  return p}
 function holdPose(p,q,seg,time){const e=EASE.slowout(q);p.r*=1-p.push*e;p.ry*=1-p.push*e;p.az+=p.drift*(e-.5)*.6;return p}
 function punch(time){let v=0;for(const c of CUES){const d=time-c;if(d>-.12&&d<1.6)v=Math.max(v,d<0?1+d/.12:Math.exp(-d*2.6))}return v}

 // modo manual (cliques, arrasto, zoom)
 let manual=null;// {from,to,start,dur,orbAz,orbEl,zoom}
 const state={lastPose:null,roll:0,clock:0,t:0,hover:null};
 function setManual(id){const from=state.lastPose?{...state.lastPose,t:state.lastPose.t.clone()}:poseOf('overview');const to=poseOf(id);manual={from,to,start:state.clock,dur:reduced?.01:1.45,orbAz:0,orbEl:0,zoom:1,id}}
 function freeze(){if(manual)return;const p=state.lastPose;const to={...p,t:p.t.clone(),focus:p.focusQ>.5?p.focusB:p.focusA};manual={from:to,to,start:-9,dur:1,orbAz:0,orbEl:0,zoom:1,id:null}}
 function manualPose(){const q=clamp01((state.clock-manual.start)/manual.dur);const p=q<1?blendPose(manual.from,manual.to,q,{crane:.12}):{...manual.to,t:manual.to.t.clone(),focusA:manual.to.focus,focusB:manual.to.focus,focusQ:1};
  p.az+=manual.orbAz;p.el=Math.max(8,Math.min(80,p.el+manual.orbEl));p.r/=manual.zoom;p.ry/=manual.zoom;return p}

 // ---- rótulos HTML projetados ----
 const labelEls=LABELS.map(l=>{const el=document.createElement(l.id?'button':'div');el.className='lbl'+(l.id?' lbl--hot':' lbl--note');el.innerHTML=`<i></i><span>${l.lines.join('<br>')}</span>`;
  if(l.id){el.type='button';el.dataset.focus=l.id;el.setAttribute('aria-label','Aproximar: '+NAMES[l.id].toLowerCase())}labelsEl.appendChild(el);return {...l,el}});

 // ---- tamanho ----
 function resize(){const r=stage.getBoundingClientRect();const w=Math.max(2,r.width),h=Math.max(2,r.height);aspect=w/h;camera.aspect=aspect;camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio,dprCap));renderer.setSize(w,h,false);composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(w,h);
  bloom.resolution.set(w*.5,h*.5);post.uniforms.uRes.value.set(w*renderer.getPixelRatio(),h*renderer.getPixelRatio());pointsAll.forEach(p=>p.material.uniforms.uScale.value=h*renderer.getPixelRatio()*.5)}
 new ResizeObserver(resize).observe(stage);resize();

 const tmpV=new THREE.Vector3(),prevCam=new THREE.Vector3();let frameAvg=16,frames=0;
 function applyPose(p,dt){const dist=distFor(p);const az=p.az*D2R,el=p.el*D2R;
  let haz=0,hel=0;if(!reduced){const c=state.clock;haz=(Math.sin(c*.53)*.16+Math.sin(c*1.31+1.2)*.07);hel=Math.sin(c*.41+2.)*.11+Math.sin(c*1.07)*.05}
  const off=new THREE.Vector3(Math.sin(az+haz*D2R)*Math.cos(el+hel*D2R),Math.sin(el+hel*D2R),Math.cos(az+haz*D2R)*Math.cos(el+hel*D2R)).multiplyScalar(dist);
  camera.position.copy(p.t).add(off);camera.up.set(0,1,0);camera.lookAt(p.t);
  // banking: inclina na direção do deslocamento lateral, como uma grua/drone real
  const vel=tmpV.copy(camera.position).sub(prevCam);if(!state.init||vel.length()>dist*.4)vel.set(0,0,0);state.init=true;prevCam.copy(camera.position);
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
  const lat=dt>0?vel.dot(right)/dt/Math.max(4,dist):0;const target=reduced?0:Math.max(-.05,Math.min(.05,-lat*.11))+p.roll*D2R;
  state.roll+=(target-state.roll)*(1-Math.exp(-dt/.28));camera.rotateZ(state.roll);
  camera.fov=p.fov*(1-(reduced?0:.075*punch(state.t)));camera.updateProjectionMatrix();
  fogU.uFogNear.value=dist*1.35;fogU.uFogFar.value=dist*4.2;scene.fog.near=dist*1.35;scene.fog.far=dist*4.2;
  // foco do tilt-shift acompanha o alvo
  const sp=p.t.clone().project(camera);post.uniforms.uFocusY.value=lerp(post.uniforms.uFocusY.value,clamp01(sp.y*.5+.5),.2);
  const close=clamp01((14-p.r)/11)*(p.r<2.6?.75:1);post.uniforms.uBlur.value=reduced?0:(mobile?.5:.85)*(.15+close*.7);post.uniforms.uBand.value=.2+(1-close)*.22;
  return dist}

 const focusCenters={};for(const [k,v] of Object.entries(data.bounds)){const mn=B(v.min[0],v.min[1],v.min[2]),mx=B(v.max[0],v.max[1],v.max[2]);
  const c=mn.clone().add(mx).multiplyScalar(.5);focusCenters[k]={c,rad:Math.max(Math.abs(mx.x-mn.x),Math.abs(mx.z-mn.z))*.62}}
 focusCenters.lake.rad=5.6;focusCenters.factory.rad=4.9;

 function render(dt,s){
  state.clock+=dt;state.t=s.t;const T=state.clock;const v=s.visual;
  // pose
  const pose=manual?manualPose():tourPose(s.t);state.lastPose=pose;const dist=applyPose(pose,dt);
  // destaque de etapa
  const fa=pose.focusA===undefined?pose.focus:pose.focusA,fb=pose.focusB===undefined?pose.focus:pose.focusB,fq=pose.focusQ??1;
  const active={};(FOCUS_SETS[fa]||[]).forEach(g=>active[g]=(active[g]||0)+(1-fq));(FOCUS_SETS[fb]||[]).forEach(g=>active[g]=(active[g]||0)+fq);
  const anyFocus=(fa?1-fq:0)+(fb?fq:0);
  for(const [g,u] of Object.entries(groupU)){const a=Math.min(1,active[g]||0);let d=anyFocus*(1-a)*(g==='pipes'?.42:g==='other'?.5:.66);if(s.overview)d=0;
   const hov=s.hover===g?.55:0;const glowT=a*anyFocus*.32+hov;u.dim+=(d-u.dim)*(1-Math.exp(-dt/.45));u.glow+=(glowT-u.glow)*(1-Math.exp(-dt/.35));u.uDim.value=u.dim;u.uGlow.value=u.glow*(.75+.25*Math.sin(T*2.4))}
  const fk=(fb&&fq>.5?fb:fa)||null;const fc=fk&&focusCenters[FOCUS_SETS[fk]?FOCUS_SETS[fk][0]:fk];
  const fOp=fc&&!s.overview?anyFocus*.9:0;focusDisc.material.opacity+=(fOp*.55-focusDisc.material.opacity)*(1-Math.exp(-dt/.4));focusGlow.material.opacity=focusDisc.material.opacity*1.2;
  if(fc){focusDisc.position.x=lerp(focusDisc.position.x,fc.c.x,1-Math.exp(-dt/.3));focusDisc.position.z=lerp(focusDisc.position.z,fc.c.z,1-Math.exp(-dt/.3));
   const sc=fc.rad*(1+.04*Math.sin(T*2));focusDisc.scale.setScalar(lerp(focusDisc.scale.x,sc,1-Math.exp(-dt/.3)));focusGlow.position.copy(focusDisc.position);focusGlow.scale.setScalar(focusDisc.scale.x*1.25)}
  // água
  waters.forEach(w=>w.uTime.value=T);
  const purity=smooth((v-12)/9),turb=s.overview?0:.85*(1-purity)*smooth((v-1.5)/3);chemW.uTurb.value=turb;
  chemW.uScan.value=s.chapter===1?((s.t-16)/12.7)*1.15%1.15:-1;chemW.uInletAmt.value=flows.chemin.amt;bioW.uInletAmt.value=flows.bioin.amt;lakeW.uInletAmt.value=flows.lake.amt*1.2;
  bioW.uBubbles.value=s.overview?.35:smooth((v-4)/3);
  // fluxos
  for(const [k,f] of Object.entries(flows)){const on=s.overview?.55:smooth((s.t-FLOW_AT[k])/1.6);f.amt+=(on-f.amt)*(1-Math.exp(-dt/.25));f.u.uAmt.value=f.amt;f.u.uTime.value=T;
   const m=new THREE.Matrix4(),sp=k==='storagein'?.95:1.35;for(let i=0;i<f.n;i++){const q=((T*sp/f.len)+i/f.n)%1;const pp=f.path.getPointAt(q);const sc=f.amt*(reduced?0:1)*(.8+.35*Math.sin(i*1.7+T*3));m.makeScale(sc,sc,sc).setPosition(pp);f.inst.setMatrixAt(i,m)}
   f.inst.instanceMatrix.needsUpdate=true;f.inst.material.opacity=Math.min(1,f.amt*1.2)}
  // sedimentos (descendo e sumindo conforme a água clareia)
  {const a=sediment.geometry.attributes;for(let i=0;i<46;i++){const [ang,rr,ph]=sedSeed[i];const life=(T*.18+ph)%1;a.position.setXYZ(i,1+Math.cos(ang+T*.05)*rr,1.31-life*.03,-5.6+Math.sin(ang+T*.05)*rr*.98);a.aA.setX(i,turb*(1-life)*.85);a.aSz.setX(i,.7+ph)}a.position.needsUpdate=a.aA.needsUpdate=a.aSz.needsUpdate=true}
  // vapor da fábrica e escape do caminhão
  {const a=vapor.geometry.attributes,src=[B(-8.45,6.0,4.05),B(-6.05,6.3,4.05)];for(let i=0;i<26;i++){const life=(T*.13+i/26)%1;const o=src[i%2];
   a.position.setXYZ(i,o.x+life*1.6+Math.sin(T*.7+i)*.18,o.y+life*2.8,o.z-life*.5);a.aA.setX(i,(1-life)*smooth(life*6)*.32);a.aSz.setX(i,.5+life*1.9)}a.position.needsUpdate=a.aA.needsUpdate=a.aSz.needsUpdate=true}
  {const a=exhaust.geometry.attributes,o=B(-10.3,3.32,1.95);for(let i=0;i<10;i++){const life=(T*.6+i/10)%1;a.position.setXYZ(i,o.x+life*.5,o.y+life*.7,o.z+life*.25);a.aA.setX(i,(1-life)*.35);a.aSz.setX(i,.6+life*1.6)}a.position.needsUpdate=a.aA.needsUpdate=a.aSz.needsUpdate=true}
  // poeira em suspensão (profundidade)
  {const a=dust.geometry.attributes;for(let i=0;i<dustSeed.length;i++){const [x,y,z,p]=dustSeed[i];a.position.setXYZ(i,x+Math.sin(T*.11+p)*1.2,y+Math.sin(T*.23+p*2)*.5,z+Math.cos(T*.09+p)*1.1);a.aA.setX(i,.22+.18*Math.sin(T*.8+p*3))}a.position.needsUpdate=a.aA.needsUpdate=true}
  // respingos: descarte na rede pública + entrada do lago
  {const a=splash.geometry.attributes;const outs=[[flows.public.end,flows.public.amt],[flows.lake.end,flows.lake.amt]];for(let i=0;i<40;i++){const [s0,ang,ph]=splSeed[i];const [o,amt]=outs[i%2];const life=(T*1.3+ph)%1;
   const r=life*.42;a.position.setXYZ(i,o.x+Math.cos(ang)*r,Math.max(.04,o.y+.05+life*.45-life*life*.9),o.z+Math.sin(ang)*r);a.aA.setX(i,amt*(1-life)*.9)}a.position.needsUpdate=a.aA.needsUpdate=true}
  // reservatório
  const stored=s.overview?1:smooth((v-36)/6);const lvl=s.chapter>=3||s.overview?stored:0;
  glassMat.uniforms.uLevel.value=lvl;glassMat.uniforms.uTime.value=T;glassMat.uniforms.uAmt.value+=(((s.chapter===3)?1:.35)-glassMat.uniforms.uAmt.value)*(1-Math.exp(-dt/.4));
  levelRing.position.y=lerp(stBot,stTop,lvl);levelRing.material.opacity=(s.chapter===3?.9:.25)*(.7+.3*Math.sin(T*3));
  // membranas: onda de luz atravessando as colunas enquanto a água passa
  const mem=Math.max(flows.filtration.amt*(s.chapter===2?1:.35),0);membranes.forEach((o,i)=>{const col=+o.name.split('_')[2]||0,row=+o.name.split('_')[3]||0;
   o.material.emissiveIntensity=mem*Math.pow(.5+.5*Math.sin(T*3.2-row*.7-col*.5),6)*1.6});
  const gr=(s.chapter===2?1:.25)*flows.chemout.amt;greens.forEach(o=>o.material.emissiveIntensity=gr*(.35+.35*Math.sin(T*2.6)));
  windows.forEach((o,i)=>o.material.emissiveIntensity=.3+.12*Math.sin(T*.7+i));
  // peixes nadando
  fish.forEach(f=>{const a=T*f.sp*f.dir+f.ph;const c=B(.8,-7.8,.29);const x=c.x+Math.cos(a)*f.rx,z=c.z+Math.sin(a)*f.rz;f.o.position.set(x,f.base.y+Math.sin(T*2+f.ph)*.008,z);
   const hx=-Math.sin(a)*f.rx*f.dir,hz=Math.cos(a)*f.rz*f.dir;f.o.rotation.set(0,-Math.atan2(hz,hx)+Math.sin(T*9+f.ph)*.08,0);
   if(f.tail)f.tail.quaternion.copy(f.tq).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.sin(T*9+f.ph)*.4))});
  // trabalhador levando caixas até o caminhão
  {const cyc=(T*.16)%1;const go=cyc<.5;const q=go?smooth(cyc/.5):1-smooth((cyc-.5)/.5);const dx=-1.05*q,dz=-.35*q;const bob=Math.abs(Math.sin(T*7))*.025;
   worker.forEach((o,i)=>{o.position.set(workerBase[i].x+dx,workerBase[i].y+bob,workerBase[i].z+dz)});
   if(carryBox){carryBox.visible=go&&q<.97;carryBox.position.set(workerBase[0].x+dx-.14,workerBase[0].y+.05+bob,workerBase[0].z+dz)}}
  // caminhão: motor ligado
  truckParts.forEach((o,i)=>{o.position.y=truckBase[i].y+Math.sin(T*38)*.004});
  wind.value=T;
  // rótulos
  const showAll=s.labels&&(s.overview||pose.r>9.5);const sr=stage.getBoundingClientRect(),stageW=sr.width,stageH=sr.height;
  labelEls.forEach(l=>{const p=l.at.clone().project(camera);const vis=p.z<1&&Math.abs(p.x)<1.08&&Math.abs(p.y)<1.08;
      const near=l.id&&(fk===l.id||(fk==='tanks'&&(l.id==='chem'||l.id==='bio'))||(fk==='reuse'&&l.key==='reuse'));
   const on=s.labels&&vis&&(showAll||near||(!l.id&&fk==='reuse'&&l.key==='reuse'));
   l.el.style.left=((p.x+1)/2*100).toFixed(2)+'%';l.el.style.top=((1-p.y)/2*100).toFixed(2)+'%';
   l._on=!!on;l._x=(p.x+1)/2*stageW;l._y=(1-p.y)/2*stageH;l._pri=near?0:l.id?1:2;l.el.classList.toggle('is-focus',!!near&&!showAll);});
  // evita sobreposição: rótulos de maior prioridade primeiro
  const placed=[];[...labelEls].sort((a,b)=>a._pri-b._pri).forEach(l=>{let on=l._on;if(on){if(!l._w){const sp=l.el.querySelector('span');l._w=sp.offsetWidth||90;l._h=sp.offsetHeight||22}
    const r={x:l._x-10,y:l._y-28-l._h,w:l._w,h:l._h};const sx=Math.min(0,stageW-8-(r.x+r.w))+Math.max(0,8-r.x);r.x+=sx;if(l._sx!==sx){l.el.querySelector('span').style.translate=sx+'px 0';l._sx=sx}if(placed.some(q=>r.x<q.x+q.w+6&&r.x+r.w+6>q.x&&r.y<q.y+q.h+4&&r.y+r.h+4>q.y))on=false;else placed.push(r)}
   if(on!==l._shown){l.el.classList.toggle('is-on',on);l._shown=on;if(!on)l._w=0}});
  // render + desempenho adaptativo
  post.uniforms.uTime.value=T;composer.render(dt);
  frames++;frameAvg=frameAvg*.95+dt*1000*.05;if(frames>90&&frameAvg>30&&dprCap>1){dprCap=Math.max(1,dprCap-.25);resize();frames=0}
  return {dist,r:pose.r,overR:SHOTS.overview.r}
 }
 // picking
 const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
 function pick(x,y){const r=canvas.getBoundingClientRect();ndc.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObjects(meshes,false)[0];if(!hit)return null;const g=hit.object.userData.group;return NAMES[g]?g:null}
 return {render,pick,setManual,
  clearManual(){manual=null},
  get manual(){return manual},
  orbit(dx,dy){freeze();manual.orbAz-=dx*.22;manual.orbEl+=dy*.16},
  zoom(f){freeze();const base=manual.to.r;manual.zoom=Math.max(base/(SHOTS.overview.r*1.08),Math.min(base/1.1,manual.zoom*f))},
  get zoomLevel(){const p=state.lastPose;return p?SHOTS.overview.r/p.r:1},
  shots:SHOTS,timeline:TIMELINE,get debug(){return {fd:focusDisc.material.opacity,fdp:focusDisc.position.toArray(),fds:focusDisc.scale.x,pose:state.lastPose&&{id:state.lastPose.id,fa:state.lastPose.focusA,fb:state.lastPose.focusB}}}};
}
