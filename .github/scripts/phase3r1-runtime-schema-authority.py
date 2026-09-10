from pathlib import Path

server = Path('server.ts')
text = server.read_text()
old = '      const agentFiles = loadAgentFiles(path.join(process.cwd(), "agent"), "/.agents");'
new = '''      // The runtime prompt below is the authoritative output contract. Do not inject
      // legacy agent configuration/instruction files into the managed-agent environment,
      // where they can compete with the current dynamic JSON schema.
      const legacyAgentRuntimeFiles = new Set([
        '/.agents/AGENTS.md',
        '/.agents/agent.yaml',
        '/.agents/requirements.txt',
      ]);
      const agentFiles = loadAgentFiles(path.join(process.cwd(), "agent"), "/.agents")
        .filter((source) => !legacyAgentRuntimeFiles.has(source.target));'''
if text.count(old) != 1:
    raise SystemExit(f'Expected exactly one agentFiles assignment, found {text.count(old)}')
server.write_text(text.replace(old, new, 1))

test = Path('src/utils/serverPromptIntegrity.test.ts')
test_text = test.read_text()
sentinel = "console.log('Production prompt integrity checks passed');"
if test_text.count(sentinel) != 1:
    raise SystemExit('Prompt integrity sentinel not found exactly once')
assertions = r'''

// The runtime dynamicSchema is authoritative. Legacy managed-agent configuration files
// must not be injected as environment sources where they can compete with that contract.
assert.match(serverSource, /legacyAgentRuntimeFiles = new Set/);
assert.match(serverSource, /'\/.agents\/AGENTS\.md'/);
assert.match(serverSource, /'\/.agents\/agent\.yaml'/);
assert.match(serverSource, /'\/.agents\/requirements\.txt'/);
assert.match(serverSource, /\.filter\(\(source\) => !legacyAgentRuntimeFiles\.has\(source\.target\)\)/);
'''
test.write_text(test_text.replace(sentinel, assertions + '\n' + sentinel, 1))
