const imageMetaCache = new Map()
const imageDataCache = new Map()

export const BASE_STICKER_Z_INDEX = 30
const MIN_STICKER_SIZE = 4
const MAX_STICKER_SIZE = 50

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

function getStickerSize(sticker) {
  const size = Number(sticker?.size)
  if (!Number.isFinite(size) || size <= 0) return MIN_STICKER_SIZE
  return clamp(size, MIN_STICKER_SIZE, MAX_STICKER_SIZE)
}

function getStickerMetrics(sticker, stageRect, centerX, centerY) {
  const width = Math.max(1, (stageRect.width * (Number(sticker?.size) || 0)) / 100)
  const height = width / getStickerAspectRatio(sticker)
  const angle = ((Number(sticker?.rotation) || 0) * Math.PI) / 180
  const halfWidth = width / 2
  const halfHeight = height / 2

  const localPoints = []
  const steps = 12
  for (let xStep = 0; xStep <= steps; xStep += 1) {
    const xFraction = (xStep / steps) - 0.5
    for (let yStep = 0; yStep <= steps; yStep += 1) {
      const yFraction = (yStep / steps) - 0.5
      localPoints.push({
        x: halfWidth * 2 * xFraction,
        y: halfHeight * 2 * yFraction,
      })
    }
  }

  return localPoints.map((point) => ({
    x: centerX + (point.x * Math.cos(angle)) - (point.y * Math.sin(angle)),
    y: centerY + (point.x * Math.sin(angle)) + (point.y * Math.cos(angle)),
  }))
}

function isPlacementValid({ sticker, stageRect, centerX, centerY, bodyMask, protectedMasks = [] }) {
  const samplePoints = getStickerMetrics(sticker, stageRect, centerX, centerY)
  const bodyThreshold = 24
  const protectedThreshold = 8

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

function getPlacementBodyBox(stageRect, placementContext) {
  if (placementContext?.bodyBox) return placementContext.bodyBox
  if (!placementContext?.bodyMask) return null
  return getContainBox(stageRect.width, stageRect.height, placementContext.bodyMask.width, placementContext.bodyMask.height)
}

function getStickerAnchorPoint(sticker, stageRect, bodyBox, preferBodyAnchor = true) {
  if (preferBodyAnchor && bodyBox && Number.isFinite(sticker?.bodyX) && Number.isFinite(sticker?.bodyY)) {
    return {
      x: bodyBox.x + (clamp(Number(sticker.bodyX), 0, 100) / 100) * bodyBox.width,
      y: bodyBox.y + (clamp(Number(sticker.bodyY), 0, 100) / 100) * bodyBox.height,
    }
  }

  const x = clamp(Number(sticker?.x) || 0, 0, 100)
  const y = clamp(Number(sticker?.y) || 0, 0, 100)
  return {
    x: (x / 100) * stageRect.width,
    y: (y / 100) * stageRect.height,
  }
}

function findNearestValidCenter({ sticker, stageRect, bodyMask, protectedMasks, startX, startY, bodyBox }) {
  if (isPlacementValid({ sticker, stageRect, bodyMask, protectedMasks, centerX: startX, centerY: startY })) {
    return { x: startX, y: startY }
  }

  const maxRadius = Math.max(stageRect.width, stageRect.height) * 0.3
  const step = Math.max(4, Math.round(Math.min(stageRect.width, stageRect.height) / 120))
  const directions = 16
  let bestCandidate = null

  const considerCandidate = (candidate) => {
    if (!isPlacementValid({ sticker, stageRect, bodyMask, protectedMasks, centerX: candidate.x, centerY: candidate.y })) {
      return
    }
    const distance = Math.hypot(candidate.x - startX, candidate.y - startY)
    if (!bestCandidate || distance < bestCandidate.distance) {
      bestCandidate = { ...candidate, distance }
    }
  }

  for (let radius = step; radius <= maxRadius; radius += step) {
    for (let index = 0; index < directions; index += 1) {
      const angle = (Math.PI * 2 * index) / directions
      considerCandidate({
        x: clamp(startX + Math.cos(angle) * radius, 0, stageRect.width),
        y: clamp(startY + Math.sin(angle) * radius, 0, stageRect.height),
      })
    }
  }

  const bounds = bodyBox || {
    x: 0,
    y: 0,
    width: stageRect.width,
    height: stageRect.height,
  }

  const gridColumns = 10
  const gridRows = 10
  for (let row = 0; row <= gridRows; row += 1) {
    const ratioY = row / gridRows
    for (let column = 0; column <= gridColumns; column += 1) {
      const ratioX = column / gridColumns
      considerCandidate({
        x: bounds.x + bounds.width * ratioX,
        y: bounds.y + bounds.height * ratioY,
      })
    }
  }

  return bestCandidate ? { x: bestCandidate.x, y: bestCandidate.y } : null
}

function resolvePlacementForSize({
  sticker,
  stageRect,
  bodyMask,
  protectedMasks,
  startX,
  startY,
  bodyBox,
  size,
}) {
  const candidateSticker = { ...sticker, size }
  const center = findNearestValidCenter({
    sticker: candidateSticker,
    stageRect,
    bodyMask,
    protectedMasks,
    startX,
    startY,
    bodyBox,
  })
  if (!center) return null

  return {
    sticker: candidateSticker,
    center,
  }
}

function fitStickerPlacement({
  sticker,
  stageRect,
  bodyMask,
  protectedMasks,
  desiredCenter,
  desiredSize,
  bodyBox,
}) {
  const minSize = MIN_STICKER_SIZE
  const maxSize = clamp(desiredSize, minSize, MAX_STICKER_SIZE)

  let low = minSize
  let high = maxSize
  let best = null
  let safety = 0

  while (low <= high && safety < 20) {
    safety += 1
    const mid = Number(((low + high) / 2).toFixed(2))
    const candidate = resolvePlacementForSize({
      sticker,
      stageRect,
      bodyMask,
      protectedMasks,
      startX: desiredCenter.x,
      startY: desiredCenter.y,
      bodyBox,
      size: mid,
    })
    if (candidate) {
      best = candidate
      low = mid + 0.25
    } else {
      high = mid - 0.25
    }
  }

  if (best) return best

  const fallback = resolvePlacementForSize({
    sticker,
    stageRect,
    bodyMask,
    protectedMasks,
    startX: desiredCenter.x,
    startY: desiredCenter.y,
    bodyBox,
    size: minSize,
  })
  return fallback
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

  const [bodyResult, ...protectedResults] = await Promise.allSettled([
    getImageData(bodySrc),
    ...protectedSources.map((src) => getImageData(src)),
  ])
  if (bodyResult.status === 'rejected') throw bodyResult.reason
  const bodyMask = bodyResult.value
  const protectedMasks = protectedResults
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)

  const bodyBox = bodyMask ? getContainBox(stage.getBoundingClientRect().width, stage.getBoundingClientRect().height, bodyMask.width, bodyMask.height) : null

  return {
    bodySrc,
    bodyMask,
    bodyBox,
    protectedMasks: protectedMasks.filter(Boolean),
  }
}

