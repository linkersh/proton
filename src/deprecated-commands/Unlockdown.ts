import Lockdowns from "../../modules/Lockdowns";
const { LockdownDeny, RequiredLockdownPerms } = Lockdowns;
import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { Constants } from "eris";
import { getTag } from "../../utils/Util";
import logger from "../../core/structs/Logger";
class Unlockdown extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "unlockdown",
      description: "Un-lock the server or a specific channel.",
      usage: "[#channel]",
      commands: [
        {
          name: "all",
          desc: "Un-lock all the channels.",
          usage: "",
          cooldown: 5000,
        },
      ],
      category: "moderation",
      cooldown: 3000,
      aliases: ["unlock"],
      clientPerms: [],
      userPerms: ["manageChannels"],
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const channel = this.parseChannel(args.join(" "), message.channel.guild) || message.channel;
    const perms = channel.permissionsOf(this.client.user.id);
    if (!perms.has("manageRoles")) {
      return this.errorMessage(message, "I can't manage permissions in the specified channel.");
    }
    const overwrite = channel.permissionOverwrites.get(message.guildID);
    if (!overwrite) {
      return this.errorMessage(message, "Overwrite not found");
    }
    const allow = overwrite.allow || 0n;
    let deny = overwrite.deny || 0n;
    deny &= ~LockdownDeny;
    await this.client.editChannelPermission(
      channel.id,
      message.guildID,
      allow,
      deny,
      Constants.PermissionOverwriteTypes.ROLE,
      `Lockdown by ${getTag(message.author)}`
    );
    if (message.channel.permissionsOf(this.client.user.id).has("sendMessages")) {
      this.successMessage(message, `Un-locked ${channel.mention}.`);
    }
  }
  async all({ message }: ExecuteArgs) {
    const perms = message.channel.guild.permissionsOf(this.client.user.id);
    let x = 0,
      isError = false;
    for (; x < RequiredLockdownPerms.length; x++) {
      if (!perms.has(RequiredLockdownPerms[x] as keyof typeof Constants.Permissions)) {
        isError = true;
        break;
      }
    }
    if (isError) {
      return this.errorMessage(
        message,
        `I'm missing the ${RequiredLockdownPerms[x]} permission in this guild.`
      );
    }

    const lockdown = this.client.modules.get("Lockdown") as Lockdowns | undefined;
    if (!lockdown) {
      return this.errorMessage(message, "Lockdowns module not loaded");
    }

    try {
      await lockdown.unlockdown(message.channel.guild);
    } catch (err) {
      if (err instanceof Lockdowns.LockdownError) {
        return this.errorMessage(message, err.message);
      } else {
        logger.error("command: lockdown: failed to un-lockdown server", err);
        return this.errorMessage(message, "Something went wrong. Please try again later.");
      }
    }

    if (message.channel.permissionsOf(this.client.user.id).has("sendMessages")) {
      this.successMessage(message, `Un-locked the server.`);
    }
  }
}
export default Unlockdown;
