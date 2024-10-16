import { ProtonClient } from "../client/ProtonClient";
import { readdir } from "fs/promises";
import { readFileSync, writeFileSync } from "fs";
import logger from "../structs/Logger";
import { config } from "../../Config";
import { ApplicationCommandStructure } from "eris";

export default class CommandHandler {
  static async load(client: ProtonClient) {
    const commands = await readdir("dist/commands");
    for (const file of commands) {
      const command = await import(`../../commands/${file}`);
      const cmdInstance = new command.default(client);
      client.commands.set(cmdInstance.name, cmdInstance);
    }
    const cmds = [...client.commands.values()].map((x) => ({
      name: x.name,
      type: x.type,
      description: x.description,
      options: x.options,
      default_member_permissions: x.defaultMemberPermissions,
      dm_permission: x.dmPermission,
    }));
    const currentJson = JSON.stringify(cmds);

    let file;
    try {
      file = readFileSync("./commands.dump.json").toString();
    } catch (err) {
      writeFileSync("./commands.dump.json", currentJson);
      file = ".";
    }
    if (file && file !== currentJson) {
      if (process.env.NODE_ENV === "dev") {
        client
          .bulkEditGuildCommands(config.testGuild, cmds as unknown as ApplicationCommandStructure[])
          .catch((err) => logger.error("failed to register commands", err));
      } else {
        client
          .bulkEditCommands(cmds as unknown as ApplicationCommandStructure[])
          .catch((err) => logger.error("failed to register commands", err));
      }
    }
    logger.info("Created commands dump file");
  }
}
