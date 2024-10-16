import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import ClientModule from "../core/structs/ClientModule";
import logger from "../core/structs/Logger";

export default class QuarantinedGuilds extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "QuarantinedGuilds");
    setInterval(() => {
      this.check();
    }, 60 * 60 * 1000 * 4);
  }

  async check() {
    let quarantinedGuilds;
    try {
      quarantinedGuilds = await collections.quarantined_guilds
        .find(
          {
            checked: true,
            createdAt: { $lt: new Date(Date.now() - 2.592e9) },
          },
          { projection: { _id: 1, createdAt: 0, checked: 0 } }
        )
        .toArray();
    } catch (err) {
      logger.error(`quarantined guilds: failed to fetch quarintined_guilds`, err);
    }
    if (!quarantinedGuilds) {
      return;
    }

    const toRemove = quarantinedGuilds.map((x) => x._id);
    if (toRemove.length > 0) {
      const label = "quarantined-guilds: failed to clean up data";
      collections.guildconfigs
        .deleteMany({
          _id: { $in: toRemove },
          isPremium: false,
          unban_date: { $exists: false },
        })
        .catch((err) => logger.error(label, err));
      collections.levels
        .deleteMany({ guildID: { $in: toRemove } })
        .catch((err) => logger.error(label, err));
      collections.cases
        .deleteMany({ guildID: { $in: toRemove } })
        .catch((err) => logger.error(label, err));
      collections.moderations
        .deleteMany({ guildID: { $in: toRemove } })
        .catch((err) => logger.error(label, err));
      collections.starboard_messages
        .deleteMany({ guildID: { $in: toRemove } })
        .catch((err) => logger.error(label, err));
      collections.lockdowns
        .deleteMany({ guildID: { $in: toRemove } })
        .catch((err) => logger.error(label, err));
      collections.tags
        .deleteMany({ guildID: { $in: toRemove } })
        .catch((err) => logger.error(label, err));
      collections.command_configs
        .deleteMany({ guildID: { $in: toRemove } })
        .catch((err) => logger.error(label, err));
      collections.quarantined_guilds
        .deleteMany({ _id: { $in: toRemove } })
        .catch((err) => logger.error(label, err));
      collections.reaction_roles
        .deleteMany({ guildID: { $in: toRemove } })
        .catch((err) => logger.error(label, err));
      collections.component_roles
        .deleteMany({ guild_id: { $in: toRemove } })
        .catch((err) => logger.error(label, err));
      logger.info(`quarantined guilds: deleted all data for ${toRemove.length} guilds`);
    }
  }
}
