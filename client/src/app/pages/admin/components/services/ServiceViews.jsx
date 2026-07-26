import { motion } from 'motion/react'
import { Edit, Trash2, Wrench } from 'lucide-react'
import { formatCurrency } from '../../../../utils/formatCurrency'

export function ServiceTableView({ services, onEdit, onDelete }) {
  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-primary)]/50">
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Service Name</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Description</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Price</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Duration (mins)</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Status</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.service_id} className="border-b border-[var(--border)] hover:bg-[var(--bg-primary)]/50 transition-colors">
                <td className="px-4 py-3 text-sm text-white font-medium">{service.name}</td>
                <td className="px-4 py-3 text-sm text-[var(--text-muted)] max-w-xs truncate" title={service.description || ''}>{service.description || '—'}</td>
                <td className="px-4 py-3 text-sm text-[var(--gold-primary)] font-semibold">{formatCurrency(service.price)}</td>
                <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{service.duration_minutes ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${service.is_active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                    {service.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(service)} className="p-2 hover:bg-[var(--gold-primary)]/10 rounded-lg transition-colors" title="Edit">
                      <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                    </button>
                    <button onClick={() => onDelete(service.service_id, service.name)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {services.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <Wrench className="w-12 h-12 text-[var(--text-muted)] mb-4" />
          <p className="text-[var(--text-muted)]">No services found</p>
        </div>
      )}
    </div>
  )
}

export function ServiceGridView({ services, onEdit, onDelete }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {services.map((service) => (
        <motion.div key={service.service_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--gold-primary)]/50 transition-all group">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--gold-primary)]/20 border border-[var(--gold-primary)]/30 flex items-center justify-center">
              <Wrench className="w-6 h-6 text-[var(--gold-primary)]" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(service)} className="p-2 hover:bg-[var(--gold-primary)]/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Edit">
                <Edit className="w-4 h-4 text-[var(--gold-primary)]" />
              </button>
              <button onClick={() => onDelete(service.service_id, service.name)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Delete">
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </div>
          <h3 className="text-white font-semibold text-lg mb-2 truncate">{service.name}</h3>
          <p className="text-[var(--text-muted)] text-sm mb-4 line-clamp-2">{service.description || 'No description'}</p>
          <div className="flex items-center justify-between">
            <span className="text-[var(--gold-primary)] font-bold">{formatCurrency(service.price)}</span>
            <span className="text-[var(--text-muted)] text-xs">{service.duration_minutes ? `${service.duration_minutes} min` : ''}</span>
          </div>
          <div className="mt-3">
            <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${service.is_active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
              {service.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export default { ServiceTableView, ServiceGridView }
