import { forwardRef } from 'react'

const RiderContactInput = forwardRef(function RiderContactInput({ value = '', onChange, placeholder = '09171234567', ...props }, ref) {
  const digits = String(value).replace(/\D/g, '')
  const localNumber = digits.length === 12 && digits.startsWith('63') ? `0${digits.slice(2)}` : digits
  return <input {...props} ref={ref} type="tel" inputMode="numeric" autoComplete="tel-national"
    maxLength={11} pattern="[0-9]{0,11}" placeholder={placeholder} value={localNumber.slice(0,11)}
    onChange={event=>onChange?.({ target: { name:event.target.name, id:event.target.id, value:event.target.value.replace(/\D/g,'').slice(0,11) } })} />
})

export default RiderContactInput
