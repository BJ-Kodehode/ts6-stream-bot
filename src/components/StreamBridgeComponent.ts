// ─── StreamBridgeComponent ────────────────────────────────────────────────────
// Hoved-komponent: kobler TSSignaling → FramePipeline → LiveKit.

import { BaseComponent } from './BaseComponent.js';
import { TSSignaling } from '../connectors/TS6Client/TSSignaling.js';
import { LiveKitConnector } from '../connectors/LiveKitConnector.js';
import { FramePipeline } from '../pipeline/FramePipeline.js';
import type { BotContext } from '../core/types.js';

export class StreamBridgeComponent extends BaseComponent {
  readonly name = 'stream-bridge';

  private signaling!:  TSSignaling;
  private livekit!:    LiveKitConnector;
  private pipeline!:   FramePipeline;
  private ctx!:        BotContext;
  private streaming =  false;

  async onInit(ctx: BotContext): Promise<void> {
    this.ctx      = ctx;
    this.livekit  = new LiveKitConnector();
    this.signaling = new TSSignaling(ctx.eventBus);
    this.pipeline  = new FramePipeline(this.livekit, ctx.eventBus);

    // Koble til TS6-server via WebSocket
    await this.signaling.connect(ctx.config.teamspeak.wsUrl);
    await this.signaling.authenticate(ctx.config.bot.identity, ctx.config.teamspeak.apiKey);

    // Lytt på stream-events
    ctx.eventBus.on('ts6:streamStarted', async (clientId) => {
      ctx.logger.info(`[StreamBridge] Stream startet av: ${clientId}`);
      await this.startBridge(clientId);
    });

    ctx.eventBus.on('ts6:streamStopped', async (clientId) => {
      ctx.logger.info(`[StreamBridge] Stream stoppet av: ${clientId}`);
      await this.stopBridge();
    });

    ctx.logger.info('[StreamBridge] Klar — venter på screenshare fra TS6');
  }

  async onDestroy(): Promise<void> {
    await this.stopBridge();
    this.signaling.disconnect();
  }

  private async startBridge(streamerId: string): Promise<void> {
    if (this.streaming) return;

    try {
      await this.signaling.subscribeToScreenShare(streamerId);
      await this.livekit.connect(this.ctx.config);
      this.pipeline.start();
      this.streaming = true;
      this.ctx.logger.info('[StreamBridge] Bridge aktiv');
    } catch (err) {
      this.ctx.logger.error('[StreamBridge] Feil ved oppstart av bridge:', err);
    }
  }

  private async stopBridge(): Promise<void> {
    if (!this.streaming) return;
    this.pipeline.stop();
    await this.livekit.disconnect();
    this.streaming = false;
    this.ctx.logger.info('[StreamBridge] Bridge stoppet');
  }
}
