import { useEffect, useMemo, useState, useCallback } from 'react'
import axios from 'axios'
import {
  BASS_BASE_PRICE,
  BASS_BODY_FINISH_OPTIONS,
  BASS_BODY_OPTIONS,
  BASS_BODY_WOOD_OPTIONS,
  BASS_BRIDGE_OPTIONS,
  BASS_DEFAULT_CONFIG,
  BASS_FRETBOARD_OPTIONS,
  BASS_NECK_OPTIONS,
  BASS_HEADSTOCK_WOOD_OPTIONS,
  BASS_HEADSTOCK_STYLE_OPTIONS,
  BASS_NECK_STYLE_OPTIONS,
  BASS_HARDWARE_OPTIONS,
  BASS_INLAY_OPTIONS,
  BASS_LOGO_OPTIONS,
  BASS_BACKPLATE_OPTIONS,
  BASS_PICKUP_SCREW_OPTIONS,
  BASS_CONTROL_PLATE_OPTIONS,
  BASS_PICKGUARD_OPTIONS,
  BASS_KNOB_OPTIONS,
  BASS_PICKUP_OPTIONS,
  BASS_PICKUP_TYPE_STYLE_OPTIONS,
  BASS_STRING_OPTIONS,
  BASS_PICKUP_CONFIG_OPTIONS,
  BASS_TYPE_OPTIONS,
  bassBuilder,
} from '../lib/bassBuilderData.js'

const phpFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ? import.meta.env.VITE_API_URL : ''

export function formatPricePHP(price) {
  return phpFormatter.format(price)
}

