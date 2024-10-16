import { ProtonClient } from "../../core/client/ProtonClient";
import ClientModule from "../../core/structs/ClientModule";
import DataStore from "./DataStore";

const MAX_TAGS = 100;
const rangeRegex = /^\d+-\d+$/;

const DefaultTags: {
  [key: string]: (data: string, store: DataStore) => string;
} = {
  round: (str) => {
    const num = Number(str);
    if (isNaN(num)) {
      return "";
    }
    return Math.round(num).toString().valueOf();
  },
  floor: (str) => {
    const num = Number(str);
    if (isNaN(num)) {
      return "";
    }
    return Math.floor(num).toString().valueOf();
  },
  random: (str) => {
    const split = str.indexOf(",");
    if (split < 0) {
      return "";
    }
    const min = Number(str.slice(0, split));
    const max = Number(str.slice(split + 1));
    if (isNaN(min) || isNaN(max)) {
      return "";
    }
    const result = Math.floor(Math.random() * (max - min + 1) + min);
    return result.toString().valueOf();
  },
  object: (content, store) => {
    store.tags.set(content, {});
    return "";
  },
  in: (content, store) => {
    const left = content.slice(0, content.indexOf(",")).trim();
    let right = content.slice(content.indexOf(",") + 1).trim();
    const rightData = store.tags.get(right);
    if (rightData && Array.isArray(rightData)) {
      right = store.tags.get(right) as string;
    }
    return String(right.includes(left));
  },
  vector: (content, store) => {
    let nameIdx = content.indexOf("=");
    if (nameIdx === -1) {
      nameIdx = content.length;
    }
    const name = content.slice(0, nameIdx);
    const valuesIdx = content.indexOf("=");
    const values = [];
    if (valuesIdx > -1) {
      const split = content.slice(valuesIdx + 1).split(",");
      if (split && split.length) {
        values.push(...split);
      }
    }
    store.tags.set(name, values);
    return "";
  },
  if: (content) => {
    const condOpen = content.indexOf("(");
    const condClose = content.indexOf(")");
    const condStatement = content.slice(condOpen + 1, condClose).replace(/[\s]/g, "");
    let operator = "";
    function index(char: string) {
      const idx = condStatement.indexOf(char);
      if (idx === -1) {
        return -1;
      }
      operator = char;
      return idx;
    }
    const operatorIdx = index("==") || index("!=") || index("<") || index(">");
    const left = condStatement.slice(0, operatorIdx) || "null";
    const right = condStatement.slice(operatorIdx + operator.length) || "null";
    let cond = false;
    switch (operator) {
      case "==": {
        cond = left === right;
        break;
      }
      case "!=": {
        cond = left !== right;
        break;
      }
      case ">": {
        cond = parseFloat(left) > parseFloat(right);
        break;
      }
      case "<": {
        cond = parseFloat(left) < parseFloat(right);
        break;
      }
      case "<=": {
        cond = parseFloat(left) <= parseFloat(right);
        break;
      }
      case ">=": {
        cond = parseFloat(left) >= parseFloat(right);
        break;
      }
    }
    let endIdx = content.indexOf("(else)");

    if (endIdx < 0) {
      endIdx = content.length;
    } else {
      endIdx += 6;
    }
    content = content.replace("(else)", "");
    if (cond) {
      const truthyBlock = content.slice(content.indexOf("=>") + 2, endIdx);
      if (truthyBlock) {
        return truthyBlock;
      }
    } else {
      const falsyBlock = content.slice(endIdx);
      if (falsyBlock) {
        return falsyBlock;
      }
    }
    return "";
  },
  isNaN: (content) => {
    return String(isNaN(parseInt(content)));
  },
  push: (content, store) => {
    // push: test->ok
    const split = content.indexOf("->");
    if (!split) {
      return "";
    }
    const name = content.slice(0, split);
    if (!name || !store.tags.has(name)) {
      return "";
    }
    const value = content.slice(split + 2);
    if (!value) {
      return "";
    }
    const tag = store.tags.get(name);
    if (!Array.isArray(tag)) {
      return "";
    }
    tag.push(store.tags.has(value) ? store.tags.get(value) : value);
    return "";
  },
};

