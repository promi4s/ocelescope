import { SaxesParser } from "saxes";

const READ_LIMIT = 8 * 1024 * 1024;

const RESERVED_KEYS = new Set(["concept:name", "ocel:type"]);

const CLASSIFYING_TYPES = new Set(["string", "int", "boolean", "id"]);

const textStream = (file: File) => {
  const bytes = file.name.toLowerCase().endsWith(".gz")
    ? file.stream().pipeThrough(new DecompressionStream("gzip"))
    : file.stream();
  return bytes.pipeThrough(new TextDecoderStream());
};

const collectTraceKeys = async (file: File) => {
  const parser = new SaxesParser();
  const globalKeys: string[] = [];
  const traceKeys: string[] = [];
  let depth = 0;
  let globalDepth: number | null = null;
  let traceDepth: number | null = null;
  let hasGlobals = false;
  let done = false;

  parser.on("opentag", (tag) => {
    depth += 1;
    if (done) return;
    const key = tag.attributes.key;
    const isAttribute =
      typeof key === "string" && CLASSIFYING_TYPES.has(tag.name);

    if (tag.name === "global" && tag.attributes.scope === "trace") {
      globalDepth = depth;
      hasGlobals = true;
    } else if (tag.name === "trace" && traceDepth === null) {
      traceDepth = depth;
    } else if (tag.name === "event" && traceDepth !== null) {
      done = true;
    } else if (
      isAttribute &&
      globalDepth !== null &&
      depth === globalDepth + 1
    ) {
      globalKeys.push(key);
    } else if (isAttribute && traceDepth !== null && depth === traceDepth + 1) {
      traceKeys.push(key);
    }
  });

  parser.on("closetag", (tag) => {
    if (tag.name === "global" && depth === globalDepth) done = true;
    if (tag.name === "trace" && depth === traceDepth) done = true;
    depth -= 1;
  });

  const reader = textStream(file).getReader();
  let read = 0;
  try {
    while (!done && read < READ_LIMIT) {
      const { done: ended, value } = await reader.read();
      if (ended) break;
      read += value.length;
      parser.write(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return hasGlobals ? globalKeys : traceKeys;
};

export const readXesCaseAttributes = async (file: File) =>
  [...new Set(await collectTraceKeys(file))]
    .filter((key) => !RESERVED_KEYS.has(key))
    .sort();
