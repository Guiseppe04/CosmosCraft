import { useState } from 'react'
import { formatCurrency } from '../../utils/formatCurrency'
import ImageZoomModal from '../../pages/admin/components/shared/ImageZoomModal'

export function RefundRequestItems({ refund }) {
  const items = refund.items || []
  const itemTotal = items.reduce((sum, item) => sum + Number(item.refund_amount || 0), 0)
  return <div className="space-y-2">
    <h4 className="font-semibold text-[var(--text-light)]">Refund items</h4>
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
          <th className="p-3 text-left">Product</th><th className="p-3 text-center">Quantity</th><th className="p-3 text-right">Unit price</th><th className="p-3 text-right">Refund</th>
        </tr></thead>
        <tbody>{items.map((item, index) => <tr key={index} className="border-b border-[var(--border)] text-[var(--text-light)]">
          <td className="p-3">{item.product_name}</td><td className="p-3 text-center">{item.quantity}</td><td className="p-3 text-right">{formatCurrency(item.unit_price)}</td><td className="p-3 text-right">{formatCurrency(item.refund_amount)}</td>
        </tr>)}</tbody>
      </table>
      <p className="flex justify-between gap-3 p-3 text-sm text-[var(--text-light)]"><span>Total refund</span><strong>{formatCurrency(itemTotal > 0 ? itemTotal : Number(refund.amount_requested || 0))}</strong></p>
    </div>
  </div>
}

export function RefundRequestPhotos({ images = [] }) {
  const [image, setImage] = useState(null)
  if (!images.length) return null
  return <div className="space-y-2">
    <h4 className="font-semibold text-[var(--text-light)]">Proof photos</h4>
    <div className="flex flex-wrap gap-3">{images.map((photo, index) => <button type="button" key={index} onClick={() => setImage(photo.image_url)} aria-label={`Enlarge proof photo ${index + 1}`} className="h-20 w-20 overflow-hidden rounded-lg border border-[var(--border)]">
      <img src={photo.image_url} alt={`Proof ${index + 1}`} className="h-full w-full object-cover" />
    </button>)}</div>
    {image && <ImageZoomModal isOpen src={image} alt="Refund proof photo" onClose={() => setImage(null)} />}
  </div>
}
