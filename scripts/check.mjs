import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const html=await readFile(path.join(root,'src/index.html'),'utf8');
assert(html.includes('<html lang="pt-BR">'),'Idioma da página ausente.');
for(const file of ['boot.js','app.js','intro.js','scene3d.js'])execFileSync(process.execPath,['--check',path.join(root,'src',file)],{stdio:'inherit'});
for(const match of html.matchAll(/(?:src|href)="\.\/assets\/([^"#]+)"/g)){
 const name=match[1];const base=/\.(?:js|css)$/.test(name)&&!name.startsWith('vendor/')?'src':'assets';
 await access(path.join(root,base,name));
}
for(const file of ['index.html','app.js','intro.js','boot.js','styles.css','scene3d.js']){
 const body=await readFile(path.join(root,'src',file),'utf8');
 assert(!/\/Users\/|\/var\/folders\/|file:\/\//.test(body),'Referência a arquivo local em '+file);
}
const image=await readFile(path.join(root,'assets/illustration.webp'));
assert.equal(image.subarray(8,12).toString(),'WEBP','Ilustração WebP inválida.');
const audio=await readFile(path.join(root,'assets/narration.mp3'));
assert(audio.length>100000,'Narração incompleta.');
const app=await readFile(path.join(root,'src/app.js'),'utf8');
assert(!/speechSynthesis|SpeechSynthesisUtterance/.test(app),'Voz sintetizada não deveria estar presente.');
assert(app.includes('narration.currentTime'),'O áudio deve controlar a animação.');
const engine=await readFile(path.join(root,'src/scene3d.js'),'utf8');
assert(engine.includes("shot:'factory_open'"),'Abertura na fábrica ausente.');
for(const name of ['scene.glb','scene_data.json','vendor/three/three.module.min.js','vendor/three/addons/loaders/GLTFLoader.js','vendor/three/addons/libs/draco/gltf/draco_decoder.wasm'])await access(path.join(root,'assets',name));
const glb=await readFile(path.join(root,'assets/scene.glb'));assert.equal(glb.subarray(0,4).toString(),'glTF','Cena GLB inválida.');
console.log('Verificação concluída: fontes válidas, assets locais e narração sincronizada.');
