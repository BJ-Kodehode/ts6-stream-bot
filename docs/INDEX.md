# Documentation Index

Welcome to TS6 Stream Bot documentation. This guide will help you understand, set up, and develop with the bot.

## Quick Start

**New to this project?** Start here:

1. [README.md](../README.md) — Project overview and features
2. [SETUP.md](./SETUP.md) — Installation and first run (30 minutes)
3. Try running: `npm run dev`

## Documentation Structure

### For Users

- **[README.md](../README.md)** — Overview, features, components, getting started
- **[SETUP.md](./SETUP.md)** — Detailed installation, configuration, first run, Docker
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** — Common issues and solutions

### For Developers

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — System design, data flow, component lifecycle
- **[API.md](./API.md)** — Complete API reference for all classes and methods
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Development workflow, code standards, testing

### Planning & Reviews (added 2026-04-21)

- **[ROADMAP.md](./ROADMAP.md)** — Sprint-basert arbeidsplan fra v0.1 til v1.0 (Sprint 0–7)
- **[CODE_REVIEW.md](./CODE_REVIEW.md)** — Linje-for-linje audit: 30 funn med alvorlighet og konkret fix
- **[IMPROVEMENTS.md](./IMPROVEMENTS.md)** — Oppgraderinger: arkitektur, testing, observability, reliability, sikkerhet, ytelse
- **[FRONTEND_DESIGN.md](./FRONTEND_DESIGN.md)** — Dashboard-spec + designsystem (React + Vite)
- **[styles/design-tokens.css](./styles/design-tokens.css)** — Implementasjon av design tokens (CSS-variabler)

---

## Common Tasks

### I want to...

| Task | Document |
|------|----------|
| Get started with the bot | [SETUP.md](./SETUP.md) |
| Understand how it works | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Fix a connection error | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#connection-issues) |
| Debug video not streaming | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#videostream-issues) |
| Find API documentation | [API.md](./API.md) |
| Add a new component | [CONTRIBUTING.md](./CONTRIBUTING.md#adding-a-new-component) |
| Contribute code | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Improve performance | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#performance-issues) |

---

## Supported Versions

| Component | Version | Support |
|-----------|---------|---------|
| Node.js | 18.0+ | ✓ Active |
| TypeScript | 5.7+ | ✓ Active |
| TS6 Server | 6.0+ | ✓ Active |
| LiveKit | Latest | ✓ Active |

---

## Documentation Quality

These documents are:
- ✓ Comprehensive and detailed
- ✓ Regularly updated
- ✓ Actively maintained
- ✓ Example code included
- ✓ Troubleshooting sections provided

---

## Quick Reference

### Startup

```bash
npm install           # Install dependencies
npm run dev          # Development mode
npm run build        # Compile TypeScript
npm start            # Production mode
npm test             # Run tests
```

### Configuration

Main config file: `config.yaml`

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
  logLevel: "info"
```

### Project Structure

```
src/
├── index.ts              # Entry point
├── core/                 # Core classes (Bot, EventBus, types)
├── components/           # Pluggable components
├── connectors/           # TS6 and LiveKit integrations
├── pipeline/             # H.264 video processing
├── api/                  # REST API client
└── config/               # Configuration and logging
```

### Key Events

- `bot:ready` — Bot initialized
- `ts6:connected` — Connected to TS6
- `ts6:streamStarted` — Stream received from TS6
- `livekit:connected` — Connected to LiveKit room
- `frame:processed` — Video frame assembled and ready

---

## Troubleshooting Help

### Common Issues

**Q: Bot won't start**
→ [TROUBLESHOOTING.md - Connection Issues](./TROUBLESHOOTING.md#connection-issues)

**Q: No video appearing**
→ [TROUBLESHOOTING.md - Video/Stream Issues](./TROUBLESHOOTING.md#videostream-issues)

**Q: High memory usage**
→ [TROUBLESHOOTING.md - Performance Issues](./TROUBLESHOOTING.md#performance-issues)

**Q: Invalid config error**
→ [TROUBLESHOOTING.md - Configuration Issues](./TROUBLESHOOTING.md#configuration-issues)

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for comprehensive help.

---

## Development

### Setting Up Development Environment

```bash
# 1. Fork/clone repository
git clone <repo>
cd ts6-stream-bot

# 2. Install and build
npm install
npm run build

# 3. Run dev server
npm run dev

# 4. In another terminal, check logs
tail -f logs/bot.log
```

### Code Quality

```bash
npm run build      # Check TypeScript
npm test           # Run tests
```

### Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Development workflow
- Code standards
- Testing guidelines
- Commit conventions
- Pull request process

---

## Getting Help

### Resources

- **Questions?** Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **API Reference?** See [API.md](./API.md)
- **Architecture?** Read [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Contributing?** Guide in [CONTRIBUTING.md](./CONTRIBUTING.md)

### Report Issues

When reporting issues, include:
1. Full error message (with stack trace)
2. Configuration (without API keys)
3. Steps to reproduce
4. Output of `npm run dev` redirected to file

---

## Document Map

```
Documentation/
├── INDEX.md (you are here)
├── README.md (main entry point — ../README.md)
│
├── User-facing
│   ├── SETUP.md             (installation and config)
│   └── TROUBLESHOOTING.md   (common issues)
│
├── Developer reference
│   ├── ARCHITECTURE.md      (system design)
│   ├── API.md               (complete API reference)
│   ├── CONTRIBUTING.md      (development guide)
│   └── ts6-stream-bot-doc.md (original technical design doc)
│
└── Planning & quality (new, 2026-04-21)
    ├── ROADMAP.md           (sprint-basert arbeidsplan)
    ├── CODE_REVIEW.md       (linje-for-linje audit)
    ├── IMPROVEMENTS.md      (oppgraderinger og mønstre)
    ├── FRONTEND_DESIGN.md   (dashboard + designsystem)
    └── styles/
        └── design-tokens.css
```

---

## Latest Updates

| Document | Last Updated | Status |
|----------|--------------|--------|
| README.md | 2024-01-15 | ✓ Current |
| SETUP.md | 2024-01-15 | ✓ Current |
| ARCHITECTURE.md | 2024-01-15 | ✓ Current |
| API.md | 2024-01-15 | ✓ Current |
| TROUBLESHOOTING.md | 2024-01-15 | ✓ Current |
| CONTRIBUTING.md | 2024-01-15 | ✓ Current |

---

## Next Steps

1. **First Time?** → Read [SETUP.md](./SETUP.md)
2. **Want to Develop?** → Check [CONTRIBUTING.md](./CONTRIBUTING.md)
3. **Need Help?** → Search [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
4. **API Questions?** → Review [API.md](./API.md)

---

**TS6 Stream Bot v0.1.0**
*TypeScript-based bridge for TeamSpeak 6 and LiveKit*
