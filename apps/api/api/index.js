var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/query.js
function cachedError(xs) {
  if (originCache.has(xs))
    return originCache.get(xs);
  const x = Error.stackTraceLimit;
  Error.stackTraceLimit = 4;
  originCache.set(xs, new Error());
  Error.stackTraceLimit = x;
  return originCache.get(xs);
}
var originCache, originStackCache, originError, CLOSE, Query;
var init_query = __esm({
  "../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/query.js"() {
    "use strict";
    originCache = /* @__PURE__ */ new Map();
    originStackCache = /* @__PURE__ */ new Map();
    originError = /* @__PURE__ */ Symbol("OriginError");
    CLOSE = {};
    Query = class extends Promise {
      constructor(strings, args, handler, canceller, options = {}) {
        let resolve, reject;
        super((a, b2) => {
          resolve = a;
          reject = b2;
        });
        this.tagged = Array.isArray(strings.raw);
        this.strings = strings;
        this.args = args;
        this.handler = handler;
        this.canceller = canceller;
        this.options = options;
        this.state = null;
        this.statement = null;
        this.resolve = (x) => (this.active = false, resolve(x));
        this.reject = (x) => (this.active = false, reject(x));
        this.active = false;
        this.cancelled = null;
        this.executed = false;
        this.signature = "";
        this[originError] = this.handler.debug ? new Error() : this.tagged && cachedError(this.strings);
      }
      get origin() {
        return (this.handler.debug ? this[originError].stack : this.tagged && originStackCache.has(this.strings) ? originStackCache.get(this.strings) : originStackCache.set(this.strings, this[originError].stack).get(this.strings)) || "";
      }
      static get [Symbol.species]() {
        return Promise;
      }
      cancel() {
        return this.canceller && (this.canceller(this), this.canceller = null);
      }
      simple() {
        this.options.simple = true;
        this.options.prepare = false;
        return this;
      }
      async readable() {
        this.simple();
        this.streaming = true;
        return this;
      }
      async writable() {
        this.simple();
        this.streaming = true;
        return this;
      }
      cursor(rows = 1, fn) {
        this.options.simple = false;
        if (typeof rows === "function") {
          fn = rows;
          rows = 1;
        }
        this.cursorRows = rows;
        if (typeof fn === "function")
          return this.cursorFn = fn, this;
        let prev;
        return {
          [Symbol.asyncIterator]: () => ({
            next: () => {
              if (this.executed && !this.active)
                return { done: true };
              prev && prev();
              const promise = new Promise((resolve, reject) => {
                this.cursorFn = (value) => {
                  resolve({ value, done: false });
                  return new Promise((r) => prev = r);
                };
                this.resolve = () => (this.active = false, resolve({ done: true }));
                this.reject = (x) => (this.active = false, reject(x));
              });
              this.execute();
              return promise;
            },
            return() {
              prev && prev(CLOSE);
              return { done: true };
            }
          })
        };
      }
      describe() {
        this.options.simple = false;
        this.onlyDescribe = this.options.prepare = true;
        return this;
      }
      stream() {
        throw new Error(".stream has been renamed to .forEach");
      }
      forEach(fn) {
        this.forEachFn = fn;
        this.handle();
        return this;
      }
      raw() {
        this.isRaw = true;
        return this;
      }
      values() {
        this.isRaw = "values";
        return this;
      }
      async handle() {
        !this.executed && (this.executed = true) && await 1 && this.handler(this);
      }
      execute() {
        this.handle();
        return this;
      }
      then() {
        this.handle();
        return super.then.apply(this, arguments);
      }
      catch() {
        this.handle();
        return super.catch.apply(this, arguments);
      }
      finally() {
        this.handle();
        return super.finally.apply(this, arguments);
      }
    };
  }
});

// ../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/errors.js
function connection(x, options, socket) {
  const { host, port } = socket || options;
  const error = Object.assign(
    new Error("write " + x + " " + (options.path || host + ":" + port)),
    {
      code: x,
      errno: x,
      address: options.path || host
    },
    options.path ? {} : { port }
  );
  Error.captureStackTrace(error, connection);
  return error;
}
function postgres(x) {
  const error = new PostgresError(x);
  Error.captureStackTrace(error, postgres);
  return error;
}
function generic(code, message) {
  const error = Object.assign(new Error(code + ": " + message), { code });
  Error.captureStackTrace(error, generic);
  return error;
}
function notSupported(x) {
  const error = Object.assign(
    new Error(x + " (B) is not supported"),
    {
      code: "MESSAGE_NOT_SUPPORTED",
      name: x
    }
  );
  Error.captureStackTrace(error, notSupported);
  return error;
}
var PostgresError, Errors;
var init_errors = __esm({
  "../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/errors.js"() {
    "use strict";
    PostgresError = class extends Error {
      constructor(x) {
        super(x.message);
        this.name = this.constructor.name;
        Object.assign(this, x);
      }
    };
    Errors = {
      connection,
      postgres,
      generic,
      notSupported
    };
  }
});

