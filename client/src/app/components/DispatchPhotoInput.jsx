import {useEffect,useRef,useState} from 'react'
import {adminApi} from '../utils/adminApi'
import CustomerRefundImages from './refunds/CustomerRefundImages'
export const dispatchPhotosComplete=(items,photos)=>items.length>0 && items.every(item=>photos.some(entry=>Number(entry.order_item_id)===Number(item.order_item_id) && entry.images?.length>0))
export default function DispatchPhotoInput({orderId,customOnly=false,value=[],onChange,disabled=false,onReadyChange=()=>{},optional=false}) {
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState({}),[retry,setRetry]=useState(0)
  const reading=Object.values(busy).some(Boolean)
  const currentPhotos=useRef(value);currentPhotos.current=value
  const readyCallback=useRef(onReadyChange);readyCallback.current=onReadyChange
  useEffect(()=>{let active=true;setLoading(true);setError('');adminApi.getDispatchPhotos(orderId,customOnly).then(result=>{if(active)setItems(result.data.items)}).catch(err=>{if(active)setError(err.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[orderId,customOnly,retry])
  const complete=optional?value.some(entry=>entry.images?.length):dispatchPhotosComplete(items,value)
  useEffect(()=>{readyCallback.current(!loading && !reading && !error && complete)},[loading,reading,error,complete])
  return <section aria-label="Pre-shipping item photos" className="space-y-3 rounded-lg border border-[var(--border)] p-3">
    <h4 className="font-semibold text-[var(--text-light)]">{optional?'Supplemental dispatch evidence':'Required pre-shipping photos per item'}</h4>
    <p className="text-xs text-[var(--text-muted)]">{optional?'Select photos for the relevant items. Originals remain preserved.':'Upload 1–5 photos for every listed item. Show all units when quantity exceeds one, including identifying marks and accessories.'} PNG, JPG/JPEG or WebP; 5 MB per image, 50 MB total per upload. Visible only to authorized admins and staff.</p>
    {loading && <p role="status" className="text-sm">Loading shipment items...</p>}
    {!loading && !error && !items.length && <p role="alert" style={{color:'#ef4444'}} className="text-sm">No shippable items were found. Refresh the order before shipping.</p>}
    {items.map(item=><div key={item.order_item_id} className="space-y-2 border-t border-[var(--border)] pt-3">
      <p className="text-sm text-[var(--text-light)]">{item.product_name} — quantity {item.quantity}</p>
      <CustomerRefundImages label={`Dispatch photos for ${item.product_name} (item ${item.order_item_id})`}
        images={value.find(entry=>Number(entry.order_item_id)===Number(item.order_item_id))?.images || []}
        onChange={images=>{const next=[...currentPhotos.current.filter(entry=>Number(entry.order_item_id)!==Number(item.order_item_id)),...(images.length?[{order_item_id:Number(item.order_item_id),images}]:[])];currentPhotos.current=next;onChange(next)}}
        disabled={disabled || loading} onBusyChange={reading=>setBusy(previous=>({...previous,[item.order_item_id]:reading}))} />
    </div>)}
    {error && <p role="alert" style={{color:'#ef4444'}} className="text-sm">{error} <button type="button" onClick={()=>setRetry(value=>value+1)} className="underline">Retry shipment items</button></p>}
  </section>
}
