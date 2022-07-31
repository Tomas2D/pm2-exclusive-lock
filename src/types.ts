export interface ILockMessage {
  id: number;
  data: LOCK_MSG_ACTION;
  processId: number;
  ts: number;
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
}
