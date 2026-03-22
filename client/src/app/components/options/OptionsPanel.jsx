import { useState } from 'react'
import BodyOptions from './BodyOptions.jsx'
import NeckOptions from './NeckOptions.jsx'
import ElectronicsOptions from './ElectronicsOptions.jsx'
import HardwareOptions from './HardwareOptions.jsx'
import ExportOptions from './ExportOptions.jsx'

export default function OptionsPanel({ config, builder, options, onChange, onSave, onReset, onExport, onLoad }) {
  const [openKey, setOpenKey] = useState('body-shape')

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-white/10 bg-[#232323]">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-lg font-semibold text-white">General Options</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <BodyOptions config={config} builder={builder} options={options} openKey={openKey} setOpenKey={setOpenKey} onChange={onChange} />
          <NeckOptions config={config} builder={builder} options={options} openKey={openKey} setOpenKey={setOpenKey} onChange={onChange} />
          <ElectronicsOptions config={config} builder={builder} options={options} openKey={openKey} setOpenKey={setOpenKey} onChange={onChange} />
          <HardwareOptions config={config} builder={builder} options={options} openKey={openKey} setOpenKey={setOpenKey} onChange={onChange} />
          <ExportOptions onSave={onSave} onReset={onReset} onExport={onExport} onLoad={onLoad} />
          <div className="px-4 pb-4 pt-2 text-center text-xs text-white/50">
            <p>* All orders include a free soft case</p>
            <p className="mt-2">* No changes can be made after your order has been placed</p>
          </div>
        </div>
      </div>
    </div>
  )
}
