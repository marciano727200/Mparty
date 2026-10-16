const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "m@m.m";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const ADMIN_PASSWORD_SALT = process.env.ADMIN_PASSWORD_SALT;
const ADMIN_PASSWORD_ITERATIONS = Number(process.env.ADMIN_PASSWORD_ITERATIONS || 310000);
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!ADMIN_PASSWORD_HASH || !ADMIN_PASSWORD_SALT || !SESSION_SECRET) {
  console.error("Faltan variables de entorno de seguridad.");
  process.exit(1);
}

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const movieFile = path.join(dataDir, "movies.json");
const reportFile = path.join(dataDir, "reports.json");
const userFile = path.join(dataDir, "users.json");
const chatFile = path.join(dataDir, "chat.json");
const offersFile = path.join(dataDir, "offers.json");
const pricesFile = path.join(dataDir, "prices.json");

if (!fs.existsSync(movieFile)) {
  fs.writeFileSync(movieFile, JSON.stringify(
    Array.from({length:100}, (_,i)=>({n:i+1,name:`Película ${i+1}`,desc:"",img:"",video:""})),
    null, 2
  ));
}

function loadMovies(){ return JSON.parse(fs.readFileSync(movieFile,"utf8")); }
function saveMovies(m){ fs.writeFileSync(movieFile, JSON.stringify(m,null,2)); }
if (!fs.existsSync(reportFile)) fs.writeFileSync(reportFile, "[]");
if (!fs.existsSync(userFile)) fs.writeFileSync(userFile, "[]");
if (!fs.existsSync(chatFile)) fs.writeFileSync(chatFile, "[]");
if (!fs.existsSync(offersFile)) fs.writeFileSync(offersFile, "[]");
if (!fs.existsSync(pricesFile)) fs.writeFileSync(pricesFile, JSON.stringify({packageDiscount:10,items:[
  {name:"Netflix",options:[{label:"Cuenta",price:250},{label:"Perfil",price:70}]},
  {name:"Disney+ + ESPN",options:[{label:"Cuenta",price:110},{label:"Perfil",price:35}]},
  {name:"Max",options:[{label:"Cuenta",price:80},{label:"Perfil",price:30}]},
  {name:"Prime Video",options:[{label:"Cuenta",price:60},{label:"Perfil",price:15}]},
  {name:"Vix",options:[{label:"Cuenta",price:50},{label:"Perfil",price:12}]},
  {name:"Crunchyroll",options:[{label:"Cuenta",price:60},{label:"Perfil",price:15}]},
  {name:"Paramount",options:[{label:"Cuenta",price:65},{label:"Perfil",price:18}]},
  {name:"Spotify",options:[{label:"1 mes",price:40},{label:"3 meses",price:100}]},
  {name:"YouTube",options:[{label:"Precio",price:30}]},
  {name:"CapCut",options:[{label:"Precio",price:75}]},
  {name:"Canva",options:[{label:"Precio",price:75}]},
  {name:"ChatGPT",options:[{label:"Precio",price:75}]},
  {name:"Gemini",options:[{label:"Precio",price:75}]},
  {name:"Libros",options:[{label:"C/U",price:20}]}
]},null,2));

function loadUsers(){ return JSON.parse(fs.readFileSync(userFile,"utf8")); }
function saveUsers(u){ fs.writeFileSync(userFile, JSON.stringify(u,null,2)); }
function loadReports(){ return JSON.parse(fs.readFileSync(reportFile,"utf8")); }
function saveReports(r){ fs.writeFileSync(reportFile, JSON.stringify(r,null,2)); }
function loadChat(){ return JSON.parse(fs.readFileSync(chatFile,"utf8")); }
function saveChat(c){ fs.writeFileSync(chatFile, JSON.stringify(c,null,2)); }
function loadOffers(){ return JSON.parse(fs.readFileSync(offersFile,"utf8")); }
function saveOffers(o){ fs.writeFileSync(offersFile, JSON.stringify(o,null,2)); }
function loadPrices(){ return JSON.parse(fs.readFileSync(pricesFile,"utf8")); }
function savePrices(p){ fs.writeFileSync(pricesFile, JSON.stringify(p,null,2)); }

