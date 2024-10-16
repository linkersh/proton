import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { getTag, highestRole } from "../../utils/Util";

class Avatar extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "avatar",
      description: "View your or someone's avatar.",
      usage: "[member]",
      aliases: ["av"],
      category: "information",
      cooldown: 3000,
      userPerms: [],
      clientPerms: ["sendMessages", "embedLinks"],
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const member =
      (await this.resolveMember(args.join(" "), message.channel.guild)) || message.member;
    await message.channel.createMessage({
      messageReference: { messageID: message.id },
      embeds: [
        {
          title: `${getTag(member.user)}'s avatar`,
          color: highestRole(member, message.channel.guild)?.color ?? 0x5865f2,
          image: {
            url: member.user.dynamicAvatarURL(undefined, 2048),
          },
        },
      ],
    });
  }
}
export default Avatar;
