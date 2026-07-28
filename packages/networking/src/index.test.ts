import { describe, expect, it } from 'vitest';
import { MAX_CLIENT_MESSAGE_LENGTH, PROTOCOL_VERSION, parseClientMessage } from './index.js';

const validFrame = {
  sequence: 1,
  tick: 20,
  throttle: 1,
  steer: -0.25,
  pitch: 0,
  yaw: -0.25,
  roll: 0,
  jump: false,
  boost: true,
  handbrake: false,
  ballCam: true,
};

describe('parseClientMessage', () => {
  it('accepts a compatible hello', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION }))).toEqual({
      type: 'hello',
      protocol: PROTOCOL_VERSION,
    });
  });

  it('accepts a fully valid input frame', () => {
    expect(
      parseClientMessage(
        JSON.stringify({ type: 'input', protocol: PROTOCOL_VERSION, frame: validFrame }),
      ),
    ).toEqual({ type: 'input', protocol: PROTOCOL_VERSION, frame: validFrame });
  });

  it.each([
    { ...validFrame, sequence: -1 },
    { ...validFrame, tick: 1.5 },
    { ...validFrame, throttle: 1.01 },
    { ...validFrame, steer: Number.NaN },
    { ...validFrame, jump: 1 },
    { ...validFrame, ballCam: 'true' },
  ])('rejects a malformed input field', (frame) => {
    expect(
      parseClientMessage(JSON.stringify({ type: 'input', protocol: PROTOCOL_VERSION, frame })),
    ).toBeNull();
  });

  it('rejects incompatible protocol versions and missing frames', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'hello', protocol: 999 }))).toBeNull();
    expect(
      parseClientMessage(JSON.stringify({ type: 'input', protocol: PROTOCOL_VERSION })),
    ).toBeNull();
  });

  it('rejects malformed and oversized JSON before entering gameplay code', () => {
    expect(parseClientMessage('{')).toBeNull();
    expect(parseClientMessage('x'.repeat(MAX_CLIENT_MESSAGE_LENGTH + 1))).toBeNull();
  });
});
