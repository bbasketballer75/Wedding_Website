/**
 * Web Worker Pool Manager
 * Efficiently manages multiple worker instances
 */

interface WorkerTask<T = unknown, R = unknown> {
  id: string
  type: string
  data: T
  resolve: (result: R) => void
  reject: (error: Error) => void
}

type QueuedWorkerTask = WorkerTask<unknown, unknown>

export class WorkerPool {
  private workers: Worker[] = []
  private availableWorkers: Set<number> = new Set()
  private taskQueue: QueuedWorkerTask[] = []
  private activeTasks: Map<string, QueuedWorkerTask> = new Map()

  constructor(
    private workerFactory: () => Worker,
    private poolSize: number = navigator.hardwareConcurrency || 4
  ) {
    this.initializePool()
  }

  /**
   * Initialize worker pool
   */
  private initializePool(): void {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = this.workerFactory()

      worker.addEventListener('message', event => {
        this.handleWorkerMessage(i, event)
      })

      worker.addEventListener('error', error => {
        this.handleWorkerError(i, error)
      })

      this.workers.push(worker)
      this.availableWorkers.add(i)
    }
  }

  /**
   * Execute a task in the worker pool
   */
  async execute<T = unknown, R = unknown>(type: string, data: T): Promise<R> {
    return new Promise((resolve, reject) => {
      const task: QueuedWorkerTask = {
        id: `task-${Date.now()}-${Math.random()}`,
        type,
        data: data as unknown,
        resolve: result => resolve(result as R),
        reject,
      }

      this.taskQueue.push(task)
      this.processQueue()
    })
  }

  /**
   * Process task queue
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0 || this.availableWorkers.size === 0) {
      return
    }

    const task = this.taskQueue.shift()
    if (!task) {
      return
    }
    const workerIndex = Array.from(this.availableWorkers)[0]

    this.availableWorkers.delete(workerIndex)
    this.activeTasks.set(task.id, task)

    const worker = this.workers[workerIndex]
    const payload =
      typeof task.data === 'object' && task.data !== null
        ? (task.data as Record<string, unknown>)
        : { data: task.data }

    worker.postMessage({
      id: task.id,
      type: task.type,
      ...payload,
    })
  }

  /**
   * Handle worker message
   */
  private handleWorkerMessage(workerIndex: number, event: MessageEvent): void {
    const { id, success, data, error } = event.data
    const task = this.activeTasks.get(id)

    if (!task) return

    this.activeTasks.delete(id)
    this.availableWorkers.add(workerIndex)

    if (success) {
      task.resolve(data)
    } else {
      task.reject(new Error(error || 'Worker task failed'))
    }

    // Process next task
    this.processQueue()
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(workerIndex: number, error: ErrorEvent): void {
    console.error(`Worker ${workerIndex} error:`, error)

    // Find and reject tasks from this worker
    this.activeTasks.forEach((task, id) => {
      task.reject(new Error(`Worker error: ${error.message}`))
      this.activeTasks.delete(id)
    })

    // Restart worker
    this.workers[workerIndex].terminate()
    this.workers[workerIndex] = this.workerFactory()
    this.availableWorkers.add(workerIndex)
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    this.workers.forEach(worker => worker.terminate())
    this.workers = []
    this.availableWorkers.clear()
    this.taskQueue = []
    this.activeTasks.clear()
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    poolSize: number
    available: number
    active: number
    queued: number
  } {
    return {
      poolSize: this.poolSize,
      available: this.availableWorkers.size,
      active: this.activeTasks.size,
      queued: this.taskQueue.length,
    }
  }
}

/**
 * Create image worker pool
 */
export function createImageWorkerPool(size?: number): WorkerPool {
  return new WorkerPool(
    () => new Worker(new URL('../workers/image.worker.ts', import.meta.url), { type: 'module' }),
    size
  )
}

/**
 * Create search worker pool
 */
export function createSearchWorkerPool(size?: number): WorkerPool {
  return new WorkerPool(
    () => new Worker(new URL('../workers/search.worker.ts', import.meta.url), { type: 'module' }),
    size
  )
}

/**
 * Create sync worker
 */
export function createSyncWorker(): Worker {
  return new Worker(new URL('../workers/sync.worker.ts', import.meta.url), { type: 'module' })
}

export default {
  WorkerPool,
  createImageWorkerPool,
  createSearchWorkerPool,
  createSyncWorker,
}
