import { ClientEvents } from "eris";
import { ProtonClient } from "../client/ProtonClient";

export default class ClientEvent<T extends keyof ClientEvents = keyof ClientEvents> {
  // eslint-disable-next-line no-unused-vars
  constructor(event: T, listener: (client: ProtonClient, ...args: ClientEvents[T]) => void) {
    this.name = event;
    this.listener = listener;
  }
  name: T;
  // eslint-disable-next-line no-unused-vars
  listener: (client: ProtonClient, ...args: ClientEvents[T]) => void;
}
