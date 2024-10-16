import { GuildTextableChannel, Message } from "eris";
import { ProtonClient } from "../../core/client/ProtonClient";
import { Base } from "../../core/structs/Base";
import { FilterAny, GuildConfig } from "../../core/database/models/GuildConfig";
import { AutomodActions, PunishmentTypes } from "../../Constants";
import { setTimeout } from "timers/promises";
import logger from "../../core/structs/Logger";
import Moderation from "../Moderation";

export default class Moderator extends Base {
  constructor(client: ProtonClient) {
    super(client);
  }

  get moderation(): Moderation {
    const mod = this.client.modules.get("Moderation");
    if (mod === undefined) {
      throw new Error("Moderation module not loaded.");
    } else {
      return mod as Moderation;
    }
  }

  delete(channelID: string, id: string): void;
  delete(channelID: string, id: string[]): void;
  delete(channelID: string, id: string | string[]): void {
    if (Array.isArray(id)) {
      this.client.deleteMessages(channelID, id).catch((err) => {
        logger.error(`module: automod: moderator: failed to delete messages`, err);
      });
    } else {
      this.client.deleteMessage(channelID, id).catch((err) => {
        logger.error(`module: automod: moderator: failed to delete message`, err);
      });
    }
  }

  async judge(
    message: Message<GuildTextableChannel>,
    config: GuildConfig,
    moduleConfig: FilterAny,
    reason: string,
    warnReason: string
  ) {
    const ban = (moduleConfig.actions & AutomodActions.BAN) > 0,
      kick = (moduleConfig.actions & AutomodActions.KICK) > 0,
      mute = (moduleConfig.actions & AutomodActions.MUTE) > 0,
      warn = (moduleConfig.actions & AutomodActions.WARN) > 0,
      timeout = (moduleConfig.actions & AutomodActions.TIMEOUT) > 0;
    if (ban) {
      let banCase;
      try {
        banCase = await this.moderation.banUser(
          message.channel.guild,
          message.author,
          this.client.user,
          config,
          moduleConfig.duration || 0,
          reason
        );
      } catch (err) {
        logger.error("automod: moderator: failed to ban user", err);
      }

      if (banCase !== undefined) {
        try {
          await this.moderation.createCase(banCase);
        } catch (err) {
          logger.error("automod: moderator: failed to register ban case", err);
        }
      }
    } else if (kick) {
      let kickCase;
      try {
        kickCase = await this.moderation.kickUser(
          message.channel.guild,
          message.member,
          this.client.user,
          config,
          reason
        );
      } catch (err) {
        logger.error("automod: moderator: failed to kick user", err);
      }
      if (kickCase !== undefined) {
        try {
          await this.moderation.createCase(kickCase);
        } catch (err) {
          logger.error("automod: moderator: failed to register kick case", err);
        }
      }
    } else {
      const caseData = [];
      if (warn) {
        if (message.channel.permissionsOf(this.client.user.id)?.has("sendMessages")) {
          message.channel
            .createMessage({
              content: warnReason,
              allowedMentions: { users: true },
            })
            .then((msg) => setTimeout(5000, msg))
            .then((msg) => msg.delete().catch(() => null))
            .catch(() => null);
        }
        let thresholdCases;
        try {
          thresholdCases = await this.moderation.warnWithThresholds(
            message.channel.guild,
            message.member,
            this.client.user,
            reason,
            config
          );
        } catch (err) {
          logger.error("automod: moderator: failed to warn with thresholds", err);
        } finally {
          if (thresholdCases !== undefined) {
            caseData.push(...thresholdCases);
          }
        }
      }

      let muted, timed;
      for (let x = 0; x < caseData.length; x++) {
        const c = caseData[x];
        if (c.type === PunishmentTypes.MUTE) {
          muted = true;
        } else if (c.type === PunishmentTypes.TIMEOUT) {
          timed = true;
        }
      }
      if (mute && !muted) {
        let muteCase;
        try {
          muteCase = await this.moderation.muteUser(
            message.channel.guild,
            message.member,
            this.client.user,
            config,
            moduleConfig.duration || 0,
            reason
          );
        } catch (err) {
          logger.error(
            `automod: moderator: failed to mute user: ${message.author.id} in guild: ${message.guildID}`,
            err
          );
        } finally {
          if (muteCase !== undefined) {
            caseData.push(muteCase);
          }
        }
      } else if (timeout && !timed) {
        let timeoutCase;
        try {
          timeoutCase = await this.moderation.timeoutUser(
            message.channel.guild,
            message.author,
            this.client.user,
            reason,
            moduleConfig.duration || 0
          );
        } catch (err) {
          logger.error(
            `automod: moderator: failed to timeout user: ${message.author.id} in guild: ${message.guildID}`,
            err
          );
        } finally {
          if (timeoutCase !== undefined) {
            caseData.push(timeoutCase);
          }
        }
      }
      this.moderation
        .createCase(caseData)
        .catch((err) => logger.error("automod: moderator: failed to create cases", err));
    }
  }
}
