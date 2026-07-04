import { useMemo, useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useSearchParams, useNavigate } from 'react-router'
import { 
  RotateCcw, Save, ChevronDown, ChevronRight, Info, 
  ShoppingCart, Clock, Truck, Shield, Check, CheckCircle,
  Sparkles, Layers, Palette, Cog, Zap
} from 'lucide-react'
import { formatCurrency, toPHP } from '../utils/formatCurrency'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import useBassConfig from '../hooks/useBassConfig.js'
import BassPreview from '../components/bass/BassPreview.jsx'

const CATEGORIES = [
  { 
    id: 'body', 
    label: 'Body', 
    icon: Layers, 
    color: '#d4af37',
    tooltip: 'The body shape determines the bass guitar\'s tonal characteristics and playability.'
  },
  { 
    id: 'neck', 
    label: 'Neck & Headstock', 
    icon: Palette, 
    color: '#6366f1',
    tooltip: 'The neck profile affects how the bass feels in your hand.'
  },
  { 
    id: 'hardware', 
    label: 'Hardware', 
    icon: Cog, 
    color: '#8b5cf6',
    tooltip: 'Hardware includes bridges, tuners, and control knobs.'
  },
  { 
    id: 'electronics', 
    label: 'Electronics', 
    icon: Zap, 
    color: '#14b8a6',
    tooltip: 'Pickups convert string vibration into electrical signals.'
  },
]

function Tooltip({ content, children }) {
  return (
    <div className="group relative inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200">
        <div className="bg-theme-surface-deep border border-white/10 rounded-lg px-3 py-2 text-xs text-white/90 whitespace-nowrap shadow-xl shadow-black/50 max-w-xs">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--surface-elevated)]" />
        </div>
      </div>
    </div>
  )
}

function ConfigRow({ label, value, price }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/50">{label}</span>
      <span className="text-xs font-medium">
        {value}
        {price > 0 && (
          <span className="ml-2 text-[var(--gold-primary)]">+{formatCurrency(price)}</span>
        )}
      </span>
    </div>
  )
}

function AnimatedPrice({ price }) {
  const displayPrice = useMemo(() => {
    const phpPrice = toPHP(price, false)
    return phpPrice.toLocaleString('en-PH')
  }, [price])
  
  return (
    <div className="relative">
      <span 
        className={`text-5xl font-bold tracking-tight transition-all duration-300 ${
          price > 0 ? 'text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] via-[#f4d03f] to-[#d4af37]' : 'text-white/30'
        }`}
      >
        ₱{displayPrice}
      </span>
    </div>
  )
}

