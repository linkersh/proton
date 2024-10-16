import {
  ClientLegacyCommand,
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { EmbedBuilder } from "../../utils/EmbedBuilder.js";
import similarity from "string-similarity";
import logger from "../../core/structs/Logger.js";
import { Constants, GuildTextableChannel, Message } from "eris";

const AutomodButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.SECONDARY,
  label: "Automod",
  custom_id: "help_button_automod",
  disabled: false,
};
const ModerationButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.SECONDARY,
  label: "Moderation",
  custom_id: "help_button_moderation",
  disabled: false,
};
const ConfigButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.SECONDARY,
  label: "Config",
  custom_id: "help_button_config",
  disabled: false,
};
const InfoButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.SECONDARY,
  label: "Information",
  custom_id: "help_button_info",
  disabled: false,
};
const LevelsButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.SECONDARY,
  label: "Levels",
  custom_id: "help_button_levels",
  disabled: false,
};
const UtilButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.SECONDARY,
  label: "Util",
  custom_id: "help_button_util",
  disabled: false,
};
const homeButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.PRIMARY,
  label: "Home",
  emoji: {
    name: "🏠",
    id: null,
  },
  custom_id: "help_button_home",
  disabled: true,
};
const InviteButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.LINK,
  label: "Invite",
  url: "https://discord.com/api/oauth2/authorize?client_id=717688673780367362&permissions=4026920182&scope=bot%20applications.commands",
  disabled: true,
};
const DocsButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.LINK,
  label: "Docs\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b\u200b",
  url: "https://docs.proton-bot.net",
  disabled: true,
};
/*const TrialButton = {
   type: Constants.ComponentTypes.BUTTON,
   style: Constants.ButtonStyles.SECONDARY,
   emoji: {
      id: "947860171378528256",
      name: "crown",
      animated: false,
   },
   custom_id: "help_trial",
   disabled: false,
};*/
const TrialButton = {
  type: Constants.ComponentTypes.BUTTON,
  style: Constants.ButtonStyles.SECONDARY,
  emoji: {
    id: null,
    name: "👑",
    animated: false,
  },
  label: "\u200b\u200b\u200b\u200b\u200b\u200bPremium",
  custom_id: "help_trial",
  disabled: false,
};
class Help extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "help",
      description: "View information about commands.",
      usage: "<command_category|command_name>",
      aliases: [],
      category: "information",
      cooldown: 3000,
      userPerms: [],
      clientPerms: ["sendMessages", "embedLinks"],
    });
  }
  formatString(string: string) {
    return `${string[0]?.toUpperCase() || ""}${string.slice(1)}`;
  }
  generateCategoryHelp(category: string) {
    const commands = [...this.client.legacyCommands.values()].filter(
      (command) => command.category === category
    );
    const builder = new EmbedBuilder()
      .title(`${this.formatString(category)} commands`)
      .description(`${commands.map((x) => `\`${x.name}\``).join(", ")}`)
      .color("theme");
    return builder.build();
  }
  async buildDefaultEmbed(channel: GuildTextableChannel, args: string[]) {
    const categories = ["automod", "config", "moderation", "information", "levels", "util"];
    const category = similarity.findBestMatch(args[0]?.toLowerCase() || "", categories);
    if (category.bestMatch && category.bestMatch.rating >= 0.4) {
      return channel.createMessage({
        content: `**Website:** <https://proton-bot.net>`,
        embeds: [this.generateCategoryHelp(category.bestMatch.target)],
      });
    } else {
      const componentsRow1 = [
        homeButton,
        DocsButton,
        AutomodButton,
        ConfigButton,
        ModerationButton,
      ].map((x) => {
        if (x.style !== Constants.ButtonStyles.LINK && x.custom_id === "help_button_home") {
          x.disabled = true;
        } else {
          x.disabled = false;
        }
        return x;
      });
      const componentsRow2 = [TrialButton, InviteButton, InfoButton, LevelsButton, UtilButton].map(
        (x) => {
          x.disabled = false;
          return x;
        }
      );
      const builder = new EmbedBuilder()
        .title("Proton")
        .color("theme")
        .description(`**[Community Server](https://proton-bot.net/support)**`);
      for (const c of categories) {
        builder.field(this.formatString(c), `\`-help ${c}\``, true);
      }
      try {
        await channel.createMessage({
          content: `Welcome to Proton!\n**Documentation for the bot:** https://docs.proton-bot.net\n**Premium:** https://proton-bot.net/premium\n**Website/features:** https://proton-bot.net\n**Embed Builder:** https://proton-bot.net/embed-builder\n**Privacy Policy:** https://proton-bot.net/privacy-policy`,
          embeds: [builder.build()],
          components: [
            { type: 1, components: componentsRow1 },
            { type: 1, components: componentsRow2 },
          ],
        });
      } catch (err) {
        logger.warn(`command: help: failed to send the help message`, err);
        return this.errorMessage(
          { channel } as unknown as Message<GuildTextableChannel>,
          "Failed to send a help embed, please try again later."
        );
      }
      /* const listener = new ComponentListener(this.client, msg, {
            expireAfter: 60_000,
            repeatTimeout: true,
            userID: userID,
            componentTypes: [2],
         });*/

      /* listener.on("interactionCreate", (interaction) => {
            let embed;
            componentsRow1 = componentsRow1.map((x) => {
               x.disabled = false;
               return x;
            });
            componentsRow2 = componentsRow2.map((x) => {
               x.disabled = false;
               return x;
            });
            if (interaction.data.custom_id === "help_button_moderation") {
               componentsRow1[
                  componentsRow1.findIndex(
                     (x) =>
                        x.style !== Constants.ButtonStyles.LINK &&
                        x.custom_id === "help_button_moderation"
                  )
               ].disabled = true;
               embed = generateCategoryHelp("moderation");
            }
            if (interaction.data.custom_id === "help_button_invite") {
               return interaction
                  .createMessage({
                     flags: 64,
                     content: `Here you go: [click me](https://proton-bot.net/invite)`,
                  })
                  .catch((err) => {
                     Logger.warn(`command: help: failed to respond to an interaction`, err);
                  });
            }
            if (interaction.data.custom_id === "help_button_config") {
               componentsRow1[
                  componentsRow1.findIndex(
                     (x) =>
                        x.style !== Constants.ButtonStyles.LINK &&
                        x.custom_id === "help_button_config"
                  )
               ].disabled = true;
               embed = generateCategoryHelp("config");
            }
            if (interaction.data.custom_id === "help_button_automod") {
               componentsRow1[
                  componentsRow1.findIndex(
                     (x) =>
                        x.style !== Constants.ButtonStyles.LINK &&
                        x.custom_id === "help_button_automod"
                  )
               ].disabled = true;
               embed = generateCategoryHelp("automod");
            }
            if (interaction.data.custom_id === "help_button_info") {
               componentsRow2[
                  componentsRow2.findIndex(
                     (x) => "custom_id" in x && x.custom_id === "help_button_info"
                  )
               ].disabled = true;
               embed = generateCategoryHelp("information");
            }
            if (interaction.data.custom_id === "help_button_levels") {
               componentsRow2[
                  componentsRow2.findIndex(
                     (x) => "custom_id" in x && x.custom_id === "help_button_levels"
                  )
               ].disabled = true;
               embed = generateCategoryHelp("levels");
            }
            if (interaction.data.custom_id === "help_button_util") {
               componentsRow2[
                  componentsRow2.findIndex(
                     (x) => "custom_id" in x && x.custom_id === "help_button_util"
                  )
               ].disabled = true;
               embed = generateCategoryHelp("util");
            }
            if (interaction.data.custom_id === "help_trial") {
               embed = new EmbedBuilder()
                  .color("gold")
                  .title("Premium Features")
                  .description(
                     `👑 Proton Script [Examples](https://docs.proton-bot.net)
                     👑 Anti-Spam Raid (\`/spam-raid\`)
                     👑 Anti-Insult [Docs](https://docs.proton-bot.net/features/auto-moderation-1/insults)
                     👑 Username-Moderator [Docs](https://docs.proton-bot.net/features/auto-moderation-1/username-moderator)
                     👑 Family-Friendly [Docs](https://docs.proton-bot.net/features/auto-moderation-1/family-friendly-mode)
                     ... and [more](https://www.patreon.com/protonbot)
                     `
                  )
                  .footer(
                     "You can get premium for $3 per month, or get trial for 3 days per 1 server."
                  )
                  .build();
               return interaction.createMessage({
                  flags: 64,
                  embeds: [embed],
                  components: [
                     {
                        type: Constants.ComponentTypes.ACTION_ROW,
                        components: [
                           {
                              type: Constants.ComponentTypes.BUTTON,
                              style: Constants.ButtonStyles.LINK,
                              label: "Premium",
                              url: "https://www.patreon.com/protonbot",
                           },
                           {
                              type: Constants.ComponentTypes.BUTTON,
                              style: Constants.ButtonStyles.SECONDARY,
                              label: "Activate Trial (3d)",
                              custom_id: "active_trial",
                           },
                        ],
                     },
                  ],
               });
            }
            if (interaction.data.custom_id === "help_button_home") {
               componentsRow1[
                  componentsRow1.findIndex(
                     (x) =>
                        x.style !== Constants.ButtonStyles.LINK &&
                        x.custom_id === "help_button_home"
                  )
               ].disabled = true;
               embed = builder.build();
            }

            if (!embed) {
               return;
            }
            interaction
               .editParent({
                  embeds: [embed],
                  components: [
                     {
                        type: 1,
                        components: componentsRow1,
                     },
                     {
                        type: 1,
                        components: componentsRow2,
                     },
                  ],
               })
               .catch((err) =>
                  Logger.warn(`command: help: failed to respond to an interaction`, err)
               );
         });*/
    }
  }
  execute({ message, args, prefix }: ExecuteArgs) {
    if (this.client.legacyCommands.has(args[0]) || this.client.aliases.has(args[0])) {
      const cmd = this.client.legacyCommands.get(
        this.client.aliases.get(args[0]) || args[0]
      ) as ClientLegacyCommand;
      return cmd.getHelp(message, prefix);
    }
    return this.buildDefaultEmbed(message.channel, args);
  }
}
export default Help;
