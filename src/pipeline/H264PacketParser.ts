// ─── H264PacketParser ─────────────────────────────────────────────────────────
// Parser H.264 Annex-B NAL units fra rå buffer-data.

export enum NALUnitType {
  NON_IDR = 1,   // P-frame / B-frame
  IDR     = 5,   // Keyframe (Intra)
  SEI     = 6,   // Supplemental Enhancement Information
  SPS     = 7,   // Sequence Parameter Set
  PPS     = 8,   // Picture Parameter Set
  STAP_A  = 24,  // Single-Time Aggregation Packet
  FU_A    = 28,  // Fragmentation Unit
}

export interface NALUnit {
  type:       NALUnitType;
  data:       Buffer;
  isKeyframe: boolean;
}

export class H264PacketParser {
  parse(data: Buffer): NALUnit[] {
    const units: NALUnit[] = [];
    const positions = this.findStartCodes(data);

    for (let i = 0; i < positions.length; i++) {
      const start   = positions[i];
      const end     = positions[i + 1] ?? data.length;
      const nalData = data.subarray(start, end);

      if (nalData.length < 1) continue;

      const type = (nalData[0] & 0x1f) as NALUnitType;
      units.push({ type, data: nalData, isKeyframe: type === NALUnitType.IDR });
    }

    return units;
  }

  reassembleFUA(packets: Buffer[]): Buffer | null {
    if (packets.length === 0) return null;

    const chunks: Buffer[] = [];

    for (const packet of packets) {
      if (packet.length < 2) continue;

      const fuHeader = packet[1];
      const isStart  = (fuHeader & 0x80) !== 0;
      const nalType  = fuHeader & 0x1f;

      if (isStart) {
        chunks.push(Buffer.from([(packet[0] & 0xe0) | nalType]));
      }
      chunks.push(packet.subarray(2));
    }

    return Buffer.concat(chunks);
  }

  private findStartCodes(data: Buffer): number[] {
    const positions: number[] = [];

    for (let i = 0; i < data.length - 3; i++) {
      if (data[i] === 0x00 && data[i + 1] === 0x00) {
        if (data[i + 2] === 0x00 && data[i + 3] === 0x01) {
          positions.push(i + 4); i += 3;
        } else if (data[i + 2] === 0x01) {
          positions.push(i + 3); i += 2;
        }
      }
    }

    return positions;
  }
}
