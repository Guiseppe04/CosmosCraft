import {useEffect,useState} from 'react'
import {adminApi} from '../utils/adminApi'
import ImageZoomModal from '../pages/admin/components/shared/ImageZoomModal'
import DispatchPhotoInput from './DispatchPhotoInput'
function Thumbnail({photo,onOpen}){
  const [src,setSrc]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0)
  useEffect(()=>{let active=true;setError('');setSrc(null);adminApi.getDispatchPhoto(photo.photo_id).then(result=>{if(active)setSrc(result.data.image)}).catch(err=>{if(active)setError(err.message)});return()=>{active=false}},[photo.photo_id,retry])
  return <>{src && !error && <button type="button" onClick={()=>onOpen({src,alt:`Dispatch photo of ${photo.item_name}`})} aria-label={`Enlarge dispatch photo of ${photo.item_name}`} className="block w-full"><img src={src} alt={`Pre-shipping preview of ${photo.item_name}`} onError={()=>setError('This dispatch photo could not be displayed.')} className="max-h-40 w-full rounded-lg bg-white object-contain" /></button>}
    {error && <p role="alert" style={{color:'#ef4444'}} className="text-xs">{error} <button type="button" onClick={()=>setRetry(value=>value+1)} className="underline">Retry photo</button></p>}</>
}
export default function DispatchPhotoGallery({orderId,allowAdd=false,customerView=false}) {
  const [photos,setPhotos]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[image,setImage]=useState(null),[retry,setRetry]=useState(0)
  const [add,setAdd]=useState(false),[entries,setEntries]=useState([]),[reason,setReason]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false)
  useEffect(()=>{let active=true;setLoading(true);setError('');adminApi.getDispatchPhotos(orderId).then(result=>{if(active)setPhotos(result.data.photos)}).catch(err=>{if(active)setError(err.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[orderId,retry])
  async function open(photo){setError('');try{const result=await adminApi.getDispatchPhoto(photo.photo_id);setImage({src:result.data.image,alt:`Dispatch photo of ${photo.item_name}`})}catch(err){setError(err.message)}}
  async function save(){if(busy)return;setBusy(true);setError('');try{await adminApi.appendDispatchPhotos(orderId,{itemPhotos:entries,reason});setAdd(false);setEntries([]);setReason('');setRetry(value=>value+1)}catch(err){setError(err.message)}finally{setBusy(false)}}
  return <section aria-label="Pre-shipping product evidence" className="space-y-3 rounded-xl border border-[var(--border)] p-4">
    <h3 className="font-semibold text-[var(--text-light)]">Pre-shipping photos</h3>
    <p className="text-xs text-[var(--text-muted)]">{customerView?'These photos show the recorded condition of your items before shipping. You can enlarge them and compare them with the items you receive.':'Compare these dispatch records with customer and return evidence. Photos support assessment; they do not automatically determine who caused damage.'}</p>
    {loading && <p role="status" className="text-sm text-[var(--text-muted)]">Loading dispatch evidence...</p>}
    {!loading && !photos.length && !error && <p className="text-sm text-[var(--text-muted)]">No dispatch photos were recorded. Historical shipments may predate this requirement.</p>}
    <div className="grid gap-3 sm:grid-cols-2">{photos.map(photo=><div key={photo.photo_id} className="space-y-1 rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--text-muted)]">
      <p>{photo.item_name} — quantity {photo.quantity}</p><p>{photo.phase==='pre_dispatch'?'Original dispatch record':'Later supplemental evidence'}</p>
      <p>{new Date(photo.created_at).toLocaleString('en-PH')}{!customerView && ` · ${photo.uploader_name?.trim() || 'Authorized uploader'}`}</p>
      {!customerView && photo.addition_reason && <p className="whitespace-pre-wrap break-words">Addition reason: {photo.addition_reason}</p>}
      <Thumbnail photo={photo} onOpen={setImage} />
      <button type="button" onClick={()=>open(photo)} className="text-[var(--gold-primary)] underline">View dispatch photo of {photo.item_name}</button>
    </div>)}</div>
    {allowAdd && !customerView && photos.length>0 && <button type="button" disabled={busy} onClick={()=>setAdd(value=>!value)} className="text-sm text-[var(--gold-primary)] underline">Add supplemental photos</button>}
    {add && !customerView && <div className="space-y-3"><DispatchPhotoInput orderId={orderId} value={entries} onChange={setEntries} onReadyChange={setReady} disabled={busy} optional />
      <label className="block text-sm text-[var(--text-light)]">Reason for adding evidence<textarea value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)} className="mt-1 w-full rounded-lg bg-[var(--bg-primary)] p-2" /></label>
      <button type="button" disabled={!ready || busy} onClick={save} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--gold-primary)] disabled:opacity-50">Save supplemental evidence</button></div>}
    {image && <ImageZoomModal isOpen src={image.src} alt={image.alt} onClose={()=>setImage(null)} />}
    {error && <p role="alert" style={{color:'#ef4444'}} className="text-sm">{error} <button type="button" onClick={()=>setRetry(value=>value+1)} className="underline">Retry dispatch evidence</button></p>}
  </section>
}
