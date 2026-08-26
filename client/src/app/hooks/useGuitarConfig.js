import { useEffect, useMemo, useState, useCallback } from 'react'
import axios from 'axios'
import { API } from '../utils/apiConfig'
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
  INLAY_SHAPE_OPTIONS,
  INLAY_MATERIAL_OPTIONS,
   KNOB_OPTIONS_BY_BODY,
   KNOB_STYLE_OPTIONS,
   PICKGUARD_OPTIONS_BY_BODY,
  PICKUP_OPTIONS,
  GUITAR_TYPE_OPTIONS,
  guitarBuilder,
  // New option data
  DEXTERITY_OPTIONS,
  STRING_COUNT_OPTIONS,
  MULTISCALE_OPTIONS,
  SCALE_LENGTH_OPTIONS,
  CASE_OPTIONS,
  BEVEL_OPTIONS,
  TOP_WOOD_OPTIONS,
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
} from '../lib/guitarBuilderData.js'

import { resolveTopWoodAsset, resolveFinishAsset, resolveTopCoatAsset, resolveNeckWoodAsset, resolveHeadstockWoodAsset, resolveFingerboardWoodAsset, resolveInlay, resolveNeckRearFinishAsset, resolveBackNeckAsset, resolveBackplateAsset, resolveOutputJackAsset, resolveKnobAsset, resolveKnobStyleOverlay, resolveSwitchAsset } from '../lib/assetResolver.js'
import { listBuilderAssets } from '../utils/apiConfig.js'

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

