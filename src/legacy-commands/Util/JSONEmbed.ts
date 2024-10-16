import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { ComponentListener } from "../../utils/ComponentListener.js";
import { MessageListener } from "../../utils/MessageListener.js";
import axios from "axios";
import { GuildTextableChannel, Message } from "eris";

const snowflakeRegex = /^[0-9]{16,19}$/;

class JSONEmbed extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "jsonembed",
      description: "Pass a json string and send it as embed(s)",
      usage: "<string>",
      aliases: ["jsonem"],
      category: "util",
      cooldown: 3000,
      userPerms: ["manageMessages"],
      clientPerms: ["sendMessages"],
    });
  }

  fetchFile(link: string) {
    return new Promise((resolve, reject) => {
      axios
        .get(link, { maxBodyLength: 5e6, maxContentLength: 5e6 })
        .then((value) => resolve(value.data))
        .catch(() => reject("Bad response"));
    });
  }

  process(message: Message<GuildTextableChannel>, type: 1 | 2) {
    const collector = new MessageListener(message.channel, this.client, {
      filter: (fmsg) => {
        return fmsg.author.id === message.author.id;
      },
      expireAfter: 60_000,
      repeatTimeout: false,
    });
    let stage = 1,
      channelID: string | undefined,
      messageID: string | undefined;
    collector.on("messageCreate", async (cmsg) => {
      if (type === 2) {
        if (stage === 1) {
          const channel = cmsg.channelMentions[0];
          if (!channel || !cmsg.channel.guild.channels.has(channel)) {
            collector.stop("error");
            return this.errorMessage(cmsg, "That channel doesn't exist.");
          }
          const channelObj = cmsg.channel.guild.channels.get(channel);
          const perms = channelObj?.permissionsOf(this.client.user.id);
          if (!perms || !perms.has("sendMessages") || !perms.has("readMessageHistory")) {
            collector.stop("error");
            return this.errorMessage(
              cmsg,
              "I don't have permissions to send messages and/or read message history in that channel."
            );
          }
          channelID = channel;
          stage++;
          cmsg.channel.createMessage("Step 2. Please send the id of the message for me to edit.");
        } else if (stage === 2) {
          if (!snowflakeRegex.test(cmsg.content)) {
            collector.stop("error");
            return this.errorMessage(cmsg, "That is not a valid message id!");
          }
          try {
            await this.client.getMessage(channelID ?? "", cmsg.content);
          } catch (err) {
            collector.stop("error");
            return this.errorMessage(
              cmsg,
              `Message with id: ${cmsg.content} in channel: <#${channelID}> could not be found.`
            );
          }
          stage++;
          messageID = cmsg.content;
          cmsg.channel.createMessage("Step 3. Please send the JSON string of embeds.");
        } else if (stage === 3) {
          collector.stop("error");
          let isError = false;
          let attachment = null;
          let data = null;

          if (
            cmsg.attachments &&
            (attachment = cmsg.attachments.find(
              (a) => a.content_type === "text/plain; charset=utf-8"
            ))
          ) {
            try {
              data = await this.fetchFile(attachment.url);
            } catch (err) {
              isError = true;
            }
          } else {
            try {
              data = JSON.parse(cmsg.content);
            } catch {
              isError = true;
            }
          }

          if (isError || !data) {
            return this.errorMessage(cmsg, "Specify a valid json string.");
          }
          if (!Array.isArray(data)) {
            data = [data];
          }
          this.client
            .editMessage(channelID as string, messageID as string, {
              embeds: data,
            })
            .catch(() => {
              this.errorMessage(cmsg, "Embed content too long/invalid data");
            });
        }
      } else {
        collector.stop("type 1");
        let isError = false;
        let attachment = null;
        let data = null;

        if (
          cmsg.attachments &&
          (attachment = cmsg.attachments.find(
            (a) => a.content_type === "text/plain; charset=utf-8"
          ))
        ) {
          try {
            data = await this.fetchFile(attachment.url);
          } catch (err) {
            isError = true;
          }
        } else {
          try {
            data = JSON.parse(cmsg.content);
          } catch {
            isError = true;
          }
        }

        if (isError || !data) {
          return this.errorMessage(cmsg, "Specify a valid json string.");
        }
        if (!Array.isArray(data)) {
          data = [data];
        }
        cmsg.channel.createMessage({ embeds: data }).catch(() => {
          this.errorMessage(cmsg, "Embed content too long/invalid data");
        });
      }
    });
  }
  async execute({ message }: ExecuteArgs) {
    const msg = await message.channel
      .createMessage({
        content:
          "**Embed builder:** <https://proton-bot.net/embed-builder>\nPlease select an option. It's recommended that you have the JSON string of embeds ready before running this command",
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                custom_id: "btn_jsonembed_create_message",
                style: 2,
                label: "Create new message",
              },
              {
                type: 2,
                custom_id: "btn_jsonembed_edit_message",
                style: 2,
                label: "Edit my message",
              },
            ],
          },
        ],
      })
      .catch(() => null);
    if (!msg) {
      return;
    }
    const listener = new ComponentListener(this.client, msg, {
      expireAfter: 20_000,
      repeatTimeout: false,
      userID: message.author.id,
      componentTypes: [2],
    });
    listener.on("interactionCreate", (interaction) => {
      listener.stop("done");
      if (interaction.data.custom_id === "btn_jsonembed_create_message") {
        this.process(message, 1);
        interaction
          .editParent({
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    custom_id: "btn_jsonembed_create_message",
                    style: 1,
                    label: "Create new message",
                    disabled: true,
                  },
                  {
                    type: 2,
                    custom_id: "btn_jsonembed_edit_message",
                    style: 2,
                    label: "Edit my message",
                    disabled: true,
                  },
                ],
              },
            ],
          })
          .catch(() => null);
        interaction.channel
          .createMessage(
            `<@!${
              (interaction.member ?? interaction.user ?? { id: "" }).id
            }>, please specify a JSON string with embed(s)`
          )
          .catch(() => null);
      } else {
        this.process(message, 2);
        interaction
          .editParent({
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    custom_id: "btn_jsonembed_create_message",
                    style: 2,
                    label: "Create new message",
                    disabled: true,
                  },
                  {
                    type: 2,
                    custom_id: "btn_jsonembed_edit_message",
                    style: 1,
                    label: "Edit my message",
                    disabled: true,
                  },
                ],
              },
            ],
          })
          .catch(() => null);
        interaction.channel
          .createMessage(
            `<@!${
              (interaction.member ?? interaction.user ?? { id: "" }).id
            }>, please specify a channel containing the message I should edit.`
          )
          .catch(() => null);
      }
    });
    listener.on("stop", (reason) => {
      if (reason === "timeout") {
        msg
          .edit({
            content: "Selection time ran out, please use the command again.",
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    custom_id: "btn_jsonembed_create_message",
                    style: 2,
                    label: "Create new message",
                    disabled: true,
                  },
                  {
                    type: 2,
                    custom_id: "btn_jsonembed_edit_message",
                    style: 2,
                    label: "Edit my message",
                    disabled: true,
                  },
                ],
              },
            ],
          })
          .catch(() => null);
      }
    });
    /*let data,
           isError = false;
        try {
           data = JSON.parse(args.join(" "));
        } catch {
           isError = true;
        }

        if (isError) {
           return this.errorMessage(message, "Specify a valid json string.");
        }

        if (!Array.isArray(data)) {
           data = [data];
        }

        message.channel.createMessage({ embeds: data }).catch(() => {
           this.errorMessage(message, "Embed content too long/invalid data");
        });*/
  }
}
export default JSONEmbed;
