const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createFixture,png}=require('./helpers/orderRefundFixture');
const photos=require('../services/dispatchPhotoService');

test('customer dispatch photo routes require ownership and shipment, redact staff data and remain read-only',async()=>{
  const f=await createFixture(),server=f.app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const request=async(actor,path,method='GET',body)=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/orders${path}`,{method,headers:{'Content-Type':'application/json','x-test-actor':actor},body:body?JSON.stringify(body):undefined});
    return {status:response.status,body:await response.json(),cache:response.headers.get('cache-control')};
  };
  try{
    await f.db.exec("UPDATE orders SET status='processing'");
    await photos.transaction(f.ids.order,f.ids.admin,db=>photos.save(db,f.ids.order,'order',[{order_item_id:1,images:[png]}],f.ids.admin));
    const original=(await f.db.query("SELECT photo_id FROM order_dispatch_photos WHERE phase='pre_dispatch'")).rows[0].photo_id;
    const listPath=`/${f.ids.order}/dispatch-photos`,imagePath=`/dispatch-photos/${original}`;
    assert.equal((await request('customer',listPath)).status,403);
    assert.equal((await request('customer',imagePath)).status,404);
    assert.equal((await request('admin',imagePath)).status,200);
    assert.equal((await request('staff',listPath)).status,200);
    await f.db.exec("UPDATE orders SET status='shipped'");
    const list=await request('customer',listPath);
    assert.equal(list.status,200);assert.equal(list.cache,'private, no-store');
    assert.equal(list.body.data.photos.length,1);
    for(const field of ['uploaded_by','uploader_name','addition_reason','dispatch_key','file_data'])assert.equal(list.body.data.photos[0][field],undefined,field);
    const image=await request('customer',imagePath);
    assert.equal(image.status,200);assert.equal(image.body.data.image,png);assert.equal(image.cache,'private, no-store');
    assert.equal((await request('other',listPath)).status,404);
    assert.equal((await request('other',imagePath)).status,404);
    assert.equal((await request('unknown',imagePath)).status,401);
    const additions={reason:'Recorded additional internal inspection evidence.',itemPhotos:[{order_item_id:1,images:[png]}]};
    assert.equal((await request('customer',listPath,'POST',additions)).status,403);
    assert.equal((await request('admin',listPath,'POST',additions)).status,200);
    const supplemental=(await f.db.query("SELECT photo_id FROM order_dispatch_photos WHERE phase='supplemental'")).rows[0].photo_id;
    assert.equal((await request('customer',`/dispatch-photos/${supplemental}`)).status,404);
    assert.equal((await request('staff',`/dispatch-photos/${supplemental}`)).status,200);
    assert.equal((await request('customer',listPath)).body.data.photos.length,1);
    for(const status of ['out_for_delivery','delivered','received','completed']){
      await f.db.query('UPDATE orders SET status=$1',[status]);
      assert.equal((await request('customer',imagePath)).status,200,status);
    }
  }finally{await new Promise(resolve=>server.close(resolve));await f.close();}
});
