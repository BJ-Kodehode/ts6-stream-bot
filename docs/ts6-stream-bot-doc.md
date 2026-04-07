================================================================================
  TS6 STREAM BOT — Teknisk Designdokument
  TeamSpeak 6 → LiveKit Screen Share Bridge
  Versjon: 0.1 DRAFT | Mars 2026
================================================================================


────────────────────────────────────────────────────────────────────────────────
1. SAMMENDRAG
────────────────────────────────────────────────────────────────────────────────

Dette dokumentet beskriver design og arkitektur for en server-side bot som
kjører på en TeamSpeak 6 (TS6) server. Botens primære oppgave er å fange opp
skjermdelingsstrømmer (screen share) fra TS6-klienter og videresende dem til
et LiveKit room, slik at eksterne seere kan se strømmen uten å være tilkoblet
TS6-serveren direkte.

Boten er designet komponentbasert i TypeScript slik at ny funksjonalitet kan
legges til som isolerte komponenter uten å endre kjernelogikken.


────────────────────────────────────────────────────────────────────────────────
2. KONTEKST OG BAKGRUNN
────────────────────────────────────────────────────────────────────────────────

2.1 TeamSpeak 6 — Hva er nytt
──────────────────────────────

TeamSpeak 6 er en komplett omskrivning av TS3 og introduserer flere
arkitekturelle endringer relevante for dette prosjektet:

  • WebRTC:   Screensharing via WebRTC (P2P med server-relay)
  • H.264:    OpenH264 som standard videokodek for screensharing
  • GPU:      GPU-akselerert enkoding/dekoding via FFmpeg (AMF, QSV, NVENC)
  • REST API: HTTP/REST API på port 10080 erstatter telnet ServerQuery
  • P2P:      P2P streaming med single-encoding sparer ressurser ved flere seere

INFO — TS6 beta3 Foundation I Update (Oktober 2025):
  Denne oppdateringen introduserte OpenH264-støtte, P2P streaming med
  single-encoding, dynamisk kodek-valg og GPU-hardware-akselerasjon.
  Dette er versjonen boten er designet mot.


2.2 Kritisk arkitekturforståelse: Hvor sitter streamen?
────────────────────────────────────────────────────────

TS6 sitt Remote App API (WebSocket, port 5899) er et klient-side kontroll-API
— det kjører på brukerens maskin, ikke på serveren. Det eksponerer IKKE
mediastrømmer.

Screensharing skjer via WebRTC direkte mellom klientene (P2P), med serveren
som signalformidler. For å få tilgang til H.264-framedata må boten opptre som
en fullverdig TS6-klient og delta i WebRTC-sesjonen.

ADVARSEL — Server-side bot betyr headless TS6-klient:
  Boten kan IKKE motta H.264-frames via TS6 server REST API alene.
  Den må implementere TS6 sin klientprotokoll og koble seg til
  screenshare-sesjonen som en vanlig (headless) deltaker.
  Dette krever reverse engineering av klientprotokollen.


────────────────────────────────────────────────────────────────────────────────
3. DATAFLYT
────────────────────────────────────────────────────────────────────────────────

3.1 Overordnet flyt
────────────────────

  TS6 Klient (bruker)
      │
      │  WebRTC P2P / server-relay (H.264 over RTP)
      ▼
  TS6Client (headless bot-klient på servermaskinen)
      │  Kobler seg til kanalen via TS6-protokollen
      │  Deltar i WebRTC-sesjon, mottar H.264-stream
      ▼
  H264PacketParser  →  H264FrameAssembler
      │  Parser NAL units, håndterer FU-A fragmentering
      │  Setter sammen komplette keyframes + P-frames
      ▼
  LiveKitConnector
      │  Publiserer H.264 direkte som VideoTrack
      │  Ingen re-encoding nødvendig
      ▼
  LiveKit Room  →  Seere (nettleser, app, etc.)


3.2 H.264 Pipeline — teknisk detalj
─────────────────────────────────────

TS6 bruker OpenH264 som kodek. H.264-dataen pakkes som NAL units
(Network Abstraction Layer). Pipelinen håndterer følgende NAL-typer:

  NAL Type         Beskrivelse
  ─────────────────────────────────────────────────────────────────────────
  SPS (type 7)     Sequence Parameter Set — inneholder kodekparametre.
                   Lagres og prepend-es til IDR-frames.

  PPS (type 8)     Picture Parameter Set — bildeparametre.
                   Lagres og prepend-es til IDR-frames.

  IDR (type 5)     Keyframe (Intra-coded). Komplett bilde, kan dekodes
                   uten historikk.

  Non-IDR (type 1) P-frame / B-frame. Delta-frame, refererer til
                   tidligere frames.

  FU-A (type 28)   Fragmentation Unit. Store frames splittet over flere
                   pakker. Reassembles før videre prosessering.


