import { useEffect, useMemo, useState, useCallback } from 'react'
import axios from 'axios'
import {
  BASE_PRICE,
  BODY_FINISH_OPTIONS,
  BODY_OPTIONS,
  BODY_WOOD_OPTIONS,
  BRIDGE_OPTIONS,
  DEFAULT_CONFIG,
  FRETBOARD_OPTIONS,
  NECK_OPTIONS,
  HEADSTOCK_OPTIONS,
  HEADSTOCK_WOOD_OPTIONS,
  HARDWARE_OPTIONS,
  INLAY_OPTIONS,
  KNOB_OPTIONS_BY_BODY,
  PICKGUARD_OPTIONS_BY_BODY,
  PICKUP_OPTIONS,
  GUITAR_TYPE_OPTIONS,
  guitarBuilder,
} from '../lib/guitarBuilderData.js'

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

export default function useGuitarConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [builderParts, setBuilderParts] = useState([])
  const [loadingPrices, setLoadingPrices] = useState(true)

  const fetchBuilderParts = async () => {
    setLoadingPrices(true)
    try {
      const response = await axios.get(`${API_URL}/api/builder-parts`, {
        params: { is_active: true, pageSize: 500, _t: Date.now() },
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' }
      })
      if (response.data?.data) {
        setBuilderParts(response.data.data)
      }
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
      const configType = typeof config.guitarType === 'string' ? config.guitarType.trim().toLowerCase() : ''
      const matchesType = !partType || partType === configType
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
    console.log('[useGuitarConfig] builderParts:', builderParts.length, 'priceOverrides:', overrides, 'guitarType:', config.guitarType)
    return overrides
  }, [builderParts, config.guitarType])

  const getPrice = (optionKey, staticOptions, configKey) => {
    if (priceOverrides[optionKey]?.price !== undefined) {
      return priceOverrides[optionKey].price
    }
    return staticOptions[configKey]?.price ?? 0
  }

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
    return override !== undefined ? Number(override) : BASE_PRICE
  }, [priceOverrides])

  const mergedBodyOptions = useMemo(() => {
    const merged = { ...BODY_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedBodyWoodOptions = useMemo(() => {
    const merged = { ...BODY_WOOD_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedBodyFinishOptions = useMemo(() => {
    const merged = { ...BODY_FINISH_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedNeckOptions = useMemo(() => {
    const merged = { ...NECK_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedFretboardOptions = useMemo(() => {
    const merged = { ...FRETBOARD_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedHeadstockOptions = useMemo(() => {
    const merged = { ...HEADSTOCK_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedHeadstockWoodOptions = useMemo(() => {
    const merged = { ...HEADSTOCK_WOOD_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedInlayOptions = useMemo(() => {
    const merged = { ...INLAY_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedBridgeOptions = useMemo(() => {
    const merged = { ...BRIDGE_OPTIONS }
    const bridgeCatPrice = priceOverrides['cat:bridge']?.price
    Object.keys(merged).forEach(key => {
      const specific = getOptionOverride('bridge', key)
      const finalPrice = specific !== undefined ? specific : bridgeCatPrice
      if (finalPrice !== undefined) {
        merged[key] = { ...merged[key], price: finalPrice }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedHardwareOptions = useMemo(() => {
    const merged = { ...HARDWARE_OPTIONS }
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
    const merged = { ...PICKUP_OPTIONS }
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

  const getCategoryPrice = (cat) => priceOverrides[`cat:${cat}`]?.price
  const pickguardOptions = useMemo(
    () =>
      Object.entries(PICKGUARD_OPTIONS_BY_BODY[config.body] ?? PICKGUARD_OPTIONS_BY_BODY.strat).map(([value, option]) => {
        const specific = getOptionOverride('pickguard', value)
        const catPrice = getCategoryPrice('pickguard')
        const finalPrice = specific !== undefined ? specific : catPrice
        return { value, ...(finalPrice !== undefined ? { ...option, price: finalPrice } : option), preview: option.src }
      }),
    [config.body, priceOverrides],
  )
  const knobOptions = useMemo(
    () =>
      Object.entries(KNOB_OPTIONS_BY_BODY[config.body] ?? KNOB_OPTIONS_BY_BODY.strat).map(([value, option]) => {
        const specific = getOptionOverride('hardware', value) ?? getOptionOverride('knobs', value)
        const catPrice = getCategoryPrice('knobs')
        const finalPrice = specific !== undefined ? specific : catPrice
        return { value, ...(finalPrice !== undefined ? { ...option, price: finalPrice } : option), preview: option.src }
      }),
    [config.body, priceOverrides],
  )

  useEffect(() => {
    const validBodies = Object.entries(BODY_OPTIONS)
      .filter(([, opt]) => !opt.types || opt.types.includes(config.guitarType))
      .map(([key]) => key)
    
    if (!validBodies.includes(config.body)) {
      setConfig(prev => ({ ...prev, body: validBodies[0] }))
    }
  }, [config.guitarType])

  useEffect(() => {
    const pickguardKeys = Object.keys(PICKGUARD_OPTIONS_BY_BODY[config.body] ?? PICKGUARD_OPTIONS_BY_BODY.strat)
    const knobKeys = Object.keys(KNOB_OPTIONS_BY_BODY[config.body] ?? KNOB_OPTIONS_BY_BODY.strat)
    const nextPickguard = pickguardKeys.includes(config.pickguard) ? config.pickguard : pickguardKeys[0]
    const nextKnobs = knobKeys.includes(config.knobs) ? config.knobs : knobKeys[0]

    if (nextPickguard !== config.pickguard || nextKnobs !== config.knobs) {
      setConfig(prev => ({
        ...prev,
        pickguard: nextPickguard,
        knobs: nextKnobs,
      }))
    }
  }, [config.body, config.knobs, config.pickguard])

  const updateConfig = useCallback((patch) => {
    setConfig(prev => ({ ...prev, ...patch }))
  }, [])

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG)
  }, [])

  const price = useMemo(() => {
    return (
      dynamicBasePrice +
      (mergedBodyOptions[config.body]?.price ?? BODY_OPTIONS[config.body]?.price ?? 0) +
      (mergedBodyWoodOptions[config.bodyWood]?.price ?? BODY_WOOD_OPTIONS[config.bodyWood]?.price ?? 0) +
      (mergedBodyFinishOptions[config.bodyFinish]?.price ?? BODY_FINISH_OPTIONS[config.bodyFinish]?.price ?? 0) +
      (mergedNeckOptions[config.neck]?.price ?? NECK_OPTIONS[config.neck]?.price ?? 0) +
      (mergedFretboardOptions[config.fretboard]?.price ?? FRETBOARD_OPTIONS[config.fretboard]?.price ?? 0) +
      (mergedHeadstockOptions[config.headstock]?.price ?? HEADSTOCK_OPTIONS[config.headstock]?.price ?? 0) +
      (mergedHeadstockWoodOptions[config.headstockWood]?.price ?? HEADSTOCK_WOOD_OPTIONS[config.headstockWood]?.price ?? 0) +
      (mergedInlayOptions[config.inlays]?.price ?? INLAY_OPTIONS[config.inlays]?.price ?? 0) +
      (mergedBridgeOptions[config.bridge]?.price ?? BRIDGE_OPTIONS[config.bridge]?.price ?? 0) +
      (pickguardOptions.find(option => option.value === config.pickguard)?.price ?? 0) +
      (knobOptions.find(option => option.value === config.knobs)?.price ?? 0) +
      (mergedHardwareOptions[config.hardware]?.price ?? HARDWARE_OPTIONS[config.hardware]?.price ?? 0) +
      (mergedPickupOptions[config.pickups]?.price ?? PICKUP_OPTIONS[config.pickups]?.price ?? 0)
    )
  }, [config, dynamicBasePrice, mergedBodyOptions, mergedBodyWoodOptions, mergedBodyFinishOptions, mergedNeckOptions, mergedFretboardOptions, mergedHeadstockOptions, mergedHeadstockWoodOptions, mergedInlayOptions, mergedBridgeOptions, pickguardOptions, knobOptions, mergedHardwareOptions, mergedPickupOptions])

  const summary = useMemo(
    () => ({
      body: BODY_OPTIONS[config.body]?.label ?? config.body,
      bodyWood: BODY_WOOD_OPTIONS[config.bodyWood]?.label ?? config.bodyWood,
      bodyFinish: BODY_FINISH_OPTIONS[config.bodyFinish]?.label ?? config.bodyFinish,
      neck: NECK_OPTIONS[config.neck]?.label ?? config.neck,
      fretboard: FRETBOARD_OPTIONS[config.fretboard]?.label ?? config.fretboard,
      headstock: HEADSTOCK_OPTIONS[config.headstock]?.label ?? config.headstock,
      headstockWood: HEADSTOCK_WOOD_OPTIONS[config.headstockWood]?.label ?? config.headstockWood,
      inlays: INLAY_OPTIONS[config.inlays]?.label ?? config.inlays,
      bridge: BRIDGE_OPTIONS[config.bridge]?.label ?? config.bridge,
      pickguard: PICKGUARD_OPTIONS_BY_BODY[config.body]?.[config.pickguard]?.label ?? config.pickguard,
      knobs: KNOB_OPTIONS_BY_BODY[config.body]?.[config.knobs]?.label ?? config.knobs,
      hardware: HARDWARE_OPTIONS[config.hardware]?.label ?? config.hardware,
      pickups: PICKUP_OPTIONS[config.pickups]?.label ?? config.pickups,
    }),
    [config],
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
    () => Object.entries(mergedBodyOptions)
      .filter(([, opt]) => !opt.types || opt.types.includes(config.guitarType))
      .map(([value, option]) => ({ value, ...option })),
    [config.guitarType, mergedBodyOptions],
  )
  const guitarTypeOptions = useMemo(
    () => GUITAR_TYPE_OPTIONS,
    [],
  )
  const neckOptions = useMemo(
    () => Object.entries(mergedNeckOptions).map(([value, option]) => ({ value, ...option })),
    [mergedNeckOptions],
  )
  const fretboardOptions = useMemo(
    () => Object.entries(mergedFretboardOptions).map(([value, option]) => ({ value, ...option })),
    [mergedFretboardOptions],
  )
  const headstockOptions = useMemo(
    () => Object.entries(mergedHeadstockOptions).map(([value, option]) => ({ value, ...option, preview: option.logo })),
    [mergedHeadstockOptions],
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
      Object.entries(mergedBridgeOptions).map(([value, option]) => ({
        value,
        ...option,
        preview: option.assets?.[config.hardware] ?? option.assets?.chrome ?? option.assets?.black ?? option.assets?.gold,
      })),
    [config.hardware, mergedBridgeOptions],
  )
  const pickupOptions = useMemo(
    () => Object.entries(mergedPickupOptions).map(([value, option]) => ({ value, ...option })),
    [mergedPickupOptions],
  )
  const hardwareOptions = useMemo(
    () => Object.entries(mergedHardwareOptions).map(([value, option]) => ({ value, ...option })),
    [mergedHardwareOptions],
  )

  const exportConfig = useCallback(() => JSON.stringify(config, null, 2), [config])

  const loadConfig = useCallback((raw) => {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    setConfig(prev => ({
      ...DEFAULT_CONFIG,
      ...prev,
      ...parsed,
    }))
  }, [])

  const pricingBreakdown = useMemo(() => ({
      base: dynamicBasePrice,
      body: mergedBodyOptions[config.body]?.price ?? BODY_OPTIONS[config.body]?.price ?? 0,
      bodyWood: mergedBodyWoodOptions[config.bodyWood]?.price ?? BODY_WOOD_OPTIONS[config.bodyWood]?.price ?? 0,
      bodyFinish: mergedBodyFinishOptions[config.bodyFinish]?.price ?? BODY_FINISH_OPTIONS[config.bodyFinish]?.price ?? 0,
      neck: mergedNeckOptions[config.neck]?.price ?? NECK_OPTIONS[config.neck]?.price ?? 0,
      fretboard: mergedFretboardOptions[config.fretboard]?.price ?? FRETBOARD_OPTIONS[config.fretboard]?.price ?? 0,
      headstock: mergedHeadstockOptions[config.headstock]?.price ?? HEADSTOCK_OPTIONS[config.headstock]?.price ?? 0,
      headstockWood: mergedHeadstockWoodOptions[config.headstockWood]?.price ?? HEADSTOCK_WOOD_OPTIONS[config.headstockWood]?.price ?? 0,
      inlays: mergedInlayOptions[config.inlays]?.price ?? INLAY_OPTIONS[config.inlays]?.price ?? 0,
      bridge: mergedBridgeOptions[config.bridge]?.price ?? BRIDGE_OPTIONS[config.bridge]?.price ?? 0,
      pickguard: pickguardOptions.find(option => option.value === config.pickguard)?.price ?? 0,
      knobs: knobOptions.find(option => option.value === config.knobs)?.price ?? 0,
      hardware: mergedHardwareOptions[config.hardware]?.price ?? HARDWARE_OPTIONS[config.hardware]?.price ?? 0,
      pickups: mergedPickupOptions[config.pickups]?.price ?? PICKUP_OPTIONS[config.pickups]?.price ?? 0
  }), [config, dynamicBasePrice, mergedBodyOptions, mergedBodyWoodOptions, mergedBodyFinishOptions, mergedNeckOptions, mergedFretboardOptions, mergedHeadstockOptions, mergedHeadstockWoodOptions, mergedInlayOptions, mergedBridgeOptions, pickguardOptions, knobOptions, mergedHardwareOptions, mergedPickupOptions])

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
    pricingBreakdown,
    exportConfig,
    loadConfig,
    builder: guitarBuilder,
    loadingPrices,
    refreshPrices,
    options: {
      guitarTypeOptions,
      bodyOptions,
      bodyWoodOptions,
      bodyFinishOptions,
      neckOptions,
      fretboardOptions,
      headstockOptions,
      headstockWoodOptions,
      inlayOptions,
      bridgeOptions,
      pickguardOptions,
      knobOptions,
      pickupOptions,
      hardwareOptions,
      basePrice: dynamicBasePrice,
    },
  }
}
