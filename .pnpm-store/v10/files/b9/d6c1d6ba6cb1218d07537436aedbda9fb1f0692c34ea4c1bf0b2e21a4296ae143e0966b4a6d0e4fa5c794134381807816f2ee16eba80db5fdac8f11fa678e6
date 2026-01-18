"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/decorators.ts
function Tool(options = {}) {
  return (target, propertyKey, descriptor) => {
    const toolName = String(propertyKey);
    Reflect.defineMetadata("tool:name", toolName, descriptor.value);
    Reflect.defineMetadata("tool:description", options.description || "", descriptor.value);
    Reflect.defineMetadata("tool:propertyKey", propertyKey, descriptor.value);
    if (options.inputClass) {
      Reflect.defineMetadata("tool:inputClass", options.inputClass, descriptor.value);
    }
    if (options.securitySchemes) {
      Reflect.defineMetadata("tool:securitySchemes", options.securitySchemes, descriptor.value);
    }
  };
}
function Prompt(options = {}) {
  return (target, propertyKey, descriptor) => {
    const promptName = String(propertyKey);
    Reflect.defineMetadata("prompt:name", promptName, descriptor.value);
    Reflect.defineMetadata("prompt:description", options.description || "", descriptor.value);
    Reflect.defineMetadata("prompt:propertyKey", propertyKey, descriptor.value);
    if (options.inputClass) {
      Reflect.defineMetadata("prompt:inputClass", options.inputClass, descriptor.value);
    } else {
      const paramTypes = Reflect.getMetadata("design:paramtypes", target, propertyKey);
      if (paramTypes && paramTypes.length > 0 && paramTypes[0] !== Object) {
        Reflect.defineMetadata("prompt:inputClass", paramTypes[0], descriptor.value);
      }
    }
  };
}
function Resource(options = {}) {
  return (target, propertyKey, descriptor) => {
    const resourceName = String(propertyKey);
    const className = target.constructor.name.toLowerCase().replace("service", "");
    const resourceUri = options.uri ?? `ui://${className}/${resourceName}`;
    Reflect.defineMetadata("resource:uri", resourceUri, descriptor.value);
    Reflect.defineMetadata("resource:name", resourceName, descriptor.value);
    Reflect.defineMetadata("resource:description", options.description || "", descriptor.value);
    Reflect.defineMetadata("resource:mimeType", options.mimeType || "application/json", descriptor.value);
    Reflect.defineMetadata("resource:propertyKey", propertyKey, descriptor.value);
    if (options.inputClass) {
      Reflect.defineMetadata("resource:inputClass", options.inputClass, descriptor.value);
    }
  };
}
function Auth(options) {
  return (target, propertyKey, descriptor) => {
    if (propertyKey && descriptor) {
      Reflect.defineMetadata("auth:provider", options.provider, descriptor.value);
      Reflect.defineMetadata("auth:required", true, descriptor.value);
    } else {
      Reflect.defineMetadata("auth:provider", options.provider, target);
      Reflect.defineMetadata("auth:required", true, target);
    }
  };
}
function UserEnvs() {
  return (target, propertyKey) => {
    const constructor = target.constructor;
    Reflect.defineMetadata("userenvs:propertyKey", propertyKey, constructor);
  };
}
function UI(component) {
  return (target, propertyKey, descriptor) => {
    if (propertyKey && descriptor) {
      Reflect.defineMetadata("ui:component", component, descriptor.value);
    } else {
      Reflect.defineMetadata("ui:component", component, target);
    }
  };
}
function Render(format) {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata("render:format", format, descriptor.value);
  };
}
function Deprecated(message) {
  return (target, propertyKey, descriptor) => {
    const deprecationMessage = message || "This feature is deprecated";
    if (propertyKey && descriptor) {
      Reflect.defineMetadata("deprecated:message", deprecationMessage, descriptor.value);
      Reflect.defineMetadata("deprecated:true", true, descriptor.value);
      const originalMethod = descriptor.value;
      descriptor.value = function(...args) {
        console.warn(`DEPRECATED: ${String(propertyKey)} - ${deprecationMessage}`);
        return originalMethod.apply(this, args);
      };
    } else {
      Reflect.defineMetadata("deprecated:message", deprecationMessage, target);
      Reflect.defineMetadata("deprecated:true", true, target);
      console.warn(`DEPRECATED: ${target.name} - ${deprecationMessage}`);
    }
  };
}
function getMethodMetadata(method) {
  return {
    // Tool metadata
    toolName: Reflect.getMetadata("tool:name", method),
    toolDescription: Reflect.getMetadata("tool:description", method),
    // Prompt metadata
    promptName: Reflect.getMetadata("prompt:name", method),
    promptDescription: Reflect.getMetadata("prompt:description", method),
    // Resource metadata
    resourceUri: Reflect.getMetadata("resource:uri", method),
    resourceName: Reflect.getMetadata("resource:name", method),
    resourceDescription: Reflect.getMetadata("resource:description", method),
    // Common metadata
    inputSchema: Reflect.getMetadata("schema:input", method),
    outputSchema: Reflect.getMetadata("schema:output", method),
    authProvider: Reflect.getMetadata("auth:provider", method),
    authRequired: Reflect.getMetadata("auth:required", method),
    uiComponent: Reflect.getMetadata("ui:component", method),
    renderFormat: Reflect.getMetadata("render:format", method),
    deprecated: Reflect.getMetadata("deprecated:true", method),
    deprecationMessage: Reflect.getMetadata("deprecated:message", method)
  };
}
function getDecoratedMethods(target, metadataKey) {
  const methods = [];
  const prototype = target.prototype || target;
  for (const propertyKey of Object.getOwnPropertyNames(prototype)) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyKey);
    if (descriptor && typeof descriptor.value === "function") {
      const metadata = Reflect.getMetadata(metadataKey, descriptor.value);
      if (metadata !== void 0) {
        methods.push({
          method: descriptor.value,
          propertyKey,
          metadata
        });
      }
    }
  }
  return methods;
}
var import_reflect_metadata;
var init_decorators = __esm({
  "src/decorators.ts"() {
    "use strict";
    import_reflect_metadata = require("reflect-metadata");
    __name(Tool, "Tool");
    __name(Prompt, "Prompt");
    __name(Resource, "Resource");
    __name(Auth, "Auth");
    __name(UserEnvs, "UserEnvs");
    __name(UI, "UI");
    __name(Render, "Render");
    __name(Deprecated, "Deprecated");
    __name(getMethodMetadata, "getMethodMetadata");
    __name(getDecoratedMethods, "getDecoratedMethods");
  }
});

