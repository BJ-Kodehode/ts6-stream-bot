# TS6 Stream Bot — Arbeidsplan (Roadmap)

> **Formål:** Konkret, sprint-basert arbeidsplan som tar prosjektet fra nåværende 40–50 % ferdigstillelse til v1.0.
> **Komplementerer** den strategiske 6-fase-planen i [ts6-stream-bot-doc.md](./ts6-stream-bot-doc.md) med operasjonelle, leverbare oppgaver.
> **Leveser:** Hver sprint ender i en kjørbar, demonstrerbar tilstand (selv om funksjonen bak er stub).

---

## Oppsummering — Hvor står vi?

| Område | Status | Kommentar |
|---|---|---|
| Bot-rammeverk (Bot, EventBus, BaseComponent) | ✅ 95 % | Solid arkitektur, små opprydninger |
| Konfigurasjon (Zod + YAML) | ⚠️ 80 % | `yaml`-pakke mangler i `package.json` — krasjer ved oppstart |
| TS6 REST API-klient | ✅ 85 % | Mangler `sendMessage`, paginering, retries |
| TS6 WebSocket-signaling | 🟡 40 % | Skeleton finnes, men meldingstyper er TODO |
| TS6 WebRTC | 🔴 5 % | Ren stub — hele pipelinen er kommentert ut |
| H.264 parsing + assembly | ✅ 80 % | Fungerer i prinsipp, mangler tester og edge cases |
| LiveKit-integrasjon | 🔴 10 % | Kobler token, men ingen reell publisering |
| Webhook-server | 🔴 0 % | Nevnt i config, men ingen HTTP-server startes |
| Kommandoer | 🟡 50 % | Svar kun i logg — ikke tilbake til TS6-chat |
| Tester | 🔴 0 % | Vitest er installert, men ingen tester finnes |
| CI/CD | 🔴 0 % | Ikke satt opp |
| Observability (metrics, health) | 🔴 0 % | Kun console/file-logg |
| Dashboard/Frontend | 🔴 0 % | Ikke startet — foreslått i [FRONTEND_DESIGN.md](./FRONTEND_DESIGN.md) |

**Kritisk blocker:** TS6 sin WebSocket-klientprotokoll er ikke reverse-engineered. Alt som handler om WebRTC, stream-start, ICE-candidates osv. er stubs.

---

## Prinsipper for planen

1. **Unblock først.** Før vi bygger nytt, fjerner vi det som hindrer kjøring (manglende pakker, kompilerings­feil).
2. **Protokoll-first.** Uten kjent TS6-WS-protokoll er alt downstream spekulasjon. Sprint 2 er reverse engineering.
3. **Mock underveis.** Hver pipeline-del skal kunne testes mot en fake (MockTS6Server, FakeFrameSource) — ikke bare mot ekte server.
4. **Grønn build hver sprint.** `npm run build` + `npm test` + `npm run dev` må fullføre uten feil før sprint regnes som ferdig.
5. **Demo på slutten.** Hver sprint leverer én konkret ting man kan vise frem.

---

## Sprint 0 — Stabilisering (1–2 dager)

**Mål:** Prosjektet kompilerer, kjører og har en grønn test-pipeline.

