/* QuizPulse: PWA offline shell and all 9,000 questions. Scoped to the repository path. */
'use strict';
const VERSION='20261024-pwa-1';
const CACHE='quizpulse-pwa-'+VERSION;
const PACKS='ABC'.split('').flatMap(d=>[1,2,3].flatMap(n=>[
  './data/'+d+n+'.json',
  './data/answers_'+d+n+'.json'
]));
const SHELL=[
  './','./index.html','./assets/style.css',
  './assets/light.css?v=5','./assets/app.js?v=5',
  './manifest.webmanifest',
  './icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png'
];

async function saveData(){
  const cache=await caches.open(CACHE);
  let saved=0;
  for(const url of PACKS){
    try{
      if(await cache.match(url)){saved++;continue}
      const res=await fetch(new Request(url,{cache:'reload'}));
      if(!res.ok)throw new Error('HTTP '+res.status);
      await cache.put(url,res);
      saved++;
    }catch(err){
      console.warn('[QuizPulse PWA] Offline data unavailable:',url,err);
    }
  }
  return saved;
}
async function offlineStatus(){
 const cache=await caches.open(CACHE);
 let count=0;
 for(const path of PACKS)if(await cache.match(path))count++;
 return {type:'QUIZPULSE_OFFLINE_STATUS',cached:count,total:PACKS.length,ready:count===PACKS.length};
}
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(SHELL);
  await saveData(); // Best effort: failure to save a bank cannot break app installation.
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  for(const key of await caches.keys()){
   if(key.startsWith('quizpulse-pwa-')&&key!==CACHE)await caches.delete(key);
  }
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url),scope=new URL(self.registration.scope);
 if(req.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 if(req.mode==='navigate'){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   try{
    const response=await fetch(req);
    if(response.ok)await cache.put('./index.html',response.clone());
    return response;
   }catch{
    return await cache.match('./index.html')||await cache.match('./')||Response.error();
   }
  })());
  return;
 }
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const saved=await cache.match(req);
  if(saved)return saved;
  const response=await fetch(req);
  if(response.ok&&response.type!=='opaque')await cache.put(req,response.clone());
  return response;
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='QUIZPULSE_CHECK_OFFLINE'){
  event.waitUntil(offlineStatus().then(s=>event.source?.postMessage(s)));
 }
 if(event.data?.type==='QUIZPULSE_CACHE_ALL'){
  event.waitUntil((async()=>{
   await saveData();
   event.source?.postMessage(await offlineStatus());
  })());
 }
});
