import { setTimeout } from "timers/promises";

export interface SequentialTimeQueueOptions {
  timeFrame: number;
}

export type CallbackFunction = () => void;

export class SequentialTimeQueue {
  constructor(options: SequentialTimeQueueOptions) {
    this.timeFrame = options.timeFrame || 5000;
  }
  timeFrame: number;
  queue: CallbackFunction[] = [];

  async check() {
    if (this.queue.length > 0) {
      await setTimeout(this.timeFrame);
      const elem = this.queue.shift();
      if (elem) {
        elem();
      }
      this.check();
    }
  }

  add(callback: CallbackFunction) {
    this.queue.push(callback);
    if (this.queue.length === 1) {
      this.check();
    }
  }
}
