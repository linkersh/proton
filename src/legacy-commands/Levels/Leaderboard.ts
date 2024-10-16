import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import { EmbedBuilder } from "../../utils/EmbedBuilder";
import { ComponentListener } from "../../utils/ComponentListener.js";
import { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";
import { Level } from "../../core/database/models/Levels";
import { Constants, User } from "eris";
import logger from "../../core/structs/Logger.js";
import { getTag } from "../../utils/Util";

class Leaderboard extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "leaderboard",
      description: "View the levelling leaderboard.",
      usage: "[page]",
      aliases: ["lb"],
      cooldown: 3000,
      category: "levels",
      userPerms: [],
      clientPerms: ["sendMessages", "embedLinks"],
    });
  }
  async execute({ message }: ExecuteArgs) {
    const components = [
      {
        type: Constants.ComponentTypes.BUTTON,
        style: Constants.ButtonStyles.SECONDARY,
        label: "Previous",
        custom_id: "leaderboard_button_previous",
        disabled: true,
      },
      {
        type: Constants.ComponentTypes.BUTTON,
        style: Constants.ButtonStyles.SECONDARY,
        label: "Next",
        custom_id: "leaderboard_button_next",
        disabled: false,
      },
    ];
    let page = 1;
    const fetchData = () => {
      const skip = page > 1 ? (page - 1) * 10 : 0;
      return collections.levels
        .find({ guildID: message.guildID })
        .sort({ "xp.total": -1 })
        .skip(skip)
        .limit(10)
        .toArray();
    };
    const buildEmbed = async (data: Level[]) => {
      const builder = new EmbedBuilder().title(`${message.channel.guild.name}'s leaderboard`);
      let desc = "";
      let rank = 1 + (page - 1) * 10;
      for (const rankData of data) {
        let user = this.client.users.get(rankData.userID);
        if (!user) {
          try {
            user = await this.client.getRESTUser(rankData.userID);
            if (user) {
              this.client.users.add(user, null, true);
            }
          } catch {
            user = {
              username: "Unkown User",
              discriminator: "0000",
            } as User;
          }
        }
        desc += `\`#${rank}\` **${getTag(user)}**`;
        desc += ` - Level: ${rankData.level.toLocaleString()}\n`;
        rank++;
      }
      if (desc.length === 0) {
        builder.description("Seems empty ehh?");
      } else {
        builder.description(desc);
      }
      builder.footer(`Page: ${page}`);
      builder.color("theme");
      return builder;
    };
    let data: Level[] | undefined, embed: EmbedBuilder | undefined;
    try {
      data = await fetchData();
      embed = await buildEmbed(data);
    } catch (err) {
      logger.error(`command: leaderboard: failed to fetch and/or build embed from data`, err);
    }

    if (!data || !embed) {
      return this.errorMessage(message, "Failed to fetch/visualize data, please try again later.");
    }
    if (data.length < 10) {
      components[1].disabled = true;
    }
    let msg;
    try {
      msg = await message.channel.createMessage({
        embeds: [embed.build()],
        components: [{ type: 1, components: components }],
      });
    } catch (err) {
      logger.warn(`command: leaderboard: failed to send the leaderboard message`, err);
    }
    if (!msg) {
      return this.errorMessage(message, "Failed to fetch/visualize data, please try again later.");
    }
    const listener = new ComponentListener(this.client, msg, {
      expireAfter: 60_000,
      repeatTimeout: true,
      userID: message.author.id,
      componentTypes: [2],
    });

    listener.on("interactionCreate", async (interaction) => {
      if (interaction.data.custom_id === "leaderboard_button_previous") {
        page--;
        if (page === 1) {
          components[0].disabled = true;
        } else {
          components[0].disabled = false;
        }
        components[1].disabled = false;
        let newEmbed;
        try {
          const newData = await fetchData();
          newEmbed = await buildEmbed(newData);
        } catch (err) {
          logger.error(`command: leaderboard: failed to fetch and/or build embed from data`, err);
        }
        if (!newEmbed) {
          interaction
            .editParent({
              content: "Failed to fetch previous page, please try again later.",
              components: [],
              embeds: [],
            })
            .catch((err) => {
              logger.warn(`command: leaderboard: failed to respond to interaction`, err);
            });
          return;
        }
        interaction
          .editParent({
            embeds: [newEmbed.build()],
            components: [{ type: 1, components: components }],
          })
          .catch((err) => {
            logger.warn(`command: leaderboard: failed to respond to interaction`, err);
          });
      }
      if (interaction.data.custom_id === "leaderboard_button_next") {
        page++;
        let newData;
        try {
          newData = await fetchData();
        } catch (err) {
          logger.error(`command: leaderboard: failed to fetch data`, err);
        }
        if (!newData) {
          interaction
            .editParent({
              content: "Failed to fetch leaderboard, please try again later.",
              components: [],
              embeds: [],
            })
            .catch((err) => {
              logger.warn(`command: leaderboard: failed to respond to interaction`, err);
            });
          return;
        }
        if (!data || data.length === 0) {
          page--;
          components[1].disabled = true;
          interaction
            .editParent({
              components: [{ type: 1, components: components }],
            })
            .catch((err) => {
              logger.warn(`command: leaderboard: failed to respond to interaction`, err);
            });
        } else {
          components[0].disabled = false;
          if (data.length <= 9) {
            components[1].disabled = true;
          } else {
            components[1].disabled = false;
          }
          buildEmbed(newData)
            .then((embed) => {
              interaction
                .editParent({
                  embeds: [embed.build()],
                  components: [{ type: 1, components: components }],
                })
                .catch((err) => {
                  logger.warn(`command: leaderboard: failed to respond to interaction`, err);
                });
            })
            .catch((err) => {
              logger.error(err);
              interaction
                .editParent({
                  content: "Failed to visualize data, please try again later.",
                  components: [],
                  embeds: [],
                })
                .catch((err) => {
                  logger.warn(`command: leaderboard: failed to respond to interaction`, err);
                });
            });
        }
      }
    });
  }
}
export default Leaderboard;
