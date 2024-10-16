import {
  ActionRow,
  CommandInteraction,
  Constants,
  Guild,
  GuildTextableChannel,
  InteractionButton,
  InteractionDataOptionsSubCommand,
  InteractionDataOptionsWithValue,
  Role,
} from "eris";
import { ProtonClient } from "../core/client/ProtonClient";
import { genComponentRoleID, highestRole, stringifyEmoji } from "../utils/Util";
import Command from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";
import { collections } from "../core/database/DBClient";
import { ButtonRolesDataFlags } from "../core/database/models/ComponentRoles";

const uEmojiRegex = /[\p{Emoji}\u200d]+/gu;
const cEmojiRegex = /^<(a)?:(.+?):(\d{16,18})>$/;
const snowflakeRegex = /[0-9]{16,19}/;

const channelTypes = [
  Constants.ChannelTypes.GUILD_TEXT,
  Constants.ChannelTypes.GUILD_NEWS,
  Constants.ChannelTypes.GUILD_NEWS_THREAD,
  Constants.ChannelTypes.GUILD_PUBLIC_THREAD,
  Constants.ChannelTypes.GUILD_PRIVATE_THREAD,
];

const { ApplicationCommandOptionTypes: OptionType } = Constants;

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

type SubCommandInter = WithRequired<CommandInteraction<GuildTextableChannel>, "member">;

