import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
class Vote extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "invite",
      description: "Wanna invite me?",
      usage: "",
      aliases: ["invite", "add", "support"],
      category: "information",
      cooldown: 3000,
      userPerms: [],
      clientPerms: ["sendMessages", "embedLinks"],
    });
  }
  execute({ message }: ExecuteArgs) {
    const features = `Auto Moderation, Anti-Raid, Levelling, Reaction Roles, Starboard and sooo much more!`;
    return message.channel.createMessage({
      content: `Add me to your server!\n**Highlighted features:** ${features}`,
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "Invite",
              url: `https://proton-bot.net/invite`,
            },
            {
              type: 2,
              style: 5,
              label: "Support Server",
              url: "https://discord.gg/ZJCFSRy",
            },
          ],
        },
      ],
    });
  }
}
export default Vote;
