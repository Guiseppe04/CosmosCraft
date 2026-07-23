/**
 * useDynamicConfigurator
 *
 * Bridges the new dynamic schema with the existing useGuitarConfig hook.
 * Manages category/model selection, config syncing, and asset resolution.
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  CATEGORIES,
  getDefaultConfig,
  getFieldOptions,
  isFieldVisible,
  OPTION_FIELDS,
} from '../lib/configuratorSchema'

export default function useDynamicConfigurator(baseConfig, updateConfig, resetConfig) {
  const [guitarCategory, setGuitarCategory] = useState('electric')
  const [guitarModel, setGuitarModel] = useState('dc')
  const [activeSection, setActiveSection] = useState('General')

  // When category changes, reset to first available model
  const handleCategoryChange = useCallback(
    (category) => {
      setGuitarCategory(category)
      const models = Object.keys(CATEGORIES[category]?.models || {})
      const firstModel = models[0] || 'dc'
      setGuitarModel(firstModel)
      
      // Load default config for the new category/model
      const defaults = getDefaultConfig(category, firstModel)
      resetConfig()
      updateConfig(defaults)
    },
    [resetConfig, updateConfig]
  )

  // When model changes, load its defaults
  const handleModelChange = useCallback(
    (model) => {
      setGuitarModel(model)
      
      // Sync the body key and other model-specific defaults
      const defaults = getDefaultConfig(guitarCategory, model)
      updateConfig(defaults)
    },
    [guitarCategory, updateConfig]
  )

  // Sync body config key when model changes
  useEffect(() => {
    if (baseConfig.body !== guitarModel) {
      updateConfig({ body: guitarModel })
    }
  }, [guitarModel, baseConfig.body, updateConfig])

  // Map finish color from new schema to the existing bodyFinish field
  const mappedConfig = useMemo(() => {
    // Bridge between new schema keys and existing config keys
    const mapped = { ...baseConfig }

    // Map hardwareColor -> hardware (existing field)
    if (mapped.hardwareColor && mapped.hardware !== mapped.hardwareColor) {
      mapped.hardware = mapped.hardwareColor
    }

    // Map neckWood -> neck (existing field)
    if (mapped.neckWood && mapped.neck !== mapped.neckWood) {
      mapped.neck = mapped.neckWood
    }

    // Map fingerboardWood -> fretboard (existing field)
    if (mapped.fingerboardWood && mapped.fretboard !== mapped.fingerboardWood) {
      mapped.fretboard = mapped.fingerboardWood
    }

    // Map headstockShape -> headstock (existing field)
    if (mapped.headstockShape && mapped.headstock !== mapped.headstockShape) {
      mapped.headstock = mapped.headstockShape
    }

    // Map finishColor -> bodyFinish
    if (mapped.finishColor && mapped.bodyFinish !== mapped.finishColor) {
      mapped.bodyFinish = mapped.finishColor
    }

    return mapped
  }, [baseConfig])

  // Wrap updateConfig to sync both schemas
  const handleUpdateConfig = useCallback(
    (patch) => {
      const syncedPatch = { ...patch }

      // Reverse mapping: when new schema keys change, update old ones too
      if (patch.hardwareColor) syncedPatch.hardware = patch.hardwareColor
      if (patch.neckWood) syncedPatch.neck = patch.neckWood
      if (patch.fingerboardWood) syncedPatch.fretboard = patch.fingerboardWood
      if (patch.headstockShape) syncedPatch.headstock = patch.headstockShape
      if (patch.finishColor) syncedPatch.bodyFinish = patch.finishColor
      if (patch.finishColor && patch.finishType) {
        syncedPatch.bodyFinish = patch.finishColor
      }

      // When pickupConfiguration changes, update old pickups field
      if (patch.pickupConfiguration) syncedPatch.pickups = patch.pickupConfiguration

      // Sync hardware color with existing knob colors too if applicable
      if (patch.knobs && baseConfig.knobs !== patch.knobs) {
        // knob change is fine as-is
      }

      updateConfig(syncedPatch)
    },
    [updateConfig, baseConfig]
  )

  // Get options for the current field config
  const getOptionsForField = useCallback(
    (field) => {
      return getFieldOptions(field, baseConfig, guitarCategory, guitarModel)
    },
    [baseConfig, guitarCategory, guitarModel]
  )

  return {
    // Current state
    guitarCategory,
    guitarModel,
    activeSection,
    mappedConfig,

    // Actions
    setActiveSection,
    handleCategoryChange,
    handleModelChange,
    handleUpdateConfig,

    // Helpers
    getOptionsForField,

    // Available models/categories
    categories: CATEGORIES,
    availableModels: Object.keys(CATEGORIES[guitarCategory]?.models || {}),
  }
