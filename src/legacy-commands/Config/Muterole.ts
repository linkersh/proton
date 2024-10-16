import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";

let MUTEROLE_PERMS_DENY = 0n;
MUTEROLE_PERMS_DENY |= 64n;
MUTEROLE_PERMS_DENY |= 2048n;
MUTEROLE_PERMS_DENY |= 4096n;
MUTEROLE_PERMS_DENY |= 1048576n;
MUTEROLE_PERMS_DENY |= 67108864n;
MUTEROLE_PERMS_DENY |= 1n << 34n;
MUTEROLE_PERMS_DENY |= 1n << 35n;
MUTEROLE_PERMS_DENY |= 1n << 36n;
const MUTEROLE_PERMS_ARR = [
  0n,
  64n,
  2048n,
  4096n,
  1048576n,
  67108864n,
  1n << 34n,
  1n << 35n,
  1n << 36n,
];
class Muterole extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "muterole",
      description: "Set or create a custom muterole for the bot to use when muting members.",
      usage: "<command>",
      category: "config",
      commands: [
        {
          name: "set",
          desc: "Set an existing role as the muterole.",
          cooldown: 8000,
          usage: "<role>",
        },
        {
          name: "check",
          desc: "Check for bad permissions of muterole in channels. (enforces the default muterole permissions)",
          cooldown: 8000,
          usage: "<role>",
        },
      ],
      aliases: [],
      cooldown: 3000,
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  async set({ message, args, config }: ExecuteArgs) {
    const role = this.parseRole(args[0], message.channel.guild);
    if (!role) {
      return this.errorMessage(message, "Mention or use the id of a valid role.");
    }
    if (config.moderation?.muterole === role.id) {
      return this.errorMessage(message, "Thats already the mute role.");
    }
    const updateConfig = collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "moderation.muterole": role.id } }
    );
    const sendMessage = message.channel.createMessage({
      content: `I'm updating the channels, this may take a bit!`,
      messageReference: { messageID: message.id, failIfNotExists: false },
    });
    await Promise.all([updateConfig, sendMessage]);
    message.channel.sendTyping();
    let iterations = 0;
    const interval = setInterval(() => {
      iterations++;
      message.channel.sendTyping();
      if (iterations >= 10) {
        clearInterval(interval);
      }
    }, 9000);
    let updated = 0;
    let failed = 0;
    const channels = [...message.channel.guild.channels.values()];
    for (const channel of channels) {
      try {
        if (!channel.permissionsOf(this.client.user.id).has("viewChannel")) {
          failed++;
          continue;
        }
        if (!channel.permissionsOf(this.client.user.id).has("manageChannels")) {
          failed++;
          continue;
        }
        if (channel.permissionOverwrites.has(role.id)) {
          const overwrite = channel.permissionOverwrites.get(role.id) || {
            deny: BigInt(0),
            allow: BigInt(0),
          };
          for (const perm of MUTEROLE_PERMS_ARR) {
            if ((perm & overwrite.deny) === 0n) {
              const perms = (overwrite.deny |= MUTEROLE_PERMS_DENY);
              const remove = (overwrite.allow &= ~MUTEROLE_PERMS_DENY);
              await channel.editPermission(role.id, remove, perms, 0);
              break;
            }
          }
        } else {
          await channel.editPermission(role.id, 0, MUTEROLE_PERMS_DENY, 0);
        }
        updated++;
      } catch (e) {
        failed++;
      }
    }
    clearInterval(interval);
    this.successMessage(
      message,
      `Set muterole to ${role.name}, updated ${updated} channels and ${failed} failed to update due to lack of permissions.`
    );
  }
  async check({ message, config }: ExecuteArgs) {
    if (!config.moderation || !config.moderation.muterole) {
      return this.errorMessage(message, "Mute role is not setup.");
    }
    const muterole = message.channel.guild.roles.get(config.moderation?.muterole);
    if (!muterole) {
      return this.errorMessage(message, "The registered mute-role does not exist.");
    }
    const sendMessage = message.channel.createMessage({
      content: `I'm checking the channels, this may take a bit!`,
      messageReference: { messageID: message.id, failIfNotExists: false },
    });
    await sendMessage;
    message.channel.sendTyping();
    let iterations = 0;
    const interval = setInterval(() => {
      iterations++;
      message.channel.sendTyping();
      if (iterations >= 10) {
        clearInterval(interval);
      }
    }, 9000);
    let updated = 0;
    let failed = 0;
    const channels = [...message.channel.guild.channels.values()];
    for (const channel of channels) {
      try {
        if (!channel.permissionsOf(this.client.user.id).has("viewChannel")) {
          failed++;
          continue;
        }
        if (!channel.permissionsOf(this.client.user.id).has("manageChannels")) {
          failed++;
          continue;
        }
        if (channel.permissionOverwrites.has(muterole.id)) {
          const overwrite = channel.permissionOverwrites.get(muterole.id) || {
            deny: BigInt(0),
            allow: BigInt(0),
          };
          for (const perm of MUTEROLE_PERMS_ARR) {
            if ((perm & overwrite.deny) === 0n) {
              const perms = (overwrite.deny |= MUTEROLE_PERMS_DENY);
              const remove = (overwrite.allow &= ~MUTEROLE_PERMS_DENY);
              await channel.editPermission(muterole.id, remove, perms, 0);
              break;
            }
          }
        } else {
          await channel.editPermission(muterole.id, 0, MUTEROLE_PERMS_DENY, 0);
        }
        updated++;
      } catch (e) {
        failed++;
      }
    }
    clearInterval(interval);
    this.successMessage(
      message,
      `Updated ${updated} channels and ${failed} failed to update due to lack of permissions.`
    );
  }
}
export default Muterole;
