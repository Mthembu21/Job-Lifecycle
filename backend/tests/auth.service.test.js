const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveLoginUser, passwordProblem } = require('../src/modules/auth/auth.service');

const user = {
  id: 'u1',
  name: 'Component Planner',
  email: 'planner@example.com',
  role: 'PLANNER',
  passwordHash: 'hash',
  tokenVersion: 0,
};

test('returns the user when the password matches', async () => {
  const result = await resolveLoginUser({
    email: user.email,
    password: 'right',
    findUserByEmail: async () => user,
    comparePassword: async (password) => password === 'right',
  });
  assert.deepEqual(result, user);
});

test('returns null for a wrong password', async () => {
  const result = await resolveLoginUser({
    email: user.email,
    password: 'wrong',
    findUserByEmail: async () => user,
    comparePassword: async (password) => password === 'right',
  });
  assert.equal(result, null);
});

test('returns null for an unknown email, still running a password comparison (equal timing)', async () => {
  let compared = false;
  const result = await resolveLoginUser({
    email: 'nobody@example.com',
    password: 'whatever',
    findUserByEmail: async () => null,
    comparePassword: async () => {
      compared = true;
      return false;
    },
  });
  assert.equal(result, null);
  assert.equal(compared, true);
});

test('never lets anyone in when the database is unavailable (no fallback accounts)', async () => {
  await assert.rejects(
    resolveLoginUser({
      email: 'admin@demo.local',
      password: 'Password123!',
      findUserByEmail: async () => {
        throw new Error('server selection timeout');
      },
      comparePassword: async () => true,
    })
  );
});

test('password policy', () => {
  assert.match(passwordProblem('short'), /at least 12/);
  assert.match(passwordProblem('Password123!'), /at least 12|too easy/);
  assert.match(passwordProblem('planner-is-great-2026', 'planner@example.com'), /username/);
  assert.equal(passwordProblem('blue-crane-ladder-7'), null);
});
