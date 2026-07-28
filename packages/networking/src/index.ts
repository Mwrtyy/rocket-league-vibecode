import type { PlayerInputFrame, SimulationState } from '@aether/simulation';

export const PROTOCOL_VERSION = 1;

export type ClientMessage =
  | { type: 'hello'; protocol: number }
  | { type: 'input'; protocol: number; frame: PlayerInputFrame };

export type ServerMessage =
  | { type: 'welcome'; protocol: number; tick: number }
  | { type: 'snapshot'; protocol: number; state: SimulationState }
  | { type: 'error'; protocol: number; code: string; message: string };

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || !('type' in value)) return null;
    const candidate = value as Partial<ClientMessage>;
    if (candidate.type === 'hello' && candidate.protocol === PROTOCOL_VERSION) return candidate as ClientMessage;
    if (candidate.type === 'input' && candidate.protocol === PROTOCOL_VERSION && 'frame' in candidate) return candidate as ClientMessage;
    return null;
  } catch {
    return null;
  }
}
