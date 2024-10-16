import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { ComponentListener } from "../../utils/ComponentListener";
import Logger from "../../core/structs/Logger";
import { collections } from "../../core/database/DBClient";
import { CommandLog } from "../../core/database/models/CommandLog";

const CustomIDs = {
  NEXT_PAGE: "command_log_next_page",
  PREVIOUS_PAGE: "command_log_previous_page",
  DELETE_DATA: "command_log_delete_data",
};
class CLog extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "clog",
      description: ".",
      usage: "<server-id>",
      category: "admin",
      cooldown: 0,
      aliases: [],
      clientPerms: [],
      userPerms: [],
      admin: true,
    });
  }
  fetchData(serverID: string, limit: number, skip: number) {
    return collections.command_logs.find({ guildID: serverID }).limit(limit).skip(skip).toArray();
  }
  prettify(logs: CommandLog[]) {
    let str = "";
    for (let i = 0; i < logs.length; i++) {
      const cl = logs[i];
      str += `**Command:** \`${cl.command}\`, **is slash:** ${cl.slashCommand}, **user id:** ${cl.userID}, exec error: ${cl.executionError}\n`;
    }
    return str;
  }
  calculatePage(page: number, perPage = 15) {
    const skip = page > 1 ? (page - 1) * perPage : 0;
    return [perPage, skip];
  }

  async execute({ message, args }: ExecuteArgs) {
    if (!args[0]) {
      return this.errorMessage(message, "Specify a server id.");
    }

    let page = 1;
    const [limit, skip] = this.calculatePage(page);
    const logs = await this.fetchData(args[0], limit, skip);
    if (logs.length === 0) {
      return this.errorMessage(message, "No entries.");
    }
    const msg = await this.client.createMessage(message.channel.id, {
      content: this.prettify(logs),
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 2,
              custom_id: CustomIDs.PREVIOUS_PAGE,
              label: "Previous page",
            },
            {
              type: 2,
              style: 2,
              custom_id: CustomIDs.NEXT_PAGE,
              label: "Next page",
            },
            {
              type: 2,
              style: 4,
              custom_id: CustomIDs.DELETE_DATA,
              label: "Delete all logs",
            },
          ],
        },
      ],
    });
    const listener = new ComponentListener(this.client, msg, {
      expireAfter: 20_000,
      repeatTimeout: true,
      componentTypes: [2],
    });

    listener.on("interactionCreate", (interaction) => {
      const custom_id = interaction.data.custom_id;
      if (custom_id === CustomIDs.PREVIOUS_PAGE) {
        if (page <= 1) {
          return interaction
            .acknowledge()
            .catch((err) => Logger.warn(`command: clog: failed to ack an interaction`, err));
        }
        const [newLimit, newSkip] = this.calculatePage(--page);
        this.fetchData(args[0], newLimit, newSkip)
          .then((logs) => {
            if (!logs.length) {
              return interaction.createMessage({
                content: "No more log data.",
                flags: 64,
              });
            }
            const pretty_logs = this.prettify(logs);
            return interaction.editParent({ content: pretty_logs });
          })
          .catch((err) => {
            Logger.error(`command: clog: error fetching command logs in guild:`, args[0], err);
            return interaction.createMessage({
              content: "Error fetching logs",
              flags: 64,
            });
          })
          .catch((err) => Logger.warn(`command: clog: failed to respond to an interaction`, err));
        // console.log("Go back, i want to be monke");
      } else if (custom_id === CustomIDs.NEXT_PAGE) {
        // console.log("Envolve!!");
        const [newLimit, newSkip] = this.calculatePage(++page);
        this.fetchData(args[0], newLimit, newSkip)
          .then((logs) => {
            if (!logs.length) {
              return interaction.createMessage({
                content: "No more log data.",
                flags: 64,
              });
            }
            const pretty_logs = this.prettify(logs);
            return interaction.editParent({ content: pretty_logs });
          })
          .catch((err) => {
            Logger.error(`command: clog: error fetching command logs in guild:`, args[0], err);
            return interaction.createMessage({
              content: "Error fetching logs",
              flags: 64,
            });
          })
          .catch((err) => Logger.warn(`command: clog:  failed to respond to an interaction`, err));
      } else if (custom_id === CustomIDs.DELETE_DATA) {
        collections.command_logs
          .deleteMany({ guildID: args[0] })
          .then((result) => {
            return interaction.createMessage({
              content: `Deleted ${result.deletedCount} command logs`,
            });
          })
          .catch((err) => {
            Logger.error(`command: clog: error deleting command logs in guild:`, args[0], err);
            return interaction.createMessage({
              content: "Error deleting logs",
              flags: 64,
            });
          })
          .catch((err) => Logger.warn(`command: clog: failed to respond to an interaction`, err));
      }
    });
    listener.on("stop", (reason) => {
      if (reason === "timeout") {
        this.client
          .editMessage(message.channel.id, msg.id, {
            content: "Timed out",
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 2,
                    custom_id: CustomIDs.PREVIOUS_PAGE,
                    label: "Previous page",
                    disabled: true,
                  },
                  {
                    type: 2,
                    style: 2,
                    custom_id: CustomIDs.NEXT_PAGE,
                    label: "Next page",
                    disabled: true,
                  },
                  {
                    type: 2,
                    style: 4,
                    custom_id: CustomIDs.DELETE_DATA,
                    label: "Delete all logs",
                    disabled: true,
                  },
                ],
              },
            ],
          })
          .catch((err) =>
            Logger.warn(`command: clog: failed to disable components after timeout`, err)
          );
      }
    });
  }
}
export default CLog;
