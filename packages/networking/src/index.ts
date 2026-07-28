import type { PlayerInputFrame, SimulationState } from '@aether/simulation';

export const PROTOCOL_VERSION = 1;
export const MAX_CLIENT_MESSAGE_LENGTH = 4096;

export type ClientMessage =
  | { type: 'hello'; protocol: number }
  | { type: 'input'; protocol: number; frame: PlayerInputFrame };

export type ServerMessage =
  | { type: 'welcome'; protocol: number; tick: number }
  | { type: 'snapshot'; protocol: number; state: SimulationState }
  | { type: 'error'; protocol: number; code: string; message: string };

export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length === 0 || raw.length > MAX_CLIENT_MESSAGE_LENGTH) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.protocol !== PROTOCOL_VERSION) return null;
    if (value.type === 'hello') return { type: 'hello', protocol: PROTOCOL_VERSION };
    if (value.type !== 'input' || !isPlayerInputFrame(value.frame)) return null;
    return { type: 'input', protocol: PROTOCOL_VERSION, frame: value.frame };
  } catch {
    return null;
  }
}

export function isPlayerInputFrame(value: unknown): value is PlayerInputFrame {
  if (!isRecord(value)) return false;
  return (
    isNonNegativeSafeInteger(value.sequence) &&
    isNonNegativeSafeInteger(value.tick) &&
    isAxis(value.throttle) &&
    isAxis(value.steer) &&
    isAxis(value.pitch) &&
    isAxis(value.yaw) &&
    isAxis(value.roll) &&
    typeof value.jump === 'boolean' &&
    typeof value.boost === 'boolean' &&
    typeof value.handbrake === 'boolean' &&
    typeof value.ballCam === 'boolean'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isAxis(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -1 && value <= 1;
}
