import AutoMod from ".";
import { GuildTextableChannel, Message } from "eris";
import { AutomodActions } from "../../Constants";
import { ProtonClient } from "../../core/client/ProtonClient";
import { FilterAny, GuildConfig } from "../../core/database/models/GuildConfig";
import { Base } from "../../core/structs/Base";
import prettyMilliseconds from "pretty-ms";
import logger from "../../core/structs/Logger";

export interface Counter {
  messageIDs: Set<string>;
  points: number;
  timestamp: number;
}

export default class Checker extends Base {
  constructor(client: ProtonClient, baseReason: string, warnReason: string) {
    super(client);
    this.baseReason = baseReason;
    this.warnReason = warnReason;
  }
  private readonly container: Map<string, Counter> = new Map();
  private readonly baseReason: string;
  private readonly warnReason: string;

  get automod() {
    const mod = this.client.modules.get("AutoMod");
    if (!mod) {
      throw new Error("Cannot find the AutoMod module.");
    }
    return mod as AutoMod;
  }

  increment(key: string, points: number, messageID: string) {
    const data = this.container.get(key);
    if (!data) {
      this.container.set(key, {
        points: points,
        messageIDs: new Set([messageID]),
        timestamp: Date.now(),
      });
    } else {
      data.points++;
      data.messageIDs.add(messageID);
    }
    return this;
  }

  reset(key: string) {
    this.container.set(key, {
      points: 0,
      messageIDs: new Set([]),
      timestamp: Date.now(),
    });
  }

  get(key: string) {
    return this.container.get(key);
  }

  check(key: string, maxPoints: number, maxTime: number) {
    const data = this.container.get(key);
    if (!data) {
      return false;
    }
    const took = Date.now() - data.timestamp;
    if (took > maxTime * 1000) {
      this.reset(key);
      return false;
    }
    if (maxPoints < data.points) {
      return data;
    } else {
      return false;
    }
  }

  async moderate(
    message: Message<GuildTextableChannel>,
    config: GuildConfig,
    moduleConfig: FilterAny,
    data: Counter
  ) {
    if (moduleConfig.actions & AutomodActions.DELETE_MESSAGE) {
      if (message.channel.permissionsOf(this.client.user.id)?.has("manageMessages")) {
        this.automod.moderator.delete(message.channel.id, Array.from(data.messageIDs));
      }
    }
    if (moduleConfig.actions === AutomodActions.DELETE_MESSAGE) {
      return;
    }
    const took = Date.now() - data.timestamp;
    try {
      await this.automod.moderator.judge(
        message,
        config,
        moduleConfig,
        `${this.baseReason} ${data.points}/${prettyMilliseconds(took)}`,
        `${message.author.mention}, ${this.warnReason}`
      );
    } catch (err) {
      logger.error(`automod: checker: moderate: failed to judge user`, err);
    }
  }
}
