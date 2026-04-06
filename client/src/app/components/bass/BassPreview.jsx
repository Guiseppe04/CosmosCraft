import { useMemo } from 'react'
import { CircleDot } from 'lucide-react'
import {
  bassBuilder,
  BASS_NECK_FRETS,
  BASS_NECK_MASK,
  BASS_NECK_NUT,
  resolveBassVariant,
} from '../../lib/bassBuilderData.js'

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

function BassLayer({ src, maskSrc, style, className = '' }) {
  if (!src && !maskSrc) return null
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none select-none ${className}`}
      style={maskSrc ? maskedLayerStyle(maskSrc, style) : layerStyle(src, style)}
    />
  )
}

function BassPreview({ config, view, onViewChange }) {
  const model = bassBuilder.BODY_OPTIONS[config.bassType] ?? bassBuilder.BODY_OPTIONS.vader
  const bodyWood = bassBuilder.BODY_WOOD_OPTIONS[config.bodyWood] ?? bassBuilder.BODY_WOOD_OPTIONS.maple
  const bodyFinish = bassBuilder.BODY_FINISH_OPTIONS[config.bodyFinish] ?? bassBuilder.BODY_FINISH_OPTIONS.none
  const hardware = bassBuilder.HARDWARE_OPTIONS[config.hardware] ?? bassBuilder.HARDWARE_OPTIONS.chrome
  const neck = bassBuilder.NECK_OPTIONS[config.neck] ?? bassBuilder.NECK_OPTIONS.maple
  const fretboard = bassBuilder.FRETBOARD_OPTIONS[config.fretboard] ?? bassBuilder.FRETBOARD_OPTIONS.rosewood
  const headstockWood =
    bassBuilder.HEADSTOCK_WOOD_OPTIONS[config.headstockWood] ?? bassBuilder.HEADSTOCK_WOOD_OPTIONS.maple
  const inlay = bassBuilder.INLAY_OPTIONS[config.inlays] ?? bassBuilder.INLAY_OPTIONS.pearl
  const bridge = bassBuilder.BRIDGE_OPTIONS[config.bridge] ?? bassBuilder.BRIDGE_OPTIONS.standard
  const bodyAssets = bassBuilder.BODY_LAYER_ASSETS[config.bassType] ?? bassBuilder.BODY_LAYER_ASSETS.vader
  const previewLayout = bassBuilder.PREVIEW_LAYOUTS[config.bassType] ?? bassBuilder.PREVIEW_LAYOUTS.vader
  const previewFlip = view === 'rear' ? 'scaleX(-1)' : 'scaleX(1)'
  const previewScale = view === 'rear' ? previewLayout.scale * 0.98 : previewLayout.scale
  const previewX = previewLayout.x
  const previewY = previewLayout.y
  const colorKey = hardware.color

  const pickguardAsset = bassBuilder.PICKGUARD_OPTIONS[config.bassType]?.[config.pickguard]?.src ?? null
  const knobAsset = bassBuilder.KNOB_OPTIONS[config.bassType]?.[config.knobs]?.src ?? null

  const pickupSrc = useMemo(() => {
    const bassType = config.bassType
    const pickupType = config.pickups
    
    const pickupImages = {
      vader: {
        standard: 'bass/vader/front/pickups/hb/standard/4/bridge-black.png',
        split: 'bass/vader/front/pickups/hb/standard/4/bridge-black.png',
        humbucker: 'bass/vader/front/pickups/hb/standard/4/bridge-black.png',
        active: 'bass/vader/front/pickups/hb/standard/4/bridge-black.png',
      },
      pb: {
        standard: 'bass/pb/front/pickups/4/bridge-black.png',
        split: 'bass/pb/front/pickups/4/bridge-black.png',
        humbucker: 'bass/pb/front/pickups/4/bridge-black.png',
        active: 'bass/pb/front/pickups/4/bridge-black.png',
      },
      jb: {
        standard: 'bass/jb/front/pickups/standard/4/bridge-black.png',
        split: 'bass/jb/front/pickups/standard/4/bridge-black.png',
        humbucker: 'bass/jb/front/pickups/standard/4/bridge-black.png',
        active: 'bass/jb/front/pickups/standard/4/bridge-black.png',
      },
    }
    
    const path = pickupImages[bassType]?.[pickupType] ?? pickupImages.vader.standard
    
    return new URL(`../../../../builder/bass_models/${path}`, import.meta.url).href
  }, [config.bassType, config.pickups])

  const hardwareLayers = useMemo(() => {
    const bridgeSrc = resolveBassVariant(bridge.assets, colorKey)
    const strapSrc = resolveBassVariant(bodyAssets.strap, colorKey)
    return [
      { src: bridgeSrc, className: 'opacity-95' },
      { src: strapSrc, className: 'opacity-95' },
      { src: knobAsset, className: 'opacity-95' },
      { src: pickguardAsset, className: 'opacity-95' },
      { src: pickupSrc, className: 'opacity-95' },
    ].filter(layer => Boolean(layer.src))
  }, [bodyAssets, bridge.assets, colorKey, knobAsset, pickguardAsset, pickupSrc])

  const neckLayers = useMemo(() => {
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
              opacity: 1,
              mixBlendMode: 'normal',
            },
          }
        : bodyFinish.color
        ? {
            maskSrc: model.bodySrc,
            style: {
              backgroundColor: bodyFinish.color,
              opacity: 1,
              mixBlendMode: 'normal',
            },
          }
        : null,
      {
        maskSrc: BASS_NECK_MASK,
        style: {
          backgroundImage: `url(${neck.src})`,
          filter: neck.filter,
          opacity: 0.98,
        },
      },
      {
        maskSrc: BASS_NECK_MASK,
        style: {
          backgroundImage: `url(${fretboard.src})`,
          opacity: 0.94,
          mixBlendMode: 'multiply',
        },
      },
      { src: BASS_NECK_FRETS.stainless, className: 'opacity-85' },
      { src: inlay.src, className: 'opacity-95' },
      { src: BASS_NECK_NUT[hardware.color === 'black' ? 'black' : 'white'], className: 'opacity-90' },
      {
        maskSrc: BASS_NECK_MASK,
        style: {
          backgroundImage: `url(${headstockWood.texture})`,
          opacity: 0.95,
        },
      },
    ].filter(Boolean)
  }, [bodyFinish.texture, bodyFinish.color, bodyWood.texture, colorKey, config.bassType, fretboard.src, headstockWood.texture, inlay.src, neck.filter, neck.src, hardware.color])

  return (
    <div className="w-full">
      <div className="relative mx-auto w-full">
        <div className="relative overflow-hidden rounded-xl">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1a] via-[#0f0f0f] to-[#0a0a0a]" />
          
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-radial from-white/10 via-transparent to-transparent opacity-40" />
            <div className="absolute top-0 left-1/4 w-[300px] h-[300px] bg-gradient-radial from-[#d4af37]/5 via-transparent to-transparent opacity-50" />
            <div className="absolute top-0 right-1/4 w-[300px] h-[300px] bg-gradient-radial from-white/5 via-transparent to-transparent opacity-30" />
          </div>
          
          <div className="relative flex items-center justify-center py-8">
            <div
              className="relative aspect-[16/7] w-full max-w-[1000px] transition-transform duration-500 ease-out"
              style={{
                transform: `translate(${previewX}px, ${previewY}px) scale(${previewScale}) ${previewFlip}`,
                transformOrigin: '50% 50%',
              }}
            >
              {neckLayers.map((layer, index) => (
                <BassLayer
                  key={`${layer.src ?? layer.maskSrc ?? 'layer'}-${index}`}
                  src={layer.src}
                  maskSrc={layer.maskSrc}
                  style={layer.style}
                  className={layer.className}
                />
              ))}
              {hardwareLayers.map((layer, index) => (
                <BassLayer key={`${layer.src}-${index}`} src={layer.src} className={layer.className} />
              ))}
            </div>
          </div>
          
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-6 bg-gradient-to-b from-transparent via-black/30 to-black/50 blur-xl" />
        </div>
      </div>
    </div>
  )
}

export default BassPreview