import { ModerationTemplateActionTypes } from "../../Constants";
import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import Logger from "../../core/structs/Logger";
import { ComponentListener } from "../../utils/ComponentListener";
import pm from "pretty-ms";
import { collections } from "../../core/database/DBClient";
import Moderation from "../../modules/Moderation";
import { ModerationTemplate } from "../../core/database/models/ModerationTemplates";
import { getTag } from "../../utils/Util";
import { Constants, Message, TextChannel } from "eris";
const {
  ModerationTemplateActionTypes: { MUTE, KICK, BAN, WARN, TIMEOUT },
} = { ModerationTemplateActionTypes };

class Punish extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "punish",
      description: "Select a pre-made punishment for a user.",
      usage: "[template name]",
      aliases: [],
      category: "moderation",
      cooldown: 3000,
      userPerms: ["manageMessages"],
      clientPerms: ["sendMessages"],
    });
  }
  async execute({ message, args, config }: ExecuteArgs) {
    const member = await this.resolveMember(args[0], message.channel.guild).catch((err) => {
      Logger.error(`command: punish: error fetching member`, err);
      return;
    });
    if (!member) {
      return this.errorMessage(message, "Specify a valid member to punish.");
    }
    const label = String(args[1] || "").toLowerCase();
    const data = await collections.moderation_templates.findOne({
      _id: message.guildID,
    });
    if (!data || !data.templates || data.templates.length === 0) {
      return this.errorMessage(message, "There are no moderation templates setup.");
    }
    const template = data.templates.find((x) => x.name.toLowerCase() === label);
    const moderate = async (target: ModerationTemplate) => {
      const Moderation = this.client.modules.get("Moderation") as Moderation | undefined;
      if (!Moderation) {
        Logger.error("command: ban: moderation module not loaded");
        return this.errorMessage(message, "Moderation module not loaded.");
      }

      const selfMember = this.client.getSelfMember(message.channel.guild);
      if (!selfMember) {
        return this.errorMessage(message, "Can't get find self member. Please try again later.");
      }
      let action = "";
      if (target.actions & BAN) {
        action = "ban";
      } else if (target.actions & KICK) {
        action = "kick";
      } else if (target.actions & MUTE) {
        action = "mute";
      } else if (target.actions & TIMEOUT) {
        action = "timeout";
      } else if (target.actions & WARN) {
        action = "warn";
      }
      const errMsg = await Moderation.canPunish(
        message.channel.guild,
        message.member,
        member,
        action
      );
      if (errMsg) {
        return this.errorMessage(message, errMsg);
      }
      let reason = args.slice(2).join(" ");
      if (reason.trimStart().length === 0) {
        reason = "No reason provided.";
      }
      if (target.actions & BAN) {
        if (!message.channel.guild.permissionsOf(this.client.user.id).has("banMembers")) {
          return this.errorMessage(message, "I don't have ban members permissions.");
        }
        Moderation.banUser(
          message.channel.guild,
          member.user,
          message.author,
          config,
          target.duration || 0,
          reason
        )
          .then((banCase) => {
            Moderation.createCase(banCase).catch((err) =>
              Logger.error(`command: punish: failed to create ban case`, err)
            );
            let msgStr = `**${getTag(member.user)}** has been banned`;
            if (target.duration > 0) {
              msgStr += ` for ${pm(target.duration)}.`;
            } else {
              msgStr += ".";
            }
            this.successMessage(message, msgStr);
          })
          .catch((err) => {
            Logger.warn(`command: punish: failed to ban user`, err);
            this.errorMessage(message, "Failed to ban that member.");
          });
        return;
      } else if (target.actions & KICK) {
        if (!message.channel.guild.permissionsOf(this.client.user.id).has("kickMembers")) {
          return this.errorMessage(message, "I don't have kick members permissions.");
        }
        Moderation.kickUser(message.channel.guild, member, message.author, config, reason)
          .then((kickCase) => {
            Moderation.createCase(kickCase).catch((err) =>
              Logger.error(`command: punish: failed to create kick case`, err)
            );
            this.successMessage(message, `**${getTag(member.user)}** has been kicked.`);
          })
          .catch((err) => {
            Logger.warn(`command: punish: failed to kick user`, err);
            this.errorMessage(message, "Failed to kick that member.");
          });
        return;
      } else {
        const cases = [],
          actions = [];
        if (target.actions & MUTE) {
          if (!message.channel.guild.permissionsOf(this.client.user.id).has("manageRoles")) {
            return this.errorMessage(message, "I can't manage roles");
          }
          const muteCase = await Moderation.muteUser(
            message.channel.guild,
            member,
            message.author,
            config,
            target.duration || 0,
            reason
          ).catch(() => null);
          if (muteCase) {
            cases.push(muteCase);
            actions.push("muted");
          }
        } else if (target.actions & TIMEOUT && target.duration) {
          const timeoutCase = await Moderation.timeoutUser(
            message.channel.guild,
            member.user,
            message.author,
            reason,
            target.duration
          ).catch((err) => {
            Logger.error(`command: punish: failed to create timeout case`, err);
          });
          if (timeoutCase !== undefined) {
            cases.push(timeoutCase);
            actions.push("timed out");
          }
        }
        if (target.actions & WARN) {
          actions.push("warned");
          cases.push(
            Moderation.warnUser(message.channel.guild, member.user, message.author, config, reason)
          );
        }
        if (!actions.length) {
          return this.errorMessage(
            message,
            "No actions were applied the cause of it could be possibly missing mute role."
          );
        }
        this.successMessage(
          message,
          `**${getTag(member.user)}** has been ${actions.join(" and ")}.`
        );
        Moderation.createCase(cases).catch((err) =>
          Logger.error(`command: punish: failed to create case(s)`, err)
        );
      }
    };
    if (template) {
      moderate(template);
    } else {
      const options = [];
      for (let x = 0; x < data.templates.length; x++) {
        const currentTmp = data.templates[x];
        options.push({
          label: currentTmp.name,
          value: currentTmp.name,
          default: data.templates.length > 1 && x === 0,
        });
      }
      let msg: Message<TextChannel> | undefined;
      try {
        msg = await message.channel.createMessage({
          content: "Select a moderation template.",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 3,
                  custom_id: `mod_template`,
                  options: options,
                  placeholder: "Select a moderation template",
                  max_values: 1,
                },
              ],
            },
          ],
        });
      } catch (err) {
        Logger.warn(`command: punish: failed to create moderation template selection message`, err);
      }
      if (!msg) {
        return this.errorMessage(message, "Failed to render a selection, please try again later.");
      }
      const listener = new ComponentListener(this.client, msg, {
        expireAfter: 30 * 1000,
        userID: message.author.id,
        repeatTimeout: false,
        componentTypes: [3],
      });

      listener.on("interactionCreate", (interaction) => {
        if (interaction.data.component_type !== Constants.ComponentTypes.SELECT_MENU) {
          return;
        }
        const option = interaction.data.values[0];
        const selectedTemplate = data.templates.find(
          (x) => x.name.toLowerCase() === option.toLowerCase()
        );
        if (!selectedTemplate) {
          return interaction
            .editParent({ content: "This template does not exist." })
            .catch((err) => {
              Logger.warn(`command: punish: failed to respond to an interaction`, err);
            });
        }
        moderate(selectedTemplate);
        listener.stop("done");
        interaction
          .acknowledge()
          .then(() => msg?.delete())
          .catch((err) =>
            Logger.warn(`command: punish: failed to ack interaction/delete message`, err)
          );
      });
      listener.on("stop", (reason) => {
        if (reason === "timeout") {
          if (msg && msg.components && msg.components[0]) {
            const btn = msg.components[0].components[0];
            if (btn && btn.type === Constants.ComponentTypes.BUTTON) {
              btn.disabled = true;
            }
          }
          if (msg) {
            msg
              .edit({ components: msg.components })
              .catch((err) =>
                Logger.warn(`command: punish: failed to disable all components`, err)
              );
          }
        }
      });
    }
  }
}
export default Punish;
