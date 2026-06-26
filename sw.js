var CACHE = "xigua-v2";
var ASSETS = ["./","./index.html","./manifest.webmanifest","./icon.svg","./icon-192.png","./icon-512.png"];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(ASSETS);}).catch(function(){}));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch(_) { return; }
  // 不缓存 API、跨域 API 请求一律直通网络
  if(url.pathname.indexOf("/api/") === 0 || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then(function(cached){
      var net = fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){c.put(req, copy);}).catch(function(){});
        return res;
      }).catch(function(){ return cached; });
      return cached || net;
    })
  );
});
