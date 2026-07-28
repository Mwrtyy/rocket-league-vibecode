import { WebSocketServer, type WebSocket } from 'ws';
import { PROTOCOL_VERSION, parseClientMessage, type ServerMessage } from '@aether/networking';
import { FIXED_DT, ReferenceBallSimulation, type PlayerInputFrame } from '@aether/simulation';

const port = Number(process.env.PORT ?? 8080);
const wss = new WebSocketServer({ port });
const simulation = new ReferenceBallSimulation();
const lastSequence = new WeakMap<WebSocket, number>();
const pendingInput = new WeakMap<WebSocket, PlayerInputFrame>();

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

wss.on('connection', (socket) => {
  lastSequence.set(socket, -1);
  send(socket, { type: 'welcome', protocol: PROTOCOL_VERSION, tick: simulation.getState().tick });

  socket.on('message', (data) => {
    const message = parseClientMessage(data.toString());
    if (message === null) {
      send(socket, { type: 'error', protocol: PROTOCOL_VERSION, code: 'BAD_MESSAGE', message: 'Invalid or incompatible message.' });
      return;
    }
    if (message.type !== 'input') return;
    const previous = lastSequence.get(socket) ?? -1;
    if (message.frame.sequence <= previous) {
      send(socket, { type: 'error', protocol: PROTOCOL_VERSION, code: 'STALE_INPUT', message: 'Input sequence must increase.' });
      return;
    }
    lastSequence.set(socket, message.frame.sequence);
    pendingInput.set(socket, message.frame);
  });
});

const interval = setInterval(() => {
  // Ball-only milestone: inputs are validated and buffered but cannot yet affect a car.
  for (const socket of wss.clients) pendingInput.delete(socket);
  simulation.step(undefined, FIXED_DT);
  const state = simulation.getState();
  if (state.tick % 4 === 0) {
    const snapshot: ServerMessage = { type: 'snapshot', protocol: PROTOCOL_VERSION, state };
    const payload = JSON.stringify(snapshot);
    for (const socket of wss.clients) if (socket.readyState === socket.OPEN) socket.send(payload);
  }
}, FIXED_DT * 1000);

function shutdown(): void {
  clearInterval(interval);
  wss.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`Aether Strike authoritative server listening on ws://localhost:${port}`);
