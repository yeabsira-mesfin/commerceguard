import test from 'node:test';
import assert from 'node:assert/strict';
import {app} from '../server.js';

test('product administration, profile, order status and local recovery',{skip:!process.env.TEST_INTEGRATION},async()=>{
 const server=app.listen(0),base='http://127.0.0.1:'+server.address().port+'/api';
 async function call(path,token,method='GET',body){
  const res=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  return {status:res.status,data:await res.json()};
 }
 try{
  async function login(email,password){
   const result=await call('/auth/login',null,'POST',{email,password});
   assert.equal(result.status,200);
   return result.data.token;
  }
  const admin=await login('admin@commerceguard.test',process.env.DEMO_ADMIN_PASSWORD);
  const email='commerce-advanced-'+Date.now()+'@example.test';
  const customer=await call('/auth/register',null,'POST',{name:'Synthetic Buyer',email,password:process.env.DEMO_ADMIN_PASSWORD});
  assert.equal(customer.status,201);
  const token=await login(email,process.env.DEMO_ADMIN_PASSWORD);
  assert.equal((await call('/admin/orders',token)).status,403);
  const create=await call('/products',admin,'POST',{name:'Security Key Organizer '+Date.now(),description:'Synthetic test object',category:'Workspace',price_cents:3500,stock:4});
  assert.equal(create.status,201);
  const productId=create.data.product.id;
  assert.equal((await call('/products/'+productId)).status,200);
  assert.equal((await call('/products/'+productId+'/details',token,'PATCH',{name:'Unauthorized edit',description:'None',category:'Workspace',price_cents:1,stock:3})).status,403);
  const edited=await call('/products/'+productId+'/details',admin,'PATCH',{name:create.data.product.name,description:'Updated test object',category:'Workspace',price_cents:3900,stock:4});
  assert.equal(edited.status,200);
  const order=await call('/orders',token,'POST',{items:[{product_id:productId,quantity:2}]});
  assert.equal(order.status,201);
  assert.equal(order.data.order.total_cents,7800);
  const orderId=order.data.order.id;
  assert.equal((await call('/admin/orders',admin)).status,200);
  assert.equal((await call('/admin/orders/'+orderId+'/status',token,'PATCH',{status:'fulfilled'})).status,403);
  const status=await call('/admin/orders/'+orderId+'/status',admin,'PATCH',{status:'processing'});
  assert.equal(status.status,200);
  assert.equal((await call('/orders/'+orderId,token)).data.order.status,'processing');
  const profile=await call('/profile',token,'PATCH',{name:'Updated Synthetic Buyer'});
  assert.equal(profile.status,200);
  assert.equal(profile.data.user.name,'Updated Synthetic Buyer');
  assert.equal((await call('/admin/audit',admin)).status,200);
  if(process.env.DEMO_RESET_TOKENS==='true'){
   const recover=await call('/auth/forgot-password',null,'POST',{email});
   assert.equal(recover.status,200);
   const resetToken=recover.data.demo_token;
   assert.match(resetToken,/^[a-f0-9]{64}$/);
   const reset=await call('/auth/reset-password',null,'POST',{token:resetToken,password:'new-synthetic-demo-password-2026'});
   assert.equal(reset.status,200);
   assert.equal((await call('/auth/reset-password',null,'POST',{token:resetToken,password:'other-synthetic-demo-password'})).status,400);
   assert.equal((await call('/auth/login',null,'POST',{email,password:process.env.DEMO_ADMIN_PASSWORD})).status,401);
   assert.equal((await call('/auth/login',null,'POST',{email,password:'new-synthetic-demo-password-2026'})).status,200);
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
});
