import OptionGroup from './OptionGroup.jsx'

export default function ElectronicsOptions({
  config,
  builder,
  options,
  openKey,
  setOpenKey,
  onChange,
}) {
  return (
    <>
      <div className="px-4 pt-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
        Electronics Options
      </div>
      <OptionGroup
        title="Pickups"
        description="Pickup layout"
        variant="text"
        value={config.pickups}
        onChange={pickups => onChange({ pickups })}
        options={options.pickupOptions}
        isOpen={openKey === 'pickups'}
        onToggle={() => setOpenKey(prev => (prev === 'pickups' ? null : 'pickups'))}
        selectedLabel={builder.PICKUP_OPTIONS[config.pickups]?.label ?? config.pickups}
      />
    </>
  )
}
