import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import Logger from "../../core/structs/Logger";
import { ReactionRoleTypes } from "../../Constants";
import { MessageListener } from "../../utils/MessageListener";
import { collections } from "../../core/database/DBClient";
import { Message } from "eris";
import { Reaction } from "../../core/database/models/ReactionRoles";
import { Filter } from "mongodb";
import { ReactionRoles as ReactionRoleSchema } from "../../core/database/models/ReactionRoles";

const snowflakeRegex = /^[0-9]{16,19}$/;

class ReactionRoles extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "reactionroles",
      usage: "<command>",
      description:
        "**Docs:** [here](https://docs.proton-bot.net/features/reaction-roles)\nSetup and configure reaction roles!",
      commands: [
        {
          name: "add",
          desc: "Bind a reaction and a role to a specific message.",
          cooldown: 3000,
          usage: "<channel> <message-id> <emoji> <role>",
        },
        {
          name: "addmany",
          desc: "Add several reactions at once to a custom message",
          cooldown: 5000,
          usage: "<channel> <message_id>",
        },
      ],
      aliases: [],
      category: "config",
      cooldown: 3000,
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages", "manageRoles"],
    });
  }
  async add({ message, args }: ExecuteArgs) {
    const channel = this.parseChannel(args[0], message.channel.guild);
    if (!channel) {
      return this.errorMessage(message, "You need to specify a valid channel.");
    }
    const messageID = args[1];
    if (!snowflakeRegex.test(messageID)) {
      return this.errorMessage(
        message,
        `You need to specify a valid message id that was previously sent in: ${channel.mention}`
      );
    }
    const channelPerms = channel.permissionsOf(this.client.user.id);
    if (!channelPerms.has("readMessageHistory")) {
      return this.errorMessage(
        message,
        `I need \`Read Message History\` permission in ${channel.mention} to get a message from it`
      );
    }
    const emoji = this.parseEmoji(args[2]);
    if (!emoji) {
      return this.errorMessage(message, "You need to specify a custom or a default emoji.");
    }
    const roleName = args.slice(3).join(" ").slice(0, 250);
    const role = this.parseRole(roleName, message.channel.guild);
    if (!role) {
      if (!roleName) {
        return this.errorMessage(
          message,
          `You need to mention a valid role or specify its id or name.`
        );
      } else {
        return this.errorMessage(
          message,
          `"${roleName}" is not a valid name, id or mention of a role.`
        );
      }
    }
    const msg = await channel.getMessage(messageID).catch(() => null);
    if (!msg) {
      return this.errorMessage(message, "That is not a valid message id!");
    }
    if (!channelPerms.has("addReactions")) {
      return this.errorMessage(
        message,
        `I can't add reactions in ${channel.mention} please give me the Add Reactions permission!`
      );
    }
    try {
      if (emoji.id) {
        msg.addReaction(`${emoji.name}:${emoji.id}`);
      } else {
        msg.addReaction(emoji.name);
      }
    } catch {
      // eslint-disable-next-line
    }
    const baseQuery: Filter<ReactionRoleSchema> = {
      guildID: `${message.guildID}`,
      channelID: channel.id,
      messageID: msg.id,
    };
    const existingRR = await collections.reaction_roles.findOne({
      channelID: "",
    });
    if (
      existingRR?.reactions?.find((r) => {
        return r.emoji.id ? r.emoji.id === emoji.id : r.emoji.name === emoji.name;
      })
    ) {
      if (emoji.id) {
        baseQuery.reactions = { emoji: { id: emoji.id } };
      } else {
        baseQuery.reactions = { emoji: { name: emoji.name } };
      }
      await collections.reaction_roles.updateOne(baseQuery, {
        $set: { "reactions.$.role": role.id },
      });
    } else {
      await collections.reaction_roles.updateOne(
        baseQuery,
        {
          $push: { reactions: { role: role.id, emoji: emoji } },
          $setOnInsert: { type: ReactionRoleTypes.NORMAL },
        },
        { upsert: true }
      );
    }
    this.successMessage(
      message,
      `Added a reaction ${emoji.id ? `<:${emoji.name}:${emoji.id}>` : emoji.name}` +
        ` and bound it to role: ${role.name}.`
    );
  }
  async addmany({ message, args }: ExecuteArgs) {
    const channel = this.parseChannel(args[0], message.channel.guild);
    if (!channel) {
      return this.errorMessage(message, "You need to specify a valid channel.");
    }
    const messageID = args[1];
    if (!messageID || !snowflakeRegex.test(messageID)) {
      return this.errorMessage(
        message,
        `You need to specify a valid message id that was previously sent in: ${channel.mention}`
      );
    }
    let fetchMessage: Message;
    try {
      fetchMessage = channel.messages.get(messageID) || (await channel.getMessage(messageID));
    } catch {
      return this.errorMessage(
        message,
        `Could not find a message with ID \`${messageID}\` in ${channel.mention}`
      );
    }
    const collector = new MessageListener(message.channel, this.client, {
      repeatTimeout: true,
      expireAfter: 60 * 1000 * 3,
      filter: (msg) => msg.author.id === message.author.id,
    });
    let tries = 3;
    const msgArr = [
      `Alright, now please send message(s) using this syntax **in each message**: \`<emoji_name|emoji_id|emoji> <role|role_name|role_id>\``,
      `\n**Don't include \`<\` and \`>\` characters! They are just an example.**`,
      `After 3 minutes the bot will stop listening to your messages, you will have to retry!\n\nWhen you have finished your setup type: \`done\``,
    ];
    // let emojis: Emoji[];
    // let isError = 0;
    // try {
    //    emojis = await this.client.getRESTGuildEmojis(message.guildID);
    // } catch (err) {
    //    Logger.error(`command: reaction roles: failed to get guild emojis`, err);
    //    isError = 1;
    // }
    // if (isError) {
    //    return message.channel.createMessage("Failed to fetch this guild's emojis.");
    // }
    message.channel.createMessage(msgArr.join("\n"));
    function check() {
      if (tries <= 0) {
        collector.stop("NO_TRIES");
        return message.channel.createMessage(`You have lost all your tries, please try again.`);
      }
      tries--;
    }
    const data: Reaction[] = [];
    let promtedTooMuch = false;
    collector.on("messageCreate", (msg) => {
      const lowerCase = msg.content.toLowerCase();
      if (lowerCase === "cancel") {
        collector.stop("CANCELED");
        return message.channel.createMessage("Canceled the reaction role");
      } else if (lowerCase === "done" || lowerCase === "complete") {
        collector.stop("DONE");
        return;
      }
      if (data.length >= 20) {
        if (promtedTooMuch) {
          if (lowerCase === "yes") {
            collector.stop("DONE");
          } else if (lowerCase === "no") {
            collector.stop("");
          }
          check();
        } else {
          promtedTooMuch = true;
          message.channel.createMessage(
            `You have reached the 20 reaction limit, type \`yes\` if you want to save the current changes type \`no\` if you want to cancel the setup.`
          );
        }
        return;
      }
      const args = msg.content.trim().split(" ");
      const emoji = this.parseEmoji(args[0]);
      if (!emoji) {
        message.channel.createMessage(`You need to specify an emoji or its name.`);
        return check();
      }
      const role = this.parseRole(args[1], msg.channel.guild);
      if (!role) {
        message.channel.createMessage(`You need to specify a valid role.`);
        return check();
      }
      if (typeof emoji === "object") {
        data.push({ role: role.id, emoji: emoji });
      } else {
        data.push({
          role: role.id,
          emoji: { id: null, name: emoji, animated: false },
        });
      }
      if (
        message.channel.type === 0 &&
        message.channel.permissionsOf(this.client.user.id).has("addReactions")
      ) {
        msg.addReaction("✅");
      }
    });
    collector.on("stop", async (reason) => {
      if (reason === "DONE") {
        for (const emoji of data) {
          try {
            await fetchMessage.addReaction(
              emoji.emoji.id ? `${emoji.emoji.id}:${emoji.emoji.id}` : emoji.emoji.name
            );
          } catch {
            message.channel.createMessage(
              `Something went wrong, i couldn't react to the message with`
            );
            break;
          }
        }
        collections.reaction_roles
          .updateOne(
            { messageID: fetchMessage.id, guildID: message.guildID },
            {
              $push: {
                reactions: {
                  $each: data.map((x) => {
                    return { role: x.role, emoji: x.emoji };
                  }),
                },
              },
              $setOnInsert: {
                channelID: channel.id,
                type: ReactionRoleTypes.NORMAL,
              },
            },
            { upsert: true }
          )
          .then(() => {
            message.channel.createMessage(
              `Added ${data.length} reactions to message \`${fetchMessage.id}\` in ${channel.mention}.`
            );
          })
          .catch((err) => {
            Logger.error(`command: reaction-roles: failed to save reaction-roles data`, err);
            message.channel.createMessage(
              "Failed to create reaction roles, please try again later..."
            );
          });
      }
    });
  }
}
export default ReactionRoles;
