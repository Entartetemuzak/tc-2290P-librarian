const encoder = new TextEncoder();

/** The four varint size classes: [byte count, tag]. */
const SIZE_CLASSES: readonly (readonly [number, number])[] = [[1, 0], [2, 1], [3, 2], [5, 3]];

/**
 * Serializes values in the command protocol's compact encoding. Integers are
 * variable-length with a 2-bit size tag in the low bits, little-endian.
 */
export default class ByteWriter {
  readonly bytes: number[] = [];

  private pushLittleEndian(value: number, count: number): void {
    let rest = value;
    for (let i = 0; i < count; i += 1) {
      this.bytes.push(rest % 256);
      rest = Math.floor(rest / 256);
    }
  }

  uint(value: number): this {
    const v = value >>> 0; // eslint-disable-line no-bitwise -- coerce to uint32
    const sizeClass = SIZE_CLASSES.find(([count]) => count === 5 || v < 2 ** (8 * count - 2));
    const [count, tag] = sizeClass ?? [5, 3];
    this.pushLittleEndian(v * 4 + tag, count);
    return this;
  }

  int(value: number): this {
    const magnitude = Math.abs(value);
    const sign = value < 0 ? 4 : 0;
    const sizeClass = SIZE_CLASSES.find(
      ([count]) => count === 5 || magnitude < 2 ** (8 * count - 3),
    );
    const [count, tag] = sizeClass ?? [5, 3];
    this.pushLittleEndian(magnitude * 8 + sign + tag, count);
    return this;
  }

  byte(value: number): this {
    this.bytes.push(value % 256);
    return this;
  }

  bool(value: boolean): this {
    return this.byte(value ? 1 : 0);
  }

  string(value: string): this {
    const encoded = encoder.encode(value);
    this.uint(encoded.length);
    encoded.forEach((b) => this.bytes.push(b));
    return this;
  }

  vector<T>(items: readonly T[], writeItem: (writer: ByteWriter, item: T) => void): this {
    this.uint(items.length);
    items.forEach((item) => writeItem(this, item));
    return this;
  }

  /** Optional<T> is encoded as a vector with zero or one element. */
  optional<T>(item: T | null, writeItem: (writer: ByteWriter, item: T) => void): this {
    return this.vector(item === null ? [] : [item], writeItem);
  }
}
