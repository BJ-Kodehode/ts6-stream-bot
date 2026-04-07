# Setup & Installation Guide

Step-by-step guide to set up TS6 Stream Bot.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Steps](#installation-steps)
- [Configuration](#configuration)
- [Verification](#verification)
- [First Run](#first-run)

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Windows 10 / Ubuntu 20.04 | Windows 11 / Ubuntu 22.04 |
| Node.js | 18.0 | 20.0+ |
| RAM | 512 MB | 2 GB |
| Storage | 500 MB | 2 GB |
| CPU | Dual-core | Quad-core |
| Network | 10 Mbps | 100 Mbps |

### Required Software

1. **Node.js & npm**
   ```bash
   # Download from https://nodejs.org/
   # Verify installation:
   node --version    # Should be 18.0 or higher
   npm --version     # Should be 8.0 or higher
   ```

2. **Git** (for cloning repository)
   ```bash
   git --version
   ```

3. **TS6 Server** 6.0+
   - Must be running and accessible over network
   - API key must be generated

4. **LiveKit Server**
   - Can be local or cloud-hosted
   - Credentials (API key, secret) needed

### Network Requirements

- **TS6 Connection**: Default ports
  - REST API: `10080/tcp`
  - WebSocket: `9987/tcp` or configurable
  - Webhooks: Configurable (default `3000/tcp`)

- **LiveKit Connection**: Default ports
  - WebSocket: `7880/tcp` (or custom)

- Network connectivity between Bot → TS6 and Bot → LiveKit

---

## Installation Steps

### 1. Clone Repository

```bash
# HTTPS
git clone https://github.com/your-org/ts6-stream-bot.git
cd ts6-stream-bot

# Or SSH
git clone git@github.com:your-org/ts6-stream-bot.git
cd ts6-stream-bot
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- Production: `@livekit/rtc-node`, `livekit-server-sdk`, `ws`, `zod`, `eventemitter3`, `winston`
- Development: `typescript`, `tsx`, `vitest`, `@types/*`

### 3. Verify Node.js Version

```bash
node --version
# Output should be v18.0.0 or higher
```

### 4. Verify TypeScript

```bash
npx tsc --version
# Output should be 5.7.0 or higher
```

### 5. Setup Directory

```bash
# Create logs directory
mkdir -p logs

# Create data directory (optional)
mkdir -p data
```

---

## Configuration

### 1. Create config.yaml

Create `config.yaml` in project root:

```yaml
# TS6 Stream Bot - Configuration

teamspeak:
  # REST API endpoint of TS6 server
  apiUrl: "http://localhost:10080/v1"
  
  # API key - generate in TS6 client:
  # Menu > Server > Settings > API Keys > Generate
  apiKey: "your-ts6-api-key-here"
  
  # WebSocket endpoint for real-time signaling
  wsUrl: "ws://localhost:9987"
  
  # Port to listen for webhook events from TS6
  webhookPort: 3000

livekit:
  # LiveKit server WebSocket URL
  url: "ws://localhost:7880"
  
  # LiveKit API key (from configuration)
  apiKey: "devkey"
  
  # LiveKit API secret (from configuration)
  apiSecret: "secret"
  
  # Target room name (created automatically if doesn't exist)
  roomName: "ts6-stream"

bot:
  # Identity/username for bot on TS6
  identity: "ts6-stream-bot"
  
  # Log level: debug | info | warn | error
  logLevel: "info"
```

### 2. Configure TS6 Server

#### Generate API Key

1. Open TS6 Client
2. Navigate to: **Menu** → **Server** → **Settings** → **API Keys**
3. Click **Generate Key**
4. Copy the generated key
5. Paste into `config.yaml` under `teamspeak.apiKey`

#### Enable Webhooks (Optional)

1. In TS6 Settings → **Webhooks**
2. Ensure webhooks are enabled
3. Point to bot server: `http://<bot-ip>:3000/webhook`

#### Get WebSocket URL

- Usually: `ws://localhost:9987` (local)
- Or: `ws://<server-ip>:9987` (remote)

### 3. Configure LiveKit

#### Using Docker (Quick Start)

```bash
# Run LiveKit in Docker
docker run -d \
  -p 7880:7880 \
  -p 7881:7881 \
  -e LIVEKIT_KEYS="devkey: secret" \
  livekit/livekit-server \
  --dev --bind=0.0.0.0
```

#### Using LiveKit Cloud

1. Sign up at [livekit.io](https://livekit.io)
2. Create project
3. Get API key/secret from dashboard
4. Update `config.yaml`

#### Get Credentials

Look for in LiveKit config or dashboard:
- **API Key**: Usually `devkey` (development) or long string
- **API Secret**: Usually `secret` (development) or long string
- **URL**: WebSocket endpoint, e.g., `ws://localhost:7880`

### 4. Validate Configuration

```bash
# Check YAML syntax (using Node.js)
node -e "
const yaml = require('js-yaml');
const fs = require('fs');
try {
  const config = yaml.load(fs.readFileSync('config.yaml', 'utf8'));
  console.log('✓ Config is valid');
  console.log(JSON.stringify(config, null, 2));
} catch (e) {
  console.error('✗ Config error:', e.message);
}
"
```

---

## Verification

### Test TS6 Connection

```bash
# Test REST API
curl -H "Authorization: Bearer YOUR-API-KEY" \
  http://localhost:10080/v1/server

# Should return server info like:
# {
#   "name": "My Server",
#   "version": "6.0.0",
#   ...
# }
```

### Test WebSocket Connection

```bash
# Install wscat for testing
npm install -g wscat

# Connect to TS6 WebSocket
wscat -c ws://localhost:9987

# Send HELLO message
{"type":"hello","version":"1.0"}

# Should receive response
```

### Test LiveKit Connection

```bash
# Install livectl for testing
npm install -g @livekit/cli

# Test connection
livekit-cli test-egress \
  --url ws://localhost:7880 \
  --api-key devkey \
  --api-secret secret
```

### Test Bot Starting

```bash
npm run dev
```

Expected output:
```
[Bot] Starting...
[Bot] TS6 connected — server: My Server
[Bot] Init: stream-bridge
[Bot] Init: command-component
[Bot] Init: autojoin-component
[Bot] Init: debug-component
[StreamBridge] Ready — waiting for screenshare from TS6
[Bot] Ready — 4 component(s) active
```

---

## First Run

### 1. Start Development Server

```bash
npm run dev
```

### 2. Monitor Logs

```bash
# In another terminal
tail -f logs/bot.log
```

### 3. Test Connection

In TS6:
1. Connect to server
2. Should see bot appear in client list
3. Bot should show as connected

### 4. Test Streaming

1. One TS6 client starts streaming (screenshare)
2. Bot should emit `ts6:streamStarted` event (check logs)
3. Stream should appear in LiveKit room

### 5. Test Commands

In TS6 chat:
- `!status` — Should show bot status
- `!clients` — Should list all connected clients

---

## Troubleshooting Initial Setup

### "Cannot find module 'ts6-stream-bot'"

**Solution:** Run `npm install` in project directory

### "config.yaml not found"

**Solution:** Create `config.yaml` with valid configuration (see Configuration section)

### "ECONNREFUSED localhost:10080"

**Solutions:**
1. Verify TS6 server is running
2. Check REST API port is correct (usually 10080)
3. Check firewall allows connection
4. Try with specific IP: `http://192.168.1.100:10080`

### "Unauthorized" error from TS6 API

**Solutions:**
1. API key might be wrong
2. Try regenerating API key in TS6
3. Ensure API key has sufficient permissions
4. Try accessing API directly to verify:
   ```bash
   curl -H "Authorization: Bearer YOUR-KEY" http://localhost:10080/v1/server
   ```

### "Cannot connect to LiveKit at ws://localhost:7880"

**Solutions:**
1. Verify LiveKit is running
2. Check port 7880 is correct
3. If using Docker, check container is running: `docker ps`
4. Try connecting from local machine first
5. Check firewall rules

### Bot starts but doesn't process streams

**Diagnosis:**
1. Check if `ts6:streamStarted` event appears in logs
2. Check if stream is from TS6 (might need to activate)
3. Enable `logLevel: "debug"` for detailed logs
4. Verify LiveKit room connection

---

## Environment-Specific Setup

### Development Machine

```yaml
teamspeak:
  apiUrl: "http://localhost:10080/v1"
  wsUrl: "ws://localhost:9987"

livekit:
  url: "ws://localhost:7880"

bot:
  logLevel: "debug"
```

### Local Network

```yaml
teamspeak:
  apiUrl: "http://192.168.1.100:10080/v1"
  wsUrl: "ws://192.168.1.100:9987"

livekit:
  url: "ws://192.168.1.200:7880"

bot:
  logLevel: "info"
```

### Cloud/Production

```yaml
teamspeak:
  apiUrl: "https://ts6.example.com:10080/v1"
  wsUrl: "wss://ts6.example.com:9987"

livekit:
  url: "wss://livekit.example.com:7880"

bot:
  logLevel: "warn"
```

---

## Docker Setup (Optional)

### Create Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

CMD ["npm", "start"]
```

### Build Image

```bash
docker build -t ts6-stream-bot:latest .
```

### Run Container

```bash
docker run -d \
  --name ts6-bot \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/logs:/app/logs \
  -p 3000:3000 \
  ts6-stream-bot:latest
```

### Check Logs

```bash
docker logs -f ts6-bot
```

---

## Next Steps

1. [Read the Architecture Guide](./ARCHITECTURE.md) for system design
2. [Review API Reference](./API.md) for component APIs
3. [Check Troubleshooting](./TROUBLESHOOTING.md) for common issues
4. Create custom components following the BaseComponent pattern

---

**Last Updated**: 2024-01-15
