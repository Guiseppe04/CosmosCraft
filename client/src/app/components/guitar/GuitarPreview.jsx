import { useMemo } from 'react'
import { CircleDot, Trash2 } from 'lucide-react'
import {
  guitarBuilder,
  NECK_FRETS,
  NECK_MASK,
  NECK_NUT,
  resolveVariant,
} from '../../lib/guitarBuilderData.js'
import {
  resolveTopWoodAsset,
  resolveFinishAsset,
  resolveTopCoatAsset,
  resolveInlay,
  resolveNeckWoodAsset,
  resolveHeadstockWoodAsset,
  resolveFingerboardWoodAsset,
  resolveTrussCover,
  resolveTremoloCoverAsset,
  resolveRearTuners,
  resolveRearTunerButtons,
  resolveFrontTunerButtons,
  resolveNeckBolts,
  resolveBackplateAsset,
  resolveBackplateScrewsAsset,
  resolveElectronicsCavityCoverAsset,
  resolveFrontStrapButtonAsset,
  resolveBackStrapButtonColorAsset,
  resolveFrontKnobAsset,
  resolveOutputJackAsset,
  resolveNeckRearFinishAsset,
} from '../../lib/assetResolver.js'

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

const gradientLayerStyle = (gradient, extra = {}) => ({
  backgroundImage: gradient,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
  backgroundSize: 'contain',
  ...extra,
})

