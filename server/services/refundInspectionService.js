const { AppError } = require('../middleware/errorHandler');
const inventory = require('./inventoryService');
const fail = message => { throw new AppError(message,400); };

// Caller holds the order and refund locks. Inspection, ledger and stock commit together.
async function save(db,refund,data,userId) {
  if (!refund.item_received_at) fail('Confirm physical receipt before saving an inspection');
  if (!data.inspectionNotes?.trim()) fail('Inspection notes are required');
  if (typeof data.claimVerified !== 'boolean') fail('Record whether the customer claim was verified during inspection');
  const items = (await db.query(`SELECT r.order_item_id,r.quantity,o.product_id
    FROM refund_request_items r JOIN order_items o USING(order_item_id)
    WHERE r.refund_request_id=$1 AND r.deleted_at IS NULL ORDER BY o.product_id,r.order_item_id`,[refund.refund_request_id])).rows;
  const results = data.inspectionItems;
  if (!Array.isArray(results) || results.length !== items.length || !items.length
    || new Set(results.map(item=>String(item.orderItemId))).size !== results.length) fail('Record the returned and accepted quantity and resale condition for every item');
  const inspected = items.map(item=>{
    const result=results.find(value=>String(value.orderItemId)===String(item.order_item_id));
    if (!result || !Number.isSafeInteger(result.acceptedQuantity) || result.acceptedQuantity<0 || result.acceptedQuantity>Number(item.quantity)
      || typeof result.resaleSuitable!=='boolean') fail('Accepted quantities must be whole numbers between zero and the requested quantity, with a resale condition');
    return {...result,productId:item.product_id};
  });
  const previous=refund.review_data?.inspection;
  if (previous) {
    if (previous.items.length!==inspected.length || inspected.some(item=>!previous.items.some(old=>String(old.orderItemId)===String(item.orderItemId)
      && old.acceptedQuantity===item.acceptedQuantity && old.resaleSuitable===item.resaleSuitable && old.productId===item.productId)) || previous.notes!==data.inspectionNotes.trim()
      || previous.claimVerified!==data.claimVerified) throw new AppError('Inspection is already saved. Refresh to use its recorded results.',409);
    return previous;
  }
  if (inspected.some(item=>item.resaleSuitable)) {
    if (data.resaleConfirmed !== true) fail('Confirm that the listed quantities were physically received, inspected and are suitable for resale');
    if (!data.resaleProofImage) fail('Upload photo proof showing that the returned items are suitable for resale');
    await require('./orderRefundWorkflow').saveFile(db,refund.refund_request_id,'inspection',data.resaleProofImage,userId);
  }
  for (const item of inspected) {
    if (!item.productId || !item.resaleSuitable || !item.acceptedQuantity) continue;
    const inserted=await db.query(`INSERT INTO refund_restock_log(refund_request_id,order_item_id,product_id,quantity,restocked_by)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(refund_request_id,order_item_id) DO NOTHING RETURNING restock_id`,
    [refund.refund_request_id,item.orderItemId,item.productId,item.acceptedQuantity,userId]);
    if (!inserted.rows.length) continue;
    await inventory.addStock(item.productId,item.acceptedQuantity,{client:db,createdBy:userId,
      notes:`Restocked from refund return — Request #${refund.request_number || refund.refund_request_id}, quantity: ${item.acceptedQuantity}.`});
  }
  return {items:inspected,notes:data.inspectionNotes.trim(),claimVerified:data.claimVerified,
    ...(inspected.some(item=>item.resaleSuitable)?{resaleConfirmed:true,proofKind:'inspection'}:{})};
}
module.exports={save};
