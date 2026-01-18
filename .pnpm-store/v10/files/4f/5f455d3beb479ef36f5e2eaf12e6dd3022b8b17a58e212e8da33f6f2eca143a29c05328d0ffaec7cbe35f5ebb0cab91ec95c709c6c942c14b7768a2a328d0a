import { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * Simple configurable logger for LeanMCP SDK
 */
declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}
interface LoggerOptions {
    level?: LogLevel;
    prefix?: string;
    timestamps?: boolean;
    /**
     * Enable or disable ANSI colors. Defaults to true.
     */
    colorize?: boolean;
    /**
     * Provide additional metadata context (e.g. module name)
     */
    context?: string;
    /**
     * Optional third-party handlers (PostHog, Sentry, etc.)
     * They receive the structured payload for easy integration.
     */
    handlers?: LoggerHandler[];
}
interface LogPayload {
    level: LogLevel;
    levelLabel: string;
    message: string;
    args: any[];
    prefix?: string;
    context?: string;
    timestamp: string;
}
type LoggerHandler = (payload: LogPayload) => void;
declare class Logger {
    private level;
    private prefix;
    private timestamps;
    private colorize;
    private context?;
    private handlers;
    constructor(options?: LoggerOptions);
    private format;
    private shouldLog;
    private emit;
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    setLevel(level: LogLevel): void;
    getLevel(): LogLevel;
}
declare const defaultLogger: Logger;

interface HTTPServerOptions {
    port?: number;
    cors?: boolean | {
        origin?: string | string[];
        credentials?: boolean;
    };
    logging?: boolean;
    logger?: Logger;
    sessionTimeout?: number;
    stateless?: boolean;
    dashboard?: boolean;
    /** OAuth/Auth configuration (MCP authorization spec) */
    auth?: HTTPServerAuthOptions;
}
/**
 * OAuth/Auth configuration for MCP server
 *
 * Enables MCP authorization spec compliance by exposing
 * `/.well-known/oauth-protected-resource` (RFC 9728)
 */
interface HTTPServerAuthOptions {
    /** Resource identifier (defaults to server URL) */
    resource?: string;
    /** Authorization servers (defaults to self) */
    authorizationServers?: string[];
    /** Supported OAuth scopes */
    scopesSupported?: string[];
    /** Documentation URL */
    documentationUrl?: string;
    /** Enable built-in OAuth authorization server */
    enableOAuthServer?: boolean;
    /** OAuth server options (when enableOAuthServer is true) */
    oauthServerOptions?: {
        /** Session secret for signing tokens/state */
        sessionSecret: string;
        /** JWT signing secret (defaults to sessionSecret if not provided) */
        jwtSigningSecret?: string;
        /** JWT encryption secret for encrypting upstream tokens */
        jwtEncryptionSecret?: Buffer;
        /** Issuer URL for JWTs */
        issuer?: string;
        /** Access token TTL in seconds (default: 3600) */
        tokenTTL?: number;
        /** Enable Dynamic Client Registration (for ChatGPT etc.) */
        enableDCR?: boolean;
        /** Upstream OAuth provider configuration */
        upstreamProvider?: {
            id: string;
            authorizationEndpoint: string;
            tokenEndpoint: string;
            clientId: string;
            clientSecret: string;
            scopes?: string[];
            userInfoEndpoint?: string;
        };
    };
}
interface MCPServerFactory {
    (): Server | Promise<Server>;
}
type HTTPServerInput = MCPServerFactory | MCPServerConstructorOptions;
/**
 * Create an HTTP server for MCP with Streamable HTTP transport
 * Returns the HTTP server instance to keep the process alive
 *
 * @param serverInput - Either MCPServerConstructorOptions or a factory function that returns a Server
 * @param options - HTTP server options (only used when serverInput is a factory function)
 */
declare function createHTTPServer(serverInput: HTTPServerInput, options?: HTTPServerOptions): Promise<any>;

/**
 * Security scheme for MCP tools (per MCP authorization spec)
 *
 * @example
 * ```typescript
 * @Tool({
 *   description: 'Fetch user data',
 *   securitySchemes: [{ type: 'oauth2', scopes: ['read:user'] }],
 * })
 * async fetchUser() { ... }
 * ```
 */
