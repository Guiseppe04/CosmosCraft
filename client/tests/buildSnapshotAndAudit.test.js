import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { buildSnapshot } from '../src/app/utils/buildSnapshot.js'

test('baseline comparisons ignore metadata but retain every meaningful design and sticker change', () => {
  const config={body:'dc',strings:'7',finishColor:'#123456'}
  const sticker={id:'a',src:'/art.png',side:'front',x:35,y:50,size:18,rotation:30}
  const original=buildSnapshot(config,[sticker])
  assert.equal(original,buildSnapshot({finishColor:config.finishColor,strings:'7',body:'dc',_previewImages:{front:'image'}},[{...sticker,bodyX:20,bodyY:30,aspectRatio:2}]))
  for(const patch of [{x:40},{y:40},{size:20},{rotation:45},{side:'rear'},{src:'/other.png'}]) {
    assert.notEqual(original,buildSnapshot(config,[{...sticker,...patch}]))
  }
  assert.notEqual(original,buildSnapshot({...config,finishColor:'#ffffff'},[sticker]))
  assert.notEqual(original,buildSnapshot(config,[]))
  assert.notEqual(original,buildSnapshot(config,[sticker,{...sticker,id:'b'}]))
  assert.notEqual(buildSnapshot(config,[sticker,{...sticker,id:'b'}]),buildSnapshot(config,[{...sticker,id:'b'},sticker]))
})

test('existing audit presentation clearly identifies sent builds and their recipients', async () => {
  const bundle=await build({entryPoints:['src/app/utils/auditFormatters.js'],bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
  const {formatAuditEntry}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
  const result=formatAuditEntry({action:'BUILD_SENT_TO_CUSTOMER',entity_type:'customizations',entity_id:'build-123',
    context:{buildName:'Custom Stratocaster',buildId:'build-123',customerName:'Juan Dela Cruz',customerId:'customer-123'}})
  assert.equal(result.title,'Build Sent to Customer')
  assert.match(result.description,/Custom Stratocaster \(build-123\) to Juan Dela Cruz/)
  assert.deepEqual(result.metadata.map(entry=>entry.value),['Custom Stratocaster','build-123','Juan Dela Cruz','customer-123'])
})
