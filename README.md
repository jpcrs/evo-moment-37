# Moment 37

A playable browser challenge built from the `3sx` C engine and a local PS2 disc image. Ken versus Chun-Li on the NYC subway stage, one health point, a scripted Houyoku-sen, fifteen parries and a counterattack to win. Keyboard and standard browser controllers are supported.

## Play

The built game is already in `web/dist`. No build is needed to play it:

```sh
npm start
```

Open **http://localhost:3737** in a browser with WebGL 2. Click **Start challenge** (or press Enter / controller Start). The build initializes the fixed fight directly. There are no title, menu, selection or round-intro sequences. The game fills the available viewport with parry progress and Help in its top bar, and the attempt counter and game controls in its bottom bar. Help contains the instructions and keyboard/controller mappings; it pauses an active attempt while open.

| Action | Keyboard | Xbox / PlayStation controller |
| --- | --- | --- |
| Move / parry | Arrow keys | D-pad or left stick |
| Light / medium / heavy punch | Z / X / C | X / Y / RB · Square / Triangle / R1 |
| Light / medium / heavy kick | A / S / D | A / B / RT · Cross / Circle / R2 |
| Retry | R | Back / Share |
| Pause / resume | Space or Escape | Start / Options |

Ken starts on the right, facing Chun-Li on the left. Tap **left**, then release, for each parry. Jump before the last kick and tap forward in the air. Counter with jumping heavy kick, crouching medium kick, then two quarter circles forward plus kick for Shippu Jinraikyaku. Ken wins only after all fifteen parries and an actual engine-calculated knockout. The game also supports ordinary movement, attacks and super commands; there is no automatic parry or combo button.

The top bar includes a game-volume slider and an **Evo audio** checkbox, selected by default. Starting the challenge with it selected loads a local 16-second PCM clip from the requested Evo Events recording, beginning at its super-activation frame (video frame 896 at 30 fps, 29.8667 seconds). The recording is aligned to the engine’s confirmed Houyoku-sen activation. Pause holds the recording at the game clock; resume restores the matching offset; retry resets it. The game-volume slider adjusts the engine audio independently of the recording. Help links to the official recording and the requested Bonus video.

The server binds to your own computer. It uses no account or cloud service. Music and sound effects use the original sound engine; the browser enables audio after user interaction.

## What runs in WebAssembly

`web/CMakeLists.txt` compiles the original game sources, command parser, collision checks, fixed point movement, animation and damage calculation directly from `3sx/src`. **The `3sx` checkout is unchanged.** JavaScript schedules the original 59.59949 frames per second and supplies input buttons. It does not decide whether a parry, attack, hit or knockout succeeds.

The changes are outside that checkout:

- `web/native/webgl_renderer.c` and shaders adapt the desktop OpenGL renderer to WebGL 2, retaining the original indexed textures, palettes and draw commands.
- `web/native/web_support.c` supplies browser input and host services in place of desktop configuration, filesystem discovery and controller discovery.
- `web/native/web_app.c` selects the fixed matchup, initializes the challenge state, supplies Chun-Li's two quarter circles plus kick through the original pad interface, and restores the original engine state on retry. Resets also restore effects, background state, background-layer switches, HUD tiles, palettes and pad history, recompute the renderer's scale from the saved camera zoom, and invalidate the renderer’s texture cache. Pixel comparisons verify the same rendered scene after a KO and when retry interrupts Chun-Li's super zoom.
- `web/native/moment_runtime.c` initializes only Ken, Chun-Li and their stage. `web/specialize.py` copies the original frame loop verbatim and restricts character, stage and sound-bank dispatch tables to this scene. The title/menu/selection routes are absent from the linked module; `web/audit_build.py` checks the linker symbol map and resource manifest.
- `web/prepare_assets.py` reads the supplied ISO9660 disc and repacks the required AFS entries. Resource numbers and every included resource's contents remain unchanged. `web/assets/manifest.json` records their source offsets, sizes and SHA-256 hashes.

This build uses 3SX revision `7bf8ab611b64ab762aa36324aa2942dee5285174`, Emscripten 6.0.11 and SDL 3.4.12. Emscripten's function-pointer cast emulation handles legacy C callbacks that a native executable accepts but WebAssembly otherwise rejects.

### Fidelity limits

This is a reconstruction using the provided **PS2 engine and assets**. 3SX's PS2-to-CPS3 arcade accuracy work is ongoing; this build does not claim arcade-identical behavior. It leaves the PS2 combat path enabled, with default system direction settings.

