# Playable development checkpoint — 2026-11-21

Platform: macOS Apple Silicon, Chromium 151, native ANGLE Metal. Browser E2E viewport 1440 × 900, device scale 1, one test worker. Streaming cases use low quality; explicit visual cases also exercise high quality. These measurements cover one workstation.

Current checks:

- TypeScript typecheck and production build pass.
- 67 unit / integration tests across 23 files pass, including real Rapier movement, a multi-kilometer road continuity regression, chunk physical-handle preservation, retry after optional asset failure, version migration, database-open/shutdown races, transactions and single-payment game rewards.
- All 64 pinned art / transcoder files pass SHA-256 verification with `python3 scripts/assets.py`.
- A previous full 25-case browser checkpoint passed. The expanded 29-case run reached 28 passes; its paid-facility tour exposed an interaction-boundary timing issue in the test walking controller. After approaching with margin, the full 14-facility tour passed separately in 1.5 minutes. All 29 scenarios therefore have passing coverage across the full run and focused reruns; this is not represented as a single fully green 29-case invocation. Night-driving visual coverage also passed separately after correcting cockpit placement. Final surface evidence is recorded separately below.
- Production smoke: start menu and actual game launch, no uncaught errors, QA API remains absent even with `?e2e=1`.
- Fresh browser / local static server startup: menu at 1,340 ms; playable at 1,979 ms; 20,466,296 encoded response-body bytes over 50 completed requests (about 20.5 MB, excluding HTTP headers). One chunk detail request was still pending while play was possible. This is a local-server measurement, not a remote-network latency guarantee.
- Runtime neighborhood pool: 36 pedestrians, 14 moving traffic vehicles, 10 parked vehicles. Restaurant / bar / cafe patrons, merchants and active mission passengers are local interior / mission entities. The street-view case verifies multiple people and cars inside the camera frustum and observes their positions changing.

Real browser paths include physical door entry, refrigerator opening, visible hand-held grocery selection, carrying a basket to checkout, consumption, driving, garage retrieval, refueling at an exterior pump, apartment access, bank transfer, 14 paid facility effects, opening hours, patron conversation, four equipment types and ammunition persistence, robbery, police foot entry and arrest, swimming, origin rebasing, repeatable passenger rides with a mid-trip reload, a skill-based arcade round, rebinding controls and graceful WebGL2 failure.

Fault injection covers worker crash/restart, temporary district-model download failure with physical roads retained, and cancelling a dealership transaction during an in-flight vehicle download without losing cash.

Issues discovered and corrected after the early checkpoint:

1. Shadow-casting lights whose shadow map had never been initialized could turn PBR surfaces white. Day/night light visibility and shadow activation now agree. Visual validation checks surface color/contrast as well as console errors and includes quality changes at night.
2. Long high-speed travel exposed false collisions at solid road-box end caps. Rounded chassis edges helped but did not fully eliminate them. Road and bridge support now use continuous triangle surfaces with internal-edge correction; diagnostics retain real impact contacts.
3. ACTIVE / NEAR visual transitions recreated physical ground. Physical handles now remain stable when collision coverage is already present.
4. Optional facade failure could leave usable road geometry in a state that never retried its visual detail. Physical readiness and completed visual detail now have independent state.
5. Sliders could retain keyboard focus after settings closed. Closing a panel returns focus to the game; opening panels releases controls. Escape and save keys also work from form controls.
6. Parked cars could occupy a service driveway or crowd dealership deliveries. Shared parking / driveway rules now reserve those spaces.
7. Vehicle exit used a fixed ground height. Ground queries and full-character clearance now support safe exits on the elevated bridge.
8. Imported wrist names are normalized by the glTF loader. Right/left attachment points now resolve the actual bones, covered by a real-asset rig test.
9. A sofa blocked a bedroom route; cinema seats blocked a generic service approach. Furniture dimensions/layout and a dedicated ticket kiosk now keep the paths usable.
10. Database open could complete after shutdown. The late connection now closes immediately; startup asset stages also stop after shutdown.

Memory figures are estimates of owned geometry and texture data. They exclude some browser, physics, framebuffer, worker and driver overhead. Revisit tests compare stabilized template caches and assert matching ownership and collider counts after another tour. No claim is made about all-device frame rates, an eight-hour continuous driving soak, complete GTA-scale content, or production-quality vehicle suspension / NPC schedules.

## Long-run evidence and remaining qualifications

