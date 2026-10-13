const {pool} = require('../config/database');
const {AppError} = require('../middleware/errorHandler');
const {randomUUID} = require('crypto');
const schemas = require('../utils/refundReviewValidation');
const audit = require('./refundAudit');
const workflow = require('./orderRefundWorkflow');
const actor = user => user?.user_id || user?.id;
const fail = (message,code=400) => {throw new AppError(message,code);};
function validate(schema,data) {const {error,value}=schema.validate(data);if(error)fail(error.details[0].message);return value;}
function requireAdmin(user) {if(!workflow.isAdmin(user))fail('Only authorized admins can manage refund reviews',403);}
const today = () => {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part = name => parts.find(item=>item.type===name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const overdue = (refund,shipping) => Boolean(shipping?.deadline && shipping.deadline<today()
  && !refund.item_received_at && !refund.return_received_at && !['returned','return_in_transit','return_confirmed','not_required'].includes(refund.return_status)
  && !['returned','return_in_transit','return_confirmed'].includes(refund.status)
  && !['completed','refunded','rejected','withdrawn'].includes(refund.status));
function customerReview(refund) {
  const review=refund.review_data || {};
  return {shipping:review.shipping || null,overdue:overdue(refund,review.shipping),policy:review.policy?{settings:review.policy.settings,submittedAt:review.policy.submittedAt,items:review.policy.items}:null,
    timeline:require('./refundPolicyService').timeline(refund),
    repairOffers:(review.repairOffers || []).map(({id,type,description,offeredAt,response,respondedAt})=>({id,type,description,offeredAt,response,respondedAt}))};
}
async function getContext(refund) {
  const order = (await pool.query('SELECT to_jsonb(o) AS data FROM orders o WHERE order_id=$1',[refund.order_id])).rows[0]?.data || {};
  const project = refund.project_id ? (await pool.query('SELECT to_jsonb(p) AS data FROM projects p WHERE project_id=$1',[refund.project_id])).rows[0]?.data || {} : {};
  const custom = await require('./refundPolicyService').selectedCustom(pool,refund);
  const paid = (await pool.query("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE order_id=$1 AND status IN ('verified','refunded') AND to_jsonb(payments)->>'deleted_at' IS NULL",[refund.order_id])).rows[0]?.total;
  const receipt=refund.review_data?.receipt;
  return {containsCustomItems:custom || Boolean(refund.project_id),confirmedPolicy:require('./refundPolicyService').settings,
    calculation:await require('./refundPolicyService').calculation(pool,refund),timeline:require('./refundPolicyService').timeline(refund),receivedAt:order.received_at || null,deliveredAt:order.delivered_at || null,
    projectDeliveredAt:project.delivered_at || null,projectPickedUpAt:project.picked_up_at || null,
    receiptNeedsReview:receipt?.status==='disputed' || (receipt?.status!=='verified' && !order.received_at && !order.delivered_at && !project.delivered_at && !project.picked_up_at),
    receiptDisputed:receipt?.status==='disputed',verifiedPaymentTotal:Number(paid || 0),discountAmount:order.discount_amount ?? null,
    orderTotal:order.total_amount ?? null,outboundShippingCost:order.shipping_cost ?? null,
    overdue:overdue(refund,refund.review_data?.shipping)};
}
async function mutate(id,user,operation,{customer=false}={}) {
  if(!customer)requireAdmin(user);
  const db=await pool.connect();
  try {
    await db.query('BEGIN');
    const auditContext=await audit.prepare(db,actor(user));
    const order=(await db.query('SELECT order_id FROM refund_requests WHERE refund_request_id=$1 AND deleted_at IS NULL',[id])).rows[0];
    if(!order)fail('Refund request not found',404);
    await db.query('SELECT order_id FROM orders WHERE order_id=$1 FOR UPDATE',[order.order_id]);
    const refund=(await db.query('SELECT * FROM refund_requests WHERE refund_request_id=$1 AND deleted_at IS NULL FOR UPDATE',[id])).rows[0];
    if(customer && refund.user_id!==actor(user))fail('Refund request not found',404);
    const result=operation(refund);
    if(!result){await db.query('COMMIT');return workflow.publicRefund(refund);}
    const timeline=require('./refundPolicyService').timeline({...refund,review_data:result.review});
    if(timeline.startedAt)result.review.processingStartedAt=timeline.startedAt;
    const updated=(await db.query('UPDATE refund_requests SET review_data=$2::jsonb,updated_at=now() WHERE refund_request_id=$1 RETURNING *',[id,JSON.stringify(result.review)])).rows[0];
    await audit.record(auditContext,{userId:actor(user),action:result.action,entityId:refund.order_id,status:refund.status,previousStatus:refund.status,
      details:{refund_request_id:id,review_version:result.review.version},executor:db});
    const notifications=require('./refundNotifications');
    const records=await notifications.record(db,updated,result.notification,customer);
    await db.query('COMMIT');notifications.publish(records);
    return workflow.publicRefund(updated);
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
function checkVersion(refund,version) {if((refund.review_data?.version || 0)!==version)fail('Review details changed. Refresh this request before saving.',409);}
function editable(refund) {if(['completed','refunded','rejected','withdrawn'].includes(refund.status))fail('This refund is closed. Its review records cannot be changed.',409);}
async function update(id,user,data) {
  const value=validate(schemas.reviewSchema,data);
  if(value.receipt.status==='verified' && (!value.receipt.confirmedDate || !value.receipt.evidence.trim()))fail('A confirmed receipt date and verification evidence are required');
  if(value.receipt.status==='disputed' && !value.receipt.evidence.trim())fail('Explain the receipt-date dispute');
  if(value.receipt.confirmedDate && value.receipt.confirmedDate>today())fail('The confirmed receipt date cannot be in the future');
  if(value.financial.verified && (value.financial.materialValue==null || value.financial.incurredLabor==null || !value.financial.evidence.trim()))fail('Record known material value, incurred labor, and supporting evidence before marking financial inputs verified');
  if(value.shipping.reimbursement==='recorded' && (value.shipping.reimbursementAmount==null || !value.shipping.reimbursementReference.trim()))fail('Record the reimbursement amount and its receipt or payment reference');
  return mutate(id,user,refund=>{editable(refund);checkVersion(refund,value.version);
    const old=refund.review_data || {};
    return {review:{...old,...value,version:value.version+1,evidenceCompletedAt:value.evidenceComplete?(old.evidenceCompletedAt || new Date().toISOString()):null,
      updatedBy:actor(user),updatedAt:new Date().toISOString()},action:'refund_review_updated',notification:'review_updated'};});
}
async function offer(id,user,data) {
  const value=validate(schemas.offerSchema,data);
  if(require('../utils/refundValidation').refundTextError(value.description,'Repair/rework offer'))fail('Describe the repair/rework offer using at least 10 meaningful characters');
  return mutate(id,user,refund=>{editable(refund);checkVersion(refund,value.version);
    if(['processing','refund_sent'].includes(refund.status))fail('A repair/rework offer cannot be issued after payment processing has started',409);
    const old=refund.review_data || {},offers=old.repairOffers || [];
    if(offers.at(-1)?.response==='pending')fail('Wait for the customer response to the current offer before issuing another',409);
    return {review:{...old,version:value.version+1,repairOffers:[...offers,{id:randomUUID(),type:value.type,description:value.description,
      offeredBy:actor(user),offeredAt:new Date().toISOString(),response:'pending',respondedAt:null}]},action:'refund_repair_offered',notification:'repair_offered'};});
}
async function respond(id,user,data) {
  const value=validate(schemas.responseSchema,data);
  return mutate(id,user,refund=>{editable(refund);
    const old=refund.review_data || {},offers=old.repairOffers || [],current=offers.at(-1);
    if(!current || current.id!==value.offerId)fail('This offer is no longer available. Refresh your refund details.',409);
    if(current.response===value.response)return null;
    if(current.response!=='pending')fail('A response has already been recorded for this offer',409);
    if(['processing','refund_sent'].includes(refund.status))fail('Payment processing has already started. Contact the store about this offer.',409);
    return {review:{...old,version:(old.version || 0)+1,repairOffers:[...offers.slice(0,-1),{...current,response:value.response,respondedAt:new Date().toISOString()}]},
      action:`refund_repair_${value.response}`,notification:`repair_${value.response}`};
  },{customer:true});
}
async function getPolicy(user) {requireAdmin(user);const row=(await pool.query('SELECT draft,updated_at FROM refund_policy_settings WHERE id=1')).rows[0];return {draft:row?.draft || {},updatedAt:row?.updated_at,active:false};}
async function savePolicy(user,data) {
  requireAdmin(user);const value=validate(schemas.policySchema,data);
  for(const prefix of ['regular','custom'])if(value[prefix+'ProcessingDaysMin']!=null && value[prefix+'ProcessingDaysMax']!=null && value[prefix+'ProcessingDaysMin']>value[prefix+'ProcessingDaysMax'])fail('The minimum processing estimate cannot exceed the maximum');
  const result=await pool.query(`UPDATE refund_policy_settings SET draft=$1::jsonb,updated_by=$2,updated_at=now() WHERE id=1
    AND COALESCE((draft->>'version')::int,0)=$3 RETURNING draft,updated_at`,[JSON.stringify({...value,version:value.version+1}),actor(user),value.version]);
  if(!result.rows.length)fail('Draft settings changed. Reload them before saving.',409);
  return {draft:result.rows[0].draft,updatedAt:result.rows[0].updated_at,active:false};
}
module.exports={getContext,customerReview,update,offer,respond,getPolicy,savePolicy};
