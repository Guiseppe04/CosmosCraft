require('dotenv').config({path:require('path').resolve(__dirname,'../.env'),quiet:true});
const {pool}=require('../config/database');
const fs=require('fs');
const path=require('path');
(async()=>{const db=await pool.connect();try {
  await db.query('BEGIN');
  await db.query(fs.readFileSync(path.join(__dirname,'53_refund_inspection_stock.sql'),'utf8'));
  await db.query('COMMIT');
  console.log('Migration 53 applied: inspection return stock ledger.');
} catch(error) {await db.query('ROLLBACK');console.error(error.message);process.exitCode=1;}
finally {db.release();await pool.end();}})().catch(error=>{console.error(error.message);process.exitCode=1;});