export default class Parser extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "Parser");
  }
  parse(string: string, tags: unknown[] = []): string {
    let USED_TAGS = 0,
      lastOutput = "",
      lastString = "",
      values = [];
    if (tags && Array.isArray(tags)) {
      values = tags;
    }

    const store = new DataStore(values);
    while (MAX_TAGS > USED_TAGS && lastOutput !== string) {
      lastOutput = string;
      const closeIdx = string.indexOf("}");
      const openIdx = string.slice(0, closeIdx).lastIndexOf("{");
      if (closeIdx === -1 || openIdx === -1) {
        lastString = string;
        break;
      }
      const content = string.slice(openIdx + 1, closeIdx);
      let out = this.analyzeContent(content, store);
      if (typeof out === "undefined") {
        out = "";
      }

      string = string.replace(`{${content}}`, String(out));
      lastString = String(out);
      USED_TAGS++;
    }
    return lastString;
  }

  analyzeContent(content: string, store: DataStore): string {
    content = content.trimStart().trimEnd();
    const colonIndex = content.indexOf(":");
    const name = content.slice(0, colonIndex > -1 ? colonIndex : content.length);
    const tagData = store.tags.get(name) || DefaultTags[name];
    let data = content.slice(colonIndex + 1);
    if (tagData !== null && typeof tagData === "object" && data in (tagData as object)) {
      return (tagData as object)[data as keyof typeof tagData] ?? "null";
    }
    if (typeof tagData === "function") {
      return tagData(data, store) ?? "";
    }
    if (colonIndex < 0) {
      return String(tagData);
    }
    let assignIdx = content.slice(colonIndex + 1).indexOf("=");
    if (assignIdx > -1) {
      assignIdx += colonIndex + 2;
      if (Array.isArray(tagData)) {
        const index = Number(data.slice(0, data.indexOf("=")));
        if (!index || index < 0) {
          return "";
        }
        if (!tagData[index]) {
          return "";
        }
        tagData[index] = data.slice(data.indexOf("=") + 1);
        return "";
      } else if (tagData !== null && typeof tagData === "object") {
        // eslint-disable-next-line
        (tagData as any)[data.slice(0, data.indexOf("=")).trim()] = content.slice(assignIdx);
      }
    }

    if (Array.isArray(tagData)) {
      const newContent = content.slice(colonIndex + 1);
      if (rangeRegex.test(newContent)) {
        const split = newContent.split("-");
        const indexA = Number(split[0]);
        const indexB = Number(split[1]);
        if (indexA > indexB) {
          return "";
        }
        return tagData.slice(indexA, indexB).join(" ");
      } else {
        let sliceNext = false;
        if (newContent.endsWith("+")) {
          sliceNext = true;
        }
        const index = Number(sliceNext ? newContent.slice(0, newContent.indexOf("+")) : newContent);
        if (isNaN(index) || index < 0) {
          return "";
        }
        if (!tagData[index]) {
          return "";
        }
        let indexData = null;
        if (sliceNext) {
          indexData = tagData.slice(index).join(" ");
        } else {
          indexData = tagData[index];
        }
        return indexData ?? "";
      }
    } else if (typeof tagData === "object") {
      const sliceFirstColon = content.slice(colonIndex + 1);
      const str = sliceFirstColon.slice(
        0,
        sliceFirstColon.indexOf(":") > -1 ? sliceFirstColon.indexOf(":") : sliceFirstColon.length
      );
      const objectData = (tagData !== null && (tagData as Record<string, unknown>)[str]) ?? "null";
      if (typeof objectData === "function") {
        return objectData(sliceFirstColon.slice(sliceFirstColon.indexOf(":") + 1), store) ?? "";
      }
      return String(objectData);
    }
    data = data.trim();
    store.tags.set(name, data);
    return "";
  }
}
