import {
  ActionRow,
  ActionRowComponents,
  Button,
  ComponentInteraction,
  Constants,
  Role,
} from "eris";
import { ProtonClient } from "../core/client/ProtonClient";
import { genComponentRoleID, getTag, highestRole } from "../utils/Util";
import ClientModule from "../core/structs/ClientModule";
import logger from "../core/structs/Logger";
import { collections } from "../core/database/DBClient";
import { ButtonRolesDataFlags, ComponentRolesData } from "../core/database/models/ComponentRoles";
import { TrialStatus } from "../core/database/models/GuildConfig";
import { EmbedBuilder } from "../utils/EmbedBuilder";
import { config } from "../Config";
import { REQUESTS_CHANNEL_ID, REQUESTS_LOGCHANNEL_ID } from "../Constants";
import Help from "../legacy-commands/Information/Help";
export default class ButtonHandler extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "ButtonHandler");
  }

  private readonly locks = new Set<string>();

  lockButtons(interaction: ComponentInteraction) {
    if (!interaction.message.components) {
      return;
    }

    const components: ActionRow[] = [];
    for (const row of interaction.message.components) {
      const rowComponents: ActionRowComponents[] = [];
      for (const component of row.components) {
        component.disabled = true;
        rowComponents.push(component);
      }
      components.push({
        type: Constants.ComponentTypes.ACTION_ROW,
        components: rowComponents,
      });
    }
    const content = "Message expired, run the command again to access the buttons.";
    interaction
      .editParent({ content, components })
      .catch((err) => logger.error("Failed to disable all components on message", err));
  }

  async onclick(interaction: ComponentInteraction) {
    if (!interaction.guildID || !interaction.member || !("guild" in interaction.channel)) {
      return this.lockButtons(interaction);
    }

    const btnID = interaction.data.custom_id;
    if (btnID === "active_trial") {
      if (!interaction.member.permissions.has("administrator")) {
        return interaction
          .createMessage({
            flags: 64,
            content:
              "You need to have **administrator** permission to active trial for this server. Ask an admin to activate trial for this server.",
          })
          .catch((err) =>
            logger.error("button-handler: active trial: failed to respond to interaction.", err)
          );
      }
      const guildConfig = await this.client.getGuildConfig(interaction.guildID);
      if (!guildConfig) {
        return interaction
          .createMessage({
            flags: 64,
            content: "Error! No guild config found. Try again",
          })
          .catch((err) =>
            logger.error("button-handler: active trial: failed to respond to interaction.", err)
          );
      }
      if (interaction.channel.guild.memberCount < 1000) {
        if (guildConfig.trial_status === TrialStatus.REQUESTED) {
          return interaction
            .createMessage({
              flags: 64,
              content: "You have less than 1,000 members and you've already requested for premium.",
            })
            .catch((err) =>
              logger.error("button-handler: active trial: failed to respond to interaction.", err)
            );
        }
        return interaction
          .createMessage({
            flags: 64,
            content:
              'You need atleast 1,000 members to activate trial premium for free. You have less than 1,000 members, so make a request to get premium trial. **By clicking "Request Trial" you agree to being direct messaged by Proton**',
            components: [
              {
                type: Constants.ComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: Constants.ComponentTypes.BUTTON,
                    style: Constants.ButtonStyles.SECONDARY,
                    label: "Request Trial",
                    custom_id: "request_trial",
                  },
                ],
              },
            ],
          })
          .catch((err) =>
            logger.error("button-handler: active trial: failed to respond to interaction.", err)
          );
      }
      if (guildConfig.trial_status === TrialStatus.UNAVAILABLE) {
        return interaction
          .createMessage({
            flags: 64,
            content:
              "Trial has already been used in this server. Consider getting [Premium](<https://proton-bot.net/premium>)",
          })
          .catch((err) =>
            logger.error("button-handler: active trial: failed to respond to interaction.", err)
          );
      }
      if (guildConfig.trial_status === TrialStatus.AVAILABLE) {
        return interaction
          .createMessage({
            flags: 64,
            content:
              "Trial already available, you can activate it by using `-premium activate` at any time.",
          })
          .catch((err) =>
            logger.error("button-handler: active trial: failed to respond to interaction.", err)
          );
      }
      if (guildConfig.trial_status === TrialStatus.ACTIVATED) {
        return interaction
          .createMessage({
            flags: 64,
            content: "Trial already activated.",
          })
          .catch((err) =>
            logger.error("button-handler: active trial: failed to respond to interaction.", err)
          );
      }
      try {
        await collections.guildconfigs.updateOne(
          { _id: interaction.guildID },
          { $set: { trial_status: TrialStatus.AVAILABLE } }
        );
      } catch (err) {
        logger.error("button-handler: active trial: failed to activate trial", err);
        return interaction
          .createMessage({
            flags: 64,
            content: "Failed to make trial.",
          })
          .catch((err) =>
            logger.error("button-handler: active trial: failed to respond to interaction.", err)
          );
      }
      return interaction
        .createMessage({
          flags: 64,
          content: "Trial available! You can activate it by using `/activate-trial` at any time.",
        })
        .catch((err) =>
          logger.error("button-handler: active trial: failed to respond to interaction.", err)
        );
    } else if (btnID === "request_trial") {
      if (!interaction.member.permissions.has("administrator")) {
        return interaction
          .createMessage({
            flags: 64,
            content:
              "You need to have **administrator** permission to active trial for this server. Ask an admin to activate trial for this server.",
          })
          .catch((err) =>
            logger.error("button-handler: active trial: failed to respond to interaction.", err)
          );
      }
      /*try {
            await interaction.defer(64);
         } catch (err) {
            logger.error("button handler: failed to defer interaction", err);
            return;
         }*/
      try {
        await collections.guildconfigs.updateOne(
          { _id: interaction.guildID },
          { $set: { trial_status: TrialStatus.REQUESTED } }
        );
      } catch (err) {
        logger.error("button-handler: failed to update guild config", err);
        return interaction
          .editParent({
            content: `Failed to send request! Try again.`,
            components: [],
          })
          .catch((err) =>
            logger.error("button-handler: active trial: failed to respond to interaction.", err)
          );
      }
      const owner = await this.client.getUser(interaction.channel.guild.ownerID);
      const requestEmbed = new EmbedBuilder();
      requestEmbed
        .title("New Request")
        .field("Requester", `${getTag(interaction.member.user)} (${interaction.member.id})`, true)
        .field("Guild", `${interaction.channel.guild.name} (${interaction.channel.guild.id})`, true)
        .field(
          "Member count",
          `${interaction.channel.guild.memberCount.toLocaleString()} members`,
          true
        )
        .field(
          "Owner",
          `${owner ? getTag(owner) : "Unknown tag"} (${interaction.channel.guild.ownerID})`,
          true
        )
        .field("Guild Description", interaction.channel.guild.description ?? "None", true)
        .thumbnail(interaction.channel.guild.dynamicIconURL(undefined, 256) ?? "")
        .color("theme");
      try {
        await this.client.createMessage(REQUESTS_CHANNEL_ID, {
          embeds: [requestEmbed.build()],
          components: [
            {
              type: Constants.ComponentTypes.ACTION_ROW,
              components: [
                {
                  type: Constants.ComponentTypes.BUTTON,
                  style: Constants.ButtonStyles.SUCCESS,
                  label: "Accept",
                  custom_id: `trial_accept_${interaction.guildID}`,
                },
                {
                  type: Constants.ComponentTypes.BUTTON,
                  style: Constants.ButtonStyles.DANGER,
                  label: "Deny",
                  custom_id: `trial_deny_${interaction.guildID}`,
                },
              ],
            },
          ],
        });
      } catch (err) {
        logger.error("button handler: failed to send request", err);
        return interaction
          .editParent({
            content: "Failed to send request, please try again.",
          })
          .catch((err) =>
            logger.error("button-handler: active trial: failed to respond to interaction.", err)
          );
      }
      return interaction
        .editParent({
          content: `Request sent! You must be in our [discord](<https://proton-bot.net/support>) server so we can contact you!`,
          components: [],
        })
        .catch((err) =>
          logger.error("button-handler: active trial: failed to respond to interaction.", err)
        );
    } else if (btnID.startsWith("trial_accept_")) {
      if (!config.admins.includes(interaction.member.id)) {
        return interaction
          .createMessage("Can't do this.")
          .catch((err) =>
            logger.error("button-handler: active trial: failed to respond to interaction.", err)
          );
      }
      const guildID = btnID.slice(13);
      const userIdValue = interaction.message.embeds[0]?.fields?.find(
        (f) => f.name === "Requester"
      )?.value;
      const guildNameValue = interaction.message.embeds[0]?.fields?.find(
        (f) => f.name === "Guild"
      )?.value;
      let userID = "";
      let guildName = "";
      if (userIdValue) {
        userID = userIdValue.slice(userIdValue.indexOf("(") + 1, userIdValue.indexOf(")"));
      }
      if (guildNameValue) {
        guildName = guildNameValue.slice(0, guildNameValue.indexOf("("));
      }
      const logEmbed = new EmbedBuilder()
        .color("green")
        .title("Trial Accept")
        .field("Guild:", `${guildName} (${guildID})`, true)
        .field("Requester", userID, true)
        .field("Moderator", `${getTag(interaction.member.user)} (${interaction.member.id})`, true)
        .timestamp(new Date());
      this.client
        .createMessage(REQUESTS_LOGCHANNEL_ID, {
          embeds: [logEmbed.build()],
        })
        .catch((err) => {
          logger.error("button-handler: failed to send log to request log channel", err);
        });
      try {
        await collections.guildconfigs.updateOne(
          { _id: guildID },
          {
            $set: {
              trial_status: TrialStatus.AVAILABLE,
            },
          }
        );
      } catch (err) {
        logger.error("button-handler: failed to make trial available for guild", err);
        return interaction
          .createMessage("Failed to accept request.")
          .catch((err) =>
            logger.error("button-handler: active trial: failed to respond to interaction.", err)
          );
      }
      let dmSuccess = false;
      try {
        const dmChannel = await this.client.getDMChannel(userID);
        if (dmChannel) {
          await dmChannel.createMessage(
            `Your request to get free premium trial for 3 days has been accepted, you can now activate it with \`/activate-trial\`.\nServer: ${
              guildName || guildID
            }`
          );
          dmSuccess = true;
        }
      } catch (err) {
        dmSuccess = false;
        logger.warn("button handler: failed to dm user", err);
      }
      return interaction
        .editParent({
          content: `**Accepted** message sent: ${dmSuccess}`,
          components: [
            {
              type: Constants.ComponentTypes.ACTION_ROW,
              components: [
                {
                  type: Constants.ComponentTypes.BUTTON,
                  style: Constants.ButtonStyles.SUCCESS,
                  label: "Accept",
                  custom_id: `mock_trial_accept`,
                  disabled: true,
                },
                {
                  type: Constants.ComponentTypes.BUTTON,
                  style: Constants.ButtonStyles.DANGER,
                  label: "Deny",
                  custom_id: `mock_trial_deny`,
                  disabled: true,
                },
              ],
            },
          ],
        })
        .catch((err) =>
          logger.error("button-handler: active trial: failed to respond to interaction.", err)
        );
    } else if (btnID.startsWith("trial_deny_")) {
      if (!config.admins.includes(interaction.member.id)) {
        return interaction
          .createMessage("Can't do this.")
          .catch((err) =>
            logger.error("button-handler: active trial: failed to respond to interaction.", err)
          );
      }
      const guildID = btnID.slice(11);
      const userIdValue = interaction.message.embeds[0]?.fields?.find(
        (f) => f.name === "Requester"
      )?.value;
      let userID = "";
      if (userIdValue) {
        userID = userIdValue.slice(userIdValue.indexOf("(") + 1, userIdValue.indexOf(")"));
      }
      return interaction
        .createModal({
          title: "Deny trial request",
          components: [
            {
              type: Constants.ComponentTypes.ACTION_ROW,
              components: [
                {
                  type: Constants.ComponentTypes.TEXT_INPUT,
                  style: Constants.TextInputStyles.SHORT,
                  label: "User ID",
                  custom_id: "user_id",
                  value: userID,
                },
              ],
            },
            {
              type: Constants.ComponentTypes.ACTION_ROW,
              components: [
                {
                  type: Constants.ComponentTypes.TEXT_INPUT,
                  style: Constants.TextInputStyles.PARAGRAPH,
                  label: "Reason",
                  custom_id: "deny_reason",
                },
              ],
            },
          ],
          custom_id: `trial_deny_${guildID}`,
        })
        .catch((err) =>
          logger.error("button-handler: active trial: failed to respond to interaction.", err)
        );
    } else if (btnID.startsWith("button_roles-") && !this.locks.has(interaction.guildID)) {
      const roleID = btnID.slice(btnID.indexOf("-") + 1);
      const guild = this.client.guilds.get(interaction.guildID);
      if (!guild) {
        return;
      }
      const role = guild.roles.get(roleID);
      if (!role) {
        try {
          await interaction.createMessage({
            content: `The role you're trying to assign doesn't exist. Please contact this server's admins.`,
            flags: 64,
          });
        } catch (err) {
          logger.error(`button handler: failed to create message`, err);
        }
        return;
      }

      this.locks.add(guild.id);
      try {
        await interaction.defer(64);
      } catch (err) {
        this.locks.delete(guild.id);
        return logger.error("button handler: failed to defer interaction", err);
      }

      const message = interaction.message;
      if (!message.components) {
        this.locks.delete(guild.id);
        return interaction
          .createFollowup({
            flags: 64,
            content: "Failed to do migration.",
          })
          .catch((err) => logger.error(`button handler: failed to respond to an interaction`, err));
      }

      const components: ComponentRolesData[] = [];
      for (let x = 0; x < message.components.length; x++) {
        for (let i = 0; i < message.components[x].components.length; i++) {
          const component = message.components[x].components[i];
          if (
            component.type !== Constants.ComponentTypes.BUTTON ||
            component.style === Constants.ButtonStyles.LINK
          ) {
            continue;
          }

          const customID = genComponentRoleID();
          const roleID = component.custom_id.slice(component.custom_id.indexOf("-") + 1);

          component.custom_id = customID;
          components.push({
            component_type: Constants.ComponentTypes.BUTTON,
            component_id: customID,
            role_ids: [roleID],
            flags: ButtonRolesDataFlags.NORMAL,
          });
        }
      }

      try {
        await collections.component_roles.insertOne({
          channel_id: interaction.channel.id,
          message_id: message.id,
          guild_id: guild.id,
          components: components,
        });
      } catch (err) {
        this.locks.delete(guild.id);
        logger.error("button handler: failed to create component roles", err);
        return interaction
          .createFollowup({
            flags: 64,
            content: "Failed to do migration.",
          })
          .catch((err) => logger.error(`button handler: failed to respond to an interaction`, err));
      }

      try {
        await this.client.editMessage(interaction.channel.id, interaction.message.id, {
          components: message.components,
        });
      } catch (err) {
        logger.error("button handler: failed to create component roles", err);
        interaction
          .createFollowup({
            flags: 64,
            content: "Failed to do migration.",
          })
          .catch((err) => logger.error(`button handler: failed to respond to an interaction`, err));
      } finally {
        this.locks.delete(guild.id);
      }

      interaction
        .createFollowup({
          flags: 64,
          content: "Migration done, try using the buttons again!",
        })
        .catch((err) => logger.error(`button handler: failed to respond to an interaction`, err));
      /*const selfMember = await this.client.getSelfMember(guild);
         if (
            !selfMember ||
            (selfMember && highestRole(selfMember, guild).position < role?.position)
         ) {
            try {
               await interaction.createMessage({
                  content: `I cannot add this role to you due to role hierarchy. Please report this issue to the server's staff.`,
                  flags: 64,
               });
            } catch (err) {
               logger.error(`button handler: failed to create message`, err);
            }
            return;
         }

         if (!selfMember.permissions?.has("manageRoles")) {
            try {
               await interaction.createMessage({
                  content:
                     "I cannot add any roles. Please report this issue to the server's staff.",
                  flags: 64,
               });
            } catch (err) {
               logger.error(`button handler: failed to create message`, err);
            }
            return;
         }

         if (interaction.member.roles.includes(roleID)) {
            try {
               await this.client.removeGuildMemberRole(
                  interaction.guildID,
                  interaction.member.user.id,
                  roleID
               );
            } catch (err) {
               logger.error("button handler: failed to remove member's role", err);
            }
            try {
               await interaction.createMessage({
                  content: `Removed <@&${roleID}> from you.`,
                  flags: 64,
               });
            } catch (err) {
               logger.error(`button handler: failed to create message`, err);
            }
            return;
         } else {
            try {
               await this.client.addGuildMemberRole(
                  interaction.guildID,
                  interaction.member.user.id,
                  roleID
               );
            } catch (err) {
               logger.error("button handler: failed to add a role to a member", err);
            }
            try {
               await interaction.createMessage({
                  content: `Added the <@&${roleID}> role to you.`,
                  flags: 64,
               });
            } catch (err) {
               logger.error(`button handler: failed to create message`, err);
            }
            return;
         }*/
    } else if (btnID.startsWith("cr_")) {
      try {
        await interaction.defer(64);
      } catch (err) {
        logger.error("button-handler: failed to defer interaction", err);
        return;
      }
      const componentRoles = await collections.component_roles.findOne(
        {
          channel_id: interaction.channel.id,
          message_id: interaction.message.id,
        },
        {
          projection: {
            components: { $elemMatch: { component_id: btnID } },
            _id: 0,
          },
        }
      );

      if (!componentRoles || !componentRoles.components) {
        return;
      }

      const componentRoleData = componentRoles.components[0];
      if (!componentRoleData) {
        return;
      }

      const guild = this.client.guilds.get(interaction.guildID);
      if (!guild) {
        return;
      }

      const selfMember = await this.client.getSelfMember(guild);
      if (!selfMember || !selfMember.permissions.has("manageRoles")) {
        try {
          await interaction.createFollowup({
            content: "I cannot add any roles. Please report this issue to the server's staff.",
            flags: 64,
          });
        } catch (err) {
          logger.error(`button handler: failed to create message`, err);
        }
        return;
      }

      const addRoles: Role[] = [];
      const removeRoles: Role[] = [];
      for (const roleID of componentRoleData.role_ids) {
        const role = guild.roles.get(roleID);
        if (!role) {
          continue;
        }
        if (
          !selfMember ||
          (selfMember && highestRole(selfMember, guild).position < role?.position)
        ) {
          continue;
        }

        if (interaction.member.roles.includes(roleID)) {
          removeRoles.push(role);
        } else {
          addRoles.push(role);
        }
      }

      const memberRoles = new Set(interaction.member.roles);
      for (const roleID of addRoles) memberRoles.add(roleID.id);
      for (const roleID of removeRoles) memberRoles.delete(roleID.id);

      try {
        await this.client.editGuildMember(interaction.guildID, interaction.member.id, {
          roles: Array.from(memberRoles),
        });
      } catch (err) {
        logger.error("button handler: failed to add a role to a member", err);
      }

      let msg = "";
      if (addRoles.length > 0) {
        msg += `Gave you: ${addRoles.map((r) => r.name).join(", ")} roles.\n`;
      }
      if (removeRoles.length > 0) {
        msg += `Took from you the: ${removeRoles.map((r) => r.name).join(", ")} roles.`;
      }
      if (msg.length === 0) {
        msg = "No roles changed.";
      }
      interaction.createFollowup({ content: msg, flags: 64 }).catch((err) => {
        logger.error("button handler: failed to create follow up", err);
      });
    } else if (btnID.startsWith("help_") && interaction.message.components) {
      const componentsRow1 = interaction.message.components[0].components.map((comp) => {
        comp.disabled = false;
        return comp;
      }) as Button[];
      const componentsRow2 = interaction.message.components[1].components.map((comp) => {
        comp.disabled = false;
        return comp;
      }) as Button[];
      let embed;
      if (interaction.data.custom_id === "help_button_moderation") {
        componentsRow1[
          componentsRow1.findIndex(
            (x) =>
              x.style !== Constants.ButtonStyles.LINK && x.custom_id === "help_button_moderation"
          )
        ].disabled = true;
        embed = this.generateCategoryHelp("moderation");
      }
      if (interaction.data.custom_id === "help_button_invite") {
        return interaction
          .createMessage({
            flags: 64,
            content: `Here you go: [click me](https://proton-bot.net/invite)`,
          })
          .catch((err) => {
            logger.warn(`command: help: failed to respond to an interaction`, err);
          });
      }
      if (interaction.data.custom_id === "help_button_config") {
        componentsRow1[
          componentsRow1.findIndex(
            (x) => x.style !== Constants.ButtonStyles.LINK && x.custom_id === "help_button_config"
          )
        ].disabled = true;
        embed = this.generateCategoryHelp("config");
      }
      if (interaction.data.custom_id === "help_button_automod") {
        componentsRow1[
          componentsRow1.findIndex(
            (x) => x.style !== Constants.ButtonStyles.LINK && x.custom_id === "help_button_automod"
          )
        ].disabled = true;
        embed = this.generateCategoryHelp("automod");
      }
      if (interaction.data.custom_id === "help_button_info") {
        componentsRow2[
          componentsRow2.findIndex((x) => "custom_id" in x && x.custom_id === "help_button_info")
        ].disabled = true;
        embed = this.generateCategoryHelp("information");
      }
      if (interaction.data.custom_id === "help_button_levels") {
        componentsRow2[
          componentsRow2.findIndex((x) => "custom_id" in x && x.custom_id === "help_button_levels")
        ].disabled = true;
        embed = this.generateCategoryHelp("levels");
      }
      if (interaction.data.custom_id === "help_button_util") {
        componentsRow2[
          componentsRow2.findIndex((x) => "custom_id" in x && x.custom_id === "help_button_util")
        ].disabled = true;
        embed = this.generateCategoryHelp("util");
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
          .footer("You can get premium for $3 per month, or get trial for 3 days per 1 server.")
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
        const categories = ["automod", "config", "moderation", "information", "levels", "util"];
        const builder = new EmbedBuilder()
          .title("Proton")
          .color("theme")
          .description(`**[Community Server](https://proton-bot.net/support)**`);
        for (const c of categories) {
          builder.field(this.formatString(c), `\`-help ${c}\``, true);
        }
        componentsRow1[
          componentsRow1.findIndex(
            (x) => x.style !== Constants.ButtonStyles.LINK && x.custom_id === "help_button_home"
          )
        ].disabled = true;
        embed = builder.build();
      }
      if (!embed) {
        return;
      }
      if (interaction.message.flags & 64) {
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
          .catch((err) => logger.warn(`command: help: failed to respond to an interaction`, err));
      } else {
        interaction
          .createMessage({
            flags: 64,
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
          .catch((err) => logger.warn(`command: help: failed to respond to an interaction`, err));
      }
    } else {
      this.lockButtons(interaction);
    }
  }

  generateCategoryHelp(category: string) {
    return (this.client.legacyCommands.get("help") as unknown as Help).generateCategoryHelp(
      category
    );
  }
  formatString(string: string) {
    return `${string[0]?.toUpperCase() || ""}${string.slice(1)}`;
  }
}
