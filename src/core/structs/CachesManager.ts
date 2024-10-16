import { ProtonClient } from "../client/ProtonClient";
import { Base } from "./Base";

export default class CachesManager extends Base {
  constructor(client: ProtonClient) {
    super(client);

    setInterval(() => {
      this.check();
    }, 60_000 * 30);
  }

  check() {
    this.client.guildConfigCache.clear();
    this.client.reactionRolesCache.clear();
  }
}
