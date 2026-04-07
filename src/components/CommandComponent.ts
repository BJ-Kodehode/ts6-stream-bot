// ─── CommandComponent ─────────────────────────────────────────────────────────
// Lytter på chat-kommandoer via TS6 webhook og utfører REST API-kall.
// Eksempel-kommandoer: !status, !kick <id>, !clients

import { BaseComponent } from './BaseComponent.js';
import type { BotContext } from '../core/types.js';

const PREFIX = '!';

export class CommandComponent extends BaseComponent {
  readonly name = 'command';
  private ctx!: BotContext;

  async onInit(ctx: BotContext): Promise<void> {
    this.ctx = ctx;

    // Lytt på chat-meldinger fra TS6 webhook
    ctx.eventBus.on('ts6:webhook', async (event) => {
      if (event.event !== 'chat_message') return;

      const text = String(event.data.message ?? '').trim();
      if (!text.startsWith(PREFIX)) return;

      const [cmd, ...args] = text.slice(PREFIX.length).split(' ');
      await this.handleCommand(cmd.toLowerCase(), args);
    });

    ctx.logger.info('[Command] Klar — lytter på chat-kommandoer');
  }

  async onDestroy(): Promise<void> {}

  private async handleCommand(cmd: string, args: string[]): Promise<void> {
    this.ctx.logger.debug(`[Command] ${cmd} ${args.join(' ')}`);

    switch (cmd) {
      case 'status':
        await this.cmdStatus();
        break;

      case 'clients':
        await this.cmdClients();
        break;

      case 'kick':
        if (args[0]) await this.cmdKick(Number(args[0]), args.slice(1).join(' '));
        break;

      default:
        this.ctx.logger.debug(`[Command] Ukjent kommando: ${cmd}`);
    }
  }

  private async cmdStatus(): Promise<void> {
    try {
      const info = await this.ctx.ts6Api.getServerInfo();
      this.ctx.logger.info(
        `[Command] Status — ${info.name}: ${info.clients_online} klienter, ${info.channels_online} kanaler`
      );
    } catch (err) {
      this.ctx.logger.error('[Command] Feil ved henting av status:', err);
    }
  }

  private async cmdClients(): Promise<void> {
    try {
      const clients = await this.ctx.ts6Api.getClients();
      this.ctx.logger.info(
        `[Command] Klienter (${clients.length}): ` +
        clients.map(c => `${c.nickname}(${c.clid})`).join(', ')
      );
    } catch (err) {
      this.ctx.logger.error('[Command] Feil ved henting av klienter:', err);
    }
  }

  private async cmdKick(clid: number, reason = 'Kicked by bot'): Promise<void> {
    if (isNaN(clid)) {
      this.ctx.logger.warn('[Command] Ugyldig client ID for kick');
      return;
    }
    try {
      await this.ctx.ts6Api.kickClient(clid, reason);
      this.ctx.logger.info(`[Command] Kicket klient ${clid}: ${reason}`);
    } catch (err) {
      this.ctx.logger.error(`[Command] Feil ved kick av ${clid}:`, err);
    }
  }
}
