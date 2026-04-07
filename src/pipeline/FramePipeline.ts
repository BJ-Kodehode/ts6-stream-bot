// ─── FramePipeline ────────────────────────────────────────────────────────────
// Koordinerer flyten av H.264 frames fra kilde (TS6) til mål (LiveKit).
// Holder buffering og backpressure-logikk samlet på ett sted.

import { H264FrameAssembler } from './H264FrameAssembler.js';
import type { LiveKitConnector } from '../connectors/LiveKitConnector.js';
import type { EventBus } from '../core/EventBus.js';

export class FramePipeline {
  private assembler: H264FrameAssembler;
  private active =   false;

  // Antall frames som kan stå i kø — dropp gamle ved backpressure
  private readonly maxQueueSize = 10;
  private queue: Array<() => Promise<void>> = [];
  private processing = false;

  constructor(
    private sink:     LiveKitConnector,
    private eventBus: EventBus,
  ) {
    this.assembler = new H264FrameAssembler();
  }

  start(): void {
    if (this.active) return;
    this.active = true;

    // Lytt på rå frames fra EventBus (publisert av TSWebRTC)
    this.eventBus.on('frame:raw', (rawFrame) => {
      this.assembler.push(rawFrame);
    });

    // Assembler leverer komplette frames — send videre til LiveKit
    this.assembler.onFrame(async (frame) => {
      if (!this.sink.isConnected()) return;

      // Dropp P-frames ved backpressure, men behold alltid keyframes
      if (this.queue.length >= this.maxQueueSize && !frame.isKeyframe) return;

      this.queue.push(() => this.sink.pushFrame(frame));
      this.processQueue();
    });

    console.log('[FramePipeline] Startet');
  }

  stop(): void {
    this.active = false;
    this.queue  = [];
    this.assembler.reset();
    console.log('[FramePipeline] Stoppet');
  }

  reset(): void {
    this.queue = [];
    this.assembler.reset();
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      try {
        await task?.();
      } catch (err) {
        console.warn('[FramePipeline] Feil ved sending av frame:', err);
      }
    }

    this.processing = false;
  }
}
