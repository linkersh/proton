import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import Logger from "../../core/structs/Logger";
import Moderation from "../../modules/Moderation";

class Kick extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "kick",
      description: "Kick a member from the server",
      usage: "<member> [reason]",
      examples: [
        "kick @Linker shut",
        "kick 521677874055479296 Silent kick ™",
        "kick Linker#0001 STOP IT",
      ],
      category: "moderation",
      allowMods: true,
      cooldown: 5000,
      aliases: [],
      clientPerms: ["sendMessages", "kickMembers"],
      userPerms: ["kickMembers"],
    });
  }
  async execute({ message, args, config, prefix }: ExecuteArgs) {
    const Moderation = this.client.modules.get("Moderation") as Moderation | undefined;
    if (!Moderation) {
      Logger.error("command: ban: moderation module not loaded");
      return this.errorMessage(message, "Moderation module not loaded.");
    }

    const member = await this.resolveMember(args[0], message.channel.guild);
    const error = `Specify a member to kick.`;
    if (!member) {
      await message.channel
        .createMessage({
          embeds: [this.getExampleUsage(message, error, prefix)],
        })
        .catch((err) => Logger.warn(`command: kick: failed to create example message`, err));
      return;
    }
    const actionError = await Moderation.canPunish(
      message.channel.guild,
      message.member,
      member,
      "kick"
    );
    if (actionError) {
      return this.errorMessage(message, actionError);
    }
    const reason = args.slice(1).join(" ");
    Moderation.kickUser(message.channel.guild, member, message.member.user, config, reason)
      .then((kickCase) => {
        Moderation.createCase(kickCase).catch((err) =>
          Logger.error("command: kick: failed to create case", err)
        );
        this.successMessage(
          message,
          `**${kickCase.user.username}#${kickCase.user.discriminator}** has been kicked.`
        );
      })
      .catch((err) => {
        Logger.error(`command: kick: failed to kick user`, err);
        this.errorMessage(message, "Failed to kick that user.");
      });
  }
}
export default Kick;