// ../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/types.js
function handleValue(x, parameters, types2, options) {
  let value = x instanceof Parameter ? x.value : x;
  if (value === void 0) {
    x instanceof Parameter ? x.value = options.transform.undefined : value = x = options.transform.undefined;
    if (value === void 0)
      throw Errors.generic("UNDEFINED_VALUE", "Undefined values are not allowed");
  }
  return "$" + types2.push(
    x instanceof Parameter ? (parameters.push(x.value), x.array ? x.array[x.type || inferType(x.value)] || x.type || firstIsString(x.value) : x.type) : (parameters.push(x), inferType(x))
  );
}
function stringify(q, string, value, parameters, types2, options) {
  for (let i = 1; i < q.strings.length; i++) {
    string += stringifyValue(string, value, parameters, types2, options) + q.strings[i];
    value = q.args[i];
  }
  return string;
}
function stringifyValue(string, value, parameters, types2, o) {
  return value instanceof Builder ? value.build(string, parameters, types2, o) : value instanceof Query ? fragment(value, parameters, types2, o) : value instanceof Identifier ? value.value : value && value[0] instanceof Query ? value.reduce((acc, x) => acc + " " + fragment(x, parameters, types2, o), "") : handleValue(value, parameters, types2, o);
}
function fragment(q, parameters, types2, options) {
  q.fragment = true;
  return stringify(q, q.strings[0], q.args[0], parameters, types2, options);
}
function valuesBuilder(first, parameters, types2, columns, options) {
  return first.map(
    (row) => "(" + columns.map(
      (column) => stringifyValue("values", row[column], parameters, types2, options)
    ).join(",") + ")"
  ).join(",");
}
function values(first, rest, parameters, types2, options) {
  const multi = Array.isArray(first[0]);
  const columns = rest.length ? rest.flat() : Object.keys(multi ? first[0] : first);
  return valuesBuilder(multi ? first : [first], parameters, types2, columns, options);
}
function select(first, rest, parameters, types2, options) {
  typeof first === "string" && (first = [first].concat(rest));
  if (Array.isArray(first))
    return escapeIdentifiers(first, options);
  let value;
  const columns = rest.length ? rest.flat() : Object.keys(first);
  return columns.map((x) => {
    value = first[x];
    return (value instanceof Query ? fragment(value, parameters, types2, options) : value instanceof Identifier ? value.value : handleValue(value, parameters, types2, options)) + " as " + escapeIdentifier(options.transform.column.to ? options.transform.column.to(x) : x);
  }).join(",");
}
function notTagged() {
  throw Errors.generic("NOT_TAGGED_CALL", "Query not called as a tagged template literal");
}
function firstIsString(x) {
  if (Array.isArray(x))
    return firstIsString(x[0]);
  return typeof x === "string" ? 1009 : 0;
}
function typeHandlers(types2) {
  return Object.keys(types2).reduce((acc, k) => {
    types2[k].from && [].concat(types2[k].from).forEach((x) => acc.parsers[x] = types2[k].parse);
    if (types2[k].serialize) {
      acc.serializers[types2[k].to] = types2[k].serialize;
      types2[k].from && [].concat(types2[k].from).forEach((x) => acc.serializers[x] = types2[k].serialize);
    }
    return acc;
  }, { parsers: {}, serializers: {} });
}
function escapeIdentifiers(xs, { transform: { column } }) {
  return xs.map((x) => escapeIdentifier(column.to ? column.to(x) : x)).join(",");
}
function arrayEscape(x) {
  return x.replace(escapeBackslash, "\\\\").replace(escapeQuote, '\\"');
}
function arrayParserLoop(s, x, parser, typarray) {
  const xs = [];
  const delimiter = typarray === 1020 ? ";" : ",";
  for (; s.i < x.length; s.i++) {
    s.char = x[s.i];
    if (s.quoted) {
      if (s.char === "\\") {
        s.str += x[++s.i];
      } else if (s.char === '"') {
        xs.push(parser ? parser(s.str) : s.str);
        s.str = "";
        s.quoted = x[s.i + 1] === '"';
        s.last = s.i + 2;
      } else {
        s.str += s.char;
      }
    } else if (s.char === '"') {
      s.quoted = true;
    } else if (s.char === "{") {
      s.last = ++s.i;
      xs.push(arrayParserLoop(s, x, parser, typarray));
    } else if (s.char === "}") {
      s.quoted = false;
      s.last < s.i && xs.push(parser ? parser(x.slice(s.last, s.i)) : x.slice(s.last, s.i));
      s.last = s.i + 1;
      break;
    } else if (s.char === delimiter && s.p !== "}" && s.p !== '"') {
      xs.push(parser ? parser(x.slice(s.last, s.i)) : x.slice(s.last, s.i));
      s.last = s.i + 1;
    }
    s.p = s.char;
  }
  s.last < s.i && xs.push(parser ? parser(x.slice(s.last, s.i + 1)) : x.slice(s.last, s.i + 1));
  return xs;
}
function createJsonTransform(fn) {
  return function jsonTransform(x, column) {
    return typeof x === "object" && x !== null && (column.type === 114 || column.type === 3802) ? Array.isArray(x) ? x.map((x2) => jsonTransform(x2, column)) : Object.entries(x).reduce((acc, [k, v]) => Object.assign(acc, { [fn(k)]: jsonTransform(v, column) }), {}) : x;
  };
}
var types, NotTagged, Identifier, Parameter, Builder, defaultHandlers, builders, serializers, parsers, mergeUserTypes, escapeIdentifier, inferType, escapeBackslash, escapeQuote, arraySerializer, arrayParserState, arrayParser, toCamel, toPascal, toKebab, fromCamel, fromPascal, fromKebab, camel, pascal, kebab;
var init_types = __esm({
  "../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/types.js"() {
    "use strict";
    init_query();
    init_errors();
    types = {
      string: {
        to: 25,
        from: null,
        // defaults to string
        serialize: (x) => "" + x
      },
      number: {
        to: 0,
        from: [21, 23, 26, 700, 701],
        serialize: (x) => "" + x,
        parse: (x) => +x
      },
      json: {
        to: 114,
        from: [114, 3802],
        serialize: (x) => JSON.stringify(x),
        parse: (x) => JSON.parse(x)
      },
      boolean: {
        to: 16,
        from: 16,
        serialize: (x) => x === true ? "t" : "f",
        parse: (x) => x === "t"
      },
      date: {
        to: 1184,
        from: [1082, 1114, 1184],
        serialize: (x) => (x instanceof Date ? x : new Date(x)).toISOString(),
        parse: (x) => new Date(x)
      },
      bytea: {
        to: 17,
        from: 17,
        serialize: (x) => "\\x" + Buffer.from(x).toString("hex"),
        parse: (x) => Buffer.from(x.slice(2), "hex")
      }
    };
    NotTagged = class {
      then() {
        notTagged();
      }
      catch() {
        notTagged();
      }
      finally() {
        notTagged();
      }
    };
    Identifier = class extends NotTagged {
      constructor(value) {
        super();
        this.value = escapeIdentifier(value);
      }
    };
    Parameter = class extends NotTagged {
      constructor(value, type, array) {
        super();
        this.value = value;
        this.type = type;
        this.array = array;
      }
    };
    Builder = class extends NotTagged {
      constructor(first, rest) {
        super();
        this.first = first;
        this.rest = rest;
      }
      build(before, parameters, types2, options) {
        const keyword = builders.map(([x, fn]) => ({ fn, i: before.search(x) })).sort((a, b2) => a.i - b2.i).pop();
        return keyword.i === -1 ? escapeIdentifiers(this.first, options) : keyword.fn(this.first, this.rest, parameters, types2, options);
      }
    };
    defaultHandlers = typeHandlers(types);
    builders = Object.entries({
      values,
      in: (...xs) => {
        const x = values(...xs);
        return x === "()" ? "(null)" : x;
      },
      select,
      as: select,
      returning: select,
      "\\(": select,
      update(first, rest, parameters, types2, options) {
        return (rest.length ? rest.flat() : Object.keys(first)).map(
          (x) => escapeIdentifier(options.transform.column.to ? options.transform.column.to(x) : x) + "=" + stringifyValue("values", first[x], parameters, types2, options)
        );
      },
      insert(first, rest, parameters, types2, options) {
        const columns = rest.length ? rest.flat() : Object.keys(Array.isArray(first) ? first[0] : first);
        return "(" + escapeIdentifiers(columns, options) + ")values" + valuesBuilder(Array.isArray(first) ? first : [first], parameters, types2, columns, options);
      }
    }).map(([x, fn]) => [new RegExp("((?:^|[\\s(])" + x + "(?:$|[\\s(]))(?![\\s\\S]*\\1)", "i"), fn]);
    serializers = defaultHandlers.serializers;
    parsers = defaultHandlers.parsers;
    mergeUserTypes = function(types2) {
      const user = typeHandlers(types2 || {});
      return {
        serializers: Object.assign({}, serializers, user.serializers),
        parsers: Object.assign({}, parsers, user.parsers)
      };
    };
    escapeIdentifier = function escape(str) {
      return '"' + str.replace(/"/g, '""').replace(/\./g, '"."') + '"';
    };
    inferType = function inferType2(x) {
      return x instanceof Parameter ? x.type : x instanceof Date ? 1184 : x instanceof Uint8Array ? 17 : x === true || x === false ? 16 : typeof x === "bigint" ? 20 : Array.isArray(x) ? inferType2(x[0]) : 0;
    };
    escapeBackslash = /\\/g;
    escapeQuote = /"/g;
    arraySerializer = function arraySerializer2(xs, serializer, options, typarray) {
      if (Array.isArray(xs) === false)
        return xs;
      if (!xs.length)
        return "{}";
      const first = xs[0];
      const delimiter = typarray === 1020 ? ";" : ",";
      if (Array.isArray(first) && !first.type)
        return "{" + xs.map((x) => arraySerializer2(x, serializer, options, typarray)).join(delimiter) + "}";
      return "{" + xs.map((x) => {
        if (x === void 0) {
          x = options.transform.undefined;
          if (x === void 0)
            throw Errors.generic("UNDEFINED_VALUE", "Undefined values are not allowed");
        }
        return x === null ? "null" : '"' + arrayEscape(serializer ? serializer(x.type ? x.value : x) : "" + x) + '"';
      }).join(delimiter) + "}";
    };
    arrayParserState = {
      i: 0,
      char: null,
      str: "",
      quoted: false,
      last: 0
    };
    arrayParser = function arrayParser2(x, parser, typarray) {
      arrayParserState.i = arrayParserState.last = 0;
      return arrayParserLoop(arrayParserState, x, parser, typarray);
    };
    toCamel = (x) => {
      let str = x[0];
      for (let i = 1; i < x.length; i++)
        str += x[i] === "_" ? x[++i].toUpperCase() : x[i];
      return str;
    };
    toPascal = (x) => {
      let str = x[0].toUpperCase();
      for (let i = 1; i < x.length; i++)
        str += x[i] === "_" ? x[++i].toUpperCase() : x[i];
      return str;
    };
    toKebab = (x) => x.replace(/_/g, "-");
    fromCamel = (x) => x.replace(/([A-Z])/g, "_$1").toLowerCase();
    fromPascal = (x) => (x.slice(0, 1) + x.slice(1).replace(/([A-Z])/g, "_$1")).toLowerCase();
    fromKebab = (x) => x.replace(/-/g, "_");
    toCamel.column = { from: toCamel };
    toCamel.value = { from: createJsonTransform(toCamel) };
    fromCamel.column = { to: fromCamel };
    camel = { ...toCamel };
    camel.column.to = fromCamel;
    toPascal.column = { from: toPascal };
    toPascal.value = { from: createJsonTransform(toPascal) };
    fromPascal.column = { to: fromPascal };
    pascal = { ...toPascal };
    pascal.column.to = fromPascal;
    toKebab.column = { from: toKebab };
    toKebab.value = { from: createJsonTransform(toKebab) };
    fromKebab.column = { to: fromKebab };
    kebab = { ...toKebab };
    kebab.column.to = fromKebab;
  }
});

// ../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/result.js
var Result;
var init_result = __esm({
  "../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/result.js"() {
    "use strict";
    Result = class extends Array {
      constructor() {
        super();
        Object.defineProperties(this, {
          count: { value: null, writable: true },
          state: { value: null, writable: true },
          command: { value: null, writable: true },
          columns: { value: null, writable: true },
          statement: { value: null, writable: true }
        });
      }
      static get [Symbol.species]() {
        return Array;
      }
    };
  }
});

// ../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/queue.js
function Queue(initial = []) {
  let xs = initial.slice();
  let index2 = 0;
  return {
    get length() {
      return xs.length - index2;
    },
    remove: (x) => {
      const index3 = xs.indexOf(x);
      return index3 === -1 ? null : (xs.splice(index3, 1), x);
    },
    push: (x) => (xs.push(x), x),
    shift: () => {
      const out = xs[index2++];
      if (index2 === xs.length) {
        index2 = 0;
        xs = [];
      } else {
        xs[index2 - 1] = void 0;
      }
      return out;
    }
  };
}
var queue_default;
var init_queue = __esm({
  "../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/queue.js"() {
    "use strict";
    queue_default = Queue;
  }
});

// ../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/bytes.js
function fit(x) {
  if (buffer.length - b.i < x) {
    const prev = buffer, length = prev.length;
    buffer = Buffer.allocUnsafe(length + (length >> 1) + x);
    prev.copy(buffer);
  }
}
function reset() {
  b.i = 0;
  return b;
}
var size, buffer, messages, b, bytes_default;
var init_bytes = __esm({
  "../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/bytes.js"() {
    "use strict";
    size = 256;
    buffer = Buffer.allocUnsafe(size);
    messages = "BCcDdEFfHPpQSX".split("").reduce((acc, x) => {
      const v = x.charCodeAt(0);
      acc[x] = () => {
        buffer[0] = v;
        b.i = 5;
        return b;
      };
      return acc;
    }, {});
    b = Object.assign(reset, messages, {
      N: String.fromCharCode(0),
      i: 0,
      inc(x) {
        b.i += x;
        return b;
      },
      str(x) {
        const length = Buffer.byteLength(x);
        fit(length);
        b.i += buffer.write(x, b.i, length, "utf8");
        return b;
      },
      i16(x) {
        fit(2);
        buffer.writeUInt16BE(x, b.i);
        b.i += 2;
        return b;
      },
      i32(x, i) {
        if (i || i === 0) {
          buffer.writeUInt32BE(x, i);
          return b;
        }
        fit(4);
        buffer.writeUInt32BE(x, b.i);
        b.i += 4;
        return b;
      },
      z(x) {
        fit(x);
        buffer.fill(0, b.i, b.i + x);
        b.i += x;
        return b;
      },
      raw(x) {
        buffer = Buffer.concat([buffer.subarray(0, b.i), x]);
        b.i = buffer.length;
        return b;
      },
      end(at = 1) {
        buffer.writeUInt32BE(b.i - at, at);
        const out = buffer.subarray(0, b.i);
        b.i = 0;
        buffer = Buffer.allocUnsafe(size);
        return out;
      }
    });
    bytes_default = b;
  }
});

// ../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/connection.js
import net from "net";
import tls from "tls";
import crypto from "crypto";
import Stream from "stream";
import { performance } from "perf_hooks";
function Connection(options, queues = {}, { onopen = noop, onend = noop, onclose = noop } = {}) {
  const {
    sslnegotiation,
    ssl,
    max,
    user,
    host,
    port,
    database,
    parsers: parsers2,
    transform,
    onnotice,
    onnotify,
    onparameter,
    max_pipeline,
    keep_alive,
    backoff: backoff2,
    target_session_attrs
  } = options;
  const sent = queue_default(), id = uid++, backend = { pid: null, secret: null }, idleTimer = timer(end, options.idle_timeout), lifeTimer = timer(end, options.max_lifetime), connectTimer = timer(connectTimedOut, options.connect_timeout);
  let socket = null, cancelMessage, errorResponse = null, result = new Result(), incoming = Buffer.alloc(0), needsTypes = options.fetch_types, backendParameters = {}, statements = {}, statementId = Math.random().toString(36).slice(2), statementCount = 1, closedTime = 0, remaining = 0, hostIndex = 0, retries = 0, length = 0, delay = 0, rows = 0, serverSignature = null, nextWriteTimer = null, terminated = false, incomings = null, results = null, initial = null, ending = null, stream = null, chunk = null, ended = null, nonce = null, query = null, final = null;
  const connection2 = {
    queue: queues.closed,
    idleTimer,
    connect(query2) {
      initial = query2;
      reconnect();
    },
    terminate,
    execute,
    cancel,
    end,
    count: 0,
    id
  };
  queues.closed && queues.closed.push(connection2);
  return connection2;
  async function createSocket() {
    let x;
    try {
      x = options.socket ? await Promise.resolve(options.socket(options)) : new net.Socket();
    } catch (e) {
      error(e);
      return;
    }
    x.on("error", error);
    x.on("close", closed);
    x.on("drain", drain);
    return x;
  }
  async function cancel({ pid, secret }, resolve, reject) {
    try {
      cancelMessage = bytes_default().i32(16).i32(80877102).i32(pid).i32(secret).end(16);
      await connect();
      socket.once("error", reject);
      socket.once("close", resolve);
    } catch (error2) {
      reject(error2);
    }
  }
  function execute(q) {
    if (terminated)
      return queryError(q, Errors.connection("CONNECTION_DESTROYED", options));
    if (stream)
      return queryError(q, Errors.generic("COPY_IN_PROGRESS", "You cannot execute queries during copy"));
    if (q.cancelled)
      return;
    try {
      q.state = backend;
      query ? sent.push(q) : (query = q, query.active = true);
      build(q);
      return write(toBuffer(q)) && !q.describeFirst && !q.cursorFn && sent.length < max_pipeline && (!q.options.onexecute || q.options.onexecute(connection2));
    } catch (error2) {
      sent.length === 0 && write(Sync);
      errored(error2);
      return true;
    }
  }
  function toBuffer(q) {
    if (q.parameters.length >= 65534)
      throw Errors.generic("MAX_PARAMETERS_EXCEEDED", "Max number of parameters (65534) exceeded");
    return q.options.simple ? bytes_default().Q().str(q.statement.string + bytes_default.N).end() : q.describeFirst ? Buffer.concat([describe(q), Flush]) : q.prepare ? q.prepared ? prepared(q) : Buffer.concat([describe(q), prepared(q)]) : unnamed(q);
  }
  function describe(q) {
    return Buffer.concat([
      Parse(q.statement.string, q.parameters, q.statement.types, q.statement.name),
      Describe("S", q.statement.name)
    ]);
  }
  function prepared(q) {
    return Buffer.concat([
      Bind(q.parameters, q.statement.types, q.statement.name, q.cursorName),
      q.cursorFn ? Execute("", q.cursorRows) : ExecuteUnnamed
    ]);
  }
  function unnamed(q) {
    return Buffer.concat([
      Parse(q.statement.string, q.parameters, q.statement.types),
      DescribeUnnamed,
      prepared(q)
    ]);
  }
  function build(q) {
    const parameters = [], types2 = [];
    const string = stringify(q, q.strings[0], q.args[0], parameters, types2, options);
    !q.tagged && q.args.forEach((x) => handleValue(x, parameters, types2, options));
    q.prepare = options.prepare && ("prepare" in q.options ? q.options.prepare : true);
    q.string = string;
    q.signature = q.prepare && types2 + string;
    q.onlyDescribe && delete statements[q.signature];
    q.parameters = q.parameters || parameters;
    q.prepared = q.prepare && q.signature in statements;
    q.describeFirst = q.onlyDescribe || parameters.length && !q.prepared;
    q.statement = q.prepared ? statements[q.signature] : { string, types: types2, name: q.prepare ? statementId + statementCount++ : "" };
    typeof options.debug === "function" && options.debug(id, string, parameters, types2);
  }
  function write(x, fn) {
    chunk = chunk ? Buffer.concat([chunk, x]) : Buffer.from(x);
    if (fn || chunk.length >= 1024)
      return nextWrite(fn);
    nextWriteTimer === null && (nextWriteTimer = setImmediate(nextWrite));
    return true;
  }
  function nextWrite(fn) {
    const x = socket.write(chunk, fn);
    nextWriteTimer !== null && clearImmediate(nextWriteTimer);
    chunk = nextWriteTimer = null;
    return x;
  }
  function connectTimedOut() {
    errored(Errors.connection("CONNECT_TIMEOUT", options, socket));
    socket.destroy();
  }
  async function secure() {
    if (sslnegotiation !== "direct") {
      write(SSLRequest);
      const canSSL = await new Promise((r) => socket.once("data", (x) => r(x[0] === 83)));
      if (!canSSL && ssl === "prefer")
        return connected();
    }
    const options2 = {
      socket,
      servername: net.isIP(socket.host) ? void 0 : socket.host
    };
    if (sslnegotiation === "direct")
      options2.ALPNProtocols = ["postgresql"];
    if (ssl === "require" || ssl === "allow" || ssl === "prefer")
      options2.rejectUnauthorized = false;
    else if (typeof ssl === "object")
      Object.assign(options2, ssl);
    socket.removeAllListeners();
    socket = tls.connect(options2);
    socket.on("secureConnect", connected);
    socket.on("error", error);
    socket.on("close", closed);
    socket.on("drain", drain);
  }
  function drain() {
    !query && onopen(connection2);
  }
  function data(x) {
    if (incomings) {
      incomings.push(x);
      remaining -= x.length;
      if (remaining > 0)
        return;
    }
    incoming = incomings ? Buffer.concat(incomings, length - remaining) : incoming.length === 0 ? x : Buffer.concat([incoming, x], incoming.length + x.length);
    while (incoming.length > 4) {
      length = incoming.readUInt32BE(1);
      if (length >= incoming.length) {
        remaining = length - incoming.length;
        incomings = [incoming];
        break;
      }
      try {
        handle2(incoming.subarray(0, length + 1));
      } catch (e) {
        query && (query.cursorFn || query.describeFirst) && write(Sync);
        errored(e);
      }
      incoming = incoming.subarray(length + 1);
      remaining = 0;
      incomings = null;
    }
  }
  async function connect() {
    terminated = false;
    backendParameters = {};
    socket || (socket = await createSocket());
    if (!socket)
      return;
    connectTimer.start();
    if (options.socket)
      return ssl ? secure() : connected();
    socket.on("connect", ssl ? secure : connected);
    if (options.path)
      return socket.connect(options.path);
    socket.ssl = ssl;
    socket.connect(port[hostIndex], host[hostIndex]);
    socket.host = host[hostIndex];
    socket.port = port[hostIndex];
    hostIndex = (hostIndex + 1) % port.length;
  }
  function reconnect() {
    setTimeout(connect, closedTime ? Math.max(0, closedTime + delay - performance.now()) : 0);
  }
  function connected() {
    try {
      statements = {};
      needsTypes = options.fetch_types;
      statementId = Math.random().toString(36).slice(2);
      statementCount = 1;
      lifeTimer.start();
      socket.on("data", data);
      keep_alive && socket.setKeepAlive && socket.setKeepAlive(true, 1e3 * keep_alive);
      const s = StartupMessage();
      write(s);
    } catch (err) {
      error(err);
    }
  }
  function error(err) {
    if (connection2.queue === queues.connecting && options.host[retries + 1])
      return;
    errored(err);
    while (sent.length)
      queryError(sent.shift(), err);
  }
  function errored(err) {
    stream && (stream.destroy(err), stream = null);
    query && queryError(query, err);
    initial && (queryError(initial, err), initial = null);
  }
  function queryError(query2, err) {
    if (query2.reserve)
      return query2.reject(err);
    if (!err || typeof err !== "object")
      err = new Error(err);
    "query" in err || "parameters" in err || Object.defineProperties(err, {
      stack: { value: err.stack + query2.origin.replace(/.*\n/, "\n"), enumerable: options.debug },
      query: { value: query2.string, enumerable: options.debug },
      parameters: { value: query2.parameters, enumerable: options.debug },
      args: { value: query2.args, enumerable: options.debug },
      types: { value: query2.statement && query2.statement.types, enumerable: options.debug }
    });
    query2.reject(err);
  }
  function end() {
    return ending || (!connection2.reserved && onend(connection2), !connection2.reserved && !initial && !query && sent.length === 0 ? (terminate(), new Promise((r) => socket && socket.readyState !== "closed" ? socket.once("close", r) : r())) : ending = new Promise((r) => ended = r));
  }
  function terminate() {
    terminated = true;
    if (stream || query || initial || sent.length)
      error(Errors.connection("CONNECTION_DESTROYED", options));
    clearImmediate(nextWriteTimer);
    if (socket) {
      socket.removeListener("data", data);
      socket.removeListener("connect", connected);
      socket.readyState === "open" && socket.end(bytes_default().X().end());
    }
    ended && (ended(), ending = ended = null);
  }
  async function closed(hadError) {
    incoming = Buffer.alloc(0);
    remaining = 0;
    incomings = null;
    clearImmediate(nextWriteTimer);
    socket.removeListener("data", data);
    socket.removeListener("connect", connected);
    idleTimer.cancel();
    lifeTimer.cancel();
    connectTimer.cancel();
    socket.removeAllListeners();
    socket = null;
    if (initial)
      return reconnect();
    !hadError && (query || sent.length) && error(Errors.connection("CONNECTION_CLOSED", options, socket));
    closedTime = performance.now();
    hadError && options.shared.retries++;
    delay = (typeof backoff2 === "function" ? backoff2(options.shared.retries) : backoff2) * 1e3;
    onclose(connection2, Errors.connection("CONNECTION_CLOSED", options, socket));
  }
  function handle2(xs, x = xs[0]) {
    (x === 68 ? DataRow : (
      // D
      x === 100 ? CopyData : (
        // d
        x === 65 ? NotificationResponse : (
          // A
          x === 83 ? ParameterStatus : (
            // S
            x === 90 ? ReadyForQuery : (
              // Z
              x === 67 ? CommandComplete : (
                // C
                x === 50 ? BindComplete : (
                  // 2
                  x === 49 ? ParseComplete : (
                    // 1
                    x === 116 ? ParameterDescription : (
                      // t
                      x === 84 ? RowDescription : (
                        // T
                        x === 82 ? Authentication : (
                          // R
                          x === 110 ? NoData : (
                            // n
                            x === 75 ? BackendKeyData : (
                              // K
                              x === 69 ? ErrorResponse : (
                                // E
                                x === 115 ? PortalSuspended : (
                                  // s
                                  x === 51 ? CloseComplete : (
                                    // 3
                                    x === 71 ? CopyInResponse : (
                                      // G
                                      x === 78 ? NoticeResponse : (
                                        // N
                                        x === 72 ? CopyOutResponse : (
                                          // H
                                          x === 99 ? CopyDone : (
                                            // c
                                            x === 73 ? EmptyQueryResponse : (
                                              // I
                                              x === 86 ? FunctionCallResponse : (
                                                // V
                                                x === 118 ? NegotiateProtocolVersion : (
                                                  // v
                                                  x === 87 ? CopyBothResponse : (
                                                    // W
                                                    /* c8 ignore next */
                                                    UnknownMessage
                                                  )
                                                )
                                              )
                                            )
                                          )
                                        )
                                      )
                                    )
                                  )
                                )
                              )
                            )
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    ))(xs);
  }
  function DataRow(x) {
    let index2 = 7;
    let length2;
    let column;
    let value;
    const row = query.isRaw ? new Array(query.statement.columns.length) : {};
    for (let i = 0; i < query.statement.columns.length; i++) {
      column = query.statement.columns[i];
      length2 = x.readInt32BE(index2);
      index2 += 4;
      value = length2 === -1 ? null : query.isRaw === true ? x.subarray(index2, index2 += length2) : column.parser === void 0 ? x.toString("utf8", index2, index2 += length2) : column.parser.array === true ? column.parser(x.toString("utf8", index2 + 1, index2 += length2)) : column.parser(x.toString("utf8", index2, index2 += length2));
      query.isRaw ? row[i] = query.isRaw === true ? value : transform.value.from ? transform.value.from(value, column) : value : row[column.name] = transform.value.from ? transform.value.from(value, column) : value;
    }
    query.forEachFn ? query.forEachFn(transform.row.from ? transform.row.from(row) : row, result) : result[rows++] = transform.row.from ? transform.row.from(row) : row;
  }
  function ParameterStatus(x) {
    const [k, v] = x.toString("utf8", 5, x.length - 1).split(bytes_default.N);
    backendParameters[k] = v;
    if (options.parameters[k] !== v) {
      options.parameters[k] = v;
      onparameter && onparameter(k, v);
    }
  }
  function ReadyForQuery(x) {
    if (query) {
      if (errorResponse) {
        query.retried ? errored(query.retried) : query.prepared && retryRoutines.has(errorResponse.routine) ? retry(query, errorResponse) : errored(errorResponse);
      } else {
        query.resolve(results || result);
      }
    } else if (errorResponse) {
      errored(errorResponse);
    }
    query = results = errorResponse = null;
    result = new Result();
    connectTimer.cancel();
    if (initial) {
      if (target_session_attrs) {
        if (!backendParameters.in_hot_standby || !backendParameters.default_transaction_read_only)
          return fetchState();
        else if (tryNext(target_session_attrs, backendParameters))
          return terminate();
      }
      if (needsTypes) {
        initial.reserve && (initial = null);
        return fetchArrayTypes();
      }
      initial && !initial.reserve && execute(initial);
      options.shared.retries = retries = 0;
      initial = null;
      return;
    }
    while (sent.length && (query = sent.shift()) && (query.active = true, query.cancelled))
      Connection(options).cancel(query.state, query.cancelled.resolve, query.cancelled.reject);
    if (query)
      return;
    connection2.reserved ? !connection2.reserved.release && x[5] === 73 ? ending ? terminate() : (connection2.reserved = null, onopen(connection2)) : connection2.reserved() : ending ? terminate() : onopen(connection2);
  }
  function CommandComplete(x) {
    rows = 0;
    for (let i = x.length - 1; i > 0; i--) {
      if (x[i] === 32 && x[i + 1] < 58 && result.count === null)
        result.count = +x.toString("utf8", i + 1, x.length - 1);
      if (x[i - 1] >= 65) {
        result.command = x.toString("utf8", 5, i);
        result.state = backend;
        break;
      }
    }
    final && (final(), final = null);
    if (result.command === "BEGIN" && max !== 1 && !connection2.reserved)
      return errored(Errors.generic("UNSAFE_TRANSACTION", "Only use sql.begin, sql.reserved or max: 1"));
    if (query.options.simple)
      return BindComplete();
    if (query.cursorFn) {
      result.count && query.cursorFn(result);
      write(Sync);
    }
  }
  function ParseComplete() {
    query.parsing = false;
  }
  function BindComplete() {
    !result.statement && (result.statement = query.statement);
    result.columns = query.statement.columns;
  }
  function ParameterDescription(x) {
    const length2 = x.readUInt16BE(5);
    for (let i = 0; i < length2; ++i)
      !query.statement.types[i] && (query.statement.types[i] = x.readUInt32BE(7 + i * 4));
    query.prepare && (statements[query.signature] = query.statement);
    query.describeFirst && !query.onlyDescribe && (write(prepared(query)), query.describeFirst = false);
  }
  function RowDescription(x) {
    if (result.command) {
      results = results || [result];
      results.push(result = new Result());
      result.count = null;
      query.statement.columns = null;
    }
    const length2 = x.readUInt16BE(5);
    let index2 = 7;
    let start;
    query.statement.columns = Array(length2);
    for (let i = 0; i < length2; ++i) {
      start = index2;
      while (x[index2++] !== 0) ;
      const table = x.readUInt32BE(index2);
      const number = x.readUInt16BE(index2 + 4);
      const type = x.readUInt32BE(index2 + 6);
      query.statement.columns[i] = {
        name: transform.column.from ? transform.column.from(x.toString("utf8", start, index2 - 1)) : x.toString("utf8", start, index2 - 1),
        parser: parsers2[type],
        table,
        number,
        type
      };
      index2 += 18;
    }
    result.statement = query.statement;
    if (query.onlyDescribe)
      return query.resolve(query.statement), write(Sync);
  }
  async function Authentication(x, type = x.readUInt32BE(5)) {
    (type === 3 ? AuthenticationCleartextPassword : type === 5 ? AuthenticationMD5Password : type === 10 ? SASL : type === 11 ? SASLContinue : type === 12 ? SASLFinal : type !== 0 ? UnknownAuth : noop)(x, type);
  }
  async function AuthenticationCleartextPassword() {
    const payload = await Pass();
    write(
      bytes_default().p().str(payload).z(1).end()
    );
  }
  async function AuthenticationMD5Password(x) {
    const payload = "md5" + await md5(
      Buffer.concat([
        Buffer.from(await md5(await Pass() + user)),
        x.subarray(9)
      ])
    );
    write(
      bytes_default().p().str(payload).z(1).end()
    );
  }
  async function SASL() {
    nonce = (await crypto.randomBytes(18)).toString("base64");
    bytes_default().p().str("SCRAM-SHA-256" + bytes_default.N);
    const i = bytes_default.i;
    write(bytes_default.inc(4).str("n,,n=*,r=" + nonce).i32(bytes_default.i - i - 4, i).end());
  }
  async function SASLContinue(x) {
    const res = x.toString("utf8", 9).split(",").reduce((acc, x2) => (acc[x2[0]] = x2.slice(2), acc), {});
    const saltedPassword = await crypto.pbkdf2Sync(
      await Pass(),
      Buffer.from(res.s, "base64"),
      parseInt(res.i),
      32,
      "sha256"
    );
    const clientKey = await hmac(saltedPassword, "Client Key");
    const auth = "n=*,r=" + nonce + ",r=" + res.r + ",s=" + res.s + ",i=" + res.i + ",c=biws,r=" + res.r;
    serverSignature = (await hmac(await hmac(saltedPassword, "Server Key"), auth)).toString("base64");
    const payload = "c=biws,r=" + res.r + ",p=" + xor(
      clientKey,
      Buffer.from(await hmac(await sha256(clientKey), auth))
    ).toString("base64");
    write(
      bytes_default().p().str(payload).end()
    );
  }
  function SASLFinal(x) {
    if (x.toString("utf8", 9).split(bytes_default.N, 1)[0].slice(2) === serverSignature)
      return;
    errored(Errors.generic("SASL_SIGNATURE_MISMATCH", "The server did not return the correct signature"));
    socket.destroy();
  }
  function Pass() {
    return Promise.resolve(
      typeof options.pass === "function" ? options.pass() : options.pass
    );
  }
  function NoData() {
    result.statement = query.statement;
    result.statement.columns = [];
    if (query.onlyDescribe)
      return query.resolve(query.statement), write(Sync);
  }
  function BackendKeyData(x) {
    backend.pid = x.readUInt32BE(5);
    backend.secret = x.readUInt32BE(9);
  }
  async function fetchArrayTypes() {
    needsTypes = false;
    const types2 = await new Query([`
      select b.oid, b.typarray
      from pg_catalog.pg_type a
      left join pg_catalog.pg_type b on b.oid = a.typelem
      where a.typcategory = 'A'
      group by b.oid, b.typarray
      order by b.oid
    `], [], execute);
    types2.forEach(({ oid, typarray }) => addArrayType(oid, typarray));
  }
  function addArrayType(oid, typarray) {
    if (!!options.parsers[typarray] && !!options.serializers[typarray]) return;
    const parser = options.parsers[oid];
    options.shared.typeArrayMap[oid] = typarray;
    options.parsers[typarray] = (xs) => arrayParser(xs, parser, typarray);
    options.parsers[typarray].array = true;
    options.serializers[typarray] = (xs) => arraySerializer(xs, options.serializers[oid], options, typarray);
  }
  function tryNext(x, xs) {
    return x === "read-write" && xs.default_transaction_read_only === "on" || x === "read-only" && xs.default_transaction_read_only === "off" || x === "primary" && xs.in_hot_standby === "on" || x === "standby" && xs.in_hot_standby === "off" || x === "prefer-standby" && xs.in_hot_standby === "off" && options.host[retries];
  }
  function fetchState() {
    const query2 = new Query([`
      show transaction_read_only;
      select pg_catalog.pg_is_in_recovery()
    `], [], execute, null, { simple: true });
    query2.resolve = ([[a], [b2]]) => {
      backendParameters.default_transaction_read_only = a.transaction_read_only;
      backendParameters.in_hot_standby = b2.pg_is_in_recovery ? "on" : "off";
    };
    query2.execute();
  }
  function ErrorResponse(x) {
    if (query) {
      (query.cursorFn || query.describeFirst) && write(Sync);
      errorResponse = Errors.postgres(parseError(x));
    } else {
      errored(Errors.postgres(parseError(x)));
    }
  }
  function retry(q, error2) {
    delete statements[q.signature];
    q.retried = error2;
    execute(q);
  }
  function NotificationResponse(x) {
    if (!onnotify)
      return;
    let index2 = 9;
    while (x[index2++] !== 0) ;
    onnotify(
      x.toString("utf8", 9, index2 - 1),
      x.toString("utf8", index2, x.length - 1)
    );
  }
  async function PortalSuspended() {
    try {
      const x = await Promise.resolve(query.cursorFn(result));
      rows = 0;
      x === CLOSE ? write(Close(query.portal)) : (result = new Result(), write(Execute("", query.cursorRows)));
    } catch (err) {
      write(Sync);
      query.reject(err);
    }
  }
  function CloseComplete() {
    result.count && query.cursorFn(result);
    query.resolve(result);
  }
  function CopyInResponse() {
    stream = new Stream.Writable({
      autoDestroy: true,
      write(chunk2, encoding, callback) {
        socket.write(bytes_default().d().raw(chunk2).end(), callback);
      },
      destroy(error2, callback) {
        callback(error2);
        socket.write(bytes_default().f().str(error2 + bytes_default.N).end());
        stream = null;
      },
      final(callback) {
        socket.write(bytes_default().c().end());
        final = callback;
        stream = null;
      }
    });
    query.resolve(stream);
  }
  function CopyOutResponse() {
    stream = new Stream.Readable({
      read() {
        socket.resume();
      }
    });
    query.resolve(stream);
  }
  function CopyBothResponse() {
    stream = new Stream.Duplex({
      autoDestroy: true,
      read() {
        socket.resume();
      },
      /* c8 ignore next 11 */
      write(chunk2, encoding, callback) {
        socket.write(bytes_default().d().raw(chunk2).end(), callback);
      },
      destroy(error2, callback) {
        callback(error2);
        socket.write(bytes_default().f().str(error2 + bytes_default.N).end());
        stream = null;
      },
      final(callback) {
        socket.write(bytes_default().c().end());
        final = callback;
      }
    });
    query.resolve(stream);
  }
  function CopyData(x) {
    stream && (stream.push(x.subarray(5)) || socket.pause());
  }
  function CopyDone() {
    stream && stream.push(null);
    stream = null;
  }
  function NoticeResponse(x) {
    onnotice ? onnotice(parseError(x)) : console.log(parseError(x));
  }
  function EmptyQueryResponse() {
  }
  function FunctionCallResponse() {
    errored(Errors.notSupported("FunctionCallResponse"));
  }
  function NegotiateProtocolVersion() {
    errored(Errors.notSupported("NegotiateProtocolVersion"));
  }
  function UnknownMessage(x) {
    console.error("Postgres.js : Unknown Message:", x[0]);
  }
  function UnknownAuth(x, type) {
    console.error("Postgres.js : Unknown Auth:", type);
  }
  function Bind(parameters, types2, statement = "", portal = "") {
    let prev, type;
    bytes_default().B().str(portal + bytes_default.N).str(statement + bytes_default.N).i16(0).i16(parameters.length);
    parameters.forEach((x, i) => {
      if (x === null)
        return bytes_default.i32(4294967295);
      type = types2[i];
      parameters[i] = x = type in options.serializers ? options.serializers[type](x) : "" + x;
      prev = bytes_default.i;
      bytes_default.inc(4).str(x).i32(bytes_default.i - prev - 4, prev);
    });
    bytes_default.i16(0);
    return bytes_default.end();
  }
  function Parse(str, parameters, types2, name = "") {
    bytes_default().P().str(name + bytes_default.N).str(str + bytes_default.N).i16(parameters.length);
    parameters.forEach((x, i) => bytes_default.i32(types2[i] || 0));
    return bytes_default.end();
  }
  function Describe(x, name = "") {
    return bytes_default().D().str(x).str(name + bytes_default.N).end();
  }
  function Execute(portal = "", rows2 = 0) {
    return Buffer.concat([
      bytes_default().E().str(portal + bytes_default.N).i32(rows2).end(),
      Flush
    ]);
  }
  function Close(portal = "") {
    return Buffer.concat([
      bytes_default().C().str("P").str(portal + bytes_default.N).end(),
      bytes_default().S().end()
    ]);
  }
  function StartupMessage() {
    return cancelMessage || bytes_default().inc(4).i16(3).z(2).str(
      Object.entries(Object.assign(
        {
          user,
          database,
          client_encoding: "UTF8"
        },
        options.connection
      )).filter(([, v]) => v).map(([k, v]) => k + bytes_default.N + v).join(bytes_default.N)
    ).z(2).end(0);
  }
}
function parseError(x) {
  const error = {};
  let start = 5;
  for (let i = 5; i < x.length - 1; i++) {
    if (x[i] === 0) {
      error[errorFields[x[start]]] = x.toString("utf8", start + 1, i);
      start = i + 1;
    }
  }
  return error;
}
function md5(x) {
  return crypto.createHash("md5").update(x).digest("hex");
}
function hmac(key2, x) {
  return crypto.createHmac("sha256", key2).update(x).digest();
}
function sha256(x) {
  return crypto.createHash("sha256").update(x).digest();
}
function xor(a, b2) {
  const length = Math.max(a.length, b2.length);
  const buffer2 = Buffer.allocUnsafe(length);
  for (let i = 0; i < length; i++)
    buffer2[i] = a[i] ^ b2[i];
  return buffer2;
}
function timer(fn, seconds) {
  seconds = typeof seconds === "function" ? seconds() : seconds;
  if (!seconds)
    return { cancel: noop, start: noop };
  let timer2;
  return {
    cancel() {
      timer2 && (clearTimeout(timer2), timer2 = null);
    },
    start() {
      timer2 && clearTimeout(timer2);
      timer2 = setTimeout(done, seconds * 1e3, arguments);
    }
  };
  function done(args) {
    fn.apply(null, args);
    timer2 = null;
  }
}
var connection_default, uid, Sync, Flush, SSLRequest, ExecuteUnnamed, DescribeUnnamed, noop, retryRoutines, errorFields;
var init_connection = __esm({
  "../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/connection.js"() {
    "use strict";
    init_types();
    init_errors();
    init_result();
    init_queue();
    init_query();
    init_bytes();
    connection_default = Connection;
    uid = 1;
    Sync = bytes_default().S().end();
    Flush = bytes_default().H().end();
    SSLRequest = bytes_default().i32(8).i32(80877103).end(8);
    ExecuteUnnamed = Buffer.concat([bytes_default().E().str(bytes_default.N).i32(0).end(), Sync]);
    DescribeUnnamed = bytes_default().D().str("S").str(bytes_default.N).end();
    noop = () => {
    };
    retryRoutines = /* @__PURE__ */ new Set([
      "FetchPreparedStatement",
      "RevalidateCachedQuery",
      "transformAssignedExpr"
    ]);
    errorFields = {
      83: "severity_local",
      // S
      86: "severity",
      // V
      67: "code",
      // C
      77: "message",
      // M
      68: "detail",
      // D
      72: "hint",
      // H
      80: "position",
      // P
      112: "internal_position",
      // p
      113: "internal_query",
      // q
      87: "where",
      // W
      115: "schema_name",
      // s
      116: "table_name",
      // t
      99: "column_name",
      // c
      100: "data type_name",
      // d
      110: "constraint_name",
      // n
      70: "file",
      // F
      76: "line",
      // L
      82: "routine"
      // R
    };
  }
});

// ../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/subscribe.js
function Subscribe(postgres2, options) {
  const subscribers = /* @__PURE__ */ new Map(), slot = "postgresjs_" + Math.random().toString(36).slice(2), state = {};
  let connection2, stream, ended = false;
  const sql3 = subscribe.sql = postgres2({
    ...options,
    transform: { column: {}, value: {}, row: {} },
    max: 1,
    fetch_types: false,
    idle_timeout: null,
    max_lifetime: null,
    connection: {
      ...options.connection,
      replication: "database"
    },
    onclose: async function() {
      if (ended)
        return;
      stream = null;
      state.pid = state.secret = void 0;
      connected(await init(sql3, slot, options.publications));
      subscribers.forEach((event) => event.forEach(({ onsubscribe }) => onsubscribe()));
    },
    no_subscribe: true
  });
  const end = sql3.end, close = sql3.close;
  sql3.end = async () => {
    ended = true;
    stream && await new Promise((r) => (stream.once("close", r), stream.end()));
    return end();
  };
  sql3.close = async () => {
    stream && await new Promise((r) => (stream.once("close", r), stream.end()));
    return close();
  };
  return subscribe;
  async function subscribe(event, fn, onsubscribe = noop2, onerror = noop2) {
    event = parseEvent(event);
    if (!connection2)
      connection2 = init(sql3, slot, options.publications);
    const subscriber = { fn, onsubscribe };
    const fns = subscribers.has(event) ? subscribers.get(event).add(subscriber) : subscribers.set(event, /* @__PURE__ */ new Set([subscriber])).get(event);
    const unsubscribe = () => {
      fns.delete(subscriber);
      fns.size === 0 && subscribers.delete(event);
    };
    return connection2.then((x) => {
      connected(x);
      onsubscribe();
      stream && stream.on("error", onerror);
      return { unsubscribe, state, sql: sql3 };
    });
  }
  function connected(x) {
    stream = x.stream;
    state.pid = x.state.pid;
    state.secret = x.state.secret;
  }
  async function init(sql4, slot2, publications) {
    if (!publications)
      throw new Error("Missing publication names");
    const xs = await sql4.unsafe(
      `CREATE_REPLICATION_SLOT ${slot2} TEMPORARY LOGICAL pgoutput NOEXPORT_SNAPSHOT`
    );
    const [x] = xs;
    const stream2 = await sql4.unsafe(
      `START_REPLICATION SLOT ${slot2} LOGICAL ${x.consistent_point} (proto_version '1', publication_names '${publications}')`
    ).writable();
    const state2 = {
      lsn: Buffer.concat(x.consistent_point.split("/").map((x2) => Buffer.from(("00000000" + x2).slice(-8), "hex")))
    };
    stream2.on("data", data);
    stream2.on("error", error);
    stream2.on("close", sql4.close);
    return { stream: stream2, state: xs.state };
    function error(e) {
      console.error("Unexpected error during logical streaming - reconnecting", e);
    }
    function data(x2) {
      if (x2[0] === 119) {
        parse(x2.subarray(25), state2, sql4.options.parsers, handle2, options.transform);
      } else if (x2[0] === 107 && x2[17]) {
        state2.lsn = x2.subarray(1, 9);
        pong();
      }
    }
    function handle2(a, b2) {
      const path = b2.relation.schema + "." + b2.relation.table;
      call("*", a, b2);
      call("*:" + path, a, b2);
      b2.relation.keys.length && call("*:" + path + "=" + b2.relation.keys.map((x2) => a[x2.name]), a, b2);
      call(b2.command, a, b2);
      call(b2.command + ":" + path, a, b2);
      b2.relation.keys.length && call(b2.command + ":" + path + "=" + b2.relation.keys.map((x2) => a[x2.name]), a, b2);
    }
    function pong() {
      const x2 = Buffer.alloc(34);
      x2[0] = "r".charCodeAt(0);
      x2.fill(state2.lsn, 1);
      x2.writeBigInt64BE(BigInt(Date.now() - Date.UTC(2e3, 0, 1)) * BigInt(1e3), 25);
      stream2.write(x2);
    }
  }
  function call(x, a, b2) {
    subscribers.has(x) && subscribers.get(x).forEach(({ fn }) => fn(a, b2, x));
  }
}
function Time(x) {
  return new Date(Date.UTC(2e3, 0, 1) + Number(x / BigInt(1e3)));
}
function parse(x, state, parsers2, handle2, transform) {
  const char = (acc, [k, v]) => (acc[k.charCodeAt(0)] = v, acc);
  Object.entries({
    R: (x2) => {
      let i = 1;
      const r = state[x2.readUInt32BE(i)] = {
        schema: x2.toString("utf8", i += 4, i = x2.indexOf(0, i)) || "pg_catalog",
        table: x2.toString("utf8", i + 1, i = x2.indexOf(0, i + 1)),
        columns: Array(x2.readUInt16BE(i += 2)),
        keys: []
      };
      i += 2;
      let columnIndex = 0, column;
      while (i < x2.length) {
        column = r.columns[columnIndex++] = {
          key: x2[i++],
          name: transform.column.from ? transform.column.from(x2.toString("utf8", i, i = x2.indexOf(0, i))) : x2.toString("utf8", i, i = x2.indexOf(0, i)),
          type: x2.readUInt32BE(i += 1),
          parser: parsers2[x2.readUInt32BE(i)],
          atttypmod: x2.readUInt32BE(i += 4)
        };
        column.key && r.keys.push(column);
        i += 4;
      }
    },
    Y: () => {
    },
    // Type
    O: () => {
    },
    // Origin
    B: (x2) => {
      state.date = Time(x2.readBigInt64BE(9));
      state.lsn = x2.subarray(1, 9);
    },
    I: (x2) => {
      let i = 1;
      const relation = state[x2.readUInt32BE(i)];
      const { row } = tuples(x2, relation.columns, i += 7, transform);
      handle2(row, {
        command: "insert",
        relation
      });
    },
    D: (x2) => {
      let i = 1;
      const relation = state[x2.readUInt32BE(i)];
      i += 4;
      const key2 = x2[i] === 75;
      handle2(
        key2 || x2[i] === 79 ? tuples(x2, relation.columns, i += 3, transform).row : null,
        {
          command: "delete",
          relation,
          key: key2
        }
      );
    },
    U: (x2) => {
      let i = 1;
      const relation = state[x2.readUInt32BE(i)];
      i += 4;
      const key2 = x2[i] === 75;
      const xs = key2 || x2[i] === 79 ? tuples(x2, relation.columns, i += 3, transform) : null;
      xs && (i = xs.i);
      const { row } = tuples(x2, relation.columns, i + 3, transform);
      handle2(row, {
        command: "update",
        relation,
        key: key2,
        old: xs && xs.row
      });
    },
    T: () => {
    },
    // Truncate,
    C: () => {
    }
    // Commit
  }).reduce(char, {})[x[0]](x);
}
function tuples(x, columns, xi, transform) {
  let type, column, value;
  const row = transform.raw ? new Array(columns.length) : {};
  for (let i = 0; i < columns.length; i++) {
    type = x[xi++];
    column = columns[i];
    value = type === 110 ? null : type === 117 ? void 0 : column.parser === void 0 ? x.toString("utf8", xi + 4, xi += 4 + x.readUInt32BE(xi)) : column.parser.array === true ? column.parser(x.toString("utf8", xi + 5, xi += 4 + x.readUInt32BE(xi))) : column.parser(x.toString("utf8", xi + 4, xi += 4 + x.readUInt32BE(xi)));
    transform.raw ? row[i] = transform.raw === true ? value : transform.value.from ? transform.value.from(value, column) : value : row[column.name] = transform.value.from ? transform.value.from(value, column) : value;
  }
  return { i: xi, row: transform.row.from ? transform.row.from(row) : row };
}
function parseEvent(x) {
  const xs = x.match(/^(\*|insert|update|delete)?:?([^.]+?\.?[^=]+)?=?(.+)?/i) || [];
  if (!xs)
    throw new Error("Malformed subscribe pattern: " + x);
  const [, command, path, key2] = xs;
  return (command || "*") + (path ? ":" + (path.indexOf(".") === -1 ? "public." + path : path) : "") + (key2 ? "=" + key2 : "");
}
var noop2;
var init_subscribe = __esm({
  "../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/subscribe.js"() {
    "use strict";
    noop2 = () => {
    };
  }
});

// ../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/large.js
import Stream2 from "stream";
function largeObject(sql3, oid, mode = 131072 | 262144) {
  return new Promise(async (resolve, reject) => {
    await sql3.begin(async (sql4) => {
      let finish;
      !oid && ([{ oid }] = await sql4`select lo_creat(-1) as oid`);
      const [{ fd }] = await sql4`select lo_open(${oid}, ${mode}) as fd`;
      const lo = {
        writable,
        readable,
        close: () => sql4`select lo_close(${fd})`.then(finish),
        tell: () => sql4`select lo_tell64(${fd})`,
        read: (x) => sql4`select loread(${fd}, ${x}) as data`,
        write: (x) => sql4`select lowrite(${fd}, ${x})`,
        truncate: (x) => sql4`select lo_truncate64(${fd}, ${x})`,
        seek: (x, whence = 0) => sql4`select lo_lseek64(${fd}, ${x}, ${whence})`,
        size: () => sql4`
          select
            lo_lseek64(${fd}, location, 0) as position,
            seek.size
          from (
            select
              lo_lseek64($1, 0, 2) as size,
              tell.location
            from (select lo_tell64($1) as location) tell
          ) seek
        `
      };
      resolve(lo);
      return new Promise(async (r) => finish = r);
      async function readable({
        highWaterMark = 2048 * 8,
        start = 0,
        end = Infinity
      } = {}) {
        let max = end - start;
        start && await lo.seek(start);
        return new Stream2.Readable({
          highWaterMark,
          async read(size2) {
            const l = size2 > max ? size2 - max : size2;
            max -= size2;
            const [{ data }] = await lo.read(l);
            this.push(data);
            if (data.length < size2)
              this.push(null);
          }
        });
      }
      async function writable({
        highWaterMark = 2048 * 8,
        start = 0
      } = {}) {
        start && await lo.seek(start);
        return new Stream2.Writable({
          highWaterMark,
          write(chunk, encoding, callback) {
            lo.write(chunk).then(() => callback(), callback);
          }
        });
      }
    }).catch(reject);
  });
}
var init_large = __esm({
  "../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/large.js"() {
    "use strict";
  }
});

// ../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js
import os from "os";
import fs from "fs";
function Postgres(a, b2) {
  const options = parseOptions(a, b2), subscribe = options.no_subscribe || Subscribe(Postgres, { ...options });
  let ending = false;
  const queries = queue_default(), connecting = queue_default(), reserved = queue_default(), closed = queue_default(), ended = queue_default(), open = queue_default(), busy = queue_default(), full = queue_default(), queues = { connecting, reserved, closed, ended, open, busy, full };
  const connections = [...Array(options.max)].map(() => connection_default(options, queues, { onopen, onend, onclose }));
  const sql3 = Sql(handler);
  Object.assign(sql3, {
    get parameters() {
      return options.parameters;
    },
    largeObject: largeObject.bind(null, sql3),
    subscribe,
    CLOSE,
    END: CLOSE,
    PostgresError,
    options,
    reserve: reserve2,
    listen,
    begin,
    close,
    end
  });
  return sql3;
  function Sql(handler2) {
    handler2.debug = options.debug;
    Object.entries(options.types).reduce((acc, [name, type]) => {
      acc[name] = (x) => new Parameter(x, type.to);
      return acc;
    }, typed);
    Object.assign(sql4, {
      types: typed,
      typed,
      unsafe,
      notify,
      array,
      json,
      file
    });
    return sql4;
    function typed(value, type) {
      return new Parameter(value, type);
    }
    function sql4(strings, ...args) {
      const query = strings && Array.isArray(strings.raw) ? new Query(strings, args, handler2, cancel) : typeof strings === "string" && !args.length ? new Identifier(options.transform.column.to ? options.transform.column.to(strings) : strings) : new Builder(strings, args);
      return query;
    }
    function unsafe(string, args = [], options2 = {}) {
      arguments.length === 2 && !Array.isArray(args) && (options2 = args, args = []);
      const query = new Query([string], args, handler2, cancel, {
        prepare: false,
        ...options2,
        simple: "simple" in options2 ? options2.simple : args.length === 0
      });
      return query;
    }
    function file(path, args = [], options2 = {}) {
      arguments.length === 2 && !Array.isArray(args) && (options2 = args, args = []);
      const query = new Query([], args, (query2) => {
        fs.readFile(path, "utf8", (err, string) => {
          if (err)
            return query2.reject(err);
          query2.strings = [string];
          handler2(query2);
        });
      }, cancel, {
        ...options2,
        simple: "simple" in options2 ? options2.simple : args.length === 0
      });
      return query;
    }
  }
  async function listen(name, fn, onlisten) {
    const listener = { fn, onlisten };
    const sql4 = listen.sql || (listen.sql = Postgres({
      ...options,
      max: 1,
      idle_timeout: null,
      max_lifetime: null,
      fetch_types: false,
      onclose() {
        Object.entries(listen.channels).forEach(([name2, { listeners }]) => {
          delete listen.channels[name2];
          Promise.all(listeners.map((l) => listen(name2, l.fn, l.onlisten).catch(() => {
          })));
        });
      },
      onnotify(c, x) {
        c in listen.channels && listen.channels[c].listeners.forEach((l) => l.fn(x));
      }
    }));
    const channels = listen.channels || (listen.channels = {}), exists = name in channels;
    if (exists) {
      channels[name].listeners.push(listener);
      const result2 = await channels[name].result;
      listener.onlisten && listener.onlisten();
      return { state: result2.state, unlisten };
    }
    channels[name] = { result: sql4`listen ${sql4.unsafe('"' + name.replace(/"/g, '""') + '"')}`, listeners: [listener] };
    const result = await channels[name].result;
    listener.onlisten && listener.onlisten();
    return { state: result.state, unlisten };
    async function unlisten() {
      if (name in channels === false)
        return;
      channels[name].listeners = channels[name].listeners.filter((x) => x !== listener);
      if (channels[name].listeners.length)
        return;
      delete channels[name];
      return sql4`unlisten ${sql4.unsafe('"' + name.replace(/"/g, '""') + '"')}`;
    }
  }
  async function notify(channel, payload) {
    return await sql3`select pg_notify(${channel}, ${"" + payload})`;
  }
  async function reserve2() {
    const queue = queue_default();
    const c = open.length ? open.shift() : await new Promise((resolve, reject) => {
      const query = { reserve: resolve, reject };
      queries.push(query);
      closed.length && connect(closed.shift(), query);
    });
    move(c, reserved);
    c.reserved = () => queue.length ? c.execute(queue.shift()) : move(c, reserved);
    c.reserved.release = true;
    const sql4 = Sql(handler2);
    sql4.release = () => {
      c.reserved = null;
      onopen(c);
    };
    return sql4;
    function handler2(q) {
      c.queue === full ? queue.push(q) : c.execute(q) || move(c, full);
    }
  }
  async function begin(options2, fn) {
    !fn && (fn = options2, options2 = "");
    const queries2 = queue_default();
    let savepoints = 0, connection2, prepare = null;
    try {
      await sql3.unsafe("begin " + options2.replace(/[^a-z ]/ig, ""), [], { onexecute }).execute();
      return await Promise.race([
        scope(connection2, fn),
        new Promise((_, reject) => connection2.onclose = reject)
      ]);
    } catch (error) {
      throw error;
    }
    async function scope(c, fn2, name) {
      const sql4 = Sql(handler2);
      sql4.savepoint = savepoint;
      sql4.prepare = (x) => prepare = x.replace(/[^a-z0-9$-_. ]/gi);
      let uncaughtError, result;
      name && await sql4`savepoint ${sql4(name)}`;
      try {
        result = await new Promise((resolve, reject) => {
          const x = fn2(sql4);
          Promise.resolve(Array.isArray(x) ? Promise.all(x) : x).then(resolve, reject);
        });
        if (uncaughtError)
          throw uncaughtError;
      } catch (e) {
        await (name ? sql4`rollback to ${sql4(name)}` : sql4`rollback`);
        throw e instanceof PostgresError && e.code === "25P02" && uncaughtError || e;
      }
      if (!name) {
        prepare ? await sql4`prepare transaction '${sql4.unsafe(prepare)}'` : await sql4`commit`;
      }
      return result;
      function savepoint(name2, fn3) {
        if (name2 && Array.isArray(name2.raw))
          return savepoint((sql5) => sql5.apply(sql5, arguments));
        arguments.length === 1 && (fn3 = name2, name2 = null);
        return scope(c, fn3, "s" + savepoints++ + (name2 ? "_" + name2 : ""));
      }
      function handler2(q) {
        q.catch((e) => uncaughtError || (uncaughtError = e));
        c.queue === full ? queries2.push(q) : c.execute(q) || move(c, full);
      }
    }
    function onexecute(c) {
      connection2 = c;
      move(c, reserved);
      c.reserved = () => queries2.length ? c.execute(queries2.shift()) : move(c, reserved);
    }
  }
  function move(c, queue) {
    c.queue.remove(c);
    queue.push(c);
    c.queue = queue;
    queue === open ? c.idleTimer.start() : c.idleTimer.cancel();
    return c;
  }
  function json(x) {
    return new Parameter(x, 3802);
  }
  function array(x, type) {
    if (!Array.isArray(x))
      return array(Array.from(arguments));
    return new Parameter(x, type || (x.length ? inferType(x) || 25 : 0), options.shared.typeArrayMap);
  }
  function handler(query) {
    if (ending)
      return query.reject(Errors.connection("CONNECTION_ENDED", options, options));
    if (open.length)
      return go(open.shift(), query);
    if (closed.length)
      return connect(closed.shift(), query);
    busy.length ? go(busy.shift(), query) : queries.push(query);
  }
  function go(c, query) {
    return c.execute(query) ? move(c, busy) : move(c, full);
  }
  function cancel(query) {
    return new Promise((resolve, reject) => {
      query.state ? query.active ? connection_default(options).cancel(query.state, resolve, reject) : query.cancelled = { resolve, reject } : (queries.remove(query), query.cancelled = true, query.reject(Errors.generic("57014", "canceling statement due to user request")), resolve());
    });
  }
  async function end({ timeout = null } = {}) {
    if (ending)
      return ending;
    await 1;
    let timer2;
    return ending = Promise.race([
      new Promise((r) => timeout !== null && (timer2 = setTimeout(destroy, timeout * 1e3, r))),
      Promise.all(connections.map((c) => c.end()).concat(
        listen.sql ? listen.sql.end({ timeout: 0 }) : [],
        subscribe.sql ? subscribe.sql.end({ timeout: 0 }) : []
      ))
    ]).then(() => clearTimeout(timer2));
  }
  async function close() {
    await Promise.all(connections.map((c) => c.end()));
  }
  async function destroy(resolve) {
    await Promise.all(connections.map((c) => c.terminate()));
    while (queries.length)
      queries.shift().reject(Errors.connection("CONNECTION_DESTROYED", options));
    resolve();
  }
  function connect(c, query) {
    move(c, connecting);
    c.connect(query);
    return c;
  }
  function onend(c) {
    move(c, ended);
  }
  function onopen(c) {
    if (queries.length === 0)
      return move(c, open);
    let max = Math.ceil(queries.length / (connecting.length + 1)), ready = true;
    while (ready && queries.length && max-- > 0) {
      const query = queries.shift();
      if (query.reserve)
        return query.reserve(c);
      ready = c.execute(query);
    }
    ready ? move(c, busy) : move(c, full);
  }
  function onclose(c, e) {
    move(c, closed);
    c.reserved = null;
    c.onclose && (c.onclose(e), c.onclose = null);
    options.onclose && options.onclose(c.id);
    queries.length && connect(c, queries.shift());
  }
}
function parseOptions(a, b2) {
  if (a && a.shared)
    return a;
  const env = process.env, o = (!a || typeof a === "string" ? b2 : a) || {}, { url, multihost } = parseUrl(a), query = [...url.searchParams].reduce((a2, [b3, c]) => (a2[b3] = c, a2), {}), host = o.hostname || o.host || multihost || url.hostname || env.PGHOST || "localhost", port = o.port || url.port || env.PGPORT || 5432, user = o.user || o.username || url.username || env.PGUSERNAME || env.PGUSER || osUsername();
  o.no_prepare && (o.prepare = false);
  query.sslmode && (query.ssl = query.sslmode, delete query.sslmode);
  "timeout" in o && (console.log("The timeout option is deprecated, use idle_timeout instead"), o.idle_timeout = o.timeout);
  query.sslrootcert === "system" && (query.ssl = "verify-full");
  const ints = ["idle_timeout", "connect_timeout", "max_lifetime", "max_pipeline", "backoff", "keep_alive"];
  const defaults = {
    max: globalThis.Cloudflare ? 3 : 10,
    ssl: false,
    sslnegotiation: null,
    idle_timeout: null,
    connect_timeout: 30,
    max_lifetime,
    max_pipeline: 100,
    backoff,
    keep_alive: 60,
    prepare: true,
    debug: false,
    fetch_types: true,
    publications: "alltables",
    target_session_attrs: null
  };
  return {
    host: Array.isArray(host) ? host : host.split(",").map((x) => x.split(":")[0]),
    port: Array.isArray(port) ? port : host.split(",").map((x) => parseInt(x.split(":")[1] || port)),
    path: o.path || host.indexOf("/") > -1 && host + "/.s.PGSQL." + port,
    database: o.database || o.db || (url.pathname || "").slice(1) || env.PGDATABASE || user,
    user,
    pass: o.pass || o.password || url.password || env.PGPASSWORD || "",
    ...Object.entries(defaults).reduce(
      (acc, [k, d]) => {
        const value = k in o ? o[k] : k in query ? query[k] === "disable" || query[k] === "false" ? false : query[k] : env["PG" + k.toUpperCase()] || d;
        acc[k] = typeof value === "string" && ints.includes(k) ? +value : value;
        return acc;
      },
      {}
    ),
    connection: {
      application_name: env.PGAPPNAME || "postgres.js",
      ...o.connection,
      ...Object.entries(query).reduce((acc, [k, v]) => (k in defaults || (acc[k] = v), acc), {})
    },
    types: o.types || {},
    target_session_attrs: tsa(o, url, env),
    onnotice: o.onnotice,
    onnotify: o.onnotify,
    onclose: o.onclose,
    onparameter: o.onparameter,
    socket: o.socket,
    transform: parseTransform(o.transform || { undefined: void 0 }),
    parameters: {},
    shared: { retries: 0, typeArrayMap: {} },
    ...mergeUserTypes(o.types)
  };
}
function tsa(o, url, env) {
  const x = o.target_session_attrs || url.searchParams.get("target_session_attrs") || env.PGTARGETSESSIONATTRS;
  if (!x || ["read-write", "read-only", "primary", "standby", "prefer-standby"].includes(x))
    return x;
  throw new Error("target_session_attrs " + x + " is not supported");
}
function backoff(retries) {
  return (0.5 + Math.random() / 2) * Math.min(3 ** retries / 100, 20);
}
function max_lifetime() {
  return 60 * (30 + Math.random() * 30);
}
function parseTransform(x) {
  return {
    undefined: x.undefined,
    column: {
      from: typeof x.column === "function" ? x.column : x.column && x.column.from,
      to: x.column && x.column.to
    },
    value: {
      from: typeof x.value === "function" ? x.value : x.value && x.value.from,
      to: x.value && x.value.to
    },
    row: {
      from: typeof x.row === "function" ? x.row : x.row && x.row.from,
      to: x.row && x.row.to
    }
  };
}
function parseUrl(url) {
  if (!url || typeof url !== "string")
    return { url: { searchParams: /* @__PURE__ */ new Map() } };
  let host = url;
  host = host.slice(host.indexOf("://") + 3).split(/[?/]/)[0];
  host = decodeURIComponent(host.slice(host.indexOf("@") + 1));
  const urlObj = new URL(url.replace(host, host.split(",")[0]));
  return {
    url: {
      username: decodeURIComponent(urlObj.username),
      password: decodeURIComponent(urlObj.password),
      host: urlObj.host,
      hostname: urlObj.hostname,
      port: urlObj.port,
      pathname: urlObj.pathname,
      searchParams: urlObj.searchParams
    },
    multihost: host.indexOf(",") > -1 && host
  };
}
function osUsername() {
  try {
    return os.userInfo().username;
  } catch (_) {
    return process.env.USERNAME || process.env.USER || process.env.LOGNAME;
  }
}
var src_default;
var init_src = __esm({
  "../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js"() {
    "use strict";
    init_types();
    init_connection();
    init_query();
    init_queue();
    init_errors();
    init_subscribe();
    init_large();
    Object.assign(Postgres, {
      PostgresError,
      toPascal,
      pascal,
      toCamel,
      camel,
      toKebab,
      kebab,
      fromPascal,
      fromCamel,
      fromKebab,
      BigInt: {
        to: 20,
        from: [20],
        parse: (x) => BigInt(x),
        // eslint-disable-line
        serialize: (x) => x.toString()
      }
    });
    src_default = Postgres;
  }
});

// ../../packages/db/src/schema.ts
var schema_exports = {};
__export(schema_exports, {
  accounts: () => accounts,
  adminAuditLog: () => adminAuditLog,
  apiKeys: () => apiKeys,
  balances: () => balances,
  creditLedger: () => creditLedger,
  entitlements: () => entitlements,
  models: () => models,
  modelsRelations: () => modelsRelations,
  packages: () => packages,
  packagesRelations: () => packagesRelations,
  paymentEvents: () => paymentEvents,
  payments: () => payments,
  providers: () => providers,
  providersRelations: () => providersRelations,
  redeemCodes: () => redeemCodes,
  redemptions: () => redemptions,
  requestLogs: () => requestLogs,
  requestLogsRelations: () => requestLogsRelations,
  reservations: () => reservations,
  sessions: () => sessions,
  usageRecords: () => usageRecords,
  users: () => users,
  usersRelations: () => usersRelations,
  verifications: () => verifications
});
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  uuid,
  jsonb,
  index,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
var now, updatedAt, users, sessions, accounts, verifications, apiKeys, providers, models, requestLogs, balances, creditLedger, reservations, packages, entitlements, usageRecords, payments, paymentEvents, redeemCodes, redemptions, adminAuditLog, usersRelations, providersRelations, modelsRelations, packagesRelations, requestLogsRelations;
var init_schema = __esm({
  "../../packages/db/src/schema.ts"() {
    "use strict";
    now = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
    updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
    users = pgTable("users", {
      id: uuid("id").primaryKey().defaultRandom(),
      name: text("name").notNull(),
      email: text("email").notNull().unique(),
      emailVerified: boolean("email_verified").notNull().default(false),
      image: text("image"),
      role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
      suspended: boolean("suspended").notNull().default(false),
      createdAt: now(),
      updatedAt: updatedAt()
    });
    sessions = pgTable(
      "sessions",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        token: text("token").notNull().unique(),
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        createdAt: now(),
        updatedAt: updatedAt()
      },
      (t) => [index("sessions_user_idx").on(t.userId)]
    );
    accounts = pgTable("accounts", {
      id: uuid("id").primaryKey().defaultRandom(),
      accountId: text("account_id").notNull(),
      providerId: text("provider_id").notNull(),
      userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      accessToken: text("access_token"),
      refreshToken: text("refresh_token"),
      accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
      refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
      scope: text("scope"),
      idToken: text("id_token"),
      password: text("password"),
      createdAt: now(),
      updatedAt: updatedAt()
    });
    verifications = pgTable("verifications", {
      id: uuid("id").primaryKey().defaultRandom(),
      identifier: text("identifier").notNull(),
      value: text("value").notNull(),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      createdAt: now(),
      updatedAt: updatedAt()
    });
    apiKeys = pgTable(
      "api_keys",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        keyHash: text("key_hash").notNull().unique(),
        keyPrefix: text("key_prefix").notNull(),
        status: text("status", { enum: ["active", "revoked"] }).notNull().default("active"),
        expiresAt: timestamp("expires_at", { withTimezone: true }),
        lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
        createdAt: now(),
        revokedAt: timestamp("revoked_at", { withTimezone: true })
      },
      (t) => [index("api_keys_user_idx").on(t.userId)]
    );
    providers = pgTable("providers", {
      id: uuid("id").primaryKey().defaultRandom(),
      name: text("name").notNull().unique(),
      baseUrl: text("base_url").notNull(),
      encryptedCredentials: text("encrypted_credentials"),
      credentialReference: text("credential_reference"),
      status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
      circuitBreakerState: jsonb("circuit_breaker_state").$type().notNull().default({ state: "closed", failures: 0, openUntil: null, lastFailure: null }),
      createdAt: now(),
      updatedAt: updatedAt()
    });
    models = pgTable(
      "models",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
        publicModelId: text("public_model_id").notNull().unique(),
        providerModelId: text("provider_model_id").notNull(),
        displayName: text("display_name").notNull(),
        description: text("description"),
        contextLength: integer("context_length").notNull(),
        capabilities: jsonb("capabilities").$type().notNull().default([]),
        inputCreditsPer1m: integer("input_credits_per_1m").notNull(),
        outputCreditsPer1m: integer("output_credits_per_1m").notNull(),
        providerCostInputPer1m: integer("provider_cost_input_per_1m"),
        providerCostOutputPer1m: integer("provider_cost_output_per_1m"),
        status: text("status", { enum: ["active", "inactive", "deprecated"] }).notNull().default("active"),
        replacementModelAlias: text("replacement_model_alias"),
        fallbackProviderId: uuid("fallback_provider_id").references(() => providers.id, {
          onDelete: "set null"
        }),
        createdAt: now(),
        updatedAt: updatedAt()
      },
      (t) => [index("models_provider_idx").on(t.providerId)]
    );
    requestLogs = pgTable(
      "request_logs",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        requestId: text("request_id").notNull().unique(),
        userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
        apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
        modelAlias: text("model_alias").notNull(),
        resolvedModelId: uuid("resolved_model_id").references(() => models.id, { onDelete: "set null" }),
        providerName: text("provider_name"),
        promptTokens: integer("prompt_tokens"),
        completionTokens: integer("completion_tokens"),
        creditsConsumed: bigint("credits_consumed", { mode: "number" }),
        latencyMs: integer("latency_ms"),
        gatewayLatencyMs: integer("gateway_latency_ms"),
        status: text("status", { enum: ["success", "error", "cancelled"] }).notNull(),
        errorType: text("error_type"),
        streamed: boolean("streamed").notNull().default(false),
        createdAt: now()
      },
      (t) => [
        index("req_logs_user_idx").on(t.userId),
        index("req_logs_created_idx").on(t.createdAt)
      ]
    );
    balances = pgTable("balances", {
      userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
      credits: bigint("credits", { mode: "number" }).notNull().default(0),
      updatedAt: updatedAt()
    });
    creditLedger = pgTable(
      "credit_ledger",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        entryType: text("entry_type", {
          enum: [
            "purchase",
            "redeem",
            "usage",
            "reservation",
            "settlement",
            "release",
            "refund",
            "admin_adjustment",
            "promotion"
          ]
        }).notNull(),
        amount: bigint("amount", { mode: "number" }).notNull(),
        reservationId: uuid("reservation_id"),
        sourceType: text("source_type", { enum: ["balance", "entitlement"] }).notNull().default("balance"),
        sourceId: uuid("source_id"),
        reference: text("reference"),
        createdAt: now()
      },
      (t) => [
        index("ledger_user_idx").on(t.userId),
        index("ledger_reservation_idx").on(t.reservationId)
      ]
    );
    reservations = pgTable(
      "reservations",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
        modelId: uuid("model_id").notNull().references(() => models.id, { onDelete: "restrict" }),
        sourceType: text("source_type", { enum: ["balance", "entitlement"] }).notNull(),
        sourceId: uuid("source_id"),
        estimatedCredits: bigint("estimated_credits", { mode: "number" }).notNull(),
        actualCredits: bigint("actual_credits", { mode: "number" }),
        status: text("status", { enum: ["reserved", "settled", "released"] }).notNull().default("reserved"),
        usageRecordId: uuid("usage_record_id"),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        createdAt: now(),
        settledAt: timestamp("settled_at", { withTimezone: true })
      },
      (t) => [
        index("reservations_user_idx").on(t.userId),
        index("reservations_status_idx").on(t.status)
      ]
    );
    packages = pgTable("packages", {
      id: uuid("id").primaryKey().defaultRandom(),
      name: text("name").notNull().unique(),
      description: text("description"),
      creditAllowance: bigint("credit_allowance", { mode: "number" }).notNull(),
      modelId: uuid("model_id").references(() => models.id, { onDelete: "set null" }),
      durationHours: integer("duration_hours"),
      priceCents: integer("price_cents"),
      currency: text("currency").notNull().default("IDR"),
      recurring: boolean("recurring").notNull().default(false),
      status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
      createdAt: now(),
      updatedAt: updatedAt()
    });
    entitlements = pgTable(
      "entitlements",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        packageId: uuid("package_id").references(() => packages.id, { onDelete: "set null" }),
        modelId: uuid("model_id").references(() => models.id, { onDelete: "set null" }),
        allowance: bigint("allowance", { mode: "number" }).notNull(),
        remaining: bigint("remaining", { mode: "number" }).notNull(),
        source: text("source", { enum: ["purchase", "redeem", "admin", "promotion"] }).notNull(),
        startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        status: text("status", { enum: ["active", "exhausted", "expired", "revoked"] }).notNull().default("active"),
        createdAt: now()
      },
      (t) => [index("entitlements_user_idx").on(t.userId), index("entitlements_status_idx").on(t.status)]
    );
    usageRecords = pgTable(
      "usage_records",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
        modelId: uuid("model_id").notNull().references(() => models.id, { onDelete: "restrict" }),
        providerId: uuid("provider_id").references(() => providers.id, { onDelete: "set null" }),
        requestId: text("request_id").notNull().unique(),
        promptTokens: integer("prompt_tokens").notNull().default(0),
        completionTokens: integer("completion_tokens").notNull().default(0),
        totalTokens: integer("total_tokens").notNull().default(0),
        creditsConsumed: bigint("credits_consumed", { mode: "number" }).notNull().default(0),
        latencyMs: integer("latency_ms"),
        status: text("status", { enum: ["success", "error"] }).notNull(),
        error: text("error"),
        streamed: boolean("streamed").notNull().default(false),
        createdAt: now()
      },
      (t) => [index("usage_user_idx").on(t.userId), index("usage_model_idx").on(t.modelId)]
    );
    payments = pgTable(
      "payments",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        provider: text("provider").notNull(),
        externalId: text("external_id").notNull().unique(),
        packageId: uuid("package_id").references(() => packages.id, { onDelete: "set null" }),
        amountCents: integer("amount_cents").notNull(),
        currency: text("currency").notNull().default("IDR"),
        credits: bigint("credits", { mode: "number" }).notNull(),
        status: text("status", { enum: ["pending", "paid", "failed", "expired", "refunded"] }).notNull().default("pending"),
        paidAt: timestamp("paid_at", { withTimezone: true }),
        createdAt: now()
      },
      (t) => [index("payments_user_idx").on(t.userId)]
    );
    paymentEvents = pgTable("payment_events", {
      id: uuid("id").primaryKey().defaultRandom(),
      provider: text("provider").notNull(),
      eventId: text("event_id").notNull(),
      paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
      payload: jsonb("payload").notNull(),
      processedAt: now()
    }, (t) => [uniqueIndex("payment_events_unique").on(t.provider, t.eventId)]);
    redeemCodes = pgTable("redeem_codes", {
      id: uuid("id").primaryKey().defaultRandom(),
      code: text("code").notNull().unique(),
      name: text("name"),
      rewardType: text("reward_type", { enum: ["credits", "package"] }).notNull(),
      creditAmount: bigint("credit_amount", { mode: "number" }),
      packageId: uuid("package_id").references(() => packages.id, { onDelete: "set null" }),
      modelId: uuid("model_id").references(() => models.id, { onDelete: "set null" }),
      durationHours: integer("duration_hours"),
      maxRedemptions: integer("max_redemptions"),
      redeemedCount: integer("redeemed_count").notNull().default(0),
      expiresAt: timestamp("expires_at", { withTimezone: true }),
      active: boolean("active").notNull().default(true),
      createdAt: now()
    });
    redemptions = pgTable(
      "redemptions",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        codeId: uuid("code_id").notNull().references(() => redeemCodes.id, { onDelete: "cascade" }),
        userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        createdAt: now()
      },
      (t) => [uniqueIndex("redemptions_unique").on(t.codeId, t.userId)]
    );
    adminAuditLog = pgTable(
      "admin_audit_log",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
        action: text("action").notNull(),
        entity: text("entity").notNull(),
        entityId: text("entity_id"),
        detail: jsonb("detail"),
        createdAt: now()
      },
      (t) => [index("audit_admin_idx").on(t.adminId)]
    );
    usersRelations = relations(users, ({ many, one }) => ({
      sessions: many(sessions),
      accounts: many(accounts),
      apiKeys: many(apiKeys),
      balance: one(balances),
      ledger: many(creditLedger),
      entitlements: many(entitlements),
      usage: many(usageRecords),
      payments: many(payments),
      requestLogs: many(requestLogs)
    }));
    providersRelations = relations(providers, ({ many }) => ({
      models: many(models)
    }));
    modelsRelations = relations(models, ({ one, many }) => ({
      provider: one(providers, { fields: [models.providerId], references: [providers.id] }),
      fallbackProvider: one(providers, { fields: [models.fallbackProviderId], references: [providers.id] }),
      requestLogs: many(requestLogs)
    }));
    packagesRelations = relations(packages, ({ one }) => ({
      model: one(models, { fields: [packages.modelId], references: [models.id] })
    }));
    requestLogsRelations = relations(requestLogs, ({ one }) => ({
      user: one(users, { fields: [requestLogs.userId], references: [users.id] }),
      apiKey: one(apiKeys, { fields: [requestLogs.apiKeyId], references: [apiKeys.id] }),
      resolvedModel: one(models, { fields: [requestLogs.resolvedModelId], references: [models.id] })
    }));
  }
});

// ../../packages/db/src/index.ts
var src_exports = {};
__export(src_exports, {
  accounts: () => accounts,
  adminAuditLog: () => adminAuditLog,
  apiKeys: () => apiKeys,
  balances: () => balances,
  creditLedger: () => creditLedger,
  db: () => db,
  entitlements: () => entitlements,
  getDb: () => getDb,
  models: () => models,
  modelsRelations: () => modelsRelations,
  packages: () => packages,
  packagesRelations: () => packagesRelations,
  paymentEvents: () => paymentEvents,
  payments: () => payments,
  providers: () => providers,
  providersRelations: () => providersRelations,
  redeemCodes: () => redeemCodes,
  redemptions: () => redemptions,
  requestLogs: () => requestLogs,
  requestLogsRelations: () => requestLogsRelations,
  reservations: () => reservations,
  schema: () => schema_exports,
  sessions: () => sessions,
  usageRecords: () => usageRecords,
  users: () => users,
  usersRelations: () => usersRelations,
  verifications: () => verifications
});
import { drizzle } from "drizzle-orm/postgres-js";
function getDb() {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL ?? "postgresql://unset:unset@localhost:5432/unset";
    const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
    instance = drizzle(
      src_default(connectionString, {
        max: isVercel ? 1 : 10,
        prepare: false,
        idle_timeout: 15
      }),
      { schema: schema_exports }
    );
  }
  return instance;
}
var instance, db;
var init_src2 = __esm({
  "../../packages/db/src/index.ts"() {
    "use strict";
    init_src();
    init_schema();
    init_schema();
    instance = null;
    db = new Proxy({}, {
      get(_t, prop) {
        return Reflect.get(getDb(), prop);
      }
    });
  }
});

