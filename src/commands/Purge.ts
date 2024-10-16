import { ProtonClient } from "../core/client/ProtonClient";
import { CommandInteraction, GuildTextableChannel, Constants } from "eris";
import Command from "../core/structs/ClientCommand";
import { getTag } from "../utils/Util";
const { ApplicationCommandOptionTypes: OptionType } = Constants;

enum EntityTypes {
  ROLE,
  USER,
}

export default class Purge extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "purge";
  description = "Purge messages with optional filters";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.INTEGER,
      name: "amount",
      description: "The amount of messages to search and test.",
      required: true,
      min_value: 2,
      max_value: 500,
    },
    {
      type: OptionType.STRING,
      name: "includes",
      description: "Search for a specific text in the message content",
    },
    {
      type: OptionType.MENTIONABLE,
      name: "entity",
      description: "A role or a user to purge messages of.",
    },
    {
      type: OptionType.BOOLEAN,
      name: "bots",
      description: "Whether to purge messages by bots only.",
    },
    {
      type: OptionType.BOOLEAN,
      name: "humans",
      description: "Whether to purge messages by normal non-bot users only.",
    },
    {
      type: OptionType.BOOLEAN,
      name: "pins",
      description: "Whether to purge pinned messages.",
    },
  ];
  guildID = null;
  defaultMemberPermissions = Constants.Permissions.manageMessages.toString();
  dmPermission = false;

  async handler(interaction: CommandInteraction<GuildTextableChannel>) {
    if (interaction.data.options === undefined) return;
    if (!interaction.guildID || !interaction.member) return;
    await interaction.acknowledge();

    const guild = await this.client.getGuild(interaction.guildID);
    if (!guild) return;

    const guildConfig = await this.client.getGuildConfig(interaction.guildID);
    if (!guildConfig) return;

    let textCheck: string | undefined,
      entity: string | undefined,
      onlyBots = false,
      onlyHumans = false,
      pins = false,
      amount = -1,
      entityType: EntityTypes | undefined;
    if (interaction.data.options) {
      for (const option of interaction.data.options) {
        if (option.name === "includes" && option.type === OptionType.STRING) {
          textCheck = option.value;
        } else if (option.name === "entity" && option.type === OptionType.MENTIONABLE) {
          entity = option.value;
        } else if (option.name === "bots" && option.type === OptionType.BOOLEAN) {
          onlyBots = option.value;
        } else if (option.name === "humans" && option.type === OptionType.BOOLEAN) {
          onlyHumans = option.value;
        } else if (option.name === "pins" && option.type === OptionType.BOOLEAN) {
          pins = option.value;
        } else if (option.name === "amount" && option.type === OptionType.INTEGER) {
          amount = option.value;
        }
      }
    }

    if (this.client.purgeTasks.has(interaction.channel.id)) {
      return interaction.createFollowup(
        "A purge task is already on-going, please wait for it complete."
      );
    }
    if (!interaction.channel.permissionsOf(interaction.member).has("manageMessages")) {
      return interaction.createFollowup(
        `You don't have **Manage Messages** permissions in: ${interaction.channel.mention}`
      );
    }
    const selfMember = await this.client.getSelfMember(guild);
    if (!selfMember) return;

    if (!interaction.channel.permissionsOf(selfMember).has("manageMessages")) {
      return interaction.createFollowup(
        `I don't have **Manage Messages** permission in ${interaction.channel.mention}.`
      );
    }

    if (entity && interaction.data.resolved) {
      if (interaction.data.resolved.roles && interaction.data.resolved.roles.has(entity)) {
        entityType = EntityTypes.ROLE;
      } else if (interaction.data.resolved.users && interaction.data.resolved.users.has(entity)) {
        entityType = EntityTypes.USER;
      }
    }

    const msg = await interaction.getOriginalMessage();

    this.client.purgeTasks.set(interaction.channel.id, undefined);
    const usersAffected = new Map();
    return this.client
      .purgeChannel(interaction.channel.id, {
        limit: amount,
        filter: (message) => {
          if (message.id === msg.id) {
            return false;
          }
          if (onlyBots && !message.author.bot) {
            return false;
          }
          if (onlyHumans && message.author.bot) {
            return false;
          }
          if (!pins && message.pinned) {
            return false;
          }
          if (textCheck && !message.content.includes(textCheck)) {
            return false;
          }
          if (entity) {
            if (entityType === EntityTypes.USER && message.author.id !== entity) {
              return false;
            } else if (entityType === EntityTypes.ROLE && message.member.roles.includes(entity)) {
              return false;
            }
          }

          const userData = usersAffected.get(message.author.id);
          if (userData !== undefined) {
            usersAffected.set(message.author.id, {
              tag: getTag(message.author),
              msgCount: userData.msgCount + 1,
            });
          } else {
            usersAffected.set(message.author.id, {
              tag: getTag(message.author),
              msgCount: 1,
            });
          }
          return true;
        },
      })
      .then((count) => {
        this.client.purgeTasks.delete(interaction.channel.id);
        let content = `**Total messages purged:** ${count}\n\n`;
        const mapToArr = [...usersAffected.values()];
        for (let i = 0; i < mapToArr.length; i++) {
          content += `**${mapToArr[i].tag}:** ${mapToArr[i].msgCount}\n`;
        }
        return interaction.editOriginalMessage(content);
      });
  }
}
