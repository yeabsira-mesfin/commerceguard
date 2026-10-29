import test from 'node:test';
import assert from 'node:assert/strict';
import {isAdmin,canReadOrder,validCart,cleanProduct} from '../policy.js';
test('customer cannot access another customer order',()=>{
  assert.equal(canReadOrder({id:'a',role:'customer'},{user_id:'b'}),false);
  assert.equal(canReadOrder({id:'a',role:'customer'},{user_id:'a'}),true);
  assert.equal(canReadOrder({id:'admin',role:'admin'},{user_id:'b'}),true);
  assert.equal(isAdmin({role:'customer'}),false);
});
test('checkout payload validates quantity and unique product IDs',()=>{
  const p='00000000-0000-0000-0000-000000000001';
  assert.equal(validCart([{product_id:p,quantity:1}]),true);
  assert.equal(validCart([{product_id:p,quantity:-1}]),false);
  assert.equal(validCart([{product_id:p,quantity:1},{product_id:p,quantity:1}]),false);
});
test('product validation rejects negative price and stock',()=>{
  const p={name:'Example lamp',category:'Office',price_cents:1200,stock:5};
  assert.equal(cleanProduct(p),true);
  assert.equal(cleanProduct({...p,price_cents:-1}),false);
  assert.equal(cleanProduct({...p,stock:-1}),false);
});
