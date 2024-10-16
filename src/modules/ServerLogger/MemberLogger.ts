import { EmbedOptions, Guild, Member, OldMember } from "eris";
import { ProtonClient } from "../../core/client/ProtonClient";
import { Base } from "../../core/structs/Base";
import { EmbedBuilder } from "../../utils/EmbedBuilder";
import { getTag } from "../../utils/Util";
import { ServerLogColors } from "../../Constants";
import logger from "../../core/structs/Logger";
import TimeoutBucket from "../../utils/TimeoutBucket";

export default class MemberLogger extends Base {
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
      logger.error("member logger: failed to create a log", err);
    });
  }

  async guildMemberUpdate(guild: Guild, member: Member, oldMember: OldMember | null) {
    if (!oldMember) {
      return;
    }
    let guildConfig;
    try {
      guildConfig = await this.client.getGuildConfig(guild.id);
    } catch (err) {
      logger.error("member logger: failed to retrive guild config", err);
      return;
    }
    if (!guildConfig || !guildConfig.logs || !guildConfig.logs.member) {
      return;
    }

    const channel = guild.channels.get(guildConfig.logs.member);
    if (!channel) {
      return;
    }

    const perms = channel.permissionsOf(this.client.user.id);
    if (!perms || !perms.has("viewChannel") || !perms.has("sendMessages")) {
      return;
    }

    if (member.nick !== oldMember.nick) {
      const logEmbed = new EmbedBuilder()
        .author(getTag(member.user), member.user.dynamicAvatarURL(undefined, 256))
        .title("Member nickname updated")
        .description(`${oldMember.nick ?? "(no nickname)"} -> ${member.nick ?? "(no nickname)"}`)
        .color(ServerLogColors.MODIFY)
        .timestamp(new Date());
      this.bucket.push(channel.id, logEmbed.build());
    } else if (member.roles.length !== oldMember.roles.length) {
      let changes = [],
        type = 1;
      if (member.roles.length > oldMember.roles.length) {
        changes = member.roles.filter((r) => !oldMember.roles.includes(r));
      } else {
        type = 2;
        changes = oldMember.roles.filter((r) => !member.roles.includes(r));
      }
      const roleMap = changes
        .map((x) => `<@&${x}>`)
        .join("\n")
        .slice(0, 1024);
      const logEmbed = new EmbedBuilder()
        .author(getTag(member.user), member.user.dynamicAvatarURL(undefined, 256))
        .title("Member role updated")
        .field(type === 1 ? "+ Added:" : "- Removed:", roleMap || "None")
        .color(ServerLogColors.MODIFY)
        .timestamp(new Date());
      this.bucket.push(channel.id, logEmbed.build());
    }
  }
}
