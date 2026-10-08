const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const ROOM_TTL = 1000 * 60 * 60 * 12;

function clean(s, max=500) {
  return String(s ?? "").replace(/[<>]/g, "").trim().slice(0, max);
}
function code() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}
function roomPublic(r) {
  return {
    code:r.code, hostId:r.hostId,
    users:[...r.users.values()].map(u=>({id:u.id,name:u.name})),
    media:r.media,
    version:r.version,
    messages:r.messages.slice(-100)
  };
}
function getRoom(c) {
  return rooms.get(String(c||"").toUpperCase());
}
function send(res,status,data,type="application/json") {
  res.writeHead(status, {"Content-Type":type, "Cache-Control":"no-store", "Access-Control-Allow-Origin":"*"});
  res.end(type.includes("json") ? JSON.stringify(data) : data);
}
async function body(req) {
  return await new Promise((resolve,reject)=>{
    let b="";
    req.on("data",x=>{b+=x;if(b.length>100000) req.destroy();});
    req.on("end",()=>{try{resolve(JSON.parse(b||"{}"))}catch(e){resolve({})}});
    req.on("error",reject);
  });
}
function mediaFor(url) {
  let u=clean(url,2000);
  if (!u) return {type:"none",url:""};
  // Accept a full OneDrive <iframe ...> embed code as well as a plain URL.
  // We extract only the src so the browser receives the actual Microsoft embed page.
  const iframeMatch = u.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
  if (iframeMatch) u = iframeMatch[1];
  // OneDrive share links: add the official embed hint so the iframe can render
  // the shared media instead of the normal OneDrive landing page.
  try {
    const x = new URL(u.startsWith("http") ? u : "https://" + u);
    const host = x.hostname.toLowerCase();
    if (host === "1drv.ms" || host.endsWith(".1drv.ms")) {
      if (!x.searchParams.has("embed")) x.searchParams.set("embed", "1");
      return {type:"onedrive",url:x.toString(),originalUrl:u};
    }
    if (host === "onedrive.live.com" || host.endsWith(".onedrive.live.com")) {
      // Current OneDrive embed links can use /personal/.../_layouts/15/embed.aspx
      // and are already ready to be displayed in an iframe.
      if (x.pathname.includes("/_layouts/15/embed.aspx") || x.pathname.startsWith("/embed")) {
        return {type:"onedrive",url:x.toString(),originalUrl:u};
      }
      if (x.searchParams.has("resid") || x.searchParams.has("id")) {
        const q = new URLSearchParams(x.searchParams);
        if (!q.has("embed")) q.set("embed","1");
        return {type:"onedrive",url:"https://onedrive.live.com/embed?"+q.toString(),originalUrl:u};
      }
    }
  } catch {}
  if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(u)) {
    let id="";
    try {
      const x=new URL(u.startsWith("http")?u:"https://"+u);
      if(x.hostname.includes("youtu.be")) id=x.pathname.slice(1).split("/")[0];
      else if(x.pathname==="/watch") id=x.searchParams.get("v")||"";
      else if(x.pathname.startsWith("/shorts/")) id=x.pathname.split("/")[2]||"";
      else if(x.pathname.startsWith("/embed/")) id=x.pathname.split("/")[2]||"";
    } catch {}
    if(id) return {type:"youtube",url:u,id};
  }
  if(/\.(mp4|webm|ogg|m4v)(\?.*)?$/i.test(u)) return {type:"video",url:u};
  return {type:"iframe",url:u};
}
setInterval(()=>{
  const now=Date.now();
  for(const [c,r] of rooms) if(now-r.lastActivity>ROOM_TTL) rooms.delete(c);
}, 10*60*1000);

