import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { exportMaskedPreview } from './exportMaskedPreview.js'
import { BASE_STICKER_Z_INDEX, buildStickerPlacementContext, getStickerRenderPosition } from './stickerPlacement.js'

// Use the editor's own renderer and resolved assets at a fixed export size.
// Capturing offscreen avoids changing the active view, zoom, or sticker state.
export async function captureBuildViews(Preview, config, stickers, previewProps = {}, { scale = 2 } = {}) {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1200px;pointer-events:none;'
  document.body.appendChild(host)
  const root = createRoot(host)
  const contexts = {}
  const render = () => flushSync(() => root.render(<>
    {['front', 'rear'].map(side => <div key={side} data-capture-side={side} style={{width:1200, padding:24}}>
      <Preview {...previewProps} config={config} view={side} stickerOverlay={stickers
        .filter(sticker => (sticker.side || 'front') === side)
        .map((sticker, index) => {
          const position = getStickerRenderPosition(sticker, contexts[side]?.stage, contexts[side]?.placement)
          const mirrored = contexts[side]?.mirrored || false
          return <img key={sticker.id || index} src={sticker.src} alt="" data-export-sticker="true"
            data-sticker-unmirror={mirrored ? 'true' : 'false'}
            data-sticker-x={position.x} data-sticker-y={position.y} data-sticker-rotation={sticker.rotation || 0}
            style={{position:'absolute',zIndex:BASE_STICKER_Z_INDEX + index,left:`${position.x}%`,top:`${position.y}%`,width:`${sticker.size}%`,
              transform:`translate(-50%, -50%) rotate(${(mirrored ? -1 : 1) * (sticker.rotation || 0)}deg)${mirrored ? ' scaleX(-1)' : ''}`,transformOrigin:'center center'}} />
        })} />
    </div>)}
  </>))
  try {
    render()
    for (const side of ['front', 'rear']) {
      const stage = host.querySelector(`[data-capture-side="${side}"] [data-export-stage="true"]`)
      stage.style.transition = 'none'
      const maskSrc = stage.querySelector('[data-sticker-clip-mask-src]')?.getAttribute('data-sticker-clip-mask-src') || previewProps.stickerMaskSrc
      const placement = maskSrc ? await buildStickerPlacementContext(stage, maskSrc) : null
      const mirrored = new DOMMatrix(getComputedStyle(stage).transform).a < 0
      contexts[side] = {stage,placement,mirrored}
    }
    render()
    await Promise.all([...host.querySelectorAll('img')].map(img => img.decode()))
    const images = {}
    for (const side of ['front','rear']) {
      images[side] = await exportMaskedPreview(host.querySelector(`[data-capture-side="${side}"]`), {download:false,background:'#141414',scale})
    }
    return images
  } finally {
    root.unmount()
    host.remove()
  }
}
