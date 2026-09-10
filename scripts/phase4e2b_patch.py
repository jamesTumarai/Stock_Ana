from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


# Pure client-side configuration resolver. Keep the current production project only
# as a compatibility fallback; do not silently allow it on preview/local hosts.
Path('src/lib/firebaseConfig.ts').write_text(r'''export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export type FirebaseConfigSource = 'environment' | 'legacy_production_fallback';

export interface FirebaseClientConfigResolution {
  config: FirebaseWebConfig;
  source: FirebaseConfigSource;
}

export const LEGACY_PRODUCTION_FIREBASE_PROJECT_ID = 'stock-analyze-a89d0';

export const LEGACY_PRODUCTION_FIREBASE_CONFIG: FirebaseWebConfig = {
  apiKey: 'AIzaSyCOoXe_HxUrdUgMMchwRtgBPb-Jvi91UR4',
  authDomain: 'stock-analyze-a89d0.firebaseapp.com',
  projectId: LEGACY_PRODUCTION_FIREBASE_PROJECT_ID,
  storageBucket: 'stock-analyze-a89d0.firebasestorage.app',
  messagingSenderId: '251448969613',
  appId: '1:251448969613:web:7678d9ec4649558f8195c4',
  measurementId: 'G-GSVXQJRSWN',
};

const REQUIRED_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const KNOWN_PRODUCTION_HOSTS = new Set([
  'stock-ana-ten.vercel.app',
  'stock-ana-jamestumarais-projects.vercel.app',
  'stock-ana-git-main-jamestumarais-projects.vercel.app',
]);

const readString = (env: Record<string, unknown>, key: string): string => {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
};

export function resolveFirebaseClientConfig(
  env: Record<string, unknown>,
): FirebaseClientConfigResolution {
  const provided = REQUIRED_ENV_KEYS.filter(key => readString(env, key));

  if (provided.length === 0) {
    return {
      config: { ...LEGACY_PRODUCTION_FIREBASE_CONFIG },
      source: 'legacy_production_fallback',
    };
  }

  if (provided.length !== REQUIRED_ENV_KEYS.length) {
    const missing = REQUIRED_ENV_KEYS.filter(key => !readString(env, key));
    throw new Error(`Incomplete Firebase client environment configuration. Missing: ${missing.join(', ')}`);
  }

  const measurementId = readString(env, 'VITE_FIREBASE_MEASUREMENT_ID');
  return {
    source: 'environment',
    config: {
      apiKey: readString(env, 'VITE_FIREBASE_API_KEY'),
      authDomain: readString(env, 'VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: readString(env, 'VITE_FIREBASE_PROJECT_ID'),
      storageBucket: readString(env, 'VITE_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: readString(env, 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
      appId: readString(env, 'VITE_FIREBASE_APP_ID'),
      ...(measurementId ? { measurementId } : {}),
    },
  };
}

export function isFirebaseDataAccessAllowed(
  resolution: FirebaseClientConfigResolution,
  hostname: string,
  allowProductionProjectOverride = false,
): boolean {
  if (resolution.config.projectId !== LEGACY_PRODUCTION_FIREBASE_PROJECT_ID) return true;
  if (allowProductionProjectOverride) return true;
  return KNOWN_PRODUCTION_HOSTS.has(hostname.toLowerCase());
}
''')

# Runtime Firebase initialization now comes from the resolver and exports a guard
# consumed by the application before authenticated/data-bearing flows begin.
firebase_path = Path('src/lib/firebase.ts')
firebase_path.write_text(r'''import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { isFirebaseDataAccessAllowed, resolveFirebaseClientConfig } from './firebaseConfig';

type ViteEnv = Record<string, string | boolean | undefined>;
const viteEnv = (((import.meta as ImportMeta & { env?: ViteEnv }).env) ?? {}) as ViteEnv;
const firebaseResolution = resolveFirebaseClientConfig(viteEnv);
const runtimeHostname = typeof window === 'undefined' ? '' : window.location.hostname;
const allowProductionProjectOverride = viteEnv.VITE_FIREBASE_ALLOW_PRODUCTION_PROJECT === 'true';

export const firebaseConfigSource = firebaseResolution.source;
export const firebaseProjectId = firebaseResolution.config.projectId;
export const firebaseDataAccessAllowed = isFirebaseDataAccessAllowed(
  firebaseResolution,
  runtimeHostname,
  allowProductionProjectOverride,
);

const app = initializeApp(firebaseResolution.config);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
''')