function toStagePointFromBodyPoint(bodyPoint, stageRect, bodyBox) {
  if (!bodyPoint || !bodyBox || !stageRect) return null
  return {
    x: bodyBox.x + (bodyPoint.x / 100) * bodyBox.width,
    y: bodyBox.y + (bodyPoint.y / 100) * bodyBox.height,
  }
}

function toBodyPointFromStagePoint(stagePoint, stageRect, bodyBox) {
  if (!stagePoint || !bodyBox || !stageRect) return null
  return {
    x: ((stagePoint.x - bodyBox.x) / bodyBox.width) * 100,
    y: ((stagePoint.y - bodyBox.y) / bodyBox.height) * 100,
  }
}

export function normalizeStickerPlacement(sticker, stage, placementContext, options = {}) {
  if (!sticker) return sticker
  const stageRect = stage?.getBoundingClientRect?.()
  if (!stageRect || stageRect.width <= 0 || stageRect.height <= 0) {
    return sticker
  }
  const bodyBox = placementContext?.bodyMask ? getPlacementBodyBox(stageRect, placementContext) : null
  const size = getStickerSize(sticker)
  const x = Number(sticker.x)
  const y = Number(sticker.y)
  const fallbackX = Number.isFinite(x) ? x : 50
  const fallbackY = Number.isFinite(y) ? y : 50

  if (!bodyBox) {
    return {
      ...sticker,
      x: fallbackX,
      y: fallbackY,
      size,
    }
  }

  const bodyPoint = toBodyPointFromStagePoint(
    {
      x: ((fallbackX / 100) * stageRect.width),
      y: ((fallbackY / 100) * stageRect.height),
    },
    stageRect,
    bodyBox,
  )

  return {
    ...sticker,
    x: fallbackX,
    y: fallbackY,
    size,
    bodyX: bodyPoint?.x ?? fallbackX,
    bodyY: bodyPoint?.y ?? fallbackY,
  }
}

export function getStickerRenderPosition(sticker, stage, placementContext) {
  if (!sticker) return { x: 0, y: 0 }
  const stageRect = stage?.getBoundingClientRect?.()
  if (!stageRect || stageRect.width <= 0 || stageRect.height <= 0) {
    return {
      x: clamp(Number(sticker.x) || 0, 0, 100),
      y: clamp(Number(sticker.y) || 0, 0, 100),
    }
  }

  const bodyMask = placementContext?.bodyMask
  const bodyBox = placementContext?.bodyBox || (bodyMask ? getContainBox(stageRect.width, stageRect.height, bodyMask.width, bodyMask.height) : null)

  if (bodyBox && Number.isFinite(sticker.bodyX) && Number.isFinite(sticker.bodyY)) {
    const point = toStagePointFromBodyPoint({ x: sticker.bodyX, y: sticker.bodyY }, stageRect, bodyBox)
    if (point) {
      return {
        x: (point.x / stageRect.width) * 100,
        y: (point.y / stageRect.height) * 100,
      }
    }
  }

  return {
    x: clamp(Number(sticker.x) || 0, 0, 100),
    y: clamp(Number(sticker.y) || 0, 0, 100),
  }
}
