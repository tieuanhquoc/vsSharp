export type SessionKind = 'run' | 'debug';
export type SessionStatus = 'idle' | 'building' | 'running' | 'debugging' | 'failed' | 'stopped';

export function isActiveSessionStatus(status: SessionStatus): boolean {
  return status === 'building' || status === 'running' || status === 'debugging';
}

export function contextValueForSession(kind: SessionKind, status: SessionStatus): string {
  if (status === 'failed') return 'vssharp.profile.failed';
  if (status === 'building') return 'vssharp.profile.building';
  if (status === 'running') return 'vssharp.profile.running';
  if (status === 'debugging') return 'vssharp.profile.debugging';
  return 'vssharp.profile.idle';
}
