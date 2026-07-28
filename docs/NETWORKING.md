# Networking

The first milestone uses an authoritative Node.js WebSocket server at 120 Hz.

Implemented now:

- server-owned simulation tick;
- sequence-numbered input frames;
- duplicate and stale sequence rejection;
- periodic state snapshots;
- protocol version field;
- no acceptance of client position, velocity, boost or scoring state.

Not yet implemented:

- local prediction;
- reconciliation and correction smoothing;
- remote interpolation buffer;
- lobby/session authentication;
- packet reordering simulation;
- reconnect state transfer;
- authoritative car and match simulation.
