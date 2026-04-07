import type { BotContext } from '../core/types.js';

export abstract class BaseComponent {
  abstract readonly name: string;
  abstract onInit(ctx: BotContext):  Promise<void>;
  abstract onDestroy():              Promise<void>;
}
