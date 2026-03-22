import OptionGroup from './OptionGroup.jsx'

export default function NeckOptions({
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
        Neck Options
      </div>
      <OptionGroup
        title="Neck"
        description="Neck profile and finish"
        variant="text"
        value={config.neck}
        onChange={neck => onChange({ neck })}
        options={options.neckOptions}
        isOpen={openKey === 'neck'}
        onToggle={() => setOpenKey(prev => (prev === 'neck' ? null : 'neck'))}
        selectedLabel={builder.NECK_OPTIONS[config.neck]?.label ?? config.neck}
      />
      <OptionGroup
        title="Fretboard"
        description="Fingerboard wood"
        variant="text"
        value={config.fretboard}
        onChange={fretboard => onChange({ fretboard })}
        options={options.fretboardOptions}
        isOpen={openKey === 'fretboard'}
        onToggle={() => setOpenKey(prev => (prev === 'fretboard' ? null : 'fretboard'))}
        selectedLabel={builder.FRETBOARD_OPTIONS[config.fretboard]?.label ?? config.fretboard}
      />
      <OptionGroup
        title="Headstock"
        description="Headstock shape"
        variant="text"
        value={config.headstock}
        onChange={headstock => onChange({ headstock })}
        options={options.headstockOptions}
        isOpen={openKey === 'headstock'}
        onToggle={() => setOpenKey(prev => (prev === 'headstock' ? null : 'headstock'))}
        selectedLabel={builder.HEADSTOCK_OPTIONS[config.headstock]?.label ?? config.headstock}
      />
      <OptionGroup
        title="Headstock Wood"
        description="Wood grain under the logo"
        value={config.headstockWood}
        onChange={headstockWood => onChange({ headstockWood })}
        options={options.headstockWoodOptions}
        isOpen={openKey === 'headstockWood'}
        onToggle={() => setOpenKey(prev => (prev === 'headstockWood' ? null : 'headstockWood'))}
        selectedLabel={builder.HEADSTOCK_WOOD_OPTIONS[config.headstockWood]?.label ?? config.headstockWood}
      />
      <OptionGroup
        title="Inlays"
        description="Fretboard marker style"
        value={config.inlays}
        onChange={inlays => onChange({ inlays })}
        options={options.inlayOptions}
        isOpen={openKey === 'inlays'}
        onToggle={() => setOpenKey(prev => (prev === 'inlays' ? null : 'inlays'))}
        selectedLabel={builder.INLAY_OPTIONS[config.inlays]?.label ?? config.inlays}
      />
    </>
  )
}