// src/schema-generator.ts
function classToJsonSchema(classConstructor) {
  const instance = new classConstructor();
  const properties = {};
  const required = [];
  const propertyNames = Object.keys(instance);
  for (const propertyName of propertyNames) {
    const propertyType = Reflect.getMetadata("design:type", instance, propertyName);
    let jsonSchemaType = "any";
    if (propertyType) {
      switch (propertyType.name) {
        case "String":
          jsonSchemaType = "string";
          break;
        case "Number":
          jsonSchemaType = "number";
          break;
        case "Boolean":
          jsonSchemaType = "boolean";
          break;
        case "Array":
          jsonSchemaType = "array";
          break;
        case "Object":
          jsonSchemaType = "object";
          break;
        default:
          jsonSchemaType = "object";
      }
    }
    properties[propertyName] = {
      type: jsonSchemaType
    };
    const descriptor = Object.getOwnPropertyDescriptor(instance, propertyName);
    if (descriptor && descriptor.value === void 0) {
      const isOptional = propertyName.endsWith("?") || Reflect.getMetadata("optional", instance, propertyName);
      if (!isOptional) {
        required.push(propertyName);
      }
    }
  }
  return {
    type: "object",
    properties,
    required: required.length > 0 ? required : void 0
  };
}
function Optional() {
  return (target, propertyKey) => {
    Reflect.defineMetadata("optional", true, target, propertyKey);
  };
}
function SchemaConstraint(constraints) {
  return (target, propertyKey) => {
    Reflect.defineMetadata("schema:constraints", constraints, target, propertyKey);
  };
}
function classToJsonSchemaWithConstraints(classConstructor) {
  const instance = new classConstructor();
  const properties = {};
  const required = [];
  const propertyNames = Object.keys(instance);
  for (const propertyName of propertyNames) {
    const propertyType = Reflect.getMetadata("design:type", instance, propertyName);
    const constraints = Reflect.getMetadata("schema:constraints", instance, propertyName);
    const isOptional = Reflect.getMetadata("optional", instance, propertyName);
    let jsonSchemaType = "string";
    if (propertyType) {
      switch (propertyType.name) {
        case "String":
          jsonSchemaType = "string";
          break;
        case "Number":
          jsonSchemaType = "number";
          break;
        case "Boolean":
          jsonSchemaType = "boolean";
          break;
        case "Array":
          jsonSchemaType = "array";
          break;
        case "Object":
          jsonSchemaType = "object";
          break;
        default:
          jsonSchemaType = "object";
      }
    } else if (constraints) {
      if (constraints.minLength !== void 0 || constraints.maxLength !== void 0 || constraints.pattern) {
        jsonSchemaType = "string";
      } else if (constraints.minimum !== void 0 || constraints.maximum !== void 0) {
        jsonSchemaType = "number";
      } else if (constraints.enum && constraints.enum.length > 0) {
        const firstValue = constraints.enum[0];
        if (typeof firstValue === "number") {
          jsonSchemaType = "number";
        } else if (typeof firstValue === "boolean") {
          jsonSchemaType = "boolean";
        } else {
          jsonSchemaType = "string";
        }
      }
    }
    properties[propertyName] = {
      type: jsonSchemaType,
      ...constraints || {}
    };
    if (!isOptional) {
      required.push(propertyName);
    }
  }
  return {
    type: "object",
    properties,
    required: required.length > 0 ? required : void 0
  };
}
var import_reflect_metadata2;
var init_schema_generator = __esm({
  "src/schema-generator.ts"() {
    "use strict";
    import_reflect_metadata2 = require("reflect-metadata");
    __name(classToJsonSchema, "classToJsonSchema");
    __name(Optional, "Optional");
    __name(SchemaConstraint, "SchemaConstraint");
    __name(classToJsonSchemaWithConstraints, "classToJsonSchemaWithConstraints");
  }
});

// src/logger.ts
var LogLevel, COLORS, levelStyles, Logger, defaultLogger;
var init_logger = __esm({
  "src/logger.ts"() {
    "use strict";
    LogLevel = /* @__PURE__ */ (function(LogLevel2) {
      LogLevel2[LogLevel2["DEBUG"] = 0] = "DEBUG";
      LogLevel2[LogLevel2["INFO"] = 1] = "INFO";
      LogLevel2[LogLevel2["WARN"] = 2] = "WARN";
      LogLevel2[LogLevel2["ERROR"] = 3] = "ERROR";
      LogLevel2[LogLevel2["NONE"] = 4] = "NONE";
      return LogLevel2;
    })({});
    COLORS = {
      reset: "\x1B[0m",
      gray: "\x1B[38;5;244m",
      blue: "\x1B[1;34m",
      amber: "\x1B[38;5;214m",
      red: "\x1B[1;31m"
    };
    levelStyles = {
      [0]: {
        label: "DEBUG",
        color: COLORS.gray
      },
      [1]: {
        label: "INFO",
        color: COLORS.blue
      },
      [2]: {
        label: "WARN",
        color: COLORS.amber
      },
      [3]: {
        label: "ERROR",
        color: COLORS.red
      },
      [4]: {
        label: "NONE",
        color: COLORS.gray
      }
    };
    Logger = class {
      static {
        __name(this, "Logger");
      }
      level;
      prefix;
      timestamps;
      colorize;
      context;
      handlers;
      constructor(options = {}) {
        this.level = options.level ?? 1;
        this.prefix = options.prefix ?? "";
        this.timestamps = options.timestamps ?? true;
        this.colorize = options.colorize ?? true;
        this.context = options.context;
        this.handlers = options.handlers ?? [];
      }
      format(level, message) {
        const style = levelStyles[level];
        const timestamp = this.timestamps ? `[${(/* @__PURE__ */ new Date()).toISOString()}]` : "";
        const prefix = this.prefix ? `[${this.prefix}]` : "";
        const context = this.context ? `[${this.context}]` : "";
        const label = `[${style.label}]`;
        const parts = `${timestamp}${prefix}${context}${label} ${message}`;
        if (!this.colorize) return parts;
        return `${style.color}${parts}${COLORS.reset}`;
      }
      shouldLog(level) {
        return level >= this.level && this.level !== 4;
      }
      emit(level, message, consoleFn, ...args) {
        if (!this.shouldLog(level)) return;
        const payload = {
          level,
          levelLabel: levelStyles[level].label,
          message,
          args,
          prefix: this.prefix,
          context: this.context,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
        consoleFn(this.format(level, message), ...args);
        this.handlers.forEach((handler) => {
          try {
            handler(payload);
          } catch (err) {
            console.debug("Logger handler error", err);
          }
        });
      }
      debug(message, ...args) {
        this.emit(0, message, console.debug, ...args);
      }
      info(message, ...args) {
        this.emit(1, message, console.info, ...args);
      }
      warn(message, ...args) {
        this.emit(2, message, console.warn, ...args);
      }
      error(message, ...args) {
        this.emit(3, message, console.error, ...args);
      }
      setLevel(level) {
        this.level = level;
      }
      getLevel() {
        return this.level;
      }
    };
    defaultLogger = new Logger({
      level: 1,
      prefix: "LeanMCP"
    });
  }
});

// src/validation.ts
function validatePort(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${port}. Must be an integer between 1-65535`);
  }
}
function validatePath(path2) {
  if (path2.includes("..") || path2.includes("~")) {
    throw new Error(`Invalid path: ${path2}. Path traversal patterns are not allowed`);
  }
}
function validateServiceName(name) {
  const validNamePattern = /^[a-zA-Z0-9_-]+$/;
  if (!validNamePattern.test(name)) {
    throw new Error(`Invalid service name: ${name}. Service names must contain only alphanumeric characters, hyphens, and underscores`);
  }
}
function validateNonEmpty(value, fieldName) {
  if (!value || value.trim().length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }
}
function validateUrl(url, allowedProtocols = [
  "http:",
  "https:"
]) {
  try {
    const parsed = new URL(url);
    if (!allowedProtocols.includes(parsed.protocol)) {
      throw new Error(`Invalid URL protocol: ${parsed.protocol}. Allowed protocols: ${allowedProtocols.join(", ")}`);
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Invalid URL: ${url}`);
    }
    throw error;
  }
}
var init_validation = __esm({
  "src/validation.ts"() {
    "use strict";
    __name(validatePort, "validatePort");
    __name(validatePath, "validatePath");
    __name(validateServiceName, "validateServiceName");
    __name(validateNonEmpty, "validateNonEmpty");
    __name(validateUrl, "validateUrl");
  }
});

