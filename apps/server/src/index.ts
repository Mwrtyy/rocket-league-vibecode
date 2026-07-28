import { performance } from 'node:perf_hooks';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  MAX_CLIENT_MESSAGE_LENGTH,
  PROTOCOL_VERSION,
  parseClientMessage,
  type ServerMessage,
} from '@aether/networking';
import {
  FixedStepRunner,
  GameSimulation,
  NEUTRAL_INPUT,
  type PlayerInputFrame,
} from '@aether/simulation';

const port = Number(process.env.PORT ?? 8080);
const wss = new WebSocketServer({
  port,
  maxPayload: MAX_CLIENT_MESSAGE_LENGTH,
  perMessageDeflate: false,
});
const simulation = new GameSimulation(undefined, { matchMode: true });
const lastSequence = new WeakMap<WebSocket, number>();
const pendingInput = new WeakMap<WebSocket, PlayerInputFrame>();
const rateWindows = new WeakMap<WebSocket, { startedAt: number; messages: number }>();
let driver: WebSocket | null = null;
let authoritativeTick = simulation.getState().tick;

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

function consumeMessageBudget(socket: WebSocket): boolean {
  const now = performance.now();
  const current = rateWindows.get(socket);
  if (current === undefined || now - current.startedAt >= 1000) {
    rateWindows.set(socket, { startedAt: now, messages: 1 });
    return true;
  }
  current.messages += 1;
  return current.messages <= 300;
}

wss.on('connection', (socket) => {
  lastSequence.set(socket, -1);
  rateWindows.set(socket, { startedAt: performance.now(), messages: 0 });
  if (driver === null) driver = socket;
  send(socket, { type: 'welcome', protocol: PROTOCOL_VERSION, tick: authoritativeTick });

  socket.on('message', (data) => {
    if (!consumeMessageBudget(socket)) {
      send(socket, {
        type: 'error',
        protocol: PROTOCOL_VERSION,
        code: 'RATE_LIMIT',
        message: 'Input message rate exceeded the accepted gameplay budget.',
      });
      socket.close(1008, 'Input rate exceeded');
      return;
    }

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
    if (
      message.frame.tick < authoritativeTick - 240 ||
      message.frame.tick > authoritativeTick + 240
    ) {
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
    rateWindows.delete(socket);
    if (driver === socket) selectNextDriver();
  });
});

const runner = new FixedStepRunner(() => {
  const input = driver === null ? NEUTRAL_INPUT : (pendingInput.get(driver) ?? NEUTRAL_INPUT);
  simulation.step(input);
  authoritativeTick += 1;
  if (authoritativeTick % 4 === 0) broadcastSnapshot();
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
