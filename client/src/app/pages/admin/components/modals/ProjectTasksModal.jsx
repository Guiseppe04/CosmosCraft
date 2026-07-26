import { motion } from 'motion/react'
import ProjectTaskTracker from '../../../../components/projects/ProjectTaskTracker'
import { ModalHeader } from '../shared/ModalHeader'

export function ProjectTasksModal({ modal, closeModal, visibleParts }) {
  if (!modal.data) return null

  return (
    <>
      <ModalHeader title="Project Tasks & Parts" onClose={closeModal} />
      <div className="mt-6">
        <ProjectTaskTracker
          projectId={modal.data.project_id}
          projectName={modal.data.name || modal.data.title}
          isAdmin={true}
          parts={visibleParts}
          projectData={modal.data}
        />
      </div>
    </>
  )
}
