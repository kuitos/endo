export * from './types.js';
import { AsyncQueue, Stream, Reader, Writer } from './types.js';

export function makeQueue<TValue>(): AsyncQueue<TValue>;

export function makeStream<
  TRead,
  TWrite = unknown,
  TReadReturn = unknown,
  TWriteReturn = unknown,
>(
  acks: AsyncQueue<IteratorResult<TRead, TReadReturn>>,
  data: AsyncQueue<IteratorResult<TWrite, TWriteReturn>>,
): Stream<TRead, TWrite, TReadReturn, TWriteReturn>;

export function makePipe<
  TRead,
  TWrite = unknown,
  TReadReturn = unknown,
  TWriteReturn = unknown,
>(): [
  Stream<TRead, TWrite, TReadReturn, TWriteReturn>,
  Stream<TWrite, TRead, TWriteReturn, TReadReturn>,
];

export function pump<
  TRead,
  TWrite = unknown,
  TReadReturn = unknown,
  TWriteReturn = unknown,
>(
  writer: Stream<TWrite, TRead, TWriteReturn, TReadReturn>,
  reader: Stream<TRead, TWrite, TReadReturn, TWriteReturn>,
  primer?: TWrite,
): Promise<void>;

export function prime<
  TRead,
  TWrite = unknown,
  TReturn = unknown,
>(
  writer: AsyncGenerator<TRead,  TReturn, TWrite>,
  primer: TWrite,
): Stream<TRead, TWrite, TReturn, TReturn>;

// Overload:
export function prime<
  TRead,
>(
  writer: AsyncGenerator<TRead, undefined, undefined>,
  // primer is implicitly undefined for this overload.
): Stream<TRead, undefined, undefined, undefined>;

export function mapReader<
  TReadIn,
  TReadOut,
  TReadReturn = unknown,
  TWrite = unknown,
  TWriteReturn = unknown,
>(
  reader: Stream<TReadIn, TWrite, TReadReturn, TWriteReturn>,
  transform: (value: TReadIn) => TReadOut,
): Stream<TReadOut, TWrite, TReadReturn, TWriteReturn>;

export function mapWriter<
  TWriteIn,
  TWriteOut,
  TWriteReturn = unknown,
  TRead = unknown,
  TReadReturn = unknown,
>(
  writer: Stream<TRead, TWriteOut, TReadReturn, TWriteReturn>,
  transform: (value: TWriteIn) => TWriteOut,
): Stream<TRead, TWriteIn, TReadReturn, TWriteReturn>;
