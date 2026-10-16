# APEX GP

**Arcade Moto Grand Prix · Web Edition**

APEX GP is a fast, neon-styled motorcycle racing game that runs directly in the browser. Race against AI riders, challenge a friend in split-screen mode, manage your boost, and fight for the best lap time across multiple circuits.

![APEX GP](https://img.shields.io/badge/game-APEX%20GP-e63946?style=for-the-badge)
![Three.js](https://img.shields.io/badge/Three.js-0.160.0-black?style=for-the-badge&logo=three.js)
![License](https://img.shields.io/badge/license-not%20specified-lightgrey?style=for-the-badge)

## Features

- **Solo Race** against AI riders
- **Two-player split-screen** racing on the same keyboard
- Multiple circuits with a minimap and lap tracking
- Selectable difficulty:
  - Rookie
  - Pro
  - Legend
- Selectable race lengths: 1, 2, 3, or 5 laps
- Nitro boost system with an on-screen boost meter
- Race standings, best-lap timing, total race timing, and podium results
- Multiple camera views
- Procedural 3D track, bikes, scenery, lighting, and race effects
- Web Audio engine for racing sound effects
- USB gamepad support
- Responsive HUD and menu UI
- No build step or package installation required

## Getting Started

### Requirements

- A modern desktop browser with ES module support
- An internet connection on first load, since Three.js and fonts are loaded from CDNs
- Python, the Python launcher, or Node.js with `npx` for the included Windows launcher

### Windows quick start

Double-click [`start.bat`](./start.bat). The launcher will:

1. Find an available local port.
2. Start a local static HTTP server.
3. Open APEX GP in your default browser.

### Manual start

Because the game uses JavaScript modules, serve the project over HTTP rather than opening `index.html` directly.

Using Python:

```powershell
python -m http.server 8080
```

Or using the Python launcher on Windows:

```powershell
py -m http.server 8080
```

Then open <http://localhost:8080>.

Using `serve`:

```powershell
npx --yes serve -l 8080 .
```

## Controls

### Player 1

| Action | Keyboard |
| --- | --- |
| Accelerate | `W` |
| Brake | `S` |
| Steer left/right | `A` / `D` |
| Nitro boost | `Left Shift` or `Space` |

### Player 2

| Action | Keyboard |
| --- | --- |
| Accelerate | `Up Arrow` |
| Brake | `Down Arrow` |
| Steer left/right | `Left Arrow` / `Right Arrow` |
| Nitro boost | `Right Shift` or `Numpad 0` |

### Race controls

| Action | Key |
| --- | --- |
| Pause/resume | `P` |
| Change camera | `C` |
| Mute/unmute | `M` |
| Restart race | `R` |

Compatible gamepads can be used for steering. Connect gamepads before starting a race for the best results.

## How to Play

1. Choose **Solo Race** or **Split Screen** from the main menu.
2. Select a circuit, difficulty, and number of laps.
3. Accelerate out of the start and use the racing line to maintain speed.
4. Use nitro strategically on straights and when overtaking.
5. Complete the race before your opponents and aim for the fastest best lap.

## Project Structure

```text
.
├── index.html       # Game shell, menus, HUD, and Three.js import map
├── start.bat        # Windows local-server launcher
├── css/
│   └── style.css    # Menus, HUD, results screen, and responsive styling
└── js/
    ├── main.js      # Game lifecycle, menus, race loop, and state
    ├── input.js     # Keyboard and gamepad input
    ├── bike.js      # Bike physics and rider behavior
    ├── ai.js        # AI rider logic
    ├── track.js     # Track generation and race-world setup
    ├── tracks.js    # Circuit definitions
    ├── camera.js    # Race camera behavior
    ├── hud.js       # HUD, minimaps, timing, and standings
    ├── effects.js   # Visual race effects
    ├── audio.js     # Sound and mute controls
    └── utils.js     # Shared utilities
```

## Technology

- HTML5 Canvas
- Modern JavaScript ES modules
- [Three.js](https://threejs.org/) `0.160.0`
- Web Audio API
- CSS3

Three.js is referenced through the import map in [`index.html`](./index.html), so this project does not currently require `npm install`, a bundler, or a generated build directory.

## Development

The project is intentionally simple to run and modify:

1. Clone or download the repository.
2. Start a local HTTP server using one of the commands above.
3. Edit the source files.
4. Refresh the browser to test changes.

There is currently no automated test suite or build pipeline. Browser developer tools are useful for checking runtime errors and performance while working on the game.

## Browser Notes

- Use a Chromium-, Firefox-, or Safari-based browser with WebGL enabled.
- Browser autoplay policies may require the first interaction before audio can start.
- A larger window provides the best split-screen experience.
- Keep the game served from `localhost` so module and asset loading works consistently.

## License

No license has been specified for this repository yet.
