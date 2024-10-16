import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import ClientModule from "../core/structs/ClientModule";
import logger from "../core/structs/Logger";
import { highestRole } from "../utils/Util";

export default class TimeoutRoles extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "TimeoutRoles");
    this.startTimer();
  }
  timer?: NodeJS.Timer;

  startTimer() {
    this.timer = setTimeout(() => {
      this.checkTimedAutoroles();
    }, 80_000);
  }

  async checkTimedAutoroles() {
    const now = new Date();
    let data;
    try {
      data = await collections.timeout_roles.find({ executeAt: { $lt: now } }).toArray();
    } catch (err) {
      logger.error("autoroles: failed to fetch timeout roles", data);
    }
    if (!data) return;

    for (let x = 0; x < data.length; x++) {
      const job = data[x];
      const guild = await this.client.getGuild(job.guildID);
      if (!guild) continue;

      const selfMember = await this.client.getSelfMember(guild);
      const role = guild.roles.get(job.role);
      if (!selfMember || !role) continue;
      if (role.position >= highestRole(selfMember, guild).position) continue;

      this.client
        .addGuildMemberRole(job.guildID, job.userID, job.role)
        .catch((err) => logger.error("timeout roles: failed to add role", err));
    }

    collections.timeout_roles
      .deleteMany({ executeAt: { $lt: now } })
      .catch((err) => logger.error("timeout roles: failed to delete data", err));
  }
}
