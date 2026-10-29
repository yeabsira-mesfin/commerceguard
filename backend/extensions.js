import {randomBytes,createHash} from 'node:crypto';
import bcrypt from 'bcryptjs';

const validProduct=x=>typeof x?.name==='string'&&x.name.trim().length>=3&&x.name.length<=120&&typeof x.description==='string'&&x.description.length<=800&&typeof x.category==='string'&&x.category.trim().length>=2&&x.category.length<=80&&Number.isInteger(x.price_cents)&&x.price_cents>=0&&x.price_cents<=10000000&&Number.isInteger(x.stock)&&x.stock>=0;
const hashToken=x=>createHash('sha256').update(x).digest('hex');

export function installCommerceExtensions(app,{query,pool,auth,admin,limiter,wrap,audit}){
 const reject=(res,message='Invalid data')=>res.status(400).json({error:message});
 app.get('/api/products/:id',wrap(async(req,res)=>{
  const {rows}=await query('SELECT id,name,description,category,price_cents,stock FROM products WHERE id=$1',[req.params.id]);
  if(!rows.length)return res.status(404).json({error:'Product not found'});
  res.json({product:rows[0]});
 }));
 app.patch('/api/products/:id/details',auth,admin,wrap(async(req,res)=>{
  if(!validProduct(req.body))return reject(res,'Invalid product details');
  const p=req.body;
  const {rows}=await query('UPDATE products SET name=$1,description=$2,category=$3,price_cents=$4,stock=$5 WHERE id=$6 RETURNING *',[p.name.trim(),p.description,p.category.trim(),p.price_cents,p.stock,req.params.id]);
  if(!rows.length)return res.status(404).json({error:'Product not found'});
  await audit(req.user.id,'edit','product',req.params.id);
  res.json({product:rows[0]});
 }));
 app.get('/api/profile',auth,wrap(async(req,res)=>{
  const {rows}=await query('SELECT id,name,email,role,created_at FROM users WHERE id=$1',[req.user.id]);
  if(!rows.length)return res.status(404).json({error:'Account not found'});
  res.json({user:rows[0]});
 }));
 app.patch('/api/profile',auth,wrap(async(req,res)=>{
  const name=req.body?.name;
  if(typeof name!=='string'||name.trim().length<2||name.length>100)return reject(res,'Invalid profile name');
  const {rows}=await query('UPDATE users SET name=$1 WHERE id=$2 RETURNING id,name,email,role',[name.trim(),req.user.id]);
  await audit(req.user.id,'edit_profile','user',req.user.id);
  res.json({user:rows[0]});
 }));
 app.get('/api/admin/orders',auth,admin,wrap(async(_req,res)=>{
  const {rows}=await query('SELECT o.id,o.total_cents,o.status,o.created_at,u.name customer_name FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 200');
  res.json({orders:rows});
 }));
 app.patch('/api/admin/orders/:id/status',auth,admin,wrap(async(req,res)=>{
  const status=req.body?.status;
  if(!['simulated_paid','processing','fulfilled','cancelled'].includes(status))return reject(res,'Invalid order status');
  const {rows}=await query('UPDATE orders SET status=$1 WHERE id=$2 RETURNING id,status,total_cents',[status,req.params.id]);
  if(!rows.length)return res.status(404).json({error:'Order not found'});
  await audit(req.user.id,'order_status_change','order',req.params.id);
  res.json({order:rows[0]});
 }));
 app.get('/api/admin/audit',auth,admin,wrap(async(_req,res)=>{
  const {rows}=await query('SELECT id,action,object_type,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100');
  res.json({audit:rows});
 }));

 // Reset delivery is intentionally simulated; no token is ever exposed in production.
 // For an isolated local demo ONLY, DEMO_RESET_TOKENS=true returns a token once.
 app.post('/api/auth/forgot-password',limiter,wrap(async(req,res)=>{
  const email=req.body?.email;
  if(typeof email!=='string'||email.length>254)return reject(res,'Valid email required');
  const {rows}=await query('SELECT id FROM users WHERE email=$1',[email.trim().toLowerCase()]);
  let demoToken;
  if(rows.length){
   const token=randomBytes(32).toString('hex');
   await query('INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES($1,$2,now() + interval \'15 minutes\')',[rows[0].id,hashToken(token)]);
   if(process.env.NODE_ENV!=='production'&&process.env.DEMO_RESET_TOKENS==='true')demoToken=token;
  }
  // Uniform response for unknown and known emails, except local demo disclosure.
  res.json({message:'If an account exists, a reset request has been processed.',delivery:'demo_only',...(demoToken?{demo_token:demoToken}:{})});
 }));
 app.post('/api/auth/reset-password',limiter,wrap(async(req,res)=>{
  const {token,password}=req.body||{};
  if(typeof token!=='string'||!/^[0-9a-f]{64}$/.test(token)||typeof password!=='string'||password.length<12||password.length>128)return reject(res,'Invalid reset request');
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   const record=await client.query("SELECT user_id FROM password_resets WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now() FOR UPDATE",[hashToken(token)]);
   if(!record.rows.length){await client.query('ROLLBACK');return res.status(400).json({error:'Reset token is invalid or expired'});}
   const userId=record.rows[0].user_id;
   const hashed=await bcrypt.hash(password,12);
   await client.query('UPDATE users SET password_hash=$1 WHERE id=$2',[hashed,userId]);
   await client.query('UPDATE password_resets SET used_at=now() WHERE token_hash=$1',[hashToken(token)]);
   await client.query('INSERT INTO audit_logs(actor_id,action,object_type,object_id) VALUES($1,$2,$3,$4)',[userId,'password_reset','user',userId]);
   await client.query('COMMIT');
   res.json({reset:true});
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }));
}
