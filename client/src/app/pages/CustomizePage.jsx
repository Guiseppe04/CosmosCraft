import { useMemo, useState } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import useGuitarConfig from '../hooks/useGuitarConfig.js'
import GuitarPreview from '../components/guitar/GuitarPreview.jsx'
import OptionsPanel from '../components/options/OptionsPanel.jsx'
import BodyMaterialsPanel from '../components/options/BodyMaterialsPanel.jsx'
import SummaryCard from '../components/ui/SummaryCard.jsx'

export function CustomizePage() {
  const { config, updateConfig, resetConfig, price, summary, exportConfig, loadConfig, builder, options } =
    useGuitarConfig()
  const [view, setView] = useState('front')
  const { isAuthenticated, openLogin } = useAuth()
  const { addToCart, setIsOpen: setCartOpen } = useCart()

  const summaryRows = useMemo(
    () => [
      ['Body', summary.body],
      ['Wood', summary.bodyWood],
      ['Finish', summary.bodyFinish],
      ['Neck', summary.neck],
      ['Fretboard', summary.fretboard],
      ['Bridge', summary.bridge],
      ['Hardware', summary.hardware],
      ['Pickups', summary.pickups],
    ],
    [summary],
  )

  const saveBuild = () => {
    const build = {
      id: `build-${Date.now()}`,
      name: `${summary.body} build`,
      price,
      config,
      savedAt: new Date().toISOString(),
    }

    const stored = JSON.parse(window.localStorage.getItem('cosmoscraft_saved_builds') || '[]')
    stored.unshift(build)
    window.localStorage.setItem('cosmoscraft_saved_builds', JSON.stringify(stored.slice(0, 20)))
  }

  const handleSave = () => {
    if (!isAuthenticated) {
      openLogin(saveBuild)
      return
    }
    saveBuild()
  }

  const handleAddToCart = () => {
    const addBuildToCart = () => {
      addToCart({
        id: `custom-build-${Date.now()}`,
        name: `Custom ${summary.body} Guitar`,
        price,
        quantity: 1,
        image: config.body,
        metadata: config,
      })
      setCartOpen(true)
    }

    if (!isAuthenticated) {
      openLogin(addBuildToCart)
      return
    }

    addBuildToCart()
  }

  const handleExport = () => {
    const data = exportConfig()
    const blob = new Blob([data], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'cosmoscraft-builder-config.json'
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const handleLoad = () => {
    const raw = window.prompt('Paste a saved builder JSON configuration')
    if (!raw) return
    try {
      loadConfig(JSON.parse(raw))
    } catch {
      window.alert('Invalid JSON configuration')
    }
  }

  const handleChange = patch => updateConfig(patch)

  return (
    <div className="h-screen overflow-hidden bg-[#111111] pt-16 text-white">
      <div className="mx-auto flex h-full max-w-[1900px] flex-col px-3 pb-3 sm:px-4 lg:px-5 lg:pb-5">

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[360px_minmax(0,1fr)_400px]">
          <aside className="min-h-0">
            <OptionsPanel
              config={config}
              builder={builder}
              options={options}
              onChange={handleChange}
              onSave={handleSave}
              onReset={resetConfig}
              onExport={handleExport}
              onLoad={handleLoad}
            />
          </aside>

          <main className="min-h-0 border-l border-white/10 bg-[#111111]">
            <div className="mx-auto flex h-full max-w-[1180px] flex-col px-3 py-3 sm:px-4 lg:px-6">
              <SummaryCard price={price} rows={summaryRows} onAddToCart={handleAddToCart} />
              <div className="mt-3 flex min-h-0 flex-1 items-center">
                <GuitarPreview config={config} view={view} onViewChange={setView} />
              </div>

             

              <p className="mt-3 text-center text-[11px] uppercase tracking-[0.18em] text-white/45">
                Graphic representation only. Actual product may differ.
              </p>
            </div>
          </main>

          <aside className="min-h-0 border-l border-white/10 bg-[#111111]">
            <BodyMaterialsPanel config={config} builder={builder} options={options} onChange={handleChange} />
          </aside>
        </div>
      </div>
    </div>
  )
}

export default CustomizePage
