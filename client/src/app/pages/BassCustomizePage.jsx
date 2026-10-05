import { useMemo, useState, useRef, useEffect } from 'react'
import { useStickerDraft } from '../hooks/useStickerDraft'
import { useBuilderDesktop } from '../hooks/useBuilderDesktop.js'
import { motion, AnimatePresence } from 'motion/react'
import { useSearchParams, useNavigate, useBlocker } from 'react-router'
import {
  ChevronDown, Info,
  Check, CheckCircle,
  Sparkles, Layers, Palette, Cog, Zap, Image,
  Trees, PaintBucket, ToggleRight
} from 'lucide-react'
import { formatCurrency } from '../utils/formatCurrency'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import useBassConfig from '../hooks/useBassConfig.js'
import BassPreview from '../components/bass/BassPreview.jsx'
import { downloadPreviewImages } from '../utils/exportMaskedPreview.js'
import { captureBuildViews } from '../utils/captureBuildViews.jsx'
import { useBuildSnapshot } from '../hooks/useBuildSnapshot.js'
import { API, getAuthHeaders } from '../utils/apiConfig'
import { RGBColorPicker } from '../components/options/RGBColorPicker.jsx'
import { optimizeCloudinaryImage } from '../utils/cloudinary.js'
import {
  buildStickerPlacementContext,
  getStickerAspectRatioFromMeta,
  getStickerImageMeta,
  getStickerRenderPosition,
  normalizeStickerPlacement,
} from '../utils/stickerPlacement.js'
import { BuilderActionBar } from '../components/customize/BuilderActionBar.jsx'
import { WalkInAssignmentModal } from '../components/customize/WalkInAssignmentModal.jsx'
import { BuilderCheckoutSection } from '../components/customize/BuilderCheckoutSection.jsx'
import { BuilderSavedBadge } from '../components/customize/BuilderSavedBadge.jsx'
import { PreviewViewControls, PreviewZoomControls } from '../components/customize/PreviewControls.jsx'
import { usePreviewWheelZoom } from '../hooks/usePreviewWheelZoom.js'
import { StickerPanel } from '../components/customize/StickerPanel.jsx'
import { StickerCanvasItem } from '../components/customize/StickerCanvasItem.jsx'
import { useStickerSelection } from '../hooks/useStickerSelection.js'
import { BuilderConfigurationPanel } from '../components/customize/BuilderConfigurationPanel.jsx'
import { BuilderConfiguratorDrawer } from '../components/customize/BuilderConfiguratorDrawer.jsx'
import {
  buildConfigurationLineItems,
  BASS_CONFIGURATION_ITEMS,
} from '../utils/buildConfigurationLineItems.js'

const CATEGORIES = [
  {
    id: 'general',
    label: 'General',
    icon: Sparkles,
    color: '#f59e0b',
    tooltip: 'Basic configuration including dexterity, scale length, and case.'
  },
  {
    id: 'body',
    label: 'Body',
    icon: Layers,
    color: '#d4af37',
    tooltip: 'The body shape determines the bass guitar\'s tonal characteristics and playability.'
  },
  {
    id: 'neck',
    label: 'Neck & Headstock',
    icon: Palette,
    color: '#6366f1',
    tooltip: 'The neck profile affects how the bass feels in your hand.'
  },
  {
    id: 'hardware',
    label: 'Hardware',
    icon: Cog,
    color: '#8b5cf6',
    tooltip: 'Hardware includes bridges, tuners, and control knobs.'
  },
  {
    id: 'electronics',
    label: 'Electronics',
    icon: Zap,
    color: '#14b8a6',
    tooltip: 'Pickups convert string vibration into electrical signals.'
  },
]

const MAX_STICKERS = 10
const DEFAULT_STICKER_PRICE = 100

function Tooltip({ content, children }) {
  return (
    <div className="group relative inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200">
        <div className="bg-theme-surface-deep border border-white/10 rounded-lg px-3 py-2 text-xs text-white/90 whitespace-nowrap shadow-xl shadow-black/50 max-w-xs">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--surface-elevated)]" />
        </div>
      </div>
    </div>
  )
}

function OptionButton({ option, isSelected, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative w-full rounded-xl border p-3.5 text-left transition-all duration-200 ${disabled
          ? 'border-white/5 opacity-40 cursor-not-allowed'
          : isSelected
            ? 'border-[#d4af37] bg-gradient-to-br from-[#d4af37]/20 to-[#d4af37]/5 shadow-lg shadow-[#d4af37]/10'
            : 'border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--gold-primary)] hover:bg-[var(--surface-dark)]'
        }`}
    >
      {isSelected && (
        <div className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-bl-lg rounded-tr-xl bg-[#d4af37]">
          <Check className="h-3 w-3 text-black" />
        </div>
      )}

      <div className="space-y-1.5">
        <div className={`text-[15px] font-bold leading-tight tracking-tight transition-colors duration-200 ${isSelected ? 'text-[var(--text-light)]' : 'text-[var(--text-light)] group-hover:text-white'
          }`}>
          {option.label}
        </div>
        {option.note && (
          <div className="text-[11px] leading-relaxed text-[var(--text-muted)] line-clamp-2">
            {option.note}
          </div>
        )}
        {option.price > 0 && (
          <div className={`text-[11px] font-semibold ${isSelected ? 'text-[#d4af37]' : 'text-[#d4af37]/70'
            }`}>
            +₱{option.price.toLocaleString('en-PH')}
          </div>
        )}
      </div>
    </button>
  )
}

function VisualCard({ option, isSelected, onClick, previewImage, fallbackImage, imageHeight = 'h-16', fit = 'cover', imageZoom, imagePosition }) {
  const [displayImage, setDisplayImage] = useState(previewImage || fallbackImage || '')

  useEffect(() => {
    setDisplayImage(previewImage || fallbackImage || '')
  }, [previewImage, fallbackImage])

  const optimizedImage = optimizeCloudinaryImage(displayImage, { width: 640 })

  // NEW: per-option zoom/position, with sane defaults
  const resolvedImageZoom = imageZoom ?? option.textureZoom ?? 1.4
  const resolvedImagePosition = imagePosition ?? option.texturePosition ?? '30%'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${isSelected
          ? 'border-[#d4af37] shadow-lg shadow-[#d4af37]/20 ring-2 ring-[#d4af37]/30'
          : 'border-[var(--border)] hover:border-[var(--gold-primary)]/40'
        }`}
    >
      <div className={`relative ${imageHeight} w-full overflow-hidden`}>
        {displayImage ? (
          <img
            src={optimizedImage}
            alt={option.label}
            loading="lazy"
            onError={() => {
              if (fallbackImage && displayImage !== fallbackImage) {
                setDisplayImage(fallbackImage)
                return
              }
              setDisplayImage('')
            }}
            className={`absolute inset-0 h-full w-full transition-transform duration-500 ${fit === 'contain'
                ? 'object-contain p-1.5 group-hover:scale-110'
                : 'object-cover group-hover:scale-105'
              }`}
            style={{
              objectPosition: resolvedImagePosition,
              transform: `scale(${resolvedImageZoom})`,
              transformOrigin: resolvedImagePosition,
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5" />
        )}

        {isSelected && (
          <div className="absolute inset-0 bg-[#d4af37]/20" />
        )}

        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      <div className={`border-t border-[var(--border)] p-2.5 transition-colors duration-200 ${isSelected ? 'bg-[#d4af37]/10' : 'bg-[var(--surface-elevated)]'
        }`}>
        <div className={`text-sm font-bold leading-tight tracking-tight transition-colors duration-200 ${isSelected ? 'text-[var(--text-light)]' : 'text-[var(--text-light)]'
          }`}>
          {option.label}
        </div>
        {option.note && (
          <div className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)] line-clamp-2">
            {option.note}
          </div>
        )}
        {option.price > 0 && (
          <div className={`mt-1 text-[11px] font-semibold ${isSelected ? 'text-[#d4af37]' : 'text-[#d4af37]/70'
            }`}>
            +₱{option.price.toLocaleString('en-PH')}
          </div>
        )}
      </div>

      {isSelected && (
        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#d4af37] shadow-lg">
          <Check className="h-2.5 w-2.5 text-black" />
        </div>
      )}
    </button>
  )
}

