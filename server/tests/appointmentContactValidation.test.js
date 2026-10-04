const assert = require('node:assert/strict')
const { appointmentValidation } = require('../utils/appointmentValidation')

const booking = {
  appointment_type: 'service_home',
  services: ['1'],
  address_id: '11111111-1111-4111-8111-111111111111',
  scheduled_at: new Date(Date.now() + 86400000).toISOString(),
  payment_method: 'cash',
}

for (const contact_number of ['9123456789', '09123456789', '+639123456789', ' 09123456789 ', '', undefined]) {
  const result = appointmentValidation.createAppointmentSchema.validate({ ...booking, contact_number })
  assert.ifError(result.error)
  assert.equal(result.value.contact_number, contact_number ? '+639123456789' : contact_number)

  const update = appointmentValidation.updateAppointmentSchema.validate({ contact_number, notes: 'Updated contact' })
  assert.ifError(update.error)
  assert.equal(update.value.contact_number, contact_number ? '+639123456789' : contact_number)
}

const invalid = appointmentValidation.createAppointmentSchema.validate({ ...booking, contact_number: '123' })
assert.equal(invalid.error.details[0].type, 'string.pattern.base')
const unknown = appointmentValidation.createAppointmentSchema.validate({ ...booking, unexpected_field: true })
assert.equal(unknown.error.details[0].type, 'object.unknown')
console.log('appointment contact number validation test passed')
