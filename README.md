# TS6 Stream Bot

A TypeScript-based bridge bot that connects **TeamSpeak 6** servers to **LiveKit** for real-time video streaming and conferencing. This bot enables screensharing, stream handling, and client management between TeamSpeak and LiveKit ecosystems.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Bot](#running-the-bot)
- [Components](#components)
- [API Reference](#api-reference)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

**TS6 Stream Bot** is a middleware application that:

1. **Bridges TeamSpeak 6 ↔ LiveKit**: Synchronizes streams and clients between two communication platforms
2. **Handles H.264 Video**: Processes and assembles H.264 video frames from TS6 WebRTC streams
3. **Manages Clients**: Automatically joins/leaves rooms and manages connection state
4. **Provides Commands**: Offers chat commands for status monitoring, client management, and debugging
5. **Logs & Monitors**: Comprehensive logging with Winston for diagnosing connection issues

**Use Cases:**
- Stream desktop/webcam from TeamSpeak to LiveKit audience
- Create hybrid conferences combining both platforms
- Automate client room management
- Debug connection and streaming issues

---

## ✨ Features

### Core Features
- ✅ **Stream Bridging**: TS6 WebRTC video → H.264 → LiveKit streaming
- ✅ **Real-time H.264 Parsing**: Assembles fragmented video packets into complete frames
- ✅ **WebSocket Signaling**: Two-way signaling protocol with TS6 servers
- ✅ **REST API Integration**: Queries TS6 server state (clients, channels, info)
- ✅ **Event-Driven Architecture**: EventEmitter3-based component communication
- ✅ **Configurable Logging**: Winston logger with adjustable levels
- ✅ **Component Registration**: Pluggable architecture for extending functionality

### Included Components
- **StreamBridgeComponent**: Main bridging logic (TS6 → LiveKit)
- **CommandComponent**: Chat command handler (!status, !kick, !clients, etc.)
- **AutoJoinComponent**: Auto-joins clients when they appear on TS6
- **DebugComponent**: Development-only diagnostics (marked for removal in production)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TS6 Stream Bot                        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────┐         ┌──────────────────┐       │
│  │   Components    │◄────────┤   Event Bus      │       │
│  │  (Pluggable)    │         │  (EventEmitter3) │       │
│  └─────────────────┘         └──────────────────┘       │
│         │                             │                  │
│         ▼                             │                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │   StreamBridgeComponent (Main)                  │   │
│  │  ┌──────────┐  ┌─────────────┐  ┌────────────┐ │   │
│  │  │TSSignal  │→ │FramePipeline│→ │ LiveKit    │ │   │
│  │  │ing (WS)  │  │ (H.264)     │  │Connector   │ │   │
│  │  └──────────┘  └─────────────┘  └────────────┘ │   │
│  └─────────────────────────────────────────────────┘   │
│         │                      │                        │
│         │                      │                        │
│    ┌────▼─────┐          ┌────▼──────────┐            │
│    │TS6 Server│          │  LiveKit      │            │
│    │(REST API)│          │  Room/Stream  │            │
│    │(WebSocket)          │               │            │
│    └──────────┘          └────────────────┘            │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
TS6 WebRTC Stream
    ↓
TSSignaling (WebSocket)
    ↓
RawH264Frame packets
    ↓
H264PacketParser → H264FrameAssembler
    ↓
Complete H264Frame (with SPS/PPS)
    ↓
FramePipeline
    ↓
LiveKit Connector
    ↓
LiveKit Room Stream
```

### Key Modules

| Module | Purpose |
|--------|---------|
| **Bot.ts** | Main orchestrator; manages component lifecycle |
| **EventBus.ts** | Centralized event broadcasting (EventEmitter3 wrapper) |
| **components/** | Pluggable modules for different features |
| **connectors/TS6Client/** | TS6 WebSocket protocol (signaling, WebRTC, protocol) |
| **connectors/LiveKitConnector.ts** | LiveKit integration (streaming to rooms) |
| **pipeline/** | H.264 frame processing (parsing, assembly) |
| **api/TS6RestClient.ts** | TS6 REST API client (server info, clients, channels) |
| **config/** | Configuration loading and logging setup |

---

## 📦 Prerequisites

### Required Software
- **Node.js** 18+ (for ES modules support)
- **TypeScript** 5.7+
- **TS6 Server** 6.0+ with webhooks enabled
- **LiveKit Server** (local or cloud instance)

### Required Credentials
- **TS6 API Key**: Generated in TS6 client settings → API Keys
- **TS6 WebSocket URL**: Typically `ws://localhost:9987`
- **LiveKit API Key & Secret**: From LiveKit configuration
- **LiveKit URL**: WebSocket address of LiveKit server

---

## 🚀 Installation

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd ts6-stream-bot
npm install
```

### 2. TypeScript Compilation (Optional)

```bash
npm run build
# Outputs to dist/
```

### 3. Verify Setup

```bash
npm run dev
# Should connect to TS6 and LiveKit if config is correct
```

---

## ⚙️ Configuration

### config.yaml

Create or update `config.yaml` in the project root:

```yaml
# TeamSpeak 6 Configuration
teamspeak:
  # REST API endpoint
  apiUrl: "http://localhost:10080/v1"
  # API key from TS6 client settings
  apiKey: "your-ts6-api-key"
  # WebSocket endpoint for signaling
  wsUrl: "ws://localhost:9987"
  # Port for webhook events
  webhookPort: 3000

# LiveKit Configuration
livekit:
  url:       "ws://localhost:7880"   # LiveKit WebSocket
  apiKey:    "devkey"                 # LiveKit API key
  apiSecret: "secret"                 # LiveKit API secret
  roomName:  "ts6-stream"             # Target room name

# Bot Settings
bot:
  identity: "ts6-stream-bot"          # Bot identifier in TS6
  logLevel: "info"                    # debug | info | warn | error
```

### Environment Variables (Alternative)

Instead of `config.yaml`, you can use environment variables:

```bash
export TS6_API_URL="http://localhost:10080/v1"
export TS6_API_KEY="your-key"
export TS6_WS_URL="ws://localhost:9987"
export LIVEKIT_URL="ws://localhost:7880"
export LIVEKIT_API_KEY="devkey"
export LIVEKIT_API_SECRET="secret"
export BOT_LOGEVEL="info"
```

---

## ▶️ Running the Bot

### Development Mode

```bash
npm run dev
```
- Runs with `tsx` (no compilation needed)
- Watches for changes where applicable
- Full logging output

### Production Mode

```bash
npm run build
npm start
```
- Compiles TypeScript to `dist/`
- Runs from compiled JavaScript
- Faster startup

### Running Tests

```bash
npm test
# Runs Vitest test suite
```

### Example Output

```
2024-01-15 10:30:45 info:  [Bot] Starts...
2024-01-15 10:30:45 info:  [Bot] TS6 connected — server: My Server
2024-01-15 10:30:45 info:  [Bot] Init: stream-bridge
2024-01-15 10:30:46 info:  [StreamBridge] Ready — waiting for screenshare from TS6
2024-01-15 10:30:46 info:  [Bot] Ready — 4 component(s) active
```

---

## 🧩 Components

### StreamBridgeComponent

**Purpose**: Main bridging logic between TS6 and LiveKit

**Responsibilities:**
- Connects to TS6 via WebSocket (TSSignaling)
- Receives H.264 video frames from TS6 streams
- Processes frames through FramePipeline
- Sends frames to LiveKit room

**Events Consumed:**
- `ts6:streamStarted` → Start bridging
- `ts6:streamStopped` → Stop bridging

**Events Emitted:**
- `stream:connected`
- `stream:disconnected`
- `frame:processed`

---

### CommandComponent

**Purpose**: Handle chat commands from TS6 clients

**Supported Commands:**
- `!status` — Shows current bot status and connections
- `!clients` — Lists connected TS6 clients
- `!kick <clientId>` — Disconnect a client
- `!bridge <on|off>` — Enable/disable streaming

**Configuration:**
- Prefix: `!` (hardcoded; can be made configurable)
- Permissions: None (all users can execute)

---

### AutoJoinComponent

**Purpose**: Automatically follow streamers between channels

**Behavior:**
- Monitors TS6 channel changes
- Automatically joins when target client joins a channel
- Useful for keeping bot synchronized with stream source

**Configuration:**
- Target client ID: Currently hardcoded (can be made configurable)

---

### DebugComponent

**Purpose**: Development diagnostics and troubleshooting

**Features:**
- Logs all incoming messages
- Reports protocol errors
- Performance metrics (frame count, bitrate)

**⚠️ Note**: Marked for removal in production (see `src/components/DebugComponent.ts`)

---

## 📡 API Reference

### TS6RestClient

```typescript
// Initialized and provided via BotContext

// Get server info
const info = await context.ts6Api.getServerInfo();
// Returns: { name: string, version: string, ... }

// List all connected clients
const clients = await context.ts6Api.getClients();
// Returns: Client[]

// Get specific client info
const client = await context.ts6Api.getClient(clientId);

// List channels
const channels = await context.ts6Api.getChannels();

// Send message to client
await context.ts6Api.sendMessage(clientId, "Hello!");

// Disconnect client
await context.ts6Api.kickClient(clientId);
```

### Event Bus

```typescript
// Subscribe to event
context.eventBus.on('event-name', (data) => {
  console.log('Event:', data);
});

// Emit event
context.eventBus.emit('event-name', { foo: 'bar' });

// Remove listener
context.eventBus.off('event-name', handler);
```

### Core Events

| Event | Data | Source |
|-------|------|--------|
| `bot:ready` | none | Bot |
| `bot:shutdown` | none | Bot |
| `ts6:connected` | none | TSSignaling |
| `ts6:disconnected` | none | TSSignaling |
| `ts6:streamStarted` | clientId | TSSignaling |
| `ts6:streamStopped` | clientId | TSSignaling |
| `livekit:connected` | roomName | LiveKitConnector |
| `livekit:disconnected` | roomName | LiveKitConnector |
| `frame:processed` | H264Frame | FramePipeline |

---

## 🛠️ Development

### Project Structure

```
src/
├── index.ts                          # Entry point; initializes Bot
├── core/
│   ├── Bot.ts                        # Main orchestrator
│   ├── EventBus.ts                   # Event dispatching
│   └── types.ts                      # Shared TypeScript interfaces
├── config/
│   ├── config.ts                     # Configuration loader (YAML)
│   └── logger.ts                     # Winston logger setup
├── components/                       # Pluggable bot components
│   ├── BaseComponent.ts              # Abstract base class
│   ├── StreamBridgeComponent.ts      # Main bridging logic
│   ├── CommandComponent.ts           # Chat commands
│   ├── AutoJoinComponent.ts          # Auto-join channels
│   └── DebugComponent.ts             # Debug/dev helper
├── connectors/
│   ├── LiveKitConnector.ts           # LiveKit integration
│   └── TS6Client/
│       ├── TSSignaling.ts            # WebSocket signaling
│       ├── TSWebRTC.ts               # WebRTC connections
│       └── TSProtocol.ts             # TS6 protocol messages
├── api/
│   └── TS6RestClient.ts              # TS6 REST API client
└── pipeline/
    ├── FramePipeline.ts              # Orchestrates frame processing
    ├── H264FrameAssembler.ts         # Assembles fragmented frames
    └── H264PacketParser.ts           # Parses H.264 packets
```

### Adding a New Component

1. Create file: `src/components/MyComponent.ts`
2. Extend `BaseComponent`:

```typescript
import { BaseComponent } from './BaseComponent.js';
import type { BotContext } from '../core/types.js';

export class MyComponent extends BaseComponent {
  readonly name = 'my-component';

  async onInit(ctx: BotContext): Promise<void> {
    ctx.logger.info('[MyComponent] Initialized');
    // Setup logic here
  }

  async onDestroy(): Promise<void> {
    ctx.logger.info('[MyComponent] Destroyed');
    // Cleanup logic here
  }
}
```

3. Register in `src/index.ts`:

```typescript
bot.register(new MyComponent());
```

### Code Style

- **Language**: TypeScript 5.7+
- **Module System**: ES Modules (`.ts` files use `.js` imports)
- **Async**: Promises/async-await
- **Comments**: Norwegian language in code comments
- **Logging**: Winston via `context.logger`

### Scripts

```bash
npm run dev         # Development with tsx
npm run build       # Compile TypeScript
npm start           # Run compiled code
npm test            # Run tests with Vitest
```

---

## 🔧 Troubleshooting

### Bot Won't Connect to TS6

**Error**: `TS6 REST API unavailable`

**Solutions:**
1. Check `apiUrl` in `config.yaml` matches TS6 REST port (usually `10080`)
2. Verify API key is correct (generated in TS6 client)
3. Ensure TS6 server is running: `curl http://localhost:10080/v1/info`
4. Check firewall/network connectivity

### No Video from TS6 to LiveKit

**Steps to debug:**
1. Check `streamStarted` event is fired:
   - Look for `[StreamBridge] Stream started by: <clientId>` in logs
2. Verify FramePipeline is receiving H.264 frames:
   - Look for `[H264FrameAssembler] Frame assembled` logs
3. Check LiveKit connection:
   - Look for `[LiveKit] Connected to room: ts6-stream`

**Enable Debug Logging:**
```yaml
bot:
  logLevel: "debug"  # See all details
```

### WebSocket Connection Timeouts

**Possible causes:**
- TS6 `wsUrl` is incorrect (default: `ws://localhost:9987`)
- Network firewall blocking port 9987
- TS6 server not listening on WebSocket

**Fix:**
```bash
# Test connectivity
nc -zv localhost 9987
```

### Memory Leak / High CPU Usage

**Investigation:**
1. Enable debug logging to find long-running operations
2. Check for missing event listeners cleanup in components
3. Ensure `onDestroy()` is properly called in all components

**Monitoring:**
```bash
# Run with Node profiling
node --inspect dist/index.js
# Open chrome://inspect in Chromium browser
```

---

## 📝 Additional Resources

### TeamSpeak 6 Documentation
- [TS6 REST API](https://ts6-api.example.com)
- [TS6 WebSocket Protocol](https://ts6-ws.example.com)

### LiveKit Documentation
- [LiveKit JavaScript SDK](https://docs.livekit.io/js)
- [LiveKit REST API](https://docs.livekit.io/reference)

### Related Tools
- [Zod](https://zod.dev/) — Schema validation
- [Winston](https://github.com/winstonjs/winston) — Logging
- [EventEmitter3](https://github.com/primus/eventemitter3) — Event system

---

## 📄 License

[Add your license here]

## 🤝 Contributing

[Add contribution guidelines here]

---

**Last Updated**: 2024-01-15  
**Version**: 0.1.0
