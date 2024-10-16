import { PunishmentTypes } from "../../Constants";
import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import Logger from "../../core/structs/Logger";
import Moderation from "../../modules/Moderation";

class Warn extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "warn",
      description: "Warn a specific member.",
      usage: "<member> [reason]",
      examples: [
        "warn PlsHelp#0991 Stop misusing the support channels, join the support server for help.",
        "warn 521677874055479296 Emoji spamming again ;-;, @admins use the -emojispam command!",
        "warn Linker you are so bad at coding, i can't take you anymore",
      ],
      aliases: ["w"],
      allowMods: true,
      cooldown: 5000,
      category: "moderation",
      clientPerms: ["sendMessages"],
      userPerms: ["manageMessages"],
    });
  }
  async execute({ message, args, config, prefix }: ExecuteArgs) {
    const Moderation = this.client.modules.get("Moderation") as Moderation | undefined;
    if (!Moderation) {
      Logger.error("command: ban: moderation module not loaded");
      return this.errorMessage(message, "Moderation module not loaded.");
    }

    const member = await this.resolveMember(args[0], message.channel.guild);
    const error = `Specify a member to warn.`;
    if (!member) {
      return message.channel
        .createMessage({
          embeds: [this.getExampleUsage(message, error, prefix)],
        })
        .catch((err) => Logger.error(`command: warn: failed to create example message`, err));
    }
    const actionError = await Moderation.canPunish(
      message.channel.guild,
      message.member,
      member,
      "warn"
    );
    if (actionError) {
      return this.errorMessage(message, actionError);
    }
    const reason = args.slice(1).join(" ");
    const warnCases = await Moderation.warnWithThresholds(
      message.channel.guild,
      member,
      message.member.user,
      reason,
      config
    );
    Moderation.createCase(warnCases).catch((err) =>
      Logger.error(`command: warn: failed to create create many cases`, err)
    );
    let content = `**${member.user.username}#${member.user.discriminator}** has been `;
    const format = (t: PunishmentTypes) => {
      if (t === PunishmentTypes.BAN) {
        return "banned";
      } else if (t === PunishmentTypes.MUTE) {
        return "muted";
      } else if (t === PunishmentTypes.KICK) {
        return "kicked";
      } else if (t === PunishmentTypes.WARN) {
        return "warned";
      }
    };
    if (warnCases.length > 2) {
      content += warnCases
        .slice(0, warnCases.length - 1)
        .map((c) => format(c.type))
        .join(", ");
      content += ` and `;
      const lastCase = warnCases.pop();
      if (lastCase) {
        content += format(lastCase.type);
      }
    } else {
      content += warnCases.map((c) => format(c.type)).join(" and ");
    }
    content += ".";
    this.successMessage(message, content);
  }
}
export default Warn;
