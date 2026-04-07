import type { BotConfig, BotContext } from './types.js';
import { EventBus } from './EventBus.js';
import { TS6RestClient } from '../api/TS6RestClient.js';
import type { BaseComponent } from '../components/BaseComponent.js';
import { createLogger } from '../config/logger.js';

// ─── Bot — orkestrerer lifecycle for alle komponenter ─────────────────────────

export class Bot {
  private components = new Map<string, BaseComponent>();
  private context:    BotContext;
  private running =   false;

  constructor(private config: BotConfig) {
    const logger   = createLogger(config.bot.logLevel);
    const eventBus = new EventBus();
    const ts6Api   = new TS6RestClient(config.teamspeak.apiUrl, config.teamspeak.apiKey);

    this.context = { config, ts6Api, eventBus, logger };
  }

  register(component: BaseComponent): this {
    if (this.running) {
      throw new Error(`Kan ikke registrere '${component.name}' etter start()`);
    }
    this.components.set(component.name, component);
    this.context.logger.info(`[Bot] Registrert: ${component.name}`);
    return this;
  }

  async start(): Promise<void> {
    this.running = true;
    this.context.logger.info('[Bot] Starter...');

    await this.verifyTS6Connection();

    for (const [name, component] of this.components) {
      try {
        this.context.logger.info(`[Bot] Init: ${name}`);
        await component.onInit(this.context);
      } catch (err) {
        this.context.logger.error(`[Bot] Feil ved init av '${name}':`, err);
        throw err;
      }
    }

    this.context.eventBus.emit('bot:ready');
    this.context.logger.info(`[Bot] Klar — ${this.components.size} komponent(er) aktive`);

    process.on('SIGINT',  () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

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
    process.exit(0);
  }

  private async verifyTS6Connection(): Promise<void> {
    try {
      const info = await this.context.ts6Api.getServerInfo();
      this.context.logger.info(`[Bot] TS6 tilkoblet — server: ${info.name}`);
    } catch (err) {
      throw new Error(`TS6 REST API utilgjengelig. Sjekk apiUrl og apiKey i config.yaml.\n${err}`);
    }
  }
}
