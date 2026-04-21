# TS6 Stream Bot — Kode-review og audit

> **Formål:** Konkret, linje-for-linje audit av kildekoden.
> **Metode:** Hvert funn har alvorlighetsgrad, fil/linje-referanse, forklaring på _hvorfor_ det er et problem, og en **konkret fix** klar til å lime inn.
> **Dato:** 2026-04-21 • **Kodebase versjon:** 0.1.0 (commit 5a6b5d5)

---

## Alvorlighetsgrader

| Kode | Betydning |
|---|---|
| 🔴 **Kritisk** | Prosjektet kjører ikke / krasjer / sikkerhetsproblem. Fix umiddelbart. |
| 🟠 **Høy** | Bug som rammer funksjonalitet, men gir ikke crash. Fix før release. |
| 🟡 **Medium** | Vedlikeholdsproblem, technical debt, code smell. Fix når du er i området. |
| 🟢 **Lav** | Stilistisk eller nice-to-have. |

---

## 🔴 Kritiske funn

### #1 — `yaml`-pakken er ikke installert

**Fil:** [src/config/config.ts:3](../src/config/config.ts#L3) • **Symptom:** `Cannot find module 'yaml'` ved oppstart.

```ts
import { parse } from 'yaml';   // ← pakken finnes ikke i package.json
```

`package.json` har `ws`, `zod`, `winston`, `eventemitter3`, `livekit-server-sdk`, `@livekit/rtc-node`. Ikke `yaml`. `npm run dev` feiler umiddelbart.

**Fix:**
```bash
npm install yaml
```

Alternativt: bytt til `js-yaml` om du foretrekker (da må import endres).

---

### #2 — Sensitive filer kan havne i git

**Fil:** [.gitignore](../.gitignore) • Innhold per nå:
```
node_modules/
dist/
```

`config.yaml` inneholder `apiKey` og `apiSecret`. Hvis noen commit'er en ekte config, er den publisert for alltid. `bot.log`, `ts6-events.jsonl` og `ts6-ws-raw.jsonl` produseres ved kjøring og kan inneholde sensitive data fra serveren (API-nøkler i auth-meldinger, klient-UID'er, chatter).

**Fix — oppdater `.gitignore`:**
```
# Dependencies og build
node_modules/
dist/

# Lokal konfig (bruk config.example.yaml som template)
config.yaml
config.local.yaml
.env
.env.local

# Runtime-filer
bot.log
*.log
ts6-events.jsonl
ts6-ws-raw.jsonl
logs/

# Sertifikater og nøkler
*.pem
*.key
*.crt

# IDE
.vscode/
.idea/
*.swp
.DS_Store

# Test-artefakter
coverage/
.nyc_output/
```

**Samtidig:** opprett `config.example.yaml` med dummyverdier, og dokumenter at `config.yaml` er per-miljø.

**Hvis** du allerede har committet `config.yaml` med ekte nøkkel: **rotér nøkkelen med en gang** og bruk `git filter-repo` eller BFG til å slette den fra historikk.

---

### #3 — `Bot.stop()` kaller `process.exit(0)`