function safePrices(x){
  const items=Array.isArray(x.items)?x.items.slice(0,50).map(it=>({
    name:String(it.name||"").trim().slice(0,80),
    options:Array.isArray(it.options)?it.options.slice(0,3).map(o=>({label:String(o.label||"Precio").slice(0,40),price:Math.max(0,Math.min(100000,Number(o.price)||0))})):[]
  })).filter(it=>it.name&&it.options.length):[];
  return {packageDiscount:Math.max(0,Math.min(90,Number(x.packageDiscount)||0)),items};
}
function safeChatMessage(m){ return {id:String(m.id||crypto.randomUUID()).slice(0,80),sender:m.sender==="admin"?"admin":"user",name:String(m.name||"").slice(0,80),text:String(m.text||"").slice(0,1000),createdAt:m.createdAt||new Date().toISOString()}; }
function safeReport(x){
  return {
    id: String(x.id || crypto.randomUUID()).slice(0,80),
    platform: String(x.platform||"").slice(0,60),
    account: String(x.account||"").slice(0,100),
    email: String(x.email||"").slice(0,120),
    phone: String(x.phone||"").slice(0,30),
    problem: String(x.problem||"").slice(0,1000),
    status: ["Pendiente","En proceso","Resuelto"].includes(x.status) ? x.status : "Pendiente",
    createdAt: x.createdAt || new Date().toISOString(),
    messages: Array.isArray(x.messages) ? x.messages.slice(-200).map(m=>({
      id:String(m.id||crypto.randomUUID()).slice(0,80),
      sender:m.sender === "admin" ? "admin" : "user",
      name:String(m.name||"").slice(0,80),
      text:String(m.text||"").slice(0,1000),
      createdAt:m.createdAt || new Date().toISOString()
    })) : []
  };
}

function parseCookies(req){
  const out={};
  for(const part of (req.headers.cookie||"").split(";")){
    const i=part.indexOf("="); if(i>0) out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());
  }
  return out;
}
function sign(value){
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}
const SESSION_DAYS = 30;
const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60;

function makeSession(email){
  const payload=Buffer.from(JSON.stringify({email,exp:Date.now()+1000*60*60*24*SESSION_DAYS})).toString("base64url");
  return payload+"."+sign(payload);
}
function adminFromRequest(req){
  const token=parseCookies(req).ms_admin;
  if(!token) return null;
  const [p,s]=token.split(".");
  if(!p||!s||sign(p)!==s) return null;
  try{
    const d=JSON.parse(Buffer.from(p,"base64url").toString());
    if(d.exp<Date.now() || d.email!==ADMIN_EMAIL) return null;
    return {email:d.email,name:"Administrador"};
  }catch{return null}
}

function makePasswordHash(password){
  const salt=crypto.randomBytes(16);
  const iterations=310000;
  const hash=crypto.pbkdf2Sync(String(password),salt,iterations,32,"sha256");
  return {hash:hash.toString("base64"),salt:salt.toString("base64"),iterations};
}
function verifyUserPassword(password,u){
  try{
    const actual=crypto.pbkdf2Sync(String(password),Buffer.from(u.salt,"base64"),Number(u.iterations||310000),32,"sha256");
    return crypto.timingSafeEqual(actual,Buffer.from(u.hash,"base64"));
  }catch{return false}
}
function makeUserSession(user){
  const payload=Buffer.from(JSON.stringify({id:user.id,email:user.email,name:user.name,exp:Date.now()+1000*60*60*24*SESSION_DAYS})).toString("base64url");
  return payload+"."+sign(payload);
}
function userFromRequest(req){
  const token=parseCookies(req).ms_user;
  if(!token) return null;
  const [p,s]=token.split(".");
  if(!p||!s||sign(p)!==s) return null;
  try{
    const d=JSON.parse(Buffer.from(p,"base64url").toString());
    if(d.exp<Date.now()) return null;
    const u=loadUsers().find(x=>x.id===d.id && x.email===d.email);
    return u?{id:u.id,email:u.email,name:u.name}:null;
  }catch{return null}
}

