import { Bot } from './core/Bot.js';
import { loadConfig } from './config/config.js';
import { StreamBridgeComponent } from './components/StreamBridgeComponent.js';
import { CommandComponent } from './components/CommandComponent.js';
import { AutoJoinComponent } from './components/AutoJoinComponent.js';
import { DebugComponent } from './components/DebugComponent.js';

async function main() {
  const config = loadConfig('config.yaml');

  const bot = new Bot(config);

  bot
    .register(new StreamBridgeComponent())  // TS6 → LiveKit (hoved)
    .register(new CommandComponent())       // !status, !kick, !clients
    .register(new AutoJoinComponent())      // følger streamere mellom kanaler
    .register(new DebugComponent());        // TODO: fjern i produksjon

  await bot.start();
}

main().catch((err) => {
  console.error('Fatal feil ved oppstart:', err);
  process.exit(1);
});
