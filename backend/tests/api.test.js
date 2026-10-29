import test from 'node:test';
import assert from 'node:assert/strict';
import {app} from '../server.js';
import {pool,query} from '../db.js';

test('customer checkout is inventory-backed and other customers cannot view orders',{skip:!process.env.TEST_INTEGRATION},async()=>{
 const server=app.listen(0),base='http://127.0.0.1:'+server.address().port;
 async function call(path,token,method='GET',body){
  const r=await fetch(base+'/api'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:r.status,data:await r.json()};
 }
 try{
  const suffix=Date.now();
  for(const n of ['owner','other']){
   const result=await call('/auth/register',null,'POST',{name:'Synthetic '+n,email:n+suffix+'@example.test',password:process.env.DEMO_ADMIN_PASSWORD});
   assert.equal(result.status,201);
  }
  async function login(email){
   const r=await call('/auth/login',null,'POST',{email,password:process.env.DEMO_ADMIN_PASSWORD});
   assert.equal(r.status,200);return r.data.token;
  }
  const owner=await login('owner'+suffix+'@example.test'),other=await login('other'+suffix+'@example.test');
  const products=await call('/products');
  assert.equal(products.status,200);
  assert.ok(products.data.products.length>0);
  const product=products.data.products[0];
  assert.equal((await call('/products',owner,'POST',{name:'Customer injection',category:'test',price_cents:0,stock:1})).status,403);
  const order=await call('/orders',owner,'POST',{items:[{product_id:product.id,quantity:1}]});
  assert.equal(order.status,201);
  assert.equal(order.data.order.total_cents,product.price_cents);
  assert.equal((await call('/orders/'+order.data.order.id,other)).status,403);
  assert.equal((await call('/orders/'+order.data.order.id,owner)).status,200);
  const updated=await query('SELECT stock FROM products WHERE id=$1',[product.id]);
  assert.equal(updated.rows[0].stock,product.stock-1);
 }finally{await new Promise(resolve=>server.close(resolve));await pool.end();}
});
