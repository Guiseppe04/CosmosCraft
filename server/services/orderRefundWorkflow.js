const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { refundDestinationSchema } = require('../utils/refundValidation');

const transitions = {
  pending: ['under_review', 'withdrawn'], under_review: ['approved', 'rejected'],
  approved: ['processing'], processing: ['refund_sent'], refund_sent: ['completed'],
  completed: [], rejected: [], withdrawn: [],
};
const isAdmin = user => ['admin', 'super_admin'].includes(user?.role);
const userId = user => user?.user_id || user?.id;

// Never send account details or file bytes to a socket, customer list, or staff.
const publicRefund = refund => {
  if (!refund) return refund;
  const { payment_destination, ...safe } = refund;
  return safe;
};

function decodeImage(value) {
  if (typeof value !== 'string' || value.length > 7 * 1024 * 1024) throw new AppError('Image must be PNG, JPG, JPEG or WebP and no larger than 5 MB', 400);
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new AppError('Invalid image upload', 400);
  const bytes = Buffer.from(match[2], 'base64');
  const valid = match[1] === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : match[1] === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid || bytes.length < 12 || bytes.length > 5 * 1024 * 1024) throw new AppError('Invalid image contents or size', 400);
  return { mime: match[1], bytes };
}

async function saveFile(db, id, kind, image, actorId) {
  const file = decodeImage(image);
  await db.query(`INSERT INTO refund_private_files (refund_request_id,kind,mime_type,file_data,uploaded_by)
    VALUES ($1,$2,$3,$4,$5)`, [id, kind, file.mime, file.bytes, actorId]);
}

async function ensureReady() {
  const result = await pool.query("SELECT to_regclass('refund_private_destinations') AS destinations, to_regclass('refund_private_files') AS files");
  if (!result.rows[0]?.destinations || !result.rows[0]?.files) throw new AppError('The updated refund process is not yet available. Ask the administrator to apply refund migration 42.', 503);
}

function validateDestination(destination) {
  const { error, value } = refundDestinationSchema.validate(destination, { abortEarly: false });
  if (error) throw new AppError(error.details.map(d => d.message).join('; '), 400);
  if (value.qrImage) decodeImage(value.qrImage);
  return value;
}

async function attachRequest(db, refund, destination, actorId, options = {}) {
  const value = validateDestination(destination);
  const { qrImage, method, ...details } = value;
  if (qrImage) await saveFile(db, refund.refund_request_id, 'qr', qrImage, actorId);
  await db.query('INSERT INTO refund_private_destinations (refund_request_id,payment_destination) VALUES ($1,$2)', [refund.refund_request_id,JSON.stringify(details)]);
  const result = await db.query(`UPDATE refund_requests SET workflow_version=2, preferred_method=$2,
    refund_type='money_refund', amount_requested=(
      SELECT COALESCE(SUM(refund_amount),0) FROM refund_request_items WHERE refund_request_id=$1 AND deleted_at IS NULL)
    WHERE refund_request_id=$1 RETURNING *`, [refund.refund_request_id, method]);
  if (options.cancellationAmount != null) {
    const cancellation = await db.query(`UPDATE refund_requests SET amount_requested=$2, status=$3
      WHERE refund_request_id=$1 RETURNING *`, [refund.refund_request_id, options.cancellationAmount,
      options.awaitingVerification ? 'pending_payment_verification' : 'pending']);
    result.rows[0] = cancellation.rows[0];
  }
  const available = await db.query(`SELECT
    (SELECT COALESCE(SUM(amount),0) FROM payments WHERE order_id=$1 AND
      (status='verified' OR ($3::boolean AND status IN ('pending','for_verification')))) AS paid,
    (SELECT COALESCE(SUM(COALESCE(refunded_amount,approved_amount,amount_requested)),0) FROM refund_requests
      WHERE order_id=$1 AND refund_request_id<>$2 AND deleted_at IS NULL AND status IN ('refunded','refund_sent','completed')) AS refunded`, [refund.order_id,refund.refund_request_id, options.cancellationAmount != null]);
  const requested = Number(result.rows[0].amount_requested);
  if (!Number.isFinite(requested) || requested <= 0 || requested + Number(available.rows[0].refunded) > Number(available.rows[0].paid)) throw new AppError('The requested refund exceeds the remaining verified payment', 400);
  return publicRefund(result.rows[0]);
}

