import axios from "axios";
import ClientModule from "../core/structs/ClientModule";
import { config } from "../Config";
import { ProtonClient } from "../core/client/ProtonClient";

export type ValidAttributes =
  | "TOXICITY"
  | "TOXICITY_EXPERIMENTAL"
  | "SEVERE_TOXICITY"
  | "SEVERE_TOXICITY_EXPERIMENTAL"
  | "TOXICITY_FAST"
  | "IDENTITY_ATTACK"
  | "IDENTITY_ATTACK_EXPERIMENTAL"
  | "INSULT"
  | "INSULT_EXPERIMENTAL"
  | "PROFANITY"
  | "PROFANITY_EXPERIMENTAL"
  | "THREAT"
  | "THREAT_EXPERIMENTAL"
  | "SEXUALLY_EXPLICIT"
  | "FLIRTATION"
  | "ATTACK_ON_AUTHOR"
  | "ATTACK_ON_COMMENTER"
  | "INCOHERENT"
  | "INFLAMMATORY"
  | "LIKELY_TO_REJECT"
  | "OBSCENE"
  | "SPAM"
  | "UNSUBSTANTIAL";
export interface AnalyzeSchemaEntry {
  text?: string;
  type?: "PLAIN_TEXT" | "HTML";
}

export interface RequestAttribute {
  scoreType?: "PROBABILITY";
  scoreThreshold?: number;
}

export interface AnalyzeSchema {
  comment: {
    text: string;
    type?: "PLAIN_TEXT" | "HTML";
  };
  context?: {
    entries: Array<AnalyzeSchemaEntry>;
  };
  requestedAttributes: {
    [K in ValidAttributes]?: RequestAttribute;
  };
  spanAnnotations?: boolean;
  languages?: Array<"en">;
  doNotStore?: boolean;
  clientToken?: string;
  sessionId?: string;
  communityId?: string;
}

export default class Analyzer extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "Analyzer");
  }
  private readonly REQ_PATH = "https://commentanalyzer.googleAPIs.com/v1alpha1/comments:analyze";
  analyze(options: AnalyzeSchema) {
    return new Promise((resolve, reject) => {
      axios
        .post(this.REQ_PATH, options, {
          params: { key: config.secret.googleApi },
        })
        .then((response) => {
          resolve(response.data);
        })
        .catch(reject);
    });
  }
}
