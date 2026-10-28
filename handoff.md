# MyEczema project handoff

Updated October 26, 2026. This and the short README are the only current project Markdown files. Requirements describe intended behavior; they do not establish implemented backend services or release acceptance.

## Delivery status

- Ready for a guided local iOS simulator demo with synthetic data. Not a deployed end-to-end backend, real-service demonstration, independently distributed demo or launch-ready product.

## Completed work

- Expo/React Native/TypeScript monorepo, shared design tokens and Figma-aligned five-tab app: Today, Insights, Ask Nella, Care and Profile.
- Welcome, guest exploration, Cognito email-auth adapter and self/caregiver onboarding. Live authentication acceptance is still outstanding.
- Separate local care profiles; profile-name/dependent relationship/age-band editing; account identity remains read-only.
- Encrypted on-device check-ins/drafts, skin-photo handling, products, duplicate-scan preservation, weekday routines, supply and local reminders.
- History filters, Insights/calendar completeness, Weekly Review, product-period history, local photo comparison and native patient-generated PDF preview/sharing.
- Educational Ask and physical-product shopping/order/subscription simulations, privacy disclosures, deletion-request preparation and retry/cleanup boundaries.
- Ten reproduced iOS defects fixed across the October 15–17 native passes, covering stale-owner writes, recovery, notifications, asynchronous packaging moves and accessible layouts/labels.
- Repeatable adult demo sessions: Alex starts at onboarding; Jordan has completed setup, two fictional products and 52 check-ins across the previous 60 completed local days.
- AWS CDK foundation and an IAM-free demo deployment were recorded. Current live AWS state has not been reverified for this handoff.

## Run and demonstrate

Requirements: Node.js >=22.13 and pinned pnpm 11.22.0; Xcode and an iOS development binary for native demonstration. Expo Go is insufficient for the app's native modules.

```bash
pnpm install --frozen-lockfile
pnpm --filter @myeczema/mobile demo:ios
```

The demo command starts Metro on `localhost:8086` with the synthetic flag. Welcome → Get started / I already have an account → choose Alex or Jordan. No passwords, verification messages or AWS account creation are involved.

Reopening resumes the current session and edits. Profile → Sign out → select again starts fresh; the first onboarding step also has Choose demo. Fresh starts isolate previous synthetic namespaces rather than erasing Keychain records. Do not use real health data. Synthetic entry requires development mode, iOS and `EXPO_PUBLIC_SYNTHETIC_DEMO=1`; it is disabled in release bundles and other platforms. Alex uses `alex.demo@example.invalid`; Jordan uses `jordan.demo@example.invalid`. Jordan has eight deliberate missing days, two unverified fictional products and no saved activity today, ready for a live check-in. The 90-day view initially shows 52/90 recorded. Photos/chats/orders/payments are not seeded; reminder switches start off. Choose Myself for the adult onboarding walkthrough.

## Outstanding work, in order

| Work | Dependency / completion requirement |
| --- | --- |
| AWS deployment access | Account administrator verifies the recorded failed `CDKToolkit` bootstrap and owned residuals, resolves them safely, bootstraps Canada Central and provides approved project deployment roles/GitHub OIDC. PowerUser demo mode omits IAM-dependent workloads. |
| Backend and sync | Authenticated profile/check-in/routine/history APIs, server account/profile authorization, audit controls, versioned/idempotent offline writes, conflict/session-expiry recovery and cross-device negative tests. |
| Real authentication | Verify registration, email verification, sign-in/restoration, reset and sign-out against Cognito; owner configures Google/Apple credentials, callbacks and email/domain delivery. Synthetic sessions do not close this work. |
| Trusted media | Authenticated upload intents, validation/quarantine, signed reads, ownership checks, deletion, retries and abandoned-upload cleanup. Local file references are not cloud object references. |
| Live AI | Approved Bedrock model/inference destinations, safety evaluation, limits, retention and clinical/escalation copy. |
| Commerce | Approved catalogue/prices/images, Stripe test access, verified webhook-authoritative orders and physical subscriptions. Fulfillment, inventory, tax, returns and production payments remain separately owned. |
| Remote notifications | Apple/APNs access, backend events, delivery/tap/token handling, cross-device and timezone/DST reconciliation. Tested local reminders are a separate implemented stage. |
| Account deletion | Actual initiation/status service and external page, reauthentication, verified login/write lock, grace/purge/backups and completion notice. Opening a support email draft is not submission or deletion. |
| Remaining iOS QA | Physical camera/barcode, minimum-supported iOS, spoken VoiceOver/focus order, reliable multi-touch/edge Back, real midnight/timezone/DST and remaining storage/lifecycle permutations. |
| Production release | Separate production AWS account, Apple organization/signing/TestFlight/store operations, privacy/legal/minor/research/retention/clinical approval, security/restore/deletion/load/incident exercises and final release acceptance. |

Android runtime/build testing was excluded from the recent work. The shared codebase supports Android, but no current Android acceptance is claimed. Provider portal, Firebase migration, private-area photos and diagnostic/causal product claims remain excluded.

## Verification and evidence

