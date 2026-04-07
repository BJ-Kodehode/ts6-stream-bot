import { H264PacketParser, NALUnitType } from './H264PacketParser.js';
import type { H264Frame, RawH264Frame } from '../core/types.js';

// ─── H264FrameAssembler ───────────────────────────────────────────────────────
// Setter sammen komplette H.264-frames fra rå NAL unit-pakker.

type FrameHandler = (frame: H264Frame) => void;

export class H264FrameAssembler {
  private parser      = new H264PacketParser();
  private pendingFUA: Buffer[] = [];
  private lastSPS:    Buffer | null = null;
  private lastPPS:    Buffer | null = null;
  private handlers:   FrameHandler[] = [];

  onFrame(handler: FrameHandler): void {
    this.handlers.push(handler);
  }

  push(raw: RawH264Frame): void {
    const units = this.parser.parse(raw.data);

    for (const unit of units) {
      switch (unit.type) {
        case NALUnitType.SPS:
          this.lastSPS = unit.data;
          break;

        case NALUnitType.PPS:
          this.lastPPS = unit.data;
          break;

        case NALUnitType.IDR:
          this.emit({
            data:       this.prependParameterSets(unit.data),
            isKeyframe: true,
            timestamp:  raw.timestamp,
            sps:        this.lastSPS ?? undefined,
            pps:        this.lastPPS ?? undefined,
          });
          break;

        case NALUnitType.NON_IDR:
          this.emit({ data: unit.data, isKeyframe: false, timestamp: raw.timestamp });
          break;

        case NALUnitType.FU_A:
          this.handleFUA(unit.data, raw.timestamp);
          break;
      }
    }
  }

  reset(): void {
    this.pendingFUA = [];
    this.lastSPS    = null;
    this.lastPPS    = null;
  }

  private handleFUA(data: Buffer, timestamp: number): void {
    const fuHeader = data[1];
    const isStart  = (fuHeader & 0x80) !== 0;
    const isEnd    = (fuHeader & 0x40) !== 0;

    if (isStart) this.pendingFUA = [data];
    else         this.pendingFUA.push(data);

    if (isEnd && this.pendingFUA.length > 0) {
      const reassembled = this.parser.reassembleFUA(this.pendingFUA);
      this.pendingFUA   = [];
      if (reassembled) {
        const isKeyframe = (reassembled[0] & 0x1f) === NALUnitType.IDR;
        this.emit({ data: reassembled, isKeyframe, timestamp });
      }
    }
  }

  private prependParameterSets(idrData: Buffer): Buffer {
    const sc = Buffer.from([0x00, 0x00, 0x00, 0x01]);
    const parts: Buffer[] = [];
    if (this.lastSPS) parts.push(sc, this.lastSPS);
    if (this.lastPPS) parts.push(sc, this.lastPPS);
    parts.push(sc, idrData);
    return Buffer.concat(parts);
  }

  private emit(frame: H264Frame): void {
    this.handlers.forEach(h => h(frame));
  }
}
