const {AppError} = require('../middleware/errorHandler');
// Fixed client-approved policies. There is no editable policy settings API.
const settings = Object.freeze({version:2,regularRefundDays:14,customWarrantyMonths:3,regularRefundPercent:50,
  regularProcessingDaysMin:1,regularProcessingDaysMax:3,customProcessingDaysMin:7,customProcessingDaysMax:14});
const day = 86400000;
const money = value => Math.floor((value + Number.EPSILON) * 100) / 100;

// Work in Philippine local time; clamp calendar-month anniversaries at month end.
function deadline(receivedAt, custom, policy=settings) {
  const date = new Date(new Date(receivedAt).getTime() + 8 * 3600000);
  if (!Number.isFinite(date.getTime())) return null;
  if (custom) {
    const dateOfMonth = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + policy.customWarrantyMonths);
    const last = new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
    date.setUTCDate(Math.min(dateOfMonth,last));
  } else date.setUTCDate(date.getUTCDate() + policy.regularRefundDays);
  return new Date(date.getTime() - 8 * 3600000).toISOString();
}
function eligibility(receivedAt, custom, submittedAt=new Date(), policy=settings) {
  const expiresAt = receivedAt && deadline(receivedAt,custom,policy);
  return {custom,receivedAt:receivedAt || null,expiresAt:expiresAt || null,
    outcome:!expiresAt || new Date(receivedAt)>new Date(submittedAt) ? 'manual_review' : new Date(submittedAt)>new Date(expiresAt) ? 'expired' : 'eligible'};
}
async function itemReceipt(db,orderId,item) {
  const row=(await db.query('SELECT to_jsonb(o) AS data FROM orders o WHERE order_id=$1',[orderId])).rows[0]?.data || {};
  if(row.received_at || row.delivered_at) return row.received_at || row.delivered_at;
  if(item.customization_id) {
    const project=(await db.query('SELECT to_jsonb(p) AS data FROM projects p WHERE order_id=$1 AND deleted_at IS NULL LIMIT 1',[orderId])).rows[0]?.data || {};
    return project.picked_up_at || project.delivered_at || null;
  }
  return null;
}
async function snapshotItem(db,orderId,item,submittedAt,disputed=false) {
  const result=eligibility(await itemReceipt(db,orderId,item),Boolean(item.customization_id),submittedAt);
  if(disputed) result.outcome='manual_review';
  if(result.outcome==='expired') throw new AppError(result.custom ? 'Customized guitar warranty requests must be submitted within three calendar months of receipt' : 'Regular product refund requests must be submitted within 14 days of receipt',400);
  return {...result,orderItemId:item.order_item_id};
}
async function selectedCustom(db,refund) {
  if(refund.review_data?.policy) return refund.review_data.policy.items.some(item=>item.custom);
  return Boolean(refund.project_id) || (await db.query(`SELECT 1 FROM refund_request_items r JOIN order_items i USING(order_item_id)
    WHERE r.refund_request_id=$1 AND r.deleted_at IS NULL AND to_jsonb(i)->>'customization_id' IS NOT NULL LIMIT 1`,[refund.refund_request_id])).rows.length>0;
}
function verifyReceipt(refund) {
  const policy=refund.review_data?.policy;
  if(!policy) return; // Existing requests retain their original eligibility decision.
  const receipt=refund.review_data.receipt;
  if(receipt?.status==='disputed' || (policy.items.some(item=>item.outcome==='manual_review') && receipt?.status!=='verified'))
    throw new AppError('Verify the actual receipt date and evidence in review details before approving this refund',409);
  if(receipt?.status==='verified') {
    // A date-only verification includes the entire anniversary day in Manila.
    const receivedAt=receipt.confirmedDate+'T23:59:59.999+08:00';
    if(policy.items.some(item=>eligibility(receivedAt,item.custom,policy.submittedAt,policy.settings).outcome==='expired'))
      throw new AppError('The verified receipt date places this request outside the submission window',409);
  }
}
async function calculation(db,refund) {
  const custom=await selectedCustom(db,refund);
  const totals=(await db.query(`SELECT
    (SELECT COALESCE(SUM(amount),0) FROM payments WHERE order_id=$1 AND status IN ('verified','refunded') AND to_jsonb(payments)->>'deleted_at' IS NULL) AS paid,
    (SELECT COALESCE(SUM(COALESCE(refunded_amount,approved_amount,amount_requested)),0) FROM refund_requests
      WHERE order_id=$1 AND refund_request_id<>$2 AND deleted_at IS NULL AND status NOT IN ('rejected','withdrawn')) AS reserved`,[refund.order_id,refund.refund_request_id])).rows[0];
  const remaining=Math.max(0,Number(totals.paid)-Number(totals.reserved));
  if(custom) {
    const financial=refund.review_data?.financial;
    const verified=financial?.verified && financial.materialValue!=null && financial.incurredLabor!=null && financial.evidence?.trim();
    const maximum=verified ? money(Math.min(Number(refund.amount_requested),Number(financial.materialValue),Math.max(0,remaining-Number(financial.incurredLabor)))) : null;
    return {custom,remainingPayment:remaining,requiresVerifiedCosts:!verified,maximum,suggestedAmount:maximum};
  }
  // Default only: an existing approved amount is never rewritten by this calculation.
  const suggested=money(Math.min(remaining,Number(refund.amount_requested))*settings.regularRefundPercent/100);
  return {custom,remainingPayment:remaining,requiresVerifiedCosts:false,maximum:Math.min(remaining,Number(refund.amount_requested)),suggestedAmount:suggested};
}
function timeline(refund) {
  const review=refund.review_data || {},policy=review.policy?.settings || settings;
  const custom=review.policy?.items?.some(item=>item.custom) || Boolean(refund.project_id);
  const returnAt=refund.return_status==='not_required' ? review.noReturnDecisionAt : refund.item_received_at && refund.inspected_at;
  const startedAt=review.processingStartedAt || (review.evidenceComplete && review.evidenceCompletedAt && returnAt ? new Date(Math.max(new Date(review.evidenceCompletedAt).getTime(),new Date(returnAt).getTime())).toISOString() : null);
  const minDays=custom?policy.customProcessingDaysMin:policy.regularProcessingDaysMin,maxDays=custom?policy.customProcessingDaysMax:policy.regularProcessingDaysMax;
  return {startedAt,minDays,maxDays,estimatedEarliestAt:startedAt?new Date(new Date(startedAt).getTime()+minDays*day).toISOString():null,
    estimatedLatestAt:startedAt?new Date(new Date(startedAt).getTime()+maxDays*day).toISOString():null,completedAt:refund.payment_confirmed_at || null};
}
module.exports={settings,deadline,eligibility,snapshotItem,selectedCustom,verifyReceipt,calculation,timeline};
