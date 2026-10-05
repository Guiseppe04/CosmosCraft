import { Minus, Plus } from 'lucide-react'

export function PreviewViewControls({ view, onViewChange }) {
  return <div className="builder-view-controls" role="group" aria-label="Guitar view">
    {['front', 'rear'].map(side => <button key={side} type="button"
      aria-label={side === 'front' ? 'Front View' : 'Rear View'} aria-pressed={view === side}
      onClick={() => onViewChange(side)} title={side === 'front' ? 'Front view' : 'Rear view'}>
      <span>{side === 'front' ? 'Front' : 'Rear'}</span>
    </button>)}
  </div>
}

export function PreviewZoomControls({ zoomLevel, onZoomOut, onZoomIn, onReset }) {
  return <div className="builder-zoom-controls" role="group" aria-label="Preview zoom">
    <button type="button" onClick={onZoomOut} disabled={zoomLevel <= 0.7} aria-label="Zoom out" title="Zoom out">
      <span><Minus size={13} /></span>
    </button>
    <button type="button" onClick={onReset} className="preview-zoom-percent" aria-label="Reset zoom" title="Reset zoom">
      {Math.round(zoomLevel * 100)}%
    </button>
    <button type="button" onClick={onZoomIn} disabled={zoomLevel >= 2} aria-label="Zoom in" title="Zoom in">
      <span><Plus size={13} /></span>
    </button>
  </div>
}
