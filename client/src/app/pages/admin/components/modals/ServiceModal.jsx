import { ModalHeader } from '../shared/ModalHeader'
import { ModalFooter } from '../shared/ModalFooter'
import { FormField } from '../shared/FormField'

export function ServiceModal({ modal, form, setForm, formErrors, closeModal, isSaving, saveService, labelCls, inputCls }) {
  return (
    <>
      <ModalHeader title={modal.data ? 'Edit Service' : 'Add Service'} onClose={closeModal} />
      <div className="space-y-4 mt-6">
        <FormField
          id="service-name"
          label="Service Name"
          required
          value={form.name || ''}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          placeholder="e.g. Setup & Intonation"
          error={formErrors.name}
        />
        <FormField
          id="service-description"
          label="Description"
          value={form.description || ''}
          onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          textarea
          placeholder="Describe the service..."
        />
        <FormField
          id="service-price"
          label="Base Price"
          required
          type="number"
          min={0}
          step={0.01}
          value={form.price || ''}
          onChange={(v) => setForm((f) => ({ ...f, price: v }))}
          placeholder="1500.00"
          error={formErrors.price}
        />
        <FormField
          id="service-duration"
          label="Duration (hours)"
          type="number"
          min={0}
          step={0.5}
          value={form.duration || ''}
          onChange={(v) => setForm((f) => ({ ...f, duration: v }))}
          placeholder="e.g. 2"
          error={formErrors.duration}
        />
        <div>
          <label htmlFor="service-status" className={labelCls}>Status</label>
          <select
            id="service-status"
            value={form.is_active === undefined ? 'true' : (form.is_active ? 'true' : 'false')}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === 'true' }))}
            className={inputCls}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>
      <ModalFooter onCancel={closeModal} onSave={saveService} isSaving={isSaving} />
    </>
  )
}