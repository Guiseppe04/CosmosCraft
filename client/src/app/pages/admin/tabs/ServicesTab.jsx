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
  openModal,
  deleteService,
}) {
  return (
    <motion.div key="services" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
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
