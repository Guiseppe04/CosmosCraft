const titleCase = value => String(value || '').replace(/[_-]+/g, ' ')
  .toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());

const MODULES = {
  project: 'Projects', order: 'Orders', payment: 'Payments', refund: 'Refunds',
  inventory: 'Inventory', fulfillment: 'Fulfillment', pos: 'POS', products: 'Products',
  guitar_builder_parts: 'Guitar Builder Parts', appointments: 'Appointments',
  appointment_schedule: 'Booking Schedule', users: 'Users', rbac: 'Roles and Permissions',
  settings: 'Settings', cart: 'Cart', customizations: 'Customizations',
  services: 'Services', notifications: 'Notifications',
};

function formatValue(field, value) {
  if (value === null || value === undefined) return 'empty';
  if (value === '[redacted]') return '[redacted]';
  if (typeof value === 'boolean') return value ? 'enabled' : 'disabled';
  if (typeof value === 'object') return 'updated data';
  if (/amount|price|cost|fee|total/i.test(field) && Number.isFinite(Number(value))) {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value));
  }
  if (/status|role|type/i.test(field)) return titleCase(value);
  return String(value);
}

// Translation is read-only. Raw snapshots and before/after values remain intact.
function presentAudit(log) {
  const context = log.context || {};
  const table = titleCase(context.source_table || log.entity_type);
  const record = context.order_number || context.project_number || context.product_name
    || context.refund_number || context.reference_code || context.sale_number
    || context.build_name || context.record_id || log.entity_id;
  const action = { INSERT: 'Created', UPDATE: 'Updated', DELETE: 'Deleted' }[log.action] || titleCase(log.action);
  const changes = Object.entries(log.changes || {}).map(([field, change]) => ({
    field, label: titleCase(field), from: change?.from ?? null, to: change?.to ?? null,
    fromLabel: formatValue(field, change?.from), toLabel: formatValue(field, change?.to),
  }));
  const changeText = context.database_operation === 'UPDATE'
    ? changes.slice(0, 5).map(change => `${change.label}: ${change.fromLabel} → ${change.toLabel}`).join('; ')
    : '';
  return {
    ...log,
    display: {
      module: MODULES[log.entity_type] || titleCase(log.entity_type),
      action,
      title: `${table}: ${action}`,
      description: `${table}${record ? ` (${record})` : ''}: ${changeText || action.toLowerCase()}.`,
      changes,
    },
  };
}

module.exports = { presentAudit };
