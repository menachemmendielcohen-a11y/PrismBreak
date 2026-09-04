# PRISM BREAK — Unity Port

This folder is a separate Unity 6 project. The original React/HTML5 game remains intact beside it.

## Open the project

1. Open Unity Hub.
2. Choose **Add project from disk**.
3. Select this `PrismBreak-Unity` folder.
4. Open it with Unity `6000.3.23f1`.
5. Open `Assets/Scenes/PrismBreak.unity` and press Play.

If the scene has not been generated yet, use **PRISM BREAK → Configure Project** once.

## Controls

- Mouse: the pointer is the ship.
- Automatic fire: targets the closest hostile.
- `Space`: Dash / Absorb.
- `Q` or left click: Refract stored spectrum energy; Prism Lance when available.
- `E`: open the Nova confirmation. Nova costs one shard fragment collected during the current run.
- `F`: Prism Smash.
- `P`: Pause / resume.
- `B`: hide or restore nonessential HUD panels.

## WebGL / CrazyGames

The installed Unity editor currently has Windows Standalone support only. Add **WebGL Build Support** for Unity `6000.3.23f1` through Unity Hub before creating a CrazyGames build. The port includes browser-save and platform bridge hooks, but no upload or deployment is performed automatically.

## Save migration

Unity uses save schema v4. On WebGL, the legacy bridge can import the existing browser profile (`prism-break-profile-v2`) so campaign, shards, ranks, Prime unlocks and permanent Prism Core powers can be preserved.

## Source layout

- `Assets/Scripts/Core` — shared state, deterministic math and constants.
- `Assets/Scripts/Combat` — upgrades and combat helpers.
- `Assets/Scripts/Runtime` — fixed-step game simulation.
- `Assets/Scripts/Progression` — Campaign, Prime, Threat and achievements.
- `Assets/Scripts/Save` — profile migration and persistence.
- `Assets/Scripts/Presentation` — menus, HUD, rendering, animation and music.
- `Assets/Scripts/Platform` — WebGL/CrazyGames-safe hooks.
- `Assets/Tests/EditMode` — deterministic formula and save tests.
