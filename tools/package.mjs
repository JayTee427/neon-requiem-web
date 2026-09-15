import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist'),release=path.resolve(root,'release/NeonRequiemWeb');
if(!release.startsWith(path.resolve(root,'release')+path.sep))throw Error('Invalid release folder');
fs.mkdirSync(release,{recursive:true});
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const admitted=[];let bytes=0,transfer=0;
for(const file of walk(dist)){const rel=path.relative(dist,file);if(rel.endsWith('.meta')||/^content[\\/]textures[\\/].+\.png$/.test(rel))continue;
 const target=path.join(release,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);admitted.push(rel.replaceAll('\\','/'));bytes+=fs.statSync(file).size;
 if(/\.(bin|json|js|css|html)$/.test(file)){const compressed=zlib.brotliCompressSync(fs.readFileSync(file),{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:6}});fs.writeFileSync(target+'.br',compressed);transfer+=compressed.length;}else transfer+=fs.statSync(file).size;
}
for(const name of ['serve.mjs','Launch Web Game.ps1','Launch Neon Requiem.cmd'])fs.copyFileSync(path.join(root,'tools',name),path.join(release,name));
fs.copyFileSync(path.join(root,'README.md'),path.join(release,'README.md'));fs.copyFileSync(path.join(root,'node_modules/three/LICENSE'),path.join(release,'THREE-LICENSE.txt'));
fs.copyFileSync(path.join(root,'LICENSE'),path.join(release,'LICENSE'));
fs.cpSync(path.join(root,'docs'),path.join(release,'docs'),{recursive:true});
fs.writeFileSync(path.join(release,'release-manifest.json'),JSON.stringify({game:'Neon Requiem',edition:'Three.js / Living City',version:'1.0.0',generated:new Date().toISOString(),files:admitted,uncompressedBytes:bytes,estimatedCompressedTransferBytes:transfer},null,2));
console.log(JSON.stringify({release,files:admitted.length,uncompressedMB:(bytes/1e6).toFixed(1),compressedTransferMB:(transfer/1e6).toFixed(1)}));
