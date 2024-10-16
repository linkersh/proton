import { ProtonClient } from "../client/ProtonClient";
import { readdir } from "fs/promises";
import ClientModule from "../structs/ClientModule";

type ModuleConstructor<T> = new (client: ProtonClient) => T;
export default class ModuleHandler {
  static async load(client: ProtonClient) {
    const commands = await readdir("dist/modules", { withFileTypes: true });
    for (const file of commands) {
      let _module: ModuleConstructor<ClientModule> | null = null;
      if (file.isDirectory()) {
        _module = (await import(`../../modules/${file.name}/index`)).default;
      } else {
        _module = (await import(`../../modules/${file.name}`)).default;
      }
      if (_module !== null) {
        const mod = new _module(client);
        client.modules.set(mod.name, mod);
      }
    }
  }
}
