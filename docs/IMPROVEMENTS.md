# TS6 Stream Bot — Forbedringer og oppgraderinger

> **Formål:** Mønstre, oppgraderinger og tips som hever kodekvalitet og drift — uten å være direkte bug-fix.
> **Komplementerer** [CODE_REVIEW.md](./CODE_REVIEW.md) (bug-liste) og [ROADMAP.md](./ROADMAP.md) (tidsplan).
> **Prinsipp:** Hver forbedring har _hvorfor_, _hvordan_, og _når man bør velge bort_.

---

## Innhold

1. [Arkitektur og design-patterns](#arkitektur-og-design-patterns)
2. [TypeScript-oppgraderinger](#typescript-oppgraderinger)
3. [Testing og kvalitetssikring](#testing-og-kvalitetssikring)
4. [Observability](#observability)
5. [Reliability og feilhåndtering](#reliability-og-feilhandtering)
6. [Developer experience](#developer-experience)
7. [Sikkerhet](#sikkerhet)
8. [Ytelse](#ytelse)
9. [Pakking og distribusjon](#pakking-og-distribusjon)
10. [Alternative teknologivalg å vurdere](#alternative-teknologivalg-a-vurdere)

---

## Arkitektur og design-patterns

### 1. Dependency Injection istedenfor `ctx!`

Alle komponenter har `private ctx!: BotContext;` og lar `onInit()` "magisk" sette den. Det er et lett antipattern — du får ingen compile-time garanti for at `ctx` er satt når andre metoder kaller `this.ctx.eventBus`.

**Forbedring:** Bruk factory-pattern ved registrering:

```ts
// Bot.ts
type ComponentFactory = (ctx: BotContext) => BaseComponent;

register(factory: ComponentFactory | BaseComponent): this {
  const component = typeof factory === 'function' ? factory(this.context) : factory;
  // ...
}

// index.ts
bot.register((ctx) => new CommandComponent(ctx));
```

Eller enklere: inject via konstruktør etter at `BotContext` er klart (bygg komponentene _etter_ `verifyTS6Connection`).

**Når ikke:** Hvis du vil kunne instansiere komponenter uten `BotContext` (f.eks. i tester), er lazy `onInit` bedre.

---

### 2. Skille `Transport` (WebSocket) fra `Protocol` (parsing)

`TSSignaling` gjør i dag _både_ WebSocket-håndtering og meldingsrouting. Når du skal reverse-engineere TS6-protokollen, vil du ende opp med å blande protokolldetaljer med transport.

**Forbedring:**
```
TSTransport    — rå WebSocket, send/receive bytes og JSON
  ↓
TSProtocolCodec — serialiserer/deserialiserer meldinger
  ↓
TSSignaling     — høy-nivå API (connect, authenticate, subscribe)
```

Det lar deg bytte ut transport (f.eks. en unit-test som bruker in-memory transport).

---

### 3. `EventBus` → `Mediator` for kommandoer

Event-bus er fint for broadcast (stream startet → tre komponenter reagerer). Men for _kommando-svar_-flyten (en request → ett svar), er det klumsete.

**Forbedring:** Legg til en request/response-kanal:

```ts
class Mediator {
  async request<TReq, TRes>(channel: string, payload: TReq): Promise<TRes> { /* ... */ }
  handle<TReq, TRes>(channel: string, handler: (req: TReq) => Promise<TRes>): void { /* ... */ }
}
```

Typisk brukstilfelle: `bridge:status` — spørre StreamBridgeComponent om aktiv streamer, kanal, fps, uten å emitte events og vente på svar via annet event.

---

### 4. Immutable `BotConfig`

`BotConfig`-typen er plain interface. Hvis en komponent muterer `ctx.config.bot.logLevel`, påvirker det alle andre.

**Forbedring:**
```ts
import { z } from 'zod';
export type BotConfig = Readonly<z.infer<typeof ConfigSchema>>;
```

Plus `Object.freeze(result.data)` i `loadConfig`.

---

### 5. State machine for bridge-lifecycle

`StreamBridgeComponent.streaming: boolean` er en to-state indicator. I virkeligheten er det flere:

```
IDLE → CONNECTING → ACTIVE → STOPPING → IDLE
            ↓                    ↓
            ERROR ← ← ← ← ← ← ← RECONNECTING
```

**Forbedring:** Bruk en enum eller `xstate` for mindre tilstandsmaskiner:

```ts
export type BridgeState =
  | { kind: 'idle' }
  | { kind: 'connecting'; streamerId: string }
  | { kind: 'active'; streamerId: string; startedAt: number }
  | { kind: 'stopping' }
  | { kind: 'error'; reason: string };
```

Dette gir mer robust kode og bedre logging.

---

### 6. Plugin-system for eksterne komponenter

Planlegger du at tredjeparter skal skrive komponenter? Da bør `Bot.register()` lastes dynamisk:

```ts
// Konfig
bot:
  plugins:
    - "@streamertools/obs-sync"
    - "./custom/MyPlugin.js"
```

Og i `Bot.start()`:
```ts
for (const plugin of this.config.bot.plugins ?? []) {
  const mod = await import(plugin);
  this.register(new mod.default());
}
```

**Når ikke:** Før v1.0 er dette unødvendig kompleksitet. Hold det statisk til du har behov.

---

## TypeScript-oppgraderinger

### 7. Enable `"strict": true` — allerede satt ✓

Men vurder også disse:
```json
{
  "noUncheckedIndexedAccess": true,   // array[i] returnerer T | undefined
  "exactOptionalPropertyTypes": true, // { foo?: string } ≠ { foo: string | undefined }
  "noImplicitOverride": true,         // krever 'override'-nøkkelord
  "verbatimModuleSyntax": true        // skille import type vs import value
}
```

`noUncheckedIndexedAccess` fanger bugs som #13 (out-of-bounds i parser) allerede ved kompilering.

---

### 8. Bytt `moduleResolution: node` → `nodenext`

`node` er legacy-CommonJS-style. Med ESM-prosjekt (`"type": "module"`) er `nodenext` korrekt.

```json
{
  "module": "nodenext",
  "moduleResolution": "nodenext"
}
```

Kan kreve små justeringer i path-imports, men gir bedre error-messages.

---

### 9. Branded types for ID-er

I dag brukes `string` og `number` om hverandre for client-ID. Er `clid` en number i REST og string i WS? Fort miks'ing.

**Forbedring:**
```ts
type Brand<T, B> = T & { readonly __brand: B };
export type ClientId = Brand<string, 'ClientId'>;
export type ChannelId = Brand<string, 'ChannelId'>;

export function clientId(v: string | number): ClientId {
  return String(v) as ClientId;
}
```

Det er overkill for et lite prosjekt, men lønner seg når kodebasen vokser.

---

### 10. `@types/node` matcher Node-versjon

`package.json` har `@types/node: ^20.17.0`. README krever `Node.js 18+`. Velg én standard — helst node 20 LTS, så vil du kunne bruke `--watch`, `util.parseArgs`, og native test-runner om du vil bytte fra Vitest senere.

---

## Testing og kvalitetssikring

### 11. Vitest-struktur

Legg opp tester slik:
```
tests/
├── unit/
│   ├── H264PacketParser.test.ts
│   ├── H264FrameAssembler.test.ts
│   ├── FramePipeline.test.ts
│   └── config.test.ts
├── integration/
│   ├── TSSignaling.test.ts   # Mot MockTS6Server
│   └── Bot.test.ts
├── fixtures/
│   ├── h264-samples/
│   │   ├── keyframe.h264     # Ekte bytes
│   │   ├── pframe.h264
│   │   └── fua-fragments.h264
│   └── ws-dumps/             # Fra Sprint 2
└── mocks/
    ├── MockTS6Server.ts
    └── MockLiveKitRoom.ts
```

`vitest.config.ts`:
```ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: { provider: 'v8', reporter: ['text', 'lcov'], include: ['src/**/*.ts'] },
  },
});
```

### 12. Property-based testing for parser

H.264-parsing er perfekt for `fast-check`:
```ts
import fc from 'fast-check';
test('parser håndterer vilkårlige bytes uten å kaste', () => {
  fc.assert(fc.property(fc.uint8Array(), (arr) => {
    const parser = new H264PacketParser();
    parser.parse(Buffer.from(arr));
  }));
});
```

Fanger edge cases du aldri ville skrevet test for.

### 13. Snapshot-tester for event-sekvenser

```ts
const events: string[] = [];
eventBus.on('ts6:streamStarted', () => events.push('streamStarted'));
// kjør scenario
expect(events).toMatchSnapshot();
```

### 14. E2E-test som kjører i Docker

`docker-compose.test.yml` med ekte LiveKit-instans + MockTS6Server. Pytest-style test. Bra for pre-release gate.

---

## Observability

### 15. Strukturert JSON-logging i produksjon

```ts
// logger.ts
const isProd = process.env.NODE_ENV === 'production';
return winston.createLogger({
  level,
  format: isProd
    ? winston.format.combine(winston.format.timestamp(), winston.format.json())
    : winston.format.combine(/* pretty */),
  // ...
});
```

Produksjons-logg blir:
```json
{"level":"info","message":"Bot klar","ts":"2026-04-21T12:00:00Z","service":"ts6-stream-bot","components":4}
```

Enkelt å parse i Loki / Datadog / CloudWatch.

### 16. Request-ID / trace-ID

Hver ekstern request (REST, WS-melding) får en `traceId`. Logg den med alle operasjoner den utløser. Gjør debugging mye enklere når noe henger.

```ts
const traceId = crypto.randomUUID();
logger.child({ traceId }).info('Behandler kommando', { cmd });
```

### 17. OpenTelemetry for distribuerte traces

Hvis du senere kobler sammen flere boter / tjenester:
```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

### 18. Prometheus-metrics

```ts
import { Counter, Gauge, Histogram, register } from 'prom-client';

export const framesProcessed = new Counter({ name: 'ts6_frames_processed_total', help: 'Total frames', labelNames: ['type'] });
export const activeStreamers = new Gauge({ name: 'ts6_active_streamers', help: 'Antall aktive streamere' });
export const frameLatency = new Histogram({ name: 'ts6_frame_latency_seconds', help: 'Frame latency', buckets: [0.01, 0.05, 0.1, 0.5, 1] });
```

Eksponér på `/metrics`.

### 19. Grafana-dashboard-template

Lag en `grafana/dashboards/ts6-stream-bot.json` med paneler for:
- Bot oppetid
- Antall aktive streams
- Frames/sekund (linje-graf)
- Drop-rate (andel keyframes vs. P-frames forkastet)
- Reconnect-hendelser (events/min)

Bruk Grafana provisioning slik at `docker-compose up` gir deg dashboardet gratis.

---

## Reliability og feilhåndtering

### 20. Sirkuit breaker for eksterne kall

`TS6RestClient` kan bli spammet på et API som er dødt. Bruk `opossum`:

```ts
import CircuitBreaker from 'opossum';
const breaker = new CircuitBreaker(this.request.bind(this), {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
});
```

### 21. Idempotency for webhook-handling

TS6 kan sende samme webhook to ganger (retry). Lag en LRU-cache:

```ts
import { LRUCache } from 'lru-cache';
const seen = new LRUCache({ max: 1000, ttl: 60_000 });

if (seen.has(payload.id)) return res.writeHead(204).end();
seen.set(payload.id, true);
```

### 22. Graceful shutdown med timeout

```ts
async stop(): Promise<void> {
  const timeout = setTimeout(() => {
    this.context.logger.error('[Bot] Timeout ved shutdown — force-exit');
    process.exit(1);
  }, 10_000);

  try {
    // ... destroy alle komponenter
  } finally {
    clearTimeout(timeout);
  }
}
```

### 23. Health-endpoint skiller live/ready

- `/healthz` — prosessen lever. Returnerer alltid 200 om bot-prosessen kjører.
- `/readyz` — boten er koblet til TS6 og LiveKit. Returnerer 503 om en av dem er nede.

Kubernetes bruker disse hver for seg:
- Liveness → restart pod hvis prosessen henger
- Readiness → fjern fra load-balancer hvis den ikke er klar

---

## Developer experience

### 24. Legg til ESLint + Prettier

```bash
npm install -D eslint prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-prettier
```

`.eslintrc.cjs`:
```js
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
  },
};
```

### 25. Husky + lint-staged

Pre-commit hook kjører eslint/prettier/tsc på endrede filer.

```json
// package.json
"scripts": {
  "prepare": "husky install",
  "lint": "eslint src",
  "format": "prettier --write src"
}
```

### 26. `.editorconfig`

```ini
root = true
[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
[*.md]
trim_trailing_whitespace = false
```

### 27. `.nvmrc` / `engines` i package.json

```json
"engines": {
  "node": ">=20.0.0",
  "npm": ">=10.0.0"
}
```

```
# .nvmrc
20
```

### 28. VS Code-arbeidskonfigurasjon

`.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "eslint.validate": ["typescript"]
}
```

`.vscode/extensions.json` — anbefal extensions.

### 29. Debug-konfig for VS Code

`.vscode/launch.json` med launch-config for `tsx src/index.ts`, slik at man kan sette breakpoints uten terminal.

---

## Sikkerhet

### 30. Validering på boundaries, tillit internt

Alle inputs fra:
- TS6 WebSocket (`TSProtocol.parseIncoming`)
- Webhooks (`WebhookServer`)
- Kommandoer (`CommandComponent`)
- Config (`loadConfig`)

...skal gjennom Zod-schema. Intern kode (Bot → komponenter) kan stole på typer.

Eksempel for webhook:
```ts
const WebhookPayloadSchema = z.object({
  event: z.string(),
  data: z.record(z.unknown()),
  timestamp: z.number().optional(),
});
const parsed = WebhookPayloadSchema.safeParse(body);
if (!parsed.success) { res.writeHead(400).end(); return; }
```

### 31. Secrets via env, aldri config-fil i prod

`config.yaml` er fint for dev. I prod, bruk:
- Kubernetes Secret + env-variabler
- Docker `--env-file`
- Vault / AWS Secrets Manager

### 32. Audit-logg for admin-handlinger

Når noen kicker eller bruker `!bridge off`, logg:
```ts
logger.info('admin-action', { action: 'kick', target: clid, invoker: senderClid, reason });
```

Separér fra debug-logg (eget filnavn eller log-nivå).

### 33. Rate-limiting

Med `express-rate-limit` (eller lignende for raw http):
- Webhook-endepunkt: 100 req/min per IP
- `/metrics`: kun fra interne IP-er
- Dashboard API: auth-wall + rate-limit

---

## Ytelse

### 34. Bruk `Buffer.allocUnsafe` for hot-path

I `H264FrameAssembler.prependParameterSets`, `Buffer.concat` er OK. Men hvis du finner profiler-hotspot i parsing, kan du bytte til pre-allokert buffer + `.copy()`.

### 35. Stream-basert fil-logging

`appendFileSync` blokker event-loop. For høy-volum logging (DebugComponent), bruk:
```ts
import { createWriteStream } from 'fs';
const stream = createWriteStream('ts6-events.jsonl', { flags: 'a' });
stream.write(entry + '\n');
```

### 36. Worker thread for parsing

Hvis H.264-parsing blir flaskehals (> 30 % CPU på main thread):
```ts
import { Worker } from 'node:worker_threads';
// Flytt H264PacketParser til dedikert worker
```

**Men mål først.** `clinic.js` eller `0x` for flame-graph.

### 37. `fs.promises` + `pipeline`

For alt som involverer filer, bruk promises-basert API og `stream.pipeline` for backpressure.

---

## Pakking og distribusjon

### 38. Multi-stage Dockerfile

```dockerfile
# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
USER node
EXPOSE 3000 9090
CMD ["node", "dist/index.js"]
```

Husk `.dockerignore` — ikke kopier inn `node_modules`, `.git`, `tests`.

### 39. GitHub Container Registry

Publiser image til `ghcr.io/<org>/ts6-stream-bot:v0.x.x` via CI.

### 40. Semantic versioning + changelog

Bruk `changesets` eller manuelt `CHANGELOG.md`. Tag hver release:
```bash
git tag -a v0.2.0 -m "Sprint 2: Protocol reversing"
git push --tags
```

### 41. Docker-compose for lokal utvikling

```yaml
# docker-compose.dev.yml
services:
  livekit:
    image: livekit/livekit-server:latest
    ports: ["7880:7880"]
    environment:
      LIVEKIT_KEYS: "devkey: secret"
  bot:
    build: .
    depends_on: [livekit]
    env_file: .env
    volumes:
      - ./config.yaml:/app/config.yaml:ro
```

`docker-compose up` og du har alt.

---

## Alternative teknologivalg å vurdere

Ikke bytt med mindre du har grunn, men vit at de finnes:

### `@roamhq/wrtc` vs `node-webrtc`
- `node-webrtc` (pkg `wrtc`) har ikke vært vedlikeholdt siden 2022.
- `@roamhq/wrtc` er aktivt (forks). Anbefal den.
- Hvis H.264 hardware-akselerasjon blir viktig, vurder native ffmpeg-bindings (`@ffmpeg-installer/ffmpeg` + `fluent-ffmpeg`).

### Fastify vs Express (for WebhookServer)
- Fastify er raskere, har innebygd Zod-lignende schema.
- Express er mer kjent.
- For dette prosjektet: **`fastify`** — du vil ha schema-validering uansett.

### Winston vs Pino
- Pino er 5–10× raskere, struktur-JSON ut av boksen.
- Winston er mer fleksibelt m/ transports.
- Om du seriously skal gå mot prod-drift: **Pino** er verdt å bytte til.

### Vitest vs Node native test runner
- Vitest har snapshot, mocking, coverage — alt.
- Node native er "gratis", men må hacke mocking.
- **Bli på Vitest.** Moden, rask, bra.

### `ws` vs `uWebSockets.js`
- `ws` er standard og rikelig for denne belastningen.
- Bytt kun hvis du ser WS som flaskehals.

### EventEmitter3 vs `emittery` / `tiny-typed-emitter`
- EventEmitter3 er rask, men typings er litt klumsete.
- `tiny-typed-emitter` har renere generics.
- Liten forskjell — ikke prioritet.

### Zod vs Valibot vs ArkType
- Zod er standard, stor økosystem.
- Valibot er treshake'bart (bundler size), men irrelevant for Node.
- **Bli på Zod** med mindre bundle-størrelse er kritisk.

---

## Oppsummering av topp 10 oppgraderinger

Om du bare gjør 10 av forbedringene i dette dokumentet:

1. **ESLint + Prettier + Husky** (#24, #25)
2. **Strengere tsconfig** (#7, #8)
3. **Strukturert JSON-logging i prod** (#15)
4. **Prometheus-metrics** (#18)
5. **Graceful shutdown med timeout** (#22)
6. **Retry med backoff i `TS6RestClient`** (#21, CODE_REVIEW #19)
7. **Property-based tester for parser** (#12)
8. **Strict event-typing i `EventBus`** (CODE_REVIEW #9)
9. **Docker multi-stage build** (#38)
10. **Trace-ID for request-korrelasjon** (#16)

Disse gir deg 80 % av fordelene for 20 % av arbeidet.

---

*Versjon 1.0 — 2026-04-21*