interface SecurityScheme {
    /** Type of security - 'noauth' for anonymous, 'oauth2' for OAuth */
    type: 'noauth' | 'oauth2';
    /** Required OAuth scopes (for oauth2 type) */
    scopes?: string[];
}
interface ToolOptions {
    description?: string;
    inputClass?: any;
    /**
     * Security schemes for this tool (MCP authorization spec)
     *
     * - `noauth`: Tool is callable anonymously
     * - `oauth2`: Tool requires OAuth 2.0 access token
     *
     * If both are listed, tool works anonymously but OAuth unlocks more features.
     * If omitted, tool inherits server-level defaults.
     */
    securitySchemes?: SecurityScheme[];
}
interface PromptOptions {
    description?: string;
    inputClass?: any;
}
/**
 * Marks a method as an MCP tool (callable function)
 * - Tool name is automatically derived from function name
 * - Input schema is explicitly defined via inputClass
 * - Full type safety at compile time
 *
 * @example
 * class AnalyzeSentimentInput {
 *   @SchemaConstraint({ description: 'Text to analyze' })
 *   text!: string;
 *
 *   @Optional()
 *   language?: string;
 * }
 *
 * @Tool({
 *   description: 'Analyze sentiment of text',
 *   inputClass: AnalyzeSentimentInput
 * })
 * async analyzeSentiment(args: AnalyzeSentimentInput): Promise<AnalyzeSentimentOutput> {
 *   // Tool name will be: "analyzeSentiment"
 * }
 *
 * @example
 * // Tool with OAuth requirement
 * @Tool({
 *   description: 'Fetch private user data',
 *   securitySchemes: [{ type: 'oauth2', scopes: ['read:user'] }],
 * })
 * async fetchPrivateData() { ... }
 */
declare function Tool(options?: ToolOptions): MethodDecorator;
/**
 * Marks a method as an MCP prompt template
 * - Prompt name is automatically derived from function name
 * - Input schema can be explicitly defined via inputClass or inferred from parameter type
 *
 * @example
 * class PromptInput {
 *   @SchemaConstraint({ description: 'Auth token' })
 *   token!: string;
 * }
 *
 * @Prompt({
 *   description: 'Generate sentiment analysis prompt',
 *   inputClass: PromptInput
 * })
 * sentimentPrompt(args: PromptInput) {
 *   // Prompt name will be: "sentimentPrompt"
 * }
 */
declare function Prompt(options?: PromptOptions): MethodDecorator;
interface ResourceOptions {
    description?: string;
    mimeType?: string;
    inputClass?: any;
}
interface ResourceOptions {
    description?: string;
    mimeType?: string;
    inputClass?: any;
    uri?: string;
}
/**
 * Marks a method as an MCP resource (data source/endpoint)
 * - Resource URI defaults to ui://classname/methodname (for ext-apps compatibility)
 * - Can be customized with explicit uri option
 *
 * @example
 * class ResourceInput {
 *   @SchemaConstraint({ description: 'Auth token' })
 *   token!: string;
 * }
 *
 * @Resource({
 *   description: 'Service statistics',
 *   mimeType: 'application/json',
 *   inputClass: ResourceInput
 * })
 * getStats(args: ResourceInput) {
 *   // Resource URI will be: "ui://servicename/getStats"
 * }
 */
declare function Resource(options?: ResourceOptions): MethodDecorator;
interface AuthOptions {
    provider: string;
}
/**
 * Adds authentication requirements using a specified provider
 * @example
 * @Auth({ provider: 'clerk' })
 * export class MyService { }
 *
 * @Tool({ description: 'Premium feature' })
 * @Auth({ provider: 'stripe' })
 * async premiumAction() { }
 */
declare function Auth(options: AuthOptions): ClassDecorator & MethodDecorator;
/**
 * Injects environment variables or user-level configuration into the tool instance
 */
declare function UserEnvs(): PropertyDecorator;
/**
 * Property decorator to mark a field as optional in JSON Schema
 *
 * @example
 * class MyInput {
 *   required!: string;
 *
 *   @Optional()
 *   optional?: string;
 * }
 */
/**
 * Links a UI component or frontend visualization to a tool or resource
 * @param component - UI component name
 */
declare function UI(component: string): ClassDecorator & MethodDecorator;
/**
 * Specifies how output should be rendered
 * @param format - Render format ('markdown', 'html', 'json', 'chart', 'table')
 */
declare function Render(format: 'markdown' | 'html' | 'json' | 'chart' | 'table' | string): MethodDecorator;
/**
 * Marks a tool, prompt, or resource as deprecated
 * @param message - Optional deprecation message
 */
declare function Deprecated(message?: string): ClassDecorator & MethodDecorator;
/**
 * Get metadata for a specific method
 */
