# The Pineapple Protocol

A pixel-art mystery game for Year 9 Computer Science students at Shrewsbury International School Bangkok.

## Stage 2 — Framing flow

This build covers everything before the puzzles:

- Title screen with animated PINEAPPLE wordmark
- "How to Play" modal
- Character select (Boy / Girl / Star)
- House select (all 6 houses with crests and themed colours)
- Name entry with live validation
- Opening cutscene (12 lines of dialogue, typewriter, PINEAPPLE reveal, Auntie radio)
- School map with 8 hotspots (6 required + 2 optional), inventory panel, progress bar, PINEAPPLE warning
- Room placeholder (puzzles arrive in stage 3+)

## How to run

The game is a static site — open `index.html` in any modern browser.

**Local testing on Windows / Mac:**
1. Unzip the folder somewhere
2. Either:
   - Double-click `index.html` (works for everything except the cutscene background image, which needs `file://` permissions some browsers block)
   - OR run `python3 -m http.server 8000` from inside the folder, then visit `http://localhost:8000`

**iPad testing:**
1. Host the folder on any web server (school server, Netlify drop, GitHub Pages, etc.)
2. Open the URL in Safari
3. Tap "Add to Home Screen" to make it feel like a native app (it includes the right meta tags)

## What to test

Run through the full flow once on each device:
- All three character options work
- All six house cards work
- Name validation rejects empty/short/special-character names
- Cutscene typewriter completes; tapping skips ahead
- Map shows your name, house, all 8 hotspots
- Pier hotspot is highlighted as next; clicking opens placeholder
- Back-to-map button works

## Known stage 2 limitations

These are intentionally deferred to later stages:
- Hotspot clicks open a placeholder, not the puzzle
- No audio files yet (sound effects are generated via Web Audio API)
- No save state (per design)
- No "back to title" button mid-game (deliberate — the game is short)

## Folder structure

```
pineapple-protocol/
├── index.html          # All screens and DOM scaffolding
├── css/style.css       # Full game stylesheet
├── js/game.js          # Game state, dialogue system, screen routing
├── ASSETS.md           # Asset manifest
└── assets/
    ├── scenes/    (11 backgrounds)
    ├── portraits/ (9 character heads)
    ├── pineapple/ (4 antagonist states)
    ├── houses/    (6 crests)
    └── items/     (7 inventory sprites)
```

## Stage 3+ roadmap

1. Pier puzzle — Boat Loading drag-and-drop
2. Library puzzle — Binary Decoder
3. Canteen puzzle — Flappy Mango
4. (optional) Field puzzle — Algorithm Coach
5. Theatre puzzle — Light the Stage
6. (optional) Rooftop puzzle — Antenna Alignment
7. CS Classroom puzzle — Debug the Code
8. Server Room finale — Containment Sequence
9. Victory + career cards summary
10. Polish pass: sound effects, PNG optimisation, transitions
