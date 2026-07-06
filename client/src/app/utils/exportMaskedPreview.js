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

function drawImageContain(ctx, image, dx, dy, dw, dh) {
  const imageRatio = image.width / image.height
  const boxRatio = dw / dh

  let renderWidth = dw
  let renderHeight = dh
  let x = dx
  let y = dy

  if (imageRatio > boxRatio) {
    renderHeight = dw / imageRatio
    y += (dh - renderHeight) / 2
  } else {
    renderWidth = dh * imageRatio
    x += (dw - renderWidth) / 2
  }

  ctx.drawImage(image, x, y, renderWidth, renderHeight)
}

function normalizeBlendMode(mode) {
  if (!mode || mode === 'normal') return 'source-over'
  if (mode === 'screen' || mode === 'multiply') return mode
  return 'source-over'
}

function readNumericZIndex(style, fallback = 0) {
  const value = Number.parseFloat(style?.zIndex ?? '')
  return Number.isFinite(value) ? value : fallback
}

export async function exportMaskedPreview(previewRoot, { fileName, background = '#111111', scale = 2 } = {}) {
  const DEBUG = Boolean(import.meta.env?.DEV)
  const stage = previewRoot?.querySelector('[data-export-stage="true"]')
  if (!stage) {
    throw new Error('Preview stage not found')
  }

  const rootRect = previewRoot.getBoundingClientRect()
  const stageRect = stage.getBoundingClientRect()
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(rootRect.width * scale))
  canvas.height = Math.max(1, Math.round(rootRect.height * scale))

  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, rootRect.width, rootRect.height)

  const stageX = stageRect.left - rootRect.left
  const stageY = stageRect.top - rootRect.top
  // Stage rect already reflects CSS transforms on screen; draw directly in this final box
  // to avoid double-transform drift between preview and exported image.
  ctx.translate(stageX, stageY)

  const exportOps = []
  let order = 0

  const layerNodes = Array.from(stage.querySelectorAll('[data-export-layer="true"]'))
  for (const layerNode of layerNodes) {
    const style = window.getComputedStyle(layerNode)
    const rawImageSrc = parseUrl(style.backgroundImage)
    const rawMaskSrc = parseUrl(style.maskImage || style.webkitMaskImage)
    const imageSrc = isValidImageSrc(rawImageSrc) ? rawImageSrc : null
    const maskSrc = isValidImageSrc(rawMaskSrc) ? rawMaskSrc : null
    if (!imageSrc && !maskSrc) continue

    exportOps.push({
      type: 'layer',
      zIndex: readNumericZIndex(style, 0),
      order: order += 1,
      node: layerNode,
      style,
      imageSrc,
      maskSrc,
    })
  }

  const stickerNodes = Array.from(previewRoot.querySelectorAll('img[data-export-sticker="true"]'))
  for (const stickerNode of stickerNodes) {
    const style = window.getComputedStyle(stickerNode)
    const src = stickerNode.getAttribute('src')
    if (!isValidImageSrc(src)) continue

    exportOps.push({
      type: 'sticker',
      zIndex: readNumericZIndex(style, 0),
      order: order += 1,
      node: stickerNode,
      style,
      imageSrc: src,
    })
  }

  exportOps.sort((a, b) => (a.zIndex - b.zIndex) || (a.order - b.order))

  const exportLayerRows = []
  for (const op of exportOps) {
    if (op.type === 'layer') {
      try {
        ctx.save()
        ctx.globalAlpha = Number.parseFloat(op.style.opacity || '1') || 1
        ctx.globalCompositeOperation = normalizeBlendMode(op.style.mixBlendMode)
        ctx.filter = op.style.filter && op.style.filter !== 'none' ? op.style.filter : 'none'

        if (op.maskSrc) {
          const [maskImage, fillImage] = await Promise.all([
            loadImage(op.maskSrc),
            op.imageSrc ? loadImage(op.imageSrc) : Promise.resolve(null),
          ])

          const maskCanvas = document.createElement('canvas')
          maskCanvas.width = Math.max(1, Math.round(stageRect.width * scale))
          maskCanvas.height = Math.max(1, Math.round(stageRect.height * scale))
          const maskCtx = maskCanvas.getContext('2d')
          maskCtx.scale(scale, scale)

          if (fillImage) {
            drawImageContain(maskCtx, fillImage, 0, 0, stageRect.width, stageRect.height)
          } else {
            maskCtx.fillStyle = op.style.backgroundColor || 'transparent'
            maskCtx.fillRect(0, 0, stageRect.width, stageRect.height)
          }

          maskCtx.globalCompositeOperation = 'destination-in'
          drawImageContain(maskCtx, maskImage, 0, 0, stageRect.width, stageRect.height)
          ctx.drawImage(maskCanvas, 0, 0, stageRect.width, stageRect.height)
        } else if (op.imageSrc) {
          const image = await loadImage(op.imageSrc)
          drawImageContain(ctx, image, 0, 0, stageRect.width, stageRect.height)
        }
      } catch (error) {
        console.warn('Skipping layer during export:', op.node.getAttribute('data-layer') || 'unknown-layer', error)
      } finally {
        ctx.restore()
      }
      if (DEBUG) {
        const rect = op.node.getBoundingClientRect()
        exportLayerRows.push({
          name: op.node.getAttribute('data-layer') || '',
          src: op.imageSrc || '',
          mask: op.maskSrc || '',
          zIndex: op.zIndex,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          opacity: op.style.opacity,
          display: op.style.display,
          visibility: op.style.visibility,
          transform: op.style.transform,
        })
      }
      continue
    }

    const rotation = Number.parseFloat(op.node.getAttribute('data-sticker-rotation') || '0')

    try {
      const image = await loadImage(op.imageSrc)
      ctx.save()
      ctx.filter = 'none'
      const rect = op.node.getBoundingClientRect()
      const drawWidth = rect.width
      const drawHeight = rect.height
      const centerX = (rect.left - stageRect.left) + drawWidth / 2
      const centerY = (rect.top - stageRect.top) + drawHeight / 2

      ctx.translate(centerX, centerY)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
    } catch (error) {
      console.warn('Skipping sticker during export:', error)
    } finally {
      ctx.restore()
    }
  }
  if (DEBUG) {
    console.log('[BASS EXPORT DEBUG] Rendered layer diagnostics', {
      stage: {
        width: Math.round(stageRect.width),
        height: Math.round(stageRect.height),
      },
      layers: exportLayerRows,
    })
  }

  const link = document.createElement('a')
  link.download = fileName ?? `preview-${Date.now()}.png`
  link.href = canvas.toDataURL('image/png')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
