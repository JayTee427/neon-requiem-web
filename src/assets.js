import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const BASE=import.meta.env.BASE_URL+'content/';
export class Assets {
 constructor(){this.rooms=[];this.actors=new Map();this.geometry=[];this.materials=[];}
 async load(progress){
  const get=async p=>{const r=await fetch(BASE+p);if(!r.ok)throw Error(p+': '+r.status);return r;};
  this.data=await (await get('manifest.json')).json();progress(.08,'Reading the six districts…');
  const [binary,...json]=await Promise.all([(await get('geometry.bin')).arrayBuffer(),...Array.from({length:6},(_,i)=>get('rooms/'+i+'.json').then(r=>r.json())),...this.data.actors.map(n=>get('actors/'+n+'.json').then(r=>r.json()))]);this.binary=binary;this.rooms=json.slice(0,6);this.data.actors.forEach((n,i)=>this.actors.set(n,json[i+6]));progress(.28,'Restoring materials and brasswork…');
  const loader=new THREE.TextureLoader();let done=0;
  this.textures=await Promise.all(this.data.textures.map(async t=>{const tex=await loader.loadAsync(BASE+(t.webFile||t.file));tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=4;progress(.28+.6*(++done/this.data.textures.length),'Restoring materials '+done+' / '+this.data.textures.length);return tex;}));
  this.materials=this.data.materials.map(m=>{
   const tex=(id,srgb=false)=>{if(id<0)return null;const t=this.textures[id].clone();if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.repeat.fromArray(m.repeat);t.offset.fromArray(m.offset);return t;};
   const mat=new THREE.MeshStandardMaterial({name:m.name,color:new THREE.Color().fromArray(m.color),map:tex(m.map,true),metalness:Math.min(.9,m.metallic),roughness:Math.max(.12,1-m.smoothness),normalMap:tex(m.normal),emissive:new THREE.Color().fromArray(m.emission),emissiveMap:tex(m.emissiveMap,true),transparent:m.transparent,opacity:m.color[3],alphaTest:m.alphaTest,side:THREE.FrontSide});
   if(m.metallicMap>=0){mat.metalnessMap=tex(m.metallicMap);mat.roughnessMap=mat.metalnessMap;mat.metalness=1;mat.roughness=1;}
   if(m.shader.includes('Wet Reflection')||m.shader.includes('TextMeshPro'))mat.visible=false;
   if(m.shader.includes('Canal Water')){mat.color.setHex(0x092a30);mat.metalness=.8;mat.roughness=.22;}
   if(/glass|window|neon|power|emiss/i.test(m.name)&&(mat.emissive.r+mat.emissive.g+mat.emissive.b)<.01){mat.emissive.copy(mat.color).multiplyScalar(.08);}
   mat.envMapIntensity=.38;return mat;
  });
  this.geometry=this.data.meshes.map(m=>{const g=new THREE.BufferGeometry();for(const [name,attr]of Object.entries({position:m.position,normal:m.normal,uv:m.uv,skinIndex:m.skinIndex,skinWeight:m.skinWeight})){if(attr)g.setAttribute(name,new THREE.BufferAttribute(this.array(attr),attr.size));}g.setIndex(new THREE.BufferAttribute(this.array(m.index),1));m.groups.forEach(x=>g.addGroup(x.start,x.count,x.materialIndex));if(!m.normal)g.computeVertexNormals();g.computeBoundingSphere();return g;});progress(.95,'Waking Sable Voss…');
 }
 array(a){return a.type==='u32'?new Uint32Array(this.binary,a.offset,a.count):new Float32Array(this.binary,a.offset,a.count);}
 instantiate(data,{room=false}={}){
  const group=new THREE.Group(),bones=new Set(data.nodes.flatMap(n=>n.skin?.bones||[])),nodes=data.nodes.map((n,i)=>{let o;
   if(n.mesh>=0){const mats=n.materials.map(id=>this.materials[id]||this.materials[0]);o=n.skin?new THREE.SkinnedMesh(this.geometry[n.mesh],mats):new THREE.Mesh(this.geometry[n.mesh],mats);o.castShadow=!room;o.receiveShadow=true;o.frustumCulled=!n.skin;}
   else o=bones.has(i)?new THREE.Bone():new THREE.Group();
   o.name='n'+i;o.userData={...n,originalName:n.name};o.position.fromArray(n.position);o.quaternion.fromArray(n.rotation);o.scale.fromArray(n.scale);o.visible=n.active||i===0;return o;
  });
  data.nodes.forEach((n,i)=>{(n.parent>=0?nodes[n.parent]:group).add(nodes[i]);});group.updateMatrixWorld(true);
  data.nodes.forEach((n,i)=>{if(n.skin){const skeleton=new THREE.Skeleton(n.skin.bones.map(j=>nodes[j]||nodes[0]),n.skin.inverses.map(m=>new THREE.Matrix4().fromArray(m)));nodes[i].bind(skeleton,nodes[i].matrixWorld);}});
  const clips=(data.clips||[]).map(c=>{const times=Float32Array.from({length:c.frames},(_,i)=>i*c.duration/(c.frames-1)),tracks=[];
   for(const t of c.tracks){const a=this.array(t.data),pos=[],rot=[];let changedP=false,changedR=false;for(let f=0;f<c.frames;f++){for(let k=0;k<3;k++){pos.push(a[f*7+k]);if(Math.abs(a[f*7+k]-a[k])>.00001)changedP=true;}for(let k=3;k<7;k++){rot.push(a[f*7+k]);if(Math.abs(a[f*7+k]-a[k])>.00001)changedR=true;}}
    // Constant tracks are retained for the rest pose, but never animate the actor's world root.
    if(t.node!==0&&!(data.name.includes('Sable')&&data.nodes[t.node].name==='Facing')){tracks.push(new THREE.VectorKeyframeTrack('n'+t.node+'.position',times,pos));tracks.push(new THREE.QuaternionKeyframeTrack('n'+t.node+'.quaternion',times,rot));}
   }return new THREE.AnimationClip(c.name,c.duration,tracks);
  });
  group.userData={nodes,clips,data};return group;
 }
 actor(name){return this.instantiate(this.actors.get(name));}
 room(id){
  const group=this.instantiate(this.rooms[id],{room:true}),nodes=group.userData.nodes,colliders=[],interactables=[],motions=[],emitters=[],lights=[];
  group.updateMatrixWorld(true);
  nodes.forEach(o=>{const n=o.userData;let visible=true;for(let a=o;a&&a!==group;a=a.parent)if(!a.visible)visible=false;if(!visible)return;
   for(const c of n.colliders||[]){const box=new THREE.Box3().setFromCenterAndSize(new THREE.Vector3().fromArray(c.center),new THREE.Vector3().fromArray(c.size)).applyMatrix4(o.matrixWorld);if(box.max.y>.42&&box.min.y<1.5)colliders.push({x0:box.min.x,x1:box.max.x,z0:box.min.z,z1:box.max.z});}
   if(n.interact){const p=o.getWorldPosition(new THREE.Vector3());interactables.push({...n.interact,x:p.x,z:p.z,node:o,used:false});}
   if(n.motion)motions.push({node:o,...n.motion,position:o.position.clone(),rotation:o.quaternion.clone()});
   if(n.particle){const p=o.getWorldPosition(new THREE.Vector3());if(/steam|mist|smoke|vent|plume/i.test(n.name))emitters.push({x:p.x,y:p.y,z:p.z,...n.particle});}
   if(n.light&&n.light.type==='Point'){const p=o.getWorldPosition(new THREE.Vector3());lights.push({...n.light,position:p});}
  });
  // Consolidate static geometry without flattening the animated mechanisms.
  const batches=new Map();for(const o of nodes){if(!o.isMesh||o.isSkinnedMesh)continue;let dynamic=false,visible=true;for(let a=o;a&&a!==group;a=a.parent){if(a.userData.motion||a.userData.interact)dynamic=true;if(!a.visible)visible=false;}if(dynamic||!visible)continue;
   const src=o.geometry;for(const g of src.groups){const mat=o.material[g.materialIndex];if(!mat)continue;const geo=new THREE.BufferGeometry();for(const k of ['position','normal','uv'])if(src.attributes[k])geo.setAttribute(k,src.attributes[k]);geo.setIndex(new THREE.BufferAttribute(src.index.array.slice(g.start,g.start+g.count),1));const cp=geo.clone().applyMatrix4(o.matrixWorld);if(o.matrixWorld.determinant()<0){const ix=cp.index.array;for(let k=0;k<ix.length;k+=3){const v=ix[k];ix[k]=ix[k+2];ix[k+2]=v;}}if(!cp.attributes.uv)cp.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(cp.attributes.position.count*2),2));if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(cp);}o.layers.set(31);
  }
  for(const[mat,list]of batches){const merged=mergeGeometries(list,false);if(merged){const mesh=new THREE.Mesh(merged,mat);mesh.receiveShadow=true;group.add(mesh);}list.forEach(g=>g.dispose());}
  lights.sort((a,b)=>b.intensity-a.intensity);for(const l of lights.slice(0,8)){const light=new THREE.PointLight(new THREE.Color().fromArray(l.color),l.intensity*7,l.range,1.7);light.position.copy(l.position);group.add(light);}
  group.userData={...group.userData,colliders,interactables,motions,emitters};return group;
 }
}
export {THREE,BASE};
