import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { highestRole, parseDuration } from "../../utils/Util";
import pm from "pretty-ms";
import Logger from "../../core/structs/Logger";
import Moderation from "../../modules/Moderation";

class Mute extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "mute",
      description: "Mute a specific member in the server.",
      usage: "<member> [duration] [reason]",
      examples: [
        "mute @Test Dummy Spamming attachments, should've used `-attachmentespam` automod SMH!",
        "mute 747401903268429874 get some help!",
        'mute "Pro Djs Developer" 🙄',
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
    let selfMember = guild.members.get(this.client.user.id);
    if (!selfMember) {
      selfMember = await this.client.getRESTGuildMember(message.guildID, this.client.user.id);
      if (!selfMember) {
        return this.errorMessage(
          message,
          "Failed to retrieve my own info, please try again later..."
        );
      }
      guild.members.add(selfMember, guild);
    }
    const Moderation = this.client.modules.get("Moderation") as Moderation | undefined;
    if (!Moderation) {
      Logger.error("command: ban: moderation module not loaded");
      return this.errorMessage(message, "Moderation module not loaded.");
    }
    if (!muterole) {
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
      const error = `Specify a member to mute.`;
      return message.channel
        .createMessage({
          embeds: [this.getExampleUsage(message, error, prefix)],
        })
        .catch((err) => Logger.warn(`command: mute: failed to create example message`, err));
    }
    if (member.roles.includes(muterole.id)) {
      return this.errorMessage(message, `This member is already muted.`);
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
    let reason = args.slice(1).join(" "),
      duration = 0;
    const parsedDuration = parseDuration(reason);
    if (typeof parsedDuration === "object") {
      const str = parsedDuration.match[0] ?? "";
      reason =
        reason.slice(0, reason.indexOf(str)).trimEnd() +
        reason.slice(reason.indexOf(str) + str.length).trimStart();
      duration = parsedDuration.duration;
    }
    Moderation.muteUser(message.channel.guild, member, message.author, config, duration, reason)
      .then((muteCase) => {
        Moderation.createCase(muteCase).catch((err) =>
          Logger.error(`command: mute: failed to create case`, err)
        );
        let msg = `**${muteCase.user.username}#${muteCase.user.discriminator}** has been muted`;
        if (muteCase.duration > 0) {
          msg += ` for ${pm(muteCase.duration)}`;
        }
        msg += ".";
        this.successMessage(message, msg);
      })
      .catch((msg) => {
        Logger.warn(`command: mute: failed to mute user`, msg);
        this.errorMessage(message, "Can't mute that user, please try again later.");
      });
  }
}
export default Mute;
