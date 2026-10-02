/**
 * Appointment Receipt Generator and Printer for CosmosCraft
 * Simplified receipt without status clutter.
 */


export function printAppointmentReceipt(appointment) {
  if (!appointment) return

  const escapeHtml = (value) => {
    if (value === null || value === undefined) return ''

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  // Proper casing for receipt display.
  // Examples:
  // "electric guitar" -> "Electric Guitar"
  // "ELECTRIC GUITAR" -> "Electric Guitar"
  // "acoustic-electric guitar" -> "Acoustic-Electric Guitar"
  const toProperCase = (value) => {
    if (!value) return ''

    return String(value)
      .trim()
      .toLowerCase()
      .replace(/\b([a-z])/g, (match) => match.toUpperCase())
  }

  const ref =
    appointment.reference_code ||
    appointment.referenceNumber ||
    appointment.appointment_id ||
    appointment.id ||
    'N/A'

  const scheduledDate =
    appointment.scheduled_at || appointment.date

  const formattedDate = scheduledDate
    ? new Date(scheduledDate).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : 'N/A'

  const appointmentType =
    appointment.appointment_type || 'service_in_shop'

  const isHome = appointmentType === 'service_home'

  const typeLabel = isHome
    ? 'Home Service'
    : 'In-Shop Service'

  const locationLabel = isHome
    ? (
        appointment.customer_address ||
        appointment.address ||
        appointment.location_id ||
        'Customer Address'
      )
    : (
        appointment.location_id
          ? String(appointment.location_id)
              .replace(/-/g, ' ')
              .toUpperCase()
          : 'Balagtas Main Branch'
      )

  const clientName =
    appointment.customer_name ||
    appointment.user_name ||
    appointment.client_name ||
    appointment.customerName ||
    'Guest'

  const clientEmail =
    appointment.customer_email ||
    appointment.user_email ||
    appointment.customerEmail ||
    '—'

  const clientPhone =
    appointment.customer_phone ||
    appointment.user_phone ||
    appointment.customerPhone ||
    '—'

  const paymentMethod = appointment.payment_method
    ? String(appointment.payment_method)
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase()
    : 'CASH'

  // ------------------------------------------------------------
  // GUITAR TYPE ONLY
  // ------------------------------------------------------------

  let guitarTypes = []
  let guitarDetails = appointment.guitar_details

  if (typeof guitarDetails === 'string') {
    try {
      guitarDetails = JSON.parse(guitarDetails)
    } catch (_) {
      guitarDetails = null
    }
  }

  const guitars =
    Array.isArray(guitarDetails?.guitars) &&
    guitarDetails.guitars.length > 0
      ? guitarDetails.guitars
      : (
          guitarDetails &&
          typeof guitarDetails === 'object' &&
          guitarDetails.type
            ? [guitarDetails]
            : []
        )

  if (guitars.length > 0) {
    guitars.forEach((guitar) => {
      if (guitar?.type) {
        guitarTypes.push(
          toProperCase(guitar.type)
        )
      }
    })
  }

  // Fallback only to extract the guitar type.
  // Notes themselves are NOT printed.
  if (
    guitarTypes.length === 0 &&
    typeof appointment.notes === 'string'
  ) {
    appointment.notes.split('\n').forEach((line) => {
      const match = line.match(
        /^Guitar\s+\d+:\s*.+?\s+\(([^)]+)\)\s*$/i
      )

      if (match?.[1]) {
        guitarTypes.push(
          toProperCase(match[1])
        )
      }
    })
  }

  guitarTypes = [...new Set(guitarTypes)]

  // ------------------------------------------------------------
  // SERVICES
  // ------------------------------------------------------------

  let serviceRows = []

  if (
    Array.isArray(appointment.service_details) &&
    appointment.service_details.length > 0
  ) {
    serviceRows = appointment.service_details.map(
      (service) => ({
        name: service.name,
        price: Number.isFinite(Number(service.price))
          ? Number(service.price)
          : null,
      })
    )
  } else if (
    Array.isArray(appointment.service_names) &&
    appointment.service_names.length > 0
  ) {
    serviceRows = appointment.service_names.map(
      (name) => ({
        name: String(name).replace(/-/g, ' '),
        price: null,
      })
    )
  } else if (
    Array.isArray(appointment.services) &&
    appointment.services.length > 0
  ) {
    serviceRows = appointment.services.map(
      (service) => ({
        name:
          typeof service === 'string'
            ? service.replace(/-/g, ' ')
            : service.name ||
              service.service_name ||
              'Service',

        price: Number.isFinite(Number(service.price))
          ? Number(service.price)
          : null,
      })
    )
  } else if (appointment.service_name) {
    serviceRows = [
      {
        name: appointment.service_name,
        price: null,
      },
    ]
  }

  const hasAnyPrices = serviceRows.some(
    (row) => row.price !== null
  )

  const total = hasAnyPrices
    ? serviceRows.reduce(
        (sum, row) => sum + (row.price || 0),
        0
      )
    : (
        Number.isFinite(
          Number(
            appointment.total_amount ??
            appointment.total
          )
        )
          ? Number(
              appointment.total_amount ??
              appointment.total
            )
          : null
      )

  const printDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const money = (amount) =>
    `PHP ${Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const divider =
    '------------------------------------------'

  // ------------------------------------------------------------
  // RECEIPT HTML
  // ------------------------------------------------------------

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">

<title>Receipt - ${escapeHtml(ref)}</title>

<style>
  /*
   * 80mm THERMAL RECEIPT
   *
   * The browser preview will use an 80mm-wide page.
   * Height remains automatic based on receipt content.
   */
  @page {
    size: 80mm auto;
    margin: 0;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    width: 80mm;
  }

  body {
    font-family:
      "Courier New",
      Courier,
      monospace;

    font-size: 11px;
    line-height: 1.35;

    font-weight: 400;

    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .receipt {
    width: 80mm;
    padding: 8px 7px;
  }

  /*
   * Keep all normal receipt text at exactly 11px.
   * Bold is used for hierarchy, not larger font sizes.
   */
  .header {
    text-align: center;
    margin-bottom: 7px;
  }

  .brand,
  .title {
    font-size: 11px;
    line-height: 1.35;
    font-weight: 700;
  }

  .divider {
    width: 100%;
    text-align: center;
    margin: 6px 0;
    font-size: 11px;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
  }

  .section-title {
    text-align: center;
    font-size: 11px;
    line-height: 1.35;
    font-weight: 700;
    margin: 6px 0 5px;
    text-transform: uppercase;
  }

  .row {
    display: flex;
    width: 100%;
    margin: 3px 0;
    align-items: flex-start;
  }

  .label {
    width: 30%;
    flex: 0 0 30%;
    font-size: 11px;
    line-height: 1.35;
    font-weight: 700;
    text-transform: uppercase;
  }

  .value {
    width: 70%;
    flex: 0 0 70%;
    font-size: 11px;
    line-height: 1.35;
    text-align: right;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .guitar-type {
    width: 100%;
    text-align: center;
    font-size: 11px;
    line-height: 1.35;
    font-weight: 700;
    margin: 3px 0;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  /*
   * Services:
   * Long service names wrap to another line.
   * Font size stays exactly the same.
   */
  .service-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 7px;

    width: 100%;

    margin: 5px 0;

    align-items: start;
  }

  .service-name {
    min-width: 0;

    font-size: 11px;
    line-height: 1.35;

    text-align: left;

    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .service-price {
    min-width: 0;

    font-size: 11px;
    line-height: 1.35;

    text-align: right;

    white-space: nowrap;
  }

  /*
   * TOTAL uses the SAME 11px size as the summary
   * and every other receipt element.
   */
  .total {
    display: flex;

    justify-content: space-between;
    align-items: flex-start;

    width: 100%;

    margin-top: 7px;

    font-size: 11px;
    line-height: 1.35;
    font-weight: 700;
  }

  .footer {
    text-align: center;

    margin-top: 9px;

    font-size: 11px;
    line-height: 1.4;
  }

  .thank-you {
    font-size: 11px;
    font-weight: 700;
  }

  @media print {
    html,
    body {
      width: 80mm;
      margin: 0;
      padding: 0;
    }

    .receipt {
      width: 80mm;
    }
  }
</style>
</head>

<body>

<div class="receipt">

  <!-- HEADER -->

  <div class="header">
    <div class="brand">
      COSMOS CRAFT GUITARS
    </div>

    <div class="title">
      APPOINTMENT SERVICE RECEIPT
    </div>
  </div>

  <div class="divider">${divider}</div>

  <!-- APPOINTMENT SUMMARY -->

  <div class="row">
    <div class="label">Ref</div>
    <div class="value">
      ${escapeHtml(ref)}
    </div>
  </div>

  <div class="row">
    <div class="label">Date</div>
    <div class="value">
      ${escapeHtml(formattedDate)}
    </div>
  </div>

  <div class="row">
    <div class="label">Type</div>
    <div class="value">
      ${escapeHtml(typeLabel)}
    </div>
  </div>

  <div class="row">
    <div class="label">Location</div>
    <div class="value">
      ${escapeHtml(locationLabel)}
    </div>
  </div>

  <div class="divider">${divider}</div>

  <!-- CUSTOMER -->

  <div class="section-title">
    CUSTOMER
  </div>

  <div class="row">
    <div class="label">Name</div>
    <div class="value">
      ${escapeHtml(clientName)}
    </div>
  </div>

  <div class="row">
    <div class="label">Phone</div>
    <div class="value">
      ${escapeHtml(clientPhone)}
    </div>
  </div>

  <div class="row">
    <div class="label">Email</div>
    <div class="value">
      ${escapeHtml(clientEmail)}
    </div>
  </div>

  ${
    appointment.customer_address || isHome
      ? `
        <div class="row">
          <div class="label">Address</div>

          <div class="value">
            ${escapeHtml(
              appointment.customer_address ||
              locationLabel
            )}
          </div>
        </div>
      `
      : ''
  }

  <!-- PAYMENT IS DIRECTLY BELOW CUSTOMER DETAILS -->

  <div class="row">
    <div class="label">Payment</div>

    <div class="value">
      ${escapeHtml(paymentMethod)}
    </div>
  </div>

  <!-- GUITAR TYPE -->

  ${
    guitarTypes.length > 0
      ? `
        <div class="divider">${divider}</div>

        <div class="section-title">
          GUITAR TYPE
        </div>

        ${guitarTypes
          .map(
            (type) => `
              <div class="guitar-type">
                ${escapeHtml(type)}
              </div>
            `
          )
          .join('')}
      `
      : ''
  }

  <!-- SERVICES -->

  <div class="divider">${divider}</div>

  <div class="section-title">
    SERVICES
  </div>

  ${
    serviceRows.length > 0
      ? serviceRows
          .map(
            (service) => `
              <div class="service-row">

                <div class="service-name">
                  ${escapeHtml(
                    String(
                      service.name || 'Service'
                    )
                      .replace(/-/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim()
                  )}
                </div>

                <div class="service-price">
                  ${
                    service.price !== null
                      ? money(service.price)
                      : 'Consultation'
                  }
                </div>

              </div>
            `
          )
          .join('')
      : `
        <div class="service-row">

          <div class="service-name">
            Consultation / Assessment
          </div>

          <div class="service-price">
            Complimentary
          </div>

        </div>
      `
  }

  <!-- TOTAL -->

  ${
    total !== null
      ? `
        <div class="total">
          <span>TOTAL</span>
          <span>${money(total)}</span>
        </div>
      `
      : ''
  }

  <div class="divider">${divider}</div>

  <!-- FOOTER -->

  <div class="footer">

    <div class="thank-you">
      THANK YOU FOR CHOOSING
    </div>

    <div class="thank-you">
      COSMOS CRAFT GUITARS
    </div>

    <div>
      Printed on ${escapeHtml(printDate)}
    </div>

  </div>

</div>

<script>
  window.onload = function () {
    window.print()

    window.onafterprint = function () {
      window.close()
    }
  }
<\/script>

</body>
</html>`

  const win = window.open(
    '',
    '_blank',
    'width=420,height=750'
  )

  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
  }
}






