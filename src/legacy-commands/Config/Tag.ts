import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import Logger from "../../core/structs/Logger";
import { collections } from "../../core/database/DBClient";
import { Tag as TagSchema } from "../../core/database/models/Tag";
import Tags from "../../modules/Tags";
import logger from "../../core/structs/Logger";

class Tag extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "tag",
      description:
        "A tag is like a custom command you can use it like `<prefix>tag-name-here`." +
        "This command is used to create/update/delete tags.",
      usage: "[tag-name]",
      commands: [
        {
          name: "create",
          desc: "Create a tag with a name and content.",
          usage: "<name> <content>",
          cooldown: 3000,
        },
        {
          name: "update",
          desc: "Update an existing tag.",
          usage: "<name> <content>",
          cooldown: 3000,
        },
        {
          name: "delete",
          desc: "Delete an existing tag.",
          usage: "<name>",
          cooldown: 3000,
        },
        {
          name: "list",
          desc: "List all the tags in this server",
          usage: "",
          cooldown: 5000,
        },
        {
          name: "disown",
          desc: "Disown your tag.",
          usage: "<tag_name>",
          cooldown: 5000,
        },
        {
          name: "claim",
          desc: "Claim a disowned tag.",
          usage: "<tag_name>",
          cooldown: 5000,
        },
      ],
      aliases: [],
      category: "config",
      cooldown: 3000,
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const Tags = this.client.modules.get("Tags") as Tags | undefined;
    if (!Tags) {
      logger.warn("command: tag: tags module not found");
      return this.errorMessage(message, "Tag module not found.");
    }
    Tags.executeTag(message, args, args.join());
  }
  async disown({ message, args }: ExecuteArgs) {
    const tagName = args.join(" ");
    const tag = await collections.tags.findOne({
      guild_id: message.guildID,
      name: tagName,
    });
    if (!tag || tag.owner_id !== message.author.id) {
      if (tag?.owner_id) {
        return this.errorMessage(
          message,
          `You don't own this tag but you can claim it. **This command is deprecated, switch to \`/tag\`**`
        );
      } else {
        return this.errorMessage(
          message,
          `You don't own this tag. **This command is deprecated, switch to \`/tag\`**`
        );
      }
    }
    await collections.tags.updateOne(
      { guild_id: message.guildID, name: tagName },
      { $set: { owner_id: null } }
    );
    this.successMessage(
      message,
      `You no longer own tag: \`${tagName}\`. **This command is deprecated, switch to \`/tag\`**`
    );
  }
  async claim({ message, args }: ExecuteArgs) {
    const tagName = args.join(" ");
    const data = await collections.tags.updateOne(
      { guild_id: message.guildID, name: tagName, owner_id: null },
      { $set: { owner_id: message.author.id } }
    );
    if (data.matchedCount === 0) {
      return this.errorMessage(
        message,
        `Either this tag already has an owner or it doesn't exist. **This command is deprecated, switch to \`/tag\`**`
      );
    }
    if (data.modifiedCount === 0) {
      return this.errorMessage(
        message,
        `You already own this tag. **This command is deprecated, switch to \`/tag\`**`
      );
    }
    this.successMessage(
      message,
      `Tag: \`${tagName}\` is now yours! **This command is deprecated, switch to \`/tag\`**`
    );
  }
  async create({ message, args, config }: ExecuteArgs) {
    const tagCount = await collections.tags.countDocuments({
      guild_id: message.guildID,
    });
    if (tagCount >= 50 && !config.isPremium) {
      return this.errorMessage(
        message,
        "You can't add more tags! Upgrade to premium to increase the limit. Get premium @ https://proton-bot.net/premium"
      );
    } else if (tagCount >= 250 && config.isPremium) {
      return this.errorMessage(message, "You have reached the tag limit of 250.");
    }
    // const nameMatch = /[^\s"']+|"([^"]*)"|'([^']*)'/.exec(args.join(' '));
    // let name = '';
    // if (nameMatch && nameMatch[1]) {
    //    name = nameMatch[1];
    // } else if (nameMatch && nameMatch[0]) {
    //    name = nameMatch[0];
    // }
    const name = args[0];
    if (!name) {
      return this.errorMessage(message, "You need to specify a tag name.");
    }
    if (name.length > 30) {
      return this.errorMessage(message, "Tag names cannot be above 30 in length.");
    }
    const content = args.slice(1).join(" ");
    if (!content) {
      return this.errorMessage(message, "You need to specify some content for the tag.");
    }
    const res = await collections.tags.updateOne(
      { guild_id: message.guildID, name: name },
      {
        $setOnInsert: {
          owner_id: message.author.id,
          created_at: Date.now(),
        },
        $set: {
          content,
        },
      },
      { upsert: true }
    );
    if (res.upsertedCount === 1) {
      this.successMessage(
        message,
        `Created a tag called: \`${name}\`. **This command is deprecated, switch to \`/tag\`**`
      );
    } else {
      this.successMessage(
        message,
        `Updated tag: \`${name}\` **This command is deprecated, switch to \`/tag\`**`
      );
    }
  }
  async update({ message, args }: ExecuteArgs) {
    const name = args[0];
    if (!name) {
      return this.errorMessage(message, "You need to specify a tag name.");
    }
    const content = args.slice(1).join(" ");
    if (!content) {
      return this.errorMessage(message, "You need to specify some **new** content for this tag.");
    }
    const query: { guild_id: string; name: string; owner_id?: string } = {
      guild_id: message.guildID,
      name: name,
    };
    if (!message.member.permissions.has("manageMessages")) {
      query["owner_id"] = message.author.id;
    }
    const res = await collections.tags.updateOne(query, {
      $set: { content },
    });
    if (res.matchedCount === 0) {
      this.errorMessage(
        message,
        `EIther this tag doesn't exist or you don't own it.\nModerators are allowed to bypass tag ownership, permissions required: \`Manage Messages\`. **This command is deprecated, switch to \`/tag\`**`
      );
    } else if (res.modifiedCount === 0) {
      this.errorMessage(
        message,
        "Tag wasn't found, if you want to create a tag use the `tag create` command."
      );
    } else {
      this.successMessage(message, "Tag was updated.");
    }
  }
  async delete({ message, args }: ExecuteArgs) {
    const name = args.join(" ");
    if (!name) {
      return this.errorMessage(message, "You need to specify a tag name to delete.");
    }
    const query: { guild_id: string; name: string; owner_id?: string } = {
      guild_id: message.guildID,
      name: name,
    };
    if (!message.member.permissions.has("manageMessages")) {
      query["owner_id"] = message.author.id;
    }
    const res = await collections.tags.deleteOne(query);
    if (res.deletedCount === 0) {
      this.errorMessage(message, "Either this tag doesn't exist or you don't own it.");
    } else {
      this.successMessage(
        message,
        `Tag \`${name}\` has been deleted. **This command is deprecated, switch to \`/tag\`**`
      );
    }
  }
  list({ message }: ExecuteArgs) {
    const splitIntoMessages = (tags: TagSchema[]) => {
      const messages: string[] = [];
      let currentString = "**This command is deprecated, switch to `/tag`**\n";
      for (const tag of tags) {
        const stringToAdd = ` \`${tag.name}\``;
        if (stringToAdd.length + currentString.length > 2000) {
          messages.push(currentString);
          currentString = stringToAdd;
        } else {
          currentString += stringToAdd;
        }
      }
      if (currentString.length) {
        messages.push(currentString);
      }
      message.author.getDMChannel().then((channel) => {
        channel
          .createMessage(messages[0])
          .then(() => {
            for (const msg of messages.slice(1)) {
              channel.createMessage(msg);
            }
          })
          .catch(() => {
            for (const msg of messages) {
              message.channel.createMessage(msg);
            }
          });
      });
    };
    collections.tags
      .find({ guild_id: message.guildID }, { projection: { name: 1, _id: 0 } })
      .toArray()
      .then(splitIntoMessages)
      .catch((err) => {
        Logger.error(`command: tag: failed to query tags for guild:`, message.guildID, err);
        this.errorMessage(message, "Failed to list, please try again later.");
      });
  }
}
export default Tag;