// src/lib/duitku.ts
var duitku_exports = {};
__export(duitku_exports, {
  checkTransactionStatus: () => checkTransactionStatus,
  createTransaction: () => createTransaction,
  verifyCallbackSignature: () => verifyCallbackSignature
});
import { createHmac, timingSafeEqual } from "crypto";
function getMerchantCode() {
  const code = process.env.DUITKU_MERCHANT_CODE;
  if (!code) throw new Error("DUITKU_MERCHANT_CODE is not set");
  return code;
}
function getApiKey() {
  const key2 = process.env.DUITKU_API_KEY;
  if (!key2) throw new Error("DUITKU_API_KEY is not set");
  return key2;
}
function baseUrl() {
  const env = process.env.DUITKU_ENV ?? "sandbox";
  return env === "production" ? "https://passport.duitku.com/webapi" : "https://sandbox.duitku.com/webapi";
}
function hmacSha256(data, key2) {
  return createHmac("sha256", key2).update(data).digest("hex");
}
async function createTransaction(params) {
  const merchantCode = getMerchantCode();
  const apiKey = getApiKey();
  const stringToSign = `${merchantCode}${params.merchantOrderId}${params.paymentAmount}`;
  const signature = hmacSha256(stringToSign, apiKey);
  const body = {
    merchantCode,
    paymentAmount: params.paymentAmount,
    merchantOrderId: params.merchantOrderId,
    productDetails: params.productDetails,
    email: params.email,
    customerVaName: params.customerVaName,
    callbackUrl: params.callbackUrl,
    returnUrl: params.returnUrl,
    signature,
    expiryPeriod: params.expiryPeriod ?? 60
  };
  if (params.paymentMethod) {
    body.paymentMethod = params.paymentMethod;
  }
  const url = `${baseUrl()}/api/merchant/v2/inquiry`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) {
    const text2 = await res.text().catch(() => "");
    throw new Error(`Duitku createTransaction HTTP ${res.status}: ${text2.slice(0, 300)}`);
  }
  const data = await res.json();
  if (data.statusCode !== "00") {
    throw new Error(`Duitku createTransaction failed: ${data.statusMessage ?? data.Message ?? "unknown error"}`);
  }
  return {
    paymentUrl: data.paymentUrl,
    reference: data.reference,
    statusCode: data.statusCode,
    statusMessage: data.statusMessage
  };
}
async function checkTransactionStatus(merchantOrderId) {
  const merchantCode = getMerchantCode();
  const apiKey = getApiKey();
  const signature = hmacSha256(`${merchantCode}${merchantOrderId}`, apiKey);
  const params = { merchantCode, merchantOrderId, signature };
  const url = `${baseUrl()}/api/merchant/transactionStatus`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) {
    const text2 = await res.text().catch(() => "");
    throw new Error(`Duitku checkTransaction HTTP ${res.status}: ${text2.slice(0, 300)}`);
  }
  const data = await res.json();
  return data;
}
function verifyCallbackSignature(payload) {
  const apiKey = getApiKey();
  const stringToSign = `${payload.merchantCode}${payload.amount}${payload.merchantOrderId}`;
  const expected = hmacSha256(stringToSign, apiKey);
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(payload.signature, "hex")
    );
  } catch {
    return false;
  }
}
var init_duitku = __esm({
  "src/lib/duitku.ts"() {
    "use strict";
  }
});

