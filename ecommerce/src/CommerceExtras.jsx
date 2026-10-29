import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {useDispatch} from 'react-redux';
import {addItemToCart} from './redux/slices/cartSlice';

const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
async function api(path,token,options={}){
 const response=await fetch('/api'+path,{...options,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(options.body?{'Content-Type':'application/json'}:{})}});
 if(!response.ok){const body=await response.json().catch(()=>({}));throw Error(body.error||'Operation failed');}
 return response.json();
}
const emptyProduct={name:'',description:'',category:'Workspace',price:'',stock:10};
export default function CommerceExtras({path,token,user,products,onRefresh,onUser,onError,onNotice}){
 const dispatch=useDispatch();
 const [accountName,setAccountName]=useState(user?.name||''),[busy,setBusy]=useState(false);
 const [productForm,setProductForm]=useState(emptyProduct),[orders,setOrders]=useState([]),[audit,setAudit]=useState([]);
 const [resetEmail,setResetEmail]=useState(''),[resetToken,setResetToken]=useState(''),[newPassword,setNewPassword]=useState(''),[demoToken,setDemoToken]=useState('');
 useEffect(()=>setAccountName(user?.name||''),[user?.name]);
 useEffect(()=>{
  if(path==='/admin'&&user?.role==='admin'){
   Promise.all([api('/admin/orders',token),api('/admin/audit',token)]).then(([o,a])=>{setOrders(o.orders);setAudit(a.audit);}).catch(e=>onError(e.message));
  }
 },[path,user?.role,token]);
 async function execute(fn,message){
  setBusy(true);onError('');onNotice('');
  try{await fn();onNotice(message);if(onRefresh)await onRefresh();}
  catch(e){onError(e.message);}finally{setBusy(false);}
 }
 if(path.startsWith('/product/')){
  const id=path.split('/')[2],product=products.find(p=>p.id===id);
  return <div className="extra-section"><div className="page-head"><p className="eyebrow">PRODUCT DETAILS</p><h1>{product?.name||'Product'}</h1></div>{product?<section className="paper product-detail"><div className="product-symbol">◈</div><div><p className="eyebrow">{product.category}</p><h2>{product.name}</h2><p>{product.description}</p><strong>{money(product.price_cents)}</strong><p>{product.stock} units available</p><button className="primary" disabled={!product.stock} onClick={()=>{dispatch(addItemToCart(product));onNotice('Added to bag');}}>Add to bag +</button><p><Link to="/">Return to catalog</Link></p></div></section>:<div className="paper">Product unavailable. <Link to="/">Return to catalog</Link></div>}</div>;
 }
 if(path==='/reset-password')return <div className="auth-layout"><div><p className="eyebrow">ACCOUNT RECOVERY</p><h1>Password recovery demo</h1><p>One-time expiring tokens. No real email is delivered and reset tokens are disclosed only in an explicitly enabled local demo environment.</p></div><div className="paper auth-form"><form onSubmit={e=>{e.preventDefault();execute(async()=>{const response=await api('/auth/forgot-password',null,{method:'POST',body:JSON.stringify({email:resetEmail})});setDemoToken(response.demo_token||'');if(response.demo_token)setResetToken(response.demo_token);},'Password reset request processed');}}><label>Email address<input type="email" required value={resetEmail} onChange={e=>setResetEmail(e.target.value)}/></label><button className="primary" disabled={busy}>Request reset token</button></form>{demoToken&&<p className="demo-token">LOCAL DEMO TOKEN: {demoToken}</p>}<form onSubmit={e=>{e.preventDefault();execute(async()=>{await api('/auth/reset-password',null,{method:'POST',body:JSON.stringify({token:resetToken,password:newPassword})});setResetToken('');setNewPassword('');setDemoToken('');},'Password changed');}}><label>One-time token<input required value={resetToken} onChange={e=>setResetToken(e.target.value)}/></label><label>New password<input type="password" required minLength="12" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label><button className="secondary" disabled={busy}>Reset password</button></form><Link to="/login">Back to sign in</Link></div></div>;
 if(path==='/account'&&user)return <section className="paper extra-section"><h2>Profile settings</h2><p>Email: {user.email}</p><form className="extra-inline" onSubmit={e=>{e.preventDefault();execute(async()=>{const r=await api('/profile',token,{method:'PATCH',body:JSON.stringify({name:accountName})});onUser({...user,name:r.user.name});},'Profile updated');}}><label>Display name<input minLength="2" required maxLength="100" value={accountName} onChange={e=>setAccountName(e.target.value)}/></label><button className="secondary" disabled={busy}>Save profile</button></form></section>;
 if(path==='/admin'&&user?.role==='admin')return <div className="extra-section">
   <section className="paper"><h2>Create product</h2><form className="extra-product-form" onSubmit={e=>{e.preventDefault();execute(async()=>{await api('/products',token,{method:'POST',body:JSON.stringify({name:productForm.name,description:productForm.description,category:productForm.category,price_cents:Math.round(Number(productForm.price)*100),stock:Number(productForm.stock)})});setProductForm(emptyProduct);},'Product created');}}><label>Name<input required minLength="3" value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})}/></label><label>Description<input required value={productForm.description} onChange={e=>setProductForm({...productForm,description:e.target.value})}/></label><label>Category<input required value={productForm.category} onChange={e=>setProductForm({...productForm,category:e.target.value})}/></label><label>Price (USD)<input type="number" step=".01" min="0" required value={productForm.price} onChange={e=>setProductForm({...productForm,price:e.target.value})}/></label><label>Stock<input type="number" min="0" required value={productForm.stock} onChange={e=>setProductForm({...productForm,stock:e.target.value})}/></label><button className="primary" disabled={busy}>Add product</button></form></section>
   <section className="paper"><h2>Order fulfillment simulation</h2><p>Statuses are operational simulations. No actual shipping or payment processing.</p>{orders.map(o=><div className="order-row" key={o.id}><div><strong>Order #{o.id.slice(0,8)}</strong><small>{o.customer_name} · {money(o.total_cents)}</small></div><select aria-label={'Status for order '+o.id} value={o.status} onChange={e=>execute(async()=>{await api('/admin/orders/'+o.id+'/status',token,{method:'PATCH',body:JSON.stringify({status:e.target.value})});const data=await api('/admin/orders',token);setOrders(data.orders);},'Order status updated')} disabled={busy}><option value="simulated_paid">Simulated paid</option><option value="processing">Processing</option><option value="fulfilled">Fulfilled</option><option value="cancelled">Cancelled</option></select></div>)}{!orders.length&&<p>No orders placed yet.</p>}</section>
   <section className="paper"><h2>Administrative audit history</h2><div className="audit-grid">{audit.slice(0,20).map(a=><div key={a.id}><strong>{a.action.replaceAll('_',' ')}</strong><small>{a.object_type} · {new Date(a.created_at).toLocaleString()}</small></div>)}{!audit.length&&<p>No administrative changes yet.</p>}</div></section>
  </div>;
 return null;
}
