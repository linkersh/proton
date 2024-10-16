import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { Constants } from "eris";
import { getTag, parseDuration } from "../../utils/Util";
import Lockdowns from "../../modules/Lockdowns";
import logger from "../../core/structs/Logger";

class Lockdown extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "lockdown",
      description: "Lockdown the channels.",
      usage: "[#channel]",
      commands: [
        {
          name: "all",
          desc: "Lock all the channels.",
          usage: "",
          cooldown: 5000,
        },
      ],
      category: "moderation",
      cooldown: 3000,
      aliases: ["lock"],
      clientPerms: ["sendMessages", "embedLinks"],
      userPerms: ["manageChannels"],
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const channel = this.parseChannel(args.join(" "), message.channel.guild) || message.channel;
    const perms = channel.permissionsOf(this.client.user.id);
    if (!perms.has("sendMessages")) {
      return this.errorMessage(message, "I can't view the specified channel.");
    }
    let x = 0,
      isError = false;
    for (; x < Lockdowns.RequiredLockdownPerms.length; x++) {
      if (!perms.has(Lockdowns.RequiredLockdownPerms[x] as keyof typeof Constants.Permissions)) {
        isError = true;
        break;
      }
    }
    if (isError) {
      return this.errorMessage(
        message,
        `I'm missing the ${Lockdowns.RequiredLockdownPerms[x]} permission in ${channel.mention}`
      );
    }
    await this.client.editChannelPermission(
      channel.id,
      message.guildID,
      BigInt(channel.permissionOverwrites.get(message.guildID)?.allow || 0) &
        ~Lockdowns.LockdownDeny,
      Lockdowns.LockdownDeny,
      Constants.PermissionOverwriteTypes.ROLE,
      `Lockdown by ${getTag(message.author)}`
    );
    if (message.channel.permissionsOf(this.client.user.id).has("sendMessages")) {
      this.successMessage(message, `Locked ${channel.mention}.`);
    }
  }
  async all({ message, args }: ExecuteArgs) {
    const duration = parseDuration(args[0])?.duration || 0;
    const perms = message.channel.guild.permissionsOf(this.client.user.id);
    let x = 0,
      isError = false;
    for (; x < Lockdowns.RequiredLockdownPerms.length; x++) {
      if (!perms.has(Lockdowns.RequiredLockdownPerms[x] as keyof typeof Constants.Permissions)) {
        isError = true;
        break;
      }
    }
    if (isError) {
      return this.errorMessage(
        message,
        `I'm missing the ${Lockdowns.RequiredLockdownPerms[x]} permission in this guild.`
      );
    }

    const lockdown = this.client.modules.get("Lockdown") as Lockdowns | undefined;
    if (!lockdown) {
      return this.errorMessage(message, "Lockdowns module not loaded");
    }

    try {
      await lockdown.lockdown(message.channel.guild, duration);
    } catch (err) {
      if (err instanceof Lockdowns.LockdownError) {
        return this.errorMessage(message, err.message);
      } else {
        logger.error("command: lockdown: failed to lockdown server", err);
        return this.errorMessage(message, "Something went wrong. Please try again later.");
      }
    }

    if (message.channel.permissionsOf(this.client.user.id).has("sendMessages")) {
      this.successMessage(message, `Locked the server.`);
    }
  }
}
export default Lockdown;
