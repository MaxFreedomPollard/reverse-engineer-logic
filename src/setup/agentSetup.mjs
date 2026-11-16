import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

/**
 * Multi-Agent / Multi-Client MCP & Skill Setup Engine (modeled directly on REA's `rea setup` & `rea doctor`).
 * Detects, configures, backs up, and verifies all major AI agent clients on macOS & Linux:
 *   1. Claude Desktop
 *   2. Claude Code
 *   3. Cursor
 *   4. Antigravity
 *   5. Gemini CLI
 *   6. Windsurf
 *   7. VS Code (GitHub Copilot MCP)
 *   8. Zed
 *   9. Cline (VS Code extension)
 *  10. OpenCode
 */
export function getAgentClientCatalog(home = homedir(), platform = process.platform) {
  const isMac = platform === "darwin";
  const appSupport = isMac
    ? join(home, "Library", "Application Support")
    : join(home, ".config");

  return [
    {
      id: "claude-desktop",
      name: "Claude Desktop",
      format: "mcpServers-json",
      configPath: join(appSupport, "Claude", "claude_desktop_config.json"),
      detectPaths: [join(appSupport, "Claude"), isMac ? "/Applications/Claude.app" : ""].filter(Boolean),
      skillDir: null,
    },
    {
      id: "claude-code",
      name: "Claude Code",
      format: "mcpServers-json",
      configPath: join(home, ".claude.json"),
      detectPaths: [join(home, ".claude"), join(home, ".claude.json")],
      skillDir: join(home, ".claude", "skills", "reverse-engineer-logic"),
    },
    {
      id: "cursor",
      name: "Cursor",
      format: "mcpServers-json",
      configPath: join(home, ".cursor", "mcp.json"),
      detectPaths: [join(home, ".cursor"), isMac ? "/Applications/Cursor.app" : ""].filter(Boolean),
      skillDir: join(home, ".cursor", "skills", "reverse-engineer-logic"),
    },
    {
      id: "antigravity",
      name: "Google Antigravity",
      format: "mcpServers-json",
      configPath: join(home, ".gemini", "config", "mcp_config.json"),
      detectPaths: [
        join(home, ".gemini", "config"),
        join(home, ".gemini", "antigravity"),
        isMac ? "/Applications/Antigravity.app" : "",
      ].filter(Boolean),
      skillDir: join(home, ".gemini", "config", "skills", "reverse-engineer-logic"),
    },
    {
      id: "gemini-cli",
      name: "Gemini CLI",
      format: "mcpServers-json",
      configPath: join(home, ".gemini", "settings.json"),
      detectPaths: [join(home, ".gemini", "settings.json"), join(home, ".gemini", "skills")],
      skillDir: join(home, ".gemini", "skills", "reverse-engineer-logic"),
    },
    {
      id: "windsurf",
      name: "Windsurf",
      format: "mcpServers-json",
      configPath: join(home, ".codeium", "windsurf", "mcp_config.json"),
      detectPaths: [join(home, ".codeium", "windsurf"), isMac ? "/Applications/Windsurf.app" : ""].filter(Boolean),
      skillDir: null,
    },
    {
      id: "vscode",
      name: "VS Code (MCP)",
      format: "vscode-servers-json",
      configPath: join(appSupport, "Code", "User", "mcp.json"),
      detectPaths: [join(appSupport, "Code", "User"), isMac ? "/Applications/Visual Studio Code.app" : ""].filter(Boolean),
      skillDir: null,
    },
    {
      id: "zed",
      name: "Zed",
      format: "zed-context-servers-json",
      configPath: join(home, ".config", "zed", "settings.json"),
      detectPaths: [join(home, ".config", "zed"), isMac ? "/Applications/Zed.app" : ""].filter(Boolean),
      skillDir: null,
    },
    {
      id: "cline",
      name: "Cline",
      format: "mcpServers-json",
      configPath: join(
        appSupport,
        "Code",
        "User",
        "globalStorage",
        "saoudrizwan.claude-dev",
        "settings",
        "cline_mcp_settings.json"
      ),
      detectPaths: [join(appSupport, "Code", "User", "globalStorage", "saoudrizwan.claude-dev")],
      skillDir: null,
    },
    {
      id: "opencode",
      name: "OpenCode",
      format: "opencode-mcp-json",
      configPath: join(home, ".config", "opencode", "opencode.json"),
      detectPaths: [join(home, ".config", "opencode")],
      skillDir: null,
    },
  ];
}

export function inspectAgentClients({ launcherCommand, launcherArgs = ["mcp"], home = homedir() } = {}) {
  const catalog = getAgentClientCatalog(home);
  return catalog.map((client) => {
    const detected = client.detectPaths.some((p) => existsSync(p));
    let configured = false;
    let currentEntry = null;
    let parseError = null;

    if (existsSync(client.configPath)) {
      try {
        const raw = readFileSync(client.configPath, "utf8").trim();
        const parsed = raw ? JSON.parse(raw) : {};
        if (client.format === "mcpServers-json") {
          currentEntry = parsed?.mcpServers?.rel || parsed?.mcpServers?.["reverse-engineer-logic"] || null;
        } else if (client.format === "vscode-servers-json") {
          currentEntry = parsed?.servers?.rel || parsed?.servers?.["reverse-engineer-logic"] || null;
        } else if (client.format === "zed-context-servers-json") {
          currentEntry = parsed?.context_servers?.rel || null;
        } else if (client.format === "opencode-mcp-json") {
          currentEntry = parsed?.mcp?.rel || null;
        }
        configured = Boolean(currentEntry);
      } catch (e) {
        parseError = e.message;
      }
    }

    const skillInstalled = client.skillDir ? existsSync(join(client.skillDir, "SKILL.md")) : null;

    return {
      id: client.id,
      name: client.name,
      detected,
      configured,
      skill_installed: skillInstalled,
      config_path: client.configPath,
      skill_dir: client.skillDir,
      current_entry: currentEntry,
      parse_error: parseError,
      recommended_launcher: launcherCommand ? { command: launcherCommand, args: launcherArgs } : null,
    };
  });
}

export function configureAgentClients({
  clientIds = [],
  allDetected = false,
  launcherCommand,
  launcherArgs = ["mcp"],
  skillMarkdownContent = null,
  dryRun = false,
  home = homedir(),
}) {
  const catalog = getAgentClientCatalog(home);
  const statuses = inspectAgentClients({ launcherCommand, launcherArgs, home });
  const selectedIds = new Set(
    allDetected
      ? statuses.filter((s) => s.detected).map((s) => s.id)
      : clientIds
  );

  const actions = [];
  for (const client of catalog) {
    if (!selectedIds.has(client.id)) continue;

    let doc = {};
    const existed = existsSync(client.configPath);
    if (existed) {
      const raw = readFileSync(client.configPath, "utf8").trim();
      doc = raw ? JSON.parse(raw) : {};
    }

    if (client.format === "mcpServers-json") {
      doc.mcpServers = doc.mcpServers && typeof doc.mcpServers === "object" ? doc.mcpServers : {};
      doc.mcpServers.rel = { command: launcherCommand, args: launcherArgs };
    } else if (client.format === "vscode-servers-json") {
      doc.servers = doc.servers && typeof doc.servers === "object" ? doc.servers : {};
      doc.servers.rel = { type: "stdio", command: launcherCommand, args: launcherArgs };
    } else if (client.format === "zed-context-servers-json") {
      doc.context_servers = doc.context_servers && typeof doc.context_servers === "object" ? doc.context_servers : {};
      doc.context_servers.rel = { command: { path: launcherCommand, args: launcherArgs } };
    } else if (client.format === "opencode-mcp-json") {
      doc.mcp = doc.mcp && typeof doc.mcp === "object" ? doc.mcp : {};
      doc.mcp.rel = { type: "local", command: [launcherCommand, ...launcherArgs], enabled: true };
    }

    let backupPath = null;
    if (!dryRun) {
      mkdirSync(dirname(client.configPath), { recursive: true });
      if (existed) {
        backupPath = `${client.configPath}.rel-backup`;
        copyFileSync(client.configPath, backupPath);
      }
      writeFileSync(client.configPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
    }

    let skillPath = null;
    if (client.skillDir && skillMarkdownContent) {
      skillPath = join(resolve(client.skillDir), "SKILL.md");
      if (!dryRun) {
        mkdirSync(client.skillDir, { recursive: true });
        writeFileSync(skillPath, skillMarkdownContent, "utf8");
      }
    }

    actions.push({
      client_id: client.id,
      client_name: client.name,
      applied: !dryRun,
      config_path: client.configPath,
      backup_path: backupPath,
      skill_path: skillPath,
    });
  }

  return {
    dry_run: dryRun,
    configured_count: actions.length,
    actions,
  };
}
