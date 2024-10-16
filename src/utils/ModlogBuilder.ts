import prettyMilliseconds from "pretty-ms";
import { Embed } from "eris";
import { DefaultAvatar, PunishmentColors, PunishmentTypes } from "../Constants";
import { CaseUser } from "../core/database/models/Case";
import { getTag } from "./Util";

export default class ModlogBuilder {
  private _reason = "";
  private _target?: CaseUser;
  private _moderator?: CaseUser;
  private _duration = 0;
  private _action: PunishmentTypes = -1;
  private _id = -1;

  id(id: number) {
    this._id = id;
    return this;
  }

  reason(text: string) {
    this._reason = text;
    return this;
  }

  target(target: CaseUser) {
    this._target = target;
    return this;
  }

  moderator(moderator: CaseUser) {
    this._moderator = moderator;
    return this;
  }

  duration(duration: number) {
    this._duration = duration;
    return this;
  }

  action(action: PunishmentTypes) {
    this._action = action;
    return this;
  }

  private formatAction(action: PunishmentTypes) {
    switch (action) {
      case PunishmentTypes.BAN:
        return "ban";
      case PunishmentTypes.KICK:
        return "kick";
      case PunishmentTypes.MUTE:
        return "mute";
      case PunishmentTypes.SOFTBAN:
        return "soft-ban";
      case PunishmentTypes.TIMEOUT:
        return "timeout";
      case PunishmentTypes.UNBAN:
        return "un-ban";
      case PunishmentTypes.UNMUTE:
        return "un-mute";
      case PunishmentTypes.USERNAME_MODERATE:
        return "username-moderate";
      case PunishmentTypes.WARN:
        return "warn";
      default:
        return "unknown";
    }
  }

  build() {
    if (!this._target || !this._moderator) {
      throw new Error(`Target or moderator unspecified.`);
    }

    let description = `**Target:** ${getTag(this._target)} (\`${this._target.id}\`)\n`;
    if (this._duration > 0) {
      const time = Math.floor((Date.now() + this._duration) / 1000);
      description += `**Duration:** ${prettyMilliseconds(this._duration)}, <t:${time}:R>\n`;
    }
    description += `**Action:** ${this.formatAction(this._action)}\n`;
    description += `**Reason:** ${this._reason || "No reason specified."}`;
    return {
      author: {
        name: `${getTag(this._moderator)} (${this._moderator.id})`,
        icon_url: this._moderator.avatar_url || DefaultAvatar,
      },
      color: PunishmentColors[this._action],
      description: description,
      thumbnail: { url: this._target.avatar_url },
      timestamp: new Date(),
      footer: { text: `Case ID: ${this._id}` },
    } as Embed;
  }
}