function verifyPassword(password){
  const salt=Buffer.from(ADMIN_PASSWORD_SALT,"base64");
  const expected=Buffer.from(ADMIN_PASSWORD_HASH,"base64");
  const actual=crypto.pbkdf2Sync(password,salt,ADMIN_PASSWORD_ITERATIONS,expected.length,"sha256");
  return crypto.timingSafeEqual(actual,expected);
}
function json(res,status,data,headers={}){
  const body=JSON.stringify(data);
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers});
  res.end(body);
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    let b=""; req.on("data",c=>{b+=c;if(b.length>600000) reject(new Error("body too large"))});
    req.on("end",()=>{try{resolve(JSON.parse(b||"{}"))}catch{reject(new Error("invalid json"))}});
    req.on("error",reject);
  });
}
function safeOffer(x){
  return {
    id: String(x.id || crypto.randomUUID()).slice(0,80),
    title: String(x.title||"").trim().slice(0,120),
    description: String(x.description||"").slice(0,500),
    image: String(x.image||"").slice(0,500000),
    regularPrice: String(x.regularPrice||"").slice(0,40),
    offerPrice: String(x.offerPrice||"").slice(0,40),
    validity: String(x.validity||"").slice(0,120),
    whatsapp: String(x.whatsapp||"").slice(0,500),
    createdAt: x.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function safeMovie(x){
  const n=Number(x.n);
  return {n,name:String(x.name||"").slice(0,120),desc:String(x.desc||"").slice(0,1000),img:String(x.img||"").slice(0,500000),video:String(x.video||"").slice(0,5000)};
}

const server=http.createServer(async(req,res)=>{
  try{
    if(req.url==="/api/movies" && req.method==="GET"){
      return json(res,200,loadMovies());
    }
    if(req.url==="/api/admin/me" && req.method==="GET"){
      const a=adminFromRequest(req); return a?json(res,200,a):json(res,401,{error:"No autenticado"});
    }
    if(req.url==="/api/auth/register" && req.method==="POST"){
      const b=await readBody(req);
      const name=String(b.name||"").trim().slice(0,80);
      const email=String(b.email||"").trim().toLowerCase().slice(0,160);
      const password=String(b.password||"");
      if(name.length<2) return json(res,400,{error:"Escribe tu nombre."});
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res,400,{error:"Correo electrónico inválido."});
      if(password.length<6) return json(res,400,{error:"La contraseña debe tener al menos 6 caracteres."});
      if(email===ADMIN_EMAIL.toLowerCase()) return json(res,409,{error:"Ese correo está reservado para administración."});
      const users=loadUsers();
      if(users.some(u=>u.email===email)) return json(res,409,{error:"Ese correo ya está registrado."});
      const ph=makePasswordHash(password);
      const user={id:crypto.randomUUID(),name,email,...ph,createdAt:new Date().toISOString()};
      users.push(user); saveUsers(users);
      const token=makeUserSession(user);
      return json(res,201,{ok:true,name:user.name,email:user.email},{"Set-Cookie":`ms_user=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`});
    }
    if(req.url==="/api/auth/login" && req.method==="POST"){
      const b=await readBody(req); const email=String(b.email||"").trim().toLowerCase(); const password=String(b.password||"");
      if(email===ADMIN_EMAIL.toLowerCase()) return json(res,403,{error:"Usa el acceso de administrador."});
      const u=loadUsers().find(x=>x.email===email);
      if(!u || !verifyUserPassword(password,u)) return json(res,401,{error:"Correo o contraseña incorrectos."});
      const token=makeUserSession(u);
      return json(res,200,{ok:true,name:u.name,email:u.email},{"Set-Cookie":`ms_user=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`});
    }
    if(req.url==="/api/auth/me" && req.method==="GET"){
      const u=userFromRequest(req); return u?json(res,200,u):json(res,401,{error:"No autenticado"});
    }
    if(req.url==="/api/auth/logout" && req.method==="POST"){
      return json(res,200,{ok:true},{"Set-Cookie":"ms_user=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"});
    }
    if(req.url==="/api/admin/login" && req.method==="POST"){
      const b=await readBody(req);
      if(String(b.email||"").trim().toLowerCase()!==ADMIN_EMAIL.toLowerCase() || !verifyPassword(String(b.password||"")))
        return json(res,401,{error:"Correo o contraseña incorrectos."});
      const token=makeSession(ADMIN_EMAIL);
      return json(res,200,{name:"Administrador"},{ "Set-Cookie":`ms_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`});
    }
    if(req.url==="/api/admin/logout" && req.method==="POST"){
      return json(res,200,{ok:true},{"Set-Cookie":"ms_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"});
    }
    if(req.url==="/api/offers" && req.method==="GET"){
      return json(res,200,loadOffers());
    }
    if(req.url==="/api/prices" && req.method==="GET"){
      return json(res,200,loadPrices());
    }
    if(req.url==="/api/admin/prices" && req.method==="GET"){
      if(!adminFromRequest(req)) return json(res,401,{error:"Solo el administrador puede ver los precios."});
      return json(res,200,loadPrices());
    }
    if(req.url==="/api/admin/prices" && req.method==="PUT"){
      if(!adminFromRequest(req)) return json(res,401,{error:"Solo el administrador puede modificar los precios."});
      const prices=safePrices(await readBody(req));
      if(!prices.items.length) return json(res,400,{error:"Debes tener al menos una plataforma con precio."});
      savePrices(prices); return json(res,200,prices);
    }
    if(req.url==="/api/admin/offers" && req.method==="GET"){
      if(!adminFromRequest(req)) return json(res,401,{error:"Solo el administrador puede ver las ofertas."});
      return json(res,200,loadOffers());
    }
    if(req.url==="/api/admin/offers" && req.method==="POST"){
      if(!adminFromRequest(req)) return json(res,401,{error:"Solo el administrador puede crear ofertas."});
      const offer=safeOffer(await readBody(req));
      if(!offer.title || !offer.offerPrice) return json(res,400,{error:"El nombre y el precio de oferta son obligatorios."});
      const offers=loadOffers(); offers.unshift(offer); saveOffers(offers);
      return json(res,201,{ok:true,offer});
    }
    if(req.url==="/api/admin/offers" && req.method==="PUT"){
      if(!adminFromRequest(req)) return json(res,401,{error:"Solo el administrador puede modificar ofertas."});
      const b=await readBody(req); const id=String(b.id||"");
      const offers=loadOffers(); const i=offers.findIndex(x=>x.id===id);
      if(i<0) return json(res,404,{error:"Oferta no encontrada."});
      const offer=safeOffer({...b,id,createdAt:offers[i].createdAt}); offers[i]=offer; saveOffers(offers);
      return json(res,200,{ok:true,offer});
    }
    if(req.url==="/api/admin/offers" && req.method==="DELETE"){
      if(!adminFromRequest(req)) return json(res,401,{error:"Solo el administrador puede eliminar ofertas."});
      const b=await readBody(req); const id=String(b.id||""); const offers=loadOffers(); const next=offers.filter(x=>x.id!==id);
      if(next.length===offers.length) return json(res,404,{error:"Oferta no encontrada."});
      saveOffers(next); return json(res,200,{ok:true});
    }
    if(req.url==="/api/admin/movies" && req.method==="PUT"){
      if(!adminFromRequest(req)) return json(res,401,{error:"Solo el administrador puede modificar películas."});
      const movie=safeMovie(await readBody(req));
      if(!Number.isInteger(movie.n)||movie.n<1||movie.n>100) return json(res,400,{error:"El número debe estar entre 1 y 100."});
      const movies=loadMovies(); movies[movie.n-1]=movie; saveMovies(movies);
      return json(res,200,{ok:true,movie});
    }
    if(req.url==="/api/chat" && req.method==="GET"){
      return json(res,200,loadChat().slice(-300).map(safeChatMessage));
    }
    if(req.url==="/api/chat" && req.method==="POST"){
      const u=userFromRequest(req); const a=adminFromRequest(req);
      if(!u && !a) return json(res,401,{error:"Debes iniciar sesión para escribir en el chat."});
      const b=await readBody(req); const text=String(b.text||"").trim().slice(0,1000);
      if(!text) return json(res,400,{error:"Escribe un mensaje."});
      const c=loadChat();
      c.push(safeChatMessage({sender:a?"admin":"user",name:a?"Administrador":u.name,text,createdAt:new Date().toISOString()}));
      saveChat(c.slice(-300));
      return json(res,201,{ok:true});
    }
    if(req.url==="/api/reports" && req.method==="POST"){
      const u=userFromRequest(req); if(!u) return json(res,401,{error:"Debes registrarte e iniciar sesión para enviar solicitudes."});
      const r=safeReport(await readBody(req));
      r.userId=u.id;
      r.userName=u.name;
      r.userEmail=u.email;
      r.messages=[];
      if(!r.platform||!r.account||!r.email||!r.phone||!r.problem) return json(res,400,{error:"Completa todos los campos."});
      const reports=loadReports(); reports.unshift(r); saveReports(reports);
      return json(res,201,{ok:true,id:r.id});
    }
    if(req.url==="/api/reports/mine" && req.method==="GET"){
      const u=userFromRequest(req); if(!u) return json(res,401,{error:"Debes iniciar sesión."});
      const reports=loadReports().filter(r=>r.userId===u.id).map(r=>safeReport(r));
      return json(res,200,reports);
    }
    if(req.url==="/api/reports/message" && req.method==="POST"){
      const u=userFromRequest(req); if(!u) return json(res,401,{error:"Debes iniciar sesión."});
      const b=await readBody(req); const id=String(b.id||""); const text=String(b.text||"").trim().slice(0,1000);
      if(!id||!text) return json(res,400,{error:"Escribe un mensaje."});
      const reports=loadReports(); const r=reports.find(x=>x.id===id && x.userId===u.id);
      if(!r) return json(res,404,{error:"Solicitud no encontrada."});
      if(r.status==="Resuelto") return json(res,409,{error:"Este reporte ya está resuelto."});
      if(!Array.isArray(r.messages)) r.messages=[];
      r.messages.push({id:crypto.randomUUID(),sender:"user",name:u.name,text,createdAt:new Date().toISOString()});
      r.messages=r.messages.slice(-200); saveReports(reports);
      return json(res,201,{ok:true,report:safeReport(r)});
    }
    if(req.url==="/api/admin/report-message" && req.method==="POST"){
      const a=adminFromRequest(req); if(!a) return json(res,401,{error:"Solo el administrador puede escribir en los reportes."});
      const b=await readBody(req); const id=String(b.id||""); const text=String(b.text||"").trim().slice(0,1000);
      if(!id||!text) return json(res,400,{error:"Escribe un mensaje."});
      const reports=loadReports(); const r=reports.find(x=>x.id===id);
      if(!r) return json(res,404,{error:"Solicitud no encontrada."});
      if(r.status==="Resuelto") return json(res,409,{error:"Este reporte ya está resuelto."});
      if(!Array.isArray(r.messages)) r.messages=[];
      r.messages.push({id:crypto.randomUUID(),sender:"admin",name:"Administrador",text,createdAt:new Date().toISOString()});
      r.messages=r.messages.slice(-200); saveReports(reports);
      return json(res,201,{ok:true,report:safeReport(r)});
    }
    if(req.url==="/api/admin/reports" && req.method==="GET"){
      if(!adminFromRequest(req)) return json(res,401,{error:"Solo el administrador puede ver las solicitudes."});
      return json(res,200,loadReports());
    }
    if(req.url==="/api/admin/reports" && req.method==="PUT"){
      if(!adminFromRequest(req)) return json(res,401,{error:"Solo el administrador puede modificar solicitudes."});
      const b=await readBody(req); const id=String(b.id||"");
      const status=String(b.status||"");
      if(!["Pendiente","En proceso","Resuelto"].includes(status)) return json(res,400,{error:"Estado inválido."});
      const reports=loadReports(); const r=reports.find(x=>x.id===id);
      if(!r) return json(res,404,{error:"Solicitud no encontrada."});
      r.status=status; saveReports(reports); return json(res,200,{ok:true,report:r});
    }
    if(req.url==="/api/admin/reports" && req.method==="DELETE"){
      if(!adminFromRequest(req)) return json(res,401,{error:"Solo el administrador puede eliminar solicitudes."});
      const b=await readBody(req); const id=String(b.id||"");
      const reports=loadReports(); const next=reports.filter(x=>x.id!==id);
      if(next.length===reports.length) return json(res,404,{error:"Solicitud no encontrada."});
      saveReports(next); return json(res,200,{ok:true});
    }
    if(req.method==="GET"){
      const cleanUrl = req.url.split("?
