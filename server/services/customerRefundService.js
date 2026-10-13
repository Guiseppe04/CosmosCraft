const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const workflow = require('./orderRefundWorkflow');

async function ensureReady() {
  await workflow.ensureReady();
  const result = await pool.query(`SELECT (
    SELECT pg_get_constraintdef(oid) FROM pg_constraint
    WHERE conrelid=to_regclass('refund_private_files') AND conname='refund_private_files_kind_check'
  ) AS file_kinds FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name='refund_requests' AND column_name='original_payment_method'`);
  const kinds = result.rows[0]?.file_kinds || '';
  const requiredKinds = Array.from({length:5},(_,i) => [`evidence${i}`,`return${i}`]).flat();
  if (!result.rows.length || requiredKinds.some(kind => !kinds.includes(`'${kind}'`))) {
    throw new AppError('The customer refund database update is incomplete. Run node server/migrations/run-migration46.js, then retry.', 503);
  }
}

async function getTracking(id, actorId) {
  const result = await pool.query(`SELECT r.* FROM refund_requests r
    WHERE refund_request_id=$1 AND user_id=$2 AND deleted_at IS NULL`, [id, actorId]);
  const refund = result.rows[0];
  if (!refund) throw new AppError('Refund request not found', 404);
  const files = await pool.query(`SELECT kind FROM refund_private_files WHERE refund_request_id=$1
    AND (kind LIKE 'evidence%' OR kind LIKE 'return%') ORDER BY kind`, [id]);
  // Explicit allowlist: never expose payment account details or employee IDs.
  const fields = ['refund_request_id','status','reason','customer_notes','created_at','updated_at',
    'amount_requested','approved_amount','refunded_amount','original_payment_method',
    'preferred_method','admin_notes','rejection_reason','return_status','return_instructions',
    'return_method','return_reference','customer_return_notes','return_confirmed_at',
    'approved_at','processing_at','refund_sent_at','completed_at','refund_reference',
    'no_return_reason','item_received_at','inspection_notes','inspected_at','payment_confirmed_at'];
  const history = await pool.query(`SELECT
    CASE WHEN changes->'return_status'->>'to'='not_required' THEN 'refund_return_not_required' ELSE action END AS action,
    previous_status,new_status,created_at FROM audit_logs
    WHERE (details->>'refund_request_id'=$1 OR (entity_type='refund' AND entity_id=$1::uuid))
      AND new_status IS NOT NULL
      AND (action LIKE 'refund_%' OR action='INSERT' OR changes ? 'status'
        OR changes->'return_status'->>'to' IN ('not_required','returned','return_in_transit','return_confirmed'))
    ORDER BY created_at`,[id]);
  return { ...Object.fromEntries(fields.map(key => [key, refund[key] ?? null])), review:require('./refundReviewService').customerReview(refund),files: files.rows.map(f => f.kind),history:history.rows };
}

async function getEvidence(id, kind, actorId) {
  if (!/^(evidence|return)_?[0-4]$/.test(kind)) throw new AppError('Image not found', 404);
  const result = await pool.query(`SELECT f.mime_type,f.file_data FROM refund_private_files f
    JOIN refund_requests r USING(refund_request_id)
    WHERE f.refund_request_id=$1 AND f.kind=$2 AND r.user_id=$3 AND r.deleted_at IS NULL`, [id,kind,actorId]);
  if (!result.rows[0]) throw new AppError('Image not found', 404);
  return result.rows[0];
}

async function submitReturn(id, actorId, data) {
  await ensureReady();
  const { error } = require('../utils/validation').customerReturnEvidenceSchema.validate(data);
  if (error) throw new AppError(error.details[0].message,400);
  data.images.forEach(workflow.decodeImage);
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const auditContext = await require('./refundAudit').prepare(db,actorId);
    const result = await db.query(`SELECT * FROM refund_requests WHERE refund_request_id=$1
      AND user_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id,actorId]);
    const refund = result.rows[0];
    if (!refund) throw new AppError('Refund request not found', 404);
    if (!['return_required','approved','return_pending'].includes(refund.status) || refund.return_status !== 'return_pending' || !refund.return_instructions?.trim()) {
      throw new AppError('Return evidence can only be submitted after return instructions are approved.', 409);
    }
    for (let i = 0; i < data.images.length; i++) await workflow.saveFile(db,id,`return${i}`,data.images[i],actorId);
    const updated = await db.query(`UPDATE refund_requests SET return_status='returned',
      status=CASE WHEN status='return_required' OR (original_payment_method IS NOT NULL AND status='approved') THEN 'return_in_transit' ELSE status END,
      return_method=$2,return_reference=$3,customer_return_notes=$4,updated_at=now()
      WHERE refund_request_id=$1 RETURNING *`, [id,data.returnMethod,data.returnReference || null,data.notes || null]);
    const audit = await require('./refundAudit').record(auditContext,{ userId:actorId,action:'refund_return_submitted',
      entityId:refund.order_id,status:updated.rows[0].status === 'return_in_transit' ? 'return_in_transit' : 'returned',previousStatus:refund.status,
      details:{refund_request_id:id,return_method:data.returnMethod},executor:db });
    if (!audit) throw new AppError('The return activity could not be recorded. Please retry.',503);
    const notifications = require('./refundNotifications');
    const recorded = await notifications.record(db,updated.rows[0],'return_in_transit',true);
    await db.query('COMMIT');
    notifications.publish(recorded);
    return workflow.publicRefund(updated.rows[0]);
  } catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
}

module.exports = { ensureReady, getTracking, getEvidence, submitReturn };