# Server-side Firebase target resolver. Explicit environment configuration wins.
# Preview/development cannot silently fall back to the production Firebase project.
Path('server/auth/firebaseProject.ts').write_text(r'''export const LEGACY_PRODUCTION_FIREBASE_PROJECT_ID = 'stock-analyze-a89d0';

export interface FirebaseAdminProjectResolution {
  projectId: string;
  source: 'environment' | 'legacy_production_fallback';
}

const clean = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export function resolveFirebaseAdminProjectId(
  env: Record<string, string | undefined> = process.env,
): FirebaseAdminProjectResolution {
  const explicitProjectId = clean(env.FIREBASE_PROJECT_ID);
  const vercelEnvironment = clean(env.VERCEL_ENV).toLowerCase();
  const nodeEnvironment = clean(env.NODE_ENV).toLowerCase();
  const knownNonProduction = vercelEnvironment === 'preview'
    || vercelEnvironment === 'development'
    || nodeEnvironment === 'development';
  const allowProductionProject = clean(env.FIREBASE_ALLOW_PRODUCTION_PROJECT_IN_NONPROD).toLowerCase() === 'true';

  if (explicitProjectId) {
    if (
      explicitProjectId === LEGACY_PRODUCTION_FIREBASE_PROJECT_ID
      && knownNonProduction
      && !allowProductionProject
    ) {
      throw new Error('Production Firebase project is blocked in preview/development without an explicit override.');
    }
    return { projectId: explicitProjectId, source: 'environment' };
  }

  if (knownNonProduction) {
    throw new Error('FIREBASE_PROJECT_ID must be explicitly configured for preview/development.');
  }

  return {
    projectId: LEGACY_PRODUCTION_FIREBASE_PROJECT_ID,
    source: 'legacy_production_fallback',
  };
}
''')

auth_path = Path('server/auth/firebaseAuth.ts')
auth = auth_path.read_text()
auth = replace_once(
    auth,
    "import { getAuth } from 'firebase-admin/auth';\n",
    "import { getAuth } from 'firebase-admin/auth';\nimport { resolveFirebaseAdminProjectId } from './firebaseProject.ts';\n",
    'firebase auth resolver import',
)
auth = replace_once(
    auth,
    "const ADMIN_APP_NAME = 'lumina-server-auth';\nconst DEFAULT_FIREBASE_PROJECT_ID = 'stock-analyze-a89d0';\n",
    "const ADMIN_APP_NAME = 'lumina-server-auth';\n",
    'firebase auth legacy constant',
)
auth = replace_once(
    auth,
    "  return initializeApp(\n    { projectId: process.env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID },\n    ADMIN_APP_NAME,\n  );",
    "  const { projectId } = resolveFirebaseAdminProjectId();\n  return initializeApp({ projectId }, ADMIN_APP_NAME);",
    'firebase admin initialization',
)
auth_path.write_text(auth)

# Gate all authenticated/data-bearing client flows when the runtime would otherwise
# use the production Firebase project from a non-production host.
app_path = Path('src/App.tsx')
app = app_path.read_text()
app = replace_once(
    app,
    "import { auth, db, googleProvider } from './lib/firebase';",
    "import { auth, db, firebaseDataAccessAllowed, googleProvider } from './lib/firebase';",
    'App Firebase import',
)
app = replace_once(
    app,
    "      if (currentUser) {\n        fetchHistory(currentUser.uid);\n      } else {\n        setHistoryReports([]);\n      }",
    "      if (currentUser && firebaseDataAccessAllowed) {\n        fetchHistory(currentUser.uid);\n      } else {\n        if (currentUser && !firebaseDataAccessAllowed) {\n          console.warn('[firebase] Authenticated data access is blocked until this environment has its own Firebase configuration.');\n        }\n        setHistoryReports([]);\n      }",
    'auth state data guard',
)
app = replace_once(
    app,
    "  const handleLogin = async () => {\n    try {",
    "  const handleLogin = async () => {\n    if (!firebaseDataAccessAllowed) {\n      setError('Firebase is not configured for this environment. Production Firebase access is blocked outside approved production hosts.');\n      return;\n    }\n    try {",
    'login guard',
)
app = replace_once(
    app,
    "  const fetchHistory = async (userId: string) => {\n    try {",
    "  const fetchHistory = async (userId: string) => {\n    if (!firebaseDataAccessAllowed) return;\n    try {",
    'history guard',
)
app = replace_once(
    app,
    "  const deleteReports = async (reportIds: string | string[]) => {\n    if (!user) return;",
    "  const deleteReports = async (reportIds: string | string[]) => {\n    if (!user || !firebaseDataAccessAllowed) return;",
    'delete guard',
)
app = replace_once(
    app,
    "  const saveReportToFirebase = async (reportData: ReportData) => {\n    if (!user) return;",
    "  const saveReportToFirebase = async (reportData: ReportData) => {\n    if (!user || !firebaseDataAccessAllowed) return;",
    'save guard',
)
start_anchor = "  ) => {\n    setRun(true);\n    setErr(null);"
start_replacement = "  ) => {\n    if (!firebaseDataAccessAllowed) {\n      setErr('Firebase is not configured for this environment. Analysis is blocked to prevent production-account cross-environment access.');\n      return;\n    }\n    setRun(true);\n    setErr(null);"
app = replace_once(app, start_anchor, start_replacement, 'Analyze start guard')
app_path.write_text(app)

