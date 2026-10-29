import bcrypt from 'bcryptjs';
import {pool} from '../db.js';
if(!process.env.DEMO_ADMIN_PASSWORD||process.env.DEMO_ADMIN_PASSWORD.length<12)throw Error('Set DEMO_ADMIN_PASSWORD to 12+ characters');
const client=await pool.connect();
try{
  await client.query('BEGIN');
  const hash=await bcrypt.hash(process.env.DEMO_ADMIN_PASSWORD,12);
  await client.query("INSERT INTO users(name,email,password_hash,role) VALUES('Store Admin','admin@commerceguard.test',$1,'admin') ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash",[hash]);
  for(const p of [
    ['Minimal Workspace Lamp','Warm dimmable light for focused work','Workspace',5900,28],
    ['Ergonomic Desk Stand','Aluminum laptop elevation platform','Workspace',7400,15],
    ['Travel Organizer','Multi-compartment technical pouch','Travel',3500,37],
    ['Ceramic Coffee Set','Matte espresso cups, 4 pieces','Lifestyle',4500,21],
    ['Noise Isolation Headphones','Comfort fit with wired audio','Technology',9900,13],
    ['Wireless Keyboard','Compact mechanical layout','Technology',12500,9]
  ]) await client.query('INSERT INTO products(name,description,category,price_cents,stock) VALUES($1,$2,$3,$4,$5) ON CONFLICT(name) DO UPDATE SET stock=EXCLUDED.stock,price_cents=EXCLUDED.price_cents',p);
  await client.query('COMMIT');
  console.log('Seeded synthetic store inventory and admin@commerceguard.test');
}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();await pool.end();}