declare function getMethodMetadata(method: Function): {
    toolName: any;
    toolDescription: any;
    promptName: any;
    promptDescription: any;
    resourceUri: any;
    resourceName: any;
    resourceDescription: any;
    inputSchema: any;
    outputSchema: any;
    authProvider: any;
    authRequired: any;
    uiComponent: any;
    renderFormat: any;
    deprecated: any;
    deprecationMessage: any;
};
/**
 * Get all methods with a specific decorator from a class
 */
declare function getDecoratedMethods(target: any, metadataKey: string): Array<{
    method: Function;
    propertyKey: string;
    metadata: any;
}>;

/**
 * Converts a TypeScript class to JSON Schema
 * Uses reflect-metadata and TypeScript design:type metadata
 */
declare function classToJsonSchema(classConstructor: new () => any): any;
/**
 * Property decorator to mark a field as optional in JSON Schema
 */
declare function Optional(): PropertyDecorator;
/**
 * Property decorator to add JSON Schema constraints
 */
declare function SchemaConstraint(constraints: {
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    pattern?: string;
    enum?: any[];
    description?: string;
    default?: any;
}): PropertyDecorator;
/**
 * Enhanced schema generator that includes constraints
 */
declare function classToJsonSchemaWithConstraints(classConstructor: new () => any): any;

/**
 * Input validation utilities for LeanMCP
 * Provides secure validation for common input types
 */
/**
 * Validates that a port number is within valid range (1-65535)
 *
 * @param port - Port number to validate
 * @throws {Error} If port is invalid
 *
 * @example
 * ```typescript
 * validatePort(3000); // OK
 * validatePort(0);    // Throws error
 * validatePort(70000); // Throws error
 * ```
 */
declare function validatePort(port: number): void;
/**
 * Validates that a file path doesn't contain directory traversal patterns
 * Prevents path traversal attacks by checking for '..' and '~'
 *
 * @param path - File path to validate
 * @throws {Error} If path contains unsafe patterns
 *
 * @example
 * ```typescript
 * validatePath('./services'); // OK
 * validatePath('../etc/passwd'); // Throws error
 * validatePath('~/secrets'); // Throws error
 * ```
 */
declare function validatePath(path: string): void;
/**
 * Validates that a service name contains only safe characters
 * Allows alphanumeric, hyphens, and underscores only
 *
 * @param name - Service name to validate
 * @throws {Error} If name contains unsafe characters
 *
 * @example
 * ```typescript
 * validateServiceName('my-service'); // OK
 * validateServiceName('my_service_123'); // OK
 * validateServiceName('my service'); // Throws error
 * validateServiceName('../malicious'); // Throws error
 * ```
 */
declare function validateServiceName(name: string): void;
/**
 * Validates that a string is not empty or only whitespace
 *
 * @param value - String to validate
 * @param fieldName - Name of the field for error message
 * @throws {Error} If string is empty or only whitespace
 *
 * @example
 * ```typescript
 * validateNonEmpty('hello', 'name'); // OK
 * validateNonEmpty('', 'name'); // Throws error
 * validateNonEmpty('   ', 'name'); // Throws error
 * ```
 */
declare function validateNonEmpty(value: string, fieldName: string): void;
/**
 * Validates that a URL is well-formed and uses allowed protocols
 *
 * @param url - URL to validate
 * @param allowedProtocols - Array of allowed protocols (default: ['http:', 'https:'])
 * @throws {Error} If URL is invalid or uses disallowed protocol
 *
 * @example
 * ```typescript
 * validateUrl('https://example.com'); // OK
 * validateUrl('http://localhost:3000'); // OK
 * validateUrl('file:///etc/passwd'); // Throws error
 * validateUrl('javascript:alert(1)'); // Throws error
 * ```
 */
declare function validateUrl(url: string, allowedProtocols?: string[]): void;

/**
 * MCP Authorization Helpers
 *
 * Utilities for implementing MCP authorization spec in tools.
 * Provides helpers for auth error responses and token verification.
 */
/**
 * Options for creating an auth error response
 */
interface AuthErrorOptions {
    /** URL to the protected resource metadata */
    resourceMetadataUrl: string;
    /** OAuth error code */
    error?: 'invalid_token' | 'expired_token' | 'insufficient_scope';
    /** Human-readable error description */
    errorDescription?: string;
    /** Required scopes that were missing */
    requiredScopes?: string[];
}
/**
 * MCP-compliant auth error result structure
 */
