import CryptoKit
import Foundation
import JavaScriptCore
import Security

public struct ProviderInfo: Codable {
    public let id: String
    public let name: String
    public let kind: String
    public let available: Bool
    public let detail: String?
}

public struct AgentClientStatus: Codable {
    public let id: String
    public let name: String
    public let detected: Bool
    public let configured: Bool
    public let config_path: String
    public let skill_path: String?
}

public final class KeychainStore {
    private static let service = "io.github.reverse-engineer-logic.keys"

    public static func setKey(_ value: String, for providerId: String) {
        let account = providerId
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        var addQuery = query
        addQuery[kSecValueData as String] = Data(trimmed.utf8)
        SecItemAdd(addQuery as CFDictionary, nil)
    }

    public static func getKey(for providerId: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: providerId,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        let str = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (str?.isEmpty == false) ? str : nil
    }
}

public final class RelNativeEngine {
    private let jsContext: JSContext

    public init() throws {
        guard let ctx = JSContext() else {
            throw NSError(domain: "RelNativeEngine", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to initialize JavaScriptCore context"])
        }
        self.jsContext = ctx

        let sha256Block: @convention(block) (String) -> String = { input in
            let digest = SHA256.hash(data: Data(input.utf8))
            return digest.map { String(format: "%02x", $0) }.joined()
        }
        ctx.setObject(sha256Block, forKeyedSubscript: "__relSha256Hex" as NSString)

        let jsSource = try Self.loadEmbeddedJsBundle()
        ctx.evaluateScript(jsSource)
        if let exc = ctx.exception {
            throw NSError(domain: "RelNativeEngine", code: 2, userInfo: [NSLocalizedDescriptionKey: "JSC init error: \(exc)"])
        }
    }

    private static func loadEmbeddedJsBundle() throws -> String {
        let execURL = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
        let macosDir = execURL.deletingLastPathComponent()
        let contentsDir = macosDir.deletingLastPathComponent()
        let candidates = [
            Bundle.main.url(forResource: "rel-jsc-core", withExtension: "js"),
            contentsDir.appendingPathComponent("Resources/rel-jsc-core.js"),
            macosDir.appendingPathComponent("../Resources/rel-jsc-core.js"),
            execURL.deletingLastPathComponent().appendingPathComponent("rel-jsc-core.js"),
        ].compactMap { $0 }

        for url in candidates {
            if FileManager.default.fileExists(atPath: url.path) {
                return try String(contentsOf: url, encoding: .utf8)
            }
        }
        throw NSError(domain: "RelNativeEngine", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not locate rel-jsc-core.js in app bundle Resources"])
    }

    public static func loadEmbeddedSkillMarkdown() -> String? {
        let execURL = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
        let contentsDir = execURL.deletingLastPathComponent().deletingLastPathComponent()
        let candidates = [
            Bundle.main.url(forResource: "SKILL", withExtension: "md"),
            contentsDir.appendingPathComponent("Resources/SKILL.md"),
        ].compactMap { $0 }
        for u in candidates where FileManager.default.fileExists(atPath: u.path) {
            return try? String(contentsOf: u, encoding: .utf8)
        }
        return nil
    }

    public func mcpToolsJson() -> String {
        let val = jsContext.evaluateScript("JSON.stringify(globalThis.RELCore.REL_MCP_TOOLS)")
        return val?.toString() ?? "[]"
    }

    public func decompileOnly(text: String, context: String?) throws -> String {
        guard let core = jsContext.objectForKeyedSubscript("RELCore"),
              let res = core.invokeMethod("decompileOnly", withArguments: [text, context ?? NSNull()]) else {
            throw NSError(domain: "RelNativeEngine", code: 4, userInfo: [NSLocalizedDescriptionKey: "decompileOnly failed"])
        }
        if let exc = jsContext.exception {
            jsContext.exception = nil
            throw NSError(domain: "RelNativeEngine", code: 5, userInfo: [NSLocalizedDescriptionKey: "\(exc)"])
        }
        return res.toString() ?? "{}"
    }

    public func compareOnly(left: String, right: String) throws -> String {
        guard let core = jsContext.objectForKeyedSubscript("RELCore"),
              let res = core.invokeMethod("compareOnly", withArguments: [left, right]) else {
            throw NSError(domain: "RelNativeEngine", code: 6, userInfo: [NSLocalizedDescriptionKey: "compareOnly failed"])
        }
        if let exc = jsContext.exception {
            jsContext.exception = nil
            throw NSError(domain: "RelNativeEngine", code: 7, userInfo: [NSLocalizedDescriptionKey: "\(exc)"])
        }
        return res.toString() ?? "{}"
    }

    public func verifyBundleJson(_ json: String) throws -> String {
        guard let core = jsContext.objectForKeyedSubscript("RELCore"),
              let res = core.invokeMethod("verifyBundleJson", withArguments: [json]) else {
            throw NSError(domain: "RelNativeEngine", code: 8, userInfo: [NSLocalizedDescriptionKey: "verifyBundleJson failed"])
        }
        return res.toString() ?? "{}"
    }

    public static func findExecutable(_ name: String) -> String? {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let envPath = ProcessInfo.processInfo.environment["PATH"] ?? ""
        var dirs = [
            "\(home)/.local/bin",
            "/opt/homebrew/bin",
            "/usr/local/bin",
        ]
        dirs.append(contentsOf: envPath.split(separator: ":").map(String.init))
        for d in dirs {
            let full = "\(d)/\(name)"
            if FileManager.default.isExecutableFile(atPath: full) {
                return full
            }
        }
        return nil
    }

    public static func resolvedApiKey(providerId: String, envNames: [String]) -> String? {
        for e in envNames {
            if let v = ProcessInfo.processInfo.environment[e], !v.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return v.trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        return KeychainStore.getKey(for: providerId)
    }

    public static func detectProviders() -> [ProviderInfo] {
        var list: [ProviderInfo] = []
        let apiSpecs: [(String, String, [String])] = [
            ("anthropic", "Anthropic Claude API", ["ANTHROPIC_API_KEY"]),
            ("gemini", "Google Gemini API", ["GEMINI_API_KEY", "GOOGLE_API_KEY"]),
            ("xai", "xAI Grok API", ["XAI_API_KEY"]),
            ("deepseek", "DeepSeek API", ["DEEPSEEK_API_KEY"]),
            ("mistral", "Mistral Large API", ["MISTRAL_API_KEY"]),
            ("openrouter", "OpenRouter Multi-Model API", ["OPENROUTER_API_KEY"]),
        ]
        for (id, name, envs) in apiSpecs {
            let has = resolvedApiKey(providerId: id, envNames: envs) != nil
            list.append(ProviderInfo(id: id, name: name, kind: "api", available: has, detail: has ? "API key configured" : "Set key in Providers tab or env"))
        }

        let ollamaModel = UserDefaults.standard.string(forKey: "rel_ollama_model")
            ?? ProcessInfo.processInfo.environment["REL_OLLAMA_MODEL"]
            ?? ProcessInfo.processInfo.environment["OLLAMA_MODEL"]
        let ollamaAvailable = (ollamaModel != nil && !ollamaModel!.isEmpty) || findExecutable("ollama") != nil
        list.append(ProviderInfo(id: "ollama", name: "Ollama Local Runtime", kind: "local-http", available: ollamaAvailable, detail: ollamaModel ?? "http://127.0.0.1:11434"))

        if let p = findExecutable("claude"), ProcessInfo.processInfo.environment["REL_INSIDE_CLAUDE"] != "1" {
            list.append(ProviderInfo(id: "claude-cli", name: "Claude Code Local CLI", kind: "cli", available: true, detail: p))
        }
        if let p = findExecutable("gemini"), ProcessInfo.processInfo.environment["REL_INSIDE_GEMINI"] != "1" {
            list.append(ProviderInfo(id: "gemini-cli", name: "Gemini Local CLI", kind: "cli", available: true, detail: p))
        }
        if let p = findExecutable("agy"), ProcessInfo.processInfo.environment["REL_INSIDE_AGY"] != "1" {
            list.append(ProviderInfo(id: "agy", name: "Antigravity Local CLI", kind: "cli", available: true, detail: p))
        }

        list.append(ProviderInfo(id: "builtin", name: "Built-in Deterministic Pragmatic & Game-Theoretic Engine", kind: "offline", available: true, detail: "Instant (<50ms), 100% offline"))
        return list
    }

    public func analyze(text: String, context: String?, requestedProvider: String = "auto") async throws -> String {
        var opts: [String: Any] = [:]
        if let c = context, !c.isEmpty { opts["context"] = c }

        guard let core = jsContext.objectForKeyedSubscript("RELCore"),
              let prepVal = core.invokeMethod("prepareInvestigation", withArguments: [text, opts]),
              let prepJson = prepVal.toString() else {
            throw NSError(domain: "RelNativeEngine", code: 10, userInfo: [NSLocalizedDescriptionKey: "prepareInvestigation failed"])
        }
        if let exc = jsContext.exception {
            jsContext.exception = nil
            throw NSError(domain: "RelNativeEngine", code: 11, userInfo: [NSLocalizedDescriptionKey: "\(exc)"])
        }

        guard let prepObj = try JSONSerialization.jsonObject(with: Data(prepJson.utf8)) as? [String: Any],
              let prompt = prepObj["prompt"] as? String else {
            throw NSError(domain: "RelNativeEngine", code: 12, userInfo: [NSLocalizedDescriptionKey: "Missing prompt in prepared state"])
        }

        let providers = Self.detectProviders()
        let chosen: ProviderInfo
        if requestedProvider == "auto" || requestedProvider.isEmpty {
            chosen = providers.first(where: { $0.available && $0.id != "builtin" }) ?? providers.last!
        } else if let m = providers.first(where: { $0.id == requestedProvider && $0.available }) {
            chosen = m
        } else {
            chosen = providers.last!
        }

        if chosen.id == "builtin" {
            guard let fin = core.invokeMethod("finalizeInvestigation", withArguments: [prepJson, NSNull(), "builtin", chosen.name, false]),
                  let out = fin.toString() else {
                throw NSError(domain: "RelNativeEngine", code: 13, userInfo: [NSLocalizedDescriptionKey: "finalizeInvestigation failed"])
            }
            return out
        }

        var rawModelText: String? = nil
        do {
            rawModelText = try await Self.invokeNeuralProvider(chosen, prompt: prompt)
        } catch {
            rawModelText = nil
        }

        let isNeural = (rawModelText != nil && !rawModelText!.isEmpty)
        guard let fin = core.invokeMethod(
            "finalizeInvestigation",
            withArguments: [
                prepJson,
                rawModelText ?? NSNull(),
                isNeural ? chosen.id : "builtin-fallback",
                chosen.name,
                isNeural,
            ]
        ), let out = fin.toString() else {
            throw NSError(domain: "RelNativeEngine", code: 14, userInfo: [NSLocalizedDescriptionKey: "finalizeInvestigation failed"])
        }
        return out
    }

    private static func invokeNeuralProvider(_ provider: ProviderInfo, prompt: String) async throws -> String {
        switch provider.id {
        case "anthropic":
            guard let key = resolvedApiKey(providerId: "anthropic", envNames: ["ANTHROPIC_API_KEY"]) else {
                throw URLError(.userAuthenticationRequired)
            }
            let model = ProcessInfo.processInfo.environment["REL_ANTHROPIC_MODEL"] ?? "claude-sonnet-4-20250514"
            var req = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
            req.httpMethod = "POST"
            req.timeoutInterval = 120
            req.setValue("application/json", forHTTPHeaderField: "content-type")
            req.setValue(key, forHTTPHeaderField: "x-api-key")
            req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
            req.httpBody = try JSONSerialization.data(withJSONObject: [
                "model": model,
                "max_tokens": 8192,
                "messages": [["role": "user", "content": prompt]],
            ])
            let (data, _) = try await URLSession.shared.data(for: req)
            let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            let content = obj?["content"] as? [[String: Any]] ?? []
            return content.compactMap { $0["text"] as? String }.joined(separator: "\n")

        case "gemini":
            guard let key = resolvedApiKey(providerId: "gemini", envNames: ["GEMINI_API_KEY", "GOOGLE_API_KEY"]) else {
                throw URLError(.userAuthenticationRequired)
            }
            let model = ProcessInfo.processInfo.environment["REL_GEMINI_MODEL"] ?? "gemini-2.5-pro"
            var req = URLRequest(url: URL(string: "https://generativelanguage.googleapis.com/v1beta/models/\(model):generateContent?key=\(key)")!)
            req.httpMethod = "POST"
            req.timeoutInterval = 120
            req.setValue("application/json", forHTTPHeaderField: "content-type")
            req.httpBody = try JSONSerialization.data(withJSONObject: [
                "contents": [["parts": [["text": prompt]]]],
                "generationConfig": ["responseMimeType": "application/json"],
            ])
            let (data, _) = try await URLSession.shared.data(for: req)
            let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            let cands = obj?["candidates"] as? [[String: Any]]
            let parts = (cands?.first?["content"] as? [String: Any])?["parts"] as? [[String: Any]] ?? []
            return parts.compactMap { $0["text"] as? String }.joined(separator: "\n")

        case "xai", "deepseek", "mistral", "openrouter":
            let cfg: (String, [String], String) = {
                switch provider.id {
                case "xai": return ("https://api.x.ai/v1/chat/completions", ["XAI_API_KEY"], "grok-3")
                case "deepseek": return ("https://api.deepseek.com/chat/completions", ["DEEPSEEK_API_KEY"], "deepseek-chat")
                case "mistral": return ("https://api.mistral.com/v1/chat/completions", ["MISTRAL_API_KEY"], "mistral-large-latest")
                default: return ("https://openrouter.ai/api/v1/chat/completions", ["OPENROUTER_API_KEY"], "anthropic/claude-sonnet-4")
                }
            }()
            guard let key = resolvedApiKey(providerId: provider.id, envNames: cfg.1) else {
                throw URLError(.userAuthenticationRequired)
            }
            var req = URLRequest(url: URL(string: cfg.0)!)
            req.httpMethod = "POST"
            req.timeoutInterval = 120
            req.setValue("application/json", forHTTPHeaderField: "content-type")
            req.setValue("Bearer \(key)", forHTTPHeaderField: "authorization")
            req.httpBody = try JSONSerialization.data(withJSONObject: [
                "model": cfg.2,
                "response_format": ["type": "json_object"],
                "messages": [["role": "user", "content": prompt]],
            ])
            let (data, _) = try await URLSession.shared.data(for: req)
            let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            let choices = obj?["choices"] as? [[String: Any]]
            let msg = choices?.first?["message"] as? [String: Any]
            return msg?["content"] as? String ?? ""

        case "ollama":
            let host = UserDefaults.standard.string(forKey: "rel_ollama_host")
                ?? ProcessInfo.processInfo.environment["OLLAMA_HOST"]
                ?? "http://127.0.0.1:11434"
            let model = UserDefaults.standard.string(forKey: "rel_ollama_model")
                ?? ProcessInfo.processInfo.environment["REL_OLLAMA_MODEL"]
                ?? ProcessInfo.processInfo.environment["OLLAMA_MODEL"]
                ?? "llama3.3"
            var req = URLRequest(url: URL(string: "\(host.trimmingCharacters(in: CharacterSet(charactersIn: "/")))/api/chat")!)
            req.httpMethod = "POST"
            req.timeoutInterval = 120
            req.setValue("application/json", forHTTPHeaderField: "content-type")
            req.httpBody = try JSONSerialization.data(withJSONObject: [
                "model": model,
                "format": "json",
                "stream": false,
                "messages": [["role": "user", "content": prompt]],
            ])
            let (data, _) = try await URLSession.shared.data(for: req)
            let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            return (obj?["message"] as? [String: Any])?["content"] as? String ?? ""

        case "claude-cli", "gemini-cli", "agy":
            guard let bin = provider.detail else { throw URLError(.fileDoesNotExist) }
            let args: [String]
            var extraEnv: [String: String] = [:]
            if provider.id == "claude-cli" {
                args = ["-p", prompt, "--output-format", "json"]
                extraEnv["REL_INSIDE_CLAUDE"] = "1"
            } else if provider.id == "gemini-cli" {
                args = ["-p", prompt]
                extraEnv["REL_INSIDE_GEMINI"] = "1"
            } else {
                args = ["--disable-slash-commands", "--effort=medium", "--print-timeout=90s", "-p=\(prompt)"]
                extraEnv["REL_INSIDE_AGY"] = "1"
            }
            return try await runSubprocess(executable: bin, arguments: args, extraEnv: extraEnv)

        default:
            throw URLError(.unsupportedURL)
        }
    }

    private static func runSubprocess(executable: String, arguments: [String], extraEnv: [String: String]) async throws -> String {
        try await withCheckedThrowingContinuation { cont in
            let proc = Process()
            proc.executableURL = URL(fileURLWithPath: executable)
            proc.arguments = arguments
            var env = ProcessInfo.processInfo.environment
            for (k, v) in extraEnv { env[k] = v }
            proc.environment = env
            proc.standardInput = FileHandle.nullDevice
            let outPipe = Pipe()
            proc.standardOutput = outPipe
            proc.standardError = FileHandle.nullDevice
            proc.terminationHandler = { _ in
                let data = outPipe.fileHandleForReading.readDataToEndOfFile()
                cont.resume(returning: String(data: data, encoding: .utf8) ?? "")
            }
            do {
                try proc.run()
            } catch {
                cont.resume(throwing: error)
            }
        }
    }

    // MARK: - REA-Style Multi-Agent Client Detection & Registration

    public static func resolvedMcpBinaryPath() -> String {
        let execURL = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
        let siblingRel = execURL.deletingLastPathComponent().appendingPathComponent("rel")
        if FileManager.default.isExecutableFile(atPath: siblingRel.path) {
            return siblingRel.path
        }
        if FileManager.default.isExecutableFile(atPath: "/Applications/Reverse Engineer Logic.app/Contents/MacOS/rel") {
            return "/Applications/Reverse Engineer Logic.app/Contents/MacOS/rel"
        }
        return execURL.path
    }

    private struct ClientSpec {
        let id: String
        let name: String
        let format: String
        let configPath: String
        let detectPaths: [String]
        let skillDir: String?
    }

    private static func clientCatalog() -> [ClientSpec] {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let appSup = "\(home)/Library/Application Support"
        return [
            ClientSpec(id: "claude-desktop", name: "Claude Desktop", format: "mcpServers", configPath: "\(appSup)/Claude/claude_desktop_config.json", detectPaths: ["\(appSup)/Claude", "/Applications/Claude.app"], skillDir: nil),
            ClientSpec(id: "claude-code", name: "Claude Code", format: "mcpServers", configPath: "\(home)/.claude.json", detectPaths: ["\(home)/.claude", "\(home)/.claude.json"], skillDir: "\(home)/.claude/skills/reverse-engineer-logic"),
            ClientSpec(id: "cursor", name: "Cursor", format: "mcpServers", configPath: "\(home)/.cursor/mcp.json", detectPaths: ["\(home)/.cursor", "/Applications/Cursor.app"], skillDir: "\(home)/.cursor/skills/reverse-engineer-logic"),
            ClientSpec(id: "antigravity", name: "Google Antigravity", format: "mcpServers", configPath: "\(home)/.gemini/config/mcp_config.json", detectPaths: ["\(home)/.gemini/config", "\(home)/.gemini/antigravity", "/Applications/Antigravity.app"], skillDir: "\(home)/.gemini/config/skills/reverse-engineer-logic"),
            ClientSpec(id: "gemini-cli", name: "Gemini CLI", format: "mcpServers", configPath: "\(home)/.gemini/settings.json", detectPaths: ["\(home)/.gemini/settings.json", "\(home)/.gemini/skills"], skillDir: "\(home)/.gemini/skills/reverse-engineer-logic"),
            ClientSpec(id: "windsurf", name: "Windsurf", format: "mcpServers", configPath: "\(home)/.codeium/windsurf/mcp_config.json", detectPaths: ["\(home)/.codeium/windsurf", "/Applications/Windsurf.app"], skillDir: nil),
            ClientSpec(id: "vscode", name: "VS Code (MCP)", format: "vscode", configPath: "\(appSup)/Code/User/mcp.json", detectPaths: ["\(appSup)/Code/User", "/Applications/Visual Studio Code.app"], skillDir: nil),
            ClientSpec(id: "zed", name: "Zed", format: "zed", configPath: "\(home)/.config/zed/settings.json", detectPaths: ["\(home)/.config/zed", "/Applications/Zed.app"], skillDir: nil),
            ClientSpec(id: "cline", name: "Cline", format: "mcpServers", configPath: "\(appSup)/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json", detectPaths: ["\(appSup)/Code/User/globalStorage/saoudrizwan.claude-dev"], skillDir: nil),
            ClientSpec(id: "opencode", name: "OpenCode", format: "opencode", configPath: "\(home)/.config/opencode/opencode.json", detectPaths: ["\(home)/.config/opencode"], skillDir: nil),
        ]
    }

    public static func inspectClients() -> [AgentClientStatus] {
        let fm = FileManager.default
        return clientCatalog().map { spec in
            let detected = spec.detectPaths.contains { fm.fileExists(atPath: $0) }
            var configured = false
            if let data = try? Data(contentsOf: URL(fileURLWithPath: spec.configPath)),
               let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                switch spec.format {
                case "mcpServers":
                    configured = (obj["mcpServers"] as? [String: Any])?["rel"] != nil
                case "vscode":
                    configured = (obj["servers"] as? [String: Any])?["rel"] != nil
                case "zed":
                    configured = (obj["context_servers"] as? [String: Any])?["rel"] != nil
                case "opencode":
                    configured = (obj["mcp"] as? [String: Any])?["rel"] != nil
                default:
                    break
                }
            }
            return AgentClientStatus(
                id: spec.id,
                name: spec.name,
                detected: detected,
                configured: configured,
                config_path: spec.configPath,
                skill_path: spec.skillDir.map { "\($0)/SKILL.md" }
            )
        }
    }

    public static func configureClients(ids: Set<String>?, allDetected: Bool) throws -> Int {
        let fm = FileManager.default
        let relBin = resolvedMcpBinaryPath()
        let statuses = inspectClients()
        let targetIds: Set<String> = allDetected
            ? Set(statuses.filter { $0.detected }.map { $0.id })
            : (ids ?? [])

        let skillMd = loadEmbeddedSkillMarkdown()
        var count = 0

        for spec in clientCatalog() where targetIds.contains(spec.id) {
            let cfgURL = URL(fileURLWithPath: spec.configPath)
            try fm.createDirectory(at: cfgURL.deletingLastPathComponent(), withIntermediateDirectories: true)

            var root: [String: Any] = [:]
            if fm.fileExists(atPath: spec.configPath),
               let existing = try? Data(contentsOf: cfgURL),
               let parsed = try? JSONSerialization.jsonObject(with: existing) as? [String: Any] {
                root = parsed
                try? existing.write(to: URL(fileURLWithPath: "\(spec.configPath).rel-backup"))
            }

            switch spec.format {
            case "mcpServers":
                var servers = root["mcpServers"] as? [String: Any] ?? [:]
                servers["rel"] = ["command": relBin, "args": ["mcp"]]
                root["mcpServers"] = servers
            case "vscode":
                var servers = root["servers"] as? [String: Any] ?? [:]
                servers["rel"] = ["type": "stdio", "command": relBin, "args": ["mcp"]]
                root["servers"] = servers
            case "zed":
                var servers = root["context_servers"] as? [String: Any] ?? [:]
                servers["rel"] = ["command": ["path": relBin, "args": ["mcp"]]]
                root["context_servers"] = servers
            case "opencode":
                var servers = root["mcp"] as? [String: Any] ?? [:]
                servers["rel"] = ["type": "local", "command": [relBin, "mcp"], "enabled": true]
                root["mcp"] = servers
            default:
                break
            }

            let outData = try JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted, .sortedKeys])
            try outData.write(to: cfgURL)

            if let sDir = spec.skillDir, let md = skillMd {
                try fm.createDirectory(atPath: sDir, withIntermediateDirectories: true)
                try md.write(toFile: "\(sDir)/SKILL.md", atomically: true, encoding: .utf8)
            }
            count += 1
        }
        return count
    }
}
