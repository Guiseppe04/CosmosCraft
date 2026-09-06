import { useEffect, useMemo, useState, useCallback } from 'react'
import axios from 'axios'
import { API } from '../utils/apiConfig'
import { resolveFinishAsset } from '../lib/assetResolver.js'
import {
  BASS_BASE_PRICE,
  BASS_BODY_FINISH_OPTIONS,
  BASS_BODY_OPTIONS,
  BASS_BODY_WOOD_OPTIONS,
  BASS_TOP_WOOD_OPTIONS,
  BASS_BRIDGE_OPTIONS,
  BASS_DEFAULT_CONFIG,
  BASS_FRETBOARD_OPTIONS,
  BASS_FRET_OPTIONS,
  BASS_FINGERBOARD_RADIUS_OPTIONS,
  BASS_NECK_REAR_FINISH_OPTIONS,
  BASS_NECK_OPTIONS,
  BASS_HEADSTOCK_WOOD_OPTIONS,
  BASS_HEADSTOCK_STYLE_OPTIONS,
  BASS_NECK_STYLE_OPTIONS,
  BASS_HARDWARE_OPTIONS,
  BASS_INLAY_OPTIONS,
  BASS_INLAY_SHAPE_OPTIONS,
  BASS_INLAY_MATERIAL_OPTIONS,
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
  BASS_SCALE_LENGTH_OPTIONS,
  bassAsset,
  bassBuilder,
  VADER_PICKUP_OPTIONS,
  VADER_STRAP_BUTTON_OPTIONS,
  VADER_ELECTRONICS_CAVITY_COVER_OPTIONS,
  // New schema option constants (reused from guitar builder)
  DEXTERITY_OPTIONS,
  STRING_COUNT_OPTIONS,
  MULTISCALE_OPTIONS,
  CASE_OPTIONS,
  FINISH_TYPE_OPTIONS,
  TOP_COAT_OPTIONS,
  BURST_FINISH_OPTIONS,
  NECK_CONSTRUCTION_OPTIONS,
  FRET_OPTIONS,
  NECK_REAR_FINISH_OPTIONS,
  HEADSTOCK_SHAPE_OPTIONS,
  TRUSS_ROD_COVER_OPTIONS,
  ELECTRONICS_TYPE_OPTIONS,
  PICKUP_CONFIGURATION_OPTIONS,
  PICKUP_MODEL_BRIDGE_OPTIONS,
  PICKUP_MODEL_MIDDLE_OPTIONS,
  PICKUP_MODEL_NECK_OPTIONS,
  PICKUP_COLOR_OPTIONS,
  PICKUP_POLE_COLOR_OPTIONS,
  CONTROLS_OPTIONS,
  SADDLE_OPTIONS,
  NUT_OPTIONS,
  TUNING_OPTIONS,
  TUNING_DISCLAIMER,
  STRING_BRAND_OPTIONS,
  OUTPUT_JACK_OPTIONS,
  STRAP_BUTTON_OPTIONS,
  TUNER_BUTTON_OPTIONS,
  ELECTRONICS_CAVITY_COVER_OPTIONS,
  TREMOLO_COVER_OPTIONS_BY_BRIDGE,
  KNOB_STYLE_OPTIONS,
} from '../lib/bassBuilderData.js'

const phpFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const API_URL = API

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
    const registerOverride = (key, value) => {
      if (!key) return
      if (overrides[key] === undefined) {
        overrides[key] = value
      }
    }

    builderParts.forEach(part => {
      const partType = typeof part.guitar_type === 'string' ? part.guitar_type.trim().toLowerCase() : ''
      const matchesType = !partType || partType === 'bass'
      if (matchesType && part.price !== undefined) {
        const metadata = part?.metadata && typeof part.metadata === 'object' ? part.metadata : {}
        const normalizedCategory = typeof part.part_category === 'string' ? part.part_category.trim().toLowerCase() : ''
        const normalizedTypeMapping = typeof part.type_mapping === 'string' ? part.type_mapping.trim() : ''
        const normalizedNameKey = typeof part.name === 'string' ? part.name.trim().toLowerCase().replace(/\s+/g, '') : ''
        const normalizedOptionKey = typeof metadata.option_key === 'string' ? metadata.option_key.trim().toLowerCase() : ''
        const normalizedVariant = typeof metadata.variant === 'string' ? metadata.variant.trim().toLowerCase() : ''
        const overrideValue = { price: Number(part.price), partCategory: normalizedCategory || part.part_category }

        if (normalizedTypeMapping) {
          registerOverride(normalizedTypeMapping, overrideValue)
          registerOverride(normalizedTypeMapping.toLowerCase(), overrideValue)
        }
        if (normalizedOptionKey) {
          registerOverride(normalizedOptionKey, overrideValue)
          if (normalizedCategory) {
            registerOverride(`catname:${normalizedCategory}:${normalizedOptionKey}`, overrideValue)
          }
          if (normalizedCategory && normalizedVariant) {
            registerOverride(`variant:${normalizedCategory}:${normalizedVariant}:${normalizedOptionKey}`, overrideValue)
          }
        }
        if (normalizedCategory && normalizedNameKey) {
          registerOverride(`catname:${normalizedCategory}:${normalizedNameKey}`, overrideValue)
        }
        if (normalizedCategory) {
          registerOverride(`cat:${normalizedCategory}`, overrideValue)
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
  const getOptionOverride = (category, optionKey, variant = '') => {
    const key = String(optionKey || '').trim()
    const normalized = key.toLowerCase()
    const normalizedVariant = String(variant || '').trim().toLowerCase()
    return (
      priceOverrides[`variant:${category}:${normalizedVariant}:${normalized}`]?.price ??
      priceOverrides[`catname:${category}:${normalized}`]?.price ??
      priceOverrides[key]?.price ??
      priceOverrides[normalized]?.price
    )
  }

  const getStaticOptionPrice = (optionMap, configKey) => {
    if (!configKey) return 0
    return optionMap[configKey]?.price ?? 0
  }

  const mergeOptionsFromBuilderParts = useCallback((baseOptions, { partCategory, typeMappings = [] } = {}) => {
    const merged = { ...baseOptions }
    const normalizedType = String(config.bassType || 'vader').trim().toLowerCase()
    const normalizedTypeMappings = typeMappings.map(mapping => String(mapping).trim().toLowerCase())

    builderParts.forEach((part) => {
      const partType = typeof part.bass_type === 'string' ? part.bass_type.trim().toLowerCase() : ''
      const matchesType = !partType || partType === normalizedType
      if (!matchesType) return

      const normalizedCategory = typeof part.part_category === 'string' ? part.part_category.trim().toLowerCase() : ''
      const normalizedTypeMapping = typeof part.type_mapping === 'string' ? part.type_mapping.trim().toLowerCase() : ''
      const metadata = part?.metadata && typeof part.metadata === 'object' ? part.metadata : {}
      const optionKey = typeof metadata.option_key === 'string' ? metadata.option_key.trim() : ''
      const variant = typeof metadata.variant === 'string' ? metadata.variant.trim() : ''

      if (!optionKey) return
      if (partCategory && normalizedCategory !== String(partCategory).trim().toLowerCase()) return
      if (normalizedTypeMappings.length > 0 && !normalizedTypeMappings.includes(normalizedTypeMapping)) return

      const normalizedOptionKey = String(optionKey).trim()
      const existingOption = merged[normalizedOptionKey]
      const nextOption = {
        ...(existingOption || {}),
        label: existingOption?.label || part?.name || normalizedOptionKey,
        note: existingOption?.note || part?.description || '',
        price: Number(part?.price) || existingOption?.price || 0,
      }

      if (part?.image_url) nextOption.src = part.image_url
      if (variant) nextOption.variant = variant
      merged[normalizedOptionKey] = nextOption
    })

    return merged
  }, [builderParts, config.bassType])

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

  const mergedFingerboardRadiusOptions = useMemo(() => {
    const merged = { ...BASS_FINGERBOARD_RADIUS_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides])

  const mergedFretOptions = useMemo(() => ({ ...BASS_FRET_OPTIONS }), [])

  const mergedNeckRearFinishOptions = useMemo(() => {
    const topCoat = config.topCoat
    const merged = {}
    Object.entries(BASS_NECK_REAR_FINISH_OPTIONS).forEach(([key, opt]) => {
      if (!topCoat || opt.visibleTopCoats.includes(topCoat)) {
        merged[key] = opt
      }
    })
    return merged
  }, [config.topCoat])

  const mergedHeadstockWoodOptions = useMemo(() => {
    if (config.bassType === 'vader') return {}
    const merged = { ...BASS_HEADSTOCK_WOOD_OPTIONS }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [priceOverrides, config.bassType])

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

  const mergedBackplateOptions = useMemo(() => {
    const merged = {}
    Object.keys(BASS_BACKPLATE_OPTIONS).forEach(bodyKey => {
      merged[bodyKey] = { ...BASS_BACKPLATE_OPTIONS[bodyKey] }
      Object.keys(merged[bodyKey]).forEach(key => {
        const specific = getOptionOverride('hardware', key)
        if (specific !== undefined) {
          merged[bodyKey][key] = { ...merged[bodyKey][key], price: specific }
        }
      })
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
        const specific = getOptionOverride('bridge', key, bodyKey)
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
        const specific = getOptionOverride('pickguard', key, bodyKey)
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
        const specific = getOptionOverride('knobs', key, bodyKey) ?? getOptionOverride('hardware', key, bodyKey)
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

  const mergedDexterityOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(DEXTERITY_OPTIONS, { partCategory: 'misc', typeMappings: ['dexterity'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedMultiscaleOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(MULTISCALE_OPTIONS, { partCategory: 'misc', typeMappings: ['multiscale'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedScaleLengthOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(BASS_SCALE_LENGTH_OPTIONS, { partCategory: 'misc', typeMappings: ['scaleLength'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedCaseOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(CASE_OPTIONS, { partCategory: 'misc', typeMappings: ['case'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedTopWoodOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(BASS_TOP_WOOD_OPTIONS, { partCategory: 'misc', typeMappings: ['topWood'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedFinishTypeOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(FINISH_TYPE_OPTIONS, { partCategory: 'misc', typeMappings: ['finishType'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedTopCoatOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(TOP_COAT_OPTIONS, { partCategory: 'misc', typeMappings: ['topCoat'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedBurstFinishOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(BURST_FINISH_OPTIONS, { partCategory: 'misc', typeMappings: ['burstFinish'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedNeckConstructionOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(NECK_CONSTRUCTION_OPTIONS, { partCategory: 'misc', typeMappings: ['neckConstruction'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedInlayShapeOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(BASS_INLAY_SHAPE_OPTIONS, { partCategory: 'misc', typeMappings: ['inlayShape', 'inlay-shape', 'inlayshape'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

const UNAVAILABLE_MATERIALS_BY_SHAPE = {
  blocks: ['luminlay'],
}

const mergedInlayMaterialOptions = useMemo(() => {
  const merged = mergeOptionsFromBuilderParts(BASS_INLAY_MATERIAL_OPTIONS, { partCategory: 'misc', typeMappings: ['inlayMaterial', 'inlay-material', 'inlaymaterial'] })
  Object.keys(merged).forEach(key => {
    if (priceOverrides[key] !== undefined) {
      merged[key] = { ...merged[key], price: priceOverrides[key].price }
    }
  })
  const excluded = UNAVAILABLE_MATERIALS_BY_SHAPE[config.inlayShape] || []
  excluded.forEach(key => delete merged[key])
  return merged
}, [mergeOptionsFromBuilderParts, priceOverrides, config.inlayShape])

  const mergedHeadstockShapeOptions = useMemo(() => {
    if (config.bassType === 'vader') return {}
    const merged = mergeOptionsFromBuilderParts(HEADSTOCK_SHAPE_OPTIONS, { partCategory: 'misc', typeMappings: ['headstockShape'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides, config.bassType])

  const mergedTrussRodCoverOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(TRUSS_ROD_COVER_OPTIONS, { partCategory: 'misc', typeMappings: ['trussRodCover'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedElectronicsTypeOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(ELECTRONICS_TYPE_OPTIONS, { partCategory: 'misc', typeMappings: ['electronicsType'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedPickupConfigurationOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(PICKUP_CONFIGURATION_OPTIONS, { partCategory: 'misc', typeMappings: ['pickupConfiguration'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedBridgePickupModelOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(PICKUP_MODEL_BRIDGE_OPTIONS, { partCategory: 'misc', typeMappings: ['bridgePickupModel'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedMiddlePickupModelOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(PICKUP_MODEL_MIDDLE_OPTIONS, { partCategory: 'misc', typeMappings: ['middlePickupModel'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedNeckPickupModelOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(PICKUP_MODEL_NECK_OPTIONS, { partCategory: 'misc', typeMappings: ['neckPickupModel'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedPickupColorOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(PICKUP_COLOR_OPTIONS, { partCategory: 'misc', typeMappings: ['pickupColor'] })
    Object.keys(merged).forEach(key => {
      const specific = getOptionOverride('misc', key)
      if (specific !== undefined) {
        merged[key] = { ...merged[key], price: specific }
      }
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedPickupPoleColorOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(PICKUP_POLE_COLOR_OPTIONS, { partCategory: 'misc', typeMappings: ['pickupPoleColor'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedControlsOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(CONTROLS_OPTIONS, { partCategory: 'misc', typeMappings: ['controls'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedSaddleOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(SADDLE_OPTIONS, { partCategory: 'misc', typeMappings: ['saddle'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedNutOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(NUT_OPTIONS, { partCategory: 'misc', typeMappings: ['nut'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedTuningOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(TUNING_OPTIONS, { partCategory: 'misc', typeMappings: ['tuning'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedStringBrandOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(STRING_BRAND_OPTIONS, { partCategory: 'misc', typeMappings: ['stringBrand'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedOutputJackOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(OUTPUT_JACK_OPTIONS, { partCategory: 'misc', typeMappings: ['outputJack'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedStrapButtonOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(STRAP_BUTTON_OPTIONS, { partCategory: 'misc', typeMappings: ['strapButtons'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedTunerButtonOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(TUNER_BUTTON_OPTIONS, { partCategory: 'misc', typeMappings: ['tunerButtons'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedElectronicsCavityCoverOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(ELECTRONICS_CAVITY_COVER_OPTIONS, { partCategory: 'misc', typeMappings: ['electronicsCavityCover'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const tremoloCoverOptions = useMemo(() => {
    const byBridge = TREMOLO_COVER_OPTIONS_BY_BRIDGE[config.bridge]
    if (!byBridge) return {}
    const merged = { ...byBridge }
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key]?.price !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [config.bridge, TREMOLO_COVER_OPTIONS_BY_BRIDGE, priceOverrides])

  const getBridgeKeysForStrings = useCallback((bassType, strings) => {
    const allKeys = Object.keys(BASS_BRIDGE_OPTIONS[bassType] ?? BASS_BRIDGE_OPTIONS.vader)
    const wantsFive = String(strings) === '5'
    const fiveKeys = allKeys.filter((key) => /(^|[^0-9])5([^0-9]|$)/i.test(key))
    const fourKeys = allKeys.filter((key) => !/(^|[^0-9])5([^0-9]|$)/i.test(key))
    const preferred = wantsFive ? fiveKeys : fourKeys
    return preferred.length > 0 ? preferred : allKeys
  }, [])

  useEffect(() => {
    const pickguardKeys = Object.keys(BASS_PICKGUARD_OPTIONS[config.bassType] ?? BASS_PICKGUARD_OPTIONS.vader)
    const knobKeys = Object.keys(BASS_KNOB_OPTIONS[config.bassType] ?? BASS_KNOB_OPTIONS.vader)
    const bridgeKeys = getBridgeKeysForStrings(config.bassType, config.strings)
    const headstockWoodKeys = Object.keys(BASS_HEADSTOCK_WOOD_OPTIONS)
    const headstockShapeKeys = Object.keys(HEADSTOCK_SHAPE_OPTIONS)

    const isHeadless = config.bassType === 'vader'
    
    const nextPickguard = pickguardKeys.includes(config.pickguard) ? config.pickguard : pickguardKeys[0]
    const nextKnobs = knobKeys.includes(config.knobs) ? config.knobs : knobKeys[0]
    const nextBridge = bridgeKeys.includes(config.bridge) ? config.bridge : bridgeKeys[0]
    const nextHeadstockWood = isHeadless || !headstockWoodKeys.includes(config.headstockWood) ? headstockWoodKeys[0] : config.headstockWood
    const nextHeadstockShape = isHeadless || !headstockShapeKeys.includes(config.headstockShape) ? headstockShapeKeys[0] : config.headstockShape

    if (
      nextPickguard !== config.pickguard ||
      nextKnobs !== config.knobs ||
      nextBridge !== config.bridge ||
      nextHeadstockWood !== config.headstockWood ||
      nextHeadstockShape !== config.headstockShape
    ) {
      setConfig(prev => ({
        ...prev,
        pickguard: nextPickguard,
        knobs: nextKnobs,
        bridge: nextBridge,
        headstockWood: nextHeadstockWood,
        headstockShape: nextHeadstockShape,
      }))
    }
  }, [config.bassType, config.strings, config.knobs, config.pickguard, config.bridge, config.logo, config.headstockWood, config.headstockShape, getBridgeKeysForStrings])

  // Reset neckRearFinish when topCoat changes such that the previously
  // selected value is no longer allowed. Per spec:
  //   topCoat='tungOil'      -> hide entire neckRearFinish option
  //   topCoat='clearGloss'   -> clearGlossNeck, tungOilNeck, satinMatteNeck
  //   topCoat='rawTone'      -> clearGlossNeck, tungOilNeck
  //   topCoat='satinMatte'   -> tungOilNeck, satinMatteNeck
  useEffect(() => {
    if (config.topCoat === 'tungOil') {
      if (config.neckRearFinish !== 'none' && config.neckRearFinish) {
        setConfig(prev => ({ ...prev, neckRearFinish: 'none' }))
      }
      return
    }
    const allowed = Object.entries(BASS_NECK_REAR_FINISH_OPTIONS)
      .filter(([, opt]) => opt.visibleTopCoats.includes(config.topCoat))
      .map(([key]) => key)
    if (config.neckRearFinish && config.neckRearFinish !== 'none' && !allowed.includes(config.neckRearFinish)) {
      setConfig(prev => ({ ...prev, neckRearFinish: allowed[0] || 'none' }))
    }
  }, [config.topCoat, config.neckRearFinish])

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
      (mergedFingerboardRadiusOptions[config.fingerboardRadius]?.price ?? 0) +
      (mergedFretboardOptions[config.fretboard]?.price ?? BASS_FRETBOARD_OPTIONS[config.fretboard]?.price ?? 0) +
      (mergedFretOptions[config.frets]?.price ?? BASS_FRET_OPTIONS[config.frets]?.price ?? 0) +
      (BASS_NECK_REAR_FINISH_OPTIONS[config.neckRearFinish]?.price ?? 0) +
      (mergedHeadstockWoodOptions[config.headstockWood]?.price ?? BASS_HEADSTOCK_WOOD_OPTIONS[config.headstockWood]?.price ?? 0) +
      (mergedHeadstockStyleOptions[config.headstockStyle]?.price ?? BASS_HEADSTOCK_STYLE_OPTIONS[config.headstockStyle]?.price ?? 0) +
      (mergedNeckStyleOptions[config.neckStyle]?.price ?? BASS_NECK_STYLE_OPTIONS[config.neckStyle]?.price ?? 0) +
      (mergedInlayShapeOptions[config.inlayShape]?.price ?? BASS_INLAY_SHAPE_OPTIONS[config.inlayShape]?.price ?? 0) +
      (mergedInlayMaterialOptions[config.inlayMaterial]?.price ?? BASS_INLAY_MATERIAL_OPTIONS[config.inlayMaterial]?.price ?? 0) +
      (mergedInlayOptions[config.inlays]?.price ?? BASS_INLAY_OPTIONS[config.inlays]?.price ?? 0) +
      (mergedBackplateOptions[config.bassType]?.[config.backplate]?.price ?? BASS_BACKPLATE_OPTIONS[config.bassType]?.[config.backplate]?.price ?? 0) +
      (mergedPickupScrewOptions[config.bassType]?.[config.pickupScrews]?.price ?? BASS_PICKUP_SCREW_OPTIONS[config.bassType]?.[config.pickupScrews]?.price ?? 0) +
      (mergedControlPlateOptions[config.controlPlate]?.price ?? BASS_CONTROL_PLATE_OPTIONS[config.controlPlate]?.price ?? 0) +
      (mergedBridgeOptions[config.bassType]?.[config.bridge]?.price ?? BASS_BRIDGE_OPTIONS[config.bassType]?.[config.bridge]?.price ?? 0) +
      (mergedPickguardOptions[config.bassType]?.[config.pickguard]?.price ?? BASS_PICKGUARD_OPTIONS[config.bassType]?.[config.pickguard]?.price ?? 0) +
      (mergedKnobOptions[config.bassType]?.[config.knobs]?.price ?? BASS_KNOB_OPTIONS[config.bassType]?.[config.knobs]?.price ?? 0) +
      (mergedHardwareOptions[config.hardware]?.price ?? BASS_HARDWARE_OPTIONS[config.hardware]?.price ?? 0) +
      (mergedPickupOptions[config.pickups]?.price ?? BASS_PICKUP_OPTIONS[config.pickups]?.price ?? 0) +
      (mergedPickupTypeStyleOptions[config.pickupTypeStyle]?.price ?? BASS_PICKUP_TYPE_STYLE_OPTIONS[config.pickupTypeStyle]?.price ?? 0) +
      (mergedStringOptions[config.strings]?.price ?? BASS_STRING_OPTIONS[config.strings]?.price ?? 0) +
      // General options
      (mergedDexterityOptions[config.dexterity]?.price ?? 0) +
      (mergedMultiscaleOptions[config.multiscale]?.price ?? 0) +
      (mergedScaleLengthOptions[config.scaleLength]?.price ?? 0) +
      (mergedCaseOptions[config.case]?.price ?? 0) +
      // Body new options
      (mergedTopWoodOptions[config.topWood]?.price ?? 0) +
      (mergedFinishTypeOptions[config.finishType]?.price ?? 0) +
      (mergedTopCoatOptions[config.topCoat]?.price ?? 0) +
      (mergedBurstFinishOptions[config.burstFinish]?.price ?? 0) +
      // Neck new options
      (mergedNeckConstructionOptions[config.neckConstruction]?.price ?? 0) +
      (mergedInlayShapeOptions[config.inlayShape]?.price ?? 0) +
      (mergedInlayMaterialOptions[config.inlayMaterial]?.price ?? 0) +
      (mergedFretOptions[config.frets]?.price ?? 0) +
      (mergedNeckRearFinishOptions[config.neckRearFinish]?.price ?? 0) +
      (mergedHeadstockShapeOptions[config.headstockShape]?.price ?? 0) +
      (mergedTrussRodCoverOptions[config.trussRodCover]?.price ?? 0) +
      // Electronics new options
      (mergedElectronicsTypeOptions[config.electronicsType]?.price ?? 0) +
      (mergedPickupConfigurationOptions[config.pickupConfiguration]?.price ?? 0) +
      (mergedBridgePickupModelOptions[config.bridgePickupModel]?.price ?? 0) +
      (mergedMiddlePickupModelOptions[config.middlePickupModel]?.price ?? 0) +
      (mergedNeckPickupModelOptions[config.neckPickupModel]?.price ?? 0) +
      (mergedPickupColorOptions[config.pickupColor]?.price ?? 0) +
      (mergedPickupPoleColorOptions[config.pickupPoleColor]?.price ?? 0) +
      (mergedControlsOptions[config.controls]?.price ?? 0) +
      // Hardware new options
      (mergedSaddleOptions[config.saddle]?.price ?? 0) +
      (mergedNutOptions[config.nut]?.price ?? 0) +
      (mergedTuningOptions[config.tuning]?.price ?? 0) +
      (mergedStringBrandOptions[config.stringBrand]?.price ?? 0) +
      (mergedOutputJackOptions[config.outputJack]?.price ?? 0) +
      (mergedStrapButtonOptions[config.strapButtons]?.price ?? 0) +
      (mergedTunerButtonOptions[config.tunerButtons]?.price ?? 0) +
      (mergedElectronicsCavityCoverOptions[config.electronicsCavityCover]?.price ?? 0) +
      (tremoloCoverOptions[config.tremoloCover]?.price ?? 0)
    )
  }, [
    config, dynamicBasePrice,
    mergedBodyOptions, mergedBodyWoodOptions, mergedBodyFinishOptions,
    mergedNeckOptions, mergedFretboardOptions, mergedHeadstockWoodOptions,
    mergedHeadstockStyleOptions, mergedNeckStyleOptions, mergedInlayOptions,
     mergedBackplateOptions, mergedPickupScrewOptions,
    mergedControlPlateOptions, mergedBridgeOptions, mergedPickguardOptions,
    mergedKnobOptions, mergedHardwareOptions, mergedPickupOptions,
    mergedPickupTypeStyleOptions, mergedStringOptions,
    mergedDexterityOptions, mergedMultiscaleOptions, mergedScaleLengthOptions,
    mergedCaseOptions, mergedTopWoodOptions,
    mergedFinishTypeOptions, mergedTopCoatOptions, mergedBurstFinishOptions,
    mergedNeckConstructionOptions, mergedInlayShapeOptions,
    mergedInlayMaterialOptions, mergedFretOptions,
    mergedNeckRearFinishOptions, mergedHeadstockShapeOptions,
    mergedTrussRodCoverOptions, mergedElectronicsTypeOptions,
    mergedPickupConfigurationOptions, mergedBridgePickupModelOptions,
    mergedMiddlePickupModelOptions, mergedNeckPickupModelOptions,
    mergedPickupColorOptions, mergedPickupPoleColorOptions,
    mergedControlsOptions, mergedSaddleOptions, mergedNutOptions,
    mergedTuningOptions, mergedStringBrandOptions, mergedOutputJackOptions,
    mergedStrapButtonOptions, mergedTunerButtonOptions,
    mergedElectronicsCavityCoverOptions, tremoloCoverOptions,
  ])

  const summary = useMemo(
    () => ({
      body: BASS_BODY_OPTIONS[config.bassType]?.label ?? config.bassType,
      bodyWood: BASS_BODY_WOOD_OPTIONS[config.bodyWood]?.label ?? config.bodyWood,
      bodyFinish: BASS_BODY_FINISH_OPTIONS[config.bodyFinish]?.label ?? config.bodyFinish,
      neck: BASS_NECK_OPTIONS[config.neck]?.label ?? config.neck,
      fingerboardRadius: BASS_FINGERBOARD_RADIUS_OPTIONS[config.fingerboardRadius]?.label ?? config.fingerboardRadius,
      fretboard: BASS_FRETBOARD_OPTIONS[config.fretboard]?.label ?? config.fretboard,
      frets: BASS_FRET_OPTIONS[config.frets]?.label ?? config.frets,
      neckRearFinish: BASS_NECK_REAR_FINISH_OPTIONS[config.neckRearFinish]?.label ?? config.neckRearFinish,
      headstockWood: BASS_HEADSTOCK_WOOD_OPTIONS[config.headstockWood]?.label ?? config.headstockWood,
      headstockStyle: BASS_HEADSTOCK_STYLE_OPTIONS[config.headstockStyle]?.label ?? config.headstockStyle,
      neckStyle: BASS_NECK_STYLE_OPTIONS[config.neckStyle]?.label ?? config.neckStyle,
      inlayShape: BASS_INLAY_SHAPE_OPTIONS[config.inlayShape]?.label ?? config.inlayShape,
      inlayMaterial: BASS_INLAY_MATERIAL_OPTIONS[config.inlayMaterial]?.label ?? config.inlayMaterial,
      inlays: BASS_INLAY_OPTIONS[config.inlays]?.label ?? config.inlays,
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
      // General options
      dexterity: DEXTERITY_OPTIONS[config.dexterity]?.label ?? config.dexterity,
      multiscale: MULTISCALE_OPTIONS[config.multiscale]?.label ?? config.multiscale,
      scaleLength: BASS_SCALE_LENGTH_OPTIONS[config.scaleLength]?.label ?? config.scaleLength,
      caseType: CASE_OPTIONS[config.case]?.label ?? config.case,
      // Body new options
      bevel: [config.bevel]?.label ?? config.bevel,
      topWood: BASS_TOP_WOOD_OPTIONS[config.topWood]?.label ?? config.topWood,
      finishType: FINISH_TYPE_OPTIONS[config.finishType]?.label ?? config.finishType,
      topCoat: TOP_COAT_OPTIONS[config.topCoat]?.label ?? config.topCoat,
      burstFinish: BURST_FINISH_OPTIONS[config.burstFinish]?.label ?? config.burstFinish,
      // Neck new options
      neckConstruction: NECK_CONSTRUCTION_OPTIONS[config.neckConstruction]?.label ?? config.neckConstruction,
      inlayShape: BASS_INLAY_SHAPE_OPTIONS[config.inlayShape]?.label ?? config.inlayShape,
      inlayMaterial: BASS_INLAY_MATERIAL_OPTIONS[config.inlayMaterial]?.label ?? config.inlayMaterial,
      frets: FRET_OPTIONS[config.frets]?.label ?? config.frets,
      neckRearFinish: NECK_REAR_FINISH_OPTIONS[config.neckRearFinish]?.label ?? config.neckRearFinish,
      headstockShape: HEADSTOCK_SHAPE_OPTIONS[config.headstockShape]?.label ?? config.headstockShape,
      trussRodCover: TRUSS_ROD_COVER_OPTIONS[config.trussRodCover]?.label ?? config.trussRodCover,
      // Electronics new options
      electronicsType: ELECTRONICS_TYPE_OPTIONS[config.electronicsType]?.label ?? config.electronicsType,
      pickupConfiguration: PICKUP_CONFIGURATION_OPTIONS[config.pickupConfiguration]?.label ?? config.pickupConfiguration,
      bridgePickupModel: PICKUP_MODEL_BRIDGE_OPTIONS[config.bridgePickupModel]?.label ?? config.bridgePickupModel,
      middlePickupModel: PICKUP_MODEL_MIDDLE_OPTIONS[config.middlePickupModel]?.label ?? config.middlePickupModel,
      neckPickupModel: PICKUP_MODEL_NECK_OPTIONS[config.neckPickupModel]?.label ?? config.neckPickupModel,
      pickupColor: PICKUP_COLOR_OPTIONS[config.pickupColor]?.label ?? config.pickupColor,
      pickupColorVariant: PICKUP_COLOR_OPTIONS[config.pickupColor]?.variants?.[config.pickupColorVariant]?.label ?? config.pickupColorVariant,
      pickupPoleColor: PICKUP_POLE_COLOR_OPTIONS[config.pickupPoleColor]?.label ?? config.pickupPoleColor,
      pickupPaintedColor: PICKUP_COLOR_OPTIONS[config.pickupColor]?.variants?.[config.pickupPaintedColor]?.label ?? config.pickupPaintedColor,
      pickupWoodType: config.pickupWoodType,
      controls: CONTROLS_OPTIONS[config.controls]?.label ?? config.controls,
      // Hardware new options
      saddle: SADDLE_OPTIONS[config.saddle]?.label ?? config.saddle,
      nut: NUT_OPTIONS[config.nut]?.label ?? config.nut,
      tuning: TUNING_OPTIONS[config.tuning]?.label ?? config.tuning,
      tuningDisclaimer: config.tuning === 'custom' ? TUNING_DISCLAIMER : '',
      stringBrand: STRING_BRAND_OPTIONS[config.stringBrand]?.label ?? config.stringBrand,
      outputJack: OUTPUT_JACK_OPTIONS[config.outputJack]?.label ?? config.outputJack,
      strapButtons: STRAP_BUTTON_OPTIONS[config.strapButtons]?.label ?? config.strapButtons,
      tunerButtons: TUNER_BUTTON_OPTIONS[config.tunerButtons]?.label ?? config.tunerButtons,
      electronicsCavityCover: ELECTRONICS_CAVITY_COVER_OPTIONS[config.electronicsCavityCover]?.label ?? config.electronicsCavityCover,
      tremoloCover: TREMOLO_COVER_OPTIONS_BY_BRIDGE[config.bridge]?.[config.tremoloCover]?.label ?? config.tremoloCover,
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
    () => {
      const bridgeMap = mergedBridgeOptions[config.bassType] ?? mergedBridgeOptions.vader
      const allowedKeys = new Set(getBridgeKeysForStrings(config.bassType, config.strings))
      return Object.entries(bridgeMap).filter(([value]) => allowedKeys.has(value)).map(([value, option]) => ({
        value,
        ...option,
        preview: option.assets?.[config.hardware] ?? option.assets?.chrome ?? option.assets?.black ?? option.assets?.gold,
      }))
    },
    [config.hardware, config.bassType, config.strings, getBridgeKeysForStrings, mergedBridgeOptions],
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
      config.bassType === 'vader' ? [] : Object.entries(mergedKnobOptions[config.bassType] ?? mergedKnobOptions.vader).map(([value, option]) => ({
        value,
        ...option,
        preview: option.src,
      })),
    [config.bassType, mergedKnobOptions],
  )
  const pickupOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(mergedPickupOptions).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedPickupOptions],
  )
  const pickupConfigOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(BASS_PICKUP_CONFIG_OPTIONS).map(([value, option]) => ({ value, ...option })),
    [config.bassType],
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

  const fingerboardRadiusOptions = useMemo(
    () => Object.entries(mergedFingerboardRadiusOptions).map(([value, option]) => ({ value, ...option })),
    [mergedFingerboardRadiusOptions],
  )

  const fretOptions = useMemo(
    () => Object.entries(mergedFretOptions).map(([value, option]) => ({ value, ...option })),
    [mergedFretOptions],
  )

  const neckRearFinishOptions = useMemo(
    () => Object.entries(mergedNeckRearFinishOptions).map(([value, option]) => ({ value, ...option })),
    [mergedNeckRearFinishOptions],
  )

  const neckWoodOptionsByGroup = useMemo(() => {
    const groups = { '1piece': [], '3piece': [], '5piece': [], '7piece': [] }
    Object.entries(mergedNeckOptions).forEach(([value, opt]) => {
      const group = opt.group || '1piece'
      if (!groups[group]) groups[group] = []
      groups[group].push({ value, ...opt })
    })
    return groups
  }, [mergedNeckOptions])
  const pickupTypeStyleOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(mergedPickupTypeStyleOptions).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedPickupTypeStyleOptions],
  )
  const hardwareOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(mergedHardwareOptions).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedHardwareOptions],
  )
  const vaderHardwareOptions = useMemo(
    () => config.bassType === 'vader' ? [
      { value: 'chrome', label: 'Chrome', note: 'Standard bright hardware', price: 0 },
      { value: 'black', label: 'Black', note: 'Stealth hardware', price: 45 },
    ] : [],
    [config.bassType],
  )
  const backplateOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(mergedBackplateOptions[config.bassType] ?? mergedBackplateOptions.vader).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedBackplateOptions],
  )
  const pickupScrewOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(mergedPickupScrewOptions[config.bassType] ?? mergedPickupScrewOptions.vader).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedPickupScrewOptions],
  )
  const controlPlateOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(mergedControlPlateOptions).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedControlPlateOptions],
  )

  const dexterityOptions = useMemo(
    () => Object.entries(mergedDexterityOptions).map(([value, option]) => ({ value, ...option })),
    [mergedDexterityOptions],
  )
  const multiscaleOptions = useMemo(
    () => Object.entries(mergedMultiscaleOptions).map(([value, option]) => ({ value, ...option })),
    [mergedMultiscaleOptions],
  )
  const scaleLengthOptions = useMemo(
    () => Object.entries(mergedScaleLengthOptions).map(([value, option]) => ({ value, ...option })),
    [mergedScaleLengthOptions],
  )
  const caseOptions = useMemo(
    () => Object.entries(mergedCaseOptions).map(([value, option]) => ({ value, ...option })),
    [mergedCaseOptions],
  )
  const topWoodOptions = useMemo(
    () => Object.entries(mergedTopWoodOptions).map(([value, option]) => ({ value, ...option })),
    [mergedTopWoodOptions],
  )
  const finishTypeOptions = useMemo(
    () => Object.entries(mergedFinishTypeOptions).map(([value, option]) => ({ value, ...option })),
    [mergedFinishTypeOptions],
  )
  const topCoatOptions = useMemo(
    () => Object.entries(mergedTopCoatOptions).map(([value, option]) => ({ value, ...option })),
    [mergedTopCoatOptions],
  )
  const finishColorOptions = useMemo(() => {
    const finishType = config.finishType
    if (!finishType || finishType === 'solid') return []
    const fallbackMap = {
      metallic: [
        { value: 'black-magic-metallic', label: 'Black Magic Metallic', price: 35 },
        { value: 'blue-mist-metallic', label: 'Blue Mist Metallic', price: 35 },
        { value: 'candy-red-metallic', label: 'Candy Red Metallic', price: 35 },
        { value: 'gold', label: 'Gold Metallic', price: 35 },
        { value: 'grape-jelly-metallic', label: 'Grape Jelly Metallic', price: 35 },
        { value: 'green-to-purple-color-shift', label: 'Green to Purple Color Shift', price: 35 },
        { value: 'gunmetal-gray-metallic', label: 'Gunmetal Gray Metallic', price: 35 },
        { value: 'lambo-orange-metallic', label: 'Lambo Orange Metallic', price: 35 },
        { value: 'metallic-peach', label: 'Metallic Peach', price: 35 },
      ],
      translucent: [
        { value: 'aqua', label: 'Aqua', price: 35 },
        { value: 'emerald-green', label: 'Emerald Green', price: 35 },
        { value: 'moss-green', label: 'Moss Green', price: 35 },
        { value: 'orange', label: 'Orange', price: 35 },
        { value: 'pink', label: 'Pink', price: 35 },
        { value: 'purple', label: 'Purple', price: 35 },
        { value: 'red', label: 'Red', price: 35 },
        { value: 'sapphire-blue', label: 'Sapphire Blue', price: 35 },
        { value: 'teal', label: 'Teal', price: 35 },
        { value: 'tigers-eye', label: "Tiger's Eye", price: 35 },
        { value: 'trans-black', label: 'Trans Black', price: 35 },
        { value: 'wine', label: 'Wine', price: 35 },
      ],
      sparkle: [
        { value: 'aqua', label: 'Aqua Sparkle', price: 40 },
        { value: 'emerald-green', label: 'Emerald Green Sparkle', price: 40 },
        { value: 'orange', label: 'Orange Sparkle', price: 40 },
        { value: 'pink', label: 'Pink Sparkle', price: 40 },
        { value: 'purple', label: 'Purple Sparkle', price: 40 },
        { value: 'red', label: 'Red Sparkle', price: 40 },
        { value: 'sapphire-blue', label: 'Sapphire Blue Sparkle', price: 40 },
        { value: 'silver', label: 'Silver Sparkle', price: 40 },
        { value: 'teal', label: 'Teal Sparkle', price: 40 },
        { value: 'wine', label: 'Wine Sparkle', price: 40 },
      ],
      fade: [
        { value: 'black-to-red', label: 'Black to Red', price: 45 },
        { value: 'black-to-blue', label: 'Black to Blue', price: 45 },
        { value: 'black-to-green', label: 'Black to Green', price: 45 },
        { value: 'white-to-black', label: 'White to Black', price: 45 },
        { value: 'red-to-yellow', label: 'Red to Yellow', price: 45 },
        { value: 'blue-to-purple', label: 'Blue to Purple', price: 45 },
      ],
    }
    const fallback = fallbackMap[finishType] || []
    return fallback.map(option => ({
      ...option,
      preview: resolveFinishAsset('bass', config.bassType || 'vader', finishType, option.value),
    }))
  }, [config.finishType, config.bassType])
  const burstFinishOptions = useMemo(
    () => Object.entries(mergedBurstFinishOptions).map(([value, option]) => ({ value, ...option })),
    [mergedBurstFinishOptions],
  )
  const burstEdgesOptions = useMemo(() => ([
    { value: 'none', label: 'None', note: 'No burst edges', price: 0 },
    { value: 'blackBurst', label: 'Black Burst Edges', note: 'Black burst on both sides', price: 45 },
    { value: 'whiteBurst', label: 'White Burst Edges', note: 'White burst on both sides', price: 45 },
    { value: 'translucentBlackBurst', label: 'Translucent Black Burst', note: 'Translucent black burst on both sides', price: 50 },
    { value: 'reverseTranslucentBlackBurst', label: 'Reverse Translucent Black Burst', note: 'Reverse translucent black burst (front only)', price: 55 },
  ]), [])
  const threePieceBodyOptions = useMemo(() => ([
    { value: 'off', label: 'Off', note: 'Standard 1-piece body', price: 0 },
    { value: 'on', label: 'On', note: '3-piece body construction', price: 80 },
  ]), [])
  const neckConstructionOptions = useMemo(
    () => Object.entries(mergedNeckConstructionOptions).map(([value, option]) => ({ value, ...option })),
    [mergedNeckConstructionOptions],
  )
  const inlayShapeOptions = useMemo(
    () => Object.entries(mergedInlayShapeOptions).map(([value, option]) => {
      const folder = BASS_INLAY_SHAPE_OPTIONS[value]?.folder || 'id'
      return { value, ...option, preview: bassAsset(`all-models/necks/bass/4-string/front/20-fret/round-bottom/inlays/${folder}/white.png`) }
    }),
    [mergedInlayShapeOptions],
  )
  const inlayMaterialOptions = useMemo(
    () => Object.entries(mergedInlayMaterialOptions).map(([value, option]) => {
      const code = BASS_INLAY_MATERIAL_OPTIONS[value]?.code || 'imp'
      return { value, ...option, preview: bassAsset(`all-models/necks/bass/inlay-material/${code}.png`) }
    }),
    [mergedInlayMaterialOptions],
  )
  const headstockShapeOptions = useMemo(
    () => Object.entries(mergedHeadstockShapeOptions).map(([value, option]) => ({ value, ...option })),
    [mergedHeadstockShapeOptions],
  )
  const trussRodCoverOptions = useMemo(
    () => Object.entries(mergedTrussRodCoverOptions).map(([value, option]) => ({ value, ...option })),
    [mergedTrussRodCoverOptions],
  )
  const electronicsTypeOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(mergedElectronicsTypeOptions).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedElectronicsTypeOptions],
  )
  const pickupConfigurationOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(mergedPickupConfigurationOptions).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedPickupConfigurationOptions],
  )
  const bridgePickupModelOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(mergedBridgePickupModelOptions).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedBridgePickupModelOptions],
  )
  const middlePickupModelOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(mergedMiddlePickupModelOptions).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedMiddlePickupModelOptions],
  )
  const neckPickupModelOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(mergedNeckPickupModelOptions).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedNeckPickupModelOptions],
  )
  const pickupColorOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(mergedPickupColorOptions).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedPickupColorOptions],
  )
  const pickupColorVariantOptions = useMemo(() => {
    if (config.bassType === 'vader') return []
    const type = config.pickupColor || 'bobbins'
    if (type === 'bobbins' || type === 'covers') {
      const variantOptions = type === 'bobbins'
        ? [
            { value: 'black', label: 'Black', note: 'Black bobbins', price: 0 },
            { value: 'white', label: 'White', note: 'White bobbins', price: 0 },
            { value: 'cream', label: 'Cream', note: 'Cream bobbins', price: 0 },
            { value: 'racing-green', label: 'Racing Green', note: 'Racing green bobbins', price: 0 },
            { value: 'white-black', label: 'White & Black', note: 'White and black bobbins', price: 0 },
            { value: 'black-cream', label: 'Black & Cream', note: 'Black and cream bobbins', price: 0 },
            { value: 'racing-green-black', label: 'Racing Green & Black', note: 'Racing green and black bobbins', price: 0 },
          ]
        : [
            { value: 'black', label: 'Black', note: 'Black covers', price: 0 },
            { value: 'chrome', label: 'Chrome', note: 'Chrome covers', price: 10 },
            { value: 'gold', label: 'Gold', note: 'Gold covers', price: 15 },
          ]
      return variantOptions
    }
    return []
  }, [config.bassType, config.pickupColor])
  const pickupPoleColorOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(mergedPickupPoleColorOptions).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedPickupPoleColorOptions],
  )
  const pickupPaintedColorOptions = useMemo(() => {
    if (config.bassType === 'vader') return []
    return pickupColorVariantOptions.filter(o => o.value === 'black' || o.value === 'white' || o.value === 'cream' || o.value === 'racing-green' || o.value === 'chrome' || o.value === 'gold')
  }, [config.bassType, pickupColorVariantOptions])
  const pickupWoodTypeOptions = useMemo(() => {
    if (config.bassType === 'vader') return []
    return [
      { value: 'black', label: 'Black', note: 'Dark wood grain', price: 0 },
      { value: 'white', label: 'White', note: 'Light wood grain', price: 0 },
      { value: 'cream', label: 'Cream', note: 'Cream wood grain', price: 0 },
      { value: 'racing-green', label: 'Racing Green', note: 'Green wood grain', price: 0 },
    ]
  }, [config.bassType])
  const controlsOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(mergedControlsOptions).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedControlsOptions],
  )
  const saddleOptions = useMemo(
    () => Object.entries(mergedSaddleOptions).map(([value, option]) => ({ value, ...option })),
    [mergedSaddleOptions],
  )
  const nutOptions = useMemo(
    () => Object.entries(mergedNutOptions).map(([value, option]) => ({ value, ...option })),
    [mergedNutOptions],
  )
  const tuningOptions = useMemo(
    () => Object.entries(mergedTuningOptions).map(([value, option]) => ({ value, ...option })),
    [mergedTuningOptions],
  )
  const stringBrandOptions = useMemo(
    () => Object.entries(mergedStringBrandOptions).map(([value, option]) => ({ value, ...option })),
    [mergedStringBrandOptions],
  )
  const outputJackOptions = useMemo(
    () => Object.entries(mergedOutputJackOptions).map(([value, option]) => ({ value, ...option })),
    [mergedOutputJackOptions],
  )
  const strapButtonOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(mergedStrapButtonOptions).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedStrapButtonOptions],
  )
  const tunerButtonOptions = useMemo(
    () => Object.entries(mergedTunerButtonOptions).map(([value, option]) => ({ value, ...option })),
    [mergedTunerButtonOptions],
  )
  const electronicsCavityCoverOptions = useMemo(
    () => config.bassType === 'vader' ? [] : Object.entries(mergedElectronicsCavityCoverOptions).map(([value, option]) => ({ value, ...option })),
    [config.bassType, mergedElectronicsCavityCoverOptions],
  )
  const tremoloCoverOptionList = useMemo(
    () => Object.entries(tremoloCoverOptions || {}).map(([value, option]) => ({ value, ...option })),
    [tremoloCoverOptions],
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

  const pricingBreakdown = useMemo(() => ({
    base: dynamicBasePrice,
    body: mergedBodyOptions[config.bassType]?.price ?? BASS_BODY_OPTIONS[config.bassType]?.price ?? 0,
    bodyWood: mergedBodyWoodOptions[config.bodyWood]?.price ?? BASS_BODY_WOOD_OPTIONS[config.bodyWood]?.price ?? 0,
    bodyFinish: mergedBodyFinishOptions[config.bodyFinish]?.price ?? BASS_BODY_FINISH_OPTIONS[config.bodyFinish]?.price ?? 0,
    neck: mergedNeckOptions[config.neck]?.price ?? BASS_NECK_OPTIONS[config.neck]?.price ?? 0,
    fingerboardRadius: mergedFingerboardRadiusOptions[config.fingerboardRadius]?.price ?? 0,
    fretboard: mergedFretboardOptions[config.fretboard]?.price ?? BASS_FRETBOARD_OPTIONS[config.fretboard]?.price ?? 0,
    frets: mergedFretOptions[config.frets]?.price ?? BASS_FRET_OPTIONS[config.frets]?.price ?? 0,
    neckRearFinish: BASS_NECK_REAR_FINISH_OPTIONS[config.neckRearFinish]?.price ?? 0,
    headstockWood: mergedHeadstockWoodOptions[config.headstockWood]?.price ?? BASS_HEADSTOCK_WOOD_OPTIONS[config.headstockWood]?.price ?? 0,
    headstockStyle: mergedHeadstockStyleOptions[config.headstockStyle]?.price ?? BASS_HEADSTOCK_STYLE_OPTIONS[config.headstockStyle]?.price ?? 0,
    neckStyle: mergedNeckStyleOptions[config.neckStyle]?.price ?? BASS_NECK_STYLE_OPTIONS[config.neckStyle]?.price ?? 0,
    inlayShape: mergedInlayShapeOptions[config.inlayShape]?.price ?? BASS_INLAY_SHAPE_OPTIONS[config.inlayShape]?.price ?? 0,
    inlayMaterial: mergedInlayMaterialOptions[config.inlayMaterial]?.price ?? BASS_INLAY_MATERIAL_OPTIONS[config.inlayMaterial]?.price ?? 0,
    inlays: mergedInlayOptions[config.inlays]?.price ?? BASS_INLAY_OPTIONS[config.inlays]?.price ?? 0,
    backplate: mergedBackplateOptions[config.bassType]?.[config.backplate]?.price ?? BASS_BACKPLATE_OPTIONS[config.bassType]?.[config.backplate]?.price ?? 0,
    pickupScrews: mergedPickupScrewOptions[config.bassType]?.[config.pickupScrews]?.price ?? BASS_PICKUP_SCREW_OPTIONS[config.bassType]?.[config.pickupScrews]?.price ?? 0,
    controlPlate: mergedControlPlateOptions[config.controlPlate]?.price ?? BASS_CONTROL_PLATE_OPTIONS[config.controlPlate]?.price ?? 0,
    bridge: mergedBridgeOptions[config.bassType]?.[config.bridge]?.price ?? BASS_BRIDGE_OPTIONS[config.bassType]?.[config.bridge]?.price ?? 0,
    pickguard: mergedPickguardOptions[config.bassType]?.[config.pickguard]?.price ?? BASS_PICKGUARD_OPTIONS[config.bassType]?.[config.pickguard]?.price ?? 0,
    knobs: mergedKnobOptions[config.bassType]?.[config.knobs]?.price ?? BASS_KNOB_OPTIONS[config.bassType]?.[config.knobs]?.price ?? 0,
    hardware: mergedHardwareOptions[config.hardware]?.price ?? BASS_HARDWARE_OPTIONS[config.hardware]?.price ?? 0,
    pickups: mergedPickupOptions[config.pickups]?.price ?? BASS_PICKUP_OPTIONS[config.pickups]?.price ?? 0,
    pickupTypeStyle: mergedPickupTypeStyleOptions[config.pickupTypeStyle]?.price ?? BASS_PICKUP_TYPE_STYLE_OPTIONS[config.pickupTypeStyle]?.price ?? 0,
    pickupConfig: 0,
    strings: mergedStringOptions[config.strings]?.price ?? BASS_STRING_OPTIONS[config.strings]?.price ?? 0,
    dexterity: mergedDexterityOptions[config.dexterity]?.price ?? 0,
    multiscale: mergedMultiscaleOptions[config.multiscale]?.price ?? 0,
    scaleLength: mergedScaleLengthOptions[config.scaleLength]?.price ?? 0,
    caseType: mergedCaseOptions[config.case]?.price ?? 0,
    topWood: mergedTopWoodOptions[config.topWood]?.price ?? 0,
    finishType: mergedFinishTypeOptions[config.finishType]?.price ?? 0,
    topCoat: mergedTopCoatOptions[config.topCoat]?.price ?? 0,
    burstFinish: mergedBurstFinishOptions[config.burstFinish]?.price ?? 0,
    neckConstruction: mergedNeckConstructionOptions[config.neckConstruction]?.price ?? 0,
    inlayShape: mergedInlayShapeOptions[config.inlayShape]?.price ?? 0,
    inlayMaterial: mergedInlayMaterialOptions[config.inlayMaterial]?.price ?? 0,
    frets: mergedFretOptions[config.frets]?.price ?? 0,
    neckRearFinish: mergedNeckRearFinishOptions[config.neckRearFinish]?.price ?? 0,
    headstockShape: mergedHeadstockShapeOptions[config.headstockShape]?.price ?? 0,
    trussRodCover: mergedTrussRodCoverOptions[config.trussRodCover]?.price ?? 0,
    electronicsType: mergedElectronicsTypeOptions[config.electronicsType]?.price ?? 0,
    pickupConfiguration: mergedPickupConfigurationOptions[config.pickupConfiguration]?.price ?? 0,
    bridgePickupModel: mergedBridgePickupModelOptions[config.bridgePickupModel]?.price ?? 0,
    middlePickupModel: mergedMiddlePickupModelOptions[config.middlePickupModel]?.price ?? 0,
    neckPickupModel: mergedNeckPickupModelOptions[config.neckPickupModel]?.price ?? 0,
    pickupColor: mergedPickupColorOptions[config.pickupColor]?.price ?? 0,
    pickupColorVariant: 0,
    pickupPoleColor: mergedPickupPoleColorOptions[config.pickupPoleColor]?.price ?? 0,
    controls: mergedControlsOptions[config.controls]?.price ?? 0,
    saddle: mergedSaddleOptions[config.saddle]?.price ?? 0,
    nut: mergedNutOptions[config.nut]?.price ?? 0,
    tuning: mergedTuningOptions[config.tuning]?.price ?? 0,
    stringBrand: mergedStringBrandOptions[config.stringBrand]?.price ?? 0,
    outputJack: mergedOutputJackOptions[config.outputJack]?.price ?? 0,
    strapButtons: mergedStrapButtonOptions[config.strapButtons]?.price ?? 0,
    tunerButtons: mergedTunerButtonOptions[config.tunerButtons]?.price ?? 0,
    electronicsCavityCover: mergedElectronicsCavityCoverOptions[config.electronicsCavityCover]?.price ?? 0,
    tremoloCover: tremoloCoverOptions[config.tremoloCover]?.price ?? 0,
  }), [
    config, dynamicBasePrice,
    mergedBodyOptions, mergedBodyWoodOptions, mergedBodyFinishOptions,
    mergedNeckOptions, mergedFretboardOptions, mergedHeadstockWoodOptions,
    mergedHeadstockStyleOptions, mergedNeckStyleOptions, mergedInlayOptions,
     mergedBackplateOptions, mergedPickupScrewOptions,
    mergedControlPlateOptions, mergedBridgeOptions, mergedPickguardOptions,
    mergedKnobOptions, mergedHardwareOptions, mergedPickupOptions,
    mergedPickupTypeStyleOptions, mergedStringOptions,
    mergedDexterityOptions, mergedMultiscaleOptions, mergedScaleLengthOptions,
    mergedCaseOptions, mergedTopWoodOptions,
    mergedFinishTypeOptions, mergedTopCoatOptions, mergedBurstFinishOptions,
    mergedNeckConstructionOptions, mergedInlayShapeOptions,
    mergedInlayMaterialOptions, mergedFretOptions,
    mergedNeckRearFinishOptions, mergedHeadstockShapeOptions,
    mergedTrussRodCoverOptions, mergedElectronicsTypeOptions,
    mergedPickupConfigurationOptions, mergedBridgePickupModelOptions,
    mergedMiddlePickupModelOptions, mergedNeckPickupModelOptions,
    mergedPickupColorOptions, mergedPickupPoleColorOptions,
    mergedControlsOptions, mergedSaddleOptions, mergedNutOptions,
    mergedTuningOptions, mergedStringBrandOptions, mergedOutputJackOptions,
    mergedStrapButtonOptions, mergedTunerButtonOptions,
    mergedElectronicsCavityCoverOptions, tremoloCoverOptions,
  ])

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
    builder: bassBuilder,
    loadingPrices,
    refreshPrices,
    options: {
      bassTypeOptions,
      bodyOptions,
      bodyWoodOptions,
      bodyFinishOptions,
      neckOptions,
      neckWoodOptionsByGroup,
      fingerboardRadiusOptions,
      fretboardOptions,
      headstockWoodOptions,
      headstockStyleOptions,
      neckStyleOptions,
      inlayOptions,
      inlayShapeOptions,
      inlayMaterialOptions,
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
      // New General options
      dexterityOptions,
      multiscaleOptions,
      scaleLengthOptions,
      caseOptions,
      // New Body options
      topWoodOptions,
      finishTypeOptions,
      topCoatOptions,
      burstFinishOptions,
      // New Neck options
      neckConstructionOptions,
      inlayShapeOptions,
      inlayMaterialOptions,
      fretOptions,
      neckRearFinishOptions,
      headstockShapeOptions,
      trussRodCoverOptions,
      // New Electronics options
      electronicsTypeOptions,
      pickupConfigurationOptions,
      bridgePickupModelOptions,
      middlePickupModelOptions,
      neckPickupModelOptions,
      pickupColorOptions,
      pickupColorVariantOptions,
      pickupPaintedColorOptions,
      pickupWoodTypeOptions,
      pickupPoleColorOptions,
      controlsOptions,
      // Vader-specific pickup options
      vaderBridgePickupOptions: Object.entries(VADER_PICKUP_OPTIONS)
        .filter(([key]) => ['radiumHumbucker', 'radiumSingle', 'singleHbSweetSpot', 'hbAlnico', 'fishmanFluence'].includes(key))
        .map(([value, option]) => ({ value, ...option })),
      vaderNeckPickupOptions: (() => {
        const bridge = config.vaderBridgePickup || 'radiumHumbucker'
        const allowed = bridge === 'radiumSingle'
          ? ['radiumHumbucker', 'scpSplitCoil']
          : bridge === 'radiumHumbucker'
            ? ['radiumHumbucker']
            : bridge === 'hbAlnico'
              ? ['jvaSingleCoil']
              : bridge === 'fishmanFluence'
                ? ['fishmanFluence']
                : []
        return Object.entries(VADER_PICKUP_OPTIONS)
          .filter(([key]) => allowed.includes(key))
          .map(([value, option]) => ({ value, ...option }))
      })(),
      vaderPickupColorOptions: [
        { value: 'none', label: 'None (Stock)', note: 'No color customization', price: 0 },
        { value: 'custom', label: 'Custom RGB Color', note: 'Apply custom RGB color shift', price: 10 },
      ],
      // Vader-specific hardware options
      vaderHardwareOptions: [
        { value: 'chrome', label: 'Chrome', note: 'Standard bright hardware', price: 0 },
        { value: 'black', label: 'Black', note: 'Stealth hardware', price: 45 },
      ],
      vaderKnobsOptions: [
        { value: 'hardwareColor', label: 'Hardware Color Knobs', note: 'Knobs matched to hardware color', price: 0 },
        { value: 'abalone', label: 'Metal Knobs w/ Abalone Inlays', note: 'Chrome knobs with abalone inlay', price: 0 },
        { value: 'pearl', label: 'Metal Knobs w/ White Pearl Inlays', note: 'Chrome knobs with white pearl inlay', price: 0 },
        { value: 'tamarind', label: 'Tamarind Wood', note: 'Warm wood-look knobs', price: 0 },
      ],
      vaderStrapButtonOptions: Object.entries(VADER_STRAP_BUTTON_OPTIONS).map(([value, option]) => ({ value, ...option })),
      vaderElectronicsCavityCoverOptions: Object.entries(VADER_ELECTRONICS_CAVITY_COVER_OPTIONS).map(([value, option]) => ({ value, ...option })),
      // New Hardware options
      saddleOptions,
      nutOptions,
      tuningOptions,
      stringBrandOptions,
      outputJackOptions,
      strapButtonOptions,
      tunerButtonOptions,
      electronicsCavityCoverOptions,
      tremoloCoverOptions: tremoloCoverOptionList,
      tuningDisclaimer: TUNING_DISCLAIMER,
      // Vader-specific finish/wood options
      finishColorOptions,
      burstEdgesOptions,
      threePieceBodyOptions,
      basePrice: dynamicBasePrice,
    },
  }
}