function OptionButton({ option, isSelected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full rounded-xl border p-3.5 text-left transition-all duration-200 ${
        isSelected
          ? 'border-[#d4af37] bg-gradient-to-br from-[#d4af37]/20 to-[#d4af37]/5 shadow-lg shadow-[#d4af37]/10'
          : 'border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--gold-primary)] hover:bg-[var(--surface-dark)]'
      }`}
    >
      {isSelected && (
        <div className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-bl-lg rounded-tr-xl bg-[#d4af37]">
          <Check className="h-3 w-3 text-black" />
        </div>
      )}
      
      <div className="space-y-1">
        <div className={`text-sm font-semibold transition-colors duration-200 ${
          isSelected ? 'text-[var(--text-light)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-light)]'
        }`}>
          {option.label}
        </div>
        {option.note && (
          <div className="text-xs text-white/40 line-clamp-1">
            {option.note}
          </div>
        )}
        {option.price > 0 && (
          <div className={`text-xs font-semibold ${
            isSelected ? 'text-[#d4af37]' : 'text-[#d4af37]/70'
          }`}>
            +₱{option.price.toLocaleString('en-PH')}
          </div>
        )}
      </div>
    </button>
  )
}

function VisualCard({ option, isSelected, onClick, previewImage }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${
        isSelected
          ? 'border-[#d4af37] shadow-lg shadow-[#d4af37]/20 ring-2 ring-[#d4af37]/30'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      <div className="relative h-16 w-full overflow-hidden">
        {previewImage ? (
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url(${previewImage})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5" />
        )}
        
        {isSelected && (
          <div className="absolute inset-0 bg-[#d4af37]/20" />
        )}
        
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      
      <div className={`p-2.5 transition-colors duration-200 ${
        isSelected ? 'bg-[#d4af37]/10' : 'bg-[#151515]'
      }`}>
        <div className={`text-xs font-semibold transition-colors duration-200 ${
          isSelected ? 'text-white' : 'text-white/80'
        }`}>
          {option.label}
        </div>
        {option.price > 0 && (
          <div className={`text-[10px] font-medium ${
            isSelected ? 'text-[#d4af37]' : 'text-[#d4af37]/70'
          }`}>
            +₱{option.price.toLocaleString('en-PH')}
          </div>
        )}
      </div>
      
      {isSelected && (
        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#d4af37] shadow-lg">
          <Check className="h-2.5 w-2.5 text-black" />
        </div>
      )}
    </button>
  )
}

export function BassCustomizePage() {
  const [searchParams] = useSearchParams()
  const editBuildId = searchParams.get('edit')
  const navigate = useNavigate()

<<<<<<< Updated upstream
  const { config, updateConfig, resetConfig, price, summary, exportConfig, loadConfig, builder, options } =
    useBassConfig()
=======
  const {
    config,
    updateConfig: baseUpdateConfig,
    resetConfig: baseResetConfig,
    price,
    summary,
    pricingBreakdown,
    exportConfig,
    loadConfig: baseLoadConfig,
    builder,
    options,
    refreshPrices,
  } = useBassConfig()
>>>>>>> Stashed changes
  const [view, setView] = useState('front')
  const [activeCategory, setActiveCategory] = useState('body')
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [bassTypeDropdownOpen, setBassTypeDropdownOpen] = useState(false)
  const categoryDropdownRef = useRef(null)
  const { isAuthenticated, openLogin } = useAuth()
  const { addToCart, setIsOpen: setCartOpen } = useCart()
<<<<<<< Updated upstream
=======
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(Boolean(editBuildId))
  const bypassNavigationBlockRef = useRef(false)
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const suppressDirtyTrackingRef = useRef(false)
  const [stickers, setStickers] = useState([])
  const [selectedStickerId, setSelectedStickerId] = useState(null)
  const [isDraggingSticker, setIsDraggingSticker] = useState(false)
  const [isStickerPanelOpen, setIsStickerPanelOpen] = useState(true)
  const stickerFileInputRef = useRef(null)
  const stickersRef = useRef([])
  const panStartRef = useRef({ pointerX: 0, pointerY: 0, originX: 0, originY: 0 })
  const previewViewportRef = useRef(null)
  const previewStageRef = useRef(null)
  const stickersInitializedRef = useRef(false)

  const updateConfig = (patch) => {
    if (editBuildId && !suppressDirtyTrackingRef.current) {
      setHasUnsavedChanges(true)
    }
    baseUpdateConfig(patch)
  }

  const resetConfig = () => {
    if (editBuildId && !suppressDirtyTrackingRef.current) {
      setHasUnsavedChanges(true)
    }
    baseResetConfig()
  }

  const loadConfig = (raw) => {
    if (editBuildId && !suppressDirtyTrackingRef.current) {
      setHasUnsavedChanges(true)
    }
    baseLoadConfig(raw)
  }

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(2, Number((prev + 0.1).toFixed(2))))
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(0.7, Number((prev - 0.1).toFixed(2))))
  const handleZoomReset = () => {
    setZoomLevel(1)
    setPanOffset({ x: 0, y: 0 })
  }
>>>>>>> Stashed changes

  useEffect(() => {
    function handleClickOutside(event) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setCategoryDropdownOpen(false)
        setBassTypeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (editBuildId) {
      for (const storageKey of ['cosmoscraft_saved_bass_builds', 'cosmoscraft_saved_builds']) {
        const builds = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
        const target = builds.find(b => b.id === editBuildId)
        if (target) {
          try {
            loadConfig(target.config)
          } catch (e) {
            console.error('Failed to load build config for editing:', e)
          }
          break
        }
      }
    }
  }, [editBuildId, loadConfig])

  const pickguardOptions = useMemo(() => {
    if (!options.pickguardOptions) return []
    return options.pickguardOptions
  }, [options.pickguardOptions, config.bassType])

  const knobOptions = useMemo(() => {
    if (!options.knobOptions) return []
    return options.knobOptions
  }, [options.knobOptions, config.bassType])

  const [toastMessage, setToastMessage] = useState(null)

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  const saveBuild = (shouldNavigate = true) => {
    const buildId = editBuildId || `build-${Date.now()}`
    const build = {
      id: buildId,
      name: `${summary.body} build`,
      price,
      config,
      summary,
      savedAt: new Date().toISOString(),
    }

    let storedKey = 'cosmoscraft_saved_bass_builds'
    let stored = JSON.parse(window.localStorage.getItem(storedKey) || '[]')
    
    let existingIndex = stored.findIndex(b => b.id === buildId)
    if (existingIndex === -1 && window.localStorage.getItem('cosmoscraft_saved_builds')) {
      const normStored = JSON.parse(window.localStorage.getItem('cosmoscraft_saved_builds'))
      const normIndex = normStored.findIndex(b => b.id === buildId)
      if (normIndex !== -1) {
        storedKey = 'cosmoscraft_saved_builds'
        stored = normStored
        existingIndex = normIndex
      }
    }

    if (existingIndex !== -1) {
      stored[existingIndex] = { ...stored[existingIndex], ...build }
    } else {
      stored.unshift(build)
    }

    if (stored.length > 20) stored = stored.slice(0, 20)
    window.localStorage.setItem(storedKey, JSON.stringify(stored))
    
    if (shouldNavigate) {
      navigate('/dashboard', { state: { section: 'guitar', message: 'Build saved to My Guitar!' } })
    } else {
      setToastMessage('Your Build is saved to My Guitar!')
    }
  }

  const handleSave = () => {
    if (!isAuthenticated) {
      openLogin(() => saveBuild(true))
      return
    }
    saveBuild(true)
  }

  const handleAddToCart = () => {
    const saveAndToast = () => saveBuild(false)

    if (!isAuthenticated) {
      openLogin(saveAndToast)
      return
    }

    saveAndToast()
  }

  const [savedBuilds, setSavedBuilds] = useState([])
  const [showLoadModal, setShowLoadModal] = useState(false)

  useEffect(() => {
    // Load saved builds from localStorage
    const stored = JSON.parse(window.localStorage.getItem('cosmoscraft_saved_bass_builds') || '[]')
    setSavedBuilds(stored)
  }, [])

  const handleSaveImage = () => {
    if (!isAuthenticated) {
      openLogin(() => {
        window.alert('Please log in to save your bass design as an image.')
      })
      return
    }

    window.alert('Image save feature coming soon! Your build configuration is automatically saved.')
  }

  const handleLoadBuild = (buildId) => {
    const build = savedBuilds.find(b => b.id === buildId)
    if (build) {
      loadConfig(build.config)
      setShowLoadModal(false)
    }
  }

  const handleDeleteBuild = (buildId) => {
    const updated = savedBuilds.filter(b => b.id !== buildId)
    setSavedBuilds(updated)
    window.localStorage.setItem('cosmoscraft_saved_bass_builds', JSON.stringify(updated))
  }

  const handleExportConfig = () => {
    const data = exportConfig()
    const blob = new Blob([data], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cosmoscraft-bass-${config.bassType}-${Date.now()}.json`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const handleImportConfig = () => {
    const raw = window.prompt('Paste your saved builder JSON configuration')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      loadConfig(parsed)
      window.alert('Configuration loaded successfully!')
    } catch {
      window.alert('Invalid JSON configuration. Please check and try again.')
    }
  }

  const getCategoryInfo = () => {
    const category = CATEGORIES.find(c => c.id === activeCategory)
    return category
  }

  return (
    <div className="h-screen overflow-hidden bg-[var(--bg-primary)] pt-16 text-[var(--text-light)] relative">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 z-[100] bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] px-6 py-3 rounded-xl font-bold shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mx-auto flex h-full max-w-[2000px] flex-col px-3 pb-3 sm:px-4 lg:px-6 lg:pb-6">
        
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)_400px]">
          
