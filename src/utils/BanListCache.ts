import { User } from "eris";
import { ProtonClient } from "../core/client/ProtonClient";
import { Base } from "../core/structs/Base";
import logger from "../core/structs/Logger";

interface GuildBan {
  reason?: string | undefined;
  user: User;
}

export default class BanListCache extends Base {
  constructor(client: ProtonClient) {
    super(client);
  }
  private readonly locks: Map<string, Promise<GuildBan[]>> = new Map();
  private readonly bans: Map<string, GuildBan[]> = new Map();
  private timer?: NodeJS.Timer;

  clearBans() {
    this.bans.clear();
  }

  startTimer() {
    this.timer = setTimeout(() => {
      this.clearBans();
    }, 60_000 * 30);
  }

  stopTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  getBanList(guildID: string): Promise<GuildBan[]> {
    return new Promise((resolve) => {
      const op = this.locks.get(guildID);
      if (op !== undefined) {
        op.then(resolve);
        return;
      }

      const inCache = this.bans.get(guildID);
      if (inCache) {
        resolve(inCache);
        return;
      }
      this.locks.set(
        guildID,
        this.client
          .getGuildBans(guildID)
          .then((values) => {
            this.locks.delete(guildID);
            this.bans.set(guildID, values);
            resolve(values);
            return values;
          })
          .catch((err) => {
            logger.error(`ban list cache: failed to fetch ban list for guild: ${guildID}`, err);
            this.locks.delete(guildID);
            resolve([]);
            return [];
          })
      );
    });
  }
}
