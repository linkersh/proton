import { ClientLegacyCommand, SubCommand } from "../core/structs/ClientLegacyCommand";

export default class CommandCooldowns {
  private readonly _cooldowns = new Map();
  addRatelimit(user: string, command: ClientLegacyCommand, subcommand?: SubCommand) {
    let key = "";
    if (subcommand) {
      key = `${user}-${command.name}-${subcommand.name}`;
      this._cooldowns.set(key, null);
      setTimeout(() => {
        this._cooldowns.delete(key);
      }, subcommand.cooldown || command.cooldown);
    } else {
      key = `${user}-${command.name}`;
      this._cooldowns.set(key, null);
      setTimeout(() => {
        this._cooldowns.delete(key);
      }, command.cooldown);
    }
  }
  ratelimited(user: string, command: ClientLegacyCommand, subcommand?: SubCommand) {
    if (subcommand) {
      if (this._cooldowns.has(`${user}-${command.name}-${subcommand.name}`)) {
        return true;
      }
    } else if (this._cooldowns.has(`${user}-${command.name}`)) {
      return true;
    }
    return false;
  }
}
