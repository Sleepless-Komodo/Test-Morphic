var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x2) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x2, {
  get: (a2, b3) => (typeof require !== "undefined" ? require : a2)[b3]
}) : x2)(function(x2) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x2 + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc3) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc3 = __getOwnPropDesc(from, key2)) || desc3.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/query.js
function cachedError(xs) {
  if (originCache.has(xs))
    return originCache.get(xs);
  const x2 = Error.stackTraceLimit;
  Error.stackTraceLimit = 4;
  originCache.set(xs, new Error());
  Error.stackTraceLimit = x2;
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
        super((a2, b3) => {
          resolve = a2;
          reject = b3;
        });
        this.tagged = Array.isArray(strings.raw);
        this.strings = strings;
        this.args = args;
        this.handler = handler;
        this.canceller = canceller;
        this.options = options;
        this.state = null;
        this.statement = null;
        this.resolve = (x2) => (this.active = false, resolve(x2));
        this.reject = (x2) => (this.active = false, reject(x2));
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
                this.reject = (x2) => (this.active = false, reject(x2));
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
function connection(x2, options, socket) {
  const { host, port } = socket || options;
  const error = Object.assign(
    new Error("write " + x2 + " " + (options.path || host + ":" + port)),
    {
      code: x2,
      errno: x2,
      address: options.path || host
    },
    options.path ? {} : { port }
  );
  Error.captureStackTrace(error, connection);
  return error;
}
function postgres(x2) {
  const error = new PostgresError(x2);
  Error.captureStackTrace(error, postgres);
  return error;
}
function generic(code, message) {
  const error = Object.assign(new Error(code + ": " + message), { code });
  Error.captureStackTrace(error, generic);
  return error;
}
function notSupported(x2) {
  const error = Object.assign(
    new Error(x2 + " (B) is not supported"),
    {
      code: "MESSAGE_NOT_SUPPORTED",
      name: x2
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
      constructor(x2) {
        super(x2.message);
        this.name = this.constructor.name;
        Object.assign(this, x2);
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
function handleValue(x2, parameters, types2, options) {
  let value = x2 instanceof Parameter ? x2.value : x2;
  if (value === void 0) {
    x2 instanceof Parameter ? x2.value = options.transform.undefined : value = x2 = options.transform.undefined;
    if (value === void 0)
      throw Errors.generic("UNDEFINED_VALUE", "Undefined values are not allowed");
  }
  return "$" + types2.push(
    x2 instanceof Parameter ? (parameters.push(x2.value), x2.array ? x2.array[x2.type || inferType(x2.value)] || x2.type || firstIsString(x2.value) : x2.type) : (parameters.push(x2), inferType(x2))
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
  return value instanceof Builder ? value.build(string, parameters, types2, o) : value instanceof Query ? fragment(value, parameters, types2, o) : value instanceof Identifier ? value.value : value && value[0] instanceof Query ? value.reduce((acc, x2) => acc + " " + fragment(x2, parameters, types2, o), "") : handleValue(value, parameters, types2, o);
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
  return columns.map((x2) => {
    value = first[x2];
    return (value instanceof Query ? fragment(value, parameters, types2, options) : value instanceof Identifier ? value.value : handleValue(value, parameters, types2, options)) + " as " + escapeIdentifier(options.transform.column.to ? options.transform.column.to(x2) : x2);
  }).join(",");
}
function notTagged() {
  throw Errors.generic("NOT_TAGGED_CALL", "Query not called as a tagged template literal");
}
function firstIsString(x2) {
  if (Array.isArray(x2))
    return firstIsString(x2[0]);
  return typeof x2 === "string" ? 1009 : 0;
}
function typeHandlers(types2) {
  return Object.keys(types2).reduce((acc, k) => {
    types2[k].from && [].concat(types2[k].from).forEach((x2) => acc.parsers[x2] = types2[k].parse);
    if (types2[k].serialize) {
      acc.serializers[types2[k].to] = types2[k].serialize;
      types2[k].from && [].concat(types2[k].from).forEach((x2) => acc.serializers[x2] = types2[k].serialize);
    }
    return acc;
  }, { parsers: {}, serializers: {} });
}
function escapeIdentifiers(xs, { transform: { column } }) {
  return xs.map((x2) => escapeIdentifier(column.to ? column.to(x2) : x2)).join(",");
}
function arrayEscape(x2) {
  return x2.replace(escapeBackslash, "\\\\").replace(escapeQuote, '\\"');
}
function arrayParserLoop(s, x2, parser, typarray) {
  const xs = [];
  const delimiter = typarray === 1020 ? ";" : ",";
  for (; s.i < x2.length; s.i++) {
    s.char = x2[s.i];
    if (s.quoted) {
      if (s.char === "\\") {
        s.str += x2[++s.i];
      } else if (s.char === '"') {
        xs.push(parser ? parser(s.str) : s.str);
        s.str = "";
        s.quoted = x2[s.i + 1] === '"';
        s.last = s.i + 2;
      } else {
        s.str += s.char;
      }
    } else if (s.char === '"') {
      s.quoted = true;
    } else if (s.char === "{") {
      s.last = ++s.i;
      xs.push(arrayParserLoop(s, x2, parser, typarray));
    } else if (s.char === "}") {
      s.quoted = false;
      s.last < s.i && xs.push(parser ? parser(x2.slice(s.last, s.i)) : x2.slice(s.last, s.i));
      s.last = s.i + 1;
      break;
    } else if (s.char === delimiter && s.p !== "}" && s.p !== '"') {
      xs.push(parser ? parser(x2.slice(s.last, s.i)) : x2.slice(s.last, s.i));
      s.last = s.i + 1;
    }
    s.p = s.char;
  }
  s.last < s.i && xs.push(parser ? parser(x2.slice(s.last, s.i + 1)) : x2.slice(s.last, s.i + 1));
  return xs;
}
function createJsonTransform(fn) {
  return function jsonTransform(x2, column) {
    return typeof x2 === "object" && x2 !== null && (column.type === 114 || column.type === 3802) ? Array.isArray(x2) ? x2.map((x3) => jsonTransform(x3, column)) : Object.entries(x2).reduce((acc, [k, v2]) => Object.assign(acc, { [fn(k)]: jsonTransform(v2, column) }), {}) : x2;
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
        serialize: (x2) => "" + x2
      },
      number: {
        to: 0,
        from: [21, 23, 26, 700, 701],
        serialize: (x2) => "" + x2,
        parse: (x2) => +x2
      },
      json: {
        to: 114,
        from: [114, 3802],
        serialize: (x2) => JSON.stringify(x2),
        parse: (x2) => JSON.parse(x2)
      },
      boolean: {
        to: 16,
        from: 16,
        serialize: (x2) => x2 === true ? "t" : "f",
        parse: (x2) => x2 === "t"
      },
      date: {
        to: 1184,
        from: [1082, 1114, 1184],
        serialize: (x2) => (x2 instanceof Date ? x2 : new Date(x2)).toISOString(),
        parse: (x2) => new Date(x2)
      },
      bytea: {
        to: 17,
        from: 17,
        serialize: (x2) => "\\x" + Buffer.from(x2).toString("hex"),
        parse: (x2) => Buffer.from(x2.slice(2), "hex")
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
        const keyword = builders.map(([x2, fn]) => ({ fn, i: before.search(x2) })).sort((a2, b3) => a2.i - b3.i).pop();
        return keyword.i === -1 ? escapeIdentifiers(this.first, options) : keyword.fn(this.first, this.rest, parameters, types2, options);
      }
    };
    defaultHandlers = typeHandlers(types);
    builders = Object.entries({
      values,
      in: (...xs) => {
        const x2 = values(...xs);
        return x2 === "()" ? "(null)" : x2;
      },
      select,
      as: select,
      returning: select,
      "\\(": select,
      update(first, rest, parameters, types2, options) {
        return (rest.length ? rest.flat() : Object.keys(first)).map(
          (x2) => escapeIdentifier(options.transform.column.to ? options.transform.column.to(x2) : x2) + "=" + stringifyValue("values", first[x2], parameters, types2, options)
        );
      },
      insert(first, rest, parameters, types2, options) {
        const columns = rest.length ? rest.flat() : Object.keys(Array.isArray(first) ? first[0] : first);
        return "(" + escapeIdentifiers(columns, options) + ")values" + valuesBuilder(Array.isArray(first) ? first : [first], parameters, types2, columns, options);
      }
    }).map(([x2, fn]) => [new RegExp("((?:^|[\\s(])" + x2 + "(?:$|[\\s(]))(?![\\s\\S]*\\1)", "i"), fn]);
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
    inferType = function inferType2(x2) {
      return x2 instanceof Parameter ? x2.type : x2 instanceof Date ? 1184 : x2 instanceof Uint8Array ? 17 : x2 === true || x2 === false ? 16 : typeof x2 === "bigint" ? 20 : Array.isArray(x2) ? inferType2(x2[0]) : 0;
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
        return "{" + xs.map((x2) => arraySerializer2(x2, serializer, options, typarray)).join(delimiter) + "}";
      return "{" + xs.map((x2) => {
        if (x2 === void 0) {
          x2 = options.transform.undefined;
          if (x2 === void 0)
            throw Errors.generic("UNDEFINED_VALUE", "Undefined values are not allowed");
        }
        return x2 === null ? "null" : '"' + arrayEscape(serializer ? serializer(x2.type ? x2.value : x2) : "" + x2) + '"';
      }).join(delimiter) + "}";
    };
    arrayParserState = {
      i: 0,
      char: null,
      str: "",
      quoted: false,
      last: 0
    };
    arrayParser = function arrayParser2(x2, parser, typarray) {
      arrayParserState.i = arrayParserState.last = 0;
      return arrayParserLoop(arrayParserState, x2, parser, typarray);
    };
    toCamel = (x2) => {
      let str = x2[0];
      for (let i = 1; i < x2.length; i++)
        str += x2[i] === "_" ? x2[++i].toUpperCase() : x2[i];
      return str;
    };
    toPascal = (x2) => {
      let str = x2[0].toUpperCase();
      for (let i = 1; i < x2.length; i++)
        str += x2[i] === "_" ? x2[++i].toUpperCase() : x2[i];
      return str;
    };
    toKebab = (x2) => x2.replace(/_/g, "-");
    fromCamel = (x2) => x2.replace(/([A-Z])/g, "_$1").toLowerCase();
    fromPascal = (x2) => (x2.slice(0, 1) + x2.slice(1).replace(/([A-Z])/g, "_$1")).toLowerCase();
    fromKebab = (x2) => x2.replace(/-/g, "_");
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
    remove: (x2) => {
      const index3 = xs.indexOf(x2);
      return index3 === -1 ? null : (xs.splice(index3, 1), x2);
    },
    push: (x2) => (xs.push(x2), x2),
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
function fit(x2) {
  if (buffer.length - b.i < x2) {
    const prev = buffer, length = prev.length;
    buffer = Buffer.allocUnsafe(length + (length >> 1) + x2);
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
    messages = "BCcDdEFfHPpQSX".split("").reduce((acc, x2) => {
      const v2 = x2.charCodeAt(0);
      acc[x2] = () => {
        buffer[0] = v2;
        b.i = 5;
        return b;
      };
      return acc;
    }, {});
    b = Object.assign(reset, messages, {
      N: String.fromCharCode(0),
      i: 0,
      inc(x2) {
        b.i += x2;
        return b;
      },
      str(x2) {
        const length = Buffer.byteLength(x2);
        fit(length);
        b.i += buffer.write(x2, b.i, length, "utf8");
        return b;
      },
      i16(x2) {
        fit(2);
        buffer.writeUInt16BE(x2, b.i);
        b.i += 2;
        return b;
      },
      i32(x2, i) {
        if (i || i === 0) {
          buffer.writeUInt32BE(x2, i);
          return b;
        }
        fit(4);
        buffer.writeUInt32BE(x2, b.i);
        b.i += 4;
        return b;
      },
      z(x2) {
        fit(x2);
        buffer.fill(0, b.i, b.i + x2);
        b.i += x2;
        return b;
      },
      raw(x2) {
        buffer = Buffer.concat([buffer.subarray(0, b.i), x2]);
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
import crypto2 from "crypto";
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
    let x2;
    try {
      x2 = options.socket ? await Promise.resolve(options.socket(options)) : new net.Socket();
    } catch (e) {
      error(e);
      return;
    }
    x2.on("error", error);
    x2.on("close", closed);
    x2.on("drain", drain);
    return x2;
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
    !q.tagged && q.args.forEach((x2) => handleValue(x2, parameters, types2, options));
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
  function write(x2, fn) {
    chunk = chunk ? Buffer.concat([chunk, x2]) : Buffer.from(x2);
    if (fn || chunk.length >= 1024)
      return nextWrite(fn);
    nextWriteTimer === null && (nextWriteTimer = setImmediate(nextWrite));
    return true;
  }
  function nextWrite(fn) {
    const x2 = socket.write(chunk, fn);
    nextWriteTimer !== null && clearImmediate(nextWriteTimer);
    chunk = nextWriteTimer = null;
    return x2;
  }
  function connectTimedOut() {
    errored(Errors.connection("CONNECT_TIMEOUT", options, socket));
    socket.destroy();
  }
  async function secure() {
    if (sslnegotiation !== "direct") {
      write(SSLRequest);
      const canSSL = await new Promise((r) => socket.once("data", (x2) => r(x2[0] === 83)));
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
  function data(x2) {
    if (incomings) {
      incomings.push(x2);
      remaining -= x2.length;
      if (remaining > 0)
        return;
    }
    incoming = incomings ? Buffer.concat(incomings, length - remaining) : incoming.length === 0 ? x2 : Buffer.concat([incoming, x2], incoming.length + x2.length);
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
  function handle2(xs, x2 = xs[0]) {
    (x2 === 68 ? DataRow : (
      // D
      x2 === 100 ? CopyData : (
        // d
        x2 === 65 ? NotificationResponse : (
          // A
          x2 === 83 ? ParameterStatus : (
            // S
            x2 === 90 ? ReadyForQuery : (
              // Z
              x2 === 67 ? CommandComplete : (
                // C
                x2 === 50 ? BindComplete : (
                  // 2
                  x2 === 49 ? ParseComplete : (
                    // 1
                    x2 === 116 ? ParameterDescription : (
                      // t
                      x2 === 84 ? RowDescription : (
                        // T
                        x2 === 82 ? Authentication : (
                          // R
                          x2 === 110 ? NoData : (
                            // n
                            x2 === 75 ? BackendKeyData : (
                              // K
                              x2 === 69 ? ErrorResponse : (
                                // E
                                x2 === 115 ? PortalSuspended : (
                                  // s
                                  x2 === 51 ? CloseComplete : (
                                    // 3
                                    x2 === 71 ? CopyInResponse : (
                                      // G
                                      x2 === 78 ? NoticeResponse : (
                                        // N
                                        x2 === 72 ? CopyOutResponse : (
                                          // H
                                          x2 === 99 ? CopyDone : (
                                            // c
                                            x2 === 73 ? EmptyQueryResponse : (
                                              // I
                                              x2 === 86 ? FunctionCallResponse : (
                                                // V
                                                x2 === 118 ? NegotiateProtocolVersion : (
                                                  // v
                                                  x2 === 87 ? CopyBothResponse : (
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
  function DataRow(x2) {
    let index2 = 7;
    let length2;
    let column;
    let value;
    const row = query.isRaw ? new Array(query.statement.columns.length) : {};
    for (let i = 0; i < query.statement.columns.length; i++) {
      column = query.statement.columns[i];
      length2 = x2.readInt32BE(index2);
      index2 += 4;
      value = length2 === -1 ? null : query.isRaw === true ? x2.subarray(index2, index2 += length2) : column.parser === void 0 ? x2.toString("utf8", index2, index2 += length2) : column.parser.array === true ? column.parser(x2.toString("utf8", index2 + 1, index2 += length2)) : column.parser(x2.toString("utf8", index2, index2 += length2));
      query.isRaw ? row[i] = query.isRaw === true ? value : transform.value.from ? transform.value.from(value, column) : value : row[column.name] = transform.value.from ? transform.value.from(value, column) : value;
    }
    query.forEachFn ? query.forEachFn(transform.row.from ? transform.row.from(row) : row, result) : result[rows++] = transform.row.from ? transform.row.from(row) : row;
  }
  function ParameterStatus(x2) {
    const [k, v2] = x2.toString("utf8", 5, x2.length - 1).split(bytes_default.N);
    backendParameters[k] = v2;
    if (options.parameters[k] !== v2) {
      options.parameters[k] = v2;
      onparameter && onparameter(k, v2);
    }
  }
  function ReadyForQuery(x2) {
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
    connection2.reserved ? !connection2.reserved.release && x2[5] === 73 ? ending ? terminate() : (connection2.reserved = null, onopen(connection2)) : connection2.reserved() : ending ? terminate() : onopen(connection2);
  }
  function CommandComplete(x2) {
    rows = 0;
    for (let i = x2.length - 1; i > 0; i--) {
      if (x2[i] === 32 && x2[i + 1] < 58 && result.count === null)
        result.count = +x2.toString("utf8", i + 1, x2.length - 1);
      if (x2[i - 1] >= 65) {
        result.command = x2.toString("utf8", 5, i);
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
  function ParameterDescription(x2) {
    const length2 = x2.readUInt16BE(5);
    for (let i = 0; i < length2; ++i)
      !query.statement.types[i] && (query.statement.types[i] = x2.readUInt32BE(7 + i * 4));
    query.prepare && (statements[query.signature] = query.statement);
    query.describeFirst && !query.onlyDescribe && (write(prepared(query)), query.describeFirst = false);
  }
  function RowDescription(x2) {
    if (result.command) {
      results = results || [result];
      results.push(result = new Result());
      result.count = null;
      query.statement.columns = null;
    }
    const length2 = x2.readUInt16BE(5);
    let index2 = 7;
    let start;
    query.statement.columns = Array(length2);
    for (let i = 0; i < length2; ++i) {
      start = index2;
      while (x2[index2++] !== 0) ;
      const table = x2.readUInt32BE(index2);
      const number = x2.readUInt16BE(index2 + 4);
      const type = x2.readUInt32BE(index2 + 6);
      query.statement.columns[i] = {
        name: transform.column.from ? transform.column.from(x2.toString("utf8", start, index2 - 1)) : x2.toString("utf8", start, index2 - 1),
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
  async function Authentication(x2, type = x2.readUInt32BE(5)) {
    (type === 3 ? AuthenticationCleartextPassword : type === 5 ? AuthenticationMD5Password : type === 10 ? SASL : type === 11 ? SASLContinue : type === 12 ? SASLFinal : type !== 0 ? UnknownAuth : noop)(x2, type);
  }
  async function AuthenticationCleartextPassword() {
    const payload = await Pass();
    write(
      bytes_default().p().str(payload).z(1).end()
    );
  }
  async function AuthenticationMD5Password(x2) {
    const payload = "md5" + await md5(
      Buffer.concat([
        Buffer.from(await md5(await Pass() + user)),
        x2.subarray(9)
      ])
    );
    write(
      bytes_default().p().str(payload).z(1).end()
    );
  }
  async function SASL() {
    nonce = (await crypto2.randomBytes(18)).toString("base64");
    bytes_default().p().str("SCRAM-SHA-256" + bytes_default.N);
    const i = bytes_default.i;
    write(bytes_default.inc(4).str("n,,n=*,r=" + nonce).i32(bytes_default.i - i - 4, i).end());
  }
  async function SASLContinue(x2) {
    const res = x2.toString("utf8", 9).split(",").reduce((acc, x3) => (acc[x3[0]] = x3.slice(2), acc), {});
    const saltedPassword = await crypto2.pbkdf2Sync(
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
  function SASLFinal(x2) {
    if (x2.toString("utf8", 9).split(bytes_default.N, 1)[0].slice(2) === serverSignature)
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
  function BackendKeyData(x2) {
    backend.pid = x2.readUInt32BE(5);
    backend.secret = x2.readUInt32BE(9);
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
  function tryNext(x2, xs) {
    return x2 === "read-write" && xs.default_transaction_read_only === "on" || x2 === "read-only" && xs.default_transaction_read_only === "off" || x2 === "primary" && xs.in_hot_standby === "on" || x2 === "standby" && xs.in_hot_standby === "off" || x2 === "prefer-standby" && xs.in_hot_standby === "off" && options.host[retries];
  }
  function fetchState() {
    const query2 = new Query([`
      show transaction_read_only;
      select pg_catalog.pg_is_in_recovery()
    `], [], execute, null, { simple: true });
    query2.resolve = ([[a2], [b3]]) => {
      backendParameters.default_transaction_read_only = a2.transaction_read_only;
      backendParameters.in_hot_standby = b3.pg_is_in_recovery ? "on" : "off";
    };
    query2.execute();
  }
  function ErrorResponse(x2) {
    if (query) {
      (query.cursorFn || query.describeFirst) && write(Sync);
      errorResponse = Errors.postgres(parseError(x2));
    } else {
      errored(Errors.postgres(parseError(x2)));
    }
  }
  function retry(q, error2) {
    delete statements[q.signature];
    q.retried = error2;
    execute(q);
  }
  function NotificationResponse(x2) {
    if (!onnotify)
      return;
    let index2 = 9;
    while (x2[index2++] !== 0) ;
    onnotify(
      x2.toString("utf8", 9, index2 - 1),
      x2.toString("utf8", index2, x2.length - 1)
    );
  }
  async function PortalSuspended() {
    try {
      const x2 = await Promise.resolve(query.cursorFn(result));
      rows = 0;
      x2 === CLOSE ? write(Close(query.portal)) : (result = new Result(), write(Execute("", query.cursorRows)));
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
  function CopyData(x2) {
    stream && (stream.push(x2.subarray(5)) || socket.pause());
  }
  function CopyDone() {
    stream && stream.push(null);
    stream = null;
  }
  function NoticeResponse(x2) {
    onnotice ? onnotice(parseError(x2)) : console.log(parseError(x2));
  }
  function EmptyQueryResponse() {
  }
  function FunctionCallResponse() {
    errored(Errors.notSupported("FunctionCallResponse"));
  }
  function NegotiateProtocolVersion() {
    errored(Errors.notSupported("NegotiateProtocolVersion"));
  }
  function UnknownMessage(x2) {
    console.error("Postgres.js : Unknown Message:", x2[0]);
  }
  function UnknownAuth(x2, type) {
    console.error("Postgres.js : Unknown Auth:", type);
  }
  function Bind(parameters, types2, statement = "", portal = "") {
    let prev, type;
    bytes_default().B().str(portal + bytes_default.N).str(statement + bytes_default.N).i16(0).i16(parameters.length);
    parameters.forEach((x2, i) => {
      if (x2 === null)
        return bytes_default.i32(4294967295);
      type = types2[i];
      parameters[i] = x2 = type in options.serializers ? options.serializers[type](x2) : "" + x2;
      prev = bytes_default.i;
      bytes_default.inc(4).str(x2).i32(bytes_default.i - prev - 4, prev);
    });
    bytes_default.i16(0);
    return bytes_default.end();
  }
  function Parse(str, parameters, types2, name = "") {
    bytes_default().P().str(name + bytes_default.N).str(str + bytes_default.N).i16(parameters.length);
    parameters.forEach((x2, i) => bytes_default.i32(types2[i] || 0));
    return bytes_default.end();
  }
  function Describe(x2, name = "") {
    return bytes_default().D().str(x2).str(name + bytes_default.N).end();
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
      )).filter(([, v2]) => v2).map(([k, v2]) => k + bytes_default.N + v2).join(bytes_default.N)
    ).z(2).end(0);
  }
}
function parseError(x2) {
  const error = {};
  let start = 5;
  for (let i = 5; i < x2.length - 1; i++) {
    if (x2[i] === 0) {
      error[errorFields[x2[start]]] = x2.toString("utf8", start + 1, i);
      start = i + 1;
    }
  }
  return error;
}
function md5(x2) {
  return crypto2.createHash("md5").update(x2).digest("hex");
}
function hmac(key2, x2) {
  return crypto2.createHmac("sha256", key2).update(x2).digest();
}
function sha256(x2) {
  return crypto2.createHash("sha256").update(x2).digest();
}
function xor(a2, b3) {
  const length = Math.max(a2.length, b3.length);
  const buffer2 = Buffer.allocUnsafe(length);
  for (let i = 0; i < length; i++)
    buffer2[i] = a2[i] ^ b3[i];
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
    return connection2.then((x2) => {
      connected(x2);
      onsubscribe();
      stream && stream.on("error", onerror);
      return { unsubscribe, state, sql: sql3 };
    });
  }
  function connected(x2) {
    stream = x2.stream;
    state.pid = x2.state.pid;
    state.secret = x2.state.secret;
  }
  async function init(sql4, slot2, publications) {
    if (!publications)
      throw new Error("Missing publication names");
    const xs = await sql4.unsafe(
      `CREATE_REPLICATION_SLOT ${slot2} TEMPORARY LOGICAL pgoutput NOEXPORT_SNAPSHOT`
    );
    const [x2] = xs;
    const stream2 = await sql4.unsafe(
      `START_REPLICATION SLOT ${slot2} LOGICAL ${x2.consistent_point} (proto_version '1', publication_names '${publications}')`
    ).writable();
    const state2 = {
      lsn: Buffer.concat(x2.consistent_point.split("/").map((x3) => Buffer.from(("00000000" + x3).slice(-8), "hex")))
    };
    stream2.on("data", data);
    stream2.on("error", error);
    stream2.on("close", sql4.close);
    return { stream: stream2, state: xs.state };
    function error(e) {
      console.error("Unexpected error during logical streaming - reconnecting", e);
    }
    function data(x3) {
      if (x3[0] === 119) {
        parse(x3.subarray(25), state2, sql4.options.parsers, handle2, options.transform);
      } else if (x3[0] === 107 && x3[17]) {
        state2.lsn = x3.subarray(1, 9);
        pong();
      }
    }
    function handle2(a2, b3) {
      const path = b3.relation.schema + "." + b3.relation.table;
      call("*", a2, b3);
      call("*:" + path, a2, b3);
      b3.relation.keys.length && call("*:" + path + "=" + b3.relation.keys.map((x3) => a2[x3.name]), a2, b3);
      call(b3.command, a2, b3);
      call(b3.command + ":" + path, a2, b3);
      b3.relation.keys.length && call(b3.command + ":" + path + "=" + b3.relation.keys.map((x3) => a2[x3.name]), a2, b3);
    }
    function pong() {
      const x3 = Buffer.alloc(34);
      x3[0] = "r".charCodeAt(0);
      x3.fill(state2.lsn, 1);
      x3.writeBigInt64BE(BigInt(Date.now() - Date.UTC(2e3, 0, 1)) * BigInt(1e3), 25);
      stream2.write(x3);
    }
  }
  function call(x2, a2, b3) {
    subscribers.has(x2) && subscribers.get(x2).forEach(({ fn }) => fn(a2, b3, x2));
  }
}
function Time(x2) {
  return new Date(Date.UTC(2e3, 0, 1) + Number(x2 / BigInt(1e3)));
}
function parse(x2, state, parsers2, handle2, transform) {
  const char = (acc, [k, v2]) => (acc[k.charCodeAt(0)] = v2, acc);
  Object.entries({
    R: (x3) => {
      let i = 1;
      const r = state[x3.readUInt32BE(i)] = {
        schema: x3.toString("utf8", i += 4, i = x3.indexOf(0, i)) || "pg_catalog",
        table: x3.toString("utf8", i + 1, i = x3.indexOf(0, i + 1)),
        columns: Array(x3.readUInt16BE(i += 2)),
        keys: []
      };
      i += 2;
      let columnIndex = 0, column;
      while (i < x3.length) {
        column = r.columns[columnIndex++] = {
          key: x3[i++],
          name: transform.column.from ? transform.column.from(x3.toString("utf8", i, i = x3.indexOf(0, i))) : x3.toString("utf8", i, i = x3.indexOf(0, i)),
          type: x3.readUInt32BE(i += 1),
          parser: parsers2[x3.readUInt32BE(i)],
          atttypmod: x3.readUInt32BE(i += 4)
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
    B: (x3) => {
      state.date = Time(x3.readBigInt64BE(9));
      state.lsn = x3.subarray(1, 9);
    },
    I: (x3) => {
      let i = 1;
      const relation = state[x3.readUInt32BE(i)];
      const { row } = tuples(x3, relation.columns, i += 7, transform);
      handle2(row, {
        command: "insert",
        relation
      });
    },
    D: (x3) => {
      let i = 1;
      const relation = state[x3.readUInt32BE(i)];
      i += 4;
      const key2 = x3[i] === 75;
      handle2(
        key2 || x3[i] === 79 ? tuples(x3, relation.columns, i += 3, transform).row : null,
        {
          command: "delete",
          relation,
          key: key2
        }
      );
    },
    U: (x3) => {
      let i = 1;
      const relation = state[x3.readUInt32BE(i)];
      i += 4;
      const key2 = x3[i] === 75;
      const xs = key2 || x3[i] === 79 ? tuples(x3, relation.columns, i += 3, transform) : null;
      xs && (i = xs.i);
      const { row } = tuples(x3, relation.columns, i + 3, transform);
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
  }).reduce(char, {})[x2[0]](x2);
}
function tuples(x2, columns, xi2, transform) {
  let type, column, value;
  const row = transform.raw ? new Array(columns.length) : {};
  for (let i = 0; i < columns.length; i++) {
    type = x2[xi2++];
    column = columns[i];
    value = type === 110 ? null : type === 117 ? void 0 : column.parser === void 0 ? x2.toString("utf8", xi2 + 4, xi2 += 4 + x2.readUInt32BE(xi2)) : column.parser.array === true ? column.parser(x2.toString("utf8", xi2 + 5, xi2 += 4 + x2.readUInt32BE(xi2))) : column.parser(x2.toString("utf8", xi2 + 4, xi2 += 4 + x2.readUInt32BE(xi2)));
    transform.raw ? row[i] = transform.raw === true ? value : transform.value.from ? transform.value.from(value, column) : value : row[column.name] = transform.value.from ? transform.value.from(value, column) : value;
  }
  return { i: xi2, row: transform.row.from ? transform.row.from(row) : row };
}
function parseEvent(x2) {
  const xs = x2.match(/^(\*|insert|update|delete)?:?([^.]+?\.?[^=]+)?=?(.+)?/i) || [];
  if (!xs)
    throw new Error("Malformed subscribe pattern: " + x2);
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
      const lo2 = {
        writable,
        readable,
        close: () => sql4`select lo_close(${fd})`.then(finish),
        tell: () => sql4`select lo_tell64(${fd})`,
        read: (x2) => sql4`select loread(${fd}, ${x2}) as data`,
        write: (x2) => sql4`select lowrite(${fd}, ${x2})`,
        truncate: (x2) => sql4`select lo_truncate64(${fd}, ${x2})`,
        seek: (x2, whence = 0) => sql4`select lo_lseek64(${fd}, ${x2}, ${whence})`,
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
      resolve(lo2);
      return new Promise(async (r) => finish = r);
      async function readable({
        highWaterMark = 2048 * 8,
        start = 0,
        end = Infinity
      } = {}) {
        let max = end - start;
        start && await lo2.seek(start);
        return new Stream2.Readable({
          highWaterMark,
          async read(size2) {
            const l = size2 > max ? size2 - max : size2;
            max -= size2;
            const [{ data }] = await lo2.read(l);
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
        start && await lo2.seek(start);
        return new Stream2.Writable({
          highWaterMark,
          write(chunk, encoding, callback) {
            lo2.write(chunk).then(() => callback(), callback);
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
function Postgres(a2, b3) {
  const options = parseOptions(a2, b3), subscribe = options.no_subscribe || Subscribe(Postgres, { ...options });
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
      acc[name] = (x2) => new Parameter(x2, type.to);
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
      onnotify(c, x2) {
        c in listen.channels && listen.channels[c].listeners.forEach((l) => l.fn(x2));
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
      channels[name].listeners = channels[name].listeners.filter((x2) => x2 !== listener);
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
      sql4.prepare = (x2) => prepare = x2.replace(/[^a-z0-9$-_. ]/gi);
      let uncaughtError, result;
      name && await sql4`savepoint ${sql4(name)}`;
      try {
        result = await new Promise((resolve, reject) => {
          const x2 = fn2(sql4);
          Promise.resolve(Array.isArray(x2) ? Promise.all(x2) : x2).then(resolve, reject);
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
  function json(x2) {
    return new Parameter(x2, 3802);
  }
  function array(x2, type) {
    if (!Array.isArray(x2))
      return array(Array.from(arguments));
    return new Parameter(x2, type || (x2.length ? inferType(x2) || 25 : 0), options.shared.typeArrayMap);
  }
  function handler(query) {
    if (ending)
      return query.reject(Errors.connection("CONNECTION_ENDED", options, options));
    if (open.length)
      return go2(open.shift(), query);
    if (closed.length)
      return connect(closed.shift(), query);
    busy.length ? go2(busy.shift(), query) : queries.push(query);
  }
  function go2(c, query) {
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
function parseOptions(a2, b3) {
  if (a2 && a2.shared)
    return a2;
  const env = process.env, o = (!a2 || typeof a2 === "string" ? b3 : a2) || {}, { url, multihost } = parseUrl(a2), query = [...url.searchParams].reduce((a3, [b4, c]) => (a3[b4] = c, a3), {}), host = o.hostname || o.host || multihost || url.hostname || env.PGHOST || "localhost", port = o.port || url.port || env.PGPORT || 5432, user = o.user || o.username || url.username || env.PGUSERNAME || env.PGUSER || osUsername();
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
    host: Array.isArray(host) ? host : host.split(",").map((x2) => x2.split(":")[0]),
    port: Array.isArray(port) ? port : host.split(",").map((x2) => parseInt(x2.split(":")[1] || port)),
    path: o.path || host.indexOf("/") > -1 && host + "/.s.PGSQL." + port,
    database: o.database || o.db || (url.pathname || "").slice(1) || env.PGDATABASE || user,
    user,
    pass: o.pass || o.password || url.password || env.PGPASSWORD || "",
    ...Object.entries(defaults).reduce(
      (acc, [k, d2]) => {
        const value = k in o ? o[k] : k in query ? query[k] === "disable" || query[k] === "false" ? false : query[k] : env["PG" + k.toUpperCase()] || d2;
        acc[k] = typeof value === "string" && ints.includes(k) ? +value : value;
        return acc;
      },
      {}
    ),
    connection: {
      application_name: env.PGAPPNAME || "postgres.js",
      ...o.connection,
      ...Object.entries(query).reduce((acc, [k, v2]) => (k in defaults || (acc[k] = v2), acc), {})
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
  const x2 = o.target_session_attrs || url.searchParams.get("target_session_attrs") || env.PGTARGETSESSIONATTRS;
  if (!x2 || ["read-write", "read-only", "primary", "standby", "prefer-standby"].includes(x2))
    return x2;
  throw new Error("target_session_attrs " + x2 + " is not supported");
}
function backoff(retries) {
  return (0.5 + Math.random() / 2) * Math.min(3 ** retries / 100, 20);
}
function max_lifetime() {
  return 60 * (30 + Math.random() * 30);
}
function parseTransform(x2) {
  return {
    undefined: x2.undefined,
    column: {
      from: typeof x2.column === "function" ? x2.column : x2.column && x2.column.from,
      to: x2.column && x2.column.to
    },
    value: {
      from: typeof x2.value === "function" ? x2.value : x2.value && x2.value.from,
      to: x2.value && x2.value.to
    },
    row: {
      from: typeof x2.row === "function" ? x2.row : x2.row && x2.row.from,
      to: x2.row && x2.row.to
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
        parse: (x2) => BigInt(x2),
        // eslint-disable-line
        serialize: (x2) => x2.toString()
      }
    });
    src_default = Postgres;
  }
});

// ../../node_modules/.pnpm/@neondatabase+serverless@1.1.0/node_modules/@neondatabase/serverless/index.mjs
function ha(r) {
  return 0;
}
function Yt(r, e = false) {
  let { protocol: t } = new URL(r), n = "http:" + r.substring(
    t.length
  ), { username: i, password: s, host: o, hostname: u, port: c, pathname: l, search: f, searchParams: y, hash: g } = new URL(
    n
  );
  s = decodeURIComponent(s), i = decodeURIComponent(i), l = decodeURIComponent(l);
  let A = i + ":" + s, C = e ? Object.fromEntries(y.entries()) : f;
  return {
    href: r,
    protocol: t,
    auth: A,
    username: i,
    password: s,
    host: o,
    hostname: u,
    port: c,
    pathname: l,
    search: f,
    query: C,
    hash: g
  };
}
function Xe(r) {
  let e = 1779033703, t = 3144134277, n = 1013904242, i = 2773480762, s = 1359893119, o = 2600822924, u = 528734635, c = 1541459225, l = 0, f = 0, y = [
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ], g = a((I, w) => I >>> w | I << 32 - w, "rrot"), A = new Uint32Array(64), C = new Uint8Array(64), D = a(() => {
    for (let B = 0, j = 0; B < 16; B++, j += 4) A[B] = C[j] << 24 | C[j + 1] << 16 | C[j + 2] << 8 | C[j + 3];
    for (let B = 16; B < 64; B++) {
      let j = g(A[B - 15], 7) ^ g(A[B - 15], 18) ^ A[B - 15] >>> 3, le = g(
        A[B - 2],
        17
      ) ^ g(A[B - 2], 19) ^ A[B - 2] >>> 10;
      A[B] = A[B - 16] + j + A[B - 7] + le | 0;
    }
    let I = e, w = t, Z = n, W = i, J = s, X = o, se = u, oe = c;
    for (let B = 0; B < 64; B++) {
      let j = g(J, 6) ^ g(J, 11) ^ g(J, 25), le = J & X ^ ~J & se, de = oe + j + le + y[B] + A[B] | 0, We = g(I, 2) ^ g(
        I,
        13
      ) ^ g(I, 22), fe = I & w ^ I & Z ^ w & Z, _e = We + fe | 0;
      oe = se, se = X, X = J, J = W + de | 0, W = Z, Z = w, w = I, I = de + _e | 0;
    }
    e = e + I | 0, t = t + w | 0, n = n + Z | 0, i = i + W | 0, s = s + J | 0, o = o + X | 0, u = u + se | 0, c = c + oe | 0, f = 0;
  }, "process"), Y = a((I) => {
    typeof I == "string" && (I = new TextEncoder().encode(I));
    for (let w = 0; w < I.length; w++) C[f++] = I[w], f === 64 && D();
    l += I.length;
  }, "add"), P = a(() => {
    if (C[f++] = 128, f == 64 && D(), f + 8 > 64) {
      for (; f < 64; ) C[f++] = 0;
      D();
    }
    for (; f < 58; ) C[f++] = 0;
    let I = l * 8;
    C[f++] = I / 1099511627776 & 255, C[f++] = I / 4294967296 & 255, C[f++] = I >>> 24, C[f++] = I >>> 16 & 255, C[f++] = I >>> 8 & 255, C[f++] = I & 255, D();
    let w = new Uint8Array(
      32
    );
    return w[0] = e >>> 24, w[1] = e >>> 16 & 255, w[2] = e >>> 8 & 255, w[3] = e & 255, w[4] = t >>> 24, w[5] = t >>> 16 & 255, w[6] = t >>> 8 & 255, w[7] = t & 255, w[8] = n >>> 24, w[9] = n >>> 16 & 255, w[10] = n >>> 8 & 255, w[11] = n & 255, w[12] = i >>> 24, w[13] = i >>> 16 & 255, w[14] = i >>> 8 & 255, w[15] = i & 255, w[16] = s >>> 24, w[17] = s >>> 16 & 255, w[18] = s >>> 8 & 255, w[19] = s & 255, w[20] = o >>> 24, w[21] = o >>> 16 & 255, w[22] = o >>> 8 & 255, w[23] = o & 255, w[24] = u >>> 24, w[25] = u >>> 16 & 255, w[26] = u >>> 8 & 255, w[27] = u & 255, w[28] = c >>> 24, w[29] = c >>> 16 & 255, w[30] = c >>> 8 & 255, w[31] = c & 255, w;
  }, "digest");
  return r === void 0 ? { add: Y, digest: P } : (Y(r), P());
}
function gu(r) {
  return crypto.getRandomValues(d.alloc(r));
}
function bu(r) {
  if (r === "sha256") return { update: a(function(e) {
    return { digest: a(
      function() {
        return d.from(Xe(e));
      },
      "digest"
    ) };
  }, "update") };
  if (r === "md5") return { update: a(function(e) {
    return {
      digest: a(function() {
        return typeof e == "string" ? et.hashStr(e) : et.hashByteArray(e);
      }, "digest")
    };
  }, "update") };
  throw new Error(`Hash type '${r}' not supported`);
}
function vu(r, e) {
  if (r !== "sha256") throw new Error(`Only sha256 is supported (requested: '${r}')`);
  return { update: a(function(t) {
    return { digest: a(
      function() {
        typeof e == "string" && (e = new TextEncoder().encode(e)), typeof t == "string" && (t = new TextEncoder().encode(
          t
        ));
        let n = e.length;
        if (n > 64) e = Xe(e);
        else if (n < 64) {
          let c = new Uint8Array(64);
          c.set(e), e = c;
        }
        let i = new Uint8Array(
          64
        ), s = new Uint8Array(64);
        for (let c = 0; c < 64; c++) i[c] = 54 ^ e[c], s[c] = 92 ^ e[c];
        let o = new Uint8Array(t.length + 64);
        o.set(i, 0), o.set(t, 64);
        let u = new Uint8Array(96);
        return u.set(s, 0), u.set(Xe(o), 64), d.from(Xe(u));
      },
      "digest"
    ) };
  }, "update") };
}
function ju(...r) {
  return r.join("/");
}
function Hu(r, e) {
  e(new Error("No filesystem"));
}
function $c({ socket: r, servername: e }) {
  return r.startTls(e), r;
}
function Ea(r, { alphabet: e, scratchArr: t } = {}) {
  if (!He) if (He = new Uint16Array(256), wt = new Uint16Array(256), xi) for (let C = 0; C < 256; C++) He[C] = yt[C & 15] << 8 | yt[C >>> 4], wt[C] = mt[C & 15] << 8 | mt[C >>> 4];
  else for (let C = 0; C < 256; C++) He[C] = yt[C & 15] | yt[C >>> 4] << 8, wt[C] = mt[C & 15] | mt[C >>> 4] << 8;
  r.byteOffset % 4 !== 0 && (r = new Uint8Array(r));
  let n = r.length, i = n >>> 1, s = n >>> 2, o = t || new Uint16Array(n), u = new Uint32Array(
    r.buffer,
    r.byteOffset,
    s
  ), c = new Uint32Array(o.buffer, o.byteOffset, i), l = e === "upper" ? wt : He, f = 0, y = 0, g;
  if (xi)
    for (; f < s; ) g = u[f++], c[y++] = l[g >>> 8 & 255] << 16 | l[g & 255], c[y++] = l[g >>> 24] << 16 | l[g >>> 16 & 255];
  else for (; f < s; )
    g = u[f++], c[y++] = l[g >>> 24] << 16 | l[g >>> 16 & 255], c[y++] = l[g >>> 8 & 255] << 16 | l[g & 255];
  for (f <<= 2; f < n; ) o[f] = l[r[f++]];
  return xa.decode(o.subarray(0, n));
}
function Aa(r, e = {}) {
  let t = "", n = r.length, i = va >>> 1, s = Math.ceil(n / i), o = new Uint16Array(s > 1 ? i : n);
  for (let u = 0; u < s; u++) {
    let c = u * i, l = c + i;
    t += Ea(r.subarray(c, l), ba(ga(
      {},
      e
    ), { scratchArr: o }));
  }
  return t;
}
function Ei(r, e = {}) {
  return e.alphabet !== "upper" && typeof r.toHex == "function" ? r.toHex() : Aa(r, e);
}
function bt() {
  typeof window < "u" && typeof document < "u" && typeof console < "u" && typeof console.warn == "function" && console.warn(`          
        ************************************************************
        *                                                          *
        *  WARNING: Running SQL directly from the browser can have *
        *  security implications. Even if your database is         *
        *  protected by Row-Level Security (RLS), use it at your   *
        *  own risk. This approach is great for fast prototyping,  *
        *  but ensure proper safeguards are in place to prevent    *
        *  misuse or execution of expensive SQL queries by your    *
        *  end users.                                              *
        *                                                          *
        *  If you've assessed the risks, suppress this message     *
        *  using the disableWarningInBrowsers configuration        *
        *  parameter.                                              *
        *                                                          *
        ************************************************************`);
}
function Lu(r) {
  return r instanceof d ? "\\x" + Ei(r) : r;
}
function ss(r) {
  let { query: e, params: t } = r instanceof $e ? r.toParameterizedQuery() : r;
  return { query: e, params: t.map((n) => Lu((0, us.prepareValue)(n))) };
}
function cs(r, {
  arrayMode: e,
  fullResults: t,
  fetchOptions: n,
  isolationLevel: i,
  readOnly: s,
  deferrable: o,
  authToken: u,
  disableWarningInBrowsers: c
} = {}) {
  if (!r) throw new Error("No database connection string was provided to `neon()`. Perhaps an environment variable has not been set?");
  let l;
  try {
    l = Yt(r);
  } catch {
    throw new Error(
      "Database connection string provided to `neon()` is not a valid URL. Connection string: " + String(r)
    );
  }
  let { protocol: f, username: y, hostname: g, port: A, pathname: C } = l;
  if (f !== "postgres:" && f !== "postgresql:" || !y || !g || !C) throw new Error("Database connection string format for `neon()` should be: postgresql://user:password@host.tld/dbname?option=value");
  function D(P, ...I) {
    if (!(Array.isArray(P) && Array.isArray(P.raw) && Array.isArray(I))) throw new Error('This function can now be called only as a tagged-template function: sql`SELECT ${value}`, not sql("SELECT $1", [value], options). For a conventional function call with value placeholders ($1, $2, etc.), use sql.query("SELECT $1", [value], options).');
    return new Ce(
      Y,
      new $e(P, I)
    );
  }
  a(D, "templateFn"), D.query = (P, I, w) => new Ce(Y, { query: P, params: I ?? [] }, w), D.unsafe = (P) => new Ge(
    P
  ), D.transaction = async (P, I) => {
    if (typeof P == "function" && (P = P(D)), !Array.isArray(P)) throw new Error(is);
    P.forEach((W) => {
      if (!(W instanceof Ce)) throw new Error(is);
    });
    let w = P.map((W) => W.queryData), Z = P.map((W) => W.opts ?? {});
    return Y(w, Z, I);
  };
  async function Y(P, I, w) {
    let { fetchEndpoint: Z, fetchFunction: W } = ce, J = Array.isArray(
      P
    ) ? { queries: P.map((ee) => ss(ee)) } : ss(P), X = n ?? {}, se = e ?? false, oe = t ?? false, B = i, j = s, le = o;
    w !== void 0 && (w.fetchOptions !== void 0 && (X = { ...X, ...w.fetchOptions }), w.arrayMode !== void 0 && (se = w.arrayMode), w.fullResults !== void 0 && (oe = w.fullResults), w.isolationLevel !== void 0 && (B = w.isolationLevel), w.readOnly !== void 0 && (j = w.readOnly), w.deferrable !== void 0 && (le = w.deferrable)), I !== void 0 && !Array.isArray(I) && I.fetchOptions !== void 0 && (X = { ...X, ...I.fetchOptions });
    let de = u;
    !Array.isArray(I) && I?.authToken !== void 0 && (de = I.authToken);
    let We = typeof Z == "function" ? Z(g, A, { jwtAuth: de !== void 0 }) : Z, fe = { "Neon-Connection-String": r, "Neon-Raw-Text-Output": "true", "Neon-Array-Mode": "true" }, _e = await Fu(de);
    _e && (fe.Authorization = `Bearer ${_e}`), Array.isArray(P) && (B !== void 0 && (fe["Neon-Batch-Isolation-Level"] = B), j !== void 0 && (fe["Neon-Batch-Read-Only"] = String(j)), le !== void 0 && (fe["Neon-Batch-Deferrable"] = String(le))), c || ce.disableWarningInBrowsers || bt();
    let ye;
    try {
      ye = await (W ?? fetch)(We, { method: "POST", body: JSON.stringify(J), headers: fe, ...X });
    } catch (ee) {
      let M = new be(
        `Error connecting to database: ${ee}`
      );
      throw M.sourceError = ee, M;
    }
    if (ye.ok) {
      let ee = await ye.json();
      if (Array.isArray(P)) {
        let M = ee.results;
        if (!Array.isArray(M)) throw new be("Neon internal error: unexpected result format");
        return M.map(($, me) => {
          let Ot = I[me] ?? {}, vo = Ot.arrayMode ?? se, xo = Ot.fullResults ?? oe;
          return os2(
            $,
            { arrayMode: vo, fullResults: xo, types: Ot.types }
          );
        });
      } else {
        let M = I ?? {}, $ = M.arrayMode ?? se, me = M.fullResults ?? oe;
        return os2(ee, { arrayMode: $, fullResults: me, types: M.types });
      }
    } else {
      let { status: ee } = ye;
      if (ee === 400) {
        let M = await ye.json(), $ = new be(M.message);
        for (let me of Bu) $[me] = M[me] ?? void 0;
        throw $;
      } else {
        let M = await ye.text();
        throw new be(
          `Server error (HTTP status ${ee}): ${M}`
        );
      }
    }
  }
  return a(Y, "execute"), D;
}
function os2(r, {
  arrayMode: e,
  fullResults: t,
  types: n
}) {
  let i = new as.default(n), s = r.fields.map((c) => c.name), o = r.fields.map((c) => i.getTypeParser(
    c.dataTypeID
  )), u = e === true ? r.rows.map((c) => c.map((l, f) => l === null ? null : o[f](l))) : r.rows.map((c) => Object.fromEntries(
    c.map((l, f) => [s[f], l === null ? null : o[f](l)])
  ));
  return t ? (r.viaNeonFetch = true, r.rowAsArray = e, r.rows = u, r._parsers = o, r._types = i, r) : u;
}
async function Fu(r) {
  if (typeof r == "string") return r;
  if (typeof r == "function") try {
    return await Promise.resolve(r());
  } catch (e) {
    let t = new be("Error getting auth token.");
    throw e instanceof Error && (t = new be(`Error getting auth token: ${e.message}`)), t;
  }
}
function vl(r, e) {
  if (e) return { callback: e, result: void 0 };
  let t, n, i = a(function(o, u) {
    o ? t(o) : n(u);
  }, "cb"), s = new r(function(o, u) {
    n = o, t = u;
  });
  return { callback: i, result: s };
}
var So, Ie, Eo, Ao, Co, _o, Io, a, G, T, ie, Dn, Se, O, E, Qn, Nn, ii, b2, v, x, d, m, p, ge, wi, mi, yi, S, ce, Fe, gi, Zt, tr, rr, Ti, Ri, Fi, Mi, Wi, Hi, Ki, Zi, Je, At, es, U, et, ts, lr, fr, tt, rt, nt, ku, it, ds, mr, wr, gr, br, vr, $u, xr, ys, Er, Sr, ms, vs, Es, Cs, _s, cc, Is, Ps, Rt, Ms, qs, ln, Qs, Ws, js, Gs, vn, Vs, zs, En, eo, io, so, ol, oo, ao, lo, yo, Ln, ot, pa, da, ya, bi, ma, wa, vi, ga, ba, va, xi, xa, Jt, yt, mt, Sa, Si, He, wt, gt, $e, Xt, Ge, as, us, _t, be, is, Bu, dr, Ce, go, wo, kn, ut, bo, Un, Mn, ct, export_DatabaseError, export_defaults, export_escapeIdentifier, export_escapeLiteral, export_types;
var init_serverless = __esm({
  "../../node_modules/.pnpm/@neondatabase+serverless@1.1.0/node_modules/@neondatabase/serverless/index.mjs"() {
    "use strict";
    So = Object.create;
    Ie = Object.defineProperty;
    Eo = Object.getOwnPropertyDescriptor;
    Ao = Object.getOwnPropertyNames;
    Co = Object.getPrototypeOf;
    _o = Object.prototype.hasOwnProperty;
    Io = (r, e, t) => e in r ? Ie(r, e, { enumerable: true, configurable: true, writable: true, value: t }) : r[e] = t;
    a = (r, e) => Ie(r, "name", { value: e, configurable: true });
    G = (r, e) => () => (r && (e = r(r = 0)), e);
    T = (r, e) => () => (e || r((e = { exports: {} }).exports, e), e.exports);
    ie = (r, e) => {
      for (var t in e) Ie(r, t, {
        get: e[t],
        enumerable: true
      });
    };
    Dn = (r, e, t, n) => {
      if (e && typeof e == "object" || typeof e == "function") for (let i of Ao(e)) !_o.call(r, i) && i !== t && Ie(r, i, { get: () => e[i], enumerable: !(n = Eo(e, i)) || n.enumerable });
      return r;
    };
    Se = (r, e, t) => (t = r != null ? So(Co(r)) : {}, Dn(e || !r || !r.__esModule ? Ie(t, "default", { value: r, enumerable: true }) : t, r));
    O = (r) => Dn(Ie({}, "__esModule", { value: true }), r);
    E = (r, e, t) => Io(r, typeof e != "symbol" ? e + "" : e, t);
    Qn = T((lt2) => {
      "use strict";
      p();
      lt2.byteLength = Po;
      lt2.toByteArray = Bo;
      lt2.fromByteArray = ko;
      var ae = [], te = [], To = typeof Uint8Array < "u" ? Uint8Array : Array, qt = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      for (Ee = 0, On = qt.length; Ee < On; ++Ee) ae[Ee] = qt[Ee], te[qt.charCodeAt(Ee)] = Ee;
      var Ee, On;
      te[45] = 62;
      te[95] = 63;
      function qn(r) {
        var e = r.length;
        if (e % 4 > 0) throw new Error("Invalid string. Length must be a multiple of 4");
        var t = r.indexOf("=");
        t === -1 && (t = e);
        var n = t === e ? 0 : 4 - t % 4;
        return [t, n];
      }
      a(qn, "getLens");
      function Po(r) {
        var e = qn(r), t = e[0], n = e[1];
        return (t + n) * 3 / 4 - n;
      }
      a(Po, "byteLength");
      function Ro(r, e, t) {
        return (e + t) * 3 / 4 - t;
      }
      a(Ro, "_byteLength");
      function Bo(r) {
        var e, t = qn(r), n = t[0], i = t[1], s = new To(Ro(r, n, i)), o = 0, u = i > 0 ? n - 4 : n, c;
        for (c = 0; c < u; c += 4) e = te[r.charCodeAt(c)] << 18 | te[r.charCodeAt(c + 1)] << 12 | te[r.charCodeAt(c + 2)] << 6 | te[r.charCodeAt(c + 3)], s[o++] = e >> 16 & 255, s[o++] = e >> 8 & 255, s[o++] = e & 255;
        return i === 2 && (e = te[r.charCodeAt(
          c
        )] << 2 | te[r.charCodeAt(c + 1)] >> 4, s[o++] = e & 255), i === 1 && (e = te[r.charCodeAt(c)] << 10 | te[r.charCodeAt(c + 1)] << 4 | te[r.charCodeAt(c + 2)] >> 2, s[o++] = e >> 8 & 255, s[o++] = e & 255), s;
      }
      a(Bo, "toByteArray");
      function Lo(r) {
        return ae[r >> 18 & 63] + ae[r >> 12 & 63] + ae[r >> 6 & 63] + ae[r & 63];
      }
      a(Lo, "tripletToBase64");
      function Fo(r, e, t) {
        for (var n, i = [], s = e; s < t; s += 3) n = (r[s] << 16 & 16711680) + (r[s + 1] << 8 & 65280) + (r[s + 2] & 255), i.push(Lo(n));
        return i.join("");
      }
      a(Fo, "encodeChunk");
      function ko(r) {
        for (var e, t = r.length, n = t % 3, i = [], s = 16383, o = 0, u = t - n; o < u; o += s) i.push(Fo(
          r,
          o,
          o + s > u ? u : o + s
        ));
        return n === 1 ? (e = r[t - 1], i.push(ae[e >> 2] + ae[e << 4 & 63] + "==")) : n === 2 && (e = (r[t - 2] << 8) + r[t - 1], i.push(ae[e >> 10] + ae[e >> 4 & 63] + ae[e << 2 & 63] + "=")), i.join("");
      }
      a(ko, "fromByteArray");
    });
    Nn = T((Qt) => {
      p();
      Qt.read = function(r, e, t, n, i) {
        var s, o, u = i * 8 - n - 1, c = (1 << u) - 1, l = c >> 1, f = -7, y = t ? i - 1 : 0, g = t ? -1 : 1, A = r[e + y];
        for (y += g, s = A & (1 << -f) - 1, A >>= -f, f += u; f > 0; s = s * 256 + r[e + y], y += g, f -= 8) ;
        for (o = s & (1 << -f) - 1, s >>= -f, f += n; f > 0; o = o * 256 + r[e + y], y += g, f -= 8) ;
        if (s === 0) s = 1 - l;
        else {
          if (s === c) return o ? NaN : (A ? -1 : 1) * (1 / 0);
          o = o + Math.pow(2, n), s = s - l;
        }
        return (A ? -1 : 1) * o * Math.pow(2, s - n);
      };
      Qt.write = function(r, e, t, n, i, s) {
        var o, u, c, l = s * 8 - i - 1, f = (1 << l) - 1, y = f >> 1, g = i === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0, A = n ? 0 : s - 1, C = n ? 1 : -1, D = e < 0 || e === 0 && 1 / e < 0 ? 1 : 0;
        for (e = Math.abs(e), isNaN(e) || e === 1 / 0 ? (u = isNaN(e) ? 1 : 0, o = f) : (o = Math.floor(Math.log(e) / Math.LN2), e * (c = Math.pow(2, -o)) < 1 && (o--, c *= 2), o + y >= 1 ? e += g / c : e += g * Math.pow(2, 1 - y), e * c >= 2 && (o++, c /= 2), o + y >= f ? (u = 0, o = f) : o + y >= 1 ? (u = (e * c - 1) * Math.pow(2, i), o = o + y) : (u = e * Math.pow(2, y - 1) * Math.pow(2, i), o = 0)); i >= 8; r[t + A] = u & 255, A += C, u /= 256, i -= 8) ;
        for (o = o << i | u, l += i; l > 0; r[t + A] = o & 255, A += C, o /= 256, l -= 8) ;
        r[t + A - C] |= D * 128;
      };
    });
    ii = T((Be) => {
      "use strict";
      p();
      var Nt = Qn(), Pe = Nn(), Wn = typeof Symbol == "function" && typeof Symbol.for == "function" ? /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom") : null;
      Be.Buffer = h;
      Be.SlowBuffer = Qo;
      Be.INSPECT_MAX_BYTES = 50;
      var ft = 2147483647;
      Be.kMaxLength = ft;
      h.TYPED_ARRAY_SUPPORT = Mo();
      !h.TYPED_ARRAY_SUPPORT && typeof console < "u" && typeof console.error == "function" && console.error("This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support.");
      function Mo() {
        try {
          let r = new Uint8Array(1), e = { foo: a(function() {
            return 42;
          }, "foo") };
          return Object.setPrototypeOf(e, Uint8Array.prototype), Object.setPrototypeOf(r, e), r.foo() === 42;
        } catch {
          return false;
        }
      }
      a(Mo, "typedArraySupport");
      Object.defineProperty(h.prototype, "parent", { enumerable: true, get: a(function() {
        if (h.isBuffer(this)) return this.buffer;
      }, "get") });
      Object.defineProperty(h.prototype, "offset", { enumerable: true, get: a(function() {
        if (h.isBuffer(
          this
        )) return this.byteOffset;
      }, "get") });
      function he(r) {
        if (r > ft) throw new RangeError('The value "' + r + '" is invalid for option "size"');
        let e = new Uint8Array(r);
        return Object.setPrototypeOf(e, h.prototype), e;
      }
      a(he, "createBuffer");
      function h(r, e, t) {
        if (typeof r == "number") {
          if (typeof e == "string") throw new TypeError(
            'The "string" argument must be of type string. Received type number'
          );
          return $t(r);
        }
        return Gn(r, e, t);
      }
      a(h, "Buffer");
      h.poolSize = 8192;
      function Gn(r, e, t) {
        if (typeof r == "string") return Do(r, e);
        if (ArrayBuffer.isView(r)) return Oo(r);
        if (r == null) throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof r);
        if (ue(r, ArrayBuffer) || r && ue(r.buffer, ArrayBuffer) || typeof SharedArrayBuffer < "u" && (ue(r, SharedArrayBuffer) || r && ue(
          r.buffer,
          SharedArrayBuffer
        ))) return jt(r, e, t);
        if (typeof r == "number") throw new TypeError('The "value" argument must not be of type number. Received type number');
        let n = r.valueOf && r.valueOf();
        if (n != null && n !== r) return h.from(n, e, t);
        let i = qo(r);
        if (i) return i;
        if (typeof Symbol < "u" && Symbol.toPrimitive != null && typeof r[Symbol.toPrimitive] == "function") return h.from(r[Symbol.toPrimitive]("string"), e, t);
        throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof r);
      }
      a(Gn, "from");
      h.from = function(r, e, t) {
        return Gn(r, e, t);
      };
      Object.setPrototypeOf(
        h.prototype,
        Uint8Array.prototype
      );
      Object.setPrototypeOf(h, Uint8Array);
      function Vn(r) {
        if (typeof r != "number") throw new TypeError(
          '"size" argument must be of type number'
        );
        if (r < 0) throw new RangeError('The value "' + r + '" is invalid for option "size"');
      }
      a(Vn, "assertSize");
      function Uo(r, e, t) {
        return Vn(r), r <= 0 ? he(r) : e !== void 0 ? typeof t == "string" ? he(r).fill(e, t) : he(r).fill(e) : he(r);
      }
      a(Uo, "alloc");
      h.alloc = function(r, e, t) {
        return Uo(r, e, t);
      };
      function $t(r) {
        return Vn(r), he(r < 0 ? 0 : Gt(r) | 0);
      }
      a($t, "allocUnsafe");
      h.allocUnsafe = function(r) {
        return $t(
          r
        );
      };
      h.allocUnsafeSlow = function(r) {
        return $t(r);
      };
      function Do(r, e) {
        if ((typeof e != "string" || e === "") && (e = "utf8"), !h.isEncoding(e)) throw new TypeError("Unknown encoding: " + e);
        let t = zn(r, e) | 0, n = he(t), i = n.write(
          r,
          e
        );
        return i !== t && (n = n.slice(0, i)), n;
      }
      a(Do, "fromString");
      function Wt(r) {
        let e = r.length < 0 ? 0 : Gt(r.length) | 0, t = he(e);
        for (let n = 0; n < e; n += 1) t[n] = r[n] & 255;
        return t;
      }
      a(Wt, "fromArrayLike");
      function Oo(r) {
        if (ue(r, Uint8Array)) {
          let e = new Uint8Array(r);
          return jt(e.buffer, e.byteOffset, e.byteLength);
        }
        return Wt(r);
      }
      a(Oo, "fromArrayView");
      function jt(r, e, t) {
        if (e < 0 || r.byteLength < e) throw new RangeError('"offset" is outside of buffer bounds');
        if (r.byteLength < e + (t || 0)) throw new RangeError('"length" is outside of buffer bounds');
        let n;
        return e === void 0 && t === void 0 ? n = new Uint8Array(r) : t === void 0 ? n = new Uint8Array(r, e) : n = new Uint8Array(
          r,
          e,
          t
        ), Object.setPrototypeOf(n, h.prototype), n;
      }
      a(jt, "fromArrayBuffer");
      function qo(r) {
        if (h.isBuffer(r)) {
          let e = Gt(r.length) | 0, t = he(e);
          return t.length === 0 || r.copy(t, 0, 0, e), t;
        }
        if (r.length !== void 0) return typeof r.length != "number" || zt(r.length) ? he(0) : Wt(r);
        if (r.type === "Buffer" && Array.isArray(r.data)) return Wt(r.data);
      }
      a(qo, "fromObject");
      function Gt(r) {
        if (r >= ft) throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + ft.toString(16) + " bytes");
        return r | 0;
      }
      a(Gt, "checked");
      function Qo(r) {
        return +r != r && (r = 0), h.alloc(+r);
      }
      a(Qo, "SlowBuffer");
      h.isBuffer = a(function(e) {
        return e != null && e._isBuffer === true && e !== h.prototype;
      }, "isBuffer");
      h.compare = a(function(e, t) {
        if (ue(e, Uint8Array) && (e = h.from(e, e.offset, e.byteLength)), ue(t, Uint8Array) && (t = h.from(t, t.offset, t.byteLength)), !h.isBuffer(e) || !h.isBuffer(t)) throw new TypeError(
          'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
        );
        if (e === t) return 0;
        let n = e.length, i = t.length;
        for (let s = 0, o = Math.min(n, i); s < o; ++s) if (e[s] !== t[s]) {
          n = e[s], i = t[s];
          break;
        }
        return n < i ? -1 : i < n ? 1 : 0;
      }, "compare");
      h.isEncoding = a(function(e) {
        switch (String(e).toLowerCase()) {
          case "hex":
          case "utf8":
          case "utf-8":
          case "ascii":
          case "latin1":
          case "binary":
          case "base64":
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return true;
          default:
            return false;
        }
      }, "isEncoding");
      h.concat = a(function(e, t) {
        if (!Array.isArray(e)) throw new TypeError(
          '"list" argument must be an Array of Buffers'
        );
        if (e.length === 0) return h.alloc(0);
        let n;
        if (t === void 0)
          for (t = 0, n = 0; n < e.length; ++n) t += e[n].length;
        let i = h.allocUnsafe(t), s = 0;
        for (n = 0; n < e.length; ++n) {
          let o = e[n];
          if (ue(o, Uint8Array)) s + o.length > i.length ? (h.isBuffer(o) || (o = h.from(o)), o.copy(i, s)) : Uint8Array.prototype.set.call(i, o, s);
          else if (h.isBuffer(o)) o.copy(i, s);
          else throw new TypeError('"list" argument must be an Array of Buffers');
          s += o.length;
        }
        return i;
      }, "concat");
      function zn(r, e) {
        if (h.isBuffer(r)) return r.length;
        if (ArrayBuffer.isView(r) || ue(r, ArrayBuffer)) return r.byteLength;
        if (typeof r != "string") throw new TypeError(
          'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof r
        );
        let t = r.length, n = arguments.length > 2 && arguments[2] === true;
        if (!n && t === 0) return 0;
        let i = false;
        for (; ; ) switch (e) {
          case "ascii":
          case "latin1":
          case "binary":
            return t;
          case "utf8":
          case "utf-8":
            return Ht(r).length;
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return t * 2;
          case "hex":
            return t >>> 1;
          case "base64":
            return ni(r).length;
          default:
            if (i) return n ? -1 : Ht(r).length;
            e = ("" + e).toLowerCase(), i = true;
        }
      }
      a(zn, "byteLength");
      h.byteLength = zn;
      function No(r, e, t) {
        let n = false;
        if ((e === void 0 || e < 0) && (e = 0), e > this.length || ((t === void 0 || t > this.length) && (t = this.length), t <= 0) || (t >>>= 0, e >>>= 0, t <= e)) return "";
        for (r || (r = "utf8"); ; ) switch (r) {
          case "hex":
            return Zo(this, e, t);
          case "utf8":
          case "utf-8":
            return Yn(this, e, t);
          case "ascii":
            return Ko(this, e, t);
          case "latin1":
          case "binary":
            return Yo(
              this,
              e,
              t
            );
          case "base64":
            return Vo(this, e, t);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return Jo(
              this,
              e,
              t
            );
          default:
            if (n) throw new TypeError("Unknown encoding: " + r);
            r = (r + "").toLowerCase(), n = true;
        }
      }
      a(
        No,
        "slowToString"
      );
      h.prototype._isBuffer = true;
      function Ae(r, e, t) {
        let n = r[e];
        r[e] = r[t], r[t] = n;
      }
      a(Ae, "swap");
      h.prototype.swap16 = a(function() {
        let e = this.length;
        if (e % 2 !== 0) throw new RangeError("Buffer size must be a multiple of 16-bits");
        for (let t = 0; t < e; t += 2) Ae(this, t, t + 1);
        return this;
      }, "swap16");
      h.prototype.swap32 = a(function() {
        let e = this.length;
        if (e % 4 !== 0) throw new RangeError("Buffer size must be a multiple of 32-bits");
        for (let t = 0; t < e; t += 4) Ae(this, t, t + 3), Ae(this, t + 1, t + 2);
        return this;
      }, "swap32");
      h.prototype.swap64 = a(
        function() {
          let e = this.length;
          if (e % 8 !== 0) throw new RangeError("Buffer size must be a multiple of 64-bits");
          for (let t = 0; t < e; t += 8) Ae(this, t, t + 7), Ae(this, t + 1, t + 6), Ae(this, t + 2, t + 5), Ae(this, t + 3, t + 4);
          return this;
        },
        "swap64"
      );
      h.prototype.toString = a(function() {
        let e = this.length;
        return e === 0 ? "" : arguments.length === 0 ? Yn(
          this,
          0,
          e
        ) : No.apply(this, arguments);
      }, "toString");
      h.prototype.toLocaleString = h.prototype.toString;
      h.prototype.equals = a(function(e) {
        if (!h.isBuffer(e)) throw new TypeError("Argument must be a Buffer");
        return this === e ? true : h.compare(this, e) === 0;
      }, "equals");
      h.prototype.inspect = a(function() {
        let e = "", t = Be.INSPECT_MAX_BYTES;
        return e = this.toString("hex", 0, t).replace(/(.{2})/g, "$1 ").trim(), this.length > t && (e += " ... "), "<Buffer " + e + ">";
      }, "inspect");
      Wn && (h.prototype[Wn] = h.prototype.inspect);
      h.prototype.compare = a(function(e, t, n, i, s) {
        if (ue(e, Uint8Array) && (e = h.from(e, e.offset, e.byteLength)), !h.isBuffer(e)) throw new TypeError('The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof e);
        if (t === void 0 && (t = 0), n === void 0 && (n = e ? e.length : 0), i === void 0 && (i = 0), s === void 0 && (s = this.length), t < 0 || n > e.length || i < 0 || s > this.length) throw new RangeError("out of range index");
        if (i >= s && t >= n) return 0;
        if (i >= s) return -1;
        if (t >= n) return 1;
        if (t >>>= 0, n >>>= 0, i >>>= 0, s >>>= 0, this === e) return 0;
        let o = s - i, u = n - t, c = Math.min(o, u), l = this.slice(
          i,
          s
        ), f = e.slice(t, n);
        for (let y = 0; y < c; ++y) if (l[y] !== f[y]) {
          o = l[y], u = f[y];
          break;
        }
        return o < u ? -1 : u < o ? 1 : 0;
      }, "compare");
      function Kn(r, e, t, n, i) {
        if (r.length === 0) return -1;
        if (typeof t == "string" ? (n = t, t = 0) : t > 2147483647 ? t = 2147483647 : t < -2147483648 && (t = -2147483648), t = +t, zt(t) && (t = i ? 0 : r.length - 1), t < 0 && (t = r.length + t), t >= r.length) {
          if (i) return -1;
          t = r.length - 1;
        } else if (t < 0) if (i) t = 0;
        else return -1;
        if (typeof e == "string" && (e = h.from(
          e,
          n
        )), h.isBuffer(e)) return e.length === 0 ? -1 : jn(r, e, t, n, i);
        if (typeof e == "number") return e = e & 255, typeof Uint8Array.prototype.indexOf == "function" ? i ? Uint8Array.prototype.indexOf.call(r, e, t) : Uint8Array.prototype.lastIndexOf.call(r, e, t) : jn(r, [e], t, n, i);
        throw new TypeError("val must be string, number or Buffer");
      }
      a(Kn, "bidirectionalIndexOf");
      function jn(r, e, t, n, i) {
        let s = 1, o = r.length, u = e.length;
        if (n !== void 0 && (n = String(n).toLowerCase(), n === "ucs2" || n === "ucs-2" || n === "utf16le" || n === "utf-16le")) {
          if (r.length < 2 || e.length < 2) return -1;
          s = 2, o /= 2, u /= 2, t /= 2;
        }
        function c(f, y) {
          return s === 1 ? f[y] : f.readUInt16BE(y * s);
        }
        a(c, "read");
        let l;
        if (i) {
          let f = -1;
          for (l = t; l < o; l++) if (c(r, l) === c(e, f === -1 ? 0 : l - f)) {
            if (f === -1 && (f = l), l - f + 1 === u) return f * s;
          } else f !== -1 && (l -= l - f), f = -1;
        } else for (t + u > o && (t = o - u), l = t; l >= 0; l--) {
          let f = true;
          for (let y = 0; y < u; y++) if (c(r, l + y) !== c(e, y)) {
            f = false;
            break;
          }
          if (f) return l;
        }
        return -1;
      }
      a(jn, "arrayIndexOf");
      h.prototype.includes = a(function(e, t, n) {
        return this.indexOf(
          e,
          t,
          n
        ) !== -1;
      }, "includes");
      h.prototype.indexOf = a(function(e, t, n) {
        return Kn(this, e, t, n, true);
      }, "indexOf");
      h.prototype.lastIndexOf = a(function(e, t, n) {
        return Kn(this, e, t, n, false);
      }, "lastIndexOf");
      function Wo(r, e, t, n) {
        t = Number(t) || 0;
        let i = r.length - t;
        n ? (n = Number(n), n > i && (n = i)) : n = i;
        let s = e.length;
        n > s / 2 && (n = s / 2);
        let o;
        for (o = 0; o < n; ++o) {
          let u = parseInt(e.substr(o * 2, 2), 16);
          if (zt(u)) return o;
          r[t + o] = u;
        }
        return o;
      }
      a(Wo, "hexWrite");
      function jo(r, e, t, n) {
        return ht(Ht(e, r.length - t), r, t, n);
      }
      a(jo, "utf8Write");
      function Ho(r, e, t, n) {
        return ht(ra(e), r, t, n);
      }
      a(
        Ho,
        "asciiWrite"
      );
      function $o(r, e, t, n) {
        return ht(ni(e), r, t, n);
      }
      a($o, "base64Write");
      function Go(r, e, t, n) {
        return ht(
          na(e, r.length - t),
          r,
          t,
          n
        );
      }
      a(Go, "ucs2Write");
      h.prototype.write = a(function(e, t, n, i) {
        if (t === void 0) i = "utf8", n = this.length, t = 0;
        else if (n === void 0 && typeof t == "string") i = t, n = this.length, t = 0;
        else if (isFinite(t))
          t = t >>> 0, isFinite(n) ? (n = n >>> 0, i === void 0 && (i = "utf8")) : (i = n, n = void 0);
        else throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
        let s = this.length - t;
        if ((n === void 0 || n > s) && (n = s), e.length > 0 && (n < 0 || t < 0) || t > this.length) throw new RangeError("Attempt to write outside buffer bounds");
        i || (i = "utf8");
        let o = false;
        for (; ; ) switch (i) {
          case "hex":
            return Wo(this, e, t, n);
          case "utf8":
          case "utf-8":
            return jo(this, e, t, n);
          case "ascii":
          case "latin1":
          case "binary":
            return Ho(this, e, t, n);
          case "base64":
            return $o(this, e, t, n);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return Go(this, e, t, n);
          default:
            if (o) throw new TypeError("Unknown encoding: " + i);
            i = ("" + i).toLowerCase(), o = true;
        }
      }, "write");
      h.prototype.toJSON = a(function() {
        return { type: "Buffer", data: Array.prototype.slice.call(this._arr || this, 0) };
      }, "toJSON");
      function Vo(r, e, t) {
        return e === 0 && t === r.length ? Nt.fromByteArray(r) : Nt.fromByteArray(r.slice(e, t));
      }
      a(Vo, "base64Slice");
      function Yn(r, e, t) {
        t = Math.min(r.length, t);
        let n = [], i = e;
        for (; i < t; ) {
          let s = r[i], o = null, u = s > 239 ? 4 : s > 223 ? 3 : s > 191 ? 2 : 1;
          if (i + u <= t) {
            let c, l, f, y;
            switch (u) {
              case 1:
                s < 128 && (o = s);
                break;
              case 2:
                c = r[i + 1], (c & 192) === 128 && (y = (s & 31) << 6 | c & 63, y > 127 && (o = y));
                break;
              case 3:
                c = r[i + 1], l = r[i + 2], (c & 192) === 128 && (l & 192) === 128 && (y = (s & 15) << 12 | (c & 63) << 6 | l & 63, y > 2047 && (y < 55296 || y > 57343) && (o = y));
                break;
              case 4:
                c = r[i + 1], l = r[i + 2], f = r[i + 3], (c & 192) === 128 && (l & 192) === 128 && (f & 192) === 128 && (y = (s & 15) << 18 | (c & 63) << 12 | (l & 63) << 6 | f & 63, y > 65535 && y < 1114112 && (o = y));
            }
          }
          o === null ? (o = 65533, u = 1) : o > 65535 && (o -= 65536, n.push(o >>> 10 & 1023 | 55296), o = 56320 | o & 1023), n.push(o), i += u;
        }
        return zo(n);
      }
      a(Yn, "utf8Slice");
      var Hn = 4096;
      function zo(r) {
        let e = r.length;
        if (e <= Hn) return String.fromCharCode.apply(String, r);
        let t = "", n = 0;
        for (; n < e; ) t += String.fromCharCode.apply(String, r.slice(n, n += Hn));
        return t;
      }
      a(zo, "decodeCodePointsArray");
      function Ko(r, e, t) {
        let n = "";
        t = Math.min(r.length, t);
        for (let i = e; i < t; ++i) n += String.fromCharCode(r[i] & 127);
        return n;
      }
      a(Ko, "asciiSlice");
      function Yo(r, e, t) {
        let n = "";
        t = Math.min(r.length, t);
        for (let i = e; i < t; ++i) n += String.fromCharCode(r[i]);
        return n;
      }
      a(Yo, "latin1Slice");
      function Zo(r, e, t) {
        let n = r.length;
        (!e || e < 0) && (e = 0), (!t || t < 0 || t > n) && (t = n);
        let i = "";
        for (let s = e; s < t; ++s) i += ia[r[s]];
        return i;
      }
      a(Zo, "hexSlice");
      function Jo(r, e, t) {
        let n = r.slice(e, t), i = "";
        for (let s = 0; s < n.length - 1; s += 2) i += String.fromCharCode(n[s] + n[s + 1] * 256);
        return i;
      }
      a(Jo, "utf16leSlice");
      h.prototype.slice = a(function(e, t) {
        let n = this.length;
        e = ~~e, t = t === void 0 ? n : ~~t, e < 0 ? (e += n, e < 0 && (e = 0)) : e > n && (e = n), t < 0 ? (t += n, t < 0 && (t = 0)) : t > n && (t = n), t < e && (t = e);
        let i = this.subarray(e, t);
        return Object.setPrototypeOf(i, h.prototype), i;
      }, "slice");
      function q(r, e, t) {
        if (r % 1 !== 0 || r < 0) throw new RangeError("offset is not uint");
        if (r + e > t) throw new RangeError("Trying to access beyond buffer length");
      }
      a(q, "checkOffset");
      h.prototype.readUintLE = h.prototype.readUIntLE = a(
        function(e, t, n) {
          e = e >>> 0, t = t >>> 0, n || q(e, t, this.length);
          let i = this[e], s = 1, o = 0;
          for (; ++o < t && (s *= 256); ) i += this[e + o] * s;
          return i;
        },
        "readUIntLE"
      );
      h.prototype.readUintBE = h.prototype.readUIntBE = a(function(e, t, n) {
        e = e >>> 0, t = t >>> 0, n || q(
          e,
          t,
          this.length
        );
        let i = this[e + --t], s = 1;
        for (; t > 0 && (s *= 256); ) i += this[e + --t] * s;
        return i;
      }, "readUIntBE");
      h.prototype.readUint8 = h.prototype.readUInt8 = a(
        function(e, t) {
          return e = e >>> 0, t || q(e, 1, this.length), this[e];
        },
        "readUInt8"
      );
      h.prototype.readUint16LE = h.prototype.readUInt16LE = a(function(e, t) {
        return e = e >>> 0, t || q(
          e,
          2,
          this.length
        ), this[e] | this[e + 1] << 8;
      }, "readUInt16LE");
      h.prototype.readUint16BE = h.prototype.readUInt16BE = a(function(e, t) {
        return e = e >>> 0, t || q(e, 2, this.length), this[e] << 8 | this[e + 1];
      }, "readUInt16BE");
      h.prototype.readUint32LE = h.prototype.readUInt32LE = a(function(e, t) {
        return e = e >>> 0, t || q(e, 4, this.length), (this[e] | this[e + 1] << 8 | this[e + 2] << 16) + this[e + 3] * 16777216;
      }, "readUInt32LE");
      h.prototype.readUint32BE = h.prototype.readUInt32BE = a(function(e, t) {
        return e = e >>> 0, t || q(e, 4, this.length), this[e] * 16777216 + (this[e + 1] << 16 | this[e + 2] << 8 | this[e + 3]);
      }, "readUInt32BE");
      h.prototype.readBigUInt64LE = we(a(function(e) {
        e = e >>> 0, Re(e, "offset");
        let t = this[e], n = this[e + 7];
        (t === void 0 || n === void 0) && je(e, this.length - 8);
        let i = t + this[++e] * 2 ** 8 + this[++e] * 2 ** 16 + this[++e] * 2 ** 24, s = this[++e] + this[++e] * 2 ** 8 + this[++e] * 2 ** 16 + n * 2 ** 24;
        return BigInt(i) + (BigInt(s) << BigInt(32));
      }, "readBigUInt64LE"));
      h.prototype.readBigUInt64BE = we(a(function(e) {
        e = e >>> 0, Re(e, "offset");
        let t = this[e], n = this[e + 7];
        (t === void 0 || n === void 0) && je(e, this.length - 8);
        let i = t * 2 ** 24 + this[++e] * 2 ** 16 + this[++e] * 2 ** 8 + this[++e], s = this[++e] * 2 ** 24 + this[++e] * 2 ** 16 + this[++e] * 2 ** 8 + n;
        return (BigInt(i) << BigInt(
          32
        )) + BigInt(s);
      }, "readBigUInt64BE"));
      h.prototype.readIntLE = a(function(e, t, n) {
        e = e >>> 0, t = t >>> 0, n || q(
          e,
          t,
          this.length
        );
        let i = this[e], s = 1, o = 0;
        for (; ++o < t && (s *= 256); ) i += this[e + o] * s;
        return s *= 128, i >= s && (i -= Math.pow(2, 8 * t)), i;
      }, "readIntLE");
      h.prototype.readIntBE = a(function(e, t, n) {
        e = e >>> 0, t = t >>> 0, n || q(e, t, this.length);
        let i = t, s = 1, o = this[e + --i];
        for (; i > 0 && (s *= 256); ) o += this[e + --i] * s;
        return s *= 128, o >= s && (o -= Math.pow(2, 8 * t)), o;
      }, "readIntBE");
      h.prototype.readInt8 = a(function(e, t) {
        return e = e >>> 0, t || q(e, 1, this.length), this[e] & 128 ? (255 - this[e] + 1) * -1 : this[e];
      }, "readInt8");
      h.prototype.readInt16LE = a(function(e, t) {
        e = e >>> 0, t || q(
          e,
          2,
          this.length
        );
        let n = this[e] | this[e + 1] << 8;
        return n & 32768 ? n | 4294901760 : n;
      }, "readInt16LE");
      h.prototype.readInt16BE = a(function(e, t) {
        e = e >>> 0, t || q(e, 2, this.length);
        let n = this[e + 1] | this[e] << 8;
        return n & 32768 ? n | 4294901760 : n;
      }, "readInt16BE");
      h.prototype.readInt32LE = a(function(e, t) {
        return e = e >>> 0, t || q(e, 4, this.length), this[e] | this[e + 1] << 8 | this[e + 2] << 16 | this[e + 3] << 24;
      }, "readInt32LE");
      h.prototype.readInt32BE = a(function(e, t) {
        return e = e >>> 0, t || q(e, 4, this.length), this[e] << 24 | this[e + 1] << 16 | this[e + 2] << 8 | this[e + 3];
      }, "readInt32BE");
      h.prototype.readBigInt64LE = we(a(function(e) {
        e = e >>> 0, Re(e, "offset");
        let t = this[e], n = this[e + 7];
        (t === void 0 || n === void 0) && je(e, this.length - 8);
        let i = this[e + 4] + this[e + 5] * 2 ** 8 + this[e + 6] * 2 ** 16 + (n << 24);
        return (BigInt(i) << BigInt(
          32
        )) + BigInt(t + this[++e] * 2 ** 8 + this[++e] * 2 ** 16 + this[++e] * 2 ** 24);
      }, "readBigInt64LE"));
      h.prototype.readBigInt64BE = we(a(function(e) {
        e = e >>> 0, Re(e, "offset");
        let t = this[e], n = this[e + 7];
        (t === void 0 || n === void 0) && je(e, this.length - 8);
        let i = (t << 24) + this[++e] * 2 ** 16 + this[++e] * 2 ** 8 + this[++e];
        return (BigInt(i) << BigInt(32)) + BigInt(
          this[++e] * 2 ** 24 + this[++e] * 2 ** 16 + this[++e] * 2 ** 8 + n
        );
      }, "readBigInt64BE"));
      h.prototype.readFloatLE = a(function(e, t) {
        return e = e >>> 0, t || q(e, 4, this.length), Pe.read(this, e, true, 23, 4);
      }, "readFloatLE");
      h.prototype.readFloatBE = a(function(e, t) {
        return e = e >>> 0, t || q(e, 4, this.length), Pe.read(this, e, false, 23, 4);
      }, "readFloatBE");
      h.prototype.readDoubleLE = a(function(e, t) {
        return e = e >>> 0, t || q(e, 8, this.length), Pe.read(this, e, true, 52, 8);
      }, "readDoubleLE");
      h.prototype.readDoubleBE = a(function(e, t) {
        return e = e >>> 0, t || q(e, 8, this.length), Pe.read(
          this,
          e,
          false,
          52,
          8
        );
      }, "readDoubleBE");
      function V(r, e, t, n, i, s) {
        if (!h.isBuffer(r)) throw new TypeError('"buffer" argument must be a Buffer instance');
        if (e > i || e < s) throw new RangeError('"value" argument is out of bounds');
        if (t + n > r.length) throw new RangeError("Index out of range");
      }
      a(V, "checkInt");
      h.prototype.writeUintLE = h.prototype.writeUIntLE = a(function(e, t, n, i) {
        if (e = +e, t = t >>> 0, n = n >>> 0, !i) {
          let u = Math.pow(2, 8 * n) - 1;
          V(
            this,
            e,
            t,
            n,
            u,
            0
          );
        }
        let s = 1, o = 0;
        for (this[t] = e & 255; ++o < n && (s *= 256); ) this[t + o] = e / s & 255;
        return t + n;
      }, "writeUIntLE");
      h.prototype.writeUintBE = h.prototype.writeUIntBE = a(function(e, t, n, i) {
        if (e = +e, t = t >>> 0, n = n >>> 0, !i) {
          let u = Math.pow(2, 8 * n) - 1;
          V(this, e, t, n, u, 0);
        }
        let s = n - 1, o = 1;
        for (this[t + s] = e & 255; --s >= 0 && (o *= 256); ) this[t + s] = e / o & 255;
        return t + n;
      }, "writeUIntBE");
      h.prototype.writeUint8 = h.prototype.writeUInt8 = a(function(e, t, n) {
        return e = +e, t = t >>> 0, n || V(this, e, t, 1, 255, 0), this[t] = e & 255, t + 1;
      }, "writeUInt8");
      h.prototype.writeUint16LE = h.prototype.writeUInt16LE = a(function(e, t, n) {
        return e = +e, t = t >>> 0, n || V(this, e, t, 2, 65535, 0), this[t] = e & 255, this[t + 1] = e >>> 8, t + 2;
      }, "writeUInt16LE");
      h.prototype.writeUint16BE = h.prototype.writeUInt16BE = a(function(e, t, n) {
        return e = +e, t = t >>> 0, n || V(this, e, t, 2, 65535, 0), this[t] = e >>> 8, this[t + 1] = e & 255, t + 2;
      }, "writeUInt16BE");
      h.prototype.writeUint32LE = h.prototype.writeUInt32LE = a(function(e, t, n) {
        return e = +e, t = t >>> 0, n || V(
          this,
          e,
          t,
          4,
          4294967295,
          0
        ), this[t + 3] = e >>> 24, this[t + 2] = e >>> 16, this[t + 1] = e >>> 8, this[t] = e & 255, t + 4;
      }, "writeUInt32LE");
      h.prototype.writeUint32BE = h.prototype.writeUInt32BE = a(function(e, t, n) {
        return e = +e, t = t >>> 0, n || V(
          this,
          e,
          t,
          4,
          4294967295,
          0
        ), this[t] = e >>> 24, this[t + 1] = e >>> 16, this[t + 2] = e >>> 8, this[t + 3] = e & 255, t + 4;
      }, "writeUInt32BE");
      function Zn(r, e, t, n, i) {
        ri(e, n, i, r, t, 7);
        let s = Number(e & BigInt(4294967295));
        r[t++] = s, s = s >> 8, r[t++] = s, s = s >> 8, r[t++] = s, s = s >> 8, r[t++] = s;
        let o = Number(e >> BigInt(32) & BigInt(4294967295));
        return r[t++] = o, o = o >> 8, r[t++] = o, o = o >> 8, r[t++] = o, o = o >> 8, r[t++] = o, t;
      }
      a(Zn, "wrtBigUInt64LE");
      function Jn(r, e, t, n, i) {
        ri(e, n, i, r, t, 7);
        let s = Number(e & BigInt(4294967295));
        r[t + 7] = s, s = s >> 8, r[t + 6] = s, s = s >> 8, r[t + 5] = s, s = s >> 8, r[t + 4] = s;
        let o = Number(e >> BigInt(32) & BigInt(4294967295));
        return r[t + 3] = o, o = o >> 8, r[t + 2] = o, o = o >> 8, r[t + 1] = o, o = o >> 8, r[t] = o, t + 8;
      }
      a(Jn, "wrtBigUInt64BE");
      h.prototype.writeBigUInt64LE = we(a(function(e, t = 0) {
        return Zn(this, e, t, BigInt(0), BigInt("0xffffffffffffffff"));
      }, "writeBigUInt64LE"));
      h.prototype.writeBigUInt64BE = we(a(function(e, t = 0) {
        return Jn(this, e, t, BigInt(0), BigInt(
          "0xffffffffffffffff"
        ));
      }, "writeBigUInt64BE"));
      h.prototype.writeIntLE = a(function(e, t, n, i) {
        if (e = +e, t = t >>> 0, !i) {
          let c = Math.pow(2, 8 * n - 1);
          V(this, e, t, n, c - 1, -c);
        }
        let s = 0, o = 1, u = 0;
        for (this[t] = e & 255; ++s < n && (o *= 256); )
          e < 0 && u === 0 && this[t + s - 1] !== 0 && (u = 1), this[t + s] = (e / o >> 0) - u & 255;
        return t + n;
      }, "writeIntLE");
      h.prototype.writeIntBE = a(function(e, t, n, i) {
        if (e = +e, t = t >>> 0, !i) {
          let c = Math.pow(2, 8 * n - 1);
          V(this, e, t, n, c - 1, -c);
        }
        let s = n - 1, o = 1, u = 0;
        for (this[t + s] = e & 255; --s >= 0 && (o *= 256); ) e < 0 && u === 0 && this[t + s + 1] !== 0 && (u = 1), this[t + s] = (e / o >> 0) - u & 255;
        return t + n;
      }, "writeIntBE");
      h.prototype.writeInt8 = a(function(e, t, n) {
        return e = +e, t = t >>> 0, n || V(this, e, t, 1, 127, -128), e < 0 && (e = 255 + e + 1), this[t] = e & 255, t + 1;
      }, "writeInt8");
      h.prototype.writeInt16LE = a(function(e, t, n) {
        return e = +e, t = t >>> 0, n || V(this, e, t, 2, 32767, -32768), this[t] = e & 255, this[t + 1] = e >>> 8, t + 2;
      }, "writeInt16LE");
      h.prototype.writeInt16BE = a(function(e, t, n) {
        return e = +e, t = t >>> 0, n || V(this, e, t, 2, 32767, -32768), this[t] = e >>> 8, this[t + 1] = e & 255, t + 2;
      }, "writeInt16BE");
      h.prototype.writeInt32LE = a(function(e, t, n) {
        return e = +e, t = t >>> 0, n || V(
          this,
          e,
          t,
          4,
          2147483647,
          -2147483648
        ), this[t] = e & 255, this[t + 1] = e >>> 8, this[t + 2] = e >>> 16, this[t + 3] = e >>> 24, t + 4;
      }, "writeInt32LE");
      h.prototype.writeInt32BE = a(function(e, t, n) {
        return e = +e, t = t >>> 0, n || V(
          this,
          e,
          t,
          4,
          2147483647,
          -2147483648
        ), e < 0 && (e = 4294967295 + e + 1), this[t] = e >>> 24, this[t + 1] = e >>> 16, this[t + 2] = e >>> 8, this[t + 3] = e & 255, t + 4;
      }, "writeInt32BE");
      h.prototype.writeBigInt64LE = we(a(function(e, t = 0) {
        return Zn(this, e, t, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
      }, "writeBigInt64LE"));
      h.prototype.writeBigInt64BE = we(
        a(function(e, t = 0) {
          return Jn(this, e, t, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
        }, "writeBigInt64BE")
      );
      function Xn(r, e, t, n, i, s) {
        if (t + n > r.length) throw new RangeError("Index out of range");
        if (t < 0) throw new RangeError("Index out of range");
      }
      a(Xn, "checkIEEE754");
      function ei(r, e, t, n, i) {
        return e = +e, t = t >>> 0, i || Xn(r, e, t, 4, 34028234663852886e22, -34028234663852886e22), Pe.write(r, e, t, n, 23, 4), t + 4;
      }
      a(
        ei,
        "writeFloat"
      );
      h.prototype.writeFloatLE = a(function(e, t, n) {
        return ei(this, e, t, true, n);
      }, "writeFloatLE");
      h.prototype.writeFloatBE = a(function(e, t, n) {
        return ei(this, e, t, false, n);
      }, "writeFloatBE");
      function ti(r, e, t, n, i) {
        return e = +e, t = t >>> 0, i || Xn(r, e, t, 8, 17976931348623157e292, -17976931348623157e292), Pe.write(
          r,
          e,
          t,
          n,
          52,
          8
        ), t + 8;
      }
      a(ti, "writeDouble");
      h.prototype.writeDoubleLE = a(function(e, t, n) {
        return ti(this, e, t, true, n);
      }, "writeDoubleLE");
      h.prototype.writeDoubleBE = a(function(e, t, n) {
        return ti(this, e, t, false, n);
      }, "writeDoubleBE");
      h.prototype.copy = a(function(e, t, n, i) {
        if (!h.isBuffer(e)) throw new TypeError("argument should be a Buffer");
        if (n || (n = 0), !i && i !== 0 && (i = this.length), t >= e.length && (t = e.length), t || (t = 0), i > 0 && i < n && (i = n), i === n || e.length === 0 || this.length === 0) return 0;
        if (t < 0) throw new RangeError("targetStart out of bounds");
        if (n < 0 || n >= this.length) throw new RangeError("Index out of range");
        if (i < 0) throw new RangeError("sourceEnd out of bounds");
        i > this.length && (i = this.length), e.length - t < i - n && (i = e.length - t + n);
        let s = i - n;
        return this === e && typeof Uint8Array.prototype.copyWithin == "function" ? this.copyWithin(t, n, i) : Uint8Array.prototype.set.call(e, this.subarray(n, i), t), s;
      }, "copy");
      h.prototype.fill = a(function(e, t, n, i) {
        if (typeof e == "string") {
          if (typeof t == "string" ? (i = t, t = 0, n = this.length) : typeof n == "string" && (i = n, n = this.length), i !== void 0 && typeof i != "string") throw new TypeError("encoding must be a string");
          if (typeof i == "string" && !h.isEncoding(i)) throw new TypeError(
            "Unknown encoding: " + i
          );
          if (e.length === 1) {
            let o = e.charCodeAt(0);
            (i === "utf8" && o < 128 || i === "latin1") && (e = o);
          }
        } else typeof e == "number" ? e = e & 255 : typeof e == "boolean" && (e = Number(e));
        if (t < 0 || this.length < t || this.length < n) throw new RangeError("Out of range index");
        if (n <= t) return this;
        t = t >>> 0, n = n === void 0 ? this.length : n >>> 0, e || (e = 0);
        let s;
        if (typeof e == "number") for (s = t; s < n; ++s) this[s] = e;
        else {
          let o = h.isBuffer(e) ? e : h.from(
            e,
            i
          ), u = o.length;
          if (u === 0) throw new TypeError('The value "' + e + '" is invalid for argument "value"');
          for (s = 0; s < n - t; ++s) this[s + t] = o[s % u];
        }
        return this;
      }, "fill");
      var Te = {};
      function Vt(r, e, t) {
        var n;
        Te[r] = (n = class extends t {
          constructor() {
            super(), Object.defineProperty(this, "message", { value: e.apply(this, arguments), writable: true, configurable: true }), this.name = `${this.name} [${r}]`, this.stack, delete this.name;
          }
          get code() {
            return r;
          }
          set code(s) {
            Object.defineProperty(
              this,
              "code",
              { configurable: true, enumerable: true, value: s, writable: true }
            );
          }
          toString() {
            return `${this.name} [${r}]: ${this.message}`;
          }
        }, a(n, "NodeError"), n);
      }
      a(Vt, "E");
      Vt("ERR_BUFFER_OUT_OF_BOUNDS", function(r) {
        return r ? `${r} is outside of buffer bounds` : "Attempt to access memory outside buffer bounds";
      }, RangeError);
      Vt(
        "ERR_INVALID_ARG_TYPE",
        function(r, e) {
          return `The "${r}" argument must be of type number. Received type ${typeof e}`;
        },
        TypeError
      );
      Vt("ERR_OUT_OF_RANGE", function(r, e, t) {
        let n = `The value of "${r}" is out of range.`, i = t;
        return Number.isInteger(t) && Math.abs(t) > 2 ** 32 ? i = $n(String(t)) : typeof t == "bigint" && (i = String(
          t
        ), (t > BigInt(2) ** BigInt(32) || t < -(BigInt(2) ** BigInt(32))) && (i = $n(i)), i += "n"), n += ` It must be ${e}. Received ${i}`, n;
      }, RangeError);
      function $n(r) {
        let e = "", t = r.length, n = r[0] === "-" ? 1 : 0;
        for (; t >= n + 4; t -= 3) e = `_${r.slice(t - 3, t)}${e}`;
        return `${r.slice(0, t)}${e}`;
      }
      a($n, "addNumericalSeparator");
      function Xo(r, e, t) {
        Re(e, "offset"), (r[e] === void 0 || r[e + t] === void 0) && je(e, r.length - (t + 1));
      }
      a(Xo, "checkBounds");
      function ri(r, e, t, n, i, s) {
        if (r > t || r < e) {
          let o = typeof e == "bigint" ? "n" : "", u;
          throw s > 3 ? e === 0 || e === BigInt(0) ? u = `>= 0${o} and < 2${o} ** ${(s + 1) * 8}${o}` : u = `>= -(2${o} ** ${(s + 1) * 8 - 1}${o}) and < 2 ** ${(s + 1) * 8 - 1}${o}` : u = `>= ${e}${o} and <= ${t}${o}`, new Te.ERR_OUT_OF_RANGE("value", u, r);
        }
        Xo(n, i, s);
      }
      a(ri, "checkIntBI");
      function Re(r, e) {
        if (typeof r != "number") throw new Te.ERR_INVALID_ARG_TYPE(e, "number", r);
      }
      a(Re, "validateNumber");
      function je(r, e, t) {
        throw Math.floor(r) !== r ? (Re(r, t), new Te.ERR_OUT_OF_RANGE(t || "offset", "an integer", r)) : e < 0 ? new Te.ERR_BUFFER_OUT_OF_BOUNDS() : new Te.ERR_OUT_OF_RANGE(t || "offset", `>= ${t ? 1 : 0} and <= ${e}`, r);
      }
      a(je, "boundsError");
      var ea = /[^+/0-9A-Za-z-_]/g;
      function ta(r) {
        if (r = r.split("=")[0], r = r.trim().replace(ea, ""), r.length < 2) return "";
        for (; r.length % 4 !== 0; ) r = r + "=";
        return r;
      }
      a(ta, "base64clean");
      function Ht(r, e) {
        e = e || 1 / 0;
        let t, n = r.length, i = null, s = [];
        for (let o = 0; o < n; ++o) {
          if (t = r.charCodeAt(o), t > 55295 && t < 57344) {
            if (!i) {
              if (t > 56319) {
                (e -= 3) > -1 && s.push(239, 191, 189);
                continue;
              } else if (o + 1 === n) {
                (e -= 3) > -1 && s.push(239, 191, 189);
                continue;
              }
              i = t;
              continue;
            }
            if (t < 56320) {
              (e -= 3) > -1 && s.push(239, 191, 189), i = t;
              continue;
            }
            t = (i - 55296 << 10 | t - 56320) + 65536;
          } else i && (e -= 3) > -1 && s.push(239, 191, 189);
          if (i = null, t < 128) {
            if ((e -= 1) < 0) break;
            s.push(t);
          } else if (t < 2048) {
            if ((e -= 2) < 0) break;
            s.push(t >> 6 | 192, t & 63 | 128);
          } else if (t < 65536) {
            if ((e -= 3) < 0) break;
            s.push(t >> 12 | 224, t >> 6 & 63 | 128, t & 63 | 128);
          } else if (t < 1114112) {
            if ((e -= 4) < 0) break;
            s.push(t >> 18 | 240, t >> 12 & 63 | 128, t >> 6 & 63 | 128, t & 63 | 128);
          } else throw new Error("Invalid code point");
        }
        return s;
      }
      a(Ht, "utf8ToBytes");
      function ra(r) {
        let e = [];
        for (let t = 0; t < r.length; ++t) e.push(r.charCodeAt(t) & 255);
        return e;
      }
      a(
        ra,
        "asciiToBytes"
      );
      function na(r, e) {
        let t, n, i, s = [];
        for (let o = 0; o < r.length && !((e -= 2) < 0); ++o) t = r.charCodeAt(
          o
        ), n = t >> 8, i = t % 256, s.push(i), s.push(n);
        return s;
      }
      a(na, "utf16leToBytes");
      function ni(r) {
        return Nt.toByteArray(
          ta(r)
        );
      }
      a(ni, "base64ToBytes");
      function ht(r, e, t, n) {
        let i;
        for (i = 0; i < n && !(i + t >= e.length || i >= r.length); ++i)
          e[i + t] = r[i];
        return i;
      }
      a(ht, "blitBuffer");
      function ue(r, e) {
        return r instanceof e || r != null && r.constructor != null && r.constructor.name != null && r.constructor.name === e.name;
      }
      a(ue, "isInstance");
      function zt(r) {
        return r !== r;
      }
      a(zt, "numberIsNaN");
      var ia = (function() {
        let r = "0123456789abcdef", e = new Array(256);
        for (let t = 0; t < 16; ++t) {
          let n = t * 16;
          for (let i = 0; i < 16; ++i) e[n + i] = r[t] + r[i];
        }
        return e;
      })();
      function we(r) {
        return typeof BigInt > "u" ? sa : r;
      }
      a(we, "defineBigIntMethod");
      function sa() {
        throw new Error("BigInt not supported");
      }
      a(sa, "BufferBigIntNotDefined");
    });
    p = G(() => {
      "use strict";
      b2 = globalThis, v = globalThis.setImmediate ?? ((r) => setTimeout(r, 0)), x = globalThis.clearImmediate ?? ((r) => clearTimeout(r)), d = typeof globalThis.Buffer == "function" && typeof globalThis.Buffer.allocUnsafe == "function" ? globalThis.Buffer : ii().Buffer, m = globalThis.process ?? {};
      m.env ?? (m.env = {});
      try {
        m.nextTick(() => {
        });
      } catch {
        let e = Promise.resolve();
        m.nextTick = e.then.bind(e);
      }
    });
    ge = T((Bl, Kt) => {
      "use strict";
      p();
      var Le = typeof Reflect == "object" ? Reflect : null, si = Le && typeof Le.apply == "function" ? Le.apply : a(function(e, t, n) {
        return Function.prototype.apply.call(e, t, n);
      }, "ReflectApply"), pt;
      Le && typeof Le.ownKeys == "function" ? pt = Le.ownKeys : Object.getOwnPropertySymbols ? pt = a(function(e) {
        return Object.getOwnPropertyNames(e).concat(Object.getOwnPropertySymbols(e));
      }, "ReflectOwnKeys") : pt = a(function(e) {
        return Object.getOwnPropertyNames(e);
      }, "ReflectOwnKeys");
      function oa(r) {
        console && console.warn && console.warn(r);
      }
      a(
        oa,
        "ProcessEmitWarning"
      );
      var ai = Number.isNaN || a(function(e) {
        return e !== e;
      }, "NumberIsNaN");
      function R() {
        R.init.call(this);
      }
      a(R, "EventEmitter");
      Kt.exports = R;
      Kt.exports.once = la;
      R.EventEmitter = R;
      R.prototype._events = void 0;
      R.prototype._eventsCount = 0;
      R.prototype._maxListeners = void 0;
      var oi = 10;
      function dt(r) {
        if (typeof r != "function") throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof r);
      }
      a(dt, "checkListener");
      Object.defineProperty(R, "defaultMaxListeners", { enumerable: true, get: a(function() {
        return oi;
      }, "get"), set: a(
        function(r) {
          if (typeof r != "number" || r < 0 || ai(r)) throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + r + ".");
          oi = r;
        },
        "set"
      ) });
      R.init = function() {
        (this._events === void 0 || this._events === Object.getPrototypeOf(this)._events) && (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0), this._maxListeners = this._maxListeners || void 0;
      };
      R.prototype.setMaxListeners = a(function(e) {
        if (typeof e != "number" || e < 0 || ai(e)) throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + e + ".");
        return this._maxListeners = e, this;
      }, "setMaxListeners");
      function ui(r) {
        return r._maxListeners === void 0 ? R.defaultMaxListeners : r._maxListeners;
      }
      a(ui, "_getMaxListeners");
      R.prototype.getMaxListeners = a(function() {
        return ui(this);
      }, "getMaxListeners");
      R.prototype.emit = a(function(e) {
        for (var t = [], n = 1; n < arguments.length; n++) t.push(arguments[n]);
        var i = e === "error", s = this._events;
        if (s !== void 0) i = i && s.error === void 0;
        else if (!i) return false;
        if (i) {
          var o;
          if (t.length > 0 && (o = t[0]), o instanceof Error) throw o;
          var u = new Error("Unhandled error." + (o ? " (" + o.message + ")" : ""));
          throw u.context = o, u;
        }
        var c = s[e];
        if (c === void 0) return false;
        if (typeof c == "function") si(c, this, t);
        else for (var l = c.length, f = pi(c, l), n = 0; n < l; ++n) si(f[n], this, t);
        return true;
      }, "emit");
      function ci(r, e, t, n) {
        var i, s, o;
        if (dt(
          t
        ), s = r._events, s === void 0 ? (s = r._events = /* @__PURE__ */ Object.create(null), r._eventsCount = 0) : (s.newListener !== void 0 && (r.emit("newListener", e, t.listener ? t.listener : t), s = r._events), o = s[e]), o === void 0) o = s[e] = t, ++r._eventsCount;
        else if (typeof o == "function" ? o = s[e] = n ? [t, o] : [o, t] : n ? o.unshift(t) : o.push(t), i = ui(r), i > 0 && o.length > i && !o.warned) {
          o.warned = true;
          var u = new Error("Possible EventEmitter memory leak detected. " + o.length + " " + String(e) + " listeners added. Use emitter.setMaxListeners() to increase limit");
          u.name = "MaxListenersExceededWarning", u.emitter = r, u.type = e, u.count = o.length, oa(u);
        }
        return r;
      }
      a(ci, "_addListener");
      R.prototype.addListener = a(function(e, t) {
        return ci(this, e, t, false);
      }, "addListener");
      R.prototype.on = R.prototype.addListener;
      R.prototype.prependListener = a(function(e, t) {
        return ci(this, e, t, true);
      }, "prependListener");
      function aa() {
        if (!this.fired) return this.target.removeListener(this.type, this.wrapFn), this.fired = true, arguments.length === 0 ? this.listener.call(this.target) : this.listener.apply(this.target, arguments);
      }
      a(aa, "onceWrapper");
      function li(r, e, t) {
        var n = {
          fired: false,
          wrapFn: void 0,
          target: r,
          type: e,
          listener: t
        }, i = aa.bind(n);
        return i.listener = t, n.wrapFn = i, i;
      }
      a(li, "_onceWrap");
      R.prototype.once = a(function(e, t) {
        return dt(t), this.on(e, li(this, e, t)), this;
      }, "once");
      R.prototype.prependOnceListener = a(function(e, t) {
        return dt(t), this.prependListener(e, li(this, e, t)), this;
      }, "prependOnceListener");
      R.prototype.removeListener = a(function(e, t) {
        var n, i, s, o, u;
        if (dt(t), i = this._events, i === void 0) return this;
        if (n = i[e], n === void 0) return this;
        if (n === t || n.listener === t) --this._eventsCount === 0 ? this._events = /* @__PURE__ */ Object.create(null) : (delete i[e], i.removeListener && this.emit("removeListener", e, n.listener || t));
        else if (typeof n != "function") {
          for (s = -1, o = n.length - 1; o >= 0; o--) if (n[o] === t || n[o].listener === t) {
            u = n[o].listener, s = o;
            break;
          }
          if (s < 0) return this;
          s === 0 ? n.shift() : ua(n, s), n.length === 1 && (i[e] = n[0]), i.removeListener !== void 0 && this.emit("removeListener", e, u || t);
        }
        return this;
      }, "removeListener");
      R.prototype.off = R.prototype.removeListener;
      R.prototype.removeAllListeners = a(function(e) {
        var t, n, i;
        if (n = this._events, n === void 0) return this;
        if (n.removeListener === void 0) return arguments.length === 0 ? (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0) : n[e] !== void 0 && (--this._eventsCount === 0 ? this._events = /* @__PURE__ */ Object.create(null) : delete n[e]), this;
        if (arguments.length === 0) {
          var s = Object.keys(n), o;
          for (i = 0; i < s.length; ++i) o = s[i], o !== "removeListener" && this.removeAllListeners(
            o
          );
          return this.removeAllListeners("removeListener"), this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0, this;
        }
        if (t = n[e], typeof t == "function") this.removeListener(e, t);
        else if (t !== void 0) for (i = t.length - 1; i >= 0; i--) this.removeListener(e, t[i]);
        return this;
      }, "removeAllListeners");
      function fi(r, e, t) {
        var n = r._events;
        if (n === void 0) return [];
        var i = n[e];
        return i === void 0 ? [] : typeof i == "function" ? t ? [i.listener || i] : [i] : t ? ca(i) : pi(i, i.length);
      }
      a(fi, "_listeners");
      R.prototype.listeners = a(function(e) {
        return fi(this, e, true);
      }, "listeners");
      R.prototype.rawListeners = a(function(e) {
        return fi(this, e, false);
      }, "rawListeners");
      R.listenerCount = function(r, e) {
        return typeof r.listenerCount == "function" ? r.listenerCount(e) : hi.call(r, e);
      };
      R.prototype.listenerCount = hi;
      function hi(r) {
        var e = this._events;
        if (e !== void 0) {
          var t = e[r];
          if (typeof t == "function")
            return 1;
          if (t !== void 0) return t.length;
        }
        return 0;
      }
      a(hi, "listenerCount");
      R.prototype.eventNames = a(function() {
        return this._eventsCount > 0 ? pt(this._events) : [];
      }, "eventNames");
      function pi(r, e) {
        for (var t = new Array(e), n = 0; n < e; ++n) t[n] = r[n];
        return t;
      }
      a(pi, "arrayClone");
      function ua(r, e) {
        for (; e + 1 < r.length; e++) r[e] = r[e + 1];
        r.pop();
      }
      a(ua, "spliceOne");
      function ca(r) {
        for (var e = new Array(r.length), t = 0; t < e.length; ++t) e[t] = r[t].listener || r[t];
        return e;
      }
      a(ca, "unwrapListeners");
      function la(r, e) {
        return new Promise(function(t, n) {
          function i(o) {
            r.removeListener(e, s), n(o);
          }
          a(i, "errorListener");
          function s() {
            typeof r.removeListener == "function" && r.removeListener("error", i), t([].slice.call(arguments));
          }
          a(s, "resolver"), di(r, e, s, { once: true }), e !== "error" && fa(r, i, { once: true });
        });
      }
      a(la, "once");
      function fa(r, e, t) {
        typeof r.on == "function" && di(r, "error", e, t);
      }
      a(
        fa,
        "addErrorHandlerIfEventEmitter"
      );
      function di(r, e, t, n) {
        if (typeof r.on == "function") n.once ? r.once(e, t) : r.on(e, t);
        else if (typeof r.addEventListener == "function") r.addEventListener(e, a(function i(s) {
          n.once && r.removeEventListener(e, i), t(s);
        }, "wrapListener"));
        else throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof r);
      }
      a(di, "eventTargetAgnosticAddListener");
    });
    wi = {};
    ie(wi, { Socket: () => ce, isIP: () => ha });
    Fe = G(() => {
      "use strict";
      p();
      mi = Se(ge(), 1);
      a(ha, "isIP");
      yi = /^[^.]+\./, S = class S2 extends mi.EventEmitter {
        constructor() {
          super(...arguments);
          E(this, "opts", {});
          E(this, "connecting", false);
          E(this, "pending", true);
          E(
            this,
            "writable",
            true
          );
          E(this, "encrypted", false);
          E(this, "authorized", false);
          E(this, "destroyed", false);
          E(this, "ws", null);
          E(this, "writeBuffer");
          E(this, "tlsState", 0);
          E(this, "tlsRead");
          E(this, "tlsWrite");
        }
        static get poolQueryViaFetch() {
          return S2.opts.poolQueryViaFetch ?? S2.defaults.poolQueryViaFetch;
        }
        static set poolQueryViaFetch(t) {
          S2.opts.poolQueryViaFetch = t;
        }
        static get fetchEndpoint() {
          return S2.opts.fetchEndpoint ?? S2.defaults.fetchEndpoint;
        }
        static set fetchEndpoint(t) {
          S2.opts.fetchEndpoint = t;
        }
        static get fetchConnectionCache() {
          return true;
        }
        static set fetchConnectionCache(t) {
          console.warn("The `fetchConnectionCache` option is deprecated (now always `true`)");
        }
        static get fetchFunction() {
          return S2.opts.fetchFunction ?? S2.defaults.fetchFunction;
        }
        static set fetchFunction(t) {
          S2.opts.fetchFunction = t;
        }
        static get webSocketConstructor() {
          return S2.opts.webSocketConstructor ?? S2.defaults.webSocketConstructor;
        }
        static set webSocketConstructor(t) {
          S2.opts.webSocketConstructor = t;
        }
        get webSocketConstructor() {
          return this.opts.webSocketConstructor ?? S2.webSocketConstructor;
        }
        set webSocketConstructor(t) {
          this.opts.webSocketConstructor = t;
        }
        static get wsProxy() {
          return S2.opts.wsProxy ?? S2.defaults.wsProxy;
        }
        static set wsProxy(t) {
          S2.opts.wsProxy = t;
        }
        get wsProxy() {
          return this.opts.wsProxy ?? S2.wsProxy;
        }
        set wsProxy(t) {
          this.opts.wsProxy = t;
        }
        static get coalesceWrites() {
          return S2.opts.coalesceWrites ?? S2.defaults.coalesceWrites;
        }
        static set coalesceWrites(t) {
          S2.opts.coalesceWrites = t;
        }
        get coalesceWrites() {
          return this.opts.coalesceWrites ?? S2.coalesceWrites;
        }
        set coalesceWrites(t) {
          this.opts.coalesceWrites = t;
        }
        static get useSecureWebSocket() {
          return S2.opts.useSecureWebSocket ?? S2.defaults.useSecureWebSocket;
        }
        static set useSecureWebSocket(t) {
          S2.opts.useSecureWebSocket = t;
        }
        get useSecureWebSocket() {
          return this.opts.useSecureWebSocket ?? S2.useSecureWebSocket;
        }
        set useSecureWebSocket(t) {
          this.opts.useSecureWebSocket = t;
        }
        static get forceDisablePgSSL() {
          return S2.opts.forceDisablePgSSL ?? S2.defaults.forceDisablePgSSL;
        }
        static set forceDisablePgSSL(t) {
          S2.opts.forceDisablePgSSL = t;
        }
        get forceDisablePgSSL() {
          return this.opts.forceDisablePgSSL ?? S2.forceDisablePgSSL;
        }
        set forceDisablePgSSL(t) {
          this.opts.forceDisablePgSSL = t;
        }
        static get disableSNI() {
          return S2.opts.disableSNI ?? S2.defaults.disableSNI;
        }
        static set disableSNI(t) {
          S2.opts.disableSNI = t;
        }
        get disableSNI() {
          return this.opts.disableSNI ?? S2.disableSNI;
        }
        set disableSNI(t) {
          this.opts.disableSNI = t;
        }
        static get disableWarningInBrowsers() {
          return S2.opts.disableWarningInBrowsers ?? S2.defaults.disableWarningInBrowsers;
        }
        static set disableWarningInBrowsers(t) {
          S2.opts.disableWarningInBrowsers = t;
        }
        get disableWarningInBrowsers() {
          return this.opts.disableWarningInBrowsers ?? S2.disableWarningInBrowsers;
        }
        set disableWarningInBrowsers(t) {
          this.opts.disableWarningInBrowsers = t;
        }
        static get pipelineConnect() {
          return S2.opts.pipelineConnect ?? S2.defaults.pipelineConnect;
        }
        static set pipelineConnect(t) {
          S2.opts.pipelineConnect = t;
        }
        get pipelineConnect() {
          return this.opts.pipelineConnect ?? S2.pipelineConnect;
        }
        set pipelineConnect(t) {
          this.opts.pipelineConnect = t;
        }
        static get subtls() {
          return S2.opts.subtls ?? S2.defaults.subtls;
        }
        static set subtls(t) {
          S2.opts.subtls = t;
        }
        get subtls() {
          return this.opts.subtls ?? S2.subtls;
        }
        set subtls(t) {
          this.opts.subtls = t;
        }
        static get pipelineTLS() {
          return S2.opts.pipelineTLS ?? S2.defaults.pipelineTLS;
        }
        static set pipelineTLS(t) {
          S2.opts.pipelineTLS = t;
        }
        get pipelineTLS() {
          return this.opts.pipelineTLS ?? S2.pipelineTLS;
        }
        set pipelineTLS(t) {
          this.opts.pipelineTLS = t;
        }
        static get rootCerts() {
          return S2.opts.rootCerts ?? S2.defaults.rootCerts;
        }
        static set rootCerts(t) {
          S2.opts.rootCerts = t;
        }
        get rootCerts() {
          return this.opts.rootCerts ?? S2.rootCerts;
        }
        set rootCerts(t) {
          this.opts.rootCerts = t;
        }
        wsProxyAddrForHost(t, n) {
          let i = this.wsProxy;
          if (i === void 0) throw new Error("No WebSocket proxy is configured. Please see https://github.com/neondatabase/serverless/blob/main/CONFIG.md#wsproxy-string--host-string-port-number--string--string");
          return typeof i == "function" ? i(t, n) : `${i}?address=${t}:${n}`;
        }
        setNoDelay() {
          return this;
        }
        setKeepAlive() {
          return this;
        }
        ref() {
          return this;
        }
        unref() {
          return this;
        }
        connect(t, n, i) {
          this.connecting = true, i && this.once("connect", i);
          let s = a(() => {
            this.connecting = false, this.pending = false, this.emit("connect"), this.emit("ready");
          }, "handleWebSocketOpen"), o = a((c, l = false) => {
            c.binaryType = "arraybuffer", c.addEventListener("error", (f) => {
              this.emit("error", f), this.emit("close");
            }), c.addEventListener("message", (f) => {
              if (this.tlsState === 0) {
                let y = d.from(f.data);
                this.emit("data", y);
              }
            }), c.addEventListener("close", () => {
              this.emit("close");
            }), l ? s() : c.addEventListener(
              "open",
              s
            );
          }, "configureWebSocket"), u;
          try {
            u = this.wsProxyAddrForHost(n, typeof t == "string" ? parseInt(t, 10) : t);
          } catch (c) {
            this.emit("error", c), this.emit("close");
            return;
          }
          try {
            let l = (this.useSecureWebSocket ? "wss:" : "ws:") + "//" + u;
            if (this.webSocketConstructor !== void 0) this.ws = new this.webSocketConstructor(l), o(this.ws);
            else try {
              this.ws = new WebSocket(l), o(this.ws);
            } catch {
              this.ws = new __unstable_WebSocket(l), o(this.ws);
            }
          } catch (c) {
            let f = (this.useSecureWebSocket ? "https:" : "http:") + "//" + u;
            fetch(f, { headers: { Upgrade: "websocket" } }).then(
              (y) => {
                if (this.ws = y.webSocket, this.ws == null) throw c;
                this.ws.accept(), o(this.ws, true);
              }
            ).catch((y) => {
              this.emit(
                "error",
                new Error(`All attempts to open a WebSocket to connect to the database failed. Please refer to https://github.com/neondatabase/serverless/blob/main/CONFIG.md#websocketconstructor-typeof-websocket--undefined. Details: ${y}`)
              ), this.emit("close");
            });
          }
        }
        async startTls(t) {
          if (this.subtls === void 0) throw new Error(
            "For Postgres SSL connections, you must set `neonConfig.subtls` to the subtls library. See https://github.com/neondatabase/serverless/blob/main/CONFIG.md for more information."
          );
          this.tlsState = 1;
          let n = await this.subtls.TrustedCert.databaseFromPEM(this.rootCerts), i = new this.subtls.WebSocketReadQueue(this.ws), s = i.read.bind(i), o = this.rawWrite.bind(this), { read: u, write: c } = await this.subtls.startTls(t, n, s, o, { useSNI: !this.disableSNI, expectPreData: this.pipelineTLS ? new Uint8Array([83]) : void 0 });
          this.tlsRead = u, this.tlsWrite = c, this.tlsState = 2, this.encrypted = true, this.authorized = true, this.emit("secureConnection", this), this.tlsReadLoop();
        }
        async tlsReadLoop() {
          for (; ; ) {
            let t = await this.tlsRead();
            if (t === void 0) break;
            {
              let n = d.from(t);
              this.emit("data", n);
            }
          }
        }
        rawWrite(t) {
          if (!this.coalesceWrites) {
            this.ws && this.ws.send(t);
            return;
          }
          if (this.writeBuffer === void 0) this.writeBuffer = t, setTimeout(() => {
            this.ws && this.ws.send(this.writeBuffer), this.writeBuffer = void 0;
          }, 0);
          else {
            let n = new Uint8Array(
              this.writeBuffer.length + t.length
            );
            n.set(this.writeBuffer), n.set(t, this.writeBuffer.length), this.writeBuffer = n;
          }
        }
        write(t, n = "utf8", i = (s) => {
        }) {
          return t.length === 0 ? (i(), true) : (typeof t == "string" && (t = d.from(t, n)), this.tlsState === 0 ? (this.rawWrite(t), i()) : this.tlsState === 1 ? this.once("secureConnection", () => {
            this.write(
              t,
              n,
              i
            );
          }) : (this.tlsWrite(t), i()), true);
        }
        end(t = d.alloc(0), n = "utf8", i = () => {
        }) {
          return this.write(t, n, () => {
            this.ws.close(), i();
          }), this;
        }
        destroy() {
          return this.destroyed = true, this.end();
        }
      };
      a(S, "Socket"), E(S, "defaults", {
        poolQueryViaFetch: false,
        fetchEndpoint: a((t, n, i) => {
          let s;
          return i?.jwtAuth ? s = t.replace(yi, "apiauth.") : s = t.replace(yi, "api."), "https://" + s + "/sql";
        }, "fetchEndpoint"),
        fetchConnectionCache: true,
        fetchFunction: void 0,
        webSocketConstructor: void 0,
        wsProxy: a((t) => t + "/v2", "wsProxy"),
        useSecureWebSocket: true,
        forceDisablePgSSL: true,
        coalesceWrites: true,
        pipelineConnect: "password",
        subtls: void 0,
        rootCerts: "",
        pipelineTLS: false,
        disableSNI: false,
        disableWarningInBrowsers: false
      }), E(S, "opts", {});
      ce = S;
    });
    gi = {};
    ie(gi, { parse: () => Yt });
    Zt = G(() => {
      "use strict";
      p();
      a(Yt, "parse");
    });
    tr = T((Ai) => {
      "use strict";
      p();
      Ai.parse = function(r, e) {
        return new er(r, e).parse();
      };
      var vt = class vt2 {
        constructor(e, t) {
          this.source = e, this.transform = t || Ca, this.position = 0, this.entries = [], this.recorded = [], this.dimension = 0;
        }
        isEof() {
          return this.position >= this.source.length;
        }
        nextCharacter() {
          var e = this.source[this.position++];
          return e === "\\" ? { value: this.source[this.position++], escaped: true } : { value: e, escaped: false };
        }
        record(e) {
          this.recorded.push(
            e
          );
        }
        newEntry(e) {
          var t;
          (this.recorded.length > 0 || e) && (t = this.recorded.join(""), t === "NULL" && !e && (t = null), t !== null && (t = this.transform(t)), this.entries.push(t), this.recorded = []);
        }
        consumeDimensions() {
          if (this.source[0] === "[") for (; !this.isEof(); ) {
            var e = this.nextCharacter();
            if (e.value === "=") break;
          }
        }
        parse(e) {
          var t, n, i;
          for (this.consumeDimensions(); !this.isEof(); ) if (t = this.nextCharacter(), t.value === "{" && !i) this.dimension++, this.dimension > 1 && (n = new vt2(this.source.substr(this.position - 1), this.transform), this.entries.push(n.parse(
            true
          )), this.position += n.position - 2);
          else if (t.value === "}" && !i) {
            if (this.dimension--, !this.dimension && (this.newEntry(), e)) return this.entries;
          } else t.value === '"' && !t.escaped ? (i && this.newEntry(true), i = !i) : t.value === "," && !i ? this.newEntry() : this.record(t.value);
          if (this.dimension !== 0) throw new Error("array dimension not balanced");
          return this.entries;
        }
      };
      a(vt, "ArrayParser");
      var er = vt;
      function Ca(r) {
        return r;
      }
      a(Ca, "identity");
    });
    rr = T((Zl, Ci) => {
      p();
      var _a = tr();
      Ci.exports = { create: a(function(r, e) {
        return { parse: a(function() {
          return _a.parse(r, e);
        }, "parse") };
      }, "create") };
    });
    Ti = T((ef, Ii) => {
      "use strict";
      p();
      var Ia = /(\d{1,})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,})?.*?( BC)?$/, Ta = /^(\d{1,})-(\d{2})-(\d{2})( BC)?$/, Pa = /([Z+-])(\d{2})?:?(\d{2})?:?(\d{2})?/, Ra = /^-?infinity$/;
      Ii.exports = a(function(e) {
        if (Ra.test(e)) return Number(e.replace("i", "I"));
        var t = Ia.exec(e);
        if (!t) return Ba(
          e
        ) || null;
        var n = !!t[8], i = parseInt(t[1], 10);
        n && (i = _i(i));
        var s = parseInt(t[2], 10) - 1, o = t[3], u = parseInt(
          t[4],
          10
        ), c = parseInt(t[5], 10), l = parseInt(t[6], 10), f = t[7];
        f = f ? 1e3 * parseFloat(f) : 0;
        var y, g = La(e);
        return g != null ? (y = new Date(Date.UTC(i, s, o, u, c, l, f)), nr(i) && y.setUTCFullYear(i), g !== 0 && y.setTime(y.getTime() - g)) : (y = new Date(i, s, o, u, c, l, f), nr(i) && y.setFullYear(i)), y;
      }, "parseDate");
      function Ba(r) {
        var e = Ta.exec(r);
        if (e) {
          var t = parseInt(e[1], 10), n = !!e[4];
          n && (t = _i(t));
          var i = parseInt(e[2], 10) - 1, s = e[3], o = new Date(t, i, s);
          return nr(
            t
          ) && o.setFullYear(t), o;
        }
      }
      a(Ba, "getDate");
      function La(r) {
        if (r.endsWith("+00")) return 0;
        var e = Pa.exec(r.split(" ")[1]);
        if (e) {
          var t = e[1];
          if (t === "Z") return 0;
          var n = t === "-" ? -1 : 1, i = parseInt(e[2], 10) * 3600 + parseInt(
            e[3] || 0,
            10
          ) * 60 + parseInt(e[4] || 0, 10);
          return i * n * 1e3;
        }
      }
      a(La, "timeZoneOffset");
      function _i(r) {
        return -(r - 1);
      }
      a(_i, "bcYearToNegativeYear");
      function nr(r) {
        return r >= 0 && r < 100;
      }
      a(nr, "is0To99");
    });
    Ri = T((nf, Pi) => {
      p();
      Pi.exports = ka;
      var Fa = Object.prototype.hasOwnProperty;
      function ka(r) {
        for (var e = 1; e < arguments.length; e++) {
          var t = arguments[e];
          for (var n in t) Fa.call(t, n) && (r[n] = t[n]);
        }
        return r;
      }
      a(ka, "extend");
    });
    Fi = T((af, Li) => {
      "use strict";
      p();
      var Ma = Ri();
      Li.exports = ke;
      function ke(r) {
        if (!(this instanceof ke))
          return new ke(r);
        Ma(this, Va(r));
      }
      a(ke, "PostgresInterval");
      var Ua = [
        "seconds",
        "minutes",
        "hours",
        "days",
        "months",
        "years"
      ];
      ke.prototype.toPostgres = function() {
        var r = Ua.filter(this.hasOwnProperty, this);
        return this.milliseconds && r.indexOf("seconds") < 0 && r.push("seconds"), r.length === 0 ? "0" : r.map(function(e) {
          var t = this[e] || 0;
          return e === "seconds" && this.milliseconds && (t = (t + this.milliseconds / 1e3).toFixed(6).replace(
            /\.?0+$/,
            ""
          )), t + " " + e;
        }, this).join(" ");
      };
      var Da = { years: "Y", months: "M", days: "D", hours: "H", minutes: "M", seconds: "S" }, Oa = ["years", "months", "days"], qa = ["hours", "minutes", "seconds"];
      ke.prototype.toISOString = ke.prototype.toISO = function() {
        var r = Oa.map(t, this).join(""), e = qa.map(t, this).join("");
        return "P" + r + "T" + e;
        function t(n) {
          var i = this[n] || 0;
          return n === "seconds" && this.milliseconds && (i = (i + this.milliseconds / 1e3).toFixed(6).replace(
            /0+$/,
            ""
          )), i + Da[n];
        }
      };
      var ir = "([+-]?\\d+)", Qa = ir + "\\s+years?", Na = ir + "\\s+mons?", Wa = ir + "\\s+days?", ja = "([+-])?([\\d]*):(\\d\\d):(\\d\\d)\\.?(\\d{1,6})?", Ha = new RegExp([Qa, Na, Wa, ja].map(function(r) {
        return "(" + r + ")?";
      }).join("\\s*")), Bi = { years: 2, months: 4, days: 6, hours: 9, minutes: 10, seconds: 11, milliseconds: 12 }, $a = ["hours", "minutes", "seconds", "milliseconds"];
      function Ga(r) {
        var e = r + "000000".slice(r.length);
        return parseInt(
          e,
          10
        ) / 1e3;
      }
      a(Ga, "parseMilliseconds");
      function Va(r) {
        if (!r) return {};
        var e = Ha.exec(r), t = e[8] === "-";
        return Object.keys(Bi).reduce(function(n, i) {
          var s = Bi[i], o = e[s];
          return !o || (o = i === "milliseconds" ? Ga(o) : parseInt(o, 10), !o) || (t && ~$a.indexOf(i) && (o *= -1), n[i] = o), n;
        }, {});
      }
      a(Va, "parse");
    });
    Mi = T((lf, ki) => {
      "use strict";
      p();
      ki.exports = a(function(e) {
        if (/^\\x/.test(e)) return new d(e.substr(
          2
        ), "hex");
        for (var t = "", n = 0; n < e.length; ) if (e[n] !== "\\") t += e[n], ++n;
        else if (/[0-7]{3}/.test(e.substr(n + 1, 3))) t += String.fromCharCode(parseInt(e.substr(n + 1, 3), 8)), n += 4;
        else {
          for (var i = 1; n + i < e.length && e[n + i] === "\\"; ) i++;
          for (var s = 0; s < Math.floor(i / 2); ++s) t += "\\";
          n += Math.floor(i / 2) * 2;
        }
        return new d(t, "binary");
      }, "parseBytea");
    });
    Wi = T((pf, Ni) => {
      p();
      var Ve = tr(), ze = rr(), xt = Ti(), Di = Fi(), Oi = Mi();
      function St(r) {
        return a(function(t) {
          return t === null ? t : r(t);
        }, "nullAllowed");
      }
      a(St, "allowNull");
      function qi(r) {
        return r === null ? r : r === "TRUE" || r === "t" || r === "true" || r === "y" || r === "yes" || r === "on" || r === "1";
      }
      a(qi, "parseBool");
      function za(r) {
        return r ? Ve.parse(r, qi) : null;
      }
      a(za, "parseBoolArray");
      function Ka(r) {
        return parseInt(r, 10);
      }
      a(Ka, "parseBaseTenInt");
      function sr(r) {
        return r ? Ve.parse(r, St(Ka)) : null;
      }
      a(sr, "parseIntegerArray");
      function Ya(r) {
        return r ? Ve.parse(r, St(function(e) {
          return Qi(e).trim();
        })) : null;
      }
      a(Ya, "parseBigIntegerArray");
      var Za = a(function(r) {
        if (!r) return null;
        var e = ze.create(r, function(t) {
          return t !== null && (t = cr(t)), t;
        });
        return e.parse();
      }, "parsePointArray"), or3 = a(function(r) {
        if (!r) return null;
        var e = ze.create(r, function(t) {
          return t !== null && (t = parseFloat(t)), t;
        });
        return e.parse();
      }, "parseFloatArray"), re = a(function(r) {
        if (!r) return null;
        var e = ze.create(r);
        return e.parse();
      }, "parseStringArray"), ar = a(function(r) {
        if (!r) return null;
        var e = ze.create(
          r,
          function(t) {
            return t !== null && (t = xt(t)), t;
          }
        );
        return e.parse();
      }, "parseDateArray"), Ja = a(function(r) {
        if (!r)
          return null;
        var e = ze.create(r, function(t) {
          return t !== null && (t = Di(t)), t;
        });
        return e.parse();
      }, "parseIntervalArray"), Xa = a(function(r) {
        return r ? Ve.parse(r, St(Oi)) : null;
      }, "parseByteAArray"), ur = a(function(r) {
        return parseInt(r, 10);
      }, "parseInteger"), Qi = a(function(r) {
        var e = String(r);
        return /^\d+$/.test(e) ? e : r;
      }, "parseBigInteger"), Ui = a(function(r) {
        return r ? Ve.parse(r, St(JSON.parse)) : null;
      }, "parseJsonArray"), cr = a(
        function(r) {
          return r[0] !== "(" ? null : (r = r.substring(1, r.length - 1).split(","), { x: parseFloat(r[0]), y: parseFloat(
            r[1]
          ) });
        },
        "parsePoint"
      ), eu = a(function(r) {
        if (r[0] !== "<" && r[1] !== "(") return null;
        for (var e = "(", t = "", n = false, i = 2; i < r.length - 1; i++) {
          if (n || (e += r[i]), r[i] === ")") {
            n = true;
            continue;
          } else if (!n) continue;
          r[i] !== "," && (t += r[i]);
        }
        var s = cr(e);
        return s.radius = parseFloat(t), s;
      }, "parseCircle"), tu = a(function(r) {
        r(20, Qi), r(21, ur), r(23, ur), r(26, ur), r(700, parseFloat), r(701, parseFloat), r(16, qi), r(1082, xt), r(1114, xt), r(1184, xt), r(
          600,
          cr
        ), r(651, re), r(718, eu), r(1e3, za), r(1001, Xa), r(1005, sr), r(1007, sr), r(1028, sr), r(1016, Ya), r(1017, Za), r(1021, or3), r(1022, or3), r(1231, or3), r(1014, re), r(1015, re), r(1008, re), r(1009, re), r(1040, re), r(1041, re), r(
          1115,
          ar
        ), r(1182, ar), r(1185, ar), r(1186, Di), r(1187, Ja), r(17, Oi), r(114, JSON.parse.bind(JSON)), r(3802, JSON.parse.bind(JSON)), r(199, Ui), r(3807, Ui), r(3907, re), r(2951, re), r(791, re), r(1183, re), r(1270, re);
      }, "init");
      Ni.exports = { init: tu };
    });
    Hi = T((mf, ji) => {
      "use strict";
      p();
      var z2 = 1e6;
      function ru(r) {
        var e = r.readInt32BE(0), t = r.readUInt32BE(
          4
        ), n = "";
        e < 0 && (e = ~e + (t === 0), t = ~t + 1 >>> 0, n = "-");
        var i = "", s, o, u, c, l, f;
        {
          if (s = e % z2, e = e / z2 >>> 0, o = 4294967296 * s + t, t = o / z2 >>> 0, u = "" + (o - z2 * t), t === 0 && e === 0) return n + u + i;
          for (c = "", l = 6 - u.length, f = 0; f < l; f++) c += "0";
          i = c + u + i;
        }
        {
          if (s = e % z2, e = e / z2 >>> 0, o = 4294967296 * s + t, t = o / z2 >>> 0, u = "" + (o - z2 * t), t === 0 && e === 0) return n + u + i;
          for (c = "", l = 6 - u.length, f = 0; f < l; f++) c += "0";
          i = c + u + i;
        }
        {
          if (s = e % z2, e = e / z2 >>> 0, o = 4294967296 * s + t, t = o / z2 >>> 0, u = "" + (o - z2 * t), t === 0 && e === 0) return n + u + i;
          for (c = "", l = 6 - u.length, f = 0; f < l; f++) c += "0";
          i = c + u + i;
        }
        return s = e % z2, o = 4294967296 * s + t, u = "" + o % z2, n + u + i;
      }
      a(ru, "readInt8");
      ji.exports = ru;
    });
    Ki = T((bf, zi) => {
      p();
      var nu = Hi(), L = a(function(r, e, t, n, i) {
        t = t || 0, n = n || false, i = i || function(A, C, D) {
          return A * Math.pow(2, D) + C;
        };
        var s = t >> 3, o = a(function(A) {
          return n ? ~A & 255 : A;
        }, "inv"), u = 255, c = 8 - t % 8;
        e < c && (u = 255 << 8 - e & 255, c = e), t && (u = u >> t % 8);
        var l = 0;
        t % 8 + e >= 8 && (l = i(0, o(r[s]) & u, c));
        for (var f = e + t >> 3, y = s + 1; y < f; y++) l = i(l, o(
          r[y]
        ), 8);
        var g = (e + t) % 8;
        return g > 0 && (l = i(l, o(r[f]) >> 8 - g, g)), l;
      }, "parseBits"), Vi = a(function(r, e, t) {
        var n = Math.pow(2, t - 1) - 1, i = L(r, 1), s = L(r, t, 1);
        if (s === 0) return 0;
        var o = 1, u = a(function(l, f, y) {
          l === 0 && (l = 1);
          for (var g = 1; g <= y; g++) o /= 2, (f & 1 << y - g) > 0 && (l += o);
          return l;
        }, "parsePrecisionBits"), c = L(r, e, t + 1, false, u);
        return s == Math.pow(
          2,
          t + 1
        ) - 1 ? c === 0 ? i === 0 ? 1 / 0 : -1 / 0 : NaN : (i === 0 ? 1 : -1) * Math.pow(2, s - n) * c;
      }, "parseFloatFromBits"), iu = a(function(r) {
        return L(r, 1) == 1 ? -1 * (L(r, 15, 1, true) + 1) : L(r, 15, 1);
      }, "parseInt16"), $i = a(function(r) {
        return L(r, 1) == 1 ? -1 * (L(
          r,
          31,
          1,
          true
        ) + 1) : L(r, 31, 1);
      }, "parseInt32"), su = a(function(r) {
        return Vi(r, 23, 8);
      }, "parseFloat32"), ou = a(function(r) {
        return Vi(r, 52, 11);
      }, "parseFloat64"), au = a(function(r) {
        var e = L(r, 16, 32);
        if (e == 49152) return NaN;
        for (var t = Math.pow(1e4, L(r, 16, 16)), n = 0, i = [], s = L(r, 16), o = 0; o < s; o++) n += L(r, 16, 64 + 16 * o) * t, t /= 1e4;
        var u = Math.pow(10, L(
          r,
          16,
          48
        ));
        return (e === 0 ? 1 : -1) * Math.round(n * u) / u;
      }, "parseNumeric"), Gi = a(function(r, e) {
        var t = L(e, 1), n = L(
          e,
          63,
          1
        ), i = new Date((t === 0 ? 1 : -1) * n / 1e3 + 9466848e5);
        return r || i.setTime(i.getTime() + i.getTimezoneOffset() * 6e4), i.usec = n % 1e3, i.getMicroSeconds = function() {
          return this.usec;
        }, i.setMicroSeconds = function(s) {
          this.usec = s;
        }, i.getUTCMicroSeconds = function() {
          return this.usec;
        }, i;
      }, "parseDate"), Ke = a(
        function(r) {
          for (var e = L(
            r,
            32
          ), t = L(r, 32, 32), n = L(r, 32, 64), i = 96, s = [], o = 0; o < e; o++) s[o] = L(r, 32, i), i += 32, i += 32;
          var u = a(function(l) {
            var f = L(r, 32, i);
            if (i += 32, f == 4294967295) return null;
            var y;
            if (l == 23 || l == 20) return y = L(r, f * 8, i), i += f * 8, y;
            if (l == 25) return y = r.toString(this.encoding, i >> 3, (i += f << 3) >> 3), y;
            console.log("ERROR: ElementType not implemented: " + l);
          }, "parseElement"), c = a(function(l, f) {
            var y = [], g;
            if (l.length > 1) {
              var A = l.shift();
              for (g = 0; g < A; g++) y[g] = c(l, f);
              l.unshift(A);
            } else for (g = 0; g < l[0]; g++) y[g] = u(f);
            return y;
          }, "parse");
          return c(s, n);
        },
        "parseArray"
      ), uu = a(function(r) {
        return r.toString("utf8");
      }, "parseText"), cu = a(function(r) {
        return r === null ? null : L(r, 8) > 0;
      }, "parseBool"), lu = a(function(r) {
        r(20, nu), r(21, iu), r(23, $i), r(26, $i), r(1700, au), r(700, su), r(701, ou), r(16, cu), r(1114, Gi.bind(null, false)), r(1184, Gi.bind(null, true)), r(1e3, Ke), r(1007, Ke), r(1016, Ke), r(1008, Ke), r(1009, Ke), r(25, uu);
      }, "init");
      zi.exports = { init: lu };
    });
    Zi = T((Sf, Yi) => {
      p();
      Yi.exports = {
        BOOL: 16,
        BYTEA: 17,
        CHAR: 18,
        INT8: 20,
        INT2: 21,
        INT4: 23,
        REGPROC: 24,
        TEXT: 25,
        OID: 26,
        TID: 27,
        XID: 28,
        CID: 29,
        JSON: 114,
        XML: 142,
        PG_NODE_TREE: 194,
        SMGR: 210,
        PATH: 602,
        POLYGON: 604,
        CIDR: 650,
        FLOAT4: 700,
        FLOAT8: 701,
        ABSTIME: 702,
        RELTIME: 703,
        TINTERVAL: 704,
        CIRCLE: 718,
        MACADDR8: 774,
        MONEY: 790,
        MACADDR: 829,
        INET: 869,
        ACLITEM: 1033,
        BPCHAR: 1042,
        VARCHAR: 1043,
        DATE: 1082,
        TIME: 1083,
        TIMESTAMP: 1114,
        TIMESTAMPTZ: 1184,
        INTERVAL: 1186,
        TIMETZ: 1266,
        BIT: 1560,
        VARBIT: 1562,
        NUMERIC: 1700,
        REFCURSOR: 1790,
        REGPROCEDURE: 2202,
        REGOPER: 2203,
        REGOPERATOR: 2204,
        REGCLASS: 2205,
        REGTYPE: 2206,
        UUID: 2950,
        TXID_SNAPSHOT: 2970,
        PG_LSN: 3220,
        PG_NDISTINCT: 3361,
        PG_DEPENDENCIES: 3402,
        TSVECTOR: 3614,
        TSQUERY: 3615,
        GTSVECTOR: 3642,
        REGCONFIG: 3734,
        REGDICTIONARY: 3769,
        JSONB: 3802,
        REGNAMESPACE: 4089,
        REGROLE: 4096
      };
    });
    Je = T((Ze) => {
      p();
      var fu = Wi(), hu = Ki(), pu = rr(), du = Zi();
      Ze.getTypeParser = yu;
      Ze.setTypeParser = mu;
      Ze.arrayParser = pu;
      Ze.builtins = du;
      var Ye = { text: {}, binary: {} };
      function Ji(r) {
        return String(r);
      }
      a(Ji, "noParse");
      function yu(r, e) {
        return e = e || "text", Ye[e] && Ye[e][r] || Ji;
      }
      a(yu, "getTypeParser");
      function mu(r, e, t) {
        typeof e == "function" && (t = e, e = "text"), Ye[e][r] = t;
      }
      a(mu, "setTypeParser");
      fu.init(function(r, e) {
        Ye.text[r] = e;
      });
      hu.init(function(r, e) {
        Ye.binary[r] = e;
      });
    });
    At = T((If, Xi) => {
      "use strict";
      p();
      var wu = Je();
      function Et(r) {
        this._types = r || wu, this.text = {}, this.binary = {};
      }
      a(Et, "TypeOverrides");
      Et.prototype.getOverrides = function(r) {
        switch (r) {
          case "text":
            return this.text;
          case "binary":
            return this.binary;
          default:
            return {};
        }
      };
      Et.prototype.setTypeParser = function(r, e, t) {
        typeof e == "function" && (t = e, e = "text"), this.getOverrides(e)[r] = t;
      };
      Et.prototype.getTypeParser = function(r, e) {
        return e = e || "text", this.getOverrides(e)[r] || this._types.getTypeParser(r, e);
      };
      Xi.exports = Et;
    });
    es = G(() => {
      "use strict";
      p();
      a(Xe, "sha256");
    });
    ts = G(() => {
      "use strict";
      p();
      U = class U2 {
        constructor() {
          E(this, "_dataLength", 0);
          E(this, "_bufferLength", 0);
          E(this, "_state", new Int32Array(4));
          E(this, "_buffer", new ArrayBuffer(68));
          E(this, "_buffer8");
          E(this, "_buffer32");
          this._buffer8 = new Uint8Array(this._buffer, 0, 68), this._buffer32 = new Uint32Array(this._buffer, 0, 17), this.start();
        }
        static hashByteArray(e, t = false) {
          return this.onePassHasher.start().appendByteArray(
            e
          ).end(t);
        }
        static hashStr(e, t = false) {
          return this.onePassHasher.start().appendStr(e).end(t);
        }
        static hashAsciiStr(e, t = false) {
          return this.onePassHasher.start().appendAsciiStr(e).end(t);
        }
        static _hex(e) {
          let t = U2.hexChars, n = U2.hexOut, i, s, o, u;
          for (u = 0; u < 4; u += 1) for (s = u * 8, i = e[u], o = 0; o < 8; o += 2) n[s + 1 + o] = t.charAt(i & 15), i >>>= 4, n[s + 0 + o] = t.charAt(
            i & 15
          ), i >>>= 4;
          return n.join("");
        }
        static _md5cycle(e, t) {
          let n = e[0], i = e[1], s = e[2], o = e[3];
          n += (i & s | ~i & o) + t[0] - 680876936 | 0, n = (n << 7 | n >>> 25) + i | 0, o += (n & i | ~n & s) + t[1] - 389564586 | 0, o = (o << 12 | o >>> 20) + n | 0, s += (o & n | ~o & i) + t[2] + 606105819 | 0, s = (s << 17 | s >>> 15) + o | 0, i += (s & o | ~s & n) + t[3] - 1044525330 | 0, i = (i << 22 | i >>> 10) + s | 0, n += (i & s | ~i & o) + t[4] - 176418897 | 0, n = (n << 7 | n >>> 25) + i | 0, o += (n & i | ~n & s) + t[5] + 1200080426 | 0, o = (o << 12 | o >>> 20) + n | 0, s += (o & n | ~o & i) + t[6] - 1473231341 | 0, s = (s << 17 | s >>> 15) + o | 0, i += (s & o | ~s & n) + t[7] - 45705983 | 0, i = (i << 22 | i >>> 10) + s | 0, n += (i & s | ~i & o) + t[8] + 1770035416 | 0, n = (n << 7 | n >>> 25) + i | 0, o += (n & i | ~n & s) + t[9] - 1958414417 | 0, o = (o << 12 | o >>> 20) + n | 0, s += (o & n | ~o & i) + t[10] - 42063 | 0, s = (s << 17 | s >>> 15) + o | 0, i += (s & o | ~s & n) + t[11] - 1990404162 | 0, i = (i << 22 | i >>> 10) + s | 0, n += (i & s | ~i & o) + t[12] + 1804603682 | 0, n = (n << 7 | n >>> 25) + i | 0, o += (n & i | ~n & s) + t[13] - 40341101 | 0, o = (o << 12 | o >>> 20) + n | 0, s += (o & n | ~o & i) + t[14] - 1502002290 | 0, s = (s << 17 | s >>> 15) + o | 0, i += (s & o | ~s & n) + t[15] + 1236535329 | 0, i = (i << 22 | i >>> 10) + s | 0, n += (i & o | s & ~o) + t[1] - 165796510 | 0, n = (n << 5 | n >>> 27) + i | 0, o += (n & s | i & ~s) + t[6] - 1069501632 | 0, o = (o << 9 | o >>> 23) + n | 0, s += (o & i | n & ~i) + t[11] + 643717713 | 0, s = (s << 14 | s >>> 18) + o | 0, i += (s & n | o & ~n) + t[0] - 373897302 | 0, i = (i << 20 | i >>> 12) + s | 0, n += (i & o | s & ~o) + t[5] - 701558691 | 0, n = (n << 5 | n >>> 27) + i | 0, o += (n & s | i & ~s) + t[10] + 38016083 | 0, o = (o << 9 | o >>> 23) + n | 0, s += (o & i | n & ~i) + t[15] - 660478335 | 0, s = (s << 14 | s >>> 18) + o | 0, i += (s & n | o & ~n) + t[4] - 405537848 | 0, i = (i << 20 | i >>> 12) + s | 0, n += (i & o | s & ~o) + t[9] + 568446438 | 0, n = (n << 5 | n >>> 27) + i | 0, o += (n & s | i & ~s) + t[14] - 1019803690 | 0, o = (o << 9 | o >>> 23) + n | 0, s += (o & i | n & ~i) + t[3] - 187363961 | 0, s = (s << 14 | s >>> 18) + o | 0, i += (s & n | o & ~n) + t[8] + 1163531501 | 0, i = (i << 20 | i >>> 12) + s | 0, n += (i & o | s & ~o) + t[13] - 1444681467 | 0, n = (n << 5 | n >>> 27) + i | 0, o += (n & s | i & ~s) + t[2] - 51403784 | 0, o = (o << 9 | o >>> 23) + n | 0, s += (o & i | n & ~i) + t[7] + 1735328473 | 0, s = (s << 14 | s >>> 18) + o | 0, i += (s & n | o & ~n) + t[12] - 1926607734 | 0, i = (i << 20 | i >>> 12) + s | 0, n += (i ^ s ^ o) + t[5] - 378558 | 0, n = (n << 4 | n >>> 28) + i | 0, o += (n ^ i ^ s) + t[8] - 2022574463 | 0, o = (o << 11 | o >>> 21) + n | 0, s += (o ^ n ^ i) + t[11] + 1839030562 | 0, s = (s << 16 | s >>> 16) + o | 0, i += (s ^ o ^ n) + t[14] - 35309556 | 0, i = (i << 23 | i >>> 9) + s | 0, n += (i ^ s ^ o) + t[1] - 1530992060 | 0, n = (n << 4 | n >>> 28) + i | 0, o += (n ^ i ^ s) + t[4] + 1272893353 | 0, o = (o << 11 | o >>> 21) + n | 0, s += (o ^ n ^ i) + t[7] - 155497632 | 0, s = (s << 16 | s >>> 16) + o | 0, i += (s ^ o ^ n) + t[10] - 1094730640 | 0, i = (i << 23 | i >>> 9) + s | 0, n += (i ^ s ^ o) + t[13] + 681279174 | 0, n = (n << 4 | n >>> 28) + i | 0, o += (n ^ i ^ s) + t[0] - 358537222 | 0, o = (o << 11 | o >>> 21) + n | 0, s += (o ^ n ^ i) + t[3] - 722521979 | 0, s = (s << 16 | s >>> 16) + o | 0, i += (s ^ o ^ n) + t[6] + 76029189 | 0, i = (i << 23 | i >>> 9) + s | 0, n += (i ^ s ^ o) + t[9] - 640364487 | 0, n = (n << 4 | n >>> 28) + i | 0, o += (n ^ i ^ s) + t[12] - 421815835 | 0, o = (o << 11 | o >>> 21) + n | 0, s += (o ^ n ^ i) + t[15] + 530742520 | 0, s = (s << 16 | s >>> 16) + o | 0, i += (s ^ o ^ n) + t[2] - 995338651 | 0, i = (i << 23 | i >>> 9) + s | 0, n += (s ^ (i | ~o)) + t[0] - 198630844 | 0, n = (n << 6 | n >>> 26) + i | 0, o += (i ^ (n | ~s)) + t[7] + 1126891415 | 0, o = (o << 10 | o >>> 22) + n | 0, s += (n ^ (o | ~i)) + t[14] - 1416354905 | 0, s = (s << 15 | s >>> 17) + o | 0, i += (o ^ (s | ~n)) + t[5] - 57434055 | 0, i = (i << 21 | i >>> 11) + s | 0, n += (s ^ (i | ~o)) + t[12] + 1700485571 | 0, n = (n << 6 | n >>> 26) + i | 0, o += (i ^ (n | ~s)) + t[3] - 1894986606 | 0, o = (o << 10 | o >>> 22) + n | 0, s += (n ^ (o | ~i)) + t[10] - 1051523 | 0, s = (s << 15 | s >>> 17) + o | 0, i += (o ^ (s | ~n)) + t[1] - 2054922799 | 0, i = (i << 21 | i >>> 11) + s | 0, n += (s ^ (i | ~o)) + t[8] + 1873313359 | 0, n = (n << 6 | n >>> 26) + i | 0, o += (i ^ (n | ~s)) + t[15] - 30611744 | 0, o = (o << 10 | o >>> 22) + n | 0, s += (n ^ (o | ~i)) + t[6] - 1560198380 | 0, s = (s << 15 | s >>> 17) + o | 0, i += (o ^ (s | ~n)) + t[13] + 1309151649 | 0, i = (i << 21 | i >>> 11) + s | 0, n += (s ^ (i | ~o)) + t[4] - 145523070 | 0, n = (n << 6 | n >>> 26) + i | 0, o += (i ^ (n | ~s)) + t[11] - 1120210379 | 0, o = (o << 10 | o >>> 22) + n | 0, s += (n ^ (o | ~i)) + t[2] + 718787259 | 0, s = (s << 15 | s >>> 17) + o | 0, i += (o ^ (s | ~n)) + t[9] - 343485551 | 0, i = (i << 21 | i >>> 11) + s | 0, e[0] = n + e[0] | 0, e[1] = i + e[1] | 0, e[2] = s + e[2] | 0, e[3] = o + e[3] | 0;
        }
        start() {
          return this._dataLength = 0, this._bufferLength = 0, this._state.set(U2.stateIdentity), this;
        }
        appendStr(e) {
          let t = this._buffer8, n = this._buffer32, i = this._bufferLength, s, o;
          for (o = 0; o < e.length; o += 1) {
            if (s = e.charCodeAt(o), s < 128) t[i++] = s;
            else if (s < 2048) t[i++] = (s >>> 6) + 192, t[i++] = s & 63 | 128;
            else if (s < 55296 || s > 56319) t[i++] = (s >>> 12) + 224, t[i++] = s >>> 6 & 63 | 128, t[i++] = s & 63 | 128;
            else {
              if (s = (s - 55296) * 1024 + (e.charCodeAt(++o) - 56320) + 65536, s > 1114111) throw new Error(
                "Unicode standard supports code points up to U+10FFFF"
              );
              t[i++] = (s >>> 18) + 240, t[i++] = s >>> 12 & 63 | 128, t[i++] = s >>> 6 & 63 | 128, t[i++] = s & 63 | 128;
            }
            i >= 64 && (this._dataLength += 64, U2._md5cycle(this._state, n), i -= 64, n[0] = n[16]);
          }
          return this._bufferLength = i, this;
        }
        appendAsciiStr(e) {
          let t = this._buffer8, n = this._buffer32, i = this._bufferLength, s, o = 0;
          for (; ; ) {
            for (s = Math.min(e.length - o, 64 - i); s--; ) t[i++] = e.charCodeAt(o++);
            if (i < 64) break;
            this._dataLength += 64, U2._md5cycle(this._state, n), i = 0;
          }
          return this._bufferLength = i, this;
        }
        appendByteArray(e) {
          let t = this._buffer8, n = this._buffer32, i = this._bufferLength, s, o = 0;
          for (; ; ) {
            for (s = Math.min(e.length - o, 64 - i); s--; ) t[i++] = e[o++];
            if (i < 64) break;
            this._dataLength += 64, U2._md5cycle(this._state, n), i = 0;
          }
          return this._bufferLength = i, this;
        }
        getState() {
          let e = this._state;
          return { buffer: String.fromCharCode.apply(null, Array.from(this._buffer8)), buflen: this._bufferLength, length: this._dataLength, state: [e[0], e[1], e[2], e[3]] };
        }
        setState(e) {
          let t = e.buffer, n = e.state, i = this._state, s;
          for (this._dataLength = e.length, this._bufferLength = e.buflen, i[0] = n[0], i[1] = n[1], i[2] = n[2], i[3] = n[3], s = 0; s < t.length; s += 1) this._buffer8[s] = t.charCodeAt(s);
        }
        end(e = false) {
          let t = this._bufferLength, n = this._buffer8, i = this._buffer32, s = (t >> 2) + 1;
          this._dataLength += t;
          let o = this._dataLength * 8;
          if (n[t] = 128, n[t + 1] = n[t + 2] = n[t + 3] = 0, i.set(U2.buffer32Identity.subarray(s), s), t > 55 && (U2._md5cycle(this._state, i), i.set(U2.buffer32Identity)), o <= 4294967295) i[14] = o;
          else {
            let u = o.toString(16).match(/(.*?)(.{0,8})$/);
            if (u === null) return;
            let c = parseInt(
              u[2],
              16
            ), l = parseInt(u[1], 16) || 0;
            i[14] = c, i[15] = l;
          }
          return U2._md5cycle(this._state, i), e ? this._state : U2._hex(
            this._state
          );
        }
      };
      a(U, "Md5"), E(U, "stateIdentity", new Int32Array([1732584193, -271733879, -1732584194, 271733878])), E(U, "buffer32Identity", new Int32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), E(U, "hexChars", "0123456789abcdef"), E(U, "hexOut", []), E(U, "onePassHasher", new U());
      et = U;
    });
    lr = {};
    ie(lr, { createHash: () => bu, createHmac: () => vu, randomBytes: () => gu });
    fr = G(() => {
      "use strict";
      p();
      es();
      ts();
      a(gu, "randomBytes");
      a(bu, "createHash");
      a(vu, "createHmac");
    });
    tt = T((Qf, hr) => {
      "use strict";
      p();
      hr.exports = {
        host: "localhost",
        user: m.platform === "win32" ? m.env.USERNAME : m.env.USER,
        database: void 0,
        password: null,
        connectionString: void 0,
        port: 5432,
        rows: 0,
        binary: false,
        max: 10,
        idleTimeoutMillis: 3e4,
        client_encoding: "",
        ssl: false,
        application_name: void 0,
        fallback_application_name: void 0,
        options: void 0,
        parseInputDatesAsUTC: false,
        statement_timeout: false,
        lock_timeout: false,
        idle_in_transaction_session_timeout: false,
        query_timeout: false,
        connect_timeout: 0,
        keepalives: 1,
        keepalives_idle: 0
      };
      var Me = Je(), xu = Me.getTypeParser(20, "text"), Su = Me.getTypeParser(
        1016,
        "text"
      );
      hr.exports.__defineSetter__("parseInt8", function(r) {
        Me.setTypeParser(20, "text", r ? Me.getTypeParser(
          23,
          "text"
        ) : xu), Me.setTypeParser(1016, "text", r ? Me.getTypeParser(1007, "text") : Su);
      });
    });
    rt = T((Wf, ns) => {
      "use strict";
      p();
      var Eu = (fr(), O(lr)), Au = tt();
      function Cu(r) {
        var e = r.replace(
          /\\/g,
          "\\\\"
        ).replace(/"/g, '\\"');
        return '"' + e + '"';
      }
      a(Cu, "escapeElement");
      function rs(r) {
        for (var e = "{", t = 0; t < r.length; t++) t > 0 && (e = e + ","), r[t] === null || typeof r[t] > "u" ? e = e + "NULL" : Array.isArray(r[t]) ? e = e + rs(r[t]) : r[t] instanceof d ? e += "\\\\x" + r[t].toString("hex") : e += Cu(Ct(r[t]));
        return e = e + "}", e;
      }
      a(rs, "arrayString");
      var Ct = a(function(r, e) {
        if (r == null) return null;
        if (r instanceof d) return r;
        if (ArrayBuffer.isView(r)) {
          var t = d.from(r.buffer, r.byteOffset, r.byteLength);
          return t.length === r.byteLength ? t : t.slice(r.byteOffset, r.byteOffset + r.byteLength);
        }
        return r instanceof Date ? Au.parseInputDatesAsUTC ? Tu(r) : Iu(r) : Array.isArray(r) ? rs(r) : typeof r == "object" ? _u(r, e) : r.toString();
      }, "prepareValue");
      function _u(r, e) {
        if (r && typeof r.toPostgres == "function") {
          if (e = e || [], e.indexOf(r) !== -1) throw new Error('circular reference detected while preparing "' + r + '" for query');
          return e.push(r), Ct(r.toPostgres(Ct), e);
        }
        return JSON.stringify(r);
      }
      a(_u, "prepareObject");
      function N(r, e) {
        for (r = "" + r; r.length < e; ) r = "0" + r;
        return r;
      }
      a(N, "pad");
      function Iu(r) {
        var e = -r.getTimezoneOffset(), t = r.getFullYear(), n = t < 1;
        n && (t = Math.abs(t) + 1);
        var i = N(t, 4) + "-" + N(r.getMonth() + 1, 2) + "-" + N(r.getDate(), 2) + "T" + N(
          r.getHours(),
          2
        ) + ":" + N(r.getMinutes(), 2) + ":" + N(r.getSeconds(), 2) + "." + N(r.getMilliseconds(), 3);
        return e < 0 ? (i += "-", e *= -1) : i += "+", i += N(Math.floor(e / 60), 2) + ":" + N(e % 60, 2), n && (i += " BC"), i;
      }
      a(Iu, "dateToString");
      function Tu(r) {
        var e = r.getUTCFullYear(), t = e < 1;
        t && (e = Math.abs(e) + 1);
        var n = N(e, 4) + "-" + N(r.getUTCMonth() + 1, 2) + "-" + N(r.getUTCDate(), 2) + "T" + N(r.getUTCHours(), 2) + ":" + N(r.getUTCMinutes(), 2) + ":" + N(r.getUTCSeconds(), 2) + "." + N(
          r.getUTCMilliseconds(),
          3
        );
        return n += "+00:00", t && (n += " BC"), n;
      }
      a(Tu, "dateToStringUTC");
      function Pu(r, e, t) {
        return r = typeof r == "string" ? { text: r } : r, e && (typeof e == "function" ? r.callback = e : r.values = e), t && (r.callback = t), r;
      }
      a(Pu, "normalizeQueryConfig");
      var pr = a(function(r) {
        return Eu.createHash("md5").update(r, "utf-8").digest("hex");
      }, "md5"), Ru = a(
        function(r, e, t) {
          var n = pr(e + r), i = pr(d.concat([d.from(n), t]));
          return "md5" + i;
        },
        "postgresMd5PasswordHash"
      );
      ns.exports = {
        prepareValue: a(function(e) {
          return Ct(e);
        }, "prepareValueWrapper"),
        normalizeQueryConfig: Pu,
        postgresMd5PasswordHash: Ru,
        md5: pr
      };
    });
    nt = {};
    ie(nt, { default: () => ku });
    it = G(() => {
      "use strict";
      p();
      ku = {};
    });
    ds = T((th, ps) => {
      "use strict";
      p();
      var yr = (fr(), O(lr));
      function Mu(r) {
        if (r.indexOf("SCRAM-SHA-256") === -1) throw new Error("SASL: Only mechanism SCRAM-SHA-256 is currently supported");
        let e = yr.randomBytes(
          18
        ).toString("base64");
        return { mechanism: "SCRAM-SHA-256", clientNonce: e, response: "n,,n=*,r=" + e, message: "SASLInitialResponse" };
      }
      a(Mu, "startSession");
      function Uu(r, e, t) {
        if (r.message !== "SASLInitialResponse") throw new Error(
          "SASL: Last message was not SASLInitialResponse"
        );
        if (typeof e != "string") throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string");
        if (typeof t != "string") throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: serverData must be a string");
        let n = qu(t);
        if (n.nonce.startsWith(r.clientNonce)) {
          if (n.nonce.length === r.clientNonce.length) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce is too short");
        } else throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce does not start with client nonce");
        var i = d.from(n.salt, "base64"), s = Wu(e, i, n.iteration), o = Ue(s, "Client Key"), u = Nu(
          o
        ), c = "n=*,r=" + r.clientNonce, l = "r=" + n.nonce + ",s=" + n.salt + ",i=" + n.iteration, f = "c=biws,r=" + n.nonce, y = c + "," + l + "," + f, g = Ue(u, y), A = hs(o, g), C = A.toString("base64"), D = Ue(s, "Server Key"), Y = Ue(D, y);
        r.message = "SASLResponse", r.serverSignature = Y.toString("base64"), r.response = f + ",p=" + C;
      }
      a(Uu, "continueSession");
      function Du(r, e) {
        if (r.message !== "SASLResponse") throw new Error("SASL: Last message was not SASLResponse");
        if (typeof e != "string") throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: serverData must be a string");
        let { serverSignature: t } = Qu(
          e
        );
        if (t !== r.serverSignature) throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match");
      }
      a(Du, "finalizeSession");
      function Ou(r) {
        if (typeof r != "string") throw new TypeError("SASL: text must be a string");
        return r.split("").map((e, t) => r.charCodeAt(t)).every((e) => e >= 33 && e <= 43 || e >= 45 && e <= 126);
      }
      a(Ou, "isPrintableChars");
      function ls(r) {
        return /^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/.test(r);
      }
      a(ls, "isBase64");
      function fs2(r) {
        if (typeof r != "string") throw new TypeError("SASL: attribute pairs text must be a string");
        return new Map(r.split(",").map((e) => {
          if (!/^.=/.test(e)) throw new Error("SASL: Invalid attribute pair entry");
          let t = e[0], n = e.substring(2);
          return [t, n];
        }));
      }
      a(fs2, "parseAttributePairs");
      function qu(r) {
        let e = fs2(r), t = e.get("r");
        if (t) {
          if (!Ou(t)) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce must only contain printable characters");
        } else throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce missing");
        let n = e.get("s");
        if (n) {
          if (!ls(n)) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt must be base64");
        } else throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt missing");
        let i = e.get("i");
        if (i) {
          if (!/^[1-9][0-9]*$/.test(i)) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: invalid iteration count");
        } else throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration missing");
        let s = parseInt(i, 10);
        return { nonce: t, salt: n, iteration: s };
      }
      a(qu, "parseServerFirstMessage");
      function Qu(r) {
        let t = fs2(r).get("v");
        if (t) {
          if (!ls(t)) throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature must be base64");
        } else throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing");
        return { serverSignature: t };
      }
      a(Qu, "parseServerFinalMessage");
      function hs(r, e) {
        if (!d.isBuffer(r)) throw new TypeError("first argument must be a Buffer");
        if (!d.isBuffer(e)) throw new TypeError(
          "second argument must be a Buffer"
        );
        if (r.length !== e.length) throw new Error("Buffer lengths must match");
        if (r.length === 0) throw new Error("Buffers cannot be empty");
        return d.from(r.map((t, n) => r[n] ^ e[n]));
      }
      a(hs, "xorBuffers");
      function Nu(r) {
        return yr.createHash("sha256").update(r).digest();
      }
      a(Nu, "sha256");
      function Ue(r, e) {
        return yr.createHmac("sha256", r).update(e).digest();
      }
      a(Ue, "hmacSha256");
      function Wu(r, e, t) {
        for (var n = Ue(
          r,
          d.concat([e, d.from([0, 0, 0, 1])])
        ), i = n, s = 0; s < t - 1; s++) n = Ue(r, n), i = hs(i, n);
        return i;
      }
      a(Wu, "Hi");
      ps.exports = { startSession: Mu, continueSession: Uu, finalizeSession: Du };
    });
    mr = {};
    ie(mr, { join: () => ju });
    wr = G(() => {
      "use strict";
      p();
      a(
        ju,
        "join"
      );
    });
    gr = {};
    ie(gr, { stat: () => Hu });
    br = G(() => {
      "use strict";
      p();
      a(Hu, "stat");
    });
    vr = {};
    ie(vr, { default: () => $u });
    xr = G(() => {
      "use strict";
      p();
      $u = {};
    });
    ys = {};
    ie(ys, { StringDecoder: () => Sr });
    ms = G(() => {
      "use strict";
      p();
      Er = class Er {
        constructor(e) {
          E(this, "td");
          this.td = new TextDecoder(e);
        }
        write(e) {
          return this.td.decode(e, { stream: true });
        }
        end(e) {
          return this.td.decode(e);
        }
      };
      a(Er, "StringDecoder");
      Sr = Er;
    });
    vs = T((fh, bs) => {
      "use strict";
      p();
      var { Transform: Gu } = (xr(), O(vr)), { StringDecoder: Vu } = (ms(), O(ys)), ve = /* @__PURE__ */ Symbol(
        "last"
      ), It = /* @__PURE__ */ Symbol("decoder");
      function zu(r, e, t) {
        let n;
        if (this.overflow) {
          if (n = this[It].write(r).split(
            this.matcher
          ), n.length === 1) return t();
          n.shift(), this.overflow = false;
        } else this[ve] += this[It].write(r), n = this[ve].split(this.matcher);
        this[ve] = n.pop();
        for (let i = 0; i < n.length; i++) try {
          gs(this, this.mapper(n[i]));
        } catch (s) {
          return t(s);
        }
        if (this.overflow = this[ve].length > this.maxLength, this.overflow && !this.skipOverflow) {
          t(new Error(
            "maximum buffer reached"
          ));
          return;
        }
        t();
      }
      a(zu, "transform");
      function Ku(r) {
        if (this[ve] += this[It].end(), this[ve])
          try {
            gs(this, this.mapper(this[ve]));
          } catch (e) {
            return r(e);
          }
        r();
      }
      a(Ku, "flush");
      function gs(r, e) {
        e !== void 0 && r.push(e);
      }
      a(gs, "push");
      function ws(r) {
        return r;
      }
      a(ws, "noop");
      function Yu(r, e, t) {
        switch (r = r || /\r?\n/, e = e || ws, t = t || {}, arguments.length) {
          case 1:
            typeof r == "function" ? (e = r, r = /\r?\n/) : typeof r == "object" && !(r instanceof RegExp) && !r[Symbol.split] && (t = r, r = /\r?\n/);
            break;
          case 2:
            typeof r == "function" ? (t = e, e = r, r = /\r?\n/) : typeof e == "object" && (t = e, e = ws);
        }
        t = Object.assign({}, t), t.autoDestroy = true, t.transform = zu, t.flush = Ku, t.readableObjectMode = true;
        let n = new Gu(t);
        return n[ve] = "", n[It] = new Vu("utf8"), n.matcher = r, n.mapper = e, n.maxLength = t.maxLength, n.skipOverflow = t.skipOverflow || false, n.overflow = false, n._destroy = function(i, s) {
          this._writableState.errorEmitted = false, s(i);
        }, n;
      }
      a(Yu, "split");
      bs.exports = Yu;
    });
    Es = T((dh, pe) => {
      "use strict";
      p();
      var xs = (wr(), O(mr)), Zu = (xr(), O(vr)).Stream, Ju = vs(), Ss = (it(), O(nt)), Xu = 5432, Tt = m.platform === "win32", st = m.stderr, ec = 56, tc = 7, rc = 61440, nc = 32768;
      function ic(r) {
        return (r & rc) == nc;
      }
      a(ic, "isRegFile");
      var De = ["host", "port", "database", "user", "password"], Ar = De.length, sc = De[Ar - 1];
      function Cr() {
        var r = st instanceof Zu && st.writable === true;
        if (r) {
          var e = Array.prototype.slice.call(arguments).concat(`
`);
          st.write(Ss.format.apply(Ss, e));
        }
      }
      a(Cr, "warn");
      Object.defineProperty(pe.exports, "isWin", { get: a(function() {
        return Tt;
      }, "get"), set: a(function(r) {
        Tt = r;
      }, "set") });
      pe.exports.warnTo = function(r) {
        var e = st;
        return st = r, e;
      };
      pe.exports.getFileName = function(r) {
        var e = r || m.env, t = e.PGPASSFILE || (Tt ? xs.join(e.APPDATA || "./", "postgresql", "pgpass.conf") : xs.join(e.HOME || "./", ".pgpass"));
        return t;
      };
      pe.exports.usePgPass = function(r, e) {
        return Object.prototype.hasOwnProperty.call(m.env, "PGPASSWORD") ? false : Tt ? true : (e = e || "<unkn>", ic(r.mode) ? r.mode & (ec | tc) ? (Cr('WARNING: password file "%s" has group or world access; permissions should be u=rw (0600) or less', e), false) : true : (Cr('WARNING: password file "%s" is not a plain file', e), false));
      };
      var oc = pe.exports.match = function(r, e) {
        return De.slice(0, -1).reduce(function(t, n, i) {
          return i == 1 && Number(r[n] || Xu) === Number(
            e[n]
          ) ? t && true : t && (e[n] === "*" || e[n] === r[n]);
        }, true);
      };
      pe.exports.getPassword = function(r, e, t) {
        var n, i = e.pipe(
          Ju()
        );
        function s(c) {
          var l = ac(c);
          l && uc(l) && oc(r, l) && (n = l[sc], i.end());
        }
        a(s, "onLine");
        var o = a(function() {
          e.destroy(), t(n);
        }, "onEnd"), u = a(function(c) {
          e.destroy(), Cr("WARNING: error on reading file: %s", c), t(
            void 0
          );
        }, "onErr");
        e.on("error", u), i.on("data", s).on("end", o).on("error", u);
      };
      var ac = pe.exports.parseLine = function(r) {
        if (r.length < 11 || r.match(/^\s+#/)) return null;
        for (var e = "", t = "", n = 0, i = 0, s = 0, o = {}, u = false, c = a(
          function(f, y, g) {
            var A = r.substring(y, g);
            Object.hasOwnProperty.call(m.env, "PGPASS_NO_DEESCAPE") || (A = A.replace(/\\([:\\])/g, "$1")), o[De[f]] = A;
          },
          "addToObj"
        ), l = 0; l < r.length - 1; l += 1) {
          if (e = r.charAt(l + 1), t = r.charAt(
            l
          ), u = n == Ar - 1, u) {
            c(n, i);
            break;
          }
          l >= 0 && e == ":" && t !== "\\" && (c(n, i, l + 1), i = l + 2, n += 1);
        }
        return o = Object.keys(o).length === Ar ? o : null, o;
      }, uc = pe.exports.isValidEntry = function(r) {
        for (var e = { 0: function(o) {
          return o.length > 0;
        }, 1: function(o) {
          return o === "*" ? true : (o = Number(o), isFinite(o) && o > 0 && o < 9007199254740992 && Math.floor(o) === o);
        }, 2: function(o) {
          return o.length > 0;
        }, 3: function(o) {
          return o.length > 0;
        }, 4: function(o) {
          return o.length > 0;
        } }, t = 0; t < De.length; t += 1) {
          var n = e[t], i = r[De[t]] || "", s = n(i);
          if (!s) return false;
        }
        return true;
      };
    });
    Cs = T((gh, _r) => {
      "use strict";
      p();
      var wh = (wr(), O(mr)), As = (br(), O(gr)), Pt = Es();
      _r.exports = function(r, e) {
        var t = Pt.getFileName();
        As.stat(t, function(n, i) {
          if (n || !Pt.usePgPass(i, t)) return e(void 0);
          var s = As.createReadStream(
            t
          );
          Pt.getPassword(r, s, e);
        });
      };
      _r.exports.warnTo = Pt.warnTo;
    });
    _s = {};
    ie(_s, { default: () => cc });
    Is = G(() => {
      "use strict";
      p();
      cc = {};
    });
    Ps = T((xh, Ts) => {
      "use strict";
      p();
      var lc = (Zt(), O(gi)), Ir = (br(), O(gr));
      function Tr(r) {
        if (r.charAt(0) === "/") {
          var t = r.split(" ");
          return { host: t[0], database: t[1] };
        }
        var e = lc.parse(/ |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i.test(r) ? encodeURI(r).replace(/\%25(\d\d)/g, "%$1") : r, true), t = e.query;
        for (var n in t) Array.isArray(t[n]) && (t[n] = t[n][t[n].length - 1]);
        var i = (e.auth || ":").split(":");
        if (t.user = i[0], t.password = i.splice(1).join(
          ":"
        ), t.port = e.port, e.protocol == "socket:") return t.host = decodeURI(e.pathname), t.database = e.query.db, t.client_encoding = e.query.encoding, t;
        t.host || (t.host = e.hostname);
        var s = e.pathname;
        if (!t.host && s && /^%2f/i.test(s)) {
          var o = s.split("/");
          t.host = decodeURIComponent(o[0]), s = o.splice(1).join("/");
        }
        switch (s && s.charAt(
          0
        ) === "/" && (s = s.slice(1) || null), t.database = s && decodeURI(s), (t.ssl === "true" || t.ssl === "1") && (t.ssl = true), t.ssl === "0" && (t.ssl = false), (t.sslcert || t.sslkey || t.sslrootcert || t.sslmode) && (t.ssl = {}), t.sslcert && (t.ssl.cert = Ir.readFileSync(t.sslcert).toString()), t.sslkey && (t.ssl.key = Ir.readFileSync(t.sslkey).toString()), t.sslrootcert && (t.ssl.ca = Ir.readFileSync(t.sslrootcert).toString()), t.sslmode) {
          case "disable": {
            t.ssl = false;
            break;
          }
          case "prefer":
          case "require":
          case "verify-ca":
          case "verify-full":
            break;
          case "no-verify": {
            t.ssl.rejectUnauthorized = false;
            break;
          }
        }
        return t;
      }
      a(Tr, "parse");
      Ts.exports = Tr;
      Tr.parse = Tr;
    });
    Rt = T((Ah, Ls) => {
      "use strict";
      p();
      var fc = (Is(), O(_s)), Bs = tt(), Rs = Ps().parse, H = a(function(r, e, t) {
        return t === void 0 ? t = m.env["PG" + r.toUpperCase()] : t === false || (t = m.env[t]), e[r] || t || Bs[r];
      }, "val"), hc = a(function() {
        switch (m.env.PGSSLMODE) {
          case "disable":
            return false;
          case "prefer":
          case "require":
          case "verify-ca":
          case "verify-full":
            return true;
          case "no-verify":
            return { rejectUnauthorized: false };
        }
        return Bs.ssl;
      }, "readSSLConfigFromEnvironment"), Oe = a(function(r) {
        return "'" + ("" + r).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
      }, "quoteParamValue"), ne = a(function(r, e, t) {
        var n = e[t];
        n != null && r.push(t + "=" + Oe(n));
      }, "add"), Rr = class Rr {
        constructor(e) {
          e = typeof e == "string" ? Rs(e) : e || {}, e.connectionString && (e = Object.assign({}, e, Rs(e.connectionString))), this.user = H("user", e), this.database = H("database", e), this.database === void 0 && (this.database = this.user), this.port = parseInt(H("port", e), 10), this.host = H("host", e), Object.defineProperty(this, "password", {
            configurable: true,
            enumerable: false,
            writable: true,
            value: H("password", e)
          }), this.binary = H("binary", e), this.options = H("options", e), this.ssl = typeof e.ssl > "u" ? hc() : e.ssl, typeof this.ssl == "string" && this.ssl === "true" && (this.ssl = true), this.ssl === "no-verify" && (this.ssl = { rejectUnauthorized: false }), this.ssl && this.ssl.key && Object.defineProperty(this.ssl, "key", { enumerable: false }), this.client_encoding = H("client_encoding", e), this.replication = H("replication", e), this.isDomainSocket = !(this.host || "").indexOf("/"), this.application_name = H("application_name", e, "PGAPPNAME"), this.fallback_application_name = H("fallback_application_name", e, false), this.statement_timeout = H("statement_timeout", e, false), this.lock_timeout = H("lock_timeout", e, false), this.idle_in_transaction_session_timeout = H("idle_in_transaction_session_timeout", e, false), this.query_timeout = H("query_timeout", e, false), e.connectionTimeoutMillis === void 0 ? this.connect_timeout = m.env.PGCONNECT_TIMEOUT || 0 : this.connect_timeout = Math.floor(e.connectionTimeoutMillis / 1e3), e.keepAlive === false ? this.keepalives = 0 : e.keepAlive === true && (this.keepalives = 1), typeof e.keepAliveInitialDelayMillis == "number" && (this.keepalives_idle = Math.floor(e.keepAliveInitialDelayMillis / 1e3));
        }
        getLibpqConnectionString(e) {
          var t = [];
          ne(t, this, "user"), ne(t, this, "password"), ne(t, this, "port"), ne(t, this, "application_name"), ne(
            t,
            this,
            "fallback_application_name"
          ), ne(t, this, "connect_timeout"), ne(t, this, "options");
          var n = typeof this.ssl == "object" ? this.ssl : this.ssl ? { sslmode: this.ssl } : {};
          if (ne(t, n, "sslmode"), ne(t, n, "sslca"), ne(t, n, "sslkey"), ne(t, n, "sslcert"), ne(t, n, "sslrootcert"), this.database && t.push("dbname=" + Oe(this.database)), this.replication && t.push("replication=" + Oe(this.replication)), this.host && t.push("host=" + Oe(this.host)), this.isDomainSocket) return e(null, t.join(" "));
          this.client_encoding && t.push("client_encoding=" + Oe(this.client_encoding)), fc.lookup(this.host, function(i, s) {
            return i ? e(i, null) : (t.push("hostaddr=" + Oe(s)), e(null, t.join(" ")));
          });
        }
      };
      a(Rr, "ConnectionParameters");
      var Pr = Rr;
      Ls.exports = Pr;
    });
    Ms = T((Ih, ks) => {
      "use strict";
      p();
      var pc = Je(), Fs = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/, Lr = class Lr {
        constructor(e, t) {
          this.command = null, this.rowCount = null, this.oid = null, this.rows = [], this.fields = [], this._parsers = void 0, this._types = t, this.RowCtor = null, this.rowAsArray = e === "array", this.rowAsArray && (this.parseRow = this._parseRowAsArray);
        }
        addCommandComplete(e) {
          var t;
          e.text ? t = Fs.exec(e.text) : t = Fs.exec(e.command), t && (this.command = t[1], t[3] ? (this.oid = parseInt(
            t[2],
            10
          ), this.rowCount = parseInt(t[3], 10)) : t[2] && (this.rowCount = parseInt(t[2], 10)));
        }
        _parseRowAsArray(e) {
          for (var t = new Array(
            e.length
          ), n = 0, i = e.length; n < i; n++) {
            var s = e[n];
            s !== null ? t[n] = this._parsers[n](s) : t[n] = null;
          }
          return t;
        }
        parseRow(e) {
          for (var t = {}, n = 0, i = e.length; n < i; n++) {
            var s = e[n], o = this.fields[n].name;
            s !== null ? t[o] = this._parsers[n](
              s
            ) : t[o] = null;
          }
          return t;
        }
        addRow(e) {
          this.rows.push(e);
        }
        addFields(e) {
          this.fields = e, this.fields.length && (this._parsers = new Array(e.length));
          for (var t = 0; t < e.length; t++) {
            var n = e[t];
            this._types ? this._parsers[t] = this._types.getTypeParser(n.dataTypeID, n.format || "text") : this._parsers[t] = pc.getTypeParser(n.dataTypeID, n.format || "text");
          }
        }
      };
      a(Lr, "Result");
      var Br = Lr;
      ks.exports = Br;
    });
    qs = T((Rh, Os) => {
      "use strict";
      p();
      var { EventEmitter: dc } = ge(), Us = Ms(), Ds = rt(), kr = class kr extends dc {
        constructor(e, t, n) {
          super(), e = Ds.normalizeQueryConfig(e, t, n), this.text = e.text, this.values = e.values, this.rows = e.rows, this.types = e.types, this.name = e.name, this.binary = e.binary, this.portal = e.portal || "", this.callback = e.callback, this._rowMode = e.rowMode, m.domain && e.callback && (this.callback = m.domain.bind(e.callback)), this._result = new Us(this._rowMode, this.types), this._results = this._result, this.isPreparedStatement = false, this._canceledDueToError = false, this._promise = null;
        }
        requiresPreparation() {
          return this.name || this.rows ? true : !this.text || !this.values ? false : this.values.length > 0;
        }
        _checkForMultirow() {
          this._result.command && (Array.isArray(this._results) || (this._results = [this._result]), this._result = new Us(this._rowMode, this.types), this._results.push(this._result));
        }
        handleRowDescription(e) {
          this._checkForMultirow(), this._result.addFields(e.fields), this._accumulateRows = this.callback || !this.listeners("row").length;
        }
        handleDataRow(e) {
          let t;
          if (!this._canceledDueToError) {
            try {
              t = this._result.parseRow(
                e.fields
              );
            } catch (n) {
              this._canceledDueToError = n;
              return;
            }
            this.emit("row", t, this._result), this._accumulateRows && this._result.addRow(t);
          }
        }
        handleCommandComplete(e, t) {
          this._checkForMultirow(), this._result.addCommandComplete(
            e
          ), this.rows && t.sync();
        }
        handleEmptyQuery(e) {
          this.rows && e.sync();
        }
        handleError(e, t) {
          if (this._canceledDueToError && (e = this._canceledDueToError, this._canceledDueToError = false), this.callback) return this.callback(e);
          this.emit("error", e);
        }
        handleReadyForQuery(e) {
          if (this._canceledDueToError) return this.handleError(
            this._canceledDueToError,
            e
          );
          if (this.callback) try {
            this.callback(null, this._results);
          } catch (t) {
            m.nextTick(() => {
              throw t;
            });
          }
          this.emit(
            "end",
            this._results
          );
        }
        submit(e) {
          if (typeof this.text != "string" && typeof this.name != "string") return new Error(
            "A query must have either text or a name. Supplying neither is unsupported."
          );
          let t = e.parsedStatements[this.name];
          return this.text && t && this.text !== t ? new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`) : this.values && !Array.isArray(this.values) ? new Error("Query values must be an array") : (this.requiresPreparation() ? this.prepare(e) : e.query(this.text), null);
        }
        hasBeenParsed(e) {
          return this.name && e.parsedStatements[this.name];
        }
        handlePortalSuspended(e) {
          this._getRows(e, this.rows);
        }
        _getRows(e, t) {
          e.execute({ portal: this.portal, rows: t }), t ? e.flush() : e.sync();
        }
        prepare(e) {
          this.isPreparedStatement = true, this.hasBeenParsed(e) || e.parse({ text: this.text, name: this.name, types: this.types });
          try {
            e.bind({ portal: this.portal, statement: this.name, values: this.values, binary: this.binary, valueMapper: Ds.prepareValue });
          } catch (t) {
            this.handleError(t, e);
            return;
          }
          e.describe({ type: "P", name: this.portal || "" }), this._getRows(e, this.rows);
        }
        handleCopyInResponse(e) {
          e.sendCopyFail("No source stream defined");
        }
        handleCopyData(e, t) {
        }
      };
      a(kr, "Query");
      var Fr = kr;
      Os.exports = Fr;
    });
    ln = T((_) => {
      "use strict";
      p();
      Object.defineProperty(_, "__esModule", { value: true });
      _.NoticeMessage = _.DataRowMessage = _.CommandCompleteMessage = _.ReadyForQueryMessage = _.NotificationResponseMessage = _.BackendKeyDataMessage = _.AuthenticationMD5Password = _.ParameterStatusMessage = _.ParameterDescriptionMessage = _.RowDescriptionMessage = _.Field = _.CopyResponse = _.CopyDataMessage = _.DatabaseError = _.copyDone = _.emptyQuery = _.replicationStart = _.portalSuspended = _.noData = _.closeComplete = _.bindComplete = _.parseComplete = void 0;
      _.parseComplete = { name: "parseComplete", length: 5 };
      _.bindComplete = { name: "bindComplete", length: 5 };
      _.closeComplete = { name: "closeComplete", length: 5 };
      _.noData = { name: "noData", length: 5 };
      _.portalSuspended = { name: "portalSuspended", length: 5 };
      _.replicationStart = { name: "replicationStart", length: 4 };
      _.emptyQuery = { name: "emptyQuery", length: 4 };
      _.copyDone = { name: "copyDone", length: 4 };
      var Kr = class Kr extends Error {
        constructor(e, t, n) {
          super(e), this.length = t, this.name = n;
        }
      };
      a(Kr, "DatabaseError");
      var Mr = Kr;
      _.DatabaseError = Mr;
      var Yr = class Yr {
        constructor(e, t) {
          this.length = e, this.chunk = t, this.name = "copyData";
        }
      };
      a(Yr, "CopyDataMessage");
      var Ur = Yr;
      _.CopyDataMessage = Ur;
      var Zr = class Zr {
        constructor(e, t, n, i) {
          this.length = e, this.name = t, this.binary = n, this.columnTypes = new Array(i);
        }
      };
      a(Zr, "CopyResponse");
      var Dr = Zr;
      _.CopyResponse = Dr;
      var Jr = class Jr {
        constructor(e, t, n, i, s, o, u) {
          this.name = e, this.tableID = t, this.columnID = n, this.dataTypeID = i, this.dataTypeSize = s, this.dataTypeModifier = o, this.format = u;
        }
      };
      a(Jr, "Field");
      var Or = Jr;
      _.Field = Or;
      var Xr = class Xr {
        constructor(e, t) {
          this.length = e, this.fieldCount = t, this.name = "rowDescription", this.fields = new Array(this.fieldCount);
        }
      };
      a(Xr, "RowDescriptionMessage");
      var qr = Xr;
      _.RowDescriptionMessage = qr;
      var en = class en {
        constructor(e, t) {
          this.length = e, this.parameterCount = t, this.name = "parameterDescription", this.dataTypeIDs = new Array(this.parameterCount);
        }
      };
      a(en, "ParameterDescriptionMessage");
      var Qr = en;
      _.ParameterDescriptionMessage = Qr;
      var tn = class tn {
        constructor(e, t, n) {
          this.length = e, this.parameterName = t, this.parameterValue = n, this.name = "parameterStatus";
        }
      };
      a(tn, "ParameterStatusMessage");
      var Nr = tn;
      _.ParameterStatusMessage = Nr;
      var rn = class rn {
        constructor(e, t) {
          this.length = e, this.salt = t, this.name = "authenticationMD5Password";
        }
      };
      a(rn, "AuthenticationMD5Password");
      var Wr = rn;
      _.AuthenticationMD5Password = Wr;
      var nn = class nn {
        constructor(e, t, n) {
          this.length = e, this.processID = t, this.secretKey = n, this.name = "backendKeyData";
        }
      };
      a(nn, "BackendKeyDataMessage");
      var jr = nn;
      _.BackendKeyDataMessage = jr;
      var sn = class sn {
        constructor(e, t, n, i) {
          this.length = e, this.processId = t, this.channel = n, this.payload = i, this.name = "notification";
        }
      };
      a(sn, "NotificationResponseMessage");
      var Hr = sn;
      _.NotificationResponseMessage = Hr;
      var on = class on {
        constructor(e, t) {
          this.length = e, this.status = t, this.name = "readyForQuery";
        }
      };
      a(on, "ReadyForQueryMessage");
      var $r = on;
      _.ReadyForQueryMessage = $r;
      var an = class an {
        constructor(e, t) {
          this.length = e, this.text = t, this.name = "commandComplete";
        }
      };
      a(an, "CommandCompleteMessage");
      var Gr = an;
      _.CommandCompleteMessage = Gr;
      var un = class un {
        constructor(e, t) {
          this.length = e, this.fields = t, this.name = "dataRow", this.fieldCount = t.length;
        }
      };
      a(un, "DataRowMessage");
      var Vr = un;
      _.DataRowMessage = Vr;
      var cn = class cn {
        constructor(e, t) {
          this.length = e, this.message = t, this.name = "notice";
        }
      };
      a(cn, "NoticeMessage");
      var zr = cn;
      _.NoticeMessage = zr;
    });
    Qs = T((Bt) => {
      "use strict";
      p();
      Object.defineProperty(Bt, "__esModule", { value: true });
      Bt.Writer = void 0;
      var hn = class hn {
        constructor(e = 256) {
          this.size = e, this.offset = 5, this.headerPosition = 0, this.buffer = d.allocUnsafe(e);
        }
        ensure(e) {
          if (this.buffer.length - this.offset < e) {
            let n = this.buffer, i = n.length + (n.length >> 1) + e;
            this.buffer = d.allocUnsafe(i), n.copy(
              this.buffer
            );
          }
        }
        addInt32(e) {
          return this.ensure(4), this.buffer[this.offset++] = e >>> 24 & 255, this.buffer[this.offset++] = e >>> 16 & 255, this.buffer[this.offset++] = e >>> 8 & 255, this.buffer[this.offset++] = e >>> 0 & 255, this;
        }
        addInt16(e) {
          return this.ensure(2), this.buffer[this.offset++] = e >>> 8 & 255, this.buffer[this.offset++] = e >>> 0 & 255, this;
        }
        addCString(e) {
          if (!e) this.ensure(1);
          else {
            let t = d.byteLength(e);
            this.ensure(t + 1), this.buffer.write(e, this.offset, "utf-8"), this.offset += t;
          }
          return this.buffer[this.offset++] = 0, this;
        }
        addString(e = "") {
          let t = d.byteLength(e);
          return this.ensure(t), this.buffer.write(e, this.offset), this.offset += t, this;
        }
        add(e) {
          return this.ensure(
            e.length
          ), e.copy(this.buffer, this.offset), this.offset += e.length, this;
        }
        join(e) {
          if (e) {
            this.buffer[this.headerPosition] = e;
            let t = this.offset - (this.headerPosition + 1);
            this.buffer.writeInt32BE(t, this.headerPosition + 1);
          }
          return this.buffer.slice(e ? 0 : 5, this.offset);
        }
        flush(e) {
          let t = this.join(e);
          return this.offset = 5, this.headerPosition = 0, this.buffer = d.allocUnsafe(this.size), t;
        }
      };
      a(hn, "Writer");
      var fn = hn;
      Bt.Writer = fn;
    });
    Ws = T((Ft) => {
      "use strict";
      p();
      Object.defineProperty(Ft, "__esModule", { value: true });
      Ft.serialize = void 0;
      var pn = Qs(), F = new pn.Writer(), yc = a((r) => {
        F.addInt16(3).addInt16(0);
        for (let n of Object.keys(r)) F.addCString(
          n
        ).addCString(r[n]);
        F.addCString("client_encoding").addCString("UTF8");
        let e = F.addCString("").flush(), t = e.length + 4;
        return new pn.Writer().addInt32(t).add(e).flush();
      }, "startup"), mc = a(() => {
        let r = d.allocUnsafe(
          8
        );
        return r.writeInt32BE(8, 0), r.writeInt32BE(80877103, 4), r;
      }, "requestSsl"), wc = a((r) => F.addCString(r).flush(
        112
      ), "password"), gc = a(function(r, e) {
        return F.addCString(r).addInt32(d.byteLength(e)).addString(e), F.flush(112);
      }, "sendSASLInitialResponseMessage"), bc = a(function(r) {
        return F.addString(r).flush(112);
      }, "sendSCRAMClientFinalMessage"), vc = a((r) => F.addCString(r).flush(81), "query"), Ns = [], xc = a((r) => {
        let e = r.name || "";
        e.length > 63 && (console.error("Warning! Postgres only supports 63 characters for query names."), console.error("You supplied %s (%s)", e, e.length), console.error("This can cause conflicts and silent errors executing queries"));
        let t = r.types || Ns, n = t.length, i = F.addCString(e).addCString(r.text).addInt16(n);
        for (let s = 0; s < n; s++) i.addInt32(t[s]);
        return F.flush(80);
      }, "parse"), qe = new pn.Writer(), Sc = a(function(r, e) {
        for (let t = 0; t < r.length; t++) {
          let n = e ? e(r[t], t) : r[t];
          n == null ? (F.addInt16(0), qe.addInt32(-1)) : n instanceof d ? (F.addInt16(
            1
          ), qe.addInt32(n.length), qe.add(n)) : (F.addInt16(0), qe.addInt32(d.byteLength(n)), qe.addString(n));
        }
      }, "writeValues"), Ec = a((r = {}) => {
        let e = r.portal || "", t = r.statement || "", n = r.binary || false, i = r.values || Ns, s = i.length;
        return F.addCString(e).addCString(t), F.addInt16(s), Sc(i, r.valueMapper), F.addInt16(s), F.add(qe.flush()), F.addInt16(n ? 1 : 0), F.flush(66);
      }, "bind"), Ac = d.from([69, 0, 0, 0, 9, 0, 0, 0, 0, 0]), Cc = a((r) => {
        if (!r || !r.portal && !r.rows) return Ac;
        let e = r.portal || "", t = r.rows || 0, n = d.byteLength(e), i = 4 + n + 1 + 4, s = d.allocUnsafe(1 + i);
        return s[0] = 69, s.writeInt32BE(i, 1), s.write(e, 5, "utf-8"), s[n + 5] = 0, s.writeUInt32BE(t, s.length - 4), s;
      }, "execute"), _c = a(
        (r, e) => {
          let t = d.allocUnsafe(16);
          return t.writeInt32BE(16, 0), t.writeInt16BE(1234, 4), t.writeInt16BE(
            5678,
            6
          ), t.writeInt32BE(r, 8), t.writeInt32BE(e, 12), t;
        },
        "cancel"
      ), dn = a((r, e) => {
        let n = 4 + d.byteLength(e) + 1, i = d.allocUnsafe(1 + n);
        return i[0] = r, i.writeInt32BE(n, 1), i.write(e, 5, "utf-8"), i[n] = 0, i;
      }, "cstringMessage"), Ic = F.addCString("P").flush(68), Tc = F.addCString("S").flush(68), Pc = a((r) => r.name ? dn(68, `${r.type}${r.name || ""}`) : r.type === "P" ? Ic : Tc, "describe"), Rc = a((r) => {
        let e = `${r.type}${r.name || ""}`;
        return dn(67, e);
      }, "close"), Bc = a((r) => F.add(r).flush(100), "copyData"), Lc = a((r) => dn(102, r), "copyFail"), Lt = a((r) => d.from([r, 0, 0, 0, 4]), "codeOnlyBuffer"), Fc = Lt(72), kc = Lt(83), Mc = Lt(88), Uc = Lt(99), Dc = {
        startup: yc,
        password: wc,
        requestSsl: mc,
        sendSASLInitialResponseMessage: gc,
        sendSCRAMClientFinalMessage: bc,
        query: vc,
        parse: xc,
        bind: Ec,
        execute: Cc,
        describe: Pc,
        close: Rc,
        flush: a(
          () => Fc,
          "flush"
        ),
        sync: a(() => kc, "sync"),
        end: a(() => Mc, "end"),
        copyData: Bc,
        copyDone: a(() => Uc, "copyDone"),
        copyFail: Lc,
        cancel: _c
      };
      Ft.serialize = Dc;
    });
    js = T((kt) => {
      "use strict";
      p();
      Object.defineProperty(kt, "__esModule", { value: true });
      kt.BufferReader = void 0;
      var Oc = d.allocUnsafe(0), mn = class mn {
        constructor(e = 0) {
          this.offset = e, this.buffer = Oc, this.encoding = "utf-8";
        }
        setBuffer(e, t) {
          this.offset = e, this.buffer = t;
        }
        int16() {
          let e = this.buffer.readInt16BE(this.offset);
          return this.offset += 2, e;
        }
        byte() {
          let e = this.buffer[this.offset];
          return this.offset++, e;
        }
        int32() {
          let e = this.buffer.readInt32BE(
            this.offset
          );
          return this.offset += 4, e;
        }
        uint32() {
          let e = this.buffer.readUInt32BE(this.offset);
          return this.offset += 4, e;
        }
        string(e) {
          let t = this.buffer.toString(this.encoding, this.offset, this.offset + e);
          return this.offset += e, t;
        }
        cstring() {
          let e = this.offset, t = e;
          for (; this.buffer[t++] !== 0; ) ;
          return this.offset = t, this.buffer.toString(this.encoding, e, t - 1);
        }
        bytes(e) {
          let t = this.buffer.slice(this.offset, this.offset + e);
          return this.offset += e, t;
        }
      };
      a(mn, "BufferReader");
      var yn = mn;
      kt.BufferReader = yn;
    });
    Gs = T((Mt) => {
      "use strict";
      p();
      Object.defineProperty(Mt, "__esModule", { value: true });
      Mt.Parser = void 0;
      var k = ln(), qc = js(), wn = 1, Qc = 4, Hs = wn + Qc, $s = d.allocUnsafe(0), bn = class bn {
        constructor(e) {
          if (this.buffer = $s, this.bufferLength = 0, this.bufferOffset = 0, this.reader = new qc.BufferReader(), e?.mode === "binary") throw new Error("Binary mode not supported yet");
          this.mode = e?.mode || "text";
        }
        parse(e, t) {
          this.mergeBuffer(e);
          let n = this.bufferOffset + this.bufferLength, i = this.bufferOffset;
          for (; i + Hs <= n; ) {
            let s = this.buffer[i], o = this.buffer.readUInt32BE(
              i + wn
            ), u = wn + o;
            if (u + i <= n) {
              let c = this.handlePacket(i + Hs, s, o, this.buffer);
              t(c), i += u;
            } else break;
          }
          i === n ? (this.buffer = $s, this.bufferLength = 0, this.bufferOffset = 0) : (this.bufferLength = n - i, this.bufferOffset = i);
        }
        mergeBuffer(e) {
          if (this.bufferLength > 0) {
            let t = this.bufferLength + e.byteLength;
            if (t + this.bufferOffset > this.buffer.byteLength) {
              let i;
              if (t <= this.buffer.byteLength && this.bufferOffset >= this.bufferLength) i = this.buffer;
              else {
                let s = this.buffer.byteLength * 2;
                for (; t >= s; ) s *= 2;
                i = d.allocUnsafe(s);
              }
              this.buffer.copy(i, 0, this.bufferOffset, this.bufferOffset + this.bufferLength), this.buffer = i, this.bufferOffset = 0;
            }
            e.copy(this.buffer, this.bufferOffset + this.bufferLength), this.bufferLength = t;
          } else this.buffer = e, this.bufferOffset = 0, this.bufferLength = e.byteLength;
        }
        handlePacket(e, t, n, i) {
          switch (t) {
            case 50:
              return k.bindComplete;
            case 49:
              return k.parseComplete;
            case 51:
              return k.closeComplete;
            case 110:
              return k.noData;
            case 115:
              return k.portalSuspended;
            case 99:
              return k.copyDone;
            case 87:
              return k.replicationStart;
            case 73:
              return k.emptyQuery;
            case 68:
              return this.parseDataRowMessage(e, n, i);
            case 67:
              return this.parseCommandCompleteMessage(
                e,
                n,
                i
              );
            case 90:
              return this.parseReadyForQueryMessage(e, n, i);
            case 65:
              return this.parseNotificationMessage(
                e,
                n,
                i
              );
            case 82:
              return this.parseAuthenticationResponse(e, n, i);
            case 83:
              return this.parseParameterStatusMessage(
                e,
                n,
                i
              );
            case 75:
              return this.parseBackendKeyData(e, n, i);
            case 69:
              return this.parseErrorMessage(e, n, i, "error");
            case 78:
              return this.parseErrorMessage(e, n, i, "notice");
            case 84:
              return this.parseRowDescriptionMessage(
                e,
                n,
                i
              );
            case 116:
              return this.parseParameterDescriptionMessage(e, n, i);
            case 71:
              return this.parseCopyInMessage(
                e,
                n,
                i
              );
            case 72:
              return this.parseCopyOutMessage(e, n, i);
            case 100:
              return this.parseCopyData(e, n, i);
            default:
              return new k.DatabaseError("received invalid response: " + t.toString(16), n, "error");
          }
        }
        parseReadyForQueryMessage(e, t, n) {
          this.reader.setBuffer(e, n);
          let i = this.reader.string(1);
          return new k.ReadyForQueryMessage(t, i);
        }
        parseCommandCompleteMessage(e, t, n) {
          this.reader.setBuffer(e, n);
          let i = this.reader.cstring();
          return new k.CommandCompleteMessage(t, i);
        }
        parseCopyData(e, t, n) {
          let i = n.slice(e, e + (t - 4));
          return new k.CopyDataMessage(t, i);
        }
        parseCopyInMessage(e, t, n) {
          return this.parseCopyMessage(
            e,
            t,
            n,
            "copyInResponse"
          );
        }
        parseCopyOutMessage(e, t, n) {
          return this.parseCopyMessage(e, t, n, "copyOutResponse");
        }
        parseCopyMessage(e, t, n, i) {
          this.reader.setBuffer(e, n);
          let s = this.reader.byte() !== 0, o = this.reader.int16(), u = new k.CopyResponse(t, i, s, o);
          for (let c = 0; c < o; c++) u.columnTypes[c] = this.reader.int16();
          return u;
        }
        parseNotificationMessage(e, t, n) {
          this.reader.setBuffer(e, n);
          let i = this.reader.int32(), s = this.reader.cstring(), o = this.reader.cstring();
          return new k.NotificationResponseMessage(t, i, s, o);
        }
        parseRowDescriptionMessage(e, t, n) {
          this.reader.setBuffer(
            e,
            n
          );
          let i = this.reader.int16(), s = new k.RowDescriptionMessage(t, i);
          for (let o = 0; o < i; o++) s.fields[o] = this.parseField();
          return s;
        }
        parseField() {
          let e = this.reader.cstring(), t = this.reader.uint32(), n = this.reader.int16(), i = this.reader.uint32(), s = this.reader.int16(), o = this.reader.int32(), u = this.reader.int16() === 0 ? "text" : "binary";
          return new k.Field(e, t, n, i, s, o, u);
        }
        parseParameterDescriptionMessage(e, t, n) {
          this.reader.setBuffer(e, n);
          let i = this.reader.int16(), s = new k.ParameterDescriptionMessage(t, i);
          for (let o = 0; o < i; o++)
            s.dataTypeIDs[o] = this.reader.int32();
          return s;
        }
        parseDataRowMessage(e, t, n) {
          this.reader.setBuffer(e, n);
          let i = this.reader.int16(), s = new Array(i);
          for (let o = 0; o < i; o++) {
            let u = this.reader.int32();
            s[o] = u === -1 ? null : this.reader.string(u);
          }
          return new k.DataRowMessage(t, s);
        }
        parseParameterStatusMessage(e, t, n) {
          this.reader.setBuffer(e, n);
          let i = this.reader.cstring(), s = this.reader.cstring();
          return new k.ParameterStatusMessage(
            t,
            i,
            s
          );
        }
        parseBackendKeyData(e, t, n) {
          this.reader.setBuffer(e, n);
          let i = this.reader.int32(), s = this.reader.int32();
          return new k.BackendKeyDataMessage(t, i, s);
        }
        parseAuthenticationResponse(e, t, n) {
          this.reader.setBuffer(
            e,
            n
          );
          let i = this.reader.int32(), s = { name: "authenticationOk", length: t };
          switch (i) {
            case 0:
              break;
            case 3:
              s.length === 8 && (s.name = "authenticationCleartextPassword");
              break;
            case 5:
              if (s.length === 12) {
                s.name = "authenticationMD5Password";
                let o = this.reader.bytes(4);
                return new k.AuthenticationMD5Password(t, o);
              }
              break;
            case 10:
              {
                s.name = "authenticationSASL", s.mechanisms = [];
                let o;
                do
                  o = this.reader.cstring(), o && s.mechanisms.push(o);
                while (o);
              }
              break;
            case 11:
              s.name = "authenticationSASLContinue", s.data = this.reader.string(t - 8);
              break;
            case 12:
              s.name = "authenticationSASLFinal", s.data = this.reader.string(t - 8);
              break;
            default:
              throw new Error("Unknown authenticationOk message type " + i);
          }
          return s;
        }
        parseErrorMessage(e, t, n, i) {
          this.reader.setBuffer(e, n);
          let s = {}, o = this.reader.string(1);
          for (; o !== "\0"; ) s[o] = this.reader.cstring(), o = this.reader.string(1);
          let u = s.M, c = i === "notice" ? new k.NoticeMessage(t, u) : new k.DatabaseError(u, t, i);
          return c.severity = s.S, c.code = s.C, c.detail = s.D, c.hint = s.H, c.position = s.P, c.internalPosition = s.p, c.internalQuery = s.q, c.where = s.W, c.schema = s.s, c.table = s.t, c.column = s.c, c.dataType = s.d, c.constraint = s.n, c.file = s.F, c.line = s.L, c.routine = s.R, c;
        }
      };
      a(bn, "Parser");
      var gn = bn;
      Mt.Parser = gn;
    });
    vn = T((xe) => {
      "use strict";
      p();
      Object.defineProperty(xe, "__esModule", { value: true });
      xe.DatabaseError = xe.serialize = xe.parse = void 0;
      var Nc = ln();
      Object.defineProperty(xe, "DatabaseError", { enumerable: true, get: a(
        function() {
          return Nc.DatabaseError;
        },
        "get"
      ) });
      var Wc = Ws();
      Object.defineProperty(xe, "serialize", {
        enumerable: true,
        get: a(function() {
          return Wc.serialize;
        }, "get")
      });
      var jc = Gs();
      function Hc(r, e) {
        let t = new jc.Parser();
        return r.on("data", (n) => t.parse(n, e)), new Promise((n) => r.on("end", () => n()));
      }
      a(Hc, "parse");
      xe.parse = Hc;
    });
    Vs = {};
    ie(Vs, { connect: () => $c });
    zs = G(
      () => {
        "use strict";
        p();
        a($c, "connect");
      }
    );
    En = T((Xh, Zs) => {
      "use strict";
      p();
      var Ks = (Fe(), O(wi)), Gc = ge().EventEmitter, { parse: Vc, serialize: Q } = vn(), Ys = Q.flush(), zc = Q.sync(), Kc = Q.end(), Sn = class Sn extends Gc {
        constructor(e) {
          super(), e = e || {}, this.stream = e.stream || new Ks.Socket(), this._keepAlive = e.keepAlive, this._keepAliveInitialDelayMillis = e.keepAliveInitialDelayMillis, this.lastBuffer = false, this.parsedStatements = {}, this.ssl = e.ssl || false, this._ending = false, this._emitMessage = false;
          var t = this;
          this.on("newListener", function(n) {
            n === "message" && (t._emitMessage = true);
          });
        }
        connect(e, t) {
          var n = this;
          this._connecting = true, this.stream.setNoDelay(true), this.stream.connect(e, t), this.stream.once("connect", function() {
            n._keepAlive && n.stream.setKeepAlive(true, n._keepAliveInitialDelayMillis), n.emit("connect");
          });
          let i = a(function(s) {
            n._ending && (s.code === "ECONNRESET" || s.code === "EPIPE") || n.emit("error", s);
          }, "reportStreamError");
          if (this.stream.on("error", i), this.stream.on("close", function() {
            n.emit("end");
          }), !this.ssl) return this.attachListeners(
            this.stream
          );
          this.stream.once("data", function(s) {
            var o = s.toString("utf8");
            switch (o) {
              case "S":
                break;
              case "N":
                return n.stream.end(), n.emit("error", new Error("The server does not support SSL connections"));
              default:
                return n.stream.end(), n.emit("error", new Error("There was an error establishing an SSL connection"));
            }
            var u = (zs(), O(Vs));
            let c = { socket: n.stream };
            n.ssl !== true && (Object.assign(c, n.ssl), "key" in n.ssl && (c.key = n.ssl.key)), Ks.isIP(t) === 0 && (c.servername = t);
            try {
              n.stream = u.connect(c);
            } catch (l) {
              return n.emit(
                "error",
                l
              );
            }
            n.attachListeners(n.stream), n.stream.on("error", i), n.emit("sslconnect");
          });
        }
        attachListeners(e) {
          e.on(
            "end",
            () => {
              this.emit("end");
            }
          ), Vc(e, (t) => {
            var n = t.name === "error" ? "errorMessage" : t.name;
            this._emitMessage && this.emit("message", t), this.emit(n, t);
          });
        }
        requestSsl() {
          this.stream.write(Q.requestSsl());
        }
        startup(e) {
          this.stream.write(Q.startup(e));
        }
        cancel(e, t) {
          this._send(Q.cancel(e, t));
        }
        password(e) {
          this._send(Q.password(e));
        }
        sendSASLInitialResponseMessage(e, t) {
          this._send(Q.sendSASLInitialResponseMessage(e, t));
        }
        sendSCRAMClientFinalMessage(e) {
          this._send(Q.sendSCRAMClientFinalMessage(
            e
          ));
        }
        _send(e) {
          return this.stream.writable ? this.stream.write(e) : false;
        }
        query(e) {
          this._send(Q.query(e));
        }
        parse(e) {
          this._send(Q.parse(e));
        }
        bind(e) {
          this._send(Q.bind(e));
        }
        execute(e) {
          this._send(Q.execute(e));
        }
        flush() {
          this.stream.writable && this.stream.write(Ys);
        }
        sync() {
          this._ending = true, this._send(Ys), this._send(zc);
        }
        ref() {
          this.stream.ref();
        }
        unref() {
          this.stream.unref();
        }
        end() {
          if (this._ending = true, !this._connecting || !this.stream.writable) {
            this.stream.end();
            return;
          }
          return this.stream.write(Kc, () => {
            this.stream.end();
          });
        }
        close(e) {
          this._send(Q.close(e));
        }
        describe(e) {
          this._send(Q.describe(e));
        }
        sendCopyFromChunk(e) {
          this._send(Q.copyData(e));
        }
        endCopyFrom() {
          this._send(Q.copyDone());
        }
        sendCopyFail(e) {
          this._send(Q.copyFail(e));
        }
      };
      a(Sn, "Connection");
      var xn = Sn;
      Zs.exports = xn;
    });
    eo = T((np, Xs) => {
      "use strict";
      p();
      var Yc = ge().EventEmitter, rp = (it(), O(nt)), Zc = rt(), An = ds(), Jc = Cs(), Xc = At(), el = Rt(), Js = qs(), tl = tt(), rl = En(), Cn = class Cn extends Yc {
        constructor(e) {
          super(), this.connectionParameters = new el(e), this.user = this.connectionParameters.user, this.database = this.connectionParameters.database, this.port = this.connectionParameters.port, this.host = this.connectionParameters.host, Object.defineProperty(
            this,
            "password",
            { configurable: true, enumerable: false, writable: true, value: this.connectionParameters.password }
          ), this.replication = this.connectionParameters.replication;
          var t = e || {};
          this._Promise = t.Promise || b2.Promise, this._types = new Xc(t.types), this._ending = false, this._connecting = false, this._connected = false, this._connectionError = false, this._queryable = true, this.connection = t.connection || new rl({ stream: t.stream, ssl: this.connectionParameters.ssl, keepAlive: t.keepAlive || false, keepAliveInitialDelayMillis: t.keepAliveInitialDelayMillis || 0, encoding: this.connectionParameters.client_encoding || "utf8" }), this.queryQueue = [], this.binary = t.binary || tl.binary, this.processID = null, this.secretKey = null, this.ssl = this.connectionParameters.ssl || false, this.ssl && this.ssl.key && Object.defineProperty(this.ssl, "key", { enumerable: false }), this._connectionTimeoutMillis = t.connectionTimeoutMillis || 0;
        }
        _errorAllQueries(e) {
          let t = a((n) => {
            m.nextTick(() => {
              n.handleError(e, this.connection);
            });
          }, "enqueueError");
          this.activeQuery && (t(this.activeQuery), this.activeQuery = null), this.queryQueue.forEach(t), this.queryQueue.length = 0;
        }
        _connect(e) {
          var t = this, n = this.connection;
          if (this._connectionCallback = e, this._connecting || this._connected) {
            let i = new Error("Client has already been connected. You cannot reuse a client.");
            m.nextTick(
              () => {
                e(i);
              }
            );
            return;
          }
          this._connecting = true, this.connectionTimeoutHandle, this._connectionTimeoutMillis > 0 && (this.connectionTimeoutHandle = setTimeout(() => {
            n._ending = true, n.stream.destroy(new Error("timeout expired"));
          }, this._connectionTimeoutMillis)), this.host && this.host.indexOf("/") === 0 ? n.connect(this.host + "/.s.PGSQL." + this.port) : n.connect(this.port, this.host), n.on("connect", function() {
            t.ssl ? n.requestSsl() : n.startup(t.getStartupConf());
          }), n.on("sslconnect", function() {
            n.startup(t.getStartupConf());
          }), this._attachListeners(
            n
          ), n.once("end", () => {
            let i = this._ending ? new Error("Connection terminated") : new Error("Connection terminated unexpectedly");
            clearTimeout(this.connectionTimeoutHandle), this._errorAllQueries(i), this._ending || (this._connecting && !this._connectionError ? this._connectionCallback ? this._connectionCallback(i) : this._handleErrorEvent(i) : this._connectionError || this._handleErrorEvent(i)), m.nextTick(() => {
              this.emit("end");
            });
          });
        }
        connect(e) {
          if (e) {
            this._connect(e);
            return;
          }
          return new this._Promise((t, n) => {
            this._connect((i) => {
              i ? n(i) : t();
            });
          });
        }
        _attachListeners(e) {
          e.on("authenticationCleartextPassword", this._handleAuthCleartextPassword.bind(this)), e.on("authenticationMD5Password", this._handleAuthMD5Password.bind(this)), e.on("authenticationSASL", this._handleAuthSASL.bind(this)), e.on("authenticationSASLContinue", this._handleAuthSASLContinue.bind(this)), e.on("authenticationSASLFinal", this._handleAuthSASLFinal.bind(this)), e.on("backendKeyData", this._handleBackendKeyData.bind(this)), e.on("error", this._handleErrorEvent.bind(this)), e.on("errorMessage", this._handleErrorMessage.bind(this)), e.on("readyForQuery", this._handleReadyForQuery.bind(this)), e.on("notice", this._handleNotice.bind(this)), e.on("rowDescription", this._handleRowDescription.bind(this)), e.on("dataRow", this._handleDataRow.bind(this)), e.on("portalSuspended", this._handlePortalSuspended.bind(
            this
          )), e.on("emptyQuery", this._handleEmptyQuery.bind(this)), e.on("commandComplete", this._handleCommandComplete.bind(this)), e.on("parseComplete", this._handleParseComplete.bind(this)), e.on("copyInResponse", this._handleCopyInResponse.bind(this)), e.on("copyData", this._handleCopyData.bind(this)), e.on("notification", this._handleNotification.bind(this));
        }
        _checkPgPass(e) {
          let t = this.connection;
          typeof this.password == "function" ? this._Promise.resolve().then(() => this.password()).then((n) => {
            if (n !== void 0) {
              if (typeof n != "string") {
                t.emit("error", new TypeError(
                  "Password must be a string"
                ));
                return;
              }
              this.connectionParameters.password = this.password = n;
            } else this.connectionParameters.password = this.password = null;
            e();
          }).catch((n) => {
            t.emit("error", n);
          }) : this.password !== null ? e() : Jc(
            this.connectionParameters,
            (n) => {
              n !== void 0 && (this.connectionParameters.password = this.password = n), e();
            }
          );
        }
        _handleAuthCleartextPassword(e) {
          this._checkPgPass(() => {
            this.connection.password(this.password);
          });
        }
        _handleAuthMD5Password(e) {
          this._checkPgPass(
            () => {
              let t = Zc.postgresMd5PasswordHash(this.user, this.password, e.salt);
              this.connection.password(t);
            }
          );
        }
        _handleAuthSASL(e) {
          this._checkPgPass(() => {
            this.saslSession = An.startSession(e.mechanisms), this.connection.sendSASLInitialResponseMessage(
              this.saslSession.mechanism,
              this.saslSession.response
            );
          });
        }
        _handleAuthSASLContinue(e) {
          An.continueSession(
            this.saslSession,
            this.password,
            e.data
          ), this.connection.sendSCRAMClientFinalMessage(this.saslSession.response);
        }
        _handleAuthSASLFinal(e) {
          An.finalizeSession(this.saslSession, e.data), this.saslSession = null;
        }
        _handleBackendKeyData(e) {
          this.processID = e.processID, this.secretKey = e.secretKey;
        }
        _handleReadyForQuery(e) {
          this._connecting && (this._connecting = false, this._connected = true, clearTimeout(this.connectionTimeoutHandle), this._connectionCallback && (this._connectionCallback(null, this), this._connectionCallback = null), this.emit("connect"));
          let { activeQuery: t } = this;
          this.activeQuery = null, this.readyForQuery = true, t && t.handleReadyForQuery(this.connection), this._pulseQueryQueue();
        }
        _handleErrorWhileConnecting(e) {
          if (!this._connectionError) {
            if (this._connectionError = true, clearTimeout(this.connectionTimeoutHandle), this._connectionCallback) return this._connectionCallback(e);
            this.emit("error", e);
          }
        }
        _handleErrorEvent(e) {
          if (this._connecting) return this._handleErrorWhileConnecting(e);
          this._queryable = false, this._errorAllQueries(e), this.emit("error", e);
        }
        _handleErrorMessage(e) {
          if (this._connecting) return this._handleErrorWhileConnecting(e);
          let t = this.activeQuery;
          if (!t) {
            this._handleErrorEvent(e);
            return;
          }
          this.activeQuery = null, t.handleError(
            e,
            this.connection
          );
        }
        _handleRowDescription(e) {
          this.activeQuery.handleRowDescription(e);
        }
        _handleDataRow(e) {
          this.activeQuery.handleDataRow(e);
        }
        _handlePortalSuspended(e) {
          this.activeQuery.handlePortalSuspended(this.connection);
        }
        _handleEmptyQuery(e) {
          this.activeQuery.handleEmptyQuery(this.connection);
        }
        _handleCommandComplete(e) {
          this.activeQuery.handleCommandComplete(e, this.connection);
        }
        _handleParseComplete(e) {
          this.activeQuery.name && (this.connection.parsedStatements[this.activeQuery.name] = this.activeQuery.text);
        }
        _handleCopyInResponse(e) {
          this.activeQuery.handleCopyInResponse(this.connection);
        }
        _handleCopyData(e) {
          this.activeQuery.handleCopyData(
            e,
            this.connection
          );
        }
        _handleNotification(e) {
          this.emit("notification", e);
        }
        _handleNotice(e) {
          this.emit("notice", e);
        }
        getStartupConf() {
          var e = this.connectionParameters, t = { user: e.user, database: e.database }, n = e.application_name || e.fallback_application_name;
          return n && (t.application_name = n), e.replication && (t.replication = "" + e.replication), e.statement_timeout && (t.statement_timeout = String(parseInt(e.statement_timeout, 10))), e.lock_timeout && (t.lock_timeout = String(parseInt(e.lock_timeout, 10))), e.idle_in_transaction_session_timeout && (t.idle_in_transaction_session_timeout = String(parseInt(e.idle_in_transaction_session_timeout, 10))), e.options && (t.options = e.options), t;
        }
        cancel(e, t) {
          if (e.activeQuery === t) {
            var n = this.connection;
            this.host && this.host.indexOf("/") === 0 ? n.connect(this.host + "/.s.PGSQL." + this.port) : n.connect(this.port, this.host), n.on("connect", function() {
              n.cancel(
                e.processID,
                e.secretKey
              );
            });
          } else e.queryQueue.indexOf(t) !== -1 && e.queryQueue.splice(e.queryQueue.indexOf(t), 1);
        }
        setTypeParser(e, t, n) {
          return this._types.setTypeParser(e, t, n);
        }
        getTypeParser(e, t) {
          return this._types.getTypeParser(e, t);
        }
        escapeIdentifier(e) {
          return '"' + e.replace(/"/g, '""') + '"';
        }
        escapeLiteral(e) {
          for (var t = false, n = "'", i = 0; i < e.length; i++) {
            var s = e[i];
            s === "'" ? n += s + s : s === "\\" ? (n += s + s, t = true) : n += s;
          }
          return n += "'", t === true && (n = " E" + n), n;
        }
        _pulseQueryQueue() {
          if (this.readyForQuery === true) if (this.activeQuery = this.queryQueue.shift(), this.activeQuery) {
            this.readyForQuery = false, this.hasExecuted = true;
            let e = this.activeQuery.submit(this.connection);
            e && m.nextTick(() => {
              this.activeQuery.handleError(e, this.connection), this.readyForQuery = true, this._pulseQueryQueue();
            });
          } else this.hasExecuted && (this.activeQuery = null, this.emit("drain"));
        }
        query(e, t, n) {
          var i, s, o, u, c;
          if (e == null) throw new TypeError(
            "Client was passed a null or undefined query"
          );
          return typeof e.submit == "function" ? (o = e.query_timeout || this.connectionParameters.query_timeout, s = i = e, typeof t == "function" && (i.callback = i.callback || t)) : (o = this.connectionParameters.query_timeout, i = new Js(e, t, n), i.callback || (s = new this._Promise((l, f) => {
            i.callback = (y, g) => y ? f(y) : l(g);
          }))), o && (c = i.callback, u = setTimeout(() => {
            var l = new Error("Query read timeout");
            m.nextTick(
              () => {
                i.handleError(l, this.connection);
              }
            ), c(l), i.callback = () => {
            };
            var f = this.queryQueue.indexOf(i);
            f > -1 && this.queryQueue.splice(f, 1), this._pulseQueryQueue();
          }, o), i.callback = (l, f) => {
            clearTimeout(u), c(l, f);
          }), this.binary && !i.binary && (i.binary = true), i._result && !i._result._types && (i._result._types = this._types), this._queryable ? this._ending ? (m.nextTick(() => {
            i.handleError(new Error("Client was closed and is not queryable"), this.connection);
          }), s) : (this.queryQueue.push(i), this._pulseQueryQueue(), s) : (m.nextTick(() => {
            i.handleError(new Error("Client has encountered a connection error and is not queryable"), this.connection);
          }), s);
        }
        ref() {
          this.connection.ref();
        }
        unref() {
          this.connection.unref();
        }
        end(e) {
          if (this._ending = true, !this.connection._connecting) if (e) e();
          else return this._Promise.resolve();
          if (this.activeQuery || !this._queryable ? this.connection.stream.destroy() : this.connection.end(), e) this.connection.once("end", e);
          else return new this._Promise((t) => {
            this.connection.once("end", t);
          });
        }
      };
      a(Cn, "Client");
      var Ut = Cn;
      Ut.Query = Js;
      Xs.exports = Ut;
    });
    io = T((op, no) => {
      "use strict";
      p();
      var nl = ge().EventEmitter, to = a(function() {
      }, "NOOP"), ro = a((r, e) => {
        let t = r.findIndex(e);
        return t === -1 ? void 0 : r.splice(t, 1)[0];
      }, "removeWhere"), Tn = class Tn {
        constructor(e, t, n) {
          this.client = e, this.idleListener = t, this.timeoutId = n;
        }
      };
      a(Tn, "IdleItem");
      var _n = Tn, Pn = class Pn {
        constructor(e) {
          this.callback = e;
        }
      };
      a(Pn, "PendingItem");
      var Qe = Pn;
      function il() {
        throw new Error("Release called on client which has already been released to the pool.");
      }
      a(il, "throwOnDoubleRelease");
      function Dt(r, e) {
        if (e)
          return { callback: e, result: void 0 };
        let t, n, i = a(function(o, u) {
          o ? t(o) : n(u);
        }, "cb"), s = new r(function(o, u) {
          n = o, t = u;
        }).catch((o) => {
          throw Error.captureStackTrace(o), o;
        });
        return { callback: i, result: s };
      }
      a(Dt, "promisify");
      function sl(r, e) {
        return a(function t(n) {
          n.client = e, e.removeListener("error", t), e.on("error", () => {
            r.log(
              "additional client error after disconnection due to error",
              n
            );
          }), r._remove(e), r.emit("error", n, e);
        }, "idleListener");
      }
      a(sl, "makeIdleListener");
      var Rn = class Rn extends nl {
        constructor(e, t) {
          super(), this.options = Object.assign({}, e), e != null && "password" in e && Object.defineProperty(this.options, "password", {
            configurable: true,
            enumerable: false,
            writable: true,
            value: e.password
          }), e != null && e.ssl && e.ssl.key && Object.defineProperty(this.options.ssl, "key", { enumerable: false }), this.options.max = this.options.max || this.options.poolSize || 10, this.options.min = this.options.min || 0, this.options.maxUses = this.options.maxUses || 1 / 0, this.options.allowExitOnIdle = this.options.allowExitOnIdle || false, this.options.maxLifetimeSeconds = this.options.maxLifetimeSeconds || 0, this.log = this.options.log || function() {
          }, this.Client = this.options.Client || t || ot().Client, this.Promise = this.options.Promise || b2.Promise, typeof this.options.idleTimeoutMillis > "u" && (this.options.idleTimeoutMillis = 1e4), this._clients = [], this._idle = [], this._expired = /* @__PURE__ */ new WeakSet(), this._pendingQueue = [], this._endCallback = void 0, this.ending = false, this.ended = false;
        }
        _isFull() {
          return this._clients.length >= this.options.max;
        }
        _isAboveMin() {
          return this._clients.length > this.options.min;
        }
        _pulseQueue() {
          if (this.log("pulse queue"), this.ended) {
            this.log("pulse queue ended");
            return;
          }
          if (this.ending) {
            this.log("pulse queue on ending"), this._idle.length && this._idle.slice().map((t) => {
              this._remove(t.client);
            }), this._clients.length || (this.ended = true, this._endCallback());
            return;
          }
          if (!this._pendingQueue.length) {
            this.log("no queued requests");
            return;
          }
          if (!this._idle.length && this._isFull()) return;
          let e = this._pendingQueue.shift();
          if (this._idle.length) {
            let t = this._idle.pop();
            clearTimeout(
              t.timeoutId
            );
            let n = t.client;
            n.ref && n.ref();
            let i = t.idleListener;
            return this._acquireClient(n, e, i, false);
          }
          if (!this._isFull()) return this.newClient(e);
          throw new Error("unexpected condition");
        }
        _remove(e) {
          let t = ro(
            this._idle,
            (n) => n.client === e
          );
          t !== void 0 && clearTimeout(t.timeoutId), this._clients = this._clients.filter(
            (n) => n !== e
          ), e.end(), this.emit("remove", e);
        }
        connect(e) {
          if (this.ending) {
            let i = new Error("Cannot use a pool after calling end on the pool");
            return e ? e(i) : this.Promise.reject(i);
          }
          let t = Dt(this.Promise, e), n = t.result;
          if (this._isFull() || this._idle.length) {
            if (this._idle.length && m.nextTick(() => this._pulseQueue()), !this.options.connectionTimeoutMillis) return this._pendingQueue.push(new Qe(t.callback)), n;
            let i = a((u, c, l) => {
              clearTimeout(o), t.callback(u, c, l);
            }, "queueCallback"), s = new Qe(i), o = setTimeout(() => {
              ro(
                this._pendingQueue,
                (u) => u.callback === i
              ), s.timedOut = true, t.callback(new Error("timeout exceeded when trying to connect"));
            }, this.options.connectionTimeoutMillis);
            return o.unref && o.unref(), this._pendingQueue.push(s), n;
          }
          return this.newClient(new Qe(t.callback)), n;
        }
        newClient(e) {
          let t = new this.Client(this.options);
          this._clients.push(
            t
          );
          let n = sl(this, t);
          this.log("checking client timeout");
          let i, s = false;
          this.options.connectionTimeoutMillis && (i = setTimeout(() => {
            this.log("ending client due to timeout"), s = true, t.connection ? t.connection.stream.destroy() : t.end();
          }, this.options.connectionTimeoutMillis)), this.log("connecting new client"), t.connect((o) => {
            if (i && clearTimeout(i), t.on("error", n), o) this.log("client failed to connect", o), this._clients = this._clients.filter((u) => u !== t), s && (o = new Error("Connection terminated due to connection timeout", { cause: o })), this._pulseQueue(), e.timedOut || e.callback(o, void 0, to);
            else {
              if (this.log("new client connected"), this.options.maxLifetimeSeconds !== 0) {
                let u = setTimeout(() => {
                  this.log("ending client due to expired lifetime"), this._expired.add(t), this._idle.findIndex((l) => l.client === t) !== -1 && this._acquireClient(
                    t,
                    new Qe((l, f, y) => y()),
                    n,
                    false
                  );
                }, this.options.maxLifetimeSeconds * 1e3);
                u.unref(), t.once("end", () => clearTimeout(u));
              }
              return this._acquireClient(t, e, n, true);
            }
          });
        }
        _acquireClient(e, t, n, i) {
          i && this.emit("connect", e), this.emit("acquire", e), e.release = this._releaseOnce(e, n), e.removeListener("error", n), t.timedOut ? i && this.options.verify ? this.options.verify(e, e.release) : e.release() : i && this.options.verify ? this.options.verify(e, (s) => {
            if (s) return e.release(s), t.callback(s, void 0, to);
            t.callback(void 0, e, e.release);
          }) : t.callback(void 0, e, e.release);
        }
        _releaseOnce(e, t) {
          let n = false;
          return (i) => {
            n && il(), n = true, this._release(e, t, i);
          };
        }
        _release(e, t, n) {
          if (e.on("error", t), e._poolUseCount = (e._poolUseCount || 0) + 1, this.emit("release", n, e), n || this.ending || !e._queryable || e._ending || e._poolUseCount >= this.options.maxUses) {
            e._poolUseCount >= this.options.maxUses && this.log("remove expended client"), this._remove(e), this._pulseQueue();
            return;
          }
          if (this._expired.has(e)) {
            this.log("remove expired client"), this._expired.delete(e), this._remove(e), this._pulseQueue();
            return;
          }
          let s;
          this.options.idleTimeoutMillis && this._isAboveMin() && (s = setTimeout(() => {
            this.log("remove idle client"), this._remove(e);
          }, this.options.idleTimeoutMillis), this.options.allowExitOnIdle && s.unref()), this.options.allowExitOnIdle && e.unref(), this._idle.push(new _n(
            e,
            t,
            s
          )), this._pulseQueue();
        }
        query(e, t, n) {
          if (typeof e == "function") {
            let s = Dt(this.Promise, e);
            return v(function() {
              return s.callback(new Error("Passing a function as the first parameter to pool.query is not supported"));
            }), s.result;
          }
          typeof t == "function" && (n = t, t = void 0);
          let i = Dt(this.Promise, n);
          return n = i.callback, this.connect((s, o) => {
            if (s) return n(s);
            let u = false, c = a((l) => {
              u || (u = true, o.release(l), n(l));
            }, "onError");
            o.once("error", c), this.log("dispatching query");
            try {
              o.query(e, t, (l, f) => {
                if (this.log("query dispatched"), o.removeListener(
                  "error",
                  c
                ), !u) return u = true, o.release(l), l ? n(l) : n(void 0, f);
              });
            } catch (l) {
              return o.release(l), n(l);
            }
          }), i.result;
        }
        end(e) {
          if (this.log("ending"), this.ending) {
            let n = new Error("Called end on pool more than once");
            return e ? e(n) : this.Promise.reject(n);
          }
          this.ending = true;
          let t = Dt(this.Promise, e);
          return this._endCallback = t.callback, this._pulseQueue(), t.result;
        }
        get waitingCount() {
          return this._pendingQueue.length;
        }
        get idleCount() {
          return this._idle.length;
        }
        get expiredCount() {
          return this._clients.reduce((e, t) => e + (this._expired.has(t) ? 1 : 0), 0);
        }
        get totalCount() {
          return this._clients.length;
        }
      };
      a(Rn, "Pool");
      var In = Rn;
      no.exports = In;
    });
    so = {};
    ie(so, { default: () => ol });
    oo = G(() => {
      "use strict";
      p();
      ol = {};
    });
    ao = T((lp, al) => {
      al.exports = { name: "pg", version: "8.8.0", description: "PostgreSQL client - pure javascript & libpq with the same API", keywords: [
        "database",
        "libpq",
        "pg",
        "postgre",
        "postgres",
        "postgresql",
        "rdbms"
      ], homepage: "https://github.com/brianc/node-postgres", repository: { type: "git", url: "git://github.com/brianc/node-postgres.git", directory: "packages/pg" }, author: "Brian Carlson <brian.m.carlson@gmail.com>", main: "./lib", dependencies: { "buffer-writer": "2.0.0", "packet-reader": "1.0.0", "pg-connection-string": "^2.5.0", "pg-pool": "^3.5.2", "pg-protocol": "^1.5.0", "pg-types": "^2.1.0", pgpass: "1.x" }, devDependencies: {
        async: "2.6.4",
        bluebird: "3.5.2",
        co: "4.6.0",
        "pg-copy-streams": "0.3.0"
      }, peerDependencies: { "pg-native": ">=3.0.1" }, peerDependenciesMeta: { "pg-native": { optional: true } }, scripts: { test: "make test-all" }, files: ["lib", "SPONSORS.md"], license: "MIT", engines: { node: ">= 8.0.0" }, gitHead: "c99fb2c127ddf8d712500db2c7b9a5491a178655" };
    });
    lo = T((fp, co) => {
      "use strict";
      p();
      var uo = ge().EventEmitter, ul = (it(), O(nt)), Bn = rt(), Ne = co.exports = function(r, e, t) {
        uo.call(this), r = Bn.normalizeQueryConfig(r, e, t), this.text = r.text, this.values = r.values, this.name = r.name, this.callback = r.callback, this.state = "new", this._arrayMode = r.rowMode === "array", this._emitRowEvents = false, this.on("newListener", function(n) {
          n === "row" && (this._emitRowEvents = true);
        }.bind(this));
      };
      ul.inherits(Ne, uo);
      var cl = { sqlState: "code", statementPosition: "position", messagePrimary: "message", context: "where", schemaName: "schema", tableName: "table", columnName: "column", dataTypeName: "dataType", constraintName: "constraint", sourceFile: "file", sourceLine: "line", sourceFunction: "routine" };
      Ne.prototype.handleError = function(r) {
        var e = this.native.pq.resultErrorFields();
        if (e) for (var t in e) {
          var n = cl[t] || t;
          r[n] = e[t];
        }
        this.callback ? this.callback(r) : this.emit("error", r), this.state = "error";
      };
      Ne.prototype.then = function(r, e) {
        return this._getPromise().then(
          r,
          e
        );
      };
      Ne.prototype.catch = function(r) {
        return this._getPromise().catch(r);
      };
      Ne.prototype._getPromise = function() {
        return this._promise ? this._promise : (this._promise = new Promise(function(r, e) {
          this._once("end", r), this._once("error", e);
        }.bind(this)), this._promise);
      };
      Ne.prototype.submit = function(r) {
        this.state = "running";
        var e = this;
        this.native = r.native, r.native.arrayMode = this._arrayMode;
        var t = a(function(s, o, u) {
          if (r.native.arrayMode = false, v(function() {
            e.emit("_done");
          }), s) return e.handleError(s);
          e._emitRowEvents && (u.length > 1 ? o.forEach(
            (c, l) => {
              c.forEach((f) => {
                e.emit("row", f, u[l]);
              });
            }
          ) : o.forEach(function(c) {
            e.emit("row", c, u);
          })), e.state = "end", e.emit("end", u), e.callback && e.callback(null, u);
        }, "after");
        if (m.domain && (t = m.domain.bind(t)), this.name) {
          this.name.length > 63 && (console.error("Warning! Postgres only supports 63 characters for query names."), console.error("You supplied %s (%s)", this.name, this.name.length), console.error("This can cause conflicts and silent errors executing queries"));
          var n = (this.values || []).map(Bn.prepareValue);
          if (r.namedQueries[this.name]) {
            if (this.text && r.namedQueries[this.name] !== this.text) {
              let s = new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
              return t(s);
            }
            return r.native.execute(this.name, n, t);
          }
          return r.native.prepare(this.name, this.text, n.length, function(s) {
            return s ? t(s) : (r.namedQueries[e.name] = e.text, e.native.execute(e.name, n, t));
          });
        } else if (this.values) {
          if (!Array.isArray(
            this.values
          )) {
            let s = new Error("Query values must be an array");
            return t(s);
          }
          var i = this.values.map(Bn.prepareValue);
          r.native.query(this.text, i, t);
        } else r.native.query(this.text, t);
      };
    });
    yo = T((yp, po) => {
      "use strict";
      p();
      var ll = (oo(), O(so)), fl = At(), dp = ao(), fo = ge().EventEmitter, hl = (it(), O(nt)), pl = Rt(), ho = lo(), K = po.exports = function(r) {
        fo.call(this), r = r || {}, this._Promise = r.Promise || b2.Promise, this._types = new fl(r.types), this.native = new ll({ types: this._types }), this._queryQueue = [], this._ending = false, this._connecting = false, this._connected = false, this._queryable = true;
        var e = this.connectionParameters = new pl(r);
        this.user = e.user, Object.defineProperty(this, "password", { configurable: true, enumerable: false, writable: true, value: e.password }), this.database = e.database, this.host = e.host, this.port = e.port, this.namedQueries = {};
      };
      K.Query = ho;
      hl.inherits(K, fo);
      K.prototype._errorAllQueries = function(r) {
        let e = a((t) => {
          m.nextTick(() => {
            t.native = this.native, t.handleError(r);
          });
        }, "enqueueError");
        this._hasActiveQuery() && (e(this._activeQuery), this._activeQuery = null), this._queryQueue.forEach(e), this._queryQueue.length = 0;
      };
      K.prototype._connect = function(r) {
        var e = this;
        if (this._connecting) {
          m.nextTick(() => r(new Error("Client has already been connected. You cannot reuse a client.")));
          return;
        }
        this._connecting = true, this.connectionParameters.getLibpqConnectionString(function(t, n) {
          if (t) return r(t);
          e.native.connect(n, function(i) {
            if (i) return e.native.end(), r(i);
            e._connected = true, e.native.on("error", function(s) {
              e._queryable = false, e._errorAllQueries(s), e.emit("error", s);
            }), e.native.on("notification", function(s) {
              e.emit("notification", { channel: s.relname, payload: s.extra });
            }), e.emit("connect"), e._pulseQueryQueue(true), r();
          });
        });
      };
      K.prototype.connect = function(r) {
        if (r) {
          this._connect(r);
          return;
        }
        return new this._Promise((e, t) => {
          this._connect((n) => {
            n ? t(n) : e();
          });
        });
      };
      K.prototype.query = function(r, e, t) {
        var n, i, s, o, u;
        if (r == null) throw new TypeError("Client was passed a null or undefined query");
        if (typeof r.submit == "function") s = r.query_timeout || this.connectionParameters.query_timeout, i = n = r, typeof e == "function" && (r.callback = e);
        else if (s = this.connectionParameters.query_timeout, n = new ho(r, e, t), !n.callback) {
          let c, l;
          i = new this._Promise((f, y) => {
            c = f, l = y;
          }), n.callback = (f, y) => f ? l(f) : c(y);
        }
        return s && (u = n.callback, o = setTimeout(() => {
          var c = new Error(
            "Query read timeout"
          );
          m.nextTick(() => {
            n.handleError(c, this.connection);
          }), u(c), n.callback = () => {
          };
          var l = this._queryQueue.indexOf(n);
          l > -1 && this._queryQueue.splice(l, 1), this._pulseQueryQueue();
        }, s), n.callback = (c, l) => {
          clearTimeout(o), u(c, l);
        }), this._queryable ? this._ending ? (n.native = this.native, m.nextTick(() => {
          n.handleError(
            new Error("Client was closed and is not queryable")
          );
        }), i) : (this._queryQueue.push(n), this._pulseQueryQueue(), i) : (n.native = this.native, m.nextTick(() => {
          n.handleError(new Error("Client has encountered a connection error and is not queryable"));
        }), i);
      };
      K.prototype.end = function(r) {
        var e = this;
        this._ending = true, this._connected || this.once("connect", this.end.bind(this, r));
        var t;
        return r || (t = new this._Promise(function(n, i) {
          r = a((s) => s ? i(s) : n(), "cb");
        })), this.native.end(function() {
          e._errorAllQueries(new Error("Connection terminated")), m.nextTick(() => {
            e.emit("end"), r && r();
          });
        }), t;
      };
      K.prototype._hasActiveQuery = function() {
        return this._activeQuery && this._activeQuery.state !== "error" && this._activeQuery.state !== "end";
      };
      K.prototype._pulseQueryQueue = function(r) {
        if (this._connected && !this._hasActiveQuery()) {
          var e = this._queryQueue.shift();
          if (!e) {
            r || this.emit("drain");
            return;
          }
          this._activeQuery = e, e.submit(this);
          var t = this;
          e.once("_done", function() {
            t._pulseQueryQueue();
          });
        }
      };
      K.prototype.cancel = function(r) {
        this._activeQuery === r ? this.native.cancel(function() {
        }) : this._queryQueue.indexOf(r) !== -1 && this._queryQueue.splice(this._queryQueue.indexOf(r), 1);
      };
      K.prototype.ref = function() {
      };
      K.prototype.unref = function() {
      };
      K.prototype.setTypeParser = function(r, e, t) {
        return this._types.setTypeParser(
          r,
          e,
          t
        );
      };
      K.prototype.getTypeParser = function(r, e) {
        return this._types.getTypeParser(r, e);
      };
    });
    Ln = T((gp, mo) => {
      "use strict";
      p();
      mo.exports = yo();
    });
    ot = T((vp, at) => {
      "use strict";
      p();
      var dl = eo(), yl = tt(), ml = En(), wl = io(), { DatabaseError: gl } = vn(), bl = a(
        (r) => {
          var e;
          return e = class extends wl {
            constructor(n) {
              super(n, r);
            }
          }, a(e, "BoundPool"), e;
        },
        "poolFactory"
      ), Fn = a(
        function(r) {
          this.defaults = yl, this.Client = r, this.Query = this.Client.Query, this.Pool = bl(this.Client), this._pools = [], this.Connection = ml, this.types = Je(), this.DatabaseError = gl;
        },
        "PG"
      );
      typeof m.env.NODE_PG_FORCE_NATIVE < "u" ? at.exports = new Fn(Ln()) : (at.exports = new Fn(dl), Object.defineProperty(at.exports, "native", {
        configurable: true,
        enumerable: false,
        get() {
          var r = null;
          try {
            r = new Fn(Ln());
          } catch (e) {
            if (e.code !== "MODULE_NOT_FOUND") throw e;
          }
          return Object.defineProperty(at.exports, "native", { value: r }), r;
        }
      }));
    });
    p();
    p();
    Fe();
    Zt();
    p();
    pa = Object.defineProperty;
    da = Object.defineProperties;
    ya = Object.getOwnPropertyDescriptors;
    bi = Object.getOwnPropertySymbols;
    ma = Object.prototype.hasOwnProperty;
    wa = Object.prototype.propertyIsEnumerable;
    vi = a(
      (r, e, t) => e in r ? pa(r, e, { enumerable: true, configurable: true, writable: true, value: t }) : r[e] = t,
      "__defNormalProp"
    );
    ga = a((r, e) => {
      for (var t in e || (e = {})) ma.call(e, t) && vi(r, t, e[t]);
      if (bi) for (var t of bi(e)) wa.call(e, t) && vi(r, t, e[t]);
      return r;
    }, "__spreadValues");
    ba = a((r, e) => da(r, ya(e)), "__spreadProps");
    va = 1008e3;
    xi = new Uint8Array(
      new Uint16Array([258]).buffer
    )[0] === 2;
    xa = new TextDecoder();
    Jt = new TextEncoder();
    yt = Jt.encode("0123456789abcdef");
    mt = Jt.encode("0123456789ABCDEF");
    Sa = Jt.encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
    Si = Sa.slice();
    Si[62] = 45;
    Si[63] = 95;
    a(Ea, "_toHex");
    a(Aa, "_toHexChunked");
    a(Ei, "toHex");
    p();
    gt = class gt2 {
      constructor(e, t) {
        this.strings = e;
        this.values = t;
      }
      toParameterizedQuery(e = { query: "", params: [] }) {
        let { strings: t, values: n } = this;
        for (let i = 0, s = t.length; i < s; i++) if (e.query += t[i], i < n.length) {
          let o = n[i];
          if (o instanceof Ge) e.query += o.sql;
          else if (o instanceof Ce) if (o.queryData instanceof gt2) o.queryData.toParameterizedQuery(
            e
          );
          else {
            if (o.queryData.params?.length) throw new Error("This query is not composable");
            e.query += o.queryData.query;
          }
          else {
            let { params: u } = e;
            u.push(o), e.query += "$" + u.length, (o instanceof d || ArrayBuffer.isView(o)) && (e.query += "::bytea");
          }
        }
        return e;
      }
    };
    a(gt, "SqlTemplate");
    $e = gt;
    Xt = class Xt2 {
      constructor(e) {
        this.sql = e;
      }
    };
    a(Xt, "UnsafeRawSql");
    Ge = Xt;
    p();
    a(bt, "warnIfBrowser");
    Fe();
    as = Se(At());
    us = Se(rt());
    _t = class _t2 extends Error {
      constructor(t) {
        super(t);
        E(this, "name", "NeonDbError");
        E(this, "severity");
        E(this, "code");
        E(this, "detail");
        E(this, "hint");
        E(this, "position");
        E(this, "internalPosition");
        E(
          this,
          "internalQuery"
        );
        E(this, "where");
        E(this, "schema");
        E(this, "table");
        E(this, "column");
        E(this, "dataType");
        E(this, "constraint");
        E(this, "file");
        E(this, "line");
        E(this, "routine");
        E(this, "sourceError");
        "captureStackTrace" in Error && typeof Error.captureStackTrace == "function" && Error.captureStackTrace(this, _t2);
      }
    };
    a(
      _t,
      "NeonDbError"
    );
    be = _t;
    is = "transaction() expects an array of queries, or a function returning an array of queries";
    Bu = ["severity", "code", "detail", "hint", "position", "internalPosition", "internalQuery", "where", "schema", "table", "column", "dataType", "constraint", "file", "line", "routine"];
    a(Lu, "encodeBuffersAsBytea");
    a(ss, "prepareQuery");
    a(cs, "neon");
    dr = class dr2 {
      constructor(e, t, n) {
        this.execute = e;
        this.queryData = t;
        this.opts = n;
      }
      then(e, t) {
        return this.execute(this.queryData, this.opts).then(e, t);
      }
      catch(e) {
        return this.execute(this.queryData, this.opts).catch(e);
      }
      finally(e) {
        return this.execute(
          this.queryData,
          this.opts
        ).finally(e);
      }
    };
    a(dr, "NeonQueryPromise");
    Ce = dr;
    a(os2, "processQueryResult");
    a(Fu, "getAuthToken");
    p();
    go = Se(ot());
    p();
    wo = Se(ot());
    kn = class kn2 extends wo.Client {
      constructor(t) {
        super(t);
        this.config = t;
      }
      get neonConfig() {
        return this.connection.stream;
      }
      connect(t) {
        let { neonConfig: n } = this;
        n.forceDisablePgSSL && (this.ssl = this.connection.ssl = false), this.ssl && n.useSecureWebSocket && console.warn("SSL is enabled for both Postgres (e.g. ?sslmode=require in the connection string + forceDisablePgSSL = false) and the WebSocket tunnel (useSecureWebSocket = true). Double encryption will increase latency and CPU usage. It may be appropriate to disable SSL in the Postgres connection parameters or set forceDisablePgSSL = true.");
        let i = typeof this.config != "string" && this.config?.host !== void 0 || typeof this.config != "string" && this.config?.connectionString !== void 0 || m.env.PGHOST !== void 0, s = m.env.USER ?? m.env.USERNAME;
        if (!i && this.host === "localhost" && this.user === s && this.database === s && this.password === null) throw new Error(`No database host or connection string was set, and key parameters have default values (host: localhost, user: ${s}, db: ${s}, password: null). Is an environment variable missing? Alternatively, if you intended to connect with these parameters, please set the host to 'localhost' explicitly.`);
        let o = super.connect(t), u = n.pipelineTLS && this.ssl, c = n.pipelineConnect === "password";
        if (!u && !n.pipelineConnect) return o;
        let l = this.connection;
        if (u && l.on(
          "connect",
          () => l.stream.emit("data", "S")
        ), c) {
          l.removeAllListeners("authenticationCleartextPassword"), l.removeAllListeners("readyForQuery"), l.once("readyForQuery", () => l.on("readyForQuery", this._handleReadyForQuery.bind(this)));
          let f = this.ssl ? "sslconnect" : "connect";
          l.on(f, () => {
            this.neonConfig.disableWarningInBrowsers || bt(), this._handleAuthCleartextPassword(), this._handleReadyForQuery();
          });
        }
        return o;
      }
      async _handleAuthSASLContinue(t) {
        if (typeof crypto > "u" || crypto.subtle === void 0 || crypto.subtle.importKey === void 0) throw new Error("Cannot use SASL auth when `crypto.subtle` is not defined");
        let n = crypto.subtle, i = this.saslSession, s = this.password, o = t.data;
        if (i.message !== "SASLInitialResponse" || typeof s != "string" || typeof o != "string") throw new Error(
          "SASL: protocol error"
        );
        let u = Object.fromEntries(o.split(",").map((M) => {
          if (!/^.=/.test(M)) throw new Error(
            "SASL: Invalid attribute pair entry"
          );
          let $ = M[0], me = M.substring(2);
          return [$, me];
        })), c = u.r, l = u.s, f = u.i;
        if (!c || !/^[!-+--~]+$/.test(c)) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce missing/unprintable");
        if (!l || !/^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/.test(l)) throw new Error(
          "SASL: SCRAM-SERVER-FIRST-MESSAGE: salt missing/not base64"
        );
        if (!f || !/^[1-9][0-9]*$/.test(f)) throw new Error(
          "SASL: SCRAM-SERVER-FIRST-MESSAGE: missing/invalid iteration count"
        );
        if (!c.startsWith(i.clientNonce))
          throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce does not start with client nonce");
        if (c.length === i.clientNonce.length) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce is too short");
        let y = parseInt(f, 10), g = d.from(l, "base64"), A = new TextEncoder(), C = A.encode(s), D = await n.importKey(
          "raw",
          C,
          { name: "HMAC", hash: { name: "SHA-256" } },
          false,
          ["sign"]
        ), Y = new Uint8Array(await n.sign("HMAC", D, d.concat(
          [g, d.from([0, 0, 0, 1])]
        ))), P = Y;
        for (var I = 0; I < y - 1; I++) Y = new Uint8Array(await n.sign("HMAC", D, Y)), P = d.from(
          P.map((M, $) => P[$] ^ Y[$])
        );
        let w = P, Z = await n.importKey(
          "raw",
          w,
          { name: "HMAC", hash: { name: "SHA-256" } },
          false,
          ["sign"]
        ), W = new Uint8Array(await n.sign("HMAC", Z, A.encode("Client Key"))), J = await n.digest(
          "SHA-256",
          W
        ), X = "n=*,r=" + i.clientNonce, se = "r=" + c + ",s=" + l + ",i=" + y, oe = "c=biws,r=" + c, B = X + "," + se + "," + oe, j = await n.importKey(
          "raw",
          J,
          { name: "HMAC", hash: { name: "SHA-256" } },
          false,
          ["sign"]
        );
        var le = new Uint8Array(await n.sign(
          "HMAC",
          j,
          A.encode(B)
        )), de = d.from(W.map((M, $) => W[$] ^ le[$])), We = de.toString("base64");
        let fe = await n.importKey(
          "raw",
          w,
          { name: "HMAC", hash: { name: "SHA-256" } },
          false,
          ["sign"]
        ), _e = await n.sign("HMAC", fe, A.encode("Server Key")), ye = await n.importKey("raw", _e, { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]);
        var ee = d.from(
          await n.sign("HMAC", ye, A.encode(B))
        );
        i.message = "SASLResponse", i.serverSignature = ee.toString("base64"), i.response = oe + ",p=" + We, this.connection.sendSCRAMClientFinalMessage(this.saslSession.response);
      }
    };
    a(
      kn,
      "NeonClient"
    );
    ut = kn;
    Fe();
    bo = Se(Rt());
    a(vl, "promisify");
    Un = class Un2 extends go.Pool {
      constructor() {
        super(...arguments);
        E(this, "Client", ut);
        E(this, "hasFetchUnsupportedListeners", false);
        E(this, "addListener", this.on);
      }
      on(t, n) {
        return t !== "error" && (this.hasFetchUnsupportedListeners = true), super.on(t, n);
      }
      query(t, n, i) {
        if (!ce.poolQueryViaFetch || this.hasFetchUnsupportedListeners || typeof t == "function") return super.query(
          t,
          n,
          i
        );
        typeof n == "function" && (i = n, n = void 0);
        let s = vl(this.Promise, i);
        i = s.callback;
        try {
          let o = new bo.default(
            this.options
          ), u = encodeURIComponent, c = encodeURI, l = `postgresql://${u(o.user)}:${u(o.password)}@${u(o.host)}/${c(o.database)}`, f = typeof t == "string" ? t : t.text, y = n ?? t.values ?? [];
          cs(l, { fullResults: true, arrayMode: t.rowMode === "array" }).query(f, y, { types: t.types ?? this.options?.types }).then((A) => i(void 0, A)).catch((A) => i(
            A
          ));
        } catch (o) {
          i(o);
        }
        return s.result;
      }
    };
    a(Un, "NeonPool");
    Mn = Un;
    Fe();
    ct = Se(ot());
    export_DatabaseError = ct.DatabaseError;
    export_defaults = ct.defaults;
    export_escapeIdentifier = ct.escapeIdentifier;
    export_escapeLiteral = ct.escapeLiteral;
    export_types = ct.types;
  }
});

// ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/constants.js"(exports, module) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: /* @__PURE__ */ Symbol("kIsForOnEventAttribute"),
      kListener: /* @__PURE__ */ Symbol("kListener"),
      kStatusCode: /* @__PURE__ */ Symbol("status-code"),
      kWebSocket: /* @__PURE__ */ Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/buffer-util.js"(exports, module) {
    "use strict";
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer2, mask) {
      for (let i = 0; i < buffer2.length; i++) {
        buffer2[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = __require("bufferutil");
        module.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module.exports.unmask = function(buffer2, mask) {
          if (buffer2.length < 32) _unmask(buffer2, mask);
          else bufferUtil.unmask(buffer2, mask);
        };
      } catch (e) {
      }
    }
  }
});

// ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/limiter.js"(exports, module) {
    "use strict";
    var kDone = /* @__PURE__ */ Symbol("kDone");
    var kRun = /* @__PURE__ */ Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module.exports = Limiter;
  }
});

// ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/permessage-deflate.js"(exports, module) {
    "use strict";
    var zlib = __require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = /* @__PURE__ */ Symbol("permessage-deflate");
    var kTotalLength = /* @__PURE__ */ Symbol("total-length");
    var kCallback = /* @__PURE__ */ Symbol("callback");
    var kBuffers = /* @__PURE__ */ Symbol("buffers");
    var kError = /* @__PURE__ */ Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate2 = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {Boolean} [options.isServer=false] Create the instance in either
       *     server or client mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       */
      constructor(options) {
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._maxPayload = this._options.maxPayload | 0;
        this._isServer = !!this._options.isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && (typeof params.client_max_window_bits === "number" ? opts.clientMaxWindowBits > params.client_max_window_bits : !params.client_max_window_bits)) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key2) => {
            let value = params[key2];
            if (value.length > 1) {
              throw new Error(`Parameter "${key2}" must have only a single value`);
            }
            value = value[0];
            if (key2 === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key2}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key2}": ${value}`
                );
              }
            } else if (key2 === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key2}": ${value}`
                );
              }
              value = num;
            } else if (key2 === "client_no_context_takeover" || key2 === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key2}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key2}"`);
            }
            params[key2] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key2 = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key2] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key2];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key2 = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key2] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key2];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module.exports = PerMessageDeflate2;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/validation.js"(exports, module) {
    "use strict";
    var { isUtf8 } = __require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = __require("utf-8-validate");
        module.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/receiver.js"(exports, module) {
    "use strict";
    var { Writable } = __require("stream");
    var PerMessageDeflate2 = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver2 = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxBufferedChunks = options.maxBufferedChunks | 0;
        this._maxFragments = options.maxFragments | 0;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._numFragments = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
          cb(
            this.createError(
              RangeError,
              "Too many buffered chunks",
              false,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            )
          );
          return;
        }
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate2.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._maxFragments > 0 && ++this._numFragments > this._maxFragments) {
          const error = this.createError(
            RangeError,
            "Too many message fragments",
            false,
            1008,
            "WS_ERR_TOO_MANY_BUFFERED_PARTS"
          );
          cb(error);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._numFragments = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module.exports = Receiver2;
  }
});

// ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/sender.js"(exports, module) {
    "use strict";
    var { Duplex } = __require("stream");
    var { randomFillSync } = __require("crypto");
    var {
      types: { isUint8Array }
    } = __require("util");
    var PerMessageDeflate2 = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = /* @__PURE__ */ Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender2 = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) return [target, data];
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else if (isUint8Array(data)) {
            buf.set(data, 2);
          } else {
            throw new TypeError("Second argument must be a string or a Uint8Array");
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module.exports = Sender2;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/event-target.js"(exports, module) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = /* @__PURE__ */ Symbol("kCode");
    var kData = /* @__PURE__ */ Symbol("kData");
    var kError = /* @__PURE__ */ Symbol("kError");
    var kMessage = /* @__PURE__ */ Symbol("kMessage");
    var kReason = /* @__PURE__ */ Symbol("kReason");
    var kTarget = /* @__PURE__ */ Symbol("kTarget");
    var kType = /* @__PURE__ */ Symbol("kType");
    var kWasClean = /* @__PURE__ */ Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/extension.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    function parse2(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension2) => {
        let configurations = extensions[extension2];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension2].concat(
            Object.keys(params).map((k) => {
              let values2 = params[k];
              if (!Array.isArray(values2)) values2 = [values2];
              return values2.map((v2) => v2 === true ? k : `${k}=${v2}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module.exports = { format, parse: parse2 };
  }
});

// ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/websocket.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var https = __require("https");
    var http = __require("http");
    var net2 = __require("net");
    var tls2 = __require("tls");
    var { randomBytes: randomBytes3, createHash: createHash3 } = __require("crypto");
    var { Duplex, Readable } = __require("stream");
    var { URL: URL2 } = __require("url");
    var PerMessageDeflate2 = require_permessage_deflate();
    var Receiver2 = require_receiver();
    var Sender2 = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse: parse2 } = require_extension();
    var { toBuffer } = require_buffer_util();
    var kAborted = /* @__PURE__ */ Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket3 = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            protocols = [];
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              protocols = [];
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._closeTimeout = options.closeTimeout;
          this._isServer = true;
        }
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxBufferedChunks: options.maxBufferedChunks,
          maxFragments: options.maxFragments,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate2.extensionName]) {
          this._extensions[PerMessageDeflate2.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._readyState = _WebSocket.CLOSING;
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate2.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket3, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket3.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket3, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket3.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket3, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket3.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket3, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket3.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket3.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket3.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket3.prototype.addEventListener = addEventListener;
    WebSocket3.prototype.removeEventListener = removeEventListener;
    module.exports = WebSocket3;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxBufferedChunks: 256 * 1024,
        maxFragments: 16 * 1024,
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      websocket._closeTimeout = opts.closeTimeout;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL2) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL2(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:") {
        parsedUrl.protocol = "ws:";
      } else if (parsedUrl.protocol === "https:") {
        parsedUrl.protocol = "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key2 = randomBytes3(16).toString("base64");
      const request = isSecure ? https.request : http.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key2,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate2({
          ...opts.perMessageDeflate,
          isServer: false,
          maxPayload: opts.maxPayload
        });
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate2.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
      }
      if (isIpcUrl) {
        const parts = opts.path.split(":");
        opts.socketPath = parts[0];
        opts.path = parts[1];
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key3, value] of Object.entries(headers)) {
              options.headers[key3.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL2(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket3.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash3("sha1").update(key2 + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse2(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate2.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate2.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxBufferedChunks: opts.maxBufferedChunks,
          maxFragments: opts.maxFragments,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket3.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net2.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net2.isIP(options.host) ? "" : options.host;
      }
      return tls2.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket3.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeMessage = reason;
      websocket._closeCode = code;
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket3.CLOSED) return;
      if (websocket.readyState === WebSocket3.OPEN) {
        websocket._readyState = WebSocket3.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket3.CLOSING;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        const chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket3.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket3.CLOSING;
        this.destroy();
      }
    }
  }
});

// ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/stream.js"(exports, module) {
    "use strict";
    var WebSocket3 = require_websocket();
    var { Duplex } = __require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream2(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null) return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused) ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module.exports = createWebSocketStream2;
  }
});

// ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/subprotocol.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse2(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module.exports = { parse: parse2 };
  }
});

// ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/lib/websocket-server.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var http = __require("http");
    var { Duplex } = __require("stream");
    var { createHash: createHash3 } = __require("crypto");
    var extension2 = require_extension();
    var PerMessageDeflate2 = require_permessage_deflate();
    var subprotocol2 = require_subprotocol();
    var WebSocket3 = require_websocket();
    var { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer2 = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=16384] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxBufferedChunks: 256 * 1024,
          maxFragments: 16 * 1024,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket3,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http.createServer((req, res) => {
            const body = http.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index2 = req.url.indexOf("?");
          const pathname = index2 !== -1 ? req.url.slice(0, index2) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key2 = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key2 === void 0 || !keyRegex.test(key2)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol2.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate2({
            ...this.options.perMessageDeflate,
            isServer: true,
            maxPayload: this.options.maxPayload
          });
          try {
            const offers = extension2.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate2.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate2.extensionName]);
              extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key2,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key2, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key2, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash3("sha1").update(key2 + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate2.extensionName]) {
          const params = extensions[PerMessageDeflate2.extensionName].params;
          const value = extension2.format({
            [PerMessageDeflate2.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxBufferedChunks: this.options.maxBufferedChunks,
          maxFragments: this.options.maxFragments,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module.exports = WebSocketServer2;
    function addListeners(server, map) {
      for (const event of Object.keys(map)) server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// ../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/wrapper.mjs
var import_stream3, import_extension, import_permessage_deflate, import_receiver, import_sender, import_subprotocol, import_websocket, import_websocket_server, wrapper_default;
var init_wrapper = __esm({
  "../../node_modules/.pnpm/ws@8.21.3/node_modules/ws/wrapper.mjs"() {
    "use strict";
    import_stream3 = __toESM(require_stream(), 1);
    import_extension = __toESM(require_extension(), 1);
    import_permessage_deflate = __toESM(require_permessage_deflate(), 1);
    import_receiver = __toESM(require_receiver(), 1);
    import_sender = __toESM(require_sender(), 1);
    import_subprotocol = __toESM(require_subprotocol(), 1);
    import_websocket = __toESM(require_websocket(), 1);
    import_websocket_server = __toESM(require_websocket_server(), 1);
    wrapper_default = import_websocket.default;
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
  verifications: () => verifications,
  withTransaction: () => withTransaction
});
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
function getConnectionString() {
  return process.env.DATABASE_URL ?? "postgresql://unset:unset@localhost:5432/unset";
}
function getDb() {
  if (_httpInstance) return _httpInstance;
  const connectionString = getConnectionString();
  if (isVercel) {
    const sql3 = cs(connectionString);
    _httpInstance = drizzleHttp(sql3, { schema: schema_exports });
  } else {
    _httpInstance = drizzlePostgres(
      src_default(connectionString, {
        max: 10,
        prepare: false
      }),
      { schema: schema_exports }
    );
  }
  return _httpInstance;
}
async function withTransaction(fn) {
  if (!isVercel) {
    return getDb().transaction(fn);
  }
  const pool = new Mn({ connectionString: getConnectionString() });
  const txDb = drizzleNeon(pool, { schema: schema_exports });
  try {
    return await txDb.transaction(fn);
  } finally {
    await pool.end().catch(() => {
    });
  }
}
var isVercel, _httpInstance, db;
var init_src2 = __esm({
  "../../packages/db/src/index.ts"() {
    "use strict";
    init_src();
    init_serverless();
    init_wrapper();
    init_schema();
    init_schema();
    ce.webSocketConstructor = wrapper_default;
    isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
    _httpInstance = null;
    db = new Proxy({}, {
      get(_t3, prop) {
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
import { handle } from "@hono/node-server/vercel";

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
var envTimeout = process.env.UPSTREAM_TIMEOUT_MS ? Number(process.env.UPSTREAM_TIMEOUT_MS) : 55e3;
var UPSTREAM_TIMEOUT_MS = Number.isNaN(envTimeout) || envTimeout <= 0 ? 55e3 : envTimeout;
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
    return fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: timeoutSignal
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
import { and as and2, eq as eq3, gt as gt3, lt, sql } from "drizzle-orm";
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
      gt3(entitlements.expiresAt, now2),
      gt3(entitlements.remaining, 0)
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
  return withTransaction(async (tx) => {
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
  return withTransaction(async (tx) => {
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
  await withTransaction(async (tx) => {
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
    for (const [token, ts2] of tokens.entries()) {
      if (ts2 < minTimestampMs) {
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
      for (const [k, v2] of this.counters.entries()) {
        if (v2.expiresAt <= now2) {
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
  await db.update(schema_exports.apiKeys).set({ lastUsedAt: /* @__PURE__ */ new Date() }).where(eq4(schema_exports.apiKeys.id, key2.id)).catch(() => {
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
    data: rows.map((m2) => ({
      id: m2.id,
      object: "model",
      created: 0,
      owned_by: "morphic",
      display_name: m2.displayName,
      context_length: m2.contextLength,
      capabilities: m2.capabilities,
      status: m2.status,
      replacement_model_alias: m2.replacementModelAlias
    }))
  });
});
v1.get("/models/:id", async (c) => {
  const modelId = c.req.param("id");
  const { db: db2, schema: s } = await Promise.resolve().then(() => (init_src2(), src_exports));
  const { eq: eq11, and: and10, inArray } = await import("drizzle-orm");
  const [m2] = await db2.select({
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
  if (!m2) {
    return c.json(
      { error: { message: `model '${modelId}' not found`, type: "invalid_request_error", code: "model_not_found" } },
      404
    );
  }
  return c.json({
    id: m2.id,
    object: "model",
    created: 0,
    owned_by: "morphic",
    display_name: m2.displayName,
    context_length: m2.contextLength,
    capabilities: m2.capabilities,
    status: m2.status,
    replacement_model_alias: m2.replacementModelAlias
  });
});
v1.get("/ping-dahl", async (c) => {
  try {
    const res = await fetch("https://inference.dahl.global/v1/models", { signal: AbortSignal.timeout(5e3) });
    return c.json({ status: res.status, ok: res.ok });
  } catch (e) {
    return c.json({ error: e.message, stack: e.stack }, 500);
  }
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
  const promptText = body.messages.map((m2) => typeof m2.content === "string" ? m2.content : JSON.stringify(m2.content)).join("\n");
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
import { eq as eq6, and as and5, gt as gt4, or as or2 } from "drizzle-orm";
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
      gt4(schema_exports.sessions.expiresAt, /* @__PURE__ */ new Date())
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
var config = {
  runtime: "nodejs",
  api: {
    bodyParser: false
  }
};
var maxDuration = 60;
var index_vercel_default = handle(app);
export {
  config,
  index_vercel_default as default,
  maxDuration
};
/*! Bundled license information:

@neondatabase/serverless/index.mjs:
  (*! Bundled license information:
  
  ieee754/index.js:
    (*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> *)
  
  buffer/index.js:
    (*!
     * The buffer module from node.js, for the browser.
     *
     * @author   Feross Aboukhadijeh <https://feross.org>
     * @license  MIT
     *)
  *)
*/
