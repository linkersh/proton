export default class DataStore {
  constructor(values: [string, unknown][] = []) {
    this.tags = new Map(values);
  }
  readonly tags: Map<string, unknown>;
  leak() {
    this.tags.clear();
  }
}
