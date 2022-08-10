export class LockTimeoutError extends Error {
  constructor(message = 'Lock could not been retrieved withing specificied timeout') {
    super(message);
  }
}

export class LockMasterError extends Error {
  constructor(message = 'Master process is not available') {
    super(message);
  }
}

export class LockCommunicationError extends Error {
  constructor(message = 'Cannot send lock request to other nodes') {
    super(message);
  }
}

export class SessionDestroyedError extends Error {
  constructor(message = 'Session has been destroyed!') {
    super(message);
  }
}

export class MasterNotFound extends Error {
  constructor(message = 'Master instance cannot be detected') {
    super(message);
  }
}