- Latest application baseline: 259 mobile + 8 infrastructure + 2 domain tests, lint/typecheck and native-config validation passed. CDK synthesis and an iOS Hermes export passed.
- iOS27 large/compact simulators covered the documented native scenarios, including fresh onboarding, populated Insights, a saved routine edit surviving cold restart and scenario switching. Synthetic identities and source mocks are not real-authentication/server-authorization evidence.
- Native iOS27 checks included local check-in/draft/rollback recovery, duplicate/scheduled Care, filters/calendar labels, scoped photo history, packaging selection/normalization/cleanup, profile forms, notification grant/delivery/tap/revoke and native PDF/share cleanup. Results apply to stated synthetic scenarios, not every lifecycle case. Historical full receipts remain in Git and the original PRs.
- Transient local design/review exports were removed during this minimal cleanup. Historical runtime ports, process IDs and Figma session keys are not portable setup requirements.

## Project files

| Location, relative to repository root | Contents |
| --- | --- |
| `apps/mobile/src/app/` | Expo Router screens and navigation |
| `apps/mobile/src/contexts/` | Auth, profiles, check-ins, Care, notifications, PDF, Ask and commerce state |
| `apps/mobile/src/lib/` | Storage, domain logic, synthetic fixtures and behavior tests |
| `apps/mobile/src/components/` | Shared mobile controls and feature UI |
| `apps/mobile/app.json`, `apps/mobile/package.json` | Native configuration and mobile commands/dependencies |
| `apps/mobile/scripts/start-synthetic-demo.mjs` | Local iOS demo launcher |
| `packages/ui/src/tokens.ts`, `packages/domain/` | Design tokens and shared domain code |
| `apps/mobile/assets/brand/` | Brand assets and provenance |
| `infra/lib/foundation-stack.ts`, `infra/` | CDK foundation and tests; application backend services still need implementation |
| `.github/workflows/ci.yml` | Frozen install, checks and infrastructure synthesis |
| `handoff.md`, `README.md` | All current project documentation; detailed earlier specifications are archived in Git |

## Access and transfer notes

- `.env.local`, SSO sessions, signing credentials and ignored native/build output are machine-local and not committed. `.env.example` contains public application identifiers, not passwords. Never copy secrets into this handoff.
- Use CDK for infrastructure; synthesis does not deploy. Do not delete AWS resources or expand permissions as a side effect of this handoff.

## Essential product and technical constraints

- Keep active-profile context and separate account/profile storage. Reject stale callbacks including A→B→A; serialize writes against latest state and fail closed on load/save errors. Issued native writes may finish in their original owner; cancellation/transactional rollback is not promised. Owner-bound drafts currently discard on changes; a different UX needs an explicit decision.
- Missing data is neither improvement nor completion; do not infer product links/causation from coincident dates. Duplicate adds preserve full saved records. Schedule edits apply from today with prior-rule snapshots. Prescriptions require individual logging outside skincare bulk actions. Help preference follows the first saved check-in, separate from onboarding areas/symptoms.
- Skin photos require contextual permission and private-area acknowledgement; normalize JPEG copies to <=2048-pixel long edge/8MB with opaque names and owner checks. Cache loss/decode failure keeps references and shows unavailable media. Packaging has its own purpose/cache and never enters skin history, skin counts or PDFs. Commit metadata before replacing files; retain uncertain writes and retry only failed cleanup resources.
- PDF text is escaped and patient-generated, with explicit missingness. Skin-photo inclusion is off by default, capped at eight owned images. Keep temporary output until native sharing settles, then remove owned files; a recipient may retain a copy. Local cleanup is not cloud deletion.
- Notification copy is generic, with owner-scoped schedule/recovery records. Departure independently attempts indexed and recovery-journal cancellation. Demo checkout never charges; recovery requires a matching stored receipt. Paid orders must come from verified backend/webhook state; subscriptions are physical shipments, not digital entitlements.
- No health notes/photos/tokens/prompts in normal logs or advertising analytics. Private data requires encryption, least-privilege/MFA staff access and separate production. Research requires optional express opt-in separate from Terms. No HIPAA-compliance or clinical-approval claim is established by this demo.
- Retention values remain technical defaults pending legal/owner approval and implementation: guest chat 30 days; signed-in chat 12 months; incomplete drafts/uploads 30 days; deletion grace 14 days, live purge 30 days, backups 90 days; security/support logs 24 months; consent/order/tax evidence 7 years. Research retention requires a separate protocol. A support-email draft does not enforce any of these.
- IAM-free AWS mode omits IAM/Lambda workloads, API execution logging roles, automatic S3 object deletion and GitHub OIDC; the health route is a mock. Production rejects this mode. Last recorded spend alerts were USD 50/100/250, not spend caps. Canada-region Bedrock invocation alone does not establish Canadian-only processing.

## Design source and archived specifications

[Figma: nella](https://www.figma.com/design/G6h1gyiTLpKopmvufN7vsr/nella?node-id=0-1&p=f) is the design source. Use approved Page1 hybrids, not every duplicate/proposed frame. Preserve native safe areas/scrolling, enlarged text, accessible labels/status and >=44pt iOS targets.

Brand files in `apps/mobile/assets/brand/` were exported October 6, 2026 from that file: `nella-logo.png` from Welcome 9:1820; `google.svg` and `apple.svg` from sign-in 25:32. Product copy uses MyEczema while Nella remains the company mark. Temporary asset URLs are unnecessary.
