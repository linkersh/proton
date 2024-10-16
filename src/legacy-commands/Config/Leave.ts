import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";

class Leave extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "leave",
      description:
        "**Docs:** [here](https://docs.proton-bot.net/features/gateway-and-auto-roles#farewell-message)\nSend a message when a user leaves this server.",
      usage: "",
      category: "config",
      cooldown: 3000,
      aliases: ["leavemessage", "leave-message"],
      commands: [
        {
          name: "message",
          desc: "Set a custom leave message.",
          usage: "<content>",
          cooldown: 3000,
        },
        {
          name: "channel",
          desc: "Set a leave channel.",
          usage: "<channel>",
          cooldown: 3000,
        },
        {
          name: "tags",
          desc: "See all the leave message tags",
          cooldown: 2500,
        },
        {
          name: "disable",
          desc: "Disable leave messages",
          cooldown: 3000,
        },
      ],
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  async message({ message, args }: ExecuteArgs) {
    const msg = args.join(" ");
    if (!msg) {
      return this.errorMessage(message, "Specify a leave message.");
    }
    if (msg.length > 2000) {
      return this.errorMessage(message, "Leave message may not be above 2000 characters.");
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "leave_message.message": msg } }
    );
    this.successMessage(message, "Leave message updated.");
  }
  async channel({ message, args }: ExecuteArgs) {
    const channel = this.parseChannel(args.join(" "), message.channel.guild);
    if (!channel) {
      return this.errorMessage(message, "Specify a valid channel.");
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "leave_message.channel_id": channel.id } }
    );
    this.successMessage(message, `Leave message channel set to: ${channel.mention}`);
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $unset: { leave_message: "" } }
    );
    this.successMessage(message, `Leave message disabled.`);
  }
  async tags({ message }: ExecuteArgs) {
    const userProps = [
      {
        name: "user:id",
        desc: "ID of the user that left.",
      },
      {
        name: "user:username",
        desc: "Username of the user that left.",
      },
      {
        name: "user:discriminator",
        desc: "Discriminator of the user that left",
      },
      {
        name: "user:avatarURL",
        desc: "Avatar url of the user.",
      },
    ];
    const serverProps = [
      {
        name: "server:id",
        desc: "Server's id.",
      },
      {
        name: "server:name",
        desc: "Server's name.",
      },
      {
        name: "server:rtcRegion",
        desc: "Server's rtcRegion.",
      },
      {
        name: "server:memberCount",
        desc: "The current member count in the server.",
      },
      {
        name: "server:iconURL",
        desc: "The server's icon url.",
      },
      {
        name: "server:ownerID",
        desc: "The server owner's user ID.",
      },
    ];
    const userTagStr = `\`\`\`${userProps.map((x) => `{${x.name}} ${x.desc}`).join("\n")}\`\`\``;
    const serverTagStr = `\`\`\`${serverProps
      .map((x) => `{${x.name}} ${x.desc}`)
      .join("\n")}\`\`\``;
    await message.channel.createMessage(
      `**User tags:**\n${userTagStr}\n**Server tags:** ${serverTagStr}`
    );
  }
}
export default Leave;
