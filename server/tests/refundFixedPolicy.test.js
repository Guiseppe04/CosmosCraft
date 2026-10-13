const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createFixture,png}=require('./helpers/orderRefundFixture');
const orders=require('../services/orderService');
const workflow=require('../services/orderRefundWorkflow');
const policy=require('../services/refundPolicyService');
const admin=f=>({id:f.ids.admin,role:'admin'});
const create=(f,reason)=>orders.createRefundRequest({orderId:f.ids.order,userId:f.ids.customer,reason,customerNotes:'',items:[{order_item_id:1,quantity:2}],images:[png]});
const noReturn=(f,id)=>workflow.update(id,'under_review',admin(f),{action:'mark_no_return',noReturnReason:'Documented safety concerns prevent shipping the item back.'});

test('all regular refund reasons default to 50 percent and admin adjustments remain allowed',async()=>{
  const f=await createFixture();try{
    for(const reason of ['damaged','wrong_item','not_as_described','no_longer_needed','better_price','other']){
      const refund=await create(f,reason),id=refund.refund_request_id;
      await noReturn(f,id);
      const result=await workflow.update(id,'approved',admin(f),{adminNotes:'Applied the default fifty percent after reviewing this request.'});
      assert.equal(Number(result.approved_amount),500,reason);
      await workflow.update(id,'rejected',admin(f),{adminNotes:'Test case closed after checking the calculated default amount.'});
    }
    const refund=await create(f,'damaged');await noReturn(f,refund.refund_request_id);
    const adjusted=await workflow.update(refund.refund_request_id,'approved',admin(f),{approvedAmount:750,adminNotes:'Approved a higher amount based on verified circumstances.'});
    assert.equal(Number(adjusted.approved_amount),750);
  }finally{await f.close();}
});

test('custom refunds retain verified costs and the existing formula instead of a fifty percent default',async()=>{
  const f=await createFixture();try{
    await f.db.exec("ALTER TABLE order_items ADD COLUMN customization_id UUID; UPDATE order_items SET customization_id='40000000-0000-4000-8000-000000000001'");
    const refund=await create(f,'damaged'),id=refund.refund_request_id;await noReturn(f,id);
    await assert.rejects(workflow.update(id,'approved',admin(f)),/Verify material/);
    await f.db.query("UPDATE refund_requests SET review_data=jsonb_set(review_data,'{financial}',$2::jsonb) WHERE refund_request_id=$1",[id,JSON.stringify({verified:true,materialValue:600,incurredLabor:300,evidence:'Verified material invoices and incurred labor records.'})]);
    const approved=await workflow.update(id,'approved',admin(f),{adminNotes:'Approved the verified material value under the cost formula.'});
    assert.equal(Number(approved.approved_amount),600);
  }finally{await f.close();}
});

test('hardcoded warranty and processing estimates retain calendar-month boundaries',()=>{
  assert.equal(policy.settings.customWarrantyMonths,3);
  assert.equal(policy.deadline('2026-01-31T12:00:00+08:00',true),'2026-04-30T04:00:00.000Z');
  const regular=policy.timeline({review_data:{}});
  const custom=policy.timeline({review_data:{policy:{settings:policy.settings,items:[{custom:true}]}}});
  assert.deepEqual([regular.minDays,regular.maxDays],[1,3]);
  assert.deepEqual([custom.minDays,custom.maxDays],[7,14]);
});
