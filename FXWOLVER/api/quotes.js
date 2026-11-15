const {quote}=require('../lib');
module.exports=async(req,res)=>{const o={};await Promise.all(String(req.query.s||'').split(',').filter(Boolean).slice(0,40).map(async s=>{o[s]=await quote(s);}));res.setHeader('Cache-Control','s-maxage=3,stale-while-revalidate=5');res.status(200).json(o);};
