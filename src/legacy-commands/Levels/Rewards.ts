import { ProtonClient } from "../../core/client/ProtonClient.js";
import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand.js";
import { EmbedBuilder } from "../../utils/EmbedBuilder.js";
import logger from "../../core/structs/Logger.js";

class Rewards extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "rewards",
      description: "Full list of Levelling rewards.",
      usage: "",
      aliases: ["perks", "level-perks"],
      cooldown: 2000,
      category: "levels",
      userPerms: [],
      clientPerms: ["sendMessages", "embedLinks"],
    });
  }
  execute(ctx: ExecuteArgs) {
    if (!ctx.config.levels || !ctx.config.levels.rewards?.length) {
      return this.errorMessage(ctx.message, `There aren't any level rewards here...`);
    }
    const rewards = ctx.config.levels.rewards
      .filter((r) => ctx.message.channel.guild.roles.has(r.role_id))
      .sort((a, b) => a.level - b.level);
    const builder = new EmbedBuilder()
      .title("Level rewards")
      .description(
        rewards.map((x) => `Level: \`${x.level}\` | Role: <@&${x.role_id}>`).join("\n") ||
          "Empty :("
      )
      .color("theme");
    ctx.message.channel.createMessage({ embeds: [builder.build()] }).catch((err) => {
      logger.warn(`command: rewards:  failed to send message`, err);
    });
  }
}
export default Rewards;
