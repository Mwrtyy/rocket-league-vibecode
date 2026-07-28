import type { Vec3 } from '@aether/shared';
import { BOOST_PAD_LAYOUT } from './constants/boost.js';
import { MATCH } from './constants/match.js';

export interface BallState {
  position: Vec3;
  linearVelocity: Vec3;
  angularVelocity: Vec3;
}

export interface CarRotation {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface CarJumpState {
  firstJumpConsumed: boolean;
  secondJumpConsumed: boolean;
  jumpHeldSeconds: number;
  airborneSeconds: number;
  dodgeActiveSeconds: number;
}

export interface CarState {
  position: Vec3;
  linearVelocity: Vec3;
  angularVelocity: Vec3;
  rotation: CarRotation;
  boost: number;
  grounded: boolean;
  supersonic: boolean;
  jump: CarJumpState;
}

export type Team = 'blue' | 'orange';
export type MatchPhase = 'freeplay' | 'countdown' | 'playing' | 'goal' | 'overtime' | 'ended';

export interface MatchState {
  phase: MatchPhase;
  clockSeconds: number;
  countdownSeconds: number;
  goalPauseSeconds: number;
  blueScore: number;
  orangeScore: number;
  zeroSecondActive: boolean;
  lastScorer: Team | null;
}

export interface BoostPadState {
  id: number;
  active: boolean;
  respawnSeconds: number;
}

export interface SimulationState {
  tick: number;
  ball: BallState;
  car: CarState;
  match: MatchState;
  boostPads: BoostPadState[];
}

export function createInitialState(matchMode = false): SimulationState {
  return {
    tick: 0,
    ball: {
      position: { x: 0, y: 0, z: 91.25 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
    },
    car: {
      position: { x: 0, y: -1200, z: 18.08 },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      rotation: { yaw: 0, pitch: 0, roll: 0 },
      boost: matchMode ? MATCH.startingBoost.value : 100,
      grounded: true,
      supersonic: false,
      jump: {
        firstJumpConsumed: false,
        secondJumpConsumed: false,
        jumpHeldSeconds: 0,
        airborneSeconds: 0,
        dodgeActiveSeconds: 0,
      },
    },
    match: {
      phase: matchMode ? 'countdown' : 'freeplay',
      clockSeconds: MATCH.regulation.value,
      countdownSeconds: matchMode ? MATCH.kickoffCountdown.value : 0,
      goalPauseSeconds: 0,
      blueScore: 0,
      orangeScore: 0,
      zeroSecondActive: false,
      lastScorer: null,
    },
    boostPads: BOOST_PAD_LAYOUT.map((pad) => ({ id: pad.id, active: true, respawnSeconds: 0 })),
  };
}
