import React from 'react'
import AppointmentDetailsModal from './AppointmentDetailsModal'

/**
 * AppointmentModal - Canonical Appointment Details View
 * Standardized across Calendar, Table, Admin, and Staff views.
 */
export default function AppointmentModal({
  isOpen,
  show,
  onClose,
  appointment,
  onStatusChange,
  onCancel,
  onPaymentStatusUpdate,
  ...rest
}) {
  return (
    <AppointmentDetailsModal
      show={show ?? isOpen}
      onClose={onClose}
      appointment={appointment}
      onStatusChange={onStatusChange}
      onCancel={onCancel}
      onPaymentStatusUpdate={onPaymentStatusUpdate}
      {...rest}
    />
  )
}
