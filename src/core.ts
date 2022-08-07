import pm2 from 'pm2';
import { getCurrentProcessId, getInstances } from 'pm2-master-process';
import PromiseQueue from 'promise-queue';
import { Task } from 'promise-based-task';
import { noop, withTimeout } from './helpers';
import { LockCommunicationError, LockMasterError, SessionDestroyedError } from './errors';
import type { IConfig, ILogger, ILockMessage } from './types';
import { LOCK_MSG_ACTION } from './types';

export class LockService {
  private readonly _localQueue = new PromiseQueue(1, Infinity);
  private readonly _globalQueue = new PromiseQueue(1, Infinity);

  private _latestMasterId?: number;
  private _isMasterDestroyed = new Task<never>();

  private _isInitialed?: Task<void>;
  private _isDestroyed?: Task<void>;

  private readonly _groupId: string;
  private readonly _lockTimeout: number;
  private readonly _logger?: ILogger;

  constructor({ logger, lockTimeout = 5 * 60 * 1000, groupId }: IConfig = {}) {
    this._logger = logger;
    this._lockTimeout = lockTimeout;
    this._groupId = groupId || 'DEFAULT';

    this._init().catch(noop)
  }

  async lock<T>(fn: () => Promise<T>): Promise<T> {
    await this._init();

    // non PM2
    if (getCurrentProcessId() === null) {
      return fn();
    }

    const timeout = 360 * 1000;

    return this._localQueue.add(
      withTimeout(async () => {
        this._logger?.debug(`Request for lock...`);
        await this._retrieveLock();
        this._logger?.debug(`-> lock retrieved`);

        return fn().finally(async () => {
          await this._sendUnlock();
          this._logger?.debug(`-> unlock`);
        });
      }, timeout),
    );
  }

  async getLockStatuses() {
    return {
      queue: {
        waiting: this._globalQueue.getQueueLength(),
        inProgress: this._globalQueue.getPendingLength(),
      },
      processes: await this._getProcess(),
      selfId: getCurrentProcessId(),
      masterProcessId: await this._getMasterInstanceId(),
    };
  }

  private _init() {
    if (this._isDestroyed) {
      throw new SessionDestroyedError()
    }
    if (this._isInitialed) {
      return this._isInitialed;
    }

    this._isInitialed = new Task<void>();

    if (getCurrentProcessId() === null) {
      this._isInitialed.resolve();
      return this._isInitialed;
    }

    // Listen for messages
    const incomingMessageHandler = (message: ILockMessage) => {
      this._logger?.debug(`Received message type: "${message?.data}"`);

      if (message?.data === LOCK_MSG_ACTION.PING) {
        this._sendMessage(LOCK_MSG_ACTION.PONG, [message.processId]).catch(noop);
        return;
      }

      if (message?.data === LOCK_MSG_ACTION.DISCONNECT) {
        if (message.processId === this._latestMasterId) {
          this._invalidateMaster();
        }
        if (message.processId === getCurrentProcessId()) {
          process.off('message', incomingMessageHandler)
        }
        return;
      }

      if (message?.data === LOCK_MSG_ACTION.REQ_LOCK) {
        this._globalQueue
          .add(async () => {
            const isMaster = await this._isMasterInstance();

            const { task, cancelWaitForMessage } = this._waitForMessage(LOCK_MSG_ACTION.REQ_UNLOCK);

            if (isMaster) {
              const [{ hasError }] = await this._sendMessage(LOCK_MSG_ACTION.REQ_LOCK_ACK, [
                message.processId,
              ]);
              if (hasError) {
                cancelWaitForMessage();
                this._logger?.debug(`Cannot send message to ${message.processId}, skipping`);
                return;
              }
            }

            await Promise.race([this._isMasterDestroyed, task]).finally(cancelWaitForMessage);
          })
          .catch(noop);
        return;
      }
    };
    process.on('message', incomingMessageHandler);

    // Create PM2 connection
    pm2.connect(true, (err) => {
      if (err) {
        process.off('message', incomingMessageHandler);
        if (this._isInitialed) {
          this._isInitialed.reject(err);
          this._isInitialed = undefined;
        }
      } else {
        if (this._isInitialed) {
          this._isInitialed.resolve();
        }
      }
    });

    return this._isInitialed;
  }

