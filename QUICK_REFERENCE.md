# Quick Reference Guide

Fast lookup for common tasks and commands.

## Installation

```bash
# Clone and setup
git clone <repo>
cd ts6-stream-bot
npm install

# Verify setup
npm run build    # Should have no errors
npm run dev      # Should start without errors
```

---

## Commands

```bash
npm run dev     # Start in development mode
npm run build   # Compile TypeScript → dist/
npm start       # Run compiled code
npm test        # Run tests

npm install     # Install dependencies
npm update      # Update dependencies
```

---

## Configuration

**File:** `config.yaml`

```yaml
teamspeak:
  apiUrl: "http://localhost:10080/v1"
  apiKey: "your-api-key"
  wsUrl: "ws://localhost:9987"
  webhookPort: 3000

livekit:
  url: "ws://localhost:7880"
  apiKey: "devkey"
  apiSecret: "secret"
  roomName: "ts6-stream"

bot:
  identity: "ts6-stream-bot"
  logLevel: "info|debug|warn|error"
```

---

## Folder Structure

```
src/
  index.ts                      Entry point
  core/Bot.ts                   Main class
  components/                   Pluggable features
  connectors/                   Integrations
  pipeline/                     Video processing
  api/                          API clients
  config/                       Configuration
```

---

## Common Issues & Quick Fixes

| Issue | Fix |
|-------|-----|
| `ECONNREFUSED` | Check TS6 server running on port 10080 |
| `Unauthorized` | Regenerate TS6 API key, check config |
| `WebSocket timeout` | Verify `wsUrl` in config, check firewall |
| No video | Enable debug logging, check stream source |
| Memory growing | Restart bot, reduce frame size |
| High CPU | Close other processes, reduce resolution |

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `config.yaml` | Configuration |
| `src/index.ts` | Entry point |
| `src/core/Bot.ts` | Main bot class |
| `src/core/EventBus.ts` | Event system |
| `package.json` | Dependencies |
| `tsconfig.json` | TypeScript config |

---

## API Quick Reference

```typescript
// Access in any component via `ctx` parameter

// Logger
ctx.logger.info('message');
ctx.logger.error('error', error);

// Events
ctx.eventBus.emit('event', data);
ctx.eventBus.on('event', handler);

// TS6 API
await ctx.ts6Api.getServerInfo();
await ctx.ts6Api.getClients();
await ctx.ts6Api.sendMessage(clientId, 'hello');

// Config
config.teamspeak.apiUrl
config.livekit.roomName
```

---

## Events

```typescript
// Lifecycle
bot:ready
bot:shutdown

// TS6
ts6:connected
ts6:streamStarted
ts6:streamStopped

// LiveKit
livekit:connected
livekit:disconnected

// Streaming
frame:processed
command:received
```

---

## Component Template

```typescript
import { BaseComponent } from './BaseComponent.js';

export class MyComponent extends BaseComponent {
  readonly name = 'my-component';

  async onInit(ctx) {
    ctx.logger.info(`[${this.name}] Starting`);
    ctx.eventBus.on('event', this.handler.bind(this));
  }

  async onDestroy() {
    ctx.logger.info(`[${this.name}] Stopped`);
  }

  private handler(data) {
    // Handle event
  }
}
```

Register in `src/index.ts`:
```typescript
bot.register(new MyComponent());
```

---

## Environment Setup

### Windows
```powershell
$env:TS6_API_URL = "http://localhost:10080/v1"
$env:TS6_API_KEY = "your-key"
```

### Linux/Mac
```bash
export TS6_API_URL="http://localhost:10080/v1"
export TS6_API_KEY="your-key"
```

### Docker
```bash
docker run -v $(pwd)/config.yaml:/app/config.yaml \
  ts6-stream-bot:latest
```

---

## Debugging Tips

```bash
# See detailed logs
npm run dev 2>&1 | tee debug.log

# Tests
npm test

# Check for issues
npm run build

# Node debugger
node --inspect src/index.ts
# Then open chrome://inspect
```

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Single test
npm test -- MyComponent.test.ts
```

---

## Git Workflow

```bash
# New feature
git checkout -b feature/my-feature
git commit -m "feat(scope): description"
git push origin feature/my-feature

# Create pull request on GitHub

# Update from main
git fetch upstream
git rebase upstream/main
```

---

## Useful Links

- [TypeScript Docs](https://www.typescriptlang.org)
- [Node.js Docs](https://nodejs.org/docs)
- [Vitest Docs](https://vitest.dev)
- [Winston Logger](https://github.com/winstonjs/winston)
- [EventEmitter3](https://github.com/primus/eventemitter3)

---

## Important Paths

```
$PWD/config.yaml          Configuration file
$PWD/src/                 Source code
$PWD/dist/                Compiled code
$PWD/docs/                Documentation
$PWD/logs/                Log files
$PWD/package.json         Dependencies
$PWD/tsconfig.json        TypeScript config
```

---

## Log Levels

- `debug` — Detailed technical info (dev only)
- `info` — Important milestones
- `warn` — Unexpected but recoverable
- `error` — Failures

Set in `config.yaml`:
```yaml
bot:
  logLevel: "debug"  # or info, warn, error
```

---

## Version Info

- **Node.js**: 18+ required
- **TypeScript**: 5.7+
- **TS6**: 6.0+
- **LiveKit**: Latest

Check versions:
```bash
node --version
npm --version
npx tsc --version
```

---

## Performance Tips

1. **Reduce frame size** → Lower resolution/frame rate in TS6
2. **Network** → Use gigabit network, minimize latency
3. **CPU** → Close unnecessary programs
4. **Memory** → Monitor with `npm run dev` and check for leaks
5. **Logging** → Use `warn` level in production (not debug)

---

## Support Resources

- **Setup Help** → See [docs/SETUP.md](./docs/SETUP.md)
- **Troubleshooting** → See [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)
- **API Reference** → See [docs/API.md](./docs/API.md)
- **Architecture** → See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Development** → See [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md)
- **Full Index** → See [docs/INDEX.md](./docs/INDEX.md)

---

**TS6 Stream Bot — Quick Reference v0.1.0**
