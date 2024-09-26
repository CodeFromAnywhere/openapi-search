import { OpenAPIV3 } from "openapi-types";
type NonFunctionKeyNames<T> = Exclude<
  {
    [key in keyof T]: T[key] extends Function ? never : key;
  }[keyof T],
  undefined
>;

type RemoveFunctions<T> = Pick<T, NonFunctionKeyNames<T>>;

export type OpenapiDocument = RemoveFunctions<OpenAPIV3.Document>;

import { load } from "js-yaml";

/**
 * TODO: find a way to return the correct type interface
 */

export const mergeObjectsArray = <T extends { [key: string]: any }>(
  objectsArray: T[],
): T => {
  const result = objectsArray.reduce((previous, current) => {
    return { ...previous, ...current };
  }, {} as T);

  return result;
};

/**
 * Fan out to your own API endpoint.
 *
 * Assumes QSTASH_TOKEN and CRON_SECRET exist.
 */
export const qStashFanOut = async (
  destination: string,
  context: any[],
  /** If the serverless provider gives too many timeouts, try delaying messages to prevent sending them all at once. E.g. if you want to send 100 per second, fill 0.01 here */
  secondDelayPerItem?: number,

  bearerToken?: string,
): Promise<{ error?: string; list?: { error?: string; data?: any }[] }> => {
  const QSTASH_TOKEN = process.env.QSTASH_TOKEN;
  const CRON_SECRET = process.env.CRON_SECRET;
  const QSTASH_BASE_URL = "https://qstash.upstash.io";

  if (!QSTASH_TOKEN || !CRON_SECRET) {
    return { error: "Missing required environment variables" };
  }

  const batchMessages = context.map((body, index) => {
    // NB: add delay if we need
    const delay = secondDelayPerItem
      ? Math.round(index * secondDelayPerItem)
      : undefined;

    const headers: { [k: string]: string } = bearerToken
      ? {
          [`Upstash-Forward-Authorization`]: `Bearer ${bearerToken}`,
        }
      : {};

    if (delay) {
      headers["Upstash-Delay"] = `${delay}s`;
    }
    return {
      destination,
      body: body ? JSON.stringify(body) : undefined,
      headers,
    };
  });
  const totalSize = JSON.stringify(batchMessages).length;

  if (totalSize / batchMessages.length > 500000) {
    return { error: "payload too big, max 500kb per message" };
  }

  // Another issue with fan-out is the max request size must remain under 1MB. This is a simplified implementation that works if all requests are sized equally, to prevent it going over 1mb.
  // A later potential improvement could be to actually slice the batches on size and provide the max request size as param.

  const neededRequests = 2 * (totalSize / 1000000);
  const maxPerRequest = Math.ceil(batchMessages.length / neededRequests);
  // console.log({ totalSize, neededRequests, maxPerRequest });

  const batchMessagesBatches =
    batchMessages.length > maxPerRequest
      ? new Array(Math.ceil(batchMessages.length / maxPerRequest))
          .fill(null)
          .map((_, index) =>
            batchMessages.slice(
              index * maxPerRequest,
              index * maxPerRequest + maxPerRequest,
            ),
          )
      : [batchMessages];

  // console.log(
  //   "msgs",
  //   batchMessages.length,
  //   "batches",
  //   batchMessagesBatches.length,
  //   "max",
  //   maxPerRequest,
  // );

  const list = await Promise.all(
    batchMessagesBatches.map(async (batch) => {
      try {
        const response = await fetch(`${QSTASH_BASE_URL}/v2/batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${QSTASH_TOKEN}`,
          },
          body: JSON.stringify(batch),
        });

        if (!response.ok) {
          return {
            error: `HTTP error! status: ${response.status} - ${
              response.statusText
            } - ${await response.text()}`,
          };
        }

        const data = await response.json();

        return { error: undefined, data };
      } catch (e) {
        return { error: String(e) };
      }
    }),
  );

  const errorCount = list.filter((x) => !!x.error).length;
  if (errorCount > 0) {
    return { error: `${errorCount} errors`, list };
  }

  return { error: undefined, list };
};