interface AuthErrorResult {
    content: {
        type: 'text';
        text: string;
    }[];
    _meta: {
        'mcp/www_authenticate': string[];
    };
    isError: true;
}
/**
 * Create an MCP-compliant auth error result
 *
 * Returns the proper `_meta["mcp/www_authenticate"]` format that triggers
 * ChatGPT's OAuth linking UI.
 *
 * @example
 * ```typescript
 * @Tool({
 *   description: 'Fetch private data',
 *   securitySchemes: [{ type: 'oauth2', scopes: ['read:private'] }],
 * })
 * async fetchPrivateData(): Promise<any> {
 *   const token = this.getAccessToken();
 *
 *   if (!token) {
 *     return createAuthError('Please authenticate to access this feature', {
 *       resourceMetadataUrl: `${process.env.PUBLIC_URL}/.well-known/oauth-protected-resource`,
 *       error: 'invalid_token',
 *       errorDescription: 'No access token provided',
 *     });
 *   }
 *
 *   // Proceed with authenticated request...
 * }
 * ```
 *
 * @param message - User-facing error message
 * @param options - Auth error options
 * @returns MCP-compliant auth error result
 */
declare function createAuthError(message: string, options: AuthErrorOptions): AuthErrorResult;
/**
 * Check if a result is an auth error
 */
declare function isAuthError(result: unknown): result is AuthErrorResult;
/**
 * Extract access token from Authorization header
 *
 * @param authHeader - The Authorization header value
 * @returns The bearer token, or null if not present/valid
 */
declare function extractBearerToken(authHeader: string | undefined): string | null;
/**
 * Protected Resource Metadata (RFC 9728)
 */
interface ProtectedResourceMetadata {
    /** Canonical resource identifier */
    resource: string;
    /** Authorization servers that can authorize access */
    authorization_servers: string[];
    /** Scopes supported by this resource */
    scopes_supported?: string[];
    /** Resource documentation URL */
    resource_documentation?: string;
}
/**
 * Generate Protected Resource Metadata document
 *
 * @param options - Metadata options
 * @returns RFC 9728 compliant metadata
 */
declare function createProtectedResourceMetadata(options: {
    resource: string;
    authorizationServers?: string[];
    scopesSupported?: string[];
    documentationUrl?: string;
}): ProtectedResourceMetadata;

interface MCPServerOptions {
    servicesDir: string;
    port?: number;
    cors?: boolean;
    logging?: boolean;
}
interface MCPServerConstructorOptions {
    name: string;
    version: string;
    logging?: boolean;
    debug?: boolean;
    autoDiscover?: boolean;
    mcpDir?: string;
    serviceFactories?: Record<string, () => any>;
    port?: number;
    cors?: boolean | {
        origin?: string | string[];
        credentials?: boolean;
    };
    sessionTimeout?: number;
    stateless?: boolean;
    dashboard?: boolean;
    /** OAuth/Auth configuration (MCP authorization spec) - passed to HTTPServerOptions */
    auth?: HTTPServerAuthOptions;
}
interface RegisteredTool {
    name: string;
    description: string;
    inputSchema: any;
    method: Function;
    instance: any;
    propertyKey: string;
    _meta?: Record<string, unknown>;
}
interface RegisteredPrompt {
    name: string;
    description: string;
    arguments: any[];
    method: Function;
    instance: any;
    propertyKey: string;
}
interface RegisteredResource {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
    inputSchema?: any;
    method: Function;
    instance: any;
    propertyKey: string;
}
/**
 * MCPServer - A simplified server class for manually registering services
 * Use this when you want to explicitly instantiate and register your services
 */
