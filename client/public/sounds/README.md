# Game sounds

Add audio files here. The game expects these filenames (WAV, MP3, or OGG).

## Sound effects (SFX)

| File | Purpose |
|------|--------|
| `start.wav` | Played when the player starts a new game (from menu). |
| `carrot_collect.wav` | Played when the player collects a carrot. |
| `level_up.wav` | Played when the player completes a level and advances. |
| `powerup_heart.wav` | Played when the player collects the heart (extra life) power-up. |
| `powerup_shield.wav` | Played when the player collects the shield power-up. |
| `powerup_speed.wav` | Played when the player collects or uses the speed power-up. |
| `powerup_attract.wav` | Played when the player collects the Attract-o-Hare (magnet) power-up. |
| `hit_damage.wav` | Played when the player is hit by a ball and loses a life. |
| `shield_deflect.wav` | Played when the shield deflects a ball. |
| `ball_explode.wav` | Played when a ball is destroyed (e.g. hit by a shot). |
| `death.wav` | Played when the player dies (game over). |
| `carrot_shoot.wav` | Played when the giant carrot shoots. |
| `blaster_shoot.wav` | Played when the player fires the blasters. |
| `ui_click.wav` | Played when the player clicks a button or other UI element. |
| `golden_bunny.wav` | Loops while the player is at MAX hearts (10 — golden bunny). In-game music is paused while this plays and resumes when the player loses a heart. |
| `rapid_rabbit_loop.wav` | Looping ambience while the player is in Rapid Rabbit (speed boost) mode. |
| `attract_loop.wav` | Looping ambience while the player is in Attract-o-Hare (magnet) mode. |

## Music

| File | Purpose |
|------|--------|
| `music_menu.wav` | Background music on the main menu. |
| `music_ingame01.wav` … `music_ingame04.wav` | In-game music; played in order (01 → 02 → 03 → 04 → 01 …). Additional tracks (e.g. `music_ingame05.wav`) can be added by extending the `INGAME_MUSIC_FILES` array in `SoundContext.tsx`. |
| `music_gameover.wav` | Background music on the game over screen. |

Files are loaded from `/sounds/<name>` (e.g. `start.wav`, `music_menu.wav`). If a file is missing, playback is skipped without errors.