# Replace production-targeting example values with environment-specific placeholders.
Path('.env.example').write_text(r'''# Create a local .env file and replace placeholders. Never commit real secrets.
# Vercel environment-variable changes require a new deployment.

GEMINI_API_KEY=replace_with_your_google_ai_studio_api_key
PORT=3001

# Firebase environment contract
# Local development and Vercel Preview must use an explicitly configured non-production
# Firebase project. Keep the server project ID and VITE_FIREBASE_PROJECT_ID aligned.
FIREBASE_PROJECT_ID=replace_with_environment_specific_firebase_project_id
VITE_FIREBASE_API_KEY=replace_with_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=replace_with_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=replace_with_environment_specific_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=replace_with_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=replace_with_sender_id
VITE_FIREBASE_APP_ID=replace_with_web_app_id
VITE_FIREBASE_MEASUREMENT_ID=replace_with_measurement_id_if_used

# Emergency compatibility overrides. Leave unset in normal development/preview.
# VITE_FIREBASE_ALLOW_PRODUCTION_PROJECT=true
# FIREBASE_ALLOW_PRODUCTION_PROJECT_IN_NONPROD=true

# AI API abuse controls are enforced per authenticated Firebase UID on each running server instance.
# Defaults: Analyze 8/15m with 1 concurrent run; DCF assumptions 16/15m; metric insights 60/15m; TTS 30/15m.
''')

# Quarantine the stale AI Studio Firebase CLI scaffold so `firebase deploy` from the
# repository root cannot silently target its old named database.
legacy_firebase = Path('firebase.json')
legacy_applet = Path('firebase-applet-config.json')
if not legacy_firebase.exists() or not legacy_applet.exists():
    raise SystemExit('expected legacy Firebase scaffold files are missing')
legacy_firebase.rename('firebase.legacy-ai-studio.json')
legacy_applet.rename('firebase-applet-config.legacy.json')

Path('docs').mkdir(exist_ok=True)
Path('docs/FIREBASE_ENVIRONMENTS.md').write_text(r'''# Firebase environment safety

Lumina currently has a production-compatibility Firebase fallback for the existing
`stock-analyze-a89d0` project. The fallback exists only to avoid breaking the live
production deployment while environment variables are rolled out. It is not the
recommended configuration for new environments.

## Environment contract

Production, Preview, and local development should each provide the complete Firebase
web configuration through the `VITE_FIREBASE_*` variables in `.env.example`, and the
server must use the same project through `FIREBASE_PROJECT_ID`.

If any client Firebase variable is supplied, all required client variables must be
supplied. Partial configuration fails closed instead of mixing values from different
projects. Local/Preview runs are blocked from authenticated data access when they would
otherwise resolve to the production Firebase project. Production domains currently in
Vercel remain compatible with the legacy fallback until production variables are set.

After production variables have been configured and auth/history have passed a live
smoke test, remove the legacy production fallback in a separate PR.

## Archived AI Studio scaffold

`firebase.legacy-ai-studio.json` and `firebase-applet-config.legacy.json` are archived
configuration from an older AI Studio project (`festive-state-gsjh2`) and named
Firestore database. They are intentionally not named `firebase.json` / active applet
config because the current web app initializes Firestore with `getFirestore(app)`,
which means the default database of its configured Firebase project.

Do not use the archived files for production rules deployment.

## Firestore rules deployment

The repository intentionally has no active `firebase.json` after this hardening step.
This makes a casual `firebase deploy` from the repository root fail closed. Before any
rules deployment:

1. Confirm the Firebase project and Firestore database that the running production app
   actually uses.
2. Export/back up the affected data and keep a rollback copy of the previous rules.
3. Create an explicit deployment config for that verified target; do not reuse the
   archived AI Studio config.
4. Validate rules against owner read/create, immutable report snapshots, and soft-delete
   metadata behavior.
5. Deploy to non-production first, then production only after auth/history smoke tests.

A Vercel application deployment does not deploy Firestore rules.
''')

