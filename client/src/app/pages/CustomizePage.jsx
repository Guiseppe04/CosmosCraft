import { useMemo, useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useSearchParams, useNavigate, useBlocker } from 'react-router'
import { 
  ChevronDown, Info, 
  Check, CheckCircle,
  Sparkles, Layers, Palette, Cog, Zap, Image, ZoomIn, ZoomOut, Trash2
} from 'lucide-react'
import { exportMaskedPreview } from '../utils/exportMaskedPreview.js'
import { adminApi } from '../utils/adminApi.js'
import { optimizeCloudinaryImage } from '../utils/cloudinary.js'
import {
  BASE_STICKER_Z_INDEX,
  buildStickerPlacementContext,
  getStickerAspectRatioFromMeta,
  getStickerImageMeta,
  getStickerRenderPosition,
  normalizeStickerPlacement,
} from '../utils/stickerPlacement.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import useGuitarConfig from '../hooks/useGuitarConfig.js'
import GuitarPreview from '../components/guitar/GuitarPreview.jsx'
import { RGBColorPicker } from '../components/options/RGBColorPicker.jsx'
import { BuilderActionBar } from '../components/customize/BuilderActionBar.jsx'
import { BuilderCheckoutSection } from '../components/customize/BuilderCheckoutSection.jsx'
import { BuilderSavedBadge } from '../components/customize/BuilderSavedBadge.jsx'
import { StickerPanel } from '../components/customize/StickerPanel.jsx'
import { BuilderConfigurationPanel } from '../components/customize/BuilderConfigurationPanel.jsx'
import {
  buildConfigurationLineItems,
  GUITAR_CONFIGURATION_ITEMS,
} from '../utils/buildConfigurationLineItems.js'

