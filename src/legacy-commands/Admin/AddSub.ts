import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { getTag } from "../../utils/Util";
import Subscriptions from "../../modules/Subscriptions";
import logger from "../../core/structs/Logger";
class AddSub extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "addsub",
      description: "Add a subscription to a user.",
      usage: "<uid> <sub-type> <months>",
      category: "admin",
      aliases: [],
      clientPerms: [],
      userPerms: [],
      cooldown: 0,
      admin: true,
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const user = await this.resolveUser(args[0]);
    if (!user) {
      return this.errorMessage(message, `You need to specify a valid user.`);
    }
    let serverSlots = parseInt(args[1]);
    if (!Number.isInteger(serverSlots)) {
      serverSlots = 0;
    }
    if (serverSlots < 0) {
      return this.errorMessage(message, `You need to specify max amount of server slots.`);
    }
    const subscriptions = this.client.modules.get("Subscriptions") as Subscriptions | undefined;
    if (!subscriptions) {
      logger.error("command: add-sub: subscriptions module not found");
      return this.errorMessage(message, "Subscriptions module not found.");
    }
    await subscriptions.addsub(user.id, serverSlots, args[2] === "true");
    this.successMessage(
      message,
      `Added ${serverSlots} premium server slots to **${getTag(user)}**!`
    );
  }
}
export default AddSub;