async function update(id, status, user, data = {}) {
  await ensureReady();
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const result = await db.query(`SELECT r.*, d.payment_destination FROM refund_requests r
      LEFT JOIN refund_private_destinations d USING(refund_request_id)
      WHERE r.refund_request_id=$1 AND r.deleted_at IS NULL FOR UPDATE OF r`, [id]);
    const refund = result.rows[0];
    if (!refund) throw new AppError('Refund request not found', 404);
    if (refund.workflow_version !== 2) throw new AppError('Use the original workflow for this refund', 409);
    await db.query('SELECT order_id FROM orders WHERE order_id=$1 FOR UPDATE', [refund.order_id]);
    const owner = refund.user_id === userId(user);
    if (!isAdmin(user) && !(owner && status === 'completed' && refund.status === 'refund_sent')) throw new AppError('Only authorized admins can manage refunds', 403);
    if (!transitions[refund.status]?.includes(status)) throw new AppError(`Invalid refund status transition from '${refund.status}' to '${status}'`, 409);
    const notes = String(data.adminNotes || '').trim();
    if (notes.length > 1000) throw new AppError('Refund notes must not exceed 1000 characters', 400);
    if (status === 'rejected' && !notes) throw new AppError('A rejection reason is required', 400);
    let amount = Number(refund.approved_amount ?? refund.amount_requested);
    if (status === 'approved') {
      amount = data.approvedAmount == null ? Number(refund.amount_requested) : Number(data.approvedAmount);
      const paid = await db.query("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE order_id=$1 AND status='verified'", [refund.order_id]);
      const previous = await db.query("SELECT COALESCE(SUM(COALESCE(refunded_amount,approved_amount,amount_requested)),0) AS total FROM refund_requests WHERE order_id=$1 AND refund_request_id<>$2 AND deleted_at IS NULL AND status IN ('refunded','refund_sent','completed')", [refund.order_id,id]);
      if (!Number.isFinite(amount) || amount <= 0 || Math.abs(Math.round(amount * 100) - amount * 100) > 0.000001 || amount > Number(refund.amount_requested) || amount + Number(previous.rows[0].total) > Number(paid.rows[0].total)) throw new AppError('Refund amount must be positive and cannot exceed the requested amount or remaining verified payment', 400);
      if (amount !== Number(refund.amount_requested) && !notes) throw new AppError('Explain any adjustment to the refund amount', 400);
    }
    if (status === 'processing') {
      const qr = refund.preferred_method === 'e_wallet'
        ? await db.query("SELECT 1 FROM refund_private_files WHERE refund_request_id=$1 AND kind='qr'", [id])
        : { rows: [] };
      // QR bytes were validated before storage. QR-only requests need no account fields.
      if (!qr.rows.length) validateDestination({ method: refund.preferred_method, ...refund.payment_destination });
    }
    if (status === 'refund_sent') {
      if (!Number.isFinite(amount) || amount <= 0) throw new AppError('An approved refund amount is required', 400);
      const available = await db.query(`SELECT
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE order_id=$1 AND status='verified') AS paid,
        (SELECT COALESCE(SUM(COALESCE(refunded_amount,approved_amount,amount_requested)),0) FROM refund_requests
          WHERE order_id=$1 AND refund_request_id<>$2 AND deleted_at IS NULL AND status IN ('refunded','refund_sent','completed')) AS refunded`, [refund.order_id,id]);
      if (amount + Number(available.rows[0].refunded) > Number(available.rows[0].paid)) throw new AppError('The refund exceeds the remaining verified payment. Review the original payment before sending.', 409);
      if (!data.proofImage) throw new AppError('Upload proof of payment before marking the refund as sent', 400);
      await saveFile(db, id, 'proof', data.proofImage, userId(user));
    }
    const reference = String(data.refundReference || '').trim();
    if (reference.length > 255) throw new AppError('Transaction reference must not exceed 255 characters', 400);
    const updated = await db.query(`UPDATE refund_requests SET status=$2::text, updated_at=now(),
      admin_notes=COALESCE(NULLIF($3,''),admin_notes), reviewed_by=CASE WHEN $2 IN ('under_review','approved','rejected') THEN $4 ELSE reviewed_by END,
      reviewed_at=CASE WHEN $2='under_review' THEN now() ELSE reviewed_at END,
      rejection_reason=CASE WHEN $2='rejected' THEN $3 ELSE rejection_reason END,
      approved_amount=CASE WHEN $2='approved' THEN $5 ELSE approved_amount END,
      approved_at=CASE WHEN $2='approved' THEN now() ELSE approved_at END,
      processing_at=CASE WHEN $2='processing' THEN now() ELSE processing_at END,
      refunded_amount=CASE WHEN $2='refund_sent' THEN $5 ELSE refunded_amount END,
      refund_reference=CASE WHEN $2='refund_sent' THEN NULLIF($6,'') ELSE refund_reference END,
      refund_method=CASE WHEN $2='refund_sent' THEN CASE preferred_method WHEN 'e_bank' THEN 'bank_transfer' ELSE 'e_wallet' END ELSE refund_method END,
      refund_sent_at=CASE WHEN $2='refund_sent' THEN now() ELSE refund_sent_at END,
      sent_by=CASE WHEN $2='refund_sent' THEN $4 ELSE sent_by END,
      refunded_at=CASE WHEN $2='completed' THEN now() ELSE refunded_at END,
      completed_at=CASE WHEN $2='completed' THEN now() ELSE completed_at END,
      completed_by=CASE WHEN $2='completed' THEN $4 ELSE completed_by END
      WHERE refund_request_id=$1 RETURNING *`, [id,status,notes,userId(user),amount,reference]);
    if (status === 'refund_sent') {
      // A partial refund does not turn the entire original payment into a refund.
      const totals = await db.query(`SELECT
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE order_id=$1 AND status IN ('verified','refunded')) AS paid,
        (SELECT COALESCE(SUM(COALESCE(refunded_amount,approved_amount,amount_requested)),0) FROM refund_requests
          WHERE order_id=$1 AND deleted_at IS NULL AND status IN ('refunded','refund_sent','completed')) AS refunded`, [refund.order_id]);
      if (Number(totals.rows[0].paid) > 0 && Number(totals.rows[0].refunded) >= Number(totals.rows[0].paid)) {
        await db.query("UPDATE payments SET status='refunded', updated_at=now() WHERE order_id=$1 AND status='verified'", [refund.order_id]);
        await db.query("UPDATE orders SET payment_status='refunded', updated_at=now() WHERE order_id=$1", [refund.order_id]);
      }
    }
    await require('./auditService').logRefundEvent({ userId: userId(user), action: `refund_${status}`, entityId: refund.order_id,
      status, previousStatus: refund.status, details: { refund_request_id: id, amount }, executor: db });
    await db.query('COMMIT');
    return publicRefund(updated.rows[0]);
  } catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
}

async function getFile(id, kind, user) {
  await ensureReady();
  if (!['qr','proof'].includes(kind)) throw new AppError('File not found', 404);
  const result = await pool.query(`SELECT f.mime_type,f.file_data,r.user_id,r.status FROM refund_private_files f
    JOIN refund_requests r USING(refund_request_id) WHERE f.refund_request_id=$1 AND f.kind=$2 AND r.deleted_at IS NULL`, [id,kind]);
  const file = result.rows[0];
  if (!file) throw new AppError('File not found', 404);
  if (!isAdmin(user) && !(kind === 'proof' && file.user_id === userId(user) && ['refund_sent','completed'].includes(file.status))) throw new AppError('You do not have access to this file', 403);
  return file;
}

module.exports = { transitions, isAdmin, publicRefund, decodeImage, saveFile, ensureReady, validateDestination, attachRequest, update, getFile };
