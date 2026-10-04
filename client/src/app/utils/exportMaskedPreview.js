function parseUrls(value) {
  return [...String(value || '').matchAll(/url\((['"]?)(.*?)\1\)/g)].map(match => match[2])
}

function validImage(src) {
  return typeof src === 'string' && src.trim() && src !== 'none' && !src.endsWith('/undefined') && !src.endsWith('/null')
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

function drawContain(ctx, image, width, height) {
  const ratio = Math.min(width / image.width, height / image.height)
  const w = image.width * ratio
  const h = image.height * ratio
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h)
}

function makeCanvas(width, height, scale) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  return { canvas, ctx }
}

function downloadImage(dataUrl, fileName) {
  const link = document.createElement('a')
  link.download = fileName
  link.href = dataUrl
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function downloadPreviewImages(images, prefix = 'guitar-design') {
  for (const side of ['front', 'rear']) {
    if (images[side]) downloadImage(images[side], `${prefix}-${side}.png`)
  }
}

// Draw in the stage's untransformed coordinates, then apply its display transform
// once. A rotated sticker's bounding box is not its original image size.
export async function exportMaskedPreview(previewRoot, { fileName, background = '#111111', scale = 2, download = true } = {}) {
  const stage = previewRoot?.querySelector('[data-export-stage="true"]')
  if (!stage) throw new Error('Preview stage not found')
  const rootRect = previewRoot.getBoundingClientRect()
  const stageRect = stage.getBoundingClientRect()
  const width = stage.offsetWidth || stageRect.width
  const height = stage.offsetHeight || stageRect.height
  const {canvas, ctx} = makeCanvas(rootRect.width, rootRect.height, scale)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, rootRect.width, rootRect.height)
  const matrix = new DOMMatrix(getComputedStyle(stage).transform)
  const flip = matrix.a < 0 ? -1 : 1
  ctx.translate(stageRect.left - rootRect.left + stageRect.width / 2, stageRect.top - rootRect.top + stageRect.height / 2)
  ctx.scale(flip * stageRect.width / width, stageRect.height / height)
  ctx.translate(-width / 2, -height / 2)

  const imageCache = new Map()
  const image = src => {
    if (!imageCache.has(src)) imageCache.set(src, loadImage(src))
    return imageCache.get(src)
  }
  const operations = [...stage.querySelectorAll('[data-export-layer="true"], img[data-export-sticker="true"]')].map((node, order) => {
    const style = getComputedStyle(node)
    const sticker = node.matches('img[data-export-sticker="true"]')
    const clip = sticker ? node.closest('[data-sticker-clip-mask-src]') : null
    const zIndex = Number.parseFloat(clip ? getComputedStyle(clip).zIndex : style.zIndex) || 0
    return {node, style, sticker, clip, zIndex, order}
  }).filter(({style}) => style.display !== 'none' && style.visibility !== 'hidden')
    .sort((a,b) => a.zIndex - b.zIndex || a.order - b.order)

  for (const {node, style, sticker, clip} of operations) {
    ctx.save()
    try {
      const opacity = Number.parseFloat(style.opacity)
      ctx.globalAlpha = Number.isFinite(opacity) ? opacity : 1
      ctx.globalCompositeOperation = ['multiply','screen'].includes(style.mixBlendMode) ? style.mixBlendMode : 'source-over'
      if (sticker) {
        const src = node.getAttribute('src')
        if (!validImage(src)) continue
        const stickerImage = await image(src)
        // Only this sticker buffer is masked, leaving guitar components untouched.
        const buffer = makeCanvas(width, height, scale)
        const stickerWidth = node.offsetWidth
        const stickerHeight = node.offsetHeight || stickerWidth * stickerImage.height / stickerImage.width
        const x = Number.parseFloat(node.getAttribute('data-sticker-x'))
        const y = Number.parseFloat(node.getAttribute('data-sticker-y'))
        const centerX = Number.isFinite(x) ? width * x / 100 : node.offsetLeft
        const centerY = Number.isFinite(y) ? height * y / 100 : node.offsetTop
        buffer.ctx.save()
        buffer.ctx.translate(centerX, centerY)
        buffer.ctx.rotate((Number(node.getAttribute('data-sticker-rotation')) || 0) * Math.PI / 180)
        buffer.ctx.drawImage(stickerImage, -stickerWidth / 2, -stickerHeight / 2, stickerWidth, stickerHeight)
        buffer.ctx.restore()
        const maskSrc = clip?.getAttribute('data-sticker-clip-mask-src') || parseUrls(clip && getComputedStyle(clip).maskImage)[0]
        if (validImage(maskSrc)) {
          buffer.ctx.globalCompositeOperation = 'destination-in'
          drawContain(buffer.ctx, await image(maskSrc), width, height)
        }
        ctx.drawImage(buffer.canvas, 0, 0, width, height)
      } else {
        const src = parseUrls(style.backgroundImage)[0]
        const masks = parseUrls(style.maskImage || style.webkitMaskImage).filter(validImage)
        if (!validImage(src) && !masks.length) continue
        const buffer = makeCanvas(width, height, scale)
        if (validImage(src)) drawContain(buffer.ctx, await image(src), width, height)
        else {
          buffer.ctx.fillStyle = style.backgroundColor
          buffer.ctx.fillRect(0, 0, width, height)
        }
        for (const mask of masks) {
          buffer.ctx.globalCompositeOperation = 'destination-in'
          drawContain(buffer.ctx, await image(mask), width, height)
        }
        ctx.filter = style.filter && style.filter !== 'none' ? style.filter : 'none'
        if (style.transform && style.transform !== 'none') {
          const transform = new DOMMatrix(style.transform)
          ctx.translate(width / 2, height / 2)
          ctx.transform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f)
          ctx.translate(-width / 2, -height / 2)
        }
        ctx.drawImage(buffer.canvas, 0, 0, width, height)
      }
    } catch (error) {
      if (sticker) throw error
      console.warn('Skipping layer during export:', node.getAttribute('data-layer'), error)
    } finally { ctx.restore() }
  }
  const dataUrl = canvas.toDataURL('image/png')
  if (download) downloadImage(dataUrl, fileName || `preview-${Date.now()}.png`)
  return dataUrl
}
