// ─── DebugComponent ───────────────────────────────────────────────────────────
// Logger all TS6 WebSocket-trafikk og events til fil.
// Første prioritet: bruk denne til å kartlegge TS6-protokollen.
// Fjern eller deaktiver i produksjon.

import { appendFileSync, writeFileSync } from 'fs';
import { BaseComponent } from './BaseComponent.js';
import { TSSignaling } from '../connectors/TS6Client/TSSignaling.js';
import type { BotContext } from '../core/types.js';

export class DebugComponent extends BaseComponent {
  readonly name     = 'debug';
  private eventsLog = 'ts6-events.jsonl';
  private rawLog    = 'ts6-ws-raw.jsonl';
  private ctx!:       BotContext;

  async onInit(ctx: BotContext): Promise<void> {
    this.ctx = ctx;

    // Nullstill loggfiler
    writeFileSync(this.eventsLog, '');
    writeFileSync(this.rawLog, '');
    ctx.logger.info(`[Debug] Logger events → ${this.eventsLog}`);
    ctx.logger.info(`[Debug] Logger rå WS  → ${this.rawLog}`);

    // Aktiver rå WS-dump i TSSignaling (koble til ekstra signaling kun for dumping)
    const debugSignaling = new TSSignaling(ctx.eventBus);
    debugSignaling.enableDebugDump(true);

    // Logg alle EventBus-events
    ctx.eventBus.on('ts6:webhook',       (e)       => this.log('ts6:webhook', e));
    ctx.eventBus.on('ts6:clientJoined',  (id, ch)  => this.log('ts6:clientJoined', { id, ch }));
    ctx.eventBus.on('ts6:clientLeft',    (id)      => this.log('ts6:clientLeft', { id }));
    ctx.eventBus.on('ts6:streamStarted', (id)      => this.log('ts6:streamStarted', { id }));
    ctx.eventBus.on('ts6:streamStopped', (id)      => this.log('ts6:streamStopped', { id }));

    ctx.eventBus.on('frame:raw', (frame) => {
      this.log('frame:raw', {
        bytes:     frame.data.length,
        timestamp: frame.timestamp,
        // Første byte avslører NAL type
        nalType:   frame.data[0] ? (frame.data[0] & 0x1f) : null,
      });
    });

    // Snapshot av serverstate hvert 30 sek
    const interval = setInterval(async () => {
      try {
        const [clients, channels] = await Promise.all([
          ctx.ts6Api.getClients(),
          ctx.ts6Api.getChannels(),
        ]);
        this.log('snapshot', {
          clients:    clients.length,
          channels:   channels.length,
          clientList: clients.map(c => ({ id: c.clid, nick: c.nickname, cid: c.cid })),
        });
      } catch (err) {
        ctx.logger.warn('[Debug] Snapshot feilet:', err);
      }
    }, 30_000);

    ctx.eventBus.once('bot:shutdown', () => clearInterval(interval));
    ctx.logger.info('[Debug] Klar');
  }

  async onDestroy(): Promise<void> {
    this.ctx.logger.info(`[Debug] Avslutter — events i ${this.eventsLog}, rå WS i ${this.rawLog}`);
  }

  private log(type: string, data: unknown): void {
    const entry = JSON.stringify({ ts: new Date().toISOString(), type, data });
    appendFileSync(this.eventsLog, entry + '\n');
  }
}