// src/index.vercel.ts
import { handle } from "hono/vercel";

// src/app.ts
import { Hono as Hono7 } from "hono";
import { cors } from "hono/cors";

// src/routes/v1.ts
import { randomUUID } from "crypto";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

// ../../packages/shared/src/types.ts
import { z } from "zod";
var chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool", "developer"]),
  content: z.union([z.string(), z.array(z.unknown())]),
  name: z.string().optional()
});
var chatCompletionRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(chatMessageSchema).min(1),
  stream: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().positive().optional(),
  stop: z.union([z.string(), z.array(z.string())]).nullish(),
  tools: z.array(z.unknown()).optional(),
  tool_choice: z.unknown().optional(),
  response_format: z.unknown().optional()
});

// ../../packages/shared/src/credits.ts
function estimatePromptTokens(text2) {
  return Math.ceil(text2.length / 4);
}
function tokensToCredits(tokens, creditsPer1m) {
  return Math.ceil(tokens * creditsPer1m / 1e6);
}
function reserveOutputCap(input) {
  const cap = Math.min(
    input.requestedMaxTokens ?? input.modelContextLength,
    input.modelContextLength,
    input.hardReserveCap
  );
  return Math.max(cap, 0);
}
function estimateReservation(input) {
  const inputCredits = tokensToCredits(input.promptTokens, input.pricing.inputCreditsPer1m);
  const outputCredits = tokensToCredits(
    reserveOutputCap(input),
    input.pricing.outputCreditsPer1m
  );
  return inputCredits + outputCredits;
}

