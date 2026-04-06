import { useEffect, useMemo, useState } from 'react'
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
  BASS_HARDWARE_OPTIONS,
  BASS_INLAY_OPTIONS,
  BASS_PICKGUARD_OPTIONS,
  BASS_KNOB_OPTIONS,
  BASS_PICKUP_OPTIONS,
  BASS_STRING_OPTIONS,
  BASS_PICKUP_CONFIG_OPTIONS,
  BASS_TYPE_OPTIONS,
  bassBuilder,
} from '../lib/bassBuilderData.js'

export default function useBassConfig() {
  const [config, setConfig] = useState(BASS_DEFAULT_CONFIG)

  useEffect(() => {
    const pickguardKeys = Object.keys(BASS_PICKGUARD_OPTIONS[config.bassType] ?? BASS_PICKGUARD_OPTIONS.vader)
    const knobKeys = Object.keys(BASS_KNOB_OPTIONS[config.bassType] ?? BASS_KNOB_OPTIONS.vader)
    const nextPickguard = pickguardKeys.includes(config.pickguard) ? config.pickguard : pickguardKeys[0]
    const nextKnobs = knobKeys.includes(config.knobs) ? config.knobs : knobKeys[0]

    if (nextPickguard !== config.pickguard || nextKnobs !== config.knobs) {
      setConfig(prev => ({
        ...prev,
        pickguard: nextPickguard,
        knobs: nextKnobs,
      }))
    }
  }, [config.bassType, config.knobs, config.pickguard])

  const updateConfig = patch => setConfig(prev => ({ ...prev, ...patch }))

  const resetConfig = () => setConfig(BASS_DEFAULT_CONFIG)

  const price = useMemo(() => {
    return (
      BASS_BASE_PRICE +
      (BASS_BODY_OPTIONS[config.bassType]?.price ?? 0) +
      (BASS_BODY_WOOD_OPTIONS[config.bodyWood]?.price ?? 0) +
      (BASS_BODY_FINISH_OPTIONS[config.bodyFinish]?.price ?? 0) +
      (BASS_NECK_OPTIONS[config.neck]?.price ?? 0) +
      (BASS_FRETBOARD_OPTIONS[config.fretboard]?.price ?? 0) +
      (BASS_HEADSTOCK_WOOD_OPTIONS[config.headstockWood]?.price ?? 0) +
      (BASS_INLAY_OPTIONS[config.inlays]?.price ?? 0) +
      (BASS_BRIDGE_OPTIONS[config.bridge]?.price ?? 0) +
      (BASS_PICKGUARD_OPTIONS[config.bassType]?.[config.pickguard]?.price ?? 0) +
      (BASS_KNOB_OPTIONS[config.bassType]?.[config.knobs]?.price ?? 0) +
      (BASS_HARDWARE_OPTIONS[config.hardware]?.price ?? 0) +
      (BASS_PICKUP_OPTIONS[config.pickups]?.price ?? 0) +
      (BASS_STRING_OPTIONS[config.strings]?.price ?? 0)
    )
  }, [config])

  const summary = useMemo(
    () => ({
      body: BASS_BODY_OPTIONS[config.bassType]?.label ?? config.bassType,
      bodyWood: BASS_BODY_WOOD_OPTIONS[config.bodyWood]?.label ?? config.bodyWood,
      bodyFinish: BASS_BODY_FINISH_OPTIONS[config.bodyFinish]?.label ?? config.bodyFinish,
      neck: BASS_NECK_OPTIONS[config.neck]?.label ?? config.neck,
      fretboard: BASS_FRETBOARD_OPTIONS[config.fretboard]?.label ?? config.fretboard,
      headstockWood: BASS_HEADSTOCK_WOOD_OPTIONS[config.headstockWood]?.label ?? config.headstockWood,
      inlays: BASS_INLAY_OPTIONS[config.inlays]?.label ?? config.inlays,
      bridge: BASS_BRIDGE_OPTIONS[config.bridge]?.label ?? config.bridge,
      pickguard: BASS_PICKGUARD_OPTIONS[config.bassType]?.[config.pickguard]?.label ?? config.pickguard,
      knobs: BASS_KNOB_OPTIONS[config.bassType]?.[config.knobs]?.label ?? config.knobs,
      hardware: BASS_HARDWARE_OPTIONS[config.hardware]?.label ?? config.hardware,
      pickups: BASS_PICKUP_OPTIONS[config.pickups]?.label ?? config.pickups,
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
    () => Object.entries(BASS_BODY_WOOD_OPTIONS).map(([value, option]) => ({ value, ...option, preview: option.texture })),
    [],
  )
  const bodyFinishOptions = useMemo(
    () => Object.entries(BASS_BODY_FINISH_OPTIONS).map(([value, option]) => ({ value, ...option, preview: option.texture })),
    [],
  )
  const bodyOptions = useMemo(
    () => Object.entries(BASS_BODY_OPTIONS).map(([value, option]) => ({ value, ...option })),
    [],
  )
  const neckOptions = useMemo(
    () => Object.entries(BASS_NECK_OPTIONS).map(([value, option]) => ({ value, ...option })),
    [],
  )
  const fretboardOptions = useMemo(
    () => Object.entries(BASS_FRETBOARD_OPTIONS).map(([value, option]) => ({ value, ...option })),
    [],
  )
  const headstockWoodOptions = useMemo(
    () => Object.entries(BASS_HEADSTOCK_WOOD_OPTIONS).map(([value, option]) => ({ value, ...option, preview: option.texture })),
    [],
  )
  const inlayOptions = useMemo(
    () => Object.entries(BASS_INLAY_OPTIONS).map(([value, option]) => ({ value, ...option, preview: option.src })),
    [],
  )
  const bridgeOptions = useMemo(
    () =>
      Object.entries(BASS_BRIDGE_OPTIONS).map(([value, option]) => ({
        value,
        ...option,
        preview: option.assets?.[config.hardware] ?? option.assets?.chrome ?? option.assets?.black ?? option.assets?.gold,
      })),
    [config.hardware],
  )
  const pickguardOptions = useMemo(
    () =>
      Object.entries(BASS_PICKGUARD_OPTIONS[config.bassType] ?? BASS_PICKGUARD_OPTIONS.vader).map(([value, option]) => ({
        value,
        ...option,
        preview: option.src,
      })),
    [config.bassType],
  )
  const knobOptions = useMemo(
    () =>
      Object.entries(BASS_KNOB_OPTIONS[config.bassType] ?? BASS_KNOB_OPTIONS.vader).map(([value, option]) => ({
        value,
        ...option,
        preview: option.src,
      })),
    [config.bassType],
  )
  const pickupOptions = useMemo(
    () => Object.entries(BASS_PICKUP_OPTIONS).map(([value, option]) => ({ value, ...option })),
    [],
  )
  const pickupConfigOptions = useMemo(
    () => Object.entries(BASS_PICKUP_CONFIG_OPTIONS).map(([value, option]) => ({ value, ...option })),
    [],
  )
  const stringOptions = useMemo(
    () => Object.entries(BASS_STRING_OPTIONS).map(([value, option]) => ({ value, ...option })),
    [],
  )
  const hardwareOptions = useMemo(
    () => Object.entries(BASS_HARDWARE_OPTIONS).map(([value, option]) => ({ value, ...option })),
    [],
  )

  const exportConfig = () => JSON.stringify(config, null, 2)

  const loadConfig = raw => {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    setConfig(prev => ({
      ...BASS_DEFAULT_CONFIG,
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
    builder: bassBuilder,
    options: {
      bassTypeOptions,
      bodyOptions,
      bodyWoodOptions,
      bodyFinishOptions,
      neckOptions,
      fretboardOptions,
      headstockWoodOptions,
      inlayOptions,
      bridgeOptions,
      pickguardOptions,
      knobOptions,
      pickupOptions,
      pickupConfigOptions,
      stringOptions,
      hardwareOptions,
    },
  }
}