{/* LEFT PANEL - Configuration Categories */}
<aside className="min-h-0 rounded-2xl border border-white/10 bg-[var(--bg-primary)] overflow-hidden flex flex-col">
            <div className="border-b border-white/10 px-4 py-4">
              <h2 className="text-lg font-semibold tracking-tight">Build Your Bass</h2>
              <p className="mt-1 text-xs text-white/50">Select a category to customize</p>
            </div>
            
            <div className="p-3 flex-shrink-0" ref={categoryDropdownRef}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 border border-[var(--border)] bg-[var(--surface-elevated)]"
                >
                  <div 
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ 
                      backgroundColor: CATEGORIES.find(c => c.id === activeCategory)?.color + '20',
                    }}
                  >
                    {(() => {
                      const CatIcon = CATEGORIES.find(c => c.id === activeCategory)?.icon
                      return CatIcon ? <CatIcon className="h-4 w-4" style={{ color: CATEGORIES.find(c => c.id === activeCategory)?.color }} /> : null
                    })()}
                  </div>
                  <span className="text-sm font-medium text-[var(--text-light)] flex-1">
                    {CATEGORIES.find(c => c.id === activeCategory)?.label}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-[var(--text-muted)] transition-transform duration-200 ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {categoryDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-[var(--border)] rounded-xl bg-[var(--surface-elevated)] shadow-lg overflow-hidden">
                    <div className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] border-b border-[var(--border)]">
                      Category
                    </div>
                    {CATEGORIES.map((category) => {
                      const Icon = category.icon
                      const isActive = activeCategory === category.id
                      
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => {
                            setActiveCategory(category.id)
                            setCategoryDropdownOpen(false)
                          }}
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-all duration-200 ${
                            isActive
                              ? 'bg-gradient-to-r from-[#d4af37]/20 border-l-2 border-[#d4af37]'
                              : 'hover:bg-[var(--surface-dark)] border-l-2 border-transparent'
                          }`}
                        >
                          <div 
                            className="flex h-9 w-9 items-center justify-center rounded-lg"
                            style={{ 
                              backgroundColor: isActive ? `${category.color}20` : 'var(--surface-dark)',
                            }}
                          >
                            <Icon className="h-4 w-4" style={{ color: isActive ? category.color : 'var(--text-muted)' }} />
                          </div>
                          <span className={`text-sm font-medium ${isActive ? 'text-[var(--text-light)]' : 'text-[var(--text-muted)]'}`}>
                            {category.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto border-t border-white/10">
              
              {/* BODY OPTIONS */}
              {activeCategory === 'body' && (
                <div className="p-4 space-y-5">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Bass Model</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.bodyOptions?.map((opt) => (
                        <VisualCard
                          key={opt.value}
                          option={opt}
                          isSelected={config.bassType === opt.value}
                          onClick={() => updateConfig({ bassType: opt.value })}
                          previewImage={opt.bodySrc}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Body Wood</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.bodyWoodOptions?.map((opt) => (
                        <VisualCard
                          key={opt.value}
                          option={opt}
                          isSelected={config.bodyWood === opt.value}
                          onClick={() => updateConfig({ bodyWood: opt.value })}
                          previewImage={opt.texture}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Body Finish</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.bodyFinishOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.bodyFinish === opt.value}
                          onClick={() => updateConfig({ bodyFinish: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickguard</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {pickguardOptions.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.pickguard === opt.value}
                          onClick={() => updateConfig({ pickguard: opt.value })}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Front Logo</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.logoOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.logo === opt.value}
                          onClick={() => updateConfig({ logo: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* NECK OPTIONS */}
              {activeCategory === 'neck' && (
                <div className="p-4 space-y-5">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Neck Wood</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.neckOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.neck === opt.value}
                          onClick={() => updateConfig({ neck: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Fretboard</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.fretboardOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.fretboard === opt.value}
                          onClick={() => updateConfig({ fretboard: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Headstock Wood</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.headstockWoodOptions?.map((opt) => (
                        <VisualCard
                          key={opt.value}
                          option={opt}
                          isSelected={config.headstockWood === opt.value}
                          onClick={() => updateConfig({ headstockWood: opt.value })}
                          previewImage={opt.texture}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Inlays</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.inlayOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.inlays === opt.value}
                          onClick={() => updateConfig({ inlays: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Headstock Style</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.headstockStyleOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.headstockStyle === opt.value}
                          onClick={() => updateConfig({ headstockStyle: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Neck Profile</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.neckStyleOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.neckStyle === opt.value}
                          onClick={() => updateConfig({ neckStyle: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* HARDWARE OPTIONS */}
              {activeCategory === 'hardware' && (
                <div className="p-4 space-y-5">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Hardware Color</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.hardwareOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.hardware === opt.value}
                          onClick={() => updateConfig({ hardware: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Bridge</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.bridgeOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.bridge === opt.value}
                          onClick={() => updateConfig({ bridge: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Control Knobs</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {knobOptions.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.knobs === opt.value}
                          onClick={() => updateConfig({ knobs: opt.value })}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Back Plate</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.backplateOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.backplate === opt.value}
                          onClick={() => updateConfig({ backplate: opt.value })}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Screws</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.pickupScrewOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.pickupScrews === opt.value}
                          onClick={() => updateConfig({ pickupScrews: opt.value })}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Control Plate</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.controlPlateOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.controlPlate === opt.value}
                          onClick={() => updateConfig({ controlPlate: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* ELECTRONICS OPTIONS */}
              {activeCategory === 'electronics' && (
                <div className="p-4 space-y-5">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Type</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.pickupOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.pickups === opt.value}
                          onClick={() => updateConfig({ pickups: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Style</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.pickupTypeStyleOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.pickupTypeStyle === opt.value}
                          onClick={() => updateConfig({ pickupTypeStyle: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Configuration</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.pickupConfigOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.pickupConfig === opt.value}
                          onClick={() => updateConfig({ pickupConfig: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">String Configuration</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.stringOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.strings === opt.value}
                          onClick={() => updateConfig({ strings: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#14b8a6]/10">
                        <Info className="h-4 w-4 text-[#14b8a6]" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-white/60">
                          About Bass Pickups
                        </h4>
                        <p className="mt-1 text-xs text-white/40 leading-relaxed">
                          <strong>Split:</strong> Noise-free modern pickup<br/>
                          <strong>Single:</strong> Classic vintage tone<br/>
                          <strong>Humbucker:</strong> Warm, high output<br/>
                          <strong>Active:</strong> Preamp equipped for more power
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="border-t border-white/10 p-4 space-y-2 flex-shrink-0">
              <button
                type="button"
                onClick={resetConfig}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-[var(--surface-dark)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-[var(--surface-dark)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <Save className="h-4 w-4" />
                Save Build
              </button>
              {savedBuilds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowLoadModal(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-[var(--surface-dark)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <ChevronRight className="h-4 w-4" />
                  Load Build ({savedBuilds.length})
                </button>
              )}
            </div>
          </aside>

          {/* CENTER - Bass Preview */}
          <main className="min-h-0 flex flex-col">
<<<<<<< Updated upstream
            <div className="mb-4 rounded-2xl border border-white/10 bg-theme-surface-deep p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Your Build Total</p>
                  <AnimatedPrice price={price} />
                  <p className="mt-1 text-xs text-white/30">Base price: ₱{(89999).toLocaleString('en-PH')}</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#f4d03f] to-[#d4af37] px-8 py-3.5 text-sm font-bold text-black shadow-lg shadow-[#d4af37]/30 transition-all duration-300 hover:shadow-xl hover:shadow-[#d4af37]/40 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Add to Cart
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#f4d03f] to-[#d4af37] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </button>
                </div>
              </div>
              
              <div className="mt-4 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/60">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Build time: 4-6 weeks</span>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/60">
                  <Truck className="h-3.5 w-3.5" />
                  <span>Free worldwide shipping</span>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/60">
                  <Shield className="h-3.5 w-3.5" />
                  <span>2-year warranty</span>
                </div>
              </div>
            </div>
            
            <div className="relative flex-1 rounded-2xl border border-white/10 bg-gradient-to-b from-[#141414] via-[#0d0d0d] to-[#080808] overflow-hidden">
=======
            <div ref={previewRef} className="relative flex-1 rounded-2xl border border-white/10 bg-gradient-to-b from-[#141414] via-[#0d0d0d] to-[#080808] overflow-hidden">
>>>>>>> Stashed changes
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-radial from-[#d4af37]/10 via-transparent to-transparent opacity-60" />
                <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-gradient-radial from-white/5 via-transparent to-transparent rounded-full" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[200px] bg-gradient-to-t from-[#d4af37]/5 via-transparent to-transparent" />
              </div>
              
              <div className="relative h-full flex items-center justify-center p-6">
                <div className="w-full max-w-[1100px]">
                  <BassPreview config={config} view={view} onViewChange={setView} />
                </div>
              </div>
              
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-gradient-to-b from-transparent to-black/40 blur-xl" />
              
              <div className="absolute bottom-4 left-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setView('front')}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                    view === 'front'
                      ? 'bg-[#d4af37] text-black'
                      : 'bg-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]'
                  }`}
                >
                  Front View
                </button>
                <button
                  type="button"
                  onClick={() => setView('rear')}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                    view === 'rear'
                      ? 'bg-[#d4af37] text-black'
                      : 'bg-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]'
                  }`}
                >
                  Rear View
                </button>
              </div>
<<<<<<< Updated upstream
=======

              <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg border border-white/10 bg-black/35 p-1.5 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 0.7}
                  className="rounded-md bg-[var(--border)] px-2.5 py-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-elevated)] disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Zoom out"
                  title="Zoom out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"
                  aria-label="Reset zoom"
                  title="Reset zoom"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 2}
                  className="rounded-md bg-[var(--border)] px-2.5 py-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-elevated)] disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Zoom in"
                  title="Zoom in"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </div>

              <div className="absolute top-4 right-2 sm:right-4 w-[calc(100%-1rem)] sm:w-[360px] sm:max-w-[calc(100%-2rem)] space-y-2 rounded-lg border border-white/10 bg-black/35 p-2 backdrop-blur-sm">
                <input
                  ref={stickerFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleStickerUpload}
                  className="hidden"
                />
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => stickerFileInputRef.current?.click()}
                    disabled={currentViewStickers.length >= MAX_STICKERS}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--border)] px-2.5 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Upload sticker image"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Add Sticker
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/70">{currentViewStickers.length}/{MAX_STICKERS} ({view})</span>
                    <button
                      type="button"
                      onClick={() => setIsStickerPanelOpen((open) => !open)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--surface-elevated)]"
                      title={isStickerPanelOpen ? 'Hide sticker panel' : 'Show sticker panel'}
                    >
                      <span className={`inline-flex transform ${isStickerPanelOpen ? '' : 'rotate-180'}`}>
                        <ChevronDown className="h-4 w-4" />
                      </span>
                    </button>
                  </div>
                </div>

                {isStickerPanelOpen && selectedSticker && (selectedSticker.side || 'front') === view && (
                  <div className="space-y-2 rounded-md border border-white/10 bg-black/25 p-2">
                    <div className="grid grid-cols-4 gap-1.5">
                      <button type="button" onClick={() => moveLayer('back')} className="rounded bg-[var(--border)] px-1.5 py-1 text-[10px] text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]">Back</button>
                      <button type="button" onClick={() => moveLayer('down')} className="rounded bg-[var(--border)] px-1.5 py-1 text-[10px] text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]">Down</button>
                      <button type="button" onClick={() => moveLayer('up')} className="rounded bg-[var(--border)] px-1.5 py-1 text-[10px] text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]">Up</button>
                      <button type="button" onClick={() => moveLayer('front')} className="rounded bg-[var(--border)] px-1.5 py-1 text-[10px] text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]">Front</button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateSelectedSticker((prev) => ({ ...prev, size: Math.max(6, prev.size - 2) }))}
                        className="rounded-md bg-[var(--border)] px-2 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]"
                        title="Shrink sticker"
                      >
                        -
                      </button>
                      <span className="text-[10px] text-white/70 min-w-10 text-center">{Math.round(selectedSticker.size)}%</span>
                      <button
                        type="button"
                        onClick={() => updateSelectedSticker((prev) => ({ ...prev, size: Math.min(50, prev.size + 2) }))}
                        className="rounded-md bg-[var(--border)] px-2 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]"
                        title="Enlarge sticker"
                      >
                        +
                      </button>

                      <button
                        type="button"
                        onClick={() => updateSelectedSticker((prev) => ({ ...prev, rotation: (prev.rotation - 15 + 360) % 360 }))}
                        className="rounded-md bg-[var(--border)] px-2 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]"
                        title="Rotate left"
                      >
                        -15°
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedSticker((prev) => ({ ...prev, rotation: (prev.rotation + 15) % 360 }))}
                        className="rounded-md bg-[var(--border)] px-2 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]"
                        title="Rotate right"
                      >
                        +15°
                      </button>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="359"
                      value={selectedSticker.rotation || 0}
                      onChange={(e) => updateSelectedSticker({ rotation: Number(e.target.value) })}
                      className="w-full accent-[#d4af37]"
                    />

                    <div className="flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={duplicateSelectedSticker}
                        disabled={currentViewStickers.length >= MAX_STICKERS}
                        className="rounded-md bg-[var(--border)] px-2 py-1.5 text-[10px] font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStickerById(selectedSticker.id)}
                        className="rounded-md bg-red-500/20 px-2 py-1.5 text-red-300 hover:bg-red-500/30"
                        title="Remove sticker"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {isStickerPanelOpen && currentViewStickers.length > 0 && (
                  <div className="max-h-24 overflow-y-auto space-y-1 rounded-md border border-white/10 bg-black/20 p-1.5">
                    {currentViewStickers.map((stickerItem, index) => (
                      <button
                        key={stickerItem.id}
                        type="button"
                        onClick={() => setSelectedStickerId(stickerItem.id)}
                        className={`w-full flex items-center gap-2 rounded px-1.5 py-1 text-left text-[10px] ${
                          selectedStickerId === stickerItem.id
                            ? 'bg-[#d4af37]/20 text-[#d4af37]'
                            : 'bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <img src={stickerItem.src} alt={`Sticker ${index + 1}`} className="h-5 w-5 rounded object-cover" />
                        <span>{view === 'front' ? 'Front' : 'Rear'} Sticker {index + 1}</span>
                        <span className="ml-auto">z:{index + 1}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
>>>>>>> Stashed changes
            </div>

            <div className="mt-4 px-4 sm:px-6">
              <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-4 shadow-[0_15px_60px_-40px_rgba(0,0,0,0.8)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-[11px] font-semibold text-white/70">
                      <span className={`h-2.5 w-2.5 rounded-full ${hasUnsavedChanges ? 'bg-amber-300' : 'bg-emerald-300'}`} />
                      {hasUnsavedChanges ? 'Unsaved changes' : 'Saved'}
                    </div>
                  </div>

                  <div className="grid w-full gap-3 sm:grid-cols-3 sm:w-auto">
                    <button
                      type="button"
                      onClick={resetConfig}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm font-medium text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--surface-dark)]"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm font-medium text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--surface-dark)]"
                    >
                      <Save className="h-4 w-4" />
                      Save Build
                    </button>
                    {savedBuilds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowLoadModal(true)}
                        className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm font-medium text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--surface-dark)]"
                      >
                        <ChevronRight className="h-4 w-4" />
                        Load Build ({savedBuilds.length})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

