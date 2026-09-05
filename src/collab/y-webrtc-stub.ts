// swarm-collaborative-docs imports y-webrtc at module top level for its yWebrtc transport, which swarmtyp never uses
// (D-14: SwarmRtc only). This stub keeps that dependency and its signalling-server assumptions out of the bundle.
export class WebrtcProvider { constructor() { throw new Error('yWebrtc transport is not available in swarmtyp (D-14)'); } }
export default { WebrtcProvider };
