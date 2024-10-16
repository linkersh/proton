import { ProtonClient } from "../core/client/ProtonClient";
import { CommandInteraction, Constants } from "eris";
import { parseDuration } from "../utils/Util";
import { collections } from "../core/database/DBClient";
import { EmbedBuilder } from "../utils/EmbedBuilder";
import Command from "../core/structs/ClientCommand";
import prettyMilliseconds from "pretty-ms";
const { ApplicationCommandOptionTypes: OptionType } = Constants;

export default class Reminder extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "reminder";
  description = "Manage your reminders.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "create",
      description: "Create a reminder.",
      options: [
        {
          type: OptionType.STRING,
          name: "time",
          description: "The time to remind you after.",
          required: true,
        },
        {
          type: OptionType.STRING,
          name: "topic",
          description: "What do you want me to remind you about?",
          required: true,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "delete",
      description: "Delete a pending reminder.",
      options: [
        {
          type: OptionType.INTEGER,
          name: "id",
          description: "The id of the reminder to delete.",
          required: true,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "list",
      description: "List all of your reminders.",
    },
  ];
  guildID = null;
  similar(num1: number, num2: number) {
    if (num1 >= num2) {
      return num1 - num2 <= 60 * 1000 * 3;
    }
    if (num1 < num2) {
      return num2 - num1 <= 60 * 1000 * 3;
    }
    return false;
  }

  genID(size: number) {
    const result = [];
    const hexRef = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
    for (let n = 0; n < size; n++) {
      result.push(hexRef[Math.floor(Math.random() * 16)]);
    }
    return result.join("");
  }

  async handler(interaction: CommandInteraction) {
    const userID = (interaction.member ? interaction.member.id : interaction.user?.id) as string;
    const subCommand = interaction.data.options && interaction.data.options[0];
    if (!subCommand || subCommand.type !== OptionType.SUB_COMMAND) return;

    if (subCommand.name === "create" && subCommand.options) {
      const durationOpt = subCommand.options[0];
      if (!durationOpt || durationOpt.type !== OptionType.STRING) return;

      const topicOpt = subCommand.options[1];
      if (!topicOpt || topicOpt.type !== OptionType.STRING) return;

      const parseTime = parseDuration(durationOpt.value);

      if (!parseTime || parseTime.duration < 15_000) {
        return interaction.createMessage({
          content: `You need to specify a valid duration.`,
          flags: 64,
        });
      }

      const reminders = await collections.reminders.findOne({ userID });
      if (reminders && reminders.data.length >= 12) {
        return interaction.createMessage({
          flags: 64,
          content: `You have reached the limit of 12 pending reminders.`,
        });
      }

      const susRemidners = reminders?.data.filter((x) =>
        this.similar(parseTime.duration, x.duration)
      );
      if (susRemidners && susRemidners.length >= 3) {
        return interaction.createMessage({
          flags: 64,
          content: `You have too many similar reminders. Spamming the bot is forbidden!`,
        });
      }

      const reminderID = reminders ? reminders.reminderID + 1 : 1;
      await collections.reminders.updateOne(
        { userID },
        {
          $push: {
            data: {
              duration: parseTime.duration,
              endsAt: Date.now() + parseTime.duration,
              id: reminderID,
              topic: topicOpt.value,
            },
          },
          $inc: { reminderID: 1 },
        },
        { upsert: true }
      );
      return interaction.createMessage(
        `Reminder id: \`${reminderID}\`, ends after: ${prettyMilliseconds(
          parseTime.duration
        )}. Make sure you have your direct messages open!`
      );
    } else if (subCommand.name === "delete" && subCommand.options) {
      const reminderID = subCommand.options[0];
      if (!reminderID || reminderID.type !== OptionType.INTEGER) return;

      await collections.reminders.updateOne(
        { userID },
        { $pull: { data: { id: reminderID.value } } }
      );
      return interaction.createMessage(`Deleted reminder: \`${reminderID.value}\`.`);
    } else {
      const reminders = await collections.reminders.findOne({ userID });
      if (!reminders || reminders.data.length === 0) {
        return interaction.createMessage(`You don't have any reminders.`);
      }

      const builder = new EmbedBuilder().title("Your Reminders").color("theme");
      for (const reminder of reminders.data) {
        const tstamp = `<t:${Math.floor(reminder.endsAt / 1000)}:F>`;
        builder.field(
          `Reminder: ${reminder.id}`,
          `Duration: ${prettyMilliseconds(
            reminder.duration
          )}\nEnds at: ${tstamp}\nTopic: ${reminder.topic.slice(0, 50)}`,
          true
        );
      }
      return interaction.createMessage({
        embeds: [builder.build()],
      });
    }
  }
}
