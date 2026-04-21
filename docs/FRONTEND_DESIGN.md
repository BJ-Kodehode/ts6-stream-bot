# TS6 Stream Bot — Frontend og designsystem

> **Status:** Forslag / design-spec. Ingen frontend er implementert ennå.
> **Plassering i roadmap:** Sprint 6 — se [ROADMAP.md](./ROADMAP.md).
> **Stylesheet:** [styles/design-tokens.css](./styles/design-tokens.css)

---

## Hvorfor ha en frontend?

En chat-bot + log-fil er nok for utvikling, men ikke når du skal:
- **Demonstrere** boten for andre (investorer, community, arbeidsgiver).
- **Drifte** boten live (se hva som skjer akkurat nå uten å grep'e logger).
- **Debugge** i produksjon uten SSH inn på serveren.
- **Tillate mindre tekniske brukere** (moderatorer, admins) å styre boten.

Et lite dashboard løser alt dette.

---

## MVP — hva dashboardet skal gjøre

### Sider

1. **Live Status** (landingsside)
   - Bot-tilstand (koblet til TS6? LiveKit? Uptime?)
   - Aktive streams (hvem streamer nå, til hvilket rom)
   - Live FPS, drop-rate, bitrate
   - Siste 20 events fra EventBus (live-oppdatert via SSE/WebSocket)

2. **Streamers**
   - Tabell over alle kjente TS6-klienter
   - Kolonner: nick, client-ID, kanal, status (idle/streaming)
   - Kommandoer: Kick, Follow (AutoJoin legges på bruker)

3. **Command Log**
   - Kronologisk liste over alle `!`-kommandoer
   - Hvem, når, hvilken kommando, resultat (success/error)
   - Søk og filter

4. **Settings**
   - Vis config (read-only — endringer krever restart)
   - Log-level kan endres live
   - Bridge on/off toggle

5. **Debug** (kun i dev-mode)
   - Rå WS-dump streamen (live)
   - NAL-unit-typer som ankommer
   - Siste N frames som miniatyrbilder (hvis mulig å dekode)

### Navigasjon

Venstre sidebar + topp-bar. Dette er et _verktøy_, ikke en markedsførings-app — prioriter info-tetthet over visuell wow.

---

## Teknologivalg

| Lag | Valg | Alternativ | Hvorfor |
|---|---|---|---|
| Framework | **React 18 + Vite** | SvelteKit, Solid | Størst økosystem, typescript-moden |
| Språk | TypeScript | — | Samme type-definisjoner som backend |
| Styling | **CSS-variabler (design tokens) + CSS Modules** | Tailwind, styled-components | Ingen build-tid klasse-generering, full kontroll, ingen lock-in |
| Router | React Router v6 | TanStack Router | Mest brukt, enklest |
| Data-fetch | Tanstack Query | SWR | Bedre caching og devtools |
| Live-data | **Server-Sent Events (SSE)** | WebSocket | Enklere enn WS for enveis-push, reconnect gratis |
| Charts | **Recharts** | Chart.js, visx | Komponent-basert, god TS-støtte |
| Tester | Vitest + Testing Library | Jest | Samme runner som backend |

**Ikke bruk:** Next.js/Nuxt/SvelteKit SSR — dette er et admin-dashboard, ikke en publikums-app. Single-page fra `dist/public` er riktig.

---

## Designsystem — filosofi

Prosjektet er tekniksprekt, mørkt, serverrom-aktig. Designet skal:

1. **Være mørkt som standard.** Serverdrift skjer ofte i mørke rom / sent om kvelden.
2. **Prioritere lesbarhet over stil.** Tabeller, tall, logger.
3. **Bruke én aksentfarge konsekvent.** Ikke en regnbue — én "status ok"-farge og en "feil"-farge.
4. **Være tilgjengelig (WCAG AA).** Kontrastratio ≥ 4.5:1 for tekst.
5. **Respektere reduced motion.** Animasjoner er subtile og kan slås av via OS.

---

## Design tokens

Se [styles/design-tokens.css](./styles/design-tokens.css) for implementasjonen. Oppsummering:

### Farger

**Semantiske roller** (bruk disse, ikke rå hex):

```
--color-bg              # Sidebakgrunn
--color-surface         # Kort / paneler
--color-surface-raised  # Hover / elevated
--color-border          # Subtile grenser
--color-text            # Hovedtekst
--color-text-muted      # Sekundær tekst
--color-text-subtle     # Metadata, timestamps

--color-accent          # Primæraksent (knapper, lenker)
--color-accent-hover
--color-accent-subtle   # Bakgrunn for "selected"

--color-success         # Stream aktiv, koblet
--color-warning         # Reconnecting, drop-rate høy
--color-danger          # Feil, disconnected
--color-info            # Nøytral info
```

**Palettvalg:** Mørk blå-grå base (`#0a0e14` → `#1a1f2e`), elektrisk-blå aksent (`#4c9aff`), gult for warning, rødt for feil. Grønt for success bruk sparsomt — kun som statusindikator, ikke som aksent.

Full Light-mode skal finnes som overstyring av disse tokenene (`[data-theme="light"]`).

### Typografi

```
--font-sans: Inter, system-ui, -apple-system, "Segoe UI", sans-serif
--font-mono: "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace

--font-size-xs:  0.75rem   # 12px — badges, captions
--font-size-sm:  0.875rem  # 14px — table body
--font-size-md:  1rem      # 16px — base
--font-size-lg:  1.125rem  # 18px — subheader
--font-size-xl:  1.5rem    # 24px — page title
--font-size-2xl: 2rem      # 32px — hero
```

- Tabeller og numeriske verdier i mono-font (tall-justering).
- Tekst-innhold i Inter (proporsjonal, veldig lesbart i små størrelser).
- `font-variant-numeric: tabular-nums` overalt for tall.

### Spacing

Skala: 4px-basert.

```
--space-0: 0
--space-1: 0.25rem   # 4px
--space-2: 0.5rem    # 8px
--space-3: 0.75rem   # 12px
--space-4: 1rem      # 16px
--space-6: 1.5rem    # 24px
--space-8: 2rem      # 32px
--space-12: 3rem     # 48px
```

Bruk `--space-4` som "default gap" — ikke blanding av 10/12/14.

### Radius

```
--radius-sm: 4px    # Knapper, input
--radius-md: 8px    # Kort
--radius-lg: 12px   # Modals
--radius-full: 999px # Pills, avatarer
```

### Skygger

```
--shadow-sm: 0 1px 2px rgba(0,0,0,0.3)
--shadow-md: 0 4px 8px rgba(0,0,0,0.4)
--shadow-lg: 0 10px 24px rgba(0,0,0,0.5)
```

Mørk UI har naturlig mindre bruk for skygger — bruk heller `border` eller `--color-surface-raised`.

### Easing og durations

```
--ease-out: cubic-bezier(0.16, 1, 0.3, 1)
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)
--duration-fast:   120ms
--duration-medium: 240ms
--duration-slow:   400ms
```

### Z-index

```
--z-dropdown: 100
--z-sticky:   200
--z-overlay:  900
--z-modal:    1000
--z-toast:    1100
```

---

## Komponent-bibliotek (spec)

### Button

```tsx
<Button variant="primary|secondary|ghost|danger" size="sm|md|lg" loading={false}>
  Kick streamer
</Button>
```

- `primary`: aksentfarge bakgrunn
- `secondary`: transparent bakgrunn, border
- `ghost`: ingen bakgrunn, ingen border
- `danger`: rød bakgrunn
- Loading: spinner erstatter tekst, beholder bredde

### Badge / StatusChip

```tsx
<Badge tone="success|warning|danger|info|neutral">Live</Badge>
```

Med prikk-indikator:
```tsx
<StatusDot tone="success" pulse /> Streaming
```

Pulsering kun på "success + active"-tilstand — ellers statisk.

### Card

```tsx
<Card title="Active streams" action={<Button>Refresh</Button>}>
  {children}
</Card>
```

Bruk bak alle grupperte innhold-blokker.

### Table

Kritisk komponent — mesteparten av dashboardet er tabeller.

```tsx
<Table
  columns={[{ key: 'nickname', header: 'Nick' }, ...]}
  rows={clients}
  rowKey="clid"
  onRowClick={...}
  empty={<EmptyState>No clients</EmptyState>}
/>
```

Støtte for:
- Sortering
- Søk
- Sticky header
- Row-actions (kebab-meny)

### LogStream

```tsx
<LogStream
  source="/api/events"   // SSE
  maxEntries={500}
  autoscroll
  filter={{ level: ['warn', 'error'] }}
/>
```

Log-linjer har timestamp i mono-font, nivå med fargekode, melding.

### Metric

```tsx
<Metric label="FPS" value={28.4} unit="fps" trend="+2.1" />
```

Stor verdi, liten label over, trend (opp/ned pil).

### Toast (notifications)

Via `react-hot-toast` eller egen — maks 3 samtidige, auto-dismiss 4 s, klikk-for-å-fjerne.

### Modal

Overlay med blur-bakgrunn, ESC for å lukke, focus-trap.

### Tabs / Sidebar

Sidebar er sticky, collapsible. Tabs brukes innenfor sider.

---

## Layout

```
┌────────────────────────────────────────────────────┐
│  [≡]  TS6 Stream Bot             [○] [@]           │  ← topbar (56px)
├─────────┬──────────────────────────────────────────┤
│         │                                          │
│ 📊 Live │   Side-innhold                           │
│ 👥 Str  │                                          │
│ ⌨ Cmd   │                                          │
│ ⚙ Set   │                                          │
│ 🐛 Debug│                                          │
│         │                                          │
│         │                                          │
│ v0.3.0  │                                          │
└─────────┴──────────────────────────────────────────┘
   240px            resten
```

Responsivt: sidebar kollapser til kun ikoner < 900 px, og til drawer < 600 px.

---

## Eksempel — Live Status-siden

```tsx
export function LiveStatusPage() {
  const { data: status } = useQuery({ queryKey: ['status'], queryFn: fetchStatus });
  const { data: streams } = useQuery({ queryKey: ['streams'], queryFn: fetchStreams });

  return (
    <PageLayout title="Live Status">
      <Grid cols={3}>
        <Metric label="TS6"      value={status?.ts6Connected ? 'Connected' : 'Offline'} tone={status?.ts6Connected ? 'success' : 'danger'} />
        <Metric label="LiveKit"  value={status?.livekitConnected ? 'Connected' : 'Offline'} tone={status?.livekitConnected ? 'success' : 'danger'} />
        <Metric label="Uptime"   value={formatDuration(status?.uptimeMs)} />
      </Grid>

      <Card title="Active streams">
        <Table
          columns={[
            { key: 'nickname', header: 'Streamer' },
            { key: 'channel',  header: 'TS6 channel' },
            { key: 'fps',      header: 'FPS', render: v => <MonoValue>{v}</MonoValue> },
            { key: 'duration', header: 'Duration' },
            { key: 'actions',  header: '',     render: row => <RowActions row={row} /> },
          ]}
          rows={streams ?? []}
          empty={<EmptyState icon="🔇">No active streams</EmptyState>}
        />
      </Card>

      <Card title="Events">
        <LogStream source="/api/events" maxEntries={50} />
      </Card>
    </PageLayout>
  );
}
```

---

## Backend-endepunkter for dashboardet

Legg til i `src/api/DashboardApi.ts`:

| Method | Path | Formål |
|---|---|---|
| GET | `/api/status` | Bot-tilstand (koblet, uptime) |
| GET | `/api/streams` | Aktive streams |
| GET | `/api/clients` | TS6-klienter |
| GET | `/api/events` | SSE-stream av live-events |
| GET | `/api/commands` | Kommando-historikk |
| GET | `/api/metrics` | Prometheus-format (deles med Prom) |
| POST | `/api/bridge` | `{ enabled: boolean }` — skru bridge av/på |
| POST | `/api/clients/:clid/kick` | Kick |
| POST | `/api/loglevel` | Endre log-level live |

Auth: `Authorization: Bearer <token>`-header, hvor token hentes fra samme API-nøkkel som i config eller egen dashboard-token.

---

## Tilgjengelighet (WCAG AA)

- Alle interaktive elementer er fokus-bare (tab-navigering).
- Fokus-ring er synlig — bruk `:focus-visible` med tydelig outline.
- Status er ikke kun farge — bruk også ikon og tekst ("OK / Error").
- Tabeller har `<th scope="col">`.
- Motion respekterer `prefers-reduced-motion: reduce`.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Branding

Logoforslag: minimalistisk. To sirkler som overlapper med en linje mellom — symboliserer "bro" mellom to plattformer.

```
 ●───●
```

Farge: aksent-blå.

Wordmark: `TS6 Stream Bot` i Inter Bold, eller `ts6-sb` som kortform.

---

## Ikonbibliotek

Bruk **Lucide React** (`lucide-react`). 1200+ ikoner, konsistent stil, `strokeWidth={1.5}` som standard. Alternativt Radix Icons.

---

## Implementasjonsplan

### Fase 1 — Scaffold (1 dag)
1. `mkdir dashboard && cd dashboard && npm create vite@latest . -- --template react-ts`
2. Kopier `design-tokens.css` inn og importer i `main.tsx`
3. Oppsett: React Router, TanStack Query
4. Lag `PageLayout`, `Sidebar`, `Topbar`

### Fase 2 — Komponenter (2–3 dager)
5. Button, Badge, Card, Table, LogStream, Metric
6. Storybook (valgfritt) for å teste komponenter isolert

### Fase 3 — Sider (3–4 dager)
7. Live Status
8. Streamers
9. Command Log
10. Settings

### Fase 4 — Backend-integrasjon (2–3 dager)
11. `DashboardApi.ts` i backend
12. SSE-endpoint
13. Auth-wall
14. Bygg dashboard inn i `dist/public`, serv fra samme proses

### Fase 5 — Polishing (1–2 dager)
15. Light theme
16. Tastatursnarveier (`?` for hjelp)
17. Responsivt på tablet/mobil
18. Lighthouse-score ≥ 90 på alle kategorier

---

## Anti-scope — ikke gjør dette

- **Ikke** bygg custom auth-system. Start med API-nøkkel, oppgrader til OAuth/SSO senere om behov.
- **Ikke** lag offline-støtte / PWA. Dette er et admin-verktøy.
- **Ikke** legg til dark/light theme-toggle før light-theme er faktisk testet.
- **Ikke** bruk state-manager som Redux/Zustand før du har funnet at lokale states + TanStack Query ikke holder.
- **Ikke** implementer komponenter du ikke bruker. Byg det dashboardet trenger — ingenting mer.

---

## Oppsummering

Et lite dashboard:
- Hever prosjektet fra "hobby CLI" til "ekte produkt".
- Gjør demoing og drift mye enklere.
- Design tokens + CSS modules gir deg full kontroll uten bloat.
- Kan ferdigstilles på ~2 uker fulltids-arbeid etter Sprint 5.

---

*Versjon 1.0 — 2026-04-21*

*Se også: [styles/design-tokens.css](./styles/design-tokens.css) for implementasjon av tokens.*
