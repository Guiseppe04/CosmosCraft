const {pool}=require('../config/database');
const {AppError}=require('../middleware/errorHandler');
const {decodeImage}=require('./orderRefundWorkflow');
const fail=(message,code=400)=>{throw new AppError(message,code);};
const privileged=user=>['admin','super_admin','staff'].includes(user?.role);
const customerVisible=order=>Boolean(order.shipped_at) || ['shipped','out_for_delivery','delivered','received','completed'].includes(order.status);
function authorize(user){if(!privileged(user))fail('Only authorized admins and staff can access dispatch photos',403);}
const isPickup=order=>['pickup','shop_pickup','pickup_appointment','pickup_at_shop'].includes(order.shipping_method || order.fulfillment_method);
async function hasManagedAudit(db,table){return Boolean((await db.query(`SELECT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid=to_regclass($1) AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND p.proname='audit_record_change') AS managed`,[table])).rows[0]?.managed);}
async function items(db,orderId,customOnly=false){
  const result=await db.query(`SELECT order_item_id,quantity,COALESCE(product_name,'Ordered item') AS product_name,
    to_jsonb(order_items)->>'customization_id' AS customization_id FROM order_items WHERE order_id=$1
    ${customOnly?"AND to_jsonb(order_items)->>'customization_id' IS NOT NULL":''} ORDER BY order_item_id`,[orderId]);
  return result.rows;
}
async function transaction(orderId,actorId,operation){
  const db=await pool.connect();try{await db.query('BEGIN');
    const order=(await db.query('SELECT * FROM orders WHERE order_id=$1 FOR UPDATE',[orderId])).rows[0];
    if(!order)fail('Order not found',404);
    await db.query("SELECT set_config('cosmos.audit_actor_id',$1,true),set_config('cosmos.audit_source','shipment_api',true)",[String(actorId || '')]);
    const result=await operation(db,order);await db.query('COMMIT');return result;
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
async function save(db,orderId,dispatchKey,itemPhotos,actorId,{customOnly=false,supplemental=false,reason=null}={}){
  if(!actorId)fail('An authenticated uploader is required for dispatch photos',401);
  const required=await items(db,orderId,customOnly);
  if(!required.length)fail('No shippable order items were found. Review the order before dispatch.');
  if(!Array.isArray(itemPhotos) || !itemPhotos.length)fail('Upload pre-shipping photos for every item before dispatch.');
  if(new Set(itemPhotos.map(item=>Number(item.order_item_id))).size!==itemPhotos.length)fail('Duplicate dispatch photo items are not allowed');
  const lookup=new Map(required.map(item=>[Number(item.order_item_id),item]));
  let totalBytes=0;const prepared=[];
  for(const entry of itemPhotos){
    const item=lookup.get(Number(entry.order_item_id));
    if(!item)fail('Dispatch photos must belong to items in this shipment');
    if(!Array.isArray(entry.images) || entry.images.length<1 || entry.images.length>5)fail('Upload 1–5 pre-shipping photos per item');
    for(const image of entry.images){const file=decodeImage(image);totalBytes+=file.bytes.length;prepared.push({item,file});}
  }
  if(!supplemental && required.some(item=>!itemPhotos.some(entry=>Number(entry.order_item_id)===Number(item.order_item_id))))fail('Upload pre-shipping photos for every item before dispatch.');
  if(totalBytes>50*1024*1024)fail('Dispatch photos must total no more than 50 MB per upload');
  if(!supplemental && (await db.query("SELECT 1 FROM order_dispatch_photos WHERE order_id=$1 AND dispatch_key=$2 AND phase='pre_dispatch' LIMIT 1",[orderId,dispatchKey])).rows.length)fail('Dispatch evidence is already recorded for this shipment',409);
  for(const {item,file} of prepared)await db.query(`INSERT INTO order_dispatch_photos(order_id,order_item_id,dispatch_key,phase,item_name,quantity,mime_type,file_data,uploaded_by,addition_reason)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[orderId,item.order_item_id,dispatchKey,supplemental?'supplemental':'pre_dispatch',item.product_name,item.quantity,file.mime,file.bytes,actorId,reason]);
}
async function list(orderId,user,customOnly=false){
  const order=(await pool.query("SELECT o.user_id,o.status,to_jsonb(o)->>'shipped_at' AS shipped_at FROM orders o WHERE order_id=$1",[orderId])).rows[0];
  if(!order || (!privileged(user) && order.user_id!==(user?.user_id || user?.id)))fail('Order not found',404);
  if(!privileged(user)){
    if(!customerVisible(order))fail('Pre-shipping photos are available after your order is shipped',403);
    const photos=(await pool.query(`SELECT photo_id,order_item_id,phase,item_name,quantity,created_at FROM order_dispatch_photos
      WHERE order_id=$1 AND phase='pre_dispatch' ORDER BY created_at,photo_id`,[orderId])).rows;
    return {items:(await items(pool,orderId,customOnly)).map(({order_item_id,quantity,product_name})=>({order_item_id,quantity,product_name})),photos};
  }
  const photos=await pool.query(`SELECT p.photo_id,p.order_item_id,p.dispatch_key,p.phase,p.item_name,p.quantity,p.created_at,p.uploaded_by,p.addition_reason,
    COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'') AS uploader_name FROM order_dispatch_photos p
    LEFT JOIN users u ON u.user_id=p.uploaded_by WHERE p.order_id=$1 ORDER BY p.created_at,p.photo_id`,[orderId]);
  return {items:await items(pool,orderId,customOnly),photos:photos.rows};
}
async function get(photoId,user){
  const photo=(await pool.query(`SELECT p.mime_type,p.file_data FROM order_dispatch_photos p JOIN orders o ON o.order_id=p.order_id
    WHERE p.photo_id=$1 AND ($2::boolean OR (o.user_id=$3 AND p.phase='pre_dispatch'
      AND (o.status IN ('shipped','out_for_delivery','delivered','received','completed') OR to_jsonb(o)->>'shipped_at' IS NOT NULL)))`,
    [photoId,privileged(user),user?.user_id || user?.id || null])).rows[0];
  if(!photo)fail('Dispatch photo not found',404);return photo;
}
async function append(orderId,user,data){authorize(user);const reason=String(data.reason || '').trim();
  if(require('../utils/refundValidation').refundTextError(reason,'Addition reason'))fail('Explain the photo addition using at least 10 meaningful characters');
  return transaction(orderId,user.user_id || user.id,async(db)=>{
    if(!(await db.query("SELECT 1 FROM order_dispatch_photos WHERE order_id=$1 AND phase='pre_dispatch' LIMIT 1",[orderId])).rows.length)fail('Original dispatch photos must already be recorded before adding supplemental evidence',409);
    await save(db,orderId,'supplemental',data.itemPhotos,user.user_id || user.id,{supplemental:true,reason});return {saved:true};
  });
}
module.exports={save,transaction,list,get,append,isPickup,hasManagedAudit};