function GuitarLayer({ src, maskSrc, gradient, style, className = '', layerName = '', protectedLayer = false }) {
  if (!src && !maskSrc && !gradient) return null
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none select-none ${className}`}
      style={
        gradient
          ? gradientLayerStyle(gradient, style)
          : maskSrc
          ? maskedLayerStyle(maskSrc, style)
          : layerStyle(src, style)
      }
      data-export-layer="true"
      data-layer={layerName}
      data-layer-src={src || ''}
      data-layer-mask={maskSrc || ''}
      data-sticker-protected={protectedLayer ? 'true' : 'false'}
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

function GuitarPreview({ config, view, onViewChange, modelImageSrc, stickerOverlay = null, stickerMaskSrc = null, stageRef = null }) {
  const model = guitarBuilder.BODY_OPTIONS[config.body] ?? guitarBuilder.BODY_OPTIONS.strat
  const modelBodySrc = modelImageSrc || model.bodySrc
  const bodyWood = guitarBuilder.BODY_WOOD_OPTIONS[config.bodyWood] ?? guitarBuilder.BODY_WOOD_OPTIONS.rosewood
  
  // Handle both predefined finishes and custom hex colors
  const isCustomColor = config.bodyFinish && typeof config.bodyFinish === 'string' && config.bodyFinish.startsWith('#')
  const bodyFinish = isCustomColor 
    ? { color: config.bodyFinish, texture: null }
    : (guitarBuilder.BODY_FINISH_OPTIONS[config.bodyFinish] ?? guitarBuilder.BODY_FINISH_OPTIONS.none)
  
  const hardware = guitarBuilder.HARDWARE_OPTIONS[config.hardware] ?? guitarBuilder.HARDWARE_OPTIONS.chrome
  const neckStatic = guitarBuilder.NECK_OPTIONS[config.neck] ?? guitarBuilder.NECK_OPTIONS.maple
  const neckWoodKey = config.neckWood || config.neck || 'maple'
  const neck = { ...neckStatic, src: resolveNeckWoodAsset('electric', config.body || 'dc', neckWoodKey) || neckStatic.src }
  const fretboardStatic = guitarBuilder.FRETBOARD_OPTIONS[config.fretboard] ?? guitarBuilder.FRETBOARD_OPTIONS.rosewood
  const fretboardWoodKey = config.fingerboardWood || config.fretboard || 'rosewood'
  const fretboard = { ...fretboardStatic, src: resolveFingerboardWoodAsset('electric', config.body || 'dc', fretboardWoodKey) || fretboardStatic.src }
  const headstock = guitarBuilder.HEADSTOCK_OPTIONS[config.headstock] ?? guitarBuilder.HEADSTOCK_OPTIONS.gt6
  const headstockWoodKey = config.headstockWood || 'plain-maple'
  const headstockWoodStatic = guitarBuilder.HEADSTOCK_WOOD_OPTIONS[headstockWoodKey] ?? guitarBuilder.HEADSTOCK_WOOD_OPTIONS.rosewood
  const headstockWood = { ...headstockWoodStatic, texture: resolveHeadstockWoodAsset('electric', config.body || 'dc', headstockWoodKey) || headstockWoodStatic.texture }
  const headstockTrussCover = resolveTrussCover('electric', config.body || 'dc', config.trussRodCover || 'black') || headstock.trussCover
  const inlaySrc = config.inlayShape || config.inlayMaterial
    ? resolveInlay(
        'electric',
        config.body || 'dc',
        config.inlayShape || 'dots',
        config.inlayMaterial || 'pearl',
      )
    : resolveInlay('electric', config.body || 'dc', config.inlay || config.inlays || 'idwhite-pearl')
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

  const rearTunersSrc = resolveRearTuners('electric', config.body || 'dc', config.headstock || 'gt6', colorKey)
  const rearTunerButtonsSrc = resolveRearTunerButtons('electric', config.body || 'dc', config.headstock || 'gt6', config.tunerButtons || 'off')
  const frontTunerButtonsSrc = resolveFrontTunerButtons('electric', config.body || 'dc', config.headstock || 'gt6', config.tunerButtons || 'off')
  const neckBoltsSrc = config.body === 'delos' ? resolveNeckBolts('electric', 'delos') : null
  const backplateSrc = config.electronicsCavityCover && config.electronicsCavityCover !== 'none' ? resolveElectronicsCavityCoverAsset('electric', config.body || 'dc', config.electronicsCavityCover) : null
  const backplateScrewsSrc = backplateSrc ? resolveBackplateScrewsAsset('electric', config.body || 'dc') : null
  const outputJackSrc = config.outputJack === 'on' ? resolveOutputJackAsset('electric', config.body || 'dc', colorKey) : null
  const tremoloCoverSrc = (config.bridge === 'hipshotTremolo' || config.bridge === 'floydRoseTremolo') && config.tremoloCover && config.tremoloCover !== 'none' ? resolveTremoloCoverAsset('electric', config.body || 'dc', config.bridge, config.tremoloCover) : null
  const rearNeckFinishSrc = config.neckRearFinish && config.neckRearFinish !== 'none' ? resolveRearNeckFinishAsset('electric', config.body || 'dc', config.neckRearFinish) : null
  const frontStrapButtonSrc = config.strapButtons && config.strapButtons !== 'none' ? resolveFrontStrapButtonAsset('electric', config.body || 'dc', config.strapButtons, colorKey) : null
  const rearStrapButtonSrc = config.strapButtons && config.strapButtons !== 'none' ? resolveBackStrapButtonColorAsset('electric', config.body || 'dc', config.strapButtons, colorKey) : null
  const hardwareMetalKnobSrc = resolveFrontKnobAsset('electric', config.body || 'dc', colorKey)

  // Resolve top wood texture if selected
  const topWoodTexture = config.topWood && config.topWood !== 'none'
    ? resolveTopWoodAsset('electric', config.body || 'dc', config.topWood)
    : null

  // Resolve finish type color asset based on selected finishType
  // finishType determines folder: metallic, translucent, sparkle, etc.
  const finishType = config.finishType || 'solid'
  const finishColorKey = config.finishColor || config.bodyFinish || 'black'
  const isUsingDynamicFinish = config.finishType && config.finishType !== 'solid'
  const finishTypeColorAsset = isUsingDynamicFinish
    ? resolveFinishAsset('electric', config.body || 'dc', finishType, finishColorKey)
    : null

  // Resolve top coat overlay asset
  const topCoat = config.topCoat || 'clearGloss'
  const topCoatAsset = config.topCoat
    ? resolveTopCoatAsset('electric', config.body || 'dc', config.topCoat)
    : null

  const pickupLayers = useMemo(() => {
    const layout = config.pickups
    const route = guitarBuilder.PUPPY
    const add = (set, slot) => [
      { name: `${slot}-pickup-route`, src: set.route?.[colorKey]?.[slot], className: 'opacity-90', protectedLayer: true, style: { zIndex: 120 } },
      { name: `${slot}-pickup-body`, src: set.body?.[colorKey]?.[slot], className: 'opacity-90', protectedLayer: true, style: { zIndex: 121 } },
      { name: `${slot}-pickup-poles`, src: set.poles?.[colorKey]?.[slot], className: 'opacity-95', protectedLayer: true, style: { zIndex: 122 } },
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
    const hardwareMetalKnobSrc = resolveFrontKnobAsset('electric', config.body || 'dc', config.knobs || 'chrome')
    const frontStrapButtonSrc = resolveFrontStrapButtonAsset('electric', config.body || 'dc', config.body || 'dc', colorKey)
    return [
      { name: 'switch', src: switchSrc, className: 'opacity-90', protectedLayer: true, style: { zIndex: 130 } },
      { name: 'front-strap-button', src: frontStrapButtonSrc, className: 'opacity-95', protectedLayer: true, style: { zIndex: 131 } },
      { name: 'knobs', src: knobAsset, className: 'opacity-95', protectedLayer: true, style: { zIndex: 132 } },
      { name: 'hardware-metal-knob', src: hardwareMetalKnobSrc, className: 'opacity-95', protectedLayer: true, style: { zIndex: 133 } },
      { name: 'bridge', src: bridgeSrc, className: 'opacity-95', protectedLayer: true, style: { zIndex: 134 } },
    ].filter(layer => Boolean(layer.src))
  }, [bodyAssets, bridge.assets, colorKey, knobAsset, config.knobs, config.body])

  const overlayLayers = useMemo(() => {
    const layers = [
      bodyAssets.shadows ? { name: 'body-shadows', src: bodyAssets.shadows, style: { opacity: 0.8, mixBlendMode: 'multiply', zIndex: 200 } } : null,
      bodyAssets.gloss ? { name: 'body-gloss', src: bodyAssets.gloss, style: { opacity: 0.8, mixBlendMode: 'screen', zIndex: 202 } } : null,
    ].filter(Boolean)
    return layers
  }, [bodyAssets])

  const frontNeckLayers = useMemo(() => {
    const headstockTuners = resolveVariant(headstock.tuners, colorKey)

    return [
      // Body wood base
      {
        name: 'body-wood',
        maskSrc: modelBodySrc,
        style: {
          backgroundImage: `url(${bodyWood.texture})`,
          opacity: 1,
          mixBlendMode: 'normal',
          zIndex: 1,
        },
      },
      // Top wood layer (above body wood, masked to body shape)
      topWoodTexture
        ? {
            name: 'body-top-wood',
            maskSrc: modelBodySrc,
            style: {
              backgroundImage: `url(${topWoodTexture})`,
              opacity: 0.8,
              mixBlendMode: 'normal',
              zIndex: 2,
            },
          }
        : null,
      // Finish layer - use finish type color asset when available
      finishTypeColorAsset
        ? {
            name: 'body-finish-type',
            maskSrc: modelBodySrc,
            style: {
              backgroundImage: `url(${finishTypeColorAsset})`,
              opacity: 1,
              mixBlendMode: 'normal',
              zIndex: 3,
            },
          }
        : bodyFinish.texture
        ? {
            name: 'body-finish-texture',
            maskSrc: modelBodySrc,
            style: {
              backgroundImage: `url(${bodyFinish.texture})`,
              opacity: 1,
              mixBlendMode: 'normal',
              zIndex: 3,
            },
          }
        : bodyFinish.color
        ? {
            name: 'body-finish-color',
            maskSrc: modelBodySrc,
            style: {
              backgroundColor: bodyFinish.color,
              opacity: 1,
              mixBlendMode: 'normal',
              zIndex: 3,
            },
          }
        : null,
      {
        name: 'neck',
        maskSrc: NECK_MASK,
        style: {
          backgroundImage: `url(${neck.src})`,
          filter: neck.filter,
          opacity: 0.98,
          zIndex: 100,
        },
        protectedLayer: true,
      },
      {
        name: 'fretboard',
        maskSrc: NECK_MASK,
        style: {
          backgroundImage: `url(${fretboard.src})`,
          opacity: 0.94,
          mixBlendMode: 'multiply',
          zIndex: 101,
        },
        protectedLayer: true,
      },
      { name: 'inlays', src: inlaySrc, className: 'opacity-95', protectedLayer: true, style: { zIndex: 102 } },
      { name: 'frets', src: NECK_FRETS[config.pickups === 'hh' ? 'gold' : 'stainless'], className: 'opacity-85', protectedLayer: true, style: { zIndex: 103 } },
      { name: 'nut', src: NECK_NUT[config.nut] || NECK_NUT.blackGraphTech, className: 'opacity-90', protectedLayer: true, style: { zIndex: 104 } },
      {
        name: 'headstock-wood',
        maskSrc: headstock.mask,
        style: {
          backgroundImage: `url(${headstockWood.texture})`,
          opacity: 0.95,
          zIndex: 105,
        },
        protectedLayer: true,
      },
      { name: 'headstock-truss-cover', src: headstockTrussCover, className: 'opacity-95', protectedLayer: true, style: { zIndex: 106 } },
      { name: 'headstock-tuners', src: headstockTuners, className: 'opacity-95', protectedLayer: true, style: { zIndex: 107 } },
      { name: 'headstock-front-tuner-buttons', src: frontTunerButtonsSrc, className: 'opacity-90', protectedLayer: true, style: { zIndex: 108 } },
    ].filter(Boolean)
  }, [bodyFinish.texture, bodyFinish.color, bodyWood.texture, colorKey, config.body, config.pickups, config.topWood, config.finishType, config.finishColor, finishTypeColorAsset, topWoodTexture, fretboard.src, headstock, headstockWood.texture, headstockTrussCover, inlaySrc, neck.filter, neck.src, hardware.color, modelBodySrc, config.trussRodCover, config.nut, config.tunerButtons, frontTunerButtonsSrc])
  
  const rearNeckLayers = useMemo(() => {
    const headstockTuners = rearTunersSrc

     return [
       {
         name: 'body-wood',
         maskSrc: modelBodySrc,
         style: {
           backgroundImage: `url(${bodyWood.texture})`,
           opacity: 1,
           mixBlendMode: 'normal',
           zIndex: 1,
         },
       },
       topWoodTexture
         ? {
             name: 'body-top-wood',
             maskSrc: modelBodySrc,
             style: {
               backgroundImage: `url(${topWoodTexture})`,
               opacity: 0.8,
               mixBlendMode: 'normal',
               zIndex: 2,
             },
           }
         : null,
       finishTypeColorAsset
         ? {
             name: 'body-finish-type',
             maskSrc: modelBodySrc,
             style: {
               backgroundImage: `url(${finishTypeColorAsset})`,
               opacity: 1,
               mixBlendMode: 'normal',
               zIndex: 3,
             },
           }
         : bodyFinish.texture
         ? {
             name: 'body-finish-texture',
             maskSrc: modelBodySrc,
             style: {
               backgroundImage: `url(${bodyFinish.texture})`,
               opacity: 1,
               mixBlendMode: 'normal',
               zIndex: 3,
             },
           }
          : bodyFinish.color
          ? {
              name: 'body-finish-color',
              maskSrc: modelBodySrc,
              style: {
                backgroundColor: bodyFinish.color,
                opacity: 1,
                mixBlendMode: 'normal',
                zIndex: 3,
              },
            }
          : null,
         topCoatAsset
           ? {
               name: 'body-top-coat',
               style: {
                 backgroundImage: `url(${topCoatAsset})`,
                 opacity: 1,
                 mixBlendMode: 'normal',
                 zIndex: 4,
               },
             }
           : null,
       {
         name: 'neck',
         maskSrc: NECK_MASK,
         style: {
           backgroundImage: `url(${neck.src})`,
           filter: neck.filter,
           opacity: 0.98,
           zIndex: 100,
         },
         protectedLayer: true,
       },
       {
         name: 'fretboard',
         maskSrc: NECK_MASK,
         style: {
           backgroundImage: `url(${fretboard.src})`,
           opacity: 0.94,
           mixBlendMode: 'multiply',
           zIndex: 101,
         },
         protectedLayer: true,
       },
       {
         name: 'headstock-wood',
         maskSrc: headstock.mask,
         style: {
           backgroundImage: `url(${headstockWood.texture})`,
           opacity: 0.95,
           zIndex: 102,
         },
         protectedLayer: true,
       },
       { name: 'neck-bolts', src: neckBoltsSrc, className: 'opacity-90', protectedLayer: true, style: { zIndex: 104 } },
       { name: 'rear-tuners', src: rearTunersSrc, className: 'opacity-95', protectedLayer: true, style: { zIndex: 105 } },
       { name: 'rear-tuner-buttons', src: rearTunerButtonsSrc, className: 'opacity-90', protectedLayer: true, style: { zIndex: 106 } },
       { name: 'backplate', src: backplateSrc, className: 'opacity-95', protectedLayer: true, style: { zIndex: 107 } },
       { name: 'backplate-screws', src: backplateScrewsSrc, className: 'opacity-90', protectedLayer: true, style: { zIndex: 108 } },
       tremoloCoverSrc ? { name: 'tremolo-cover', src: tremoloCoverSrc, className: 'opacity-95', protectedLayer: true, style: { zIndex: 109 } } : null,
       outputJackSrc ? { name: 'output-jack', src: outputJackSrc, className: 'opacity-95', protectedLayer: true, style: { zIndex: 110 } } : null,
       { name: 'rear-strap-button', src: rearStrapButtonSrc, className: 'opacity-95', protectedLayer: true, style: { zIndex: 111 } },
       { name: 'rear-neck-finish', src: rearNeckFinishSrc, className: 'opacity-90', protectedLayer: true, style: { zIndex: 112 } },
     ].filter(Boolean)
   }, [bodyFinish.texture, bodyFinish.color, bodyWood.texture, colorKey, config.topWood, config.finishType, config.finishColor, finishTypeColorAsset, topWoodTexture, fretboard.src, headstock, headstockWood.texture, modelBodySrc, neck.filter, neck.src, topCoatAsset, neckBoltsSrc, rearTunersSrc, rearTunerButtonsSrc, backplateSrc, backplateScrewsSrc, tremoloCoverSrc, outputJackSrc, rearNeckFinishSrc, rearStrapButtonSrc])
  
  const stringLayer = useMemo(() => {
    return headstock.strings ? { src: headstock.strings, className: 'opacity-95', style: { zIndex: 110 } } : null
  }, [headstock.strings])

  return (
    <div className="w-full">
      {/* Main guitar container */}
      <div className="relative mx-auto w-full">
        {/* Guitar display area */}
        <div className="relative overflow-hidden rounded-xl">
          {/* Background gradient for depth */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1a] via-[#0f0f0f] to-[#0a0a0a]" />
          
          {/* Spotlight effect from top */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-radial from-white/10 via-transparent to-transparent opacity-40" />
            <div className="absolute top-0 left-1/4 w-[300px] h-[300px] bg-gradient-radial from-[#d4af37]/5 via-transparent to-transparent opacity-50" />
            <div className="absolute top-0 right-1/4 w-[300px] h-[300px] bg-gradient-radial from-white/5 via-transparent to-transparent opacity-30" />
          </div>
          
          {/* Guitar image */}
          <div className="relative flex items-center justify-center py-8">
            <div
              data-export-stage="true"
              ref={stageRef}
              className="relative aspect-[16/7] w-full max-w-[1000px] transition-transform duration-500 ease-out"
              style={{
                transform: `translate(${previewX}px, ${previewY}px) scale(${previewScale}) ${previewFlip}`,
                transformOrigin: '50% 50%',
              }}
            >
              {view === 'front' ? (
                <>
                  {frontNeckLayers.map((layer, index) => (
                    <GuitarLayer
                      key={`${layer.src ?? layer.maskSrc ?? 'layer'}-${index}`}
                      src={layer.src}
                      maskSrc={layer.maskSrc}
                      style={layer.style}
                      className={layer.className}
                      layerName={layer.name}
                      protectedLayer={layer.protectedLayer}
                    />
                  ))}
                  {stickerOverlay && (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 z-[25] pointer-events-none select-none"
                      style={stickerMaskSrc ? {
                        WebkitMaskImage: `url(${stickerMaskSrc})`,
                        maskImage: `url(${stickerMaskSrc})`,
                        WebkitMaskRepeat: 'no-repeat',
                        maskRepeat: 'no-repeat',
                        WebkitMaskSize: 'contain',
                        maskSize: 'contain',
                        WebkitMaskPosition: 'center',
                        maskPosition: 'center',
                        WebkitMaskMode: 'alpha',
                        maskMode: 'alpha',
                      } : undefined}
                      data-sticker-clip-mask-src={stickerMaskSrc || ''}
                    >
                      {stickerOverlay}
                    </div>
                  )}
                  {pickguardAsset && <GuitarLayer src={pickguardAsset} className="opacity-95" layerName="pickguard" style={{ zIndex: 15 }} protectedLayer />}
                  {pickupLayers.map((layer, index) => (
                    <GuitarLayer
                      key={`${layer.src}-${index}`}
                      src={layer.src}
                      style={layer.style}
                      className={layer.className}
                      layerName={layer.name}
                      protectedLayer={layer.protectedLayer}
                    />
                  ))}
                  {hardwareLayers.map((layer, index) => (
                    <GuitarLayer
                      key={`${layer.src}-${index}`}
                      src={layer.src}
                      style={layer.style}
                      className={layer.className}
                      layerName={layer.name}
                      protectedLayer={layer.protectedLayer}
                    />
                  ))}
                  {stringLayer && <GuitarLayer src={stringLayer.src} className={stringLayer.className} style={stringLayer.style} layerName="strings" protectedLayer />}
                  {overlayLayers.map((layer, index) => (
                    <GuitarLayer key={`overlay-${index}`} src={layer.src} style={layer.style} layerName={`overlay-${index}`} />
                  ))}
                </>
              ) : (
                <>
                  {rearNeckLayers.map((layer, index) => (
                    <GuitarLayer
                      key={`${layer.src ?? layer.maskSrc ?? 'layer'}-${index}`}
                      src={layer.src}
                      maskSrc={layer.maskSrc}
                      style={layer.style}
                      className={layer.className}
                      layerName={layer.name}
                      protectedLayer={layer.protectedLayer}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
          
          {/* Reflection/shadow beneath guitar */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-6 bg-gradient-to-b from-transparent via-black/30 to-black/50 blur-xl" />
        </div>
      </div>
    </div>
  )
}

export default GuitarPreview