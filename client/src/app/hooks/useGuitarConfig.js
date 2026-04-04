import { useEffect, useMemo, useState } from 'react'
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

export default function useGuitarConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)

  // Auto-select valid body when guitar type changes
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

  const updateConfig = patch => setConfig(prev => ({ ...prev, ...patch }))

  const resetConfig = () => setConfig(DEFAULT_CONFIG)

  const price = useMemo(() => {
    return (
      BASE_PRICE +
      (BODY_OPTIONS[config.body]?.price ?? 0) +
      (BODY_WOOD_OPTIONS[config.bodyWood]?.price ?? 0) +
      (BODY_FINISH_OPTIONS[config.bodyFinish]?.price ?? 0) +
      (NECK_OPTIONS[config.neck]?.price ?? 0) +
      (FRETBOARD_OPTIONS[config.fretboard]?.price ?? 0) +
      (HEADSTOCK_OPTIONS[config.headstock]?.price ?? 0) +
      (HEADSTOCK_WOOD_OPTIONS[config.headstockWood]?.price ?? 0) +
      (INLAY_OPTIONS[config.inlays]?.price ?? 0) +
      (BRIDGE_OPTIONS[config.bridge]?.price ?? 0) +
      (PICKGUARD_OPTIONS_BY_BODY[config.body]?.[config.pickguard]?.price ?? 0) +
      (KNOB_OPTIONS_BY_BODY[config.body]?.[config.knobs]?.price ?? 0) +
      (HARDWARE_OPTIONS[config.hardware]?.price ?? 0) +
      (PICKUP_OPTIONS[config.pickups]?.price ?? 0)
    )
  }, [config])

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
    () => Object.entries(BODY_WOOD_OPTIONS).map(([value, option]) => ({ value, ...option, preview: option.texture })),
    [],
  )
  const bodyFinishOptions = useMemo(
    () => Object.entries(BODY_FINISH_OPTIONS).map(([value, option]) => ({ value, ...option, preview: option.texture })),
    [],
  )
  const bodyOptions = useMemo(
    () => Object.entries(BODY_OPTIONS)
      .filter(([, opt]) => !opt.types || opt.types.includes(config.guitarType))
      .map(([value, option]) => ({ value, ...option })),
    [config.guitarType],
  )
  const guitarTypeOptions = useMemo(
    () => GUITAR_TYPE_OPTIONS,
    [],
  )
  const neckOptions = useMemo(
    () => Object.entries(NECK_OPTIONS).map(([value, option]) => ({ value, ...option })),
    [],
  )
  const fretboardOptions = useMemo(
    () => Object.entries(FRETBOARD_OPTIONS).map(([value, option]) => ({ value, ...option })),
    [],
  )
  const headstockOptions = useMemo(
    () => Object.entries(HEADSTOCK_OPTIONS).map(([value, option]) => ({ value, ...option, preview: option.logo })),
    [],
  )
  const headstockWoodOptions = useMemo(
    () => Object.entries(HEADSTOCK_WOOD_OPTIONS).map(([value, option]) => ({ value, ...option, preview: option.texture })),
    [],
  )
  const inlayOptions = useMemo(
    () => Object.entries(INLAY_OPTIONS).map(([value, option]) => ({ value, ...option, preview: option.src })),
    [],
  )
  const bridgeOptions = useMemo(
    () =>
      Object.entries(BRIDGE_OPTIONS).map(([value, option]) => ({
        value,
        ...option,
        preview: option.assets?.[config.hardware] ?? option.assets?.chrome ?? option.assets?.black ?? option.assets?.gold,
      })),
    [config.hardware],
  )
  const pickguardOptions = useMemo(
    () =>
      Object.entries(PICKGUARD_OPTIONS_BY_BODY[config.body] ?? PICKGUARD_OPTIONS_BY_BODY.strat).map(([value, option]) => ({
        value,
        ...option,
        preview: option.src,
      })),
    [config.body],
  )
  const knobOptions = useMemo(
    () =>
      Object.entries(KNOB_OPTIONS_BY_BODY[config.body] ?? KNOB_OPTIONS_BY_BODY.strat).map(([value, option]) => ({
        value,
        ...option,
        preview: option.src,
      })),
    [config.body],
  )
  const pickupOptions = useMemo(
    () => Object.entries(PICKUP_OPTIONS).map(([value, option]) => ({ value, ...option })),
    [],
  )
  const hardwareOptions = useMemo(
    () => Object.entries(HARDWARE_OPTIONS).map(([value, option]) => ({ value, ...option })),
    [],
  )

  const exportConfig = () => JSON.stringify(config, null, 2)

  const loadConfig = raw => {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    setConfig(prev => ({
      ...DEFAULT_CONFIG,
      ...prev,
      ...parsed,
    }))
  }

  return {
    config,
    setConfig,
    updateConfig,
    resetConfig,
    price,
    summary,
    exportConfig,
    loadConfig,
    builder: guitarBuilder,
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
    },
  }
}
