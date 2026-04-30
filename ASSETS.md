# The Pineapple Protocol — Asset Manifest

Quick reference for every file the game uses, where it lives, and what it does.

## Folder layout

```
pineapple-protocol/
├── index.html              # Game entry point
├── ASSETS.md               # This file
├── css/
│   └── style.css           # All styling
├── js/
│   └── game.js             # All game logic (built room-by-room)
└── assets/
    ├── scenes/             # Full-width location backgrounds (16:9)
    ├── portraits/          # Character dialogue portraits (square)
    ├── pineapple/          # 4 antagonist states
    ├── houses/             # 6 house crests
    ├── items/              # 7 inventory item sprites
    └── audio/              # SFX (added later)
```

## Scene backgrounds (`assets/scenes/`)

| File | Used for |
|---|---|
| `map.png` | School map screen + title screen background (same image, dual-purpose) |
| `pier.png` | Room 1 — Boat Loading mini-game |
| `library.png` | Room 2 — Binary Decoder mini-game |
| `canteen.png` | Room 3 — Flappy Mango mini-game |
| `field.png` | Room 4 (optional) — Algorithm Coach mini-game |
| `theatre.png` | Room 5 — Light the Stage mini-game |
| `rooftop.png` | Room 6 (optional) — Antenna Alignment mini-game |
| `classroom.png` | Room 7 — Debug the Code mini-game |
| `server.png` | Room 8 — Containment Sequence finale |
| `auntie_reveal.png` | Post-finale reveal cutscene |
| `victory.png` | Final celebration / career cards screen |

## Portraits (`assets/portraits/`)

Used in the dialogue popup system. All square aspect ratio.

| File | Speaker |
|---|---|
| `player_boy.png` | Player character — Shrewsbury Boy |
| `player_girl.png` | Player character — Shrewsbury Girl |
| `player_star.png` | Player character — The Star |
| `auntie.png` | Lunch Auntie (pixel art version, default for dialogue) |
| `auntie_large.png` | Lunch Auntie (illustrated version, for larger feature moments) |
| `lovelace.png` | Ada Lovelace (Library cameo) |
| `hopper.png` | Grace Hopper (Theatre cameo) |
| `lamarr.png` | Hedy Lamarr (Pier cameo) |
| `pineapple.png` | PINEAPPLE — antagonist talking head |

## PINEAPPLE states (`assets/pineapple/`)

Used as the icosahedron visual on screen between rooms and during finale.

| File | Shown when |
|---|---|
| `healthy.png` | Intro / before player starts solving rooms |
| `glitching.png` | Mid-game (rooms 2–5) |
| `damaged.png` | Late game (rooms 6–7, after rooftop hit) |
| `defeated.png` | Finale victory moment |

## House crests (`assets/houses/`)

| File | House | Primary | Accent | Animal |
|---|---|---|---|---|
| `williams.png` | Williams | `#108040` (green) | Black | Dragon |
| `teresa.png` | Teresa | `#602090` (purple) | `#F0A93B` (gold) | Phoenix |
| `mandela.png` | Mandela | `#F08020` (orange) | `#1F2A55` (navy) | Fox |
| `schweitzer.png` | Schweitzer | `#D02020` (red) | White | Bull |
| `malala.png` | Malala | `#001020` (deep navy) | White | Griffin |
| `king.png` | King | `#00A0E0` (cyan) | `#1F4FB6` (royal blue) | Lion |

(Hex codes sampled from the crest PNGs and used for house-themed UI accents — borders, hover states, score badge.)

## Inventory items (`assets/items/`)

| File | Item | Acquired in | Used in |
|---|---|---|---|
| `usb.png` | USB Stick | Pier (Room 1) | Server room (crafting) |
| `note.png` | Decoded Note | Library (Room 2) | Auto-applied (unlocks next location) |
| `spray.png` | Pineapple Repellent | Canteen (Room 3) | Rooftop (Room 6 — weakens PINEAPPLE) |
| `shard1.png` | Containment Fragment 1/4 | Pier | Server room (crafting) |
| `shard2.png` | Containment Fragment 2/4 | Theatre | Server room (crafting) |
| `shard3.png` | Containment Fragment 3/4 | Classroom | Server room (crafting) |
| `shard4.png` | Containment Fragment 4/4 | Server room intro | Server room (crafting) |

## Audio (`assets/audio/`)

Will be populated during the polish pass. Planned files:

- `click.mp3` — UI button click
- `success.mp3` — Mini-game completion
- `fail.mp3` — Mini-game failure / wrong answer
- `pickup.mp3` — Item collected
- `transition.mp3` — Room change
- `pineapple_taunt.mp3` — PINEAPPLE dialogue appears
- `victory.mp3` — Finale completion

(All royalty-free or generated. No background music.)
