# Security Audit Triage & Bundle Performance Analysis

## Executive Summary

- **Security Posture**: **0 critical vulnerabilities**, **0 high vulnerabilities**, **10 moderate vulnerabilities** (total 10).
- **Policy Compliance**: Per explicit architectural instructions, **`npm audit fix --force` is strictly prohibited** because it introduces breaking major version bumps across core database and infrastructure SDKs (`firebase-admin` v14, `@google-cloud/storage` v8) that would break production runtime contracts.
- **Audit Phrasing Standard**: Documentation and CI metrics state **"0 critical vulnerabilities"**; the phrase *"dependency audit clean"* is never used while moderate transitive advisories remain open.

---

## 1. Vulnerability Triage Matrix

The live dependency audit logs 10 moderate vulnerabilities across direct and transitive dependencies:

| Package | Severity | Type | Origin / Via | Impact & Architecture Boundary | Triage Disposition |
|---|---|---|---|---|---|
| **`express`** | Moderate | Direct | `qs` (transitive) | Express 4.22.2 depends on `qs`. `qs` has advisories GHSA-x5fp-wj9c-mxmx (array-limit bypass) and GHSA-4mjr-xmp4-gh2g (DoS via attacker-controlled isBuffer). | **Temporarily Accepted Risk**: Lumina routes enforce strict 1MB JSON body limits (`express.json({ limit: '1mb' })`), regex ticker validation (`^[A-Za-z0-9.-]{1,10}$`), and user-level rate limiting. Express 5 migration is planned for a dedicated infrastructure cycle. |
| **`qs`** | Moderate | Transitive | Direct dependency of `express` | See above. | **Temporarily Accepted Risk**: Protected by upstream Express middleware size limits and input sanitization boundaries. |
| **`uuid`** | Moderate | Transitive | Upstream in `gaxios`, `google-gax`, `teeny-request` | GHSA-w5hq-g745-h8pq: Missing buffer bounds check in v3/v5/v6 when external `buf` argument is provided. | **Temporarily Accepted Risk**: Lumina application code never invokes `uuid` v3/v5/v6 with user-supplied buffer arguments. Google Cloud SDKs use standard random UUID v4 generation internally. |
| **`gaxios`** | Moderate | Transitive | Direct dependency of Google APIs / auth | Depends on older `uuid` versions. | **Transitive Dependency**: Upstream Google client library maintenance cycle. |
| **`teeny-request`** | Moderate | Transitive | Direct dependency of `@google-cloud/storage` | Depends on older `uuid` versions. | **Transitive Dependency**: Upstream Google Cloud Storage SDK dependency. |
| **`retry-request`** | Moderate | Transitive | Direct dependency of `@google-cloud/storage`, `google-gax` | Depends on `teeny-request`. | **Transitive Dependency**: Upstream Google Cloud client library. |
| **`google-gax`** | Moderate | Transitive | Direct dependency of `@google-cloud/firestore` | Depends on `retry-request` and `uuid`. | **Transitive Dependency**: Upstream Google Cloud Firestore SDK. |
| **`@google-cloud/firestore`**| Moderate | Transitive | Dependency of `firebase-admin` | Depends on `google-gax`. | **Transitive Dependency**: Upgraded only via major `firebase-admin` breaking release. |
| **`@google-cloud/storage`**  | Moderate | Direct / Transitive | Direct dependency & `firebase-admin` | Depends on `retry-request` and `teeny-request`. Fix requires breaking semver bump to v8.1.0. | **Temporarily Accepted Risk**: Lumina uses Google Cloud Storage only for server-side operations with authenticated service accounts. Breaking upgrade deferred. |
| **`firebase-admin`**         | Moderate | Direct | Via `@google-cloud/firestore` and `@google-cloud/storage` | Fix requires breaking major semver bump to `firebase-admin@14.4.0`. | **Temporarily Accepted Risk**: Breaking major version upgrade requires comprehensive regression testing across Firebase Auth, Firestore persistence, and token verification. |

### Summary of Triage Rules
1. **Never use `--force`**: Running `npm audit fix --force` replaces production dependencies with unverified major releases.
2. **Deterministic pinning**: Package versions remain pinned in `package-lock.json` and validated by required CI gates.

---

## 2. Vite Bundle Performance & Chunk Size Analysis

### Current Production Build Telemetry
```
dist/index.html                     2.11 kB │ gzip:   1.01 kB
dist/assets/index-DLRf8ET9.css    157.45 kB │ gzip:  23.41 kB
dist/assets/index-*.js          2,609.44 kB │ gzip: 670.51 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
```

### Bundle Diagnostics
The single client JavaScript bundle is approximately **2.61 MB minified / 670.5 kB gzipped**, which exceeds Vite's default 500 kB chunk warning threshold.

### Major Bundle Contributors Identified
1. **Monolithic Page Component Graph**:
   - `ReportTemplate.tsx` (1,965 lines) and its dependent engines (`IntrinsicValueEngine.tsx`, `ResearchTimelineCard.tsx`, `FinancialStatementsCard.tsx`, `CalculationModal.tsx`, `MethodologyModal.tsx`) are currently bundled directly into the primary application entrypoint.
2. **Vendor Frameworks**:
   - `motion/react` / `framer-motion`: Rich animation runtime loaded on initial render.
   - `firebase/app`, `firebase/auth`, `firebase/firestore`: Client Firebase SDKs bundled together.
   - `lucide-react`: Extensive icon library treeshaking can be optimized.

### Proposed Code-Splitting Candidates (For Future Dedicated PR)
To adhere to the core rule of small, verifiable, non-breaking pull requests, actual chunk refactoring should be executed in a separate small PR with end-to-end browser regression tests:

1. **Route / View Level Lazy Loading**:
   - Wrap `ReportTemplate` in `React.lazy()` with `Suspense` fallback:
     ```tsx
     const ReportTemplate = React.lazy(() => import('./ReportTemplate'));
     ```
     *Impact*: The landing page will load only `LandingView` assets (~300 kB), deferring the 1.5+ MB report renderer until the user submits a ticker or views historical analysis.
2. **Modal Dialog Splitting**:
   - Dynamically load modals on user click (`MethodologyModal`, `CalculationModal`, `HistoryModal`).
3. **Vendor Manual Chunks in `vite.config.ts`**:
   - Configure Rollup manual chunks:
     ```typescript
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
             'vendor-motion': ['motion/react'],
           },
         },
       },
     }
     ```
