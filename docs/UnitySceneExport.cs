using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEngine.SceneManagement;
using Newtonsoft.Json;
using NeonRequiem;
public static class ExportThree {
 static string dir="Web/NeonRequiem/public/content";
 static BinaryWriter bin; static Dictionary<UnityEngine.Object,int> meshes=new Dictionary<UnityEngine.Object,int>(),materials=new Dictionary<UnityEngine.Object,int>(),textures=new Dictionary<UnityEngine.Object,int>();
 static List<object> meshData=new List<object>(),matData=new List<object>(),texData=new List<object>();
 static float[] V(Vector3 v){return new[]{v.x,v.y,-v.z};}
 static float[] Q(Quaternion q){return new[]{-q.x,-q.y,q.z,q.w};}
 static float[] C(Color c){return new[]{c.r,c.g,c.b,c.a};}
 static float[] M(Matrix4x4 m){var s=Matrix4x4.Scale(new Vector3(1,1,-1));m=s*m*s;var a=new float[16];for(int i=0;i<16;i++)a[i]=m[i];return a;}
 static object Floats(float[] a,int size){var offset=bin.BaseStream.Position;foreach(var f in a)bin.Write(f);return new{offset,count=a.Length,size,type="f32"};}
 static object Ints(int[] a){var offset=bin.BaseStream.Position;foreach(var i in a)bin.Write(i);return new{offset,count=a.Length,size=1,type="u32"};}
 static int MeshId(Mesh m){
 if(meshes.TryGetValue(m,out int id))return id;id=meshData.Count;meshes[m]=id;meshData.Add(null);
 var p=m.vertices.SelectMany(V).ToArray();var n=m.normals.SelectMany(V).ToArray();var uv=m.uv.SelectMany(x=>new[]{x.x,x.y}).ToArray();
 var idx=new List<int>();var groups=new List<object>();for(int s=0;s<m.subMeshCount;s++){var tri=m.GetTriangles(s);for(int t=0;t<tri.Length;t+=3){int swap=tri[t];tri[t]=tri[t+2];tri[t+2]=swap;}groups.Add(new{start=idx.Count,count=tri.Length,materialIndex=s});idx.AddRange(tri);}
 var bw=m.boneWeights;
 meshData[id]=new{name=m.name,position=Floats(p,3),normal=n.Length==p.Length?Floats(n,3):null,uv=uv.Length==m.vertexCount*2?Floats(uv,2):null,index=Ints(idx.ToArray()),groups,
 skinIndex=bw.Length==m.vertexCount?Floats(bw.SelectMany(b=>new[]{(float)b.boneIndex0,b.boneIndex1,b.boneIndex2,b.boneIndex3}).ToArray(),4):null,
 skinWeight=bw.Length==m.vertexCount?Floats(bw.SelectMany(b=>new[]{b.weight0,b.weight1,b.weight2,b.weight3}).ToArray(),4):null};
 return id;}
 static int TextureId(Texture t){if(!t)return -1;if(textures.TryGetValue(t,out int id))return id;id=texData.Count;textures[t]=id;
 float factor=Mathf.Min(1,1024f/Mathf.Max(t.width,t.height));int w=Mathf.Max(1,(int)(t.width*factor)),h=Mathf.Max(1,(int)(t.height*factor));
 var rt=RenderTexture.GetTemporary(w,h,0,RenderTextureFormat.ARGB32,RenderTextureReadWrite.sRGB);var prior=RenderTexture.active;
 Graphics.Blit(t,rt);RenderTexture.active=rt;var copy=new Texture2D(w,h,TextureFormat.RGBA32,false);copy.ReadPixels(new Rect(0,0,w,h),0,0);copy.Apply();
 string file="textures/"+id+".png";File.WriteAllBytes(dir+"/"+file,copy.EncodeToPNG());RenderTexture.active=prior;RenderTexture.ReleaseTemporary(rt);UnityEngine.Object.DestroyImmediate(copy);
 texData.Add(new{name=t.name,file,width=w,height=h,source=AssetDatabase.GetAssetPath(t)});return id;}
 static int MatId(Material m){if(!m)return -1;if(materials.TryGetValue(m,out int id))return id;id=matData.Count;materials[m]=id;
 string bp=m.HasProperty("_BaseMap")?"_BaseMap":"_MainTex";Texture map=m.HasProperty(bp)?m.GetTexture(bp):null;
 var color=m.HasProperty("_BaseColor")?m.GetColor("_BaseColor"):m.HasProperty("_Color")?m.GetColor("_Color"):Color.white;
 var emission=m.HasProperty("_EmissionColor")?m.GetColor("_EmissionColor"):Color.black;
 var off=map?m.GetTextureOffset(bp):Vector2.zero;var rep=map?m.GetTextureScale(bp):Vector2.one;
 matData.Add(new{name=m.name,shader=m.shader.name,color=C(color),emission=C(emission),map=TextureId(map),normal=TextureId(m.HasProperty("_BumpMap")?m.GetTexture("_BumpMap"):null),
 metallicMap=TextureId(m.HasProperty("_MetallicGlossMap")?m.GetTexture("_MetallicGlossMap"):null),emissiveMap=TextureId(m.HasProperty("_EmissionMap")?m.GetTexture("_EmissionMap"):null),
 metallic=m.HasProperty("_Metallic")?m.GetFloat("_Metallic"):0,smoothness=m.HasProperty("_Smoothness")?m.GetFloat("_Smoothness"):.3f,
 transparent=m.renderQueue>=3000,alphaTest=m.HasProperty("_AlphaClip")&&m.GetFloat("_AlphaClip")>0?.5:0,offset=new[]{off.x,off.y},repeat=new[]{rep.x,rep.y}});return id;}
 static bool Skip(Transform t){string s=t.name.ToLowerInvariant();return s.Contains("interior cargo")||s.Contains("interior pressure")||s.Contains("cooling stores")||s.Contains("central relay")||s.Contains("reliquary stores")||s=="cloister relay"||s.Contains("generated cover")||t.GetComponent<Canvas>()!=null;}
 static object Asset(GameObject root,bool actor=false){
 var ts=root.GetComponentsInChildren<Transform>(true).Where(t=>!Skip(t)&&!AncSkip(t,root.transform)).ToArray();var dict=ts.Select((t,i)=>new{t,i}).ToDictionary(x=>x.t,x=>x.i);var nodes=new List<object>();
 foreach(var t in ts){var mr=t.GetComponent<MeshRenderer>();var mf=t.GetComponent<MeshFilter>();var sk=t.GetComponent<SkinnedMeshRenderer>();var ren=sk?(Renderer)sk:mr;
 var mesh=sk?sk.sharedMesh:mf?mf.sharedMesh:null;var light=t.GetComponent<Light>();var motion=t.GetComponent<WraithLivingMotion>();var interact=t.GetComponent<WraithInteractable>();var ps=t.GetComponent<ParticleSystem>();
 var shapes=new List<object>();foreach(var col in t.GetComponents<Collider>()){if(col.isTrigger)continue;Bounds b;if(col is BoxCollider bc)b=new Bounds(bc.center,bc.size);else if(col is SphereCollider sc)b=new Bounds(sc.center,Vector3.one*sc.radius*2);else if(col is MeshCollider mc&&mc.sharedMesh)b=mc.sharedMesh.bounds;else continue;shapes.Add(new{center=V(b.center),size=new[]{b.size.x,b.size.y,b.size.z}});}
 nodes.Add(new{name=t.name,parent=t==root.transform?-1:dict.ContainsKey(t.parent)?dict[t.parent]:-1,position=t==root.transform?new[]{0f,0f,0f}:V(t.localPosition),rotation=Q(t.localRotation),scale=new[]{t.localScale.x,t.localScale.y,t.localScale.z},active=t.gameObject.activeSelf,
 mesh=mesh&&ren&&ren.enabled?MeshId(mesh):-1,materials=ren?ren.sharedMaterials.Select(MatId).ToArray():new int[0],
 skin=sk&&sk.bones.Length>0?new{bones=sk.bones.Select(b=>dict.ContainsKey(b)?dict[b]:-1).ToArray(),inverses=sk.sharedMesh.bindposes.Select(b=>M(b*sk.transform.worldToLocalMatrix*root.transform.localToWorldMatrix)).ToArray()}:null,
 light=light?new{color=C(light.color),intensity=light.intensity,range=light.range,type=light.type.ToString()}:null,
 motion=motion?new{kind=(int)motion.motion,axis=V(motion.axis),speed=motion.speed,amplitude=motion.amplitude,phase=motion.phase}:null,
 interact=interact?new{kind=(int)interact.kind,slot=interact.slot}:null,particle=ps?new{name=ps.name,rate=ps.emission.rateOverTime.constant,lifetime=ps.main.startLifetime.constant,speed=ps.main.startSpeed.constant,size=ps.main.startSize.constant,color=C(ps.main.startColor.color)}:null,colliders=shapes});
 }
 var clips=new List<object>();if(actor){var anim=root.GetComponentInChildren<Animator>();if(anim&&anim.runtimeAnimatorController){
 foreach(var clip in anim.runtimeAnimatorController.animationClips.Distinct()){
 if(clip.length<.01f)continue;
 int frames=Mathf.Clamp(Mathf.CeilToInt(clip.length*24)+1,2,150);var values=ts.Select(t=>new List<float>()).ToArray();
 AnimationMode.StartAnimationMode();try{for(int f=0;f<frames;f++){float time=(float)f/(frames-1)*clip.length;AnimationMode.BeginSampling();AnimationMode.SampleAnimationClip(anim.gameObject,clip,time);AnimationMode.EndSampling();for(int i=0;i<ts.Length;i++){values[i].AddRange(i==0?new[]{0f,0f,0f}:V(ts[i].localPosition));values[i].AddRange(Q(ts[i].localRotation));}}}finally{AnimationMode.StopAnimationMode();}
 clips.Add(new{name=clip.name,duration=clip.length,frames,tracks=values.Select((v,i)=>new{node=i,data=Floats(v.ToArray(),7)}).ToArray()});
 }
 }}
 return new{name=root.name,nodes,clips};
 }
 static bool AncSkip(Transform t,Transform root){for(var p=t.parent;p&&p!=root;p=p.parent)if(Skip(p))return true;return false;}
 static string AudioFile(AudioClip clip){if(!clip)return null;var path=AssetDatabase.GetAssetPath(clip);var name=clip.name+Path.GetExtension(path);File.Copy(path,dir+"/audio/"+name,true);return "audio/"+name;}
 public static string Run(){
 Directory.CreateDirectory(dir+"/textures");Directory.CreateDirectory(dir+"/audio");Directory.CreateDirectory(dir+"/actors");Directory.CreateDirectory(dir+"/rooms");
 meshes.Clear();materials.Clear();textures.Clear();meshData.Clear();matData.Clear();texData.Clear();
 var e=UnityEngine.Object.FindFirstObjectByType<WraithEncounter>();if(!e)throw new Exception("No encounter");
 using(bin=new BinaryWriter(File.Create(dir+"/geometry.bin"))){
 var roomDefs=new List<object>();for(int i=0;i<e.routes.rooms.Length;i++){var r=e.routes.rooms[i];File.WriteAllText(dir+"/rooms/"+i+".json",JsonConvert.SerializeObject(Asset(r.root)));
 roomDefs.Add(new{id=i,title=r.title,subtitle=r.subtitle,danger=r.danger,reward=r.reward,halfSize=new[]{r.halfSize.x,r.halfSize.y},extraction=V(r.extraction.position-r.origin),enemies=r.enemyPool.Select(x=>x.name).ToArray(),r.extraEnemies,r.extraHealth,r.eliteCount,r.clearSalvage,r.entryHeal,r.rewardBias});}
 var prefabs=new List<GameObject>();prefabs.AddRange(e.enemyTemplates);prefabs.AddRange(e.bossTemplates);foreach(var r in e.routes.rooms)prefabs.AddRange(r.enemyPool);prefabs.AddRange(e.progress.coverPrefabs);prefabs.Add(e.salvagePrefab);prefabs.Add(e.healingPrefab);prefabs.Add(e.chestPrefab);
 var actorNames=new List<string>();foreach(var prefab in prefabs.Where(p=>p).Distinct()){
 var obj=(GameObject)PrefabUtility.InstantiatePrefab(prefab);obj.transform.position=Vector3.zero;
 try{File.WriteAllText(dir+"/actors/"+prefab.name+".json",JsonConvert.SerializeObject(Asset(obj,true)));actorNames.Add(prefab.name);}finally{UnityEngine.Object.DestroyImmediate(obj);}}
 File.WriteAllText(dir+"/actors/SableVoss.json",JsonConvert.SerializeObject(Asset(e.player.gameObject,true)));actorNames.Add("SableVoss");
 var audio=UnityEngine.Object.FindFirstObjectByType<WraithAudio>();
 var data=new{version=1,game="Neon Requiem",sourceScene=SceneManager.GetActiveScene().path,rooms=roomDefs,actors=actorNames,bosses=e.bossTemplates.Select(x=>x.name).ToArray(),cover=e.progress.coverPrefabs.Select(x=>x.name).ToArray(),relics=WraithRelicCatalog.All,loadouts=WraithRunBuild.LoadoutNames,loadoutDetails=WraithRunBuild.LoadoutDetails,
 audio=new{cues=audio.cues.Select(c=>new{c.key,c.gain,clips=c.clips.Select(AudioFile).ToArray()}).ToArray(),atmosphere=AudioFile(audio.atmosphere),score=AudioFile(audio.score),flame=AudioFile(audio.flameLoop)},
 meshes=meshData,materials=matData,textures=texData};
 File.WriteAllText(dir+"/manifest.json",JsonConvert.SerializeObject(data));}
 return JsonConvert.SerializeObject(new{meshes=meshData.Count,materials=matData.Count,textures=texData.Count,bytes=new FileInfo(dir+"/geometry.bin").Length});
 }
}
