const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { appointmentRefundDestinationSchema } = require('../utils/appointmentValidation');
const transitions = { pending: ['processing', 'rejected'], processing: ['refunded', 'rejected'], refunded: [], rejected: [] };
exports.recordEvent = async (db, appointment, actorId, status, previousStatus, details = {}) => {
  await require('./auditService').logAppointmentEvent({ userId: actorId, action: status,
    entityId: appointment.appointment_id, entityType: 'appointment', status, previousStatus,
    details, context: { referenceCode: appointment.reference_code, scheduledAt: appointment.scheduled_at }, executor: db });
};
exports.notify = async (db, userId, title, message, appointmentId, admins = false) => {
  const ids = [userId];
  if (admins) {
    const res = await db.query("SELECT DISTINCT u.user_id FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.user_id LEFT JOIN roles r ON r.role_id = ur.role_id WHERE u.is_active = true AND u.deleted_at IS NULL AND (u.role::text IN ('admin','super_admin','staff') OR (r.name IN ('admin','super_admin','staff') AND ur.is_active = true))");
    ids.push(...res.rows.map(r => r.user_id));
  }
  for (const id of new Set(ids)) await db.query(`INSERT INTO notifications
    (user_id, title, message, notification_type, related_entity_id, related_entity_type)
    VALUES ($1,$2,$3,'appointment_reminder',$4,'appointments')`, [id,title,message,appointmentId]);
};
exports.create = async (data) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const res = await db.query('SELECT * FROM appointments WHERE appointment_id = $1 FOR UPDATE', [data.appointment_id]);
    const a = res.rows[0];
    if (!a) throw new AppError('Appointment not found',404);
    if (a.user_id !== data.user_id) throw new AppError('Only the appointment customer can request a refund',403);
    if (!['no_show', 'cancelled'].includes(a.status)) throw new AppError('Refunds require a cancelled or No Show appointment',409);
    if (!['e_wallet', 'e_bank', 'gcash', 'bank_transfer'].includes(String(a.payment_method || '').trim().toLowerCase())) throw new AppError('Refund requests are available only for e-wallet or bank payments',409);
    if (a.payment_status !== 'approved') throw new AppError('Payment must be reviewed and Approved before requesting a refund',409);
    if (!a.approved_payment_amount || Number(a.approved_payment_amount) <= 0) throw new AppError('Admin must confirm the original approved payment amount before a refund can be requested',409);
    const { error, value: destination } = appointmentRefundDestinationSchema.validate({
      refund_method: data.refund_method, destination_type: data.destination_type,
      account_holder: data.account_holder, account_number: data.account_number, qr_code_url: data.qr_code_url,
    }, { abortEarly: false });
    if (error) throw new AppError(error.details.map(detail => detail.message).join('; '),400);
    const exists = await db.query('SELECT 1 FROM appointment_refunds WHERE appointment_id = $1',[a.appointment_id]);
    if (exists.rows.length) throw new AppError('A refund has already been requested for this appointment',409);
    const amount = Number(a.approved_payment_amount);
    if (data.amount != null && Number(data.amount) !== amount) throw new AppError('Refund amount must match the approved payment',400);
    const payment = { payment_status: a.payment_status, payment_method: a.payment_method,
      payment_proof_url: a.payment_proof_url, amount, reference_code: a.reference_code };
    const result = await db.query(`INSERT INTO appointment_refunds
      (appointment_id,user_id,amount_requested,original_payment,refund_method,account_holder,account_number,reason,destination_type,qr_code_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [a.appointment_id,a.user_id,amount,JSON.stringify(payment),destination.refund_method,destination.account_holder || null,destination.account_number || null,data.reason || null,destination.destination_type,destination.qr_code_url || null]);
    await exports.recordEvent(db,a,a.user_id,'refund_requested',a.status,{refund_request_id:result.rows[0].refund_request_id,amount});
    await exports.notify(db,a.user_id,'Refund requested','Your appointment refund is awaiting admin processing.',a.appointment_id,true);
    await db.query('COMMIT');
    require('./socketService').emitToUserAndStaff(a.user_id,'appointment:updated',{action:'refund_requested',appointment_id:a.appointment_id,refund_request_id:result.rows[0].refund_request_id,status:'pending'});
    return result.rows[0];
  } catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
};
exports.list = async ({ user_id, status, limit = 50, offset = 0 } = {}) => {
  limit = Math.min(100, Math.max(1, Number(limit) || 50)); offset = Math.max(0, Number(offset) || 0);
  const result = await pool.query(`SELECT r.*, a.reference_code, a.scheduled_at, a.appointment_type,
    u.first_name, u.last_name, u.email, COUNT(*) OVER() AS total_count
    FROM appointment_refunds r JOIN appointments a USING(appointment_id) JOIN users u ON u.user_id = r.user_id
    WHERE ($1::uuid IS NULL OR r.user_id = $1) AND ($2::text IS NULL OR r.status = $2)
    ORDER BY r.created_at DESC LIMIT $3 OFFSET $4`,[user_id || null,status || null,limit,offset]);
  return { refund_requests:result.rows,total:Number(result.rows[0]?.total_count || 0),limit,offset };
};
exports.forAppointment = async id => (await pool.query('SELECT * FROM appointment_refunds WHERE appointment_id = $1',[id])).rows;
exports.get = async id => (await pool.query('SELECT * FROM appointment_refunds WHERE refund_request_id = $1',[id])).rows[0];
exports.update = async (id, actorId, data) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const result = await db.query(`SELECT r.*, a.reference_code, a.scheduled_at FROM appointment_refunds r
      JOIN appointments a USING(appointment_id) WHERE r.refund_request_id = $1 FOR UPDATE OF r,a`,[id]);
    const r = result.rows[0];
    if (!r) throw new AppError('Refund not found',404);
    if (!transitions[r.status]?.includes(data.status)) throw new AppError('Invalid refund status transition',409);
    const refundReference = String(data.refund_reference || r.refund_reference || '').trim();
    const proofUrl = data.proof_url || r.proof_url;
    if (data.status === 'refunded' && !refundReference && !proofUrl) throw new AppError('Refund payment proof or a transaction reference is required to complete the refund',400);
    if (data.proof_url && !/^https:\/\//i.test(data.proof_url)) throw new AppError('Proof must be an HTTPS URL',400);
    if (data.status === 'rejected' && !String(data.admin_notes || '').trim()) throw new AppError('Rejection reason is required',400);
    const updated = await db.query(`UPDATE appointment_refunds SET status=$2, refund_reference=$3, proof_url=$4,
      admin_notes=$5, reviewed_by=$6, reviewed_at=now(), updated_at=now() WHERE refund_request_id=$1 RETURNING *`,
      [id,data.status,refundReference || r.refund_reference,proofUrl,data.admin_notes ?? r.admin_notes,actorId]);
    if (data.status === 'refunded') await db.query("UPDATE appointments SET payment_status='refunded', updated_at=now() WHERE appointment_id=$1",[r.appointment_id]);
    await exports.recordEvent(db,r,actorId,`refund_${data.status}`,r.status,{ refund_request_id:id,refund_reference:data.refund_reference,amount:r.amount_requested });
    await exports.notify(db,r.user_id,data.status === 'refunded' ? 'Refund Completed' : `Refund ${data.status}`,data.status === 'refunded' ? `Your refund has been completed.${refundReference ? ` Reference: ${refundReference}.` : ''}${proofUrl ? ' View the refund payment proof in your appointment.' : ''}` : `Your refund is ${data.status}. ${data.admin_notes || ''}`,r.appointment_id);
    await db.query('COMMIT');
    require('./socketService').emitToUserAndStaff(r.user_id,'appointment:updated',{action:'refund_updated',appointment_id:r.appointment_id,refund_request_id:id,status:data.status});
    return updated.rows[0];
  } catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
};
exports.transitions = transitions;
