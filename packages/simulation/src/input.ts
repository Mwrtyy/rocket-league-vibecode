export interface PlayerInputFrame {
  sequence: number;
  tick: number;
  throttle: number;
  steer: number;
  pitch: number;
  yaw: number;
  roll: number;
  jump: boolean;
  boost: boolean;
  handbrake: boolean;
  ballCam: boolean;
}

export const NEUTRAL_INPUT: Readonly<PlayerInputFrame> = Object.freeze({
  sequence: 0,
  tick: 0,
  throttle: 0,
  steer: 0,
  pitch: 0,
  yaw: 0,
  roll: 0,
  jump: false,
  boost: false,
  handbrake: false,
  ballCam: true,
});
