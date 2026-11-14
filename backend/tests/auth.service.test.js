const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveLoginUser } = require('../src/modules/auth/auth.service');

test('resolveLoginUser returns fallback user when the database is unavailable and fallback credentials match', async () => {
  const fallbackUser = {
    id: 'demo-user',
    name: 'Demo Admin',
    email: 'admin@demo.local',
    role: 'ADMIN',
    passwordHash: '',
  };

  const user = await resolveLoginUser({
    email: 'admin@demo.local',
    password: 'Password123!',
    findUserByEmail: async () => {
      throw new Error('server selection timeout');
    },
    comparePassword: async () => false,
    fallbackUser,
  });

  assert.deepEqual(user, fallbackUser);
});
