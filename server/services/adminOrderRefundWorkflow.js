const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const workflow = require('./orderRefundWorkflow');
const notifications = require('./refundNotifications');
const { refundTextError } = require('../utils/refundValidation');
const transitions = {
  pending:['under_review','return_required','approved','rejected'],
  under_review:['return_required','approved','rejected'],
  return_required:['item_received','rejected'],return_in_transit:['item_received','rejected'],
  // Compatibility with customer-phase requests approved before this migration.
  return_pending:['item_received','rejected'],returned:['item_received','rejected'],
  item_received:['under_inspection','rejected'],under_inspection:['approved','rejected'],
  approved:['processing','item_received','rejected'],processing:['refund_sent','rejected'],refund_sent:['completed'],
  rejected:[],completed:[],withdrawn:[],
};
const actorId = user => user?.user_id || user?.id;
const fail = (message,code=400) => { throw new AppError(message,code); };
const text = (value,label,max=1000) => {
  if (value != null && typeof value !== 'string') fail(`${label} must be text`);
  const result = (value || '').trim();
  if (result.length > max) fail(`${label} must not exceed ${max} characters`);
  return result;
};
const returnVerified = refund => refund.return_status === 'return_confirmed' && refund.inspected_at && refund.inspection_notes?.trim()
  || refund.return_status === 'not_required' && refund.no_return_reason?.trim();

