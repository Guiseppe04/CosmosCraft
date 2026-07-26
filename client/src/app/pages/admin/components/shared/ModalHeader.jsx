import { X } from 'lucide-react'

export function ModalHeader({ title, onClose }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
        <X className="w-5 h-5 text-[var(--text-muted)]" />
      </button>
    </div>
  )
}

export default ModalHeader
