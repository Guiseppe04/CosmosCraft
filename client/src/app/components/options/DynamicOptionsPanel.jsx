/**
 * DynamicOptionsPanel
 *
 * Automatically generates buttons, selectors, and option groups
 * based on the available assets and configuration data.
 *
 * No hardcoded buttons — everything is driven by the configurator schema.
 */

import { useMemo } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import {
  OPTION_FIELDS,
  getFieldOptions,
  isFieldVisible,
  CATEGORIES,
  getModelLabel,
} from '../../lib/configuratorSchema'
import { resolveOptionPreview } from '../../lib/assetResolver'

// ============================================================
// Reusable Option Components
// ============================================================

function TextOptionButton({ option, isSelected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full rounded-xl border p-3.5 text-left transition-all duration-200 ${
        isSelected
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
        <div
          className={`text-[15px] font-bold leading-tight tracking-tight transition-colors duration-200 ${
            isSelected
              ? 'text-[var(--text-light)]'
              : 'text-[var(--text-light)] group-hover:text-white'
          }`}
        >
          {option.label}
        </div>
        {option.note && (
          <div className="text-[11px] leading-relaxed text-[var(--text-muted)] line-clamp-2">
            {option.note}
          </div>
        )}
        {option.price > 0 && (
          <div
            className={`text-[11px] font-semibold ${
              isSelected ? 'text-[#d4af37]' : 'text-[#d4af37]/70'
            }`}
          >
            +₱{option.price.toLocaleString('en-PH')}
          </div>
        )}
      </div>
    </button>
  )
}

function ImageOptionButton({ option, isSelected, onClick, previewImage, hasImage }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${
        isSelected
          ? 'border-[#d4af37] shadow-lg shadow-[#d4af37]/20 ring-2 ring-[#d4af37]/30'
          : 'border-[var(--border)] hover:border-[var(--gold-primary)]/40'
      }`}
    >
      {/* Preview image */}
      <div className="relative h-16 w-full overflow-hidden">
        {hasImage && previewImage ? (
          <img
            src={previewImage}
            alt={option.label}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              // Hide the image on error, show fallback gradient
              e.target.style.display = 'none'
              e.target.nextSibling && (e.target.nextSibling.style.display = 'flex')
            }}
          />
        ) : null}
        <div
          className={`absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 ${
            hasImage && previewImage ? 'hidden' : 'flex items-center justify-center'
          }`}
        >
          <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
            {option.label?.charAt(0) || '?'}
          </span>
        </div>
        {isSelected && <div className="absolute inset-0 bg-[#d4af37]/20" />}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Content */}
      <div
        className={`border-t border-[var(--border)] p-2.5 transition-colors duration-200 ${
          isSelected ? 'bg-[#d4af37]/10' : 'bg-[var(--surface-elevated)]'
        }`}
      >
        <div className="text-sm font-bold leading-tight tracking-tight text-[var(--text-light)]">
          {option.label}
        </div>
        {option.note && (
          <div className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)] line-clamp-2">
            {option.note}
          </div>
        )}
        {option.price > 0 && (
          <div
            className={`mt-1 text-[11px] font-semibold ${
              isSelected ? 'text-[#d4af37]' : 'text-[#d4af37]/70'
            }`}
          >
            +₱{option.price.toLocaleString('en-PH')}
          </div>
        )}
      </div>

      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#d4af37] shadow-lg">
          <Check className="h-2.5 w-2.5 text-black" />
        </div>
      )}
    </button>
  )
}

// ============================================================
// Dynamic Option Field Renderer
// ============================================================

function DynamicOptionField({ field, config, onUpdate, category, model }) {
  const options = useMemo(
    () => getFieldOptions(field, config, category, model),
    [field, config, category, model]
  )

  const currentValue = config[field.key]

  const getPreviewImage = (optionValue) => {
    if (optionValue === 'none' && field.key === 'topWood') return null
    if (typeof field.previewResolver === 'function') {
      return field.previewResolver(category, model, optionValue, config)
    }
    return resolveOptionPreview(category, model, field.key, optionValue)
  }

  // Image-select: Show thumbnails
  if (field.type === 'image-select') {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
          {field.label}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {options.map((option) => {
            const previewImage = getPreviewImage(option.value)
            const hasImage = Boolean(previewImage) && !option.noImage
            return (
              <ImageOptionButton
                key={option.value}
                option={option}
                isSelected={currentValue === option.value}
                onClick={() => onUpdate({ [field.key]: option.value })}
                previewImage={previewImage}
                hasImage={hasImage}
              />
            )
          })}
        </div>
      </div>
    )
  }

  // Select/Text: Show text buttons in a grid
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
        {field.label}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <TextOptionButton
            key={option.value}
            option={option}
            isSelected={currentValue === option.value}
            onClick={() => onUpdate({ [field.key]: option.value })}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Model Selector (for switching between models)
// ============================================================

function ModelSelector({ category, currentModel, onModelChange }) {
  const models = CATEGORIES[category]?.models
  if (!models) return null

  const modelKeys = Object.keys(models)

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
        Model
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {modelKeys.map((modelKey) => {
          const model = models[modelKey]
          return (
            <TextOptionButton
              key={modelKey}
              option={{
                value: modelKey,
                label: model.label,
                note: model.note,
                price: 0,
              }}
              isSelected={currentModel === modelKey}
              onClick={() => onModelChange(modelKey)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// Section Renderer
// ============================================================

function DynamicSection({ section, fields, config, onUpdate, category, model }) {
  const visibleFields = fields.filter((field) => isFieldVisible(field, config))

  if (visibleFields.length === 0) return null

  return (
    <div className="p-4 space-y-5">
      {visibleFields.map((field) => (
        <DynamicOptionField
          key={field.key}
          field={field}
          config={config}
          onUpdate={onUpdate}
          category={category}
          model={model}
        />
      ))}
    </div>
  )
}

// ============================================================
// Main Dynamic Panel
// ============================================================

export default function DynamicOptionsPanel({
  category,
  model,
  config,
  onUpdateConfig,
  onModelChange,
  activeSection,
}) {
  const fields = useMemo(() => {
    const sectionFields = OPTION_FIELDS.filter(
      (f) => f.section === activeSection
    )
    return sectionFields.filter((field) => isFieldVisible(field, config))
  }, [activeSection, config])

  const isGeneralSection = activeSection === 'General'
  const hasVisibleFields = fields.length > 0 && fields.some((f) => isFieldVisible(f, config))

  if (!hasVisibleFields && !isGeneralSection) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-white/30">
        No options available for this section
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* Model selector is always shown in General section */}
      {isGeneralSection && (
        <div className="p-4 space-y-5 border-b border-white/5">
          <ModelSelector
            category={category}
            currentModel={model}
            onModelChange={onModelChange}
          />
        </div>
      )}

      {/* All other options for this section */}
      <DynamicSection
        section={activeSection}
        fields={fields}
        config={config}
        onUpdate={onUpdateConfig}
        category={category}
        model={model}
      />
    </div>
  )
}