import { ProtonClient } from "../core/client/ProtonClient.js";
import { collections } from "../core/database/DBClient.js";
import { TrialStatus } from "../core/database/models/GuildConfig.js";
import ClientModule from "../core/structs/ClientModule.js";
import logger from "../core/structs/Logger.js";
import Logger from "../core/structs/Logger.js";
import { SequentialTimeQueue } from "../utils/SequentialTimeQueue.js";

class Subscriptions extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "Subscriptions");
    let scheduleCounter = 0;
    setInterval(() => {
      scheduleCounter++;
      if (scheduleCounter === 2) {
        scheduleCounter = 0;
        this.checkSupportGuild();
      }
      this.checkTrials();
      this.check();
    }, 60_000 * 10);
  }
  dmQueue = new SequentialTimeQueue({ timeFrame: 3000 });

  sendNotif(id: string, text: string) {
    this.dmQueue.add(() => {
      this.client
        .getDMChannel(id)
        .then((channel) => channel.createMessage(text))
        .catch((err) => Logger.error(`module: Subscriptions: failed to dm a user`, err));
    });
  }
  async checkSupportGuild() {
    let data;
    try {
      data = await collections.subscriptions
        .find({ boosted: true }, { projection: { servers: 1, userID: 1, _id: 0 } })
        .toArray();
    } catch (err) {
      Logger.error(`module: Subscriptions: failed to fetch subscriptions`, err);
    }
    if (!data) {
      return;
    }
    const guild = this.client.guilds.get("734738011819868193");
    if (!guild) {
      return Logger.warn(
        `module: Subscriptions: no support-server found when trying to check for users that unboosted.`
      );
    }
    const toRemove = [];
    for (const sub of data) {
      let member = guild.members.get(sub.userID);
      if (!member) {
        try {
          member = await this.client.getRESTGuildMember(guild.id, sub.userID);
        } catch {
          // eslint-disable-next-line
        }
      }
      if (member && !guild.members.has(member.id)) {
        guild.members.add(member, guild);
      }
      if (!member || !member.premiumSince) {
        toRemove.push(sub.userID);
      }
    }
    collections.subscriptions
      .updateMany(
        { userID: { $in: toRemove } },
        {
          $set: {
            expiresAt: new Date(Date.now() - 3.154e11),
            boosted: false,
          },
        } // 20 years ago
      )
      .catch((err) => {
        Logger.error(
          `module: Subscriptions: failed to remove boosters that no longer boost from subscriptions`,
          err
        );
      });
  }
  async check() {
    const date = new Date(Date.now() + 1.728e8);
    let subs;
    try {
      subs = await collections.subscriptions
        .find({ expiresAt: { $lte: date }, boosted: { $ne: true } })
        .toArray();
    } catch (err) {
      Logger.error(`module: Subscriptions: failed to retrieve expired subs:`, err);
    }
    if (!subs || subs.length <= 0) {
      return;
    }
    const serverIds: string[] = [];
    const notifiedIds: string[] = [];
    const removeIds: string[] = [];
    for (const sub of subs) {
      if (Date.now() >= sub.expiresAt.getTime()) {
        serverIds.push(...(sub.servers || []));
        removeIds.push(sub.userID);
        this.sendNotif(sub.userID, `Your premium subscription has expired!`);
      } else {
        if (sub.expiresAt && sub.expiresAt.getTime() - Date.now() < 1.728e8 && !sub.notified) {
          notifiedIds.push(sub.userID);
          this.sendNotif(sub.userID, `Your premium subscription will expire in 2 days!`);
        }
      }
    }
    if (serverIds.length) {
      collections.guildconfigs
        .updateOne({ _id: { $in: serverIds } }, { $set: { isPremium: false } })
        .catch((err) => {
          Logger.crit(
            `module: Subscriptions: failed to remove some servers from premium subscription: ${serverIds.join(
              ","
            )}`,
            err
          );
        });
    }
    if (notifiedIds.length) {
      collections.subscriptions
        .updateMany({ userID: { $in: notifiedIds } }, { $set: { notified: true } })
        .catch((err) => {
          Logger.error(`module: Subscriptions: failed to update notified users`, err);
        });
    }
    if (removeIds.length) {
      collections.subscriptions
        .updateMany(
          { userID: { $in: removeIds } },
          {
            $unset: {
              notified: "",
              expiresAt: "",
              serverSlots: "",
              price: "",
              boosted: "",
            },
          }
        )
        .catch((err) => {
          Logger.crit(
            `module: Subscription: failed to remove some users from premium subscription: ${removeIds.join(
              ","
            )}`,
            err
          );
        });
    }
  }
  addsub(user: string, serverSlots: number, isBooster = false) {
    let price = 0;
    switch (serverSlots) {
      case 1: {
        price = 3;
        break;
      }
      case 2: {
        price = 5;
        break;
      }
      case 3: {
        price = 7;
        break;
      }
      case 4: {
        price = 9;
        break;
      }
      case 5: {
        price = 11;
        break;
      }
      default: {
        if (serverSlots > 5) {
          price = serverSlots * 2;
        }
        break;
      }
    }
    const baseTime = 2.628e9 + 1.728e8;
    const expires = new Date(Date.now() + baseTime * 1);
    return collections.subscriptions.updateOne(
      { userID: user },
      {
        $set: {
          expiresAt: expires,
          price: price,
          serverSlots: serverSlots,
          boosted: isBooster,
        },
        $setOnInsert: { servers: [] },
      },
      { upsert: true }
    );
  }
  async checkTrials() {
    const now = new Date();
    await collections.guildconfigs
      .updateMany(
        {
          trial_status: TrialStatus.ACTIVATED,
          $expr: { $lt: [{ $add: ["$trial_start", 2.592e8] }, now] },
        },
        {
          $set: {
            trial_status: TrialStatus.UNAVAILABLE,
            isPremium: false,
          },
        }
      )
      .catch((err) => logger.error("subscriptions: failed to update expired trials", err));
  }
}
export default Subscriptions;
