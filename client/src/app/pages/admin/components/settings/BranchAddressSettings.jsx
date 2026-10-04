import { useState } from 'react'
import { MapPin, Pencil, ArrowLeft, Loader2 } from 'lucide-react'
import { AddressForm } from '../../../../components/AddressForm'
import { useBranchSettings } from '../../../../hooks/useBranchSettings'
import { DEFAULT_APPOINTMENT_BRANCH, publishBranchSettings, refreshBranchSettings } from '../../../../utils/branchSettings'
import { adminApi } from '../../../../utils/adminApi'

function getInitialAddress(branch) {
  if (branch.address_details) return branch.address_details
  // Offer the former local address for review; never publish it automatically.
  let legacyAddress
  try { legacyAddress = JSON.parse(window.localStorage.getItem('cosmoscraft.appointment.branch'))?.address }
  catch { /* Invalid legacy browser settings can be ignored. */ }
  const address = legacyAddress || branch.address
  return address === DEFAULT_APPOINTMENT_BRANCH.address
    ? { country: 'PH', streetLine1: 'Sp 047-K St Peter Compound', stateProvince: 'Bulacan', city: 'Balagtas', postalZipCode: '3016' }
    : { country: 'PH', streetLine1: address }
}

export function BranchAddressSettings({ showToast }) {
  const { branch, isLoading, error } = useBranchSettings()
  const [isEditing, setIsEditing] = useState(false)
  const [initialAddress, setInitialAddress] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const cancelEditing = () => {
    if (isSaving) return
    setIsEditing(false)
    setSaveError('')
  }

  const saveAddress = async (address) => {
    if (isSaving) return
    setIsSaving(true)
    setSaveError('')
    try {
      const response = await adminApi.updateBranchSettings(address)
      publishBranchSettings(response.data)
      setIsEditing(false)
      showToast?.('Branch address saved for all customers')
    } catch (error) {
      setSaveError(error.message || 'Failed to save branch address.')
    } finally { setIsSaving(false) }
  }

  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
      <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
        <MapPin className="w-5 h-5 text-[var(--gold-primary)]" />
        Appointment Branch
      </h3>
      <p className="text-sm text-[var(--text-muted)] mb-4">
        This address is shown to all customers for appointments and project pickups.
      </p>
      {isLoading && <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Loading branch address...</p>}
      {error && <div className="mb-4 text-sm text-red-400" role="alert">
        {error}
        <button type="button" onClick={refreshBranchSettings} className="ml-2 underline">Retry</button>
      </div>}
      {isEditing ? (
        <div className="space-y-4 max-w-xl">
          <div className="flex items-center gap-2 mb-4">
            <button type="button" onClick={cancelEditing} disabled={isSaving} className="text-[var(--gold-primary)] hover:underline text-sm font-semibold flex items-center gap-1 disabled:opacity-50">
              <ArrowLeft className="h-4 w-4" />Back
            </button>
            <span className="text-white font-semibold">Edit Branch Address</span>
          </div>
          <AddressForm
            initialAddress={initialAddress}
            onSubmit={saveAddress}
            onCancel={cancelEditing}
            showCategory={false}
            showDefault={false}
            submitLabel="Save Branch Address"
            isSubmitting={isSaving}
          />
          {saveError && <p role="alert" className="text-sm text-red-400">{saveError}</p>}
        </div>
      ) : !isLoading && (
        <div className="rounded-xl border border-[var(--border)] p-4">
          <p className="text-sm font-semibold text-[var(--text-light)]">{branch.name}</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{branch.address}</p>
          <button type="button" disabled={Boolean(error)} onClick={() => {
            setInitialAddress(getInitialAddress(branch))
            setIsEditing(true)
          }} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--gold-primary)] hover:underline disabled:opacity-50">
            <Pencil className="h-4 w-4" />Edit Branch Address
          </button>
        </div>
      )}
    </div>
  )
}
