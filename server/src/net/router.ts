import type { Connection } from './Connection.ts';
import type { PacketReader } from '../packet/PacketReader.ts';
import { RecvOp } from '../packet/opcodes.ts';
import { handleLogin, handleWorldList, handleSelectChannel } from './handlers/login.ts';
import { handleCreateCharacter, handleDeleteCharacter, handleSelectCharacter } from './handlers/character.ts';
import { handlePlayerMove, handlePlayerAttack, handlePlayerChat } from './handlers/world.ts';

/**
 * Routes a decoded packet to its handler by opcode (RustMS `net::packet::handle`).
 * Unknown opcodes are ignored (logged once) rather than killing the connection.
 */
export function dispatch(conn: Connection, opcode: number, reader: PacketReader): void {
  switch (opcode) {
    case RecvOp.Login:
      return handleLogin(conn, reader);
    case RecvOp.WorldListRequest:
      return handleWorldList(conn);
    case RecvOp.SelectChannel:
      return handleSelectChannel(conn, reader);
    case RecvOp.CreateCharacter:
      return handleCreateCharacter(conn, reader);
    case RecvOp.DeleteCharacter:
      return handleDeleteCharacter(conn, reader);
    case RecvOp.SelectCharacter:
      return handleSelectCharacter(conn, reader);
    case RecvOp.PlayerMove:
      return handlePlayerMove(conn, reader);
    case RecvOp.PlayerAttack:
      return handlePlayerAttack(conn, reader);
    case RecvOp.PlayerChat:
      return handlePlayerChat(conn, reader);
    case RecvOp.Pong:
      return;
    default:
      console.warn(`[router] unknown opcode 0x${opcode.toString(16)}`);
  }
}
