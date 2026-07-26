import { Search, Layers, List, Plus } from 'lucide-react'

export function GuitarPartsStickyHeader({ viewMode, setViewMode, density, setDensity, searchQuery, setSearchQuery, onAddPart, onClearFilters, partQuery }) {
  return (
    <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/95 backdrop-blur-md border-b border-[var(--border)] pb-4 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-white text-xl font-semibold">Guitar Parts (Builder Catalog)</h3>
          <p className="text-[var(--text-muted)] text-sm">Manage parts aligned with builder slots used in customization pages.</p>
        </div>
        <button
          onClick={onAddPart}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Part
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search parts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl p-1">
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'tree' ? 'bg-[var(--gold-primary)] text-black' : 'text-[var(--text-muted)] hover:text-white'}`}
          >
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              Tree
            </div>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'table' ? 'bg-[var(--gold-primary)] text-black' : 'text-[var(--text-muted)] hover:text-white'}`}
          >
            <div className="flex items-center gap-1.5">
              <List className="w-4 h-4" />
              Table
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl p-1">
          <button
            onClick={() => setDensity('comfortable')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${density === 'comfortable' ? 'bg-[var(--gold-primary)] text-black' : 'text-[var(--text-muted)] hover:text-white'}`}
          >
            Comfortable
          </button>
          <button
            onClick={() => setDensity('compact')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${density === 'compact' ? 'bg-[var(--gold-primary)] text-black' : 'text-[var(--text-muted)] hover:text-white'}`}
          >
            Compact
          </button>
        </div>

        <button
          onClick={onClearFilters}
          className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-white hover:border-[var(--gold-primary)] transition-colors"
        >
          Clear filters
        </button>
      </div>
    </div>
  )
}

export default GuitarPartsStickyHeader
