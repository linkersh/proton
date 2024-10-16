import { EmbedOptions, Guild, OldRole, Role, Uncached } from "eris";
import { ProtonClient } from "../../core/client/ProtonClient";
import { Base } from "../../core/structs/Base";
import { EmbedBuilder } from "../../utils/EmbedBuilder";
import { getTag } from "../../utils/Util";
import { FormattedPerms, ServerLogColors } from "../../Constants";
import logger from "../../core/structs/Logger";
import TimeoutBucket from "../../utils/TimeoutBucket";

export default class RoleLogger extends Base {
  constructor(client: ProtonClient) {
    super(client);
  }
  private readonly bucket = new TimeoutBucket<EmbedOptions>({
    maxItems: 10,
    waitFor: 5_000,
    callback: (this.callback = this.callback.bind(this)),
  });

  callback(key: string, value: EmbedOptions[]) {
    this.client.createMessage(key, { embeds: value }).catch((err) => {
      logger.error("role logger: failed to create a log", err);
    });
  }

  private formatPerms(role: Role) {
    const perms: string[] = [];
    for (const [key] of Object.entries(role.permissions)) {
      const perm = FormattedPerms[key as keyof typeof FormattedPerms];
      if (perm !== undefined) {
        perms.push(perm);
      }
    }
    return perms.join(", ");
  }

  async guildRoleCreate(guild: Guild, role: Role) {
    let guildConfig;
    try {
      guildConfig = await this.client.getGuildConfig(guild.id);
    } catch (err) {
      logger.error("role logger: guildRoleCreate: failed to retrive guild config", err);
      return;
    }
    if (!guildConfig || !guildConfig.logs || !guildConfig.logs.role) {
      return;
    }

    const channel = guild.channels.get(guildConfig.logs.role);
    if (!channel) {
      return;
    }

    const perms = channel.permissionsOf(this.client.user.id);
    if (!perms || !perms.has("viewChannel") || !perms.has("sendMessages")) {
      return;
    }

    let executor;
    if (guild.permissionsOf(this.client.user.id)?.has("viewAuditLog")) {
      try {
        const logs = await guild.getAuditLog({ actionType: 30, limit: 1 });
        if (logs.entries && logs.entries.length > 0) {
          const entry = logs.entries[0];
          if (entry.targetID === role.id) {
            executor = entry.user;
          }
        }
      } catch (err) {
        logger.error("role logger: guildRoleCreate: failed to fetch guild audit logs", err);
      }
    }

    const logEmbed = new EmbedBuilder()
      .title("Role created")
      .field("Name:", role.name, true)
      .field("ID:", role.id, true)
      .field("Position:", `${role.position} (the bigger the higher)`, true)
      .field("Color:", role.color.toString(16), true)
      .field("Hoisted:", String(role.hoist), true)
      .field("Managed:", String(role.managed), true)
      .field("Mentionable:", String(role.mentionable))
      .field("Admin permissions:", this.formatPerms(role), true)
      .color(ServerLogColors.ADD)
      .timestamp(new Date());
    if (executor) {
      logEmbed.author(getTag(executor), executor.dynamicAvatarURL(undefined, 256));
    }
    this.bucket.push(channel.id, logEmbed.build());
  }

  async guildRoleDelete(guild: Guild, role: Role | Uncached) {
    if (!("name" in role)) {
      return;
    }

    let guildConfig;
    try {
      guildConfig = await this.client.getGuildConfig(guild.id);
    } catch (err) {
      logger.error("role logger: guildRoleDelete: failed to retrive guild config", err);
      return;
    }
    if (!guildConfig || !guildConfig.logs || !guildConfig.logs.role) {
      return;
    }

    const channel = guild.channels.get(guildConfig.logs.role);
    if (!channel) {
      return;
    }

    const perms = channel.permissionsOf(this.client.user.id);
    if (!perms || !perms.has("viewChannel") || !perms.has("sendMessages")) {
      return;
    }

    let executor;
    if (guild.permissionsOf(this.client.user.id)?.has("viewAuditLog")) {
      try {
        const logs = await guild.getAuditLog({ actionType: 32, limit: 1 });
        if (logs.entries && logs.entries.length > 0) {
          const entry = logs.entries[0];
          if (entry.targetID === role.id) {
            executor = entry.user;
          }
        }
      } catch (err) {
        logger.error("role logger: guildRoleDelete: failed to fetch guild audit logs", err);
      }
    }

    const logEmbed = new EmbedBuilder()
      .title("Role deleted")
      .field("Name:", role.name, true)
      .field("ID:", role.id, true)
      .field("Position:", `${role.position} (the bigger the higher)`, true)
      .field("Color:", role.color.toString(16), true)
      .field("Hoisted:", String(role.hoist), true)
      .field("Managed:", String(role.managed), true)
      .field("Mentionable:", String(role.mentionable))
      .field("Admin permissions:", this.formatPerms(role), true)
      .color(ServerLogColors.REMOVE)
      .timestamp(new Date());
    if (executor) {
      logEmbed.author(getTag(executor), executor.dynamicAvatarURL(undefined, 256));
    }
    this.bucket.push(channel.id, logEmbed.build());
  }

  async guildRoleUpdate(guild: Guild, role: Role, oldRole: OldRole) {
    if (!("name" in oldRole)) {
      return;
    }

    let guildConfig;
    try {
      guildConfig = await this.client.getGuildConfig(guild.id);
    } catch (err) {
      logger.error("role logger: guildRoleUpdate: failed to retrive guild config", err);
      return;
    }
    if (!guildConfig || !guildConfig.logs || !guildConfig.logs.role) {
      return;
    }

    const channel = guild.channels.get(guildConfig.logs.role);
    if (!channel) {
      return;
    }

    const perms = channel.permissionsOf(this.client.user.id);
    if (!perms || !perms.has("viewChannel") || !perms.has("sendMessages")) {
      return;
    }

    let executor;
    if (guild.permissionsOf(this.client.user.id)?.has("viewAuditLog")) {
      try {
        const logs = await guild.getAuditLog({ actionType: 31, limit: 1 });
        if (logs.entries && logs.entries.length > 0) {
          const entry = logs.entries[0];
          if (entry.targetID === role.id) {
            executor = entry.user;
          }
        }
      } catch (err) {
        logger.error("role logger: guildRoleUpdate: failed to fetch guild audit logs", err);
      }
    }

    const logEmbed = new EmbedBuilder()
      .title(`Role: ${role.name}`)
      .timestamp(new Date())
      .color(ServerLogColors.MODIFY);
    if (executor) {
      logEmbed.author(getTag(executor), executor.dynamicAvatarURL(undefined, 256));
    }
    if (role.name !== oldRole.name) {
      logEmbed.field("Name updated:", `${oldRole.name} -> ${role.name}`, true);
    }
    if (role.color !== oldRole.color) {
      logEmbed.field(
        "Color updated:",
        `${oldRole.color.toString(16)} -> ${role.color.toString(16)}`,
        true
      );
    }
    if (role.hoist !== oldRole.hoist) {
      logEmbed.field("Hoisted:", `${oldRole.hoist} -> ${role.hoist}`, true);
    }
    if (role.position !== oldRole.position) {
      logEmbed.field(
        "Position updated:",
        `${oldRole.position} -> ${role.position} (the bigger the higher)`,
        true
      );
    }
    const embedObj = logEmbed.build();
    if (embedObj.fields && embedObj.fields.length === 0) {
      return;
    }
    this.bucket.push(channel.id, embedObj);
  }
}
