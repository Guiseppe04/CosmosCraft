import React, { useState } from 'react';
import DispatchPhotoInput from '../../../../components/DispatchPhotoInput';
import DispatchPhotoGallery from '../../../../components/DispatchPhotoGallery';
import { normalizeRiderContact } from '../../../../utils/phone';
import RiderContactInput from '../../../../components/RiderContactInput';
import { motion } from 'motion/react';
import {
  X,
  Truck,
  MapPin,
  CheckCircle,
  Clock,
  User,
  Guitar,
  CreditCard,
  FileText,
  ArrowRight,
  Loader2,
  Calendar,
  AlertCircle
} from 'lucide-react';

const formatLabel = (val) => {
  if (!val) return '';
  return String(val)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatDate = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCurrency = (val) => {
  if (val === null || val === undefined) return '—';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);
};

export function FulfillmentDetailsModal({ request, onClose, onUpdateStatus }) {
  if (!request) return null;

  const [adminNotes, setAdminNotes] = useState(request.admin_notes || '');
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors,setFieldErrors]=useState([]);
  const [itemPhotos,setItemPhotos]=useState([]),[photosReady,setPhotosReady]=useState(false);
  const [shippingFee,setShippingFee]=useState(request.additional_shipping_fee ?? '');
  const [trackingNumber,setTrackingNumber]=useState(request.tracking_number || '');
  const [riderName,setRiderName]=useState(request.rider_name || '');
  const [riderContact,setRiderContact]=useState(request.rider_contact || '');

  const method = request.fulfillment_method?.includes('delivery') ? 'delivery' : 'pickup';
  const status = request.status;

  // Determine next stage
  let nextStatus = null;
  let nextLabel = null;

  if (method === 'pickup') {
    if (status === 'requested') {
      nextStatus = 'processing';
      nextLabel = 'Start Processing';
    } else if (status === 'processing') {
      nextStatus = 'ready_for_pickup';
      nextLabel = 'Mark Ready for Pickup';
    } else if (status === 'ready_for_pickup') {
      nextStatus = 'completed';
      nextLabel = 'Confirm Picked Up / Completed';
    }
  } else {
    if (status === 'requested') {
      nextStatus = 'processing';
      nextLabel = 'Start Processing';
    } else if (status === 'processing') {
      nextStatus = 'out_for_delivery';
      nextLabel = 'Mark Out for Delivery';
    } else if (status === 'out_for_delivery') {
      nextStatus = 'completed';
      nextLabel = 'Confirm Delivered / Completed';
    }
  }

  const handleAdvance = async (targetStatus) => {
    if(updating)return;
    setFieldErrors([]);
    if(method==='delivery' && targetStatus==='out_for_delivery'){
      if(!/^\d+(?:\.\d{1,2})?$/.test(String(shippingFee)) || Number(shippingFee)>9999999999.99){setError('Enter a shipping fee of 0 or more, with up to two decimal places.');return;}
      if(!trackingNumber.trim()){setError('Tracking number is required before dispatch.');return;}
      if(!riderName.trim()){setError('Rider name is required before dispatch.');return;}
      if(!normalizeRiderContact(riderContact)){setError('Enter a valid Philippine mobile number for the rider.');return;}
    }
    if(method==='delivery' && targetStatus==='out_for_delivery' && !photosReady){setError('Upload pre-shipping photos for every customized item before dispatch.');return;}
    try {
      setUpdating(true);
      setError(null);
      await onUpdateStatus(request.id, targetStatus, adminNotes,targetStatus==='out_for_delivery'?{
        itemPhotos,additional_shipping_fee:Number(shippingFee),tracking_number:trackingNumber.trim(),
        rider_name:riderName.trim(),rider_contact:normalizeRiderContact(riderContact),
      }:{});
    } catch (err) {
      setFieldErrors(Array.isArray(err.fieldErrors)?err.fieldErrors:[]);
      setError(err.message || 'Failed to update fulfillment status');
    } finally {
      setUpdating(false);
    }
  };

  const addr = request.delivery_address_snapshot;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Fulfillment #{request.order_number || request.order_id?.slice(0, 8)}
              </h2>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${
                method === 'delivery'
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}>
                {method === 'delivery' ? <Truck className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                {method === 'delivery' ? 'Shop Delivery' : 'Pickup at Shop'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Custom Build: <span className="text-white font-semibold">{request.project_title || 'Custom Guitar Build'}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span role="alert" style={{color:'#ef4444'}}>{error}</span>
          </div>
        )}
        {fieldErrors.length>0 && <ul className="space-y-1 text-sm" style={{color:'#ef4444'}}>
          {fieldErrors.map(({field,message},index)=><li key={`${field}-${index}`} role="alert">{({additional_shipping_fee:'Shipping fee',tracking_number:'Tracking number',rider_name:'Rider name',rider_contact:'Rider contact number',admin_notes:'Admin notes'})[field] || (field?.startsWith('itemPhotos')?'Pre-shipping photos':field)}: {message}</li>)}
        </ul>}

        {/* Status Tracker Box */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-[var(--text-muted)]">
              Current Stage
            </span>
            <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${
              status === 'completed'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-sky-500/20 text-sky-400 border-sky-500/40'
            }`}>
              {formatLabel(status)}
            </span>
          </div>

          {/* Timeline */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02]">
              <span className="text-[10px] text-[var(--text-muted)] block">Requested</span>
              <span className="font-semibold text-white mt-0.5 block">{formatDate(request.requested_at)}</span>
            </div>
            <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02]">
              <span className="text-[10px] text-[var(--text-muted)] block">Started</span>
              <span className="font-semibold text-white mt-0.5 block">{formatDate(request.started_at)}</span>
            </div>
            <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02]">
              <span className="text-[10px] text-[var(--text-muted)] block">
                {method === 'delivery' ? 'Out for Delivery' : 'Ready for Pickup'}
              </span>
              <span className="font-semibold text-white mt-0.5 block">
                {formatDate(method === 'delivery' ? request.out_for_delivery_at : request.ready_for_pickup_at)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02]">
              <span className="text-[10px] text-[var(--text-muted)] block">Completed</span>
              <span className="font-semibold text-white mt-0.5 block">{formatDate(request.completed_at)}</span>
            </div>
          </div>
        </div>

        {/* 2-Column Info Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Customer Info */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 space-y-2">
            <h4 className="text-xs uppercase tracking-wider font-bold text-[var(--text-muted)] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
              Customer Information
            </h4>
            <div className="text-xs space-y-1 pt-1">
              <p className="font-bold text-white text-sm">
                {request.first_name} {request.last_name}
              </p>
              <p className="text-[var(--text-muted)]">{request.email}</p>
              {request.phone && <p className="text-[var(--text-muted)]">{request.phone}</p>}
            </div>
          </div>

          {/* Payment & Order Summary */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 space-y-2">
            <h4 className="text-xs uppercase tracking-wider font-bold text-[var(--text-muted)] flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
              Order & Payment
            </h4>
            <div className="text-xs space-y-1 pt-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Order Total:</span>
                <span className="font-bold text-white">{formatCurrency(request.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Order Status:</span>
                <span className="font-semibold text-white capitalize">{request.order_status || 'Paid'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Payment Status:</span>
                <span className="font-semibold text-emerald-400 capitalize">{request.order_payment_status || 'Approved'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Fulfillment Method Specifics */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 space-y-2">
          <h4 className="text-xs uppercase tracking-wider font-bold text-[var(--text-muted)] flex items-center gap-1.5">
            {method === 'delivery' ? <Truck className="w-3.5 h-3.5 text-[var(--gold-primary)]" /> : <MapPin className="w-3.5 h-3.5 text-[var(--gold-primary)]" />}
            {method === 'delivery' ? 'Delivery Address' : 'Pickup Details'}
          </h4>

          {method === 'delivery' ? (
            addr ? (
              <div className="text-xs text-white/90 space-y-0.5 pt-1">
                <p className="font-semibold text-white">{addr.label || 'Saved Address'}</p>
                <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                {addr.barangay && <p>Brgy. {addr.barangay}</p>}
                <p>{[addr.city, addr.province].filter(Boolean).join(', ')} {addr.postal_code || ''}</p>
                <p className="text-[var(--text-muted)]">{addr.country || 'Philippines'}</p>
              </div>
            ) : (
              <p className="text-xs text-amber-300 pt-1">Address snapshot not found; check order checkout details.</p>
            )
          ) : (
            <div className="text-xs text-white/90 space-y-1 pt-1">
              <p className="font-semibold text-white">CosmosCraft Custom Workshop</p>
              <p className="text-[var(--text-muted)]">123 Guitar Artisan Way, Quezon City, Metro Manila</p>
              {request.pickup_scheduled_at && (
                <p className="text-[var(--gold-primary)] font-semibold flex items-center gap-1.5 mt-2">
                  <Calendar className="w-3.5 h-3.5" />
                  Scheduled Pickup: {formatDate(request.pickup_scheduled_at)}
                </p>
              )}
            </div>
          )}

          {request.notes && (
            <div className="pt-2 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
              <span className="font-semibold text-white">Customer Notes: </span>
              {request.notes}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {method==='delivery' && nextStatus==='out_for_delivery' && <fieldset disabled={updating} className="space-y-4 rounded-xl border border-[var(--border)] p-4">
          <h3 className="font-semibold text-white">Dispatch details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Shipping fee (PHP)',shippingFee,setShippingFee,'number'],
              ['Tracking number',trackingNumber,setTrackingNumber,'text'],
              ['Rider name',riderName,setRiderName,'text'],
              ['Rider contact number',riderContact,setRiderContact,'tel'],
            ].map(([label,value,setter,type],index)=><label key={label} className="block text-sm text-white">{label} <span style={{color:'#ef4444'}}>*</span>
              {type==='tel'?<RiderContactInput aria-label={label} aria-invalid={fieldErrors.some(error=>error.field==='rider_contact')} value={value} onChange={event=>setter(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3 text-white" />:<input aria-label={label} type={type} min={type==='number'?0:undefined} step={type==='number'?'0.01':undefined}
                aria-invalid={fieldErrors.some(error=>error.field===['additional_shipping_fee','tracking_number','rider_name','rider_contact'][index])}
                maxLength={type==='number'?undefined:100} value={value} onChange={e=>setter(e.target.value)}
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3 text-white" />}
            </label>)}
          </div>
          <p className="text-xs text-[var(--text-muted)]">Enter 0 when no additional shipping fee applies.</p>
          <DispatchPhotoInput orderId={request.order_id} customOnly value={itemPhotos} onChange={setItemPhotos} onReadyChange={setPhotosReady} disabled={updating} />
        </fieldset>}
        {method==='delivery' && ['out_for_delivery','completed'].includes(status) && <dl className="grid gap-2 text-sm text-white sm:grid-cols-2">
          <div><dt>Shipping fee</dt><dd>{formatCurrency(request.additional_shipping_fee)}</dd></div>
          <div><dt>Tracking number</dt><dd>{request.tracking_number || 'Not recorded'}</dd></div>
          <div><dt>Rider name</dt><dd>{request.rider_name || 'Not recorded'}</dd></div>
          <div><dt>Rider contact number</dt><dd>{request.rider_contact || 'Not recorded'}</dd></div>
        </dl>}
        <DispatchPhotoGallery orderId={request.order_id} allowAdd />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-xs font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            Close
          </button>

          {nextStatus && (
            <button
              type="button"
              disabled={updating}
              onClick={() => handleAdvance(nextStatus)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-5 py-2.5 text-xs font-bold text-black shadow-lg shadow-[var(--gold-primary)]/20 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {updating ? 'Updating...' : nextLabel}
            </button>
          )}

          {status === 'completed' && (
            <div className="flex flex-col sm:items-end">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                {method === 'delivery' ? 'Delivered' : 'Fulfillment Complete'}
              </span>
              {method === 'delivery' && (
                <span className="text-[11px] text-emerald-300/80">
                  {request.delivery_confirmation_method === 'customer' ? 'Confirmed by Customer' : 'Confirmed by Shop'}
                  {request.delivered_at && ` (${formatDate(request.delivered_at)})`}
                </span>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