async function ensureReady() {
  const result = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema()
    AND table_name='refund_requests' AND column_name='claim_verified'`);
  if (!result.rows.length) fail('The admin refund workflow requires migration 49. Run node server/migrations/run-migration49.js.',503);
}

async function checkBudget(db,refund,amount) {
  const totals = await db.query(`SELECT
    (SELECT COALESCE(SUM(amount),0) FROM payments WHERE order_id=$1 AND status IN ('verified','refunded')) AS paid,
    (SELECT COALESCE(SUM(COALESCE(refunded_amount,approved_amount,amount_requested)),0) FROM refund_requests
      WHERE order_id=$1 AND refund_request_id<>$2 AND deleted_at IS NULL AND status NOT IN ('rejected','withdrawn')) AS reserved`,
    [refund.order_id,refund.refund_request_id]);
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount*100-Math.round(amount*100)) > 0.000001
    || amount > Number(refund.amount_requested) || amount + Number(totals.rows[0].reserved) > Number(totals.rows[0].paid)) {
    fail('Refund amount cannot exceed the requested amount or remaining verified payment');
  }
}

async function update(id,status,user,data={}) {
  await ensureReady();
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const auditContext = await require('./refundAudit').prepare(db,actorId(user));
    // All order refund mutations acquire the order lock before the refund lock.
    const order = await db.query('SELECT order_id FROM refund_requests WHERE refund_request_id=$1 AND deleted_at IS NULL',[id]);
    if (!order.rows[0]) fail('Refund request not found',404);
    await db.query('SELECT order_id FROM orders WHERE order_id=$1 FOR UPDATE',[order.rows[0].order_id]);
    const result = await db.query('SELECT * FROM refund_requests WHERE refund_request_id=$1 AND deleted_at IS NULL FOR UPDATE',[id]);
    const refund = result.rows[0];
    const policy = require('./refundPolicyService');
    if (!refund?.original_payment_method || refund.workflow_version !== 2) fail('Use the existing refund workflow for this request',409);
    const admin = workflow.isAdmin(user);
    if (!admin) fail('Only authorized admins can manage refunds',403);
    if (status === 'under_review' && data.action === 'start_review' && refund.status !== 'pending') {
      await db.query('COMMIT');
      return refund;
    }
    const noReturn = data.action === 'mark_no_return';
    if (noReturn && (status !== 'under_review' || !['pending','under_review'].includes(refund.status))) fail('A no-return exception can only be recorded during review',409);
    if (noReturn && refund.return_status === 'not_required' && refund.no_return_reason?.trim()) { await db.query('COMMIT'); return refund; }
    if (!noReturn && !transitions[refund.status]?.includes(status)) fail(`Invalid refund status transition from '${refund.status}' to '${status}'`,409);
    const notes = text(data.adminNotes,'Admin notes');
    const instructions = text(data.returnInstructions,'Return instructions',2000);
    const exception = text(data.noReturnReason,'No-return reason');
    const inspection = text(data.inspectionNotes,'Inspection notes');
    const reference = text(data.refundReference,'Refund transaction reference',255);
    const internal = text(data.internalNotes,'Internal notes');
    const fields = ['status=$2','updated_at=now()'];
    const values = [id,status];
    const set = (column,value) => { values.push(value); fields.push(`${column}=$${values.length}`); };
    if (notes) set('admin_notes',notes);
    if (data.internalNotes != null) set('internal_notes',internal);
    if (noReturn) {
      const error = refundTextError(exception,'Return Not Required reason');
      if (error) fail(error);
      set('return_status','not_required'); set('no_return_reason',exception);
      set('review_data',JSON.stringify({...refund.review_data,noReturnDecisionAt:new Date().toISOString()}));
    }
    if (status === 'under_review' && refund.status === 'pending') { set('reviewed_by',actorId(user)); fields.push('reviewed_at=now()'); }
    if (status === 'rejected') {
      const error = refundTextError(notes,'Rejection reason');
      if (error) fail(error);
      set('rejection_reason',notes);
      if (!refund.reviewed_by) set('reviewed_by',actorId(user));
      if (refund.status === 'under_inspection') {
        if (!inspection) fail('Inspection notes are required when rejecting a returned item');
        if (typeof data.claimVerified !== 'boolean') fail('Record whether the customer claim was verified during inspection');
        set('claim_verified',data.claimVerified);
        set('inspection_notes',inspection); set('inspected_by',actorId(user)); fields.push('inspected_at=now()');
      }
    }
    if (status === 'return_required') {
      const error = refundTextError(instructions,'Return instructions');
      if (error) fail(error);
      set('return_instructions',instructions); set('return_status','return_pending');
      if (!refund.reviewed_at) { set('reviewed_by',actorId(user)); fields.push('reviewed_at=now()'); }
    }
    if (status === 'item_received') {
      if (refund.return_status !== 'return_pending' && refund.return_status !== 'returned' && refund.return_status !== 'return_in_transit') {
        fail('This refund does not have a pending item return',409);
      }
      fields.push('item_received_at=now()');
    }
    if (status === 'approved') {
      policy.verifyReceipt(refund);
      if (refund.status === 'under_inspection') {
        if (!refund.item_received_at) fail('Confirm receipt of the item before approving the refund',409);
        if (!inspection) fail('Inspection notes are required');
        if (typeof data.resaleSuitable !== 'boolean') fail('Record whether the returned item is suitable for resale');
        if (typeof data.claimVerified !== 'boolean') fail('Record whether the customer claim was verified during inspection');
        if (!data.claimVerified) fail('The customer claim must be verified before approving the refund');
        set('claim_verified',data.claimVerified);
        set('inspection_notes',inspection); set('resale_suitable',data.resaleSuitable);
        set('inspected_by',actorId(user)); fields.push('inspected_at=now()');
        set('return_status','return_confirmed'); fields.push('return_confirmed_at=now()');
      } else {
        if (refund.return_status !== 'not_required' || !refund.no_return_reason?.trim()) fail('Record the Return Not Required reason in a separate action before approving this refund');
      }
      const calculation = await policy.calculation(db,refund);
      if (calculation.requiresVerifiedCosts) fail('Verify material/base value and incurred labor with supporting records before approving a customized guitar refund',409);
      const amount = data.approvedAmount == null ? calculation.suggestedAmount ?? Number(refund.amount_requested) : Number(data.approvedAmount);
      if (calculation.custom && amount > calculation.maximum) fail('The customized guitar refund cannot exceed the lower of verified material/base value and remaining actual payment minus verified incurred labor');
      await checkBudget(db,refund,amount);
      if (amount !== Number(refund.amount_requested) && refundTextError(notes,'Adjustment explanation')) fail('Explain any adjustment to the refund amount using at least 10 meaningful characters');
      set('approved_amount',amount); fields.push('approved_at=now()');
      if (!refund.reviewed_by) set('reviewed_by',actorId(user));
    }
    if (['processing','refund_sent','completed'].includes(status)) {
      policy.verifyReceipt(refund);
      const calculation = await policy.calculation(db,refund);
      if (calculation.custom && (calculation.requiresVerifiedCosts || Number(refund.approved_amount)>calculation.maximum)) fail('Recheck the verified customized guitar costs and refundable amount before payment',409);
      if (!returnVerified(refund)) fail('The return must be received and inspected, or a documented no-return exception must apply',409);
      const original = await db.query(`SELECT p.*,COALESCE(to_jsonb(p)->>'method',to_jsonb(p)->>'payment_method') AS channel
        FROM payments p WHERE payment_id=$1 AND order_id=$2 AND status IN ('verified','refunded')`,[refund.original_payment_id,refund.order_id]);
      if (!original.rows[0] || original.rows[0].channel !== refund.original_payment_method) fail('The verified original payment channel could not be confirmed',409);
      await checkBudget(db,refund,Number(refund.approved_amount));
    }
    if (status === 'processing') fields.push('processing_at=now()');
    if (status === 'refund_sent') {
      if (!data.proofImage) fail('Refund payment proof is required');
      const duplicate = await db.query(`SELECT 1 FROM refund_requests WHERE refund_request_id<>$1 AND deleted_at IS NULL
        AND lower(btrim(refund_reference))=lower($2) AND status IN ('refund_sent','completed','refunded')`,[id,reference]);
      if (reference && duplicate.rows.length) fail('This refund transaction reference has already been used',409);
      await workflow.saveFile(db,id,'proof',data.proofImage,actorId(user));
      set('refund_reference',reference || null); set('refund_method',refund.original_payment_method);
      set('refunded_amount',Number(refund.approved_amount)); set('sent_by',actorId(user)); fields.push('refund_sent_at=now()');
    }
    if (status === 'completed') {
      if (data.paymentConfirmed !== true) fail('Confirm that the actual refund payment succeeded before completing the refund');
      const proof = await db.query("SELECT 1 FROM refund_private_files WHERE refund_request_id=$1 AND kind='proof'",[id]);
      if (!proof.rows.length) fail('Refund payment proof is required');
      set('payment_confirmed',true); set('completed_by',actorId(user));
      fields.push('payment_confirmed_at=now()','completed_at=now()','refunded_at=now()');
    }
    const updated = await db.query(`UPDATE refund_requests SET ${fields.join(',')} WHERE refund_request_id=$1 RETURNING *`,values);
    const timeline=policy.timeline(updated.rows[0]);
    if(timeline.startedAt && !updated.rows[0].review_data?.processingStartedAt) {
      updated.rows[0]=(await db.query('UPDATE refund_requests SET review_data=$2::jsonb WHERE refund_request_id=$1 RETURNING *',
        [id,JSON.stringify({...updated.rows[0].review_data,processingStartedAt:timeline.startedAt})])).rows[0];
    }
    if (status === 'completed') {
      const totals = await db.query(`SELECT
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE order_id=$1 AND status IN ('verified','refunded')) AS paid,
        (SELECT COALESCE(SUM(COALESCE(refunded_amount,approved_amount,amount_requested)),0) FROM refund_requests
          WHERE order_id=$1 AND deleted_at IS NULL AND status IN ('completed','refunded')) AS refunded`,[refund.order_id]);
      if (Number(totals.rows[0].paid) > 0 && Number(totals.rows[0].refunded) >= Number(totals.rows[0].paid)) {
        await db.query("UPDATE payments SET status='refunded',updated_at=now() WHERE order_id=$1 AND status='verified'",[refund.order_id]);
        await db.query("UPDATE orders SET payment_status='refunded',updated_at=now() WHERE order_id=$1",[refund.order_id]);
      }
    }
    const audit = await require('./refundAudit').record(auditContext,{userId:actorId(user),action:noReturn ? 'refund_return_not_required' : `refund_${status}`,entityId:refund.order_id,
      status,previousStatus:refund.status,details:{refund_request_id:id,amount:updated.rows[0].approved_amount,
        ...(exception ? {no_return_reason:exception} : {}),...(inspection ? {inspection_notes:inspection,resale_suitable:data.resaleSuitable,claim_verified:data.claimVerified} : {}),
        ...(notes ? {remarks:notes} : {}),...(data.internalNotes != null ? {internal_notes_updated:true} : {})},executor:db});
    if (!audit) fail('The refund activity could not be recorded. Please retry.',503);
    const recorded = await notifications.record(db,updated.rows[0],noReturn ? 'return_not_required' : status);
    await db.query('COMMIT');
    notifications.publish(recorded);
    return updated.rows[0];
  } catch (error) { await db.query('ROLLBACK'); if (error.code === '23505') fail('This refund transaction reference has already been used',409); throw error; }
  finally { db.release(); }
}
module.exports = { update,ensureReady,transitions };
