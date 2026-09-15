import {Random,Navigation,WEAPONS,INTERVALS,MODS,NODE_RELICS,nodeCost,prereq,weaponCost,LAYOUTS,LAYOUT_NAMES,CONDITIONS,clamp,dist,copy,norm} from './rules.js';
export class Game {
 constructor(data,profile,save=()=>{}){this.data=data;this.profile=profile;this.save=save;this.events=[];this.loadout=profile.loadout;this.screen='home';this.started=false;this.roomIndex=0;this.nav=new Navigation();this.player={x:0,z:2.75,hp:100,yaw:0};this.time=0;this.nextId=1;this.enemies=[];this.bolts=[];this.fields=[];this.warnings=[];this.drops=[];this.delayed=[];this.interactables=[];this.stacks=Array(63).fill(0);this.history=[];}
 emit(type,data={}){this.events.push({type,...data});}
 notice(text){this.emit('notice',{text});}
 get depth(){return (this.cycle-1)*3+Math.min(this.room,3);}
 get blocked(){return this.screen!==null;}
 get active(){return this.started&&!this.settled&&!this.blocked;}
 get S(){return this.stacks;}
 get maxHP(){return 100+this.profile.vitality*10+20*this.S[2]-(this.titheUsed?15:0);}
 get damage(){return 1+this.S[0];}
 get crit(){return Math.min(.9,.05+.15*this.S[7]+.2*this.S[45]);}
 get attackRate(){return (1+.25*this.S[1])*(1+(this.time<this.overclockUntil?this.killCharges*.08*this.S[32]:0)+(this.movingTime>1?.2*this.S[39]:0));}
 get interval(){return INTERVALS[this.weapon]/(this.weapon===3?1+.25*this.S[55]:1)/this.attackRate;}
 get pulseLevel(){return this.S[15]+this.S[35]+this.S[36]+this.S[37];}
 get skillInterval(){return [12,14,13][this.skill]/(1+this.pulseLevel*.2);}
 get barrier(){return this.time<this.barrierUntil?this.barrierValue:0;}
 get dashInterval(){return 1.1/(1+.25*this.S[5]+.35*this.S[46]);}
 get alive(){return this.enemies.filter(e=>e.hp>0);}
 get boss(){return this.enemies.find(e=>e.boss);}
 start(seed=(Date.now()&0x7fffffff)){
  if(this.started)return false;this.seed=seed|0;this.rng=new Random(this.seed);this.started=true;this.settled=false;this.cycle=1;this.room=1;this.time=0;this.scrap=0;this.stacks.fill(0);this.owned=[true,true,false,false,false,false];this.granted=Array(6).fill(false);this.weapon=[0,4,5][this.loadout];this.owned[this.weapon]=true;this.skill=[0,2,1][this.loadout];this.heartSpent=false;this.titheUsed=false;this.upgrades=0;this.bossesDefeated=0;this.barrierValue=0;this.barrierUntil=0;this.killCharges=0;this.overclockUntil=0;this.movingTime=0;this.deadeyeUntil=0;this.lastTarget=null;this.relentless=0;this.attackNumber=0;this.splinterAt=0;this.brittleAt=0;this.backdraftAt=0;this.siphonAt=0;
  this.player={x:0,z:2.75,hp:100+this.profile.vitality*10,yaw:0,dashCD:0,dashTime:0,attackCD:0,skillCD:0,move:{x:0,z:0},attackAt:-5};
  [[7,39],[11,40],[31,27]][this.loadout].forEach(id=>this.apply(id));for(const id of this.profile.skills)if(Math.floor(id/12)===this.loadout)this.apply(NODE_RELICS[id]);this.owned.forEach((yes,i)=>{if(yes)this.grantTraining(i);});this.history=[];this.enter(0,1);return true;
 }
 toHome(){this.player={x:0,z:2.75,hp:100+this.profile.vitality*10,yaw:0};this.started=false;this.settled=false;this.screen='home';this.enemies=[];this.bolts=[];this.fields=[];this.warnings=[];this.drops=[];this.roomIndex=0;this.emit('home');}
 trainNode(id){if(this.started||!Number.isInteger(id)||id<0||id>=36||this.profile.skills.includes(id)||this.profile.bank<nodeCost(id)||(prereq(id)>=0&&!this.profile.skills.includes(prereq(id))))return false;this.profile.bank-=nodeCost(id);this.profile.skills.push(id);this.save();this.emit('sound',{key:'reward'});return true;}
 trainWeapon(w){if(this.started||!Number.isInteger(w)||w<0||w>5||this.profile.weapons[w]>=3||this.profile.bank<weaponCost(this.profile.weapons[w]))return false;this.profile.bank-=weaponCost(this.profile.weapons[w]);this.profile.weapons[w]++;this.save();this.emit('sound',{key:'reward'});return true;}
 trainVitality(){const cost=25+15*this.profile.vitality;if(this.started||this.profile.vitality>=5||this.profile.bank<cost)return false;this.profile.bank-=cost;this.profile.vitality++;this.save();return true;}
 grantTraining(w){if(this.granted[w])return;this.granted[w]=true;for(let i=0;i<this.profile.weapons[w];i++)this.apply(MODS[w][i]);}
 canTake(id){return !!this.data.relics[id]&&(id>=60||(id===17?(!this.S[17]||this.heartSpent):this.S[id]<this.data.relics[id].cap));}
 apply(id){if(!this.canTake(id))return false;if(id>=60){if(id===60)this.heal(25);if(id===61)this.scrap+=15;if(id===62)this.giveBarrier(20,12);return true;}
  this.S[id]=id===17?1:this.S[id]+1;if(id===2)this.heal(20);if(id===17)this.heartSpent=false;if(id>=18&&id<=21){this.owned[id-16]=true;this.weapon=id-16;this.grantTraining(id-16);}
  if(id>=35&&id<=37){this.skill=id-35;this.player.skillCD=Math.min(this.player.skillCD,this.skillInterval);}this.emit('weapon');return true;
 }
 draft(premium=false){const ids=[];for(let k=0;k<3;k++){
  let pool=this.data.relics.map((_,i)=>i).filter(i=>this.canTake(i)&&!ids.includes(i));if(pool.some(i=>i<60))pool=pool.filter(i=>i<60);
  const rich=premium&&k===2&&pool.some(i=>this.data.relics[i].tier===2);if(rich)pool=pool.filter(i=>this.data.relics[i].tier===2);
  const bag=[];for(const i of pool){const d=this.data.relics[i];let weight=[5,4,2][d.tier]+(rich?5:0);if(this.S.some((n,j)=>n&&this.data.relics[j].family===d.family))weight+=3;if(i>=18&&i<=21&&!this.owned[i-16])weight+=2;for(let n=0;n<weight;n++)bag.push(i);}ids.push(bag[this.rng.next(bag.length)]??60);
 }return ids;}
 offer(bonus=false){this.screen='rewards';this.bonusDraft=bonus;this.rewardsRemaining=bonus?1:2;this.rewardRerolls=0;if(!bonus)this.heal(12);this.choices=this.draft(this.room>=3||this.data.rooms[this.roomIndex].rewardBias===2);this.emit('sound',{key:'reward'});}
 choose(i){if(this.screen!=='rewards'||i<0||i>2||!this.apply(this.choices[i]))return false;this.upgrades++;this.emit('sound',{key:'reward'});if(--this.rewardsRemaining>0){this.choices=this.draft(this.room>=3||this.data.rooms[this.roomIndex].rewardBias===2);return true;}if(this.bonusDraft){this.screen=null;return true;}if(this.room<3){this.routeChoices=this.room===1?[1,2]:[3,4];this.screen='route';}else this.enter(5,4);return true;}
 reroll(){const cost=8+this.rewardRerolls*4;if(this.screen!=='rewards'||this.scrap<cost||this.rewardRerolls>=2)return false;this.scrap-=cost;this.rewardRerolls++;this.choices=this.draft(this.room>=3||this.data.rooms[this.roomIndex].rewardBias===2);return true;}
 selectRoute(i){if(this.screen!=='route'||![0,1].includes(i))return false;this.enter(this.routeChoices[i],this.room+1);return true;}
 enter(index,room){
  this.recoverDrops();this.roomIndex=index;this.room=room;this.screen='travel';this.enemies=[];this.bolts=[];this.fields=[];this.warnings=[];this.drops=[];this.delayed=[];this.player.x=0;this.player.z=2.75;this.destination=null;this.path=[];this.player.dashTime=0;this.player.move={x:0,z:0};this.heal(this.data.rooms[index].entryHeal);this.history.push(index);this.condition=new Random(this.seed^(this.cycle*65537)^((index+1)*7919)).next(4);this.hazardAt=this.time+(index===1?4.2:5.2);
  const rng=new Random(this.seed^(this.cycle*65537)^(index*8191));this.layout=rng.next(4);this.cover=index===5?[]:LAYOUTS[this.layout].map(p=>({x:p[0]+rng.value()*.3-.15,z:p[1]-(rng.value()*.3-.15),name:this.data.cover[rng.next(this.data.cover.length)],yaw:rng.next(2)*Math.PI/2}));this.emit('room',{index});
 }
 readyRoom(boxes,interactables){this.nav=new Navigation(boxes,this.data.rooms[this.roomIndex].halfSize);this.interactables=interactables.map(i=>({...i,used:false}));const p=this.nav.nearest(this.player);this.player.x=p.x;this.player.z=p.z;this.screen=null;
  const d=this.data.rooms[this.roomIndex];if(this.room===4){const name=this.data.bosses[this.rng.next(this.data.bosses.length)],isPontiff=name==='NullPontiff';this.spawnEnemy(name,{x:0,z:-1.4},true,false,isPontiff?48:38);if(isPontiff)this.anchors(3);this.notice('THE CHOIR THRONE / '+name.replace(/([a-z])([A-Z])/g,'$1 $2'));return;}
  const count=3+this.room+Math.min(4,this.cycle-1)+d.extraEnemies;for(let i=0;i<count;i++){const a=(i+.5)*Math.PI*2/count,p=this.nav.nearest({x:Math.sin(a)*3,z:-Math.cos(a)*2.6},.42),name=d.enemies[this.rng.next(d.enemies.length)],elite=i<Math.max(this.room===3?1:0,d.eliteCount);this.spawnEnemy(name,p,false,elite,5+this.room*2+d.extraHealth+(this.condition===2?3:0),i);}this.notice('DEPTH '+this.depth+' / '+LAYOUT_NAMES[this.layout]+' / '+CONDITIONS[this.condition]);
 }
 spawnEnemy(name,p,boss=false,elite=false,hp=7,index=0){
  const r=new Random(this.seed^(this.cycle*13007)^(this.roomIndex*271)^(index*113));const affix=boss?0:this.cycle>1||elite?r.next(4)+1:r.value()<.28?r.next(4)+1:0;
  hp=Math.ceil((hp+(elite?4:0))*(boss?1+.55*(this.cycle-1):1+.4*(this.cycle-1)));if(affix===2)hp=Math.ceil(hp*1.35);
  const e={id:this.nextId++,name,x:p.x,z:p.z,hp,maxHP:hp,boss,elite,affix,kind:/Brute|Hound|Maw|Revenant/.test(name)?2:/Turret|Medium|Constable/.test(name)?1:0,stationary:/Turret/.test(name),flying:/Drone|Warden/.test(name),seed:boss||name==='NullAnchor'?0:this.rng.value()*6,yaw:0,attackCD:1.7,windup:0,recovery:0,decision:0,dodge:0,nextDodge:0,aimExposure:0,regen:this.time+2,slow:0,burn:0,burnPower:0,burnTick:0,poison:0,doses:0,poisonTick:0,stun:0,vulnerable:0,brand:0,phase:0,visibleUntil:0,path:[],moving:false,attackAt:-5};
  e.attackCD+=e.seed*.15;this.enemies.push(e);this.emit('spawn',{entity:e});return e;
 }
 anchors(n){const boss=this.boss;boss.phase++;const pts=n===3?[[-2,-.2],[2,-.2],[0,1.35]]:[[-2,1.1],[2,1.1]];for(const[x,z]of pts){const a=this.spawnEnemy('NullAnchor',{x,z},false,false,4+Math.min(8,this.cycle-1));a.anchor=true;a.stationary=true;a.affix=0;a.hp=a.maxHP=4+Math.min(8,this.cycle-1);}this.notice('NULL PONTIFF / DESTROY THE VIOLET ANCHORS');}
 switchWeapon(w){if(!this.started||this.settled)return false;if(w===undefined){for(let n=1;n<=6;n++){const i=(this.weapon+n)%6;if(this.owned[i]){w=i;break;}}}if(!this.owned[w])return false;this.weapon=w;this.emit('weapon');this.emit('sound',{key:'loot'});return true;}
 heal(n){this.player.hp=Math.min(this.maxHP,this.player.hp+n);}
 giveBarrier(n,seconds){this.barrierValue=Math.min(40,this.barrier+n);this.barrierUntil=Math.max(this.barrierUntil,this.time+seconds);}
 hurt(n){if(!this.active||this.player.dashTime>0)return;let damage=Math.ceil(Math.max(1,n-2*this.S[6])*(1+.25*this.S[24]))+2*this.S[45];const absorbed=Math.min(damage,this.barrier);this.barrierValue=this.barrier-absorbed;damage-=absorbed;this.player.hp-=damage;this.emit('hurt',{damage});this.emit('number',{...copy(this.player),damage,player:true});if(this.S[12])for(const e of this.alive)if(dist(e,this.player)<2.2)this.hit(e,this.S[12]);if(this.player.hp<=0){if(this.S[17]&&!this.heartSpent){this.heartSpent=true;this.player.hp=Math.ceil(this.maxHP*.4);this.notice('SECOND HEART / MEMORY RESTORED');this.emit('shock',{...copy(this.player),radius:2,color:0xf0bc61});}else this.settle(false);}}
 settle(victory){if(this.settled)return;if(victory)this.recoverDrops();this.settled=true;this.victory=victory;this.screen='results';if(victory)this.scrap+=30*this.cycle;this.banked= victory?this.scrap:Math.floor(this.scrap/2);this.profile.bank+=this.banked;this.save();this.emit('sound',{key:victory?'reward':'boss'});}
 descend(){if(!this.active||this.room!==4||this.boss?.hp>0)return false;this.cycle++;this.heal(20);this.enter(0,1);return true;}
 extract(){if(!this.active||this.room!==4||this.boss?.hp>0)return false;const ex=this.data.rooms[5].extraction;if(dist(this.player,{x:ex[0],z:ex[2]})>2){this.notice('MOVE TO THE CYAN MEMORY ENGINE / E TO EXTRACT');return false;}this.settle(true);return true;}
 nearestItem(){let best=null,range=1.55;for(const i of this.interactables){const d=dist(i,this.player);if(!i.used&&d<range&&this.nav.clear(this.player,i)){best=i;range=d;}}return best;}
 interact(){if(!this.active)return false;if(this.room===4&&this.boss?.hp<=0&&this.extract())return true;const i=this.nearestItem();if(!i)return false;const cost=10+3*(this.depth-1);
  if(i.kind===3){if(this.scrap<cost){this.notice('FABRICATOR REQUIRES '+cost+' SALVAGE');return false;}this.scrap-=cost;this.offer(true);}i.used=true;this.emit('sound',{key:'ui'});if(i.kind===0){this.blast(i,2,3.2,0);this.bolts=this.bolts.filter(b=>dist(b,i)>3.2);}if(i.kind===1)this.warning(i,2.5,1.5,18,'capacitor');if(i.kind===2)this.collect(false,new Random(this.seed^(i.slot*233)^((this.roomIndex+1)*997)).next(8)+8);if(i.kind===4)this.heal(25);return true;
 }
 openTithe(){if(this.screen!=='rewards'||this.titheUsed||this.maxHP<=35)return false;const ids=[14,15,16,17].filter(i=>this.canTake(i));if(!ids.length)return false;this.titheOffer=ids[new Random(this.seed^0x6D317).next(ids.length)];this.screen='tithe';return true;}
 acceptTithe(){if(this.screen!=='tithe'||this.titheUsed||this.maxHP<=35||!this.canTake(this.titheOffer))return false;this.titheUsed=true;this.player.hp=Math.min(this.player.hp,this.maxHP);this.apply(this.titheOffer);this.upgrades++;this.screen='rewards';if(this.choices.some(i=>!this.canTake(i)))this.choices=this.draft();return true;}
 collect(healing,n){if(healing)this.heal(n);else {this.scrap+=Math.ceil(n*(1+.5*this.S[9])*(this.condition===3?1.5:1)*(1+.25*(this.cycle-1)));if(this.S[34])this.giveBarrier(2*this.S[34],8);}this.emit('sound',{key:'loot'});}
 recoverDrops(){for(const d of this.drops)this.collect(d.healing,d.amount);this.drops=[];}
 dash(move){if(!this.active||this.player.dashCD>0||Math.hypot(move.x,move.z)<.1)return false;this.player.dashDir=norm(move.x,move.z);this.player.dashTime=.18;this.player.dashCD=this.dashInterval;if(this.S[25])this.giveBarrier(8*this.S[25],3);if(this.S[38])this.deadeyeUntil=this.time+3;if(this.S[26])this.field(this.player,.9,2.5,this.S[26],3);this.emit('sound',{key:'dash'});this.emit('dash',{...copy(this.player),direction:this.player.dashDir});return true;}
 skillCast(){if(!this.active||this.player.skillCD>0)return false;this.player.skillCD=this.skillInterval;const radius=2.8+.35*this.pulseLevel,damage=3+this.damage+this.pulseLevel,p=copy(this.player);this.blast(p,damage,radius,this.skill);if(this.skill===1)this.field(p,radius,5,0,1);if(this.skill===2)this.field(p,radius,4,Math.max(1,this.S[11]),2);if(this.S[44])this.giveBarrier(12*this.S[44],5);if(this.S[47])this.delayed.push({at:this.time+.8,fn:()=>this.blast(p,Math.floor(damage/2)+this.S[47],radius,this.skill)});this.bolts=this.bolts.filter(b=>dist(b,p)>radius+1);this.emit('sound',{key:'pulse'});return true;}
 field(p,radius,duration,damage,style){if(this.fields.length>=12)this.fields.shift();this.fields.push({...copy(p),radius,until:this.time+duration,tick:this.time,damage,style,id:this.nextId++});}
 blast(p,damage,radius,style){this.emit('shock',{...copy(p),radius,color:style===2||style===-1?0xff7025:style===1?0x9ebcff:0x58e7e7});for(const e of this.alive)if(dist(e,p)<radius){if(!e.boss&&!e.anchor){if(style===0)e.stun=this.time+1.25;if(style===1){this.slow(e,2);e.stun=this.time+.6;}}if(style===2)this.burn(e);if(damage>0)this.hit(e,damage);}}
 slow(e,level=1){e.slow=Math.max(e.slow,this.time+2.4+.8*(level-1));}
 burn(e,level=Math.max(1,this.S[11])){e.burn=Math.max(e.burn,this.time+2.2);e.burnPower=Math.max(e.burnPower,level);}
 nearest(p,range,skip=new Set()){return this.alive.filter(e=>!e.anchor&&!skip.has(e)&&dist(p,e)<range&&this.nav.clear(p,e)).sort((a,b)=>dist(p,a)-dist(p,b))[0];}
 fire(aim){
  if(!this.active||this.player.attackCD>0||this.room===4&&this.boss?.hp<=0)return false;
  const p=this.player,w=this.weapon,dir=norm(aim.x-p.x,aim.z-p.z),charged=this.time<this.deadeyeUntil;this.deadeyeUntil=0;const crit=charged||this.rng.value()<this.crit;this.attackNumber++;if(this.S[33])p.hp=Math.max(1,p.hp-this.S[33]);p.attackCD=this.interval;p.attackAt=this.time;p.yaw=Math.atan2(-dir.x,-dir.z);
  const base=this.damage+(w>=2?Math.max(0,this.S[w+16]-1):0),targetRange=w===5?1.4:1.05;
  let hits=0;const primary=(e,d)=>{if(this.hit(e,d*(crit?2:1),true,crit,charged))hits++;};
  if(w===0||w===5){const range=w===5?7:8;let target=this.alive.filter(e=>dist(e,aim)<(e.boss?1.5:targetRange)&&dist(e,p)<range&&this.nav.clear(p,e)).sort((a,b)=>dist(a,aim)-dist(b,aim))[0];
   if(w===0){let end=target?copy(target):this.nav.trace(p,{x:p.x+dir.x*8,z:p.z+dir.z*8});if(target){primary(target,base);if(this.S[8]&&this.attackNumber%4===0){const next=this.nearest(target,3.5,new Set([target]));if(next){this.hit(next,this.S[8]);this.emit('beam',{from:copy(target),to:copy(next),weapon:5});}}if(this.S[16]&&this.attackNumber%3===0){const next=this.nearest(target,4.5,new Set([target]));if(next&&this.nav.clear(p,next)){this.hit(next,this.damage+this.S[16]);this.emit('beam',{from:copy(p),to:copy(next),weapon:0});}}}this.emit('beam',{from:copy(p),to:end,weapon:w,crit});}
   else{const visited=new Set();let from=copy(p);for(let n=0;n<3+this.S[21]+this.S[58]&&target;n++){visited.add(target);if(n===0)primary(target,base+1);else this.hit(target,(base+1)*(crit?2:1));if(this.S[59])this.slow(target,this.S[59]);this.emit('beam',{from,to:copy(target),weapon:5});from=copy(target);target=this.nearest(target,3.2,visited);}if(!visited.size)this.emit('beam',{from:copy(p),to:this.nav.trace(p,{x:p.x+dir.x*3,z:p.z+dir.z*3}),weapon:5});}
  }else {
   const range=w===1?1.9+.4*this.S[50]:w===2?4.2:w===3?8.5:3.2;
   for(const e of this.alive){const d=dist(e,p),dx=e.x-p.x,dz=e.z-p.z,dot=(dx*dir.x+dz*dir.z)/(d||1),aligned=w===3?Math.abs(dx*dir.z-dz*dir.x)<.45&&dot>0:dot>(w===1?.05:w===2?(this.S[52]?.985:.85):.88);if(d>range+(w===1&&e.boss?.4:0)||!aligned||!this.nav.clear(p,e))continue;primary(e,Math.max(1,base+(w===1?2:w===2?3+4*this.S[52]:w===3?5-this.S[55]:0)));}
   this.emit('attack',{from:copy(p),dir,weapon:w,range,crit,slug:!!this.S[52]});
  }
  if(hits)this.heal(2*this.S[3]);this.emit('sound',{key:['shot','slash','scatter','rail',null,'tesla'][w]});return true;
 }
 hit(e,damage,primary=false,critical=false,charged=false){
  if(!e||e.hp<=0)return false;
  if(e.boss&&e.name==='NullPontiff'&&this.alive.some(a=>a.anchor)){this.emit('shield',{...copy(e)});return false;}
  if(primary){damage+=2*this.S[33]+(charged?this.S[38]:0)+(this.weapon===0&&this.attackNumber%5===0?3*this.S[49]:0);
   if(!e.boss&&!e.anchor){this.relentless=e===this.lastTarget?Math.min(3,this.relentless+1):0;this.lastTarget=e;damage+=this.relentless*this.S[43];}
   if(e.hp<=e.maxHP*.3)damage=Math.ceil(damage*(1+.5*this.S[23]));if(this.time<e.vulnerable)damage=Math.ceil(damage*(1+.25*this.S[51]));
   if(this.weapon===3&&dist(e,this.player)>4)damage+=4*this.S[54];if(this.weapon===4&&e.burn>this.time&&this.S[57]&&this.time>=this.backdraftAt){damage+=2*this.S[57];this.backdraftAt=this.time+.5;}if(e.slow>this.time&&this.S[29]&&this.time>=this.brittleAt){damage+=2*this.S[29];this.brittleAt=this.time+.6;}
   damage=Math.max(1,Math.ceil(damage*(1+.4*this.S[24])));
  }
  if(e.boss&&e.name==='NullPontiff'&&e.phase===1&&e.hp-damage<=e.maxHP*.5){damage=Math.max(0,e.hp-Math.ceil(e.maxHP*.5));e.hp-=damage;this.anchors(2);}else e.hp-=damage;
  e.visibleUntil=this.time+3;this.emit('number',{...copy(e),damage,critical,boss:e.boss});this.emit('impact',{...copy(e),critical});if(this.S[10])this.slow(e,this.S[10]);if(this.S[11])this.burn(e,this.S[11]);
  if(e.hp<=0){this.kill(e);return true;}
  if(primary&&!e.anchor){
   if(critical)this.player.skillCD=Math.max(0,this.player.skillCD-.5*this.S[28]);
   if(this.weapon===0&&this.S[48]&&this.delayed.length<12){for(let n=1;n<=2;n++)this.delayed.push({at:this.time+n*.08,fn:()=>{if(e.hp>0&&this.nav.clear(this.player,e)){this.hit(e,this.S[48]);this.emit('beam',{from:copy(this.player),to:copy(e),weapon:0});}}});}
   if(this.weapon===1&&this.S[51])e.vulnerable=this.time+3;
   if(this.weapon===2&&!e.boss&&this.S[53])e.stun=this.time+.2*this.S[53];
   if(this.weapon===4){this.burn(e);e.burn+=2*this.S[56];}
   if(this.S[42]){e.doses=Math.min(5,e.doses+this.S[42]);e.poison=this.time+4;}
   if(this.S[31]&&!e.boss){e.brand=(e.brand+1)%3;if(!e.brand)this.hit(e,3*this.S[31]);}
   if(this.S[22]&&this.time>=this.splinterAt&&!e.boss){this.splinterAt=this.time+.4;const next=this.nearest(e,3,new Set([e]));if(next){this.hit(next,this.S[22]);this.emit('beam',{from:copy(e),to:copy(next),weapon:5});}}
  }return true;
 }
 kill(e){if(e.dead)return;e.dead=true;e.hp=0;this.emit('death',{entity:e});
  if(e.anchor){this.drops.push({...copy(e),id:this.nextId++,amount:4,healing:false});return;}
  if(e.boss){this.bossesDefeated++;this.bolts=[];this.warnings=[];this.drops.push({...copy(e),id:this.nextId++,amount:12,healing:false});this.emit('bossDefeated');this.emit('sound',{key:'reward'});this.notice('BOSS DEFEATED / E AT THE ENGINE TO EXTRACT · N TO DESCEND');return;}
  this.drops.push({...copy(e),id:this.nextId++,amount:(3+this.rng.next(4))*(e.elite?2:1),healing:false});if(e.elite||this.rng.value()<.35)this.drops.push({x:e.x+.3,z:e.z,id:this.nextId++,amount:18,healing:true});
  this.heal(4*this.S[13]);this.player.skillCD=Math.max(0,this.player.skillCD-.8*this.S[27]);this.killCharges=Math.min(5,this.killCharges+1);this.overclockUntil=this.time+6;
  if(e.affix===4)this.warning(e,1.6,.9,10+this.depth,'volatile');
  if(!this.resolvingDeath){this.resolvingDeath=true;try{if(this.S[14])this.blast(e,2*this.S[14],1.8,-1);if(this.S[30]&&e.burn>this.time)this.blast(e,3*this.S[30],1.7,-1);}finally{this.resolvingDeath=false;}}
  if(!this.alive.length&&this.room<4&&!this.resolvingDeath){this.recoverDrops();this.collect(false,this.data.rooms[this.roomIndex].clearSalvage);this.bolts=[];this.warnings=[];this.fields=[];this.offer();}
 }
 warning(p,radius,duration,damage,kind='circle',owner=null){const w={...copy(p),radius,start:this.time,at:this.time+duration,damage,kind,owner,id:this.nextId++};this.warnings.push(w);return w;}
 bolt(p,dir,speed,damage){this.bolts.push({...copy(p),vx:dir.x*speed,vz:dir.z*speed,damage,until:this.time+6,id:this.nextId++});}
 volley(e,target,count=1,speed=3.5,damage=6){const d=norm(target.x-e.x,target.z-e.z);for(let i=0;i<count;i++){const a=(i-(count-1)*.5)*Math.PI/15;this.bolt(e,{x:d.x*Math.cos(a)-d.z*Math.sin(a),z:d.x*Math.sin(a)+d.z*Math.cos(a)},speed,damage);}this.emit('sound',{key:'enemy'});}
 radial(e,n,speed,damage){for(let i=0;i<n;i++){const a=i*Math.PI*2/n;this.bolt(e,{x:Math.sin(a),z:Math.cos(a)},speed,damage);}}
 moveEnemy(e,dest,speed,dt,r=.28){if(!dest)return;let d=dist(e,dest);if(d<.15)return;if(!e.path.length||e.pathAt<this.time||!e.goal||dist(e.goal,dest)>.5){e.path=this.nav.path(e,dest,r);e.pathAt=this.time+.75;e.goal=copy(dest);}while(e.path.length&&dist(e,e.path[0])<.16)e.path.shift();const next=e.path[0];if(!next)return;const dir=norm(next.x-e.x,next.z-e.z),old=copy(e);this.nav.move(e,dir.x*speed*dt,dir.z*speed*dt,r);e.moving=dist(old,e)>.001;}
 updateEnemy(e,dt,input){
  e.moving=false;if(e.anchor)return;if(e.affix===3&&this.time>=e.regen){e.hp=Math.min(e.maxHP,e.hp+1);e.regen=this.time+2;}
  if(e.burn>this.time&&this.time>=e.burnTick){e.burnTick=this.time+.7;this.hit(e,e.burnPower);if(this.S[40]&&this.time>=this.siphonAt){this.siphonAt=this.time+.6;this.heal(this.S[40]);}}
  if(e.poison>this.time&&this.time>=e.poisonTick){e.poisonTick=this.time+1;this.hit(e,e.doses);}if(e.hp<=0)return;
  const p=this.player,delta=norm(p.x-e.x,p.z-e.z),distance=dist(e,p),sight=this.nav.clear(e,p);e.yaw=Math.atan2(-delta.x,-delta.z);
  if(e.stun>this.time&&!e.boss){e.windup=0;this.warnings=this.warnings.filter(w=>w.owner!==e);e.attackCD=Math.max(e.attackCD,.8);return;}
  if(e.windup>0){e.windup-=dt;if(e.windup<=0){e.attackAt=this.time;if(e.boss){if(e.name==='BellMother')this.radial(e,12,e.hp<e.maxHP*.4?3.1:2.2,9+2*(this.cycle-1));if(e.name==='NullPontiff')this.radial(e,e.phase>=2?12:8,e.phase>=2?2.7:2.1,8+2*(this.cycle-1));}else if(e.kind!==2)this.volley(e,e.target,e.elite?3:1,e.kind===1?4.2:3.5,5+this.room+2*(this.cycle-1));e.recovery=e.kind===2?.6:.4;}return;}
  if(e.recovery>0){e.recovery-=dt;return;}
  const slow=e.slow>this.time?(e.boss?.8:.55):1;e.attackCD-=dt*slow;
  if(e.boss){if(distance>2.1&&e.name!=='NullPontiff')this.moveEnemy(e,p,(e.hp<e.maxHP*.4?.75:.48)*slow,dt,.45);
   if(e.attackCD<=0){const pontiff=e.name==='NullPontiff',final=e.hp<e.maxHP*.4,duration=pontiff?(final?1.05:1.35):1.3;e.windup=duration;e.attackCD=pontiff?(final?1.65:2.5):(final?1.5:2.6);const targets=pontiff&&e.phase>=2?[copy(p),{x:p.x-1.8,z:p.z},{x:p.x+1.8,z:p.z}]:[copy(p)];targets.forEach(t=>this.warning(t,pontiff?1:1.4,duration,(pontiff?(final?22:17):24)+2*(this.cycle-1),'boss',e));}return;}
  if(e.dodge>0){e.dodge-=dt;this.moveEnemy(e,e.destination,3.8*slow,dt,.28);return;}
  const threatened=!e.stationary&&e.kind===0&&sight&&input.fire&&dist(input.aim,e)<1.1&&distance<7;e.aimExposure=threatened?e.aimExposure+dt:0;
  if(e.aimExposure>.38+e.seed*.025&&this.time>e.nextDodge){const sign=Math.sin(e.seed)<0?-1:1;e.destination=this.nav.nearest({x:e.x-delta.z*1.35*sign,z:e.z+delta.x*1.35*sign});e.dodge=.38;e.nextDodge=this.time+3.7+e.seed*.15;e.path=[];e.aimExposure=0;return;}
  e.decision-=dt;if(!e.stationary&&e.decision<=0){e.decision=.55+e.seed*.04;const desired=e.kind===2?1.05:e.kind===1?3.5:2.8;
   if(e.kind===2)e.destination=copy(p);else if(distance<desired*.7)e.destination=this.nav.nearest({x:e.x-delta.x*1.35,z:e.z-delta.z*1.35});else if(!sight||distance>desired+.75||e.attackCD>.6){let best=-Infinity;for(let i=0;i<5;i++){const angle=(i===0?0:i%2===0?-1:1)*(25+20*Math.floor((i+1)/2))*Math.PI/180*(Math.sin(e.seed+this.time*.2)>=0?1:-1),raw={x:p.x+(-delta.x*Math.cos(angle)+delta.z*Math.sin(angle))*desired,z:p.z+(-delta.x*Math.sin(angle)-delta.z*Math.cos(angle))*desired},candidate=this.nav.nearest(raw),score=(this.nav.clear(candidate,p)?5:0)-dist(candidate,e)*.45+(i>0?.4:0);if(score>best){best=score;e.destination=candidate;}}}else e.destination=copy(e);e.path=[];}
  const speed=[1.8,1.15,1.45][e.kind]*(e.elite?1.12:1)*slow*(this.condition===1?1.15:1)*(e.affix===1?1.2:1);if(!e.stationary&&!(e.kind===2&&distance<1.15))this.moveEnemy(e,e.destination,speed,dt,e.kind===2?.36:.28);
  if(e.attackCD<=0&&this.alive.filter(x=>!x.boss&&x.windup>0).length<2&&sight&&distance<(e.kind===2?1.65:6)){e.windup=e.kind===2?.85:.7;e.attackCD=(e.kind===2?2.1:2.25)*(e.elite?.9:1)*(e.affix===1?.8:1);e.target=copy(p);if(e.kind===2)this.warning(p,1.1,e.windup,12+this.room+(e.elite?3:0)+2*(this.cycle-1),'melee',e);else this.warning(p,.2,e.windup,0,'aim',e);}
 }
 update(dt,input={move:{x:0,z:0},aim:{x:0,z:0},fire:false}){
  if(!this.active)return;dt=Math.min(dt,.05);this.time+=dt;const p=this.player;
  for(const k of ['dashCD','attackCD','skillCD'])p[k]=Math.max(0,p[k]-dt);
  if(this.time>=this.overclockUntil)this.killCharges=0;
  let move=input.move||{x:0,z:0};if(Math.hypot(move.x,move.z)>.05){this.destination=null;this.path=[];}else if(this.destination){if(!this.path.length)this.path=this.nav.path(p,this.destination,.24);while(this.path.length&&dist(p,this.path[0])<.18)this.path.shift();if(this.path.length)move=norm(this.path[0].x-p.x,this.path[0].z-p.z);else this.destination=null;}
  this.movingTime=Math.hypot(move.x,move.z)>.05?this.movingTime+dt:0;p.move=move;
  const speed=(input.sprint?4.3:2.3)*(1+.18*this.S[4]);if(p.dashTime>0){this.nav.move(p,p.dashDir.x*10*dt,p.dashDir.z*10*dt,.23);p.dashTime=Math.max(0,p.dashTime-dt);}else this.nav.move(p,move.x*speed*dt,move.z*speed*dt,.24);
  if(input.fire){this.fire(input.aim);}else if(Math.hypot(move.x,move.z)>.1)p.yaw=Math.atan2(-move.x,-move.z);
  for(const e of [...this.enemies])if(e.hp>0)this.updateEnemy(e,dt,input);
  for(const d of [...this.delayed])if(this.time>=d.at){this.delayed.splice(this.delayed.indexOf(d),1);d.fn();}
  for(const w of [...this.warnings])if(this.time>=w.at){this.warnings.splice(this.warnings.indexOf(w),1);if(w.owner?.hp<=0||w.kind==='aim')continue;const hit=w.kind==='line'?Math.abs(p.z-w.z)<.42&&Math.abs(p.x-w.x)<3.8:dist(p,w)<w.radius;if(hit&&(w.kind!=='melee'||dist(p,w.owner)<2&&this.nav.clear(w.owner,p)))this.hurt(w.damage);if(w.kind==='capacitor')this.blast(w,12,w.radius,2);else this.emit('shock',{...copy(w),radius:w.radius,color:0xff8438});}
  for(const b of this.bolts){const before=copy(b),next={x:b.x+b.vx*dt,z:b.z+b.vz*dt};if(!this.nav.clear(before,next)){b.dead=true;continue;}b.x=next.x;b.z=next.z;if(dist(b,p)<.3){this.hurt(b.damage);b.dead=true;}}
  this.bolts=this.bolts.filter(b=>!b.dead&&b.until>this.time);
  for(const f of this.fields)if(this.time>=f.tick){f.tick=this.time+.6;for(const e of this.alive)if(dist(f,e)<f.radius){if(f.style===1){this.slow(e);if(!e.boss)e.stun=this.time+.15;}if(f.style===2)this.burn(e);if(f.damage)this.hit(e,f.damage);}}this.fields=this.fields.filter(f=>f.until>this.time);
  for(const d of this.drops)if(dist(d,p)<1.7+.8*this.S[41]){const v=norm(p.x-d.x,p.z-d.z);d.x+=v.x*6*dt;d.z+=v.z*6*dt;if(dist(d,p)<.3){this.collect(d.healing,d.amount);d.dead=true;}}this.drops=this.drops.filter(d=>!d.dead);
  if([1,2].includes(this.roomIndex)&&this.time>this.hazardAt){this.hazardAt=this.time+(this.roomIndex===1?4.2:5.2);if(this.roomIndex===1)this.warning({x:[0,2,-2][this.rng.next(3)],z:this.rng.next(2)?1.1:-1.1},1.15,1.6,14,'steam');else this.warning({x:0,z:this.rng.next(2)?1.4:-1.4},3.8,1.6,10,'line');}
 }
}
