# Troubleshooting Guide

Common issues and solutions for TS6 Stream Bot.

## Table of Contents

- [Connection Issues](#connection-issues)
- [Video/Stream Issues](#videostream-issues)
- [Performance Issues](#performance-issues)
- [Configuration Issues](#configuration-issues)
- [Development/Debugging](#developmentdebugging)

---

## Connection Issues

### Cannot Connect to TS6 Server

#### Error
```
[Bot] TS6 REST API unavailable. getaddrinfo ENOTFOUND localhost:10080
```

#### Causes & Solutions

| Cause | Solution |
|-------|----------|
| TS6 server not running | Start TS6 server or verify it's listening on correct port |
| Wrong host/port in config | Check `teamspeak.apiUrl`, default is `http://localhost:10080/v1` |
| Firewall blocking connection | Add firewall rule allowing outbound to port 10080 |
| Using wrong API domain | If remote, use actual hostname/IP not localhost |

#### Debugging Steps

```bash
# 1. Verify TS6 is running
# On TS6 machine:
netstat -an | grep 10080

# 2. Test REST API directly
curl -v \
  -H "Authorization: Bearer YOUR-API-KEY" \
  http://localhost:10080/v1/server

# 3. Check firewall
# Windows
netsh advfirewall firewall show rule name="TeamSpeak"

# Linux
sudo iptables -L -n | grep 10080
```

#### Quick Fix

```yaml
# config.yaml - Ensure correct format
teamspeak:
  apiUrl: "http://localhost:10080/v1"
  # NOT: http://localhost:10080  (missing /v1)
  # NOT: http://localhost (missing port)
```

---

### WebSocket Connection Timeout

#### Error
```
[TSSignaling] WebSocket timeout: ws://localhost:9987
[TSSignaling] Retrying in 5 seconds...
```

#### Causes & Solutions

| Cause | Solution |
|-------|----------|
| TS6 WebSocket not running on port 9987 | Check TS6 configuration, verify port |
| Firewall blocking WebSocket | Open TCP port 9987 in firewall |
| Wrong WebSocket URL format | Use `ws://` not `http://` for WebSocket |
| Network latency | Increase timeout in code (edit `connectors/TS6Client/TSSignaling.ts`) |

#### Testing

```bash
# Test WebSocket connectivity
# Install: npm install -g wscat

wscat -c ws://localhost:9987

# Send test message
{"type":"hello","version":"1.0"}

# Should get response
{"type":"hello-response",...}
```

#### Fix

```yaml
# config.yaml
teamspeak:
  wsUrl: "ws://localhost:9987"    # Correct
  # NOT: wss://localhost:9987      (only for HTTPS)
  # NOT: http://localhost:9987     (wrong protocol)
```

---

### TS6 API Key Invalid

#### Error
```
[TS6RestClient] Unauthorized: Invalid API key
```

#### Solutions

1. **Regenerate API Key:**
   - Open TS6 Client
   - Menu → Server → Settings → API Keys
   - Delete old key, generate new one
   - Update `config.yaml`

2. **Verify Key Format:**
   ```yaml
   teamspeak:
     apiKey: "your-api-key-here"  # Should be 32+ characters
   ```

3. **Check Permissions:**
   - Ensure API key has `server.view` and `client.list` permissions
   - Generate with admin privileges if needed

---

### LiveKit Connection Failed

#### Error
```
[LiveKitConnector] Failed to connect: ECONNREFUSED ws://localhost:7880
```

#### Causes & Solutions

| Cause | Solution |
|-------|----------|
| LiveKit server not running | Start LiveKit server (docker/binary) |
| Wrong WebSocket URL | Check config matches LiveKit server address |
| Firewall blocking 7880 | Open TCP port 7880 in firewall |
| Invalid credentials | Verify API key and secret are correct |

#### Debugging

```bash
# 1. Check if LiveKit is running
curl -v http://localhost:7880/metrics

# 2. If using Docker
docker ps | grep livekit
docker logs <container-id>

# 3. Test direct connection
node -e "
const ws = require('ws');
const client = new ws('ws://localhost:7880');
client.on('open', () => console.log('Connected!'));
client.on('error', (e) => console.error('Error:', e.message));
"
```

#### Quick Start LiveKit (Docker)

```bash
docker run -d \
  --name livekit \
  -p 7880:7880 \
  -p 7881:7881 \
  -e LIVEKIT_KEYS="devkey: secret" \
  livekit/livekit-server \
  --dev --bind 0.0.0.0
```

---

## Video/Stream Issues

### No Video Stream from TS6

#### Symptoms
- Bot starts OK
- No `ts6:streamStarted` event in logs
- No video appearing in LiveKit

#### Diagnosis Steps

```bash
# 1. Check if stream event is emitted
npm run dev | grep "Stream started"

# 2. Enable debug logging
# In config.yaml:
bot:
  logLevel: "debug"
npm run dev

# 3. Check if TS6 client is actually streaming (not just screenshare)
# In TS6 client settings, verify streaming is enabled
```

#### Common Causes & Solutions

| Cause | Solution |
|-------|----------|
| Screenshare not started in TS6 | Client must start screenshare manually |
| Wrong streaming client ID | Verify bot is listening for correct client |
| TS6 streaming disabled | Enable streaming in TS6 settings |
| Component not started | Check `StreamBridgeComponent` initialized |

#### Fix

1. **Verify Client is Streaming:**
   ```
   In TS6: Check if your camera/screenshare icon is visible
   ```

2. **Increase Log Verbosity:**
   ```yaml
   bot:
     logLevel: "debug"
   ```

3. **Restart Bot:**
   ```bash
   npm run dev  # Will show detailed logs
   ```

---

### Video Frames Not Assembling

#### Error
```
[H264FrameAssembler] Timeout waiting for frame completion at ts=12345
[H264FrameAssembler] Discarding incomplete frame
```

#### Causes

- TS6 client sent incomplete frame data
- Network packets were lost
- H.264 encoder produced unexpected format
- Bot crashed during frame assembly

#### Solutions

1. **Check Network Quality:**
   ```bash
   # Monitor packet loss
   # On TS6 client: Check network stats
   ```

2. **Increase Frame Timeout:**
   - Edit `src/pipeline/H264FrameAssembler.ts`
   - Increase `FRAME_TIMEOUT` constant:
   ```typescript
   private static readonly FRAME_TIMEOUT = 5000; // ms
   ```

3. **Enable Frame Logging:**
   ```typescript
   // In H264FrameAssembler.ts
   private logFrame(frame: H264Frame) {
     console.log(`Frame ${frame.timestamp}: ${frame.data.length} bytes, keyframe=${frame.isKeyframe}`);
   }
   ```

---

### Video Freezes or Stutters

#### Symptoms
- Video plays but freezes periodically
- Frame rate drops
- Slow motion effect

#### Causes & Solutions

| Cause | Solution |
|-------|----------|
| Network congestion | Reduce frame rate or resolution in TS6 |
| Insufficient CPU | Close other processes, use more powerful machine |
| Frame processing backlog | Check logs for `queue full` messages |
| LiveKit room overloaded | Reduce number of subscribers |

#### Performance Monitoring

```bash
# Enable verbose logging
npm run dev -- --verbose

# Look for:
# - Frame processing time
# - Queue depth
# - Network latency
```

---

## Performance Issues

### High CPU Usage

#### Diagnosis

```bash
# 1. Check if Node.js process is using high CPU
# Windows Task Manager: Look for "node.exe"
# Linux: top -p $(pgrep -f "npm run dev")

# 2. Enable profiling
node --prof src/index.ts

# 3. Analyze V8 profiling data
node --prof-process isolate-*.log > profile.txt
```

#### Solutions

| Symptom | Solution |
|---------|----------|
| 100% CPU all the time | Reduce frame rate, check for tight loops |
| CPU spikes when streaming | Normal; reduce resolution if severe |
| Gradual CPU increase | Memory leak; check component.onDestroy() |

#### Code to Check

```typescript
// In FramePipeline, ensure no infinite loops
// In H264FrameAssembler, check frame timeout
// In components, verify event listeners are removed
```

---

### High Memory Usage

#### Diagnosis

```bash
# 1. Watch memory growth
npm run dev

# 2. Monitor in another terminal
: 'Every 5 seconds on Linux'
watch -n 5 'ps aux | grep node'

# 3. Enable Node.js heap snapshots
# Stop process after running for a while
# Analyze heap: heap_dump.heapsnapshot in Chrome DevTools
```

#### Solutions

| Symptom | Solution |
|---------|----------|
| Memory grows from 50MB to 1GB | Buffer not being cleared; check H264FrameAssembler |
| Memory stable but high | Normal; H.264 buffers consume memory |
| OOM (Out of Memory) | Restart bot, reduce frame size, reduce buffer size |

#### Potential Leak Sources

```typescript
// 1. Check event listeners are removed:
this.eventBus.off('event', handler);

// 2. Check buffers are cleared:
this.buffer.clear(); // or reset

// 3. Check component cleanup:
async onDestroy() {
  await this.cleanup();  // Must be implemented
}
```

---

## Configuration Issues

### YAML Parse Error

#### Error
```
Error: YAMLParseError: unexpected indent at line 5
```

#### Solution: Validate YAML

```yaml
# ✓ CORRECT - Consistent indentation (2 spaces)
teamspeak:
  apiUrl: "http://localhost:10080/v1"
  apiKey: "my-key"

# ✗ WRONG - Mixed indentation
teamspeak:
    apiUrl: "http://localhost:10080/v1"  # 4 spaces!
  apiKey: "my-key"                       # 2 spaces

# ✗ WRONG - Tabs instead of spaces
teamspeak:
→ apiUrl: "http://localhost:10080/v1"
```

**Tools to Validate:**
```bash
# Online: https://www.yamllint.com/

# Local:
npm install -g yamllint
yamllint config.yaml
```

---

### Config Not Loading

#### Error
```
Error: Cannot find module 'config.yaml'
```

#### Solution

```bash
# 1. Verify file exists in project root
ls -la config.yaml

# 2. File must be in same directory as package.json
pwd
ls -la

# 3. Check file name (case-sensitive on Linux)
# Must be: config.yaml (not Config.yaml, config.yml, etc.)
```

---

### Invalid Configuration Values

#### Error
```
ZodError: {
  "teamspeak.apiUrl": "Invalid URL format"
}
```

#### Solutions

```yaml
# ✓ Valid values
teamspeak:
  apiUrl: "http://localhost:10080/v1"
  apiKey: "my-api-key"
  wsUrl: "ws://localhost:9987"
  webhookPort: 3000

livekit:
  url: "ws://localhost:7880"
  apiKey: "devkey"
  apiSecret: "secret"
  roomName: "my-room"

bot:
  identity: "ts6-stream-bot"
  logLevel: "info"  # or: debug, warn, error

# ✗ Common mistakes
teamspeak:
  apiUrl: "localhost:10080"      # Missing http://
  apiKey: ""                      # Empty string
  wsUrl: "wss://localhost:9987"   # Should be ws:// for local

bot:
  logLevel: "verbose"             # Should be: debug, info, warn, error
```

---

## Development/Debugging

### Enable Debug Logging

```yaml
# config.yaml
bot:
  logLevel: "debug"
```

Output will show:
- All connection attempts
- All events
- Frame data
- Full error stack traces

### Run TypeScript with Source Maps

```bash
# Create advanced debug configuration
npm run build --source-map
node --enable-source-maps dist/index.js
```

### Inspect Live Process

```bash
# Start bot with inspector
node --inspect src/index.ts

# In Chrome: go to chrome://inspect
# Click "inspect" on Node process
# Full debugger available
```

### Check Component Initialization

```bash
# Add debug logging
npm run dev | grep "Init:"

# Expected output:
# [Bot] Init: stream-bridge
# [Bot] Init: command-component
# [Bot] Init: autojoin-component
# [Bot] Init: debug-component
```

### Test Individual Components

```typescript
// In src/index.ts temporarily:

const bot = new Bot(config);

// Only register one component for testing
bot.register(new StreamBridgeComponent());
// Don't register others yet

await bot.start();

// Check if StreamBridgeComponent initializes correctly
```

### Monitor Events in Real-Time

```typescript
// Add to any component:
async onInit(ctx: BotContext): Promise<void> {
  // Log all events
  ctx.eventBus.on('*', (event, ...args) => {
    ctx.logger.debug(`Event: ${event}`, args);
  });
}
```

---

## Common Error Messages

### "Component cannot register after start()"

**Cause:** Trying to register component after `bot.start()`

**Fix:**
```typescript
// ✓ Correct order
const bot = new Bot(config);
bot.register(new MyComponent());  // Before start()
await bot.start();

// ✗ Wrong order
await bot.start();
bot.register(new MyComponent());  // After start()
```

---

### "Frame assembly timeout"

**Cause:** H.264 frame incomplete after 5 seconds

**Fix:**
1. Check network connection
2. Verify TS6 is sending frames
3. Increase timeout in code

---

### "No SPS/PPS found in frame"

**Cause:** Key frame data missing

**Fix:** 
1. Request key frame from source: usually automatic every ~2 seconds
2. If persistent, check TS6 encoder settings

---

## Getting Help

### Collect Debug Information

When reporting issues, collect:

```bash
# 1. Full bot startup output
npm run dev 2>&1 | tee debug-log.txt

# 2. Configuration (without sensitive info)
cat config.yaml  # Remove API keys before sharing

# 3. System info
node --version
npm --version
uname -a  # Linux/Mac
wmic os get version  # Windows

# 4. Error messages
# Copy full error stack trace

# Share these files with debugger
```

### Enable Verbose Output

```bash
# Temporary modification for debugging
# In src/config/logger.ts, change:
const level = config.bot.logLevel || 'debug'; // Force debug
```

---

**Last Updated**: 2024-01-15
