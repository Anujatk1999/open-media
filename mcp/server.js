#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ComposerBridge } from './bridge.js';
import { TOOLS } from './tools.js';

const bridge = new ComposerBridge();
const server = new McpServer({ name: 'shot-composer', version: '1.0.0' });

function toContent(command, result) {
  if (command === 'capture_shot' && result && typeof result.dataUrl === 'string') {
    const match = /^data:(.+?);base64,(.*)$/s.exec(result.dataUrl);
    if (match) {
      const [, mimeType, data] = match;
      return [{ type: 'image', data, mimeType }];
    }
  }
  return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
}

for (const { name, description, inputSchema } of TOOLS) {
  server.registerTool(name, { description, inputSchema }, async (args) => {
    try {
      const result = await bridge.sendCommand(name, args);
      return { content: toContent(name, result) };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  });
}

const transport = new StdioServerTransport();
await server.connect(transport);