### Oppgaver
- [ ] **S0-1** Legg til `yaml` i `package.json` (eller bytt til `js-yaml`). Kjør `npm install`. [Se CODE_REVIEW funn #1]
- [ ] **S0-2** Fix `.gitignore`: legg til `bot.log`, `ts6-events.jsonl`, `ts6-ws-raw.jsonl`, `.env`, `config.local.yaml`, `*.pem`. Sensitive filer har allerede lekket om noen har committet `config.yaml` med ekte nøkkel.
- [ ] **S0-3** Lag `config.example.yaml` med dummy-verdier, og la `config.yaml` være gitignored.
- [ ] **S0-4** Legg til env-støtte (Zod-override): `TS6_API_KEY` og `LIVEKIT_API_SECRET` skal helst komme fra env, ikke YAML.
- [ ] **S0-5** Skriv første Vitest-testfil: `H264PacketParser.test.ts` (start-code detection, NAL-type parsing, FU-A reassembly).
- [ ] **S0-6** Legg til `eslint` + `prettier` med `@typescript-eslint` og kjør på `src/`. Fix warnings.
- [ ] **S0-7** Lag GitHub Actions workflow (`.github/workflows/ci.yml`): install → build → test.
- [ ] **S0-8** Fix `README.md` "npm test" påstand — det finnes ingen tester ennå. Oppdatert status i [STATUS.md](./STATUS.md) eller inline.
- [ ] **S0-9** Fjern `DebugComponent` sin ubrukte `TSSignaling`-instans (linje 27–28 — den blir opprettet men aldri koblet til).

### Demo
```bash
npm install        # Ingen feil
npm run build      # Ingen feil
npm test           # Minst én grønn test
npm run dev        # Starter, feiler ryddig når TS6 ikke er tilgjengelig
```

---

## Sprint 1 — Testbar kjerne (3–5 dager)

**Mål:** Alle komponenter som *kan* testes uten TS6-server har tester. Bot-lifecycle er rett.

### Oppgaver
- [ ] **S1-1** Unit-tests for `H264PacketParser` — minst 10 cases (empty, single NAL, multiple NALs, STAP-A, FU-A med/uten end).
- [ ] **S1-2** Unit-tests for `H264FrameAssembler` — SPS+PPS+IDR flyt, FU-A fragmentering over flere pakker, reset().
- [ ] **S1-3** Unit-tests for `FramePipeline` — backpressure (drop P-frame når full), keyframe alltid gjennom, stopp/start.
- [ ] **S1-4** Integration-test for `EventBus` — typed events fungerer.
- [ ] **S1-5** Unit-tests for `config.ts` — valid config, invalid URL, manglende nøkler, defaults brukes.
- [ ] **S1-6** Fix `Bot.stop()` — ikke kall `process.exit(0)` direkte (gjør det umulig å teste). Flytt til `index.ts`.
- [ ] **S1-7** Fix `Bot.start()` — SIGINT/SIGTERM-handler bør legges på utenfor `start()` (alternativ: kun én gang, ikke per start).
- [ ] **S1-8** Fix `EventBus`-typing — legg til events som brukes i komponenter men ikke er typet (f.eks. `stream:connected`, `livekit:connected`, `frame:processed`).
- [ ] **S1-9** Legg `ts6:connected`/`ts6:disconnected` events i `TSSignaling` og emit når WS åpner/lukker.
- [ ] **S1-10** Lag `tests/fixtures/` med ekte H.264-bytes-samples (SPS, PPS, IDR, FU-A) for testene.

### Demo
```bash
npm test   # Minimum 25 grønne tester, coverage rapporteres
npm run dev   # Verifyer at typing-feil i EventBus er borte
```

---

## Sprint 2 — Protokoll-reversing og MockServer (5–7 dager)

**Mål:** TS6 WebSocket-meldingsformat er kjent og dokumentert. Testene kan kjøre uten ekte TS6-server.

### Oppgaver
- [ ] **S2-1** Aktiver `DebugComponent` og koble fra en ekte TS6-klient i 10 min. Dump `ts6-ws-raw.jsonl`.
- [ ] **S2-2** Start en screenshare i TS6. Dump trafikken. Marker hvilke linjer som er auth, channel-events, SDP-offer, ICE-candidates.
- [ ] **S2-3** Dokumenter meldingsformatet i ny fil [docs/TS6_PROTOCOL.md](./TS6_PROTOCOL.md) — én seksjon per meldingstype med ekte eksempel.
- [ ] **S2-4** Oppdater `TSProtocol.ts` med ekte `MessageType`-strenger og korrekt payload-struktur.
- [ ] **S2-5** Definer strenge TypeScript-interfaces per meldingstype (f.eks. `AuthResponse`, `WebRTCOfferMessage`) — erstatt `Record<string, unknown>`.
- [ ] **S2-6** Lag `tests/mocks/MockTS6Server.ts` — en WebSocket-server som svarer med ekte-lignende meldinger på basis av dump.
- [ ] **S2-7** Integration-test: `TSSignaling.connect()` mot MockTS6Server, verifiser at `ts6:streamStarted` emittes når MockServer sender stream-started-melding.
- [ ] **S2-8** Error-handling: Hva skjer om auth feiler? Legg til `auth_failed`-event og håndter det i `StreamBridgeComponent`.

### Demo
- Vis `docs/TS6_PROTOCOL.md` med reelle payload-eksempler.
- Kjør bot mot MockTS6Server og se `[StreamBridge] Stream startet av: ...` i logg.

---

## Sprint 3 — WebRTC + LiveKit fungerer end-to-end (7–10 dager)

**Mål:** Én ekte H.264-frame går fra TS6 gjennom pipeline til LiveKit-rom. Selv om bildekvaliteten er grusom — første gang video flyter.

### Oppgaver
- [ ] **S3-1** Installer WebRTC-pakke: `@roamhq/wrtc` (mest aktivt vedlikeholdt).
- [ ] **S3-2** Implementer `TSWebRTC.handleOffer()`: `RTCPeerConnection`, `setRemoteDescription`, `createAnswer`, `setLocalDescription`.
- [ ] **S3-3** Implementer `addIceCandidate()` med buffer (candidates kan komme før `setRemoteDescription`).
- [ ] **S3-4** Koble `ontrack` til `frame:raw` event — extract H.264 payload fra RTP.
- [ ] **S3-5** Installer og aktiver `@livekit/rtc-node` i `LiveKitConnector` (koden er kommentert ut).
- [ ] **S3-6** `LiveKitConnector.pushFrame()`: bruk `VideoSource.captureFrame()` med `VideoFrame(data, H264, timestamp)`.
- [ ] **S3-7** Håndter `videoSource`-lifecycle: reset ved reconnect, dispose ved disconnect.
- [ ] **S3-8** End-to-end manuell test: TS6 screenshare → LiveKit room → LiveKit web playground viser video.
- [ ] **S3-9** Logg metrics: frames-per-second, keyframe-intervall, dropped frames i `FramePipeline`.
- [ ] **S3-10** Håndter reconnect i `TSSignaling` bedre (nå blir `serverUrl` og timer lekket).

### Demo
- Skjermopptak: TS6-bruker streamer skjerm → LiveKit playground viser samme innhold (< 2 s latency).

---

## Sprint 4 — Webhook-server + CommandComponent live (3–5 dager)

**Mål:** Boten svarer i TS6-chat på ekte kommandoer, og mottar webhook-events fra serveren.

### Oppgaver
- [ ] **S4-1** Lag `src/api/WebhookServer.ts` — Express eller Fastify på `config.teamspeak.webhookPort`, validerer HMAC-signatur om tilgjengelig, emitter `ts6:webhook`.
- [ ] **S4-2** Registrer boten som webhook-mottaker ved oppstart (bruk `TS6RestClient.registerWebhook()`).
- [ ] **S4-3** Utvid `TS6RestClient` med `sendMessage(clientId, text)` — API.md lover dette, men metoden finnes ikke.
- [ ] **S4-4** `CommandComponent`: send respons tilbake til brukeren via `sendMessage` (i dag skrives kun til logg).
- [ ] **S4-5** Legg til `!help` og `!bridge on/off` (lovet i README).
- [ ] **S4-6** Tilgangskontroll: lag `adminClientIds` i config. `!kick` krever admin.
- [ ] **S4-7** Config-drevet prefix (`PREFIX` er hardkodet `'!'` i dag).

### Demo
- Chat i TS6: skriv `!status` → boten svarer i samme kanal.
- Skriv `!bridge off` som admin → streaming stopper, boten bekrefter.

---

## Sprint 5 — Observability, reliability, pakking (4–6 dager)

**Mål:** Produksjonsklar stabilitet, enkel å drifte.

### Oppgaver
- [ ] **S5-1** Prometheus-metrics: `prom-client`-endpoint på `/metrics` (frames_processed_total, ts6_ws_connected, livekit_connected, uptime_seconds).
- [ ] **S5-2** Health-endpoint på `/healthz` + `/readyz`.
- [ ] **S5-3** Structured logging: bytt Winston-format til JSON i produksjon (let for Loki/ELK). Behold pretty i dev.
- [ ] **S5-4** Winston file rotation (`winston-daily-rotate-file`).
- [ ] **S5-5** Dockerfile + `docker-compose.yml` med TS6 + LiveKit + bot.
- [ ] **S5-6** Graceful shutdown: wait for in-flight frames, close rooms, close sockets. Gi timeout (f.eks. 10 s) før force-exit.
- [ ] **S5-7** Retry-logikk i `TS6RestClient` med eksponentiell backoff (bruk `p-retry`).
- [ ] **S5-8** Rate-limiting på kommando-handler (ikke la en bruker spamme `!status`).
- [ ] **S5-9** Publiser versjon 0.5.0 på GitHub Releases med changelog.

### Demo
- `docker-compose up` starter alt. `curl localhost:9090/metrics` viser tall.
- Drep TS6-server mens boten kjører — den reconnecter seg uten crash.

---

## Sprint 6 — Dashboard og polishing (5–7 dager)

**Mål:** Frontend dashboard for å følge med / styre boten live.

Full spec i [FRONTEND_DESIGN.md](./FRONTEND_DESIGN.md). Grovt:

- [ ] **S6-1** Velg stack: Vite + React + TypeScript (eller SvelteKit om foretrukket).
- [ ] **S6-2** Legg til `src/api/DashboardApi.ts` som eksponerer REST/SSE-endepunkt for frontend.
- [ ] **S6-3** Implementer designsystem fra [FRONTEND_DESIGN.md](./FRONTEND_DESIGN.md) (tokens, komponenter).
- [ ] **S6-4** Grunnleggende sider: Live status, Aktive streams, Kommandolog, Innstillinger.
- [ ] **S6-5** WebSocket/SSE fra bot → dashboard for live-events (ingen polling).
- [ ] **S6-6** Auth-wall (enkel: API-nøkkel; senere: OAuth).
- [ ] **S6-7** Bygg frontend inn i `dist/public/` og serv fra samme Node-prosess.

### Demo
- Åpne `http://localhost:3000` → se live-status, aktive streamere, frames-per-second-graf.

---

## Sprint 7+ — Nice-to-have og community

Uprioriterte ideer, plukk fra listen:

- Multi-room: ett TS6 ↔ mange LiveKit-rom samtidig.
- Audio-bridging (TS6 voice → LiveKit audio-track).
- Recording: ta opp strømmer lokalt (mp4 via ffmpeg) mens de bridges.
- Transcoding: VP8/AV1 fallback for klienter uten H.264-støtte.
- OBS WebSocket-integrasjon for studio-kontroll.
- Discord-bridge som alternativ output.
- Plugin-API: npm-pakker som definerer egne `BaseComponent`-underklasser.
- Internasjonalisering av kommandoer (engelsk default, norsk fallback).

---

## Kritisk vei (avhengigheter)

```
Sprint 0 (stabiliser)
   └─► Sprint 1 (tester)
           └─► Sprint 2 (protokoll)
                   └─► Sprint 3 (WebRTC + LiveKit)  ← HER ER DET VIRKELIG KULT
                           └─► Sprint 4 (webhook + kommandoer)
                                   └─► Sprint 5 (reliability)
                                           └─► Sprint 6 (dashboard)
```

Sprint 0, 1 og 2 har **ingen** avhengighet til TS6 eller LiveKit. De kan gjøres i hvilket som helst miljø. Sprint 3 er første gang man trenger både TS6-server og LiveKit-instans for å teste.

---

## Estimert tidslinje (realistisk for én utvikler)

| Sprint | Kalenderdager (side-prosjekt, 10 t/uke) | Kalenderdager (fulltid) |
|---|---|---|
| 0 | 3–5 | 1–2 |
| 1 | 7–10 | 3–5 |
| 2 | 10–14 | 5–7 |
| 3 | 14–21 | 7–10 |
| 4 | 7–10 | 3–5 |
| 5 | 10–14 | 4–6 |
| 6 | 10–14 | 5–7 |
| **Totalt til v1.0** | **~2–3 måneder** | **~4–6 uker** |

Protokoll-reversing (Sprint 2) og WebRTC (Sprint 3) er de mest uforutsigbare — legg til 30 % buffer.

---

## Risikoer og mitigeringer

| Risiko | Sannsynlighet | Impact | Mitigering |
|---|---|---|---|
| TS6 endrer klientprotokollen under beta | Høy | Katastrofal | Integration-test mot MockTS6Server fanger opp, abstraher protokoll bak `TSProtocol.ts` |
| `@roamhq/wrtc` støtter ikke H.264 på din plattform | Medium | Høy | Fallback: `ffmpeg-static` som subprocess for decoding |
| LiveKit API endrer seg | Lav | Medium | Lås major version i `package.json`, Renovate-bot for oppdateringer |
| TS6 licensing-restriksjoner for bots | Medium | Høy | Følg med på TS6-forum, ha kontakt med TS-utviklerne før kommersiell bruk |
| Ytelse: full HD @ 60 fps kan være tungt i Node | Medium | Medium | Profiler med `clinic.js`, vurder native addon for parsing hvis nødvendig |

---

## Definition of Done (per sprint)

En sprint er ferdig når:

1. Alle oppgaver i sprinten er hake'et, eller flyttet til backlog med begrunnelse.
2. `npm run build` kjører uten feil eller warnings.
3. `npm test` er grønn (+ coverage ≥ 60 % for Sprint 1+).
4. `npm run dev` starter og ikke krasjer innen 60 sek i ren tilstand.
5. Ny/endret funksjonalitet er dokumentert i relevant `docs/*.md`.
6. `CHANGELOG.md` er oppdatert.
7. Git-tag `v0.X.0` lagt på main.

---

## Neste steg nå

**Akkurat nå skal du:**
1. Les [CODE_REVIEW.md](./CODE_REVIEW.md) for en konkret bug-liste.
2. Start med Sprint 0, oppgave S0-1 (manglende `yaml`-pakke — er en showstopper).
3. Når S0 er ferdig: sett opp CI, selv om det føles overkill. Det betaler seg fra dag 1.
4. Les [IMPROVEMENTS.md](./IMPROVEMENTS.md) for mønstre du kan bruke mens du jobber med sprintene.

---

*Versjon 1.0 — 2026-04-21*
