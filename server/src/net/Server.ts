import net from 'node:net';
import { Connection } from './Connection.ts';
import type { ServerContext } from './Connection.ts';
import { SERVER } from '../config.ts';

/**
 * TCP accept loop (RustMS `net::io` server / the `rust-ms-login` binary).
 * Each accepted socket becomes a Connection that performs its own handshake.
 */
export class Server {
  private server: net.Server | null = null;
  private readonly connections = new Set<Connection>();

  constructor(private readonly ctx: ServerContext) {}

  listen(port: number = SERVER.port, host: string = SERVER.host): Promise<void> {
    this.server = net.createServer((socket) => {
      socket.setNoDelay(true);
      const conn = new Connection(socket, this.ctx);
      this.connections.add(conn);
      socket.on('close', () => this.connections.delete(conn));
    });
    return new Promise((resolve) => this.server!.listen(port, host, () => resolve()));
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
    });
  }
}
