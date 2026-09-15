import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),args=process.argv.slice(2);const value=k=>args[args.indexOf(k)+1];
const root=path.resolve(args.includes('--root')?value('--root'):here),port=Number(args.includes('--port')?value('--port'):5180);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.bin':'application/octet-stream','.webp':'image/webp','.png':'image/png','.wav':'audio/wav','.ogg':'audio/ogg','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{let requestPath;try{requestPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end('Invalid URL');return;}
 if(requestPath==='/__neon_health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({app:'neon-requiem-three',version:'1.0.0'}));return;}
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
 let file=path.resolve(root,'.'+(requestPath==='/'?'/index.html':requestPath));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end('Not found');return;}
 let encoding='',chosen=file;const accept=req.headers['accept-encoding']||'';if(accept.includes('br')&&fs.existsSync(file+'.br')){chosen=file+'.br';encoding='br';}else if(accept.includes('gzip')&&fs.existsSync(file+'.gz')){chosen=file+'.gz';encoding='gzip';}
 const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':fs.statSync(chosen).size,'Cache-Control':file.endsWith('index.html')?'no-cache':'public, max-age=3600','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Vary':'Accept-Encoding'};
 if(encoding)headers['Content-Encoding']=encoding;res.writeHead(200,headers);if(req.method==='HEAD')res.end();else fs.createReadStream(chosen).pipe(res);
});server.on('error',e=>{console.error('Neon Requiem could not open port '+port+': '+e.message);process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log('Neon Requiem is ready: http://127.0.0.1:'+port));
