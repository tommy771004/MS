import { RecvOp, SendOp } from '../packet/opcodes.ts';

/**
 * A "MapleShark-lite" packet inspector (inspired by the MapleShark sniffer in
 * the awesome-maplestory list). When MS_PACKET_LOG=1, every decoded inbound and
 * pre-encrypt outbound packet is printed as `opcode name (len) hex…`, which is
 * invaluable when reverse-engineering or debugging the protocol.
 *
 * It logs *plaintext* packets (post-decrypt / pre-encrypt), so you read real
 * structure rather than ciphertext — the one thing a real wire sniffer can't do
 * without the session keys.
 */
export const PACKET_LOG = process.env.MS_PACKET_LOG === '1';

function invert(map: Record<string, number>): Map<number, string> {
  return new Map(Object.entries(map).map(([name, code]) => [code, name]));
}
const recvNames = invert(RecvOp);
const sendNames = invert(SendOp);

export function logPacket(dir: 'recv' | 'send', connId: number, opcode: number, packet: Buffer): void {
  if (!PACKET_LOG) return;
  const name = (dir === 'recv' ? recvNames : sendNames).get(opcode) ?? '?';
  const body = packet.subarray(2); // skip the 2-byte opcode
  const hex = body.subarray(0, 40).toString('hex').replace(/(..)/g, '$1 ').trim();
  const arrow = dir === 'recv' ? '→' : '←';
  console.log(
    `[pkt ${arrow} c${connId}] 0x${opcode.toString(16).padStart(2, '0')} ${name.padEnd(16)} ${body.length}B  ${hex}${body.length > 40 ? ' …' : ''}`,
  );
}
