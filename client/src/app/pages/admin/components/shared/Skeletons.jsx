export function OrderTableSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(8)].map((_, index) => (
        <div key={index} className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-4 h-4 bg-[var(--border)] rounded" />
            <div className="w-32 h-5 bg-[var(--border)] rounded" />
            <div className="flex-1">
              <div className="w-40 h-4 bg-[var(--border)] rounded mb-2" />
              <div className="w-60 h-3 bg-[var(--border)]/50 rounded" />
            </div>
            <div className="w-16 h-5 bg-[var(--border)] rounded-full" />
            <div className="w-24 h-5 bg-[var(--border)] rounded" />
            <div className="w-28 h-6 bg-[var(--border)] rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function OrderDetailsSkeleton() {
  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 space-y-6 animate-pulse">
      <div className="flex justify-between">
        <div className="w-48 h-6 bg-[var(--border)] rounded" />
        <div className="w-24 h-6 bg-[var(--border)] rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="h-20 bg-[var(--border)]/30 rounded-xl" />
        ))}
      </div>
      <div className="h-40 bg-[var(--border)]/30 rounded-xl" />
      <div className="h-32 bg-[var(--border)]/30 rounded-xl" />
    </div>
  )
}

export default { OrderTableSkeleton, OrderDetailsSkeleton }