export function generatePlainTextReceipt(appointment) {
  if (!appointment) return ''

  const ref = appointment.reference_code || appointment.referenceNumber || appointment.appointment_id || appointment.id || 'N/A'
  const scheduledDate = appointment.scheduled_at || appointment.date
  const formattedDate = scheduledDate
    ? new Date(scheduledDate).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : 'N/A'

  const appointmentType = appointment.appointment_type || 'service_in_shop'
  const isHome = appointmentType === 'service_home'
  const typeLabel = isHome ? 'Home Service' : 'In-Shop Service'
  const locationLabel = isHome
    ? (appointment.customer_address || appointment.address || appointment.location_id || 'Customer Address')
    : (appointment.location_id ? String(appointment.location_id).replace(/-/g, ' ').toUpperCase() : 'Balagtas Main Branch')

  const clientName = appointment.customer_name || appointment.user_name || appointment.client_name || appointment.customerName || 'Guest'
  const clientEmail = appointment.customer_email || appointment.user_email || appointment.customerEmail || '—'
  const clientPhone = appointment.customer_phone || appointment.user_phone || appointment.customerPhone || '—'

  const paymentMethod = appointment.payment_method ? String(appointment.payment_method).replace(/_/g, ' ').toUpperCase() : 'CASH'

  let guitarLines = []
  let guitarDetails = appointment.guitar_details
  if (typeof guitarDetails === 'string') {
    try { guitarDetails = JSON.parse(guitarDetails) } catch (_) { guitarDetails = null }
  }

  const guitars = Array.isArray(guitarDetails?.guitars) && guitarDetails.guitars.length > 0
    ? guitarDetails.guitars
    : (guitarDetails && typeof guitarDetails === 'object' && (guitarDetails.brand || guitarDetails.model || guitarDetails.type) ? [guitarDetails] : [])

  if (guitars.length > 0) {
    guitars.forEach((g, idx) => {
      const brand = g.brand || g.name || ''
      const model = g.model || g.variant || ''
      const typeStr = g.type ? ` (${g.type})` : ''
      const serial = g.serial && g.serial !== 'N/A' ? ` · Serial: ${g.serial}` : ''
      guitarLines.push(`Instrument ${idx + 1}   : ${[brand, model].filter(Boolean).join(' ')}${typeStr}${serial}`)
    })
  }

  let serviceRows = []
  if (Array.isArray(appointment.service_details) && appointment.service_details.length > 0) {
    serviceRows = appointment.service_details.map((s) => ({
      name: s.name,
      price: Number.isFinite(Number(s.price)) ? Number(s.price) : null,
    }))
  } else if (Array.isArray(appointment.service_names) && appointment.service_names.length > 0) {
    serviceRows = appointment.service_names.map((name) => ({
      name: String(name).replace(/-/g, ' '),
      price: null,
    }))
  } else if (Array.isArray(appointment.services) && appointment.services.length > 0) {
    serviceRows = appointment.services.map((s) => ({
      name: typeof s === 'string' ? s.replace(/-/g, ' ') : (s.name || s.service_name || 'Service'),
      price: Number.isFinite(Number(s.price)) ? Number(s.price) : null,
    }))
  } else if (appointment.service_name) {
    serviceRows = [{ name: appointment.service_name, price: null }]
  }

  const hasAnyPrices = serviceRows.some((r) => r.price !== null)
  const total = hasAnyPrices
    ? serviceRows.reduce((sum, r) => sum + (r.price || 0), 0)
    : (Number.isFinite(Number(appointment.total_amount ?? appointment.total))
        ? Number(appointment.total_amount ?? appointment.total)
        : null)

  const divider = '------------------------------------------------------------'
  const dblDivider = '============================================================'

  const lines = [
    dblDivider,
    '                    COSMOS CRAFT GUITARS',
    '                 APPOINTMENT SERVICE RECEIPT',
    dblDivider,
    `Receipt Ref    : ${ref}`,
    `Date & Time    : ${formattedDate}`,
    `Service Type   : ${typeLabel}`,
    `Location       : ${locationLabel}`,
    divider,
    'CUSTOMER DETAILS',
    `Name           : ${clientName}`,
    `Email          : ${clientEmail}`,
    `Phone          : ${clientPhone}`,
  ]

  if (appointment.customer_address || (isHome && locationLabel)) {
    lines.push(`Address        : ${appointment.customer_address || locationLabel}`)
  }

  if (guitarLines.length > 0) {
    lines.push(divider)
    lines.push('INSTRUMENT DETAILS')
    lines.push(...guitarLines)
  }

  lines.push(divider)
  lines.push('SERVICES & ESTIMATED CHARGES')
  if (serviceRows.length > 0) {
    serviceRows.forEach((s, idx) => {
      const num = `${idx + 1}. `.padEnd(3, ' ')
      const name = s.name.length > 36 ? s.name.slice(0, 33) + '...' : s.name.padEnd(36, ' ')
      const priceStr = s.price !== null
        ? `PHP ${Number(s.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : 'Consultation'
      lines.push(`${num}${name}  ${priceStr.padStart(16, ' ')}`)
    })
  } else {
    lines.push('1. Consultation / Assessment'.padEnd(39, ' ') + '  ' + 'Complimentary'.padStart(16, ' '))
  }

  lines.push(divider)
  if (total !== null) {
    const totalLabel = 'TOTAL ESTIMATE'.padEnd(39, ' ')
    const totalVal = `PHP ${Number(total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    lines.push(`${totalLabel}  ${totalVal.padStart(16, ' ')}`)
  }
  lines.push(`Payment Method : ${paymentMethod}`)

  if (appointment.notes) {
    lines.push(divider)
    lines.push('CUSTOMER NOTES')
    lines.push(appointment.notes)
  }

  lines.push(dblDivider)
  lines.push('        Thank you for choosing Cosmos Craft Guitars!')
  lines.push(dblDivider)

  return lines.join('\n')
}