function AccordionSection({ title, icon: Icon, children, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-white/60">
          {Icon && <Icon className="h-4 w-4 text-white/40" />}
          {title}
        </span>
        <ChevronDown className={`h-4 w-4 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="border-t border-white/10 p-4 space-y-5">
          {children}
        </div>
      )}
    </div>
  )
}

function VaderWoodSubSection({ title, options, configKey, config, updateConfig, renderCard }) {
  const [isOpen, setIsOpen] = useState(false)
  const selected = options?.find((opt) => opt.value === config[configKey])
  return (
    <div className="rounded-lg border border-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 bg-white/[0.01] hover:bg-white/[0.04] transition-colors"
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
          {title}
          {selected && selected.value !== 'none' && (
            <span className="text-[10px] text-[#d4af37] font-normal normal-case tracking-normal">
              · {selected.label}
            </span>
          )}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="border-t border-white/5 p-3">
          {options?.length ? (
            <div className="grid grid-cols-2 gap-2">
              {options.map((opt) => renderCard(opt, config[configKey] === opt.value, () => updateConfig({ [configKey]: opt.value })))}
            </div>
          ) : (
            <p className="text-[11px] text-white/40">No choices available.</p>
          )}
        </div>
      )}
    </div>
  )
}

function VaderFinishSubSection({ title, options, configKey, config, updateConfig, optionsForKey, isDisabled, disabledReason }) {
  const [isOpen, setIsOpen] = useState(false)
  const selected = optionsForKey?.find((opt) => opt.value === config[configKey])
  return (
    <div className={`rounded-lg border overflow-hidden ${isDisabled ? 'border-white/5 opacity-50' : 'border-white/10'}`}>
      <button
        type="button"
        onClick={() => !isDisabled && setIsOpen((prev) => !prev)}
        disabled={isDisabled}
        className="flex w-full items-center justify-between px-3 py-2 bg-white/[0.01] hover:bg-white/[0.04] transition-colors disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
          {title}
          {selected && selected.value !== 'none' && (
            <span className="text-[10px] text-[#d4af37] font-normal normal-case tracking-normal">
              · {selected.label}
            </span>
          )}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && !isDisabled && (
        <div className="border-t border-white/5 p-3">
          {optionsForKey?.length ? (
            <div className="grid grid-cols-2 gap-2">
              {optionsForKey.map((opt) => {
                const previewImage = opt.preview || opt.texture || opt.src
                return previewImage ? (
                  <VisualCard
                    key={opt.value}
                    option={opt}
                    isSelected={config[configKey] === opt.value}
                    onClick={() => updateConfig({ [configKey]: opt.value })}
                    previewImage={previewImage}
                  />
                ) : (
                  <OptionButton
                    key={opt.value}
                    option={opt}
                    isSelected={config[configKey] === opt.value}
                    onClick={() => updateConfig({ [configKey]: opt.value })}
                  />
                )
              })}
            </div>
          ) : (
            <p className="text-[11px] text-white/40">No choices available.</p>
          )}
        </div>
      )}
      {isDisabled && disabledReason && (
        <p className="px-3 py-1.5 text-[10px] text-white/40 border-t border-white/5">
          {disabledReason}
        </p>
      )}
    </div>
  )
}

function VaderBodyAccordion({ config, updateConfig, options, isCustomBodyColor }) {
  const isFade = config.finishType === 'fade'
  const fadeDisabled = isFade && (config.topWood === 'none' || !config.neckRearFinish)

  return (
    <div className="space-y-4">
      {/* WOOD SECTION */}
      <AccordionSection title="Wood" icon={Trees} defaultOpen={true}>
        <VaderWoodSubSection
          title="Body Wood"
          options={options.bodyWoodOptions}
          configKey="bodyWood"
          config={config}
          updateConfig={updateConfig}
          renderCard={(opt, isSelected, onClick) => (
            <VisualCard
              key={opt.value}
              option={opt}
              isSelected={isSelected}
              onClick={onClick}
              previewImage={opt.preview || opt.texture || opt.src}
            />
          )}
        />
        <VaderWoodSubSection
          title="Top Wood"
          options={options.topWoodOptions}
          configKey="topWood"
          config={config}
          updateConfig={updateConfig}
          renderCard={(opt, isSelected, onClick) => (
            <VisualCard
              key={opt.value}
              option={opt}
              isSelected={isSelected}
              onClick={onClick}
              previewImage={opt.preview || opt.texture}
            />
          )}
        />
      </AccordionSection>

      {/* FINISH SECTION */}
      <AccordionSection title="Finish" icon={PaintBucket} defaultOpen={true}>
        {/* RGB Colors */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-2">RGB Colors</h3>
          <RGBColorPicker
            value={isCustomBodyColor ? config.bodyFinish : '#1A1A1A'}
            onChange={(color) => updateConfig({ bodyFinish: color })}
            label="Select Bass Body Color"
          />
          <p className="text-[11px] text-white/40 mt-2">
            Choose any custom color for your bass body using the RGB picker or enter a hex value.
          </p>
        </div>

        {/* Finish Type selector (drives which palette is shown) */}
        <VaderFinishSubSection
          title="Finish Type"
          options={options.finishTypeOptions}
          configKey="finishType"
          config={config}
          updateConfig={updateConfig}
          optionsForKey={options.finishTypeOptions}
        />

        {/* Metallic */}
        {config.finishType === 'metallic' && (
          <VaderFinishSubSection
            title="Metallic"
            options={options.finishColorOptions}
            configKey="finishColor"
            config={config}
            updateConfig={updateConfig}
            optionsForKey={options.finishColorOptions}
          />
        )}

        {/* Translucent */}
        {config.finishType === 'translucent' && (
          <VaderFinishSubSection
            title="Translucent"
            options={options.finishColorOptions}
            configKey="finishColor"
            config={config}
            updateConfig={updateConfig}
            optionsForKey={options.finishColorOptions}
          />
        )}

        {/* Sparkle */}
        {config.finishType === 'sparkle' && (
          <VaderFinishSubSection
            title="Sparkle"
            options={options.finishColorOptions}
            configKey="finishColor"
            config={config}
            updateConfig={updateConfig}
            optionsForKey={options.finishColorOptions}
          />
        )}

        {/* Fades - requires top wood + rear finish */}
        {isFade && (
          <VaderFinishSubSection
            title="Fades"
            options={options.finishColorOptions}
            configKey="finishColor"
            config={config}
            updateConfig={updateConfig}
            optionsForKey={options.finishColorOptions}
            isDisabled={fadeDisabled}
            disabledReason={
              config.topWood === 'none' && !config.neckRearFinish
                ? 'Fades require a Top Wood and a Rear Finish option.'
                : config.topWood === 'none'
                  ? 'Fades require a Top Wood to be selected.'
                  : 'Fades require a Rear Finish option to be selected.'
            }
          />
        )}
      </AccordionSection>

      {/* TOP COAT SECTION */}
      <AccordionSection title="Top Coat" icon={Sparkles} defaultOpen={true}>
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-2">Choose Top Coat</h3>
          <div className="grid grid-cols-2 gap-2">
            {options.topCoatOptions?.map((opt) => (
              <OptionButton
                key={opt.value}
                option={opt}
                isSelected={config.topCoat === opt.value}
                onClick={() => updateConfig({ topCoat: opt.value })}
              />
            ))}
          </div>
        </div>
      </AccordionSection>

      {/* ADDITIONAL FINISH OPTIONS SECTION */}
      <AccordionSection title="Additional Finish Options" icon={Zap} defaultOpen={true}>
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-2">Burst Edges</h3>
          <div className="grid grid-cols-2 gap-2">
            {options.burstEdgesOptions?.map((opt) => (
              <OptionButton
                key={opt.value}
                option={opt}
                isSelected={config.burstEdges === opt.value}
                onClick={() => updateConfig({ burstEdges: opt.value })}
              />
            ))}
          </div>
        </div>
      </AccordionSection>

      {/* 3-PIECE BODY SECTION */}
      {options.threePieceBodyOptions?.length > 0 && (
        <AccordionSection title="Additional Finish Options — 3-Piece Body" icon={ToggleRight} defaultOpen={true}>
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-2">3-Piece Body</h3>
            <div className="grid grid-cols-2 gap-2">
              {options.threePieceBodyOptions?.map((opt) => (
                <OptionButton
                  key={opt.value}
                  option={opt}
                  isSelected={config.threePieceBody === opt.value}
                  onClick={() => updateConfig({ threePieceBody: opt.value })}
                />
              ))}
            </div>
            <p className="text-[10px] text-white/40 mt-2">
              Toggle ON to render a 3-piece body striping layer over your bass body.
            </p>
          </div>
        </AccordionSection>
      )}
    </div>
  )
}

function VaderNeckSubSection({ title, configKey, config, updateConfig, options, renderCard }) {
  const [isOpen, setIsOpen] = useState(false)
  const selected = options?.find((opt) => opt.value === config[configKey])
  return (
    <div className="rounded-lg border border-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 bg-white/[0.01] hover:bg-white/[0.04] transition-colors"
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
          {title}
          {selected && (
            <span className="text-[10px] text-[#d4af37] font-normal normal-case tracking-normal">
              · {selected.label}
            </span>
          )}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="border-t border-white/5 p-3">
          {options?.length ? (
            <div className="grid grid-cols-2 gap-2">
              {options.map((opt) => renderCard(opt, config[configKey] === opt.value, () => updateConfig({ [configKey]: opt.value })))}
            </div>
          ) : (
            <p className="text-[11px] text-white/40">No choices available.</p>
          )}
        </div>
      )}
    </div>
  )
}

function NeckAccordion({ config, updateConfig, options }) {
  const isVader = config.bassType === 'vader'
  const neckGroups = options.neckWoodOptionsByGroup || { '1piece': [], '3piece': [], '5piece': [], '7piece': [] }
  const renderWoodCard = (opt, isSelected, onClick) => (
    <VisualCard
      key={opt.value}
      option={opt}
      isSelected={isSelected}
      onClick={onClick}
      previewImage={opt.preview || opt.src || opt.texture}
    />
  )
  const renderOptionCard = (opt, isSelected, onClick) => (
    <OptionButton
      key={opt.value}
      option={opt}
      isSelected={isSelected}
      onClick={onClick}
    />
  )
  const renderInlayMaterialCard = (opt, isSelected, onClick) => (
    <VisualCard
      key={opt.value}
      option={opt}
      isSelected={isSelected}
      onClick={onClick}
      previewImage={opt.preview}
      fit="contain"
    />
  )
  const renderAssetCard = (opt, isSelected, onClick) => (
    <VisualCard
      key={opt.value}
      option={opt}
      isSelected={isSelected}
      onClick={onClick}
      previewImage={opt.preview}
      fit="contain"
      imageZoom={opt.imageZoom}
      imagePosition={opt.imagePosition}
    />
  )

  const neckRearFinishGroup = [
    { value: 'none', label: 'None', note: 'No rear finish', price: 0 },
    ...(options.neckRearFinishOptions || []),
  ]

  return (
    <div className="space-y-4">
      <AccordionSection title="Neck" icon={Palette} defaultOpen={true}>
        <AccordionSection title="Neck Wood" icon={Palette} defaultOpen={false}>
          <VaderNeckSubSection
            title="1 Piece"
            options={neckGroups['1piece']}
            configKey="neck"
            config={config}
            updateConfig={updateConfig}
            renderCard={renderWoodCard}
          />
          <VaderNeckSubSection
            title="3 Piece"
            options={neckGroups['3piece']}
            configKey="neck"
            config={config}
            updateConfig={updateConfig}
            renderCard={renderWoodCard}
          />
          <VaderNeckSubSection
            title="5 Piece"
            options={neckGroups['5piece']}
            configKey="neck"
            config={config}
            updateConfig={updateConfig}
            renderCard={renderWoodCard}
          />
          <VaderNeckSubSection
            title="7 Piece"
            options={neckGroups['7piece']}
            configKey="neck"
            config={config}
            updateConfig={updateConfig}
            renderCard={renderWoodCard}
          />
        </AccordionSection>

        <VaderNeckSubSection
          title="Fingerboard Wood"
          options={options.fretboardOptions}
          configKey="fretboard"
          config={config}
          updateConfig={updateConfig}
          renderCard={renderWoodCard}
        />
        <VaderNeckSubSection
          title="Fingerboard Radius"
          options={options.fingerboardRadiusOptions}
          configKey="fingerboardRadius"
          config={config}
          updateConfig={updateConfig}
          renderCard={renderOptionCard}
        />
        <VaderNeckSubSection
          title="Inlay Shape"
          options={options.inlayShapeOptions}
          configKey="inlayShape"
          config={config}
          updateConfig={updateConfig}
          renderCard={renderOptionCard}
        />
        <VaderNeckSubSection
          title="Inlay Material"
          options={options.inlayMaterialOptions}
          configKey="inlayMaterial"
          config={config}
          updateConfig={updateConfig}
          renderCard={renderInlayMaterialCard}
        />
        <VaderNeckSubSection
          title="Frets"
          options={options.fretOptions}
          configKey="frets"
          config={config}
          updateConfig={updateConfig}
          renderCard={renderOptionCard}
        />
        <VaderNeckSubSection
          title="Neck Rear Finish"
          options={neckRearFinishGroup}
          configKey="neckRearFinish"
          config={config}
          updateConfig={updateConfig}
          renderCard={renderOptionCard}
        />
        {config.topCoat === 'tungOil' && (
          <p className="text-[10px] text-white/40 mt-2">
            Neck Rear Finish is hidden when Top Coat is Tung Oil.
          </p>
        )}
      </AccordionSection>

      {!isVader && (
        <AccordionSection title="Headstock" icon={Layers} defaultOpen={true}>
          <VaderNeckSubSection
            title="Headstock Style"
            options={options.headstockStyleOptions}
            configKey="headstockStyle"
            config={config}
            updateConfig={updateConfig}
            renderCard={renderAssetCard}
          />
          <VaderNeckSubSection
            title="Truss Rod Cover"
            options={options.trussRodCoverOptions}
            configKey="trussRodCover"
            config={config}
            updateConfig={updateConfig}
            renderCard={renderAssetCard}
          />
        </AccordionSection>
      )}
    </div>
  )
}

export function BassCustomizePage() {
  const isDesktopBuilder = useBuilderDesktop()
  const [searchParams, setSearchParams] = useSearchParams()
  const editBuildId = searchParams.get('edit')
  const [activeBuildId, setActiveBuildId] = useState(editBuildId)
  const navigate = useNavigate()

  const {
    config,
    updateConfig: baseUpdateConfig,
    resetConfig: baseResetConfig,
    price,
    summary,
    pricingBreakdown,
    exportConfig,
    loadConfig: baseLoadConfig,
    builder,
    options,
    refreshPrices,
    loadingPrices,
  } = useBassConfig()
  const [view, setView] = useState('front')
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDraggingPreview, setIsDraggingPreview] = useState(false)
  const [activeCategory, setActiveCategory] = useState('body')
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [bassTypeDropdownOpen, setBassTypeDropdownOpen] = useState(false)
  const categoryDropdownRef = useRef(null)
  const { isAuthenticated, openLogin, user } = useAuth()
  const isWalkInMode = searchParams.get('mode') === 'walk-in' && ['staff', 'admin', 'super_admin'].includes(user?.role)
  const [walkInBuild, setWalkInBuild] = useState(null)
  const savingBuildRef = useRef(false)
  const { addToCart, setIsOpen: setCartOpen } = useCart()

  const { stickers, setStickers, selectedStickerId, setSelectedStickerId } = useStickerDraft('bassBuild')

  const { savedSnapshot, setSavedSnapshot, hasUnsavedChanges, beginLoadedBuild, markDesignChanged } = useBuildSnapshot(config, stickers, 'cosmoscraft.bassBuild', editBuildId)

  // Derived: has this build ever been saved?
  const hasBeenSaved = savedSnapshot !== null

  const bypassNavigationBlockRef = useRef(false)
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [isDraggingSticker, setIsDraggingSticker] = useState(false)
  useStickerSelection(setSelectedStickerId)
  const stickerFileInputRef = useRef(null)
  const stickersRef = useRef([])
  const stickerPlacementContextRef = useRef(null)
  const panStartRef = useRef({ pointerX: 0, pointerY: 0, originX: 0, originY: 0 })
  const previewViewportRef = useRef(null)
  const previewStageRef = useRef(null)
  usePreviewWheelZoom(previewViewportRef, { zoomLevel, setZoomLevel, panOffset, setPanOffset,
    isManipulating: isDraggingSticker, isPanning: isDraggingPreview })

  const updateConfig = (patch) => { markDesignChanged(); baseUpdateConfig(patch) }
  const resetConfig = () => { markDesignChanged(); baseResetConfig() }
  const loadConfig = (raw) => { beginLoadedBuild(); baseLoadConfig(raw) }

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(2, Number((prev + 0.1).toFixed(2))))
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(0.7, Number((prev - 0.1).toFixed(2))))
  const handleZoomReset = () => {
    setZoomLevel(1)
    setPanOffset({ x: 0, y: 0 })
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setCategoryDropdownOpen(false)
        setBassTypeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedBassModel = useMemo(
    () => options.bodyOptions?.find((option) => option.value === config.bassType) || null,
    [options.bodyOptions, config.bassType]
  )
  const currentBodyMaskSrc = selectedBassModel?.bodySrc || null
  const capturePreviewImages = (designConfig = config, designStickers = stickers, captureOptions) => captureBuildViews(BassPreview, designConfig, designStickers, {
    modelImageSrc: selectedBassModel?.previewImageUrl || selectedBassModel?.bodySrc || null,
    bodyWoodImageSrc: options.bodyWoodOptions?.find(option => option.value === designConfig.bodyWood)?.preview || null,
    topWoodImageSrc: options.topWoodOptions?.find(option => option.value === designConfig.topWood)?.preview || null,
    stickerMaskSrc: currentBodyMaskSrc,
  }, captureOptions)


  const currentViewStickers = useMemo(
    () => stickers.filter((s) => (s.side || 'front') === view),
    [stickers, view]
  )
  const stickerLineItems = useMemo(
    () => stickers.map((stickerItem, index) => ({
      id: stickerItem.id,
      category: 'Stickers',
      name: `Sticker #${index + 1}`,
      unitPrice: Number.isFinite(Number(stickerItem.price)) ? Number(stickerItem.price) : DEFAULT_STICKER_PRICE,
      quantity: 1,
      subtotal: Number.isFinite(Number(stickerItem.price)) ? Number(stickerItem.price) : DEFAULT_STICKER_PRICE,
    })),
    [stickers],
  )

  const selectedSticker = useMemo(
    () => stickers.find((s) => s.id === selectedStickerId) || null,
    [stickers, selectedStickerId]
  )
  const stickerTotal = useMemo(
    () => stickerLineItems.reduce((total, item) => total + (Number(item.subtotal) || 0), 0),
    [stickerLineItems],
  )
  const totalPrice = price + stickerTotal

  const handleStickerUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (stickers.length >= MAX_STICKERS) {
      window.alert(`You can upload up to ${MAX_STICKERS} stickers.`)
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null
      if (!dataUrl) return
      void (async () => {
        const meta = await getStickerImageMeta(dataUrl)
        const stage = previewStageRef.current
        const maskSrc = stage?.querySelector('[data-sticker-clip-mask-src]')?.getAttribute('data-sticker-clip-mask-src')
        const context = maskSrc ? await buildStickerPlacementContext(stage, maskSrc) : stickerPlacementContextRef.current
        const newSticker = normalizeStickerPlacement({
          id: `sticker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          src: dataUrl,
          x: 50,
          y: 50,
          size: 18,
          rotation: 0,
          side: view,
          aspectRatio: getStickerAspectRatioFromMeta(meta),
          price: DEFAULT_STICKER_PRICE,
        }, stage, context, { autoPlaceOnBody: true })
        markDesignChanged()
        setStickers((prev) => [...prev, newSticker])
        setSelectedStickerId(newSticker.id)
      })().catch((error) => {
        console.error('Failed to measure sticker image:', error)
      })
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const updateStickerById = (id, patchOrUpdater, options = {}) => {
    if (!id) return
    markDesignChanged()
    setStickers((prev) =>
      prev.map((stickerItem) => {
        if (stickerItem.id !== id) return stickerItem
        const nextSticker = typeof patchOrUpdater === 'function'
          ? patchOrUpdater(stickerItem)
          : { ...stickerItem, ...patchOrUpdater }
        return normalizeStickerPlacement(nextSticker, previewStageRef.current, stickerPlacementContextRef.current, options)
      })
    )
  }

  const removeStickerById = (id) => {
    markDesignChanged()
    setStickers((prev) => {
      const target = prev.find((s) => s.id === id)
      if (target?.src?.startsWith('blob:')) {
        URL.revokeObjectURL(target.src)
      }
      return prev.filter((s) => s.id !== id)
    })
    setSelectedStickerId((prev) => (prev === id ? null : prev))
  }

  const clearAllStickers = () => {
    markDesignChanged()
    stickers.forEach(sticker => {
      if (sticker.src?.startsWith('blob:')) URL.revokeObjectURL(sticker.src)
    })
    setStickers([])
    setSelectedStickerId(null)
    setIsDraggingSticker(false)
  }

  const duplicateSelectedSticker = () => {
    if (!selectedSticker || (selectedSticker.side || 'front') !== view || stickers.length >= MAX_STICKERS) return
    const duplicate = normalizeStickerPlacement({
      ...selectedSticker,
      id: `sticker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      x: Math.min(95, selectedSticker.x + 4),
      y: Math.min(95, selectedSticker.y + 4),
    }, previewStageRef.current, stickerPlacementContextRef.current)
    markDesignChanged()
    setStickers((prev) => [...prev, duplicate])
    setSelectedStickerId(duplicate.id)
  }

  const moveLayer = (direction) => {
    if (!selectedStickerId) return
    markDesignChanged()
    setStickers((prev) => {
      const current = prev.filter((s) => (s.side || 'front') === view)
      const other = prev.filter((s) => (s.side || 'front') !== view)
      const idx = current.findIndex((s) => s.id === selectedStickerId)
      if (idx < 0) return prev
      if (direction === 'front' && idx < current.length - 1) {
        const [item] = current.splice(idx, 1)
        current.push(item)
      } else if (direction === 'back' && idx > 0) {
        const [item] = current.splice(idx, 1)
        current.unshift(item)
      } else if (direction === 'up' && idx < current.length - 1) {
        ;[current[idx], current[idx + 1]] = [current[idx + 1], current[idx]]
      } else if (direction === 'down' && idx > 0) {
        ;[current[idx], current[idx - 1]] = [current[idx - 1], current[idx]]
      }
      return [...other, ...current]
    })
  }

  const currentStickerOverlay = currentViewStickers.map((stickerItem, index) => (
    <StickerCanvasItem key={stickerItem.id} sticker={stickerItem} index={index}
      position={getStickerRenderPosition(stickerItem, previewStageRef.current, stickerPlacementContextRef.current)}
      selected={selectedStickerId === stickerItem.id} stageRef={previewStageRef} mirrored={false}
      onSelect={setSelectedStickerId} onUpdate={updateStickerById} onManipulating={setIsDraggingSticker} />
  ))

  const clampPan = (x, y, scale = zoomLevel) => {
    const viewport = previewViewportRef.current
    if (!viewport || scale <= 1) return { x: 0, y: 0 }
    const maxX = ((viewport.clientWidth * scale) - viewport.clientWidth) / 2
    const maxY = ((viewport.clientHeight * scale) - viewport.clientHeight) / 2
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    }
  }

  const beginDrag = (clientX, clientY) => {
    if (zoomLevel <= 1 || isDraggingSticker) return
    setIsDraggingPreview(true)
    panStartRef.current = {
      pointerX: clientX,
      pointerY: clientY,
      originX: panOffset.x,
      originY: panOffset.y,
    }
  }

  const updateDrag = (clientX, clientY) => {
    if (!isDraggingPreview || isDraggingSticker) return
    const dx = clientX - panStartRef.current.pointerX
    const dy = clientY - panStartRef.current.pointerY
    const next = clampPan(panStartRef.current.originX + dx, panStartRef.current.originY + dy)
    setPanOffset(next)
  }

  const endDrag = () => setIsDraggingPreview(false)

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && refreshPrices) {
        refreshPrices()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [refreshPrices])

  useEffect(() => {
    stickersRef.current = stickers
  }, [stickers])

  useEffect(() => {
    const missingAspectRatio = stickers.filter((stickerItem) => !Number.isFinite(stickerItem.aspectRatio) || stickerItem.aspectRatio <= 0)
    if (!missingAspectRatio.length) return undefined

    let cancelled = false
    void Promise.all(
      missingAspectRatio.map(async (stickerItem) => {
        const meta = await getStickerImageMeta(stickerItem.src)
        return {
          id: stickerItem.id,
          aspectRatio: getStickerAspectRatioFromMeta(meta),
        }
      }),
    ).then((updates) => {
      if (cancelled) return
      if (!updates.length) return
      setStickers((prev) =>
        prev.map((stickerItem) => {
          const update = updates.find((entry) => entry.id === stickerItem.id)
          return update ? { ...stickerItem, ...update } : stickerItem
        }),
      )
    }).catch((error) => {
      if (!cancelled) {
        console.warn('Failed to hydrate sticker aspect ratios:', error)
      }
    })

    return () => {
      cancelled = true
    }
  }, [stickers])

  useEffect(() => {
    let cancelled = false
    const stage = previewStageRef.current
    if (!stage || !currentBodyMaskSrc) {
      stickerPlacementContextRef.current = null
      return undefined
    }

    stickerPlacementContextRef.current = null
    const maskSrc = stage.querySelector('[data-sticker-clip-mask-src]')?.getAttribute('data-sticker-clip-mask-src') || currentBodyMaskSrc
    void buildStickerPlacementContext(stage, maskSrc)
      .then((context) => {
        if (!cancelled) {
          stickerPlacementContextRef.current = context
          setStickers((prev) =>
            prev.map((stickerItem) => (
              (stickerItem.side || 'front') === view
                ? normalizeStickerPlacement(stickerItem, previewStageRef.current, context, { preferBodyAnchor: true })
                : stickerItem
            )),
          )
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('Failed to build sticker placement context:', error)
          stickerPlacementContextRef.current = null
        }
      })

    return () => {
      cancelled = true
    }
  }, [config, currentBodyMaskSrc, view])

  useEffect(() => {
    if (config.bassType !== 'vader') return
    const bridge = config.vaderBridgePickup || 'radiumHumbucker'
    const allowedNecks = bridge === 'radiumSingle'
      ? ['radiumHumbucker', 'scpSplitCoil']
      : bridge === 'radiumHumbucker'
        ? ['radiumHumbucker']
        : bridge === 'hbAlnico'
          ? ['jvaSingleCoil']
          : bridge === 'fishmanFluence'
            ? ['fishmanFluence']
            : bridge === 'singleHbSweetSpot'
              ? ['none']
              : []

    if (!allowedNecks.includes(config.vaderNeckPickup)) {
      const fallback = allowedNecks[0] || 'none'
      updateConfig({ vaderNeckPickup: fallback })
    }
  }, [config.bassType, config.vaderBridgePickup])

  useEffect(() => {
    if (config.bassType !== 'vader') return
    const colorPickups = ['radiumHumbucker', 'radiumSingle', 'jvaSingleCoil', 'scpSplitCoil']
    const bridge = config.vaderBridgePickup || 'radiumHumbucker'
    const neck = config.vaderNeckPickup || 'none'
    const hasColor = colorPickups.includes(bridge) || colorPickups.includes(neck)
    if (!hasColor && (config.vaderPickupColor !== 'none' || config.vaderPickupColorRgb !== '#000000')) {
      updateConfig({ vaderPickupColor: 'none', vaderPickupColorRgb: '#000000' })
    }
  }, [config.bassType, config.vaderBridgePickup, config.vaderNeckPickup])

  useEffect(() => {
    setPanOffset((prev) => clampPan(prev.x, prev.y, zoomLevel))
  }, [zoomLevel])

  useEffect(() => {
    if (!stickerPlacementContextRef.current) return
    setStickers((prev) =>
      prev.map((stickerItem) => (
        (stickerItem.side || 'front') === view
          ? normalizeStickerPlacement(stickerItem, previewStageRef.current, stickerPlacementContextRef.current, { preferBodyAnchor: true })
          : stickerItem
      )),
    )
  }, [currentBodyMaskSrc, view])

  useEffect(() => {
    if (selectedStickerId && !stickers.some(s => s.id === selectedStickerId && (s.side || 'front') === view)) {
      setSelectedStickerId(null)
    }
  }, [view, stickers, selectedStickerId])

  useEffect(() => {
    return () => {
      stickersRef.current.forEach((stickerItem) => {
        if (stickerItem?.src?.startsWith('blob:')) {
          URL.revokeObjectURL(stickerItem.src)
        }
      })
    }
  }, [])


  useEffect(() => {
    if (editBuildId) {
      for (const storageKey of ['cosmoscraft_saved_bass_builds', 'cosmoscraft_saved_builds']) {
        const builds = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
        const target = builds.find(b => b.id === editBuildId)
        if (target) {
          try {
            beginLoadedBuild()
            baseLoadConfig(target.config)
            const loadedStickers = Array.isArray(target.stickers) ? target.stickers : []
            setStickers(loadedStickers)
            setActiveBuildId(target.id)
          } catch (e) {
            console.error('Failed to load build config for editing:', e)
          }
          break
        }
      }
    }
  }, [editBuildId, baseLoadConfig])

  const shouldBlockNavigation = Boolean(activeBuildId) && hasUnsavedChanges && !bypassNavigationBlockRef.current
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      shouldBlockNavigation &&
      (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  )

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowUnsavedModal(true)
    }
  }, [blocker.state])

  useEffect(() => {
    if (!shouldBlockNavigation) return
    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [shouldBlockNavigation])

  const knobOptions = useMemo(() => {
    if (!options.knobOptions) return []
    return options.knobOptions
  }, [options.knobOptions, config.bassType])

  const [toastMessage, setToastMessage] = useState(null)
  const isCustomBodyColor = typeof config.bodyFinish === 'string' && config.bodyFinish.startsWith('#')

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  const saveBuild = async ({ shouldNavigate = true, continueBlockedNavigation = false } = {}) => {
    if (savingBuildRef.current) return
    savingBuildRef.current = true
    try {
      const buildId = activeBuildId || `build-${Date.now()}`
      if (isWalkInMode) {
        setActiveBuildId(buildId)
        setWalkInBuild({ buildId, config, summary, pricingBreakdown, lineItems: configurationLineItems, stickers, price: totalPrice, continueBlockedNavigation })
        setShowUnsavedModal(false)
        return
      }

      let previewImages
      try { previewImages = await capturePreviewImages() }
      catch (error) {
        console.error('Failed to capture build previews:', error)
        setToastMessage('Unable to save the build previews. Please try again.')
        return
      }

      const build = {
        id: buildId,
        name: `${summary.body} build`,
        price,
        config,
        stickers,
        preview_image: previewImages.front,
        preview_images: previewImages,
        summary,
        savedAt: new Date().toISOString(),
      }

      let storedKey = 'cosmoscraft_saved_bass_builds'
      let stored = JSON.parse(window.localStorage.getItem(storedKey) || '[]')

      let existingIndex = stored.findIndex(b => b.id === buildId)
      if (existingIndex === -1 && window.localStorage.getItem('cosmoscraft_saved_builds')) {
        const normStored = JSON.parse(window.localStorage.getItem('cosmoscraft_saved_builds'))
        const normIndex = normStored.findIndex(b => b.id === buildId)
        if (normIndex !== -1) {
          storedKey = 'cosmoscraft_saved_builds'
          stored = normStored
          existingIndex = normIndex
        }
      }

      const totalSavedBuildCount = ['cosmoscraft_saved_builds', 'cosmoscraft_saved_bass_builds']
        .map((key) => JSON.parse(window.localStorage.getItem(key) || '[]'))
        .reduce((total, entries) => total + (Array.isArray(entries) ? entries.length : 0), 0)

      if (existingIndex === -1 && totalSavedBuildCount >= 10) {
        setToastMessage('You can only save up to 10 bass builds. Please delete an existing build before creating a new one.')
        return
      }

      const savedCustomizationId = stored[existingIndex]?.dbCustomizationId || stored[existingIndex]?.customization_id
      if (savedCustomizationId && isAuthenticated) {
        try {
          const response = await fetch(`${API}/api/guitars/my-customizations/${savedCustomizationId}`, {
            method:'PUT', credentials:'include', headers:getAuthHeaders({'Content-Type':'application/json'}),
            body:JSON.stringify({name:build.name,guitar_type:'bass',total_price:build.price,is_saved:true,
              config_json:{...config,_previewImages:previewImages},stickers,preview_image:previewImages.front}),
          })
          if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            throw new Error(error.message || 'Unable to save your bass design')
          }
        } catch (error) {
          setToastMessage(error.message)
          return
        }
      }

      if (existingIndex !== -1) {
        stored[existingIndex] = { ...stored[existingIndex], ...build }
      } else {
        stored.unshift(build)
      }

      if (stored.length > 10) stored = stored.slice(0, 10)
      window.localStorage.setItem(storedKey, JSON.stringify(stored))
      setActiveBuildId(buildId)
      if (storedKey === 'cosmoscraft_saved_bass_builds') setSavedBuilds(stored)
      try {
        const snap = JSON.stringify({ config, stickers })
        setSavedSnapshot(snap)
        window.sessionStorage.setItem('cosmoscraft.bassBuild.savedSnapshot', snap)
      } catch { }

      if (continueBlockedNavigation && blocker.state === 'blocked') {
        setShowUnsavedModal(false)
        bypassNavigationBlockRef.current = true
        blocker.proceed()
        setTimeout(() => { bypassNavigationBlockRef.current = false }, 0)
        return
      }

      if (shouldNavigate) {
        bypassNavigationBlockRef.current = true
        navigate('/dashboard', {
          state: {
            section: 'my-guitar',
            message: 'Build saved to My Bass!',
            openBuildId: buildId,
          },
        })
        setTimeout(() => { bypassNavigationBlockRef.current = false }, 0)
      } else {
        setToastMessage('Your Build is saved to My Bass!')
      }
    } finally {
      savingBuildRef.current = false
    }
  }

  const handleSave = () => {
    if (!isAuthenticated) {
      openLogin(() => saveBuild({ shouldNavigate: false }))
      return
    }
    saveBuild({ shouldNavigate: false })
  }

  const handleSaveAndLeave = () => {
    if (!isAuthenticated) {
      openLogin(() => saveBuild({ shouldNavigate: false, continueBlockedNavigation: true }))
      return
    }
    saveBuild({ shouldNavigate: false, continueBlockedNavigation: true })
  }

  const handleStayOnPage = () => {
    setShowUnsavedModal(false)
    if (blocker.state === 'blocked') {
      blocker.reset()
    }
  }

  const handleConfirmLeave = () => {
    setShowUnsavedModal(false)
    if (blocker.state === 'blocked') {
      bypassNavigationBlockRef.current = true
      blocker.proceed()
      setTimeout(() => { bypassNavigationBlockRef.current = false }, 0)
    }
  }

  const [savedBuilds, setSavedBuilds] = useState([])
  const [showLoadModal, setShowLoadModal] = useState(false)
  const previewRef = useRef(null)

  useEffect(() => {
    // Load saved builds from localStorage
    const stored = JSON.parse(window.localStorage.getItem('cosmoscraft_saved_bass_builds') || '[]')
    setSavedBuilds(stored)
  }, [])

  const handleSaveImage = async () => {
    if (!isAuthenticated) {
      openLogin(() => {
        setTimeout(() => handleSaveImage(), 100)
      })
      return
    }

    if (!previewRef.current) {
      console.error('Preview ref not found')
      return
    }

    try {
      const images = await capturePreviewImages()
      downloadPreviewImages(images, 'bass-design')
    } catch (error) {
      console.error('Failed to save image:', error)
      window.alert('Failed to save image. Please try again.')
    }
  }

  const handleLoadBuild = (buildId) => {
    const build = savedBuilds.find(b => b.id === buildId)
    if (!build) return

    const loadedStickers = Array.isArray(build.stickers) ? build.stickers : []
    loadConfig(build.config)
    setStickers(loadedStickers)
    beginLoadedBuild()
    setActiveBuildId(build.id)
    bypassNavigationBlockRef.current = true
    setSearchParams((params) => {
      params.set('edit', build.id)
      return params
    }, { replace: true })
    setTimeout(() => { bypassNavigationBlockRef.current = false }, 0)
    setShowLoadModal(false)
  }

  const handleCreateNewBuild = () => {
    resetConfig()
    setStickers([])
    setSelectedStickerId(null)
    setActiveBuildId(null)
    setSavedSnapshot(null)
    setShowLoadModal(false)
    try {
      window.sessionStorage.removeItem('cosmoscraft.bassBuild.savedSnapshot')
    } catch { }
    setSearchParams((params) => {
      params.delete('edit')
      return params
    }, { replace: true })
  }

  const handleDeleteBuild = (buildId) => {
    const updated = savedBuilds.filter(b => b.id !== buildId)
    setSavedBuilds(updated)
    window.localStorage.setItem('cosmoscraft_saved_bass_builds', JSON.stringify(updated))
  }

  const handleExportConfig = () => {
    const data = exportConfig()
    const blob = new Blob([data], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cosmoscraft-bass-${config.bassType}-${Date.now()}.json`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const handleImportConfig = () => {
    const raw = window.prompt('Paste your saved builder JSON configuration')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      loadConfig(parsed)
      window.alert('Configuration loaded successfully!')
    } catch {
      window.alert('Invalid JSON configuration. Please check and try again.')
    }
  }

  const getCategoryInfo = () => {
    const category = CATEGORIES.find(c => c.id === activeCategory)
    return category
  }

  const configurationLineItems = useMemo(
    () => buildConfigurationLineItems(summary, pricingBreakdown, BASS_CONFIGURATION_ITEMS),
    [summary, pricingBreakdown],
  )

  const optionsPanel = (
    <section aria-label="Customization options" className="builder-options-panel flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]">
      <div className="border-b border-white/10 px-4 py-4">
        <h2 className="text-lg font-semibold tracking-tight">Build Your Bass</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Select a category to customize</p>
      </div>

      <div className="p-3 flex-shrink-0" ref={categoryDropdownRef}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 border border-[var(--border)] bg-[var(--surface-elevated)]"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                backgroundColor: CATEGORIES.find(c => c.id === activeCategory)?.color + '20',
              }}
            >
              {(() => {
                const CatIcon = CATEGORIES.find(c => c.id === activeCategory)?.icon
                return CatIcon ? <CatIcon className="h-4 w-4" style={{ color: CATEGORIES.find(c => c.id === activeCategory)?.color }} /> : null
              })()}
            </div>
            <span className="text-sm font-medium text-[var(--text-light)] flex-1">
              {CATEGORIES.find(c => c.id === activeCategory)?.label}
            </span>
            <ChevronDown className={`h-4 w-4 text-[var(--text-muted)] transition-transform duration-200 ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {categoryDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-[var(--border)] rounded-xl bg-[var(--surface-elevated)] shadow-lg overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] border-b border-[var(--border)]">
                Category
              </div>
              {CATEGORIES.map((category) => {
                const Icon = category.icon
                const isActive = activeCategory === category.id

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setActiveCategory(category.id)
                      setCategoryDropdownOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-all duration-200 ${isActive
                        ? 'bg-gradient-to-r from-[#d4af37]/20 border-l-2 border-[#d4af37]'
                        : 'hover:bg-[var(--surface-dark)] border-l-2 border-transparent'
                      }`}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: isActive ? `${category.color}20` : 'var(--surface-dark)',
                      }}
                    >
                      <Icon className="h-4 w-4" style={{ color: isActive ? category.color : 'var(--text-muted)' }} />
                    </div>
                    <span className={`text-sm font-medium ${isActive ? 'text-[var(--text-light)]' : 'text-[var(--text-muted)]'}`}>
                      {category.label}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="builder-options-scroll min-h-0 flex-1 overflow-y-auto border-t border-white/10">

        {/* GENERAL OPTIONS */}
        {activeCategory === 'general' && (
          <div className="p-4 space-y-5">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Dexterity</h3>
              <div className="grid grid-cols-2 gap-2">
                {options.dexterityOptions?.map((opt) => (
                  <OptionButton
                    key={opt.value}
                    option={opt}
                    isSelected={config.dexterity === opt.value}
                    onClick={() => updateConfig({ dexterity: opt.value })}
                  />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Scale Length</h3>
              <div className="grid grid-cols-2 gap-2">
                {options.scaleLengthOptions?.map((opt) => (
                  <OptionButton
                    key={opt.value}
                    option={opt}
                    isSelected={config.scaleLength === opt.value}
                    onClick={() => updateConfig({ scaleLength: opt.value })}
                  />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Case</h3>
              <div className="grid grid-cols-2 gap-2">
                {options.caseOptions?.map((opt) => (
                  <OptionButton
                    key={opt.value}
                    option={opt}
                    isSelected={config.case === opt.value}
                    onClick={() => updateConfig({ case: opt.value })}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeCategory === 'body' && (
          <div className="p-4 space-y-5">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Bass Model</h3>
              <div className="grid grid-cols-2 gap-2">
                {options.bodyOptions?.map((opt) => (
                  <VisualCard
                    key={opt.value}
                    option={opt}
                    isSelected={config.bassType === opt.value}
                    onClick={() => updateConfig({ bassType: opt.value })}
                    previewImage={opt.previewImageUrl}
                    fallbackImage={opt.bodySrc}
                    imageHeight="h-24"
                  />
                ))}
              </div>
            </div>

            <VaderBodyAccordion
              config={config}
              updateConfig={updateConfig}
              options={options}
              isCustomBodyColor={isCustomBodyColor}
            />
          </div>
        )}

        {/* NECK OPTIONS */}
        {activeCategory === 'neck' && (
          <div className="p-4 space-y-5">
            <NeckAccordion
              config={config}
              updateConfig={updateConfig}
              options={options}
            />
          </div>
        )}

        {/* HARDWARE OPTIONS */}
        {activeCategory === 'hardware' && (
          <div className="p-4 space-y-5">
            {config.bassType !== 'vader' && (
              <>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Hardware Color</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.hardwareOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.hardware === opt.value}
                        onClick={() => updateConfig({ hardware: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Bridge</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.bridgeOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.bridge === opt.value}
                        onClick={() => updateConfig({ bridge: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                {options.pickguardOptions?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickguard</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.pickguardOptions.map((opt) => (
                        <VisualCard
                          key={opt.value}
                          option={opt}
                          isSelected={config.pickguard === opt.value}
                          onClick={() => updateConfig({ pickguard: opt.value })}
                          previewImage={opt.preview || opt.src || opt.texture}
                          fit="contain"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Control Knobs</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {knobOptions.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.knobs === opt.value}
                        onClick={() => updateConfig({ knobs: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                {options.backplateOptions?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Back Plate</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.backplateOptions.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.backplate === opt.value}
                          onClick={() => updateConfig({ backplate: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Nut</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.nutOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.nut === opt.value}
                        onClick={() => updateConfig({ nut: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Strap Buttons</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.strapButtonOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.strapButtons === opt.value}
                        onClick={() => updateConfig({ strapButtons: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                {options.tremoloCoverOptions?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Tremolo Cover</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.tremoloCoverOptions.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.tremoloCover === opt.value}
                          onClick={() => updateConfig({ tremoloCover: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {config.bassType === 'vader' && (
              <>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Hardware Color</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.vaderHardwareOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.hardware === opt.value}
                        onClick={() => updateConfig({ hardware: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Knobs</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.vaderKnobsOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.vaderKnobs === opt.value}
                        onClick={() => updateConfig({ vaderKnobs: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Strap Buttons</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.vaderStrapButtonOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.vaderStrapButtons === opt.value}
                        onClick={() => updateConfig({ vaderStrapButtons: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Electronics Cavity Cover</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.vaderElectronicsCavityCoverOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.vaderElectronicsCavityCover === opt.value}
                        onClick={() => updateConfig({ vaderElectronicsCavityCover: opt.value })}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ELECTRONICS OPTIONS */}
        {activeCategory === 'electronics' && (
          <div className="p-4 space-y-5">
            {config.bassType !== 'vader' && (
              <>
                {/* Pickup Type, Style, Config - only for non-PB/JB basses */}
                {config.bassType !== 'pb' && config.bassType !== 'jb' && (
                  <>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Type</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {options.pickupOptions?.map((opt) => (
                          <OptionButton
                            key={opt.value}
                            option={opt}
                            isSelected={config.pickups === opt.value}
                            onClick={() => updateConfig({ pickups: opt.value })}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Style</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {options.pickupTypeStyleOptions?.map((opt) => (
                          <OptionButton
                            key={opt.value}
                            option={opt}
                            isSelected={config.pickupTypeStyle === opt.value}
                            onClick={() => updateConfig({ pickupTypeStyle: opt.value })}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Configuration</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {options.pickupConfigOptions?.map((opt) => (
                          <OptionButton
                            key={opt.value}
                            option={opt}
                            isSelected={config.pickupConfig === opt.value}
                            onClick={() => updateConfig({ pickupConfig: opt.value })}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}


              </>
            )}

            {options.electronicsTypeOptions?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Electronics Type</h3>
                <div className="grid grid-cols-2 gap-2">
                  {options.electronicsTypeOptions?.map((opt) => (
                    <OptionButton
                      key={opt.value}
                      option={opt}
                      isSelected={config.electronicsType === opt.value}
                      onClick={() => updateConfig({ electronicsType: opt.value })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Three-way branch: PB, JB, Other */}
            {config.bassType === 'pb' && (
              <>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Bridge Pickup Model</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.pbBridgePickupModelOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.pbBridgePickupModel === opt.value}
                        onClick={() => updateConfig({ pbBridgePickupModel: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Neck Pickup Model</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.pbNeckPickupModelOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.pbNeckPickupModel === opt.value}
                        onClick={() => updateConfig({ pbNeckPickupModel: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Color</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.pbPickupColorOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.pbPickupColor === opt.value}
                        onClick={() => updateConfig({ pbPickupColor: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                {config.pbPickupColor === 'custom' && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup RGB Color</h3>
                    <RGBColorPicker
                      value={config.pbPickupColorRgb || '#000000'}
                      onChange={(color) => updateConfig({ pbPickupColorRgb: color })}
                      label="Select Pickup RGB Color"
                    />
                  </div>
                )}
              </>
            )}

            {config.bassType === 'jb' && (
              <>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Bridge Pickup Model</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.jbBridgePickupModelOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.jbBridgePickupModel === opt.value}
                        onClick={() => updateConfig({ jbBridgePickupModel: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Neck Pickup Model</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.jbNeckPickupModelOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.jbNeckPickupModel === opt.value}
                        onClick={() => updateConfig({ jbNeckPickupModel: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Color</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.jbPickupColorOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.jbPickupColor === opt.value}
                        onClick={() => updateConfig({ jbPickupColor: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                {config.jbPickupColor === 'custom' && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup RGB Color</h3>
                    <RGBColorPicker
                      value={config.jbPickupColorRgb || '#000000'}
                      onChange={(color) => updateConfig({ jbPickupColorRgb: color })}
                      label="Select Pickup RGB Color"
                    />
                  </div>
                )}
              </>
            )}

            {!['vader', 'pb', 'jb'].includes(config.bassType) && (
              <>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Layout</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.pickupConfigurationOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.pickupConfiguration === opt.value}
                        onClick={() => updateConfig({ pickupConfiguration: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Bridge Pickup Model</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.bridgePickupModelOptions?.map((opt) => (
                      <VisualCard
                        key={opt.value}
                        option={opt}
                        isSelected={config.bridgePickupModel === opt.value}
                        onClick={() => updateConfig({ bridgePickupModel: opt.value })}
                        previewImage={opt.texture}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Middle Pickup Model</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.middlePickupModelOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.middlePickupModel === opt.value}
                        onClick={() => updateConfig({ middlePickupModel: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Neck Pickup Model</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.neckPickupModelOptions?.map((opt) => (
                      <VisualCard
                        key={opt.value}
                        option={opt}
                        isSelected={config.neckPickupModel === opt.value}
                        onClick={() => updateConfig({ neckPickupModel: opt.value })}
                        previewImage={opt.texture}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Color</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.pickupColorOptions?.map((opt) => (
                      <VisualCard
                        key={opt.value}
                        option={opt}
                        isSelected={config.pickupColor === opt.value}
                        onClick={() => updateConfig({ pickupColor: opt.value })}
                        previewImage={opt.texture}
                      />
                    ))}
                  </div>
                </div>

                {(config.pickupColor === 'bobbins' || config.pickupColor === 'covers') && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Color Variant</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.pickupColorVariantOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.pickupColorVariant === opt.value}
                          onClick={() => updateConfig({ pickupColorVariant: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {config.pickupColor === 'painted' && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Painted Color (RGB)</h3>
                    <RGBColorPicker
                      value={config.pickupPaintedColor || '#000000'}
                      onChange={(color) => updateConfig({ pickupPaintedColor: color })}
                      label="Select Pickup Paint"
                    />
                  </div>
                )}

                {config.pickupColor === 'wooden' && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Wood Type</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.pickupWoodTypeOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.pickupWoodType === opt.value}
                          onClick={() => updateConfig({ pickupWoodType: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pole Piece Color</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.pickupPoleColorOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.pickupPoleColor === opt.value}
                        onClick={() => updateConfig({ pickupPoleColor: opt.value })}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Controls</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.controlsOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.controls === opt.value}
                        onClick={() => updateConfig({ controls: opt.value })}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {config.bassType === 'vader' && (
              <>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Model</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {options.vaderBridgePickupOptions?.map((opt) => (
                      <OptionButton
                        key={opt.value}
                        option={opt}
                        isSelected={config.vaderBridgePickup === opt.value}
                        onClick={() => {
                          const neckMap = {
                            radiumHumbucker: 'radiumHumbucker',
                            radiumSingle: 'radiumHumbucker',
                            singleHbSweetSpot: 'none',
                            hbAlnico: 'jvaSingleCoil',
                            fishmanFluence: 'fishmanFluence',
                          }
                          updateConfig({
                            vaderBridgePickup: opt.value,
                            vaderNeckPickup: neckMap[opt.value] || config.vaderNeckPickup,
                          })
                        }}
                      />
                    ))}
                  </div>
                </div>

                {config.vaderBridgePickup !== 'singleHbSweetSpot' && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Neck Pickup</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.vaderNeckPickupOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.vaderNeckPickup === opt.value}
                          onClick={() => updateConfig({ vaderNeckPickup: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {(config.vaderBridgePickup === 'radiumHumbucker' || config.vaderBridgePickup === 'radiumSingle' || config.vaderNeckPickup === 'radiumHumbucker' || config.vaderNeckPickup === 'scpSplitCoil' || config.vaderNeckPickup === 'jvaSingleCoil') && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup Color</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {options.vaderPickupColorOptions?.map((opt) => (
                        <OptionButton
                          key={opt.value}
                          option={opt}
                          isSelected={config.vaderPickupColor === opt.value}
                          onClick={() => updateConfig({ vaderPickupColor: opt.value })}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {config.vaderPickupColor === 'custom' && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-2">Pickup RGB Color</h3>
                    <RGBColorPicker
                      value={config.vaderPickupColorRgb || '#000000'}
                      onChange={(color) => updateConfig({ vaderPickupColorRgb: color })}
                      label="Select Pickup RGB Color"
                    />
                  </div>
                )}
              </>
            )}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#14b8a6]/10">
                  <Info className="h-4 w-4 text-[#14b8a6]" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-white/60">
                    About Bass Pickups</h4>
                  <p className="mt-1 text-xs text-white/40 leading-relaxed">
                    <strong>Split:</strong> Noise-free modern pickup<br />
                    <strong>Single:</strong> Classic vintage tone<br />
                    <strong>Humbucker:</strong> Warm, high output<br />
                    <strong>Active:</strong> Preamp equipped for more power
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </section>
  )

  const summaryPanel = (
    <section aria-label="Build summary" className="builder-summary-panel flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)]">
      <div className="border-b border-white/10 px-5 py-4 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs text-[#d4af37]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Currently Editing</span>
        </div>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">
          {getCategoryInfo()?.label || 'Select a Category'}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          {getCategoryInfo()?.tooltip || 'Choose from the left panel'}
        </p>
      </div>

      <div className="builder-summary-scroll min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
        <BuilderConfigurationPanel
          lineItems={configurationLineItems}
          configurationTotal={price}
          loadingPrices={loadingPrices}
        />
      </div>

      <BuilderCheckoutSection
        price={price}
        basePrice={options.basePrice}
      />

      <div className="border-t border-white/10 p-4 flex-shrink-0">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#d4af37]/10">
              <Info className="h-4 w-4 text-[#d4af37]" />
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-white/60">
                Need Help?
              </h4>
              <p className="mt-1 text-xs text-white/40 leading-relaxed">
                Each option is carefully crafted to deliver premium quality. Hover over category names for more details, or{' '}
                <a
                  href="https://www.facebook.com/messages/t/CosmosGuitars"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#d4af37] hover:text-[#ffe270] transition-colors"
                >
                  contact our support team
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>

    </section>
  )

  return (
    <div className="builder-page relative flex min-h-screen flex-col bg-[var(--bg-primary)] pt-16 text-[var(--text-light)] 2xl:h-screen 2xl:overflow-hidden">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] px-6 py-3 rounded-xl font-bold shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center gap-2"
          >
            <CheckCircle className="h-5 w-5 shrink-0" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="builder-workspace mx-auto flex min-h-0 w-full max-w-[2000px] flex-1 flex-col px-3 py-3 sm:px-4 lg:px-6 lg:pb-6">

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 2xl:grid-cols-[340px_minmax(0,1fr)_400px]">

          {/* LEFT PANEL - Configuration Categories */}
          {isDesktopBuilder && (
            <aside aria-label="Customization options" className="hidden min-h-0 min-w-0 flex-col 2xl:flex">
              {optionsPanel}
            </aside>
          )}


          {/* CENTER - Bass Preview */}
          <main aria-label="Instrument preview" className="relative flex min-h-0 min-w-0 flex-col 2xl:overflow-y-auto">
            {!isDesktopBuilder && <BuilderConfiguratorDrawer optionsPanel={optionsPanel} summaryPanel={summaryPanel} price={price} loadingPrices={loadingPrices} />}
            <div ref={previewRef} data-builder-preview-card className="builder-preview-card relative h-[320px] min-h-[320px] shrink-0 rounded-2xl sm:h-[380px] md:h-auto md:flex-1 md:min-h-[380px] 2xl:min-h-[320px] border border-white/10 bg-black overflow-hidden">


              <div
                ref={previewViewportRef}
                className={`builder-preview-viewport relative flex h-full items-center justify-center px-3 py-16 sm:px-6 ${zoomLevel > 1 ? 'cursor-grab' : 'cursor-default'} ${isDraggingPreview ? 'cursor-grabbing' : ''}`}
                style={{ containerType: 'size', touchAction: zoomLevel > 1 ? 'none' : 'pan-y' }}
                onMouseDown={(e) => beginDrag(e.clientX, e.clientY)}
                onMouseMove={(e) => {
                  updateDrag(e.clientX, e.clientY)
                }}
                onMouseUp={() => {
                  endDrag()
                }}
                onMouseLeave={() => {
                  endDrag()
                }}
                onTouchStart={(e) => {
                  const touch = e.touches[0]
                  if (!touch) return
                  beginDrag(touch.clientX, touch.clientY)
                }}
                onTouchMove={(e) => {
                  const touch = e.touches[0]
                  if (!touch) return
                  updateDrag(touch.clientX, touch.clientY)
                }}
                onTouchEnd={() => {
                  endDrag()
                }}
                onTouchCancel={() => {
                  endDrag()
                }}
              >
                <div
                  className="builder-preview-stage relative w-full max-w-[1100px] transition-transform duration-200 ease-out"
                  style={{
                    maxWidth: 'min(1100px, calc(100cqh * 16 / 7))',
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    willChange: 'transform',
                  }}
                >
                  <BassPreview
                    config={config}
                    view={view}
                    onViewChange={setView}
                    modelImageSrc={selectedBassModel?.previewImageUrl || selectedBassModel?.bodySrc || null}
                    bodyWoodImageSrc={options.bodyWoodOptions?.find((option) => option.value === config.bodyWood)?.preview || null}
                    topWoodImageSrc={options.topWoodOptions?.find((option) => option.value === config.topWood)?.preview || null}
                    stickerOverlay={currentStickerOverlay}
                    stickerMaskSrc={selectedBassModel?.bodySrc || null}
                    stageRef={previewStageRef}
                  />
                </div>
              </div>


              <PreviewViewControls view={view} onViewChange={setView} />
              <PreviewZoomControls zoomLevel={zoomLevel} onZoomOut={handleZoomOut}
                onZoomIn={handleZoomIn} onReset={handleZoomReset} />

              {/* Saved status */}
              <div className="builder-preview-status">
                <BuilderSavedBadge
                  hasUnsavedChanges={hasUnsavedChanges}
                  hasBeenSaved={hasBeenSaved && isAuthenticated}
                  isAuthenticated={isAuthenticated}
                />
              </div>

            </div>

            <input
              ref={stickerFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleStickerUpload}
              className="hidden"
            />

            <StickerPanel
              stickerCount={stickers.length}
              maxStickers={MAX_STICKERS}
              onAddClick={() => stickerFileInputRef.current?.click()}
              addDisabled={stickers.length >= MAX_STICKERS}
              stickers={currentViewStickers}
              selectedStickerId={selectedStickerId}
              onSelect={setSelectedStickerId}
              onDuplicate={duplicateSelectedSticker}
              onDelete={() => selectedStickerId && removeStickerById(selectedStickerId)}
              onMoveLayer={moveLayer}
              onClearAll={clearAllStickers}
            />

            <BuilderActionBar
              onReset={resetConfig}
              onSave={handleSave}
              onLoad={() => setShowLoadModal(true)}
              loadLabel={savedBuilds.length > 0 ? `Load Build (${savedBuilds.length})` : 'Load Build'}
            />
            <button
              type="button"
              onClick={handleSaveImage}
              className="builder-export-button mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:text-[var(--text-muted)]"
            >
              <Image className="h-3.5 w-3.5" />
              Save preview image
            </button>
          </main>

          {/* RIGHT PANEL - Summary & Actions */}
          {isDesktopBuilder && (
            <aside aria-label="Build summary" className="hidden min-h-0 min-w-0 flex-col 2xl:flex">
              {summaryPanel}
            </aside>
          )}
        </div>
      </div>

      {/* Load Builds Modal */}
      {isWalkInMode && walkInBuild && (
        <WalkInAssignmentModal
          key={walkInBuild.buildId}
          {...walkInBuild}
          storageScope={walkInBuild.buildId}
          guitarType="bass" previewRef={previewRef} capturePreviewImages={capturePreviewImages} loadingPrices={loadingPrices}
          onClose={() => {
            if (walkInBuild.continueBlockedNavigation && blocker.state === 'blocked') setShowUnsavedModal(true)
            setWalkInBuild(null)
          }} onNewBuild={handleCreateNewBuild}
          onAssigned={(customer, sentDesign) => {
            setSavedSnapshot(JSON.stringify({ config: sentDesign.config_json, stickers: sentDesign.stickers }))
            if (walkInBuild.continueBlockedNavigation && blocker.state === 'blocked') {
              bypassNavigationBlockRef.current = true
              blocker.proceed()
              setTimeout(() => { bypassNavigationBlockRef.current = false }, 0)
            }
            setWalkInBuild(null)
            setToastMessage(`Build successfully sent to ${[customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email}!`)
          }}
        />
      )}

      {showLoadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="relative max-w-2xl w-full max-h-[80vh] overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg-primary)] shadow-2xl flex flex-col">
            {/* Header */}
            <div className="border-b border-white/10 px-6 py-4 flex-shrink-0">
              <h3 className="text-lg font-semibold">Load Saved Build</h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Select a previous build to continue editing</p>
            </div>

            {/* Builds List */}
            <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3 sm:p-6">
              {savedBuilds.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-white/50">
                  <p>No saved builds yet. Create one using the Save Build button!</p>
                </div>
              ) : (
                savedBuilds.map((build) => {
                  const savedDate = build.savedAt || build.createdAt
                  const buildPrice = Number(build.price) || 0

                  return (
                    <div
                      key={build.id}
                      className="group relative rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors duration-200 cursor-pointer"
                      onClick={() => handleLoadBuild(build.id)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{build.name}</h4>
                          <div className="mt-1 space-y-1 text-xs text-[var(--text-muted)]">
                            <p>{build.config?.bassType || 'Bass'} / {build.config?.bodyWood || 'Custom body'} / {build.config?.pickups || 'Custom pickups'}</p>
                            {savedDate && <p>Saved: {new Date(savedDate).toLocaleDateString('en-PH')}</p>}
                          </div>
                          <div className="mt-2 text-sm font-semibold text-[#d4af37]">
                            ₱{buildPrice.toLocaleString('en-PH')}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteBuild(build.id)
                          }}
                          className="flex-shrink-0 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-medium text-red-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/10 px-6 py-4 flex-shrink-0 flex gap-2">
              <button
                type="button"
                onClick={handleCreateNewBuild}
                className="min-w-0 flex-1 rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-4 py-2.5 text-sm font-semibold text-[var(--text-dark)] transition-all hover:brightness-110"
              >
                Create New Build
              </button>
              <button
                type="button"
                onClick={() => setShowLoadModal(false)}
                className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-[var(--surface-dark)]"
                style={{ color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="builder-disclaimer shrink-0 px-4 pb-3 text-center text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
        Graphic representation only. Actual product may differ.
      </p>

      {showUnsavedModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
            <h3 className="text-lg font-bold text-white mb-2">Unsaved Changes</h3>
            <p className="text-sm text-[var(--text-muted)]">
              You have unsaved changes. Please save your build before leaving this page.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleStayOnPage}
                className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSaveAndLeave()
                }}
                className="min-w-0 flex-1 rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-4 py-2.5 text-sm font-bold text-[var(--text-dark)]"
              >
                Save Build
              </button>
              <button
                type="button"
                onClick={handleConfirmLeave}
                className="min-w-0 flex-1 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/20 transition-colors"
              >
                Leave Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BassCustomizePage
