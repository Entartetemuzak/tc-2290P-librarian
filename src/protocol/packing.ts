/* eslint-disable no-bitwise -- 7-bit packing is defined bit by bit */

/**
 * Packs 8-bit data into 7-bit SysEx-safe bytes. Each group of up to seven bytes
 * is preceded by an MSB byte whose bit (6 - i) carries bit 7 of group byte i.
 */
export function pack7(data: ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let start = 0; start < data.length; start += 7) {
    const end = Math.min(start + 7, data.length);
    let msbs = 0;
    for (let i = start; i < end; i += 1) {
      msbs |= (((data[i] ?? 0) >> 7) & 1) << (6 - (i - start));
    }
    out.push(msbs);
    for (let i = start; i < end; i += 1) {
      out.push((data[i] ?? 0) & 0x7f);
    }
  }
  return out;
}

/** Reverses {@link pack7}. */
export function unpack7(packed: ArrayLike<number>): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < packed.length) {
    const msbs = packed[i] ?? 0;
    const end = Math.min(i + 8, packed.length);
    for (let j = i + 1; j < end; j += 1) {
      const bit = (msbs >> (6 - (j - i - 1))) & 1;
      out.push((packed[j] ?? 0) | (bit << 7));
    }
    i = end;
  }
  return out;
}
