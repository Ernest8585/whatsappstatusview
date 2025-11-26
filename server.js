const http=require('http');
const fs=require('fs');
const path=require('path');
const root=path.join(process.cwd(),'public');
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.json':'application/json'};
const PLANS={basic:20,standard:25,premium:35,ultimate:45,platinum:60,diamond:80,elite:100};
const BACKEND_URL=process.env.BACKEND_URL||'http://localhost:9000';
async function createPayment(body){
  const key=process.env.NOWPAYMENTS_API_KEY||process.env.NOWPAYMENT_API_KEY;
  if(!key) return {error:'Missing NOWPAYMENTS_API_KEY'};
  const planId=body.planId; const price=PLANS[planId];
  if(!price) return {error:'Invalid planId'};
  const orderId='wsve_'+Date.now()+'_'+(body.email||'user');
  const r=await fetch('https://api.nowpayments.io/v1/payment',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key},body:JSON.stringify({price_amount:price,price_currency:'USD',pay_currency:'USDTTRC20',order_id:orderId,order_description:(body.type||'purchase')+' '+planId})});
  const data=await r.json();
  if(!r.ok) return {error:data.message||'Failed',status:r.status};
  return {payment:data};
}
async function getPaymentStatus(body){
  const key=process.env.NOWPAYMENTS_API_KEY||process.env.NOWPAYMENT_API_KEY;
  if(!key) return {error:'Missing NOWPAYMENTS_API_KEY'};
  const id=body.paymentId; if(!id) return {error:'Missing paymentId'};
  const r=await fetch('https://api.nowpayments.io/v1/payment/'+encodeURIComponent(id),{headers:{'x-api-key':key}});
  const data=await r.json();
  if(!r.ok) return {error:data.message||'Failed',status:r.status};
  return {status:data};
}
function sendJson(res,obj){
  const s=JSON.stringify(obj);
  res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','no-cache');
  res.end(s);
}
const server=http.createServer(async (req,res)=>{
  const u=new URL(req.url,'http://localhost');
  async function proxy(path){
    let raw=''; await new Promise(r=>{ req.on('data',c=>raw+=c); req.on('end',r); });
    const r=await fetch(BACKEND_URL+path,{ method:req.method, headers:{'Content-Type':'application/json'}, body: raw||undefined });
    const data=await r.text();
    res.statusCode=r.status; res.setHeader('Content-Type','application/json'); res.end(data);
  }
  if(u.pathname==='/api/config'){ return sendJson(res,{nowpayments:!!(process.env.NOWPAYMENTS_API_KEY||process.env.NOWPAYMENT_API_KEY)}); }
  if(u.pathname==='/api/payment/create'&&req.method==='POST'){
    let raw=''; req.on('data',c=>raw+=c); req.on('end',async()=>{ try{ const body=raw?JSON.parse(raw):{}; const r=await createPayment(body); sendJson(res,r);}catch(e){ sendJson(res,{error:'Invalid JSON'});} });
    return;
  }
  if(u.pathname==='/api/payment/status'&&req.method==='POST'){
    let raw=''; req.on('data',c=>raw+=c); req.on('end',async()=>{ try{ const body=raw?JSON.parse(raw):{}; const r=await getPaymentStatus(body); sendJson(res,r);}catch(e){ sendJson(res,{error:'Invalid JSON'});} });
    return;
  }
  if(u.pathname==='/api/user/upsert'&&req.method==='POST'){ return proxy('/api/user/upsert'); }
  if(u.pathname==='/api/withdrawal/request'&&req.method==='POST'){ return proxy('/api/withdrawal/request'); }
  if(u.pathname==='/api/admin/withdrawal/approve'&&req.method==='POST'){ return proxy('/api/admin/withdrawal/approve'); }
  const filePath=path.join(root,decodeURIComponent(u.pathname));
  let target=filePath;
  try{ const st=fs.statSync(filePath); if(st.isDirectory()) target=path.join(root,'index.html'); }
  catch{ target=path.join(root,'index.html'); }
  try{ const buf=fs.readFileSync(target); const ext=path.extname(target).toLowerCase(); res.setHeader('Content-Type',types[ext]||'application/octet-stream'); res.setHeader('Cache-Control','no-cache'); res.end(buf); }
  catch{ res.statusCode=404; res.end('Not found'); }
});
const port=process.env.PORT?parseInt(process.env.PORT,10):8000;
server.listen(port,()=>{ console.log('http://localhost:'+port+'/'); });
