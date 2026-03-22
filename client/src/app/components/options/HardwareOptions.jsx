import OptionGroup from './OptionGroup.jsx'

export default function HardwareOptions({
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
        Hardware Options
      </div>
      <OptionGroup
        title="Hardware Color"
        description="Finish color"
        variant="text"
        value={config.hardware}
        onChange={hardware => onChange({ hardware })}
        options={options.hardwareOptions}
        isOpen={openKey === 'hardware'}
        onToggle={() => setOpenKey(prev => (prev === 'hardware' ? null : 'hardware'))}
        selectedLabel={builder.HARDWARE_OPTIONS[config.hardware]?.label ?? config.hardware}
      />
      <OptionGroup
        title="Knobs"
        description="Control knob style"
        value={config.knobs}
        onChange={knobs => onChange({ knobs })}
        options={options.knobOptions}
        isOpen={openKey === 'knobs'}
        onToggle={() => setOpenKey(prev => (prev === 'knobs' ? null : 'knobs'))}
        selectedLabel={builder.KNOB_OPTIONS_BY_BODY[config.body]?.[config.knobs]?.label ?? config.knobs}
      />
    </>
  )
}
