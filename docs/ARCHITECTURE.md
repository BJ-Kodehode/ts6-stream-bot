# Architecture Guide

Detailed architectural documentation for TS6 Stream Bot.

## Table of Contents

- [System Architecture](#system-architecture)
- [Component Lifecycle](#component-lifecycle)
- [Data Flow](#data-flow)
- [H.264 Video Pipeline](#h264-video-pipeline)
- [Event System](#event-system)
- [Configuration System](#configuration-system)
- [Error Handling](#error-handling)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                  TS6 Stream Bot Layer                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│   Application Layer (Components)                        │
│   ┌─────────────────────────────────────────────────┐  │
│   │ StreamBridgeComponent  CommandComponent         │  │
│   │ AutoJoinComponent      DebugComponent           │  │
│   └─────────────────────────────────────────────────┘  │
│                       │                                  │
│   ─────────────────────┼──────────────────────────────  │
│                       │                                  │
│   Core Services Layer                                  │
│   ┌──────────────┐  ┌──────────────┐                  │
│   │  EventBus    │  │  BotContext  │                  │
│   │ (EventEmitter│  │ - config     │                  │
│   │   3)         │  │ - logger     │                  │
│   └──────────────┘  │ - ts6Api     │                  │
│                     │ - eventBus   │                  │
│                     └──────────────┘                  │
│                       │                                  │
│   ─────────────────────┼──────────────────────────────  │
│                       │                                  │
│   Integration Layer                                    │
│   ┌─────────────────┐  ┌──────────────────┐           │
│   │  TS6Client      │  │ LiveKitConnector │           │
│   │ - Signaling     │  │ - Room Join      │           │
│   │ - Protocol      │  │ - Stream Publish │           │
│   │ - WebRTC        │  │ - Participant    │           │
│   └─────────────────┘  └──────────────────┘           │
│         │                       │                       │
│   ─────────────────────┬────────┬────────────────────  │
│                        │        │                       │
└────────────────────────┼────────┼───────────────────────┘
                         │        │
              ┌──────────▼─┐  ┌──▼──────────┐
              │ TS6 Server │  │ LiveKit     │
              │ (WebSocket)│  │ Server      │
              └────────────┘  └─────────────┘
```

### Module Responsibilities

| Module | Responsibility | Key Files |
|--------|---|---|
| **Bot** | Lifecycle management & component orchestration | `core/Bot.ts` |
| **Components** | Feature implementation & business logic | `components/*.ts` |
| **TS6Client** | TS6 protocol, signaling, WebRTC | `connectors/TS6Client/` |
| **LiveKitConnector** | LiveKit room management & publishing | `connectors/LiveKitConnector.ts` |
| **FramePipeline** | H.264 frame processing & assembly | `pipeline/` |
| **EventBus** | Inter-component communication | `core/EventBus.ts` |
| **Config** | Configuration loading & validation | `config/` |

---

## Component Lifecycle

### Initialization Sequence

```
┌─────────────────────────────────────────────┐
│ main() in index.ts                          │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│ loadConfig('config.yaml')                   │
│ - Read YAML file                            │
│ - Parse & validate with Zod                 │
│ - Return BotConfig                          │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│ new Bot(config)                             │
│ - Create EventBus                           │
│ - Create TS6RestClient                      │
│ - Create BotContext                         │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│ bot.register(component)                     │
│ - Add to Map<name, component>               │
│ - Log registration                          │
│ (Repeat for each component)                 │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│ bot.start()                                 │
│ 1. Set running = true                       │
│ 2. Verify TS6 connection (getServerInfo)    │
│ 3. For each component:                      │
│    - Call component.onInit(context)         │
│ 4. Emit 'bot:ready' event                   │
│ 5. Set up signal handlers (SIGINT, SIGTERM) │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│ Components Running                          │
│ - All event listeners active                │
│ - Connections established                   │
│ - Processing streams                        │
└─────────────────────────────────────────────┘
```

### Shutdown Sequence

```
SIGINT/SIGTERM
     │
     ▼
bot.stop()
│
├─ Log shutdown start
├─ Emit 'bot:shutdown' event
├─ For each component (in reverse order):
│  └─ Call component.onDestroy()
├─ Set running = false
└─ process.exit(0)
```

---

## Data Flow

### Stream Bridging Flow

```
TS6 WebRTC Connection
│
├─ Video Codec: H.264
├─ Transport: RTP over UDP
└─ Container: WebRTC (SRTP)
│
▼
TSSignaling.connect()
│ - Open WebSocket to TS6
│ - Send HELLO message
│ - Authenticate with API key
│
▼
TS6 sends RawH264Frame packets
│ - NALU units (header + payload)
│ - Fragmented (multiple packets per frame)
│ - Timestamps for synchronization
│
▼
H264PacketParser.parse()
│ - Extract NALU type
│ - Identify SPS/PPS (sequence/picture params)
│ - Extract frame data
│
▼
H264FrameAssembler.assemble()
│ - Collect packets with same timestamp
│ - Buffer until key frame (I-frame)
│ - Combine into complete H264Frame
│ - Attach SPS/PPS
│
▼
FramePipeline.process()
│ - Queue frame
│ - Emit 'frame:processed' event
│
▼
LiveKitConnector.publishFrame()
│ - Send to LiveKit via RTP
│ - Update frame timestamp
│ - Handle loss/retransmission
│
▼
LiveKit Room
```

### Temporal Behavior

```
Time Axis (ms)
├─────────────────────┬─────────────────────┬─────────────────────┐
│  Frame 1            │  Frame 2            │  Frame 3            │
├─────────────────────┼─────────────────────┼─────────────────────┤
│                     │                     │                     │
│ Packets: [1a,1b,1c] │ Packets: [2a,2b]    │ Packets: [3a,3b,3c,3d]
│ Assembly: ────────▶ │ Assembly: ────────▶ │ Assembly: ────────▶
│ Ready at: t=100ms   │ Ready at: t=200ms   │ Ready at: t=300ms   │
│ Sent: ────────────▶ │ Sent: ────────────▶ │ Sent: ────────────▶
│                     │                     │                     │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

---

## H.264 Video Pipeline

### Frame Assembly Process

```
Raw H.264 NAL Units (Network Abstraction Layer)
│
├─ SPS (Sequence Parameter Set)
│  └─ Codec configuration
│     - Resolution, frame rate, profile
│     - Sent once per stream
│
├─ PPS (Picture Parameter Set)
│  └─ Per-frame configuration
│
├─ I-Frame (Intra-coded, Key Frame)
│  └─ Complete image data
│     - Can decode independently
│     - Every ~ 1-5 seconds
│
├─ P-Frame (Predicted)
│  └─ Differential data
│     - Based on previous frame
│     - Most frames
│
└─ B-Frame (Bidirectional)
   └─ Advanced prediction
      - Not always present
```

### H264PacketParser

Responsibilities:
- Extract NALU header (1-5 bytes)
- Identify frame type:
  - **SPS** (type 7) → Sequence parameters
  - **PPS** (type 8) → Picture parameters
  - **IDR** (type 5) → Key frames
  - **STAP-A** (type 24) → Multiple NALUs in one packet
  - **FU-A** (type 28) → Fragmented NALUs

### H264FrameAssembler

Responsibilities:
- Buffer packets by timestamp
- Wait for complete frame (all FU-A fragments)
- Store SPS/PPS for downstream
- Emit complete H264Frame when ready

```typescript
interface H264Frame {
  data:       Buffer;       // Complete frame payload
  isKeyframe: boolean;      // true = I-frame
  timestamp:  number;       // RTP timestamp
  sps?:       Buffer;       // Sequence parameters
  pps?:       Buffer;       // Picture parameters
}
```

---

## Event System

### Event Bus Architecture

The EventBus is a wrapper around **EventEmitter3**:

```typescript
// In core/EventBus.ts
export class EventBus extends EventEmitter {
  // Inherits all EventEmitter3 methods
  on(event: string, listener: Function)
  emit(event: string, ...args: any[])
  off(event: string, listener: Function)
  once(event: string, listener: Function)
}
```

### Component Communication

Components communicate **only** through EventBus:

```
StreamBridgeComponent      CommandComponent
       │                          │
       └──────────▶ EventBus ◀────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
    emit() calls   on() calls   off() calls
```

### Event Categories

#### Lifecycle Events
- `bot:ready` — All components initialized
- `bot:shutdown` — Graceful shutdown starting
- `component:error` — Component initialization error

#### Stream Events
- `ts6:streamStarted(clientId)` — Stream source connected
- `ts6:streamStopped(clientId)` — Stream source disconnected
- `frame:processed(H264Frame)` — Video frame ready

#### Connection Events
- `ts6:connected` — WebSocket connected to TS6
- `ts6:disconnected` — WebSocket disconnected
- `livekit:connected(roomName)` — Joined LiveKit room
- `livekit:disconnected(roomName)` — Left LiveKit room

#### Client Events
- `client:joined(clientId, clientName)` — Client joined TS6
- `client:left(clientId)` — Client left TS6
- `client:moved(clientId, channelId)` — Client changed channel

#### Command Events
- `command:execute(command, args, clientId)` — Chat command received

---

## Configuration System

### ConfigLoader Process

```
1. Read config.yaml
   └─ fs.readFileSync('config.yaml')

2. Parse YAML
   └─ yaml.parse(contents)

3. Validate with Zod
   └─ configSchema.parse(object)
      ├─ Check required fields
      ├─ Type coercion
      └─ Throw on validation error

4. Return BotConfig
   └─ Strongly typed object
```

### BotConfig Structure

```typescript
interface BotConfig {
  teamspeak: {
    apiUrl:      string;    // REST endpoint
    apiKey:      string;    // Auth token
    wsUrl:       string;    // WebSocket endpoint
    webhookPort: number;    // Webhook listener port
  };
  livekit: {
    url:         string;    // WebSocket URL
    apiKey:      string;    // JWT key
    apiSecret:   string;    // JWT secret
    roomName:    string;    // Target room
  };
  bot: {
    identity:    string;    // Bot name in TS6
    logLevel:    string;    // Log verbosity
  };
}
```

### BotContext

Created once at startup, passed to all components:

```typescript
interface BotContext {
  config:   BotConfig;         // Configuration
  ts6Api:   TS6RestClient;     // API client
  eventBus: EventBus;          // Event system
  logger:   Logger;            // Winston logger
}
```

---

## Error Handling

### Error Categories

#### 1. Configuration Errors
**When**: Startup
**Cause**: Invalid config.yaml or missing required fields
**Handling**: 
```typescript
try {
  const config = loadConfig('config.yaml');
} catch (err) {
  console.error('Config error:', err);
  process.exit(1);
}
```

#### 2. Connection Errors
**When**: Attempting to connect to TS6 or LiveKit
**Cause**: Server unavailable, wrong credentials, firewall
**Handling**:
```typescript
async verifyTS6Connection() {
  try {
    await this.context.ts6Api.getServerInfo();
  } catch (err) {
    throw new Error(`TS6 REST API unavailable. ${err}`);
  }
}
```

#### 3. Protocol Errors
**When**: Receiving malformed messages
**Cause**: Incompatible TS6 version, corrupted data
**Handling**:
```typescript
try {
  const frame = this.parseFrame(data);
} catch (err) {
  this.context.logger.warn('Protocol error:', err);
  // Continue processing
}
```

#### 4. Component Errors
**When**: Component initialization fails
**Cause**: Missing dependencies, initialization logic error
**Handling**:
```typescript
for (const component of this.components.values()) {
  try {
    await component.onInit(this.context);
  } catch (err) {
    this.context.logger.error(`Component '${component.name}' failed:`, err);
    throw err; // Abort startup
  }
}
```

### Error Recovery

**Graceful Degradation:**
```
Connection Lost
    ├─ Log error
    ├─ Emit connection:error event
    └─ Attempt reconnect every N seconds

Stream Processing Error
    ├─ Log frame details
    ├─ Skip frame
    └─ Continue with next frame

Component Destroy Error
    ├─ Log warning
    ├─ Continue destroying other components
    └─ Exit process
```

---

## Performance Considerations

### Memory Management
- H.264 frames buffered in memory (typically 1-5MB)
- Old frames discarded if not processed
- No frame buffer growth checks (TODO: Add limits)

### CPU Usage
- H.264 parsing: ~1-5% per stream (hardware agnostic)
- Frame assembly: ~1-2% per stream
- Event dispatching: <1%
- Consider multi-core for multiple streams

### Network Bandwidth
- **TS6 WebSocket**: ~1-5 Mbps (depends on resolution/frame rate)
- **LiveKit Publishing**: ~1-5 Mbps (configurable in LiveKit)
- Both should be on same network for best performance

### Recommended Specs
| Metric | Minimum | Recommended |
|--------|---------|------------|
| CPU | 2 cores | 4 cores |
| RAM | 512 MB | 2 GB |
| Network | 10 Mbps | 25 Mbps |
| Latency (to servers) | <100ms | <50ms |

---

## Extension Points

### Adding Custom Components

1. Extend `BaseComponent`
2. Implement `onInit()` and `onDestroy()`
3. Subscribe to events via `context.eventBus.on()`
4. Register in `index.ts`

### Adding Custom Events

1. Define in `core/types.ts` (interface extension)
2. Emit via `context.eventBus.emit()`
3. Subscribe in consuming components

### Custom Connectors

Create new connector by:
1. Implementing connection logic
2. Emitting standard events
3. Providing interface matching existing connectors
4. Inject in StreamBridgeComponent

---

**Last Updated**: 2024-01-15
