import { useMemo, useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useSearchParams, useNavigate, useBlocker } from 'react-router'
import { 
  RotateCcw, Save, ChevronDown, ChevronRight, Info, 
  ShoppingCart, Clock, Truck, Shield, Check, CheckCircle,
  Sparkles, Layers, Palette, Cog, Zap, Image, ZoomIn, ZoomOut
} from 'lucide-react'
import { exportMaskedPreview } from '../utils/exportMaskedPreview.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import useGuitarConfig from '../hooks/useGuitarConfig.js'
import GuitarPreview from '../components/guitar/GuitarPreview.jsx'

// Configuration categories with icons and tooltips
const CATEGORIES = [
  { 
    id: 'body', 
    label: 'Body', 
    icon: Layers, 
    color: '#d4af37',
    tooltip: 'The body shape determines the guitar\'s tonal characteristics and playability.'
  },
  { 
    id: 'neck', 
    label: 'Neck & Headstock', 
    icon: Palette, 
    color: '#6366f1',
    tooltip: 'The neck profile affects how the guitar feels in your hand.'
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

// Tooltip component for technical terms
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

// Animated price display
function AnimatedPrice({ price }) {
  const displayPrice = useMemo(() => {
    return price.toLocaleString('en-PH')
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

// Option button with premium styling
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
      {/* Selected indicator */}
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

// Visual card option for wood/material selection
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
      {/* Preview image/gradient */}
      <div className="relative h-16 w-full overflow-hidden">
        {previewImage ? (
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url(${previewImage})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5" />
        )}
        
        {/* Selected overlay */}
        {isSelected && (
          <div className="absolute inset-0 bg-[#d4af37]/20" />
        )}
        
        {/* Subtle shine effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      
      {/* Content */}
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
      
      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#d4af37] shadow-lg">
          <Check className="h-2.5 w-2.5 text-black" />
        </div>
      )}
    </button>
  )
}

export function CustomizePage() {
  const [searchParams] = useSearchParams()
  const editBuildId = searchParams.get('edit')
  
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
  } = useGuitarConfig()
  const navigate = useNavigate()
  const [view, setView] = useState('front')
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDraggingPreview, setIsDraggingPreview] = useState(false)
  const panStartRef = useRef({ pointerX: 0, pointerY: 0, originX: 0, originY: 0 })
  const previewViewportRef = useRef(null)
  const [activeCategory, setActiveCategory] = useState('body')
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [guitarTypeDropdownOpen, setGuitarTypeDropdownOpen] = useState(false)
  const categoryDropdownRef = useRef(null)
  const { isAuthenticated, openLogin } = useAuth()
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(Boolean(editBuildId))
  const bypassNavigationBlockRef = useRef(false)
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const suppressDirtyTrackingRef = useRef(false)

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

  const handleZoomIn = () => setZoomLevel(prev => Math.min(2, Number((prev + 0.1).toFixed(2))))
  const handleZoomOut = () => setZoomLevel(prev => Math.max(0.7, Number((prev - 0.1).toFixed(2))))
  const handleZoomReset = () => {
    setZoomLevel(1)
    setPanOffset({ x: 0, y: 0 })
  }

  const clampPan = (x, y, scale = zoomLevel) => {
    const viewport = previewViewportRef.current
    if (!viewport || scale <= 1) return { x: 0, y: 0 }
    const maxX = ((viewport.clientWidth * scale) - viewport.clientWidth) / 2
    const maxY = ((viewport.clientHeight * scale) - viewport.clientHeight) / 2
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    }
  }

  const beginDrag = (clientX, clientY) => {
    if (zoomLevel <= 1) return
    setIsDraggingPreview(true)
    panStartRef.current = {
      pointerX: clientX,
      pointerY: clientY,
      originX: panOffset.x,
      originY: panOffset.y,
    }
  }

  const updateDrag = (clientX, clientY) => {
    if (!isDraggingPreview) return
    const dx = clientX - panStartRef.current.pointerX
    const dy = clientY - panStartRef.current.pointerY
    const next = clampPan(panStartRef.current.originX + dx, panStartRef.current.originY + dy)
    setPanOffset(next)
  }

  const endDrag = () => setIsDraggingPreview(false)

  useEffect(() => {
    setPanOffset(prev => clampPan(prev.x, prev.y, zoomLevel))
  }, [zoomLevel])

  // Get guitar type from URL and sync with config
  const urlGuitarType = searchParams.get('type') || 'electric'
  
  // Sync config with URL parameter on mount
  useEffect(() => {
    if (config.guitarType !== urlGuitarType) {
      updateConfig({ guitarType: urlGuitarType })
    }
  }, [urlGuitarType])

  // Refresh prices when page becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && refreshPrices) {
        refreshPrices()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [refreshPrices])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setCategoryDropdownOpen(false)
        setGuitarTypeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load existing build if editBuildId is provided
  useEffect(() => {
    if (editBuildId) {
      for (const storageKey of ['cosmoscraft_saved_builds', 'cosmoscraft_saved_bass_builds']) {
        const builds = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
        const target = builds.find(b => b.id === editBuildId)
        if (target) {
          try {
            suppressDirtyTrackingRef.current = true
            baseLoadConfig(target.config)
          } catch (e) {
            console.error('Failed to load build config for editing:', e)
          } finally {
            suppressDirtyTrackingRef.current = false
          }
          break
        }
      }
    }
  }, [editBuildId, baseLoadConfig])

  const shouldBlockNavigation = Boolean(editBuildId) && hasUnsavedChanges && !bypassNavigationBlockRef.current
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      shouldBlockNavigation &&
      (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  )

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowUnsavedModal(true)
    }
  }, [blocker.state])

  useEffect(() => {
    if (!shouldBlockNavigation) return
    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [shouldBlockNavigation])

  const { addToCart, setIsOpen: setCartOpen } = useCart()

  // Get pickguard options for current body
  const pickguardOptions = useMemo(() => {
    if (!options.pickguardOptions) return []
    return options.pickguardOptions
  }, [options.pickguardOptions, config.body])

  // Get knob options for current body
  const knobOptions = useMemo(() => {
    if (!options.knobOptions) return []
    return options.knobOptions
  }, [options.knobOptions, config.body])

  const [toastMessage, setToastMessage] = useState(null)

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  const saveBuild = ({ shouldNavigate = true, continueBlockedNavigation = false } = {}) => {
    const buildId = editBuildId || `build-${Date.now()}`
    const build = {
      id: buildId,
      name: `${summary.body} build`,
      price,
      config,
      pricingBreakdown,
      summary,
      savedAt: new Date().toISOString(),
    }

    let storedKey = 'cosmoscraft_saved_builds'
    let stored = JSON.parse(window.localStorage.getItem(storedKey) || '[]')
    
    // Look in bass builds if not found in normal builds (for safety)
    let existingIndex = stored.findIndex(b => b.id === buildId)
    if (existingIndex === -1 && window.localStorage.getItem('cosmoscraft_saved_bass_builds')) {
      const bassStored = JSON.parse(window.localStorage.getItem('cosmoscraft_saved_bass_builds'))
      const bassIndex = bassStored.findIndex(b => b.id === buildId)
      if (bassIndex !== -1) {
        storedKey = 'cosmoscraft_saved_bass_builds'
        stored = bassStored
        existingIndex = bassIndex
      }
    }

    if (existingIndex !== -1) {
      // Preserve existing properties like additionalParts
      stored[existingIndex] = { ...stored[existingIndex], ...build }
    } else {
      stored.unshift(build)
    }

    if (stored.length > 20) stored = stored.slice(0, 20)
    window.localStorage.setItem(storedKey, JSON.stringify(stored))
    setHasUnsavedChanges(false)
    
    if (continueBlockedNavigation && blocker.state === 'blocked') {
      setShowUnsavedModal(false)
      bypassNavigationBlockRef.current = true
      blocker.proceed()
      setTimeout(() => { bypassNavigationBlockRef.current = false }, 0)
      return
    }

    if (shouldNavigate) {
      bypassNavigationBlockRef.current = true
      navigate('/dashboard', { state: { section: 'my-guitar', message: 'Build saved to My Guitar!' } })
      setTimeout(() => { bypassNavigationBlockRef.current = false }, 0)
    } else {
      setToastMessage('Your Build is saved to My Guitar!')
    }
  }

  const handleSave = () => {
    if (!isAuthenticated) {
      openLogin(() => saveBuild({ shouldNavigate: true }))
      return
    }
    saveBuild({ shouldNavigate: true })
  }

  const handleAddToCart = () => {
    const saveAndToast = () => saveBuild({ shouldNavigate: false })

    if (!isAuthenticated) {
      openLogin(saveAndToast)
      return
    }

    saveAndToast()
  }

  const handleSaveAndLeave = () => {
    if (!isAuthenticated) {
      openLogin(() => saveBuild({ shouldNavigate: false, continueBlockedNavigation: true }))
      return
    }
    saveBuild({ shouldNavigate: false, continueBlockedNavigation: true })
  }

  const handleStayOnPage = () => {
    setShowUnsavedModal(false)
    if (blocker.state === 'blocked') {
      blocker.reset()
    }
  }

  const handleConfirmLeave = () => {
    setShowUnsavedModal(false)
    if (blocker.state === 'blocked') {
      bypassNavigationBlockRef.current = true
      blocker.proceed()
      setTimeout(() => { bypassNavigationBlockRef.current = false }, 0)
    }
  }

  const previewRef = useRef(null)

  const handleSaveImage = async () => {
    if (!isAuthenticated) {
      openLogin(() => {
        setTimeout(() => handleSaveImage(), 100)
      })
      return
    }

    if (!previewRef.current) {
      console.error('Preview ref not found')
      return
    }

    try {
      await exportMaskedPreview(previewRef.current, {
        background: '#141414',
        scale: 2,
        fileName: `custom-guitar-${config.guitarType}-${Date.now()}.png`,
      })
    } catch (error) {
      console.error('Failed to save image:', error)
      window.alert('Failed to save image. Please try again.')
    }
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

  // Get current category info
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
        
        {/* Main layout: Left panel - Center guitar - Right panel */}
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)_400px]">
          
