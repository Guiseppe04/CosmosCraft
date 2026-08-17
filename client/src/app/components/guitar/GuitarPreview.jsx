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
  resolveKnobHardwareBase,
   resolveKnobStyleOverlay,
  resolveTremoloCoverAsset,
  resolveStrapButtonBack,
  resolveStrapButtonFront,
   resolveTunerButtonStyle,
   resolveRearTunerAsset,
   resolveRearHeadstockMask,
   resolveRearBodyMask,
  resolveOutputJackByColor,
  resolveBackplateAsset,
  resolveBackplateScrews,
  resolvePickupRoute,
  resolvePickupBody,
  resolvePickupPoles,
  resolvePickupBobbinColor,
  resolvePickupBobbinMask,
  resolveFluenceMask,
  resolveSingleCoilBody,
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

  const knobStyle = config.body === 'dc' ? guitarBuilder.KNOB_STYLE_OPTIONS[config.knobs] : null
  const knobHardwareBase = config.body === 'dc'
    ? resolveKnobHardwareBase('electric', config.body || 'dc', hardware.color)
    : null
  const knobStyleOverlay = config.body === 'dc' && knobStyle
    ? resolveKnobStyleOverlay('electric', config.body || 'dc', knobStyle.fileKey)
    : (guitarBuilder.KNOB_OPTIONS_BY_BODY[config.body]?.[config.knobs]?.src ?? null)

  const nutOption = guitarBuilder.NUT_OPTIONS[config.nut] ?? guitarBuilder.NUT_OPTIONS.blackGraphTech

  const tremoloCoverAsset = useMemo(() => {
    const byBridge = guitarBuilder.TREMOLO_COVER_OPTIONS_BY_BRIDGE?.[config.bridge]
    const opt = byBridge?.[config.tremoloCover]
    if (!opt) return null
    return resolveTremoloCoverAsset('electric', config.body || 'dc', opt.fileKey)
  }, [config.bridge, config.tremoloCover, config.body])

  const outputJackAsset = config.outputJack === 'on'
    ? resolveOutputJackByColor('electric', config.body || 'dc', hardware.color)
    : null

  const strapOption = guitarBuilder.STRAP_BUTTON_OPTIONS[config.strapButtons]
  const strapFront = strapOption?.styleFolder
    ? resolveStrapButtonFront('electric', config.body || 'dc', strapOption.styleFolder, hardware.color)
    : null
  const strapBack = strapOption?.styleFolder
    ? resolveStrapButtonBack('electric', config.body || 'dc', strapOption.styleFolder, hardware.color)
    : null

  const tunerButtonOption = guitarBuilder.TUNER_BUTTON_OPTIONS[config.tunerButtons]
  const headstockShapeKey = config.headstockShape || 'gt6'
  const headstockTunerBase = resolveVariant(headstock.tuners, colorKey)
  const headstockTunerButtons = useMemo(() => {
    if (tunerButtonOption?.styleKey) {
      return resolveTunerButtonStyle('electric', config.body || 'dc', headstockShapeKey, tunerButtonOption.styleKey)
    }
    return null
  }, [tunerButtonOption, headstockShapeKey, config.body])

  const rearTunerAsset = useMemo(
    () => resolveRearTunerAsset('electric', config.body || 'dc', headstockShapeKey, colorKey),
    [headstockShapeKey, colorKey, config.body],
  )
  const rearHeadstockMask = useMemo(
    () => resolveRearHeadstockMask('electric', config.body || 'dc', headstockShapeKey),
    [headstockShapeKey, config.body],
  )
  const rearBodyMask = useMemo(
    () => resolveRearBodyMask('electric', config.body || 'dc'),
    [config.body],
  )

  const cavityOption = guitarBuilder.ELECTRONICS_CAVITY_COVER_OPTIONS[config.electronicsCavityCover]
    ?? guitarBuilder.ELECTRONICS_CAVITY_COVER_OPTIONS.black
  const cavityCoverAsset = resolveBackplateAsset('electric', config.body || 'dc', cavityOption.fileKey)
  const cavityScrewsAsset = resolveBackplateScrews('electric', config.body || 'dc')

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
    const pickupConfig = config.pickupConfiguration || 'hh'
    const isActive = config.electronicsType === 'active'
    const pickupColorType = config.pickupColor || 'bobbins'
    const pickupColorVariant = config.pickupColorVariant || 'black'
    const paintedColor = config.pickupPaintedColor || '#000000'
    const woodType = config.pickupWoodType || 'black'
    const poleColor = config.pickupPoleColor || 'chrome'
    const bridgeModel = config.bridgePickupModel || 'vantium'
    const middleModel = config.middlePickupModel || 'none'
    const neckModel = config.neckPickupModel || 'vantium'

    const isHSS = pickupConfig === 'hss'
    const isHH = pickupConfig === 'hh'

    const positions = []
    if (isHH || isActive) {
      positions.push({ slot: 'bridge', type: 'humbucker', model: bridgeModel })
      if (neckModel !== 'delete') {
        positions.push({ slot: 'neck', type: 'humbucker', model: neckModel })
      }
    }
    if (isHSS) {
      positions.push({ slot: 'bridge', type: 'humbucker', model: bridgeModel })
      positions.push({ slot: 'middle', type: 'singlecoil', model: middleModel })
      if (neckModel !== 'delete') {
        positions.push({ slot: 'neck', type: 'humbucker', model: neckModel })
      }
    }

    const getRouteSrc = (type, slot) => {
      if (type === 'singlecoil') {
        return resolvePickupRoute('electric', config.body || 'dc', 'singlecoil', 'black', slot)
      }
      return resolvePickupRoute('electric', config.body || 'dc', 'humbucker', 'black', slot)
    }

    const getBodySrc = (type, slot) => {
      if (pickupColorType === 'covers') {
        const coverColor = pickupColorVariant === 'chrome' ? 'chrome' : pickupColorVariant === 'gold' ? 'gold' : 'black'
        return resolvePickupBody('electric', config.body || 'dc', 'covered', coverColor, slot)
      }
      if (type === 'singlecoil') {
        const scColor = ['white', 'cream', 'racing-green'].includes(pickupColorVariant) ? pickupColorVariant : 'black'
        return resolveSingleCoilBody('electric', config.body || 'dc', scColor, slot)
      }
      return null
    }

    const getBodyMask = (type, slot) => {
      if (pickupColorType === 'bobbins' || pickupColorType === 'painted' || pickupColorType === 'wooden') {
        if (type === 'singlecoil') {
          return resolvePickupBobbinMask('electric', config.body || 'dc', 'middle-single')
        }
        return resolvePickupBobbinMask('electric', config.body || 'dc', slot)
      }
      return null
    }

    const getBodyStyle = (type, slot) => {
      if (pickupColorType === 'painted') {
        return { backgroundColor: paintedColor }
      }
      if (pickupColorType === 'wooden') {
        const woodTexture = resolveBodyWoodAsset('electric', config.body || 'dc', woodType)
        return { backgroundImage: `url(${woodTexture})` }
      }
      return {}
    }

    const getPolesSrc = (type, slot) => {
      const poleType = type === 'singlecoil' ? 'singlecoil' : 'humbucker'
      const coverType = pickupColorType === 'covers' ? 'covered' : 'open'
      let poleColorKey = poleColor
      if (poleColor === 'gold' && poleType === 'singlecoil') {
        poleColorKey = 'chrome'
      }
      if (type === 'singlecoil') {
        const scPoleMap = {
          black: 'black',
          white: 'white',
          cream: 'creme',
          'racing-green': 'green',
          'white-black': 'black',
          'black-cream': 'black',
          'racing-green-black': 'black',
        }
        const scColor = scPoleMap[pickupColorVariant] || 'black'
        return resolvePickupPoles('electric', config.body || 'dc', 'singlecoil', scColor, slot)
      }
      return resolvePickupPoles('electric', config.body || 'dc', poleType, coverType, `${poleColorKey}-${slot}`)
    }

    const layers = []
    for (const pos of positions) {
      const routeSrc = getRouteSrc(pos.type, pos.slot)
      const bodySrc = getBodySrc(pos.type, pos.slot)
      const bodyMask = getBodyMask(pos.type, pos.slot)
      const bodyStyle = getBodyStyle(pos.type, pos.slot)
      const polesSrc = getPolesSrc(pos.type, pos.slot)

      if (routeSrc) {
        layers.push({
          name: `${pos.slot}-pickup-route`,
          src: routeSrc,
          className: 'opacity-90',
          protectedLayer: true,
          style: { zIndex: 120 },
        })
      }

      if (bodySrc) {
        layers.push({
          name: `${pos.slot}-pickup-body`,
          src: bodySrc,
          className: 'opacity-90',
          protectedLayer: true,
          style: { zIndex: 121 },
        })
      } else if (bodyMask) {
        layers.push({
          name: `${pos.slot}-pickup-body`,
          maskSrc: bodyMask,
          className: 'opacity-90',
          protectedLayer: true,
          style: { zIndex: 121, ...bodyStyle },
        })
      }

      if (polesSrc) {
        layers.push({
          name: `${pos.slot}-pickup-poles`,
          src: polesSrc,
          className: 'opacity-95',
          protectedLayer: true,
          style: { zIndex: 122 },
        })
      }
    }

    return layers
  }, [config.pickupConfiguration, config.electronicsType, config.pickupColor, config.pickupColorVariant, config.pickupPaintedColor, config.pickupWoodType, config.pickupPoleColor, config.bridgePickupModel, config.middlePickupModel, config.neckPickupModel, config.body, colorKey])

   const hardwareLayers = useMemo(() => {
    const bridgeSrc = resolveVariant(bridge.assets, colorKey)
    const switchSrc = resolveVariant(bodyAssets.switch, colorKey)
    return [
      { name: 'switch', src: switchSrc, className: 'opacity-90', protectedLayer: true, style: { zIndex: 130 } },
      { name: 'strap-button', src: strapFront, className: 'opacity-95', protectedLayer: true, style: { zIndex: 131 } },
      { name: 'knobs-hardware-base', src: knobHardwareBase, className: 'opacity-95', protectedLayer: true, style: { zIndex: 132 } },
      { name: 'knobs-style', src: knobStyleOverlay, className: 'opacity-95', protectedLayer: true, style: { zIndex: 133 } },
      { name: 'bridge', src: bridgeSrc, className: 'opacity-95', protectedLayer: true, style: { zIndex: 134 } },
    ].filter(layer => Boolean(layer.src))
  }, [bodyAssets, bridge.assets, colorKey, knobHardwareBase, knobStyleOverlay, strapFront])

  const overlayLayers = useMemo(() => {
    const layers = [
      bodyAssets.shadows ? { name: 'body-shadows', src: bodyAssets.shadows, style: { opacity: 0.8, mixBlendMode: 'multiply', zIndex: 200 } } : null,
      bodyAssets.gloss ? { name: 'body-gloss', src: bodyAssets.gloss, style: { opacity: 0.8, mixBlendMode: 'screen', zIndex: 202 } } : null,
    ].filter(Boolean)
    return layers
  }, [bodyAssets])

  const frontNeckLayers = useMemo(() => {
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
            transform: 'scaleX(-1)',
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
      { name: 'nut', src: NECK_NUT[nutOption.assetKey], className: 'opacity-90', protectedLayer: true, style: { zIndex: 104 } },
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
      { name: 'headstock-tuners-base', src: headstockTunerBase, className: 'opacity-95', protectedLayer: true, style: { zIndex: 107 } },
      headstockTunerButtons ? { name: 'headstock-tuners-overlay', src: headstockTunerButtons, className: 'opacity-95', protectedLayer: true, style: { zIndex: 108 } } : null,
    ].filter(Boolean)
   }, [bodyFinish.texture, bodyFinish.color, bodyWood.texture, colorKey, config.body, config.pickups, config.topWood, config.finishType, config.finishColor, finishTypeColorAsset, topWoodTexture, fretboard.src, headstock, headstockWood.texture, headstockTrussCover, inlaySrc, neck.filter, neck.src, hardware.color, modelBodySrc, config.trussRodCover, nutOption, headstockTunerBase, headstockTunerButtons])
   
    const rearNeckLayers = useMemo(() => {
      const bodyMask = rearBodyMask
      return [
       {
         name: 'body-wood',
         maskSrc: bodyMask,
         style: {
           backgroundImage: `url(${bodyWood.texture})`,
           opacity: 1,
           mixBlendMode: 'normal',
           zIndex: 1,
           transform: 'scaleX(-1)',
         },
       },
      // Top wood on rear
      topWoodTexture
         ? {
             name: 'body-top-wood',
             maskSrc: bodyMask,
             style: {
               backgroundImage: `url(${topWoodTexture})`,
               opacity: 0.8,
               mixBlendMode: 'normal',
               zIndex: 2,
               transform: 'scaleX(-1)',
             },
           }
         : null,
      // Finish on rear
      finishTypeColorAsset
         ? {
             name: 'body-finish-type',
             maskSrc: bodyMask,
             style: {
               backgroundImage: `url(${finishTypeColorAsset})`,
               opacity: 1,
               mixBlendMode: 'normal',
               zIndex: 3,
               transform: 'scaleX(-1)',
             },
           }
         : bodyFinish.texture
           ? {
               name: 'body-finish-texture',
               maskSrc: bodyMask,
               style: {
                 backgroundImage: `url(${bodyFinish.texture})`,
                 opacity: 1,
                 mixBlendMode: 'normal',
                 zIndex: 3,
                 transform: 'scaleX(-1)',
               },
            }
           : bodyFinish.color
           ? {
              name: 'body-finish-color',
              maskSrc: bodyMask,
              style: {
                backgroundColor: bodyFinish.color,
                opacity: 1,
                mixBlendMode: 'normal',
                zIndex: 3,
                transform: 'scaleX(-1)',
              },
            }
           : null,
         // Top coat on rear view (no mask - apply full rear overlay)
         topCoatAsset
           ? {
               name: 'body-top-coat',
               style: {
                 backgroundImage: `url(${topCoatAsset})`,
                 opacity: 1,
                 mixBlendMode: 'normal',
                 zIndex: 4,
                 transform: 'scaleX(-1)',
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
          maskSrc: rearHeadstockMask,
          style: {
            backgroundImage: `url(${headstockWood.texture})`,
            opacity: 0.95,
            zIndex: 102,
            transform: 'scaleX(-1)',
          },
         protectedLayer: true,
       },
         rearTunerAsset
           ? { name: 'headstock-tuners-base', src: rearTunerAsset, className: 'opacity-95', protectedLayer: true, style: { zIndex: 103, transform: 'scaleX(-1)', backgroundPosition: 'top center' } }
           : null,
        ].filter(Boolean)
      }, [bodyFinish.texture, bodyFinish.color, bodyWood.texture, colorKey, config.topWood, config.finishType, config.finishColor, finishTypeColorAsset, topWoodTexture, fretboard.src, headstock, headstockWood.texture, modelBodySrc, neck.filter, neck.src, topCoatAsset, rearTunerAsset, rearHeadstockMask, rearBodyMask])
  
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
                    {outputJackAsset && (
                      <GuitarLayer src={outputJackAsset} className="opacity-95" style={{ zIndex: 55, transform: 'scaleX(-1)' }} layerName="output-jack" protectedLayer />
                    )}
                    {tremoloCoverAsset && (
                      <GuitarLayer maskSrc={rearBodyMask} style={{ backgroundImage: `url(${tremoloCoverAsset})`, zIndex: 134, backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: 'contain', transform: 'scaleX(-1)' }} layerName="tremolo-cover" protectedLayer />
                    )}
                    {cavityCoverAsset && (
                      <GuitarLayer maskSrc={rearBodyMask} style={{ backgroundImage: `url(${cavityCoverAsset})`, zIndex: 135, backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: 'contain', transform: 'scaleX(-1)' }} layerName="electronics-cavity-cover" protectedLayer />
                    )}
                    {cavityScrewsAsset && (
                      <GuitarLayer maskSrc={rearBodyMask} style={{ backgroundImage: `url(${cavityScrewsAsset})`, zIndex: 136, backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: 'contain', transform: 'scaleX(-1)' }} layerName="cavity-screws" protectedLayer />
                    )}
                    {overlayLayers.map((layer, index) => (
                      <GuitarLayer key={`overlay-${index}`} src={layer.src} style={layer.style} layerName={`overlay-${index}`} />
                    ))}
                    {strapBack && (
                      <GuitarLayer src={strapBack} className="opacity-100" style={{ zIndex: 203, transform: 'scaleX(-1)' }} layerName="strap-button-rear" protectedLayer />
                    )}
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