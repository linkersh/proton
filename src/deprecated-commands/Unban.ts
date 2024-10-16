import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { getTag } from "../../utils/Util";
import Logger from "../../core/structs/Logger";
import Moderation from "../../modules/Moderation";
import logger from "../../core/structs/Logger";

class Unban extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "unban",
      description: "Un-ban a previously banned user by search/their user ID.",
      usage: "<username|user-id>",
      examples: ["unban 323431364340744192"],
      aliases: ["ub"],
      category: "moderation",
      allowMods: true,
      cooldown: 5000,
      clientPerms: ["sendMessages", "banMembers"],
      userPerms: ["banMembers"],
    });
  }
  async execute({ message, args, prefix }: ExecuteArgs) {
    const Moderation = this.client.modules.get("Moderation") as Moderation | undefined;
    if (!Moderation) {
      Logger.error("command: ban: moderation module not loaded");
      return this.errorMessage(message, "Moderation module not loaded.");
    }

    if (!this.isUserID(args[0])) {
      return message.channel
        .createMessage({
          embeds: [this.getExampleUsage(message, "Thats not a valid user ID.", prefix)],
        })
        .catch((err) => Logger.warn(`command: unban: failed to create example message`, err));
    }

    const user = await Moderation.getUser(args[0]);
    if (!user) {
      return this.errorMessage(message, "Not a valid user.");
    }
    return Moderation.unbanUser(message.channel.guild, user, message.author, args[1])
      .then((res) => {
        Moderation.createCase(res)
          .then(() => {
            this.successMessage(message, `**${getTag(user)}** has been un-banned.`);
          })
          .catch((err) => {
            logger.error("command: unban: failed to create un-ban case", err);
            this.errorMessage(message, "Something went wrong, please try again later");
          });
      })
      .catch((err) => {
        logger.error("command: unban: failed to un-ban user", err);
        this.errorMessage(message, "Something went wrong, please try again later");
      });
  }
}
export default Unban;
