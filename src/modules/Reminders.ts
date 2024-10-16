import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import prettyMilliseconds from "pretty-ms";
import ClientModule from "../core/structs/ClientModule";
import logger from "../core/structs/Logger";

export default class Reminders extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "Reminders");
    this.startTimer();
  }
  private timer?: NodeJS.Timer;

  startTimer() {
    this.timer = setInterval(() => {
      this.check().catch((err) =>
        logger.error("reminders: failed to check for expired reminders", err)
      );
    }, 80_000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async check() {
    const endsAt = Date.now();
    let reminders;
    try {
      reminders = await collections.reminders
        .find({ "data.endsAt": { $lte: endsAt } }, { projection: { "data.$": 1, userID: 1 } })
        .toArray();
    } catch (err) {
      logger.error("reminders: failed to fetch reminders", err);
    }
    if (!reminders || reminders.length === 0) {
      return;
    }

    for (let x = 0; x < reminders.length; x++) {
      const reminder = reminders[x];
      if (reminder.data.length === 0) {
        continue;
      }
      const ago = Date.now() - (reminder.data[0].endsAt - reminder.data[0].duration);
      this.client
        .getDMChannel(reminder.userID)
        .then((channel) => {
          return channel.createMessage(
            `${prettyMilliseconds(ago)} ago, you wanted me to remind you about: ${
              reminder.data[0].topic
            }`
          );
        })
        .catch((err) => {
          logger.error("reminders: error sending message to user", err);
        });
    }
    collections.reminders
      .updateMany(
        { _id: { $in: reminders.map((x) => x._id) } },
        { $pull: { data: { endsAt: { $lte: endsAt } } } }
      )
      .catch((err) => {
        logger.error("reminders: failed to delete expired reminders", err);
      });
  }
}
