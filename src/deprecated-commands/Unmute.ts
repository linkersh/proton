import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import Logger from "../../core/structs/Logger";
import Moderation from "../../modules/Moderation";
import { getTag, highestRole } from "../../utils/Util";

class Unmute extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "unmute",
      description: "Unmute a muted member.",
      usage: "<member> [reason]",
      examples: [
        "unmute Proton the developer finally fixed the bugs, lol this is a dream",
        "unmute 747401903268429874 unmute the weirdo",
      ],
      category: "moderation",
      allowMods: true,
      cooldown: 5000,
      aliases: [],
      clientPerms: ["sendMessages", "manageRoles"],
      userPerms: ["manageRoles"],
    });
  }
  async execute({ message, args, config, prefix }: ExecuteArgs) {
    const { guild } = message.channel;
    const muterole = guild.roles.get(config.moderation?.muterole || "");
    const Moderation = this.client.modules.get("Moderation") as Moderation | undefined;
    if (!Moderation) {
      Logger.error("command: ban: moderation module not loaded");
      return this.errorMessage(message, "Moderation module not loaded.");
    }

    const selfMember = await this.client.getSelfMember(message.channel.guild);
    if (!selfMember) {
      Logger.error("command: ban: self member not found");
      return this.errorMessage(message, "Self member not found.");
    }
    if (typeof muterole === "undefined") {
      const errorNoRole =
        "There is no valid mute role set, please create or set an existing mute role." +
        "Using the `muterole` command.";
      return this.errorMessage(message, errorNoRole);
    }

    if (muterole.position > highestRole(selfMember, message.channel.guild).position) {
      const positionError =
        "Mute role is too high, i can't give it to any user. Please move my role above the mute role.";
      return this.errorMessage(message, positionError);
    }
    const member = await this.resolveMember(args[0], message.channel.guild);
    if (!member) {
      const error = `Specify a member to un-mute.`;
      return message.channel
        .createMessage({
          embeds: [this.getExampleUsage(message, error, prefix)],
        })
        .catch((err) => Logger.warn(`command: unmute: failed to create example message`, err));
    }
    const actionError = await Moderation.canPunish(
      message.channel.guild,
      message.member,
      member,
      "mute"
    );
    if (actionError) {
      return this.errorMessage(message, actionError);
    }
    if (!member.roles.includes(muterole.id)) {
      return this.errorMessage(message, `**${getTag(member.user)}** is not muted.`);
    }
    const reason = args.slice(1).join(" ");
    Moderation.unmuteUser(message.channel.guild, member, message.author, config, reason)
      .then((unmuteCase) => {
        Moderation.createCase(unmuteCase)
          .then(() => {
            this.successMessage(message, `**${getTag(member.user)}** has been unmuted.`);
          })
          .catch((err) => {
            Logger.error("command: unmute: failed to create un-mute case", err);
            this.errorMessage(message, "Something went wrong... Please try again later");
          });
      })
      .catch((err) => {
        Logger.error("command: unmute: failed to unmute user", err);
        this.errorMessage(message, err.message);
      });
  }
}
export default Unmute;