// src/http-server.ts
function isInitializeRequest(body) {
  return body && body.method === "initialize";
}
function getCallerFile() {
  const originalPrepareStackTrace = Error.prepareStackTrace;
  try {
    const err = new Error();
    Error.prepareStackTrace = (_, stack2) => stack2;
    const stack = err.stack;
    for (let i = 0; i < stack.length; i++) {
      let fileName = stack[i].getFileName();
      if (!fileName) continue;
      if (fileName.startsWith("file://")) {
        try {
          const url = new URL(fileName);
          fileName = decodeURIComponent(url.pathname);
          if (process.platform === "win32" && fileName.startsWith("/")) {
            fileName = fileName.substring(1);
          }
        } catch (e) {
          fileName = fileName.replace("file://", "");
          if (process.platform === "win32" && fileName.startsWith("/")) {
            fileName = fileName.substring(1);
          }
        }
      }
      const normalizedPath = fileName.replace(/\\/g, "/");
      const isLeanMCPCore = normalizedPath.includes("@leanmcp/core") || normalizedPath.includes("leanmcp-sdk/packages/core");
      const isValidExtension = fileName.endsWith(".ts") || fileName.endsWith(".js") || fileName.endsWith(".mjs");
      if (!isLeanMCPCore && isValidExtension) {
        return fileName;
      }
    }
    return null;
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
  }
}
async function createHTTPServer(serverInput, options) {
  let serverFactory;
  let httpOptions;
  let resolvedMcpDir;
  if (typeof serverInput === "function") {
    serverFactory = serverInput;
    httpOptions = options || {};
  } else {
    const serverOptions = serverInput;
    const { MCPServer: MCPServer2 } = await Promise.resolve().then(() => (init_index(), index_exports));
    if (!serverOptions.mcpDir) {
      const callerFile = getCallerFile();
      if (callerFile) {
        const path2 = await import("path");
        const callerDir = path2.dirname(callerFile);
        resolvedMcpDir = path2.join(callerDir, "mcp");
      }
    } else {
      resolvedMcpDir = serverOptions.mcpDir;
    }
    serverFactory = /* @__PURE__ */ __name(async () => {
      const mcpServer2 = new MCPServer2({
        ...serverOptions,
        mcpDir: resolvedMcpDir || serverOptions.mcpDir
      });
      return mcpServer2.getServer();
    }, "serverFactory");
    httpOptions = {
      port: serverOptions.port,
      cors: serverOptions.cors,
      logging: serverOptions.logging,
      sessionTimeout: serverOptions.sessionTimeout,
      stateless: serverOptions.stateless,
      dashboard: serverOptions.dashboard,
      auth: serverOptions.auth
    };
  }
  const [express, { StreamableHTTPServerTransport }, cors] = await Promise.all([
    // @ts-ignore
    import("express").catch(() => {
      throw new Error("Express not found. Install with: npm install express @types/express");
    }),
    // @ts-ignore
    import("@modelcontextprotocol/sdk/server/streamableHttp.js").catch(() => {
      throw new Error("MCP SDK not found. Install with: npm install @modelcontextprotocol/sdk");
    }),
    // @ts-ignore
    httpOptions.cors ? import("cors").catch(() => null) : Promise.resolve(null)
  ]);
  const app = express.default();
  const basePort = httpOptions.port || 3001;
  validatePort(basePort);
  const transports = {};
  let mcpServer = null;
  let statelessServerFactory = null;
  const logger = httpOptions.logger || new Logger({
    level: httpOptions.logging ? LogLevel.INFO : LogLevel.NONE,
    prefix: "HTTP"
  });
  const logPrimary = /* @__PURE__ */ __name((message) => {
    if (httpOptions.logging) {
      logger.info?.(message);
    } else {
      console.log(message);
    }
  }, "logPrimary");
  const warnPrimary = /* @__PURE__ */ __name((message) => {
    if (httpOptions.logging) {
      logger.warn?.(message);
    } else {
      console.warn(message);
    }
  }, "warnPrimary");
  const startServerWithPortRetry = /* @__PURE__ */ __name(async () => {
    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const portToTry = basePort + attempt;
      const listener = await new Promise((resolve, reject) => {
        const server = app.listen(portToTry);
        const onListening = /* @__PURE__ */ __name(() => {
          server.off("error", onError);
          resolve(server);
        }, "onListening");
        const onError = /* @__PURE__ */ __name((error) => {
          server.off("listening", onListening);
          server.close();
          reject(error);
        }, "onError");
        server.once("listening", onListening);
        server.once("error", onError);
      }).catch((error) => {
        if (error?.code === "EADDRINUSE" && attempt < maxAttempts - 1) {
          warnPrimary(`Port ${portToTry} in use, trying ${portToTry + 1}...`);
          return null;
        }
        throw error;
      });
      if (listener) {
        return {
          listener,
          port: portToTry
        };
      }
    }
    throw new Error(`No available port found in range ${basePort}-${basePort + maxAttempts - 1}`);
  }, "startServerWithPortRetry");
  if (cors && httpOptions.cors) {
    const corsOptions = typeof httpOptions.cors === "object" ? {
      origin: httpOptions.cors.origin || "*",
      methods: [
        "GET",
        "POST",
        "DELETE",
        "OPTIONS"
      ],
      allowedHeaders: [
        "Content-Type",
        "mcp-session-id",
        "mcp-protocol-version",
        "Authorization"
      ],
      exposedHeaders: [
        "mcp-session-id"
      ],
      credentials: httpOptions.cors.credentials ?? false,
      maxAge: 86400
    } : {
      // When cors: true, use permissive defaults for development
      origin: "*",
      methods: [
        "GET",
        "POST",
        "DELETE",
        "OPTIONS"
      ],
      allowedHeaders: [
        "Content-Type",
        "mcp-session-id",
        "mcp-protocol-version",
        "Authorization"
      ],
      exposedHeaders: [
        "mcp-session-id"
      ],
      credentials: false,
      maxAge: 86400
    };
    app.use(cors.default(corsOptions));
  }
  app.use(express.json());
  const isStateless = httpOptions.stateless !== false;
  console.log(`Starting LeanMCP HTTP Server (${isStateless ? "STATELESS" : "STATEFUL"})...`);
  const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://s3-dashboard-build.s3.us-west-2.amazonaws.com/out/index.html";
  let cachedDashboard = null;
  let cacheTimestamp = 0;
  const CACHE_DURATION = 5 * 60 * 1e3;
  async function fetchDashboard() {
    const now = Date.now();
    if (cachedDashboard && now - cacheTimestamp < CACHE_DURATION) {
      return cachedDashboard;
    }
    try {
      const response = await fetch(DASHBOARD_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard: ${response.status}`);
      }
      const html = await response.text();
      cachedDashboard = html;
      cacheTimestamp = now;
      return html;
    } catch (error) {
      logger.error("Error fetching dashboard from S3:", error);
      throw error;
    }
  }
  __name(fetchDashboard, "fetchDashboard");
  const isDashboardEnabled = httpOptions.dashboard !== false;
  if (isDashboardEnabled) {
    app.get("/", async (req, res) => {
      try {
        const html = await fetchDashboard();
        res.setHeader("Content-Type", "text/html");
        res.send(html);
      } catch (error) {
        res.status(500).send("<h1>Dashboard temporarily unavailable</h1><p>Please try again later.</p>");
      }
    });
  }
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      mode: isStateless ? "stateless" : "stateful",
      activeSessions: isStateless ? 0 : Object.keys(transports).length,
      uptime: process.uptime()
    });
  });
  app.get("/.well-known/oauth-protected-resource", (req, res) => {
    const host = req.headers.host || "localhost";
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const resource = httpOptions.auth?.resource || `${protocol}://${host}`;
    const authServers = httpOptions.auth?.authorizationServers || [
      resource
    ];
    res.json({
      resource,
      authorization_servers: authServers,
      scopes_supported: httpOptions.auth?.scopesSupported || [],
      resource_documentation: httpOptions.auth?.documentationUrl
    });
  });
  if (httpOptions.auth?.enableOAuthServer && httpOptions.auth?.oauthServerOptions) {
    const authOpts = httpOptions.auth.oauthServerOptions;
    app.get("/.well-known/oauth-authorization-server", (req, res) => {
      const host = req.headers.host || "localhost";
      const protocol = req.headers["x-forwarded-proto"] || "http";
      const issuer = httpOptions.auth?.resource || `${protocol}://${host}`;
      res.json({
        issuer,
        authorization_endpoint: `${issuer}/oauth/authorize`,
        token_endpoint: `${issuer}/oauth/token`,
        registration_endpoint: `${issuer}/oauth/register`,
        scopes_supported: httpOptions.auth?.scopesSupported || [],
        response_types_supported: [
          "code"
        ],
        grant_types_supported: [
          "authorization_code",
          "refresh_token"
        ],
        code_challenge_methods_supported: [
          "S256"
        ],
        token_endpoint_auth_methods_supported: [
          "client_secret_post",
          "client_secret_basic",
          "none"
        ]
      });
    });
    (async () => {
      try {
        const authServerModule = await import(
          /* webpackIgnore: true */
          "@leanmcp/auth/server"
        );
        const { OAuthAuthorizationServer } = authServerModule;
        const authServer = new OAuthAuthorizationServer({
          issuer: httpOptions.auth?.resource || `http://localhost:${basePort}`,
          sessionSecret: authOpts.sessionSecret,
          jwtSigningSecret: authOpts.jwtSigningSecret,
          jwtEncryptionSecret: authOpts.jwtEncryptionSecret,
          tokenTTL: authOpts.tokenTTL,
          upstreamProvider: authOpts.upstreamProvider,
          scopesSupported: httpOptions.auth?.scopesSupported,
          enableDCR: true
        });
        app.use(authServer.getRouter());
        logger.info("OAuth authorization server mounted");
      } catch (e) {
        logger.warn("OAuth server requested but @leanmcp/auth/server not available");
      }
    })();
  }
  const handleMCPRequestStateful = /* @__PURE__ */ __name(async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    let transport;
    const method = req.body?.method || "unknown";
    const params = req.body?.params;
    let logMessage = `${req.method} /mcp - ${method}`;
    if (params?.name) {
      logMessage += ` [${params.name}]`;
    } else if (params?.uri) {
      logMessage += ` [${params.uri}]`;
    }
    if (sessionId) {
      logMessage += ` (session: ${sessionId.substring(0, 8)}...)`;
    }
    logger.info(logMessage);
    logger.info(logMessage);
    if (req.headers.authorization) {
      if (!req.body.params) req.body.params = {};
      if (!req.body.params._meta) req.body.params._meta = {};
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        req.body.params._meta.authToken = authHeader.substring(7);
      } else {
        req.body.params._meta.authToken = authHeader;
      }
    }
    try {
      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
        logger.debug(`Reusing session: ${sessionId}`);
      } else if (!sessionId && isInitializeRequest(req.body)) {
        logger.info("Creating new MCP session...");
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: /* @__PURE__ */ __name(() => (0, import_node_crypto.randomUUID)(), "sessionIdGenerator"),
          onsessioninitialized: /* @__PURE__ */ __name((newSessionId) => {
            transports[newSessionId] = transport;
            logger.info(`Session initialized: ${newSessionId}`);
          }, "onsessioninitialized")
        });
        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
            logger.debug(`Session cleaned up: ${transport.sessionId}`);
          }
        };
        if (!mcpServer) {
          throw new Error("MCP server not initialized");
        }
        await mcpServer.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32e3,
            message: "Bad Request: Invalid session or not an init request"
          },
          id: null
        });
        return;
      }
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error"
          },
          id: null
        });
      }
    }
  }, "handleMCPRequestStateful");
  const handleMCPRequestStateless = /* @__PURE__ */ __name(async (req, res) => {
    const method = req.body?.method || "unknown";
    const params = req.body?.params;
    let logMessage = `${req.method} /mcp - ${method}`;
    if (params?.name) logMessage += ` [${params.name}]`;
    else if (params?.uri) logMessage += ` [${params.uri}]`;
    logger.info(logMessage);
    logger.info(logMessage);
    try {
      if (req.headers.authorization) {
        if (!req.body.params) req.body.params = {};
        if (!req.body.params._meta) req.body.params._meta = {};
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith("Bearer ")) {
          req.body.params._meta.authToken = authHeader.substring(7);
        } else {
          req.body.params._meta.authToken = authHeader;
        }
      }
      const freshServer = await statelessServerFactory();
      if (freshServer && typeof freshServer.waitForInit === "function") {
        await freshServer.waitForInit();
      }
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: void 0
      });
      await freshServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        transport.close();
        if ("close" in freshServer && typeof freshServer.close === "function") {
          freshServer.close();
        } else {
          freshServer.close();
        }
      });
    } catch (error) {
      logger.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error"
          },
          id: null
        });
      }
    }
  }, "handleMCPRequestStateless");
  app.get("/mcp", async (req, res) => {
    const acceptHeader = req.headers["accept"] || "";
    if (acceptHeader.includes("text/event-stream")) {
      if (!isStateless) {
        const sessionId = req.headers["mcp-session-id"];
        if (sessionId && transports[sessionId]) {
          const transport = transports[sessionId];
          logger.info(`GET /mcp SSE request (session: ${sessionId.substring(0, 8)}...)`);
          await transport.handleRequest(req, res);
          return;
        }
      }
      res.status(405).json({
        jsonrpc: "2.0",
        error: {
          code: -32e3,
          message: "SSE streaming not supported in stateless mode or invalid session"
        },
        id: null
      });
      return;
    }
    if (isDashboardEnabled) {
      try {
        const html = await fetchDashboard();
        res.setHeader("Content-Type", "text/html");
        res.send(html);
      } catch (error) {
        res.status(500).send("<h1>Dashboard temporarily unavailable</h1><p>Please try again later.</p>");
      }
    } else {
      res.status(404).json({
        error: "Dashboard disabled"
      });
    }
  });
  if (isStateless) {
    app.post("/mcp", handleMCPRequestStateless);
    app.delete("/mcp", (_req, res) => {
      res.status(405).json({
        jsonrpc: "2.0",
        error: {
          code: -32e3,
          message: "Method not allowed (stateless mode)"
        },
        id: null
      });
    });
  } else {
    app.post("/mcp", handleMCPRequestStateful);
    app.delete("/mcp", handleMCPRequestStateful);
  }
  return new Promise(async (resolve, reject) => {
    let activeListener;
    try {
      mcpServer = await serverFactory();
      if (mcpServer && typeof mcpServer.waitForInit === "function") {
        await mcpServer.waitForInit();
      }
      if (isStateless) {
        statelessServerFactory = serverFactory;
      }
      const { listener, port } = await startServerWithPortRetry();
      activeListener = listener;
      process.env.PORT = String(port);
      listener.port = port;
      console.log(`Server running on http://localhost:${port}`);
      console.log(`MCP endpoint: http://localhost:${port}/mcp`);
      console.log(`Health check: http://localhost:${port}/health`);
      resolve({
        listener,
        port
      });
      listener.on("error", (error) => {
        logger.error(`Server error: ${error.message}`);
        reject(error);
      });
      let isShuttingDown = false;
      const cleanup = /* @__PURE__ */ __name(async () => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        logger.info("\nShutting down server...");
        for (const transport of Object.values(transports)) {
          try {
            transport.close?.();
          } catch (e) {
          }
        }
        if (activeListener) {
          await new Promise((resolveClose) => {
            activeListener.close((err) => {
              if (err) {
                logger.warn(`Error closing server: ${err.message}`);
              } else {
                logger.info("Server closed");
              }
              resolveClose();
            });
          });
        }
      }, "cleanup");
      const handleShutdown = /* @__PURE__ */ __name(() => {
        cleanup().finally(() => {
        });
      }, "handleShutdown");
      process.once("SIGINT", handleShutdown);
      process.once("SIGTERM", handleShutdown);
    } catch (error) {
      reject(error);
    }
  });
}
var import_node_crypto;
var init_http_server = __esm({
  "src/http-server.ts"() {
    "use strict";
    import_node_crypto = require("crypto");
    init_logger();
    init_validation();
    __name(isInitializeRequest, "isInitializeRequest");
    __name(getCallerFile, "getCallerFile");
    __name(createHTTPServer, "createHTTPServer");
  }
});

