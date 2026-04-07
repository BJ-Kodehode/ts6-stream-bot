# API Reference

Complete API documentation for TS6 Stream Bot.

## Table of Contents

- [Core Classes](#core-classes)
- [TS6RestClient](#ts6restclient)
- [TS6Signaling](#ts6signaling)
- [LiveKitConnector](#livekit-connector)
- [FramePipeline](#framepipeline)
- [EventBus](#eventbus)
- [Types & Interfaces](#types--interfaces)

---

## Core Classes

### Bot

Main orchestrator for component lifecycle and setup.

```typescript
class Bot {
  constructor(config: BotConfig)
  
  register(component: BaseComponent): this
  async start(): Promise<void>
  async stop(): Promise<void>
}
```

#### Methods

##### `constructor(config: BotConfig)`
Creates a Bot instance with given configuration.

**Parameters:**
- `config` — Validated configuration object

**Example:**
```typescript
import { Bot } from './core/Bot.js';
import { loadConfig } from './config/config.js';

const config = loadConfig('config.yaml');
const bot = new Bot(config);
```

---

##### `register(component: BaseComponent): this`
Registers a component to be initialized with the bot.

**Parameters:**
- `component` — Instance of a component extending `BaseComponent`

**Returns:** `this` for method chaining

**Throws:** Error if called after `start()`

**Example:**
```typescript
bot
  .register(new StreamBridgeComponent())
  .register(new CommandComponent())
  .register(new AutoJoinComponent());
```

---

##### `async start(): Promise<void>`
Initializes all registered components and starts the bot.

**Process:**
1. Verifies TS6 connection
2. Initializes components in registration order
3. Emits `bot:ready` event
4. Sets up signal handlers (SIGINT, SIGTERM)

**Throws:** Error if TS6 connection fails or component init fails

**Example:**
```typescript
await bot.start();
console.log('Bot started!');
```

---

##### `async stop(): Promise<void>`
Gracefully shuts down bot and all components

**Process:**
1. Emits `bot:shutdown` event
2. Calls `onDestroy()` on all components (reverse order)
3. Exits process

**Example:**
```typescript
process.on('SIGINT', () => bot.stop());
```

---

### BaseComponent

Abstract base class for all bot components.

```typescript
abstract class BaseComponent {
  abstract readonly name: string
  abstract onInit(ctx: BotContext): Promise<void>
  abstract onDestroy(): Promise<void>
}
```

#### Properties

##### `name: string` (abstract)
Unique identifier for component.

**Example:**
```typescript
readonly name = 'my-component';
```

---

#### Methods

##### `abstract onInit(ctx: BotContext): Promise<void>`
Called when component is being initialized. Set up resources, listeners, connections here.

**Parameters:**
- `ctx` — BotContext with config, logger, eventBus, and ts6Api

**Throws:** Should throw on initialization error

**Example:**
```typescript
async onInit(ctx: BotContext): Promise<void> {
  ctx.logger.info(`[${this.name}] Initializing`);
  this.client = new MyClient();
  await this.client.connect();
}
```

---

##### `abstract onDestroy(): Promise<void>`
Called during shutdown. Clean up resources, close connections here.

**Example:**
```typescript
async onDestroy(): Promise<void> {
  await this.client.disconnect();
}
```

---

### EventBus

Centralized event dispatcher (extends EventEmitter3).

```typescript
class EventBus extends EventEmitter {
  on(event: string, listener: Function): this
  emit(event: string, ...args: any[]): boolean
  off(event: string, listener: Function): this
  once(event: string, listener: Function): this
  removeAllListeners(event?: string): this
}
```

#### Methods

##### `on(event: string, listener: Function): this`
Subscribe to events.

**Parameters:**
- `event` — Event name
- `listener` — Callback function

**Returns:** `this` for chaining

**Example:**
```typescript
context.eventBus.on('ts6:streamStarted', (clientId) => {
  console.log(`Stream started: ${clientId}`);
});
```

---

##### `emit(event: string, ...args: any[]): boolean`
Emit event to all listeners.

**Parameters:**
- `event` — Event name
- `...args` — Data to pass to listeners

**Returns:** `true` if event had listeners

**Example:**
```typescript
context.eventBus.emit('stream:ready', frameData);
```

---

##### `once(event: string, listener: Function): this`
Subscribe to single event emission only.

**Example:**
```typescript
context.eventBus.once('bot:ready', () => {
  console.log('Bot is ready!');
});
```

---

##### `off(event: string, listener: Function): this`
Unsubscribe from events.

**Example:**
```typescript
const handler = (data) => { /* ... */ };
context.eventBus.on('frame:processed', handler);
// Later...
context.eventBus.off('frame:processed', handler);
```

---

## TS6RestClient

HTTP REST client for TeamSpeak 6 API.

```typescript
class TS6RestClient {
  constructor(baseUrl: string, apiKey: string)
  
  async getServerInfo(): Promise<ServerInfo>
  async getClients(): Promise<Client[]>
  async getClient(clientId: string): Promise<Client>
  async getChannels(): Promise<Channel[]>
  async getChannel(channelId: string): Promise<Channel>
  async sendMessage(clientId: string, message: string): Promise<void>
  async kickClient(clientId: string, reason?: string): Promise<void>
  async moveClient(clientId: string, channelId: string): Promise<void>
  async getClient Permissions(clientId: string): Promise<Permission[]>
}
```

#### Methods

##### `constructor(baseUrl: string, apiKey: string)`
Creates API client instance.

**Parameters:**
- `baseUrl` — Base URL of TS6 REST API (e.g., `http://localhost:10080/v1`)
- `apiKey` — API key from TS6 client settings

**Example:**
```typescript
const api = new TS6RestClient(
  'http://localhost:10080/v1',
  'my-api-key'
);
```

---

##### `async getServerInfo(): Promise<ServerInfo>`
Retrieves server information.

**Returns:**
```typescript
interface ServerInfo {
  name: string;
  version: string;
  platform: string;
  uptime: number;
  maxClients: number;
  totalClients: number;
}
```

**Throws:** Error if API call fails

**Example:**
```typescript
const info = await context.ts6Api.getServerInfo();
console.log(`Server: ${info.name} (v${info.version})`);
```

---

##### `async getClients(): Promise<Client[]>`
Lists all connected clients.

**Returns:**
```typescript
interface Client {
  id: string;
  name: string;
  channelId: string;
  away: boolean;
  muted: boolean;
  deafened: boolean;
  recording: boolean;
  created: number;
}
```

**Throws:** Error if API call fails

**Example:**
```typescript
const clients = await context.ts6Api.getClients();
clients.forEach(c => console.log(`${c.name} in channel ${c.channelId}`));
```

---

##### `async getClient(clientId: string): Promise<Client>`
Retrieves specific client information.

**Parameters:**
- `clientId` — Client ID to fetch

**Returns:** `Client` object

**Throws:** Error if client not found or API fails

**Example:**
```typescript
const client = await context.ts6Api.getClient('client123');
console.log(client.name);
```

---

##### `async getChannels(): Promise<Channel[]>`
Lists all channels on server.

**Returns:**
```typescript
interface Channel {
  id: string;
  name: string;
  parentId?: string;
  order: number;
  temporary: boolean;
  maxClients: number;
  totalClients: number;
  topic?: string;
}
```

**Example:**
```typescript
const channels = await context.ts6Api.getChannels();
```

---

##### `async sendMessage(clientId: string, message: string): Promise<void>`
Sends direct message to client.

**Parameters:**
- `clientId` — Target client ID
- `message` — Message text

**Throws:** Error if client not found or sending fails

**Example:**
```typescript
await context.ts6Api.sendMessage('client123', 'Hello!');
```

---

##### `async kickClient(clientId: string, reason?: string): Promise<void>`
Disconnects a client from server.

**Parameters:**
- `clientId` — Client to kick
- `reason` (optional) — Kick reason message

**Throws:** Error if client not found or kick fails

**Example:**
```typescript
await context.ts6Api.kickClient('spammer', 'Spam detected');
```

---

##### `async moveClient(clientId: string, channelId: string): Promise<void>`
Moves client to different channel.

**Parameters:**
- `clientId` — Client to move
- `channelId` — Target channel ID

**Throws:** Error if operation fails

**Example:**
```typescript
await context.ts6Api.moveClient('client123', 'channel456');
```

---

## TS6Signaling

WebSocket signaling protocol handler for TS6.

```typescript
class TSSignaling extends EventEmitter {
  async connect(url: string): Promise<void>
  async authenticate(identity: string, apiKey: string): Promise<void>
  async disconnect(): Promise<void>
  async requestStream(clientId: string): Promise<void>
  async stopStream(): Promise<void>
}
```

#### Methods

##### `async connect(url: string): Promise<void>`
Establishes WebSocket connection to TS6.

**Parameters:**
- `url` — WebSocket URL (e.g., `ws://localhost:9987`)

**Emits:** `ts6:connected`

**Throws:** Error if connection fails

**Example:**
```typescript
const signaling = new TSSignaling(eventBus);
await signaling.connect('ws://localhost:9987');
```

---

##### `async authenticate(identity: string, apiKey: string): Promise<void>`
Authenticates with TS6 server.

**Parameters:**
- `identity` — Bot identity name
- `apiKey` — API key from TS6 client settings

**Throws:** Error if authentication fails

**Example:**
```typescript
await signaling.authenticate('ts6-bot', 'my-api-key');
```

---

##### `async disconnect(): Promise<void>`
Closes WebSocket connection.

**Emits:** `ts6:disconnected`

**Example:**
```typescript
await signaling.disconnect();
```

---

##### `async requestStream(clientId: string): Promise<void>`
Requests H.264 stream from specific client.

**Parameters:**
- `clientId` — Client to stream from

**Emits:** `ts6:streamStarted(clientId)`

**Example:**
```typescript
await signaling.requestStream('client123');
```

---

##### `async stopStream(): Promise<void>`
Stops receiving stream from client.

**Emits:** `ts6:streamStopped`

**Example:**
```typescript
await signaling.stopStream();
```

---

## LiveKit Connector

Integration with LiveKit for video streaming.

```typescript
class LiveKitConnector {
  async connect(url: string, token: string): Promise <void>
  async joinRoom(roomName: string): Promise<void>
  async leaveRoom(): Promise<void>
  async publishVideo(frame: H264Frame): Promise<void>
  async disconnect(): Promise<void>
}
```

#### Methods

##### `async connect(url: string, token: string): Promise<void>`
Connects to LiveKit server.

**Parameters:**
- `url` — LiveKit WebSocket URL
- `token` — JWT access token

**Emits:** `livekit:connected`

**Throws:** Error if connection fails

**Example:**
```typescript
const connector = new LiveKitConnector();
await connector.connect('ws://localhost:7880', jwtToken);
```

---

##### `async joinRoom(roomName: string): Promise<void>`
Joins specific room and starts publishing.

**Parameters:**
- `roomName` — Target room name

**Returns:** When fully connected and ready to publish

**Throws:** Error if join fails

**Example:**
```typescript
await connector.joinRoom('ts6-stream');
```

---

##### `async publishVideo(frame: H264Frame): Promise<void>`
Publishes H.264 video frame to room.

**Parameters:**
- `frame` — H264Frame object with encoded video data

**Throws:** Error if publish fails (e.g., not in room)

**Example:**
```typescript
await connector.publishVideo({
  data: Buffer.from(...),
  isKeyframe: true,
  timestamp: 1234567890,
  sps: spsBuf,
  pps: ppsBuf
});
```

---

##### `async disconnect(): Promise<void>`
Closes LiveKit connection and leaves room.

**Emits:** `livekit:disconnected`

---

## FramePipeline

Orchestrates H.264 frame assembly and publishing.

```typescript
class FramePipeline {
  constructor(
    livekit: LiveKitConnector,
    eventBus: EventBus
  )
  
  feedPacket(packet: RawH264Frame): Promise<void>
  flush(): Promise<void>
}
```

#### Methods

##### `feedPacket(packet: RawH264Frame): Promise<void>`
Feeds raw H.264 packet to pipeline for processing.

**Parameters:**
- `packet` — Raw H264 frame from TS6

```typescript
interface RawH264Frame {
  data: Buffer;
  timestamp: number;
  userId?: string;
}
```

**Emits:** `frame:processed` when complete frame assembled

**Example:**
```typescript
pipeline.feedPacket({
  data: Buffer.from([0x67, 0x42, ...]),
  timestamp: Date.now(),
  userId: 'client123'
});
```

---

##### `flush(): Promise<void>`
Flushes any buffered frames (useful on stream end).

**Example:**
```typescript
await pipeline.flush();
```

---

## Types & Interfaces

### BotConfig

Main configuration interface.

```typescript
interface BotConfig {
  teamspeak: {
    apiUrl:      string;
    apiKey:      string;
    wsUrl:       string;
    webhookPort: number;
  };
  livekit: {
    url:       string;
    apiKey:    string;
    apiSecret: string;
    roomName:  string;
  };
  bot: {
    identity: string;
    logLevel: string;   // 'debug' | 'info' | 'warn' | 'error'
  };
}
```

---

### BotContext

Context object passed to all components.

```typescript
interface BotContext {
  config:   BotConfig;
  ts6Api:   TS6RestClient;
  eventBus: EventBus;
  logger:   Logger; // Winston Logger
}
```

---

### H264Frame

Assembled and ready-to-publish H.264 frame.

```typescript
interface H264Frame {
  data:       Buffer;           // Complete frame payload
  isKeyframe: boolean;          // true for I-frames
  timestamp:  number;           // RTP timestamp
  sps?:       Buffer;           // Sequence Parameter Set
  pps?:       Buffer;           // Picture Parameter Set
}
```

---

### Standard Events

| Event | Data | Source | Handler |
|-------|------|--------|---------|
| `bot:ready` | none | Bot | `() => void` |
| `bot:shutdown` | none | Bot | `() => void` |
| `ts6:connected` | none | TSSignaling | `() => void` |
| `ts6:disconnected` | none | TSSignaling | `() => void` |
| `ts6:streamStarted` | clientId: string | TSSignaling | `(clientId) => void` |
| `ts6:streamStopped` | clientId: string | TSSignaling | `(clientId) => void` |
| `ts6:clientJoined` | clientId: string, name: string | - | `(clientId, name) => void` |
| `ts6:clientLeft` | clientId: string | - | `(clientId) => void` |
| `livekit:connected` | roomName: string | LiveKitConnector | `(roomName) => void` |
| `livekit:disconnected` | roomName: string | LiveKitConnector | `(roomName) => void` |
| `frame:processed` | frame: H264Frame | FramePipeline | `(frame) => void` |
| `command:received` | command: string, args: string[] | CommandComponent | `(cmd, args) => void` |

---

## Examples

### Complete Component Example

```typescript
import { BaseComponent } from '../components/BaseComponent.js';
import type { BotContext } from '../core/types.js';

export class MyComponent extends BaseComponent {
  readonly name = 'my-component';
  private context!: BotContext;

  async onInit(ctx: BotContext): Promise<void> {
    this.context = ctx;
    
    ctx.logger.info(`[${this.name}] Initializing`);
    
    // Subscribe to events
    ctx.eventBus.on('bot:ready', () => {
      ctx.logger.info(`[${this.name}] Bot is ready!`);
    });
    
    ctx.eventBus.on('ts6:streamStarted', (clientId) => {
      ctx.logger.info(`[${this.name}] Stream started from ${clientId}`);
    });
  }

  async onDestroy(): Promise<void> {
    this.context.logger.info(`[${this.name}] Destroying`);
  }
}
```

### Using TS6RestClient

```typescript
// In a component's onInit:
async onInit(ctx: BotContext): Promise<void> {
  try {
    // Get server info
    const info = await ctx.ts6Api.getServerInfo();
    ctx.logger.info(`Connected to ${info.name}`);
    
    // List clients
    const clients = await ctx.ts6Api.getClients();
    for (const client of clients) {
      ctx.logger.info(`Client: ${client.name} (${client.id})`);
    }
  } catch (err) {
    ctx.logger.error('API error:', err);
  }
}
```

### Emitting and Listening to Events

```typescript
// Emit event
context.eventBus.emit('stream:ready', {
  clientId: 'client123',
  resolution: '1920x1080'
});

// Listen for event
context.eventBus.on('stream:ready', (data) => {
  console.log(`Stream ready: ${data.clientId} at ${data.resolution}`);
});

// One-time listener
context.eventBus.once('bot:ready', () => {
  console.log('This fires only once');
});
```

---

**Last Updated**: 2024-01-15