# Regression tests for pure configuration decisions and source wiring.
Path('src/utils/firebaseEnvironmentBoundary.test.ts').write_text(r'''import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  LEGACY_PRODUCTION_FIREBASE_PROJECT_ID,
  isFirebaseDataAccessAllowed,
  resolveFirebaseClientConfig,
} from '../lib/firebaseConfig.ts';
import { resolveFirebaseAdminProjectId } from '../../server/auth/firebaseProject.ts';

const fullClientEnv = {
  VITE_FIREBASE_API_KEY: 'dev-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'lumina-dev.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'lumina-dev',
  VITE_FIREBASE_STORAGE_BUCKET: 'lumina-dev.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
  VITE_FIREBASE_APP_ID: '1:123:web:abc',
};

{
  const resolution = resolveFirebaseClientConfig({});
  assert.equal(resolution.source, 'legacy_production_fallback');
  assert.equal(resolution.config.projectId, LEGACY_PRODUCTION_FIREBASE_PROJECT_ID);
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'stock-ana-ten.vercel.app'), true);
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'preview-123.vercel.app'), false);
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'localhost'), false);
}

{
  const resolution = resolveFirebaseClientConfig(fullClientEnv);
  assert.equal(resolution.source, 'environment');
  assert.equal(resolution.config.projectId, 'lumina-dev');
  assert.equal(isFirebaseDataAccessAllowed(resolution, 'localhost'), true);
}

assert.throws(
  () => resolveFirebaseClientConfig({ VITE_FIREBASE_PROJECT_ID: 'partial-only' }),
  /Incomplete Firebase client environment configuration/,
);

{
  const explicit = resolveFirebaseAdminProjectId({ FIREBASE_PROJECT_ID: 'lumina-dev', VERCEL_ENV: 'preview' });
  assert.deepEqual(explicit, { projectId: 'lumina-dev', source: 'environment' });
}

assert.throws(
  () => resolveFirebaseAdminProjectId({ VERCEL_ENV: 'preview' }),
  /FIREBASE_PROJECT_ID must be explicitly configured/,
);
assert.throws(
  () => resolveFirebaseAdminProjectId({ FIREBASE_PROJECT_ID: LEGACY_PRODUCTION_FIREBASE_PROJECT_ID, VERCEL_ENV: 'preview' }),
  /Production Firebase project is blocked/,
);
assert.equal(
  resolveFirebaseAdminProjectId({ VERCEL_ENV: 'production' }).projectId,
  LEGACY_PRODUCTION_FIREBASE_PROJECT_ID,
);

const app = fs.readFileSync('src/App.tsx', 'utf8');
const firebaseRuntime = fs.readFileSync('src/lib/firebase.ts', 'utf8');
const serverAuth = fs.readFileSync('server/auth/firebaseAuth.ts', 'utf8');
const envExample = fs.readFileSync('.env.example', 'utf8');
const docs = fs.readFileSync('docs/FIREBASE_ENVIRONMENTS.md', 'utf8');
const ci = fs.readFileSync('.github/workflows/verify.yml', 'utf8');

assert.match(firebaseRuntime, /resolveFirebaseClientConfig/);
assert.match(firebaseRuntime, /firebaseDataAccessAllowed/);
assert.match(app, /if \(!firebaseDataAccessAllowed\)/);
assert.match(app, /if \(!user \|\| !firebaseDataAccessAllowed\) return;/);
assert.match(serverAuth, /resolveFirebaseAdminProjectId/);
assert.match(envExample, /VITE_FIREBASE_PROJECT_ID=/);
assert.match(envExample, /FIREBASE_PROJECT_ID=/);
assert.match(docs, /repository intentionally has no active `firebase\.json`/);
assert.match(ci, /node-version: 24/);
assert.equal(fs.existsSync('firebase.json'), false, 'stale Firebase CLI config must not remain active');
assert.equal(fs.existsSync('firebase-applet-config.json'), false, 'stale AI Studio applet config must be quarantined');
assert.equal(fs.existsSync('firebase.legacy-ai-studio.json'), true);
assert.equal(fs.existsSync('firebase-applet-config.legacy.json'), true);

console.log('Firebase environment boundary checks passed');
''')
