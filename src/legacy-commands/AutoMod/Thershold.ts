import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { PunishmentTypes } from "../../Constants";
import { EmbedBuilder } from "../../utils/EmbedBuilder";
import pm from "pretty-ms";
import { parseDuration } from "../../utils/Util";
import { collections } from "../../core/database/DBClient";

class Threshold extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "threshold",
      description: "Add/delete automod warning thresholds.",
      usage: "",
      commands: [
        {
          name: "add",
          desc: "Add a warning threshold.",
          usage: "<warn_count> <mute|kick|ban> [duration]",
        },
        {
          name: "remove",
          desc: "Remove a warning threshold",
          usage: "<warn_count>",
        },
        {
          name: "list",
          desc: "List all the thresholds.",
          usage: "",
        },
      ],
      aliases: [],
      category: "automod",
      cooldown: 3000,
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  async add({ message, args, config }: ExecuteArgs) {
    const warnCount = parseInt(args[0]);
    if (isNaN(warnCount)) {
      return this.errorMessage(message, `Warning count needs to be a number above 0.`);
    }
    if (warnCount > 25) {
      return this.errorMessage(message, `Warning count can't be above 25.`);
    }
    if (warnCount < 0) {
      return this.errorMessage(message, `Warning count needs to be above 0.`);
    }
    if (config.automod && config.automod?.warnThresholds?.find((x) => x.warnCount === warnCount)) {
      return this.errorMessage(
        message,
        `There is already a threshold on ${warnCount} warn${warnCount > 1 ? "s" : ""}.`
      );
    }
    const actions = ["ban", "mute", "kick"];
    const action = args[1]?.toLowerCase();
    if (!actions.includes(action)) {
      return this.errorMessage(
        message,
        `"${args[1] || ""}" is not a valid action name, specify a valid action from: ${actions.join(
          ", "
        )}`
      );
    }
    const timeArg = args.slice(2).join(" ").toLowerCase();
    let time = 0;
    if (timeArg) {
      const parseTime = parseDuration(timeArg);
      if (!parseTime || isNaN(parseTime?.duration)) {
        return this.errorMessage(
          message,
          `"${timeArg}" is not a valid time, specify a valid one like: \`10 hours\``
        );
      }
      if (parseTime?.duration > 0 && parseTime?.duration < 60 * 1000) {
        return this.errorMessage(message, `Time needs to be above or equal to 1 minute.`);
      }
      time = parseTime.duration;
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      {
        $push: {
          "automod.warnThresholds": {
            warnCount: warnCount,
            action: PunishmentTypes[action.toUpperCase() as keyof typeof PunishmentTypes],
            duration: time,
          },
        },
      }
    );
    this.successMessage(message, `Added a new threshold for ${warnCount} warns.`);
  }
  async remove({ message, args }: ExecuteArgs) {
    const warnCount = parseInt(args[0]);
    if (isNaN(warnCount)) {
      return this.errorMessage(message, `Warning count needs to be a number above 0.`);
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      {
        $pull: {
          "automod.warnThresholds": {
            warnCount,
          },
        },
      }
    );
    this.successMessage(message, `Removed a threshold from ${warnCount} warnings.`);
  }

  formatPunishment(action: PunishmentTypes) {
    if (action === PunishmentTypes.BAN) {
      return "ban";
    } else if (action === PunishmentTypes.KICK) {
      return "kick";
    } else if (action === PunishmentTypes.MUTE) {
      return "mute";
    }
    return "unknown action";
  }
  list({ message, config }: ExecuteArgs) {
    const thresholds = config?.automod?.warnThresholds || [];
    const builder = new EmbedBuilder()
      .title("AutoMod Warn Thresholds")
      .color("theme")
      .footer(`${thresholds.length} thresholds`);
    let desc = "";
    for (const threshold of thresholds) {
      const isKick = threshold.action === PunishmentTypes.KICK;
      desc += `${this.formatPunishment(threshold.action)} user `;
      desc += `${!isKick && threshold.duration ? `for ${pm(threshold.duration)}` : ""} `;
      desc += `when they reach **${threshold.warnCount}** warnings\n`;
    }
    if (!desc) {
      desc = `No thresholds added yet 🧐`;
    }
    builder.description(desc);
    message.channel.createMessage({ embeds: [builder.build()] });
  }
}
export default Threshold;
