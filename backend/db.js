import 'dotenv/config';
import pg from 'pg';
export const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
export const query=(sql,args=[])=>pool.query(sql,args);
