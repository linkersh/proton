import { ProtonClient } from "../../core/client/ProtonClient";
import ClientModule from "../../core/structs/ClientModule";
import GatewayLogger from "./GatewayLogger";
import MemberLogger from "./MemberLogger";
import MessageLogger from "./MessageLogger";
import RoleLogger from "./RoleLogger";
import ServerLogger from "./ServerLogger";

export default class GuildLogger extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "GuildLogger");
  }
  readonly gateway = new GatewayLogger(this.client);
  readonly member = new MemberLogger(this.client);
  readonly message = new MessageLogger(this.client);
  readonly role = new RoleLogger(this.client);
  readonly server = new ServerLogger(this.client);
}