// src/domain/router.ts
init_src2();
import { eq as eq2, and, or } from "drizzle-orm";

// ../../packages/shared/src/provider-crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
var ALGO = "aes-256-gcm";
function key() {
  const hex = process.env.PROVIDER_ENC_KEY;
  if (!hex || hex.length !== 64 || /^0+$/.test(hex)) {
    throw new Error("PROVIDER_ENC_KEY must be 64-char (32-byte) hex, not all zeros");
  }
  return Buffer.from(hex, "hex");
}
function decrypt(payload) {
  const [ivB, tagB, dataB] = payload.split(".");
  if (!ivB || !tagB || !dataB) throw new Error("malformed encrypted credential");
  const decipher = createDecipheriv(
    ALGO,
    key(),
    Buffer.from(ivB, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
function resolveProviderCredential(encrypted, reference) {
  if (encrypted) return decrypt(encrypted);
  if (reference?.startsWith("env:")) return process.env[reference.slice(4)] ?? null;
  return null;
}

// ../../packages/shared/src/models.ts
var MODEL_ALIASES = {
  "claude-3-5": "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
  "claude-3.5-sonnet": "claude-3-5-sonnet-20241022",
  "claude-3.5-sonnet-proxy": "claude-3-5-sonnet-20241022",
  "deepseek-chat": "deepseek-v4",
  "deepseek-coder": "deepseek-v4",
  "qwen-2-5-max": "qwen-2.5-max",
  "qwen-max": "qwen-2.5-max",
  "kimi-coding": "kimi-k1.5",
  "kimi-k1-5": "kimi-k1.5"
};
function normalizeModelId(modelId) {
  const clean = modelId.trim().toLowerCase();
  return MODEL_ALIASES[clean] ?? clean;
}

// src/domain/circuit-breaker.ts
init_src2();
import { eq } from "drizzle-orm";
var FAILURE_THRESHOLD = Number(process.env.CB_FAILURE_THRESHOLD ?? 5);
var FAILURE_WINDOW_MS = Number(process.env.CB_FAILURE_WINDOW_MS ?? 6e4);
var OPEN_DURATION_MS = Number(process.env.CB_OPEN_DURATION_MS ?? 12e4);
var DEFAULT_STATE = {
  state: "closed",
  failures: 0,
  openUntil: null,
  lastFailure: null
};
async function getCircuitState(providerId) {
  try {
    const [row] = await db.select({ circuitBreakerState: schema_exports.providers.circuitBreakerState }).from(schema_exports.providers).where(eq(schema_exports.providers.id, providerId)).limit(1);
    return row?.circuitBreakerState ?? DEFAULT_STATE;
  } catch (e) {
    console.error(`[circuit-breaker] failed to fetch state for provider ${providerId}:`, e);
    return DEFAULT_STATE;
  }
}
async function isCircuitOpen(providerId) {
  const state = await getCircuitState(providerId);
  if (state.state === "open") {
    if (state.openUntil && new Date(state.openUntil) <= /* @__PURE__ */ new Date()) {
      const newState = {
        ...state,
        state: "half-open"
      };
      await updateCircuitState(providerId, newState);
      return false;
    }
    return true;
  }
  return false;
}
async function recordFailure(providerId) {
  const now2 = /* @__PURE__ */ new Date();
  const state = await getCircuitState(providerId);
  let newFailures = 1;
  if (state.lastFailure) {
    const lastFailTime = new Date(state.lastFailure).getTime();
    if (now2.getTime() - lastFailTime <= FAILURE_WINDOW_MS) {
      newFailures = state.failures + 1;
    }
  }
  let newState = state.state;
  let openUntil = state.openUntil;
  if (newFailures >= FAILURE_THRESHOLD || state.state === "half-open") {
    newState = "open";
    openUntil = new Date(now2.getTime() + OPEN_DURATION_MS).toISOString();
  }
  const updatedState = {
    state: newState,
    failures: newFailures,
    openUntil,
    lastFailure: now2.toISOString()
  };
  await updateCircuitState(providerId, updatedState);
}
async function recordSuccess(providerId) {
  const state = await getCircuitState(providerId);
  if (state.state !== "closed" || state.failures > 0) {
    await updateCircuitState(providerId, DEFAULT_STATE);
  }
}
async function updateCircuitState(providerId, state) {
  try {
    await db.update(schema_exports.providers).set({ circuitBreakerState: state }).where(eq(schema_exports.providers.id, providerId));
  } catch (e) {
    console.error(`[circuit-breaker] failed to update state for provider ${providerId}:`, e);
  }
}

// src/domain/router.ts
var UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS ?? 6e4);
async function resolveModelRow(publicModelId) {
  const normalized = normalizeModelId(publicModelId);
  const [row] = await db.select({
    modelId: schema_exports.models.id,
    providerModelId: schema_exports.models.providerModelId,
    contextLength: schema_exports.models.contextLength,
    inputCreditsPer1m: schema_exports.models.inputCreditsPer1m,
    outputCreditsPer1m: schema_exports.models.outputCreditsPer1m,
    modelStatus: schema_exports.models.status,
    replacementModelAlias: schema_exports.models.replacementModelAlias,
    fallbackProviderId: schema_exports.models.fallbackProviderId,
    providerId: schema_exports.providers.id,
    providerName: schema_exports.providers.name,
    baseUrl: schema_exports.providers.baseUrl,
    encryptedCredentials: schema_exports.providers.encryptedCredentials,
    credentialReference: schema_exports.providers.credentialReference,
    providerStatus: schema_exports.providers.status
  }).from(schema_exports.models).innerJoin(schema_exports.providers, eq2(schema_exports.models.providerId, schema_exports.providers.id)).where(or(eq2(schema_exports.models.publicModelId, publicModelId), eq2(schema_exports.models.publicModelId, normalized))).limit(1);
  return row ?? null;
}
function buildRoute(row, options) {
  const prov = options.providerOverride ?? {
    id: row.providerId,
    name: row.providerName,
    baseUrl: row.baseUrl,
    encryptedCredentials: row.encryptedCredentials,
    credentialReference: row.credentialReference
  };
  return {
    providerName: prov.name,
    baseUrl: prov.baseUrl,
    credential: resolveProviderCredential(prov.encryptedCredentials, prov.credentialReference),
    providerModelId: row.providerModelId,
    modelId: row.modelId,
    contextLength: row.contextLength,
    pricing: {
      inputCreditsPer1m: row.inputCreditsPer1m,
      outputCreditsPer1m: row.outputCreditsPer1m
    },
    providerId: prov.id,
    isUsingFallback: options.isUsingFallback,
    deprecationWarning: options.deprecationWarning
  };
}
async function resolveModelWithFallback(publicModelId) {
  const row = await resolveModelRow(publicModelId);
  if (!row || row.modelStatus === "inactive") return null;
  if (row.modelStatus === "deprecated" && row.replacementModelAlias) {
    const replacementRow = await resolveModelRow(row.replacementModelAlias);
    if (replacementRow && replacementRow.modelStatus === "active" && replacementRow.providerStatus === "active") {
      if (!await isCircuitOpen(replacementRow.providerId)) {
        return buildRoute(replacementRow, {
          isUsingFallback: false,
          deprecationWarning: `model '${publicModelId}' is deprecated; redirected to '${row.replacementModelAlias}'`
        });
      }
    }
  }
  if (row.providerStatus === "active" && !await isCircuitOpen(row.providerId)) {
    return buildRoute(row, {
      isUsingFallback: false,
      deprecationWarning: row.modelStatus === "deprecated" ? `model '${publicModelId}' is deprecated` : null
    });
  }
  if (row.fallbackProviderId) {
    const [fallbackProvider] = await db.select({
      id: schema_exports.providers.id,
      name: schema_exports.providers.name,
      baseUrl: schema_exports.providers.baseUrl,
      encryptedCredentials: schema_exports.providers.encryptedCredentials,
      credentialReference: schema_exports.providers.credentialReference,
      status: schema_exports.providers.status
    }).from(schema_exports.providers).where(and(eq2(schema_exports.providers.id, row.fallbackProviderId), eq2(schema_exports.providers.status, "active"))).limit(1);
    if (fallbackProvider && !await isCircuitOpen(fallbackProvider.id)) {
      return buildRoute(row, {
        providerOverride: fallbackProvider,
        isUsingFallback: true,
        deprecationWarning: row.modelStatus === "deprecated" ? `model '${publicModelId}' is deprecated` : null
      });
    }
  }
  return null;
}
var OpenAiCompatibleAdapter = class {
  async dispatchRequest(req) {
    const { route, body, stream, signal } = req;
    const url = `${route.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const payload = { ...body, model: route.providerModelId, stream };
    const headers = { "content-type": "application/json" };
    if (route.credential) headers["authorization"] = `Bearer ${route.credential}`;
    const timeoutSignal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
    let combinedSignal = timeoutSignal;
    if (signal && typeof AbortSignal.any === "function") {
      try {
        combinedSignal = AbortSignal.any([signal, timeoutSignal]);
      } catch {
        combinedSignal = timeoutSignal;
      }
    }
    return fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: combinedSignal
    });
  }
};
var ProviderAdapterFactory = class {
  static defaultAdapter = new OpenAiCompatibleAdapter();
  static adapters = /* @__PURE__ */ new Map();
  static registerAdapter(providerName, adapter) {
    this.adapters.set(providerName.toLowerCase(), adapter);
  }
  static getAdapter(providerName) {
    return this.adapters.get(providerName.toLowerCase()) ?? this.defaultAdapter;
  }
};
async function callProvider(req) {
  const adapter = ProviderAdapterFactory.getAdapter(req.route.providerName);
  return adapter.dispatchRequest(req);
}
function normalizeUpstreamError(upstreamStatus) {
  switch (true) {
    case upstreamStatus === "timeout":
      return {
        type: "server_error",
        code: "provider_timeout",
        httpStatus: 504,
        countAsFailure: false
      };
    case upstreamStatus === 429:
      return {
        type: "rate_limit_error",
        code: "provider_rate_limited",
        httpStatus: 429,
        countAsFailure: true
      };
    case (upstreamStatus === 401 || upstreamStatus === 403):
      return {
        type: "server_error",
        code: "provider_auth_failed",
        httpStatus: 503,
        countAsFailure: false
      };
    case (upstreamStatus === "network" || typeof upstreamStatus === "number" && upstreamStatus >= 500):
      return {
        type: "server_error",
        code: "provider_error",
        httpStatus: 502,
        countAsFailure: true
      };
    default:
      return {
        type: "server_error",
        code: "provider_error",
        httpStatus: 502,
        countAsFailure: false
      };
  }
}

// src/middleware/logger.ts
init_src2();
function logRequest(input) {
  db.insert(schema_exports.requestLogs).values({ ...input }).catch((e) => console.error("[logger] failed to insert request_log:", e));
}

// ../../packages/db/src/billing.ts
init_src2();
init_schema();
import { and as and2, eq as eq3, gt, lt, sql } from "drizzle-orm";
var InsufficientCreditsError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "InsufficientCreditsError";
  }
};
function hardReserveCap() {
  return Number(process.env.HARD_RESERVE_CAP ?? 16384);
}
function reservationTtlMinutes() {
  return Number(process.env.RESERVATION_TTL_MINUTES ?? 10);
}
async function writeBalanceLedger(tx, entry) {
  await tx.insert(creditLedger).values({
    userId: entry.userId,
    entryType: entry.entryType,
    amount: entry.amount,
    reservationId: entry.reservationId ?? null,
    sourceType: "balance",
    sourceId: entry.sourceId ?? null,
    reference: entry.reference ?? null
  });
  await tx.insert(balances).values({ userId: entry.userId, credits: entry.amount }).onConflictDoUpdate({
    target: balances.userId,
    set: { credits: sql`${balances.credits} + ${entry.amount}`, updatedAt: /* @__PURE__ */ new Date() }
  });
}
async function pickSource(tx, userId, modelId, estimatedCredits) {
  const now2 = /* @__PURE__ */ new Date();
  const [ent] = await tx.select().from(entitlements).where(
    and2(
      eq3(entitlements.userId, userId),
      eq3(entitlements.status, "active"),
      eq3(entitlements.modelId, modelId),
      gt(entitlements.expiresAt, now2),
      gt(entitlements.remaining, 0)
    )
  ).orderBy(entitlements.expiresAt).limit(1);
  if (ent) return { sourceType: "entitlement", sourceId: ent.id };
  const [bal] = await tx.select().from(balances).where(eq3(balances.userId, userId)).for("update");
  if (bal && bal.credits >= estimatedCredits) {
    return { sourceType: "balance", sourceId: null };
  }
  return null;
}
async function reserve(input) {
  const estimatedCredits = estimateReservation({
    promptTokens: input.promptTokens,
    requestedMaxTokens: input.requestedMaxTokens,
    modelContextLength: input.model.contextLength,
    hardReserveCap: hardReserveCap(),
    pricing: input.model.pricing
  });
  return db.transaction(async (tx) => {
    const source = await pickSource(tx, input.userId, input.model.id, estimatedCredits);
    if (!source) {
      throw new InsufficientCreditsError(
        `insufficient credits: need >= ${estimatedCredits} reserved`
      );
    }
    if (source.sourceType === "entitlement" && source.sourceId) {
      const [ent] = await tx.select().from(entitlements).where(eq3(entitlements.id, source.sourceId)).for("update");
      if (!ent || ent.remaining <= 0) {
        throw new InsufficientCreditsError("entitlement exhausted");
      }
      await tx.update(entitlements).set({ remaining: sql`${entitlements.remaining} - ${estimatedCredits}` }).where(eq3(entitlements.id, ent.id));
      await tx.insert(creditLedger).values({
        userId: input.userId,
        entryType: "reservation",
        amount: -estimatedCredits,
        sourceType: "entitlement",
        sourceId: ent.id,
        reference: input.requestId
      });
    } else {
      await writeBalanceLedger(tx, {
        userId: input.userId,
        entryType: "reservation",
        amount: -estimatedCredits,
        reference: input.requestId
      });
    }
    const [res] = await tx.insert(reservations).values({
      userId: input.userId,
      apiKeyId: input.apiKeyId,
      modelId: input.model.id,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      estimatedCredits,
      expiresAt: new Date(Date.now() + reservationTtlMinutes() * 6e4)
    }).returning();
    return {
      id: res.id,
      sourceType: res.sourceType,
      sourceId: res.sourceId,
      estimatedCredits: res.estimatedCredits
    };
  });
}
async function settle(input) {
  const actualCredits = input.status === "success" ? tokensToCredits(input.promptTokens, input.pricing.inputCreditsPer1m) + tokensToCredits(input.completionTokens, input.pricing.outputCreditsPer1m) : 0;
  const charged = Math.min(actualCredits, input.reservation.estimatedCredits);
  const refunded = input.reservation.estimatedCredits - charged;
  return db.transaction(async (tx) => {
    const [res] = await tx.select().from(reservations).where(and2(eq3(reservations.id, input.reservation.id), eq3(reservations.status, "reserved"))).for("update");
    if (!res) {
      throw new Error(`reservation ${input.reservation.id} not in reserved state`);
    }
    const [usage] = await tx.insert(usageRecords).values({
      userId: input.userId,
      apiKeyId: res.apiKeyId,
      modelId: res.modelId,
      requestId: input.requestId,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.promptTokens + input.completionTokens,
      creditsConsumed: charged,
      latencyMs: input.latencyMs ?? null,
      status: input.status,
      error: input.error ?? null,
      streamed: input.streamed ?? false
    }).returning();
    if (res.sourceType === "entitlement" && res.sourceId) {
      if (refunded > 0) {
        await tx.update(entitlements).set({ remaining: sql`${entitlements.remaining} + ${refunded}` }).where(eq3(entitlements.id, res.sourceId));
        await tx.insert(creditLedger).values({
          userId: input.userId,
          entryType: "release",
          amount: refunded,
          reservationId: res.id,
          sourceType: "entitlement",
          sourceId: res.sourceId,
          reference: input.requestId
        });
      }
    } else {
      if (refunded > 0) {
        await writeBalanceLedger(tx, {
          userId: input.userId,
          entryType: "release",
          amount: refunded,
          reservationId: res.id,
          reference: input.requestId
        });
      }
    }
    await tx.update(reservations).set({
      status: "settled",
      actualCredits: charged,
      usageRecordId: usage.id,
      settledAt: /* @__PURE__ */ new Date()
    }).where(eq3(reservations.id, res.id));
    return { actualCredits: charged, refunded, usageRecordId: usage.id };
  });
}
async function grantCredits(input) {
  await db.transaction(async (tx) => {
    await writeBalanceLedger(tx, {
      userId: input.userId,
      entryType: input.entryType,
      amount: input.amount,
      reference: input.reference ?? null
    });
  });
}
async function grantEntitlement(input) {
  const [ent] = await db.insert(entitlements).values({
    userId: input.userId,
    packageId: input.packageId ?? null,
    modelId: input.modelId ?? null,
    allowance: input.allowance,
    remaining: input.allowance,
    source: input.source,
    expiresAt: new Date(Date.now() + (input.durationHours ?? 24) * 36e5)
  }).returning();
  return ent.id;
}

// src/middleware/auth.ts
init_src2();
import { createHash } from "crypto";
import { eq as eq4, and as and3 } from "drizzle-orm";

// src/ratelimit.ts
var InMemoryRateLimitStore = class {
  counters = /* @__PURE__ */ new Map();
  concurrencySets = /* @__PURE__ */ new Map();
  async increment(key2, ttlSeconds) {
    const now2 = Date.now();
    this.cleanExpiredCounters(now2);
    const entry = this.counters.get(key2);
    if (!entry || entry.expiresAt <= now2) {
      const newEntry = { count: 1, expiresAt: now2 + ttlSeconds * 1e3 };
      this.counters.set(key2, newEntry);
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }
  async getConcurrency(setKey, minTimestampMs) {
    const tokens = this.concurrencySets.get(setKey);
    if (!tokens) return 0;
    for (const [token, ts] of tokens.entries()) {
      if (ts < minTimestampMs) {
        tokens.delete(token);
      }
    }
    if (tokens.size === 0) {
      this.concurrencySets.delete(setKey);
      return 0;
    }
    return tokens.size;
  }
  async addConcurrency(setKey, token, timestampMs) {
    let tokens = this.concurrencySets.get(setKey);
    if (!tokens) {
      tokens = /* @__PURE__ */ new Map();
      this.concurrencySets.set(setKey, tokens);
    }
    tokens.set(token, timestampMs);
  }
  async removeConcurrency(setKey, token) {
    const tokens = this.concurrencySets.get(setKey);
    if (tokens) {
      tokens.delete(token);
      if (tokens.size === 0) {
        this.concurrencySets.delete(setKey);
      }
    }
  }
  cleanExpiredCounters(now2) {
    if (this.counters.size > 1e3) {
      for (const [k, v] of this.counters.entries()) {
        if (v.expiresAt <= now2) {
          this.counters.delete(k);
        }
      }
    }
  }
};
var rateLimitStore = new InMemoryRateLimitStore();
var RATE_WINDOW_SECONDS = 60;
var CONCURRENCY_TTL_SECONDS = 300;
async function checkRateLimit(keyId, rpm) {
  const bucket = Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1e3));
  const key2 = `rl:${keyId}:${bucket}`;
  const count2 = await rateLimitStore.increment(key2, RATE_WINDOW_SECONDS * 2);
  return count2 <= rpm;
}
async function trackConcurrency(keyId, max) {
  const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const setKey = `cc:${keyId}`;
  const now2 = Date.now();
  const minTimestamp = now2 - CONCURRENCY_TTL_SECONDS * 1e3;
  const current = await rateLimitStore.getConcurrency(setKey, minTimestamp);
  if (current >= max) {
    return { acquired: false, token };
  }
  await rateLimitStore.addConcurrency(setKey, token, now2);
  return { acquired: true, token };
}
async function releaseConcurrency(keyId, token) {
  await rateLimitStore.removeConcurrency(`cc:${keyId}`, token);
}

// src/middleware/auth.ts
async function apiKeyAuth(c, next) {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer mp-")) {
    return c.json(
      { error: { message: "missing or invalid api key", type: "auth_error", code: "missing_api_key" } },
      401
    );
  }
  const raw = header.slice("Bearer ".length).trim();
  const hash = createHash("sha256").update(raw).digest("hex");
  const [key2] = await db.select({
    id: schema_exports.apiKeys.id,
    userId: schema_exports.apiKeys.userId,
    status: schema_exports.apiKeys.status,
    expiresAt: schema_exports.apiKeys.expiresAt
  }).from(schema_exports.apiKeys).where(and3(eq4(schema_exports.apiKeys.keyHash, hash), eq4(schema_exports.apiKeys.status, "active"))).limit(1);
  if (!key2) {
    return c.json(
      { error: { message: "invalid or revoked api key", type: "auth_error", code: "invalid_api_key" } },
      401
    );
  }
  if (key2.expiresAt && key2.expiresAt < /* @__PURE__ */ new Date()) {
    return c.json(
      { error: { message: "api key has expired", type: "auth_error", code: "api_key_expired" } },
      401
    );
  }
  const [user] = await db.select({ suspended: schema_exports.users.suspended }).from(schema_exports.users).where(eq4(schema_exports.users.id, key2.userId)).limit(1);
  if (!user || user.suspended) {
    return c.json(
      { error: { message: "account suspended", type: "auth_error", code: "account_suspended" } },
      403
    );
  }
  db.update(schema_exports.apiKeys).set({ lastUsedAt: /* @__PURE__ */ new Date() }).where(eq4(schema_exports.apiKeys.id, key2.id)).catch(() => {
  });
  c.set("apiKey", { keyId: key2.id, userId: key2.userId });
  await next();
}
function gatewayGuards(limit) {
  return async (c, next) => {
    const { keyId } = c.get("apiKey");
    if (!await checkRateLimit(keyId, limit.rpm)) {
      return c.json(
        { error: { message: "rate limit exceeded", type: "rate_limit_error", code: "rate_limit_exceeded" } },
        429
      );
    }
    const slot = await trackConcurrency(keyId, limit.concurrency);
    if (!slot.acquired) {
      return c.json(
        {
          error: {
            message: "concurrency limit exceeded",
            type: "rate_limit_error",
            code: "concurrency_limit_exceeded"
          }
        },
        429
      );
    }
    try {
      await next();
    } finally {
      await releaseConcurrency(keyId, slot.token);
    }
  };
}

// src/routes/v1.ts
var v1 = new Hono();
v1.use("*", apiKeyAuth);
v1.use("*", gatewayGuards({ rpm: 120, concurrency: 5 }));
v1.get("/models", async (c) => {
  const { db: db2, schema: s } = await Promise.resolve().then(() => (init_src2(), src_exports));
  const { inArray } = await import("drizzle-orm");
  const rows = await db2.select({
    id: s.models.publicModelId,
    displayName: s.models.displayName,
    contextLength: s.models.contextLength,
    capabilities: s.models.capabilities,
    status: s.models.status,
    replacementModelAlias: s.models.replacementModelAlias
  }).from(s.models).where(inArray(s.models.status, ["active", "deprecated"]));
  return c.json({
    object: "list",
    data: rows.map((m) => ({
      id: m.id,
      object: "model",
      created: 0,
      owned_by: "morphic",
      display_name: m.displayName,
      context_length: m.contextLength,
      capabilities: m.capabilities,
      status: m.status,
      replacement_model_alias: m.replacementModelAlias
    }))
  });
});
v1.get("/models/:id", async (c) => {
  const modelId = c.req.param("id");
  const { db: db2, schema: s } = await Promise.resolve().then(() => (init_src2(), src_exports));
  const { eq: eq11, and: and10, inArray } = await import("drizzle-orm");
  const [m] = await db2.select({
    id: s.models.publicModelId,
    displayName: s.models.displayName,
    contextLength: s.models.contextLength,
    capabilities: s.models.capabilities,
    status: s.models.status,
    replacementModelAlias: s.models.replacementModelAlias
  }).from(s.models).where(
    and10(
      eq11(s.models.publicModelId, modelId),
      inArray(s.models.status, ["active", "deprecated"])
    )
  ).limit(1);
  if (!m) {
    return c.json(
      { error: { message: `model '${modelId}' not found`, type: "invalid_request_error", code: "model_not_found" } },
      404
    );
  }
  return c.json({
    id: m.id,
    object: "model",
    created: 0,
    owned_by: "morphic",
    display_name: m.displayName,
    context_length: m.contextLength,
    capabilities: m.capabilities,
    status: m.status,
    replacement_model_alias: m.replacementModelAlias
  });
});
v1.post("/chat/completions", async (c) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const { keyId, userId } = c.get("apiKey");
  let parsed;
  try {
    parsed = chatCompletionRequestSchema.safeParse(await c.req.json());
  } catch {
    logRequest({
      requestId,
      userId,
      apiKeyId: keyId,
      modelAlias: "unknown",
      resolvedModelId: null,
      providerName: null,
      promptTokens: null,
      completionTokens: null,
      creditsConsumed: null,
      latencyMs: Date.now() - startedAt,
      gatewayLatencyMs: Date.now() - startedAt,
      status: "error",
      errorType: "invalid_json",
      streamed: false
    });
    return c.json(
      { error: { message: "invalid json body", type: "invalid_request_error", code: "invalid_json" } },
      400
    );
  }
  if (!parsed.success) {
    logRequest({
      requestId,
      userId,
      apiKeyId: keyId,
      modelAlias: "unknown",
      resolvedModelId: null,
      providerName: null,
      promptTokens: null,
      completionTokens: null,
      creditsConsumed: null,
      latencyMs: Date.now() - startedAt,
      gatewayLatencyMs: Date.now() - startedAt,
      status: "error",
      errorType: "invalid_request_body",
      streamed: false
    });
    return c.json(
      {
        error: {
          message: "invalid request body",
          type: "invalid_request_error",
          code: "invalid_request_body",
          details: parsed.error.issues
        }
      },
      400
    );
  }
  const body = parsed.data;
  const route = await resolveModelWithFallback(body.model);
  if (!route) {
    logRequest({
      requestId,
      userId,
      apiKeyId: keyId,
      modelAlias: body.model,
      resolvedModelId: null,
      providerName: null,
      promptTokens: null,
      completionTokens: null,
      creditsConsumed: null,
      latencyMs: Date.now() - startedAt,
      gatewayLatencyMs: Date.now() - startedAt,
      status: "error",
      errorType: "model_not_found",
      streamed: body.stream === true
    });
    return c.json(
      {
        error: {
          message: `model '${body.model}' not found or unavailable`,
          type: "invalid_request_error",
          code: "model_not_found"
        }
      },
      404
    );
  }
  if (route.deprecationWarning) {
    c.header("X-Morphic-Warning", route.deprecationWarning);
  }
  if (!route.credential) {
    logRequest({
      requestId,
      userId,
      apiKeyId: keyId,
      modelAlias: body.model,
      resolvedModelId: route.modelId,
      providerName: route.providerName,
      promptTokens: null,
      completionTokens: null,
      creditsConsumed: null,
      latencyMs: Date.now() - startedAt,
      gatewayLatencyMs: Date.now() - startedAt,
      status: "error",
      errorType: "provider_not_configured",
      streamed: body.stream === true
    });
    return c.json(
      {
        error: {
          message: "provider credential not configured",
          type: "server_error",
          code: "provider_not_configured"
        }
      },
      503
    );
  }
  const promptText = body.messages.map((m) => typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n");
  const promptTokens = estimatePromptTokens(promptText);
  const wantsStream = body.stream === true;
  let reservation;
  try {
    reservation = await reserve({
      userId,
      apiKeyId: keyId,
      model: { id: route.modelId, contextLength: route.contextLength, pricing: route.pricing },
      promptTokens,
      requestedMaxTokens: body.max_tokens ?? null,
      requestId
    });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      logRequest({
        requestId,
        userId,
        apiKeyId: keyId,
        modelAlias: body.model,
        resolvedModelId: route.modelId,
        providerName: route.providerName,
        promptTokens,
        completionTokens: 0,
        creditsConsumed: 0,
        latencyMs: Date.now() - startedAt,
        gatewayLatencyMs: Date.now() - startedAt,
        status: "error",
        errorType: "insufficient_credits",
        streamed: wantsStream
      });
      return c.json(
        { error: { message: e.message, type: "insufficient_credits", code: "insufficient_credits" } },
        402
      );
    }
    throw e;
  }
  let upstream;
  const gatewayLatencyMs = Date.now() - startedAt;
  try {
    upstream = await callProvider({
      route,
      body,
      stream: wantsStream,
      signal: c.req.raw.signal
    });
  } catch (e) {
    const isTimeout = e?.name === "TimeoutError" || String(e).includes("timeout");
    const norm = normalizeUpstreamError(isTimeout ? "timeout" : "network");
    if (norm.countAsFailure) {
      await recordFailure(route.providerId);
    }
    const settleRes2 = await settle({
      reservation,
      userId,
      promptTokens,
      completionTokens: 0,
      pricing: route.pricing,
      requestId,
      status: "error",
      error: String(e),
      latencyMs: Date.now() - startedAt,
      streamed: wantsStream
    });
    logRequest({
      requestId,
      userId,
      apiKeyId: keyId,
      modelAlias: body.model,
      resolvedModelId: route.modelId,
      providerName: route.providerName,
      promptTokens,
      completionTokens: 0,
      creditsConsumed: settleRes2.actualCredits,
      latencyMs: Date.now() - startedAt,
      gatewayLatencyMs,
      status: "error",
      errorType: norm.code,
      streamed: wantsStream
    });
    return c.json(
      { error: { message: "upstream provider unreachable", type: norm.type, code: norm.code } },
      norm.httpStatus
    );
  }
  if (!upstream.ok) {
    const norm = normalizeUpstreamError(upstream.status);
    if (norm.countAsFailure) {
      await recordFailure(route.providerId);
    }
    const errText = await upstream.text().catch(() => "");
    const settleRes2 = await settle({
      reservation,
      userId,
      promptTokens,
      completionTokens: 0,
      pricing: route.pricing,
      requestId,
      status: "error",
      error: `upstream ${upstream.status}: ${errText.slice(0, 500)}`,
      latencyMs: Date.now() - startedAt,
      streamed: wantsStream
    });
    logRequest({
      requestId,
      userId,
      apiKeyId: keyId,
      modelAlias: body.model,
      resolvedModelId: route.modelId,
      providerName: route.providerName,
      promptTokens,
      completionTokens: 0,
      creditsConsumed: settleRes2.actualCredits,
      latencyMs: Date.now() - startedAt,
      gatewayLatencyMs,
      status: "error",
      errorType: norm.code,
      streamed: wantsStream
    });
    return c.json(
      {
        error: {
          message: "upstream provider error",
          type: norm.type,
          code: norm.code,
          status: upstream.status
        }
      },
      norm.httpStatus
    );
  }
  await recordSuccess(route.providerId);
  if (wantsStream && upstream.body) {
    return streamSSE(c, async (stream) => {
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer2 = "";
      let usage = null;
      let lastKnownCompletionTokens = 0;
      let chunksReceived = 0;
      let failed = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunkText = decoder.decode(value, { stream: true });
          await stream.write(chunkText);
          buffer2 += chunkText;
          const lines = buffer2.split("\n");
          buffer2 = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const j = JSON.parse(data);
              if (j.usage) usage = j.usage;
              if (j.usage?.completion_tokens != null) {
                lastKnownCompletionTokens = j.usage.completion_tokens;
              }
              chunksReceived++;
            } catch {
            }
          }
        }
        if (buffer2.trim()) {
          const trimmed = buffer2.trim();
          if (trimmed.startsWith("data: ")) {
            const data = trimmed.slice(6).trim();
            if (data && data !== "[DONE]") {
              try {
                const j = JSON.parse(data);
                if (j.usage) usage = j.usage;
                if (j.usage?.completion_tokens != null) {
                  lastKnownCompletionTokens = j.usage.completion_tokens;
                }
                chunksReceived++;
              } catch {
              }
            }
          }
          buffer2 = "";
        }
      } catch {
        failed = true;
      }
      const promptT2 = usage?.prompt_tokens ?? promptTokens;
      const completionT2 = usage?.completion_tokens ?? (lastKnownCompletionTokens > 0 ? lastKnownCompletionTokens : chunksReceived > 0 ? Math.max(1, chunksReceived * 8) : 0);
      const settleRes2 = await settle({
        reservation,
        userId,
        promptTokens: promptT2,
        completionTokens: completionT2,
        pricing: route.pricing,
        requestId,
        status: failed ? "error" : "success",
        latencyMs: Date.now() - startedAt,
        streamed: true
      });
      logRequest({
        requestId,
        userId,
        apiKeyId: keyId,
        modelAlias: body.model,
        resolvedModelId: route.modelId,
        providerName: route.providerName,
        promptTokens: promptT2,
        completionTokens: completionT2,
        creditsConsumed: settleRes2.actualCredits,
        latencyMs: Date.now() - startedAt,
        gatewayLatencyMs,
        status: failed ? "error" : "success",
        errorType: failed ? "stream_disconnected" : null,
        streamed: true
      });
    });
  }
  const text2 = await upstream.text();
  let promptT = promptTokens;
  let completionT = 0;
  try {
    const j = JSON.parse(text2);
    promptT = j.usage?.prompt_tokens ?? promptTokens;
    completionT = j.usage?.completion_tokens ?? 0;
  } catch {
  }
  const settleRes = await settle({
    reservation,
    userId,
    promptTokens: promptT,
    completionTokens: completionT,
    pricing: route.pricing,
    requestId,
    status: "success",
    latencyMs: Date.now() - startedAt,
    streamed: false
  });
  logRequest({
    requestId,
    userId,
    apiKeyId: keyId,
    modelAlias: body.model,
    resolvedModelId: route.modelId,
    providerName: route.providerName,
    promptTokens: promptT,
    completionTokens: completionT,
    creditsConsumed: settleRes.actualCredits,
    latencyMs: Date.now() - startedAt,
    gatewayLatencyMs,
    status: "success",
    errorType: null,
    streamed: false
  });
  return c.body(text2, upstream.status, { "content-type": "application/json" });
});

// src/routes/webhooks.ts
init_src2();
import { createHmac as createHmac2, timingSafeEqual as timingSafeEqual2 } from "crypto";
import { Hono as Hono2 } from "hono";
import { and as and4, eq as eq5 } from "drizzle-orm";
var webhooks = new Hono2();
function verifyMockSignature(body, signature) {
  const secret = process.env.MOCK_PAYMENT_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac2("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual2(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
webhooks.post("/mock", async (c) => {
  const raw = await c.req.text();
  if (!verifyMockSignature(raw, c.req.header("x-webhook-signature"))) {
    return c.json({ error: "invalid signature" }, 401);
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return c.json({ error: "invalid payload" }, 400);
  }
  const { event_id: eventId, payment_id: paymentId, status } = payload;
  if (!eventId || !paymentId || !status) {
    return c.json({ error: "missing fields" }, 400);
  }
  const [existing] = await db.select().from(schema_exports.paymentEvents).where(and4(eq5(schema_exports.paymentEvents.provider, "mock"), eq5(schema_exports.paymentEvents.eventId, eventId))).limit(1);
  if (existing) return c.json({ ok: true, duplicate: true });
  const [payment] = await db.select().from(schema_exports.payments).where(and4(eq5(schema_exports.payments.provider, "mock"), eq5(schema_exports.payments.externalId, paymentId))).limit(1);
  if (!payment) return c.json({ error: "payment not found" }, 404);
  if (payment.status !== "pending") {
    await db.insert(schema_exports.paymentEvents).values({
      provider: "mock",
      eventId,
      paymentId: payment.id,
      payload
    }).onConflictDoNothing();
    return c.json({ ok: true, duplicate: true });
  }
  if (status === "paid") {
    await db.transaction(async (tx) => {
      await tx.insert(schema_exports.paymentEvents).values({ provider: "mock", eventId, paymentId: payment.id, payload });
      await tx.update(schema_exports.payments).set({ status: "paid", paidAt: /* @__PURE__ */ new Date() }).where(and4(eq5(schema_exports.payments.id, payment.id), eq5(schema_exports.payments.status, "pending")));
    });
    if (payment.packageId) {
      const [pkg] = await db.select().from(schema_exports.packages).where(eq5(schema_exports.packages.id, payment.packageId)).limit(1);
      if (pkg) {
        if (pkg.modelId) {
          await grantEntitlement({
            userId: payment.userId,
            allowance: pkg.creditAllowance,
            modelId: pkg.modelId,
            durationHours: pkg.durationHours,
            source: "purchase",
            packageId: pkg.id
          });
        } else {
          await grantCredits({
            userId: payment.userId,
            amount: pkg.creditAllowance,
            entryType: "purchase",
            reference: `payment:${payment.id}`
          });
        }
      }
    } else {
      await grantCredits({
        userId: payment.userId,
        amount: payment.credits,
        entryType: "purchase",
        reference: `payment:${payment.id}`
      });
    }
  } else {
    await db.transaction(async (tx) => {
      await tx.insert(schema_exports.paymentEvents).values({ provider: "mock", eventId, paymentId: payment.id, payload });
      await tx.update(schema_exports.payments).set({ status: "failed" }).where(and4(eq5(schema_exports.payments.id, payment.id), eq5(schema_exports.payments.status, "pending")));
    });
  }
  return c.json({ ok: true });
});
webhooks.post("/duitku", async (c) => {
  let formData;
  try {
    const raw = await c.req.text();
    formData = new URLSearchParams(raw);
  } catch {
    console.error("[webhook/duitku] failed to parse form body");
    return c.json({ ok: false, reason: "parse_error" });
  }
  const payload = {
    merchantCode: formData.get("merchantCode") ?? "",
    amount: formData.get("amount") ?? "",
    merchantOrderId: formData.get("merchantOrderId") ?? "",
    productDetail: formData.get("productDetail") ?? "",
    additionalParam: formData.get("additionalParam") ?? "",
    paymentCode: formData.get("paymentCode") ?? "",
    resultCode: formData.get("resultCode") ?? "",
    merchantUserId: formData.get("merchantUserId") ?? "",
    reference: formData.get("reference") ?? "",
    publisherOrderId: formData.get("publisherOrderId") ?? "",
    signature: formData.get("signature") ?? "",
    spUserHash: formData.get("spUserHash") ?? "",
    settlementDate: formData.get("settlementDate") ?? "",
    issuerCode: formData.get("issuerCode") ?? "",
    customerName: formData.get("customerName") ?? ""
  };
  const { verifyCallbackSignature: verifyCallbackSignature2 } = await Promise.resolve().then(() => (init_duitku(), duitku_exports));
  if (!verifyCallbackSignature2(payload)) {
    console.error("[webhook/duitku] invalid signature for merchantOrderId:", payload.merchantOrderId);
    return c.json({ ok: false, reason: "invalid_signature" });
  }
  const eventId = payload.publisherOrderId || payload.reference || payload.merchantOrderId;
  const [existing] = await db.select({ id: schema_exports.paymentEvents.id }).from(schema_exports.paymentEvents).where(and4(eq5(schema_exports.paymentEvents.provider, "duitku"), eq5(schema_exports.paymentEvents.eventId, eventId))).limit(1);
  if (existing) {
    console.log("[webhook/duitku] duplicate event, skipping:", eventId);
    return c.json({ ok: true, duplicate: true });
  }
  const [payment] = await db.select().from(schema_exports.payments).where(and4(eq5(schema_exports.payments.provider, "duitku"), eq5(schema_exports.payments.externalId, payload.merchantOrderId))).limit(1);
  if (!payment) {
    console.error("[webhook/duitku] payment not found for merchantOrderId:", payload.merchantOrderId);
    return c.json({ ok: true, reason: "payment_not_found" });
  }
  const rawPayload = Object.fromEntries(formData.entries());
  if (payload.resultCode === "00") {
    if (payment.status !== "pending") {
      await db.insert(schema_exports.paymentEvents).values({ provider: "duitku", eventId, paymentId: payment.id, payload: rawPayload }).onConflictDoNothing();
      return c.json({ ok: true, duplicate: true });
    }
    try {
      await db.transaction(async (tx) => {
        await tx.insert(schema_exports.paymentEvents).values({
          provider: "duitku",
          eventId,
          paymentId: payment.id,
          payload: rawPayload
        });
        await tx.update(schema_exports.payments).set({ status: "paid", paidAt: /* @__PURE__ */ new Date() }).where(and4(eq5(schema_exports.payments.id, payment.id), eq5(schema_exports.payments.status, "pending")));
      });
      if (payment.packageId) {
        const [pkg] = await db.select().from(schema_exports.packages).where(eq5(schema_exports.packages.id, payment.packageId)).limit(1);
        if (pkg) {
          if (pkg.modelId) {
            await grantEntitlement({
              userId: payment.userId,
              allowance: pkg.creditAllowance,
              modelId: pkg.modelId,
              durationHours: pkg.durationHours,
              source: "purchase",
              packageId: pkg.id
            });
          } else {
            await grantCredits({
              userId: payment.userId,
              amount: pkg.creditAllowance,
              entryType: "purchase",
              reference: `payment:${payment.id}`
            });
          }
        }
      } else {
        await grantCredits({
          userId: payment.userId,
          amount: payment.credits,
          entryType: "purchase",
          reference: `payment:${payment.id}`
        });
      }
      console.log(`[webhook/duitku] payment ${payment.id} paid \u2014 ${payment.credits} credits granted to ${payment.userId}`);
    } catch (err) {
      console.error("[webhook/duitku] error processing paid event:", err);
    }
  } else {
    await db.transaction(async (tx) => {
      await tx.insert(schema_exports.paymentEvents).values({
        provider: "duitku",
        eventId,
        paymentId: payment.id,
        payload: rawPayload
      }).onConflictDoNothing();
      await tx.update(schema_exports.payments).set({ status: "failed" }).where(and4(eq5(schema_exports.payments.id, payment.id), eq5(schema_exports.payments.status, "pending")));
    });
    console.log(`[webhook/duitku] payment ${payment.id} failed (resultCode: ${payload.resultCode})`);
  }
  return c.json({ ok: true });
});

// src/routes/keys.ts
init_src2();
import { randomBytes as randomBytes2, createHash as createHash2 } from "crypto";
import { Hono as Hono3 } from "hono";
import { eq as eq7, and as and6, desc } from "drizzle-orm";

// src/middleware/session-auth.ts
init_src2();
import { eq as eq6, and as and5, gt as gt2, or as or2 } from "drizzle-orm";
async function sessionAuth(c, next) {
  const authHeader = c.req.header("authorization");
  let rawToken;
  if (authHeader?.startsWith("Bearer ")) {
    rawToken = authHeader.slice("Bearer ".length).trim();
  } else {
    const cookies = c.req.header("cookie");
    if (cookies) {
      const match = cookies.match(/(?:__Secure-)?(?:better-auth\.session_token|session_token)=([^;]+)/);
      if (match) {
        rawToken = decodeURIComponent(match[1]).trim();
      }
    }
  }
  if (!rawToken) {
    return c.json(
      { error: { message: "unauthorized: session token required", type: "auth_error", code: "missing_session_token" } },
      401
    );
  }
  const unsignedToken = rawToken.includes(".") ? rawToken.split(".")[0] : rawToken;
  const [session] = await db.select({
    id: schema_exports.sessions.id,
    userId: schema_exports.sessions.userId,
    expiresAt: schema_exports.sessions.expiresAt,
    suspended: schema_exports.users.suspended
  }).from(schema_exports.sessions).where(
    and5(
      or2(eq6(schema_exports.sessions.token, rawToken), eq6(schema_exports.sessions.token, unsignedToken)),
      gt2(schema_exports.sessions.expiresAt, /* @__PURE__ */ new Date())
    )
  ).limit(1);
  if (!session) {
    return c.json(
      { error: { message: "invalid or expired session token", type: "auth_error", code: "invalid_session_token" } },
      401
    );
  }
  if (session.suspended) {
    return c.json(
      { error: { message: "account suspended", type: "auth_error", code: "account_suspended" } },
      403
    );
  }
  c.set("userSession", { userId: session.userId, sessionId: session.id });
  await next();
}

// src/routes/keys.ts
var keys = new Hono3();
keys.use("*", sessionAuth);
keys.post("/", async (c) => {
  const { userId } = c.get("userSession");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { message: "invalid json body", type: "invalid_request_error", code: "invalid_json" } },
      400
    );
  }
  const name = body.name?.trim();
  if (!name) {
    return c.json(
      { error: { message: "key name is required", type: "invalid_request_error", code: "missing_key_name" } },
      400
    );
  }
  let expiresAt = null;
  if (body.expiresIn && body.expiresIn !== "none") {
    if (body.expiresIn === "30d") {
      expiresAt = new Date(Date.now() + 30 * 864e5);
    } else if (body.expiresIn === "90d") {
      expiresAt = new Date(Date.now() + 90 * 864e5);
    } else {
      const parsed = new Date(body.expiresIn);
      if (!isNaN(parsed.getTime())) {
        expiresAt = parsed;
      }
    }
  }
  const rawKey = `mp-${randomBytes2(32).toString("hex")}`;
  const keyPrefix = rawKey.slice(0, 10);
  const keyHash = createHash2("sha256").update(rawKey).digest("hex");
  const [inserted] = await db.insert(schema_exports.apiKeys).values({
    userId,
    name,
    keyHash,
    keyPrefix,
    status: "active",
    expiresAt
  }).returning({
    id: schema_exports.apiKeys.id,
    name: schema_exports.apiKeys.name,
    keyPrefix: schema_exports.apiKeys.keyPrefix,
    status: schema_exports.apiKeys.status,
    expiresAt: schema_exports.apiKeys.expiresAt,
    createdAt: schema_exports.apiKeys.createdAt
  });
  return c.json(
    {
      id: inserted.id,
      name: inserted.name,
      prefix: inserted.keyPrefix,
      key: rawKey,
      status: inserted.status,
      expires_at: inserted.expiresAt?.toISOString() ?? null,
      created_at: inserted.createdAt.toISOString()
    },
    201
  );
});
keys.get("/", async (c) => {
  const { userId } = c.get("userSession");
  const rows = await db.select({
    id: schema_exports.apiKeys.id,
    name: schema_exports.apiKeys.name,
    prefix: schema_exports.apiKeys.keyPrefix,
    status: schema_exports.apiKeys.status,
    expiresAt: schema_exports.apiKeys.expiresAt,
    lastUsedAt: schema_exports.apiKeys.lastUsedAt,
    createdAt: schema_exports.apiKeys.createdAt,
    revokedAt: schema_exports.apiKeys.revokedAt
  }).from(schema_exports.apiKeys).where(eq7(schema_exports.apiKeys.userId, userId)).orderBy(desc(schema_exports.apiKeys.createdAt));
  return c.json({
    data: rows.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      status: k.status,
      expires_at: k.expiresAt?.toISOString() ?? null,
      last_used_at: k.lastUsedAt?.toISOString() ?? null,
      created_at: k.createdAt.toISOString(),
      revoked_at: k.revokedAt?.toISOString() ?? null
    }))
  });
});
keys.delete("/:id", async (c) => {
  const { userId } = c.get("userSession");
  const keyId = c.req.param("id");
  const [key2] = await db.select({ id: schema_exports.apiKeys.id, status: schema_exports.apiKeys.status }).from(schema_exports.apiKeys).where(and6(eq7(schema_exports.apiKeys.id, keyId), eq7(schema_exports.apiKeys.userId, userId))).limit(1);
  if (!key2) {
    return c.json(
      { error: { message: "api key not found", type: "invalid_request_error", code: "key_not_found" } },
      404
    );
  }
  const revokedAt = /* @__PURE__ */ new Date();
  await db.update(schema_exports.apiKeys).set({ status: "revoked", revokedAt }).where(eq7(schema_exports.apiKeys.id, keyId));
  return c.json({
    id: keyId,
    status: "revoked",
    revoked_at: revokedAt.toISOString()
  });
});

// src/routes/account.ts
init_src2();
import { Hono as Hono4 } from "hono";
import { eq as eq8, and as and7, desc as desc2, gte, lte, count } from "drizzle-orm";
var account = new Hono4();
account.use("*", sessionAuth);
account.get("/balance", async (c) => {
  const { userId } = c.get("userSession");
  const [bal] = await db.select({ credits: schema_exports.balances.credits, updatedAt: schema_exports.balances.updatedAt }).from(schema_exports.balances).where(eq8(schema_exports.balances.userId, userId)).limit(1);
  return c.json({
    credits: bal?.credits ?? 0,
    updated_at: bal?.updatedAt?.toISOString() ?? null
  });
});
account.get("/usage", async (c) => {
  const { userId } = c.get("userSession");
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 20)));
  const offset = (page - 1) * limit;
  const fromStr = c.req.query("from");
  const toStr = c.req.query("to");
  const conditions = [eq8(schema_exports.usageRecords.userId, userId)];
  if (fromStr) {
    const fromDate = new Date(fromStr);
    if (!isNaN(fromDate.getTime())) conditions.push(gte(schema_exports.usageRecords.createdAt, fromDate));
  }
  if (toStr) {
    const toDate = new Date(toStr);
    if (!isNaN(toDate.getTime())) conditions.push(lte(schema_exports.usageRecords.createdAt, toDate));
  }
  const whereClause = and7(...conditions);
  const [totalRes] = await db.select({ count: count() }).from(schema_exports.usageRecords).where(whereClause);
  const total = Number(totalRes?.count ?? 0);
  const rows = await db.select({
    id: schema_exports.usageRecords.id,
    requestId: schema_exports.usageRecords.requestId,
    modelId: schema_exports.usageRecords.modelId,
    publicModelId: schema_exports.models.publicModelId,
    promptTokens: schema_exports.usageRecords.promptTokens,
    completionTokens: schema_exports.usageRecords.completionTokens,
    totalTokens: schema_exports.usageRecords.totalTokens,
    creditsConsumed: schema_exports.usageRecords.creditsConsumed,
    latencyMs: schema_exports.usageRecords.latencyMs,
    status: schema_exports.usageRecords.status,
    streamed: schema_exports.usageRecords.streamed,
    createdAt: schema_exports.usageRecords.createdAt
  }).from(schema_exports.usageRecords).leftJoin(schema_exports.models, eq8(schema_exports.usageRecords.modelId, schema_exports.models.id)).where(whereClause).orderBy(desc2(schema_exports.usageRecords.createdAt)).limit(limit).offset(offset);
  return c.json({
    data: rows.map((u) => ({
      id: u.id,
      request_id: u.requestId,
      model: u.publicModelId ?? u.modelId,
      prompt_tokens: u.promptTokens,
      completion_tokens: u.completionTokens,
      total_tokens: u.totalTokens,
      credits_consumed: u.creditsConsumed,
      latency_ms: u.latencyMs,
      status: u.status,
      streamed: u.streamed,
      created_at: u.createdAt.toISOString()
    })),
    total,
    page,
    limit
  });
});
account.get("/transactions", async (c) => {
  const { userId } = c.get("userSession");
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 20)));
  const offset = (page - 1) * limit;
  const whereClause = eq8(schema_exports.creditLedger.userId, userId);
  const [totalRes] = await db.select({ count: count() }).from(schema_exports.creditLedger).where(whereClause);
  const total = Number(totalRes?.count ?? 0);
  const rows = await db.select({
    id: schema_exports.creditLedger.id,
    entryType: schema_exports.creditLedger.entryType,
    amount: schema_exports.creditLedger.amount,
    sourceType: schema_exports.creditLedger.sourceType,
    reference: schema_exports.creditLedger.reference,
    createdAt: schema_exports.creditLedger.createdAt
  }).from(schema_exports.creditLedger).where(whereClause).orderBy(desc2(schema_exports.creditLedger.createdAt)).limit(limit).offset(offset);
  return c.json({
    data: rows.map((t) => ({
      id: t.id,
      entry_type: t.entryType,
      amount: t.amount,
      source_type: t.sourceType,
      reference: t.reference,
      created_at: t.createdAt.toISOString()
    })),
    total,
    page,
    limit
  });
});

// src/routes/payments.ts
init_src2();
import { Hono as Hono5 } from "hono";
import { eq as eq9, and as and8 } from "drizzle-orm";
init_duitku();
var payments2 = new Hono5();
payments2.use("*", sessionAuth);
payments2.post("/create", async (c) => {
  const { userId } = c.get("userSession");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { message: "invalid json body", type: "invalid_request_error", code: "invalid_json" } },
      400
    );
  }
  const { packageId } = body;
  if (!packageId) {
    return c.json(
      { error: { message: "packageId is required", type: "invalid_request_error", code: "missing_package_id" } },
      400
    );
  }
  const [pkg] = await db.select().from(schema_exports.packages).where(and8(eq9(schema_exports.packages.id, packageId), eq9(schema_exports.packages.status, "active"))).limit(1);
  if (!pkg) {
    return c.json(
      { error: { message: "package not found or inactive", type: "invalid_request_error", code: "package_not_found" } },
      404
    );
  }
  if (!pkg.priceCents || pkg.priceCents <= 0) {
    return c.json(
      { error: { message: "package has no price set", type: "invalid_request_error", code: "package_no_price" } },
      400
    );
  }
  const [user] = await db.select({ name: schema_exports.users.name, email: schema_exports.users.email }).from(schema_exports.users).where(eq9(schema_exports.users.id, userId)).limit(1);
  if (!user) {
    return c.json(
      { error: { message: "user not found", type: "auth_error", code: "user_not_found" } },
      401
    );
  }
  const merchantOrderId = `morphic-${userId.slice(0, 8)}-${Date.now()}`;
  const amountIDR = pkg.priceCents;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
  const [payment] = await db.insert(schema_exports.payments).values({
    userId,
    provider: "duitku",
    externalId: merchantOrderId,
    packageId: pkg.id,
    amountCents: amountIDR,
    currency: pkg.currency ?? "IDR",
    credits: pkg.creditAllowance,
    status: "pending"
  }).returning();
  let duitkuResult;
  try {
    duitkuResult = await createTransaction({
      merchantOrderId,
      paymentAmount: amountIDR,
      productDetails: `Morphic Credits \u2014 ${pkg.name}`,
      email: user.email,
      customerVaName: user.name.slice(0, 20),
      callbackUrl: `${apiUrl}/webhooks/duitku`,
      returnUrl: `${appUrl}/dashboard/billing?ref=${payment.id}`,
      expiryPeriod: 60
    });
  } catch (err) {
    await db.update(schema_exports.payments).set({ status: "failed" }).where(eq9(schema_exports.payments.id, payment.id));
    console.error("[payments/create] Duitku error:", err?.message);
    return c.json(
      { error: { message: "payment gateway error", type: "server_error", code: "gateway_error" } },
      502
    );
  }
  await db.update(schema_exports.payments).set({ externalId: merchantOrderId }).where(eq9(schema_exports.payments.id, payment.id));
  const expiresAt = new Date(Date.now() + 60 * 6e4).toISOString();
  return c.json({
    paymentId: payment.id,
    merchantOrderId,
    paymentUrl: duitkuResult.paymentUrl,
    reference: duitkuResult.reference,
    amountIDR,
    expiresAt,
    package: {
      id: pkg.id,
      name: pkg.name,
      creditAllowance: pkg.creditAllowance
    }
  });
});
payments2.get("/:id", async (c) => {
  const { userId } = c.get("userSession");
  const paymentId = c.req.param("id");
  const [payment] = await db.select().from(schema_exports.payments).where(and8(eq9(schema_exports.payments.id, paymentId), eq9(schema_exports.payments.userId, userId))).limit(1);
  if (!payment) {
    return c.json(
      { error: { message: "payment not found", type: "invalid_request_error", code: "payment_not_found" } },
      404
    );
  }
  if (payment.status === "pending" && payment.provider === "duitku") {
    try {
      const status = await checkTransactionStatus(payment.externalId);
      if (status.statusCode === "00") {
        console.log(`[payments/${paymentId}] Duitku reports paid but DB still pending \u2014 webhook may be in-flight`);
      }
    } catch {
    }
  }
  return c.json({
    id: payment.id,
    status: payment.status,
    provider: payment.provider,
    amountCents: payment.amountCents,
    currency: payment.currency,
    credits: payment.credits,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString()
  });
});

// src/routes/redeem.ts
init_src2();
import { Hono as Hono6 } from "hono";
import { eq as eq10, and as and9, sql as sql2 } from "drizzle-orm";
var redeem = new Hono6();
redeem.use("*", sessionAuth);
redeem.post("/", async (c) => {
  const { userId } = c.get("userSession");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { message: "invalid json body", type: "invalid_request_error", code: "invalid_json" } },
      400
    );
  }
  const { code } = body;
  if (!code || typeof code !== "string") {
    return c.json(
      { error: { message: "code is required", type: "invalid_request_error", code: "missing_code" } },
      400
    );
  }
  const upperCode = code.trim().toUpperCase();
  const [redeemCode] = await db.select().from(schema_exports.redeemCodes).where(and9(eq10(schema_exports.redeemCodes.code, upperCode), eq10(schema_exports.redeemCodes.active, true))).limit(1);
  if (!redeemCode) {
    return c.json(
      { error: { message: "invalid or inactive code", type: "invalid_request_error", code: "invalid_code" } },
      400
    );
  }
  if (redeemCode.expiresAt && redeemCode.expiresAt < /* @__PURE__ */ new Date()) {
    return c.json(
      { error: { message: "code has expired", type: "invalid_request_error", code: "code_expired" } },
      400
    );
  }
  if (redeemCode.maxRedemptions && redeemCode.redeemedCount >= redeemCode.maxRedemptions) {
    return c.json(
      { error: { message: "code has reached maximum redemptions", type: "invalid_request_error", code: "code_fully_redeemed" } },
      400
    );
  }
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema_exports.redemptions).values({
        codeId: redeemCode.id,
        userId
      });
      await tx.update(schema_exports.redeemCodes).set({ redeemedCount: sql2`${schema_exports.redeemCodes.redeemedCount} + 1` }).where(eq10(schema_exports.redeemCodes.id, redeemCode.id));
    });
  } catch (err) {
    if (err.code === "23505" || err.message?.includes("unique constraint")) {
      return c.json(
        { error: { message: "you have already redeemed this code", type: "invalid_request_error", code: "code_already_redeemed" } },
        409
        // Conflict
      );
    }
    console.error("[redeem] transaction failed:", err);
    return c.json(
      { error: { message: "failed to redeem code", type: "server_error", code: "redeem_failed" } },
      500
    );
  }
  let grantedCredits = 0;
  let packageInfo = null;
  if (redeemCode.rewardType === "package" && redeemCode.packageId) {
    const [pkg] = await db.select().from(schema_exports.packages).where(eq10(schema_exports.packages.id, redeemCode.packageId)).limit(1);
    if (pkg) {
      if (pkg.modelId) {
        await grantEntitlement({
          userId,
          allowance: pkg.creditAllowance,
          modelId: pkg.modelId,
          durationHours: pkg.durationHours,
          source: "redeem",
          packageId: pkg.id
        });
      } else {
        await grantCredits({
          userId,
          amount: pkg.creditAllowance,
          entryType: "redeem",
          reference: `code:${redeemCode.id}`
        });
      }
      grantedCredits = pkg.creditAllowance;
      packageInfo = { id: pkg.id, name: pkg.name };
    }
  } else if (redeemCode.rewardType === "credits" && redeemCode.creditAmount) {
    await grantCredits({
      userId,
      amount: redeemCode.creditAmount,
      entryType: "redeem",
      reference: `code:${redeemCode.id}`
    });
    grantedCredits = redeemCode.creditAmount;
  }
  return c.json({
    ok: true,
    message: "code redeemed successfully",
    reward: {
      type: redeemCode.rewardType,
      credits: grantedCredits,
      package: packageInfo
    }
  });
});

// src/app.ts
var app = new Hono7();
app.use(
  "*",
  cors({
    // Allowed request origin
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    // Allowed headers from FE to BE
    allowHeaders: ["Content-Type", "Authorization", "x-internal-secret"],
    // Allowed HTTP methods
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    // Expose headers to FE
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    // cache preflight 10 minutes
    credentials: true
  })
);
app.onError((err, c) => {
  console.error("[API Error]:", err);
  return c.json(
    { error: { message: err.message || "Internal Server Error", type: "internal_error", code: "internal_error" } },
    500
  );
});
app.get("/health", (c) => c.json({ ok: true }));
app.route("/v1", v1);
app.route("/webhooks", webhooks);
app.route("/v1/keys", keys);
app.route("/v1/account", account);
app.route("/v1/payments", payments2);
app.route("/v1/redeem", redeem);

// src/index.vercel.ts
var config = { runtime: "nodejs" };
var index_vercel_default = handle(app);
export {
  config,
  index_vercel_default as default
};