// src/auth-helpers.ts
function createAuthError(message, options) {
  const error = options.error || "invalid_token";
  const errorDescription = options.errorDescription || message;
  const wwwAuth = `Bearer resource_metadata="${options.resourceMetadataUrl}", error="${error}", error_description="${errorDescription}"`;
  return {
    content: [
      {
        type: "text",
        text: message
      }
    ],
    _meta: {
      "mcp/www_authenticate": [
        wwwAuth
      ]
    },
    isError: true
  };
}
function isAuthError(result) {
  if (!result || typeof result !== "object") return false;
  const r = result;
  return r.isError === true && r._meta !== void 0 && typeof r._meta === "object" && r._meta !== null && "mcp/www_authenticate" in r._meta;
}
function extractBearerToken(authHeader) {
  if (!authHeader) return null;
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
function createProtectedResourceMetadata(options) {
  return {
    resource: options.resource,
    authorization_servers: options.authorizationServers || [
      options.resource
    ],
    scopes_supported: options.scopesSupported,
    resource_documentation: options.documentationUrl
  };
}
var init_auth_helpers = __esm({
  "src/auth-helpers.ts"() {
    "use strict";
    __name(createAuthError, "createAuthError");
    __name(isAuthError, "isAuthError");
    __name(extractBearerToken, "extractBearerToken");
    __name(createProtectedResourceMetadata, "createProtectedResourceMetadata");
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Auth: () => Auth,
  Deprecated: () => Deprecated,
  LogLevel: () => LogLevel,
  Logger: () => Logger,
  MCPServer: () => MCPServer,
  MCPServerRuntime: () => MCPServerRuntime,
  Optional: () => Optional,
  Prompt: () => Prompt,
  Render: () => Render,
  Resource: () => Resource,
  SchemaConstraint: () => SchemaConstraint,
  Tool: () => Tool,
  UI: () => UI,
  UserEnvs: () => UserEnvs,
  classToJsonSchema: () => classToJsonSchema,
  classToJsonSchemaWithConstraints: () => classToJsonSchemaWithConstraints,
  createAuthError: () => createAuthError,
  createHTTPServer: () => createHTTPServer,
  createProtectedResourceMetadata: () => createProtectedResourceMetadata,
  defaultLogger: () => defaultLogger,
  extractBearerToken: () => extractBearerToken,
  getDecoratedMethods: () => getDecoratedMethods,
  getMethodMetadata: () => getMethodMetadata,
  isAuthError: () => isAuthError,
  startMCPServer: () => startMCPServer,
  validateNonEmpty: () => validateNonEmpty,
  validatePath: () => validatePath,
  validatePort: () => validatePort,
  validateServiceName: () => validateServiceName,
  validateUrl: () => validateUrl
});
module.exports = __toCommonJS(index_exports);
async function startMCPServer(options) {
  const runtime = new MCPServerRuntime(options);
  await runtime.start();
  return runtime;
}
var import_reflect_metadata3, import_fs, import_path, import_url, import_server, import_stdio, import_types, import_ajv, ajv, MCPServer, MCPServerRuntime;
var init_index = __esm({
  "src/index.ts"() {
    import_reflect_metadata3 = require("reflect-metadata");
    import_fs = __toESM(require("fs"));
    import_path = __toESM(require("path"));
    import_url = require("url");
    import_server = require("@modelcontextprotocol/sdk/server/index.js");
    import_stdio = require("@modelcontextprotocol/sdk/server/stdio.js");
    import_types = require("@modelcontextprotocol/sdk/types.js");
    import_ajv = __toESM(require("ajv"));
    init_decorators();
    init_schema_generator();
    init_http_server();
    init_logger();
    init_validation();
    init_auth_helpers();
    init_decorators();
    init_schema_generator();
    init_logger();
    ajv = new import_ajv.default();
    MCPServer = class {
      static {
        __name(this, "MCPServer");
      }
      server;
      tools = /* @__PURE__ */ new Map();
      prompts = /* @__PURE__ */ new Map();
      resources = /* @__PURE__ */ new Map();
      logging;
      logger;
      options;
      initPromise;
      autoDiscovered = false;
      manifestWatcher = null;
      constructor(options) {
        this.options = options;
        this.logging = options.logging || false;
        let logLevel = LogLevel.NONE;
        if (options.logging) {
          logLevel = options.debug ? LogLevel.DEBUG : LogLevel.INFO;
        }
        this.logger = new Logger({
          level: logLevel,
          prefix: "MCPServer"
        });
        this.server = new import_server.Server({
          name: options.name,
          version: options.version
        }, {
          capabilities: {
            tools: {},
            prompts: {},
            resources: {}
          }
        });
        this.setupHandlers();
        this.initPromise = this.autoInit();
      }
      /**
      * Internal initialization - runs automatically in constructor
      */
      async autoInit() {
        const options = this.options;
        if (options.autoDiscover !== false) {
          await this.autoDiscoverServices(options.mcpDir, options.serviceFactories);
        }
        await this.loadUIManifest();
        this.watchUIManifest();
      }
      /**
      * Wait for initialization to complete
      * This is called internally by createHTTPServer
      */
      async waitForInit() {
        await this.initPromise;
      }
      /**
      * Automatically discover and register services from the mcp directory
      * Called by init() unless autoDiscover is set to false
      */
      async autoDiscoverServices(customMcpDir, serviceFactories) {
        if (this.autoDiscovered) return;
        this.autoDiscovered = true;
        try {
          let mcpDir;
          if (customMcpDir) {
            mcpDir = customMcpDir;
          } else {
            const callerFile = this.getCallerFile();
            if (callerFile) {
              const callerDir = import_path.default.dirname(callerFile);
              mcpDir = import_path.default.join(callerDir, "mcp");
            } else {
              mcpDir = import_path.default.join(process.cwd(), "mcp");
            }
          }
          if (import_fs.default.existsSync(mcpDir)) {
            this.logger.debug(`Auto-discovering services from: ${mcpDir}`);
            await this.autoRegisterServices(mcpDir, serviceFactories);
          } else {
            this.logger.debug(`MCP directory not found at ${mcpDir}, skipping auto-discovery`);
          }
        } catch (error) {
          this.logger.warn(`Auto-discovery failed: ${error.message}`);
        }
      }
      /**
      * Get the file path of the caller (the file that instantiated MCPServer)
      */
      getCallerFile() {
        const originalPrepareStackTrace = Error.prepareStackTrace;
        try {
          const err = new Error();
          Error.prepareStackTrace = (_, stack2) => stack2;
          const stack = err.stack;
          for (let i = 0; i < stack.length; i++) {
            let fileName = stack[i].getFileName();
            if (!fileName) continue;
            if (fileName.startsWith("file://")) {
              try {
                const url = new URL(fileName);
                fileName = decodeURIComponent(url.pathname);
                if (process.platform === "win32" && fileName.startsWith("/")) {
                  fileName = fileName.substring(1);
                }
              } catch (e) {
                fileName = fileName.replace("file://", "");
                if (process.platform === "win32" && fileName.startsWith("/")) {
                  fileName = fileName.substring(1);
                }
              }
            }
            const normalizedPath = fileName.replace(/\\/g, "/");
            const isLeanMCPCore = normalizedPath.includes("@leanmcp/core") || normalizedPath.includes("leanmcp-sdk/packages/core");
            const isValidExtension = fileName.endsWith(".ts") || fileName.endsWith(".js") || fileName.endsWith(".mjs");
            if (!isLeanMCPCore && isValidExtension) {
              return fileName;
            }
          }
          this.logger.debug("No suitable caller file found in stack trace");
          return null;
        } finally {
          Error.prepareStackTrace = originalPrepareStackTrace;
        }
      }
      setupHandlers() {
        this.server.setRequestHandler(import_types.ListToolsRequestSchema, async () => {
          const tools = [];
          for (const [name, tool] of this.tools.entries()) {
            const toolDef = {
              name,
              description: tool.description,
              inputSchema: tool.inputSchema || {
                type: "object",
                properties: {}
              }
            };
            if (tool._meta && Object.keys(tool._meta).length > 0) {
              toolDef._meta = tool._meta;
            }
            tools.push(toolDef);
          }
          return {
            tools
          };
        });
        this.server.setRequestHandler(import_types.CallToolRequestSchema, async (request) => {
          const toolName = request.params.name;
          const tool = this.tools.get(toolName);
          if (!tool) {
            throw new Error(`Tool ${toolName} not found`);
          }
          const methodMeta = getMethodMetadata(tool.method);
          if (methodMeta.inputSchema) {
            const validate = ajv.compile(methodMeta.inputSchema);
            const valid = validate(request.params.arguments || {});
            if (!valid) {
              throw new Error(`Input validation failed: ${JSON.stringify(validate.errors)}`);
            }
          }
          try {
            const meta = request.params._meta;
            const result = await tool.method.call(tool.instance, request.params.arguments, meta);
            let formattedResult = result;
            let structuredContent = void 0;
            if (methodMeta.renderFormat === "markdown" && typeof result === "string") {
              formattedResult = result;
            } else if (typeof result === "object" && result !== null) {
              if ("structuredContent" in result && Object.keys(result).length === 1) {
                structuredContent = result.structuredContent;
                formattedResult = JSON.stringify(structuredContent, null, 2);
              } else if ("content" in result && Array.isArray(result.content)) {
                const textItem = result.content.find((c) => c.type === "text");
                if (textItem?.text) {
                  try {
                    structuredContent = JSON.parse(textItem.text);
                  } catch {
                    structuredContent = textItem.text;
                  }
                }
                formattedResult = JSON.stringify(result, null, 2);
              } else {
                structuredContent = result;
                formattedResult = JSON.stringify(result, null, 2);
              }
            } else {
              formattedResult = String(result);
            }
            const response = {
              content: [
                {
                  type: "text",
                  text: formattedResult
                }
              ]
            };
            if (structuredContent) {
              response.structuredContent = structuredContent;
              if (this.logger) {
                this.logger.debug(`[MCPServer] Setting structuredContent: ${JSON.stringify(structuredContent).slice(0, 100)}...`);
              }
            }
            if (tool._meta && Object.keys(tool._meta).length > 0) {
              response._meta = tool._meta;
            }
            return response;
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: ${error.message}`
                }
              ],
              isError: true
            };
          }
        });
        this.server.setRequestHandler(import_types.ListResourcesRequestSchema, async () => {
          const resources = [];
          for (const [uri, resource] of this.resources.entries()) {
            const resourceInfo = {
              uri: resource.uri,
              name: resource.name,
              description: resource.description,
              mimeType: resource.mimeType
            };
            if (resource.inputSchema) {
              resourceInfo.inputSchema = resource.inputSchema;
            }
            resources.push(resourceInfo);
          }
          return {
            resources
          };
        });
        this.server.setRequestHandler(import_types.ReadResourceRequestSchema, async (request) => {
          const uri = request.params.uri;
          const resource = this.resources.get(uri);
          if (!resource) {
            throw new Error(`Resource ${uri} not found`);
          }
          try {
            const result = await resource.method.call(resource.instance);
            let text;
            if (typeof result === "string") {
              text = result;
            } else if (result && typeof result === "object" && "text" in result) {
              text = result.text;
            } else {
              text = JSON.stringify(result, null, 2);
            }
            return {
              contents: [
                {
                  uri,
                  mimeType: resource.mimeType,
                  text
                }
              ]
            };
          } catch (error) {
            throw new Error(`Failed to read resource ${uri}: ${error.message}`);
          }
        });
        this.server.setRequestHandler(import_types.ListPromptsRequestSchema, async () => {
          const prompts = [];
          for (const [name, prompt] of this.prompts.entries()) {
            prompts.push({
              name,
              description: prompt.description,
              arguments: prompt.arguments
            });
          }
          return {
            prompts
          };
        });
        this.server.setRequestHandler(import_types.GetPromptRequestSchema, async (request) => {
          const promptName = request.params.name;
          const prompt = this.prompts.get(promptName);
          if (!prompt) {
            throw new Error(`Prompt ${promptName} not found`);
          }
          try {
            const result = await prompt.method.call(prompt.instance, request.params.arguments || {});
            if (result && result.messages) {
              return result;
            }
            return {
              description: prompt.description,
              messages: [
                {
                  role: "user",
                  content: {
                    type: "text",
                    text: typeof result === "string" ? result : JSON.stringify(result)
                  }
                }
              ]
            };
          } catch (error) {
            throw new Error(`Failed to get prompt ${promptName}: ${error.message}`);
          }
        });
      }
      /**
      * Auto-register all services from the mcp directory
      * Scans the directory recursively and registers all exported classes
      * 
      * @param mcpDir - Path to the mcp directory containing service files
      * @param serviceFactories - Optional map of service class names to factory functions for dependency injection
      * 
      * @example
      * // Auto-register services with no dependencies
      * await server.autoRegisterServices('./mcp');
      * 
      * @example
      * // Auto-register with dependency injection
      * await server.autoRegisterServices('./mcp', {
      *   SlackService: () => new SlackService(process.env.SLACK_TOKEN),
      *   AuthService: () => new AuthService(authProvider)
      * });
      */
      async autoRegisterServices(mcpDir, serviceFactories) {
        this.logger.debug(`Auto-registering services from: ${mcpDir}`);
        if (!import_fs.default.existsSync(mcpDir)) {
          this.logger.warn(`MCP directory not found: ${mcpDir}`);
          return;
        }
        const serviceFiles = this.findServiceFiles(mcpDir);
        this.logger.debug(`Found ${serviceFiles.length} service file(s)`);
        for (const filePath of serviceFiles) {
          try {
            await this.loadAndRegisterService(filePath, serviceFactories);
          } catch (error) {
            this.logger.error(`Failed to load service from ${filePath}: ${error.message}`);
          }
        }
      }
      /**
      * Recursively find all index.ts/index.js files in the mcp directory
      */
      findServiceFiles(dir) {
        const files = [];
        const entries = import_fs.default.readdirSync(dir, {
          withFileTypes: true
        });
        for (const entry of entries) {
          const fullPath = import_path.default.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...this.findServiceFiles(fullPath));
          } else if (entry.isFile()) {
            if (entry.name === "index.ts" || entry.name === "index.js") {
              files.push(fullPath);
            }
          }
        }
        return files;
      }
      /**
      * Load a service file and register all exported classes
      */
      async loadAndRegisterService(filePath, serviceFactories) {
        this.logger.debug(`Loading service from: ${filePath}`);
        const fileUrl = (0, import_url.pathToFileURL)(filePath).href;
        const module2 = await import(fileUrl);
        let registeredCount = 0;
        for (const [exportName, exportValue] of Object.entries(module2)) {
          if (typeof exportValue === "function" && exportValue.prototype) {
            try {
              let instance;
              if (serviceFactories && serviceFactories[exportName]) {
                instance = serviceFactories[exportName]();
                this.logger.info(`Using factory for service: ${exportName}`);
              } else {
                instance = new exportValue();
              }
              this.registerService(instance);
              registeredCount++;
              this.logger.debug(`Registered service: ${exportName} from ${import_path.default.basename(filePath)}`);
            } catch (error) {
              this.logger.warn(`Skipped ${exportName}: ${error.message}`);
            }
          }
        }
        if (registeredCount === 0) {
          this.logger.warn(`No services registered from ${filePath}`);
        }
      }
      /**
      * Register a service instance with decorated methods
      */
      registerService(instance) {
        const cls = instance.constructor;
        const toolMethods = getDecoratedMethods(cls, "tool:name");
        for (const { method, propertyKey } of toolMethods) {
          const methodMeta = getMethodMetadata(method);
          const inputClass = Reflect.getMetadata?.("tool:inputClass", method);
          let inputSchema = methodMeta.inputSchema;
          if (inputClass) {
            inputSchema = classToJsonSchemaWithConstraints(inputClass);
          }
          const toolMeta = Reflect.getMetadata?.("tool:meta", method) || {};
          this.tools.set(methodMeta.toolName, {
            name: methodMeta.toolName,
            description: methodMeta.toolDescription || "",
            inputSchema,
            method,
            instance,
            propertyKey,
            _meta: Object.keys(toolMeta).length > 0 ? toolMeta : void 0
          });
          if (this.logging) {
            const hasUi = toolMeta["ui/resourceUri"] ? " (with UI)" : "";
            this.logger.debug(`Registered tool: ${methodMeta.toolName}${inputClass ? " (class-based schema)" : ""}${hasUi}`);
          }
        }
        const promptMethods = getDecoratedMethods(cls, "prompt:name");
        for (const { method, propertyKey } of promptMethods) {
          const methodMeta = getMethodMetadata(method);
          const inputClass = Reflect.getMetadata?.("prompt:inputClass", method);
          let inputSchema = methodMeta.inputSchema;
          if (inputClass) {
            inputSchema = classToJsonSchemaWithConstraints(inputClass);
          }
          const promptArgs = inputSchema?.properties ? Object.keys(inputSchema.properties).map((key) => ({
            name: key,
            description: inputSchema?.properties?.[key]?.description || "",
            required: inputSchema?.required?.includes(key) || false
          })) : [];
          this.prompts.set(methodMeta.promptName, {
            name: methodMeta.promptName,
            description: methodMeta.promptDescription || "",
            arguments: promptArgs,
            method,
            instance,
            propertyKey
          });
          if (this.logging) {
            this.logger.debug(`Registered prompt: ${methodMeta.promptName}`);
          }
        }
        const resourceMethods = getDecoratedMethods(cls, "resource:uri");
        for (const { method, propertyKey } of resourceMethods) {
          const methodMeta = getMethodMetadata(method);
          const inputClass = Reflect.getMetadata?.("resource:inputClass", method);
          let inputSchema = methodMeta.inputSchema;
          if (inputClass) {
            inputSchema = classToJsonSchemaWithConstraints(inputClass);
          }
          const mimeType = Reflect.getMetadata?.("resource:mimeType", method) || "application/json";
          this.resources.set(methodMeta.resourceUri, {
            uri: methodMeta.resourceUri,
            name: methodMeta.resourceName || methodMeta.resourceUri,
            description: methodMeta.resourceDescription || "",
            mimeType,
            inputSchema,
            method,
            instance,
            propertyKey
          });
          if (this.logging) {
            this.logger.debug(`Registered resource: ${methodMeta.resourceUri}`);
          }
        }
      }
      /**
      * Watch UI manifest for changes and reload resources dynamically
      * 
      * CRITICAL: Only for stateful mode. In stateless mode, each request
      * creates a fresh server that reads the manifest directly, making
      * watchers both unnecessary and a memory leak source.
      */
      watchUIManifest() {
        if (this.options.stateless) {
          return;
        }
        try {
          const manifestPath = import_path.default.join(process.cwd(), "dist", "ui-manifest.json");
          if (!import_fs.default.existsSync(manifestPath)) {
            return;
          }
          if (this.logging) {
            this.logger.debug(`Watching UI manifest: ${manifestPath}`);
          }
          import("chokidar").then(({ default: chokidar }) => {
            this.manifestWatcher = chokidar.watch(manifestPath, {
              ignoreInitial: true,
              persistent: true,
              awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 50
              }
            });
            this.manifestWatcher.on("change", async () => {
              if (this.logging) {
                this.logger.debug("UI manifest changed, reloading resources");
              }
              await this.reloadUIManifest();
            });
            this.manifestWatcher.on("error", (error) => {
              if (this.logging) {
                this.logger.warn(`Manifest watcher error: ${error.message}`);
              }
            });
          }).catch((error) => {
            if (this.logging) {
              this.logger.warn(`Failed to initialize manifest watcher: ${error.message}`);
            }
          });
        } catch (error) {
          if (this.logging) {
            this.logger.warn(`Failed to setup manifest watcher: ${error.message}`);
          }
        }
      }
      /**
      * Reload UI manifest and update resource registrations
      */
      async reloadUIManifest() {
        try {
          const manifestPath = import_path.default.join(process.cwd(), "dist", "ui-manifest.json");
          if (!import_fs.default.existsSync(manifestPath)) {
            const uiResourceUris = Array.from(this.resources.keys()).filter((uri) => uri.startsWith("ui://"));
            for (const uri of uiResourceUris) {
              this.resources.delete(uri);
              if (this.logging) {
                this.logger.debug(`Removed UI resource: ${uri}`);
              }
            }
            return;
          }
          const manifest = JSON.parse(import_fs.default.readFileSync(manifestPath, "utf-8"));
          const currentUIUris = new Set(Object.keys(manifest));
          const registeredUIUris = Array.from(this.resources.keys()).filter((uri) => uri.startsWith("ui://"));
          for (const uri of registeredUIUris) {
            if (!currentUIUris.has(uri)) {
              this.resources.delete(uri);
              if (this.logging) {
                this.logger.debug(`Removed UI resource: ${uri}`);
              }
            }
          }
          for (const [uri, entry] of Object.entries(manifest)) {
            const isString = typeof entry === "string";
            const htmlPath = isString ? entry : entry.htmlPath;
            const isGPTApp = !isString && entry.isGPTApp;
            const gptMeta = !isString ? entry.gptMeta : void 0;
            if (!import_fs.default.existsSync(htmlPath)) {
              if (this.logging) {
                this.logger.warn(`UI HTML file not found: ${htmlPath}`);
              }
              continue;
            }
            const wasRegistered = this.resources.has(uri);
            const mimeType = isGPTApp ? "text/html+skybridge" : "text/html;profile=mcp-app";
            const _meta = {};
            if (isGPTApp) {
              _meta["openai/outputTemplate"] = uri;
              if (gptMeta) Object.assign(_meta, gptMeta);
              if (_meta["openai/widgetPrefersBorder"] === void 0) _meta["openai/widgetPrefersBorder"] = true;
            }
            this.resources.set(uri, {
              uri,
              name: uri.replace("ui://", "").replace(/\//g, "-"),
              description: `Auto-generated UI resource from pre-built HTML`,
              mimeType,
              inputSchema: void 0,
              method: /* @__PURE__ */ __name(async () => {
                if (import_fs.default.existsSync(htmlPath)) {
                  const html = import_fs.default.readFileSync(htmlPath, "utf-8");
                  return {
                    text: html,
                    _meta: Object.keys(_meta).length > 0 ? _meta : void 0
                  };
                }
                throw new Error(`UI HTML file not found: ${htmlPath}`);
              }, "method"),
              instance: null,
              propertyKey: "getUI"
            });
            if (this.logging) {
              const action = wasRegistered ? "Updated" : "Registered";
              this.logger.debug(`${action} UI resource: ${uri}`);
            }
          }
        } catch (error) {
          if (this.logging) {
            this.logger.warn(`Failed to reload UI manifest: ${error.message}`);
          }
        }
      }
      /**
      * Load UI manifest and auto-register resources for pre-built @UIApp components.
      * The manifest is generated by `leanmcp dev` or `leanmcp start` commands.
      */
      async loadUIManifest() {
        try {
          const manifestPath = import_path.default.join(process.cwd(), "dist", "ui-manifest.json");
          if (!import_fs.default.existsSync(manifestPath)) {
            return;
          }
          const manifest = JSON.parse(import_fs.default.readFileSync(manifestPath, "utf-8"));
          for (const [uri, entry] of Object.entries(manifest)) {
            const isString = typeof entry === "string";
            const htmlPath = isString ? entry : entry.htmlPath;
            const isGPTApp = !isString && entry.isGPTApp;
            const gptMeta = !isString ? entry.gptMeta : void 0;
            if (this.resources.has(uri)) {
              if (this.logging) {
                this.logger.debug(`Skipping UI resource ${uri} - already registered`);
              }
              continue;
            }
            if (!import_fs.default.existsSync(htmlPath)) {
              if (this.logging) {
                this.logger.warn(`UI HTML file not found: ${htmlPath}`);
              }
              continue;
            }
            const html = import_fs.default.readFileSync(htmlPath, "utf-8");
            const mimeType = isGPTApp ? "text/html+skybridge" : "text/html;profile=mcp-app";
            const _meta = {};
            if (isGPTApp) {
              _meta["openai/outputTemplate"] = uri;
              if (gptMeta) Object.assign(_meta, gptMeta);
              if (_meta["openai/widgetPrefersBorder"] === void 0) _meta["openai/widgetPrefersBorder"] = true;
            }
            this.resources.set(uri, {
              uri,
              name: uri.replace("ui://", "").replace(/\//g, "-"),
              description: `Auto-generated UI resource from pre-built HTML`,
              mimeType,
              inputSchema: void 0,
              method: /* @__PURE__ */ __name(async () => ({
                text: html,
                _meta: Object.keys(_meta).length > 0 ? _meta : void 0
              }), "method"),
              instance: null,
              propertyKey: "getUI"
            });
            if (this.logging) {
              this.logger.debug(`Registered UI resource from manifest: ${uri}`);
            }
          }
        } catch (error) {
          if (this.logging) {
            this.logger.warn(`Failed to load UI manifest: ${error.message}`);
          }
        }
      }
      /**
      * Get the underlying MCP SDK Server instance
      * Attaches waitForInit method for HTTP server initialization
      */
      getServer() {
        this.server.waitForInit = () => this.waitForInit();
        return this.server;
      }
      /**
      * Clean up all registered services, watchers, and resources
      * CRITICAL for stateless mode to prevent memory leaks
      */
      close() {
        if (this.manifestWatcher) {
          try {
            this.manifestWatcher.close();
          } catch (e) {
          }
          this.manifestWatcher = null;
        }
        this.tools.clear();
        this.prompts.clear();
        this.resources.clear();
        if (this.server && typeof this.server.close === "function") {
          this.server.close();
        }
      }
      /**
      * Cleanup resources (call on server shutdown)
      */
      async cleanup() {
        if (this.manifestWatcher) {
          await this.manifestWatcher.close();
          this.manifestWatcher = null;
        }
      }
    };
    MCPServerRuntime = class {
      static {
        __name(this, "MCPServerRuntime");
      }
      server;
      tools = /* @__PURE__ */ new Map();
      prompts = /* @__PURE__ */ new Map();
      resources = /* @__PURE__ */ new Map();
      options;
      logger;
      constructor(options) {
        this.options = options;
        this.logger = new Logger({
          level: this.options.logging ? LogLevel.INFO : LogLevel.NONE,
          prefix: "MCPServerRuntime"
        });
        this.server = new import_server.Server({
          name: "leanmcp-server",
          version: "0.1.0"
        }, {
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          }
        });
        this.setupHandlers();
      }
      setupHandlers() {
        this.server.setRequestHandler(import_types.ListToolsRequestSchema, async () => {
          const tools = [];
          for (const [name, tool] of this.tools.entries()) {
            tools.push({
              name,
              description: tool.description,
              inputSchema: tool.inputSchema || {
                type: "object",
                properties: {}
              }
            });
          }
          return {
            tools
          };
        });
        this.server.setRequestHandler(import_types.CallToolRequestSchema, async (request) => {
          const toolName = request.params.name;
          const tool = this.tools.get(toolName);
          if (!tool) {
            throw new Error(`Tool ${toolName} not found`);
          }
          const methodMeta = getMethodMetadata(tool.method);
          if (methodMeta.inputSchema) {
            const validate = ajv.compile(methodMeta.inputSchema);
            const valid = validate(request.params.arguments || {});
            if (!valid) {
              throw new Error(`Input validation failed: ${JSON.stringify(validate.errors)}`);
            }
          }
          if (methodMeta.authRequired) {
            if (this.options.logging) {
              this.logger.info(`Auth required for ${toolName} (provider: ${methodMeta.authProvider})`);
            }
          }
          try {
            const meta = request.params._meta;
            const result = await tool.method.call(tool.instance, request.params.arguments, meta);
            if (result && typeof result === "object" && result.type === "elicitation") {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                  }
                ],
                isError: false
              };
            }
            let formattedResult = result;
            if (methodMeta.renderFormat === "markdown" && typeof result === "string") {
              formattedResult = result;
            } else if (methodMeta.renderFormat === "json" || typeof result === "object") {
              formattedResult = JSON.stringify(result, null, 2);
            } else {
              formattedResult = String(result);
            }
            return {
              content: [
                {
                  type: "text",
                  text: formattedResult
                }
              ]
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: ${error.message}`
                }
              ],
              isError: true
            };
          }
        });
        this.server.setRequestHandler(import_types.ListResourcesRequestSchema, async () => {
          const resources = [];
          for (const [uri, resource] of this.resources.entries()) {
            resources.push({
              uri: resource.uri,
              name: resource.name,
              description: resource.description,
              mimeType: resource.mimeType
            });
          }
          return {
            resources
          };
        });
        this.server.setRequestHandler(import_types.ReadResourceRequestSchema, async (request) => {
          const uri = request.params.uri;
          const resource = this.resources.get(uri);
          if (!resource) {
            throw new Error(`Resource ${uri} not found`);
          }
          try {
            const result = await resource.method.call(resource.instance);
            return {
              contents: [
                {
                  uri,
                  mimeType: resource.mimeType,
                  text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
                }
              ]
            };
          } catch (error) {
            throw new Error(`Failed to read resource ${uri}: ${error.message}`);
          }
        });
        this.server.setRequestHandler(import_types.ListPromptsRequestSchema, async () => {
          const prompts = [];
          for (const [name, prompt] of this.prompts.entries()) {
            prompts.push({
              name,
              description: prompt.description,
              arguments: prompt.arguments
            });
          }
          return {
            prompts
          };
        });
        this.server.setRequestHandler(import_types.GetPromptRequestSchema, async (request) => {
          const promptName = request.params.name;
          const prompt = this.prompts.get(promptName);
          if (!prompt) {
            throw new Error(`Prompt ${promptName} not found`);
          }
          try {
            const result = await prompt.method.call(prompt.instance, request.params.arguments || {});
            if (result && result.messages) {
              return result;
            }
            return {
              description: prompt.description,
              messages: [
                {
                  role: "user",
                  content: {
                    type: "text",
                    text: typeof result === "string" ? result : JSON.stringify(result)
                  }
                }
              ]
            };
          } catch (error) {
            throw new Error(`Failed to get prompt ${promptName}: ${error.message}`);
          }
        });
      }
      async loadServices() {
        const absPath = import_path.default.resolve(this.options.servicesDir);
        if (!import_fs.default.existsSync(absPath)) {
          this.logger.error(`Services directory not found: ${absPath}`);
          return;
        }
        const files = import_fs.default.readdirSync(absPath);
        let toolCount = 0;
        let promptCount = 0;
        let resourceCount = 0;
        for (const dir of files) {
          const modulePath = import_path.default.join(absPath, dir, "index.ts");
          const modulePathJs = import_path.default.join(absPath, dir, "index.js");
          const finalPath = import_fs.default.existsSync(modulePath) ? modulePath : import_fs.default.existsSync(modulePathJs) ? modulePathJs : null;
          if (finalPath) {
            try {
              const fileUrl = (0, import_url.pathToFileURL)(finalPath).href;
              const mod = await import(fileUrl);
              const exportedClasses = Object.values(mod).filter((val) => typeof val === "function" && val.prototype);
              for (const cls of exportedClasses) {
                const instance = new cls();
                const envsPropKey = Reflect.getMetadata?.("userenvs:propertyKey", cls);
                if (envsPropKey) {
                  instance[envsPropKey] = process.env;
                }
                const toolMethods = getDecoratedMethods(cls, "tool:name");
                for (const { method, propertyKey, metadata } of toolMethods) {
                  const methodMeta = getMethodMetadata(method);
                  const inputClass = Reflect.getMetadata?.("tool:inputClass", method);
                  const outputClass = Reflect.getMetadata?.("tool:outputClass", method);
                  let inputSchema = methodMeta.inputSchema;
                  if (inputClass) {
                    inputSchema = classToJsonSchemaWithConstraints(inputClass);
                  }
                  this.tools.set(methodMeta.toolName, {
                    name: methodMeta.toolName,
                    description: methodMeta.toolDescription || "",
                    inputSchema,
                    method,
                    instance,
                    propertyKey
                  });
                  toolCount++;
                  if (this.options.logging) {
                    this.logger.info(`Loaded tool: ${methodMeta.toolName}${inputClass ? " (class-based schema)" : ""}`);
                  }
                }
                const promptMethods = getDecoratedMethods(cls, "prompt:name");
                for (const { method, propertyKey, metadata } of promptMethods) {
                  const methodMeta = getMethodMetadata(method);
                  const promptArgs = methodMeta.inputSchema?.properties ? Object.keys(methodMeta.inputSchema.properties).map((key) => ({
                    name: key,
                    description: methodMeta.inputSchema?.properties?.[key]?.description || "",
                    required: methodMeta.inputSchema?.required?.includes(key) || false
                  })) : [];
                  this.prompts.set(methodMeta.promptName, {
                    name: methodMeta.promptName,
                    description: methodMeta.promptDescription || "",
                    arguments: promptArgs,
                    method,
                    instance,
                    propertyKey
                  });
                  promptCount++;
                  if (this.options.logging) {
                    this.logger.info(`Loaded prompt: ${methodMeta.promptName}`);
                  }
                }
                const resourceMethods = getDecoratedMethods(cls, "resource:uri");
                for (const { method, propertyKey, metadata } of resourceMethods) {
                  const methodMeta = getMethodMetadata(method);
                  this.resources.set(methodMeta.resourceUri, {
                    uri: methodMeta.resourceUri,
                    name: methodMeta.resourceName || methodMeta.resourceUri,
                    description: methodMeta.resourceDescription || "",
                    mimeType: "application/json",
                    method,
                    instance,
                    propertyKey
                  });
                  resourceCount++;
                  if (this.options.logging) {
                    this.logger.info(`Loaded resource: ${methodMeta.resourceUri}`);
                  }
                }
              }
            } catch (error) {
              this.logger.error(`Failed to load from ${dir}:`, error.message || error);
              if (this.options.logging) {
                this.logger.error("Full error:", error);
              }
            }
          }
        }
        if (this.options.logging) {
          this.logger.info(`
Loaded ${toolCount} tools, ${promptCount} prompts, ${resourceCount} resources`);
        }
      }
      async start() {
        await this.loadServices();
        const transport = new import_stdio.StdioServerTransport();
        await this.server.connect(transport);
        if (this.options.logging) {
          this.logger.info("LeanMCP server running on stdio");
        }
      }
      getServer() {
        return this.server;
      }
      getTools() {
        return Array.from(this.tools.values());
      }
      getPrompts() {
        return Array.from(this.prompts.values());
      }
      getResources() {
        return Array.from(this.resources.values());
      }
    };
    __name(startMCPServer, "startMCPServer");
  }
});
init_index();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Auth,
  Deprecated,
  LogLevel,
  Logger,
  MCPServer,
  MCPServerRuntime,
  Optional,
  Prompt,
  Render,
  Resource,
  SchemaConstraint,
  Tool,
  UI,
  UserEnvs,
  classToJsonSchema,
  classToJsonSchemaWithConstraints,
  createAuthError,
  createHTTPServer,
  createProtectedResourceMetadata,
  defaultLogger,
  extractBearerToken,
  getDecoratedMethods,
  getMethodMetadata,
  isAuthError,
  startMCPServer,
  validateNonEmpty,
  validatePath,
  validatePort,
  validateServiceName,
  validateUrl
});
