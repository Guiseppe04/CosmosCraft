import { ModalHeader } from '../shared/ModalHeader'

export function GuitarViewModal({ modal, closeModal, formatCurrency }) {
  if (!modal.data) return null

  return (
    <>
      <ModalHeader title="Customization Details" onClose={closeModal} />
      <div className="mt-6 space-y-3 text-sm">
        {[
          ['Customer', modal.data.user_name],
          ['Guitar Type', modal.data.guitar_type],
          ['Name', modal.data.name],
          ['Body Wood', modal.data.body_wood],
          ['Neck Wood', modal.data.neck_wood],
          ['Fingerboard', modal.data.fingerboard_wood],
          ['Bridge', modal.data.bridge_type],
          ['Pickups', modal.data.pickups],
          ['Color', modal.data.color],
          ['Finish', modal.data.finish_type],
          ['Total Price', formatCurrency(modal.data.total_price)],
        ].map(([key, val]) => val ? (
          <div key={key} className="flex justify-between gap-4 border-b border-[var(--border)] pb-2">
            <span className="text-[var(--text-muted)]">{key}</span>
            <span className="text-white font-medium capitalize">{val}</span>
          </div>
        ) : null)}
      </div>
      <button onClick={closeModal} className="w-full mt-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all">Close</button>
    </>
  )
}
