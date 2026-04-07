// ─── LiveKitConnector ─────────────────────────────────────────────────────────
// Kobler boten til LiveKit og publiserer H.264 frames som VideoTrack.
// Bruker @livekit/rtc-node for native Node.js media-støtte.

import { AccessToken } from 'livekit-server-sdk';
import type { H264Frame, BotConfig } from '../core/types.js';

export class LiveKitConnector {
  private videoSource: unknown = null;
  private room:        unknown = null;
  private connected =  false;

  async connect(config: BotConfig): Promise<void> {
    const token = new AccessToken(
      config.livekit.apiKey,
      config.livekit.apiSecret,
      { identity: config.bot.identity },
    );
    token.addGrant({
      roomJoin:   true,
      room:       config.livekit.roomName,
      canPublish: true,
    });
    const jwt = await token.toJwt();

    // TODO: Aktiver når @livekit/rtc-node er installert
    // import { Room, VideoSource, LocalVideoTrack, VideoCodec } from '@livekit/rtc-node';
    //
    // this.videoSource = new VideoSource();
    // const track = LocalVideoTrack.createVideoTrack(
    //   'ts6-screen',
    //   this.videoSource,
    //   { codec: VideoCodec.H264 }
    // );
    //
    // this.room = new Room();
    // await this.room.connect(config.livekit.url, jwt);
    // await this.room.localParticipant.publishTrack(track, {
    //   videoCodec: VideoCodec.H264,
    //   simulcast:  false,   // screensharing trenger ikke simulcast
    // });

    void jwt; // midlertidig til TODO over er aktivert
    this.connected = true;
    console.log(`[LiveKit] Tilkoblet room: ${config.livekit.roomName}`);
  }

  async pushFrame(frame: H264Frame): Promise<void> {
    if (!this.connected || !this.videoSource) return;

    // TODO: Aktiver når @livekit/rtc-node er installert
    // import { VideoFrame, VideoFrameType } from '@livekit/rtc-node';
    // await (this.videoSource as VideoSource).captureFrame(
    //   new VideoFrame(frame.data, VideoFrameType.H264, frame.timestamp)
    // );

    void frame; // midlertidig
  }

  async disconnect(): Promise<void> {
    // await (this.room as Room)?.disconnect();
    this.connected   = false;
    this.videoSource = null;
    this.room        = null;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