export default class ButtonRoles extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "button-roles";
  description = "Create button roles!";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "add",
      description: "Add a button to a message and assign a role to it.",
      options: [
        {
          type: OptionType.CHANNEL,
          name: "channel",
          description: "Channel where the message is located.",
          required: true,
          channel_types: channelTypes,
        },
        {
          type: OptionType.STRING,
          name: "message-id",
          description: "ID of message to add a button to.",
          required: true,
        },
        {
          type: OptionType.ROLE,
          name: "role",
          description: "What role should be assigned when clicking the button?",
          required: true,
        },
        {
          type: OptionType.STRING,
          name: "color",
          description: "Select the color of the button.",
          choices: [
            {
              name: "blue",
              value: "blue",
            },
            {
              name: "green",
              value: "green",
            },
            {
              name: "gray",
              value: "gray",
            },
            {
              name: "red",
              value: "red",
            },
          ],
        },
        {
          type: OptionType.STRING,
          name: "label",
          description: "Button's label (the text thats displayed on it)",
        },
        {
          type: OptionType.STRING,
          name: "emoji",
          description:
            "Either a default emoji or a custom one like `emoji_name:emoji_id`. You can use any custom emoji.",
        },
        {
          type: OptionType.ROLE,
          name: "role-2",
          description: "Second role",
          required: false,
        },
        {
          type: OptionType.ROLE,
          name: "role-3",
          description: "Third role",
          required: false,
        },
        {
          type: OptionType.ROLE,
          name: "role-4",
          description: "Fourth role",
          required: false,
        },
        {
          type: OptionType.ROLE,
          name: "role-5",
          description: "Fifth role",
          required: false,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "update-emoji",
      description: "Add/remove an emoji from a button.",
      options: [
        {
          type: OptionType.CHANNEL,
          name: "channel",
          description: "Channel where the message is located.",
          required: true,
          channel_types: channelTypes,
        },
        {
          type: OptionType.STRING,
          name: "message-id",
          description: "ID of message to add a button to.",
          required: true,
        },
        {
          type: OptionType.INTEGER,
          name: "button-index",
          description: "Whats the emoji's postition in integer?",
          required: true,
          min_value: 1,
          max_value: 25,
        },
        {
          type: OptionType.STRING,
          name: "emoji",
          description:
            "Either a default emoji or a custom one like `emoji_name:emoji_id`. You can use any custom emoji.",
          required: false,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "remove",
      description: "Remove a button from a message.",
      options: [
        {
          type: OptionType.CHANNEL,
          name: "channel",
          description: "Channel where the message is located.",
          required: true,
          channel_types: channelTypes,
        },
        {
          type: OptionType.STRING,
          name: "message-id",
          description: "ID of message to add a button to.",
          required: true,
        },
        {
          type: OptionType.INTEGER,
          name: "button-index",
          description: "Whats the emoji's postition in integer?",
          required: true,
          min_value: 1,
          max_value: 25,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "update",
      description: "Update a button at a specific index.",
      options: [
        {
          type: OptionType.CHANNEL,
          name: "channel",
          description: "Channel where the message is located.",
          required: true,
          channel_types: channelTypes,
        },
        {
          type: OptionType.STRING,
          name: "message-id",
          description: "ID of message to add a button to.",
          required: true,
        },
        {
          type: OptionType.INTEGER,
          name: "button-index",
          description: "Whats the emoji's postition in integer?",
          required: true,
          min_value: 1,
          max_value: 25,
        },
        {
          type: OptionType.ROLE,
          name: "role",
          description: "What role should be assigned when clicking the button?",
          required: true,
        },
        {
          type: OptionType.STRING,
          name: "color",
          description: "Select the color of the button.",
          choices: [
            {
              name: "blue",
              value: "blue",
            },
            {
              name: "green",
              value: "green",
            },
            {
              name: "gray",
              value: "gray",
            },
            {
              name: "red",
              value: "red",
            },
          ],
        },
        {
          type: OptionType.STRING,
          name: "label",
          description: "Button's label (the text thats displayed on it)",
        },
        {
          type: OptionType.ROLE,
          name: "role-2",
          description: "Second role",
          required: false,
        },
        {
          type: OptionType.ROLE,
          name: "role-3",
          description: "Third role",
          required: false,
        },
        {
          type: OptionType.ROLE,
          name: "role-4",
          description: "Fourth role",
          required: false,
        },
        {
          type: OptionType.ROLE,
          name: "role-5",
          description: "Fifth role",
          required: false,
        },
      ],
    },
    /*{
         type: OptionType.SUB_COMMAND,
         name: "mode",
         description: "Set a mode for a message, either normal or reverse",
         options: [
            {
               type: OptionType.CHANNEL,
               name: "channel",
               description: "Channel where the message is located.",
               required: true,
               channel_types: channelTypes,
            },
            {
               type: OptionType.STRING,
               name: "message-id",
               description: "ID of message to add a button to.",
               required: true,
            },
            {
               type: OptionType.STRING,
               name: "type",
               description:
                  "The mode for the button roles, reverse for reverse behaviour of normal.",
               choices: [
                  {
                     name: "Normal",
                     value: "1",
                  },
                  { name: "Reverse", value: "2" },
               ],
               required: true,
            },
         ],
      },*/
  ];
  guildID = null;
  defaultMemberPermissions = Constants.Permissions.manageRoles.toString();
  dmPermission = false;

  async handler(interaction: CommandInteraction<GuildTextableChannel>) {
    if (interaction.data.options === undefined) {
      return;
    }
    if (!interaction.guildID || !interaction.member) {
      return;
    }

    const guild = await this.client.getGuild(interaction.guildID);
    if (!guild) return;

    const subCommand = interaction.data.options[0];
    if (!subCommand || subCommand.type !== OptionType.SUB_COMMAND) {
      return;
    }
    if (subCommand.name === "add") {
      this.handleAdd(interaction as SubCommandInter, subCommand, guild);
    } else if (subCommand.name === "update-emoji") {
      this.handleUpdateEmoji(interaction as SubCommandInter, subCommand);
    } else if (subCommand.name === "update") {
      this.handleUpdate(interaction as SubCommandInter, subCommand, guild);
    } else if (subCommand.name === "remove") {
      this.handleRemove(interaction as SubCommandInter, subCommand);
    } /* else if (subCommand.name === "mode") {
         this.handleMode(interaction as SubCommandInter, subCommand);
      }*/
  }

  async getMessage(messageID: string, channelID: string) {
    if (!snowflakeRegex.test(messageID)) {
      throw new Error(
        `Couldn't find message with id: ${messageID} in channel: <#${channelID}>.\nPerhaps I can't read messages there?`
      );
    }
    let msg;
    try {
      msg = await this.client.getMessage(channelID, messageID);
    } catch (e) {
      logger.error("command: button-roles: failed to fetch message", e);
    }
    if (!msg) {
      throw new Error(
        `Couldn't find message with id: ${messageID} in channel: <#${channelID}>.\nPerhaps I can't read messages there?`
      );
    }
    return msg;
  }

  rolesPack(interaction: SubCommandInter, options: InteractionDataOptionsWithValue[]): Role[] {
    const roles: Role[] = [];
    const roleIDs: string[] = [];
    if (!interaction.data.resolved || !interaction.data.resolved.roles) return roles;
    for (const option of options) {
      if (option.name.startsWith("role") && option.type === OptionType.ROLE) {
        const resolved = interaction.data.resolved.roles.get(option.value);
        if (resolved && !resolved.managed && !roleIDs.includes(resolved.id)) {
          roles.push(resolved);
          roleIDs.push(resolved.id);
        }
      }
    }
    return roles;
  }

  async handleAdd(
    interaction: SubCommandInter,
    option: InteractionDataOptionsSubCommand,
    guild: Guild
  ) {
    await interaction
      .acknowledge()
      .catch((err) => logger.error("command: button-roles: failed to ack an interaction", err));
    let messageID = "",
      channelID = "",
      color = "blue",
      label = "No label",
      emoji = "";
    if (option.options) {
      for (const opt of option.options) {
        if (opt.name === "message-id" && opt.type === OptionType.STRING) {
          messageID = opt.value.trimStart().trimEnd();
        } else if (opt.name === "channel" && opt.type === OptionType.CHANNEL) {
          channelID = opt.value;
        } else if (opt.name === "color" && opt.type === OptionType.STRING) {
          color = opt.value;
        } else if (opt.name === "label" && opt.type === OptionType.STRING) {
          label = opt.value;
        } else if (opt.name === "emoji" && opt.type === OptionType.STRING) {
          emoji = opt.value;
        }
      }
    }
    const memberHighestRole = highestRole(interaction.member, guild);
    const roles = this.rolesPack(interaction, option.options as InteractionDataOptionsWithValue[]);

    if (roles.length > 1) {
      const guildConfig = await this.client.getGuildConfig(interaction.guildID as string);
      if (!guildConfig) {
        return;
      }
      if (!guildConfig.isPremium) {
        return interaction
          .createFollowup(
            this.errorMessage(
              interaction.channel,
              "You can only specify more roles if you're premium. Get premium @ https://proton-bot.net/premium"
            )
          )
          .catch((err) =>
            logger.error("command: button-roles: failed to respond to an interaction", err)
          );
      }
    }

    for (const role of roles) {
      if (guild.ownerID !== interaction.member.id && role.position > memberHighestRole.position) {
        return interaction
          .createFollowup(
            this.errorMessage(
              interaction.channel,
              `You cannot assign the role: \`@${role.name}\` because it's about your **highest role**. You will have to ask a user that has a role with a higher position than ${role.name}'s position'`
            )
          )
          .catch((err) =>
            logger.error("command: button-roles: failed to respond to an interaction", err)
          );
      }
    }

    let msg;
    try {
      msg = await this.getMessage(messageID, channelID);
    } catch (err) {
      return interaction.createFollowup(
        this.errorMessage(interaction.channel, (err as Error).message)
      );
    }
    if (!msg) return;

    if (msg.author.id !== this.client.user.id) {
      return interaction
        .createFollowup(
          this.errorMessage(
            interaction.channel,
            `I'm not the author of that message. This is a discord limitation, I can only add buttons to my messages.`
          )
        )
        .catch((err) =>
          logger.error("command: button-roles: failed to respond to an interaction", err)
        );
    }

    const actualColor = this.getColorType(color);
    if (!actualColor) {
      return interaction
        .createFollowup(
          this.errorMessage(interaction.channel, `I couldn't understand the color type selected`)
        )
        .catch((err) =>
          logger.error("command: button-roles: failed to respond to an interaction", err)
        );
    }

    const parsedEmoji = this.parseEmoji(emoji);
    const actionRows =
      msg.components && msg.components.length > 0
        ? msg.components
        : [{ type: Constants.ComponentTypes.ACTION_ROW, components: [] }];
    if (parsedEmoji && label === "No label") label = "";

    const rowComponents = actionRows[actionRows.length - 1].components;
    const componentID = genComponentRoleID();
    if (rowComponents.length === 5) {
      actionRows.push({
        type: Constants.ComponentTypes.ACTION_ROW,
        components: [
          {
            type: Constants.ComponentTypes.BUTTON,
            style: actualColor,
            label: label,
            custom_id: componentID,
            emoji: parsedEmoji ? parsedEmoji : undefined,
          },
        ],
      });
    } else {
      rowComponents.push({
        type: Constants.ComponentTypes.BUTTON,
        style: actualColor,
        label: label,
        custom_id: componentID,
        emoji: parsedEmoji ? parsedEmoji : undefined,
      });
    }

    if (actionRows.length >= 6) {
      return interaction
        .createFollowup(
          this.errorMessage(
            interaction.channel,
            `You can't add more than 25 buttons to a specific message.`
          )
        )
        .catch((err) =>
          logger.error("command: button-roles: failed to respond to an interaction", err)
        );
    }

    try {
      await collections.component_roles.updateOne(
        { channel_id: channelID, message_id: msg.id },
        {
          $push: {
            components: {
              component_id: componentID,
              component_type: Constants.ComponentTypes.BUTTON,
              flags: ButtonRolesDataFlags.NORMAL,
              role_ids: roles.map((x) => x.id),
            },
          },
          $setOnInsert: {
            guild_id: interaction.guildID,
          },
        },
        { upsert: true }
      );
    } catch (err) {
      logger.error("command: button-roles: failed to save component roles data", err);
      return interaction
        .createFollowup(this.errorMessage(interaction.channel, "Something went wrong...!"))
        .catch((err) =>
          logger.error("command: button-roles: failed to respond to an interaction:", err)
        );
    }

    try {
      await msg.edit({ content: msg.content, components: actionRows });
    } catch (err) {
      logger.error("command: button-roles: failed to edit message", err);
      return interaction
        .createFollowup(
          this.errorMessage(
            interaction.channel,
            `Something went wrong...! ${(err as Error).message ?? "Unknown error"}`
          )
        )
        .catch((err) =>
          logger.error("command: button-roles: failed to respond to an interaction", err)
        );
    }

    return interaction
      .createFollowup(
        this.successMessage(
          interaction.channel,
          `Added a new button to the [message](${
            msg.jumpLink
          }) with the color ${color} and bound the roles: ${roles
            .map((r) => r.name)
            .join(",")} to it.`
        )
      )
      .catch((err) =>
        logger.error("command: button-roles: failed to respond to an interaction", err)
      );
  }

  async handleUpdateEmoji(interaction: SubCommandInter, option: InteractionDataOptionsSubCommand) {
    await interaction
      .acknowledge()
      .catch((err) => logger.error("command: button-roles: failed to ack an interaction", err));
    let messageID = "",
      channelID = "",
      emIndex = -1,
      emoji = "";
    if (option.options) {
      for (const opt of option.options) {
        if (opt.name === "message-id" && opt.type === OptionType.STRING) {
          messageID = opt.value;
        } else if (opt.name === "channel" && opt.type === OptionType.CHANNEL) {
          channelID = opt.value;
        } else if (opt.name === "button-index" && opt.type === OptionType.INTEGER) {
          emIndex = opt.value;
        } else if (opt.name === "emoji" && opt.type === OptionType.STRING) {
          emoji = opt.value;
        }
      }
    }

    let msg;
    try {
      msg = await this.getMessage(messageID, channelID);
    } catch (err) {
      return interaction.createFollowup(
        this.errorMessage(interaction.channel, (err as Error).message)
      );
    }
    if (!msg) return;

    if (msg.author.id !== this.client.user.id) {
      return interaction
        .createFollowup(
          this.errorMessage(
            interaction.channel,
            `I'm not the author of that message. This is a discord limitation, I can only add buttons to my messages.`
          )
        )
        .catch((err) =>
          logger.error("command: button-roles: failed to respond to an interaction", err)
        );
    }
    const [rowIndex, btnIndex] = this.calculateBtnLoc(emIndex);

    let button;
    try {
      button = this.checkButton(rowIndex, btnIndex, msg.components);
    } catch (err) {
      return interaction
        .createFollowup(this.errorMessage(interaction.channel, (err as Error).message))
        .catch((err) =>
          logger.error("command: button-roles: failed to respond to an interaction", err)
        );
    }

    const newEmote = this.parseEmoji(emoji);
    if (newEmote !== null) {
      button.emoji = newEmote;
      if (button.label === "No label :(") {
        delete button.label;
      }
    } else {
      delete button.emoji;
    }

    try {
      await msg.edit({ content: msg.content, components: msg.components });
    } catch (err) {
      logger.error("command: button-roles: failed to edit message", err);
      return interaction
        .createFollowup(
          this.errorMessage(
            interaction.channel,
            `Something went wrong...! ${(err as Error).message ?? "Unknown error"}`
          )
        )
        .catch((err) =>
          logger.error("command: button-roles: failed to respond to an interaction", err)
        );
    }

    let start = "";
    if (newEmote !== null) {
      start = `Updated the emoji to ${stringifyEmoji(newEmote)}`;
    } else {
      start = "Removed the emoji";
    }

    return interaction
      .createFollowup(
        this.successMessage(
          interaction.channel,
          `${start} on button ${btnIndex + 1} in row ${rowIndex + 1} in [message](${msg.jumpLink}).`
        )
      )
      .catch((err) =>
        logger.error("command: button-roles: failed to respond to an interaction", err)
      );
  }

  async handleUpdate(
    interaction: SubCommandInter,
    option: InteractionDataOptionsSubCommand,
    guild: Guild
  ) {
    await interaction
      .acknowledge()
      .catch((err) => logger.error("command: button-roles: failed to ack an interaction", err));
    let channelID = "",
      messageID = "",
      buttonIndex = -1,
      color: string | undefined,
      label: string | undefined;

    if (option.options) {
      for (const opt of option.options) {
        if (opt.name === "channel" && opt.type === OptionType.CHANNEL) {
          channelID = opt.value;
        } else if (opt.name === "message-id" && opt.type === OptionType.STRING) {
          messageID = opt.value;
        } else if (opt.name === "button-index" && opt.type === OptionType.INTEGER) {
          buttonIndex = opt.value;
        } else if (opt.name === "color" && opt.type === OptionType.STRING) {
          color = opt.value;
        } else if (opt.name === "label" && opt.type === OptionType.STRING) {
          label = opt.value;
        }
      }
    }

    let msg;
    try {
      msg = await this.getMessage(messageID, channelID);
    } catch (err) {
      return interaction.createFollowup(
        this.errorMessage(interaction.channel, (err as Error).message)
      );
    }
    if (!msg) return;

    if (msg.author.id !== this.client.user.id) {
      return interaction
        .createFollowup(
          this.errorMessage(
            interaction.channel,
            `I'm not the author of that message. This is a discord limitation, I can only add buttons to my messages.`
          )
        )
        .catch((err) =>
          logger.error("command: button-roles: failed to respond to an interaction", err)
        );
    }

    const [rowIndex, btnIndex] = this.calculateBtnLoc(buttonIndex);
    let button;
    try {
      button = this.checkButton(rowIndex, btnIndex, msg.components);
    } catch (err) {
      return interaction
        .createFollowup(this.errorMessage(interaction.channel, (err as Error).message))
        .catch((err) =>
          logger.error("command: button-roles: failed to respond to an interaction", err)
        );
    }
    const changeLog = [];

    if (color !== undefined) {
      const resolvedColor = this.getColorType(color);
      button.style = resolvedColor;
      changeLog.push(`Updated button color to: ${color}`);
    }

    if (label !== undefined) {
      button.label = label;
      changeLog.push(`Updated label to: ${label}`);
    }

    const memberHighestRole = highestRole(interaction.member, guild);
    const roles = this.rolesPack(interaction, option.options as InteractionDataOptionsWithValue[]);
    for (const role of roles) {
      if (guild.ownerID !== interaction.member.id && role.position > memberHighestRole.position) {
        return interaction
          .createFollowup(
            this.errorMessage(
              interaction.channel,
              `You cannot assign the role: \`@${role.name}\` because it's about your **highest role**. You will have to ask a user that has a role with a higher position than ${role.name}'s position'`
            )
          )
          .catch((err) =>
            logger.error("command: button-roles: failed to respond to an interaction", err)
          );
      }
    }

    if (roles.length > 0) {
      if (roles.length > 1) {
        const guildConfig = await this.client.getGuildConfig(interaction.guildID as string);
        if (!guildConfig) {
          return;
        }
        if (!guildConfig.isPremium) {
          return interaction
            .createFollowup(
              this.errorMessage(
                interaction.channel,
                "You can only specify more roles if you're premium. Get premium @ https://proton-bot.net/premium"
              )
            )
            .catch((err) =>
              logger.error("command: button-roles: failed to respond to an interaction", err)
            );
        }
      }
      try {
        await collections.component_roles.updateOne(
          {
            channel_id: channelID,
            message_id: msg.id,
            "components.component_id": button.custom_id,
          },
          {
            $set: {
              "components.$.role_ids": roles.map((r) => r.id),
            },
          }
        );
      } catch (err) {
        logger.error("command: button-roles: failed to save component roles data", err);
        return interaction
          .createFollowup(this.errorMessage(interaction.channel, "Something went wrong...!"))
          .catch((err) =>
            logger.error("command: button-roles: failed to respond to an interaction:", err)
          );
      }
      changeLog.push(`Updated roles to: ${roles.map((r) => r.name).join(", ")}`);
    }

    try {
      await msg.edit({ content: msg.content, components: msg.components });
    } catch (err) {
      logger.error("command: button-roles: failed to edit message", err);
      return interaction
        .createFollowup(
          this.errorMessage(
            interaction.channel,
            `Something went wrong...! ${(err as Error).message ?? "Unknown error"}`
          )
        )
        .catch((err) =>
          logger.error("command: button-roles: failed to respond to an interaction", err)
        );
    }

    let changeLogStr = "nothing";
    if (changeLog.length > 0) {
      changeLogStr = changeLog.join(", ");
    }

    return interaction
      .createFollowup(
        this.successMessage(
          interaction.channel,
          `Updated a button on [message](${msg.jumpLink}), changes: ${changeLogStr}.`
        )
      )
      .catch((err) =>
        logger.error("command: button-roles: failed to respond to an interaction", err)
      );
  }

  async handleRemove(interaction: SubCommandInter, option: InteractionDataOptionsSubCommand) {
    await interaction
      .acknowledge()
      .catch((err) => logger.error("command: button-roles: failed to ack an interaction", err));
    let messageID = "",
      channelID = "",
      buttonIndex = -1;
    if (option.options) {
      for (const opt of option.options) {
        if (opt.name === "channel" && opt.type === OptionType.CHANNEL) {
          channelID = opt.value;
        } else if (opt.name === "message-id" && opt.type === OptionType.STRING) {
          messageID = opt.value;
        } else if (opt.name === "button-index" && opt.type === OptionType.INTEGER) {
          buttonIndex = opt.value;
        }
      }
    }

    let msg;
    try {
      msg = await this.getMessage(messageID, channelID);
    } catch (err) {
      return interaction.createFollowup(
        this.errorMessage(interaction.channel, (err as Error).message)
      );
    }
    if (!msg) return;

    if (msg.author.id !== this.client.user.id) {
      return interaction
        .createFollowup(
          this.errorMessage(
            interaction.channel,
            `I'm not the author of that message. This is a discord limitation, I can only add buttons to my messages.`
          )
        )
        .catch((err) =>
          logger.error("command: button-roles: failed to respond to an interaction", err)
        );
    }

    const [rowIndex, btnIndex] = this.calculateBtnLoc(buttonIndex);
    try {
      this.checkButton(rowIndex, btnIndex, msg.components);
    } catch (err) {
      return interaction
        .createFollowup(this.errorMessage(interaction.channel, (err as Error).message))
        .catch((err) =>
          logger.error("command: button-roles: failed to respond to an interaction", err)
        );
    }

    if (!msg.components) return;

    const button = msg.components[rowIndex].components[btnIndex] as InteractionButton;
    msg.components[rowIndex].components.splice(btnIndex, 1);
    msg.components = msg.components.filter((row) => row.components.length > 0);

    try {
      await collections.component_roles.updateOne(
        {
          channel_id: channelID,
          message_id: msg.id,
        },
        {
          $pull: {
            components: {
              component_id: button.custom_id,
            },
          },
        }
      );
    } catch (err) {
      logger.error("command: button-roles: failed to save component roles data", err);
      return interaction
        .createFollowup(this.errorMessage(interaction.channel, "Something went wrong...!"))
        .catch((err) =>
          logger.error("command: button-roles: failed to respond to an interaction:", err)
        );
    }

    try {
      await msg.edit({ content: msg.content, components: msg.components });
    } catch (err) {
      logger.error("command: button-roles: failed to edit message", err);
      return interaction
        .createFollowup(
          this.errorMessage(
            interaction.channel,
            `Something went wrong...! ${(err as Error).message ?? "Unknown error"}`
          )
        )
        .catch((err) =>
          logger.error("command: button-roles: failed to respond to an interaction", err)
        );
    }

    return interaction
      .createFollowup(
        this.successMessage(
          interaction.channel,
          `Removed button ${btnIndex + 1} on row ${rowIndex + 1} on [message](${msg.jumpLink}).`
        )
      )
      .catch((err) =>
        logger.error("command: button-roles: failed to respond to an interaction", err)
      );
  }

  checkButton(rowIndex: number, btnIndex: number, components: ActionRow[] = []) {
    const button = components && components[rowIndex] && components[rowIndex].components[btnIndex];
    if (!button) {
      throw new Error(`The button ${btnIndex + 1} on row ${rowIndex + 1} doesn't exist.`);
    }
    if (
      button.type !== Constants.ComponentTypes.BUTTON ||
      button.style === Constants.ButtonStyles.LINK
    ) {
      throw new Error(`The component ${btnIndex + 1} on row ${rowIndex + 1} is not a **button**.`);
    }
    return button;
  }

  calculateBtnLoc(buttonIndex: number) {
    let rowIndex = 0;
    let btnIndex = 0;

    if (buttonIndex > 20) {
      rowIndex = 4;
      btnIndex = buttonIndex - 20 - 1;
    } else if (buttonIndex > 15) {
      rowIndex = 3;
      btnIndex = buttonIndex - 15 - 1;
    } else if (buttonIndex > 10) {
      rowIndex = 2;
      btnIndex = buttonIndex - 10 - 1;
    } else if (buttonIndex > 5) {
      rowIndex = 1;
      btnIndex = buttonIndex - 5 - 1;
    } else {
      btnIndex = buttonIndex - 1;
    }
    return [rowIndex, btnIndex];
  }

  getColorType(color: string) {
    switch (color) {
      case "blue":
        return Constants.ButtonStyles.PRIMARY;
      case "green":
        return Constants.ButtonStyles.SUCCESS;
      case "red":
        return Constants.ButtonStyles.DANGER;
      case "gray":
        return Constants.ButtonStyles.SECONDARY;
    }
    return Constants.ButtonStyles.PRIMARY;
  }

  parseEmoji(emoji: string) {
    let newEmote = null;
    // parse emoji
    if (uEmojiRegex.test(emoji)) {
      newEmote = { name: emoji, id: null };
    }
    const match = cEmojiRegex.exec(emoji);
    if (match) {
      const animated = match[1] ? true : false;
      const name = match[2];
      const id = match[3];
      newEmote = { animated, name, id };
    }
    return newEmote;
  }
}
