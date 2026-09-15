import {BASE} from './assets.js';
export class AudioSystem {
 constructor(data,settings){this.data=data;this.settings=settings;this.buffers=new Map();this.last={};this.voices=[];}
 async unlock(){if(this.ctx){await this.ctx.resume();return;}this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);this.master.gain.value=this.settings.master;
  const files=[...new Set(this.data.cues.flatMap(c=>c.clips))];this.ready=Promise.all(files.map(async file=>{try{const r=await fetch(BASE+file);if(!r.ok)throw Error(file);this.buffers.set(file,await this.ctx.decodeAudioData(await r.arrayBuffer()));}catch(e){console.warn('Audio unavailable:',file);}}));
  for(const[key,file]of Object.entries({ambience:this.data.atmosphere,music:this.data.score,flame:this.data.flame})){if(!file)continue;const a=new Audio(BASE+file);a.loop=true;a.preload='auto';const node=this.ctx.createMediaElementSource(a),gain=this.ctx.createGain();node.connect(gain).connect(this.master);gain.gain.value=0;this[key]={audio:a,gain};a.play().catch(()=>{});}await this.ctx.resume();
 }
 play(key,p){if(!key||!this.ctx||this.ctx.state!=='running')return;const cue=this.data.cues.find(c=>c.key===key);if(!cue)return;let i=Math.floor(Math.random()*cue.clips.length);if(cue.clips.length>1&&i===this.last[key])i=(i+1)%cue.clips.length;this.last[key]=i;const buffer=this.buffers.get(cue.clips[i]);if(!buffer)return;
  if(this.voices.length>=16){const v=this.voices.shift();try{v.stop();}catch{}}const s=this.ctx.createBufferSource(),g=this.ctx.createGain(),pan=this.ctx.createStereoPanner();s.buffer=buffer;s.playbackRate.value=key==='reward'||key==='ui'?1:key==='enemy'?.78+Math.random()*.06:.965+Math.random()*.07;g.gain.value=cue.gain*this.settings.effects;pan.pan.value=Number.isFinite(p?.x)?Math.max(-.65,Math.min(.65,p.x/12)):0;s.connect(g).connect(pan).connect(this.master);s.onended=()=>{this.voices=this.voices.filter(v=>v!==s);s.disconnect();g.disconnect();pan.disconnect();};this.voices.push(s);s.start();
 }
 update(game,fire){if(!this.ctx)return;this.master.gain.setTargetAtTime(this.settings.master,this.ctx.currentTime,.03);const combat=game.active;for(const[key,scale]of [['ambience',combat?.36:.55],['music',combat?.32:.65],['flame',fire&&combat&&game.weapon===4?.45:0]]){const slot=this[key];if(slot)slot.gain.gain.setTargetAtTime((key==='flame'?this.settings.effects:this.settings[key])*scale,this.ctx.currentTime,.1);}}
 muteHidden(hidden){if(this.ctx)(hidden?this.ctx.suspend():this.ctx.resume()).catch(()=>{});}
}