────────────────────────────────────────────────────────────────────────────────
4. SYSTEMARKITEKTUR
────────────────────────────────────────────────────────────────────────────────

4.1 Prosjektstruktur
─────────────────────

  ts6-stream-bot/
  ├── src/
  │   ├── core/
  │   │   ├── Bot.ts                  # Lifecycle og orkestrering
  │   │   ├── EventBus.ts             # Intern pub/sub mellom komponenter
  │   │   └── types.ts                # Felles interfaces og typer
  │   │
  │   ├── connectors/
  │   │   ├── TS6Client/
  │   │   │   ├── TSSignaling.ts      # WebSocket signalisering mot TS6
  │   │   │   ├── TSWebRTC.ts         # WebRTC peer connection, H.264
  │   │   │   └── TSProtocol.ts       # Auth, channel join, meldingsformat
  │   │   └── LiveKitConnector.ts     # Publiserer H.264 til LiveKit room
  │   │
  │   ├── pipeline/
  │   │   ├── FramePipeline.ts        # Koordinerer source → sink
  │   │   ├── H264PacketParser.ts     # Parser NAL units og start codes
  │   │   └── H264FrameAssembler.ts   # Assembler komplette frames
  │   │
  │   ├── components/
  │   │   ├── BaseComponent.ts          # Abstrakt base alle arver
  │   │   ├── StreamBridgeComponent.ts  # Hoved: TS6 → LiveKit
  │   │   ├── CommandComponent.ts       # REST-kall og chat-kommandoer
  │   │   ├── AutoJoinComponent.ts      # Følger aktiv streamer mellom kanaler
  │   │   └── DebugComponent.ts         # Dumper WS-trafikk til fil
  │   │
  │   ├── api/
  │   │   └── TS6RestClient.ts        # HTTP-klient mot port 10080
  │   │
  │   └── index.ts                    # Entry point
  │
  ├── config.yaml
  └── package.json


4.2 Komponentmodell
────────────────────

Alle utvidbare moduler følger BaseComponent-kontrakten. Dette sikrer at ny
funksjonalitet kan legges til uten å endre Bot.ts eller andre komponenter:

  export abstract class BaseComponent {
    abstract readonly name: string;

    abstract onInit(ctx: BotContext): Promise<void>;
    abstract onDestroy(): Promise<void>;

    // Valgfrie lifecycle hooks
    onTS6Event?(event: TS6Event): Promise<void>;
    onLiveKitEvent?(event: LKEvent): Promise<void>;
  }

Registrering av komponenter i index.ts er trivielt:

  const bot = new Bot(config);

  bot.register(new StreamBridgeComponent());  // kjerne
  bot.register(new CommandComponent());       // chat-kommandoer
  bot.register(new AutoJoinComponent());      // legg til ved behov
  bot.register(new DebugComponent());         // fjern i prod

  await bot.start();


4.3 TS6 REST API (port 10080)
──────────────────────────────

TS6 eksponerer et HTTP/REST administrasjons-API. Dette er den eneste
veldokumenterte delen av TS6 server-API-et og brukes til kontrolloperasjoner:

  Endepunkt              Beskrivelse
  ─────────────────────────────────────────────────────────────────────────
  GET  /v1/clients       List alle tilkoblede klienter
  GET  /v1/channels      List alle kanaler
  GET  /v1/serverinfo    Hent serverinformasjon
  POST /v1/clients/kick  Kast ut en klient
  POST /v1/webhooks      Registrer webhook for push-events
  GET  /swagger          Swagger UI med full API-dokumentasjon

Autentisering: x-api-key: YOUR_KEY i HTTP-header.
Nøkler genereres i TS6-klienten under Server Settings → API Keys.


────────────────────────────────────────────────────────────────────────────────
5. TS6 KLIENTPROTOKOLL — STATUS OG PLAN
────────────────────────────────────────────────────────────────────────────────

5.1 Hva er kjent
─────────────────

TS6 sin klient-til-server-protokoll er ikke offisielt dokumentert. Basert på
analyse av TS5/TS6 Remote App API og community-funn er følgende kjent:

  • Klientene kommuniserer med serveren via WebSocket
  • JSON-baserte meldinger med "type" og "payload"-felt
  • Auth-handshake kreves ved tilkobling
  • WebRTC brukes for selve mediadataen (lyd og video)
  • SDP offer/answer og ICE candidates formidles via WebSocket


5.2 Hva må reverse-engineeres
───────────────────────────────