</main>

          {/* RIGHT PANEL - Summary & Actions */}
          <aside className="min-h-0 rounded-2xl border border-white/10 bg-[var(--bg-primary)] overflow-hidden flex flex-col">
            <div className="border-b border-white/10 px-5 py-4 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs text-[#d4af37]">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Currently Editing</span>
              </div>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">
                {getCategoryInfo()?.label || 'Select a Category'}
              </h2>
              <p className="mt-0.5 text-xs text-white/50">
                {getCategoryInfo()?.tooltip || 'Choose from the left panel'}
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-3">Your Configuration</h3>
                <div className="space-y-2.5">
                  <ConfigRow label="Body" value={summary.body} price={pricingBreakdown.body} />
                  <ConfigRow label="Body Wood" value={summary.bodyWood} price={pricingBreakdown.bodyWood} />
                  <ConfigRow label="Finish" value={summary.bodyFinish} price={pricingBreakdown.bodyFinish} />
                  <ConfigRow label="Neck" value={summary.neck} price={pricingBreakdown.neck} />
                  <ConfigRow label="Fretboard" value={summary.fretboard} price={pricingBreakdown.fretboard} />
                  <ConfigRow label="Headstock Wood" value={summary.headstockWood} price={pricingBreakdown.headstockWood} />
                  <ConfigRow label="Headstock Style" value={summary.headstockStyle} price={pricingBreakdown.headstockStyle} />
                  <ConfigRow label="Neck Style" value={summary.neckStyle} price={pricingBreakdown.neckStyle} />
                  <ConfigRow label="Inlays" value={summary.inlays} price={pricingBreakdown.inlays} />
                  <ConfigRow label="Logo" value={summary.logo} price={pricingBreakdown.logo} />
                  <ConfigRow label="Backplate" value={summary.backplate} price={pricingBreakdown.backplate} />
                  <ConfigRow label="Pickup Screws" value={summary.pickupScrews} price={pricingBreakdown.pickupScrews} />
                  <ConfigRow label="Control Plate" value={summary.controlPlate} price={pricingBreakdown.controlPlate} />
                  <ConfigRow label="Bridge" value={summary.bridge} price={pricingBreakdown.bridge} />
                  <ConfigRow label="Pickguard" value={summary.pickguard} price={pricingBreakdown.pickguard} />
                  <ConfigRow label="Knobs" value={summary.knobs} price={pricingBreakdown.knobs} />
                  <ConfigRow label="Hardware" value={summary.hardware} price={pricingBreakdown.hardware} />
                  <ConfigRow label="Pickups" value={summary.pickups} price={pricingBreakdown.pickups} />
                  <ConfigRow label="Pickup Style" value={summary.pickupTypeStyle} price={pricingBreakdown.pickupTypeStyle} />
                  <ConfigRow label="Pickup Config" value={summary.pickupConfig} price={pricingBreakdown.pickupConfig} />
                  <ConfigRow label="Strings" value={summary.strings} price={pricingBreakdown.strings} />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Your Build Total</p>
                <AnimatedPrice price={price} />
                <p className="mt-1 text-xs text-white/30">Base price: ₱{(options.basePrice ?? 0).toLocaleString('en-PH')}</p>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#f4d03f] to-[#d4af37] px-4 py-3 text-sm font-bold text-black shadow-lg shadow-[#d4af37]/30 transition-all duration-300 hover:shadow-xl hover:shadow-[#d4af37]/40"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to Cart
                </button>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#d4af37]/10">
                    <Info className="h-4 w-4 text-[#d4af37]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-white/60">
                      Need Help?
                    </h4>
                    <p className="mt-1 text-xs text-white/40 leading-relaxed">
                      Each option is carefully crafted to deliver premium quality. Hover over category names for more details, or contact our support team.
                    </p>
                  </div>
                </div>
              </div>
