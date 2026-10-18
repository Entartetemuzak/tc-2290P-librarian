import type ByteReader from './ByteReader';
import type ByteWriter from './ByteWriter';
import { APP_SENDER_ID, Command } from './constants';

/**
 * Header of a command-protocol message. Version messages (IDs 4 and 5) carry
 * only the first four fields.
 */
export interface MessageHeader {
  commandId: number;
  senderId: number;
  /** Transaction ID: the sender's own counter; a response repeats the request's value. */
  sessionId: number;
  /** Status or result code. Observed: 0, 3 (ping), 16 and 0xFFFFFFFF. Meaning unknown. */
  status: number;
  sequenceId?: number;
  field6?: number;
  flag?: boolean;
}

const isVersionMessage = (commandId: number): boolean => (
  commandId === Command.VERSION_REQUEST || commandId === Command.VERSION_RESPONSE
);

export function writeHeader(
  writer: ByteWriter,
  commandId: number,
  sessionId: number,
  status = 0,
  senderId = APP_SENDER_ID,
): ByteWriter {
  writer.uint(commandId).uint(senderId).uint(sessionId).uint(status);
  if (!isVersionMessage(commandId)) writer.uint(0).uint(1).bool(true);
  return writer;
}

export function readHeader(reader: ByteReader): MessageHeader {
  const header: MessageHeader = {
    commandId: reader.uint(),
    senderId: reader.uint(),
    sessionId: reader.uint(),
    status: reader.uint(),
  };
  if (!isVersionMessage(header.commandId)) {
    header.sequenceId = reader.uint();
    header.field6 = reader.uint();
    header.flag = reader.bool();
  }
  return header;
}

export const isResponse = (commandId: number): boolean => commandId % 2 === 1;
