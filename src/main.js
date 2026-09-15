import './style.css';
import {Assets} from './assets.js';
import {Game} from './game.js';
import {World} from './world.js';
import {UI} from './ui.js';
import {AudioSystem} from './audio.js';
import {cleanProfile,defaultProfile,clamp} from './rules.js';
const SAVE='NeonRequiem.Three.LivingCity.v1';
let app;
const fail=error=>{console.error(error);document.querySelector('#ui').classList.add('open');document.querySelector('#ui').innerHTML='<section class="pause panel"><p class="eyebrow">SIGNAL INTERRUPTED</p><h1>The City Could Not Load</h1><p id="failure"></p><button id="retry">Retry Connection</button><p class="muted">Your banked progression is kept in this browser.</p></section>';document.querySelector('#failure').textContent=error.message||String(error);document.querySelector('#retry').onclick=()=>location.reload();};
async function main(){
 const assets=new Assets();await assets.load((p,text)=>{document.querySelector('#load-progress').value=p;document.querySelector('#load-status').textContent=text;});
 let profile;try{profile=cleanProfile(JSON.parse(localStorage.getItem(SAVE)));}catch{profile=defaultProfile();}
 const game=new Game(assets.data,profile,()=>{try{localStorage.setItem(SAVE,JSON.stringify(profile));}catch{game.notice('Browser storage is unavailable. Use Settings → Back Up Browser Save.');}});
 const world=new World(document.querySelector('#world'),assets,game),audio=new AudioSystem(assets.data.audio,profile.settings),ui=new UI(game,world,audio);
 const keys=new Set(),input={move:{x:0,z:0},aim:{x:0,z:-1},fire:false,sprint:false};let mouse={x:innerWidth*.6,y:innerHeight*.45};
 const flush=()=>{let safety=0;while(game.events.length&&safety++<1000){const e=game.events.shift();world.event(e);if(e.type==='sound')audio.play(e.key,e);if(e.type==='notice'){const el=document.querySelector('#toast');el.textContent=e.text;el.classList.add('show');clearTimeout(app?.toastTimer);if(app)app.toastTimer=setTimeout(()=>el.classList.remove('show'),3500);}}};
 const canvas=document.querySelector('#world');
 canvas.addEventListener('pointermove',e=>{mouse={x:e.clientX,y:e.clientY};input.aim=world.aim(mouse.x,mouse.y);});
 canvas.addEventListener('pointerdown',e=>{if(game.blocked)return;audio.unlock();input.aim=world.aim(e.clientX,e.clientY);if(e.button===0){input.fire=true;canvas.setPointerCapture(e.pointerId);}if(e.button===2){game.destination=game.nav.nearest(input.aim);game.path=[];}});
 window.addEventListener('pointerup',e=>{if(e.button===0)input.fire=false;});
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('wheel',e=>{e.preventDefault();if(!game.blocked){world.zoom=clamp(world.zoom+e.deltaY*.006,2.1,8.4);world.resize();}},{passive:false});
 window.addEventListener('keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(['Tab','Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;
  if(e.code==='Escape'){input.fire=false;ui.escape();}
  else if(e.code==='KeyI'&&game.started&&!game.settled){if(game.screen==='ledger')ui.action('resume');else if(!game.blocked)ui.action('page:ledger');}
  else if(e.code==='KeyG'){if(game.screen==='tithe')game.screen='rewards';else game.openTithe();}
  else if(e.code.startsWith('Digit')){const i=Number(e.code.slice(-1))-1;if(game.screen==='rewards')game.choose(i);else if(game.screen==='route')game.selectRoute(i);}
  else if(!game.blocked){if(e.code==='Space')game.dash(world.moveVector(keys));if(e.code==='KeyF')game.skillCast();if(e.code==='Tab')game.switchWeapon();if(e.code==='KeyE'&&!e.altKey)game.interact();if(e.code==='KeyN')game.descend();if(e.code==='KeyC')world.follow=!world.follow;}
  else if(e.code==='Enter'&&game.screen==='home'){audio.unlock();game.start();}
  else if(e.code==='KeyR'&&game.screen==='results')game.toHome();
  flush();ui.render();
 });
 window.addEventListener('keyup',e=>keys.delete(e.code));
 const unfocus=()=>{keys.clear();input.fire=false;if(game.active){ui.returnPage=null;game.screen='pause';ui.render();}};
 window.addEventListener('blur',unfocus);document.addEventListener('visibilitychange',()=>{if(document.hidden)unfocus();audio.muteHidden(document.hidden);});
 window.addEventListener('resize',()=>world.resize());
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();unfocus();fail(Error('The browser graphics device was reset. Reload to reconnect; banked training is safe.'));});
 ui.render(true);flush();
 app={game,world,assets,ui,audio,input,keys,flush,frames:0,frameMs:[],ready:true};
 window.neonRequiem=Object.freeze({getStatus:()=>({ready:true,frames:app.frames,screen:game.screen,room:game.roomIndex,depth:game.depth||0,enemies:game.alive.length,renderer:world.renderer.info.render,drawCalls:world.renderer.info.render.calls,profileBank:profile.bank})});
 if(import.meta.env.DEV&&new URLSearchParams(location.search).has('test'))window.__neonTest=app;
 let last=performance.now(),uiAt=0;
 const frame=now=>{const dt=Math.min(.05,(now-last)/1000);last=now;try{
  input.aim=world.aim(mouse.x,mouse.y);input.move=world.moveVector(keys);input.sprint=keys.has('ShiftLeft')||keys.has('ShiftRight');
  game.update(dt,input);flush();world.update(dt,keys,input);audio.update(game,input.fire);
  if(now-uiAt>90){uiAt=now;ui.render();}app.frames++;app.frameMs.push(dt*1000);if(app.frameMs.length>600)app.frameMs.shift();
  requestAnimationFrame(frame);
 }catch(error){fail(error);}};
 requestAnimationFrame(frame);
}
main().catch(fail);
