import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import ClientModule from "../core/structs/ClientModule";
import logger from "../core/structs/Logger";

export default class Stats extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "Stats");
    setInterval(() => {
      this.modStats();
      this.eventStats();
      this.commands();
    }, 60_000 * 5);
  }
  mods = {
    purges: 0,
    bans: 0,
    kicks: 0,
    mutes: 0,
    warns: 0,
    newCases: 0,
    msgDeletes: 0,
  };

  modStats() {
    const date = new Date(Date.now() - 60000 * 60 * 24);
    collections.mod_stats
      .updateOne(
        { timestamp: { $gte: date } },
        {
          $inc: this.mods,
          $setOnInsert: { timestamp: new Date(Date.now()) },
        },
        { upsert: true }
      )
      .then(() => {
        this.mods = {
          purges: 0,
          bans: 0,
          kicks: 0,
          mutes: 0,
          warns: 0,
          newCases: 0,
          msgDeletes: 0,
        };
      })
      .catch((err) => {
        logger.error(`module: stats: failed to update moderation statistics`, err);
      });
  }

  eventStats() {
    const date = new Date(Date.now() - 60000 * 60 * 24);
    const qInc: { [key: string]: number } = {};
    for (const [key, value] of this.client.events) {
      qInc[`events.${key}`] = value;
    }
    if (Object.keys(qInc).length === 0) {
      return;
    }
    collections.event_stats
      .updateOne(
        { timestamp: { $gte: date } },
        { $inc: qInc, $setOnInsert: { timestamp: new Date(Date.now()) } },
        { upsert: true }
      )
      .then(() => {
        this.client.events.clear();
      })
      .catch((err) => {
        logger.error(`module: stats: failed to update event statistics`, err);
      });
  }

  async commands() {
    const date = new Date(Date.now() - 60000 * 60 * 24);
    const data = await collections.command_stats.findOne({
      timestamp: { $gte: date },
    });
    if (data) {
      const commands = data.commands || {};
      for (const [key, value] of this.client.cmdStats) {
        if (commands[key]) {
          commands[key] += value;
        } else {
          commands[key] = value;
        }
      }
      await collections.command_stats
        .updateOne({ _id: data._id }, { $set: { commands } })
        .catch((err) => {
          logger.error(`module: Statistics: failed to update command statistics`, err);
        });
    } else {
      const newCommands: { [key: string]: number } = {};
      for (const [key, value] of this.client.cmdStats.entries()) {
        if (newCommands[key]) {
          newCommands[key] += value;
        } else {
          newCommands[key] = value;
        }
      }
      await collections.command_stats
        .insertOne({
          timestamp: new Date(Date.now()),
          commands: newCommands,
        })
        .catch((err) => {
          logger.error(`module: Statistics: failed to update command statistics`, err);
        });
    }
    this.client.cmdStats.clear();
  }
}
