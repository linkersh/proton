import { ProtonClient } from "../core/client/ProtonClient";
import { EventEmitter } from "node:events";
import { ComponentInteraction, Message, TextableChannel } from "eris";

interface ComponentListenerOptions {
  repeatTimeout: boolean;
  expireAfter: number;
  componentTypes: number[];
  userID?: string;
  filter?: (interaction: ComponentInteraction) => boolean;
}

export type CallBackFunction = (interaction: ComponentInteraction<TextableChannel>) => void;

export declare interface ComponentListener {
  on(event: "interactionCreate", listener: (interaction: ComponentInteraction) => void): this;
  on(event: "stop", listener: (reason: string) => void): this;
}

export class ComponentListener extends EventEmitter {
  constructor(
    client: ProtonClient,
    message: Message<TextableChannel>,
    options: ComponentListenerOptions
  ) {
    super();
    this.client = client;
    this.message = message;
    this.options = options;
    this.onInteraction = this.onInteraction.bind(this);

    const listeners = this.client.componentListeners.get(this.message.id);
    if (listeners) {
      listeners.push(this.onInteraction);
    } else {
      this.client.componentListeners.set(this.message.id, [this.onInteraction]);
    }
    this.timeout = this.setTimeout();
  }
  private readonly options: ComponentListenerOptions;
  private readonly message: Message<TextableChannel>;
  private readonly client: ProtonClient;
  private gotInteraction = false;
  private timeout: NodeJS.Timeout;

  stop(reason: string) {
    const listeners = this.client.componentListeners.get(this.message.id);
    if (listeners) {
      const newListeners = listeners.filter((listener) => listener !== this.onInteraction);
      this.client.componentListeners.set(this.message.id, newListeners);
    }
    this.emit("stop", reason);
    this.removeAllListeners();
  }

  setTimeout() {
    return setTimeout(() => {
      this.checkTime();
    }, this.options.expireAfter);
  }

  checkTime() {
    if (this.options.repeatTimeout && this.gotInteraction) {
      clearTimeout(this.timeout);
      this.gotInteraction = false;
      this.timeout = this.setTimeout();
    } else {
      this.stop("timeout");
    }
  }

  onInteraction(interaction: ComponentInteraction): void {
    if (!this.options.componentTypes.includes(interaction.data.component_type)) {
      return;
    }
    this.gotInteraction = true;
    const userID = interaction.member?.id || interaction.user?.id;
    if (this.options.userID && this.options.userID !== userID) {
      interaction
        .createMessage({
          flags: 64,
          content: `Only <@${this.options.userID}> can use the buttons, you can run the command yourself though!`,
        })
        .catch(() => null);
      return;
    }
    if (this.options.filter !== undefined && !this.options.filter(interaction)) {
      return;
    }
    this.emit("interactionCreate", interaction);
  }
}