const server=http.createServer(async (req,res)=>{
  try {
    const u=new URL(req.url, `http://${req.headers.host}`);
    if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type"});return res.end();}
    if(u.pathname==="/api/room" && req.method==="POST"){
      const b=await body(req), name=clean(b.name,30)||"Invitado";
      let c=code(); while(rooms.has(c)) c=code();
      const id=crypto.randomUUID();
      const r={code:c,hostId:id,users:new Map([[id,{id,name}]]),media:{type:"none",url:"",id:"",playing:false,time:0,updatedAt:Date.now()},version:1,messages:[],lastActivity:Date.now()};
      rooms.set(c,r);
      return send(res,200,{room:c,userId:id,state:roomPublic(r)});
    }
    if(u.pathname==="/api/room/join" && req.method==="POST"){
      const b=await body(req), r=getRoom(b.room), name=clean(b.name,30)||"Invitado";
      if(!r) return send(res,404,{error:"Sala no encontrada."});
      const id=crypto.randomUUID(); r.users.set(id,{id,name}); r.lastActivity=Date.now();
      return send(res,200,{room:r.code,userId:id,state:roomPublic(r)});
    }
    const m=u.pathname.match(/^\/api\/room\/([A-Z0-9]{6})\/state$/);
    if(m && req.method==="GET"){
      const r=getRoom(m[1]); if(!r) return send(res,404,{error:"Sala no encontrada."});
      r.lastActivity=Date.now(); return send(res,200,roomPublic(r));
    }
    const action=u.pathname.match(/^\/api\/room\/([A-Z0-9]{6})\/(media|chat|leave)$/);
    if(action && req.method==="POST"){
      const r=getRoom(action[1]); if(!r) return send(res,404,{error:"Sala no encontrada."});
      const b=await body(req), uid=clean(b.userId,100), user=r.users.get(uid);
      if(!user) return send(res,403,{error:"Usuario no válido."});
      r.lastActivity=Date.now();
      if(action[2]==="media"){
        if(uid!==r.hostId) return send(res,403,{error:"Solo el anfitrión puede cambiar la película."});
        if(b.kind==="load") {
          r.media={...mediaFor(b.url),playing:false,time:0,updatedAt:Date.now()};
        } else if(b.kind==="play") {
          r.media.playing=true; r.media.updatedAt=Date.now()-Number(b.time||0)*1000; r.media.time=Number(b.time||0);
        } else if(b.kind==="pause") {
          r.media.time=Math.max(0,Number(b.time||0)); r.media.playing=false; r.media.updatedAt=Date.now();
        } else if(b.kind==="seek") {
          r.media.time=Math.max(0,Number(b.time||0)); r.media.updatedAt=Date.now();
        }
        r.version++;
      } else if(action[2]==="chat"){
        const text=clean(b.text,500); if(text) r.messages.push({id:crypto.randomUUID(),name:user.name,text,at:Date.now()});
        r.messages=r.messages.slice(-100); r.version++;
      } else {
        r.users.delete(uid); if(uid===r.hostId){ const next=r.users.keys().next(); r.hostId=next.done?null:next.value; }
        r.version++;
      }
      return send(res,200,roomPublic(r));
    }
    if(u.pathname==="/" || !u.pathname.includes("/")){
      const f=path.join(__dirname,"public","index.html");
      return send(res,200,fs.readFileSync(f,"utf8"),"text/html; charset=utf-8");
    }
    const file=path.normalize(path.join(__dirname,"public",u.pathname.replace(/^\/+/,"")));
    if(!file.startsWith(path.join(__dirname,"public"))) return send(res,403,{error:"Forbidden"});
    if(fs.existsSync(file) && fs.statSync(file).isFile()){
      const ext=path.extname(file).toLowerCase();
      const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml"};
      return send(res,200,fs.readFileSync(file),types[ext]||"application/octet-stream");
    }
    send(res,404,{error:"Not found"});
  } catch(e) { console.error(e); send(res,500,{error:"Error del servidor."}); }
});
server.listen(PORT,()=>console.log(`Cine con Amigos: http://localhost:${PORT}`));
