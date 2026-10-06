import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { readFile } from 'node:fs/promises';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { z } from 'zod';
import { auth } from '../src/services/firebase.ts';
import { apiRequest } from '../src/services/api.ts';

process.env.EXPO_PUBLIC_API_URL ??= 'https://brisa-api-ral6.onrender.com';
const state = JSON.parse(
  await readFile(process.env.BRISA_TEST_STATE || '/tmp/brisa-delivery-tests.json'),
);
const account = state.accounts[0];
const { user } = await signInWithEmailAndPassword(auth, account.email, account.password);
const original = user.getIdToken;
try {
  user.getIdToken = () => new Promise(() => {});
  mock.timers.enable({ apis: ['setTimeout'] });
  const request = apiRequest('/users/me', z.unknown());
  mock.timers.tick(90_000);
  await assert.rejects(request, /demorou a responder/);
  console.log('PASS: API deadline rejects when session token retrieval stalls.');
} finally {
  mock.timers.reset();
  user.getIdToken = original;
  await signOut(auth);
}
