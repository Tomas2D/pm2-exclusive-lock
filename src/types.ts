export interface ILockMessage {
  id: number;
  data: LOCK_MSG_ACTION;
  processId: number;
  ts: number;
  groupId: string;
}

export enum LOCK_MSG_ACTION {
  DISCONNECT = 'DISCONNECT',
  PING = 'PING',
  PONG = 'PONG',

  REQ_LOCK = 'REQ_LOCK',
  REQ_LOCK_ACK = 'REQ_LOCK_ACK',
  REQ_UNLOCK = 'REQ_UNLOCK',
}

export interface ILogger {
  debug: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string, err: Error) => void;
}

export interface IConfig {
  logger?: ILogger;
  lockTimeout?: number;
  syncTimeout?: number;
  groupId?: string;
}

export type Literal = number | string | boolean | null | undefined;

export type GetObjectKeys<T, L extends string = ''> = T extends Record<string, unknown>
  ? {
      [K in keyof T]: T[K] extends Literal
        ? `${L}${K & string}`
        : Required<T[K]> extends Record<string, unknown>
        ? GetObjectKeys<Required<T[K]>, `${L}${K & string}.`>
        : never;
    }[keyof T]
  : never;
