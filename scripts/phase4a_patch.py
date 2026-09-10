from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "server.ts",
    'import { validateDcfAssumptionModel } from "./src/utils/valuation/dcfAssumptionProposal.ts";\n',
    'import { validateDcfAssumptionModel } from "./src/utils/valuation/dcfAssumptionProposal.ts";\nimport { createRequireFirebaseAuth } from "./server/auth/firebaseAuth.ts";\n',
)
replace_once(
    "server.ts",
    "  const app = express();\n\n  app.use(express.json({ limit: '50mb' }));",
    "  const app = express();\n  const requireFirebaseAuth = createRequireFirebaseAuth();\n\n  app.use(express.json({ limit: '50mb' }));",
)
for route in ["/api/tts", "/api/analyze-metric", "/api/dcf-assumptions", "/api/analyze"]:
    replace_once(
        "server.ts",
        f'  app.post("{route}", async (req, res) => {{',
        f'  app.post("{route}", requireFirebaseAuth, async (req, res) => {{',
    )

replace_once(
    "src/App.tsx",
    "import { sanitizeUndefinedForPersistence } from './utils/firestorePersistence';\n",
    "import { sanitizeUndefinedForPersistence } from './utils/firestorePersistence';\nimport { authenticatedFetch } from './services/authenticatedFetch';\n",
)
replace_once(
    "src/App.tsx",
    "      const resp = await fetch('/api/analyze', {",
    "      const resp = await authenticatedFetch('/api/analyze', {",
)
replace_once(
    "src/App.tsx",
    "  const runAnalysis = () => {\n    if (!ticker.trim() || running) return;\n",
    "  const runAnalysis = () => {\n    if (!ticker.trim() || running) return;\n    if (!user) {\n      setError(selectedLanguage === 'Thai' ? 'กรุณาเข้าสู่ระบบก่อนเริ่มวิเคราะห์' : 'Please sign in before starting an analysis.');\n      return;\n    }\n",
)

replace_once(
    "src/services/dcfAssumptionService.ts",
    "import { validateDcfAssumptionModel } from '../utils/valuation/dcfAssumptionProposal';\n",
    "import { validateDcfAssumptionModel } from '../utils/valuation/dcfAssumptionProposal';\nimport { authenticatedFetch } from './authenticatedFetch';\n",
)
replace_once(
    "src/services/dcfAssumptionService.ts",
    "    const response = await fetch('/api/dcf-assumptions', {",
    "    const response = await authenticatedFetch('/api/dcf-assumptions', {",
)

replace_once(
    "src/components/FinancialStatementsTable.tsx",
    "import { getFinancialAiInsight, FinancialAiInsight } from '../utils/financialAiInsights';\n",
    "import { getFinancialAiInsight, FinancialAiInsight } from '../utils/financialAiInsights';\nimport { authenticatedFetch } from '../services/authenticatedFetch';\n",
)
replace_once(
    "src/components/FinancialStatementsTable.tsx",
    "        const res = await fetch('/api/analyze-metric', {",
    "        const res = await authenticatedFetch('/api/analyze-metric', {",
)

env = Path('.env.example')
text = env.read_text()
if 'FIREBASE_PROJECT_ID=' not in text:
    text += "\n# Public Firebase project identifier used by server-side ID-token verification.\nFIREBASE_PROJECT_ID=stock-analyze-a89d0\n"
    env.write_text(text)
