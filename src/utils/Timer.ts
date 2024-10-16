export default class Timer {
  private startTime = 0;

  start() {
    this.startTime = performance.now();
  }

  stop() {
    const now = performance.now();
    return now - this.startTime;
  }
}
