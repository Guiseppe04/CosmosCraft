const assert = require('node:assert/strict');
const { test } = require('node:test');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const userService = require('../services/userService');
const { requestPasswordChange } = require('../controllers/userController');
const { changePasswordSchema, resetPasswordSchema, validate } = require('../utils/validation');

// Exercise the endpoint's validation and controller with an in-memory user record.
// Password verification and hashing use the real service; no database is contacted.
function setupAccount(t, { socialOnly = false } = {}) {
  const account = {
    passwordHash: socialOnly ? null : bcrypt.hashSync('Current#Password', 4),
    writes: 0,
  };
  t.mock.method(userService, 'getUserAuthInfo', async () => ({
    has_local_password: Boolean(account.passwordHash),
    provider: socialOnly ? 'google' : 'local',
  }));
  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.startsWith('SELECT password_hash')) {
      assert.deepEqual(params, ['test-user']);
      return { rows: [{ password_hash: account.passwordHash }] };
    }
    assert.match(sql, /^UPDATE users SET password_hash/);
    assert.equal(params[1], 'test-user');
    account.passwordHash = params[0];
    account.writes += 1;
    return { rows: [], rowCount: 1 };
  });
  return account;
}

function changePassword(body) {
  return new Promise((resolve, reject) => {
    const req = { user: { id: 'test-user' }, body };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ statusCode: this.statusCode, ...payload }); },
    };
    validate(changePasswordSchema)(req, res, () => requestPasswordChange(req, res, reject));
  });
}

test('password change accepts the form and signup policy, including symbols without digits', async (t) => {
  const account = setupAccount(t);
  for (const newPassword of ['Changed!Password', 'Changed#Password', 'Changed_123Password']) {
    const result = await changePassword({ oldPassword: 'Current#Password', newPassword, confirmPassword: newPassword });
    assert.equal(result.statusCode, 200);
    assert.equal(result.status, 'success');
    assert.equal(result.data.hasLocalPassword, true);
    assert.equal(await bcrypt.compare(newPassword, account.passwordHash), true);
    // Restore the current password for the next case without incrementing writes.
    account.passwordHash = bcrypt.hashSync('Current#Password', 4);
  }
  assert.equal(account.writes, 3);
});

test('password change and reset enforce the same complexity and length limits', () => {
  for (const password of ['Changed#Password', 'Abcdef!g', `Aa!${'x'.repeat(61)}`, 'short!', 'lowercase!', 'UPPERCASE!', 'NoSymbols123', `Aa!${'x'.repeat(62)}`]) {
    const change = changePasswordSchema.validate({ newPassword: password, confirmPassword: password });
    const reset = resetPasswordSchema.validate({ token: 'test-token', newPassword: password });
    assert.equal(Boolean(change.error), Boolean(reset.error), password);
  }
});

test('invalid passwords and confirmation return field errors without updating the password', async (t) => {
  const account = setupAccount(t);
  for (const [newPassword, confirmPassword, field] of [
    ['Short!', 'Short!', 'newPassword'],
    ['lowercase!', 'lowercase!', 'newPassword'],
    ['UPPERCASE!', 'UPPERCASE!', 'newPassword'],
    ['NoSymbols123', 'NoSymbols123', 'newPassword'],
    [`Aa!${'x'.repeat(62)}`, `Aa!${'x'.repeat(62)}`, 'newPassword'],
    ['Changed#Password', 'Different#Password', 'confirmPassword'],
    ['', '', 'newPassword'],
  ]) {
    const result = await changePassword({ oldPassword: 'Current#Password', newPassword, confirmPassword });
    assert.equal(result.statusCode, 400);
    assert.equal(result.status, 'error');
    assert.ok(result.errors.some(error => error.field === field && error.message));
  }
  assert.equal(account.writes, 0);
});

test('local accounts still require the correct current password and reject password reuse', async (t) => {
  const account = setupAccount(t);
  for (const [oldPassword, newPassword, message] of [
    [undefined, 'Changed#Password', /Current password is required/],
    ['Wrong#Password', 'Changed#Password', /Current password is incorrect/],
    ['Current#Password', 'Current#Password', /must be different/],
  ]) {
    await assert.rejects(changePassword({ oldPassword, newPassword, confirmPassword: newPassword }), (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, message);
      return true;
    });
  }
  assert.equal(account.writes, 0);
});

test('social-only accounts can set a local password and must supply it for subsequent changes', async (t) => {
  const account = setupAccount(t, { socialOnly: true });
  const newPassword = 'Changed#Password';
  const result = await changePassword({ newPassword, confirmPassword: newPassword });
  assert.equal(result.statusCode, 200);
  assert.equal(result.status, 'success');
  assert.equal(result.message, 'Local password set successfully.');
  assert.equal(result.data.hasLocalPassword, true);
  assert.equal(await bcrypt.compare(newPassword, account.passwordHash), true);
  await assert.rejects(changePassword({ newPassword: 'Another#Password', confirmPassword: 'Another#Password' }), /Current password is required/);
  assert.equal(account.writes, 1);
});
