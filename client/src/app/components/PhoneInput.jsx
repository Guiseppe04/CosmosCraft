import { forwardRef } from 'react'
import { getPhoneSubscriber } from '../utils/phone'

// Form state remains +63-prefixed; the editable part contains ten digits only.
const PhoneInput = forwardRef(function PhoneInput({ value, onChange, className = '', disabled, placeholder = '9XXXXXXXXX', ...props }, ref) {
  return (
    <div className={`flex w-full items-stretch ${disabled ? 'opacity-50' : ''}`}>
      <span className="inline-flex items-center rounded-l-lg border border-r-0 border-[var(--border)] bg-[var(--bg-primary)] px-3 text-sm font-semibold text-[var(--text-light)]">+63</span>
      <input {...props} ref={ref} type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} pattern="9[0-9]{9}" disabled={disabled}
        placeholder={placeholder} value={getPhoneSubscriber(value)}
        onChange={(event) => {
          const digits = event.target.value
          if (!/^\d{0,10}$/.test(digits)) return
          const nextValue = digits ? `+63${digits}` : ''
          onChange?.({ ...event, target: { name: event.target.name, id: event.target.id, value: nextValue }, currentTarget: { value: nextValue } })
        }}
        className={`${className} min-w-0 flex-1 rounded-l-none border-l-0`} />
    </div>
  )
})

export default PhoneInput