- Earlier 25-minute checkpoint: 18,331 m, 1,622 completed chunk/LOD loads, 740 unloads, 25 resident chunks, zero generation failures. This preceded the final triangle-surface road change.
- Final-surface run: 2,430 s (about 40.5 minutes), 22,340 m, 1,963 completed loads, 895 unloads, at most 25 resident chunks, zero generation failures, vehicle health 100 throughout, minimum vehicle height 0.699 m. Warm geometry/texture estimates ranged from 138.37 to 146.12 MB; median sampled rolling FPS after the first ten minutes was approximately 76 in low quality with other browser tests running.
- That final-surface run did **not** complete its planned 45 minutes: the control driver stopped behind traffic near x=15.56 on R1 and triggered its 45-second blocked-route assertion. This is recorded as a traffic-control failure, not counted as a passed 45-minute soak.
- Pedestrian lateral avoidance now has a real-physics regression, and the control driver can sound its horn when a green-light queue remains obstructed. A dedicated 10-minute reverse-driving recovery run started east of that junction and completed: 6,016 m, 565 completed loads, 259 unloads, vehicle health 100, 25 maximum resident chunks, zero generation failures and no recorded page errors. It successfully crossed the previously obstructed junction. This is a separate run; it is not combined with the stopped run to claim a passed 45-minute continuous soak.
- High-quality visual samples in the browser runs varied roughly between 29 and 53 FPS. This range includes shader warmup / concurrent testing and is not a hardware-independent guarantee.

`artifacts/startup.json`, `artifacts/streaming-traffic-soak.json`, `artifacts/surface-soak.json` and `artifacts/traffic-recovery-soak.json` retain local measurements. Artifact directories are intentionally excluded from version control. A fixed QA build is used during each long run so source edits cannot interrupt it through HMR.

## Earlier Phase 1 checkpoint

# Phase 1 verification checkpoint

Date: 2026-11-20, macOS Apple Silicon, Chromium 151, native Metal renderer.

- `pnpm typecheck`: passed.
- `pnpm test`: 21 tests passed across generation, economy, persistence, real Rapier physics and chunk lifecycle.
- `pnpm build`: passed. Build output gzip estimate approximately 0.99 MB in total, before server transfer headers; no world map download.
- Playable E2E: 2 tests passed in 29.9 s. Actual keyboard path: open door → physically walk inside → select water at shelf → walk to checkout → pay → consume → drive over 80 m → brake → exit → save → reload → verify position, inventory, money and mission.
- Streaming E2E: 2 tests passed in 52.1 s. Real-input autodrive travelled 684.67 m; 80 chunk loads, 25 unloads, no generation failures, 25 simultaneously resident chunks. Vehicle remained on physical ground.
- Region revisit E2E: 175 cumulative loads, 150 unloads. Initial and final resource ownership matched: 1,205 shared asset references, 109 materials, 213 colliders, approximately 33.24 MB estimated GPU geometry / texture memory. GPU counters stay within the actual scene's owned resources. The first renderer counter sample is colder than later samples because only visible geometry is initially uploaded.
- Short low-quality native-GPU runs sampled approximately 109–120 FPS. This is a development measurement on one machine, not a cross-device performance guarantee or a long-duration memory qualification.

Issues found and fixed during real testing:

1. Canvas stacking covered the start menu.
2. Main-menu camera was blocked by a foreground building.
3. Traffic pushed the starting vehicle out of its intended parking position.
4. Combined road / chassis friction prevented the prototype vehicle accelerating.
5. Disabling only the player collider during vehicle entry left an interfering kinematic body; both body and collider now transition together. A dedicated real-physics integration regression covers this case.
6. E2E map interactions needed to await the observable modal close before issuing the next action.
7. Resource assertions now distinguish resident ownership from the renderer's gradual GPU upload cache.

The software SwiftShader backend was unsuitable for this scene's real-time tests and caused high host CPU usage; that owned test process was terminated and subsequent macOS tests used Metal. Full production assets, all later-phase systems and 8-hour soak testing have not been completed at this checkpoint.

Final production output: `dist/`, typecheck / 67 tests / production build / 64 resource hashes all passed. Production launch and full-world map smoke passed with no page errors; the QA interface was absent. Windows/Linux hardware, Safari, long high-quality driving, full vehicle suspension and all long-term content remain outside this checkpoint.

Final focused regression: the unmodified keyboard shopping → consume → drive → exit → save → reload path and map/settings path passed together in 39.4 s after the last changes. Production and development servers both returned HTTP 200 at handoff. Owned test browsers have closed; unrelated host workloads were left intact.