Følgende er ukjent og må kartlegges via Wireshark / Chrome DevTools:

  • Komplett auth-handshake-sekvens for å registrere en bot-klient
  • Hvilke meldinger som sendes ved channel join
  • Hvordan boten abonnerer på en pågående screenshare-sesjon
  • Eksakt format på WebRTC SDP og ICE candidate-meldinger
  • Hvilken RTP-profil H.264-streamen bruker (payload type, clock rate)

INFO — Anbefalt fremgangsmåte:
  Start TS6-klienten med remote debugging:
    ./TeamSpeak --remote-debugging-port=9222
  Åpne chrome://inspect i Chrome, velg TS6-vinduet, og filtrer på WS
  i Network-fanen. Start en screenshare mens du observerer trafikken.


5.3 DebugComponent — Første skritt
────────────────────────────────────

Implementer DebugComponent som logger all WebSocket-trafikk til fil:

  ws.on('message', (data) => {
    fs.appendFileSync('ts6-events.jsonl',
      JSON.stringify({ ts: Date.now(), raw: data.toString() }) + '\n'
    );
  });

  // Let etter disse meldingstypene:
  // - auth / handshake
  // - channelJoin / channelSubscribe
  // - streamStarted / screenShareBegin
  // - webrtc: offer, answer, candidate


────────────────────────────────────────────────────────────────────────────────
6. LIVEKIT-INTEGRASJON
────────────────────────────────────────────────────────────────────────────────

6.1 Relevante LiveKit-komponenter
───────────────────────────────────

  Komponent               Bruk
  ─────────────────────────────────────────────────────────────────────────
  livekit-server-sdk      Token-generering og room-administrasjon fra Node.js
  @livekit/rtc-node       Native VideoTrack i Node.js — sender H.264 frames
  LiveKit Egress          Opptak av rooms til fil (fremtidig utvidelse)
  LiveKit Ingress         Ikke relevant — vi sender, ikke mottar eksternt


6.2 Publisering av H.264 til LiveKit
──────────────────────────────────────

Siden TS6 bruker OpenH264 og LiveKit støtter H.264 nativt, kan frames
videresendes uten re-encoding. Dette er en stor ytelsesfordel:

  // Opprett VideoSource og publiser H.264 track
  const videoSource = new VideoSource();
  const track = LocalVideoTrack.createVideoTrack(
    'ts6-screen', videoSource,
    { codec: VideoCodec.H264 }
  );

  await room.localParticipant.publishTrack(track, {
    videoCodec: VideoCodec.H264,
    simulcast: false  // Screensharing trenger ikke simulcast
  });

  // Push frames fra TS6 pipeline
  assembler.onFrame(async (frame) => {
    await videoSource.captureFrame(
      new VideoFrame(frame.data, VideoFrameType.H264, frame.timestamp)
    );
  });


────────────────────────────────────────────────────────────────────────────────
7. AVHENGIGHETER
────────────────────────────────────────────────────────────────────────────────

7.1 npm-pakker (runtime)
─────────────────────────

  Pakke                  Versjon    Formål
  ─────────────────────────────────────────────────────────────────────────
  @livekit/rtc-node      ^0.13.0    Native VideoTrack — sender H.264 frames
  livekit-server-sdk     ^2.10.0    Token-generering og room-administrasjon
  ws                     ^8.18.0    WebSocket-klient mot TS6-server
  zod                    ^3.23.0    Type-sikker config-validering
  eventemitter3          ^5.0.1     Intern EventBus mellom komponenter
  winston                ^3.17.0    Strukturert logging

7.2 npm-pakker (dev)
─────────────────────

  Pakke                  Versjon    Formål
  ─────────────────────────────────────────────────────────────────────────
  typescript             ^5.7.0     TypeScript compiler
  @types/ws              ^8.5.14    Typer for ws-pakken
  @types/node            ^20.17.0   Node.js typer
  tsx                    ^4.19.0    Kjør TypeScript direkte (uten build)
  vitest                 ^1.6.0     Testing av pipeline-komponenter

7.3 Fremtidig avhengighet — WebRTC i Node.js
─────────────────────────────────────────────

Når TS6 klientprotokollen er kartlagt trengs en WebRTC-implementasjon for
Node.js. Alternativer:

  wrtc              ^0.4.x    Stabil, men tung å kompilere (Chromium WebRTC)
  @roamhq/wrtc      ^0.4.x    Nyere fork av wrtc
  node-datachannel  ^0.x      Lettere alternativ

  NB: Det er verdt å undersøke om @livekit/rtc-node sin innebygde
  WebRTC-stack kan gjenbrukes for TS6-siden også.

