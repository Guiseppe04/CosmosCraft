import { useState } from 'react'
import { MapPin, Pencil, Plus, ArrowLeft, Loader2 } from 'lucide-react'
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
  const { branch, branches = [branch], isLoading, error } = useBranchSettings()
  const [isEditing, setIsEditing] = useState(false)
  const [initialAddress, setInitialAddress] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [editingBranch, setEditingBranch] = useState(null)
  const [branchName, setBranchName] = useState('')
  const [branchHours, setBranchHours] = useState(DEFAULT_APPOINTMENT_BRANCH.hours)

  const cancelEditing = () => {
    if (isSaving) return
    setIsEditing(false)
    setSaveError('')
  }

  const saveAddress = async (address) => {
    if (isSaving) return
    if (editingBranch?.id !== DEFAULT_APPOINTMENT_BRANCH.id && (branchName.trim().length < 2 || branchHours.trim().length < 2)) {
      setSaveError('Enter a branch name and opening hours (at least 2 characters each).')
      return
    }
    setIsSaving(true)
    setSaveError('')
    try {
      const profile = { name: branchName, hours: branchHours, address_details: address }
      const response = !editingBranch
        ? await adminApi.addBranchLocation(profile)
        : editingBranch.id === DEFAULT_APPOINTMENT_BRANCH.id
          ? await adminApi.updateBranchSettings(address)
          : await adminApi.updateBranchLocation(editingBranch.id, profile)
      publishBranchSettings(response.data)
      setIsEditing(false)
      showToast?.(editingBranch ? 'Branch address saved for all customers' : 'New branch added for customer bookings')
    } catch (error) {
      setSaveError(error.message || 'Failed to save branch address.')
    } finally { setIsSaving(false) }
  }

  return (
    <section className="admin-settings-card">
      <div className="admin-settings-heading">
        <span className="admin-settings-icon"><MapPin /></span>
        <div>
          <h3 className="admin-settings-title">Appointment branch</h3>
          <p className="admin-settings-description">Shown to customers for appointments and pickups.</p>
        </div>
      </div>
      {!isEditing && <button type="button" disabled={isLoading || Boolean(error)} onClick={() => {
        setEditingBranch(null)
        setInitialAddress({ country: 'PH' })
        setBranchName('')
        setBranchHours(DEFAULT_APPOINTMENT_BRANCH.hours)
        setSaveError('')
        setIsEditing(true)
      }} className="mb-4 inline-flex items-center gap-2 rounded-lg bg-[var(--gold-primary)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
        <Plus className="h-4 w-4" />Add branch address
      </button>}
      {isLoading && <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Loading branch address...</p>}
      {error && <div className="mb-4 text-sm text-red-400" role="alert">
        {error}
        <button type="button" onClick={refreshBranchSettings} className="ml-2 underline">Retry</button>
      </div>}
      {isEditing ? (
        <div className="admin-branch-form space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <button type="button" onClick={cancelEditing} disabled={isSaving} className="text-[var(--gold-primary)] hover:underline text-sm font-semibold flex items-center gap-1 disabled:opacity-50">
              <ArrowLeft className="h-4 w-4" />Back
            </button>
            <span className="text-white font-semibold">{editingBranch ? 'Edit Branch Address' : 'Add Branch Address'}</span>
          </div>
          {editingBranch?.id !== DEFAULT_APPOINTMENT_BRANCH.id && <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-[var(--text-muted)]">Branch name<input required maxLength={100} value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="e.g. CosmosCraft Malolos Branch" className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-2.5 text-[var(--text-light)]" /></label>
            <label className="text-sm text-[var(--text-muted)]">Opening hours<input required maxLength={200} value={branchHours} onChange={e => setBranchHours(e.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-2.5 text-[var(--text-light)]" /></label>
          </div>}
          <AddressForm
            initialAddress={initialAddress}
            onSubmit={saveAddress}
            onCancel={cancelEditing}
            showCategory={false}
            showDefault={false}
            submitLabel={editingBranch ? 'Save Branch Address' : 'Add Branch Address'}
            isSubmitting={isSaving}
          />
          {saveError && <p role="alert" className="text-sm text-red-400">{saveError}</p>}
        </div>
      ) : !isLoading && (
        <div className="space-y-3">{branches.map(location => <div key={location.id} className="admin-branch-preview">
          <span className="admin-settings-icon"><MapPin /></span>
          <div className="min-w-0">
          <p className="admin-branch-name">{location.name}</p>
          <p className="admin-branch-address">{location.address}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{location.hours}</p>
          <button type="button" aria-label="Edit Branch Address" disabled={Boolean(error)} onClick={() => {
            setEditingBranch(location)
            setInitialAddress(getInitialAddress(location))
            setBranchName(location.name)
            setBranchHours(location.hours)
            setSaveError('')
            setIsEditing(true)
          }} className="admin-settings-link admin-branch-edit disabled:opacity-50">
            <Pencil />Edit address
          </button>
          </div>
        </div>)}</div>
      )}
    </section>
  )
}
