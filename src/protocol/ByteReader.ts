import TruncatedMessageError from './TruncatedMessageError';

const decoder = new TextDecoder();

/** Reads values written with the command protocol's compact encoding. */
export default class ByteReader {
  private offset = 0;

  constructor(private readonly bytes: readonly number[]) {}

  get position(): number {
    return this.offset;
  }

  get remaining(): number[] {
    return this.bytes.slice(this.offset);
  }

  get done(): boolean {
    return this.offset >= this.bytes.length;
  }

  private take(count: number): number {
    if (this.offset + count > this.bytes.length) throw new TruncatedMessageError();
    let value = 0;
    for (let i = count - 1; i >= 0; i -= 1) {
      value = value * 256 + (this.bytes[this.offset + i] ?? 0);
    }
    this.offset += count;
    return value;
  }

  private sizeOfNext(): number {
    const first = this.bytes[this.offset];
    if (first === undefined) throw new TruncatedMessageError();
    return [1, 2, 3, 5][first % 4] ?? 5;
  }

  uint(): number {
    return Math.floor(this.take(this.sizeOfNext()) / 4);
  }

  int(): number {
    const raw = this.take(this.sizeOfNext());
    const magnitude = Math.floor(raw / 8);
    const negative = Math.floor(raw / 4) % 2 === 1;
    return negative ? -magnitude : magnitude;
  }

  byte(): number {
    return this.take(1);
  }

  bool(): boolean {
    return this.byte() !== 0;
  }

  float(): number {
    const raw = this.take(4);
    const view = new DataView(new ArrayBuffer(4));
    view.setUint32(0, raw, true);
    return view.getFloat32(0, true);
  }

  string(): string {
    const length = this.uint();
    if (this.offset + length > this.bytes.length) throw new TruncatedMessageError();
    const slice = this.bytes.slice(this.offset, this.offset + length);
    const text = decoder.decode(new Uint8Array(slice));
    this.offset += length;
    return text;
  }

  vector<T>(readItem: (reader: ByteReader) => T): T[] {
    const count = this.uint();
    return Array.from({ length: count }, () => readItem(this));
  }

  optional<T>(readItem: (reader: ByteReader) => T): T | null {
    return this.vector(readItem)[0] ?? null;
  }
}