{/* LEFT PANEL - Configuration Categories */}
<aside className="min-h-0 rounded-2xl border border-white/10 bg-[var(--bg-primary)] overflow-hidden flex flex-col">
            <div className="border-b border-white/10 px-4 py-4">
              <h2 className="text-lg font-semibold tracking-tight">Build Your Guitar</h2>
              <p className="mt-1 text-xs text-white/50">Select a category to customize</p>
            </div>
            
            {/* Combined dropdown - Guitar Type + Categories */}
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
                
                {/* Dropdown menu */}
                {categoryDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-[var(--border)] rounded-xl bg-[var(--surface-elevated)] shadow-lg overflow-hidden">
                    {/* Categories Section */}
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
            
            {/* Category-specific options */}
            <div className="flex-1 overflow-y-auto border-t border-white/10">
              
              {/* BODY OPTIONS */}
              {activeCategory === 'body' && (
                <div className="p-4 space-y-5">
                  {/* Body Shape */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Body Shape</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.bodyOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.body === opt.value}
                          onClick={() => updateConfig({ body: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Body Wood */}
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
                  
                  {/* Body Finish */}
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
                  
                  {/* Pickguard */}
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
                </div>
              )}
              
              {/* NECK OPTIONS */}
              {activeCategory === 'neck' && (
                <div className="p-4 space-y-5">
                  {/* Neck */}
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
                  
                  {/* Fretboard */}
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
                  
                  {/* Headstock */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Headstock</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.headstockOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.headstock === opt.value}
                          onClick={() => updateConfig({ headstock: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Headstock Wood */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Headstock Wood</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.headstockWoodOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.headstockWood === opt.value}
                          onClick={() => updateConfig({ headstockWood: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Inlays */}
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
                </div>
              )}
              
              {/* HARDWARE OPTIONS */}
              {activeCategory === 'hardware' && (
                <div className="p-4 space-y-5">
                  {/* Hardware Color */}
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
                  
                  {/* Bridge */}
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
                  
                  {/* Knobs */}
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
                </div>
              )}
              
              {/* ELECTRONICS OPTIONS */}
              {activeCategory === 'electronics' && (
                <div className="p-4 space-y-5">
                  {/* Pickups */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Configuration</h3>
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
                  
                  {/* Pickup Info */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#14b8a6]/10">
                        <Info className="h-4 w-4 text-[#14b8a6]" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-white/60">
                          About Pickups
                        </h4>
                        <p className="mt-1 text-xs text-white/40 leading-relaxed">
                          <strong>SSS:</strong> Three single coils - bright, classic tone<br/>
                          <strong>HSS:</strong> Bridge humbucker + singles - versatile<br/>
                          <strong>HH:</strong> Dual humbuckers - warm, high output<br/>
                          <strong>P90:</strong> Vintage soapbar style - gritty, expressive<br/>
                          <strong>Fluence:</strong> Modern active pickups - clean, powerful
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Quick actions */}
            <div className="border-t border-white/10 p-4 space-y-2 flex-shrink-0">
              <button
                type="button"
                onClick={resetConfig}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-[var(--surface-dark)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <RotateCcw className="h-4 w-4" />
                Reset Configuration
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
              <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1 text-[11px] font-semibold ${
                hasUnsavedChanges
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${hasUnsavedChanges ? 'bg-amber-300' : 'bg-emerald-300'}`} />
                {hasUnsavedChanges ? 'Unsaved changes' : 'Saved'}
              </div>
            </div>
          </aside>

          {/* CENTER - Guitar Preview */}
          <main className="min-h-0 flex flex-col">
            {/* Price & CTA Header */}
            <div className="mb-4 rounded-2xl border border-white/10 bg-theme-surface-deep p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Your Build Total</p>
                  <AnimatedPrice price={price} />
                  <p className="mt-1 text-xs text-white/30">Base price: ₱{(options.basePrice ?? 0).toLocaleString('en-PH')}</p>
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
              
              {/* Build info badges */}
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
            
            {/* Guitar Preview */}
            <div ref={previewRef} className="relative flex-1 rounded-2xl border border-white/10 bg-gradient-to-b from-[#141414] via-[#0d0d0d] to-[#080808] overflow-hidden">
              {/* Spotlight effects */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-radial from-[#d4af37]/10 via-transparent to-transparent opacity-60" />
                <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-gradient-radial from-white/5 via-transparent to-transparent rounded-full" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[200px] bg-gradient-to-t from-[#d4af37]/5 via-transparent to-transparent" />
              </div>
              
              {/* Guitar container */}
              <div
                ref={previewViewportRef}
                className={`relative h-full flex items-center justify-center p-6 ${zoomLevel > 1 ? 'cursor-grab' : 'cursor-default'} ${isDraggingPreview ? 'cursor-grabbing' : ''}`}
                onMouseDown={(e) => beginDrag(e.clientX, e.clientY)}
                onMouseMove={(e) => updateDrag(e.clientX, e.clientY)}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
                onTouchStart={(e) => {
                  const touch = e.touches[0]
                  if (!touch) return
                  beginDrag(touch.clientX, touch.clientY)
                }}
                onTouchMove={(e) => {
                  const touch = e.touches[0]
                  if (!touch) return
                  updateDrag(touch.clientX, touch.clientY)
                }}
                onTouchEnd={endDrag}
              >
                <div
                  className="w-full max-w-[1100px] transition-transform duration-200 ease-out"
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    willChange: 'transform',
                  }}
                >
                  <GuitarPreview config={config} view={view} onViewChange={setView} />
                </div>
              </div>
              
              {/* Subtle reflection/shadow beneath guitar */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-gradient-to-b from-transparent to-black/40 blur-xl" />
              
              {/* View toggle */}
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

              {/* Zoom controls */}
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
            </div>
            
            {/* Guitar specs footer */}
            <div className="mt-4 rounded-xl border border-white/10 bg-theme-surface-deep p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">Body</p>
                  <p className="mt-0.5 text-sm font-medium">{summary.body}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">Pickups</p>
                  <p className="mt-0.5 text-sm font-medium">{summary.pickups}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">Neck</p>
                  <p className="mt-0.5 text-sm font-medium">{summary.neck}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">Hardware</p>
                  <p className="mt-0.5 text-sm font-medium">{summary.hardware}</p>
                </div>
              </div>
            </div>
          </main>

          {/* RIGHT PANEL - Summary & Actions */}
          <aside className="min-h-0 rounded-2xl border border-white/10 bg-[var(--bg-primary)] overflow-hidden flex flex-col">
            {/* Header with current editing label */}
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
            
            {/* Current selection summary */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* Quick Summary */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-3">Your Configuration</h3>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Body</span>
                    <span className="text-xs font-medium">{summary.body}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Body Wood</span>
                    <span className="text-xs font-medium">{summary.bodyWood}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Finish</span>
                    <span className="text-xs font-medium">{summary.bodyFinish}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Neck</span>
                    <span className="text-xs font-medium">{summary.neck}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Fretboard</span>
                    <span className="text-xs font-medium">{summary.fretboard}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Headstock</span>
                    <span className="text-xs font-medium">{builder.HEADSTOCK_OPTIONS[config.headstock]?.label || config.headstock}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Bridge</span>
                    <span className="text-xs font-medium">{builder.BRIDGE_OPTIONS[config.bridge]?.label || config.bridge}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Pickups</span>
                    <span className="text-xs font-medium">{summary.pickups}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Hardware</span>
                    <span className="text-xs font-medium">{summary.hardware}</span>
                  </div>
                </div>
              </div>
              
              {/* Help section */}
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
              
              {/* Shipping info */}
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
            
            {/* Save Image / Load Config */}
            <div className="border-t border-white/10 p-4 flex-shrink-0">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveImage}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium transition-all duration-200 hover:bg-[var(--surface-dark)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Image className="h-3.5 w-3.5" />
                  Save Image
                </button>
                <button
                  type="button"
                  onClick={handleLoad}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium transition-all duration-200 hover:bg-[var(--surface-dark)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Load Config
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
      
      {/* Disclaimer */}
      <p className="mt-2 text-center text-[10px] uppercase tracking-[0.15em] text-white/30">
        Graphic representation only. Actual product may differ slightly due to natural wood variations.
      </p>

      {showUnsavedModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
            <h3 className="text-lg font-bold text-white mb-2">Unsaved Changes</h3>
            <p className="text-sm text-[var(--text-muted)]">
              You have unsaved changes. Please save your build before leaving this page.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleStayOnPage}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSaveAndLeave()
                }}
                className="flex-1 rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-4 py-2.5 text-sm font-bold text-[var(--text-dark)]"
              >
                Save Build
              </button>
              <button
                type="button"
                onClick={handleConfirmLeave}
                className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/20 transition-colors"
              >
                Leave Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomizePage
