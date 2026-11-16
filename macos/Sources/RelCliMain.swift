import Foundation

@main
struct RelNativeCli {
    static func main() async {
        let args = Array(CommandLine.arguments.dropFirst())
        let cmd = args.first ?? "help"

        if cmd == "mcp" || cmd == "--mcp" {
            await runMcpLoop()
            return
        }

        if cmd == "-v" || cmd == "--version" || cmd == "version" {
            print("reverse-engineer-logic 1.0.0 (macOS native universal)")
            return
        }

        if cmd == "-h" || cmd == "--help" || cmd == "help" {
            print("""
            Reverse Engineer Logic (rel v1.0.0 - macOS Native Universal)
            Discern the motivation and logic behind any message, document, or situation.

            Usage:
              rel analyze [text] [--context C] [--provider P] [--fast] [--format markdown|json]
              rel decompile [text]
              rel compare --left "V1" --right "V2"
              rel verify <evidence-bundle.json>
              rel setup [--all-detected]
              rel doctor [--json]
              rel mcp
            """)
            return
        }

        do {
            let engine = try RelNativeEngine()
            switch cmd {
            case "doctor":
                let providers = RelNativeEngine.detectProviders()
                let clients = RelNativeEngine.inspectClients()
                if args.contains("--json") {
                    struct Doc: Codable {
                        let healthy: Bool
                        let version: String
                        let providers: [ProviderInfo]
                        let agent_clients: [AgentClientStatus]
                    }
                    let data = try JSONEncoder().encode(Doc(healthy: true, version: "1.0.0", providers: providers, agent_clients: clients))
                    print(String(data: data, encoding: .utf8) ?? "{}")
                } else {
                    print("Reverse Engineer Logic (rel v1.0.0 Native) - HEALTHY")
                    print("  Providers:")
                    for p in providers where p.available {
                        print("    - \(p.id.padding(toLength: 12, withPad: " ", startingAt: 0)) : \(p.name)")
                    }
                    print("  AI Agent Clients:")
                    for c in clients {
                        let st = c.configured ? "CONFIGURED" : (c.detected ? "DETECTED" : "not installed")
                        print("    - \(c.id.padding(toLength: 15, withPad: " ", startingAt: 0)) : \(st)")
                    }
                }

            case "setup":
                let count = try RelNativeEngine.configureClients(ids: nil, allDetected: true)
                print("Configured \(count) detected AI agent client(s) with native rel MCP server.")

            case "decompile":
                let text = args.dropFirst().joined(separator: " ")
                guard !text.isEmpty else { throw NSError(domain: "CLI", code: 1, userInfo: [NSLocalizedDescriptionKey: "Provide text to decompile."]) }
                print(try engine.decompileOnly(text: text, context: nil))

            case "compare":
                var left = ""
                var right = ""
                var i = 1
                while i < args.count {
                    if args[i] == "--left", i + 1 < args.count { left = args[i + 1]; i += 2 }
                    else if args[i] == "--right", i + 1 < args.count { right = args[i + 1]; i += 2 }
                    else { i += 1 }
                }
                print(try engine.compareOnly(left: left, right: right))

            case "verify":
                guard args.count >= 2 else { throw NSError(domain: "CLI", code: 2, userInfo: [NSLocalizedDescriptionKey: "Usage: rel verify <bundle.json>"]) }
                let json = try String(contentsOfFile: args[1], encoding: .utf8)
                print(try engine.verifyBundleJson(json))

            case "analyze", "expound":
                var provider = "auto"
                var context: String? = nil
                var format = "markdown"
                var words: [String] = []
                var i = 1
                while i < args.count {
                    let a = args[i]
                    if a == "--fast" { provider = "builtin"; i += 1 }
                    else if (a == "-p" || a == "--provider"), i + 1 < args.count { provider = args[i + 1]; i += 2 }
                    else if (a == "-c" || a == "--context"), i + 1 < args.count { context = args[i + 1]; i += 2 }
                    else if a == "--format", i + 1 < args.count { format = args[i + 1]; i += 2 }
                    else if a == "-f" || a == "--file", i + 1 < args.count {
                        words.append(try String(contentsOfFile: args[i + 1], encoding: .utf8))
                        i += 2
                    } else {
                        words.append(a); i += 1
                    }
                }
                let text = words.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
                guard !text.isEmpty else { throw NSError(domain: "CLI", code: 3, userInfo: [NSLocalizedDescriptionKey: "Provide text or --file."]) }
                let bundleJson = try await engine.analyze(text: text, context: context, requestedProvider: provider)
                if format == "json" {
                    print(bundleJson)
                } else if let obj = try JSONSerialization.jsonObject(with: Data(bundleJson.utf8)) as? [String: Any],
                          let md = obj["markdown_report"] as? String {
                    print(md)
                } else {
                    print(bundleJson)
                }

            default:
                throw NSError(domain: "CLI", code: 4, userInfo: [NSLocalizedDescriptionKey: "Unknown command '\(cmd)'. Run 'rel --help'."])
            }
        } catch {
            FileHandle.standardError.write(Data("Error: \(error.localizedDescription)\n".utf8))
            Foundation.exit(1)
        }
    }

    static func runMcpLoop() async {
        guard let engine = try? RelNativeEngine() else { return }
        let toolsJson = engine.mcpToolsJson()
        let toolsArray = (try? JSONSerialization.jsonObject(with: Data(toolsJson.utf8))) ?? []

        while let line = readLine(strippingNewline: true) {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { continue }
            guard let msg = (try? JSONSerialization.jsonObject(with: Data(trimmed.utf8))) as? [String: Any] else { continue }
            guard let id = msg["id"], !(id is NSNull) else { continue }
            let method = msg["method"] as? String ?? ""
            let params = msg["params"] as? [String: Any] ?? [:]

            var response: [String: Any] = ["jsonrpc": "2.0", "id": id]
            do {
                switch method {
                case "initialize":
                    let proto = params["protocolVersion"] as? String ?? "2024-11-05"
                    response["result"] = [
                        "protocolVersion": proto,
                        "capabilities": ["tools": [String: Any]()],
                        "serverInfo": ["name": "reverse-engineer-logic", "version": "1.0.0"],
                    ]
                case "ping":
                    response["result"] = [String: Any]()
                case "tools/list":
                    response["result"] = ["tools": toolsArray]
                case "resources/list":
                    response["result"] = ["resources": [Any]()]
                case "prompts/list":
                    response["result"] = ["prompts": [Any]()]
                case "tools/call":
                    let tName = params["name"] as? String ?? ""
                    let tArgs = params["arguments"] as? [String: Any] ?? [:]
                    let outJson: String
                    switch tName {
                    case "expound_situation_or_message", "open_subject":
                        let txt = tArgs["text"] as? String ?? ""
                        let ctx = tArgs["context"] as? String
                        let prov = tArgs["provider"] as? String ?? "auto"
                        outJson = try await engine.analyze(text: txt, context: ctx, requestedProvider: prov)
                    case "compare_messages_or_framings":
                        let l = tArgs["left_text"] as? String ?? ""
                        let r = tArgs["right_text"] as? String ?? ""
                        outJson = try engine.compareOnly(left: l, right: r)
                    default:
                        outJson = "{\"status\":\"ok\",\"note\":\"Use expound_situation_or_message or compare_messages_or_framings on native MCP.\"}"
                    }
                    let parsed = (try? JSONSerialization.jsonObject(with: Data(outJson.utf8))) ?? [String: Any]()
                    response["result"] = [
                        "content": [["type": "text", "text": outJson]],
                        "structuredContent": parsed,
                        "isError": false,
                    ]
                default:
                    response["error"] = ["code": -32601, "message": "Method not found: \(method)"]
                }
            } catch {
                response["result"] = [
                    "content": [["type": "text", "text": "{\"error\":\"\(error.localizedDescription)\"}"]],
                    "isError": true,
                ]
            }

            if let outData = try? JSONSerialization.data(withJSONObject: response),
               let outStr = String(data: outData, encoding: .utf8) {
                FileHandle.standardOutput.write(Data((outStr + "\n").utf8))
            }
        }
    }
}
