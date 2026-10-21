# Nailoong — Midnight Munchies

A standalone Halloween game rebuilt around the previously generated Nailoong GLB.

**Play:** https://extraordinary-croissant-b36d78.netlify.app/nailoong-night/

## The run

Visit all three trick-or-treat houses, collect at least 12 candies, and return to the glowing southern gate before the two-minute timer expires. You have three hearts. A belly laugh frightens nearby ghosts, earns extra candy, and shows a comic reaction; it recharges in six seconds. House doorsteps are safe places to plan the next move.

- Move with **WASD / arrow keys**, or click/tap the ground.
- Click a house or a named stop in the HUD to walk there and knock automatically.
- **Space**: belly laugh. **Shift**: dash. **E**: knock / interact.
- **C** or the camera button: switch between follow and overview cameras.
- **Esc**: pause. Leaving the tab also pauses the run.
- Phones have a directional pad and laugh, dash, and knock buttons.
- Xbox / standard gamepads are detected automatically. Connect the controller, click this game tab, then press **A** to claim control and start. **Left stick / D-pad** moves; **A** knocks or resumes; **X** laughs; **B / RT** dashes; **Y** changes camera; **Menu** pauses or resumes. A pause-menu toggle can disable controller input.
- Only the focused, visible game tab accepts input. Leaving the tab or disconnecting the active controller pauses the run. Reconnect and press A to resume. A radial deadzone filters stick drift, and held buttons do not retrigger after switching tabs. Physical-controller testing remains outstanding.

## Model and presentation

`../assets/nailoong.glb` is the existing reference model, not a replacement. Its `Idle_Breathe` and `Laugh_Belly` clips are retained. `character.js` adds a witch hat, short cape, pumpkin bucket, and procedural leg movement. Each instance uses independent animation state and materials.

The new market scene, ghosts, warm lanterns, pumpkin gate, navigation, particles, touch controls, and win/loss flow live entirely in this folder. The shared Three.js files are served from `../vendor/`; its license remains there. The game is browser-local; the best score is stored on the current device. It does not call the Memory Glitch AI backend.

## Files

- `game.js`: game loop, input, navigation, ghosts, camera, sound, and UI.
- `controller.js`: controller ownership, standard button mapping, focus safety, deadzone, and reconnect handling.
- `rules.js`: collectible, cooldown, health, timer, and victory rules.
- `character.js`: original GLB loading, animation, and Halloween accessories.
- `world.js`: market geometry, lighting props, house states, and ghosts.
- `index.html`, `style.css`: responsive interface.

## Verification

Five game-rule tests are in `tests/nailoong-night.test.mjs` at the repository root. Controller snapshot and command tests are in `tests/nailoong-controller.test.mjs`; they cover activation, button edges, deadzone, focus, reconnect, unsupported mappings, and pause/resume. These are simulated inputs, not a physical Xbox hardware test.

Browser verification completed a real run with 15 candies, all three houses visited, and one remaining heart. Restart, pause, laugh activation, and a 390 × 844 mobile layout were also checked. The model adapter was checked over 1,800 simulated animation frames for finite transforms and independent instances. This is not a performance benchmark or physical mobile/controller certification.

Run locally from the repository root:

```sh
python3 -m http.server 4196 --bind 127.0.0.1 --directory dist
```

Then open `http://127.0.0.1:4196/nailoong-night/`.
