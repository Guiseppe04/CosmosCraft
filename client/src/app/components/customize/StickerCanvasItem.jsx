import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RotateCw } from 'lucide-react'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const corners = [['top-left', -1, -1], ['top-right', 1, -1], ['bottom-left', -1, 1], ['bottom-right', 1, 1]]

// Geometry stays in the existing stage percentages. Only editing chrome uses
// screen coordinates, so masks, zoom, and small screens cannot clip its handles.
export function StickerCanvasItem({ sticker, position, index, selected, stageRef, mirrored = false,
  onSelect, onUpdate, onManipulating }) {
  const gesture = useRef(null)
  const [geometry, setGeometry] = useState(null)

  useEffect(() => {
    if (!selected) return undefined
    let frame
    const measure = () => {
      const stage = stageRef.current
      if (stage) {
        const rect = stage.getBoundingClientRect()
        const viewport = stage.closest('.builder-preview-viewport')?.getBoundingClientRect() || rect
        const next = { x: rect.left + rect.width * (mirrored ? 100 - position.x : position.x) / 100,
          y: rect.top + rect.height * position.y / 100, width: rect.width * sticker.size / 100,
          height: rect.width * sticker.size / 100 / (sticker.aspectRatio || 1),
          left: Math.max(0, viewport.left), right: Math.min(innerWidth, viewport.right),
          top: Math.max(0, viewport.top), bottom: Math.min(innerHeight, viewport.bottom) }
        setGeometry(prev => prev && Object.keys(next).every(key => Math.abs(prev[key] - next[key]) < 0.1) ? prev : next)
      }
      frame = requestAnimationFrame(measure)
    }
    measure()
    return () => cancelAnimationFrame(frame)
  }, [selected, position.x, position.y, sticker.size, sticker.aspectRatio, mirrored, stageRef])

  useEffect(() => () => onManipulating(false), [onManipulating])

  const pointInStage = (event) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect?.width || !rect.height) return null
    return { x: (mirrored ? rect.right - event.clientX : event.clientX - rect.left),
      y: event.clientY - rect.top, width: rect.width, height: rect.height }
  }
  const start = (event, mode) => {
    if (event.button !== 0 || gesture.current) return
    event.preventDefault()
    event.stopPropagation()
    const point = pointInStage(event)
    if (!point) return
    const center = { x: position.x / 100 * point.width, y: position.y / 100 * point.height }
    gesture.current = { pointerId: event.pointerId, mode, point, center, size: sticker.size,
      rotation: sticker.rotation || 0,
      distance: Math.max(1, Math.hypot(point.x - center.x, point.y - center.y)),
      angle: Math.atan2(point.y - center.y, point.x - center.x) }
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelect(sticker.id)
    onManipulating(true)
  }
  const move = (event) => {
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const point = pointInStage(event)
    if (!point) return
    if (active.mode === 'drag') {
      onUpdate(sticker.id, {
        x: clamp((active.center.x + point.x - active.point.x) / point.width * 100, 0, 100),
        y: clamp((active.center.y + point.y - active.point.y) / point.height * 100, 0, 100),
      })
    } else if (active.mode === 'resize') {
      const distance = Math.hypot(point.x - active.center.x, point.y - active.center.y)
      onUpdate(sticker.id, { size: clamp(active.size * distance / active.distance, 4, 50) })
    } else {
      const angle = Math.atan2(point.y - active.center.y, point.x - active.center.x)
      onUpdate(sticker.id, { rotation: ((active.rotation + (mirrored ? -1 : 1) * (angle - active.angle) * 180 / Math.PI) % 360 + 360) % 360 })
    }
  }
  const finish = (event) => {
    if (gesture.current?.pointerId !== event.pointerId) return
    event.stopPropagation()
    gesture.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    onManipulating(false)
  }
  const events = (mode) => ({ onPointerDown: event => start(event, mode), onPointerMove: move,
    onPointerUp: finish, onPointerCancel: finish,
    onLostPointerCapture: () => { gesture.current = null; onManipulating(false) },
    onMouseDown: event => event.stopPropagation(), onTouchStart: event => event.stopPropagation(),
    onClick: event => { event.stopPropagation(); onSelect(sticker.id) } })
  const angle = sticker.rotation || 0
  const handlePoint = (x, y) => {
    const radians = angle * Math.PI / 180
    return { left: clamp(geometry.x + x * Math.cos(radians) - y * Math.sin(radians), geometry.left + 22, geometry.right - 22),
      top: clamp(geometry.y + x * Math.sin(radians) + y * Math.cos(radians), geometry.top + 22, geometry.bottom - 22) }
  }
  return <>
    <img src={sticker.src} alt={`Custom sticker ${index + 1}`} role="button" tabIndex={0}
      aria-label={`Select sticker ${index + 1}`} aria-pressed={selected} data-sticker-interactive="true"
      data-export-sticker="true" data-sticker-x={position.x} data-sticker-y={position.y}
      data-sticker-unmirror={mirrored ? 'true' : 'false'}
      data-sticker-size={sticker.size} data-sticker-rotation={sticker.rotation || 0}
      className="sticker-canvas-image" draggable={false} {...events('drag')}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(sticker.id) }
        const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
        if (selected && directions[event.key]) {
          event.preventDefault()
          const [x, y] = directions[event.key], step = event.shiftKey ? 5 : 1
          onUpdate(sticker.id, { x: clamp(position.x + x * step * (mirrored ? -1 : 1), 0, 100), y: clamp(position.y + y * step, 0, 100) })
        }
      }}
      style={{ zIndex: 30 + index, left: `${position.x}%`, top: `${position.y}%`, width: `${sticker.size}%`,
        transform: `translate(-50%, -50%) rotate(${(mirrored ? -1 : 1) * (sticker.rotation || 0)}deg)${mirrored ? ' scaleX(-1)' : ''}` }} />
    {selected && geometry && createPortal(
      <div className="sticker-editing-chrome" data-sticker-interactive="true" data-sticker-selection="true">
        <div className="sticker-selection-box" {...events('drag')} style={{ left: geometry.x, top: geometry.y,
          width: geometry.width, height: geometry.height, transform: `translate(-50%, -50%) rotate(${angle}deg)` }} />
        {corners.map(([name, x, y]) => <button key={name} type="button" className="sticker-handle sticker-resize-handle"
          aria-label={`Resize sticker ${name}`} title="Drag to resize" {...events('resize')}
          onKeyDown={event => {
            if (['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) {
              event.preventDefault(); onUpdate(sticker.id, { size: clamp(sticker.size + (['ArrowUp', 'ArrowRight'].includes(event.key) ? 1 : -1), 4, 50) })
            }
          }} style={handlePoint(x * Math.max(30, geometry.width / 2), y * Math.max(30, geometry.height / 2))}>
          <span />
        </button>)}
        <button type="button" className="sticker-handle sticker-rotation-handle" aria-label="Rotate sticker"
          title="Drag to rotate" {...events('rotate')} style={handlePoint(0, -Math.max(30, geometry.height / 2) - 38)}
          onKeyDown={event => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault(); onUpdate(sticker.id, { rotation: ((sticker.rotation || 0) + (event.key === 'ArrowRight' ? 1 : -1) + 360) % 360 })
            }
          }}><RotateCw size={14} /></button>
      </div>, document.body)}
  </>
}
