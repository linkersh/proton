import { readdir } from "fs/promises";
import { ProtonClient } from "../client/ProtonClient";
import { ClientLegacyCommand } from "../structs/ClientLegacyCommand";
import logger from "../structs/Logger";

export default class LegacyCommandHandler {
  static async load(client: ProtonClient) {
    const mainDir = await readdir("./dist/legacy-commands");
    for (const category of mainDir) {
      const categoryFiles = await readdir(`./dist/legacy-commands/${category}`);
      for (const file of categoryFiles) {
        const commandFile = await import(`../../legacy-commands/${category}/${file}`);
        if (!("default" in commandFile)) {
          logger.warn(`legacy command handler: no default export for command ${file}`);
          continue;
        }
        const command = new commandFile.default(client) as ClientLegacyCommand;
        if (command.aliases.length > 0) {
          command.aliases.map((alias) => client.aliases.set(alias, command.name));
        }
        client.legacyCommands.set(command.name, command);
      }
    }
  }
}
