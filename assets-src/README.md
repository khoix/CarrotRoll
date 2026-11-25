# Source (master) assets

These are the full-quality originals. They are **not** served to players.
`npm run optimize-assets` (needs `ffmpeg`) encodes them into `client/public/`:

| Master | Shipped as |
|---|---|
| `sounds/*.wav` (music, golden bunny, endgame static) | `client/public/sounds/*.m4a` (AAC 160 kbps) |
| `endgame/NN.png`, `endgame/mobile/NN.jpg` | `client/public/endgame/[mobile/]NN.webp` |
| `images/baseTile.png`, `images/detailTile.png` | `client/public/images/*.webp` |
| `images/waterMask.png` (2048²) | `client/public/images/waterMask.png` (1024², matches base tile) |

Short SFX and gapless ambient loops stay as WAV directly in `client/public/sounds/`
(`npm run generate-sounds` fills in any that are missing without overwriting real ones).
`sounds/demo/` (placeholder beeps), `music_endgame02.wav`, `endgame.png` and `endgame/slideshow.html` are kept here but unused by the game.
