export const isAdmin=user=>user?.role==='admin';
export const canReadOrder=(user,order)=>isAdmin(user)||String(user?.id)===String(order?.user_id);
export function validCart(items){
  return Array.isArray(items)&&items.length>0&&items.length<=50&&items.every(x=>typeof x.product_id==='string'&&/^[0-9a-f-]{36}$/i.test(x.product_id)&&Number.isInteger(x.quantity)&&x.quantity>=1&&x.quantity<=99)&&new Set(items.map(x=>x.product_id)).size===items.length;
}
export const cleanProduct=input=>typeof input?.name==='string'&&input.name.trim().length>=3&&input.name.length<=120&&typeof input.category==='string'&&input.category.length<=80&&Number.isInteger(input.price_cents)&&input.price_cents>=0&&Number.isInteger(input.stock)&&input.stock>=0;
