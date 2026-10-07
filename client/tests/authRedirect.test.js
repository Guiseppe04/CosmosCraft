import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getAuthDestination } from '../src/app/utils/authRedirect.js'

const origin = 'https://cosmoscraft.example'

test('login and OAuth never return to authentication pages', () => {
  for (const [role, destination] of [['customer', '/dashboard'], ['staff', '/staff'], ['admin', '/admin'], ['super_admin', '/admin']]) {
    for (const returnTo of [null, '/login', '/login/?next=shop', '/signup', '/auth/success', '/auth/signup', '/verify-otp', 'https://other.example/shop', 'javascript:alert(1)']) {
      assert.equal(getAuthDestination(role, returnTo, origin), destination)
    }
  }
})

test('login preserves valid local destinations and their query and hash', () => {
  assert.equal(getAuthDestination('customer', '/checkout?from=cart#payment', origin), '/checkout?from=cart#payment')
  assert.equal(getAuthDestination('staff', origin + '/staff?tab=projects', origin), '/staff?tab=projects')
})
