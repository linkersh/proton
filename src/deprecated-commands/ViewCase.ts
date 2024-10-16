import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { FormatPunishments, PunishmentColors } from "../../Constants";
import { Member } from "eris";
import { EmbedBuilder } from "../../utils/EmbedBuilder";
import pm from "pretty-ms";
import Logger from "../../core/structs/Logger";
import { collections } from "../../core/database/DBClient";
import logger from "../../core/structs/Logger";
import { getTag } from "../../utils/Util";

class Viewcase extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "view-case",
      description: "View a case by its ID",
      usage: "<id>",
      aliases: ["viewcase"],
      category: "moderation",
      allowMods: true,
      cooldown: 5000,
      clientPerms: ["sendMessages", "embedLinks"],
      userPerms: ["manageMessages"],
    });
  }

  formatDuration(duration: number) {
    if (typeof duration === "undefined" || isNaN(duration) || duration <= 0) {
      return "";
    }
    return `**Duration:** ${pm(duration)}\n`;
  }

  async execute({ message, args }: ExecuteArgs) {
    const id = parseInt(args[0]);
    if (isNaN(id) || id < 1) {
      return this.errorMessage(message, "Case ID needs to be a number and above 0.");
    }
    let caseData;
    try {
      caseData = await collections.cases.findOne({
        guild_id: message.guildID,
        id: id,
      });
    } catch (err) {
      logger.error("command: view-case: failed to get case", err);
    }
    if (!caseData) {
      return this.errorMessage(message, `Case with id "${id}" couldn't be found`);
    }
    let moderator, target;
    if (message.channel.guild.members.has(caseData.moderator.id)) {
      moderator = message.channel.guild.members.get(caseData.moderator.id) as Member;
    } else {
      moderator = caseData.moderator;
    }
    if (message.channel.guild.members.has(caseData.user.id)) {
      target = message.channel.guild.members.get(caseData.user.id) as Member;
    } else {
      target = caseData.user;
    }
    const moderatorTag = getTag(moderator);
    const targetTag = getTag(target);
    let description = "";
    description += `**Moderator:** ${moderatorTag} (${moderator.id})\n`;
    description += `${this.formatDuration(caseData.duration)}`;
    description += `**Reason:** ${caseData.reason || "No reason was provided."}`;
    const targetAvatar =
      target instanceof Member ? target.user.dynamicAvatarURL(undefined, 256) : target.avatar_url;
    const builder = new EmbedBuilder()
      .author(`${targetTag}`, targetAvatar)
      .field(`${FormatPunishments[caseData.type]} - Case #${id}`, description)
      .color(PunishmentColors[caseData.type])
      .timestamp(caseData.created_at);
    message.channel
      .createMessage({
        embeds: [builder.build()],
      })
      .catch((err) => Logger.error(`command: view-case: failed to create message`, err));
  }
}

export default Viewcase;
