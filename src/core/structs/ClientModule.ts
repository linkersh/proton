import { ProtonClient } from "../client/ProtonClient";
import { Base } from "./Base";

export default class ClientModule extends Base {
  constructor(client: ProtonClient, name: string) {
    super(client);
    this.name = name;
  }
  readonly name: string;
}
