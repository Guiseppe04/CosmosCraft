const imageMetaCache = new Map()
const imageDataCache = new Map()

function parseUrl(value) {
  if (!value || value === 'none') return null
  const match = value.match(/url\((['"]?)(.*?)\1\)/)
  return match?.[2] ?? null
}

function isValidImageSrc(src) {
  if (!src || typeof src !== 'string') return false
  const trimmed = src.trim()
  if (!trimmed || trimmed === 'none') return false
  if (trimmed.endsWith('/undefined') || trimmed.endsWith('/null')) return false
  if (trimmed.includes('undefined') || trimmed.includes('null')) return false
  return true
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    image.src = src
  })
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function getContainBox(containerWidth, containerHeight, imageWidth, imageHeight) {
  if (!containerWidth || !containerHeight || !imageWidth || !imageHeight) {
    return { x: 0, y: 0, width: containerWidth, height: containerHeight }
  }

  const containerRatio = containerWidth / containerHeight
  const imageRatio = imageWidth / imageHeight

  if (imageRatio > containerRatio) {
    const width = containerWidth
    const height = containerWidth / imageRatio
    return { x: 0, y: (containerHeight - height) / 2, width, height }
  }

  const height = containerHeight
  const width = containerHeight * imageRatio
  return { x: (containerWidth - width) / 2, y: 0, width, height }
}

async function getImageMeta(src) {
  if (!isValidImageSrc(src)) return null
  if (!imageMetaCache.has(src)) {
    imageMetaCache.set(src, (async () => {
      const image = await loadImage(src)
      return {
        src,
        width: image.naturalWidth || image.width || 1,
        height: image.naturalHeight || image.height || 1,
      }
    })())
  }
  return imageMetaCache.get(src)
}

async function getImageData(src) {
  if (!isValidImageSrc(src)) return null
  if (!imageDataCache.has(src)) {
    imageDataCache.set(src, (async () => {
      const image = await loadImage(src)
      const width = image.naturalWidth || image.width || 1
      const height = image.naturalHeight || image.height || 1
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(image, 0, 0, width, height)
      const { data } = ctx.getImageData(0, 0, width, height)
      return { src, width, height, data }
    })())
  }
  return imageDataCache.get(src)
}

function sampleAlphaAtPoint(imageData, stageRect, point) {
  if (!imageData || !stageRect) return 0
  const box = getContainBox(stageRect.width, stageRect.height, imageData.width, imageData.height)
  const localX = point.x - box.x
  const localY = point.y - box.y

  if (localX < 0 || localY < 0 || localX > box.width || localY > box.height) return 0

  const imgX = clamp(Math.floor((localX / box.width) * imageData.width), 0, imageData.width - 1)
  const imgY = clamp(Math.floor((localY / box.height) * imageData.height), 0, imageData.height - 1)
  const index = (imgY * imageData.width + imgX) * 4 + 3
  return imageData.data[index] ?? 0
}

function getStickerAspectRatio(sticker) {
  const ratio = Number(sticker?.aspectRatio)
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1
}

function getStickerMetrics(sticker, stageRect, centerX, centerY) {
  const width = Math.max(1, (stageRect.width * (Number(sticker?.size) || 0)) / 100)
  const height = width / getStickerAspectRatio(sticker)
  const angle = ((Number(sticker?.rotation) || 0) * Math.PI) / 180
  const halfWidth = width / 2
  const halfHeight = height / 2

  const localPoints = [
    { x: 0, y: 0 },
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
    { x: 0, y: -halfHeight },
    { x: halfWidth, y: 0 },
    { x: 0, y: halfHeight },
    { x: -halfWidth, y: 0 },
  ]

  return localPoints.map((point) => ({
    x: centerX + (point.x * Math.cos(angle)) - (point.y * Math.sin(angle)),
    y: centerY + (point.x * Math.sin(angle)) + (point.y * Math.cos(angle)),
  }))
}

function isPlacementValid({ sticker, stageRect, centerX, centerY, bodyMask, protectedMasks = [] }) {
  const samplePoints = getStickerMetrics(sticker, stageRect, centerX, centerY)
  const bodyThreshold = 12
  const protectedThreshold = 12

  for (const point of samplePoints) {
    if (sampleAlphaAtPoint(bodyMask, stageRect, point) < bodyThreshold) {
      return false
    }
    for (const protectedMask of protectedMasks) {
      if (sampleAlphaAtPoint(protectedMask, stageRect, point) >= protectedThreshold) {
        return false
      }
    }
  }

  return true
}

function findNearestValidCenter({ sticker, stageRect, bodyMask, protectedMasks, startX, startY }) {
  if (isPlacementValid({ sticker, stageRect, bodyMask, protectedMasks, centerX: startX, centerY: startY })) {
    return { x: startX, y: startY }
  }

  const maxRadius = Math.max(stageRect.width, stageRect.height) * 0.3
  const step = Math.max(4, Math.round(Math.min(stageRect.width, stageRect.height) / 120))
  const directions = 16

  for (let radius = step; radius <= maxRadius; radius += step) {
    for (let index = 0; index < directions; index += 1) {
      const angle = (Math.PI * 2 * index) / directions
      const candidate = {
        x: clamp(startX + Math.cos(angle) * radius, 0, stageRect.width),
        y: clamp(startY + Math.sin(angle) * radius, 0, stageRect.height),
      }

      if (isPlacementValid({ sticker, stageRect, bodyMask, protectedMasks, centerX: candidate.x, centerY: candidate.y })) {
        return candidate
      }
    }
  }

  return {
    x: clamp(startX, 0, stageRect.width),
    y: clamp(startY, 0, stageRect.height),
  }
}

export async function getStickerImageMeta(src) {
  return getImageMeta(src)
}

export function getStickerAspectRatioFromMeta(meta) {
  if (!meta) return 1
  const width = Number(meta.width) || 0
  const height = Number(meta.height) || 0
  if (!width || !height) return 1
  return width / height
}

export async function buildStickerPlacementContext(stage, bodySrc) {
  if (!stage || !isValidImageSrc(bodySrc)) return null

  const protectedNodes = Array.from(stage.querySelectorAll('[data-sticker-protected="true"]'))
  const protectedSources = []
  const seen = new Set()

  for (const node of protectedNodes) {
    const maskSrc = node.getAttribute('data-layer-mask')
    const layerSrc = node.getAttribute('data-layer-src')
    const computedStyle = window.getComputedStyle(node)
    const computedMask = parseUrl(computedStyle.maskImage || computedStyle.webkitMaskImage)
    const computedSrc = parseUrl(computedStyle.backgroundImage)
    const source = maskSrc || layerSrc || computedMask || computedSrc
    if (!isValidImageSrc(source) || seen.has(source)) continue
    seen.add(source)
    protectedSources.push(source)
  }

  const [bodyMask, ...protectedMasks] = await Promise.all([
    getImageData(bodySrc),
    ...protectedSources.map((src) => getImageData(src)),
  ])

  return {
    bodySrc,
    bodyMask,
    protectedMasks: protectedMasks.filter(Boolean),
  }
}

export function normalizeStickerPlacement(sticker, stage, placementContext) {
  if (!sticker) return sticker
  const stageRect = stage?.getBoundingClientRect?.()
  if (!stageRect || stageRect.width <= 0 || stageRect.height <= 0) {
    return sticker
  }

  const x = clamp(Number(sticker.x) || 0, 0, 100)
  const y = clamp(Number(sticker.y) || 0, 0, 100)

  if (!placementContext?.bodyMask) {
    return { ...sticker, x: clamp(x, 5, 95), y: clamp(y, 5, 95) }
  }

  const startX = (x / 100) * stageRect.width
  const startY = (y / 100) * stageRect.height
  const nextCenter = findNearestValidCenter({
    sticker,
    stageRect,
    bodyMask: placementContext.bodyMask,
    protectedMasks: placementContext.protectedMasks || [],
    startX,
    startY,
  })

  return {
    ...sticker,
    x: (nextCenter.x / stageRect.width) * 100,
    y: (nextCenter.y / stageRect.height) * 100,
  }
}

