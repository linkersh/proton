import { Member, PartialEmoji, PossiblyUncachedMessage } from "eris";
import { ReactionRoleTypes } from "../Constants";
import { ProtonClient } from "../core/client/ProtonClient";
import ClientModule from "../core/structs/ClientModule";
import logger from "../core/structs/Logger";
import { RateLimiter } from "../utils/RateLimiter";
import { highestRole, stringifyEmoji } from "../utils/Util";

export default class ReactionRoles extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "ReactionRoles");
  }
  private readonly ratelimiter = new RateLimiter({
    time: 5000,
    maxPoints: 3,
    interval: true,
  });
  async messageReactionAdd(message: PossiblyUncachedMessage, emoji: PartialEmoji, reactor: Member) {
    if (!message.guildID || !this.ratelimiter.check(reactor.id)) {
      return;
    }

    const guild = this.client.guilds.get(message.guildID);
    if (!guild) {
      return;
    }

    const selfMember = await this.client.getSelfMember(guild);
    if (!selfMember || !selfMember.permissions?.has("manageRoles")) {
      return;
    }

    if (reactor.user.bot) {
      return;
    }

    let reactionRoles;
    try {
      reactionRoles = await this.client.getReactionRoles(guild.id, message.id);
    } catch (err) {
      logger.error(`reaction roles: messageReactionAdd: failed to get reaction role data`, err);
      return;
    }

    if (!reactionRoles) {
      return;
    }
    const reaction = reactionRoles.reactions.find((r) => {
      return emoji.id ? r.emoji.id === emoji.id : emoji.name === r.emoji.name;
    });
    if (!reaction) {
      return;
    }
    const resolvedRole = guild.roles.get(reaction.role);
    if (!resolvedRole) {
      return;
    }
    if (resolvedRole.position > highestRole(selfMember, guild)?.position) {
      try {
        const dmChannel = await this.client.getDMChannel(reactor.id);
        await dmChannel.createMessage(
          `My **highest** role is lower thank the role bound to the emoji ${stringifyEmoji(emoji)}`
        );
      } catch (err) {
        logger.warn("reaction roles: messageReactionAdd: failed to dm user", err);
      }
      return;
    }

    switch (reactionRoles.type) {
      case ReactionRoleTypes.NORMAL: {
        if (reactor.roles.includes(reaction.role)) {
          return;
        }
        this.client.addGuildMemberRole(message.guildID, reactor.id, reaction.role).catch((err) => {
          logger.error("reaction role: messageReactioAdd: failed to add role to user", err);
        });
        break;
      }

      case ReactionRoleTypes.REVERSE: {
        if (!reactor.roles.includes(reaction.role)) {
          return;
        }
        this.client
          .removeGuildMemberRole(message.guildID, reactor.id, reaction.role)
          .catch((err) => {
            logger.error("reaction role: messageReactioAdd: failed to remove role from user", err);
          });
        break;
      }
    }
  }

  async messageReactionRemove(
    message: PossiblyUncachedMessage,
    emoji: PartialEmoji,
    userID: string
  ) {
    if (!message.guildID || !this.ratelimiter.check(userID)) {
      return;
    }
    const guild = this.client.guilds.get(message.guildID);
    if (!guild) {
      return;
    }
    const selfMember = await this.client.getSelfMember(guild);
    if (!selfMember || !selfMember.permissions?.has("manageRoles")) {
      return;
    }

    let reactionRoles;
    try {
      reactionRoles = await this.client.getReactionRoles(guild.id, message.id);
    } catch (err) {
      logger.error(`reaction roles: messageReactionRemove: failed to get reaction role data`, err);
      return;
    }

    if (!reactionRoles) {
      return;
    }
    const reaction = reactionRoles.reactions.find((r) => {
      return emoji.id ? r.emoji.id === emoji.id : r.emoji.name === emoji.name;
    });
    if (!reaction) {
      return;
    }
    const resolvedRole = guild.roles.get(reaction.role);
    if (!resolvedRole) {
      return;
    }
    if (resolvedRole.position > highestRole(selfMember, guild)?.position) {
      try {
        const dmChannel = await this.client.getDMChannel(userID);
        await dmChannel.createMessage(
          `My **highest** role is lower thank the role bound to the emoji ${stringifyEmoji(emoji)}`
        );
      } catch (err) {
        logger.warn("reaction roles: messageReactionRemove: failed to dm user", err);
      }
      return;
    }

    switch (reactionRoles.type) {
      case ReactionRoleTypes.NORMAL: {
        this.client.removeGuildMemberRole(message.guildID, userID, reaction.role).catch((err) => {
          logger.error("reaction role: messageReactionRemove: failed to add role to user", err);
        });
        break;
      }

      case ReactionRoleTypes.REVERSE: {
        this.client.addGuildMemberRole(message.guildID, userID, reaction.role).catch((err) => {
          logger.error(
            "reaction role: messageReactionRemove: failed to remove role from user",
            err
          );
        });
        break;
      }
    }
  }
}
