import { runCommand } from './commands';

/**
 * Must match BRIDGE_PORT in mcp/bridge.js — the two sides are separate
 * processes (browser tab vs. Node MCP server) with no shared build step, so
 * this constant is intentionally duplicated rather than imported.
 */
const BRIDGE_PORT = 39217;
const RECONNECT_DELAY_MS = 2000;

interface IncomingMessage {
  id: string;
  command: string;
  params: unknown;
}

let socket: WebSocket | null = null;
let loggedFirstAttempt = false;

function connect() {
  const ws = new WebSocket(`ws://localhost:${BRIDGE_PORT}`);
  socket = ws;

  ws.addEventListener('open', () => {
    console.info('[mcp-bridge] connected to local MCP server.');
  });

  ws.addEventListener('message', async (event) => {
    let message: IncomingMessage;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    const reply = await runCommand(message.command, message.params);
    ws.send(JSON.stringify({ id: message.id, ...reply }));
  });

  ws.addEventListener('close', () => {
    socket = null;
    setTimeout(connect, RECONNECT_DELAY_MS);
  });

  ws.addEventListener('error', () => {
    // No local MCP server running is the normal case for most users — log
    // once so it's discoverable, then retry quietly forever via 'close'.
    if (!loggedFirstAttempt) {
      loggedFirstAttempt = true;
      console.info('[mcp-bridge] no local MCP server found on port', BRIDGE_PORT, '(this is fine if you are not using an AI agent right now).');
    }
    ws.close();
  });
}

/** Called once on app load. Safe no-op if nothing is listening — see error handler above. */
export function startComposerBridge() {
  if (socket) return;
  connect();
}
