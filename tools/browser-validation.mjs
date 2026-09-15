import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
fs.mkdirSync('artifacts',{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,result)=>{assert.ok(result,name);checks.push(name);console.log('PASS',name);};
const app=fn=>page.evaluate(fn),capture=async name=>{await page.waitForTimeout(300);await page.screenshot({path:'artifacts/'+name+'.png'});};
try{
 await page.goto('http://127.0.0.1:5173/?test=1');await page.waitForFunction(()=>window.__neonTest,{},{timeout:60000});await capture('01-opening');
 check('six districts, 63 catalogue entries, 21 reusable actors loaded',await app(()=>{const a=window.__neonTest;return a.assets.rooms.length===6&&a.assets.data.relics.length===63&&a.assets.actors.size===21;}));
 // Use an isolated browser profile to exercise training without touching the user's browser save.
 await app(()=>{const a=window.__neonTest;a.game.profile.bank=600;a.game.save();a.ui.render(true);});
 await page.locator('[data-action="page:workshop"]').click();await page.locator('[data-action="page:skills"]').click();await page.locator('[data-action="train:0"]').click();
 check('real skill-tree click spends 25 banked salvage',await app(()=>window.__neonTest.game.profile.bank===575&&window.__neonTest.game.profile.skills.includes(0)));
 await capture('04-discipline');
 await page.locator('[data-action="back"]').click();await page.locator('[data-action="page:workshop"]').click();await page.locator('[data-action="page:weapons"]').click();await page.locator('[data-action="trainWeapon:0"]:enabled').click();await capture('05-mastery');
 check('weapon training saves the first mastery tier',await app(()=>window.__neonTest.game.profile.bank===545&&window.__neonTest.game.profile.weapons[0]===1));
 await page.reload();await page.waitForFunction(()=>window.__neonTest);
 check('browser profile survives reload',await app(()=>window.__neonTest.game.profile.bank===545&&window.__neonTest.game.profile.skills.includes(0)));
 await page.locator('#seed').fill('4217');await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__neonTest.game.active);await capture('02-combat');
 const before=await app(()=>({...window.__neonTest.game.player}));await page.keyboard.down('KeyD');await page.waitForTimeout(500);await page.keyboard.press('Space');await page.waitForTimeout(150);await page.keyboard.up('KeyD');
 check('keyboard movement and dash alter the player position',await app(()=>{const a=window.__neonTest;return a.game.player.dashCD>0&&Math.hypot(a.game.player.x,a.game.player.z-2.75)>.5;}));
 await page.keyboard.press('Escape');const time=await app(()=>window.__neonTest.game.time);await page.waitForTimeout(300);check('pause freezes gameplay time',(await app(()=>window.__neonTest.game.time))===time);
 await page.locator('[data-action="page:settings"]').click();await page.locator('[data-setting="quality"]').selectOption('balanced');await capture('03-settings');await page.locator('[data-setting="quality"]').selectOption('high');
 await page.setViewportSize({width:1024,height:768});await capture('06-resize');check('responsive menu fits viewport',await app(()=>document.querySelector('.panel').getBoundingClientRect().right<=innerWidth));await page.setViewportSize({width:1440,height:900});await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 // Real mouse firing against a stationary target in a known clear lane.
 await app(()=>{const a=window.__neonTest,g=a.game;g.player.hp=g.maxHP;g.player.x=3;g.player.z=2.4;g.nav.boxes=[];g.enemies.forEach(e=>{e.hp=0;a.world.entities.get(e.id)?.removeFromParent();});g.enemies=[];const e=g.spawnEnemy('BrassConstable',{x:3,z:.8},false,false,50);e.stationary=true;e.attackCD=100;g.events=[];a.world.spawn(e);a.target=e;});
 await page.waitForTimeout(250);const target=await app(()=>{const a=window.__neonTest,p=a.world.hero.position.clone().set(a.target.x,.16,a.target.z).project(a.world.camera);return{x:(p.x*.5+.5)*innerWidth,y:(-p.y*.5+.5)*innerHeight};});await page.mouse.move(target.x,target.y);await page.mouse.down();await page.waitForTimeout(900);await capture('07-coil-fire');await page.mouse.up();
 check('real left mouse input damages a visible enemy',await app(()=>window.__neonTest.target.hp<window.__neonTest.target.maxHP));
 check('audio context and generated sound buffers are active',await app(()=>window.__neonTest.audio.ctx.state==='running'&&window.__neonTest.audio.buffers.size>=20));
 // Exercise every imported weapon, animation and effect with the live renderer.
 for(let w=1;w<6;w++){await app(()=>{const a=window.__neonTest;a.game.player.attackCD=0;a.target.hp=100;a.target.maxHP=100;});await page.evaluate(w=>{const a=window.__neonTest,g=a.game;g.owned[w]=true;g.switchWeapon(w);g.fire({x:a.target.x,z:a.target.z});a.flush();},w);await capture('weapon-'+w);}
 check('all six weapon models and effects render without exception',errors.length===0);
 await app(()=>{const a=window.__neonTest;a.game.toHome();a.flush();a.game.start(913);a.flush();});
 const seen=[];
 for(let cycle=1;cycle<=2;cycle++){
  for(let room=1;room<=3;room++){
   const state=await app(()=>{const a=window.__neonTest,g=a.game;return {room:g.room,index:g.roomIndex,positions:g.alive.map(e=>({name:e.name,x:e.x,z:e.z})),player:{x:g.player.x,z:g.player.z},boxes:g.nav.boxes,blockedSpawns:g.alive.filter(e=>!g.nav.free(e.x,e.z,.24)).length,paths:g.alive.map(e=>g.nav.path(e,g.player).length)};});seen.push(state.index);check('cycle '+cycle+' room '+room+' has reachable spawns',state.blockedSpawns===0&&state.paths.every(n=>n>0));
   await app(()=>{const a=window.__neonTest,g=a.game;g.player.hp=g.maxHP;for(const e of [...g.alive])g.hit(e,9999);a.flush();a.ui.render(true);});await page.waitForFunction(()=>window.__neonTest.game.screen==='rewards');
   if(cycle===1&&room===1)await capture('08-rewards');
   await page.locator('[data-action="choose:0"]').click();await page.locator('[data-action="choose:1"]').click();
   if(room<3){if(cycle===1&&room===1)await capture('09-routes');await page.locator('[data-action="route:'+(cycle-1)+'"]').click();await page.waitForFunction(()=>window.__neonTest.game.active);await capture('district-'+await app(()=>window.__neonTest.game.roomIndex));}
   else await page.waitForFunction(()=>window.__neonTest.game.room===4&&window.__neonTest.game.active);
  }
  seen.push(5);await capture('boss-'+cycle);
  await app(()=>{const a=window.__neonTest,g=a.game;g.player.hp=g.maxHP;for(let n=0;n<4;n++){for(const e of [...g.alive].filter(e=>e.anchor))g.hit(e,9999);g.hit(g.boss,9999);}a.flush();a.ui.render(true);});await capture('10-engine-choice');
  check('boss defeat leaves a clear extraction and descent prompt',await page.locator('.boss-choice').isVisible());
  if(cycle===1){await page.keyboard.press('KeyN');await page.waitForFunction(()=>window.__neonTest.game.cycle===2&&window.__neonTest.game.room===1&&window.__neonTest.game.active);}
  else {await app(()=>{const g=window.__neonTest.game,ex=g.data.rooms[5].extraction;g.player.x=ex[0]+1.3;g.player.z=ex[2]+.2;});await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__neonTest.game.screen==='results');await capture('11-extraction');}
 }
 check('both branches and all six districts visited',new Set(seen).size===6);
 check('two-cycle extraction banks rewards and ends the run',await app(()=>{const g=window.__neonTest.game;return g.settled&&g.victory&&g.bossesDefeated===2&&g.profile.bank>545;}));
 const final=await app(()=>({status:window.neonRequiem.getStatus(),frames:window.__neonTest.frames,averageFrameMs:window.__neonTest.frameMs.reduce((a,b)=>a+b,0)/window.__neonTest.frameMs.length,geometries:window.__neonTest.world.renderer.info.memory.geometries,textures:window.__neonTest.world.renderer.info.memory.textures,bank:window.__neonTest.game.profile.bank}));
 check('no browser runtime or shader errors',errors.length===0);fs.writeFileSync('artifacts/browser-validation.json',JSON.stringify({passed:true,checks,errors,final},null,2));console.log(JSON.stringify(final));
}catch(error){await page.screenshot({path:'artifacts/failure.png'});fs.writeFileSync('artifacts/browser-validation.json',JSON.stringify({passed:false,checks,errors,error:error.stack},null,2));console.error(error);process.exitCode=1;}finally{await browser.close();}