  async destroy() {
    if (!this._isInitialed) {
      return;
    }

    if (this._isDestroyed) {
      return this._isDestroyed;
    }

    this._isDestroyed = new Task<void>();

    const curId = getCurrentProcessId();
    if (curId === null) {
      this._isDestroyed.resolve();
      return this._isDestroyed;
    }

    if (curId === this._latestMasterId) {
      this._invalidateMaster();
    }
    await this._sendMessage(LOCK_MSG_ACTION.DISCONNECT);
    pm2.disconnect();

    this._isDestroyed.resolve();
    return this._isDestroyed;
  }

  private async _getMasterInstanceId(cache = true) {
    if (cache && !this._latestMasterId !== undefined) {
      return this._latestMasterId;
    }

    const processes = await this._getProcessIds();
    this._latestMasterId = Math.min(...processes);
    return this._latestMasterId;
  }

  private async _isMasterInstance() {
    const masterId = await this._getMasterInstanceId(false);
    const currentId = getCurrentProcessId();
    return masterId === currentId;
  }

  private _invalidateMaster() {
    this._latestMasterId = undefined;
    this._isMasterDestroyed.reject(new LockMasterError());
    this._isMasterDestroyed = new Task<never>();
  }

  private _waitForMessage(type: LOCK_MSG_ACTION, from?: number) {
    const task = new Task<void>();

    const handler = (message: ILockMessage) => {
      if (!message || message?.groupId !== this._groupId) {
        return;
      }

      if (message?.data === type) {
        if (from !== undefined && from !== message.processId) {
          this._logger?.warn(
            `Received message from ${message.processId}, but expected from ${from}`,
          );
          return;
        }

        process.off('message', handler);
        task.resolve();
      }
    };
    process.on('message', handler);

    return { task, cancelWaitForMessage: () => process.off('message', handler) };
  }

  private async _retrieveLock(): Promise<void> {
    const { task: waitAck, cancelWaitForMessage } = this._waitForMessage(LOCK_MSG_ACTION.REQ_LOCK_ACK);
    const receivers = await this._sendMessage(LOCK_MSG_ACTION.REQ_LOCK);

    if (receivers.length === 0) {
      cancelWaitForMessage();
      return;
    } else if (receivers.every((status) => status.hasError)) {
      cancelWaitForMessage();
      throw new LockCommunicationError();
    }

    return Promise.race([waitAck, this._isMasterDestroyed]).finally(cancelWaitForMessage);
  }

  private async _sendUnlock(): Promise<void> {
    await this._sendMessage(LOCK_MSG_ACTION.REQ_UNLOCK);
  }

  private async _sendMessage(
    data: LOCK_MSG_ACTION,
    targets?: number[],
  ): Promise<{ instanceId: number; hasError: boolean }[]> {
    if (targets === undefined) {
      targets = await this._getProcessIds();
    }

    this._logger?.debug(`Sending message type "${data}" to ${targets.join(',')}`);
    return Promise.all(
      targets.map(async (instanceId) => {
        return new Promise((resolve) => {
          pm2.sendDataToProcessId(
            instanceId,
            {
              type: 'process:msg',
              data,
              topic: true,
              ts: Date.now(),
              processId: getCurrentProcessId(),
              groupId: this._groupId,
            },
            (err) => {
              if (err) {
                this._logger?.error(`Error when sending a message to a process`, err);
              }
              resolve({ instanceId, hasError: Boolean(err) });
            },
          );
        });
      }),
    );
  }

  private async _getProcess() {
    return getInstances({
      instanceStatus: ['online'],
    });
  }

  private async _getProcessIds(): Promise<number[]> {
    const instances = await this._getProcess();
    return instances.map((instance) => Number(instance.pm_id));
  }
}
