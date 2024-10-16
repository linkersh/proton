import { EmbedOptions, Guild, Member, MemberPartial } from "eris";
import { ServerLogColors } from "../../Constants";
import { ProtonClient } from "../../core/client/ProtonClient";
import { Base } from "../../core/structs/Base";
import { EmbedBuilder } from "../../utils/EmbedBuilder";
import { getTag } from "../../utils/Util";
import TimeoutBucket from "../../utils/TimeoutBucket";
import logger from "../../core/structs/Logger";

export default class GatewayLogger extends Base {
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
      logger.error("gateway logger: failed to create a log", err);
    });
  }

  async guildMemberAdd(guild: Guild, member: Member) {
    let guildConfig;
    try {
      guildConfig = await this.client.getGuildConfig(guild.id);
    } catch (err) {
      logger.error("gateway logger: failed to retrive guild config", err);
      return;
    }
    if (!guildConfig || !guildConfig.logs || !guildConfig.logs.gateway) {
      return;
    }

    const channel = guild.channels.get(guildConfig.logs.gateway);
    if (!channel) {
      return;
    }

    const perms = channel.permissionsOf(this.client.user.id);
    if (!perms || !perms.has("viewChannel") || !perms.has("sendMessages")) {
      return;
    }

    const createdAt = member.user.createdAt
      ? `<t:${Math.floor(member.user.createdAt / 1000)}:F>`
      : `Unknown`;
    const joinedAt = member.joinedAt ? `<t:${Math.floor(member.joinedAt / 1000)}:F>` : `Unknown`;

    const logEmbed = new EmbedBuilder()
      .author(getTag(member.user), member.user.dynamicAvatarURL(undefined, 256))
      .title("User joined")
      .description(
        `${member.user.mention} (\`id ${member.id}\`)\nThe server now has **${guild.memberCount}** members!`
      )
      .field("Joined at", joinedAt)
      .field("Created at", createdAt)
      .color(ServerLogColors.ADD);
    this.bucket.push(channel.id, logEmbed.build());
  }

  async guildMemberRemove(guild: Guild, member: Member | MemberPartial) {
    let guildConfig;
    try {
      guildConfig = await this.client.getGuildConfig(guild.id);
    } catch (err) {
      logger.error("gateway logger: failed to retrive guild config", err);
      return;
    }
    if (!guildConfig || !guildConfig.logs || !guildConfig.logs.gateway) {
      return;
    }

    const channel = guild.channels.get(guildConfig.logs.gateway);
    if (!channel) {
      return;
    }

    const perms = channel.permissionsOf(this.client.user.id);
    if (!perms || !perms.has("viewChannel") || !perms.has("sendMessages")) {
      return;
    }

    const createdAt = member.user.createdAt
      ? `<t:${Math.floor(member.user.createdAt / 1000)}:F>`
      : `Unknown`;
    const joinedAt =
      "joinedAt" in member && member.joinedAt !== null
        ? `<t:${Math.floor(member.joinedAt / 1000)}:F>`
        : `Unknown`;

    const logEmbed = new EmbedBuilder()
      .author(getTag(member.user), member.user.dynamicAvatarURL(undefined, 256))
      .title("User left")
      .description(
        `${member.user.mention} (\`id ${member.id}\`)\nThe server now has **${guild.memberCount}** members!`
      )
      .field("Joined at", joinedAt)
      .field("Created at", createdAt)
      .color(ServerLogColors.REMOVE);
    this.bucket.push(channel.id, logEmbed.build());
  }
}
