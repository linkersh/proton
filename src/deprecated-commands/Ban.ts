import { ClientLegacyCommand as Command, ExecuteArgs } from "../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../core/client/ProtonClient";
import { parseDuration } from "../utils/Util";
import { CaseStructure } from "../core/database/models/Case";
import Logger from "../core/structs/Logger";
import pm from "pretty-ms";
import Moderation from "../modules/Moderation";

const deleteDaysRegex = /^[0-7]$/i;
const snowflakeRegex = /^[0-9]{16,19}$/;

class Ban extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "ban",
      description: "Ban a member from the server.\n\nYou can put a custom duration in the reason.",
      aliases: ["b", "bonk"],
      usage: "<member> [delete days] [reason]",
      examples: [
        "ban @Linker annoying",
        "ban Linker Spamming memes in general",
        "ban Linker#0001 smol brain",
        "ban 521677874055479296 Yep! Ids work too",
      ],
      category: "moderation",
      cooldown: 5000,
      allowMods: true,
      clientPerms: ["banMembers", "sendMessages"],
      userPerms: ["banMembers"],
    });
  }
  fixDeleteDays(num: number) {
    if (num > 7) {
      return 7;
    } else if (num < 0) {
      return 0;
    }
    return num;
  }
  async execute({ message, args, config, prefix }: ExecuteArgs) {
    const Moderation = this.client.modules.get("Moderation") as Moderation | undefined;
    if (!Moderation) {
      Logger.error("command: ban: moderation module not loaded");
      return this.errorMessage(message, "Moderation module not loaded.");
    }
    const error = `Specify a member to ban.`;
    const member = await this.resolveMember(args[0], message.channel.guild).catch((err) => {
      Logger.error(`command: ban: error fetching member`, err);
      return;
    });
    let deleteDays = 0;
    if (deleteDaysRegex.test(args[1])) {
      const parse = parseInt(args[1]);
      if (!isNaN(parse)) {
        deleteDays = this.fixDeleteDays(parse);
      }
    }
    let reason = deleteDays > 0 ? args.slice(2).join(" ") : args.slice(1).join(" ");
    let duration = 0;
    const parsedDuration = parseDuration(reason || ".");
    if (typeof parsedDuration === "object") {
      const str = parsedDuration.match[0] ?? "";
      reason =
        reason.slice(0, reason.indexOf(str)).trimEnd() +
        reason.slice(reason.indexOf(str) + str.length).trimStart();
      duration = parsedDuration.duration;
    }

    const onSuccess = (banCase: CaseStructure) => {
      let tag = "Dummy#0000";
      if (banCase) {
        tag = `${banCase.user.username}#${banCase.user.discriminator}`;
        Moderation.createCase(banCase).catch((err) =>
          Logger.error(`command: ban: failed to create case`, err)
        );
      }
      let msgString = `**${tag}** has been banned`;
      if (banCase.duration > 0) {
        msgString += " ";
        msgString += pm(banCase.duration);
      }
      this.successMessage(message, msgString);
    };
    if (!member && snowflakeRegex.test(args[0])) {
      if (args[0] === message.author.id) {
        return this.errorMessage(message, `Just press the leave server button.`);
      }
      if (args[0] === this.client.user.id) {
        return this.errorMessage(message, "Why do you want to ban me? :(");
      }

      const user = await this.client.getUser(args[0]);
      if (!user) {
        return this.errorMessage(message, "That user doesn't exist.");
      }
      return Moderation.banUser(
        message.channel.guild,
        user,
        message.author,
        config,
        duration,
        reason,
        deleteDays,
        true
      )
        .then(onSuccess)
        .catch((err) => {
          Logger.warn(`command: ban: failed to ban user`, err);
          this.errorMessage(message, "Failed to ban that user.");
        });
    } else if (!member) {
      return message.channel
        .createMessage({
          embeds: [this.getExampleUsage(message, error, prefix)],
        })
        .catch((err) => Logger.warn(`command: ban: failed to send example message`, err));
    }
    const actionError = await Moderation.canPunish(
      message.channel.guild,
      message.member,
      member,
      "ban"
    );
    if (actionError) {
      return this.errorMessage(message, actionError);
    }
    Moderation.banUser(
      message.channel.guild,
      member.user,
      message.author,
      config,
      duration,
      reason,
      deleteDays,
      true
    )
      .then(onSuccess)
      .catch((err) => {
        Logger.warn(`command: ban: failed to ban user`, err);
        this.errorMessage(message, "Failed to ban that user.");
      });
  }
}
export default Ban;