<<<<<<< Updated upstream
              
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
                    <Truck className="h-5 w-5 text-white/60" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">Free Worldwide Shipping</p>
                    <p className="text-[10px] text-white/40">On all custom builds</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
                    <Clock className="h-5 w-5 text-white/60" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">4-6 Week Build Time</p>
                    <p className="text-[10px] text-white/40">Handcrafted to order</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
                    <Shield className="h-5 w-5 text-white/60" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">2-Year Warranty</p>
                    <p className="text-[10px] text-white/40">Parts and labor</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border-t border-white/10 p-4 flex-shrink-0 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExportConfig}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium transition-all duration-200 hover:bg-[var(--surface-dark)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Export
                </button>
                <button
                  type="button"
                  onClick={handleImportConfig}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium transition-all duration-200 hover:bg-[var(--surface-dark)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Import
                </button>
              </div>
            </div>
=======

            </div>
            
>>>>>>> Stashed changes
          </aside>
        </div>
      </div>
      
      {/* Load Builds Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="relative max-w-2xl w-full max-h-[80vh] overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg-primary)] shadow-2xl flex flex-col">
            {/* Header */}
            <div className="border-b border-white/10 px-6 py-4 flex-shrink-0">
              <h3 className="text-lg font-semibold">Load Saved Build</h3>
              <p className="mt-1 text-xs text-white/50">Select a previous build to continue editing</p>
            </div>
            
            {/* Builds List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {savedBuilds.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-white/50">
                  <p>No saved builds yet. Create one using the Save Build button!</p>
                </div>
              ) : (
                savedBuilds.map((build) => (
                  <div
                    key={build.id}
                    className="group relative rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors duration-200 cursor-pointer"
                    onClick={() => handleLoadBuild(build.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{build.name}</h4>
                        <div className="mt-1 space-y-1 text-xs text-white/50">
                          <p>{build.config.bassType} / {build.config.bodyWood} / {build.config.pickups}</p>
                          <p>Created: {new Date(build.createdAt).toLocaleDateString('en-PH')}</p>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-[#d4af37]">
                          ₱{build.price.toLocaleString('en-PH')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteBuild(build.id)
                        }}
                        className="flex-shrink-0 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-medium text-red-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Footer */}
            <div className="border-t border-white/10 px-6 py-4 flex-shrink-0 flex gap-2">
              <button
                type="button"
                onClick={() => setShowLoadModal(false)}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-[var(--surface-dark)]"
                style={{ color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      <p className="mt-2 text-center text-[10px] uppercase tracking-[0.15em] text-white/30">
        Graphic representation only. Actual product may differ slightly due to natural wood variations.
      </p>
    </div>
  )
}

export default BassCustomizePage