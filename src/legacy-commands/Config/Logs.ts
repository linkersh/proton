import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { ComponentListener } from "../../utils/ComponentListener";
import { Constants } from "eris";
import { collections } from "../../core/database/DBClient";

class Logs extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "logs",
      description:
        "**Docs:** [here](https://docs.proton-bot.net/features/logging)\nSetup logging for your server, modlogs, message logs and join/leave logs.",
      usage: "<command>",
      aliases: ["logging"],
      category: "config",
      commands: [
        {
          name: "set",
          desc: "Configure the logging system",
          usage: "<#channel>",
        },
        {
          name: "disable",
          desc: "Disable log(s)",
          usage: "",
        },
      ],
      cooldown: 3000,
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  async set({ message, args }: ExecuteArgs) {
    const channel = this.parseChannel(args[0], message.channel.guild);
    if (!channel) {
      return this.errorMessage(message, `Please specify a valid channel to send logs to`);
    }
    const msg = await message.channel.createMessage({
      content: `Please select log type(s)`,
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
                  value: "0",
                  description: "Log moderation actions by moderators",
                },
                {
                  label: "Message logs",
                  value: "1",
                  description: "Log message edits, deletions, purges.",
                },
                {
                  label: "Gateway logs",
                  value: "2",
                  description: "Log members that join and leave",
                },
                {
                  label: "Member logs",
                  value: "3",
                  description: "Log member role changes and nickname changes",
                },
                {
                  label: "Server logs",
                  value: "4",
                  description: "Log server changes",
                },
                {
                  label: "Role logs",
                  value: "5",
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
    const menu = new ComponentListener(this.client, msg, {
      expireAfter: 60 * 1000,
      userID: message.author.id,
      repeatTimeout: false,
      componentTypes: [3],
    });
    menu.on("interactionCreate", (data) => {
      if (data.data.component_type !== Constants.ComponentTypes.SELECT_MENU) {
        return;
      }

      const query: { [key: string]: string } = {};
      const logsAdded: string[] = [];
      for (const opt of data.data.values) {
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
      if (data.data.values && data.data.values.includes("0")) {
        query["moderation.log_channel"] = channel.id;
        logsAdded.push("Moderation Logs");
      }
      collections.guildconfigs.updateOne({ _id: message.guildID }, { $set: query }).then(() => {
        menu.stop("done");
        data.editParent({
          content: `Set ${logsAdded.join(", ")} channel to: ${channel.mention}.`,
          components: [],
        });
      });
    });
    menu.on("stop", (reason) => {
      if (reason === "timeout") {
        msg.edit({
          components: [],
          content: "You took too long to choose. Please try again.",
        });
      }
    });
  }
  async disable({ message }: ExecuteArgs) {
    const msg = await message.channel.createMessage({
      content: `Please select log type(s) to disable`,
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
                  value: "0",
                  description: "Log moderation actions by moderators",
                },
                {
                  label: "Message logs",
                  value: "1",
                  description: "Log message edits, deletions, purges.",
                },
                {
                  label: "Gateway logs",
                  value: "2",
                  description: "Log members that join and leave",
                },
                {
                  label: "Member logs",
                  value: "3",
                  description: "Log member role changes and nickname changes",
                },
                {
                  label: "Server logs",
                  value: "4",
                  description: "Log server changes",
                },
                {
                  label: "Role logs",
                  value: "5",
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
    const menu = new ComponentListener(this.client, msg, {
      expireAfter: 60 * 1000,
      userID: message.author.id,
      repeatTimeout: false,
      componentTypes: [3],
    });
    menu.on("interactionCreate", (data) => {
      if (data.data.component_type !== Constants.ComponentTypes.SELECT_MENU) {
        return;
      }
      const query: {
        "logs.gateway"?: "";
        "logs.message"?: "";
        "logs.roles"?: "";
        "logs.server"?: "";
        "logs.member"?: "";
        "moderation.log_channel"?: "";
      } = {};
      const logsRemoved: string[] = [];
      for (const opt of data.data.values) {
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
      if (data.data.values.includes("0")) {
        query["moderation.log_channel"] = "";
        logsRemoved.push("Moderation Logs");
      }
      collections.guildconfigs.updateOne({ _id: message.guildID }, { $unset: query }).then(() => {
        menu.stop("done");
        data.editParent({
          content: `Disabled ${logsRemoved.join(", ")}.`,
          components: [],
        });
      });
    });
    menu.on("stop", (reason) => {
      if (reason === "timeout") {
        msg.edit({
          components: [],
          content: "You took too long to choose. Please try again.",
        });
      }
    });
  }
}
export default Logs;
