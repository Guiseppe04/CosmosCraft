export function AdminTable({ columns, rows, renderRow, empty, footer }) {
  if (!rows || rows.length === 0) return empty || null

  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-primary)] text-[var(--text-muted)] uppercase tracking-wider font-bold border-b border-[var(--border)]">
            <tr>
              {columns.map((col) => (
                <th key={col} className="py-3 px-4">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]/50">
            {rows.map((row, index) => (
              <tr key={index} className="hover:bg-[var(--bg-primary)]/40 transition-colors">
                {renderRow(row)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  )
}

export default AdminTable
