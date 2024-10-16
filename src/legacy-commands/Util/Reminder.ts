import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import Logger from "../../core/structs/Logger.js";
class Reminder extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "reminder",
      description: "use /reminder",
      usage: "",
      aliases: [],
      category: "util",
      cooldown: 3000,
      userPerms: ["manageMessages"],
      clientPerms: ["sendMessages"],
    });
  }
  execute({ message }: ExecuteArgs) {
    message.channel
      .createMessage(`Use /reminder`)
      .catch((err) => Logger.warn(`command: reminder: failed to create message`, err));
  }
}
export default Reminder;
