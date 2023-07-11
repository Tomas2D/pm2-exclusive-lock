# 🔐 pm2-exclusive-lock 🗝

This library aims to solve a situation when you need to retrieve a lock to provide mutually exclusive access to a shared resource.
Works in the PM2 environment (cluster) and also on a single instance. The library does not use any external database or synchronizer and 
works purely on direct communication between processes. 

Does this library help you? Do not forget to give it a ⭐️!

## ⭐️ Features

- Provides mutually exclusive access to a shared resource (lock)
- Immune to PM2 restarts and auto/manual scaling
- Uses dynamic master instance to be immune to crashes
- Asynchronous callbacks, promises
- PM2 native, does not use any database under the hood

## 🚀 Installation

```
yarn add pm2-exclusive-lock
```
```
npm install pm2-exclusive-lock
```

## 🤘🏻 Usage

**Without custom configuration**

```typescript
import { LockService } from 'pm2-exclusive-lock'

const lockService = new LockService()
  
lockService.lock(async () => {
  // your code goes here 🚀
})

// On application shutdown, destroy the instance
// to allow process to send a "DISCONNECT" message to the other nodes
// and deallocate binded handlers
lockService.destroy()
```

**With custom configuration**

```typescript
import { LockService, LOCK_ERROR_RESOLUTION } from 'pm2-exclusive-lock'

const lockService = new LockService({
  groupId: 'FS_LOCK',
  lockTimeout: 10 * 1000, // 10 seconds,
  syncTimeout: 1.5 * 1000, // 1.5 seconds,
  lockErrorResolution: LOCK_ERROR_RESOLUTION.THROW, // or LOCK_ERROR_RESOLUTION.IGNORE 
  logger: {
    debug: console.debug,
    warn: console.warn,
    error: console.error
  }
})

lockService.lock(async () => {
  // your code goes here 🚀
})

// On application shutdown, destroy the instance
// to allow process to send a "DISCONNECT" message to the other nodes  
lockService.destroy()
```

### API

```typescript
interface IConfig {
  logger?: ILogger;
  lockTimeout?: number; // miliseconds
  lockTimeoutResolution?: LOCK_TIMEOUT_RESOLUTION;  // 'THROW' or 'IGNORE'
  syncTimeout?: number; // miliseconds
  groupId?: string; // name of lock group
}

interface ILogger {
  debug: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string, err: Error) => void;
}
```

## TODO

- [ ] Add tests
- [ ] Describe how locking works
