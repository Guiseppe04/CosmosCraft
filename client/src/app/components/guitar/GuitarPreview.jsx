import { memo, useMemo } from 'react'
import { CircleDot, Trash2 } from 'lucide-react'
import {
  guitarBuilder,
  NECK_FRETS,
  NECK_MASK,
  NECK_NUT,
  resolveVariant,
} from '../../lib/guitarBuilderData.js'

const layerStyle = (src, extra = {}) => ({
  backgroundImage: `url(${src})`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
  backgroundSize: 'contain',
  ...extra,
})

const maskedLayerStyle = (maskSrc, extra = {}) => ({
  backgroundColor: 'transparent',
  WebkitMaskImage: `url(${maskSrc})`,
  maskImage: `url(${maskSrc})`,
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
  ...extra,
})

function GuitarLayer({ src, maskSrc, style, className = '' }) {
  if (!src && !maskSrc) return null
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none select-none ${className}`}
      style={maskSrc ? maskedLayerStyle(maskSrc, style) : layerStyle(src, style)}
    />
  )
}

function stringsOverlayStyle() {
  return {
    backgroundImage:
      'linear-gradient(90deg, transparent 0 11%, rgba(255,255,255,0.92) 11.2% 11.4%, transparent 11.6% 22%, rgba(255,255,255,0.92) 22.2% 22.4%, transparent 22.6% 33%, rgba(255,255,255,0.92) 33.2% 33.4%, transparent 33.6% 44%, rgba(255,255,255,0.92) 44.2% 44.4%, transparent 44.6% 55%, rgba(255,255,255,0.92) 55.2% 55.4%, transparent 55.6% 66%, rgba(255,255,255,0.92) 66.2% 66.4%, transparent 66.6% 77%, rgba(255,255,255,0.92) 77.2% 77.4%, transparent 77.6% 88%, rgba(255,255,255,0.92) 88.2% 88.4%, transparent 88.6% 100%)',
    opacity: 0.7,
    mixBlendMode: 'screen',
  }
}

const GuitarPreview = memo(function GuitarPreview({ config, view, onViewChange }) {
  const model = guitarBuilder.BODY_OPTIONS[config.body] ?? guitarBuilder.BODY_OPTIONS.strat
  const bodyWood = guitarBuilder.BODY_WOOD_OPTIONS[config.bodyWood] ?? guitarBuilder.BODY_WOOD_OPTIONS.rosewood
  const bodyFinish = guitarBuilder.BODY_FINISH_OPTIONS[config.bodyFinish] ?? guitarBuilder.BODY_FINISH_OPTIONS.none
  const hardware = guitarBuilder.HARDWARE_OPTIONS[config.hardware] ?? guitarBuilder.HARDWARE_OPTIONS.chrome
  const neck = guitarBuilder.NECK_OPTIONS[config.neck] ?? guitarBuilder.NECK_OPTIONS.maple
  const fretboard = guitarBuilder.FRETBOARD_OPTIONS[config.fretboard] ?? guitarBuilder.FRETBOARD_OPTIONS.rosewood
  const headstock = guitarBuilder.HEADSTOCK_OPTIONS[config.headstock] ?? guitarBuilder.HEADSTOCK_OPTIONS.gt6
  const headstockWood =
    guitarBuilder.HEADSTOCK_WOOD_OPTIONS[config.headstockWood] ?? guitarBuilder.HEADSTOCK_WOOD_OPTIONS.rosewood
  const inlay = guitarBuilder.INLAY_OPTIONS[config.inlays] ?? guitarBuilder.INLAY_OPTIONS.pearl
  const bridge = guitarBuilder.BRIDGE_OPTIONS[config.bridge] ?? guitarBuilder.BRIDGE_OPTIONS.hipshotFixed
  const bodyAssets = guitarBuilder.BODY_LAYER_ASSETS[config.body] ?? guitarBuilder.BODY_LAYER_ASSETS.strat
  const previewLayout = guitarBuilder.PREVIEW_LAYOUTS[config.body] ?? guitarBuilder.PREVIEW_LAYOUTS.strat
  const previewFlip = view === 'rear' ? 'scaleX(-1)' : 'scaleX(1)'
  const previewScale = view === 'rear' ? previewLayout.scale * 0.98 : previewLayout.scale
  const previewX = previewLayout.x
  const previewY = previewLayout.y
  const colorKey = hardware.color

  const pickguardAsset = guitarBuilder.PICKGUARD_OPTIONS_BY_BODY[config.body]?.[config.pickguard]?.src ?? null

  const knobAsset = guitarBuilder.KNOB_OPTIONS_BY_BODY[config.body]?.[config.knobs]?.src ?? null

  const pickupLayers = useMemo(() => {
    const layout = config.pickups
    const route = guitarBuilder.PUPPY
    const add = (set, slot) => [
      { src: set.route?.[colorKey]?.[slot], className: 'opacity-90' },
      { src: set.body?.[colorKey]?.[slot], className: 'opacity-90' },
      { src: set.poles?.[colorKey]?.[slot], className: 'opacity-95' },
    ]

    if (layout === 'sss') return [...add(route.single, 'bridge'), ...add(route.single, 'middle'), ...add(route.single, 'neck')]
    if (layout === 'hh') return [...add(route.humbucker, 'bridge'), ...add(route.humbucker, 'neck')]
    if (layout === 'p90') return [...add(route.p90, 'bridge'), ...add(route.p90, 'neck')]
    if (layout === 'fluence') return [...add(route.fluence, 'bridge'), ...add(route.fluence, 'neck')]
    return [...add(route.humbucker, 'bridge'), ...add(route.single, 'middle'), ...add(route.single, 'neck')]
  }, [colorKey, config.pickups])

  const hardwareLayers = useMemo(() => {
    const bridgeSrc = resolveVariant(bridge.assets, colorKey)
    const strapSrc = resolveVariant(bodyAssets.strap, colorKey)
    const switchSrc = resolveVariant(bodyAssets.switch, colorKey)
    return [
      { src: bridgeSrc, className: 'opacity-95' },
      { src: switchSrc, className: 'opacity-90' },
      { src: strapSrc, className: 'opacity-95' },
      { src: knobAsset, className: 'opacity-95' },
      { src: pickguardAsset, className: 'opacity-95' },
    ].filter(layer => Boolean(layer.src))
  }, [bodyAssets, bridge.assets, colorKey, knobAsset, pickguardAsset])

  const neckLayers = useMemo(() => {
    const headstockTuners = resolveVariant(headstock.tuners, colorKey)

    return [
      {
        maskSrc: model.bodySrc,
        style: {
          backgroundImage: `url(${bodyWood.texture})`,
          opacity: 1,
          mixBlendMode: 'normal',
        },
      },
      bodyFinish.texture
        ? {
            maskSrc: model.bodySrc,
            style: {
              backgroundImage: `url(${bodyFinish.texture})`,
              opacity: 0.82,
              mixBlendMode: 'soft-light',
            },
          }
        : null,
      {
        maskSrc: NECK_MASK,
        style: {
          backgroundImage: `url(${neck.src})`,
          filter: neck.filter,
          opacity: 0.98,
        },
      },
      {
        maskSrc: NECK_MASK,
        style: {
          backgroundImage: `url(${fretboard.src})`,
          opacity: 0.94,
          mixBlendMode: 'multiply',
        },
      },
      { src: headstock.strings, className: 'opacity-95' },
      { src: NECK_FRETS[config.pickups === 'hh' ? 'gold' : 'stainless'], className: 'opacity-85' },
      { src: inlay.src, className: 'opacity-95' },
      { src: NECK_NUT[hardware.color === 'black' ? 'black' : 'white'], className: 'opacity-90' },
      {
        maskSrc: headstock.mask,
        style: {
          backgroundImage: `url(${headstockWood.texture})`,
          opacity: 0.95,
        },
      },
      { src: headstock.logo, className: 'opacity-95' },
      { src: headstock.trussCover, className: 'opacity-95' },
      { src: headstockTuners, className: 'opacity-95' },
    ].filter(Boolean)
  }, [bodyFinish.texture, bodyWood.texture, colorKey, config.body, config.pickups, fretboard.src, headstock, headstockWood.texture, inlay.src, neck.filter, neck.src, hardware.color])

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1160px] rounded-none border-l border-white/10 bg-[#111111] px-3 py-3 sm:px-4 lg:px-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="inline-flex rounded-md bg-white/8 p-1">
            <button
              type="button"
              onClick={() => onViewChange('front')}
              className={`rounded-md px-5 py-2 text-sm font-semibold transition-colors ${
                view === 'front' ? 'bg-[#11a9f3] text-white' : 'text-white/55 hover:text-white'
              }`}
            >
              Front
            </button>
            <button
              type="button"
              onClick={() => onViewChange('rear')}
              className={`rounded-md px-5 py-2 text-sm font-semibold transition-colors ${
                view === 'rear' ? 'bg-[#11a9f3] text-white' : 'text-white/55 hover:text-white'
              }`}
            >
              Rear
            </button>
          </div>
          <button type="button" className="grid h-12 w-12 place-items-center rounded-sm bg-[#11a9f3] text-white">
            <CircleDot className="h-5 w-5" />
          </button>
          <button type="button" className="grid h-12 w-12 place-items-center rounded-sm bg-[#11a9f3] text-white">
            <Trash2 className="h-5 w-5" />
          </button>
        </div>

        <div className="relative h-[44vh] min-h-[320px] overflow-hidden bg-[#111111]">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#191919_0%,#101010_45%,#0c0c0c_100%)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="relative aspect-[16/7] w-full max-w-[1180px]"
              style={{
                transform: `translate(${previewX}px, ${previewY}px) scale(${previewScale}) ${previewFlip}`,
                transformOrigin: '50% 50%',
              }}
            >
              {neckLayers.map((layer, index) => (
                <GuitarLayer
                  key={`${layer.src ?? layer.maskSrc ?? 'layer'}-${index}`}
                  src={layer.src}
                  maskSrc={layer.maskSrc}
                  style={layer.style}
                  className={layer.className}
                />
              ))}
              {hardwareLayers.map((layer, index) => (
                <GuitarLayer key={`${layer.src}-${index}`} src={layer.src} className={layer.className} />
              ))}
              {pickupLayers.map((layer, index) => (
                <GuitarLayer key={`${layer.src}-${index}`} src={layer.src} className={layer.className} />
              ))}
              <div className="absolute inset-x-[4%] top-[48%] z-50 h-[2px] bg-white/60" style={stringsOverlayStyle()} />
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-sm text-white/55">
          {model.label} body with {guitarBuilder.PICKUP_OPTIONS[config.pickups]?.label ?? config.pickups} pickups,{' '}
          {headstock.label} headstock, and {hardware.label.toLowerCase()} hardware
        </p>
      </div>
    </div>
  )
})

export default GuitarPreview
