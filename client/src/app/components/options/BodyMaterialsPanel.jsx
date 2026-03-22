import OptionGroup from './OptionGroup.jsx'

export default function BodyMaterialsPanel({ config, builder, options, onChange }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-lg font-semibold text-white">Body Wood</h2>
        <p className="mt-1 text-xs text-white/45">Available body woods from the model library</p>
      </div>
      <div className="h-full overflow-hidden px-3 py-3">
        <OptionGroup
          title="Body Wood"
          description="Wood grain and core material"
          value={config.bodyWood}
          onChange={bodyWood => onChange({ bodyWood })}
          options={options.bodyWoodOptions}
          chipShape="circle"
          surface="dark"
          selectedLabel={builder.BODY_WOOD_OPTIONS[config.bodyWood]?.label ?? config.bodyWood}
          isOpen
        />
        <div className="h-3" />
        <OptionGroup
          title="Solid Body Finishes"
          description="Finish colors available in the builder assets"
          value={config.bodyFinish}
          onChange={bodyFinish => onChange({ bodyFinish })}
          options={options.bodyFinishOptions}
          chipShape="circle"
          surface="dark"
          selectedLabel={builder.BODY_FINISH_OPTIONS[config.bodyFinish]?.label ?? config.bodyFinish}
          isOpen
        />
      </div>
    </div>
  )
}
