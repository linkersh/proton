import YAML from "yaml";
import { readFileSync } from "fs";
import { Config } from "./interfaces/Config";

const getConfig = () => {
  const configFile = readFileSync("config.yaml").toString();
  const config = YAML.parse(configFile);
  return config;
};

export const config = getConfig() as Config;