declare class MCPServer {
    private server;
    private tools;
    private prompts;
    private resources;
    private logging;
    private logger;
    private options;
    private initPromise;
    private autoDiscovered;
    private manifestWatcher;
    constructor(options: MCPServerConstructorOptions);
    /**
     * Internal initialization - runs automatically in constructor
     */
    private autoInit;
    /**
     * Wait for initialization to complete
     * This is called internally by createHTTPServer
     */
    waitForInit(): Promise<void>;
    /**
     * Automatically discover and register services from the mcp directory
     * Called by init() unless autoDiscover is set to false
     */
    private autoDiscoverServices;
    /**
     * Get the file path of the caller (the file that instantiated MCPServer)
     */
    private getCallerFile;
    private setupHandlers;
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
    autoRegisterServices(mcpDir: string, serviceFactories?: Record<string, () => any>): Promise<void>;
    /**
     * Recursively find all index.ts/index.js files in the mcp directory
     */
    private findServiceFiles;
    /**
     * Load a service file and register all exported classes
     */
    private loadAndRegisterService;
    /**
     * Register a service instance with decorated methods
     */
    registerService(instance: any): void;
    /**
     * Watch UI manifest for changes and reload resources dynamically
     *
     * CRITICAL: Only for stateful mode. In stateless mode, each request
     * creates a fresh server that reads the manifest directly, making
     * watchers both unnecessary and a memory leak source.
     */
    private watchUIManifest;
    /**
     * Reload UI manifest and update resource registrations
     */
    private reloadUIManifest;
    /**
     * Load UI manifest and auto-register resources for pre-built @UIApp components.
     * The manifest is generated by `leanmcp dev` or `leanmcp start` commands.
     */
    private loadUIManifest;
    /**
     * Get the underlying MCP SDK Server instance
     * Attaches waitForInit method for HTTP server initialization
     */
    getServer(): Server<{
        method: string;
        params?: {
            [x: string]: unknown;
            task?: {
                [x: string]: unknown;
                ttl?: number | null | undefined;
                pollInterval?: number | undefined;
            } | undefined;
            _meta?: {
                [x: string]: unknown;
                progressToken?: string | number | undefined;
                "io.modelcontextprotocol/related-task"?: {
                    [x: string]: unknown;
                    taskId: string;
                } | undefined;
            } | undefined;
        } | undefined;
    }, {
        method: string;
        params?: {
            [x: string]: unknown;
            _meta?: {
                [x: string]: unknown;
                "io.modelcontextprotocol/related-task"?: {
                    [x: string]: unknown;
                    taskId: string;
                } | undefined;
            } | undefined;
        } | undefined;
    }, {
        [x: string]: unknown;
        _meta?: {
            [x: string]: unknown;
            "io.modelcontextprotocol/related-task"?: {
                [x: string]: unknown;
                taskId: string;
            } | undefined;
        } | undefined;
    }>;
    /**
     * Clean up all registered services, watchers, and resources
     * CRITICAL for stateless mode to prevent memory leaks
     */
    close(): void;
    /**
     * Cleanup resources (call on server shutdown)
     */
    cleanup(): Promise<void>;
}
declare class MCPServerRuntime {
    private server;
    private tools;
    private prompts;
    private resources;
    private options;
    private logger;
    constructor(options: MCPServerOptions);
    private setupHandlers;
    loadServices(): Promise<void>;
    start(): Promise<void>;
    getServer(): Server<{
        method: string;
        params?: {
            [x: string]: unknown;
            task?: {
                [x: string]: unknown;
                ttl?: number | null | undefined;
                pollInterval?: number | undefined;
            } | undefined;
            _meta?: {
                [x: string]: unknown;
                progressToken?: string | number | undefined;
                "io.modelcontextprotocol/related-task"?: {
                    [x: string]: unknown;
                    taskId: string;
                } | undefined;
            } | undefined;
        } | undefined;
    }, {
        method: string;
        params?: {
            [x: string]: unknown;
            _meta?: {
                [x: string]: unknown;
                "io.modelcontextprotocol/related-task"?: {
                    [x: string]: unknown;
                    taskId: string;
                } | undefined;
            } | undefined;
        } | undefined;
    }, {
        [x: string]: unknown;
        _meta?: {
            [x: string]: unknown;
            "io.modelcontextprotocol/related-task"?: {
                [x: string]: unknown;
                taskId: string;
            } | undefined;
        } | undefined;
    }>;
    getTools(): RegisteredTool[];
    getPrompts(): RegisteredPrompt[];
    getResources(): RegisteredResource[];
}
/**
 * Start MCP server with tools from services directory
 */
declare function startMCPServer(options: MCPServerOptions): Promise<MCPServerRuntime>;

export { Auth, type AuthErrorOptions, type AuthErrorResult, type AuthOptions, Deprecated, type HTTPServerAuthOptions, type HTTPServerInput, type HTTPServerOptions, LogLevel, type LogPayload, Logger, type LoggerHandler, type LoggerOptions, MCPServer, type MCPServerConstructorOptions, type MCPServerFactory, type MCPServerOptions, MCPServerRuntime, Optional, Prompt, type PromptOptions, type ProtectedResourceMetadata, Render, Resource, type ResourceOptions, SchemaConstraint, type SecurityScheme, Tool, type ToolOptions, UI, UserEnvs, classToJsonSchema, classToJsonSchemaWithConstraints, createAuthError, createHTTPServer, createProtectedResourceMetadata, defaultLogger, extractBearerToken, getDecoratedMethods, getMethodMetadata, isAuthError, startMCPServer, validateNonEmpty, validatePath, validatePort, validateServiceName, validateUrl };
