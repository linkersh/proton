import { ProtonClient } from "../../core/client/ProtonClient.js";
import { collections } from "../../core/database/DBClient.js";
import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand.js";
import { getTag } from "../../utils/Util.js";
import logger from "../../core/structs/Logger.js";
import Levels from "../../modules/Levels.js";

class SetLevel extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "setlevel",
      description: "Set a level of a specific user.",
      usage: "<user> <level>",
      cooldown: 3000,
      category: "levels",
      aliases: [],
      clientPerms: ["sendMessages"],
      userPerms: ["manageGuild"],
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const member = await this.resolveMember(args[0], message.channel?.guild);
    if (!member) {
      return this.errorMessage(
        message,
        "Please mention a valid user or, specify their id or username."
      );
    }
    const level = parseInt(args[1]);
    if (isNaN(level) || level < 0) {
      return this.errorMessage(message, "Level needs to be a number and above or equal to 0.");
    }
    if (level > 100) {
      return this.errorMessage(message, "You cannot set a user's level above 100");
    }
    let currentLevels;
    try {
      currentLevels = await collections.levels.findOne(
        { guildID: message.guildID, userID: member.id },
        { projection: { xp: 1 } }
      );
    } catch (err) {
      logger.error(`command: set-level: failed to update user level`, err);
      return this.errorMessage(message, "Failed to update, please try again later.");
    }
    const levelsMod = this.client.modules.get("Levels") as Levels | undefined;
    if (!levelsMod) {
      logger.error("command: set level: cannot find the levels module.");
      return this.errorMessage(message, "Failed to update, please try again later.");
    }
    const xp = {
      total: levelsMod.totalXp(level),
      required: levelsMod.getTargetXp(level),
      current: 0,
    };
    if (currentLevels && currentLevels.xp.current < xp.required) {
      xp.current = currentLevels.xp.current;
      xp.total += currentLevels.xp.total;
    } else {
      xp.current = 0;
    }
    await collections.levels.updateOne(
      { guildID: message.guildID, userID: member.id },
      {
        $set: { xp, level },
      },
      { upsert: true }
    );
    this.successMessage(message, `Set ${getTag(member.user)}'s level to **${level}**.`);
  }
}
export default SetLevel;
