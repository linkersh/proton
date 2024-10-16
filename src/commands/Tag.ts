/* eslint-disable @typescript-eslint/no-non-null-assertion */
import Command from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";
import { ProtonClient } from "../core/client/ProtonClient";
import {
  CommandInteraction,
  GuildTextableChannel,
  Constants,
  InteractionDataOptionsSubCommand,
  Guild,
  ModalSubmitInteraction,
  AutocompleteInteraction,
} from "eris";
import { collections } from "../core/database/DBClient";
import { GuildConfig } from "../core/database/models/GuildConfig";
import { ObjectId } from "bson";
import Tags from "../modules/Tags";
import Parser from "../modules/Parser";

const { ApplicationCommandOptionTypes: OptionType } = Constants;
type Interaction = CommandInteraction<GuildTextableChannel>;
type Option = InteractionDataOptionsSubCommand;

const standardRegex = /#ps-(0|1)\n/;

export default class Tag extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "tag";
  description = "Manage tags/custom-commands in the server.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "create",
      description: "Create a tag.",
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "update",
      description: "Update an existing tag.",
      options: [
        {
          type: OptionType.STRING,
          name: "name",
          description: "The name of the tag.",
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "delete",
      description: "Deleted an existing tag.",
      options: [
        {
          type: OptionType.STRING,
          name: "name",
          description: "The name of the tag.",
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "disown",
      description: "Disown your tag (make it available for anyone to claim ownership of it)",
      options: [
        {
          type: OptionType.STRING,
          name: "name",
          description: "The name of the tag.",
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "claim",
      description: "Claim ownership of a tag without an owner.",
      options: [
        {
          type: OptionType.STRING,
          name: "name",
          description: "The name of the tag.",
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "execute",
      description: "Execute a specific tag.",
      options: [
        {
          type: OptionType.STRING,
          name: "name",
          description: "The name of the tag.",
          required: true,
          autocomplete: true,
        },
        {
          type: OptionType.STRING,
          name: "args",
          description: "Additional arguments to pass to the tag.",
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "list",
      description: "List all of the tags.",
    },
  ];
  guildID = null;
  dmPermission = false;

  async handler(interaction: Interaction) {
    if (interaction.data.options === undefined) {
      return;
    }
    if (!interaction.guildID || !interaction.member) {
      return;
    }

    const subCommand = interaction.data.options[0];
    if (!subCommand || subCommand.type !== OptionType.SUB_COMMAND) {
      return;
    }

    if (
      !interaction.member.permissions.has("manageMessages") &&
      subCommand.name !== "execute" &&
      subCommand.name !== "list"
    ) {
      return interaction.createMessage(
        this.errorMessage(
          interaction.channel,
          `You don't have enough permissions in this **guild**.`
        )
      );
    }

    const guild = interaction.channel.guild;
    if (!guild) return;

    const config = await this.client.getGuildConfig(guild.id);
    if (!config) return;

    if (subCommand.name === "create") {
      return await this.create(interaction, guild, config);
    } else if (subCommand.name === "update") {
      return await this.update(interaction, subCommand);
    } else if (subCommand.name === "delete") {
      return await this.delete(interaction, subCommand);
    } else if (subCommand.name === "disown") {
      return await this.disown(interaction, subCommand);
    } else if (subCommand.name === "claim") {
      return await this.claim(interaction, subCommand);
    } else if (subCommand.name === "execute") {
      return await this.execute(interaction, subCommand, guild);
    } else if (subCommand.name === "list") {
      return await this.list(interaction);
    }
  }

  async create(interaction: Interaction, guild: Guild, config: GuildConfig) {
    const tagCount = await collections.tags.countDocuments({
      guild_id: guild.id,
    });
    if (tagCount >= 50 && !config.isPremium) {
      return interaction.createMessage(
        this.errorMessage(
          interaction.channel,
          "Tag limit of 50 reached. Upgrade to premium to get 200 more tag slots. Get premium @ https://proton-bot.net/premium"
        )
      );
    } else if (tagCount >= 250 && config.isPremium) {
      return interaction.createMessage(
        this.errorMessage(interaction.channel, "Tag limit of 250 reached.")
      );
    }
    return interaction.createModal({
      title: "Create tag",
      custom_id: "tag_create",
      components: [
        {
          type: Constants.ComponentTypes.ACTION_ROW,
          components: [
            {
              type: Constants.ComponentTypes.TEXT_INPUT,
              label: "Tag name",
              placeholder: "hello-world",
              style: Constants.TextInputStyles.SHORT,
              required: true,
              min_length: 3,
              max_length: 30,
              custom_id: "tag_create_name",
            },
          ],
        },
        {
          type: Constants.ComponentTypes.ACTION_ROW,
          components: [
            {
              type: Constants.ComponentTypes.TEXT_INPUT,
              label: "Tag content",
              value: `#ps-1 // Set the parser standard to version 1, defaults to 0.\nstd::create_message(std::builders::MessageBuilder("Hello, world!"));`,
              style: Constants.TextInputStyles.PARAGRAPH,
              required: true,
              min_length: 1,
              max_length: 4000,
              custom_id: "tag_create_content",
            },
          ],
        },
      ],
    });
  }

  async update(interaction: Interaction, option: Option) {
    const tagNameOpt = option.options && option.options[0];
    if (!tagNameOpt || tagNameOpt.type !== OptionType.STRING) {
      return;
    }
    const tagObjectID = await this.validateTag(interaction, tagNameOpt.value);
    if (!tagObjectID) {
      return;
    }

    const tagData = await collections.tags.findOne(
      {
        _id: tagObjectID,
        guild_id: interaction.guildID,
      },
      {
        projection: {
          owner_id: 1,
          name: 1,
          content: 1,
          _id: 1,
        },
      }
    );

    if (!tagData) {
      return interaction.createMessage(
        this.errorMessage(interaction.channel, `That tag doesn't exist.`)
      );
    }

    if (tagData.owner_id === null) {
      return interaction.createMessage(
        this.errorMessage(
          interaction.channel,
          `This tag doesn't have an owner, become it's owner by using: \`/tag claim ${tagData.name}\`.`
        )
      );
    }
    if (tagData.owner_id !== interaction.member!.id) {
      return interaction.createMessage(
        this.errorMessage(
          interaction.channel,
          `This tag already has an owner (<@!${tagData.owner_id}>). You can ask them to disown the tag using: \`/tag disown ${tagData.name}\`, and then you can claim it with: /tag claim ${tagData.name}`
        )
      );
    }
    return interaction.createModal({
      title: "Update Tag",
      custom_id: "tag_update",
      components: [
        {
          type: Constants.ComponentTypes.ACTION_ROW,
          components: [
            {
              type: Constants.ComponentTypes.TEXT_INPUT,
              label: "Content",
              min_length: 1,
              max_length: 4000,
              required: true,
              style: Constants.TextInputStyles.PARAGRAPH,
              custom_id: `tag_update_content_${Buffer.from(tagNameOpt.value).toString("base64")}`,
              value: tagData.content,
              // placeholder: `std::create_message(std::builders::MessageBuilder("Hello, world!"));`,
            },
          ],
        },
      ],
    });
  }

  async delete(interaction: Interaction, option: Option) {
    const tagNameOpt = option.options && option.options[0];
    if (!tagNameOpt || tagNameOpt.type !== OptionType.STRING) {
      return;
    }

    const tagObjectID = await this.validateTag(interaction, tagNameOpt.value);
    if (!tagObjectID) return;
    const result = await collections.tags.deleteOne({
      _id: tagObjectID,
      guild_id: interaction.guildID,
      owner_id: interaction.member!.id,
    });
    if (result.deletedCount === 1) {
      return interaction.createMessage(this.successMessage(interaction.channel, "Tag deleted."));
    } else {
      return interaction.createMessage(
        this.errorMessage(
          interaction.channel,
          "Either the tag has been already deleted, or you don't own it."
        )
      );
    }
  }

  async disown(interaction: Interaction, option: Option) {
    const tagNameOpt = option.options && option.options[0];
    if (!tagNameOpt || tagNameOpt.type !== OptionType.STRING) {
      return;
    }

    const tagObjectID = await this.validateTag(interaction, tagNameOpt.value);
    if (!tagObjectID) {
      return;
    }

    const result = await collections.tags.updateOne(
      {
        _id: tagObjectID,
        guild_id: interaction.guildID,
        owner_id: interaction.member!.id,
      },
      {
        $set: { owner_id: null },
      }
    );
    if (result.matchedCount === 1 && result.modifiedCount === 1) {
      return interaction.createMessage(
        this.successMessage(interaction.channel, "You no longer own this tag.")
      );
    } else {
      return interaction.createMessage(
        this.errorMessage(interaction.channel, "Either the tag doesn't exist or you don't own it.")
      );
    }
  }

  async claim(interaction: Interaction, option: Option) {
    const tagNameOpt = option.options && option.options[0];
    if (!tagNameOpt || tagNameOpt.type !== OptionType.STRING) {
      return;
    }

    const tagObjectID = await this.validateTag(interaction, tagNameOpt.value);
    if (!tagObjectID) {
      return;
    }

    const result = await collections.tags.updateOne(
      {
        _id: tagObjectID,
        guild_id: interaction.guildID,
        owner_id: null,
      },
      {
        $set: { owner_id: interaction.member!.id },
      }
    );
    if (result.matchedCount === 1 && result.modifiedCount === 1) {
      return interaction.createMessage(
        this.successMessage(interaction.channel, "You now own this tag.")
      );
    } else {
      return interaction.createMessage(
        this.errorMessage(
          interaction.channel,
          "Either the tag doesn't exist or it already has an owner."
        )
      );
    }
  }

  async execute(interaction: Interaction, option: Option, guild: Guild) {
    await interaction.acknowledge(64);
    if (!option.options) {
      return;
    }

    const tagNameOpt = option.options[0];
    if (!tagNameOpt || tagNameOpt.type !== OptionType.STRING) {
      return;
    }

    const tagObjId = await this.validateTag(interaction, tagNameOpt.value);
    if (!tagObjId) {
      return;
    }

    const tagData = await collections.tags.findOne({
      _id: tagObjId,
      guild_id: interaction.guildID,
    });
    if (!tagData) {
      return interaction.createFollowup(
        this.errorMessage(interaction.channel, "That tag doesn't exist.")
      );
    }

    const tagArgs = option.options[1];
    if (tagArgs && tagArgs.type !== OptionType.STRING) {
      return;
    }

    const standardMatch = standardRegex.exec(tagData.content);
    if (standardMatch) {
      tagData.content = tagData.content.slice(tagData.content.indexOf("\n") + 1);
    }
    const tagsMod = this.client.modules.get("Tags") as Tags | undefined;
    if (!tagsMod) {
      logger.error("command: tag sub command: execute: tags module not found.");
      return interaction.createFollowup(this.errorMessage(interaction.channel, "No interpreter."));
    }
    if (!tagsMod.ratelimiter.check(`${interaction.member!.id}-${interaction.guildID}`)) {
      return interaction.createMessage(
        this.errorMessage(interaction.channel, "You are being ratelimited.")
      );
    }
    const tags = [
      [
        "user",
        {
          id: interaction.member!.id,
          username: interaction.member!.username,
          discriminator: interaction.member!.discriminator,
          avatarURL: interaction.member!.user.dynamicAvatarURL(undefined, 2048),
        },
      ],
      [
        "server",
        {
          id: interaction.guildID,
          name: guild.name,
          iconURL: guild.dynamicIconURL(undefined, 2048),
          ownerID: guild.ownerID,
          memberCount: guild.memberCount,
        },
      ],
      ["args", tagArgs],
    ];
    let dm = false;
    if (tagData.content.includes("{dm}")) {
      dm = true;
    }
    tagData.content = tagData.content.replace(/({dm}|{delete})/g, "");
    const parser = this.client.modules.get("Parser") as Parser | undefined;
    if (!parser) {
      logger.warn("tags: cannot find the parser module.");
      return interaction.createFollowup("No parser.");
    }

    const parse = parser.parse(tagData.content, tags);
    if (parse) {
      if (dm) {
        let dmChannel;
        try {
          dmChannel = await this.client.getDMChannel(interaction.member!.id);
        } catch (err) {
          logger.error("tags: failed to retrive dm channel", err);
        }
        if (!dmChannel) {
          return;
        }
        await dmChannel.createMessage({
          content: parse,
          allowedMentions: { users: true },
        });
        return interaction.createFollowup("Tag executed.");
      } else {
        return interaction.createFollowup(parse);
      }
    }
  }

  async list(interaction: Interaction) {
    const tags = await collections.tags
      .find({ guild_id: interaction.guildID }, { projection: { name: 1, _id: 0 } })
      .toArray();
    const message = tags.map((tag) => tag.name).join(", ");
    if (message.length < 2000) {
      return interaction.createMessage(message);
    } else {
      return interaction.createMessage("", {
        name: "tags.txt",
        file: message,
      });
    }
  }

  async autoCompleteHandler(interaction: AutocompleteInteraction<GuildTextableChannel>) {
    if (!interaction.guildID || !interaction.member) return;

    const subCommand = interaction.data.options[0];
    if (!subCommand || subCommand.type !== OptionType.SUB_COMMAND) {
      return interaction.result([]);
    }

    if (
      subCommand.name !== "execute" &&
      !interaction.channel.guild.permissionsOf(interaction.member).has("manageMessages")
    ) {
      return interaction.result([]);
    }

    const searchString = subCommand.options && subCommand.options[0];
    if (!searchString || searchString.type !== OptionType.STRING) {
      return interaction.result([]);
    }

    if (!searchString.focused) {
      return interaction.result([]);
    }

    const reverse = subCommand.name === "claim";
    const input = searchString.value;
    if (input.length === 0) {
      const tags = await collections.tags
        .find({
          guild_id: interaction.guildID,
          owner_id: reverse ? null : interaction.member.id,
        })
        .limit(25)
        .toArray();
      return interaction.result(tags.map((tag) => ({ name: tag.name, value: tag._id.toString() })));
    } else {
      const tags = await collections.tags
        .find(
          {
            guild_id: interaction.guildID,
            owner_id: reverse ? null : interaction.member.id,
            $text: { $search: input },
          },
          { projection: { score: { $meta: "textScore" }, name: 1 } }
        )
        .sort({ score: { $meta: "textScore" } })
        .limit(25)
        .toArray();
      return interaction.result(tags.map((tag) => ({ name: tag.name, value: tag._id.toString() })));
    }
  }

  async createModalHandler(interaction: ModalSubmitInteraction<GuildTextableChannel>) {
    if (!interaction.guildID || !interaction.member) return;
    if (!interaction.channel.guild.permissionsOf(interaction.member).has("manageMessages")) {
      return interaction.createMessage(
        this.errorMessage(interaction.channel, "You don't have permissions in this **guild**.")
      );
    }
    const actionRow1 = interaction.data.components[0];
    const actionRow2 = interaction.data.components[1];
    if (!actionRow1 || !actionRow2) {
      return;
    }

    const name = actionRow1.components[0];
    const content = actionRow2.components[0];

    await collections.tags.insertOne({
      name: name.value,
      content: content.value,
      owner_id: interaction.member.id,
      guild_id: interaction.guildID,
      created_at: Date.now(),
    });
    return interaction.createMessage(
      this.successMessage(
        interaction.channel,
        `Created a tag with name \`${name.value}\`. You can now run it with \`/tag execute ${name.value}\``
      )
    );
  }

  async updateModalHandler(interaction: ModalSubmitInteraction<GuildTextableChannel>) {
    if (!interaction.guildID || !interaction.member) return;
    if (!interaction.channel.guild.permissionsOf(interaction.member).has("manageMessages")) {
      return interaction.createMessage(
        this.errorMessage(interaction.channel, "You don't have permissions in this **guild**.")
      );
    }

    const content = interaction.data.components[0] && interaction.data.components[0].components[0];
    if (!content) {
      return;
    }
    const tagID = Buffer.from(
      content.custom_id.slice(content.custom_id.lastIndexOf("_") + 1),
      "base64"
    ).toString();

    const tagObjectID = await this.validateTag(interaction, tagID);
    if (!tagObjectID) {
      return;
    }
    await collections.tags.updateOne(
      {
        _id: tagObjectID,
        guild_id: interaction.guildID,
        owner_id: interaction.member.id,
      },
      { $set: { content: content.value } }
    );
    return interaction.createMessage(this.successMessage(interaction.channel, `Updated the tag.`));
  }

  async validateTag(
    interaction: Interaction | ModalSubmitInteraction<GuildTextableChannel>,
    value: string
  ) {
    if (!ObjectId.isValid(value)) {
      await interaction.createMessage(
        this.errorMessage(interaction.channel, "The tag specified doesn't exist.")
      );
      return;
    }
    return new ObjectId(value);
  }
}
