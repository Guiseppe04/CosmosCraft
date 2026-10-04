import GuitarPreview from '../guitar/GuitarPreview'
import BassPreview from '../bass/BassPreview'
import { BODY_OPTIONS, DEFAULT_CONFIG } from '../../lib/guitarBuilderData'
import { BASS_BODY_OPTIONS, BASS_DEFAULT_CONFIG } from '../../lib/bassBuilderData'

const parse = (value, fallback) => {
  if (typeof value !== 'string') return value || fallback
  try { return JSON.parse(value) || fallback } catch { return fallback }
}

export default function CustomBuildThumbnail({ item }) {
  const build = item.customization || item
  const savedConfig = parse(build.config || build.config_json, {})
  const isBass = Boolean(build.isBass || savedConfig.bassType || String(build.guitar_type || savedConfig.guitarType || '').toLowerCase().includes('bass'))
  const config = { ...(isBass ? BASS_DEFAULT_CONFIG : DEFAULT_CONFIG), ...savedConfig }
  const Preview = isBass ? BassPreview : GuitarPreview
  const mask = isBass ? BASS_BODY_OPTIONS[config.body]?.bodySrc : BODY_OPTIONS[config.body]?.bodySrc
  const stickers = parse(build.stickers, [])
  const previewImage = build.preview_image || item.preview_image
  if (previewImage) return <img src={previewImage} alt={item.name || 'Custom guitar'} className="h-full w-full object-contain" />
  return (
    <div className="relative h-full w-full overflow-hidden" role="img" aria-label={`${item.name || 'Custom guitar'} preview`}>
      <div className="absolute left-1/2 top-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 scale-[0.2]">
        <Preview config={config} view="front" modelImageSrc={null} bodyWoodImageSrc={null} topWoodImageSrc={null} stickerMaskSrc={mask || null}
          stickerOverlay={(Array.isArray(stickers) ? stickers : []).filter(sticker => (sticker.side || 'front') === 'front' && sticker.src).map((sticker, index) => (
            <img key={sticker.id || index} src={sticker.src} alt="" draggable={false} className="absolute" style={{ zIndex: 25 + index, left: `${Number(sticker.x) || 0}%`, top: `${Number(sticker.y) || 0}%`, width: `${Number(sticker.size) || 18}%`, transform: `translate(-50%, -50%) rotate(${Number(sticker.rotation) || 0}deg)` }} />
          ))}
        />
      </div>
    </div>
  )
}
