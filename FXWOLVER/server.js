// FXWOLVER — zero-dependency server + real market data proxy (Yahoo Finance, no API key). Needs Node 18+.
const http=require('http'),fs=require('fs'),path=require('path');
const PORT=process.env.PORT||3000,PUB=path.join(__dirname,'public');
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const {quote,candles}=require('./lib');
http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://x'),json=(d,c)=>{res.writeHead(c||200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(d));};
  if(u.pathname==='/api/quotes'){const o={};await Promise.all((u.searchParams.get('s')||'').split(',').filter(Boolean).slice(0,40).map(async s=>{o[s]=await quote(s);}));return json(o);}
  if(u.pathname==='/api/candles'){const d=await candles(u.searchParams.get('s')||'',u.searchParams.get('i')||'1h');return json(d||[],d?200:502);}
  let f=path.join(PUB,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname));if(!f.startsWith(PUB))f=path.join(PUB,'index.html');
  fs.readFile(f,(e,b)=>{if(e)return fs.readFile(path.join(PUB,'index.html'),(e2,b2)=>{res.writeHead(e2?500:200,{'Content-Type':'text/html; charset=utf-8'});res.end(e2?'Server Error':b2);});res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});res.end(b);});
}).listen(PORT,'0.0.0.0',()=>console.log('\n  FXWOLVER is LIVE -> http://localhost:'+PORT+'\n  Real data: Binance (crypto) + Yahoo Finance (forex, gold, stocks)\n'));
