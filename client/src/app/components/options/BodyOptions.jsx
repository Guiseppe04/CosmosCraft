import OptionGroup from './OptionGroup.jsx'

export default function BodyOptions({
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
        Body Options
      </div>
      <OptionGroup
        title="Body Shape"
        description="Choose the core silhouette"
        variant="text"
        value={config.body}
        onChange={body => onChange({ body })}
        options={options.bodyOptions}
        isOpen={openKey === 'body-shape'}
        onToggle={() => setOpenKey(prev => (prev === 'body-shape' ? null : 'body-shape'))}
        selectedLabel={builder.BODY_OPTIONS[config.body]?.label ?? config.body}
      />
      <OptionGroup
        title="Bridge"
        description="Bridge style and tuning feel"
        variant="text"
        value={config.bridge}
        onChange={bridge => onChange({ bridge })}
        options={options.bridgeOptions}
        isOpen={openKey === 'bridge'}
        onToggle={() => setOpenKey(prev => (prev === 'bridge' ? null : 'bridge'))}
        selectedLabel={builder.BRIDGE_OPTIONS[config.bridge]?.label ?? config.bridge}
      />
      <OptionGroup
        title="Pickguard"
        description="Front plate style"
        value={config.pickguard}
        onChange={pickguard => onChange({ pickguard })}
        options={options.pickguardOptions}
        isOpen={openKey === 'pickguard'}
        onToggle={() => setOpenKey(prev => (prev === 'pickguard' ? null : 'pickguard'))}
        selectedLabel={builder.PICKGUARD_OPTIONS_BY_BODY[config.body]?.[config.pickguard]?.label ?? config.pickguard}
      />
    </>
  )
}
