import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";

class OwnsWhat extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "ownswhat",
      description: ".",
      usage: "<user-id>",
      category: "admin",
      cooldown: 0,
      aliases: [],
      clientPerms: [],
      userPerms: [],
      admin: true,
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const userID = args[0];
    if (!userID) {
      return this.errorMessage(message, "Specify a user id.");
    }
    const guilds = this.client.guilds.filter((g) => g.ownerID === userID);
    if (guilds.length <= 0) {
      return this.errorMessage(message, "Owns nothing.");
    }
    let table = "";
    for (const item of guilds) {
      table += `**${item.name}**\t\`${item.id}\`\t${item.memberCount.toLocaleString()}\n`;
    }
    this.client.createMessage(message.channel.id, table);
  }
}
export default OwnsWhat;
