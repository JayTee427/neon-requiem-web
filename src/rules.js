export const WEAPONS=['Mourning Coil','Arc Saber','Pressure Scattergun','Funeral Rail','Cinder Sprayer','Tesla Loom'];
export const INTERVALS=[.23,.58,.72,.95,.22,.48];
export const MODS=[[49,48,7],[50,51,38],[53,52,22],[55,54,7],[56,57,11],[59,58,31]];
export const NODE_RELICS=[7,39,22,49,38,54,48,43,55,24,23,16,2,11,40,12,56,53,42,57,26,30,37,17,15,8,10,27,31,59,44,58,29,47,32,25];
export const NODE_NAMES=['Deadeye Training','Moving Target','Splinter Prism','Induction Bank','Deadeye Step','Longshot Capacitor','Burst Receiver','Relentless Machinery','Quick-cycle Breech','Glass Saint','Marked for Death','Echo Chamber','Iron Constitution','Furnace Initiate','Ember Siphon','Retaliatory Armor','Wick Oil','Concussive Wadding','Blight Injector','Backdraft Nozzle','Phantom Wake','Chain Cremation','Furnace Ascendant','Second Heart','Charged Heart','Arc Scholarship','Winter Current','Quickening Gear','Living Brand','Grounding Rod','Pressure Guard','Forked Circuit','Brittle Memory','Echo of the Storm','Kill Clock','Aegis Step'];
export const CONDITIONS=['STEADY PRESSURE','HUNTING HOUR','ARMORED PATROL','SALVAGE SURGE'];
export const LAYOUTS=[[[-1.6,-.3],[1.6,-.3]],[[0,-1.2],[-2,.7]],[[-1.8,-1.5],[1.8,-.2],[0,.65]],[[-2.1,-1.4],[2.1,-1.4],[-2.1,.55],[2.1,.55]]];
export const LAYOUT_NAMES=['SPLIT FOUNDRY','BROKEN PROCESSION','OFFSET GALLERIES','CROSSING LANES'];
export const TRAITS=['','SURGING','ARMORED','REGENERATING','VOLATILE'];
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const copy=p=>({x:p.x,z:p.z});
export const norm=(x,z)=>{const d=Math.hypot(x,z)||1;return {x:x/d,z:z/d};};
export const nodeCost=id=>[25,40,60,90][Math.floor(id%12/3)];
export const prereq=id=>id%12<3?-1:id-3;
export const weaponCost=rank=>[30,65,110][clamp(rank,0,2)];
// Unity's seeded System.Random subtractive generator, preserving the run's authored roll sequence.
export class Random {
 constructor(seed){let mj=161803398-Math.abs(seed===-2147483648?2147483647:seed|0);this.a=Array(56).fill(0);this.a[55]=mj;let mk=1;
 for(let i=1;i<55;i++){const ii=21*i%55;this.a[ii]=mk;mk=mj-mk;if(mk<0)mk+=2147483647;mj=this.a[ii];}
 for(let k=1;k<5;k++)for(let i=1;i<56;i++){this.a[i]-=this.a[1+(i+30)%55];if(this.a[i]<0)this.a[i]+=2147483647;}this.i=0;this.j=21;}
 value(){if(++this.i>=56)this.i=1;if(++this.j>=56)this.j=1;let n=this.a[this.i]-this.a[this.j];if(n===2147483647)n--;if(n<0)n+=2147483647;this.a[this.i]=n;return n/2147483647;}
 next(n){return Math.floor(this.value()*n);}
}
export function defaultProfile(){return {version:1,bank:0,vitality:0,skills:[],weapons:[0,0,0,0,0,0],loadout:0,settings:{master:.85,effects:.8,ambience:.4,music:.35,quality:'high',motion:true,numbers:true}};}
export function cleanProfile(raw){const p=defaultProfile();if(!raw||raw.version!==1)return p;p.bank=clamp(Math.floor(Number(raw.bank)||0),0,9999999);p.vitality=clamp(Math.floor(Number(raw.vitality)||0),0,5);p.skills=[...new Set(Array.isArray(raw.skills)?raw.skills.filter(i=>Number.isInteger(i)&&i>=0&&i<36):[])];p.weapons=p.weapons.map((_,i)=>clamp(Math.floor(Number(raw.weapons?.[i])||0),0,3));p.loadout=clamp(Math.floor(Number(raw.loadout)||0),0,2);for(const k of ['master','effects','ambience','music'])if(Number.isFinite(raw.settings?.[k]))p.settings[k]=clamp(raw.settings[k],0,1);for(const k of ['motion','numbers'])if(typeof raw.settings?.[k]==='boolean')p.settings[k]=raw.settings[k];if(['high','balanced','low'].includes(raw.settings?.quality))p.settings.quality=raw.settings.quality;return p;}
export class Navigation {
 constructor(boxes=[],bounds=[4.9,4.35]){this.boxes=boxes;this.bounds=bounds;this.step=.24;this.w=Math.ceil(bounds[0]*2/this.step)+1;this.h=Math.ceil(bounds[1]*2/this.step)+1;}
 free(x,z,r=.25){if(Math.abs(x)>this.bounds[0]-r||Math.abs(z)>this.bounds[1]-r)return false;return !this.boxes.some(b=>{const cx=clamp(x,b.x0,b.x1),cz=clamp(z,b.z0,b.z1);return (x-cx)**2+(z-cz)**2<r*r;});}
 trace(a,b,pad=0){let end=1;const dx=b.x-a.x,dz=b.z-a.z;for(const box of this.boxes){let lo=0,hi=1;for(const[v,d,mn,mx]of [[a.x,dx,box.x0-pad,box.x1+pad],[a.z,dz,box.z0-pad,box.z1+pad]]){if(Math.abs(d)<1e-8){if(v<mn||v>mx){lo=2;break;}}else {let t0=(mn-v)/d,t1=(mx-v)/d;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);}}if(lo<=hi&&lo>=0&&lo<end)end=lo;}return {x:a.x+dx*end,z:a.z+dz*end,t:end};}
 clear(a,b,pad=0){return this.trace(a,b,pad).t>.995;}
 move(p,dx,dz,r=.25){const steps=Math.ceil(Math.hypot(dx,dz)/.12)||1;for(let i=0;i<steps;i++){if(this.free(p.x+dx/steps,p.z,r))p.x+=dx/steps;if(this.free(p.x,p.z+dz/steps,r))p.z+=dz/steps;}return p;}
 nearest(p,r=.28){if(this.free(p.x,p.z,r))return copy(p);for(let radius=.15;radius<4;radius+=.15)for(let a=0;a<16;a++){const x=p.x+Math.sin(a*Math.PI/8)*radius,z=p.z+Math.cos(a*Math.PI/8)*radius;if(this.free(x,z,r))return{x,z};}return{x:0,z:2.75};}
 path(start,end,r=.28){end=this.nearest(end,r);if(this.clear(start,end,r)&&this.free(end.x,end.z,r))return[end];const s=this.step, w=this.w,h=this.h,b=this.bounds;
 const xy=p=>[clamp(Math.round((p.x+b[0])/s),0,w-1),clamp(Math.round((p.z+b[1])/s),0,h-1)],point=id=>({x:id%w*s-b[0],z:Math.floor(id/w)*s-b[1]});
 const snap=p=>{const [cx,cz]=xy(p);let best=-1,score=Infinity;for(let dz=-4;dz<=4;dz++)for(let dx=-4;dx<=4;dx++){const x=cx+dx,z=cz+dz;if(x<0||x>=w||z<0||z>=h)continue;const q=point(z*w+x),d=Math.hypot(p.x-q.x,p.z-q.z);if(d<score&&this.free(q.x,q.z,r)&&this.clear(p,q,r)){best=z*w+x;score=d;}}return best;};
 const first=snap(start),last=snap(end);if(first<0||last<0)return[];const ex=last%w,ez=Math.floor(last/w),open=[first],came=new Int32Array(w*h).fill(-1),cost=new Float32Array(w*h).fill(Infinity),closed=new Uint8Array(w*h);cost[first]=0;
 let found=-1,limit=0;while(open.length&&limit++<w*h){let best=0,score=Infinity;for(let i=0;i<open.length;i++){const id=open[i],v=cost[id]+Math.hypot(id%w-ex,Math.floor(id/w)-ez);if(v<score){score=v;best=i;}}const cur=open.splice(best,1)[0];if(cur===last){found=cur;break;}closed[cur]=1;const x=cur%w,z=Math.floor(cur/w);
 for(const[dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const nx=x+dx,nz=z+dz,id=nz*w+nx;if(nx<0||nx>=w||nz<0||nz>=h||closed[id])continue;const p=point(id);if(!this.free(p.x,p.z,r)||!this.clear(point(cur),p,r))continue;const c=cost[cur]+Math.hypot(dx,dz);if(c<cost[id]){came[id]=cur;cost[id]=c;if(!open.includes(id))open.push(id);}}
 }if(found<0)return[];const route=[];while(found!==first&&found>=0){route.unshift(point(found));found=came[found];}route.push(end);return route;}
}
