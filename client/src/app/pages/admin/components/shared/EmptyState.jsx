import { Layers } from 'lucide-react'

export function EmptyState({ title, description, icon: Icon = Layers, children }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Icon className="w-12 h-12 text-[var(--text-muted)] mb-4" />
      <p className="text-white font-semibold">{title}</p>
      {description ? <p className="text-[var(--text-muted)] text-sm mt-2">{description}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  )
}

export default EmptyState
