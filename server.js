const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

const server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,`http://${req.headers.host}`);
  if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization"});return res.end()}
  
  if(u.pathname==="/"||u.pathname==="/index.html"){
    const f=path.join(__dirname,"public","index.html");
    return res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}).end(fs.readFileSync(f,"utf8"));
  }
  
  const file=path.normalize(path.join(__dirname,"public",u.pathname.replace(/^\/+/,"")));
  if(!file.startsWith(path.join(__dirname,"public")))return res.writeHead(403).end("Forbidden");
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){
    const ext=path.extname(file).toLowerCase();
    const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml"};
    return res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream"}).end(fs.readFileSync(file));
  }
  res.writeHead(404).end("Not found");
}catch(e){console.error(e);res.writeHead(500).end("Error del servidor.")}});

server.listen(PORT,()=>console.log(`Mparty: http://localhost:${PORT}`));
