import { motion } from 'motion/react'
import { Wrench } from 'lucide-react'
import { SectionLoader } from '../components/shared/SectionLoader'
import { EmptyState } from '../components/shared/EmptyState'
import { ServiceTableView, ServiceGridView } from '../components/services/ServiceViews'
import { PaginationBar } from '../components/shared/PaginationBar'

export function ServicesTab({
  services,
  servicesLoading,
  debouncedSearch,
  serviceViewMode,
  servicesPagination,
  serviceQuery,
  setServiceQuery,
  setSearchQuery,
  openModal,
  deleteService,
}) {
  return (
    <motion.div key="services" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-white text-xl font-semibold">Services</h2>
          <p className="text-[var(--text-muted)] text-sm">Manage services and pricing offered to customers.</p>
        </div>
        {services.length > 0 && (
          <button
            onClick={() => {
              setServiceQuery({ page: 1, pageSize: serviceQuery.pageSize, sortBy: 'created_at', sortDir: 'desc', is_active: '' })
              setSearchQuery('')
            }}
            className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)] transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {servicesLoading ? (
        <SectionLoader label="Loading services..." />
      ) : services.length === 0 ? (
        <EmptyState
          icon={Wrench}
          label={debouncedSearch ? 'No services match your search' : 'No services found'}
          action={() => openModal('service')}
          actionLabel="Add Service"
        />
      ) : serviceViewMode === 'table' ? (
        <ServiceTableView services={services} onEdit={(svc) => openModal('service', svc)} onDelete={deleteService} />
      ) : (
        <ServiceGridView services={services} onEdit={(svc) => openModal('service', svc)} onDelete={deleteService} />
      )}

      {servicesPagination.totalPages > 1 && (
        <PaginationBar pagination={servicesPagination} loading={servicesLoading} onPageChange={(page) => setServiceQuery((prev) => ({ ...prev, page }))} />
      )}
    </motion.div>
  )
}
