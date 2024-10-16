import { AutoRoleTypes } from "../../Constants";
import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";
import { Role } from "eris";
import logger from "../../core/structs/Logger";

class Autorole extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "autorole",
      description:
        "**Docs:** [here](https://docs.proton-bot.net/features/gateway-and-auto-roles#auto-roles)\nWhen a new user joins they can be assigned role(s). This command is used to configure the module.",
      usage: "",
      category: "config",
      commands: [
        {
          name: "add",
          desc: "Add an autorole.",
          usage: "<role>",
          cooldown: 3500,
        },
        {
          name: "remove",
          desc: "Remove an existing autorole",
          usage: "<role>",
          cooldown: 3000,
        },
        {
          name: "timeout",
          desc: "Grant a role after a specific timeout.",
          usage: "<time in minutes> <role>",
          cooldown: 3500,
        },
        {
          name: "list",
          desc: "List all the autoroles.",
          usage: "",
          cooldown: 3000,
        },
      ],
      aliases: [],
      cooldown: 3000,
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  async add({ message, args }: ExecuteArgs) {
    const role = this.parseRole(args.join(" "), message.channel.guild);
    if (!role) {
      return this.errorMessage(message, "Specify valid role.");
    }
    await collections.guildconfigs
      .updateOne(
        { _id: message.guildID },
        {
          $push: {
            autoroles: {
              type: AutoRoleTypes.NORMAL,
              timeout: 0,
              id: role.id,
            },
          },
        }
      )
      .then(() => {
        this.successMessage(message, `Added a new autorole.`);
      })
      .catch((err) => {
        logger.error("command: auto-role: failed to add auto role", err);
        this.errorMessage(message, `Failed to add an autorole.`);
      });
  }
  async remove({ message, args, config }: ExecuteArgs) {
    if (!config?.autoroles?.length) {
      return this.errorMessage(message, `There aren't any autoroles to remove.`);
    }
    const toRemoveIds = this.parseRoles(args.join(" "), message.channel.guild);
    if (!toRemoveIds.length) {
      const roles = config.autoroles
        .filter((r) => message.channel.guild.roles.has(r.id))
        .map((x) => {
          const role = message.channel.guild.roles.get(x.id) as Role;
          return {
            label: `@${role.name}`,
            description: `Remove autorole: ${role.name}`,
            value: role.id,
          };
        });
      return await message.channel.createMessage({
        content: "Select autorole(s) to remove.",
        components: [
          {
            type: 1,
            components: [
              {
                type: 3,
                custom_id: `autorole_rm-${message.author.id}`,
                placeholder: "Select a role",
                min_values: 1,
                max_values: roles.length,
                options: roles,
              },
            ],
          },
        ],
      });
    } else {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        {
          $pull: { autoroles: { id: { $in: toRemoveIds } } },
        }
      );
      this.successMessage(message, `Removed ${toRemoveIds.length} autoroles.`);
    }
  }
  async timeout({ message, args }: ExecuteArgs) {
    const timeout = parseInt(args[0]);
    if (timeout < 1) {
      return this.errorMessage(message, "Timeout must be above 1.");
    }
    if (timeout > 20160) {
      return this.errorMessage(message, "Timeout must be below 14 days.");
    }
    const role = this.parseRole(args.slice(1).join(" "), message.channel.guild);
    if (!role) {
      return this.errorMessage(message, "Specify a valid role.");
    }
    await collections.guildconfigs
      .updateOne(
        { _id: message.guildID },
        {
          $push: {
            autoroles: {
              type: AutoRoleTypes.TIMEOUT,
              timeout: timeout,
              id: role.id,
            },
          },
        }
      )
      .then(() => {
        this.successMessage(message, `Added a new autorole.`);
      })
      .catch((err) => {
        logger.error("command: auto-role: failed to add auto role", err);
        this.errorMessage(message, `Failed to add an autorole.`);
      });
  }
  list({ message, config }: ExecuteArgs) {
    if (!config.autoroles || config.autoroles.length === 0) {
      return this.errorMessage(message, "There aren't any autoroles.");
    }
    const existingRoles = config.autoroles
      .filter((x) => message.channel.guild.roles.has(x.id))
      .map((role) => message.channel.guild.roles.get(role.id)?.name)
      .join(", ");
    message.channel.createMessage(
      `Autoroles in **${message.channel.guild.name}**: ${existingRoles}`
    );
  }
}
export default Autorole;
