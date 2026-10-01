import { useEffect, useState } from 'react'
import ProjectTaskTracker from '../../../../components/projects/ProjectTaskTracker'
import GuitarPreview from '../../../../components/guitar/GuitarPreview'
import BassPreview from '../../../../components/bass/BassPreview'
import { DEFAULT_CONFIG } from '../../../../lib/guitarBuilderData.js'
import { BASS_DEFAULT_CONFIG } from '../../../../lib/bassBuilderData.js'
import { BASE_STICKER_Z_INDEX } from '../../../../utils/stickerPlacement.js'
import { adminApi } from '../../../../utils/adminApi'
import { ModalHeader } from '../shared/ModalHeader'

export function ProjectTasksModal({ modal, closeModal, visibleParts }) {
  const [selectedBuildId, setSelectedBuildId] = useState('')
  const [projectDetails, setProjectDetails] = useState(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState('')

  useEffect(() => {
    const projectId = modal.data?.project_id
    if (!projectId) return undefined

    let cancelled = false
    setProjectDetails(null)
    setDetailsError('')
    setIsLoadingDetails(true)

    adminApi.getProject(projectId)
      .then((response) => {
        if (!cancelled) setProjectDetails(response?.data || response)
      })
      .catch((error) => {
        if (!cancelled) setDetailsError(error.message || 'Unable to load the customer build.')
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetails(false)
      })

    return () => { cancelled = true }
  }, [modal.data?.project_id])

  if (!modal.data) return null

  const projectData = projectDetails?.project_id === modal.data.project_id
    ? { ...modal.data, ...projectDetails }
    : modal.data
  const customizations = Array.isArray(projectData.customizations) ? projectData.customizations : []
  const selectedBuild = customizations.find((build) => build.customization_id === selectedBuildId) || customizations[0]
  let savedConfig = selectedBuild?.config_json
  if (typeof savedConfig === 'string') {
    try {
      savedConfig = JSON.parse(savedConfig)
    } catch {
      savedConfig = null
    }
  }
  const isBass = String(selectedBuild?.guitar_type || projectData.guitar_type || '').toLowerCase().includes('bass')
  const previewConfig = {
    ...(isBass ? BASS_DEFAULT_CONFIG : DEFAULT_CONFIG),
    ...(savedConfig && typeof savedConfig === 'object' ? savedConfig : {}),
  }
  const stickers = Array.isArray(selectedBuild?.stickers) ? selectedBuild.stickers : []
  const renderStickerOverlay = (side) => stickers
    .filter((sticker) => (sticker.side || 'front') === side && typeof sticker.src === 'string' && sticker.src)
    .map((sticker, index) => (
      <img
        key={sticker.id || `${side}-${index}`}
        src={sticker.src}
        alt={`Customer sticker ${index + 1}`}
        data-export-sticker="true"
        data-sticker-x={sticker.x}
        data-sticker-y={sticker.y}
        data-sticker-size={sticker.size}
        data-sticker-rotation={sticker.rotation || 0}
        className="absolute select-none"
        draggable={false}
        style={{
          zIndex: BASE_STICKER_Z_INDEX + index,
          left: `${Number(sticker.x) || 0}%`,
          top: `${Number(sticker.y) || 0}%`,
          width: `${Number(sticker.size) || 18}%`,
          transform: `translate(-50%, -50%) rotate(${Number(sticker.rotation) || 0}deg)`,
          transformOrigin: 'center center',
          pointerEvents: 'none',
        }}
      />
    ))

  return (
    <>
      <ModalHeader title="Project Tasks & Parts" onClose={closeModal} />
      <div className="mt-6">
        {isLoadingDetails && customizations.length === 0 && (
          <p className="mb-4 text-sm text-[var(--text-muted)]" role="status">Loading customer build...</p>
        )}
        {!isLoadingDetails && detailsError && customizations.length === 0 && (
          <p className="mb-4 text-sm text-red-400" role="alert">Could not load the customer build: {detailsError}</p>
        )}
        {customizations.length > 0 && (
          <section className="mb-6 border-b border-[var(--border)] pb-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">Customer Build</h3>
                <p className="text-xs text-[var(--text-muted)]">Front and rear design, including uploaded stickers</p>
              </div>
              {customizations.length > 1 && (
                <select
                  value={selectedBuild?.customization_id || ''}
                  onChange={(event) => setSelectedBuildId(event.target.value)}
                  aria-label="Select customer build"
                  className="max-w-full rounded-md border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2 text-sm text-white"
                >
                  {customizations.map((build, index) => (
                    <option key={build.customization_id} value={build.customization_id}>
                      {build.name || build.body_model || `${build.guitar_type || 'Guitar'} build ${index + 1}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {['front', 'rear'].map((side) => {
                const Preview = isBass ? BassPreview : GuitarPreview
                return (
                  <div key={side} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-primary)]">
                    <h4 className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase text-[var(--text-muted)]">
                      {side === 'front' ? 'Front' : 'Rear'} View
                    </h4>
                    <div className="px-2">
                      <Preview
                        config={previewConfig}
                        view={side}
                        stickerOverlay={renderStickerOverlay(side)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-white">Customer Sticker Images</h4>
                <span className="text-xs text-[var(--text-muted)]">{stickers.length} uploaded</span>
              </div>
              {stickers.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {stickers.map((sticker, index) => (
                    <figure key={sticker.id || `sticker-image-${index}`} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-primary)]">
                      <div className="flex aspect-square items-center justify-center p-3">
                        <img
                          src={sticker.src}
                          alt={`Uploaded customer sticker ${index + 1}`}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <figcaption className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">
                        Sticker {index + 1} · {(sticker.side || 'front') === 'rear' ? 'Rear' : 'Front'} placement
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No sticker images were uploaded for this build.</p>
              )}
            </div>
          </section>
        )}
        <ProjectTaskTracker
          projectId={projectData.project_id}
          projectName={projectData.name || projectData.title}
          isAdmin={true}
          parts={visibleParts}
          projectData={projectData}
        />
      </div>
    </>
  )
}
