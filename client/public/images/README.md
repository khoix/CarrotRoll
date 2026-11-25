# Background scroller assets

Place tileable textures here for the in-game background:

- **baseTile.png** (1024×1024) – Required. Seamless tileable forest+water top-down.
- **detailTile.png** (512×512) – Optional. Seamless noise/shadow overlay (parallax).
- **waterMask.png** (1024×1024) – Optional. Water = white, land = black (for water shimmer).

If `baseTile.png` is missing or fails to load, the game uses the procedural “flying over Earth” background instead.