**Fil:** [src/core/Bot.ts:67](../src/core/Bot.ts#L67)

```ts
async stop(): Promise<void> {
  // ...
  this.running = false;
  process.exit(0);   // ← problem
}
```

Dette gjør det umulig å:
- Teste lifecycle i Vitest (testen vil terminere test-prosessen).
- Restarte boten programmatisk.
- Implementere graceful shutdown med timeout.

**Fix:**
```ts
async stop(): Promise<void> {
  this.context.logger.info('[Bot] Stopper...');
  this.context.eventBus.emit('bot:shutdown');

  for (const component of [...this.components.values()].reverse()) {
    try {
      await component.onDestroy();
    } catch (err) {
      this.context.logger.warn(`[Bot] Feil ved stopping av '${component.name}':`, err);
    }
  }

  this.running = false;
  // IKKE process.exit her
}
```

Flytt `process.exit(0)` til [src/index.ts](../src/index.ts):
```ts
process.on('SIGINT',  async () => { await bot.stop(); process.exit(0); });
process.on('SIGTERM', async () => { await bot.stop(); process.exit(0); });
```

Og fjern SIGINT/SIGTERM fra `Bot.start()` (linje 50–51).

---

## 🟠 Høy alvorlighet

### #4 — `CommandComponent` lytter på `ts6:webhook` — men ingen emitter den

**Fil:** [src/components/CommandComponent.ts:19](../src/components/CommandComponent.ts#L19)

```ts
ctx.eventBus.on('ts6:webhook', async (event) => {
  if (event.event !== 'chat_message') return;
  // ...
});
```

Ingen kode i prosjektet emitter `ts6:webhook`. Det er nevnt i `EventBus.ts` som typed event, men det finnes ingen HTTP-server som tar imot webhooks fra TS6. Boten vil aldri svare på en kommando.

**Fix:** Implementer `WebhookServer.ts` (Sprint 4). Kort skisse:

```ts
// src/api/WebhookServer.ts
import http from 'node:http';
import type { EventBus } from '../core/EventBus.js';
import type { Logger } from 'winston';

export class WebhookServer {
  private server?: http.Server;

  constructor(private port: number, private eventBus: EventBus, private logger: Logger) {}

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return; }
        let body = '';
        req.on('data', (c) => body += c);
        req.on('end', () => {
          try {
            const payload = JSON.parse(body);
            this.eventBus.emit('ts6:webhook', {
              event: payload.event,
              data: payload.data ?? {},
              timestamp: Date.now(),
            });
            res.writeHead(204).end();
          } catch (err) {
            this.logger.warn('[Webhook] Invalid JSON', err);
            res.writeHead(400).end();
          }
        });
      });
      this.server.listen(this.port, () => resolve());
    });
  }

  async stop(): Promise<void> {
    await new Promise<void>((r) => this.server?.close(() => r()));
  }
}
```

Start den i `Bot.start()` før komponentene initialiseres.

---

### #5 — `CommandComponent` svarer aldri tilbake i chat

**Fil:** [src/components/CommandComponent.ts:54–87](../src/components/CommandComponent.ts#L54)

Alle kommandoer logger svaret i serverloggen. Brukeren som skrev `!status` ser ingenting. Boten er _usynlig_ for folk i TS6.

**Fix:** Legg `sendMessage` i `TS6RestClient` og bruk den:

```ts
// I TS6RestClient.ts
async sendMessage(targetClid: number, message: string): Promise<void> {
  await this.request('/clients/sendtextmessage', 'POST', {
    clid: targetClid,
    msg: message,
    targetmode: 1,  // 1 = privat melding; sjekk faktisk verdi i TS6-docs
  });
}
```

```ts
// I CommandComponent.ts — handleCommand får replyTo
private async cmdStatus(replyTo: number): Promise<void> {
  const info = await this.ctx.ts6Api.getServerInfo();
  const text = `${info.name}: ${info.clients_online} klienter, ${info.channels_online} kanaler`;
  await this.ctx.ts6Api.sendMessage(replyTo, text);
}
```

Endre `on('ts6:webhook')` til å plukke ut sender-clid fra payload:
```ts
const senderClid = Number(event.data.invokerid);
await this.handleCommand(cmd, args, senderClid);
```

---

### #6 — `TSSignaling.connect()` reconnect-logikken lekker timer + triple-tilkoblinger

**Fil:** [src/connectors/TS6Client/TSSignaling.ts:50–53](../src/connectors/TS6Client/TSSignaling.ts#L50)

```ts
this.ws.on('close', () => {
  console.warn('[TSSignaling] Tilkobling lukket — prøver igjen om 5s...');
  this.reconnectTimer = setTimeout(() => this.connect(this.serverUrl), 5000);
});
```

Problemer:
1. `connect()` returnerer en _ny_ Promise hver gang, men den originale Promise fra første connect har for lengst `resolve()`-et. Så kallsstedet får aldri beskjed om reconnect-feil.
2. Ingen backoff — 5 sek flat, vil hamre serveren om den er nede.
3. Ingen max-attempts.
4. Gamle `ws.on('message')`-handlere er ikke ryddet — hvis `ws`-objektet beholdes, blir listeners duplisert.
5. `this.webrtc`-tilstanden resettes ikke.

**Fix (skisse):**
```ts
private reconnectAttempts = 0;
private readonly MAX_RECONNECT = 10;

private scheduleReconnect() {
  if (this.reconnectAttempts >= this.MAX_RECONNECT) {
    console.error('[TSSignaling] Gir opp etter', this.MAX_RECONNECT, 'forsøk');
    return;
  }
  const delay = Math.min(60_000, 1000 * 2 ** this.reconnectAttempts); // 1s → 60s
  this.reconnectAttempts++;
  console.warn(`[TSSignaling] Reconnect om ${delay}ms (forsøk ${this.reconnectAttempts})`);
  this.reconnectTimer = setTimeout(() => {
    this.ws?.removeAllListeners();
    this.connect(this.serverUrl).catch(() => this.scheduleReconnect());
  }, delay);
}

// I 'open'-handler: reset counter
this.ws.on('open', () => {
  this.reconnectAttempts = 0;
  this.eventBus.emit('ts6:connected');
  resolve();
});

// I 'close'-handler:
this.ws.on('close', () => {
  this.eventBus.emit('ts6:disconnected');
  this.scheduleReconnect();
});
```

---

### #7 — `TSSignaling` bruker `console.log/warn/error` i stedet for Logger

**Fil:** [src/connectors/TS6Client/TSSignaling.ts:42, 51, 56, 133, 147](../src/connectors/TS6Client/TSSignaling.ts#L42)

`Bot` har en Winston-logger, men signaling-laget bruker `console`. Det betyr:
- Log-level (`debug`/`info`/`warn`/`error`) respekteres ikke.
- Logg havner ikke i `bot.log`-filen.
- Ingen strukturert formatering.

Samme gjelder [LiveKitConnector.ts:45](../src/connectors/LiveKitConnector.ts#L45), [TSWebRTC.ts:47,55,81](../src/connectors/TS6Client/TSWebRTC.ts#L47), [FramePipeline.ts:45,52,69](../src/pipeline/FramePipeline.ts#L45).

**Fix:** Send inn `Logger` som konstruktør-argument i alle ikke-komponent-klasser:
```ts
import type { Logger } from 'winston';

export class TSSignaling {
  constructor(private eventBus: EventBus, private logger: Logger) { /* ... */ }
  // ... bytt alle console.log → this.logger.info etc.
}
```

Og oppdater `StreamBridgeComponent` til å sende inn `ctx.logger` når den instansierer.

---

### #8 — `DebugComponent` lager en ubrukt `TSSignaling`

**Fil:** [src/components/DebugComponent.ts:27–28](../src/components/DebugComponent.ts#L27)

```ts
const debugSignaling = new TSSignaling(ctx.eventBus);
debugSignaling.enableDebugDump(true);
```

`debugSignaling` blir opprettet, men aldri koblet til WS. `.enableDebugDump()` setter kun et flagg på _denne_ (ubrukte) instansen. Den _andre_ signaling-instansen (fra `StreamBridgeComponent`) har fortsatt `debugMode = false`.

**Fix:** Gjør debug-dump til en global mekanisme, f.eks. en fil-appender som lytter på `EventBus`, eller eksponer `TSSignaling` via `BotContext` så Debug kan nå samme instans. Enklest:

```ts
// I StreamBridgeComponent.onInit, etter signaling-opprettelse:
if (ctx.config.bot.logLevel === 'debug') {
  this.signaling.enableDebugDump(true);
}
```

Og fjern de to linjene i `DebugComponent`.

---

### #9 — `EventBus`-typing mangler events som komponenter bruker

**Fil:** [src/core/EventBus.ts:6–20](../src/core/EventBus.ts#L6)

Events som finnes i README + `StreamBridgeComponent` men ikke i typing:
- `stream:connected`, `stream:disconnected`, `frame:processed`
- `livekit:connected`, `livekit:disconnected`
- `ts6:connected`, `ts6:disconnected`
- `command:received` (lovet i QUICK_REFERENCE.md)

Hvis man prøver `ctx.eventBus.emit('livekit:connected', 'ts6-stream')` i dag, er typingen overstyrt av `any`-lignende oppførsel. TypeScript fanger ikke feilskriving.

**Fix:**
```ts
export interface BotEvents {
  // TS6 server-events
  'ts6:connected':     () => void;
  'ts6:disconnected':  () => void;
  'ts6:webhook':       (event: TS6WebhookEvent) => void;
  'ts6:clientJoined':  (clientId: string, channelId: string) => void;
  'ts6:clientLeft':    (clientId: string) => void;
  'ts6:streamStarted': (clientId: string) => void;
  'ts6:streamStopped': (clientId: string) => void;

  // Media-pipeline
  'frame:raw':         (frame: RawH264Frame) => void;
  'frame:processed':   (frame: H264Frame) => void;

  // LiveKit
  'livekit:connected':    (roomName: string) => void;
  'livekit:disconnected': (roomName: string) => void;

  // Bridge
  'stream:connected':    (streamerId: string) => void;
  'stream:disconnected': (streamerId: string) => void;

  // Kommandoer
  'command:received':    (cmd: string, args: string[], senderClid: number) => void;

  // Bot lifecycle
  'bot:ready':    () => void;
  'bot:shutdown': () => void;
}
```

---

### #10 — `AutoJoinComponent` har død kode

**Fil:** [src/components/AutoJoinComponent.ts:40–42](../src/components/AutoJoinComponent.ts#L40)

```ts
// TODO: Når TSSignaling støtter det, join ny kanal:
// ctx.eventBus.emit('ts6:streamStopped', clientId);
// ctx.eventBus.emit('ts6:streamStarted', clientId);
```

To problemer:
1. Å emitte `ts6:streamStopped` + `streamStarted` fra _AutoJoin_ er semantisk feil — det er ikke TS6-server som sier stream er stoppet. Det vil få alle lyttere til å tro at det faktisk skjedde.
2. Pattern er "off-og-på-igjen" som cleanup, men `StreamBridgeComponent` vil bruke 1–2 sek på å re-koble LiveKit-rom.

**Fix:** Lag et ordentlig event for re-subscribe:
```ts
// EventBus.ts
'bridge:resubscribe': (streamerId: string, newChannelId: string) => void;

// AutoJoinComponent — når streamer bytter kanal:
ctx.eventBus.emit('bridge:resubscribe', clientId, channelId);

// StreamBridgeComponent lytter på bridge:resubscribe og kaller:
await this.signaling.subscribeToScreenShare(streamerId);   // uten full disconnect
```

---

## 🟡 Medium

### #11 — `loadConfig` støtter ikke env-overrides

**Fil:** [src/config/config.ts](../src/config/config.ts)

README lover at man kan bruke `TS6_API_KEY` etc. som env-variabler, men `loadConfig` leser _bare_ YAML. Så env-override fungerer ikke i praksis.

**Fix:**
```ts
export function loadConfig(path = 'config.yaml'): BotConfig {
  const raw = parse(readFileSync(path, 'utf-8')) as Record<string, any>;

  // Env-overrides
  raw.teamspeak = raw.teamspeak ?? {};
  raw.livekit   = raw.livekit   ?? {};
  raw.bot       = raw.bot       ?? {};

  if (process.env.TS6_API_URL)     raw.teamspeak.apiUrl  = process.env.TS6_API_URL;
  if (process.env.TS6_API_KEY)     raw.teamspeak.apiKey  = process.env.TS6_API_KEY;
  if (process.env.TS6_WS_URL)      raw.teamspeak.wsUrl   = process.env.TS6_WS_URL;
  if (process.env.LIVEKIT_URL)     raw.livekit.url       = process.env.LIVEKIT_URL;
  if (process.env.LIVEKIT_API_KEY) raw.livekit.apiKey    = process.env.LIVEKIT_API_KEY;
  if (process.env.LIVEKIT_SECRET)  raw.livekit.apiSecret = process.env.LIVEKIT_SECRET;
  if (process.env.BOT_LOGLEVEL)    raw.bot.logLevel      = process.env.BOT_LOGLEVEL;

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Ugyldig konfigurasjon:\n${formatZodErrors(result.error)}`);
  }
  return result.data;
}
```

Merk: README skriver `BOT_LOGEVEL` (stavefeil mangler `L`). Ikke kopier den. Riktig er `BOT_LOGLEVEL`.

---

### #12 — `config.teamspeak.apiUrl` er `z.string().url()` — TS6 kan være `https://` eller `http://` lokalt

Fungerer, men `wsUrl` har `z.string().min(1)` — den burde også valideres som URL.

**Fix:**
```ts
wsUrl: z.string().regex(/^wss?:\/\//, 'teamspeak.wsUrl må starte med ws:// eller wss://'),
```

Samme for `livekit.url`.

---

### #13 — `H264PacketParser.findStartCodes` er O(n) men kunne vært mer robust

**Fil:** [src/pipeline/H264PacketParser.ts:63–74](../src/pipeline/H264PacketParser.ts#L63)

Sjekker `data[i] === 0x00 && data[i+1] === 0x00` for hver iterasjon. Korrekt, men:
- Hopper ikke utenfor `data.length - 3` i alle grener (linje 67 kan lese utover).
- Håndterer ikke _emulation prevention bytes_ (0x03 som injiseres når naturlig bytesekvens ville sett ut som startcode).

**Fix (minor — finjuster loop-kondisjon):**
```ts
private findStartCodes(data: Buffer): number[] {
  const positions: number[] = [];
  const maxI = data.length - 3;

  for (let i = 0; i <= maxI; i++) {
    if (data[i] !== 0x00 || data[i + 1] !== 0x00) continue;

    if (i <= maxI && data[i + 2] === 0x00 && i + 3 < data.length && data[i + 3] === 0x01) {
      positions.push(i + 4);
      i += 3;
    } else if (data[i + 2] === 0x01) {
      positions.push(i + 3);
      i += 2;
    }
  }
  return positions;
}
```

Emulation-prevention: kun relevant hvis du skal _dekode_ frames. For bridge-formålet (pass through til LiveKit) trengs det ikke.

---

### #14 — `FramePipeline.processQueue()` serialiserer _alt_ selv på keyframes

**Fil:** [src/pipeline/FramePipeline.ts:60–74](../src/pipeline/FramePipeline.ts#L60)

Køen behandler en task om gangen med `await`. Det er korrekt for ordering, men:
- `processing = true` blir aldri resat om en task kaster (catcher feilen, men `processing` settes til `false` først etter while — det er ok, men ingen retry).
- Det finnes ingen max-drain-tid; én treig `pushFrame` kan låse hele køen.

**Fix:**
```ts
private async processQueue(): Promise<void> {
  if (this.processing) return;
  this.processing = true;

  try {
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      try {
        await Promise.race([
          task(),
          new Promise((_, rj) => setTimeout(() => rj(new Error('frame timeout')), 500)),
        ]);
      } catch (err) {
        this.logger.warn('[FramePipeline] Feil/timeout ved sending av frame:', err);
      }
    }
  } finally {
    this.processing = false;
  }
}
```

(og ta inn `logger` som konstruktør-argument istedenfor `console`.)

---

### #15 — `AutoJoin` bruker "unknown" som channelId placeholder — forvirrende

**Fil:** [src/components/AutoJoinComponent.ts:21](../src/components/AutoJoinComponent.ts#L21)

```ts
this.activeStreamers.set(clientId, 'unknown');
```

Senere sjekker `prevChannel === channelId`. Første `clientJoined`-event trigger `set('unknown', newChannel)` — altså registreres alltid som _bytte_. Logikken jobber som en bivirkning, men gjør det vanskelig å resonnere om.

**Fix:** Bruk `undefined` + nullable-type, eller utled channelId synkront fra `TS6RestClient.getClient(clientId)` ved stream-start:

```ts
private activeStreamers = new Map<string, string | undefined>();

ctx.eventBus.on('ts6:streamStarted', async (clientId) => {
  try {
    const client = await ctx.ts6Api.getClient(Number(clientId));
    this.activeStreamers.set(clientId, String(client.cid));
  } catch {
    this.activeStreamers.set(clientId, undefined);
  }
});
```

Legg også til `getClient(clid)` i `TS6RestClient` (mangler i dag).

---

### #16 — `Bot.start()` registrerer SIGINT/SIGTERM-handlere uten `once` eller cleanup

**Fil:** [src/core/Bot.ts:50–51](../src/core/Bot.ts#L50)

Om `bot.start()` kalles to ganger (f.eks. i tester), får du to handlere og `bot.stop()` kalles dobbelt. Også: flytt handler til `index.ts` (se #3).

**Fix:** Se #3 — flytt ut av `start()`.

---

### #17 — `DebugComponent.onDestroy()` bruker `this.ctx` som kan være udefinert om init kastet tidlig

**Fil:** [src/components/DebugComponent.ts:67–69](../src/components/DebugComponent.ts#L67)

Om `writeFileSync(this.eventsLog, '')` kaster (read-only filesystem), blir `onDestroy` kalt med `this.ctx` udefinert.

**Fix:**
```ts
async onDestroy(): Promise<void> {
  this.ctx?.logger.info(`[Debug] Avslutter — events i ${this.eventsLog}, rå WS i ${this.rawLog}`);
}
```

Eller: sett `this.ctx = ctx` før første operasjon som kan kaste.

---

### #18 — Manglende `Accept`-header i `TS6RestClient.request()`

**Fil:** [src/api/TS6RestClient.ts:37–44](../src/api/TS6RestClient.ts#L37)

```ts
headers: {
  'x-api-key':    this.apiKey,
  'Content-Type': 'application/json',
},
```

Mangler `'Accept': 'application/json'`. Noen REST-implementasjoner returnerer HTML eller annet default-format uten.

**Fix:** Legg til `'Accept': 'application/json'`. Også: legg til `User-Agent: ts6-stream-bot/0.1.0`.

---

### #19 — `TS6RestClient` har ingen timeout eller retry

**Fil:** [src/api/TS6RestClient.ts:37](../src/api/TS6RestClient.ts#L37)

`fetch()` uten `AbortController` henger i det uendelige ved nettverks-stall. TS6-server som er nede stopper hele boten fordi `verifyTS6Connection()` aldri resolver.

**Fix:**
```ts
private async request<T>(path: string, method = 'GET', body?: unknown, timeoutMs = 5000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { 'x-api-key': this.apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`TS6 API ${method} ${path} → ${res.status}: ${await res.text().catch(()=>'')}`);
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}
```

For retry: bruk `p-retry` med eksponentiell backoff (3 forsøk, start 500 ms).

---

### #20 — `loadConfig` støtter ikke `~/.config/ts6-stream-bot/config.yaml`

Mindre-viktig, men: tvinger brukeren til å ha `config.yaml` i CWD. OK for dev, dårlig for produksjon.

**Fix:** Se etter `path`-argument → `$XDG_CONFIG_HOME` → `~/.config/ts6-stream-bot/` → `cwd/config.yaml`.

---

## 🟢 Lav alvorlighet / polish

### #21 — Index-signatur kolonne-justering
`types.ts` har vakker manuell justering med mellomrom — prettier vil rive dette. Bestem om du _vil_ ha det, og da konfigurer prettier med `printWidth: 120` + `arrowParens: always` og disabler justering. Eller aksepter at prettier riper av kosmetikken.

### #22 — `CommandComponent.handleCommand` — `switch/case` vil vokse
Refaktor til en kommando-map:
```ts
private readonly commands: Record<string, (args: string[], sender: number) => Promise<void>> = {
  status: (_, s) => this.cmdStatus(s),
  clients: (_, s) => this.cmdClients(s),
  kick: (a, s) => this.cmdKick(Number(a[0]), a.slice(1).join(' '), s),
};
```

### #23 — `BotContext.ts6Api` er alltid definert — men hva hvis TS6 er nede?
Komponentene bruker `ctx.ts6Api` bombe-sikkert. Vurder `ctx.ts6Api?.getServerInfo()` eller la `Bot` retrye `verifyTS6Connection()` noen ganger før den gir opp.

### #24 — Logger-format inkluderer `extra` som stringified JSON
[config/logger.ts:10](../src/config/logger.ts#L10)

Det er greit i dev, men i prod er strukturert JSON bedre (Loki/Datadog-parsing). Se Sprint 5 om `json()` format for produksjon.

### #25 — `BaseComponent.onInit` og `onDestroy` er `abstract` — tvinger tomme stubs
I `CommandComponent.ts:31` finner du `async onDestroy(): Promise<void> {}` kun for å tilfredsstille abstract-kontrakten. Gjør en eller begge optional:

```ts
export abstract class BaseComponent {
  abstract readonly name: string;
  abstract onInit(ctx: BotContext): Promise<void>;
  onDestroy(): Promise<void> { return Promise.resolve(); }
}
```

### #26 — Stavefeil i `README.md:210` — `BOT_LOGEVEL`
Skal være `BOT_LOGLEVEL`. Vil lure folk som copy-paster.

### #27 — `docs/INDEX.md:221-226` er datert 2024-01-15
Dokumenter har falske "sist oppdatert"-datoer. Bruk git-lognavn automatisk eller bare fjern tabellen.

### #28 — `QUICK_REFERENCE.md:115` lover `sendMessage`
Samme som #5 — metoden eksisterer ikke ennå. Fix enten ved å implementere eller ved å merke som "planlagt".

### #29 — `api/TS6RestClient.ts:75` `registerWebhook` har hardkodet `events = ['*']`
Fine default, men ingen måte å _unregister_ på. Legg til `unregisterWebhook(url)`.

### #30 — Inkonsistente import-baner — `.js` vs uten
Prosjektet bruker ESM med `.js`-suffix i imports (korrekt for `moduleResolution: node`). Men `tsconfig.json` har `"moduleResolution": "node"` (legacy). Vurder `"moduleResolution": "nodenext"` for bedre ESM-samsvar.

---

## Mønstre og antipatterns

### Pattern — Bruk av `!` non-null assertion
Komponentene har `private ctx!: BotContext;` osv. Det er trygt _så lenge_ `onInit` kalles før andre metoder, som `Bot` garanterer. Men det gir deg ikke compile-time sikkerhet.

**Alternativ:** Bruk konstruktør-injection i stedet for `onInit`-tilstand:

```ts
export class CommandComponent extends BaseComponent {
  readonly name = 'command';
  constructor(private ctx: BotContext) { super(); }
  async onInit(): Promise<void> { /* subscribe events */ }
}

// I index.ts ville det bryte pattern fordi ctx ikke er tilgjengelig der.
// Alternativ 2: factory
bot.register((ctx) => new CommandComponent(ctx));
```

Men dette er et større arkitekturvalg. Grei nok som er nå.

### Antipattern — `unknown` som stubbe-type

```ts
private videoSource: unknown = null;
private room:        unknown = null;
```

`unknown` her er en markør for "vil få type senere når wrtc/livekit importeres". Det fungerer, men når du aktiverer pakken må du endre fire steder. Vurder:

```ts
import type { VideoSource, Room } from '@livekit/rtc-node';
// ... i klassen:
private videoSource: VideoSource | null = null;
private room: Room | null = null;
```

Import `type`-only koster ingenting selv om kode-import er kommentert ut.

### Antipattern — `console.log` sammen med Winston
Se #7. Vi vil én logging-kanal, ikke to.

### Antipattern — TODOs som semi-kompilerbar kode
```ts
// TODO: Aktiver når @livekit/rtc-node er installert
// import { Room, VideoSource, ... } from '@livekit/rtc-node';
// ...
void jwt; // midlertidig til TODO over er aktivert
```

Pakken _er_ i `dependencies` allerede. TODOen er foreldet — du kan aktivere koden. Dette er et klassisk tilfelle av "kom aldri tilbake til TODO".

---

## Sikkerhet (quick scan)

| # | Problem | Sted | Fix |
|---|---|---|---|
| S1 | API-nøkkel i klartekst i `config.yaml` (kan checkes inn) | [.gitignore](../.gitignore) | Se #2 |
| S2 | Webhook-endpoint mangler HMAC-signatur-verifisering | (ikke implementert ennå) | Når `WebhookServer` lages (#4), verifiser `X-TS6-Signature` med shared secret |
| S3 | `kick`-kommando krever ingen autentisering | [CommandComponent.ts](../src/components/CommandComponent.ts) | Se Sprint 4 S4-6 — admin-liste |
| S4 | Ingen input-validering på kommando-args — en ond bruker kan sende veldig lang tekst | `CommandComponent.handleCommand` | `if (text.length > 500) return;` før parsing |
| S5 | `fetch` i `TS6RestClient` uten TLS-pinning | `TS6RestClient.ts` | For lokal bruk ok; for produksjon m/ cloud: vurder `undici.Agent` med pinning |
| S6 | Logger logger kanskje API-nøkkel ved feil | `TSSignaling` debug-dump | Sjekk at `buildAuthMessage` sin `token` ikke havner i `ts6-ws-raw.jsonl` — mask den før skriving |

---

## Ytelse og ressurser

| # | Observasjon | Kommentar |
|---|---|---|
| P1 | `appendFileSync` i `DebugComponent.log` og `TSSignaling.handleRawMessage` blokker event-loop | Bytt til asynkron stream-write (`fs.createWriteStream`) |
| P2 | `H264FrameAssembler.prependParameterSets` lager ny Buffer.concat per IDR | OK — IDR er sjelden, ikke hot path |
| P3 | `FramePipeline.queue` er `Array<() => Promise<void>>` — OK for 10 elementer | Hvis `maxQueueSize` øker til >100, bytt til ringbuffer |
| P4 | `EventEmitter3` — ingen max listener warning | Sett `ee.setMaxListeners(50)` i EventBus-konstruktør, slik at du ikke mister warning hvis komponenter lekker lyttere |
| P5 | Winston-console + fil-transport i samme call — sync-ish | Greit; rotation er viktigere (Sprint 5) |

---

## Testdekning — hvor er hullene?

Null tester er committet. Prioritert test-rekkefølge:

1. **`H264PacketParser`** — pure function, lett å teste, høy verdi.
2. **`H264FrameAssembler`** — stateful men deterministisk.
3. **`FramePipeline`** — timing + backpressure.
4. **`loadConfig`** — lett å teste edge cases.
5. **`TSSignaling` (med MockTS6Server)** — integration.
6. **`Bot` lifecycle** — registrer dummy-komponenter, verifiser init/destroy-rekkefølge.

Mål: 60 % coverage til Sprint 1-slutt, 80 % til v1.0.

---

## Konkrete kommandoer — fiks nå

Sprint 0-S0-1 gjennom S0-4 kan kjøres sekvensielt:

```bash
# 1. Installer manglende pakke
npm install yaml

# 2. Oppdater .gitignore (kopier innholdet over)

# 3. Rename config.yaml → config.example.yaml med dummy-verdier
#    Oppretthold config.yaml lokalt med ekte verdier (nå gitignored)

# 4. Verifiser
npm run build
npm run dev   # Skal starte uten TS6-tilkobling — feile ryddig
```

---

## Oppsummering

| Alvorlighet | Antall funn |
|---|---|
| 🔴 Kritisk | 3 |
| 🟠 Høy | 7 |
| 🟡 Medium | 10 |
| 🟢 Lav | 10 |
| **Totalt** | **30** |

**Absolutt prioritet:** #1 (yaml-pakke), #2 (.gitignore), #3 (process.exit).
**Deretter:** #4 (webhook), #5 (chat-svar), #6 (reconnect), #7 (logger), #9 (eventtyping).

Resten kan håndteres i løpet av Sprint 1–2.

---

*Se også: [ROADMAP.md](./ROADMAP.md) for tidsplan, [IMPROVEMENTS.md](./IMPROVEMENTS.md) for oppgraderinger som ikke er direkte bug-fix.*

*Versjon 1.0 — 2026-04-21 • audit av commit 5a6b5d5*
