import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { ComponentListener } from "../../utils/ComponentListener";
import { EmbedBuilder } from "../../utils/EmbedBuilder";
import { collections } from "../../core/database/DBClient";
import { Filter } from "mongodb";
import { Case } from "../../core/database/models/Case";
import { getTag } from "../../utils/Util";
import { Constants } from "eris";
import Logger from "../../core/structs/Logger";
import { FormatPunishments } from "../../Constants";

class Cases extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "cases",
      description: "View cases of a specifc member.",
      usage: "[member]",
      allowMods: true,
      category: "moderation",
      cooldown: 5000,
      aliases: [],
      clientPerms: ["sendMessages"],
      userPerms: ["manageMessages", "viewAuditLog"],
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const member = await this.resolveUser(args[0]);
    let Q_userID: string | null = null;
    if (member) {
      Q_userID = member.id;
    }
    const components = [
      {
        type: Constants.ComponentTypes.BUTTON,
        style: Constants.ButtonStyles.SECONDARY,
        label: "Previous",
        custom_id: "cases_button_previous",
        disabled: true,
      },
      {
        type: Constants.ComponentTypes.BUTTON,
        style: Constants.ButtonStyles.SECONDARY,
        label: "Next",
        custom_id: "cases_button_next",
        disabled: false,
      },
    ];
    let page = 1;
    const fetchData = () => {
      const perPage = 9;
      const skip = page > 1 ? (page - 1) * perPage : 0;
      const query: Filter<Case> = { guild_id: message.guildID };
      if (Q_userID) {
        query.user = { id: Q_userID };
      }
      return collections.cases.find(query).skip(skip).limit(perPage).toArray();
    };
    const buildEmbed = (data: Case[]) => {
      const builder = new EmbedBuilder().color("theme");
      if (member) {
        builder.title(`${getTag(member)}'s cases`);
        for (const caseData of data) {
          const moderator = this.client.users.get(caseData.moderator.id) || {
            username: "Unkown User",
            discriminator: "0001",
          };
          const formatDate = Math.floor(new Date(caseData.created_at).getTime() / 1000);
          builder.field(
            `Case #${caseData.id} | <t:${formatDate}:d>`,
            [
              `Mod: ${getTag(moderator)}\nType: ${FormatPunishments[caseData.type]}`,
              `Reason: ${caseData.reason || "None"}`,
            ].join("\n"),
            true
          );
        }
      } else {
        builder.title("Server's Cases");
        let desc = "";
        for (const caseData of data) {
          const user = this.client.users.get(caseData.user.id) || {
            username: caseData.user.username,
            discriminator: caseData.user.discriminator,
          };
          desc += `#${caseData.id} - ${getTag(user)}\n`;
        }
        builder.description(desc || "None");
      }
      return builder;
    };
    let fetchedData;
    try {
      fetchedData = await fetchData();
    } catch (err) {
      Logger.error(`command: cases: failed to fetch cases`, err);
    }
    if (!fetchedData) {
      return this.errorMessage(message, "Failed to fetch cases data. Please try again later");
    }
    if (member && (!fetchedData || !fetchedData.length)) {
      return this.errorMessage(message, `**${getTag(member)}** does not have any cases.`);
    }
    if (fetchedData.length < 9) {
      components[1].disabled = true;
    }
    let msg;
    try {
      msg = await message.channel.createMessage({
        embeds: [buildEmbed(fetchedData).build()],
        components: [{ type: 1, components: components }],
      });
    } catch (err) {
      Logger.warn(`command: cases: failed to create message`, err);
    }
    if (!msg) {
      return this.errorMessage(message, "Failed to render cases, please try again later.");
    }
    const listener = new ComponentListener(this.client, msg, {
      expireAfter: 60_000 * 2,
      repeatTimeout: true,
      userID: message.author.id,
      componentTypes: [2],
    });

    listener.on("interactionCreate", async (interaction) => {
      if (interaction.data.custom_id === "cases_button_previous") {
        page--;
        if (page === 1) {
          components[0].disabled = true;
        } else {
          components[0].disabled = false;
        }
        components[1].disabled = false;
        let data;
        try {
          data = await fetchData();
        } catch (err) {
          Logger.error("command: cases: failed to fetch cases", err);
        }
        if (!data) {
          interaction
            .editParent({
              content: "Failed to fetch previous page, please try again later.",
              embeds: [],
              components: [],
            })
            .catch((err) =>
              Logger.warn(`command: cases: failed to respond to an interaction`, err)
            );
          return;
        }
        interaction
          .editParent({
            embeds: [buildEmbed(data).build()],
            components: [{ type: 1, components: components }],
          })
          .catch((err) => Logger.warn(`command: cases: failed to respond to an interaction`, err));
      }
      if (interaction.data.custom_id === "cases_button_next") {
        page++;
        let data,
          isError = false;
        try {
          data = await fetchData();
        } catch (err) {
          isError = true;
          Logger.error("command: cases: failed to fetch cases", err);
        }
        if (isError) {
          interaction
            .editParent({
              content: "Failed to fetch next page, please try again later.",
              embeds: [],
              components: [],
            })
            .catch((err) =>
              Logger.warn(`command: cases: failed to respond to an interaction`, err)
            );
          return;
        }
        if (!data || data.length === 0) {
          page--;
          components[1].disabled = true;
          interaction
            .editParent({
              components: [{ type: 1, components: components }],
            })
            .catch((err) =>
              Logger.warn(`command: cases: failed to respond to an interaction`, err)
            );
        } else {
          components[0].disabled = false;
          if (data.length <= 8) {
            components[1].disabled = true;
          } else {
            components[1].disabled = false;
          }
          interaction
            .editParent({
              embeds: [buildEmbed(data).build()],
              components: [{ type: 1, components: components }],
            })
            .catch((err) =>
              Logger.warn(`command: cases: failed to respond to an interaction`, err)
            );
        }
      }
    });
  }
}
export default Cases;
