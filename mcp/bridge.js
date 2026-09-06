import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';

// Must match BRIDGE_PORT in src/modules/mcpBridge/socket.ts — the two sides
// are separate processes with no shared build step, so this is intentionally
// duplicated rather than imported.
export const BRIDGE_PORT = 39217;
const REPLY_TIMEOUT_MS = 15000;

/**
 * One local WebSocket server that a single Shot Composer browser tab connects
 * to. Bridges MCP tool calls (Node process, stdio) to real composerStore
 * actions (browser process, in-memory) by forwarding {id, command, params}
 * and waiting for the matching {id, ok, result|error} reply.
 */
export class ComposerBridge {
  constructor() {
    this.browser = null;
    this.pending = new Map();
    this.wss = new WebSocketServer({ port: BRIDGE_PORT });

    this.wss.on('connection', (ws) => {
      // Only one Shot Composer tab is expected at a time; a new connection
      // (e.g. a page reload) simply replaces the old one.
      this.browser = ws;
      ws.on('message', (data) => this._handleReply(data));
      ws.on('close', () => {
        if (this.browser === ws) this.browser = null;
      });
    });
  }

  _handleReply(data) {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }
    const waiting = this.pending.get(message.id);
    if (!waiting) return;
    this.pending.delete(message.id);
    clearTimeout(waiting.timeout);
    if (message.ok) waiting.resolve(message.result);
    else waiting.reject(new Error(message.error ?? 'Unknown Shot Composer error.'));
  }

  /** Sends a command to the connected browser tab and resolves with its result, or rejects on error/timeout/no connection. */
  sendCommand(command, params) {
    if (!this.browser || this.browser.readyState !== this.browser.OPEN) {
      return Promise.reject(new Error(
        'No Shot Composer tab is connected. Open the app (npm run dev, then visit the composer) in a browser and try again.',
      ));
    }

    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Shot Composer did not respond to "${command}" in time.`));
      }, REPLY_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timeout });
      this.browser.send(JSON.stringify({ id, command, params }));
    });
  }
}
