import CommandCooldowns from "../../utils/CommandCooldowns";
import type { ClientLegacyCommand } from "./ClientLegacyCommand";

export class LegacyCommandManager extends Map<string, ClientLegacyCommand> {
  constructor() {
    super();
  }
  readonly cooldowns = new CommandCooldowns();
}
