type Callback<T> = (key: string, values: T[]) => void;
interface TimeoutBucketOptions<T> {
  maxItems: number;
  waitFor: number;
  callback: Callback<T>;
}

export default class TimeoutBucket<T> {
  constructor(options: TimeoutBucketOptions<T>) {
    this.options = options;
  }
  private readonly options: TimeoutBucketOptions<T>;
  private readonly bucket = new Map<string, T[]>();

  push(key: string, value: T) {
    const pending = this.bucket.get(key);
    if (pending && pending.length === this.options.maxItems) {
      this.bucket.set(key, [value]);
      this.options.callback(key, pending);
      setTimeout(() => {
        const val = this.bucket.get(key);
        if (val) {
          this.options.callback(key, val);
          this.bucket.delete(key);
        }
      }, this.options.waitFor);
    } else if (pending) {
      pending.push(value);
      this.bucket.set(key, pending);
    } else {
      this.bucket.set(key, [value]);
      setTimeout(() => {
        const val = this.bucket.get(key);
        if (val) {
          this.options.callback(key, val);
          this.bucket.delete(key);
        }
      }, this.options.waitFor);
    }
  }
}
