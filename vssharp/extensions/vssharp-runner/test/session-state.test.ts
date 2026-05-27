import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  contextValueForSession,
  isActiveSessionStatus,
  SessionStatus,
} from '../src/session-state';

test('isActiveSessionStatus only treats building, running, and debugging as active', () => {
  const statuses: SessionStatus[] = ['idle', 'building', 'running', 'debugging', 'failed', 'stopped'];

  assert.deepEqual(statuses.filter(isActiveSessionStatus), ['building', 'running', 'debugging']);
});

test('contextValueForSession maps statuses to tree contexts', () => {
  assert.equal(contextValueForSession('debug', 'building'), 'vssharp.profile.building');
  assert.equal(contextValueForSession('run', 'running'), 'vssharp.profile.running');
  assert.equal(contextValueForSession('debug', 'debugging'), 'vssharp.profile.debugging');
  assert.equal(contextValueForSession('run', 'failed'), 'vssharp.profile.failed');
  assert.equal(contextValueForSession('run', 'stopped'), 'vssharp.profile.idle');
});
