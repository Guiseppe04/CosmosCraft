import { useState } from 'react'
import { ChevronDown, Upload, Copy, Trash2, ArrowUp, ArrowDown } from 'lucide-react'

export function StickerPanel({ stickerCount = 0, maxStickers = 10, defaultExpanded = false,
  onAddClick, addDisabled = false, stickers = [], selectedStickerId, onSelect,
  onDuplicate, onDelete, onMoveLayer, onClearAll }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const selectedIndex = stickers.findIndex(sticker => sticker.id === selectedStickerId)
  const selected = selectedIndex >= 0
  return <div className="builder-sticker-panel sticker-management">
    <div className="builder-sticker-toolbar">
      <button type="button" onClick={onAddClick} disabled={addDisabled} className="sticker-add-button"
        title="Upload sticker image"><Upload size={15} />Add Sticker</button>
      <span className="sticker-count" aria-label={`${stickerCount} of ${maxStickers} stickers`}>{stickerCount} / {maxStickers}</span>
      <div className="sticker-context-actions">
        {selected && <>
          <button type="button" onClick={onDuplicate} disabled={addDisabled} aria-label="Duplicate sticker" title="Duplicate sticker"><Copy size={16} /></button>
          <button type="button" onClick={onDelete} aria-label="Delete sticker" title="Delete sticker" className="sticker-delete-button"><Trash2 size={16} /></button>
        </>}
        {stickerCount > 3 && <button type="button" onClick={onClearAll}
          className="sticker-clear-button sticker-delete-button" title="Remove all stickers from both views">
          Clear All
        </button>}
        <button type="button" onClick={() => setExpanded(prev => !prev)} aria-expanded={expanded}
          aria-label={expanded ? 'Collapse sticker panel' : 'Expand sticker panel'} title="Sticker library">
          <ChevronDown size={16} style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
        </button>
      </div>
    </div>
    {expanded && <div className="sticker-library">
      {stickers.length ? <div className="sticker-thumbnails" aria-label="Stickers on this view">
        {stickers.map((sticker, index) => <button type="button" key={sticker.id}
          onClick={() => onSelect(sticker.id)} aria-label={`Select sticker ${index + 1} from library`}
          aria-pressed={sticker.id === selectedStickerId} title={`Sticker ${index + 1}`}>
          <img src={sticker.src} alt="" />
        </button>)}
      </div> : <p>Add an image, then drag it on the guitar.</p>}
      {selected && stickers.length > 1 && <div className="sticker-layer-actions">
        <span>Layer {selectedIndex + 1} / {stickers.length}</span>
        <button type="button" onClick={() => onMoveLayer('down')} disabled={selectedIndex === 0}
          aria-label="Lower sticker layer" title="Move behind another sticker"><ArrowDown size={16} /></button>
        <button type="button" onClick={() => onMoveLayer('up')} disabled={selectedIndex === stickers.length - 1}
          aria-label="Raise sticker layer" title="Move above another sticker"><ArrowUp size={16} /></button>
      </div>}
      {selected && <p>Drag to move ? Corners to resize ? Circle to rotate</p>}
    </div>}
  </div>
}
