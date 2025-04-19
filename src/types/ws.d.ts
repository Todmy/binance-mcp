declare module 'ws' {
  import { EventEmitter } from 'events';

  export class WebSocket extends EventEmitter {
    constructor(address: string, options?: WebSocket.ClientOptions);

    close(code?: number, data?: string | Buffer): void;
    ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    pong(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    send(data: any, cb?: (err?: Error) => void): void;

    on(event: string, listener: (...args: any[]) => void): this;

    readyState: number;
    static CONNECTING: number;
    static OPEN: number;
    static CLOSING: number;
    static CLOSED: number;
  }

  export namespace WebSocket {
    export interface ClientOptions {
      protocol?: string;
      handshakeTimeout?: number;
      perMessageDeflate?: boolean | object;
      maxPayload?: number;
      followRedirects?: boolean;
      maxRedirects?: number;
    }
  }

  export default WebSocket;
}