/**
 * try-catches js-yaml to turn the yamlString into JSON
 */
export const tryParseYamlToJson = <T = any>(yamlString: string): T | null => {
  // Get document, or throw exception on error
  try {
    const document = load(yamlString);
    return document as T;
  } catch (e: any) {
    // console.log("failed parsing yaml", e?.message);
    return null;
  }
};

/**
 * Removes empty values (null or undefined) from your arrays in a type-safe way
 */
export function notEmpty<TValue extends unknown>(
  value: TValue | null | undefined,
): value is TValue {
  return value !== null && value !== undefined;
}

export type MapFn<T, U> = (currentValue: T, index: number, array: T[]) => U;

const mapItem = async <T, U>(
  mapFn: MapFn<T, U>,
  currentValue: T,
  index: number,
  array: T[],
): Promise<{
  status: "fulfilled" | "rejected";
  value?: U;
  reason?: unknown;
}> => {
  try {
    return {
      status: "fulfilled",
      value: await mapFn(currentValue, index, array),
    };
  } catch (reason) {
    return {
      status: "rejected",
      reason,
    };
  }
};

async function worker(
  id: number,
  generator: ArrayGenerator,
  mapFn: MapFn<any, any>,
  result: any[],
) {
  //console.time(`Worker ${id}`);
  for (let [currentValue, index, array] of generator) {
    //console.time(`Worker ${id} --- index ${index} item ${currentValue}`);

    const mappedResult = await mapItem(mapFn, currentValue, index, array);

    // NB: if mappedResult gets rejected, change nothing!
    if (mappedResult.status === "fulfilled") {
      result[index] = mappedResult.value;
    }

    //console.timeEnd(`Worker ${id} --- index ${index} item ${currentValue}`);
  }
  //console.timeEnd(`Worker ${id}`);
}

type ArrayGenerator = Generator<[any, number, any[]], void, unknown>;

/**
 * NB: Do I really need this? Would be nice not to use generators.
 */
function* arrayGenerator(array: any[]): ArrayGenerator {
  for (let index = 0; index < array.length; index++) {
    const currentValue = array[index];
    const generatorTuple: [any, number, any[]] = [currentValue, index, array];
    yield generatorTuple;
  }
}

/**
 Lets you map over any array with a async function while setting a max. concurrency

 Taken and improved from https://codeburst.io/async-map-with-limited-parallelism-in-node-js-2b91bd47af70
 */
export const mapMany = async <T, U>(
  array: T[],
  mapFn: (item: T, index: number, array: T[]) => Promise<U>,
  /**
   * Limit of amount of items at the same time
   */
  limit?: number,
): Promise<U[]> => {
  const result: U[] = [];

  if (array.length === 0) {
    return result;
  }

  const generator = arrayGenerator(array);
  const realLimit = Math.min(limit || array.length, array.length);
  const workers = new Array(realLimit);

  for (let i = 0; i < realLimit; i++) {
    workers.push(worker(i, generator, mapFn, result));
  }

  // console.log(`Initialized ${limit} workers`);

  await Promise.all(workers);

  return result;
};

const removeCommentsRegex = /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g;

/**
 * if text isn't json, returns null
 */
export const tryParseJson = <T extends unknown>(
  text: string,
  logParseError?: boolean,
): T | null => {
  try {
    const jsonStringWithoutComments = text.replace(
      removeCommentsRegex,
      (m, g) => (g ? "" : m),
    );
    return JSON.parse(jsonStringWithoutComments) as T;
  } catch (parseError) {
    if (logParseError) console.log("JSON Parse error:", parseError);
    return null;
  }
};
export type Casing =
  //camelCase
  | "camel"
  //PascalCase
  | "pascal"
  //snake_case
  | "snake"
  //kebab-case
  | "kebab"
  //CAPITAL_CASE
  | "capital"
  //Human case
  | "human";

