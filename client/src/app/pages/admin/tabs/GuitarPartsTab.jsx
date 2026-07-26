import { motion } from 'motion/react'
import { SectionLoader } from '../components/shared/SectionLoader'
import { GuitarPartsStickyHeader } from '../components/parts/GuitarPartsStickyHeader'
import { GuitarPartAccordion, GuitarPartTableView } from '../components/parts/GuitarPartsViews'

export function GuitarPartsTab({
  guitarPartViewMode,
  setGuitarPartViewMode,
  partDensity,
  setPartDensity,
  partSearchQuery,
  setPartSearchQuery,
  openModal,
  clearPartFilters,
  partQuery,
  partsLoading,
  sortedFilteredParts,
  expandedGuitarTypes,
  onToggleGuitarType,
  expandedPartCategories,
  onTogglePartCategory,
  deletePart,
  handleQuickAddPart,
  partSortConfig,
  handlePartSort,
}) {
  return (
    <motion.div key="guitar-parts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
      <GuitarPartsStickyHeader
        viewMode={guitarPartViewMode}
        setViewMode={setGuitarPartViewMode}
        density={partDensity}
        setDensity={setPartDensity}
        searchQuery={partSearchQuery}
        setSearchQuery={setPartSearchQuery}
        onAddPart={() => openModal('part')}
        onClearFilters={clearPartFilters}
        partQuery={partQuery}
      />

      {partsLoading ? (
        <SectionLoader label="Loading builder parts..." />
      ) : (
        <>
          {guitarPartViewMode === 'tree' ? (
            <GuitarPartAccordion
              parts={sortedFilteredParts}
              expandedGuitarTypes={expandedGuitarTypes}
              onToggleGuitarType={onToggleGuitarType}
              expandedPartCategories={expandedPartCategories}
              onTogglePartCategory={onTogglePartCategory}
              onEdit={(part) => openModal('part', part)}
              onDelete={deletePart}
              onQuickAdd={handleQuickAddPart}
              density={partDensity}
            />
          ) : (
            <GuitarPartTableView
              parts={sortedFilteredParts}
              onEdit={(part) => openModal('part', part)}
              onDelete={deletePart}
              density={partDensity}
              sortConfig={partSortConfig}
              onSort={handlePartSort}
            />
          )}
        </>
      )}
    </motion.div>
  )
}
