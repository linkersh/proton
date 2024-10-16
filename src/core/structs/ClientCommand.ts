import { Base } from "./Base";
import type {
  ApplicationCommandOptions,
  ApplicationCommandTypes,
  AutocompleteInteraction,
  CommandInteraction,
  GuildTextableChannel,
} from "eris";
import type Moderation from "../../modules/Moderation";
import type { ProtonClient } from "../client/ProtonClient";
import { CustomEmojis, UnicodeEmojis } from "../../Constants";

export default interface ClientCommand {
  handler(interaction: CommandInteraction): void;
  autoCompleteHandler?(interaction: AutocompleteInteraction): void;
}

export default interface ClientCommand {
  defaultMemberPermissions?: string;
  dmPermission?: boolean;
  options: ApplicationCommandOptions[];
  type: ApplicationCommandTypes;
  name: string;
  description: string;
  guildID: string | null;
}

export default abstract class ClientCommand extends Base {
  constructor(client: ProtonClient) {
    super(client);
  }

  protected get moderation() {
    const mod = this.client.modules.get("Moderation") as Moderation | undefined;
    if (mod !== undefined) {
      return mod;
    }
    throw new Error("Moderation module not loaded.");
  }

  errorMessage(channel: GuildTextableChannel, message: string) {
    if (channel.permissionsOf(this.client.user.id)?.has("externalEmojis")) {
      return `${CustomEmojis.RedTick} ${message}`;
    } else {
      return `${UnicodeEmojis.Cross} ${message}`;
    }
  }

  successMessage(channel: GuildTextableChannel, message: string) {
    if (channel.permissionsOf(this.client.user.id)?.has("externalEmojis")) {
      return `${CustomEmojis.GreenTick} ${message}`;
    } else {
      return `${UnicodeEmojis.Check} ${message}`;
    }
  }
}
