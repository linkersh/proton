import { AntiAltsActions } from "../../Constants";
import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";

class AntiAlt extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "antialt",
      description: "Prevent alt accounts from joining your server.",
      usage: "<age|disable|actions>",
      aliases: ["anti-alt"],
      cooldown: 3000,
      category: "automod",
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
      premiumOnly: true,
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const lowerCase = args[0]?.toLowerCase();
    if (lowerCase === "age") {
      const age = parseInt(args[1]);
      if (age <= 0 || isNaN(age)) {
        return this.errorMessage(
          message,
          `Age needs to be above 0!\n**Note:** Age is in __days__!`
        );
      }
      const inMs = age * 8.64e7;
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $set: { "automod.antiAlts": { minAge: inMs } } }
      );
      this.successMessage(message, `Minimum account age set to **${age}** days.`);
    } else if (lowerCase === "disable") {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $unset: { "automod.antiAlts": "" } }
      );
      this.successMessage(message, `Disabled anti-alts module.`);
    } else if (lowerCase === "actions") {
      const input = args[1]?.toLowerCase() as keyof typeof AntiAltsActions | undefined;
      if (!input || !AntiAltsActions[input]) {
        return this.errorMessage(message, `Specify a valid action from: ban, kick, mute.`);
      }
      await collections.guildconfigs.updateOne(
        {
          _id: message.guildID,
        },
        {
          $set: {
            "automod.antiAlts.action": AntiAltsActions[input],
          },
        }
      );
      this.successMessage(message, `Set action to: ${args[1].toLowerCase()} for anti-alts.`);
    } else {
      return this.errorMessage(
        message,
        `Please specify a valid option: \`disable\`, \`actions\` or \`age\`.\n**Warning:** the system will not work unless you set both actions and the age field. If you disable the system you will have to set the fields again.`
      );
    }
  }
}
export default AntiAlt;
