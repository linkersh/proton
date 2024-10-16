import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";

class Welcome extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "welcome",
      description:
        "**Docs:** [here](https://docs.proton-bot.net/features/gateway-and-auto-roles#welcome-message)\nSend a message when a new user joins this server.",
      usage: "",
      category: "config",
      cooldown: 3000,
      aliases: ["welcomemessage", "welcome-message"],
      commands: [
        {
          name: "message",
          desc: "Set a custom welcome message.",
          usage: "<content>",
          cooldown: 3000,
        },
        {
          name: "channel",
          desc: "Set a welcome channel.",
          usage: "<channel>",
          cooldown: 3000,
        },
        {
          name: "tags",
          desc: "See all the welcome message tags",
          cooldown: 2500,
        },
        {
          name: "disable",
          desc: "Disable welcome messages",
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
      return this.errorMessage(message, "Specify a welcome message.");
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "welcome_message.message": msg } }
    );
    this.successMessage(message, "Welcome message updated.");
  }
  async channel({ message, args }: ExecuteArgs) {
    const channel = this.parseChannel(args.join(" "), message.channel.guild);
    if (!channel) {
      return this.errorMessage(message, "Specify a valid channel.");
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "welcome_message.channel_id": channel.id } }
    );
    this.successMessage(message, `Welcome channel set to: ${channel.mention}`);
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $unset: { welcome_message: "" } }
    );
    this.successMessage(message, `Welcome message disabled.`);
  }
  tags({ message }: ExecuteArgs) {
    const userProps = [
      {
        name: "user:id",
        desc: "ID of the new joined user.",
      },
      {
        name: "user:username",
        desc: "Username of the new joined user.",
      },
      {
        name: "user:discriminator",
        desc: "Discriminator of the new joined user.",
      },
      {
        name: "user:avatarURL",
        desc: "Avatar url of the user.",
      },
      {
        name: "user:bot",
        desc: "Whether the joined user is a bot.",
      },
    ];
    const serverProps = [
      {
        name: "server:id",
        desc: "Server's id that the new user joined.",
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
        desc: "Server owner's user id.",
      },
    ];
    let str = "";
    str += `**User Tags:**`;
    str += `\n\`\`\`${userProps.map((x) => `{${x.name}} ${x.desc}`).join("\n")}\`\`\``;
    str += `\n**Server Tags:**`;
    str += `\n\`\`\`${serverProps.map((x) => `{${x.name}} ${x.desc}`).join("\n")}\`\`\``;
    str += `\n**Other tags:**`;
    str += `\n\`\`\`{dm}\`\`\``;
    message.channel.createMessage(str);
  }
}
export default Welcome;
