import { CommandInteraction, Constants, GuildTextableChannel } from "eris";
import prettyMilliseconds from "pretty-ms";
import { ModerationTemplateActionTypes } from "../Constants";
import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import Command from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";
import { ComponentListener } from "../utils/ComponentListener";
import { EmbedBuilder } from "../utils/EmbedBuilder";
import { parseDuration } from "../utils/Util";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

export default class Template extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "template";
  description = "Manage moderation templates.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "add",
      description: "Add a moderation template.",
      options: [
        {
          name: "name",
          description: "The template's name.",
          type: OptionType.STRING,
          required: true,
        },
        {
          name: "duration",
          description:
            "Duration for the punishments, will only work for: ban, kick, mute or timeout",
          type: OptionType.STRING,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "delete",
      description: "Deleted an existing moderation template.",
      options: [
        {
          type: OptionType.STRING,
          name: "name",
          description: "The name of the moderation template.",
          required: true,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "list",
      description: "List all moderation templates in this server.",
    },
  ];
  guildID = null;
  defaultMemberPermissions = (
    Constants.Permissions.kickMembers &
    Constants.Permissions.banMembers &
    Constants.Permissions.moderateMembers &
    Constants.Permissions.manageMessages
  ).toString();
  dmPermission = false;

  async handler(interaction: CommandInteraction<GuildTextableChannel>) {
    await interaction
      .acknowledge()
      .catch((err) => logger.error("command: button-roles: failed to ack an interaction", err));

    if (interaction.data.options === undefined) return;
    if (!interaction.guildID || !interaction.member) return;

    const guild = await this.client.getGuild(interaction.guildID);
    if (!guild) return;

    const guildConfig = await this.client.getGuildConfig(interaction.guildID);
    if (!guildConfig) return;

    const subCommand = interaction.data.options && interaction.data.options[0];
    if (!subCommand || subCommand.type !== OptionType.SUB_COMMAND) return;

    if (subCommand.name === "add" && subCommand.options) {
      const name = subCommand.options && subCommand.options[0];
      if (!name || name.type !== OptionType.STRING) return;

      let duration = 0;
      const durationOpt = subCommand.options[1];
      if (durationOpt && durationOpt.type === OptionType.STRING) {
        const parsedDur = parseDuration(durationOpt.value);
        if (parsedDur && parsedDur.duration < 30 * 1000) {
          return interaction.createFollowup(
            this.errorMessage(interaction.channel, `Duration can't be lower than 30 seconds.`)
          );
        }
        duration = parsedDur.duration;
      }

      const template = { name: name.value, duration: duration, actions: 0 };
      let templates;
      try {
        templates = await collections.moderation_templates.findOne(
          {
            _id: interaction.guildID,
            templates: { $elemMatch: { name } },
          },
          { projection: { _id: 1, templates: 1 } }
        );
      } catch (err) {
        logger.error("command: template: failed to fetch moderation template", err);
        return interaction
          .createFollowup(this.errorMessage(interaction.channel, `Something went wrong...`))
          .catch((err) =>
            logger.error("command: template: failed to reply to an interaction", err)
          );
      }

      if (templates && templates.templates.find((temp) => temp.name === name.value)) {
        return interaction
          .createFollowup(
            this.errorMessage(interaction.channel, `A template with that name already exists.`)
          )
          .catch((err) =>
            logger.error("command: template: failed to reply to an interaction", err)
          );
      }

      if (templates && templates.templates.length >= 5) {
        return interaction
          .createFollowup(
            this.errorMessage(
              interaction.channel,
              `You can't add more than 5 moderation templates.`
            )
          )
          .catch((err) =>
            logger.error("command: template: failed to reply to an interaction", err)
          );
      }

      let msg;
      try {
        msg = await interaction.createFollowup({
          content: "Select the actions for this moderation template.",
          components: [
            {
              type: Constants.ComponentTypes.ACTION_ROW,
              components: [
                {
                  type: Constants.ComponentTypes.SELECT_MENU,
                  custom_id: `modtemplates_select_actions-${interaction.member.id}`,
                  disabled: false,
                  placeholder: "Select an action",
                  min_values: 1,
                  max_values: 4,
                  options: [
                    {
                      label: "Warn",
                      value: String(ModerationTemplateActionTypes.WARN),
                    },
                    {
                      label: "Mute",
                      value: String(ModerationTemplateActionTypes.MUTE),
                    },
                    {
                      label: "Timeout",
                      value: String(ModerationTemplateActionTypes.TIMEOUT),
                    },
                    {
                      label: "Kick",
                      value: String(ModerationTemplateActionTypes.KICK),
                    },
                    {
                      label: "Ban",
                      value: String(ModerationTemplateActionTypes.BAN),
                    },
                  ],
                },
              ],
            },
          ],
        });
      } catch (err) {
        logger.error("command: template: failed to respond to an interaction", err);
        return;
      }

      const listener = new ComponentListener(this.client, msg, {
        repeatTimeout: false,
        expireAfter: 30_000,
        userID: interaction.member.user.id ?? "",
        componentTypes: [Constants.ComponentTypes.SELECT_MENU],
      });

      listener.on("interactionCreate", (inter) => {
        if (inter.data.component_type !== Constants.ComponentTypes.SELECT_MENU) return;

        const actions = inter.data.values.reduce<number>(
          (prev, curr) => Number(prev) | Number(curr),
          0
        );

        if (
          (actions & ModerationTemplateActionTypes.TIMEOUT) !== 0 &&
          !(Number.isInteger(template.duration) || template.duration < 1)
        ) {
          return inter
            .editParent({
              content: this.errorMessage(
                interaction.channel,
                `You must specify duration for the user timeout.`
              ),
              components: [],
            })
            .catch((err) =>
              logger.error("command: template: failed to reply to an interaction", err)
            );
        }

        if (
          (actions & ModerationTemplateActionTypes.MUTE) !== 0 &&
          (actions & ModerationTemplateActionTypes.TIMEOUT) !== 0
        ) {
          return inter
            .editParent({
              content: this.errorMessage(
                interaction.channel,
                `You can't use timeout and mute actions together.`
              ),
              components: [],
            })
            .catch((err) =>
              logger.error("command: template: failed to reply to an interaction", err)
            );
        }
        template.actions = actions;
        listener.stop("done");
        collections.moderation_templates
          .updateOne(
            { _id: interaction.guildID },
            { $push: { templates: template } },
            { upsert: true }
          )
          .then(() => {
            return interaction
              .createFollowup(
                this.successMessage(
                  interaction.channel,
                  `Created a new template with the name \`${name.value}\`.`
                )
              )
              .catch((err) =>
                logger.error("command: template: failed to reply to an interaction", err)
              );
          })
          .catch((err) => {
            logger.error("command: template: failed to update a moderation template", err);
            return interaction
              .createFollowup(this.errorMessage(interaction.channel, `Something went wrong...`))
              .catch((err) =>
                logger.error("command: template: failed to reply to an interaction", err)
              );
          });
      });
    } else if (subCommand.name === "delete") {
      const name = subCommand.options && subCommand.options[0];
      if (!name || name.type !== OptionType.STRING) return;
      collections.moderation_templates
        .updateOne({ _id: interaction.guildID }, { $pull: { templates: { name: name.value } } })
        .then(() => {
          return interaction
            .createFollowup(
              this.successMessage(
                interaction.channel,
                `Deleted moderation template with the name \`${name.value}\`.`
              )
            )
            .catch((err) =>
              logger.error("command: template: failed to reply to an interaction", err)
            );
        })
        .catch((err) => {
          logger.error("command: template: failed to update a moderation template", err);
          return interaction
            .createFollowup(this.errorMessage(interaction.channel, `Something went wrong...`))
            .catch((err) =>
              logger.error("command: template: failed to reply to an interaction", err)
            );
        });
    } else {
      const builder = new EmbedBuilder().color("theme").title("Moderation templates");
      let data;
      try {
        data = await collections.moderation_templates.findOne({
          _id: interaction.guildID,
        });
      } catch (err) {
        logger.error("command: template: failed to find a moderation template", err);
        return interaction
          .createFollowup(this.errorMessage(interaction.channel, `Something went wrong...`))
          .catch((err) =>
            logger.error("command: template: failed to reply to an interaction", err)
          );
      }
      if (!data || data.templates.length === 0) {
        return interaction
          .createMessage("There are no moderation templates.")
          .catch((err) =>
            logger.error("command: template: failed to reply to an interaction", err)
          );
      }
      for (let x = 0; x < data.templates.length; x++) {
        const template = data.templates[x];
        const actions = [];
        if (template.actions & ModerationTemplateActionTypes.BAN) {
          actions.push("ban");
        }
        if (template.actions & ModerationTemplateActionTypes.KICK) {
          actions.push("kick");
        }
        if (template.actions & ModerationTemplateActionTypes.MUTE) {
          actions.push("mute");
        }
        if (template.actions & ModerationTemplateActionTypes.WARN) {
          actions.push("warn");
        }
        if (template.actions & ModerationTemplateActionTypes.TIMEOUT) {
          actions.push("timeout");
        }
        builder.field(
          template.name,
          `**Duration:** ${
            template.duration ? prettyMilliseconds(template.duration) : "none"
          }\n**Actions:** ${actions.join(", ")}`
        );
      }
      interaction
        .createMessage({ embeds: [builder.build()] })
        .catch((err) => logger.error("command: template: failed to reply to an interaction", err));
    }
  }
}
