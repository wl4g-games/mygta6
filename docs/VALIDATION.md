# GitHub Pages deployment verification — 2026-11-28

- `pnpm install --frozen-lockfile --offline`: pass with pnpm 10.6.1.
- `pnpm test`: 80 tests / 27 files pass; `pnpm assets:verify`: 68 / 68 pinned assets pass.
- `pnpm build --base=/mygta6/`: typecheck and production build pass.
- Production browser check at `http://127.0.0.1:4173/mygta6/`: start → E → actual convenience-store entry; 56 successful HTTP resource paths, no page / console / request errors, QA API absent. Character, vehicle, building, prop, surface, Basis WASM and world Worker requests stay under `/mygta6/`; all three phone videos decode. Report: `artifacts/production-smoke.json`.
- `.github/workflows/pages.yml` runs validation for `dev`, PRs to `main`, and `main`. Only successful non-PR `main` runs upload and deploy the verified bundle to GitHub Pages. This workflow also retains the production screenshot, report and preview-server log for seven days.

The following gameplay and performance results are from the previous checkpoint; this deployment change does not rerun the full 38-case suite or long driving soak.

# Previous playable checkpoint — 2026-11-21

Platform: macOS Apple Silicon, Chromium 151, native ANGLE Metal, 1440 × 900 browser tests, one browser worker. Other host workloads were present. These observations cover one workstation.

- `pnpm typecheck`, `pnpm build`: **pass**. Production output: `dist/`.
- `pnpm test`: **80 tests / 27 files pass**, including real Rapier collision, chunk lifetimes, persistence, transactions, camera transforms, real-rig palm IK, first-person sleeve/hand geometry cleanup, coastal phone lookup, final police parking, entry through the real door, complete stair climbing and reversing downstairs.
- Full browser suite: **38 / 38 pass**, zero skips, failures or flaky retries, **641.4 seconds**, fixed QA bundle `index-CEwGQAWK.js`. Report: `artifacts/e2e-final.json`.
- Production smoke: actual start → E → collision-controlled convenience-store entry; no page/console errors; QA API absent even with `?e2e=1`. Script: `scripts/smoke-production.mjs`; screenshot: `artifacts/production-convenience-entry.png`.
- All **68 pinned external assets** pass SHA-256 verification with `python3 scripts/assets.py`. Phone videos are original local scene/audio recordings and load when PULSE opens.
- Fresh browser / local static server: menu **1,332 ms**, playable **1,910 ms**, **23,860,490 response-body bytes / 54 completed requests**. One detail request remained pending while play was possible. This is not a remote-network guarantee. Report: `artifacts/startup.json`.

The browser paths cover shopping/payment/consumption/save/reload, real refrigerator and carried product, garage and refueling, bank and 14 paid facility services, apartment access, NPC conversation, weapons, robbery, physical police entry/arrest, first-person driving/phone, coastal swimming and origin rebasing, GPS and both player-driven and NPC-driven taxi services. Fault injection checks worker restart, district download recovery and cancelling a pending car purchase without payment.

## Reported visual and interaction fixes

- Camera clipping computes the fraction before changing its endpoint, preventing invalid positions near walls and ceilings.
- The first-person eye is attached to the current rigid-body seat transform, without the third-person positional spring. A real-input run above 20 m/s with left/right steering measured a maximum seat error of approximately **1.03e-7 m** and palm/rim error of **0.000243 m**.
- First-person sleeves/hands are filtered from the real skinned model by joint weights; the head, hood and torso are excluded. Palm orientation and finger curl follow the rotating wheel. An owned phone has a physical dashboard/hand-held screen; the same video plays in the phone UI and 3D display.
- Pedestrian rendering interpolates separately from fixed physics, with buffered movement-animation transitions. Continuous motion is checked while the player walks.
- E opens the physical shop door and aligns the character through the opening with the collision controller. F transfers occupied/parked NPC cars, removes the overlapping traffic body, ejects the driver, raises wanted level and permits actual driving and exit.
- The private lounge has human-scale chairs (1.05 m wide, 0.46 m seat height), meeting table, desk, shelves, bar, stools, plants and a divider. Its adult attendant uses opaque two-piece costume geometry on the licensed rig, stable elbow poles and palm contact targets.
- Police use explicit door and stair links alongside the local obstacle grid. They park at the final approach, stand on physical ground, enter, climb, descend and arrest with a clear sight line. Arrest/damage cannot pass through a wall or floor. Ground-floor and upstairs cases each passed two focused repeats before the final full suite.

Screenshots: `artifacts/driving-hands-fixed.png`, `driving-phone-fixed.png`, `lounge-furnished-fixed.png`, `lounge-bikini-fixed.png`, `npc-taxi-passenger.png`, `broken-atm.png`.

## Streaming and performance evidence

- Current full-suite real-input autodrive: **871.3 m**, vehicle health **100**, zero generation failures. Bridge ramp/deck/water continuity passed.
- Seven region visits/returns: **25 resident chunks**, 175 loads / 150 unloads, zero generation failures. Original-location references returned to **732**, colliders to **1,113**; resource estimates **143.1–152.0 MB**, including retained warmed caches. This is not total browser/driver RAM.
- High-quality visual case sampled approximately **49.6 FPS**. This is a short native-GPU sample, not sustained cross-device qualification.
- Ten-minute reverse-driving stress: **6,051.8 m**, **565 loads / 259 unloads**, health **100**, zero generation failures, minimum vehicle height **0.699 m**, peak estimated resources **162.4 MB** during prefetch. The memory setting is a soft scheduling budget, not a measured total-RAM limit. This run preceded the final cockpit/wardrobe/police refinements; current streaming/visual regressions are recorded above. Report: `artifacts/streaming-soak-current.json`.

This remains a playable prototype with low-poly assets. GTA6-level art, full production animation, complete road/environment variety, vehicle suspension and every long-term content item are unfinished. Windows/Linux hardware, Safari and an eight-hour soak have not been qualified. README lists the remaining scope.

## Previous checkpoint, before the reported interaction fixes

Platform: macOS Apple Silicon, Chromium 151, native ANGLE Metal. Browser E2E viewport 1440 × 900, device scale 1, one test worker. Streaming cases use low quality; explicit visual cases also exercise high quality. These measurements cover one workstation.

Checks at that earlier checkpoint:

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

### Phase 1 verification checkpoint

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
