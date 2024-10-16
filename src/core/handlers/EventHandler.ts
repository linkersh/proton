import { ProtonClient } from "../client/ProtonClient";
import { readdir } from "fs/promises";
import ClientEvent from "../structs/ClientEvent";
import { EventListeners } from "eris";

type Args = EventListeners[keyof EventListeners];

export default class EventHandler {
  static async load(client: ProtonClient) {
    const events = await readdir("dist/events");
    for (const file of events) {
      const event = (await import(`../../events/${file}`)).default as ClientEvent;
      client.addListener(event.name, (...args: unknown[]) => {
        event.listener(client, ...(args as Args));
      });
    }
  }
}
