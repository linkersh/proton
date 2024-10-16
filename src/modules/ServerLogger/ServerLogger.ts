import { EmbedOptions, Guild, OldGuild } from "eris";
import { ProtonClient } from "../../core/client/ProtonClient";
import { Base } from "../../core/structs/Base";
import { EmbedBuilder } from "../../utils/EmbedBuilder";
import { getTag } from "../../utils/Util";
import { ServerLogColors } from "../../Constants";
import logger from "../../core/structs/Logger";
import TimeoutBucket from "../../utils/TimeoutBucket";

export default class ServerLogger extends Base {
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
      logger.error("server logger: failed to create a log", err);
    });
  }

  private formatIcon(hash: string | null, guildID: string) {
    if (hash === null) {
      return "";
    }
    const format = hash.includes("/a_") ? "gif" : this.client.options.defaultImageFormat;
    const size = 256;
    return `https://cdn.discordapp.com/icons/${guildID}/${hash}.${format}?size=${size}`;
  }

  async guildUpdate(guild: Guild, oldGuild: OldGuild) {
    let guildConfig;
    try {
      guildConfig = await this.client.getGuildConfig(guild.id);
    } catch (err) {
      logger.error("server logger: failed to retrive guild config", err);
      return;
    }
    if (!guildConfig || !guildConfig.logs || !guildConfig.logs.server) {
      return;
    }

    const channel = guild.channels.get(guildConfig.logs.server);
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
        const logs = await guild.getAuditLog({ actionType: 1, limit: 1 });
        if (logs.entries && logs.entries.length > 0) {
          const entry = logs.entries[0];
          if (entry && entry.targetID === guild.id) {
            executor = entry.user;
          }
        }
      } catch (err) {
        logger.error("server logger: failed to fetch guild logs", err);
      }
    }

    const logEmbed = new EmbedBuilder().timestamp(new Date()).color(ServerLogColors.MODIFY);
    if (executor) {
      logEmbed.author(getTag(executor), executor.dynamicAvatarURL(undefined, 256));
    }

    if (guild.name !== oldGuild.name) {
      logEmbed
        .title("Server name updated")
        .description(`${oldGuild.name || "UNKOWN_OLD_GUILD_NAME"} -> ${guild.name}`);
    } else if (guild.description !== oldGuild.description) {
      logEmbed
        .title("Server description updated")
        .field("Old description:", oldGuild.description || "UNKOWN_OLD_GUILD_DESCRIPTION")
        .field("New description:", guild.description || "No description")
        .timestamp(new Date());
    } else if (guild.icon !== oldGuild.icon) {
      let oldIcon: string = this.formatIcon(oldGuild.icon, guild.id) || "(no icon)";
      let newIcon: string = this.formatIcon(guild.icon, guild.id) || "(no icon)";
      if (!oldIcon.startsWith("(")) {
        oldIcon = `[Old icon](${oldIcon})`;
      }
      if (!newIcon.startsWith("(")) {
        newIcon = `[New icon](${newIcon})`;
      }
      logEmbed
        .title("Server icon updated")
        .description(`${oldIcon} -> ${newIcon}`)
        .timestamp(new Date());
    } else {
      return;
    }
    this.bucket.push(guild.id, logEmbed.build());
  }
}