7.4 Komplett package.json
──────────────────────────

  {
    "name": "ts6-stream-bot",
    "version": "0.1.0",
    "type": "module",
    "scripts": {
      "dev":   "tsx src/index.ts",
      "build": "tsc",
      "start": "node dist/index.js",
      "test":  "vitest"
    },
    "dependencies": {
      "@livekit/rtc-node":    "^0.13.0",
      "livekit-server-sdk":   "^2.10.0",
      "ws":                   "^8.18.0",
      "zod":                  "^3.23.0",
      "eventemitter3":        "^5.0.1",
      "winston":              "^3.17.0"
    },
    "devDependencies": {
      "typescript":           "^5.7.0",
      "@types/ws":            "^8.5.14",
      "@types/node":          "^20.17.0",
      "tsx":                  "^4.19.0",
      "vitest":               "^1.6.0"
    }
  }

7.5 Systemkrav
───────────────

  • Node.js 20+ (LTS)
  • TypeScript 5+
  • Tilgang til TS6 server REST API (port 10080)
  • API-nøkkel generert i TS6-klienten (Server Settings → API Keys)
  • LiveKit server (self-hosted eller cloud) med API-nøkkel


────────────────────────────────────────────────────────────────────────────────
8. IMPLEMENTASJONSPLAN
────────────────────────────────────────────────────────────────────────────────

8.1 Faser
──────────

  Fase 1 — Grunnmur
    REST API-klient, webhook-mottak, DebugComponent, prosjekt-scaffold.
    Kan implementeres nå.

  Fase 2 — Protokollanalyse
    Reverse engineer TS6 klientprotokoll med Wireshark / Chrome DevTools.
    Kartlegg auth, channel join og WebRTC-signalisering.

  Fase 3 — WebRTC-klient
    Implementer headless WebRTC-klient som abonnerer på screenshare.
    Motta H.264 RTP-pakker fra TS6.

  Fase 4 — H.264 Pipeline
    H264PacketParser + H264FrameAssembler.
    Parser NAL units, håndterer FU-A fragmentering og SPS/PPS.

  Fase 5 — LiveKit-bridge
    LiveKitConnector sender H.264 direkte uten re-encoding.
    StreamBridgeComponent binder TS6 og LiveKit sammen.

  Fase 6 — Utvidelser
    AutoJoinComponent, CommandComponent, opptak via LiveKit Egress,
    web-dashboard.


8.2 Første steg — Hva du kan gjøre nå
───────────────────────────────────────

  1. Sett opp prosjekt-scaffold med tsconfig.json, package.json og Bot.ts
  2. Implementer TS6RestClient mot port 10080, verifiser at du kan liste
     klienter via curl eller Swagger UI
  3. Sett opp DebugComponent som logger WS-trafikk fra TS6-klienten
  4. Start en screenshare i TS6 og analyser WS-dump for å kartlegge
     protokollen (se seksjon 5.2)
  5. Implementer enkel LiveKit-tilkobling og verifiser at du kan publisere
     en test-track til et room


────────────────────────────────────────────────────────────────────────────────
9. ÅPNE SPØRSMÅL OG RISIKOER
────────────────────────────────────────────────────────────────────────────────

  Spørsmål / Risiko                    Kommentar
  ─────────────────────────────────────────────────────────────────────────
  TS6 klientprotokoll er udokumentert  Krever reverse engineering. Protokollen
                                       kan endre seg mellom beta-versjoner.

  Ingen offisiell bot-API i TS6 ennå   TS6 server er fortsatt i beta.
                                       Bot-støtte kan komme offisielt senere.

  H.264 payload-format i RTP           Ukjent om TS6 bruker standard RTP H.264
                                       (RFC 6184) eller en egendefinert variant.

  P2P vs server-relay                  TS6 støtter ekte P2P. Boten må ha et
                                       nettverksoppsett som tillater
                                       server-relay for å motta streamen.

  Beta-lisensbegrensning               TS6 server beta-lisens er 32 slots og
                                       fornyes hver 2. måned.


────────────────────────────────────────────────────────────────────────────────
10. REFERANSER
────────────────────────────────────────────────────────────────────────────────

  • TeamSpeak 6 beta3 Foundation I changelog
    community.teamspeak.com/t/teamspeak-6-0-0-beta3-foundation-i-update/62417

  • LiveKit
    github.com/livekit/livekit  (Apache 2.0)

  • LiveKit Node.js SDK
    github.com/livekit/node-sdks

  • @livekit/rtc-node — native Node.js VideoTrack
    github.com/livekit/node-sdks/tree/main/packages/livekit-rtc

  • TS6 Server GitHub
    github.com/teamspeak/teamspeak6-server

  • TS6 REST API / Swagger UI
    http://<server>:10080/swagger

  • RFC 6184 — RTP Payload Format for H.264 Video
    datatracker.ietf.org/doc/html/rfc6184


================================================================================
  Slutt på dokument — TS6 Stream Bot v0.1 DRAFT
================================================================================
