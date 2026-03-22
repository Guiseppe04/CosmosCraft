export default function SummaryCard({ price, rows, onAddToCart }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#151515] px-3 py-3 text-white">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Current Total</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">${price.toLocaleString()}</p>
        </div>
        <button
          type="button"
          onClick={onAddToCart}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[#14a8f5] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1195d9]"
        >
          Add To Cart
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-md bg-white/5 px-2 py-2">
            <span className="text-[11px] uppercase tracking-[0.12em] text-white/45">{label}</span>
            <span className="text-xs font-medium text-white">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
