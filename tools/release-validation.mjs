import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
fs.mkdirSync('artifacts',{recursive:true});
const baseURL=process.env.NEON_RELEASE_URL||'http://127.0.0.1:5180';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});const page=await context.newPage(),errors=[],checks=[],responses=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());if(r.url().endsWith('geometry.bin'))responses.push({url:r.url(),encoding:r.headers()['content-encoding']});});
const check=(name,result)=>{assert.ok(result,name);checks.push(name);console.log('PASS',name);};
try{
 await page.goto(baseURL+'/?test=1');await page.waitForFunction(()=>window.neonRequiem?.getStatus().ready,{},{timeout:60000});await page.waitForTimeout(500);await page.screenshot({path:'artifacts/release-opening.png'});
 check('packaged assets load with Brotli compression',responses[0]?.encoding==='br');
 check('production build contains no mutable test bridge',await page.evaluate(()=>typeof window.__neonTest==='undefined'));
 await page.locator('[data-action="page:settings"]').click();
 let chooserPromise=page.waitForEvent('filechooser');await page.locator('[data-action="restore"]').click();let chooser=await chooserPromise;await chooser.setFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});await page.waitForTimeout(100);
 check('invalid save leaves bank unchanged',await page.evaluate(()=>window.neonRequiem.getStatus().profileBank===0));
 chooserPromise=page.waitForEvent('filechooser');await page.locator('[data-action="restore"]').click();chooser=await chooserPromise;await chooser.setFiles({name:'test-save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,bank:321,vitality:2,skills:[0],weapons:[1,0,0,0,0,0],loadout:0}))});await page.waitForFunction(()=>window.neonRequiem.getStatus().profileBank===321);
 check('save restore works in the packaged build',true);
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const download=await downloadPromise;await download.saveAs('artifacts/test-save-backup.json');const saved=JSON.parse(fs.readFileSync('artifacts/test-save-backup.json','utf8'));check('save backup preserves the restored training',saved.bank===321&&saved.vitality===2&&saved.skills[0]===0);
 await page.locator('[data-setting="quality"]').selectOption('low');await page.waitForTimeout(200);await page.locator('[data-setting="quality"]').selectOption('high');await page.locator('[data-action="back"]').click();
 await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.neonRequiem.getStatus().screen===null);await page.keyboard.down('KeyD');await page.waitForTimeout(450);await page.keyboard.press('Space');await page.keyboard.up('KeyD');await page.mouse.click(650,470,{button:'right'});await page.mouse.move(700,420);await page.mouse.down();await page.waitForTimeout(1000);await page.mouse.up();await page.keyboard.press('KeyF');await page.keyboard.press('Tab');
 const before=await page.evaluate(()=>window.neonRequiem.getStatus().frames);await page.waitForTimeout(7000);const after=await page.evaluate(()=>window.neonRequiem.getStatus().frames);check('release keeps rendering during real mouse and keyboard play',after-before>100);
 await page.screenshot({path:'artifacts/release-combat.png'});await page.keyboard.press('Escape');await page.locator('[data-action="page:help"]').click();await page.locator('[data-action="helpTab:3"]').click();await page.setViewportSize({width:1024,height:768});await page.screenshot({path:'artifacts/release-help.png'});
 check('release supports pause, help and window resizing',await page.locator('.help-content').isVisible());
 check('no production runtime, shader or failed-resource errors',errors.length===0);
 fs.writeFileSync('artifacts/release-validation.json',JSON.stringify({passed:true,checks,errors,frameDelta:after-before,assetTransfer:responses},null,2));
}catch(e){console.error(e);await page.screenshot({path:'artifacts/release-failure.png'});fs.writeFileSync('artifacts/release-validation.json',JSON.stringify({passed:false,checks,errors,error:e.stack},null,2));process.exitCode=1;}finally{await browser.close();}
