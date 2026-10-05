import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeStickerPlacement } from '../src/app/utils/stickerPlacement.js'

for (const side of ['front', 'rear']) {
  test(`new ${side} bass stickers fit the body instead of the preview center`, () => {
    const width = 160, height = 70
    const data = new Uint8ClampedArray(width * height * 4)
    const left = side === 'rear' ? 110 : 15
    for (let y = 20; y < 50; y++) {
      for (let x = left; x < left + 35; x++) data[(y * width + x) * 4 + 3] = 255
    }
    const context = { bodyMask: { width, height, data }, protectedMasks: [],
      bodyBox: { x: 0, y: 0, width: 960, height: 420 } }
    const stage = { getBoundingClientRect: () => ({ width: 960, height: 420 }) }
    for (const aspectRatio of [0.5, 1, 2]) {
      const sticker = normalizeStickerPlacement({ x: 50, y: 50, size: 18, aspectRatio, side },
        stage, context, { autoPlaceOnBody: true })
      const centerX = sticker.x / 100 * width
      const centerY = sticker.y / 100 * height
      const halfWidth = sticker.size / 100 * width / 2
      const halfHeight = halfWidth / aspectRatio
      assert.ok(centerX - halfWidth >= left)
      assert.ok(centerX + halfWidth < left + 35)
      assert.ok(centerY - halfHeight >= 20)
      assert.ok(centerY + halfHeight < 50)
      assert.ok(Number.isFinite(sticker.bodyX) && Number.isFinite(sticker.bodyY))
    }
  })
}