// Configuration categories with icons and tooltips
const CATEGORIES = [
  { 
    id: 'general', 
    label: 'General', 
    icon: Sparkles, 
    color: '#f59e0b',
    tooltip: 'Basic configuration including dexterity, strings, scale length, and case.'
  },
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
      
      <div className="space-y-1.5">
        <div className={`text-[15px] font-bold leading-tight tracking-tight transition-colors duration-200 ${
          isSelected ? 'text-[var(--text-light)]' : 'text-[var(--text-light)] group-hover:text-white'
        }`}>
          {option.label}
        </div>
        {option.note && (
          <div className="text-[11px] leading-relaxed text-[var(--text-muted)] line-clamp-2">
            {option.note}
          </div>
        )}
        {option.price > 0 && (
          <div className={`text-[11px] font-semibold ${
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
function VisualCard({ option, isSelected, onClick, previewImage, fallbackImage, imageHeight = 'h-16' }) {
  const [displayImage, setDisplayImage] = useState(previewImage || fallbackImage || '')

  useEffect(() => {
    setDisplayImage(previewImage || fallbackImage || '')
  }, [previewImage, fallbackImage])

  const optimizedImage = optimizeCloudinaryImage(displayImage, { width: 640 })

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${
        isSelected
          ? 'border-[#d4af37] shadow-lg shadow-[#d4af37]/20 ring-2 ring-[#d4af37]/30'
          : 'border-[var(--border)] hover:border-[var(--gold-primary)]/40'
      }`}
    >
      {/* Preview image/gradient */}
      <div className={`relative ${imageHeight} w-full overflow-hidden`}>
        {displayImage ? (
          <img
            src={optimizedImage}
            alt={option.label}
            loading="lazy"
            onError={() => {
              if (fallbackImage && displayImage !== fallbackImage) {
                setDisplayImage(fallbackImage)
                return
              }
              setDisplayImage('')
            }}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
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
      <div className={`border-t border-[var(--border)] p-2.5 transition-colors duration-200 ${
        isSelected ? 'bg-[#d4af37]/10' : 'bg-[var(--surface-elevated)]'
      }`}>
        <div className={`text-sm font-bold leading-tight tracking-tight transition-colors duration-200 ${
          isSelected ? 'text-[var(--text-light)]' : 'text-[var(--text-light)]'
        }`}>
          {option.label}
        </div>
        {option.note && (
          <div className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)] line-clamp-2">
            {option.note}
          </div>
        )}
        {option.price > 0 && (
          <div className={`mt-1 text-[11px] font-semibold ${
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

const MAX_STICKERS = 10
const DEFAULT_STICKER_PRICE = 100

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
    loadingPrices,
  } = useGuitarConfig()
  const navigate = useNavigate()
  const [view, setView] = useState('front')
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDraggingPreview, setIsDraggingPreview] = useState(false)
  const [stickers, setStickers] = useState([])
  const [selectedStickerId, setSelectedStickerId] = useState(null)
  const [isDraggingSticker, setIsDraggingSticker] = useState(false)
  const stickerFileInputRef = useRef(null)
  const stickersRef = useRef([])
  const stickerPlacementContextRef = useRef(null)
  const panStartRef = useRef({ pointerX: 0, pointerY: 0, originX: 0, originY: 0 })
  const previewViewportRef = useRef(null)
  const previewStageRef = useRef(null)
  const [activeCategory, setActiveCategory] = useState('body')
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [guitarTypeDropdownOpen, setGuitarTypeDropdownOpen] = useState(false)
  const categoryDropdownRef = useRef(null)
  const { isAuthenticated, openLogin } = useAuth()
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(Boolean(editBuildId))
  const [dbCustomizationId, setDbCustomizationId] = useState(null)
  const [isLockedCustomization, setIsLockedCustomization] = useState(false)
  const bypassNavigationBlockRef = useRef(false)
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const suppressDirtyTrackingRef = useRef(false)
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

  const handleZoomIn = () => setZoomLevel(prev => Math.min(2, Number((prev + 0.1).toFixed(2))))
  const handleZoomOut = () => setZoomLevel(prev => Math.max(0.7, Number((prev - 0.1).toFixed(2))))
  const handleZoomReset = () => {
    setZoomLevel(1)
    setPanOffset({ x: 0, y: 0 })
  }

  const currentViewStickers = useMemo(
    () => stickers.filter(s => (s.side || 'front') === view),
    [stickers, view]
  )
  const stickerLineItems = useMemo(
    () => stickers.map((stickerItem, index) => ({
      id: stickerItem.id,
      category: 'Stickers',
      name: `Sticker #${index + 1}`,
      unitPrice: Number.isFinite(Number(stickerItem.price)) ? Number(stickerItem.price) : DEFAULT_STICKER_PRICE,
      quantity: 1,
      subtotal: Number.isFinite(Number(stickerItem.price)) ? Number(stickerItem.price) : DEFAULT_STICKER_PRICE,
    })),
    [stickers],
  )
  const selectedBodyModel = useMemo(
    () => options.bodyOptions?.find((option) => option.value === config.body) || null,
    [options.bodyOptions, config.body]
  )
  const currentBodyMaskSrc = selectedBodyModel?.bodySrc || null
  const stickerTotal = useMemo(
    () => stickerLineItems.reduce((total, item) => total + (Number(item.subtotal) || 0), 0),
    [stickerLineItems],
  )
  const totalPrice = price + stickerTotal

  const handleStickerUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (currentViewStickers.length >= MAX_STICKERS) {
      alert(`You can upload up to ${MAX_STICKERS} stickers.`)
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null
      if (!dataUrl) return
      void (async () => {
        const meta = await getStickerImageMeta(dataUrl)
        const newSticker = normalizeStickerPlacement({
          id: `sticker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          src: dataUrl,
          x: 50,
          y: 50,
          size: 18,
          rotation: 0,
          side: view,
          aspectRatio: getStickerAspectRatioFromMeta(meta),
          price: DEFAULT_STICKER_PRICE,
        }, previewStageRef.current, stickerPlacementContextRef.current)
        setStickers(prev => [...prev, newSticker])
        setSelectedStickerId(newSticker.id)
      })().catch((error) => {
        console.error('Failed to measure sticker image:', error)
      })
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const selectedSticker = useMemo(
    () => stickers.find(s => s.id === selectedStickerId) || null,
    [stickers, selectedStickerId]
  )
  const currentStickerOverlay = useMemo(
    () => currentViewStickers.map((stickerItem, index) => {
      const renderPosition = getStickerRenderPosition(stickerItem, previewStageRef.current, stickerPlacementContextRef.current)
      const left = `${renderPosition.x}%`
      const top = `${renderPosition.y}%`
      return (
        <img
          key={stickerItem.id}
          src={stickerItem.src}
          data-export-sticker="true"
          data-sticker-x={renderPosition.x}
          data-sticker-y={renderPosition.y}
          data-sticker-size={stickerItem.size}
          data-sticker-rotation={stickerItem.rotation || 0}
          alt={`Custom sticker ${index + 1}`}
          className={`absolute select-none ${isDraggingSticker && selectedStickerId === stickerItem.id ? 'cursor-grabbing' : 'cursor-grab'} ${selectedStickerId === stickerItem.id ? 'ring-2 ring-inset ring-[#d4af37]/80' : ''}`}
          style={{
            zIndex: BASE_STICKER_Z_INDEX + index,
            left,
            top,
            width: `${stickerItem.size}%`,
            transform: `translate(-50%, -50%) rotate(${stickerItem.rotation || 0}deg)`,
            transformOrigin: 'center center',
            touchAction: 'none',
            userSelect: 'none',
            pointerEvents: 'auto',
          }}
          draggable={false}
          onMouseDown={(e) => {
            e.stopPropagation()
            beginStickerDrag(e.clientX, e.clientY, stickerItem.id)
          }}
          onTouchStart={(e) => {
            e.stopPropagation()
            const touch = e.touches[0]
            if (!touch) return
            beginStickerDrag(touch.clientX, touch.clientY, stickerItem.id)
          }}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedStickerId(stickerItem.id)
          }}
        />
      )
    }),
    [currentViewStickers, isDraggingSticker, selectedStickerId, previewStageRef.current, stickerPlacementContextRef.current]
  )

  const updateSelectedSticker = (patchOrUpdater, options = {}) => {
    if (!selectedStickerId) return
    setStickers(prev =>
      prev.map(stickerItem => {
        if (stickerItem.id !== selectedStickerId) return stickerItem
        const nextSticker = typeof patchOrUpdater === 'function'
          ? patchOrUpdater(stickerItem)
          : { ...stickerItem, ...patchOrUpdater }
        return normalizeStickerPlacement(nextSticker, previewStageRef.current, stickerPlacementContextRef.current, options)
      })
    )
  }

  const updateStickerById = (id, patchOrUpdater, options = {}) => {
    if (!id) return
    setStickers(prev =>
      prev.map(stickerItem => {
        if (stickerItem.id !== id) return stickerItem
        const nextSticker = typeof patchOrUpdater === 'function'
          ? patchOrUpdater(stickerItem)
          : { ...stickerItem, ...patchOrUpdater }
        return normalizeStickerPlacement(nextSticker, previewStageRef.current, stickerPlacementContextRef.current, options)
      })
    )
  }

  const removeStickerById = (id) => {
    setStickers(prev => {
      const target = prev.find(s => s.id === id)
      if (target?.src?.startsWith('blob:')) {
        URL.revokeObjectURL(target.src)
      }
      return prev.filter(s => s.id !== id)
    })
    setSelectedStickerId(prev => (prev === id ? null : prev))
  }

  const duplicateSelectedSticker = () => {
    if (!selectedSticker || (selectedSticker.side || 'front') !== view || currentViewStickers.length >= MAX_STICKERS) return
    const duplicate = normalizeStickerPlacement({
      ...selectedSticker,
      id: `sticker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      x: Math.min(95, selectedSticker.x + 4),
      y: Math.min(95, selectedSticker.y + 4),
    }, previewStageRef.current, stickerPlacementContextRef.current)
    setStickers(prev => [...prev, duplicate])
    setSelectedStickerId(duplicate.id)
  }

  const moveLayer = (direction) => {
    if (!selectedStickerId) return
    setStickers(prev => {
      const current = prev.filter(s => (s.side || 'front') === view)
      const other = prev.filter(s => (s.side || 'front') !== view)
      const idx = current.findIndex(s => s.id === selectedStickerId)
      if (idx < 0) return prev
      if (direction === 'front' && idx < current.length - 1) {
        const [item] = current.splice(idx, 1)
        current.push(item)
      } else if (direction === 'back' && idx > 0) {
        const [item] = current.splice(idx, 1)
        current.unshift(item)
      } else if (direction === 'up' && idx < current.length - 1) {
        ;[current[idx], current[idx + 1]] = [current[idx + 1], current[idx]]
      } else if (direction === 'down' && idx > 0) {
        ;[current[idx], current[idx - 1]] = [current[idx - 1], current[idx]]
      }
      return [...other, ...current]
    })
  }

  const clampSticker = (x, y) => ({
    x,
    y,
  })

  const moveStickerToClientPoint = (clientX, clientY, stickerId = selectedStickerId) => {
    const stage = previewStageRef.current
    if (!stage || !stickerId) return
    const rect = stage.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const px = ((clientX - rect.left) / rect.width) * 100
    const py = ((clientY - rect.top) / rect.height) * 100
    const clamped = clampSticker(px, py)
    updateStickerById(stickerId, clamped)
  }

  const beginStickerDrag = (clientX, clientY, stickerId) => {
    if (!stickerId) return
    setSelectedStickerId(stickerId)
    setIsDraggingSticker(true)
    moveStickerToClientPoint(clientX, clientY, stickerId)
  }

  const updateStickerDrag = (clientX, clientY) => {
    if (!isDraggingSticker) return
    moveStickerToClientPoint(clientX, clientY)
  }

  const endStickerDrag = () => setIsDraggingSticker(false)

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
    if (zoomLevel <= 1 || isDraggingSticker) return
    setIsDraggingPreview(true)
    panStartRef.current = {
      pointerX: clientX,
      pointerY: clientY,
      originX: panOffset.x,
      originY: panOffset.y,
    }
  }

  const updateDrag = (clientX, clientY) => {
    if (!isDraggingPreview || isDraggingSticker) return
    const dx = clientX - panStartRef.current.pointerX
    const dy = clientY - panStartRef.current.pointerY
    const next = clampPan(panStartRef.current.originX + dx, panStartRef.current.originY + dy)
    setPanOffset(next)
  }

  const endDrag = () => setIsDraggingPreview(false)

  useEffect(() => {
    setPanOffset(prev => clampPan(prev.x, prev.y, zoomLevel))
  }, [zoomLevel])

  useEffect(() => {
    stickersRef.current = stickers
  }, [stickers])

  useEffect(() => {
    const missingAspectRatio = stickers.filter((stickerItem) => !Number.isFinite(stickerItem.aspectRatio) || stickerItem.aspectRatio <= 0)
    if (!missingAspectRatio.length) return undefined

    let cancelled = false
    void Promise.all(
      missingAspectRatio.map(async (stickerItem) => {
        const meta = await getStickerImageMeta(stickerItem.src)
        return {
          id: stickerItem.id,
          aspectRatio: getStickerAspectRatioFromMeta(meta),
        }
      }),
    ).then((updates) => {
      if (cancelled) return
      if (!updates.length) return
      setStickers((prev) =>
        prev.map((stickerItem) => {
          const update = updates.find((entry) => entry.id === stickerItem.id)
          return update ? { ...stickerItem, ...update } : stickerItem
        }),
      )
    }).catch((error) => {
      if (!cancelled) {
        console.warn('Failed to hydrate sticker aspect ratios:', error)
      }
    })

    return () => {
      cancelled = true
    }
  }, [stickers])

  useEffect(() => {
    let cancelled = false
    const stage = previewStageRef.current
    if (!stage || !currentBodyMaskSrc) {
      stickerPlacementContextRef.current = null
      return undefined
    }

    stickerPlacementContextRef.current = null
    void buildStickerPlacementContext(stage, currentBodyMaskSrc)
      .then((context) => {
        if (!cancelled) {
          stickerPlacementContextRef.current = context
          setStickers(prev =>
            prev.map((stickerItem) => (
              (stickerItem.side || 'front') === view
                ? normalizeStickerPlacement(stickerItem, previewStageRef.current, context)
                : stickerItem
            )),
          )
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('Failed to build sticker placement context:', error)
          stickerPlacementContextRef.current = null
        }
      })

    return () => {
      cancelled = true
    }
  }, [config, currentBodyMaskSrc, view])

  useEffect(() => {
    if (!stickersInitializedRef.current) {
      stickersInitializedRef.current = true
      return
    }
    if (editBuildId && !suppressDirtyTrackingRef.current) {
      setHasUnsavedChanges(true)
    }
  }, [stickers, editBuildId])

  useEffect(() => {
    if (!stickerPlacementContextRef.current) return
    setStickers(prev =>
      prev.map((stickerItem) => (
        (stickerItem.side || 'front') === view
          ? normalizeStickerPlacement(stickerItem, previewStageRef.current, stickerPlacementContextRef.current)
          : stickerItem
      )),
    )
  }, [currentBodyMaskSrc, view])

  useEffect(() => {
    if (!selectedStickerId) {
      if (currentViewStickers[0]) setSelectedStickerId(currentViewStickers[0].id)
      return
    }
    const selectedInView = stickers.find(s => s.id === selectedStickerId && (s.side || 'front') === view)
    if (!selectedInView) {
      setSelectedStickerId(currentViewStickers[0]?.id || null)
    }
  }, [view, stickers, selectedStickerId, currentViewStickers])

  useEffect(() => {
    return () => {
      stickersRef.current.forEach(stickerItem => {
        if (stickerItem?.src?.startsWith('blob:')) {
          URL.revokeObjectURL(stickerItem.src)
        }
      })
    }
  }, [])

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
    if (!editBuildId) return

    let cancelled = false

    const loadExistingBuild = async () => {
      for (const storageKey of ['cosmoscraft_saved_builds', 'cosmoscraft_saved_bass_builds']) {
        const builds = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
        const target = builds.find(b => b.id === editBuildId)
        if (!target) continue

        const targetCustomizationId = target.dbCustomizationId || target.customization_id || null

        if (targetCustomizationId && isAuthenticated) {
          try {
            const res = await adminApi.getMyCustomizations()
            const matchingCustomization = (res.data || []).find(customization => customization.customization_id === targetCustomizationId)

            if (!cancelled && matchingCustomization?.is_locked) {
              setIsLockedCustomization(true)
              navigate('/dashboard', {
                replace: true,
                state: {
                  section: 'my-guitar',
                  message: 'This build is already in an active order. You can track it in My Guitar, but it can no longer be edited.',
                },
              })
              return
            }
          } catch (error) {
            console.error('Failed to validate customization lock status:', error)
          }
        }

        try {
          suppressDirtyTrackingRef.current = true
          baseLoadConfig(target.config)
          setStickers(Array.isArray(target.stickers) ? target.stickers : [])
          setDbCustomizationId(targetCustomizationId)
          setIsLockedCustomization(false)
        } catch (e) {
          console.error('Failed to load build config for editing:', e)
        } finally {
          suppressDirtyTrackingRef.current = false
        }
        break
      }
    }

    void loadExistingBuild()

    return () => {
      cancelled = true
    }
  }, [editBuildId, baseLoadConfig, isAuthenticated, navigate])

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

  const saveBuild = async ({ shouldNavigate = true, continueBlockedNavigation = false } = {}) => {
    if (isLockedCustomization) {
      setToastMessage('This build is already in an active order and can no longer be edited.')
      return
    }

    const buildId = editBuildId || `build-${Date.now()}`
    const baseBuild = {
      id: buildId,
      name: `${summary.body} build`,
      price: totalPrice,
      config,
      stickers,
      pricingBreakdown,
      summary,
      savedAt: new Date().toISOString(),
      dbCustomizationId,
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

    const totalSavedBuildCount = ['cosmoscraft_saved_builds', 'cosmoscraft_saved_bass_builds']
      .map((key) => JSON.parse(window.localStorage.getItem(key) || '[]'))
      .reduce((total, entries) => total + (Array.isArray(entries) ? entries.length : 0), 0)

    if (existingIndex === -1 && totalSavedBuildCount >= 10) {
      setToastMessage('You can only save up to 10 guitar builds. Please delete an existing build before creating a new one.')
      return
    }

    if (existingIndex !== -1) {
      // Preserve existing properties like additionalParts
      stored[existingIndex] = { ...stored[existingIndex], ...baseBuild }
    } else {
      stored.unshift(baseBuild)
    }

    if (stored.length > 10) stored = stored.slice(0, 10)
    const persistLocalBuild = (extraPatch = {}) => {
      const nextBuild = { ...baseBuild, ...extraPatch }
      let nextStored = JSON.parse(window.localStorage.getItem(storedKey) || '[]')
      const nextIndex = nextStored.findIndex(b => b.id === buildId)
      if (nextIndex !== -1) {
        nextStored[nextIndex] = { ...nextStored[nextIndex], ...nextBuild }
      } else {
        nextStored.unshift(nextBuild)
      }
      if (nextStored.length > 10) nextStored = nextStored.slice(0, 10)
      window.localStorage.setItem(storedKey, JSON.stringify(nextStored))
      return nextBuild
    }

    persistLocalBuild()
    setHasUnsavedChanges(false)

    try {
      const payload = {
        name: `${summary.body} build`,
        guitar_type: config.guitarType || 'electric',
        total_price: totalPrice,
        is_saved: true,
        body_wood: summary.bodyWood || null,
        neck_wood: summary.neck || null,
        fingerboard_wood: summary.fretboard || null,
        bridge_type: summary.bridge || config.bridge || null,
        pickups: summary.pickups || config.pickups || null,
        color: summary.bodyFinish || config.bodyFinish || null,
        finish_type: summary.bodyFinish || config.bodyFinish || null,
        config_json: config,
        stickers,
      }

      const endpoint = dbCustomizationId
        ? `${API}/guitars/my-customizations/${dbCustomizationId}`
        : `${API}/guitars/my-customizations`
      const method = dbCustomizationId ? 'PUT' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || 'Failed to save customization in database')
      }

      const data = await response.json().catch(() => ({}))
      const savedId = data?.data?.customization_id || dbCustomizationId || null
      if (savedId) {
        setDbCustomizationId(savedId)
        persistLocalBuild({ dbCustomizationId: savedId, customization_id: savedId })
      }
    } catch (error) {
      console.error('Database save failed (local backup retained):', error)
      if (String(error?.message || '').toLowerCase().includes('active order')) {
        setIsLockedCustomization(true)
        navigate('/dashboard', {
          replace: true,
          state: {
            section: 'my-guitar',
            message: 'This build is already in an active order. You can track it in My Guitar, but it can no longer be edited.',
          },
        })
        return
      }
      if (String(error?.message || '').toLowerCase().includes('up to 10 guitar builds')) {
        setToastMessage('You can only save up to 10 guitar builds. Please delete an existing build before creating a new one.')
        return
      }
      setToastMessage('Saved locally. Database sync failed.')
    }
    
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
      openLogin(() => { void saveBuild({ shouldNavigate: true }) })
      return
    }
    void saveBuild({ shouldNavigate: true })
  }

  const handleAddToCart = () => {
    const saveAndToast = () => { void saveBuild({ shouldNavigate: false }) }

    if (!isAuthenticated) {
      openLogin(saveAndToast)
      return
    }

    saveAndToast()
  }

  const handleSaveAndLeave = () => {
    if (!isAuthenticated) {
      openLogin(() => { void saveBuild({ shouldNavigate: false, continueBlockedNavigation: true }) })
      return
    }
    void saveBuild({ shouldNavigate: false, continueBlockedNavigation: true })
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
    navigate('/dashboard', {
      state: {
        section: 'my-guitar',
        message: 'Select a saved build from My Guitar to continue.',
      },
    })
  }

  // Get current category info
  const getCategoryInfo = () => {
    const category = CATEGORIES.find(c => c.id === activeCategory)
    return category
  }

  const configurationLineItems = useMemo(
    () => buildConfigurationLineItems(summary, pricingBreakdown, GUITAR_CONFIGURATION_ITEMS, stickerLineItems),
    [summary, pricingBreakdown, stickerLineItems],
  )

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-16 text-[var(--text-light)] relative xl:h-screen xl:overflow-hidden">
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
        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)_400px]">
          
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
              
              {/* GENERAL OPTIONS */}
              {activeCategory === 'general' && (
                <div className="p-4 space-y-5">
                  {/* Dexterity */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Dexterity</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.dexterityOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.dexterity === opt.value}
                          onClick={() => updateConfig({ dexterity: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Strings */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Number of Strings</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.stringCountOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.strings === opt.value}
                          onClick={() => updateConfig({ strings: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Multiscale */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Multiscale</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.multiscaleOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.multiscale === opt.value}
                          onClick={() => updateConfig({ multiscale: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Scale Length */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Scale Length</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.scaleLengthOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.scaleLength === opt.value}
                          onClick={() => updateConfig({ scaleLength: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Case */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Case</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.caseOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.case === opt.value}
                          onClick={() => updateConfig({ case: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* BODY OPTIONS */}
              {activeCategory === 'body' && (
                <div className="p-4 space-y-5">
                  {/* Body Shape */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Body Shape</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.bodyOptions?.map((opt) => (
                        <VisualCard
                          key={opt.value}
                          option={opt}
                          isSelected={config.body === opt.value}
                          onClick={() => updateConfig({ body: opt.value })}
                          previewImage={opt.previewImageUrl}
                          fallbackImage={opt.bodySrc}
                          imageHeight="h-24"
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Beveled Body Edges */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Beveled Body Edges</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.bevelOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.bevel === opt.value}
                          onClick={() => updateConfig({ bevel: opt.value })}
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
                  
                   {/* Top Wood */}
                   <div>
                     <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Top Wood</h3>
                     <div className="grid grid-cols-2 gap-2">
                       {options.topWoodOptions?.map((opt) => (
                         <VisualCard
                           key={opt.value}
                           option={opt}
                           isSelected={config.topWood === opt.value}
                           onClick={() => updateConfig({ topWood: opt.value })}
                           previewImage={opt.preview || opt.texture}
                           imageHeight="h-16"
                         />
                       ))}
                     </div>
                   </div>
                  
                  {/* Finish Type */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Finish Type</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.finishTypeOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.finishType === opt.value}
                          onClick={() => updateConfig({ finishType: opt.value, finishColor: opt.value === 'metallic' ? 'black' : opt.value === 'translucent' ? 'black' : opt.value === 'sparkle' ? 'black' : config.finishColor })}
                        />
                      ))}
                    </div>
                  </div>
                  
                   {/* Finish Color - dynamically discovered from selected finish folder */}
                   {config.finishType && config.finishType !== 'solid' && (
                     <div>
                       <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Finish Color</h3>
                       <div className="grid grid-cols-2 gap-2">
                         {options.finishColorOptions?.map((opt) => (
                           <VisualCard
                             key={opt.value}
                             option={opt}
                             isSelected={config.finishColor === opt.value}
                             onClick={() => updateConfig({ finishColor: opt.value })}
                             previewImage={opt.preview}
                             imageHeight="h-14"
                           />
                         ))}
                       </div>
                     </div>
                   )}
                  
                   {/* Top Coat */}
                   <div>
                     <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Top Coat</h3>
                     <div className="grid grid-cols-2 gap-2">
                       {options.topCoatOptions?.map((opt) => (
                         <VisualCard
                           key={opt.value}
                           option={opt}
                           isSelected={config.topCoat === opt.value}
                           onClick={() => updateConfig({ topCoat: opt.value })}
                           previewImage={opt.preview}
                           imageHeight="h-14"
                         />
                       ))}
                     </div>
                   </div>
                  
                  {/* Additional Finish Options (Burst Finish) - depends on Top Coat */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Additional Finish Options</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.burstFinishOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.burstFinish === opt.value}
                          onClick={() => updateConfig({ burstFinish: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Body Finish - Solid color picker, shown when finishType is 'solid' or not set */}
                  {(!config.finishType || config.finishType === 'solid') && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-3">Body Finish Color</h3>
                      <RGBColorPicker
                        value={config.bodyFinish && config.bodyFinish !== 'none' ? config.bodyFinish : '#1a1a1a'}
                        onChange={(color) => updateConfig({ bodyFinish: color })}
                        label="Select Guitar Body Color"
                      />
                      <p className="text-xs text-white/40 mt-3">Choose any custom color for your guitar body using the RGB picker or enter a hex value.</p>
                    </div>
                  )}
                  
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
                  {/* Neck Construction */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Neck Construction</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.neckConstructionOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.neckConstruction === opt.value}
                          onClick={() => updateConfig({ neckConstruction: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
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
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Fingerboard Wood</h3>
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
                  
                  {/* Frets */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Frets</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.fretOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.frets === opt.value}
                          onClick={() => updateConfig({ frets: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Neck Rear Finish */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Neck Rear Finish</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.neckRearFinishOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.neckRearFinish === opt.value}
                          onClick={() => updateConfig({ neckRearFinish: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Headstock Shape */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Headstock Shape</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.headstockShapeOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.headstockShape === opt.value}
                          onClick={() => updateConfig({ headstockShape: opt.value })}
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
                  
                  {/* Truss Rod Cover */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Truss Rod Cover</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.trussRodCoverOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.trussRodCover === opt.value}
                          onClick={() => updateConfig({ trussRodCover: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                   {/* Inlay Shape */}
                   <div>
                     <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Inlay Shape</h3>
                     <div className="grid grid-cols-2 gap-2">
                       {options.inlayShapeOptions?.map((opt) => (
                         <OptionButton
                           key={opt.value}
                           option={opt}
                           isSelected={config.inlayShape === opt.value}
                           onClick={() => updateConfig({ inlayShape: opt.value })}
                         />
                       ))}
                     </div>
                   </div>
                   <div>
                     <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Inlay Material</h3>
                     <div className="grid grid-cols-2 gap-2">
                       {options.inlayMaterialOptions?.map((opt) => (
                         <OptionButton
                           key={opt.value}
                           option={opt}
                           isSelected={config.inlayMaterial === opt.value}
                           onClick={() => updateConfig({ inlayMaterial: opt.value })}
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
                  
                  {/* Saddle */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Saddle</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.saddleOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.saddle === opt.value}
                          onClick={() => updateConfig({ saddle: opt.value })}
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
                  
                  {/* Nut */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Nut</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.nutOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.nut === opt.value}
                          onClick={() => updateConfig({ nut: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                   {/* Tuning */}
                   <div>
                     <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Tuning</h3>
                     <div className="grid grid-cols-2 gap-2">
                       {options.tuningOptions?.map((opt) => (
                         <OptionButton
                           key={opt.value}
                           option={opt}
                           isSelected={config.tuning === opt.value}
                           onClick={() => updateConfig({ tuning: opt.value })}
                         />
                       ))}
                     </div>
                     {['cStandard', 'dropC', 'dropB'].includes(config.tuning) && (
                       <p className="mt-2 text-[10px] text-white/40 leading-relaxed">
                         Note: Lower tunings require thicker strings and may require truss rod adjustment. Setup service recommended.
                       </p>
                     )}
                   </div>
                  
                  {/* String Brand */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">String Brand</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.stringBrandOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.stringBrand === opt.value}
                          onClick={() => updateConfig({ stringBrand: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Output Jack */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Output Jack</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.outputJackOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.outputJack === opt.value}
                          onClick={() => updateConfig({ outputJack: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Strap Buttons */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Strap Buttons</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.strapButtonOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.strapButtons === opt.value}
                          onClick={() => updateConfig({ strapButtons: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Tuner Buttons */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Tuner Buttons</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.tunerButtonOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.tunerButtons === opt.value}
                          onClick={() => updateConfig({ tunerButtons: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Electronics Cavity Cover */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Electronics Cavity Cover</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.electronicsCavityCoverOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.electronicsCavityCover === opt.value}
                          onClick={() => updateConfig({ electronicsCavityCover: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                   {(config.bridge === 'hipshotTremolo' || config.bridge === 'floydRoseTremolo') && (
                     <div>
                       <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Tremolo Cover</h3>
                       <div className="grid grid-cols-2 gap-2">
                         {options.tremoloCoverOptions?.map((opt) => (
                           <OptionButton
                             key={opt.value}
                             option={opt}
                             isSelected={config.tremoloCover === opt.value}
                             onClick={() => updateConfig({ tremoloCover: opt.value })}
                           />
                         ))}
                       </div>
                     </div>
                   )}
                </div>
              )}
              
              {/* ELECTRONICS OPTIONS */}
              {activeCategory === 'electronics' && (
                <div className="p-4 space-y-5">
                  {/* Electronics Type */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Electronics Type</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.electronicsTypeOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.electronicsType === opt.value}
                          onClick={() => updateConfig({ electronicsType: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Pickup Configuration */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Configuration</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.pickupConfigurationOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.pickupConfiguration === opt.value}
                          onClick={() => updateConfig({ pickupConfiguration: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Pickups (legacy) */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Set</h3>
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
                  
                  {/* Bridge Pickup Model */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Bridge Pickup</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.bridgePickupModelOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.bridgePickupModel === opt.value}
                          onClick={() => updateConfig({ bridgePickupModel: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Middle Pickup Model - only for HSS/SSS */}
                  {['hss', 'sss', 'hss'].includes(config.pickupConfiguration || config.pickups) && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Middle Pickup</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {options.middlePickupModelOptions?.map((opt) => (
                          <OptionButton
                            key={opt.value}
                            option={opt}
                            isSelected={config.middlePickupModel === opt.value}
                            onClick={() => updateConfig({ middlePickupModel: opt.value })}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Neck Pickup Model */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Neck Pickup</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.neckPickupModelOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.neckPickupModel === opt.value}
                          onClick={() => updateConfig({ neckPickupModel: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Pickup Bobbin */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Bobbin</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.pickupBobbinOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.pickupBobbin === opt.value}
                          onClick={() => updateConfig({ pickupBobbin: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Pole Piece Color */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pole Piece Color</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.pickupPoleColorOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.pickupPoleColor === opt.value}
                          onClick={() => updateConfig({ pickupPoleColor: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Controls */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Controls</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.controlsOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.controls === opt.value}
                          onClick={() => updateConfig({ controls: opt.value })}
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
            
          </aside>

          {/* CENTER - Guitar Preview */}
          <main className="min-h-0 flex flex-col">
            <div ref={previewRef} className="relative flex-1 min-h-[320px] rounded-2xl border border-white/10 bg-gradient-to-b from-[#141414] via-[#0d0d0d] to-[#080808] overflow-hidden">
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
                onMouseMove={(e) => {
                  if (isDraggingSticker) {
                    updateStickerDrag(e.clientX, e.clientY)
                    return
                  }
                  updateDrag(e.clientX, e.clientY)
                }}
                onMouseUp={() => {
                  endDrag()
                  endStickerDrag()
                }}
                onMouseLeave={() => {
                  endDrag()
                  endStickerDrag()
                }}
                onTouchStart={(e) => {
                  const touch = e.touches[0]
                  if (!touch) return
                  beginDrag(touch.clientX, touch.clientY)
                }}
                onTouchMove={(e) => {
                  const touch = e.touches[0]
                  if (!touch) return
                  if (isDraggingSticker) {
                    updateStickerDrag(touch.clientX, touch.clientY)
                    return
                  }
                  updateDrag(touch.clientX, touch.clientY)
                }}
                onTouchEnd={() => {
                  endDrag()
                  endStickerDrag()
                }}
              >
                <div
                  className="relative w-full max-w-[1100px] transition-transform duration-200 ease-out"
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    willChange: 'transform',
                  }}
                >
                  <GuitarPreview
                    config={config}
                    view={view}
                    onViewChange={setView}
                    modelImageSrc={selectedBodyModel?.previewImageUrl || selectedBodyModel?.bodySrc || null}
                    stickerOverlay={currentStickerOverlay}
                    stickerMaskSrc={selectedBodyModel?.bodySrc || null}
                    stageRef={previewStageRef}
                  />
                </div>
              </div>
              
              {/* Subtle reflection/shadow beneath guitar */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-gradient-to-b from-transparent to-black/40 blur-xl" />
              
              {/* View toggle */}
              <div className="absolute top-4 left-4 z-10 flex gap-2">
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

              {/* Saved status */}
              <div className="absolute bottom-4 left-4 z-10">
                <BuilderSavedBadge hasUnsavedChanges={hasUnsavedChanges} />
              </div>

              <input
                ref={stickerFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleStickerUpload}
                className="hidden"
              />

              <StickerPanel
                stickerCount={stickers.length}
                maxStickers={MAX_STICKERS}
                onAddClick={() => stickerFileInputRef.current?.click()}
                addDisabled={stickers.length >= MAX_STICKERS}
              >
                {selectedSticker && (selectedSticker.side || 'front') === view && (
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
                        onClick={() => updateSelectedSticker(prev => ({ ...prev, size: Math.max(6, prev.size - 2) }))}
                        className="rounded-md bg-[var(--border)] px-2 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]"
                        title="Shrink sticker"
                      >
                        -
                      </button>
                      <span className="text-[10px] text-white/70 min-w-10 text-center">{Math.round(selectedSticker.size)}%</span>
                      <button
                        type="button"
                        onClick={() => updateSelectedSticker(prev => ({ ...prev, size: Math.min(50, prev.size + 2) }))}
                        className="rounded-md bg-[var(--border)] px-2 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]"
                        title="Enlarge sticker"
                      >
                        +
                      </button>

                      <button
                        type="button"
                        onClick={() => updateSelectedSticker(prev => ({ ...prev, rotation: (prev.rotation - 15 + 360) % 360 }))}
                        className="rounded-md bg-[var(--border)] px-2 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]"
                        title="Rotate left"
                      >
                        -15°
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedSticker(prev => ({ ...prev, rotation: (prev.rotation + 15) % 360 }))}
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

                {currentViewStickers.length > 0 && (
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
              </StickerPanel>
            </div>

            <BuilderActionBar
              onReset={resetConfig}
              onSave={handleSave}
              onLoad={handleLoad}
            />
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleSaveImage}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-white/40 transition-colors hover:border-[var(--border)] hover:text-[var(--text-muted)]"
              >
                <Image className="h-3.5 w-3.5" />
                Save preview image
              </button>
            )}
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
              <BuilderConfigurationPanel
                lineItems={configurationLineItems}
                configurationTotal={totalPrice}
                loadingPrices={loadingPrices}
              />
            </div>

            <BuilderCheckoutSection
              price={totalPrice}
              basePrice={options.basePrice}
              onAddToCart={handleAddToCart}
            />

            {/* Help section */}
            <div className="border-t border-white/10 p-4 flex-shrink-0">
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
                      Each option is carefully crafted to deliver premium quality. Hover over category names for more details, or{' '}
                      <a
                        href="https://www.facebook.com/messages/t/CosmosGuitars"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#d4af37] hover:text-[#ffe270] transition-colors"
                      >
                        contact our support team
                      </a>
                      .
                    </p>
                  </div>
                </div>
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
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    handleSaveAndLeave()
                  }}
                  className="flex-1 rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-4 py-2.5 text-sm font-bold text-[var(--text-dark)]"
                >
                  Save Build
                </button>
              ) : (
                <div className="flex-1" aria-hidden="true" />
              )}
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
