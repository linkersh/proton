import { GuildTextableChannel, Message } from "eris";
import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import ClientModule from "../core/structs/ClientModule";
import logger from "../core/structs/Logger";
import { RateLimiter } from "../utils/RateLimiter";
import Parser from "./Parser";

export default class Tags extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "Tags");
  }

  readonly ratelimiter = new RateLimiter({ time: 5000, maxPoints: 3 });
  async executeTag(message: Message<GuildTextableChannel>, args: string[], name: string) {
    if (!this.ratelimiter.check(`${message.author.id}-${message.guildID}`)) {
      return;
    }
    const tags = [
      [
        "user",
        {
          id: message.author.id,
          username: message.author.username,
          discriminator: message.author.discriminator,
          avatarURL: message.author.dynamicAvatarURL(undefined, 2048),
        },
      ],
      [
        "server",
        {
          id: message.channel.guild.id,
          name: message.channel.guild.name,
          iconURL: message.channel.guild.dynamicIconURL(undefined, 2048),
          ownerID: message.channel.guild.ownerID,
          memberCount: message.channel.guild.memberCount,
        },
      ],
      ["mentions", message.mentions.map((x) => x.id)],
      ["args", args],
    ];
    const tag = await collections.tags.findOne({
      guild_id: message.guildID,
      name: name,
    });
    if (!tag) {
      return;
    }
    if (
      tag.content.includes("{delete}") &&
      message.channel.permissionsOf(this.client.user.id).has("manageMessages")
    ) {
      message.delete().catch(() => null);
    }
    let dm = false;
    if (tag.content.includes("{dm}")) {
      dm = true;
    }
    tag.content = tag.content.replace(/({dm}|{delete})/g, "");
    const parser = this.client.modules.get("Parser") as Parser | undefined;
    if (!parser) {
      logger.warn("tags: cannot find the parser module.");
      return;
    }

    let parse = parser.parse(tag.content, tags);
    parse += `\n**This method is deprecated, switch to \`/tag execute ${tag.name}\`**`;
    if (parse) {
      if (dm) {
        let dmChannel,
          isError = 0;
        try {
          dmChannel = await this.client.getDMChannel(message.author.id);
        } catch (err) {
          logger.error("tags: failed to retrive dm channel", err);
          isError = 1;
        }
        if (isError === 1 || !dmChannel) {
          return;
        }
        dmChannel
          .createMessage({
            content: parse,
            allowedMentions: { users: true },
          })
          .catch((err) => logger.error("tags: failed to create message in dm channel", err));
      } else {
        message.channel
          .createMessage(parse)
          .catch((err) => logger.error("tags: faild to create message in channel", err));
      }
      return true;
    }
  }
}
