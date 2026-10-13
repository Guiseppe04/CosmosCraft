const socketService = require('./socketService');
const labels = {
  pending:'Pending Review',under_review:'Under Review',return_required:'Return Required',return_not_required:'Return Not Required',
  return_in_transit:'Return in Transit',item_received:'Item Received',under_inspection:'Under Inspection',
  approved:'Refund Approved',processing:'Refund Processing',refund_sent:'Refund Processing',
  completed:'Refund Completed',rejected:'Refund Rejected',
  review_updated:'Return details updated',repair_offered:'Repair/rework offer',repair_accepted:'Repair/rework offer accepted',repair_declined:'Repair/rework offer declined',
};
async function record(db, refund, status, notifyAdmins = false) {
  const ids = [refund.user_id];
  if (notifyAdmins) {
    const admins = await db.query(`SELECT DISTINCT u.user_id FROM users u
      LEFT JOIN user_roles ur ON ur.user_id=u.user_id LEFT JOIN roles r ON r.role_id=ur.role_id
      WHERE u.is_active=true AND u.deleted_at IS NULL AND
      (u.role::text IN ('admin','super_admin') OR (r.name IN ('admin','super_admin') AND ur.is_active=true))`);
    ids.push(...admins.rows.map(row => row.user_id));
  }
  const label = labels[status] || status;
  const message = status === 'review_updated' ? 'Review the updated return details in your refund request. Your refund status has not changed.'
    : status === 'repair_offered' ? 'The store has offered repair or rework. Review the offer and accept or decline it in your refund request.'
    : ['repair_accepted','repair_declined'].includes(status) ? 'The customer response to the repair/rework offer was recorded. The refund status has not changed.'
    : status === 'refund_sent' ? 'Refund payment evidence has been recorded. Awaiting repayment confirmation.'
    : status === 'return_required' ? `Your return is approved. ${refund.return_instructions || ''}`
      : status === 'rejected' ? `Your refund was rejected. ${refund.rejection_reason || ''}`
        : `Refund ${refund.request_number || ''}: ${label}.`;
  const notifications = [];
  for (const id of new Set(ids)) {
    const result = await db.query(`INSERT INTO notifications
      (user_id,title,message,notification_type,related_entity_id,related_entity_type)
      VALUES ($1,$2,$3,'refund',$4,'orders') RETURNING *`, [id,label,message,refund.order_id]);
    notifications.push(result.rows[0]);
  }
  return notifications;
}
function publish(notifications) {
  for (const notification of notifications) socketService.emitToUser(notification.user_id,'notification:new',{notification});
}
module.exports = { record, publish, labels };