/**
 * this function does the same as kebabCase but it also does some more transformation on top
 *
 * useful for making simple URLs and filenames. Kebacase is not enough
 *
 * NB: this is no two way transformation. When slugifying something, information is lost and it cannot be converted back in the original name.
 *
 * TODO: make the tranformations that are done here into smaller util functions and make a clean function that can be ran before running every casing conversion (maybe in a config)
 */
export function slugify(string: string) {
  const a =
    "àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìıİłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;";
  const b =
    "aaaaaaaaaacccddeeeeeeeegghiiiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------";
  const p = new RegExp(a.split("").join("|"), "g");

  return string
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(p, (c) => b.charAt(a.indexOf(c))) // Replace special characters
    .replace(/&/g, "-and-") // Replace & with 'and'
    .replace(/[^\w\-]+/g, "") // Remove all non-word characters
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

/**
 * Slugification for filepaths in specific
 */
export function fileSlugify(string: string) {
  const a =
    "àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìıİłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·,:;";
  const b =
    "aaaaaaaaaacccddeeeeeeeegghiiiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz----";
  const p = new RegExp(a.split("").join("|"), "g");

  return (
    string
      .toString()
      .replace(/\s+/g, "-") // Replace spaces with -
      .replace(p, (c) => b.charAt(a.indexOf(c))) // Replace special characters
      .replace(/&/g, "-and-") // Replace & with 'and'
      // .replace(/[^\w\-]+/g, "") // Remove all non-word characters
      .replace(/\-\-+/g, "-") // Replace multiple - with single -
      .replace(/^-+/, "") // Trim - from start of text
      .replace(/-+$/, "")
  ); // Trim - from end of text
}

/**
 * Besides normal delimiters, every capital letter also marks the start of a new word
 */
const splitCasingDelimiters = (word: string): string[] => {
  const letters = word.split("");
  const allWords = letters.reduce(
    (words, letter) => {
      //get the last word, we know it's always defined because of the initial value of the reduce
      const lastWord: string = words.pop()!;
      //let's also get the last letter
      const lastLetter = lastWord.substring(-1);
      const lastLetterIsLowercase = lastLetter.toUpperCase() !== lastLetter;
      // NB: numbers or special characters are not uppercase in this logic, only letters change.
      const letterIsUppercase = letter.toLowerCase() !== letter;

      /**
       * If the last letter was lowercase and the next one is uppercase
       */
      const shouldCreateNewWord = lastLetterIsLowercase && letterIsUppercase;

      const newSequence = shouldCreateNewWord
        ? [lastWord, letter]
        : [`${lastWord}${letter}`];
      const newWords = words.concat(newSequence);
      return newWords;
    },
    [""],
  );

  return allWords;
  // if it was lowercase but it became upper, it's a new word
};

const nonCasingDelimiters = /[\s,._-]+/; //space, comma, dot, underscore, dash

export const getDelimiter = (target: Casing) => {
  if (target === "capital") return "_";
  if (target === "human") return " ";
  if (target === "kebab") return "-";
  if (target === "snake") return "_";
  return "";
};

export const capitaliseFirstLetter = (word: string) => {
  return word.charAt(0).toUpperCase().concat(word.substring(1));
};

const convertToTargetCasing = (word: string, index: number, target: Casing) => {
  if (target === "capital") return word.toUpperCase();
  if (target === "kebab" || target === "snake") return word.toLowerCase();
  if (target === "pascal") return capitaliseFirstLetter(word);
  if (target === "camel")
    return index === 0 ? word.toLowerCase() : capitaliseFirstLetter(word);

  //human case
  return index === 0 ? capitaliseFirstLetter(word) : word.toLowerCase();
};

/**
 *
 */
export const convertCase = (
  /**
   * NB: texts of more than a sentence are not supported
   */
  text: string,
  target: Casing,
) =>
  text
    .split(nonCasingDelimiters)
    .reduce(
      (all, word) => all.concat(splitCasingDelimiters(word)),
      [] as string[],
    )
    .map((word, index) => convertToTargetCasing(word, index, target))
    .join(getDelimiter(target));

export const camelCase = (text: string) => convertCase(text, "camel");
export const pascalCase = (text: string) => convertCase(text, "pascal");
export const snakeCase = (text: string) => convertCase(text, "snake");
export const kebabCase = (text: string) => convertCase(text, "kebab");
export const capitalCase = (text: string) => convertCase(text, "capital");
export const humanCase = (text: string) => convertCase(text, "human");

/**
 * converts any string to an array of lowercase words
 *
 * format ["word1","word2","word3"] from a string of any casing.
 */
export const lowerCaseArray = (text: string) => {
  return kebabCase(text).split("-");
};

/**
 * function that returns a filter function that can be used as a filter for any array. removes duplicates.
 *
 * optionally takes a compare function that should return a "true" if two instances are equal. if you use this function, make sure to pass a generic of the type the items will have, in order to make this equality function type safe as well
 *
 *
 */
export const onlyUnique2 =
  <U extends unknown>(isEqualFn?: (a: U, b: U) => boolean) =>
  <T extends U>(value: T, index: number, self: T[]) => {
    return (
      self.findIndex((v) => (isEqualFn ? isEqualFn(v, value) : v === value)) ===
      index
    );
  };

/** from https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
 *
 * returns a no-collision deterministic number for a string. can be useful for indexes in the frontend, for example
 */
export const hashCode = (string: string | undefined) => {
  if (!string) {
    return -1;
  }
  var hash = 0,
    i,
    chr;
  if (string.length === 0) return hash;
  for (i = 0; i < string.length; i++) {
    chr = string.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  // this ensures it's always positive
  return hash >>> 0;
};

/**
 * Sets timeout to 5 minutes by default
 *
 * Better fetch that also returns status and statusText along with the raw text result and JSON.
 */
export const fetchWithTimeout = async <T extends any>(
  input: string | Request | URL,
  init?: RequestInit,
  timeoutMs?: number,
  isNoJson?: boolean,
  isNoText?: boolean,
) => {
  const { status, statusText, text, response } = await fetchTextWithTimeout(
    input,
    init,
    timeoutMs,
    isNoText,
  );
  const json =
    text && !isNoJson
      ? tryParseJson<T>(text) || tryParseYamlToJson<T>(text)
      : null;

  return { text, json, status, statusText, response };
};

export const fetchTextWithTimeout = async (
  input: string | Request | URL,
  init?: RequestInit,
  timeoutMs?: number,
  isNoText?: boolean,
) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 300000);

    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    }).catch((err: any) => {
      // console.log({ err });
      console.log(Object.keys(err.cause));
      return err.cause.code as string; // Error caused by fetch
    });

    clearTimeout(timeoutId);

    if (typeof response === "string") {
      return { statusText: response };
    }

    const status = response?.status;
    const statusText = response?.statusText;
    // console.log({ status, statusText });
    const text = isNoText ? undefined : await response.text();

    return { text, status, statusText, response };
  } catch (e) {
    return { text: undefined, status: 500, statusText: "Catched fetch" };
  }
};

const openapis: { [url: string]: OpenapiDocument } = {};

/** Fetches openapi but with cache */
export const fetchOpenapi = async (openapiUrl: string | undefined) => {
  if (!openapiUrl) {
    return;
  }

  if (openapis[openapiUrl]) {
    // NB: cached in memory
    return openapis[openapiUrl];
  }

  const isYaml = openapiUrl.endsWith(".yaml");

  const { json, status, statusText, text } =
    await fetchWithTimeout<OpenapiDocument>(
      openapiUrl,
      {
        headers: isYaml
          ? undefined
          : {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
      },
      30000,
    );

  if (json) {
    // NB: set cache
    openapis[openapiUrl] = json;
  }
  if (!json) {
    console.log("failed fetching openapi", { status, statusText });
  }

  return json || undefined;
};
