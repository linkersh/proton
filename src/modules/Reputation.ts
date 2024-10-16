import { getTag } from "../utils/Util";
import { User } from "eris";
import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import ClientModule from "../core/structs/ClientModule";
import logger from "../core/structs/Logger";

interface UserCooldown {
  in: number | null;
  out: number | null;
}

export default class Reputation extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "Reputation");
  }
  static ReputationError = class extends Error {
    constructor(message: string) {
      super(message);
    }
  };
  private readonly cooldowns = new Map<string, UserCooldown>();

  async addRep(from: User, to: User, guildID: string) {
    const currentCooldowns = this.cooldowns.get(from.id + guildID);
    if (currentCooldowns) {
      if (currentCooldowns.out && Date.now() - currentCooldowns.out < 60_1000 * 2) {
        throw new Reputation.ReputationError("You're adding reputation too fast!");
      }
    }

    if (to.bot) {
      throw new Reputation.ReputationError("Reputation cannot be added to bots.");
    }

    if (to.id === from.id) {
      throw new Reputation.ReputationError("Don't try to thank yourself.");
    }

    this.cooldowns.set(from.id + guildID, {
      in: currentCooldowns?.in || null,
      out: Date.now(),
    });

    const toCooldowns = this.cooldowns.get(to.id + guildID);
    if (toCooldowns) {
      if (toCooldowns.in && Date.now() - toCooldowns.in < 30_1000) {
        throw new Reputation.ReputationError(`**${getTag(to)}** is getting thanked too fast.`);
      }
    }

    this.cooldowns.set(to.id + guildID, {
      in: Date.now(),
      out: toCooldowns?.out || null,
    });

    const query = { userID: to.id, guildID: guildID };
    let repData;
    try {
      repData = await collections.reputation.findOne(query);
    } catch (err) {
      logger.error("reputation: failed to retrive user reputation", err);
    }

    if (repData && repData.noRep) {
      throw new Reputation.ReputationError(`**${getTag(to)}** has no reputation on.`);
    }

    try {
      await collections.reputation.updateOne(query, { $inc: { reputation: 1 } }, { upsert: true });
    } catch (err) {
      logger.error("reputation: failed to update user's reputation", err);
    }
  }
}
