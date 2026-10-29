import 'dotenv/config';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {rateLimit} from 'express-rate-limit';
import {pool,query} from './db.js';
import {isAdmin,canReadOrder,validCart,cleanProduct} from './policy.js';

export const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'80kb'}));
app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Cache-Control','no-store');next();});
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const secret=()=>{if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)throw Error('JWT secret missing');return process.env.JWT_SECRET;};
const audit=(id,action,type,obj)=>query('INSERT INTO audit_logs(actor_id,action,object_type,object_id) VALUES($1,$2,$3,$4)',[id,action,type,obj||null]);
function auth(req,res,next){
  const bearer=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];
  if(!bearer)return res.status(401).json({error:'Sign in required'});
  try{req.user=jwt.verify(bearer,secret(),{algorithms:['HS256']});next();}catch{res.status(401).json({error:'Invalid session'});}
}
function admin(req,res,next){
  if(isAdmin(req.user))return next();
  void audit(req.user.id,'admin_access_denied','security',null).catch(()=>{});
  res.status(403).json({error:'Access denied'});
}
const limiter=rateLimit({windowMs:15*60*1000,limit:15,standardHeaders:'draft-7',legacyHeaders:false});
app.get('/api/health',(_req,res)=>res.json({status:'ok'}));
app.post('/api/auth/register',limiter,wrap(async(req,res)=>{
  const {name,email,password}=req.body||{};
  if(typeof name!=='string'||name.trim().length<2||name.length>100||typeof email!=='string'||email.length>254||!/^.+@.+\..+$/.test(email)||typeof password!=='string'||password.length<12||password.length>128)
    return res.status(400).json({error:'Valid name, email and 12+ character password required'});
  const hash=await bcrypt.hash(password,12);
  const {rows}=await query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'customer') RETURNING id,name,email,role",[name.trim(),email.trim().toLowerCase(),hash]);
  res.status(201).json({user:rows[0]});
}));
app.post('/api/auth/login',limiter,wrap(async(req,res)=>{
  const {email,password}=req.body||{};
  if(typeof email!=='string'||typeof password!=='string'||email.length>254||password.length>256)return res.status(400).json({error:'Invalid credentials'});
  const {rows}=await query('SELECT * FROM users WHERE email=$1',[email.trim().toLowerCase()]);
  const u=rows[0];
  if(!u||!(await bcrypt.compare(password,u.password_hash)))return res.status(401).json({error:'Invalid credentials'});
  const token=jwt.sign({id:u.id,role:u.role,name:u.name,email:u.email},secret(),{expiresIn:'2h',algorithm:'HS256'});
  res.json({token,user:{id:u.id,name:u.name,email:u.email,role:u.role}});
}));
app.get('/api/products',wrap(async(req,res)=>{
  const term=String(req.query.q||'').slice(0,80);
  const {rows}=await query("SELECT id,name,description,category,price_cents,stock FROM products WHERE name ILIKE $1 OR category ILIKE $1 ORDER BY name LIMIT 100",['%'+term+'%']);
  res.json({products:rows});
}));
app.post('/api/products',auth,admin,wrap(async(req,res)=>{
  if(!cleanProduct(req.body))return res.status(400).json({error:'Invalid product details'});
  const {name,description='',category,price_cents,stock}=req.body;
  const {rows}=await query('INSERT INTO products(name,description,category,price_cents,stock) VALUES($1,$2,$3,$4,$5) RETURNING *',[name.trim(),String(description).slice(0,800),category,price_cents,stock]);
  await audit(req.user.id,'create','product',rows[0].id);
  res.status(201).json({product:rows[0]});
}));
app.patch('/api/products/:id',auth,admin,wrap(async(req,res)=>{
  const stock=req.body?.stock;
  if(!Number.isInteger(stock)||stock<0)return res.status(400).json({error:'Invalid stock'});
  const {rows}=await query('UPDATE products SET stock=$1 WHERE id=$2 RETURNING *',[stock,req.params.id]);
  if(!rows[0])return res.status(404).json({error:'Not found'});
  await audit(req.user.id,'inventory_change','product',rows[0].id);
  res.json({product:rows[0]});
}));
app.post('/api/orders',auth,wrap(async(req,res)=>{
  if(!validCart(req.body?.items))return res.status(400).json({error:'Invalid cart'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const items=[];
    let total=0;
    for(const item of [...req.body.items].sort((a,b)=>a.product_id.localeCompare(b.product_id))){
      const {rows}=await client.query('SELECT id,price_cents,stock FROM products WHERE id=$1 FOR UPDATE',[item.product_id]);
      const p=rows[0];
      if(!p||p.stock<item.quantity){await client.query('ROLLBACK');return res.status(409).json({error:'Insufficient inventory'});}
      total+=p.price_cents*item.quantity;
      if(total>100000000){await client.query('ROLLBACK');return res.status(400).json({error:'Cart value exceeds demo limit'});}
      items.push({...item,price_cents:p.price_cents});
    }
    const {rows}=await client.query("INSERT INTO orders(user_id,total_cents,status) VALUES($1,$2,'simulated_paid') RETURNING id,total_cents,status,created_at",[req.user.id,total]);
    for(const item of items){
      await client.query('UPDATE products SET stock=stock-$1 WHERE id=$2',[item.quantity,item.product_id]);
      await client.query('INSERT INTO order_items(order_id,product_id,quantity,unit_price_cents) VALUES($1,$2,$3,$4)',[rows[0].id,item.product_id,item.quantity,item.price_cents]);
    }
    await client.query('INSERT INTO audit_logs(actor_id,action,object_type,object_id) VALUES($1,$2,$3,$4)',[req.user.id,'simulated_checkout','order',rows[0].id]);
    await client.query('COMMIT');
    res.status(201).json({order:rows[0]});
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}));
app.get('/api/orders',auth,wrap(async(req,res)=>{
  const {rows}=await query('SELECT id,total_cents,status,created_at FROM orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[req.user.id]);
  res.json({orders:rows});
}));
app.get('/api/orders/:id',auth,wrap(async(req,res)=>{
  const {rows}=await query('SELECT * FROM orders WHERE id=$1',[req.params.id]);
  if(!rows[0])return res.status(404).json({error:'Order not found'});
  if(!canReadOrder(req.user,rows[0])){await audit(req.user.id,'order_access_denied','security',null);return res.status(403).json({error:'Access denied'});}
  const products=await query('SELECT p.name,i.quantity,i.unit_price_cents FROM order_items i JOIN products p ON p.id=i.product_id WHERE order_id=$1',[req.params.id]);
  res.json({order:{...rows[0],items:products.rows}});
}));
app.get('/api/admin/dashboard',auth,admin,wrap(async(_req,res)=>{
  const {rows}=await query('SELECT (SELECT count(*)::int FROM orders) orders,(SELECT coalesce(sum(total_cents),0)::int FROM orders) total_cents,(SELECT count(*)::int FROM products WHERE stock<10) low_stock,(SELECT count(*)::int FROM users) users');
  res.json({metrics:rows[0]});
}));
app.use((_req,res)=>res.status(404).json({error:'Not found'}));
app.use((err,_req,res,_next)=>{const status=err.code==='23505'?409:['22P02','23503'].includes(err.code)?400:500;if(status===500)console.error('Unexpected API error',err.code||err.name);res.status(status).json({error:status===409?'Duplicate record':status===400?'Invalid reference':'Internal server error'});});
if(process.env.NODE_ENV!=='test')app.listen(Number(process.env.PORT||3100),()=>console.log('CommerceGuard API ready'));
