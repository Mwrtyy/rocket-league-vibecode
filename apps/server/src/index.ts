import { performance } from 'node:perf_hooks';
import { WebSocketServer, type WebSocket } from 'ws';
import { PROTOCOL_VERSION, parseClientMessage, type ServerMessage } from '@aether/networking';
import {
  FixedStepRunner,
  GameSimulation,
  NEUTRAL_INPUT,
  type PlayerInputFrame,
} from '@aether/simulation';

const port = Number(process.env.PORT ?? 8080);
const wss = new WebSocketServer({ port });
const simulation = new GameSimulation(undefined, { matchMode: true });
const lastSequence = new WeakMap<WebSocket, number>();
const pendingInput = new WeakMap<WebSocket, PlayerInputFrame>();
let driver: WebSocket | null = null;

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

function broadcastSnapshot(): void {
  const snapshot: ServerMessage = {
    type: 'snapshot',
    protocol: PROTOCOL_VERSION,
    state: simulation.getState(),
  };
  const payload = JSON.stringify(snapshot);
  for (const socket of wss.clients) {
    if (socket.readyState === socket.OPEN) socket.send(payload);
  }
}

function selectNextDriver(): void {
  driver = null;
  for (const candidate of wss.clients) {
    if (candidate.readyState === candidate.OPEN) {
      driver = candidate;
      break;
    }
  }
}

wss.on('connection', (socket) => {
  lastSequence.set(socket, -1);
  if (driver === null) driver = socket;
  send(socket, { type: 'welcome', protocol: PROTOCOL_VERSION, tick: simulation.getState().tick });

  socket.on('message', (data) => {
    const message = parseClientMessage(data.toString());
    if (message === null) {
      send(socket, {
        type: 'error',
        protocol: PROTOCOL_VERSION,
        code: 'BAD_MESSAGE',
        message: 'Invalid or incompatible message.',
      });
      return;
    }
    if (message.type !== 'input') return;

    const stateTick = simulation.getState().tick;
    const previous = lastSequence.get(socket) ?? -1;
    if (message.frame.sequence <= previous) {
      send(socket, {
        type: 'error',
        protocol: PROTOCOL_VERSION,
        code: 'STALE_INPUT',
        message: 'Input sequence must increase.',
      });
      return;
    }
    if (message.frame.tick < stateTick - 240 || message.frame.tick > stateTick + 240) {
      send(socket, {
        type: 'error',
        protocol: PROTOCOL_VERSION,
        code: 'INVALID_INPUT_TICK',
        message: 'Input tick is outside the accepted two-second simulation window.',
      });
      return;
    }

    lastSequence.set(socket, message.frame.sequence);
    pendingInput.set(socket, message.frame);
  });

  socket.on('close', () => {
    pendingInput.delete(socket);
    if (driver === socket) selectNextDriver();
  });
});

const runner = new FixedStepRunner(() => {
  const input = driver === null ? NEUTRAL_INPUT : (pendingInput.get(driver) ?? NEUTRAL_INPUT);
  simulation.step(input);
  if (simulation.getState().tick % 4 === 0) broadcastSnapshot();
});

let previousTime = performance.now();
let pumpTimer: NodeJS.Timeout | undefined;
function pump(): void {
  const now = performance.now();
  const elapsedSeconds = Math.min(0.1, Math.max(0, now - previousTime) / 1000);
  previousTime = now;
  runner.advance(elapsedSeconds);
  pumpTimer = setTimeout(pump, 1);
}
pump();

function shutdown(): void {
  if (pumpTimer !== undefined) clearTimeout(pumpTimer);
  wss.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`Aether Strike authoritative server listening on ws://localhost:${port}`);
