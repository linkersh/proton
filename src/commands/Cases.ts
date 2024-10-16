import { ProtonClient } from "../core/client/ProtonClient";
import { CommandInteraction, GuildTextableChannel, Constants, Button, SelectMenu } from "eris";
import Command from "../core/structs/ClientCommand";
import { collections } from "../core/database/DBClient";
import { Filter } from "mongodb";
import { Case } from "../core/database/models/Case";
import { FormatPunishments, PunishmentColors, PunishmentTypes } from "../Constants";
import { EmbedBuilder } from "../utils/EmbedBuilder";
import { getTag } from "../utils/Util";
import { ComponentListener } from "../utils/ComponentListener";
import logger from "../core/structs/Logger";
import prettyMilliseconds from "pretty-ms";
const { ApplicationCommandOptionTypes: OptionType } = Constants;

export default class Cases extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "cases";
  description = "Manage cases in this server.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "list",
      description: "List cases with optional filter(s)",
      options: [
        {
          type: OptionType.INTEGER,
          name: "page",
          description: "Page number to view",
          min_value: 1,
        },
        {
          name: "user",
          description: "Filter cases by a specific member",
          type: OptionType.USER,
        },
        {
          name: "moderator",
          description: "Filter cases by a specific moderator",
          type: OptionType.USER,
        },
        {
          name: "after",
          description: "Filter cases after a specific date, US format.",
          type: OptionType.STRING,
        },
        {
          name: "before",
          description: "Filter cases before a specific date, US format.",
          type: OptionType.STRING,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "view",
      description: "View a specific case by it's id.",
      options: [
        {
          type: OptionType.INTEGER,
          name: "id",
          description: "The id of the case to view.",
          min_value: 1,
          max_value: 49_999,
          required: true,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "delete-warn",
      description: "Delete user's warning.",
      options: [
        {
          type: OptionType.INTEGER,
          name: "id",
          description: "The id of the warn case.",
          min_value: 1,
          max_value: 49_999,
          required: true,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "clear-cases",
      description: "Clear all cases of a user.",
      options: [
        {
          name: "user",
          description: "Filter cases by a specific member",
          type: OptionType.USER,
          required: true,
        },
      ],
    },
  ];
  guildID = null;
  listCases(
    perPage: number,
    guildID: string,
    skip: number,
    types?: PunishmentTypes[],
    userID?: string,
    moderatorID?: string,
    after?: number,
    before?: number
  ) {
    const filter: Filter<Case> = {
      guild_id: guildID,
      "user.id": userID,
      "moderator.id": moderatorID,
    };
    if (types && types.length > 0) {
      filter.type = { $in: types };
    }
    if (after) {
      filter.created_at = { $gt: new Date(after) };
    }
    if (before) {
      if (filter.created_at) {
        filter.created_at = { ...filter.created_at, $lt: new Date(before) };
      } else {
        filter.created_at = { $lt: new Date(before) };
      }
    }
    return collections.cases
      .find(JSON.parse(JSON.stringify(filter)))
      .skip(skip)
      .limit(perPage)
      .toArray();
  }

  async casesEmbed(data: Case[]) {
    const builder = new EmbedBuilder();
    for (let x = 0; x < data.length; x++) {
      const caseData = data[x];
      const moderator =
        (await this.moderation.getUser(caseData.moderator.id)) ?? caseData.moderator;
      builder.field(
        `#${caseData.id} - <t:${Math.floor(caseData.created_at.getTime() / 1000)}:d>`,
        `**Moderator:** ${getTag(moderator)}\n**Type:** ${
          FormatPunishments[caseData.type]
        }\n**Reason:** ${caseData.reason?.slice(0, 50) ?? "No Reason"}`,
        true
      );
    }
    if (builder._fields.length === 0) {
      builder.description("Nothing here yet! 👀");
    }
    builder.color("theme");
    return builder.build();
  }

  async handler(interaction: CommandInteraction<GuildTextableChannel>) {
    if (interaction.data.options === undefined) {
      return;
    }
    if (!interaction.guildID || !interaction.member) {
      return;
    }

    await interaction.acknowledge();
    const guild = await this.client.getGuild(interaction.guildID);
    if (!guild) {
      return;
    }

    const subCommand = interaction.data.options[0];
    if (subCommand.type !== OptionType.SUB_COMMAND) return;
    if (subCommand.name === "list") {
      const afterOpt = subCommand.options?.find((x) => x.name === "after");
      const beforeOpt = subCommand.options?.find((x) => x.name === "before");
      const userIdOpt = subCommand.options?.find((x) => x.name === "user");
      const moderatorIdOpt = subCommand.options?.find((x) => x.name === "moderator");
      const pageOpt = subCommand.options?.find((x) => x.name === "page");
      let types: PunishmentTypes[] = [];
      let oldPage = 0;

      let after: number | undefined,
        before: number | undefined,
        userID: string | undefined,
        pageNum: number | undefined,
        moderatorID: string | undefined;

      if (afterOpt && afterOpt.type === OptionType.STRING) {
        const parsed = Date.parse(afterOpt.value);
        if (Number.isInteger(parsed)) after = parsed;
      }
      if (beforeOpt && beforeOpt.type === OptionType.STRING) {
        const parsed = Date.parse(beforeOpt.value);
        if (Number.isInteger(parsed)) before = parsed;
      }
      if (userIdOpt && userIdOpt.type === OptionType.USER) {
        userID = userIdOpt.value;
      }
      if (moderatorIdOpt && moderatorIdOpt.type === OptionType.USER) {
        moderatorID = moderatorIdOpt.value;
      }
      if (pageOpt && pageOpt.type === OptionType.INTEGER) {
        pageNum = pageOpt.value;
      }
      if (!interaction.member.permissions.has("manageMessages")) {
        userID = interaction.member.user.id;
      }

      let page = pageNum || 1;

      const pageButtons: Button[] = [
        {
          type: Constants.ComponentTypes.BUTTON,
          style: Constants.ButtonStyles.SECONDARY,
          label: "Previous",
          custom_id: "btn_slash_cases_previous",
          disabled: page === 1 ? true : false,
        },
        {
          type: Constants.ComponentTypes.BUTTON,
          style: Constants.ButtonStyles.SECONDARY,
          label: "Next",
          custom_id: "btn_slash_cases_next",
          disabled: false,
        },
      ];

      const actionsMenu: SelectMenu[] = [
        {
          type: Constants.ComponentTypes.SELECT_MENU,
          custom_id: "slash_cases_select",
          options: [
            {
              label: "All Cases",
              value: "all",
              description: "Show all cases",
            },
            {
              label: "Mutes",
              value: "mute",
              description: "Show cases that are mutes/un-mutes",
            },
            {
              label: "Bans",
              value: "ban",
              description: "Show cases that are bans/un-ban",
            },
            {
              label: "Kicks",
              value: "kick",
              description: "Show cases that are kicks",
            },
            {
              label: "Warnings",
              value: "warn",
              description: "Show cases that are warnings",
            },
            {
              label: "Timeouts",
              value: "timeout",
              description: "Show cases that are timeouts",
            },
          ],
          min_values: 1,
          max_values: 4,
          placeholder: "Select action(s)",
        },
      ];

      const perPage = 9;
      let skip = page > 1 ? (page - 1) * perPage : 0;
      const data = await this.listCases(
        9,
        guild.id,
        skip,
        types,
        userID,
        moderatorID,
        after,
        before
      );
      if (data.length < perPage) pageButtons[1].disabled = true;

      const msg = await interaction.createFollowup({
        embeds: [await this.casesEmbed(data)],
        components: [
          {
            type: Constants.ComponentTypes.ACTION_ROW,
            components: actionsMenu,
          },
          {
            type: Constants.ComponentTypes.ACTION_ROW,
            components: pageButtons,
          },
        ],
      });

      const menuListener = new ComponentListener(this.client, msg, {
        expireAfter: 40_000,
        userID: interaction.member.user.id,
        repeatTimeout: true,
        componentTypes: [Constants.ComponentTypes.SELECT_MENU],
      });

      const buttonListener = new ComponentListener(this.client, msg, {
        expireAfter: 40_000,
        userID: interaction.member.user.id,
        repeatTimeout: true,
        componentTypes: [Constants.ComponentTypes.BUTTON],
      });

      buttonListener.on("interactionCreate", async (interaction) => {
        if (interaction.data.component_type !== Constants.ComponentTypes.BUTTON) return;
        await interaction
          .acknowledge()
          .catch((err) => logger.error("command: cases: failed to ack an interaction", err));
        if (interaction.data.custom_id === "btn_slash_cases_previous") {
          if (page === 1) {
            return;
          }
          page--;
          skip = page > 1 ? (page - 1) * perPage : 0;
          let data;
          try {
            data = await this.listCases(
              9,
              guild.id,
              skip,
              types,
              userID,
              moderatorID,
              after,
              before
            );
          } catch (err) {
            logger.error("command: cases: failed to list cases", data);
            return interaction
              .createFollowup(
                this.errorMessage(
                  interaction.channel as GuildTextableChannel,
                  "Something went wrong..."
                )
              )
              .catch((err) => {
                logger.error("command: cases: failed to respond to an interaction", err);
              });
          }
          if (!data) {
            page++;
            skip = page > 1 ? (page - 1) * perPage : 0;
            pageButtons[0].disabled = true;
            return interaction
              .editParent({
                components: [
                  {
                    type: Constants.ComponentTypes.ACTION_ROW,
                    components: actionsMenu,
                  },
                  {
                    type: Constants.ComponentTypes.ACTION_ROW,
                    components: pageButtons,
                  },
                ],
              })
              .catch((err) => {
                logger.error("command: cases: failed to respond to an interaction", err);
              });
          } else {
            if (page === 1) pageButtons[0].disabled = true;
            pageButtons[1].disabled = false;
            return interaction
              .editParent({
                embeds: [await this.casesEmbed(data)],
                components: [
                  {
                    type: Constants.ComponentTypes.ACTION_ROW,
                    components: actionsMenu,
                  },
                  {
                    type: Constants.ComponentTypes.ACTION_ROW,
                    components: pageButtons,
                  },
                ],
              })
              .catch((err) => {
                logger.error("command: cases: failed to respond to an interaction", err);
              });
          }
        } else {
          page++;
          skip = page > 1 ? (page - 1) * perPage : 0;
          let data;
          try {
            data = await this.listCases(
              9,
              guild.id,
              skip,
              types,
              userID,
              moderatorID,
              after,
              before
            );
          } catch (err) {
            logger.error("command: cases: failed to list cases", data);
            return interaction
              .createFollowup(
                this.errorMessage(
                  interaction.channel as GuildTextableChannel,
                  "Something went wrong..."
                )
              )
              .catch((err) => {
                logger.error("command: cases: failed to respond to an interaction", err);
              });
          }
          if (!data || data.length === 0) {
            page--;
            skip = page > 1 ? (page - 1) * perPage : 0;
            pageButtons[1].disabled = true;
            return interaction
              .editParent({
                components: [
                  {
                    type: Constants.ComponentTypes.ACTION_ROW,
                    components: actionsMenu,
                  },
                  {
                    type: Constants.ComponentTypes.ACTION_ROW,
                    components: pageButtons,
                  },
                ],
              })
              .catch((err) => {
                logger.error("command: cases: failed to respond to an interaction", err);
              });
          } else {
            pageButtons[0].disabled = false;
            if (data.length < perPage) pageButtons[1].disabled = true;

            return interaction
              .editParent({
                embeds: [await this.casesEmbed(data)],
                components: [
                  {
                    type: Constants.ComponentTypes.ACTION_ROW,
                    components: actionsMenu,
                  },
                  {
                    type: Constants.ComponentTypes.ACTION_ROW,
                    components: pageButtons,
                  },
                ],
              })
              .catch((err) => {
                logger.error("command: cases: failed to respond to an interaction", err);
              });
          }
        }
      });

      menuListener.on("interactionCreate", async (interaction) => {
        if (interaction.data.component_type !== Constants.ComponentTypes.SELECT_MENU) return;
        await interaction
          .acknowledge()
          .catch((err) => logger.error("command: cases: failed to ack an interaction", err));
        types = [];
        if (!interaction.data.values.includes("all")) {
          if (actionsMenu[0]) {
            for (let x = 0; x < actionsMenu[0].options.length; x++) {
              const option = actionsMenu[0].options[x];
              if (interaction.data.values.includes(option.value)) {
                option.default = true;
              } else {
                option.default = false;
              }
            }
          }
          for (const opt of interaction.data.values) {
            switch (opt) {
              case "mute": {
                types.push(PunishmentTypes.MUTE, PunishmentTypes.UNMUTE);
                break;
              }
              case "ban": {
                types.push(PunishmentTypes.BAN, PunishmentTypes.UNBAN);
                break;
              }
              case "kick": {
                types.push(PunishmentTypes.KICK);
                break;
              }
              case "warn": {
                types.push(PunishmentTypes.WARN);
                break;
              }
              case "timeout": {
                types.push(PunishmentTypes.TIMEOUT);
                break;
              }
            }
          }
          oldPage = page;
          page = 1;
          skip = 0;
          pageButtons[0].disabled = true;
        } else {
          page = oldPage;
          skip = page > 1 ? (page - 1) * perPage : 0;
          if (page === 1) pageButtons[0].disabled = true;
          else pageButtons[0].disabled = false;

          for (let x = 0; x < actionsMenu[0].options.length; x++) {
            const option = actionsMenu[0].options[x];
            if (option.value !== "all") option.default = false;
          }
        }

        let data;
        try {
          data = await this.listCases(9, guild.id, skip, types, userID, moderatorID, after, before);
        } catch (err) {
          logger.error("command: cases: failed to list cases", data);
        }
        if (!data) {
          return interaction
            .createFollowup(
              this.errorMessage(
                interaction.channel as GuildTextableChannel,
                "Something went wrong..."
              )
            )
            .catch((err) => {
              logger.error("command: cases: failed to respond to an interaction", err);
            });
        }
        if (data.length === perPage) {
          pageButtons[1].disabled = false;
        } else {
          pageButtons[1].disabled = true;
        }

        return interaction
          .editParent({
            embeds: [await this.casesEmbed(data)],
            components: [
              {
                type: Constants.ComponentTypes.ACTION_ROW,
                components: actionsMenu,
              },
              {
                type: Constants.ComponentTypes.ACTION_ROW,
                components: pageButtons,
              },
            ],
          })
          .catch((err) => {
            logger.error("command: cases: failed to respond to an interaction", err);
          });
      });

      menuListener.on("stop", () => {
        actionsMenu[0].disabled = true;
        msg
          .edit({
            components: [
              {
                type: Constants.ComponentTypes.ACTION_ROW,
                components: actionsMenu,
              },
              {
                type: Constants.ComponentTypes.ACTION_ROW,
                components: pageButtons,
              },
            ],
          })
          .catch((err) => logger.error("command: cases: failed to edit message", err));
      });

      buttonListener.on("stop", () => {
        for (let x = 0; x < pageButtons.length; x++) {
          pageButtons[x].disabled = true;
        }
        msg
          .edit({
            components: [
              {
                type: Constants.ComponentTypes.ACTION_ROW,
                components: actionsMenu,
              },
              {
                type: Constants.ComponentTypes.ACTION_ROW,
                components: pageButtons,
              },
            ],
          })
          .catch((err) => logger.error("command: cases: failed to edit message", err));
      });
    } else if (subCommand.name === "view" && subCommand.options) {
      if (!interaction.member.permissions.has("manageMessages")) {
        return interaction.createFollowup(
          this.errorMessage(interaction.channel, "You don't have permissions in this guild.")
        );
      }
      const caseID = subCommand.options[0];
      if (!caseID || caseID.type !== OptionType.INTEGER) {
        return;
      }
      let caseData;
      try {
        caseData = await collections.cases.findOne({
          id: caseID.value,
          guild_id: interaction.guildID,
        });
      } catch (err) {
        logger.error("Failed to find case", err);
        return interaction.createFollowup(
          this.errorMessage(interaction.channel, "Something went wrong... Please try again later.")
        );
      }

      if (!caseData) {
        return interaction.createFollowup(
          this.errorMessage(interaction.channel, `Case with id: \`${caseID}\` doesn't exist.`)
        );
      }

      const target = (await this.moderation.getUser(caseData.user.id)) ?? caseData.user;
      const moderator =
        (await this.moderation.getUser(caseData.moderator.id)) ?? caseData.moderator;
      let desc = "";
      desc += `**Moderator:** ${getTag(moderator)} (${moderator.id})\n`;
      desc += `**Duration:** ${
        Number.isInteger(caseData.duration) && caseData.duration > 0
          ? prettyMilliseconds(caseData.duration)
          : "None"
      }\n`;
      desc += `**Reason:** ${caseData.reason || "No reason specified."}`;

      const targetAvatar =
        "avatar_url" in target ? target.avatar_url : target.dynamicAvatarURL(undefined, 256);
      const builder = new EmbedBuilder()
        .author(getTag(target), targetAvatar)
        .field(`${FormatPunishments[caseData.type]} - Case #${caseData.id}`, desc)
        .color(PunishmentColors[caseData.type])
        .timestamp(caseData.created_at);
      return interaction.createFollowup({
        embeds: [builder.build()],
      });
    } else if (subCommand.name === "delete-warn" && subCommand.options) {
      if (!interaction.member.permissions.has("manageMessages")) {
        return interaction.createFollowup(
          this.errorMessage(interaction.channel, "You don't have permissions in this guild.")
        );
      }
      const caseID = subCommand.options[0];
      if (!caseID || caseID.type !== OptionType.INTEGER) {
        return;
      }

      let res;
      try {
        res = await collections.cases.deleteOne({
          id: caseID.value,
          guild_id: interaction.guildID,
          type: PunishmentTypes.WARN,
        });
      } catch (err) {
        logger.error("Failed to find case", err);
        return interaction.createFollowup(
          this.errorMessage(interaction.channel, "Something went wrong... Please try again later.")
        );
      }

      if (res.deletedCount === 0) {
        return interaction.createFollowup(
          this.errorMessage(
            interaction.channel,
            `That case is not a warn case. Or it doesn't exist?`
          )
        );
      }
      return interaction.createFollowup(
        this.successMessage(interaction.channel, `Deleted warn case: \`#${caseID.value}\``)
      );
    } else if (subCommand.name === "clear-cases" && subCommand.options) {
      if (!interaction.member.permissions.has("manageMessages")) {
        return interaction.createFollowup(
          this.errorMessage(interaction.channel, "You don't have permissions in this guild.")
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const userID = subCommand.options.find((x) => x.name === "user")!.value as string;
      try {
        const res = await collections.cases.deleteMany({
          guild_id: interaction.guildID,
          "user.id": userID,
        });
        return interaction.createFollowup(
          this.successMessage(interaction.channel, `Deleted **${res.deletedCount}** cases.`)
        );
      } catch (err) {
        logger.error("Failed to delete cases", err);
        return interaction.createFollowup(
          this.errorMessage(interaction.channel, "Something went wrong... Please try again later.")
        );
      }
    }
  }
}
