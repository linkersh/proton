import type { ProtonClient } from "../client/ProtonClient";

export class Base {
  constructor(client: ProtonClient) {
    this.client = client;
  }
  client: ProtonClient;
}