export default function useGuitarConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [builderParts, setBuilderParts] = useState([])
  const [modelImages, setModelImages] = useState([])
  const [loadingPrices, setLoadingPrices] = useState(true)
  const [dynamicTopWoodList, setDynamicTopWoodList] = useState([])
  const [dynamicFinishColorList, setDynamicFinishColorList] = useState([])
  const [dynamicTopCoatList, setDynamicTopCoatList] = useState([])
  const [dynamicNeckWoodList, setDynamicNeckWoodList] = useState([])
  const [dynamicHeadstockWoodList, setDynamicHeadstockWoodList] = useState([])
  const [dynamicFingerboardWoodList, setDynamicFingerboardWoodList] = useState([])
  const [dynamicInlayList, setDynamicInlayList] = useState([])
  const [dynamicNeckRearFinishList, setDynamicNeckRearFinishList] = useState([])

  const INLAY_MATERIALS_BY_SHAPE = {
    dots: ['abalone', 'black', 'green', 'luminlay', 'pink', 'red', 'pearl'],
    diamonds: ['abalone', 'black', 'green', 'luminlay', 'pink', 'red', 'pearl'],
    blocks: ['abalone', 'black', 'green', 'pink', 'red', 'pearl'],
  }

  const normalizeInlayShape = (shape) => {
    if (!shape) return 'dots'
    const normalized = String(shape).trim().toLowerCase()
    if (normalized === 'dot') return 'dots'
    if (normalized === 'diamond') return 'diamonds'
    if (normalized === 'box' || normalized === 'block') return 'blocks'
    if (['dots', 'diamonds', 'blocks'].includes(normalized)) return normalized
    return 'dots'
  }

  const normalizeInlayMaterial = (material) => {
    if (!material) return 'pearl'
    const normalized = String(material).trim().toLowerCase().replace(/_/g, '-')
    if (normalized === 'white-pearl' || normalized === 'pearl') return 'pearl'
    if (['black', 'green', 'luminlay', 'pink', 'red', 'abalone'].includes(normalized)) return normalized
    return 'pearl'
  }

  const parseLegacyInlay = (legacyValue) => {
    if (!legacyValue || typeof legacyValue !== 'string') return null
    const rawKey = legacyValue.trim().toLowerCase().replace(/_/g, '-')
    const prefixMatch = rawKey.match(/^(id|idia|ib)-?(.*)$/)
    if (!prefixMatch) {
      return { shape: 'dots', material: normalizeInlayMaterial(rawKey) }
    }
    const prefix = prefixMatch[1]
    const materialKey = prefixMatch[2] || 'white-pearl'
    return {
      shape: prefix === 'idia' ? 'diamonds' : prefix === 'ib' ? 'blocks' : 'dots',
      material: normalizeInlayMaterial(materialKey),
    }
  }

  const buildLegacyInlayKey = (shape, material) => {
    const folderMap = {
      dots: 'id',
      diamonds: 'idia',
      blocks: 'ib',
    }
    const key = folderMap[normalizeInlayShape(shape)] || 'id'
    const mat = normalizeInlayMaterial(material)
    return `${key}-${mat}`
  }

  const normalizeTrussRodCover = (cover) => {
    if (!cover) return 'black'
    const normalized = String(cover).trim().toLowerCase().replace(/_/g, '-')
    if (normalized === 'cream') return 'creme'
    if (normalized === 'red-tortoiseshell' || normalized === 'redtortoiseshell' || normalized === 'red_tortoiseshell') return 'red-tortoise'
    if (normalized === 'white-pearloid' || normalized === 'whitepearloid' || normalized === 'white_pearl') return 'pearloid'
    if (normalized === 'purpleheart' || normalized === 'purple-heart') return 'purpleheart'
    if (['black', 'creme', 'white', 'pearloid', 'ebony', 'purpleheart', 'red-tortoise'].includes(normalized)) return normalized
    return 'black'
  }

  const normalizeHeadstockShape = (shape) => {
    if (!shape) return 'gt6'
    const s = String(shape).trim().toLowerCase().replace(/_/g, '-')
    // map common legacy or human-friendly names to canonical shape keys
    const map = {
      gt6: 'gt6',
      gt6r: 'gt6r',
      h33: 'h33',
      h33r: 'h33r',
      '6in': '6in',
      '6inr': '6inr',
      '6kr': '6kr',
       '624': '624',
       '2x4': '624',
     }
     if (map[s]) return map[s]
     // tolerant fallbacks
     if (s.includes('gt6')) return s.includes('r') ? 'gt6r' : 'gt6'
     return s
  }
  

  const [dynamicBackplateList, setDynamicBackplateList] = useState([])
  const [dynamicOutputJackList, setDynamicOutputJackList] = useState([])

  const fetchBuilderParts = useCallback(async (guitarType = 'electric') => {
    setLoadingPrices(true)
    try {
      const [partsResponse, modelImagesResponse] = await Promise.all([
        axios.get(`${API_URL}/api/builder-parts`, {
          params: { is_active: true, guitar_type: guitarType, pageSize: 500, _t: Date.now() },
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' }
        }),
        axios.get(`${API_URL}/api/builder-parts/model-images`, {
          params: { guitar_type: guitarType, _t: Date.now() },
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
  }, [])

  useEffect(() => {
    fetchBuilderParts(config.guitarType || 'electric')
  }, [config.guitarType, fetchBuilderParts])

  useEffect(() => {
    const handleFocus = () => fetchBuilderParts(config.guitarType || 'electric')
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        fetchBuilderParts(config.guitarType || 'electric')
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => {
    let cancelled = false
    const guitarType = config.guitarType || 'electric'
    const model = config.body || 'dc'

    Promise.all([
      listBuilderAssets({ guitarType, group: 'top-woods' }),
      listBuilderAssets({ guitarType, group: 'top-coat', model }),
    ]).then(([topWoodsRes, topCoatsRes]) => {
      if (!cancelled) {
        setDynamicTopWoodList(topWoodsRes.data?.topWoods || [])
        setDynamicTopCoatList(topCoatsRes.data?.topCoats || [])
      }
    }).catch((error) => {
      if (!cancelled) {
        console.warn('Failed to fetch dynamic top wood / top coat assets:', error)
      }
    })

    return () => { cancelled = true }
  }, [config.guitarType, config.body])

  useEffect(() => {
    let cancelled = false
    const finishType = config.finishType
    if (!finishType || finishType === 'solid' || finishType === 'burst') {
      setDynamicFinishColorList([])
      return
    }
    const guitarType = config.guitarType || 'electric'

    listBuilderAssets({
      guitarType,
      group: 'colors',
      subgroup: finishType,
    }).then(res => {
      if (!cancelled) {
        setDynamicFinishColorList(res.data?.finishColors || [])
      }
    }).catch((error) => {
      if (!cancelled) {
        console.warn('Failed to fetch dynamic finish colors:', error)
        setDynamicFinishColorList([])
      }
    })

    return () => { cancelled = true }
  }, [config.finishType, config.guitarType])

  useEffect(() => {
    let cancelled = false
    const guitarType = config.guitarType || 'electric'
    Promise.all([
      listBuilderAssets({ guitarType, group: 'neck-woods' }),
      listBuilderAssets({ guitarType, group: 'headstock-woods' }),
      listBuilderAssets({ guitarType, group: 'fingerboard-woods' }),
    ]).then(([neckRes, headstockRes, fingerboardRes]) => {
      if (!cancelled) {
        setDynamicNeckWoodList(neckRes.data?.neckWoods || [])
        setDynamicHeadstockWoodList(headstockRes.data?.headstockWoods || [])
        setDynamicFingerboardWoodList(fingerboardRes.data?.fingerboardWoods || [])
      }
    }).catch((error) => {
      if (!cancelled) {
        console.warn('Failed to fetch dynamic wood assets:', error)
      }
    })
    return () => { cancelled = true }
  }, [config.guitarType])

  useEffect(() => {
    let cancelled = false
    const guitarType = config.guitarType || 'electric'
    listBuilderAssets({ guitarType, group: 'inlays' }).then(res => {
      if (!cancelled) {
        setDynamicInlayList(res.data?.inlays || [])
      }
    }).catch((error) => {
      if (!cancelled) {
        console.warn('Failed to fetch dynamic inlay assets:', error)
      }
    })
    return () => { cancelled = true }
  }, [config.guitarType])

  useEffect(() => {
    const shape = normalizeInlayShape(config.inlayShape)
    const legacyInlay = parseLegacyInlay(config.inlay || config.inlays)
    const materialSource = config.inlayMaterial || (legacyInlay ? legacyInlay.material : undefined)
    const material = normalizeInlayMaterial(materialSource)
    const allowed = INLAY_MATERIALS_BY_SHAPE[shape] || INLAY_MATERIALS_BY_SHAPE.dots

    if (config.inlayShape !== shape || !allowed.includes(material) || config.inlayMaterial !== material) {
      setConfig(prev => ({
        ...prev,
        inlayShape: shape,
        inlayMaterial: allowed.includes(material) ? material : 'pearl',
      }))
    }
  }, [config.inlayShape, config.inlayMaterial, config.inlay, config.inlays])

  useEffect(() => {
    let cancelled = false
    const guitarType = config.guitarType || 'electric'
    const model = config.body || 'dc'
    Promise.all([
      listBuilderAssets({ guitarType, group: 'neck-rear-finish', model }),
      listBuilderAssets({ guitarType, group: 'backplates', model }),
      listBuilderAssets({ guitarType, group: 'output-jacks', model }),
    ]).then(([neckRearRes, backplateRes, jackRes]) => {
      if (!cancelled) {
        setDynamicNeckRearFinishList(neckRearRes.data?.neckRearFinishes || [])
        setDynamicBackplateList(backplateRes.data?.backplates || [])
        setDynamicOutputJackList(jackRes.data?.outputJacks || [])
      }
    }).catch((error) => {
      if (!cancelled) {
        console.warn('Failed to fetch dynamic back/rear assets:', error)
      }
    })
    return () => { cancelled = true }
  }, [config.guitarType, config.body])

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
      const configType = typeof config.guitarType === 'string' ? config.guitarType.trim().toLowerCase() : ''
      const matchesType = !partType || partType === configType
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
  }, [builderParts, config.guitarType])

  const modelImageMap = useMemo(() => {
    return modelImages.reduce((acc, item) => {
      const key = String(item?.model_key || '').trim()
      if (key && item?.image_url) {
        acc[key] = item.image_url
      }
      return acc
    }, {})
  }, [modelImages])

  const getPrice = (optionKey, staticOptions, configKey) => {
    if (priceOverrides[optionKey]?.price !== undefined) {
      return priceOverrides[optionKey].price
    }
    return staticOptions[configKey]?.price ?? 0
  }

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

  const mergeOptionsFromBuilderParts = useCallback((baseOptions, { partCategory, typeMappings = [] } = {}) => {
    const merged = { ...baseOptions }
    const normalizedType = String(config.guitarType || 'electric').trim().toLowerCase()
    const normalizedTypeMappings = typeMappings.map(mapping => String(mapping).trim().toLowerCase())

    builderParts.forEach((part) => {
      const partType = typeof part.guitar_type === 'string' ? part.guitar_type.trim().toLowerCase() : ''
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
  }, [builderParts, config.guitarType])

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

  // ---- Existing merged options (unchanged) ----
  const mergedBodyOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(BODY_OPTIONS, { partCategory: 'body', typeMappings: ['body'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedBodyWoodOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(BODY_WOOD_OPTIONS, { partCategory: 'wood_type', typeMappings: ['bodywood'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedBodyFinishOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(BODY_FINISH_OPTIONS, { partCategory: 'finish', typeMappings: ['bodyfinish'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedNeckOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(NECK_OPTIONS, { partCategory: 'neck', typeMappings: ['neck'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedFretboardOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(FRETBOARD_OPTIONS, { partCategory: 'fretboard', typeMappings: ['fretboard'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedHeadstockOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(HEADSTOCK_OPTIONS, { partCategory: 'misc', typeMappings: ['headstock'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    delete merged.pth
    delete merged.pthr
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedHeadstockWoodOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(HEADSTOCK_WOOD_OPTIONS, { partCategory: 'wood_type', typeMappings: ['headstockwood'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedInlayOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(INLAY_OPTIONS, { partCategory: 'misc', typeMappings: ['inlays', 'inlay'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedInlayShapeOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(INLAY_SHAPE_OPTIONS, { partCategory: 'misc', typeMappings: ['inlayShape', 'inlay-shape', 'inlayshape'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedInlayMaterialOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(INLAY_MATERIAL_OPTIONS, { partCategory: 'misc', typeMappings: ['inlayMaterial', 'inlay-material', 'inlaymaterial'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) {
        merged[key] = { ...merged[key], price: priceOverrides[key].price }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedDynamicNeckWoodOptions = useMemo(() => {
    if (dynamicNeckWoodList.length === 0) return mergedNeckOptions
    const merged = { ...mergedNeckOptions }
    dynamicNeckWoodList.forEach(asset => {
      if (merged[asset.key] === undefined) {
        merged[asset.key] = { label: asset.label, note: '', price: 0, texture: null }
      }
      if (priceOverrides[asset.key] !== undefined) {
        merged[asset.key] = { ...merged[asset.key], price: priceOverrides[asset.key].price }
      }
    })
    return merged
  }, [dynamicNeckWoodList, mergedNeckOptions, priceOverrides])

  const mergedDynamicHeadstockWoodOptions = useMemo(() => {
    if (dynamicHeadstockWoodList.length === 0) return mergedHeadstockWoodOptions
    const merged = { ...mergedHeadstockWoodOptions }
    dynamicHeadstockWoodList.forEach(asset => {
      if (merged[asset.key] === undefined) {
        merged[asset.key] = { label: asset.label, note: '', price: 0, texture: null }
      }
      if (priceOverrides[asset.key] !== undefined) {
        merged[asset.key] = { ...merged[asset.key], price: priceOverrides[asset.key].price }
      }
    })
    return merged
  }, [dynamicHeadstockWoodList, mergedHeadstockWoodOptions, priceOverrides])

  const mergedDynamicFingerboardWoodOptions = useMemo(() => {
    if (dynamicFingerboardWoodList.length === 0) return mergedFretboardOptions
    const merged = { ...mergedFretboardOptions }
    dynamicFingerboardWoodList.forEach(asset => {
      if (merged[asset.key] === undefined) {
        merged[asset.key] = { label: asset.label, note: '', price: 0, texture: null }
      }
      if (priceOverrides[asset.key] !== undefined) {
        merged[asset.key] = { ...merged[asset.key], price: priceOverrides[asset.key].price }
      }
    })
    return merged
  }, [dynamicFingerboardWoodList, mergedFretboardOptions, priceOverrides])

  const mergedDynamicInlayOptions = useMemo(() => {
    if (dynamicInlayList.length === 0) return mergedInlayOptions
    const merged = { ...mergedInlayOptions }
    dynamicInlayList.forEach(asset => {
      if (merged[asset.key] === undefined) {
        merged[asset.key] = { label: asset.label, note: '', price: 0, src: null }
      }
      if (priceOverrides[asset.key] !== undefined) {
        merged[asset.key] = { ...merged[asset.key], price: priceOverrides[asset.key].price }
      }
    })
    return merged
  }, [dynamicInlayList, mergedInlayOptions, priceOverrides])

  const inlayShapeOptions = useMemo(
    () => Object.entries(mergedInlayShapeOptions).map(([value, option]) => ({ value, ...option })),
    [mergedInlayShapeOptions],
  )

  const inlayMaterialOptions = useMemo(() => {
    const shape = normalizeInlayShape(config.inlayShape)
    const allowed = INLAY_MATERIALS_BY_SHAPE[shape] || INLAY_MATERIALS_BY_SHAPE.dots
    return Object.entries(mergedInlayMaterialOptions)
      .filter(([value]) => allowed.includes(value))
      .map(([value, option]) => ({ value, ...option }))
  }, [mergedInlayMaterialOptions, config.inlayShape])

  const mergedBridgeOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(BRIDGE_OPTIONS, { partCategory: 'bridge', typeMappings: ['bridge'] })
    const bridgeCatPrice = priceOverrides['cat:bridge']?.price
    Object.keys(merged).forEach(key => {
      const specific = getOptionOverride('bridge', key)
      const finalPrice = specific !== undefined ? specific : bridgeCatPrice
      if (finalPrice !== undefined) {
        merged[key] = { ...merged[key], price: finalPrice }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedHardwareOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(HARDWARE_OPTIONS, { partCategory: 'hardware', typeMappings: ['hardware'] })
    const hardwareCatPrice = priceOverrides['cat:hardware']?.price
    Object.keys(merged).forEach(key => {
      const specific = getOptionOverride('hardware', key)
      const finalPrice = specific !== undefined ? specific : hardwareCatPrice
      if (finalPrice !== undefined) {
        merged[key] = { ...merged[key], price: finalPrice }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedPickupOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(PICKUP_OPTIONS, { partCategory: 'pickups', typeMappings: ['pickups'] })
    const pickupsCatPrice = priceOverrides['cat:pickups']?.price
    Object.keys(merged).forEach(key => {
      const specific = getOptionOverride('pickups', key)
      const finalPrice = specific !== undefined ? specific : pickupsCatPrice
      if (finalPrice !== undefined) {
        merged[key] = { ...merged[key], price: finalPrice }
      }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  // ---- NEW merged options for all new customization fields ----
  const mergedDexterityOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(DEXTERITY_OPTIONS, { partCategory: 'misc', typeMappings: ['dexterity'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedStringCountOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(STRING_COUNT_OPTIONS, { partCategory: 'misc', typeMappings: ['strings'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedMultiscaleOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(MULTISCALE_OPTIONS, { partCategory: 'misc', typeMappings: ['multiscale'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedScaleLengthOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(SCALE_LENGTH_OPTIONS, { partCategory: 'misc', typeMappings: ['scaleLength'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedCaseOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(CASE_OPTIONS, { partCategory: 'misc', typeMappings: ['case'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedBevelOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(BEVEL_OPTIONS, { partCategory: 'misc', typeMappings: ['bevel'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedTopWoodOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(TOP_WOOD_OPTIONS, { partCategory: 'misc', typeMappings: ['topWood'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedFinishTypeOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(FINISH_TYPE_OPTIONS, { partCategory: 'misc', typeMappings: ['finishType'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedTopCoatOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(TOP_COAT_OPTIONS, { partCategory: 'misc', typeMappings: ['topCoat'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedDynamicTopWoodOptions = useMemo(() => {
    if (dynamicTopWoodList.length === 0) return mergedTopWoodOptions
    const merged = { ...mergedTopWoodOptions }
    dynamicTopWoodList.forEach(asset => {
      if (merged[asset.key] === undefined) {
        merged[asset.key] = { label: asset.label, note: '', price: 0, texture: null }
      }
      if (priceOverrides[asset.key] !== undefined) {
        merged[asset.key] = { ...merged[asset.key], price: priceOverrides[asset.key].price }
      }
    })
    return merged
  }, [dynamicTopWoodList, mergedTopWoodOptions, priceOverrides])

  const mergedDynamicFinishColorOptions = useMemo(() => {
    if (dynamicFinishColorList.length === 0) return {}
    const merged = {}
    const finishType = config.finishType || 'metallic'
    dynamicFinishColorList.forEach(asset => {
      merged[asset.key] = { label: asset.label, note: `${finishType} finish`, price: 0 }
      if (priceOverrides[asset.key] !== undefined) {
        merged[asset.key] = { ...merged[asset.key], price: priceOverrides[asset.key].price }
      }
    })
    return merged
  }, [dynamicFinishColorList, config.finishType, priceOverrides])

  const mergedDynamicTopCoatOptions = useMemo(() => {
    if (dynamicTopCoatList.length === 0) return mergedTopCoatOptions
    const merged = { ...mergedTopCoatOptions }
    dynamicTopCoatList.forEach(asset => {
      if (merged[asset.key] === undefined) {
        merged[asset.key] = { label: asset.label, note: '', price: 0 }
      }
      if (priceOverrides[asset.key] !== undefined) {
        merged[asset.key] = { ...merged[asset.key], price: priceOverrides[asset.key].price }
      }
    })
    return merged
  }, [dynamicTopCoatList, mergedTopCoatOptions, priceOverrides])

  const mergedBurstFinishOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(BURST_FINISH_OPTIONS, { partCategory: 'misc', typeMappings: ['burstFinish'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedNeckConstructionOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(NECK_CONSTRUCTION_OPTIONS, { partCategory: 'misc', typeMappings: ['neckConstruction'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedFretOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(FRET_OPTIONS, { partCategory: 'misc', typeMappings: ['frets'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedNeckRearFinishOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(NECK_REAR_FINISH_OPTIONS, { partCategory: 'misc', typeMappings: ['neckRearFinish'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedHeadstockShapeOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(HEADSTOCK_SHAPE_OPTIONS, { partCategory: 'misc', typeMappings: ['headstockShape'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    delete merged.pth
    delete merged.pthr
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedTrussRodCoverOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(TRUSS_ROD_COVER_OPTIONS, { partCategory: 'misc', typeMappings: ['trussRodCover'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedElectronicsTypeOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(ELECTRONICS_TYPE_OPTIONS, { partCategory: 'misc', typeMappings: ['electronicsType'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedPickupConfigurationOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(PICKUP_CONFIGURATION_OPTIONS, { partCategory: 'misc', typeMappings: ['pickupConfiguration'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedBridgePickupModelOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(PICKUP_MODEL_BRIDGE_OPTIONS, { partCategory: 'misc', typeMappings: ['bridgePickupModel'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedMiddlePickupModelOptions = useMemo(() => {
    // Responsible for merging admin price overrides into middle single coil pickup model options
    const merged = mergeOptionsFromBuilderParts(PICKUP_MODEL_MIDDLE_OPTIONS, { partCategory: 'misc', typeMappings: ['middlePickupModel'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedNeckPickupModelOptions = useMemo(() => {
    // Responsible for merging admin price overrides into neck humbucker pickup model options
    const merged = mergeOptionsFromBuilderParts(PICKUP_MODEL_NECK_OPTIONS, { partCategory: 'misc', typeMappings: ['neckPickupModel'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedPickupColorOptions = useMemo(() => {
    // Responsible for merging admin price overrides into pickup color/style options (bobbins, painted, wooden, covers)
    const merged = mergeOptionsFromBuilderParts(PICKUP_COLOR_OPTIONS, { partCategory: 'misc', typeMappings: ['pickupColor'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedPickupPoleColorOptions = useMemo(() => {
    // Responsible for merging admin price overrides into pole piece color options
    const merged = mergeOptionsFromBuilderParts(PICKUP_POLE_COLOR_OPTIONS, { partCategory: 'misc', typeMappings: ['pickupPoleColor'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedControlsOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(CONTROLS_OPTIONS, { partCategory: 'misc', typeMappings: ['controls'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedSaddleOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(SADDLE_OPTIONS, { partCategory: 'misc', typeMappings: ['saddle'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedNutOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(NUT_OPTIONS, { partCategory: 'misc', typeMappings: ['nut'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedTuningOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(TUNING_OPTIONS, { partCategory: 'misc', typeMappings: ['tuning'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedStringBrandOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(STRING_BRAND_OPTIONS, { partCategory: 'misc', typeMappings: ['stringBrand'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedOutputJackOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(OUTPUT_JACK_OPTIONS, { partCategory: 'misc', typeMappings: ['outputJack'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedStrapButtonOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(STRAP_BUTTON_OPTIONS, { partCategory: 'misc', typeMappings: ['strapButtons'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedTunerButtonOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(TUNER_BUTTON_OPTIONS, { partCategory: 'misc', typeMappings: ['tunerButtons'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
    })
    return merged
  }, [mergeOptionsFromBuilderParts, priceOverrides])

  const mergedElectronicsCavityCoverOptions = useMemo(() => {
    const merged = mergeOptionsFromBuilderParts(ELECTRONICS_CAVITY_COVER_OPTIONS, { partCategory: 'misc', typeMappings: ['electronicsCavityCover'] })
    Object.keys(merged).forEach(key => {
      if (priceOverrides[key] !== undefined) merged[key] = { ...merged[key], price: priceOverrides[key].price }
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

  const getCategoryPrice = (cat) => priceOverrides[`cat:${cat}`]?.price
  const pickguardOptions = useMemo(
    () =>
      Object.entries(PICKGUARD_OPTIONS_BY_BODY[config.body] ?? PICKGUARD_OPTIONS_BY_BODY.strat)
        .filter(([value, option]) => value !== 'none' && option?.src)
        .map(([value, option]) => {
          const specific = getOptionOverride('pickguard', value, config.body)
          const catPrice = getCategoryPrice('pickguard')
          const finalPrice = specific !== undefined ? specific : catPrice
          return { value, ...(finalPrice !== undefined ? { ...option, price: finalPrice } : option), preview: option.src }
        }),
    [config.body, priceOverrides],
  )
  const knobOptions = useMemo(
    () => {
      if (config.body === 'dc') {
        return Object.entries(KNOB_STYLE_OPTIONS).map(([value, option]) => ({
          value,
          ...option,
          preview: option.fileKey ? resolveKnobAsset('electric', 'dc', option.fileKey) : null,
        }))
      }
      return Object.entries(KNOB_OPTIONS_BY_BODY[config.body] ?? KNOB_OPTIONS_BY_BODY.strat).map(([value, option]) => {
        const specific = getOptionOverride('hardware', value, config.body) ?? getOptionOverride('knobs', value, config.body)
        const catPrice = getCategoryPrice('knobs')
        const finalPrice = specific !== undefined ? specific : catPrice
        return { value, ...(finalPrice !== undefined ? { ...option, price: finalPrice } : option), preview: option.src }
      })
    },
    [config.body, KNOB_STYLE_OPTIONS, priceOverrides],
  )
  const knobStyleOptionList = useMemo(
    () =>
      Object.entries(KNOB_STYLE_OPTIONS).map(([value, option]) => ({
        value,
        ...option,
        preview: option.fileKey ? resolveKnobStyleOverlay('electric', 'dc', option.fileKey) : null,
      })),
    [KNOB_STYLE_OPTIONS],
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
      .filter(key => key !== 'none')
    const knobKeys = config.body === 'dc'
      ? Object.keys(KNOB_STYLE_OPTIONS)
      : Object.keys(KNOB_OPTIONS_BY_BODY[config.body] ?? KNOB_OPTIONS_BY_BODY.strat)
    const nextPickguard = pickguardKeys.includes(config.pickguard) ? config.pickguard : (pickguardKeys[0] ?? 'pearloid')
    const nextKnobs = knobKeys.includes(config.knobs) ? config.knobs : (knobKeys[0] ?? 'plasticBlack')

    if (nextPickguard !== config.pickguard || nextKnobs !== config.knobs) {
      setConfig(prev => ({
        ...prev,
        pickguard: nextPickguard,
        knobs: nextKnobs,
      }))
    }
   }, [config.body, config.knobs, config.pickguard])

  useEffect(() => {
    const coverOptions = TREMOLO_COVER_OPTIONS_BY_BRIDGE[config.bridge]
    if (coverOptions) {
      const validKeys = Object.keys(coverOptions)
      if (!config.tremoloCover || !validKeys.includes(config.tremoloCover)) {
        setConfig(prev => ({ ...prev, tremoloCover: validKeys.includes('black') ? 'black' : validKeys[0] }))
      }
    } else if (config.tremoloCover) {
      setConfig(prev => ({ ...prev, tremoloCover: null }))
    }
  }, [config.bridge, config.tremoloCover, TREMOLO_COVER_OPTIONS_BY_BRIDGE])

  useEffect(() => {
    // Responsible for migrating the legacy 'standard' controls value to the new
    // 'off' option. Controls now mirror the plan: Off / DTC / DTMV for both
    // Passive and Active electronics.
    if (config.controls === 'standard') {
      setConfig(prev => ({ ...prev, controls: 'off' }))
    }
  }, [config.controls])

  const updateConfig = useCallback((patch) => {
    setConfig(prev => ({ ...prev, ...patch }))
  }, [])

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG)
  }, [])

  // Helper to get static price for any option
  const getStaticOptionPrice = (optionMap, configKey) => {
    if (!configKey) return 0
    return optionMap[configKey]?.price ?? 0
  }

  const price = useMemo(() => {
    return (
      dynamicBasePrice +
      // Old options (unchanged)
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
      (mergedPickupOptions[config.pickups]?.price ?? PICKUP_OPTIONS[config.pickups]?.price ?? 0) +
      // General options
      (mergedDexterityOptions[config.dexterity]?.price ?? 0) +
      (mergedStringCountOptions[config.strings]?.price ?? 0) +
      (mergedMultiscaleOptions[config.multiscale]?.price ?? 0) +
      (mergedScaleLengthOptions[config.scaleLength]?.price ?? 0) +
      (mergedCaseOptions[config.case]?.price ?? 0) +
      // Body new options
      (mergedBevelOptions[config.bevel]?.price ?? 0) +
      (mergedTopWoodOptions[config.topWood]?.price ?? 0) +
      (mergedFinishTypeOptions[config.finishType]?.price ?? 0) +
      (mergedTopCoatOptions[config.topCoat]?.price ?? 0) +
       (mergedBurstFinishOptions[config.burstFinish]?.price ?? 0) +
       // Neck new options
       (mergedNeckConstructionOptions[config.neckConstruction]?.price ?? 0) +
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
    mergedNeckOptions, mergedFretboardOptions, mergedHeadstockOptions,
    mergedHeadstockWoodOptions, mergedInlayOptions, mergedBridgeOptions,
    pickguardOptions, knobOptions, mergedHardwareOptions, mergedPickupOptions,
    // New deps
    mergedDexterityOptions, mergedStringCountOptions, mergedMultiscaleOptions,
    mergedScaleLengthOptions, mergedCaseOptions, mergedBevelOptions,
    mergedTopWoodOptions, mergedFinishTypeOptions, mergedTopCoatOptions,
     mergedBurstFinishOptions, mergedNeckConstructionOptions, mergedDynamicInlayOptions,
     mergedDynamicNeckWoodOptions, mergedDynamicHeadstockWoodOptions, mergedDynamicFingerboardWoodOptions,
     mergedFretOptions, mergedNeckRearFinishOptions,
    mergedHeadstockShapeOptions, mergedTrussRodCoverOptions, mergedElectronicsTypeOptions,
      mergedPickupConfigurationOptions, mergedBridgePickupModelOptions,
      mergedMiddlePickupModelOptions, mergedNeckPickupModelOptions,
      mergedPickupColorOptions, mergedPickupPoleColorOptions, mergedControlsOptions,
    mergedSaddleOptions, mergedNutOptions, mergedTuningOptions,
    mergedStringBrandOptions, mergedOutputJackOptions, mergedStrapButtonOptions,
     mergedTunerButtonOptions, mergedElectronicsCavityCoverOptions, tremoloCoverOptions,
   ])

  const summary = useMemo(
    () => ({
      // Old summary (unchanged)
      body: BODY_OPTIONS[config.body]?.label ?? config.body,
      bodyWood: BODY_WOOD_OPTIONS[config.bodyWood]?.label ?? config.bodyWood,
      bodyFinish: BODY_FINISH_OPTIONS[config.bodyFinish]?.label ?? config.bodyFinish,
      neck: NECK_OPTIONS[config.neck]?.label ?? config.neck,
      fretboard: FRETBOARD_OPTIONS[config.fretboard]?.label ?? config.fretboard,
      headstock: HEADSTOCK_OPTIONS[config.headstock]?.label ?? config.headstock,
      headstockWood: HEADSTOCK_WOOD_OPTIONS[config.headstockWood]?.label ?? config.headstockWood,
      inlays: INLAY_OPTIONS[config.inlays]?.label ?? config.inlays,
      inlayShape: INLAY_SHAPE_OPTIONS[config.inlayShape]?.label ?? config.inlayShape,
      inlayMaterial: INLAY_MATERIAL_OPTIONS[config.inlayMaterial]?.label ?? config.inlayMaterial,
      bridge: BRIDGE_OPTIONS[config.bridge]?.label ?? config.bridge,
      pickguard: PICKGUARD_OPTIONS_BY_BODY[config.body]?.[config.pickguard]?.label ?? config.pickguard,
      knobs: config.body === 'dc' ? (KNOB_STYLE_OPTIONS[config.knobs]?.label ?? config.knobs) : (KNOB_OPTIONS_BY_BODY[config.body]?.[config.knobs]?.label ?? config.knobs),
      hardware: HARDWARE_OPTIONS[config.hardware]?.label ?? config.hardware,
      pickups: PICKUP_OPTIONS[config.pickups]?.label ?? config.pickups,
      // New summary fields
      dexterity: DEXTERITY_OPTIONS[config.dexterity]?.label ?? config.dexterity,
      strings: STRING_COUNT_OPTIONS[config.strings]?.label ?? config.strings,
      multiscale: MULTISCALE_OPTIONS[config.multiscale]?.label ?? config.multiscale,
      scaleLength: SCALE_LENGTH_OPTIONS[config.scaleLength]?.label ?? config.scaleLength,
      caseType: CASE_OPTIONS[config.case]?.label ?? config.case,
      bevel: BEVEL_OPTIONS[config.bevel]?.label ?? config.bevel,
      topWood: mergedDynamicTopWoodOptions[config.topWood]?.label ?? TOP_WOOD_OPTIONS[config.topWood]?.label ?? config.topWood,
      finishType: FINISH_TYPE_OPTIONS[config.finishType]?.label ?? config.finishType,
      topCoat: mergedDynamicTopCoatOptions[config.topCoat]?.label ?? TOP_COAT_OPTIONS[config.topCoat]?.label ?? config.topCoat,
      burstFinish: BURST_FINISH_OPTIONS[config.burstFinish]?.label ?? config.burstFinish,
      neckConstruction: NECK_CONSTRUCTION_OPTIONS[config.neckConstruction]?.label ?? config.neckConstruction,
      inlay: mergedDynamicInlayOptions[config.inlay]?.label ?? INLAY_OPTIONS[config.inlay]?.label ?? config.inlay,
      frets: FRET_OPTIONS[config.frets]?.label ?? config.frets,
      neckRearFinish: NECK_REAR_FINISH_OPTIONS[config.neckRearFinish]?.label ?? config.neckRearFinish,
      headstockShape: HEADSTOCK_SHAPE_OPTIONS[config.headstockShape]?.label ?? config.headstockShape,
      trussRodCover: TRUSS_ROD_COVER_OPTIONS[config.trussRodCover]?.label ?? config.trussRodCover,
      electronicsType: ELECTRONICS_TYPE_OPTIONS[config.electronicsType]?.label ?? config.electronicsType,
      pickupConfiguration: PICKUP_CONFIGURATION_OPTIONS[config.pickupConfiguration]?.label ?? config.pickupConfiguration,
      bridgePickupModel: PICKUP_MODEL_BRIDGE_OPTIONS[config.bridgePickupModel]?.label ?? config.bridgePickupModel,
      middlePickupModel: PICKUP_MODEL_MIDDLE_OPTIONS[config.middlePickupModel]?.label ?? config.middlePickupModel,
      neckPickupModel: PICKUP_MODEL_NECK_OPTIONS[config.neckPickupModel]?.label ?? config.neckPickupModel,
      pickupColor: PICKUP_COLOR_OPTIONS[config.pickupColor]?.label ?? config.pickupColor,
      pickupPoleColor: PICKUP_POLE_COLOR_OPTIONS[config.pickupPoleColor]?.label ?? config.pickupPoleColor,
      controls: CONTROLS_OPTIONS[config.controls]?.label ?? config.controls,
      saddle: SADDLE_OPTIONS[config.saddle]?.label ?? config.saddle,
      nut: NUT_OPTIONS[config.nut]?.label ?? config.nut,
      tuning: TUNING_OPTIONS[config.tuning]?.label ?? config.tuning,
      stringBrand: STRING_BRAND_OPTIONS[config.stringBrand]?.label ?? config.stringBrand,
      outputJack: OUTPUT_JACK_OPTIONS[config.outputJack]?.label ?? config.outputJack,
      strapButtons: STRAP_BUTTON_OPTIONS[config.strapButtons]?.label ?? config.strapButtons,
      tunerButtons: TUNER_BUTTON_OPTIONS[config.tunerButtons]?.label ?? config.tunerButtons,
      electronicsCavityCover: ELECTRONICS_CAVITY_COVER_OPTIONS[config.electronicsCavityCover]?.label ?? config.electronicsCavityCover,
      tremoloCover: TREMOLO_COVER_OPTIONS_BY_BRIDGE[config.bridge]?.[config.tremoloCover]?.label ?? config.tremoloCover,
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
      .map(([value, option]) => ({
        value,
        ...option,
        previewImageUrl: modelImageMap[value] || null,
      })),
    [config.guitarType, mergedBodyOptions, modelImageMap],
  )
  const guitarTypeOptions = useMemo(
    () => GUITAR_TYPE_OPTIONS,
    [],
  )
  const neckOptions = useMemo(
    () => {
      const base = dynamicNeckWoodList.length > 0 ? mergedDynamicNeckWoodOptions : mergedNeckOptions
      return Object.entries(base).map(([value, option]) => ({
        value,
        ...option,
        preview: option.texture || resolveNeckWoodAsset('electric', config.body || 'dc', value),
      }))
    },
    [dynamicNeckWoodList, mergedDynamicNeckWoodOptions, mergedNeckOptions, config.body],
  )
  const fretboardOptions = useMemo(
    () => {
      const base = dynamicFingerboardWoodList.length > 0 ? mergedDynamicFingerboardWoodOptions : mergedFretboardOptions
      return Object.entries(base).map(([value, option]) => ({
        value,
        ...option,
        preview: option.texture || resolveFingerboardWoodAsset('electric', config.body || 'dc', value),
      }))
    },
    [dynamicFingerboardWoodList, mergedDynamicFingerboardWoodOptions, mergedFretboardOptions, config.body],
  )
  const headstockOptions = useMemo(
    () => Object.entries(mergedHeadstockOptions).map(([value, option]) => ({ value, ...option, preview: option.logo })),
    [mergedHeadstockOptions],
  )
  const headstockWoodOptions = useMemo(
    () => {
      const base = dynamicHeadstockWoodList.length > 0 ? mergedDynamicHeadstockWoodOptions : mergedHeadstockWoodOptions
      return Object.entries(base).map(([value, option]) => ({
        value,
        ...option,
        preview: option.texture || resolveHeadstockWoodAsset('electric', config.body || 'dc', value),
      }))
    },
    [dynamicHeadstockWoodList, mergedDynamicHeadstockWoodOptions, mergedHeadstockWoodOptions, config.body],
  )
  const neckWoodOptions = useMemo(
    () => {
      const base = dynamicNeckWoodList.length > 0 ? mergedDynamicNeckWoodOptions : mergedNeckOptions
      return Object.entries(base).map(([value, option]) => ({
        value,
        ...option,
        preview: option.texture || resolveNeckWoodAsset('electric', config.body || 'dc', value),
      }))
    },
    [dynamicNeckWoodList, mergedDynamicNeckWoodOptions, mergedNeckOptions, config.body],
  )
  const fingerboardWoodOptions = useMemo(
    () => {
      const base = dynamicFingerboardWoodList.length > 0 ? mergedDynamicFingerboardWoodOptions : mergedFretboardOptions
      return Object.entries(base).map(([value, option]) => ({
        value,
        ...option,
        preview: option.texture || resolveFingerboardWoodAsset('electric', config.body || 'dc', value),
      }))
    },
    [dynamicFingerboardWoodList, mergedDynamicFingerboardWoodOptions, mergedFretboardOptions, config.body],
  )
  const inlayOptions = useMemo(
    () => {
      const base = dynamicInlayList.length > 0 ? mergedDynamicInlayOptions : mergedInlayOptions
      return Object.entries(base).map(([value, option]) => ({
        value,
        ...option,
        preview: option.src || resolveInlay('electric', config.body || 'dc', value),
      }))
    },
    [dynamicInlayList, mergedDynamicInlayOptions, mergedInlayOptions, config.body],
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

  // ---- New options arrays (for UI use) ----
  const dexterityOptions = useMemo(
    () => Object.entries(mergedDexterityOptions).map(([value, option]) => ({ value, ...option })),
    [mergedDexterityOptions],
  )
  const stringCountOptions = useMemo(
    () => Object.entries(mergedStringCountOptions).map(([value, option]) => ({ value, ...option })),
    [mergedStringCountOptions],
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
  const bevelOptions = useMemo(
    () => Object.entries(mergedBevelOptions).map(([value, option]) => ({ value, ...option })),
    [mergedBevelOptions],
  )
  const topWoodOptions = useMemo(
    () => {
      const base = dynamicTopWoodList.length > 0 ? mergedDynamicTopWoodOptions : mergedTopWoodOptions
      return Object.entries(base).map(([value, option]) => ({
        value,
        ...option,
        preview: option.texture || resolveTopWoodAsset('electric', config.body || 'dc', value),
      }))
    },
    [dynamicTopWoodList, mergedDynamicTopWoodOptions, mergedTopWoodOptions, config.body],
  )
  const finishColorOptions = useMemo(() => {
    const base = dynamicFinishColorList.length > 0 ? mergedDynamicFinishColorOptions : null
    if (base && Object.keys(base).length > 0) {
      return Object.entries(base).map(([value, option]) => {
        const preview = resolveFinishAsset('electric', config.body || 'dc', config.finishType || 'solid', value)
        return { value, ...option, preview }
      })
    }
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
        { value: 'tigers-eye', label: 'Tigers Eye', price: 35 },
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
    const basePrice = priceOverrides.finishColor?.price ?? 0
    return fallback.map(option => ({
      ...option,
      price: option.price || basePrice,
      preview: resolveFinishAsset('electric', config.body || 'dc', finishType, option.value),
    }))
  }, [dynamicFinishColorList, mergedDynamicFinishColorOptions, config.body, config.finishType, priceOverrides])
  const finishTypeOptionList = useMemo(
    () => Object.entries(mergedFinishTypeOptions).map(([value, option]) => ({ value, ...option })),
    [mergedFinishTypeOptions],
  )
  const topCoatOptions = useMemo(
    () => {
      const base = dynamicTopCoatList.length > 0 ? mergedDynamicTopCoatOptions : mergedTopCoatOptions
      return Object.entries(base).map(([value, option]) => ({
        value,
        ...option,
        preview: resolveTopCoatAsset('electric', config.body || 'dc', value),
      }))
    },
    [dynamicTopCoatList, mergedDynamicTopCoatOptions, mergedTopCoatOptions, config.body],
  )
  const burstFinishOptionList = useMemo(
    () => Object.entries(mergedBurstFinishOptions).map(([value, option]) => ({ value, ...option })),
    [mergedBurstFinishOptions],
  )
  const neckConstructionOptionList = useMemo(
    () => Object.entries(mergedNeckConstructionOptions).map(([value, option]) => ({ value, ...option })),
    [mergedNeckConstructionOptions],
  )
  const fretOptionList = useMemo(
    () => Object.entries(mergedFretOptions).map(([value, option]) => ({ value, ...option })),
    [mergedFretOptions],
  )
  const neckRearFinishOptionList = useMemo(
    () => Object.entries(mergedNeckRearFinishOptions).map(([value, option]) => ({ value, ...option })),
    [mergedNeckRearFinishOptions],
  )
  const headstockShapeOptionList = useMemo(
    () => Object.entries(mergedHeadstockShapeOptions).map(([value, option]) => ({ value, ...option })),
    [mergedHeadstockShapeOptions],
  )
  const trussRodCoverOptionList = useMemo(
    () => Object.entries(mergedTrussRodCoverOptions).map(([value, option]) => ({ value, ...option })),
    [mergedTrussRodCoverOptions],
  )
  const electronicsTypeOptionList = useMemo(
    () => Object.entries(mergedElectronicsTypeOptions).map(([value, option]) => ({ value, ...option })),
    [mergedElectronicsTypeOptions],
  )
  const pickupConfigurationOptionList = useMemo(
    // Responsible for providing pickup configuration options to the UI (HH / H-S-H)
    () => Object.entries(mergedPickupConfigurationOptions).map(([value, option]) => ({ value, ...option })),
    [mergedPickupConfigurationOptions],
  )
  const bridgePickupModelOptionList = useMemo(
    // Responsible for providing bridge humbucker model options to the UI
    () => Object.entries(mergedBridgePickupModelOptions).map(([value, option]) => ({ value, ...option })),
    [mergedBridgePickupModelOptions],
  )
  const middlePickupModelOptionList = useMemo(
    // Responsible for providing middle single coil model options to the UI
    () => Object.entries(mergedMiddlePickupModelOptions).map(([value, option]) => ({ value, ...option })),
    [mergedMiddlePickupModelOptions],
  )
  const neckPickupModelOptionList = useMemo(
    // Responsible for providing neck humbucker model options to the UI
    () => Object.entries(mergedNeckPickupModelOptions).map(([value, option]) => ({ value, ...option })),
    [mergedNeckPickupModelOptions],
  )
  const pickupColorOptionList = useMemo(
    // Responsible for providing pickup color/style options to the UI (bobbins, painted, wooden, covers)
    () => Object.entries(mergedPickupColorOptions).map(([value, option]) => ({ value, ...option })),
    [mergedPickupColorOptions],
  )
  const pickupColorVariantOptionList = useMemo(() => {
    // Responsible for providing pickup color variant options to the UI (bobbin colors, cover colors)
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
  }, [config.pickupColor])
  const pickupPoleColorOptionList = useMemo(
    () => Object.entries(mergedPickupPoleColorOptions).map(([value, option]) => ({ value, ...option })),
    [mergedPickupPoleColorOptions],
  )
  const controlsOptionList = useMemo(
    () => Object.entries(mergedControlsOptions).map(([value, option]) => ({ value, ...option })),
    [mergedControlsOptions],
  )
  const saddleOptionList = useMemo(
    () => Object.entries(mergedSaddleOptions).map(([value, option]) => ({ value, ...option })),
    [mergedSaddleOptions],
  )
  const nutOptionList = useMemo(
    () => Object.entries(mergedNutOptions).map(([value, option]) => ({ value, ...option })),
    [mergedNutOptions],
  )
  const tuningOptionList = useMemo(
    () => Object.entries(mergedTuningOptions).map(([value, option]) => ({ value, ...option })),
    [mergedTuningOptions],
  )
  const stringBrandOptionList = useMemo(
    () => Object.entries(mergedStringBrandOptions).map(([value, option]) => ({ value, ...option })),
    [mergedStringBrandOptions],
  )
  const outputJackOptionList = useMemo(
    () => Object.entries(mergedOutputJackOptions).map(([value, option]) => ({ value, ...option })),
    [mergedOutputJackOptions],
  )
  const strapButtonOptionList = useMemo(
    () => Object.entries(mergedStrapButtonOptions).map(([value, option]) => ({ value, ...option })),
    [mergedStrapButtonOptions],
  )
  const tunerButtonOptionList = useMemo(
    () => Object.entries(mergedTunerButtonOptions).map(([value, option]) => ({ value, ...option })),
    [mergedTunerButtonOptions],
  )
  const electronicsCavityCoverOptionList = useMemo(
    () => Object.entries(mergedElectronicsCavityCoverOptions).map(([value, option]) => ({ value, ...option })),
    [mergedElectronicsCavityCoverOptions],
  )
  const tremoloCoverOptionList = useMemo(
    () => Object.entries(tremoloCoverOptions).map(([value, option]) => ({ value, ...option })),
    [tremoloCoverOptions],
  )

  const exportConfig = useCallback(() => JSON.stringify(config, null, 2), [config])

  const loadConfig = useCallback((raw) => {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    setConfig(prev => {
      const merged = {
        ...DEFAULT_CONFIG,
        ...prev,
        ...parsed,
      }
      const legacyInlay = parseLegacyInlay(merged.inlay || merged.inlays)
      if (legacyInlay) {
        merged.inlayShape = merged.inlayShape || legacyInlay.shape
        merged.inlayMaterial = merged.inlayMaterial || legacyInlay.material
      }
      if (merged.inlayShape && merged.inlayMaterial) {
        merged.inlay = buildLegacyInlayKey(merged.inlayShape, merged.inlayMaterial)
      }
      merged.trussRodCover = normalizeTrussRodCover(merged.trussRodCover)
      merged.headstockShape = normalizeHeadstockShape(merged.headstockShape || merged.headstock)
      merged.headstock = merged.headstockShape
      return merged
    })
  }, [])

  useEffect(() => {
    const shape = normalizeHeadstockShape(config.headstockShape || config.headstock)
    if (config.headstockShape !== shape || config.headstock !== shape) {
      setConfig(prev => ({ ...prev, headstockShape: shape, headstock: shape }))
    }
  }, [config.headstockShape, config.headstock])

  useEffect(() => {
    const patch = {}
    if (config.pickupBobbin && !config.pickupColor) {
      patch.pickupColor = 'bobbins'
      patch.pickupColorVariant = config.pickupBobbin === 'open' ? 'black' : config.pickupBobbin === 'standard' ? 'black' : config.pickupBobbin === 'singlecoil' ? 'black' : 'black'
    }
    if (config.pickupColor && typeof config.pickupColor === 'string' && config.pickupColor.includes('-')) {
      const parts = config.pickupColor.split('-')
      const type = parts[0]
      const variant = parts.slice(1).join('-')
      if (type === 'covered') {
        patch.pickupColor = 'covers'
        patch.pickupColorVariant = variant
      } else if (type === 'open') {
        patch.pickupColor = 'bobbins'
        patch.pickupColorVariant = variant
      }
    }
    if (Object.keys(patch).length > 0) {
      setConfig(prev => ({ ...prev, ...patch }))
    }
  }, [config.pickupBobbin, config.pickupColor])

  const pricingBreakdown = useMemo(() => ({
      // Old pricing keys (unchanged)
      base: dynamicBasePrice,
      body: mergedBodyOptions[config.body]?.price ?? BODY_OPTIONS[config.body]?.price ?? 0,
      bodyWood: mergedBodyWoodOptions[config.bodyWood]?.price ?? BODY_WOOD_OPTIONS[config.bodyWood]?.price ?? 0,
      bodyFinish: mergedBodyFinishOptions[config.bodyFinish]?.price ?? BODY_FINISH_OPTIONS[config.bodyFinish]?.price ?? 0,
      neck: mergedNeckOptions[config.neck]?.price ?? NECK_OPTIONS[config.neck]?.price ?? 0,
      fretboard: mergedFretboardOptions[config.fretboard]?.price ?? FRETBOARD_OPTIONS[config.fretboard]?.price ?? 0,
      headstock: mergedHeadstockOptions[config.headstock]?.price ?? HEADSTOCK_OPTIONS[config.headstock]?.price ?? 0,
      headstockWood: mergedHeadstockWoodOptions[config.headstockWood]?.price ?? HEADSTOCK_WOOD_OPTIONS[config.headstockWood]?.price ?? 0,
      inlays: mergedInlayOptions[config.inlays]?.price ?? INLAY_OPTIONS[config.inlays]?.price ?? 0,
      inlayShape: mergedInlayShapeOptions[config.inlayShape]?.price ?? 0,
      inlayMaterial: mergedInlayMaterialOptions[config.inlayMaterial]?.price ?? 0,
      bridge: mergedBridgeOptions[config.bridge]?.price ?? BRIDGE_OPTIONS[config.bridge]?.price ?? 0,
      pickguard: pickguardOptions.find(option => option.value === config.pickguard)?.price ?? 0,
      knobs: knobOptions.find(option => option.value === config.knobs)?.price ?? 0,
      hardware: mergedHardwareOptions[config.hardware]?.price ?? HARDWARE_OPTIONS[config.hardware]?.price ?? 0,
      pickups: mergedPickupOptions[config.pickups]?.price ?? PICKUP_OPTIONS[config.pickups]?.price ?? 0,
      // New pricing keys
      dexterity: mergedDexterityOptions[config.dexterity]?.price ?? 0,
      strings: mergedStringCountOptions[config.strings]?.price ?? 0,
      multiscale: mergedMultiscaleOptions[config.multiscale]?.price ?? 0,
      scaleLength: mergedScaleLengthOptions[config.scaleLength]?.price ?? 0,
      caseType: mergedCaseOptions[config.case]?.price ?? 0,
      bevel: mergedBevelOptions[config.bevel]?.price ?? 0,
      topWood: mergedDynamicTopWoodOptions[config.topWood]?.price ?? 0,
      finishType: mergedFinishTypeOptions[config.finishType]?.price ?? 0,
      topCoat: mergedDynamicTopCoatOptions[config.topCoat]?.price ?? 0,
      burstFinish: mergedBurstFinishOptions[config.burstFinish]?.price ?? 0,
      neckConstruction: mergedNeckConstructionOptions[config.neckConstruction]?.price ?? 0,
      inlay: mergedDynamicInlayOptions[config.inlay]?.price ?? 0,
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
     mergedNeckOptions, mergedFretboardOptions, mergedHeadstockOptions,
     mergedHeadstockWoodOptions, mergedInlayOptions, mergedBridgeOptions,
     pickguardOptions, knobOptions, mergedHardwareOptions, mergedPickupOptions,
     // New deps
     mergedDexterityOptions, mergedStringCountOptions, mergedMultiscaleOptions,
     mergedScaleLengthOptions, mergedCaseOptions, mergedBevelOptions,
     mergedTopWoodOptions, mergedFinishTypeOptions, mergedTopCoatOptions,
     mergedBurstFinishOptions, mergedNeckConstructionOptions, mergedDynamicInlayOptions,
     mergedDynamicNeckWoodOptions, mergedDynamicHeadstockWoodOptions, mergedDynamicFingerboardWoodOptions,
     mergedFretOptions, mergedNeckRearFinishOptions,
     mergedHeadstockShapeOptions, mergedTrussRodCoverOptions, mergedElectronicsTypeOptions,
      mergedPickupConfigurationOptions, mergedBridgePickupModelOptions,
      mergedMiddlePickupModelOptions, mergedNeckPickupModelOptions,
      mergedPickupColorOptions, mergedPickupPoleColorOptions, mergedControlsOptions,
     mergedSaddleOptions, mergedNutOptions, mergedTuningOptions,
     mergedStringBrandOptions, mergedOutputJackOptions, mergedStrapButtonOptions,
     mergedTunerButtonOptions, mergedElectronicsCavityCoverOptions, tremoloCoverOptions,
   ])

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
      inlayShapeOptions,
      inlayMaterialOptions,
      bridgeOptions,
      pickguardOptions,
      knobOptions,
      knobStyleOptionList,
      pickupOptions,
      hardwareOptions,
      basePrice: dynamicBasePrice,
      // New options
      dexterityOptions,
      stringCountOptions,
      multiscaleOptions,
      scaleLengthOptions,
      caseOptions,
      bevelOptions,
      neckWoodOptions,
      headstockWoodOptions,
      fingerboardWoodOptions,
      topWoodOptions,
      finishColorOptions,
      finishTypeOptions: finishTypeOptionList,
      topCoatOptions,
      burstFinishOptions: burstFinishOptionList,
      neckConstructionOptions: neckConstructionOptionList,
      inlayOptions,
      fretOptions: fretOptionList,
      neckRearFinishOptions: neckRearFinishOptionList,
      headstockShapeOptions: headstockShapeOptionList,
      trussRodCoverOptions: trussRodCoverOptionList,
      electronicsTypeOptions: electronicsTypeOptionList,
      pickupConfigurationOptions: pickupConfigurationOptionList,
      bridgePickupModelOptions: bridgePickupModelOptionList,
      middlePickupModelOptions: middlePickupModelOptionList,
      neckPickupModelOptions: neckPickupModelOptionList,
      pickupColorOptions: pickupColorOptionList,
      pickupColorVariantOptions: pickupColorVariantOptionList,
      pickupWoodTypeOptions: [
        { value: 'black', label: 'Black', note: 'Dark wood grain', price: 0 },
        { value: 'white', label: 'White', note: 'Light wood grain', price: 0 },
        { value: 'cream', label: 'Cream', note: 'Cream wood grain', price: 0 },
        { value: 'racing-green', label: 'Racing Green', note: 'Green wood grain', price: 0 },
      ],
      pickupPoleColorOptions: pickupPoleColorOptionList,
      controlsOptions: controlsOptionList,
      saddleOptions: saddleOptionList,
      nutOptions: nutOptionList,
      tuningOptions: tuningOptionList,
      stringBrandOptions: stringBrandOptionList,
      outputJackOptions: outputJackOptionList,
      strapButtonOptions: strapButtonOptionList,
       tunerButtonOptions: tunerButtonOptionList,
     electronicsCavityCoverOptions: electronicsCavityCoverOptionList,
       tremoloCoverOptions: tremoloCoverOptionList,
       tuningDisclaimer: TUNING_DISCLAIMER,
     },
   }
 }