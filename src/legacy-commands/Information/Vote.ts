import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
class Vote extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "vote",
      description: "Vote for me 👌",
      usage: "",
      aliases: ["topgg", "dbl"],
      category: "information",
      cooldown: 3000,
      userPerms: [],
      clientPerms: ["sendMessages", "embedLinks"],
    });
  }
  execute({ message }: ExecuteArgs) {
    return message.channel.createMessage({
      content: `Voting helps the bot, here are few links!`,
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "Top.gg",
              url: "https://top.gg/bot/717688673780367362/vote",
            },
            {
              type: 2,
              style: 5,
              label: "Discord Bot List",
              url: "https://discordbotlist.com/bots/proton/upvote",
            },
          ],
        },
      ],
    });
  }
}
export default Vote;
