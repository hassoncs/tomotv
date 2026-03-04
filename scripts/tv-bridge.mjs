#!/usr/bin/env node
/**
 * tv-bridge.mjs — WebSocket CLI bridge for Radmedia app control
 *
 * Node 24 native WebSocket (zero deps). Connects to the relay, sends
 * JSON-RPC commands, and returns responses.
 *
 * Usage:
 *   node tv-bridge.mjs '<json-rpc-payload>'
 *   node tv-bridge.mjs <method> [params-json]
 *
 * Examples:
 *   node tv-bridge.mjs '{"method":"state.status"}'
 *   node tv-bridge.mjs navigation.push '{"route":"/(tabs)/ai"}'
 *   node tv-bridge.mjs playback.play '{"jellyfinId":"abc123"}'
 */

const RELAY_URL = process.env.RADMEDIA_RELAY_URL || 'ws://openclaw.lan:9091/radmedia';
const TIMEOUT_MS = parseInt(process.env.RADMEDIA_TIMEOUT || '10000', 10);
const HELLO_ACK_TIMEOUT_MS = 3000;

// Parse args
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: tv-bridge.mjs <json-rpc-payload | method> [params-json]');
  process.exit(1);
}

let method, params;
const firstArg = args[0];

// Check if first arg is a JSON-RPC payload or a method name
if (firstArg.startsWith('{')) {
  // Full JSON-RPC payload
  try {
    const parsed = JSON.parse(firstArg);
    method = parsed.method;
    params = parsed.params;
  } catch (e) {
    console.error('tv-bridge: invalid JSON payload:', e.message);
    process.exit(1);
  }
} else {
  // Method name with optional params
  method = firstArg;
  if (args[1]) {
    try {
      params = JSON.parse(args[1]);
    } catch (e) {
      console.error('tv-bridge: invalid params JSON:', e.message);
      process.exit(1);
    }
  }
}

// Build JSON-RPC request
const requestId = `${process.pid}-${Date.now()}`;
const request = {
  jsonrpc: '2.0',
  method,
  id: requestId,
};
if (params !== undefined) {
  request.params = params;
}

// Connect and execute
const ws = new WebSocket(RELAY_URL);
let helloAckReceived = false;
let responseReceived = false;
let helloAckTimer;
let responseTimer;

ws.onopen = () => {
  ws.send('HELLO cli');
  
  // Fallback: send payload after HELLO_ACK timeout even if no ACK received
  // (relay might not be updated yet)
  helloAckTimer = setTimeout(() => {
    if (!helloAckReceived) {
      console.error('tv-bridge: HELLO_ACK timeout, sending payload anyway');
      ws.send(JSON.stringify(request));
      startResponseTimer();
    }
  }, HELLO_ACK_TIMEOUT_MS);
};

ws.onmessage = (event) => {
  const raw = event.data.toString();
  
  // Handle HELLO_ACK
  if (raw === 'HELLO_ACK') {
    clearTimeout(helloAckTimer);
    helloAckReceived = true;
    ws.send(JSON.stringify(request));
    startResponseTimer();
    return;
  }
  
  // Handle JSON-RPC response
  try {
    const msg = JSON.parse(raw);
    if (msg.id === requestId || (msg.id === null && msg.error)) {
      clearTimeout(responseTimer);
      responseReceived = true;
      console.log(JSON.stringify(msg));
      ws.close();
      process.exit(msg.error ? 1 : 0);
    }
  } catch (e) {
    console.error('tv-bridge: invalid JSON response:', raw.slice(0, 200));
    ws.close();
    process.exit(1);
  }
};

ws.onerror = (event) => {
  console.error('tv-bridge: WebSocket error:', event.message || 'unknown error');
  process.exit(1);
};

ws.onclose = (event) => {
  if (!responseReceived) {
    console.error('tv-bridge: connection closed before response');
    process.exit(1);
  }
};

function startResponseTimer() {
  responseTimer = setTimeout(() => {
    if (!responseReceived) {
      console.error('tv-bridge: response timeout');
      ws.close();
      process.exit(1);
    }
  }, TIMEOUT_MS);
}
