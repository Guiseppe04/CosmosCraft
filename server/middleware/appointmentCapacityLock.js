const LOCK_NAMESPACE = 73124;
const LOCK_KEY = 1;

const lockAppointmentCapacity = (client) =>
  client.query('SELECT pg_advisory_xact_lock($1, $2)', [LOCK_NAMESPACE, LOCK_KEY]);

module.exports = { lockAppointmentCapacity };