The historical 2004 controller recording and exact savestate were not supplied. Chun-Li's super command, remaining health and meter are reconstructed. Position and camera measurements come from the official footage just before the super, around 0:29: Ken on the right, Chun-Li on the left, with approximately 243 game pixels between their origins. The camera and sprite offsets are initialized before the scene is shown. The engine itself generates the complete attack sequence, including the two spacing-related missed kicks and fifteen connecting kicks. Starting health is Ken 1 / Chun-Li 55, with one super stock each; timer 26; third-round stage music; Ken's white costume and Chun-Li's blue costume. Chun-Li inputs the super after a short neutral lead-in and then releases the controls. The reference clip is [Evo Events' official Moment 37 video](https://www.youtube.com/watch?v=JzS96auqau0).

`web/tests/golden-inputs.json` is a regression fixture for this build, **not Daigo's recorded inputs**. It verifies fourteen grounded parries, the airborne final parry, jumping heavy kick, crouching medium kick and the actual super cancel that knocks Chun-Li out.

## Build again

The `3sx` checkout, ISO, toolchains, and intermediate resources are ignored by Git. To prepare the engine source in a fresh clone:

```sh
git clone https://github.com/crowded-street/3sx.git 3sx
git -C 3sx checkout 7bf8ab611b64ab762aa36324aa2942dee5285174
```

Supply your local disc image as `Street Fighter III - 3rd Strike (English v1.0).iso`, or pass its path to `web/build.sh` after toolchain setup.

CMake, Ninja, Git and Python 3.10+ are needed for toolchain setup. On macOS, `brew install cmake ninja python` provides the missing prerequisites. Run:

```sh
bash web/setup.sh
```

This downloads the pinned Emscripten and SDL toolchains into `.tools`, extracts your local disc resources and builds the game. After setup, rebuild with:

```sh
npm run build
```

To use an ISO at a different location:

```sh
bash web/build.sh "/absolute/path/to/your-disc.iso"
```

The build prepares approximately 10.4 MiB of disc resources. The ISO and intermediate extracted resources stay local and are ignored by the source-control rules. The deployable `web/dist` bundle is tracked, including `engine.js`, `engine.wasm`, and `engine.data`. Do not assume `engine.data` is source code: it contains the disc's game assets.

## GitHub Pages

`.github/workflows/pages.yml` publishes `web/dist` on every push to `main` and can also be run manually. The repository's Pages publishing source is **GitHub Actions**. CI deploys the prebuilt static bundle; it does not need the ISO, 3SX checkout, or native toolchains. When native code changes, rebuild locally and commit the updated engine files before pushing.

The game is hosted at **https://jpcrs.github.io/evo-moment-37/**. All runtime URLs are relative so the game works under the repository path.

## Verify

```sh
npm ci
npx playwright install chromium
npm test
node web/tests/audio.cjs
python3 web/audit_build.py
```

The browser integration test starts its own temporary local server, boots the real engine, checks the characters/stage/costumes/positions, compares the rendered scene before and after a KO and retry, verifies the neutral-input loss, plays the complete parry-and-KO sequence twice, tests keyboard input and pause, tests standard gamepad input, pause and retry through the browser input loop, and verifies resumed audio with nonzero PCM output from the original sound engine. It writes a screenshot to `web/tests/win.png`. The audio integration check verifies lazy loading, volume control, native super activation, track start offset, pause/resume, retry, and the two Help links.

Automated controller checks use the standard Gamepad API with a simulated pad. A physical controller has not been attached for this test. The build has been verified in Chromium; other WebGL 2 browsers are not yet separately verified.

## Attribution

Street Fighter III: 3rd Strike and its original game assets are Capcom's. 3SX is the [Crowded Street native port](https://github.com/crowded-street/3sx), derived from [3s-decomp](https://github.com/crowded-street/3s-decomp). Its AGPL-3.0 license and third-party notices are preserved in `3sx` and copied into `web/dist` by the build. The bundled Barlow Condensed and DM Sans fonts use the SIL Open Font License; their notices are in `web/dist/fonts`. SDL is distributed under the zlib license; Emscripten under MIT and University of Illinois/NCSA licenses. The browser port source in `web/native` is provided under the same AGPL-3.0 terms as the engine; the full license is in `LICENSE`. Help links to the engine project, decompilation project, browser port source, and license.