export default function useBassConfig() {
  const [config, setConfig] = useState(BASS_DEFAULT_CONFIG)
  const [builderParts, setBuilderParts] = useState([])
  const [modelImages, setModelImages] = useState([])
  const [loadingPrices, setLoadingPrices] = useState(true)

  const fetchBuilderParts = async () => {
    setLoadingPrices(true)
    try {
      const [partsResponse, modelImagesResponse] = await Promise.all([
        axios.get(`${API_URL}/api/builder-parts`, {
          params: { is_active: true, guitar_type: 'bass', pageSize: 500, _t: Date.now() },
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' }
        }),
        axios.get(`${API_URL}/api/builder-parts/model-images`, {
          params: { guitar_type: 'bass', _t: Date.now() },
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' }
        }),
      ])
      if (partsResponse.data?.data) {
        setBuilderParts(partsResponse.data.data)
      }
      setModelImages(Array.isArray(modelImagesResponse.data?.data) ? modelImagesResponse.data.data : [])
    } catch (error) {
      console.error('Failed to fetch builder parts:', error)
    } finally {
      setLoadingPrices(false)
    }
  }

  useEffect(() => {
    fetchBuilderParts()
  }, [])

  useEffect(() => {
    const handleFocus = () => fetchBuilderParts()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        fetchBuilderParts()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const priceOverrides = useMemo(() => {
    const overrides = {}
    builderParts.forEach(part => {
      const partType = typeof part.guitar_type === 'string' ? part.guitar_type.trim().toLowerCase() : ''
      const matchesType = !partType || partType === 'bass'
      if (matchesType && part.price !== undefined) {
        const normalizedCategory = typeof part.part_category === 'string' ? part.part_category.trim().toLowerCase() : ''
        const normalizedTypeMapping = typeof part.type_mapping === 'string' ? part.type_mapping.trim() : ''
        const normalizedNameKey = typeof part.name === 'string' ? part.name.trim().toLowerCase().replace(/\s+/g, '') : ''

        if (normalizedTypeMapping) {
          overrides[normalizedTypeMapping] = { price: Number(part.price), partCategory: normalizedCategory || part.part_category }
          overrides[normalizedTypeMapping.toLowerCase()] = { price: Number(part.price), partCategory: normalizedCategory || part.part_category }
        }
        if (normalizedCategory && normalizedNameKey) {
          overrides[`catname:${normalizedCategory}:${normalizedNameKey}`] = { price: Number(part.price), partCategory: normalizedCategory }
        }
        if (normalizedCategory) {
          overrides[`cat:${normalizedCategory}`] = { price: Number(part.price), partCategory: normalizedCategory }
        }
      }
    })
    return overrides
  }, [builderParts])

  const modelImageMap = useMemo(() => {
    return modelImages.reduce((acc, item) => {
      const key = String(item?.model_key || '').trim()
      if (key && item?.image_url) {
        acc[key] = item.image_url
      }
      return acc
    }, {})
  }, [modelImages])

  const getCategoryPrice = (cat) => priceOverrides[`cat:${cat}`]?.price
  const getOptionOverride = (category, optionKey) => {
    const key = String(optionKey || '').trim()
    const normalized = key.toLowerCase()
    return (
      priceOverrides[`catname:${category}:${normalized}`]?.price ??
      priceOverrides[key]?.price ??
      priceOverrides[normalized]?.price
    )
  }

  const dynamicBasePrice = useMemo(() => {
    const candidates = [
      priceOverrides.base?.price,
      priceOverrides.basePrice?.price,
      priceOverrides.base_price?.price,
      priceOverrides['cat:base']?.price,
      priceOverrides['cat:pricing']?.price,
    ]
    const override = candidates.find((v) => v !== undefined && !Number.isNaN(Number(v)))
    return override !== undefined ? Number(override) : BASS_BASE_PRICE
  }, [priceOverrides])

  const mergedBodyOptions = useMemo(() => {
    const merged = { ...BASS_BODY_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedBodyWoodOptions = useMemo(() => {
    const merged = { ...BASS_BODY_WOOD_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedBodyFinishOptions = useMemo(() => {
    const merged = { ...BASS_BODY_FINISH_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedNeckOptions = useMemo(() => {
    const merged = { ...BASS_NECK_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedFretboardOptions = useMemo(() => {
    const merged = { ...BASS_FRETBOARD_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedHeadstockWoodOptions = useMemo(() => {
    const merged = { ...BASS_HEADSTOCK_WOOD_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedHeadstockStyleOptions = useMemo(() => {
    const merged = { ...BASS_HEADSTOCK_STYLE_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedNeckStyleOptions = useMemo(() => {
    const merged = { ...BASS_NECK_STYLE_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedInlayOptions = useMemo(() => {
    const merged = { ...BASS_INLAY_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedLogoOptions = useMemo(() => {
    const merged = {}
    Object.keys(BASS_LOGO_OPTIONS).forEach(bodyKey => {
      merged[bodyKey] = { ...BASS_LOGO_OPTIONS[bodyKey] }
      Object.keys(merged[bodyKey]).forEach(key => {
        const specific = getOptionOverride('misc', key)
        if (specific !== undefined) {
          merged[bodyKey][key] = { ...merged[bodyKey][key], price: specific }
        }
      })
    })
    return merged
  }, [priceOverrides])

  const mergedBackplateOptions = useMemo(() => {
    const merged = { ...BASS_BACKPLATE_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedPickupScrewOptions = useMemo(() => {
    const merged = {}
    Object.keys(BASS_PICKUP_SCREW_OPTIONS).forEach(bodyKey => {
      merged[bodyKey] = { ...BASS_PICKUP_SCREW_OPTIONS[bodyKey] }
      Object.keys(merged[bodyKey]).forEach(key => {
        const specific = getOptionOverride('hardware', key)
        if (specific !== undefined) {
          merged[bodyKey][key] = { ...merged[bodyKey][key], price: specific }
        }
      })
    })
    return merged
  }, [priceOverrides])

  const mergedControlPlateOptions = useMemo(() => {
    const merged = { ...BASS_CONTROL_PLATE_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedBridgeOptions = useMemo(() => {
    const merged = {}
    const bridgeCatPrice = priceOverrides['cat:bridge']?.price
    Object.keys(BASS_BRIDGE_OPTIONS).forEach(bodyKey => {
      merged[bodyKey] = { ...BASS_BRIDGE_OPTIONS[bodyKey] }
      Object.keys(merged[bodyKey]).forEach(key => {
        const specific = getOptionOverride('bridge', key)
        const finalPrice = specific !== undefined ? specific : bridgeCatPrice
        if (finalPrice !== undefined) {
          merged[bodyKey][key] = { ...merged[bodyKey][key], price: finalPrice }
        }
      })
    })
    return merged
  }, [priceOverrides])

  const mergedPickguardOptions = useMemo(() => {
    const merged = {}
    const pickguardCatPrice = priceOverrides['cat:pickguard']?.price
    Object.keys(BASS_PICKGUARD_OPTIONS).forEach(bodyKey => {
      merged[bodyKey] = { ...BASS_PICKGUARD_OPTIONS[bodyKey] }
      Object.keys(merged[bodyKey]).forEach(key => {
        const specific = getOptionOverride('pickguard', key)
        const finalPrice = specific !== undefined ? specific : pickguardCatPrice
        if (finalPrice !== undefined) {
          merged[bodyKey][key] = { ...merged[bodyKey][key], price: finalPrice }
        }
      })
    })
    return merged
  }, [priceOverrides])

  const mergedKnobOptions = useMemo(() => {
    const merged = {}
    const knobsCatPrice = priceOverrides['cat:knobs']?.price
    const hardwareCatPrice = priceOverrides['cat:hardware']?.price
    Object.keys(BASS_KNOB_OPTIONS).forEach(bodyKey => {
      merged[bodyKey] = { ...BASS_KNOB_OPTIONS[bodyKey] }
      Object.keys(merged[bodyKey]).forEach(key => {
        const specific = getOptionOverride('knobs', key) ?? getOptionOverride('hardware', key)
        const finalPrice = specific !== undefined ? specific : (knobsCatPrice !== undefined ? knobsCatPrice : hardwareCatPrice)
        if (finalPrice !== undefined) {
          merged[bodyKey][key] = { ...merged[bodyKey][key], price: finalPrice }
        }
      })
    })
    return merged
  }, [priceOverrides])

  const mergedHardwareOptions = useMemo(() => {
    const merged = { ...BASS_HARDWARE_OPTIONS }
    const hardwareCatPrice = priceOverrides['cat:hardware']?.price
    Object.keys(merged).forEach(key => {
      const specific = getOptionOverride('hardware', key)
      const finalPrice = specific !== undefined ? specific : hardwareCatPrice
      if (finalPrice !== undefined) {
        merged[key] = { ...merged[key], price: finalPrice }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedPickupOptions = useMemo(() => {
    const merged = { ...BASS_PICKUP_OPTIONS }
    const pickupsCatPrice = priceOverrides['cat:pickups']?.price
    Object.keys(merged).forEach(key => {
      const specific = getOptionOverride('pickups', key)
      const finalPrice = specific !== undefined ? specific : pickupsCatPrice
      if (finalPrice !== undefined) {
        merged[key] = { ...merged[key], price: finalPrice }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedPickupTypeStyleOptions = useMemo(() => {
    const merged = { ...BASS_PICKUP_TYPE_STYLE_OPTIONS }
    Object.keys(merged).forEach(key => {
      const specific = getOptionOverride('pickups', key)
      if (specific !== undefined) {
        merged[key] = { ...merged[key], price: specific }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedStringOptions = useMemo(() => {
    const merged = { ...BASS_STRING_OPTIONS }
    const stringsCatPrice = priceOverrides['cat:strings']?.price
    Object.keys(merged).forEach(key => {
      const specific = getOptionOverride('strings', key)
      const finalPrice = specific !== undefined ? specific : stringsCatPrice
      if (finalPrice !== undefined) {
        merged[key] = { ...merged[key], price: finalPrice }
      }
    })
    return merged
  }, [priceOverrides])

  useEffect(() => {
    const pickguardKeys = Object.keys(BASS_PICKGUARD_OPTIONS[config.bassType] ?? BASS_PICKGUARD_OPTIONS.vader)
    const knobKeys = Object.keys(BASS_KNOB_OPTIONS[config.bassType] ?? BASS_KNOB_OPTIONS.vader)
    const bridgeKeys = Object.keys(BASS_BRIDGE_OPTIONS[config.bassType] ?? BASS_BRIDGE_OPTIONS.vader)
    const logoKeys = Object.keys(BASS_LOGO_OPTIONS[config.bassType] ?? BASS_LOGO_OPTIONS.vader)
    
    const nextPickguard = pickguardKeys.includes(config.pickguard) ? config.pickguard : pickguardKeys[0]
    const nextKnobs = knobKeys.includes(config.knobs) ? config.knobs : knobKeys[0]
    const nextBridge = bridgeKeys.includes(config.bridge) ? config.bridge : bridgeKeys[0]
    const nextLogo = logoKeys.includes(config.logo) ? config.logo : logoKeys[0]

    if (nextPickguard !== config.pickguard || nextKnobs !== config.knobs || nextBridge !== config.bridge || nextLogo !== config.logo) {
      setConfig(prev => ({
        ...prev,
        pickguard: nextPickguard,
        knobs: nextKnobs,
        bridge: nextBridge,
        logo: nextLogo,
      }))
    }
  }, [config.bassType, config.knobs, config.pickguard, config.bridge, config.logo])

  const updateConfig = useCallback((patch) => {
    setConfig(prev => ({ ...prev, ...patch }))
  }, [])

  const resetConfig = useCallback(() => {
    setConfig(BASS_DEFAULT_CONFIG)
  }, [])

  const price = useMemo(() => {
    return (
      dynamicBasePrice +
      (mergedBodyOptions[config.bassType]?.price ?? BASS_BODY_OPTIONS[config.bassType]?.price ?? 0) +
      (mergedBodyWoodOptions[config.bodyWood]?.price ?? BASS_BODY_WOOD_OPTIONS[config.bodyWood]?.price ?? 0) +
      (mergedBodyFinishOptions[config.bodyFinish]?.price ?? BASS_BODY_FINISH_OPTIONS[config.bodyFinish]?.price ?? 0) +
      (mergedNeckOptions[config.neck]?.price ?? BASS_NECK_OPTIONS[config.neck]?.price ?? 0) +
      (mergedFretboardOptions[config.fretboard]?.price ?? BASS_FRETBOARD_OPTIONS[config.fretboard]?.price ?? 0) +
      (mergedHeadstockWoodOptions[config.headstockWood]?.price ?? BASS_HEADSTOCK_WOOD_OPTIONS[config.headstockWood]?.price ?? 0) +
      (mergedHeadstockStyleOptions[config.headstockStyle]?.price ?? BASS_HEADSTOCK_STYLE_OPTIONS[config.headstockStyle]?.price ?? 0) +
      (mergedNeckStyleOptions[config.neckStyle]?.price ?? BASS_NECK_STYLE_OPTIONS[config.neckStyle]?.price ?? 0) +
      (mergedInlayOptions[config.inlays]?.price ?? BASS_INLAY_OPTIONS[config.inlays]?.price ?? 0) +
      (mergedLogoOptions[config.bassType]?.[config.logo]?.price ?? BASS_LOGO_OPTIONS[config.bassType]?.[config.logo]?.price ?? 0) +
      (mergedBackplateOptions[config.bassType]?.[config.backplate]?.price ?? BASS_BACKPLATE_OPTIONS[config.bassType]?.[config.backplate]?.price ?? 0) +
      (mergedPickupScrewOptions[config.bassType]?.[config.pickupScrews]?.price ?? BASS_PICKUP_SCREW_OPTIONS[config.bassType]?.[config.pickupScrews]?.price ?? 0) +
      (mergedControlPlateOptions[config.controlPlate]?.price ?? BASS_CONTROL_PLATE_OPTIONS[config.controlPlate]?.price ?? 0) +
      (mergedBridgeOptions[config.bassType]?.[config.bridge]?.price ?? BASS_BRIDGE_OPTIONS[config.bassType]?.[config.bridge]?.price ?? 0) +
      (mergedPickguardOptions[config.bassType]?.[config.pickguard]?.price ?? BASS_PICKGUARD_OPTIONS[config.bassType]?.[config.pickguard]?.price ?? 0) +
      (mergedKnobOptions[config.bassType]?.[config.knobs]?.price ?? BASS_KNOB_OPTIONS[config.bassType]?.[config.knobs]?.price ?? 0) +
      (mergedHardwareOptions[config.hardware]?.price ?? BASS_HARDWARE_OPTIONS[config.hardware]?.price ?? 0) +
      (mergedPickupOptions[config.pickups]?.price ?? BASS_PICKUP_OPTIONS[config.pickups]?.price ?? 0) +
      (mergedPickupTypeStyleOptions[config.pickupTypeStyle]?.price ?? BASS_PICKUP_TYPE_STYLE_OPTIONS[config.pickupTypeStyle]?.price ?? 0) +
      (mergedStringOptions[config.strings]?.price ?? BASS_STRING_OPTIONS[config.strings]?.price ?? 0)
    )
  }, [config, dynamicBasePrice, mergedBodyOptions, mergedBodyWoodOptions, mergedBodyFinishOptions, mergedNeckOptions, mergedFretboardOptions, mergedHeadstockWoodOptions, mergedHeadstockStyleOptions, mergedNeckStyleOptions, mergedInlayOptions, mergedLogoOptions, mergedBackplateOptions, mergedPickupScrewOptions, mergedControlPlateOptions, mergedBridgeOptions, mergedPickguardOptions, mergedKnobOptions, mergedHardwareOptions, mergedPickupOptions, mergedPickupTypeStyleOptions, mergedStringOptions])

  const summary = useMemo(
    () => ({
      body: BASS_BODY_OPTIONS[config.bassType]?.label ?? config.bassType,
      bodyWood: BASS_BODY_WOOD_OPTIONS[config.bodyWood]?.label ?? config.bodyWood,
      bodyFinish: BASS_BODY_FINISH_OPTIONS[config.bodyFinish]?.label ?? config.bodyFinish,
      neck: BASS_NECK_OPTIONS[config.neck]?.label ?? config.neck,
      fretboard: BASS_FRETBOARD_OPTIONS[config.fretboard]?.label ?? config.fretboard,
      headstockWood: BASS_HEADSTOCK_WOOD_OPTIONS[config.headstockWood]?.label ?? config.headstockWood,
      headstockStyle: BASS_HEADSTOCK_STYLE_OPTIONS[config.headstockStyle]?.label ?? config.headstockStyle,
      neckStyle: BASS_NECK_STYLE_OPTIONS[config.neckStyle]?.label ?? config.neckStyle,
      inlays: BASS_INLAY_OPTIONS[config.inlays]?.label ?? config.inlays,
      logo: BASS_LOGO_OPTIONS[config.bassType]?.[config.logo]?.label ?? config.logo,
      backplate: BASS_BACKPLATE_OPTIONS[config.bassType]?.[config.backplate]?.label ?? config.backplate,
      pickupScrews: BASS_PICKUP_SCREW_OPTIONS[config.bassType]?.[config.pickupScrews]?.label ?? config.pickupScrews,
      controlPlate: BASS_CONTROL_PLATE_OPTIONS[config.controlPlate]?.label ?? config.controlPlate,
      bridge: BASS_BRIDGE_OPTIONS[config.bassType]?.[config.bridge]?.label ?? config.bridge,
      pickguard: BASS_PICKGUARD_OPTIONS[config.bassType]?.[config.pickguard]?.label ?? config.pickguard,
      knobs: BASS_KNOB_OPTIONS[config.bassType]?.[config.knobs]?.label ?? config.knobs,
      hardware: BASS_HARDWARE_OPTIONS[config.hardware]?.label ?? config.hardware,
      pickups: BASS_PICKUP_OPTIONS[config.pickups]?.label ?? config.pickups,
      pickupTypeStyle: BASS_PICKUP_TYPE_STYLE_OPTIONS[config.pickupTypeStyle]?.label ?? config.pickupTypeStyle,
      strings: BASS_STRING_OPTIONS[config.strings]?.label ?? config.strings,
      pickupConfig: BASS_PICKUP_CONFIG_OPTIONS[config.pickupConfig]?.label ?? config.pickupConfig,
    }),
    [config],
  )

  const bassTypeOptions = useMemo(
    () => BASS_TYPE_OPTIONS,
    [],
  )
  const bodyWoodOptions = useMemo(
    () => Object.entries(mergedBodyWoodOptions).map(([value, option]) => ({ value, ...option, preview: option.texture })),
    [mergedBodyWoodOptions],
  )
  const bodyFinishOptions = useMemo(
    () => Object.entries(mergedBodyFinishOptions).map(([value, option]) => ({ value, ...option, preview: option.texture })),
    [mergedBodyFinishOptions],
  )
  const bodyOptions = useMemo(
    () => Object.entries(mergedBodyOptions).map(([value, option]) => ({
      value,
      ...option,
      previewImageUrl: modelImageMap[value] || null,
    })),
    [mergedBodyOptions, modelImageMap],
  )
  const neckOptions = useMemo(
    () => Object.entries(mergedNeckOptions).map(([value, option]) => ({ value, ...option })),
    [mergedNeckOptions],
  )
  const fretboardOptions = useMemo(
    () => Object.entries(mergedFretboardOptions).map(([value, option]) => ({ value, ...option })),
    [mergedFretboardOptions],
  )
  const headstockWoodOptions = useMemo(
    () => Object.entries(mergedHeadstockWoodOptions).map(([value, option]) => ({ value, ...option, preview: option.texture })),
    [mergedHeadstockWoodOptions],
  )
  const inlayOptions = useMemo(
    () => Object.entries(mergedInlayOptions).map(([value, option]) => ({ value, ...option, preview: option.src })),
    [mergedInlayOptions],
  )
  const bridgeOptions = useMemo(
    () =>
      Object.entries(mergedBridgeOptions[config.bassType] ?? mergedBridgeOptions.vader).map(([value, option]) => ({
        value,
        ...option,
        preview: option.assets?.[config.hardware] ?? option.assets?.chrome ?? option.assets?.black ?? option.assets?.gold,
      })),
    [config.hardware, config.bassType, mergedBridgeOptions],
  )
  const pickguardOptions = useMemo(
    () =>
      Object.entries(mergedPickguardOptions[config.bassType] ?? mergedPickguardOptions.vader).map(([value, option]) => ({
        value,
        ...option,
        preview: option.src,
      })),
    [config.bassType, mergedPickguardOptions],
  )
  const knobOptions = useMemo(
    () =>
      Object.entries(mergedKnobOptions[config.bassType] ?? mergedKnobOptions.vader).map(([value, option]) => ({
        value,
        ...option,
        preview: option.src,
      })),
    [config.bassType, mergedKnobOptions],
  )
  const pickupOptions = useMemo(
    () => Object.entries(mergedPickupOptions).map(([value, option]) => ({ value, ...option })),
    [mergedPickupOptions],
  )
  const pickupConfigOptions = useMemo(
    () => Object.entries(BASS_PICKUP_CONFIG_OPTIONS).map(([value, option]) => ({ value, ...option })),
    [],
  )
  const stringOptions = useMemo(
    () => Object.entries(mergedStringOptions).map(([value, option]) => ({ value, ...option })),
    [mergedStringOptions],
  )
  const headstockStyleOptions = useMemo(
    () => Object.entries(mergedHeadstockStyleOptions).map(([value, option]) => ({ value, ...option })),
    [mergedHeadstockStyleOptions],
  )
  const neckStyleOptions = useMemo(
    () => Object.entries(mergedNeckStyleOptions).map(([value, option]) => ({ value, ...option })),
    [mergedNeckStyleOptions],
  )
  const pickupTypeStyleOptions = useMemo(
    () => Object.entries(mergedPickupTypeStyleOptions).map(([value, option]) => ({ value, ...option })),
    [mergedPickupTypeStyleOptions],
  )
  const hardwareOptions = useMemo(
    () => Object.entries(mergedHardwareOptions).map(([value, option]) => ({ value, ...option })),
    [mergedHardwareOptions],
  )
  const logoOptions = useMemo(
    () => Object.entries(mergedLogoOptions[config.bassType] ?? mergedLogoOptions.vader).map(([value, option]) => ({ value, ...option, preview: option.src })),
    [config.bassType, mergedLogoOptions],
  )
  const backplateOptions = useMemo(
    () => Object.entries(mergedBackplateOptions).map(([value, option]) => ({ value, ...option })),
    [mergedBackplateOptions],
  )
  const pickupScrewOptions = useMemo(
    () => Object.entries(mergedPickupScrewOptions[config.bassType] ?? mergedPickupScrewOptions.vader).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedPickupScrewOptions],
  )
  const controlPlateOptions = useMemo(
    () => Object.entries(mergedControlPlateOptions).map(([value, option]) => ({ value, ...option })),
    [mergedControlPlateOptions],
  )

  const exportConfig = useCallback(() => JSON.stringify(config, null, 2), [config])

  const loadConfig = useCallback((raw) => {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    setConfig(prev => ({
      ...BASS_DEFAULT_CONFIG,
      ...prev,
      ...parsed,
    }))
  }, [])

  const refreshPrices = useCallback(() => {
    fetchBuilderParts()
  }, [])

  return {
    config,
    setConfig,
    updateConfig,
    resetConfig,
    price,
    summary,
    exportConfig,
    loadConfig,
    builder: bassBuilder,
    loadingPrices,
    refreshPrices,
    options: {
      bassTypeOptions,
      bodyOptions,
      bodyWoodOptions,
      bodyFinishOptions,
      neckOptions,
      fretboardOptions,
      headstockWoodOptions,
      headstockStyleOptions,
      neckStyleOptions,
      inlayOptions,
      logoOptions,
      backplateOptions,
      pickupScrewOptions,
      controlPlateOptions,
      bridgeOptions,
      pickguardOptions,
      knobOptions,
      pickupOptions,
      pickupTypeStyleOptions,
      pickupConfigOptions,
      stringOptions,
      hardwareOptions,
      basePrice: dynamicBasePrice,
    },
  }
}
