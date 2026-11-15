const {candles}=require('../lib');
module.exports=async(req,res)=>{const d=await candles(String(req.query.s||''),String(req.query.i||'1h'));res.setHeader('Cache-Control','s-maxage=10');res.status(d?200:502).json(d||[]);};
