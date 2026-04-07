// ─── AutoJoinComponent ────────────────────────────────────────────────────────
// Følger aktive streamere mellom kanaler.
// Når en bruker som streamer bytter kanal, abonnerer boten på ny kanal
// og fortsetter bridge-sesjonen.

import { BaseComponent } from './BaseComponent.js';
import type { BotContext } from '../core/types.js';

export class AutoJoinComponent extends BaseComponent {
  readonly name = 'auto-join';

  private activeStreamers = new Map<string, string>(); // clientId → channelId
  private ctx!: BotContext;

  async onInit(ctx: BotContext): Promise<void> {
    this.ctx = ctx;

    // Hold oversikt over hvem som streamer og i hvilken kanal
    ctx.eventBus.on('ts6:streamStarted', (clientId) => {
      // Channel ID settes i clientJoined — her markerer vi bare at de streamer
      this.activeStreamers.set(clientId, 'unknown');
      ctx.logger.debug(`[AutoJoin] Registrert streamer: ${clientId}`);
    });

    ctx.eventBus.on('ts6:streamStopped', (clientId) => {
      this.activeStreamers.delete(clientId);
      ctx.logger.debug(`[AutoJoin] Fjernet streamer: ${clientId}`);
    });

    ctx.eventBus.on('ts6:clientJoined', (clientId, channelId) => {
      if (!this.activeStreamers.has(clientId)) return;

      const prevChannel = this.activeStreamers.get(clientId);
      if (prevChannel === channelId) return;

      // Streamer byttet kanal — oppdater og varsle
      this.activeStreamers.set(clientId, channelId);
      ctx.logger.info(`[AutoJoin] Streamer ${clientId} byttet til kanal ${channelId}`);

      // TODO: Når TSSignaling støtter det, join ny kanal:
      // ctx.eventBus.emit('ts6:streamStopped', clientId);
      // ctx.eventBus.emit('ts6:streamStarted', clientId);
    });

    ctx.eventBus.on('ts6:clientLeft', (clientId) => {
      if (this.activeStreamers.has(clientId)) {
        this.activeStreamers.delete(clientId);
        ctx.logger.info(`[AutoJoin] Streamer ${clientId} forlot serveren`);
      }
    });

    ctx.logger.info('[AutoJoin] Klar — følger aktive streamere');
  }

  async onDestroy(): Promise<void> {
    this.activeStreamers.clear();
  }

  getActiveStreamers(): ReadonlyMap<string, string> {
    return this.activeStreamers;
  }
}
