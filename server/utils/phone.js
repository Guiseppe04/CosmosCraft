// Canonical PH mobile format; keep local-format API callers compatible.
function normalizePhMobile(value) {
  const input = String(value ?? '').trim().replace(/\s+/g, '');
  if (/^9\d{9}$/.test(input)) return `+63${input}`;
  if (/^09\d{9}$/.test(input)) return `+63${input.slice(1)}`;
  return /^\+639\d{9}$/.test(input) ? input : null;
}

module.exports = { normalizePhMobile };
