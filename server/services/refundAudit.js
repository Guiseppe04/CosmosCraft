const auditService = require('./auditService');
const { AppError } = require('../middleware/errorHandler');

// Called after BEGIN, before mutations, on the same checked-out connection.
// Protected deployments own audit writes in their existing database trigger.
async function prepare(db, actorId) {
  const result = await db.query(`SELECT
    EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE t.tgrelid=to_regclass('refund_requests') AND NOT t.tgisinternal
      AND t.tgenabled IN ('O','A') AND p.proname='audit_record_change') AS trigger_managed,
    EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE t.tgrelid=to_regclass('audit_logs') AND NOT t.tgisinternal
      AND t.tgenabled IN ('O','A') AND p.proname='audit_protect_history') AS protected_history`);
  const mode = result.rows[0];
  if (!mode.trigger_managed && mode.protected_history) {
    throw new AppError('The refund database audit trigger is unavailable. The refund has not been changed.',503);
  }
  if (!mode.trigger_managed) return {db,actorId,triggerManaged:false};
  const transaction = await db.query(`SELECT
    set_config('cosmos.audit_actor_id',$1,true),set_config('cosmos.audit_source','refund_api',true),
    txid_current()::text AS transaction_id`,[String(actorId || '')]);
  // xmin contains the 32-bit transaction ID, while txid_current includes its epoch.
  const transactionId = String(BigInt(transaction.rows[0].transaction_id) % 4294967296n);
  return {db,actorId,triggerManaged:true,transactionId};
}

async function record(context,event) {
  if (!context.triggerManaged) {
    const audit = await auditService.logRefundEvent({...event,executor:context.db});
    if (!audit) throw new AppError('The refund activity could not be recorded. Please retry.',503);
    return audit;
  }
  const id = String(event.details.refund_request_id);
  const result = await context.db.query(`SELECT user_id,action,previous_status,new_status FROM audit_logs
    WHERE entity_type='refund' AND entity_id=$1::uuid AND user_id=$2::uuid
      AND new_status IS NOT DISTINCT FROM $3::text AND xmin::text=$4
      AND context->>'source'='refund_api' LIMIT 1`,[id,context.actorId,event.status,context.transactionId]);
  if (!result.rows[0]) throw new AppError('The database did not record this refund activity. The change has been rolled back.',503);
  return result.rows[0];
}

module.exports = { prepare,record };
