import { ProtonClient } from "../core/client/ProtonClient";
import { CommandInteraction, GuildTextableChannel, Constants, Guild } from "eris";
import Command from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";
import { collections } from "../core/database/DBClient.js";
import { ComponentListener } from "../utils/ComponentListener.js";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

export default class Logs extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "logs";
  description = "Configure the events you want to log";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "subscribe",
      description: "Subscribe to certain events.",
      options: [
        {
          type: OptionType.CHANNEL,
          name: "channel",
          description: "The channel to send the logs to.",
          required: true,
          channel_types: [Constants.ChannelTypes.GUILD_TEXT],
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "unsubscribe",
      description: "Unsubscribe from certain events.",
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "subscriptions",
      description: "See the events this server is subscribed to.",
    },
  ];
  guildID = null;
  defaultMemberPermissions = Constants.Permissions.manageGuild.toString();
  dmPermission = false;

  addLogChannel(channelEventsMap: Map<string, string[]>, channelID: string, logName: string) {
    const ch = channelEventsMap.get(channelID);
    if (ch) {
      ch.push(logName);
    } else {
      channelEventsMap.set(channelID, [logName]);
    }
  }

  prettyPrintCeMap(channelEventsMap: Map<string, string[]>, guild: Guild): string {
    const unknownChannelsEvents = [];
    let output = "**Log events this server is subscribed to:**\n";
    for (const [channel_id, events] of channelEventsMap) {
      if (guild && guild.channels.has(channel_id)) {
        output += `<#${channel_id}> => ${events.join(", ")}\n`;
      } else {
        unknownChannelsEvents.push(...events);
      }
    }
    if (unknownChannelsEvents.length > 0) {
      output += `unknown channel => ${unknownChannelsEvents.join(", ")}`;
    }
    return output;
  }

  async handler(interaction: CommandInteraction<GuildTextableChannel>) {
    if (interaction.data.options === undefined) return;
    if (!interaction.guildID || !interaction.member) return;
    await interaction.acknowledge();

    const guild = await this.client.getGuild(interaction.guildID);
    if (!guild) return;

    const guildConfig = await this.client.getGuildConfig(interaction.guildID);
    if (!guildConfig) return;

    const subCommand = interaction.data.options[0];
    if (!subCommand || subCommand.type !== OptionType.SUB_COMMAND) return;

    if (subCommand.name === "subscribe") {
      const channelID = subCommand.options && subCommand.options[0];
      if (!channelID || channelID.type !== OptionType.CHANNEL) {
        return;
      }
      const channel =
        interaction.data.resolved &&
        interaction.data.resolved.channels &&
        interaction.data.resolved.channels.get(channelID.value);
      if (!channel || channel.type !== Constants.ChannelTypes.GUILD_TEXT) {
        return;
      }
      const followUp = await interaction.createFollowup({
        content: `Please select event type(s) to send in <#${channel.id}>.`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 3,
                custom_id: "menu_logs_select",
                options: [
                  {
                    label: "Moderation logs",
                    value: String(0),
                    description: "Log moderation actions by moderators",
                  },
                  {
                    label: "Message logs",
                    value: String(1),
                    description: "Log message edits, deletions, purges.",
                  },
                  {
                    label: "Gateway logs",
                    value: String(2),
                    description: "Log members that join and leave",
                  },
                  {
                    label: "Member logs",
                    value: String(3),
                    description: "Log member role changes and nickname changes",
                  },
                  {
                    label: "Server logs",
                    value: String(4),
                    description: "Log server changes",
                  },
                  {
                    label: "Role logs",
                    value: String(5),
                    description: "Log role changes",
                  },
                ],
                min_values: 1,
                max_values: 6,
                placeholder: "Select log type(s)",
              },
            ],
          },
        ],
      });
      const menu = new ComponentListener(this.client, followUp, {
        expireAfter: 40 * 1000,
        userID: interaction.member.id,
        repeatTimeout: false,
        componentTypes: [Constants.ComponentTypes.SELECT_MENU],
      });
      menu.on("interactionCreate", (inter) => {
        if (inter.data.component_type !== Constants.ComponentTypes.SELECT_MENU) return;

        const query: {
          "logs.gateway"?: string;
          "logs.message"?: string;
          "logs.roles"?: string;
          "logs.server"?: string;
          "logs.member"?: string;
          "moderation.log_channel"?: string;
        } = {};
        const logsAdded: string[] = [];
        for (const opt of inter.data.values) {
          switch (opt) {
            case "1": {
              query["logs.message"] = channel.id;
              logsAdded.push("Message Logs");
              break;
            }
            case "2": {
              query["logs.gateway"] = channel.id;
              logsAdded.push("Gateway Logs");
              break;
            }
            case "3": {
              query["logs.member"] = channel.id;
              logsAdded.push("Member Logs");
              break;
            }
            case "4": {
              query["logs.server"] = channel.id;
              logsAdded.push("Server Logs");
              break;
            }
            case "5": {
              query["logs.roles"] = channel.id;
              logsAdded.push("Role Logs");
              break;
            }
          }
        }
        if (inter.data.values.includes("0")) {
          query["moderation.log_channel"] = channel.id;
          logsAdded.push("Moderation Logs");
        }
        collections.guildconfigs
          .updateOne({ _id: interaction.guildID }, { $set: query })
          .then(() => {
            menu.stop("done");
            inter
              .editParent({
                content: this.successMessage(
                  interaction.channel,
                  `Subscribed to events: ${logsAdded.join(", ")}, they will be logged in: <#${
                    channel.id
                  }>.`
                ),
                components: [],
              })
              .catch((err) =>
                logger.error("command: logs: failed to respond to an interaction", err)
              );
          });
      });
      menu.on("stop", (reason) => {
        if (reason === "timeout") {
          interaction
            .editOriginalMessage({
              components: [],
              content: this.errorMessage(
                interaction.channel,
                "You took too long to choose. Please try again."
              ),
            })
            .catch((err) =>
              logger.error("command: logs: failed to respond to an interaction", err)
            );
        }
      });
    } else if (subCommand.name === "unsubscribe") {
      const menuOptions = [];

      if (guildConfig.logs) {
        if (guildConfig.logs.message) {
          menuOptions.push({
            label: "Message logs",
            value: "1",
            description: "Log message edits, deletions, purges.",
          });
        }
        if (guildConfig.logs.gateway) {
          menuOptions.push({
            label: "Gateway logs",
            value: "2",
            description: "Log members that join and leave",
          });
        }
        if (guildConfig.logs.member) {
          menuOptions.push({
            label: "Member logs",
            value: "3",
            description: "Log member role changes and nickname changes",
          });
        }
        if (guildConfig.logs.server) {
          menuOptions.push({
            label: "Server logs",
            value: "4",
            description: "Log server changes",
          });
        }
        if (guildConfig.logs.role) {
          menuOptions.push({
            label: "Role logs",
            value: "5",
            description: "Log role changes",
          });
        }
      }
      if (guildConfig.moderation && guildConfig.moderation.log_channel) {
        menuOptions.push({
          label: "Moderation logs",
          value: "0",
          description: "Log moderation actions by moderators",
        });
      }

      if (menuOptions.length === 0) {
        return interaction.createFollowup(
          this.errorMessage(
            interaction.channel,
            "This server isn't subscribed to any events to log."
          )
        );
      }

      const followUp = await interaction.createFollowup({
        content: `Please select event(s) to unsubscribe from.`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 3,
                custom_id: "menu_logs_select",
                options: menuOptions,
                min_values: 1,
                max_values: menuOptions.length,
                placeholder: "Select log type(s)",
              },
            ],
          },
        ],
      });
      const menu = new ComponentListener(this.client, followUp, {
        expireAfter: 30_000,
        userID: interaction.member.id,
        repeatTimeout: false,
        componentTypes: [3],
      });
      menu.on("interactionCreate", (inter) => {
        if (inter.data.component_type !== Constants.ComponentTypes.SELECT_MENU) return;

        const query: {
          "logs.gateway"?: "";
          "logs.message"?: "";
          "logs.roles"?: "";
          "logs.server"?: "";
          "logs.member"?: "";
          "moderation.log_channel"?: "";
        } = {};
        const logsRemoved: string[] = [];
        for (const opt of inter.data.values) {
          switch (opt) {
            case "1": {
              query["logs.message"] = "";
              logsRemoved.push("Message Logs");
              break;
            }
            case "2": {
              query["logs.gateway"] = "";
              logsRemoved.push("Gateway Logs");
              break;
            }
            case "3": {
              query["logs.member"] = "";
              logsRemoved.push("Member Logs");
              break;
            }
            case "4": {
              query["logs.server"] = "";
              logsRemoved.push("Server Logs");
              break;
            }
            case "5": {
              query["logs.roles"] = "";
              logsRemoved.push("Role Logs");
              break;
            }
          }
        }
        if (inter.data.values.includes("0")) {
          query["moderation.log_channel"] = "";
          logsRemoved.push("Moderation Logs");
        }
        collections.guildconfigs
          .updateOne({ _id: interaction.guildID }, { $unset: query })
          .then(() => {
            menu.stop("done");
            inter
              .editParent({
                content: this.successMessage(
                  interaction.channel,
                  `Unsubscribed from the following events: ${logsRemoved.join(", ")}.`
                ),
                components: [],
              })
              .catch((err) =>
                logger.error("command: logs: failed to respond to an interaction", err)
              );
          });
      });
      menu.on("stop", (reason) => {
        if (reason === "timeout") {
          interaction
            .editOriginalMessage({
              components: [],
              content: this.errorMessage(
                interaction.channel,
                "You took too long to choose. Please try again."
              ),
            })
            .catch((err) =>
              logger.error("command: logs: failed to respond to an interaction", err)
            );
        }
      });
    } else if (subCommand.name === "subscriptions") {
      if (!guildConfig.logs && !(guildConfig.moderation && guildConfig.moderation.log_channel)) {
        return interaction.createFollowup(
          this.errorMessage(
            interaction.channel,
            "This server isn't subscribed to any events to log."
          )
        );
      }
      const channelEventsMap = new Map();
      if (guildConfig.logs && guildConfig.logs.message) {
        this.addLogChannel(channelEventsMap, guildConfig.logs.message, "Message Edits/Deletions");
      }
      if (guildConfig.logs && guildConfig.logs.gateway) {
        this.addLogChannel(channelEventsMap, guildConfig.logs.gateway, "User Joins/Leaves");
      }
      if (guildConfig.logs && guildConfig.logs.member) {
        this.addLogChannel(channelEventsMap, guildConfig.logs.member, "Member Edits");
      }
      if (guildConfig.logs && guildConfig.logs.server) {
        this.addLogChannel(channelEventsMap, guildConfig.logs.server, "Server Edits");
      }
      if (guildConfig.logs && guildConfig.logs.role) {
        this.addLogChannel(channelEventsMap, guildConfig.logs.role, "Role Creations/Edits/Deletes");
      }
      if (guildConfig.moderation && guildConfig.moderation.log_channel) {
        this.addLogChannel(channelEventsMap, guildConfig.moderation.log_channel, "Moderations");
      }
      return interaction.createFollowup(this.prettyPrintCeMap(channelEventsMap, guild));
    }
  }
}
