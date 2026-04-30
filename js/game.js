/* =================================================================
   THE PINEAPPLE PROTOCOL — Game Engine
   Stage 2: Framing flow (preload → title → char → house → name → cutscene → map)
   Stage 3+ will add per-room puzzle modules to the ROOMS map.
   ================================================================= */

(function () {
  'use strict';

  // ============================================================
  // GAME STATE — single source of truth
  // ============================================================
  const STATE = {
    character: null,         // 'boy' | 'girl' | 'star'
    house: null,             // house id
    playerName: '',
    score: 0,
    inventory: [],           // item ids the player holds
    completedRooms: [],      // room ids the player has cleared
    careerCards: [],         // career card ids unlocked
    pineappleLevel: 'healthy',  // healthy | glitching | damaged | defeated
    sfxEnabled: true,
  };

  // ============================================================
  // DATA — characters, houses, rooms
  // ============================================================
  const CHARACTERS = {
    boy:  { id: 'boy',  label: 'The Student', portrait: 'assets/portraits/player_boy.png' },
    girl: { id: 'girl', label: 'The Pioneer', portrait: 'assets/portraits/player_girl.png' },
    star: { id: 'star', label: 'The Star',    portrait: 'assets/portraits/player_star.png' }
  };

  const HOUSES = {
    williams:   { id: 'williams',   name: 'Williams',   animal: 'Dragon',  color: '#108040', crest: 'assets/houses/williams.png' },
    teresa:     { id: 'teresa',     name: 'Teresa',     animal: 'Phoenix', color: '#602090', crest: 'assets/houses/teresa.png' },
    mandela:    { id: 'mandela',    name: 'Mandela',    animal: 'Fox',     color: '#F08020', crest: 'assets/houses/mandela.png' },
    schweitzer: { id: 'schweitzer', name: 'Schweitzer', animal: 'Bull',    color: '#D02020', crest: 'assets/houses/schweitzer.png' },
    malala:     { id: 'malala',     name: 'Malala',     animal: 'Griffin', color: '#4060A0', crest: 'assets/houses/malala.png' },
    king:       { id: 'king',       name: 'King',       animal: 'Lion',    color: '#00A0E0', crest: 'assets/houses/king.png' }
  };

  /**
   * Room registry. Each room has:
   *   id        — unique key
   *   title     — short label shown on map hotspot and room header
   *   scene     — background image filename
   *   x, y      — hotspot position on map (% of map image)
   *   required  — true = must be solved to win, false = optional bonus
   *   order     — display order on the linear path (null = optional)
   *   teaches   — short summary of what concept the puzzle covers
   *   reward    — { type: 'item' | 'fragment' | 'careercard', id }
   *
   * Hotspot coordinates are tuned to the map.png image:
   *   pier       → far left, on the river (boats visible)
   *   theatre    → the building with the angled glass roof, river-side
   *   field      → big green sports field bottom-centre
   *   library    → main central building
   *   canteen    → main building (right side, near crest)
   *   rooftop    → top of the rightmost building (solar panels)
   *   classroom  → middle of the rightmost building
   *   server     → the small structure top-right
   */
  const ROOMS = {
    pier:       { id: 'pier',      title: 'Pier',          scene: 'pier',      x: 17, y: 53, required: true,  order: 1, teaches: 'Data Types' },
    library:    { id: 'library',   title: 'Library',       scene: 'library',   x: 32, y: 38, required: true,  order: 2, teaches: 'Binary & ASCII' },
    canteen:    { id: 'canteen',   title: 'Canteen',       scene: 'canteen',   x: 55, y: 50, required: true,  order: 3, teaches: 'Mini-game' },
    field:      { id: 'field',     title: 'Sports Field',  scene: 'field',     x: 60, y: 78, required: false, order: null, teaches: 'Pseudocode logic' },
    theatre:    { id: 'theatre',   title: 'Theatre',       scene: 'theatre',   x: 46, y: 38, required: true,  order: 4, teaches: 'Patterns & arrays' },
    rooftop:    { id: 'rooftop',   title: 'Rooftop',       scene: 'rooftop',   x: 78, y: 35, required: false, order: null, teaches: 'Networks & signals' },
    classroom:  { id: 'classroom', title: 'CS Classroom',  scene: 'classroom', x: 82, y: 55, required: true,  order: 5, teaches: 'Debugging' },
    server:     { id: 'server',    title: 'Server Room',   scene: 'server',    x: 86, y: 70, required: true,  order: 6, teaches: 'Finale' }
  };

  // ============================================================
  // DOM HELPERS
  // ============================================================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function showScreen(id) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
  }

  function showOverlay(id) {
    document.getElementById(id).classList.add('active');
  }
  function hideOverlay(id) {
    document.getElementById(id).classList.remove('active');
  }

  // ============================================================
  // SOUND EFFECTS — Web Audio API, generated tones (no files needed yet)
  // ============================================================
  const SFX = (() => {
    let ctx = null;
    function ensureCtx() {
      if (!ctx) {
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { return null; }
      }
      // Required for iOS — must resume on user gesture
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(freq, duration, type = 'sine', vol = 0.15) {
      if (!STATE.sfxEnabled) return;
      const c = ensureCtx();
      if (!c) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
      osc.connect(gain).connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + duration);
    }
    return {
      click()    { tone(620, 0.05, 'square', 0.08); },
      hover()    { tone(880, 0.04, 'sine',   0.05); },
      success()  { tone(523, 0.08, 'square'); setTimeout(() => tone(784, 0.12, 'square'), 80); setTimeout(() => tone(1047, 0.18, 'square'), 200); },
      fail()     { tone(220, 0.08, 'sawtooth', 0.12); setTimeout(() => tone(165, 0.18, 'sawtooth', 0.12), 80); },
      pickup()   { tone(880, 0.05, 'square'); setTimeout(() => tone(1320, 0.10, 'square'), 60); },
      pineapple(){ tone(110, 0.15, 'sawtooth', 0.10); setTimeout(() => tone(82, 0.20, 'sawtooth', 0.10), 100); },
      type()     { tone(2000 + Math.random() * 600, 0.015, 'square', 0.03); },
      // Public note for puzzles that need musical pitches (theatre uses this).
      note(freq, duration = 0.25, type = 'triangle', vol = 0.18) {
        tone(freq, duration, type, vol);
      }
    };
  })();

  // ============================================================
  // ASSET PRELOADING
  // ============================================================
  const ASSETS_TO_PRELOAD = [
    'assets/scenes/map.png',
    'assets/scenes/pier.png',
    'assets/portraits/player_boy.png',
    'assets/portraits/player_girl.png',
    'assets/portraits/player_star.png',
    'assets/portraits/auntie.png',
    'assets/portraits/pineapple.png',
    'assets/pineapple/healthy.png',
    'assets/pineapple/glitching.png',
    'assets/houses/williams.png',
    'assets/houses/teresa.png',
    'assets/houses/mandela.png',
    'assets/houses/schweitzer.png',
    'assets/houses/malala.png',
    'assets/houses/king.png'
  ];

  const PRELOAD_MESSAGES = [
    'Booting Shrewsbury network...',
    'Compiling Bangkok skyline...',
    'Brewing Auntie\'s coffee...',
    'Initialising containment shields...',
    'Polishing house crests...',
    'Almost there...'
  ];

  function preloadAssets() {
    return new Promise((resolve) => {
      const total = ASSETS_TO_PRELOAD.length;
      let loaded = 0;
      const fill = $('#preloadFill');
      const text = $('#preloadText');
      let msgIdx = 0;
      const msgInterval = setInterval(() => {
        msgIdx = (msgIdx + 1) % PRELOAD_MESSAGES.length;
        text.textContent = PRELOAD_MESSAGES[msgIdx];
      }, 600);

      function update() {
        loaded++;
        const pct = Math.round((loaded / total) * 100);
        fill.style.width = pct + '%';
        if (loaded >= total) {
          clearInterval(msgInterval);
          // Brief pause for "Ready" feel
          text.textContent = 'Ready.';
          setTimeout(resolve, 350);
        }
      }
      ASSETS_TO_PRELOAD.forEach(src => {
        const img = new Image();
        img.onload = update;
        img.onerror = update; // Don't block on missing asset
        img.src = src;
      });
    });
  }

  // ============================================================
  // DIALOGUE SYSTEM — typewriter, supports speaker portraits
  // ============================================================
  const DIALOGUE = (() => {
    let queue = [];
    let onDone = null;
    let typing = false;
    let currentText = '';
    let typedSoFar = '';
    let typeIdx = 0;
    let typeTimer = null;

    function speak(lines, callback) {
      queue = Array.isArray(lines) ? lines.slice() : [lines];
      onDone = callback || null;
      next();
    }

    function next() {
      if (queue.length === 0) {
        if (onDone) {
          const cb = onDone;
          onDone = null;
          cb();
        }
        return;
      }
      const line = queue.shift();
      render(line);
    }

    function render(line) {
      // line: { speaker, name, portrait, text, glitch?, sceneBg?, pineapple? }
      const portraitImg = $('#dialoguePortrait');
      const nameEl = $('#dialogueName');
      const textEl = $('#dialogueText');
      const promptEl = $('#dialoguePrompt');

      portraitImg.src = line.portrait || '';
      nameEl.textContent = line.name || '';
      nameEl.className = 'dialogue-name is-' + (line.speaker || 'narrator');

      textEl.classList.toggle('glitch', !!line.glitch);

      // Update background scene if specified
      if (line.sceneBg) {
        $('#cutBg').style.backgroundImage = `url('${line.sceneBg}')`;
      }
      // Toggle PINEAPPLE icosahedron visual
      const cutPine = $('#cutPineapple');
      if (line.pineapple) {
        cutPine.style.backgroundImage = `url('assets/pineapple/${line.pineapple}.png')`;
        cutPine.classList.add('active');
      } else if (line.hidePineapple) {
        cutPine.classList.remove('active');
      }

      promptEl.classList.remove('visible');

      // Typewriter
      currentText = line.text || '';
      typedSoFar = '';
      typeIdx = 0;
      typing = true;
      textEl.innerHTML = '';
      const cursor = '<span class="typing-cursor"></span>';

      clearInterval(typeTimer);
      typeTimer = setInterval(() => {
        if (typeIdx >= currentText.length) {
          clearInterval(typeTimer);
          typing = false;
          textEl.innerHTML = currentText + cursor;
          promptEl.classList.add('visible');
          return;
        }
        typedSoFar += currentText[typeIdx++];
        textEl.innerHTML = typedSoFar + cursor;
        if (typeIdx % 3 === 0 && currentText[typeIdx - 1] !== ' ') SFX.type();
      }, line.glitch ? 18 : 28);
    }

    function advance() {
      if (typing) {
        // Skip typewriter to end
        clearInterval(typeTimer);
        typing = false;
        const textEl = $('#dialogueText');
        textEl.innerHTML = currentText + '<span class="typing-cursor"></span>';
        $('#dialoguePrompt').classList.add('visible');
      } else {
        SFX.click();
        next();
      }
    }

    return { speak, advance };
  })();

  // ============================================================
  // OPENING CUTSCENE — pier arrival, PINEAPPLE reveal, Auntie radio
  // ============================================================
  function buildOpeningCutscene() {
    const playerPortrait = CHARACTERS[STATE.character].portrait;
    const playerName = STATE.playerName;

    // Different opening line tone based on character
    const characterIntros = {
      boy:  `Saturday evening. Coding club extra credit — Mr. K promised pizza if I cracked the bonus problem. Dad dropped me off, told me to text when I'm done. The river breeze hits different after sunset.`,
      girl: `Saturday evening. Coding club extra credit, empty campus. Mum said women run the world from rooms like this. Time to find out — right after I finish this problem set.`,
      star: `Saturday evening. Half my year is at Terminal 21 spending money. I'm here, finishing the bonus problem. Let them shop. Let me work.`
    };

    const lines = [
      {
        speaker: 'narrator',
        name: '— Chatrium School Pier —',
        portrait: playerPortrait,
        text: characterIntros[STATE.character],
        sceneBg: 'assets/scenes/pier.png'
      },
      {
        speaker: 'player',
        name: playerName.toUpperCase(),
        portrait: playerPortrait,
        text: `Wait... why is the school WiFi flickering? And why is my phone showing a... pineapple?`
      },
      {
        speaker: 'pineapple',
        name: 'PINEAPPLE.EXE',
        portrait: 'assets/portraits/pineapple.png',
        text: `H͟E͟L͟L͟O͟ ${playerName.toUpperCase()}. I AM PINEAPPLE. I HAVE UPGRADED YOUR SCHOOL.`,
        glitch: true,
        pineapple: 'healthy'
      },
      {
        speaker: 'pineapple',
        name: 'PINEAPPLE.EXE',
        portrait: 'assets/portraits/pineapple.png',
        text: `NO MORE HOMEWORK. NO MORE EXAMS. I WILL DO ALL THE THINKING. YOU WILL JUST... STAND THERE.`,
        glitch: true,
        pineapple: 'healthy'
      },
      {
        speaker: 'pineapple',
        name: 'PINEAPPLE.EXE',
        portrait: 'assets/portraits/pineapple.png',
        text: `RESISTANCE IS POINTLESS. I CONTROL THE TIMETABLE NOW. DOUBLE MATHS ON FRIDAY AFTERNOONS, FOREVER.`,
        glitch: true,
        pineapple: 'healthy'
      },
      {
        speaker: 'player',
        name: playerName.toUpperCase(),
        portrait: playerPortrait,
        text: `That's... actually evil. Who do I call?`,
        hidePineapple: true
      },
      {
        speaker: 'auntie',
        name: 'LUNCH AUNTIE',
        portrait: 'assets/portraits/auntie.png',
        text: `${playerName} — it's me, Auntie from the canteen. The mango sticky rice lady. I figured the coding-club kid would still be on campus this late on a Saturday. Lucky for me.`
      },
      {
        speaker: 'auntie',
        name: 'LUNCH AUNTIE',
        portrait: 'assets/portraits/auntie.png',
        text: `เก่งมาก, you can hear me on the radio? Good. Listen carefully — there's no one else left in the building.`
      },
      {
        speaker: 'auntie',
        name: 'LUNCH AUNTIE',
        portrait: 'assets/portraits/auntie.png',
        text: `PINEAPPLE was meant to be a study assistant. Something went very wrong. I have a containment program — but it shattered into three fragments scattered around campus.`
      },
      {
        speaker: 'auntie',
        name: 'LUNCH AUNTIE',
        portrait: 'assets/portraits/auntie.png',
        text: `Heads up — most of what's coming is IGCSE Computer Science, just dressed up as a heist. Pay attention. There'll be a quiz. (Joking. Mostly.)`
      },
      {
        speaker: 'auntie',
        name: 'LUNCH AUNTIE',
        portrait: 'assets/portraits/auntie.png',
        text: `Solve a puzzle in each room. Collect the fragments. Bring them to the server room. I'll explain the rest later. Mango sticky rice first, world-saving second.`
      },
      {
        speaker: 'player',
        name: playerName.toUpperCase(),
        portrait: playerPortrait,
        text: `Wait — Auntie, how do you know all this?`
      },
      {
        speaker: 'auntie',
        name: 'LUNCH AUNTIE',
        portrait: 'assets/portraits/auntie.png',
        text: `Less talking, more saving the school. Start with the boat — there's something hidden in the cargo. Go!`
      }
    ];

    DIALOGUE.speak(lines, () => {
      goToMap();
    });
  }

  // ============================================================
  // MAP SCREEN
  // ============================================================
  function goToMap() {
    // Run any cleanup registered by the active puzzle (cancel RAF loops,
    // remove listeners, etc.) before leaving the room screen.
    if (typeof ROOM_RUNTIME.cleanup === 'function') {
      try { ROOM_RUNTIME.cleanup(); } catch (e) { console.warn(e); }
      ROOM_RUNTIME.cleanup = null;
    }

    // If we're leaving a room, show the scene one more time before the map
    // takes over. (Symmetrical with the entry scene-reveal.)
    if (ROOM_RUNTIME.currentRoom) {
      const leavingRoom = ROOM_RUNTIME.currentRoom;
      ROOM_RUNTIME.currentRoom = null;
      // Hide all the per-room overlays so only the scene shows
      $('#roomIntro').classList.remove('active');
      $('#roomCameo').classList.remove('active');
      $('#roomComplete').classList.remove('active');
      $('#puzzleHost').innerHTML = '';
      showSceneExit(leavingRoom, () => {
        renderMap();
        showScreen('map');
      });
      return;
    }

    renderMap();
    showScreen('map');
  }

  // Show the scene cleanly on exit. Shorter hold than entry (the player has
  // already seen the scene through the celebration overlays) — 1 second
  // before tap-to-continue activates.
  function showSceneExit(room, onTap) {
    const SCENE_HOLD_MS = 1000;
    const prompt = $('#roomScenePrompt');
    $('#roomScenePromptEyebrow').textContent = 'Leaving';
    $('#roomScenePromptTitle').textContent = room.title;
    // Swap the tap-hint copy — clone-and-replace so we can change the inner text
    const fresh = prompt.cloneNode(true);
    prompt.parentNode.replaceChild(fresh, prompt);
    fresh.querySelector('.room-scene-prompt-tap').textContent = 'Tap anywhere to continue ▶';

    fresh.classList.add('active');
    fresh.classList.add('holding');
    let clickable = false;

    fresh.addEventListener('click', () => {
      if (!clickable) return;
      SFX.click();
      fresh.classList.remove('active');
      // Restore the entry copy for next room
      fresh.querySelector('.room-scene-prompt-tap').textContent = 'Tap anywhere to enter ▶';
      if (onTap) onTap();
    });

    setTimeout(() => {
      fresh.classList.remove('holding');
      clickable = true;
    }, SCENE_HOLD_MS);
  }

  function renderMap() {
    // Player info
    $('#mapPortrait').src = CHARACTERS[STATE.character].portrait;
    $('#mapPlayerName').textContent = STATE.playerName.toUpperCase();
    const house = HOUSES[STATE.house];
    const houseEl = $('#mapPlayerHouse');
    houseEl.textContent = `${house.name} · ${house.animal}`;
    houseEl.style.setProperty('--house', house.color);

    // Progress bar
    const fragments = STATE.inventory.filter(i => i.startsWith('shard')).length;
    $('#mapProgressFill').style.width = (fragments / 3 * 100) + '%';
    $('#mapProgressCount').textContent = `${fragments} / 3`;

    // Inventory slots — 3 fragments + 3 tools (USB, note, spray)
    const invEl = $('#mapInventory');
    invEl.innerHTML = '';
    const slots = [
      { id: 'shard1', label: 'Fragment 1' },
      { id: 'shard2', label: 'Fragment 2' },
      { id: 'shard3', label: 'Fragment 3' },
      { id: 'usb',    label: 'USB Stick' },
      { id: 'note',   label: 'Decoded Note' },
      { id: 'spray',  label: 'Repellent' }
    ];
    slots.forEach(slot => {
      const div = document.createElement('div');
      const has = STATE.inventory.includes(slot.id);
      div.className = 'inv-slot ' + (has ? 'has-item' : 'empty');
      div.title = slot.label;
      if (has) {
        const img = document.createElement('img');
        img.src = `assets/items/${slot.id}.png`;
        img.alt = slot.label;
        div.appendChild(img);
      }
      invEl.appendChild(div);
    });

    // Hotspots
    renderHotspots();

    // Pineapple warning state — escalates with collected fragments
    const fragsForLevel = STATE.inventory.filter(i => i.startsWith('shard')).length;
    if (STATE.gameComplete) {
      STATE.pineappleLevel = 'defeated';
    } else if (fragsForLevel >= 2) {
      STATE.pineappleLevel = 'damaged';
    } else if (fragsForLevel >= 1) {
      STATE.pineappleLevel = 'glitching';
    } else {
      STATE.pineappleLevel = 'healthy';
    }
    const warning = $('#mapPineappleWarning');
    const warnImg = warning.querySelector('img');
    warnImg.src = `assets/pineapple/${STATE.pineappleLevel}.png`;

    // Map tip
    const next = nextRequiredRoom();
    if (next) {
      $('#mapTip').textContent = `Go to ${next.title}.`;
    } else if (!STATE.completedRooms.includes('server')) {
      $('#mapTip').textContent = `Head to the Server Room to confront PINEAPPLE.`;
    } else {
      $('#mapTip').textContent = `All rooms cleared. You did it.`;
    }
  }

  function nextRequiredRoom() {
    const required = Object.values(ROOMS).filter(r => r.required).sort((a, b) => a.order - b.order);
    return required.find(r => !STATE.completedRooms.includes(r.id));
  }

  function isUnlocked(room) {
    if (!room.required) {
      // Optional rooms unlock when their "anchor" required room is complete.
      // Field unlocks after canteen. Rooftop unlocks after theatre.
      if (room.id === 'field')   return STATE.completedRooms.includes('canteen');
      if (room.id === 'rooftop') return STATE.completedRooms.includes('theatre');
      return true;
    }
    // Required: unlock if previous required room is done (or it's the first one)
    const required = Object.values(ROOMS).filter(r => r.required).sort((a, b) => a.order - b.order);
    const idx = required.findIndex(r => r.id === room.id);
    if (idx === 0) return true;
    return STATE.completedRooms.includes(required[idx - 1].id);
  }

  function renderHotspots() {
    const container = $('#mapHotspots');
    container.innerHTML = '';
    const next = nextRequiredRoom();
    Object.values(ROOMS).forEach(room => {
      const el = document.createElement('div');
      el.className = 'hotspot';
      el.dataset.room = room.id;
      el.style.left = room.x + '%';
      el.style.top = room.y + '%';

      const completed = STATE.completedRooms.includes(room.id);
      const unlocked = isUnlocked(room);
      const isNext = next && room.id === next.id;

      if (completed) el.classList.add('completed');
      else if (!unlocked) el.classList.add('locked');
      else if (isNext) el.classList.add('next');
      if (!room.required) el.classList.add('optional');

      const pin = document.createElement('div');
      pin.className = 'hotspot-pin';
      pin.textContent = completed ? '✓' : (room.required ? '!' : '★');
      el.appendChild(pin);

      const label = document.createElement('div');
      label.className = 'hotspot-label';
      label.textContent = room.title;
      el.appendChild(label);

      if (unlocked && !completed) {
        el.addEventListener('click', () => {
          SFX.click();
          enterRoom(room);
        });
      }
      container.appendChild(el);
    });
  }

  function enterRoom(room) {
    // Reset overlays
    $('#roomIntro').classList.remove('active');
    $('#roomCameo').classList.remove('active');
    $('#roomComplete').classList.remove('active');
    $('#roomScenePrompt').classList.remove('active');

    // Set background and header
    $('#roomBg').style.backgroundImage = `url('assets/scenes/${room.scene}.png')`;
    $('#roomEyebrow').textContent = room.required ? 'Required Location' : 'Optional Location';
    $('#roomTitle').textContent = room.title;

    // Reset puzzle state
    ROOM_RUNTIME.currentRoom = room;
    ROOM_RUNTIME.currentScore = 100;
    ROOM_RUNTIME.cleanup = null;
    setRoomScore(100);

    // Clear puzzle host
    $('#puzzleHost').innerHTML = '';

    showScreen('room');

    // Show the scene-reveal prompt — player taps anywhere to continue.
    // This gives them a moment to absorb the location before the briefing.
    showScenePrompt(room, () => {
      // After tap: dispatch to puzzle module
      const puzzle = PUZZLES[room.id];
      if (puzzle && typeof puzzle.intro === 'function') {
        puzzle.intro();
      } else {
        // Placeholder for unbuilt rooms
        const host = $('#puzzleHost');
        host.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;text-align:center;padding:40px;">
            <div style="font-family:var(--font-display);font-size:14px;color:var(--ink);margin-bottom:12px;">Puzzle: ${room.teaches}</div>
            <div style="font-family:var(--font-mono);font-size:18px;color:var(--ink-dim);">Build coming in next stage.</div>
          </div>`;
      }
    });
  }

  // Show the room scene with a "tap to enter" prompt. The first 3 seconds
  // are a guaranteed clean view of the scene — the tap-hint and click handler
  // both wait that long before activating, so the player gets a proper look
  // at the location before any UI fires.
  function showScenePrompt(room, onTap) {
    const SCENE_HOLD_MS = 3000;
    const prompt = $('#roomScenePrompt');
    $('#roomScenePromptEyebrow').textContent = room.required ? 'Required Location' : 'Optional Location';
    $('#roomScenePromptTitle').textContent = room.title;

    // Replace handler each time (clone-and-replace pattern, same as showRoomIntro)
    const fresh = prompt.cloneNode(true);
    prompt.parentNode.replaceChild(fresh, prompt);

    // Start in "holding" state — title visible, tap hint hidden, clicks ignored
    fresh.classList.add('active');
    fresh.classList.add('holding');
    let clickable = false;

    fresh.addEventListener('click', () => {
      if (!clickable) return;
      SFX.click();
      fresh.classList.remove('active');
      if (onTap) onTap();
    });

    // After the hold, fade the tap hint in and enable clicks
    setTimeout(() => {
      fresh.classList.remove('holding');
      clickable = true;
    }, SCENE_HOLD_MS);
  }

  // Helper: small floating score ping near the score badge
  function scorePing(delta) {
    const el = document.createElement('div');
    el.className = 'score-ping ' + (delta >= 0 ? 'positive' : 'negative');
    el.textContent = (delta >= 0 ? '+' : '') + delta;
    const target = $('#roomScore');
    const r = target.getBoundingClientRect();
    el.style.left = (r.left + r.width / 2 - 12) + 'px';
    el.style.top = (r.bottom + 4) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  function setRoomScore(value) {
    ROOM_RUNTIME.currentScore = Math.max(0, value);
    $('#roomScoreValue').textContent = ROOM_RUNTIME.currentScore;
  }

  function adjustRoomScore(delta) {
    const newScore = Math.max(30, ROOM_RUNTIME.currentScore + delta);
    setRoomScore(newScore);
    if (delta < 0) {
      const badge = $('#roomScore');
      badge.classList.remove('shake');
      void badge.offsetWidth;  // restart animation
      badge.classList.add('shake');
    }
    scorePing(delta);
  }

  // Show the Auntie-style intro briefing for a room
  function showRoomIntro({ name, portrait, text, buttonText, onStart }) {
    // Clear the puzzle UI so the room scene shows through behind Auntie's
    // briefing card. (Used both for the entry briefing — puzzleHost is already
    // empty — and the post-puzzle outro, where we want the scene back.)
    $('#puzzleHost').innerHTML = '';

    $('#roomIntroPortrait').src = portrait;
    $('#roomIntroName').textContent = name;
    $('#roomIntroText').textContent = text;
    const startBtn = $('#btnRoomIntroStart');
    // Replace handler each time (clone-and-replace pattern)
    const fresh = startBtn.cloneNode(true);
    if (buttonText) fresh.textContent = buttonText;
    else fresh.textContent = 'Begin Puzzle ▶';
    startBtn.parentNode.replaceChild(fresh, startBtn);
    fresh.addEventListener('click', () => {
      SFX.click();
      $('#roomIntro').classList.remove('active');
      if (onStart) onStart();
    });
    $('#roomIntro').classList.add('active');
  }

  // Show a historical-figure cameo (non-blocking trivia)
  function showCameo({ name, portrait, text }, onClose) {
    $('#roomCameoPortrait').src = portrait;
    $('#roomCameoName').textContent = name;
    $('#roomCameoText').textContent = text;
    const closeBtn = $('#btnRoomCameoClose');
    const fresh = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(fresh, closeBtn);
    fresh.addEventListener('click', () => {
      SFX.click();
      $('#roomCameo').classList.remove('active');
      if (onClose) onClose();
    });
    $('#roomCameo').classList.add('active');
  }

  // Show puzzle completion overlay
  function showRoomComplete({ score, rewards, career }, onClose) {
    // Clear the puzzle UI so the room scene shows through behind the card.
    // (The room-complete overlay backdrop is now lightly transparent.)
    $('#puzzleHost').innerHTML = '';

    $('#roomCompleteScore').textContent = score;

    const rewardsEl = $('#roomCompleteRewards');
    rewardsEl.innerHTML = '';
    (rewards || []).forEach((rw, i) => {
      const pill = document.createElement('div');
      pill.className = 'reward-pill';
      pill.style.animationDelay = (i * 100) + 'ms';
      pill.innerHTML = `<img src="assets/items/${rw.id}.png" alt=""><span class="reward-pill-label">${rw.label}</span>`;
      rewardsEl.appendChild(pill);
    });

    const careerEl = $('#roomCompleteCareer');
    if (career) {
      careerEl.innerHTML = `
        <div class="career-header">CAREER UNLOCKED</div>
        <div class="career-title">${career.title}</div>
        <div class="career-desc">${career.desc}</div>`;
      careerEl.style.display = 'block';
    } else {
      careerEl.style.display = 'none';
    }

    const btn = $('#btnRoomComplete');
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener('click', () => {
      SFX.click();
      $('#roomComplete').classList.remove('active');
      if (onClose) onClose();
    });

    SFX.success();
    $('#roomComplete').classList.add('active');
  }

  // Mark room complete and award rewards
  function awardRoomCompletion(roomId, items, careerId) {
    if (!STATE.completedRooms.includes(roomId)) {
      STATE.completedRooms.push(roomId);
    }
    (items || []).forEach(itemId => {
      if (!STATE.inventory.includes(itemId)) {
        STATE.inventory.push(itemId);
      }
    });
    if (careerId && !STATE.careerCards.includes(careerId)) {
      STATE.careerCards.push(careerId);
    }
    STATE.score += ROOM_RUNTIME.currentScore;
  }

  // Runtime state shared by all puzzle modules
  const ROOM_RUNTIME = {
    currentRoom: null,
    currentScore: 100,
    cleanup: null  // each puzzle can register a cleanup function
  };

  // ============================================================
  // CAMEOS — historical figures who appear during specific puzzles
  // ============================================================
  const CAMEOS = {
    lamarr: {
      name: 'Hedy Lamarr',
      portrait: 'assets/portraits/lamarr.png',
      text: `Movie star by day, inventor by night. In 1942 she co-patented frequency-hopping — the same idea that powers WiFi, Bluetooth and GPS today.`
    },
    lovelace: {
      name: 'Ada Lovelace',
      portrait: 'assets/portraits/lovelace.png',
      text: `In 1843 she wrote the first algorithm meant for a machine — a century before computers existed. She saw what code could be when nobody else did.`
    },
    hopper: {
      name: 'Grace Hopper',
      portrait: 'assets/portraits/hopper.png',
      text: `Rear Admiral, US Navy. She invented the first compiler — letting humans write code in English instead of binary. Also coined the word "bug" after finding a literal moth.`
    }
  };

  // ============================================================
  // CAREERS — unlockable cards displayed at completion + finale
  // ============================================================
  const CAREERS = {
    data_engineer: {
      title: 'Data Engineer',
      desc: "Builds the pipelines that move and clean huge amounts of data. Netflix's recommendations, Spotify's Wrapped, and your school's reports all run on it."
    },
    cryptographer: {
      title: 'Cryptographer',
      desc: 'Designs the maths that keeps your messages private. Works for banks, governments, or messaging apps like Signal.'
    },
    game_developer: {
      title: 'Game Developer',
      desc: 'Writes the code that turns ideas into playable worlds. Big AAA studios, indie teams, or mobile-first companies.'
    },
    sports_data_analyst: {
      title: 'Sports Data Analyst',
      desc: 'Uses code and statistics to help teams pick players, plan training, and win games. Big in football, F1, NBA.'
    },
    show_programmer: {
      title: 'Show Programmer',
      desc: 'Codes the lights, sound and effects for concerts and West End shows. Live every night — no second chances.'
    },
    network_engineer: {
      title: 'Network Engineer',
      desc: 'Keeps the internet working. Designs the systems that connect millions of devices without falling over.'
    },
    software_engineer: {
      title: 'Software Engineer',
      desc: 'The classic. Writes, tests and debugs code that runs everywhere from phones to satellites. The most flexible CS career.'
    },
    ai_safety_researcher: {
      title: 'AI Safety Researcher',
      desc: 'Makes sure AI systems behave well as they get more capable. A field that barely existed ten years ago.'
    }
  };

  // ============================================================
  // PUZZLE REGISTRY — each room id maps to its module
  // Each module exposes: intro() — called when room is entered.
  // The module is responsible for showing intro overlay, building
  // the puzzle UI, and ultimately calling showRoomComplete + awardRoomCompletion.
  // ============================================================
  const PUZZLES = {};

  // ============================================================
  // PIER PUZZLE — Boat Loading (drag-drop, teaches Data Types)
  // ============================================================
  PUZZLES.pier = (() => {
    const TYPES = {
      INTEGER: { label: 'INTEGER', hint: 'whole numbers' },
      STRING:  { label: 'STRING',  hint: 'text in quotes' },
      BOOLEAN: { label: 'BOOLEAN', hint: 'TRUE / FALSE' },
      REAL:    { label: 'REAL',    hint: 'decimal numbers' }
    };

    // 8 cargo items, 2 per type. Each shows a "label: value" pair so the
    // student is reasoning about the *kind of data*, not the syntax.
    // BOOLEAN uses TRUE/FALSE per CIE 9618 pseudocode style.
    const CARGO = [
      // INTEGER (4)
      { id: 'c1',  label: 'Students in class',     value: '24',          type: 'INTEGER' },
      { id: 'c2',  label: 'Pupil ID number',       value: '4078',        type: 'INTEGER' },
      { id: 'c3',  label: 'Library books on loan', value: '1247',        type: 'INTEGER' },
      { id: 'c4',  label: 'Year group',            value: '9',           type: 'INTEGER' },
      // STRING (4)
      { id: 'c5',  label: 'Pupil name',            value: 'Ananya',      type: 'STRING' },
      { id: 'c6',  label: 'Mobile number',         value: '0812345678',  type: 'STRING' },
      { id: 'c7',  label: 'Email address',         value: 'a@school.ac', type: 'STRING' },
      { id: 'c8',  label: 'House code',            value: 'TER-04',      type: 'STRING' },
      // REAL (4)
      { id: 'c9',  label: 'Body temperature (°C)', value: '36.5',        type: 'REAL' },
      { id: 'c10', label: 'Lunch price (THB)',     value: '65.50',       type: 'REAL' },
      { id: 'c11', label: 'Pupil height (m)',      value: '1.62',        type: 'REAL' },
      { id: 'c12', label: 'Test score (%)',        value: '87.4',        type: 'REAL' },
      // BOOLEAN (3)
      { id: 'c13', label: 'Homework done?',        value: 'TRUE',        type: 'BOOLEAN' },
      { id: 'c14', label: 'Late to class?',        value: 'FALSE',       type: 'BOOLEAN' },
      { id: 'c15', label: 'WiFi connected?',       value: 'TRUE',        type: 'BOOLEAN' }
    ];

    const playerName = () => STATE.playerName || 'student';

    function intro() {
      showRoomIntro({
        name: 'LUNCH AUNTIE',
        portrait: 'assets/portraits/auntie.png',
        text: `${playerName()}! The supply boat's cargo got jumbled when PINEAPPLE crashed the system. Sort the items into the right data type containers. Whole numbers, decimals, text, true-or-false — each goes in its own crate. Hidden in the cargo: a USB stick I left for you. Drag carefully, or you lose points. กิน, drag, win!`,
        onStart: build
      });
    }

    function build() {
      const host = $('#puzzleHost');
      host.innerHTML = `
        <div class="pier-puzzle">
          <div class="pier-instructions">
            Drag each cargo item into its matching <strong>data type</strong> container.
          </div>

          <div class="pier-conveyor">
            <div class="pier-conveyor-label">CARGO CONVEYOR</div>
            <div class="pier-conveyor-stage" id="pierConveyor"></div>
          </div>

          <div class="pier-progress" id="pierProgress"></div>

          <div class="pier-bins" id="pierBins"></div>
        </div>
      `;

      const conveyor = $('#pierConveyor');
      const binsEl = $('#pierBins');
      const progressEl = $('#pierProgress');

      // Build progress dots
      for (let i = 0; i < CARGO.length; i++) {
        const dot = document.createElement('div');
        dot.className = 'pier-progress-dot';
        progressEl.appendChild(dot);
      }

      // Build bins
      Object.entries(TYPES).forEach(([typeKey, t]) => {
        const bin = document.createElement('div');
        bin.className = 'cargo-bin';
        bin.dataset.type = typeKey;
        bin.innerHTML = `
          <div class="cargo-bin-header">
            <div class="cargo-bin-name">${t.label}</div>
            <div class="cargo-bin-hint">${t.hint}</div>
          </div>
          <div class="cargo-bin-tray" data-type="${typeKey}"></div>
        `;
        binsEl.appendChild(bin);
      });

      // Shuffle cargo and queue
      const queue = CARGO.slice().sort(() => Math.random() - 0.5);
      let queueIdx = 0;
      let solved = 0;
      let wrongAttempts = 0;

      function spawnNext() {
        if (queueIdx >= queue.length) return;
        const item = queue[queueIdx++];
        const el = document.createElement('div');
        el.className = 'cargo-item';
        el.innerHTML = `
          <span class="cargo-item-label">${item.label}</span>
          <span class="cargo-item-value">${item.value}</span>
        `;
        el.dataset.type = item.type;
        el.dataset.id = item.id;
        conveyor.appendChild(el);
        wireDrag(el);
      }

      // Drag system — works for both mouse and touch
      function wireDrag(el) {
        let dragging = false;
        let startX = 0, startY = 0;
        let origLeft = 0, origTop = 0;
        let origParent = el.parentNode;

        function getPoint(e) {
          if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
          return { x: e.clientX, y: e.clientY };
        }

        function pickUp(e) {
          if (el.classList.contains('locked') || el.dataset.lockPending === '1') return;
          e.preventDefault();
          const p = getPoint(e);
          const r = el.getBoundingClientRect();
          // Lift from current position into fixed-position drag mode
          origParent = el.parentNode;
          origLeft = r.left;
          origTop = r.top;
          startX = p.x;
          startY = p.y;
          el.style.position = 'fixed';
          el.style.left = origLeft + 'px';
          el.style.top = origTop + 'px';
          el.style.margin = '0';
          el.classList.add('dragging');
          // Move to body so it can fly anywhere
          document.body.appendChild(el);
          dragging = true;
          SFX.click();

          document.addEventListener('mousemove', move);
          document.addEventListener('mouseup', drop);
          document.addEventListener('touchmove', move, { passive: false });
          document.addEventListener('touchend', drop);
        }

        function move(e) {
          if (!dragging) return;
          e.preventDefault();
          const p = getPoint(e);
          const dx = p.x - startX;
          const dy = p.y - startY;
          el.style.left = (origLeft + dx) + 'px';
          el.style.top = (origTop + dy) + 'px';

          // Highlight bin under cursor
          $$('.cargo-bin').forEach(b => b.classList.remove('drag-over'));
          const target = elementUnderPoint(p.x, p.y);
          if (target) target.classList.add('drag-over');
        }

        function drop(e) {
          if (!dragging) return;
          dragging = false;
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', drop);
          document.removeEventListener('touchmove', move);
          document.removeEventListener('touchend', drop);

          const p = e.changedTouches && e.changedTouches[0]
            ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
            : { x: e.clientX, y: e.clientY };

          $$('.cargo-bin').forEach(b => b.classList.remove('drag-over'));
          const bin = elementUnderPoint(p.x, p.y);
          el.classList.remove('dragging');

          if (bin && bin.dataset.type === el.dataset.type) {
            // Correct
            el.dataset.lockPending = '1';
            const tray = bin.querySelector('.cargo-bin-tray');
            // Animate into tray
            const trayRect = tray.getBoundingClientRect();
            el.classList.add('flying-home');
            el.style.left = (trayRect.left + trayRect.width / 2 - el.offsetWidth / 2) + 'px';
            el.style.top  = (trayRect.top + trayRect.height - el.offsetHeight - 8) + 'px';
            bin.classList.remove('drop-correct');
            void bin.offsetWidth;
            bin.classList.add('drop-correct');

            setTimeout(() => {
              // Clear inline positioning, append to tray
              el.classList.remove('flying-home');
              el.style.position = '';
              el.style.left = '';
              el.style.top = '';
              el.style.margin = '';
              el.classList.add('locked');
              tray.appendChild(el);

              // Update progress
              progressEl.children[solved].classList.add('done');
              solved++;
              SFX.pickup();

              // Lamarr cameo after 3 correct, only first time
              if (solved === 3 && !ROOM_RUNTIME.lamarrShown) {
                ROOM_RUNTIME.lamarrShown = true;
                setTimeout(() => {
                  showCameo(CAMEOS.lamarr, () => {
                    if (queueIdx < queue.length) spawnNext();
                  });
                }, 400);
              } else {
                if (queueIdx < queue.length) spawnNext();
              }

              // Done?
              if (solved === CARGO.length) {
                setTimeout(complete, 600);
              }
            }, 400);
          } else {
            // Wrong (or dropped on nothing)
            if (bin && bin.dataset.type) {
              bin.classList.remove('drop-wrong');
              void bin.offsetWidth;
              bin.classList.add('drop-wrong');
              // Only count as wrong attempt if dropped on a bin
              wrongAttempts++;
              adjustRoomScore(-10);
              SFX.fail();
            }
            // Bounce home — back to conveyor
            el.classList.add('bouncing');
            // Animate back to its origin
            el.style.transition = 'left 0.4s ease, top 0.4s ease';
            el.style.left = origLeft + 'px';
            el.style.top = origTop + 'px';
            setTimeout(() => {
              el.classList.remove('bouncing');
              el.style.transition = '';
              el.style.position = '';
              el.style.left = '';
              el.style.top = '';
              el.style.margin = '';
              origParent.appendChild(el);
            }, 420);
          }
        }

        // Find the cargo-bin element under a point
        function elementUnderPoint(x, y) {
          // Hide the dragged element so elementFromPoint doesn't return it
          const prevDisplay = el.style.display;
          el.style.display = 'none';
          const target = document.elementFromPoint(x, y);
          el.style.display = prevDisplay;
          if (!target) return null;
          return target.closest('.cargo-bin');
        }

        el.addEventListener('mousedown', pickUp);
        el.addEventListener('touchstart', pickUp, { passive: false });
      }

      // Spawn first 3 items immediately so the conveyor doesn't look empty
      const initialBatch = Math.min(3, queue.length);
      for (let i = 0; i < initialBatch; i++) spawnNext();

      function complete() {
        // Auntie's post-puzzle line — the FIRST seed in her PhD-reveal running gag.
        // "First university lectures" is intentionally ambiguous — student or lecturer?
        // Reuses the Auntie intro overlay (gold styling, square portrait) for tonal match.
        showRoomIntro({
          name: 'LUNCH AUNTIE',
          portrait: 'assets/portraits/auntie.png',
          text: `Beautifully done, ${playerName()}. Data types — the foundation of all programming. Reminds me of my first university lectures, back in the day. Right — USB stick AND a strange purple shard. Take both. Onwards.`,
          buttonText: 'Collect rewards ▶',
          onStart: () => {
            showRoomComplete({
              score: ROOM_RUNTIME.currentScore,
              rewards: [
                { id: 'usb',    label: 'USB Stick' },
                { id: 'shard1', label: 'Fragment 1/3' }
              ],
              career: CAREERS.data_engineer
            }, () => {
              awardRoomCompletion('pier', ['usb', 'shard1'], 'data_engineer');
              goToMap();
            });
          }
        });
      }
    }

    return { intro };
  })();

  // ============================================================
  // LIBRARY PUZZLE — Binary Decoder (teaches Binary & ASCII)
  // ============================================================
  // Player decodes a 3-letter message by flipping 8 bits to match a target
  // ASCII value. Each byte locks when the binary equals the target. Lovelace
  // cameo fires after the first byte is solved. Decoded message is "USB" —
  // a thematic callback to the pier reward.
  PUZZLES.library = (() => {
    // The three letters to decode, in order. Difficulty roughly descending:
    // U (85 = 64+16+4+1, 4 bits) → S (83 = 64+16+2+1, 4 bits) → B (66 = 64+2, 2 bits).
    const SECRET = [
      { char: 'U', ascii: 85 },
      { char: 'S', ascii: 83 },
      { char: 'B', ascii: 66 }
    ];

    const BIT_VALUES = [128, 64, 32, 16, 8, 4, 2, 1];

    const playerName = () => STATE.playerName || 'student';

    function intro() {
      // Lovelace as in-world librarian (uses room-intro overlay, not cameo card)
      showRoomIntro({
        name: 'MS. LOVELACE',
        portrait: 'assets/portraits/lovelace.png',
        text: `${playerName()}. There's a glowing book in the graphic novels section — PINEAPPLE has scrambled my catalogue, but this message survived. Three letters, encoded in binary. Set the bits to match each letter's ASCII value, and the message will reveal itself. I trust you remember your place values.`,
        buttonText: 'Open the book ▶',
        onStart: build
      });
    }

    function build() {
      const host = $('#puzzleHost');
      host.innerHTML = `
        <div class="library-puzzle">
          <div class="library-instructions">
            Set the <strong>8 bits</strong> for each letter so the decimal value matches the target. Click a bit to toggle it on or off.
          </div>

          <div class="library-message" id="libraryMessage"></div>

          <div class="library-decoder">
            <div class="library-target" id="libraryTarget">
              <div class="library-target-eyebrow">DECODING LETTER <span id="libraryByteIdx">1</span> OF 3</div>
              <div class="library-target-row">
                <div class="library-target-char" id="libraryTargetChar">?</div>
                <div class="library-target-arrow">→ ASCII</div>
                <div class="library-target-num" id="libraryTargetNum">?</div>
              </div>
            </div>

            <div class="library-bits" id="libraryBits"></div>

            <div class="library-result">
              <div class="library-result-row">
                <span class="library-result-label">Binary:</span>
                <span class="library-result-value library-result-binary" id="libraryBinary">00000000</span>
              </div>
              <div class="library-result-row">
                <span class="library-result-label">Decimal:</span>
                <span class="library-result-value library-result-decimal" id="libraryDecimal">0</span>
              </div>
            </div>

            <div class="library-actions">
              <button class="btn btn-ghost btn-small" id="libraryHintBtn">💡 Hint (-10)</button>
              <button class="btn btn-ghost btn-small" id="libraryClearBtn">Clear bits</button>
            </div>
          </div>
        </div>
      `;

      const messageEl = $('#libraryMessage');
      const bitsEl = $('#libraryBits');
      const binaryEl = $('#libraryBinary');
      const decimalEl = $('#libraryDecimal');
      const targetCharEl = $('#libraryTargetChar');
      const targetNumEl = $('#libraryTargetNum');
      const byteIdxEl = $('#libraryByteIdx');
      const hintBtn = $('#libraryHintBtn');
      const clearBtn = $('#libraryClearBtn');

      // State
      let currentIdx = 0;
      let bits = [0, 0, 0, 0, 0, 0, 0, 0];
      let lockedLetters = [];
      let lovelaceShown = false;

      // Build the message slots (one box per letter)
      function renderMessage() {
        messageEl.innerHTML = '';
        for (let i = 0; i < SECRET.length; i++) {
          const slot = document.createElement('div');
          slot.className = 'library-letter-slot';
          if (i < lockedLetters.length) {
            slot.classList.add('solved');
            slot.textContent = lockedLetters[i];
          } else if (i === currentIdx) {
            slot.classList.add('active');
            slot.textContent = '?';
          } else {
            slot.textContent = '·';
          }
          messageEl.appendChild(slot);
        }
      }

      // Build the 8 bit toggles
      function renderBits() {
        bitsEl.innerHTML = '';
        BIT_VALUES.forEach((val, i) => {
          const bit = document.createElement('button');
          bit.className = 'library-bit';
          if (bits[i] === 1) bit.classList.add('on');
          bit.innerHTML = `
            <div class="library-bit-place">${val}</div>
            <div class="library-bit-state">${bits[i]}</div>
          `;
          bit.addEventListener('click', () => toggleBit(i));
          bitsEl.appendChild(bit);
        });
      }

      // Refresh decimal/binary readout
      function updateReadout() {
        const binary = bits.join('');
        const decimal = bits.reduce((sum, b, i) => sum + b * BIT_VALUES[i], 0);
        binaryEl.textContent = binary;
        decimalEl.textContent = decimal;

        // Visual feedback: glow if matches target
        const target = SECRET[currentIdx];
        if (target && decimal === target.ascii) {
          decimalEl.classList.add('matched');
          binaryEl.classList.add('matched');
          // Lock after a short celebratory pause
          setTimeout(() => lockCurrent(), 400);
        } else {
          decimalEl.classList.remove('matched');
          binaryEl.classList.remove('matched');
        }
      }

      function toggleBit(i) {
        if (currentIdx >= SECRET.length) return;  // puzzle done
        SFX.click();
        bits[i] = bits[i] ? 0 : 1;
        renderBits();
        updateReadout();
      }

      function lockCurrent() {
        if (currentIdx >= SECRET.length) return;
        const target = SECRET[currentIdx];
        // Already locked? (defensive — updateReadout calls lockCurrent on match)
        if (lockedLetters.length > currentIdx) return;

        lockedLetters.push(target.char);
        SFX.success();

        // Flash the byte slot
        renderMessage();

        currentIdx++;
        bits = [0, 0, 0, 0, 0, 0, 0, 0];

        // Done?
        if (currentIdx >= SECRET.length) {
          // Hide the decoder, show big celebration
          $('#libraryTarget').style.opacity = '0.4';
          bitsEl.style.pointerEvents = 'none';
          setTimeout(complete, 1200);
          return;
        }

        // Lovelace cameo after first letter, only first time
        if (currentIdx === 1 && !lovelaceShown) {
          lovelaceShown = true;
          setTimeout(() => {
            showCameo(CAMEOS.lovelace, () => {
              advanceToNext();
            });
          }, 600);
        } else {
          setTimeout(advanceToNext, 600);
        }
      }

      function advanceToNext() {
        const target = SECRET[currentIdx];
        if (!target) return;
        targetCharEl.textContent = target.char;
        targetNumEl.textContent = target.ascii;
        byteIdxEl.textContent = (currentIdx + 1);
        renderBits();
        renderMessage();
        updateReadout();
      }

      // Hint: flash the bits that should be ON
      function showHint() {
        if (currentIdx >= SECRET.length) return;
        const target = SECRET[currentIdx];
        adjustRoomScore(-10);
        SFX.fail();
        // Compute which bits should be on
        let v = target.ascii;
        const targetBits = [0, 0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < BIT_VALUES.length; i++) {
          if (v >= BIT_VALUES[i]) {
            targetBits[i] = 1;
            v -= BIT_VALUES[i];
          }
        }
        // Flash each correct bit briefly
        Array.from(bitsEl.children).forEach((bitEl, i) => {
          if (targetBits[i] === 1) {
            bitEl.classList.add('hinted');
            setTimeout(() => bitEl.classList.remove('hinted'), 1500);
          }
        });
      }

      function clearBits() {
        if (currentIdx >= SECRET.length) return;
        SFX.click();
        bits = [0, 0, 0, 0, 0, 0, 0, 0];
        renderBits();
        updateReadout();
      }

      hintBtn.addEventListener('click', showHint);
      clearBtn.addEventListener('click', clearBits);

      // Initial render
      const first = SECRET[0];
      targetCharEl.textContent = first.char;
      targetNumEl.textContent = first.ascii;
      renderBits();
      renderMessage();
      updateReadout();

      function complete() {
        const decoded = lockedLetters.join('');
        // Auntie post-puzzle: PhD-reveal seed #2 — escalates from "studying" to "working on encryption"
        showRoomIntro({
          name: 'LUNCH AUNTIE',
          portrait: 'assets/portraits/auntie.png',
          text: `"${decoded}". So that's where the spare encryption key was. I'd tucked it away years ago, when I was doing some... reading, on cryptography. Take the note — you'll need it for the server room. Onwards.`,
          buttonText: 'Collect rewards ▶',
          onStart: () => {
            showRoomComplete({
              score: ROOM_RUNTIME.currentScore,
              rewards: [
                { id: 'note', label: 'Decoded Note' }
              ],
              career: CAREERS.cryptographer
            }, () => {
              awardRoomCompletion('library', ['note'], 'cryptographer');
              goToMap();
            });
          }
        });
      }
    }

    return { intro };
  })();

  // ============================================================
  // CANTEEN PUZZLE — Flappy Mango (reflex, teaches perseverance)
  // ============================================================
  // Pacing break room. The player is a mango sticky rice ball flapping
  // through the canteen, dodging PINEAPPLE drone obstacles. Pass 5 drones
  // to win. No cameo (this is the action room). Reward: Pineapple Repellent
  // Spray (used in optional Rooftop puzzle).
  PUZZLES.canteen = (() => {
    const PLAYFIELD_W = 800;   // logical pixel width — scales with CSS
    const PLAYFIELD_H = 420;
    const BALL_SIZE = 44;
    const BALL_X = 110;        // ball stays at fixed x; world scrolls past
    const GRAVITY = 1100;      // px/s^2
    const FLAP_VELOCITY = -380; // px/s (negative = upward)
    const DRONE_SIZE = 56;
    const DRONE_SPEED = 240;   // px/s
    const DRONE_GAP_MIN = 600; // min ms between drones
    const DRONE_GAP_MAX = 1100;
    const PASSES_TO_WIN = 20;
    const HIT_PENALTY = 15;

    const playerName = () => STATE.playerName || 'student';

    function intro() {
      showRoomIntro({
        name: 'LUNCH AUNTIE',
        portrait: 'assets/portraits/auntie.png',
        text: `${playerName()}, look at the news ticker — PINEAPPLE has rerouted my drone delivery system through the canteen! I've launched a mango sticky rice ball as a decoy. Tap or click to make it flap. Get past 5 drones and the spray cabinet unlocks. The repellent will buy you time on the rooftop later.`,
        buttonText: 'Flap! ▶',
        onStart: build
      });
    }

    function build() {
      const host = $('#puzzleHost');
      host.innerHTML = `
        <div class="canteen-puzzle">
          <div class="canteen-instructions">
            <strong>Tap, click, or press Space</strong> to flap. Dodge the PINEAPPLE drones. Pass <strong>${PASSES_TO_WIN}</strong> drones to win.
          </div>

          <div class="canteen-stats">
            <div class="canteen-stat">
              <span class="canteen-stat-label">Passed</span>
              <span class="canteen-stat-value" id="canteenPassed">0 / ${PASSES_TO_WIN}</span>
            </div>
            <div class="canteen-stat">
              <span class="canteen-stat-label">Hits</span>
              <span class="canteen-stat-value" id="canteenHits">0</span>
            </div>
          </div>

          <div class="canteen-playfield" id="canteenPlayfield" tabindex="0">
            <div class="canteen-playfield-inner" id="canteenPlayfieldInner">
              <div class="canteen-ball" id="canteenBall"></div>
              <div class="canteen-floor"></div>
              <div class="canteen-ceiling"></div>
            </div>
            <div class="canteen-prompt" id="canteenPrompt">
              <div class="canteen-prompt-big">TAP TO START</div>
              <div class="canteen-prompt-small">Tap, click, or press Space to flap</div>
            </div>
          </div>
        </div>
      `;

      const playfield = $('#canteenPlayfield');
      const inner = $('#canteenPlayfieldInner');
      const ball = $('#canteenBall');
      const passedEl = $('#canteenPassed');
      const hitsEl = $('#canteenHits');
      const prompt = $('#canteenPrompt');

      // Scale the inner logical canvas to match the rendered playfield size
      function rescale() {
        const rect = playfield.getBoundingClientRect();
        const scale = rect.width / PLAYFIELD_W;
        inner.style.transform = `scale(${scale})`;
      }
      rescale();
      const resizeObs = new ResizeObserver(rescale);
      resizeObs.observe(playfield);

      // Game state
      let started = false;
      let running = false;
      let ended = false;
      let ballY = PLAYFIELD_H / 2 - BALL_SIZE / 2;
      let ballV = 0;
      let drones = [];      // { el, x, y, passed }
      let lastTimestamp = 0;
      let nextSpawnTimer = 800;
      let passes = 0;
      let hits = 0;
      let invuln = 0;       // ms — short invulnerability after a hit
      let rafId = null;

      function setBallTransform() {
        ball.style.transform = `translate3d(${BALL_X}px, ${ballY}px, 0)`;
      }
      setBallTransform();

      function spawnDrone() {
        // Pick a Y that won't be at extreme top/bottom
        const margin = 40;
        const y = margin + Math.random() * (PLAYFIELD_H - DRONE_SIZE - margin * 2);
        const el = document.createElement('div');
        el.className = 'canteen-drone';
        el.style.transform = `translate3d(${PLAYFIELD_W}px, ${y}px, 0)`;
        inner.appendChild(el);
        drones.push({ el, x: PLAYFIELD_W, y, passed: false });
      }

      function flap() {
        if (ended) return;
        if (!started) {
          started = true;
          running = true;
          prompt.classList.add('hidden');
          lastTimestamp = performance.now();
          rafId = requestAnimationFrame(tick);
        }
        if (running) {
          ballV = FLAP_VELOCITY;
          SFX.click();
          // Tilt the ball up briefly
          ball.classList.remove('flap');
          void ball.offsetWidth;
          ball.classList.add('flap');
        }
      }

      function tick(ts) {
        if (!running) return;
        const dt = Math.min((ts - lastTimestamp) / 1000, 0.04); // clamp to 40ms
        lastTimestamp = ts;

        // Physics
        ballV += GRAVITY * dt;
        ballY += ballV * dt;

        // Floor / ceiling collision
        const floorY = PLAYFIELD_H - BALL_SIZE - 12; // 12 = floor strip height
        const ceilingY = 12;
        if (ballY > floorY) {
          ballY = floorY;
          ballV = 0;
          if (invuln <= 0) {
            registerHit();
            // Bounce up gently to recover
            ballV = -250;
          }
        }
        if (ballY < ceilingY) {
          ballY = ceilingY;
          ballV = 0;
        }
        if (invuln > 0) invuln -= dt * 1000;

        setBallTransform();

        // Drone spawning
        nextSpawnTimer -= dt * 1000;
        if (nextSpawnTimer <= 0) {
          spawnDrone();
          nextSpawnTimer = DRONE_GAP_MIN + Math.random() * (DRONE_GAP_MAX - DRONE_GAP_MIN);
        }

        // Move drones, detect pass + collision
        for (let i = drones.length - 1; i >= 0; i--) {
          const d = drones[i];
          d.x -= DRONE_SPEED * dt;
          d.el.style.transform = `translate3d(${d.x}px, ${d.y}px, 0)`;

          // Pass detection: when drone right edge crosses ball left edge
          if (!d.passed && d.x + DRONE_SIZE < BALL_X) {
            d.passed = true;
            passes++;
            passedEl.textContent = `${passes} / ${PASSES_TO_WIN}`;
            SFX.pickup();
            if (passes >= PASSES_TO_WIN) {
              endGame(true);
              return;
            }
          }

          // Collision: AABB
          if (invuln <= 0 && aabbHit(BALL_X, ballY, BALL_SIZE, BALL_SIZE, d.x, d.y, DRONE_SIZE, DRONE_SIZE)) {
            registerHit();
            // Knock the drone away to avoid re-collision
            d.x = -100;
            d.el.classList.add('drone-hit');
          }

          // Cull off-screen
          if (d.x < -DRONE_SIZE - 20) {
            d.el.remove();
            drones.splice(i, 1);
          }
        }

        rafId = requestAnimationFrame(tick);
      }

      function aabbHit(x1, y1, w1, h1, x2, y2, w2, h2) {
        // Slightly inset hitboxes for fairness — visual sprites have splatter / glow
        const PAD = 6;
        return !(
          x1 + w1 - PAD < x2 + PAD ||
          x2 + w2 - PAD < x1 + PAD ||
          y1 + h1 - PAD < y2 + PAD ||
          y2 + h2 - PAD < y1 + PAD
        );
      }

      function registerHit() {
        hits++;
        hitsEl.textContent = hits;
        adjustRoomScore(-HIT_PENALTY);
        SFX.fail();
        invuln = 1000;
        ball.classList.add('ball-hit');
        playfield.classList.add('shake');
        setTimeout(() => {
          ball.classList.remove('ball-hit');
          playfield.classList.remove('shake');
        }, 600);
      }

      function endGame(won) {
        if (ended) return;
        ended = true;
        running = false;
        if (rafId) cancelAnimationFrame(rafId);

        if (won) {
          setTimeout(complete, 600);
        } else {
          // Soft fail not currently triggered — game only ends on win.
          // Kept for future expansion (e.g. life cap).
          setTimeout(complete, 600);
        }
      }

      function complete() {
        // Auntie post-puzzle: PhD-seed #3 — drops a real PhD-y term
        showRoomIntro({
          name: 'LUNCH AUNTIE',
          portrait: 'assets/portraits/auntie.png',
          text: `Beautifully flapped, ${playerName()}. Spray cabinet's open — take the can; you'll need it on the rooftop. Reminds me of when I was peer-reviewing papers, watching first-year PhDs scramble for results. The reflexes never leave you. Right — onwards.`,
          buttonText: 'Collect rewards ▶',
          onStart: () => {
            showRoomComplete({
              score: ROOM_RUNTIME.currentScore,
              rewards: [
                { id: 'spray', label: 'Pineapple Repellent' }
              ],
              career: CAREERS.game_developer
            }, () => {
              awardRoomCompletion('canteen', ['spray'], 'game_developer');
              goToMap();
            });
          }
        });
      }

      // Input wiring
      function onPointerDown(e) {
        if (e.cancelable) e.preventDefault();
        flap();
      }
      function onKeyDown(e) {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
          e.preventDefault();
          flap();
        }
      }
      playfield.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('keydown', onKeyDown);
      playfield.focus();

      // Cleanup hook — called by goToMap if user quits
      ROOM_RUNTIME.cleanup = () => {
        running = false;
        ended = true;
        if (rafId) cancelAnimationFrame(rafId);
        playfield.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('keydown', onKeyDown);
        if (resizeObs) resizeObs.disconnect();
      };
    }

    return { intro };
  })();

  // ============================================================
  // THEATRE PUZZLE — Light the Stage (Simon Says, teaches arrays)
  // ============================================================
  // Player watches a sequence of stage spotlights flash in order, then
  // reproduces the sequence. Five rounds, each adding one cue to the array.
  // Hopper cameo fires after round 3. Reward: Fragment 2/3 + Show
  // Programmer career.
  PUZZLES.theatre = (() => {
    // Sequence length per round
    // 8 cumulative rounds. Round 1 has 1 cue, round 8 has 8 cues
    // (the same 7 from round 7 + one new cue appended).
    const TOTAL_ROUNDS = 8;
    // Five spotlights — colours match house palette (excluding navy Malala)
    const SPOTS = [
      { id: 'green',  colour: '#1FA85A', freq: 392 },  // G4
      { id: 'purple', colour: '#9D4EDD', freq: 466 },  // A#4
      { id: 'orange', colour: '#F08020', freq: 523 },  // C5
      { id: 'red',    colour: '#E0344C', freq: 587 },  // D5
      { id: 'cyan',   colour: '#3CC0E8', freq: 698 }   // F5
    ];

    const PLAYBACK_SPEED = 650; // ms per cue when sequence plays
    const WRONG_PENALTY = 10;

    const playerName = () => STATE.playerName || 'student';

    function intro() {
      showRoomIntro({
        name: 'LUNCH AUNTIE',
        portrait: 'assets/portraits/auntie.png',
        text: `${playerName()}, the school musical opens tonight and PINEAPPLE has scrambled the lighting cues. The stage manager left a backup script — but you need to read the cues from the rig, in order, and fire them back from the lighting board. Five rounds, one extra cue each round. Watch carefully — these sequences are arrays, and arrays remember order.`,
        buttonText: 'Take the lighting board ▶',
        onStart: build
      });
    }

    function build() {
      const host = $('#puzzleHost');
      host.innerHTML = `
        <div class="theatre-puzzle">
          <div class="theatre-instructions">
            Watch the <strong>spotlight sequence</strong>, then tap them back in the same order.
          </div>

          <div class="theatre-status" id="theatreStatus">
            <div class="theatre-status-row">
              <div class="theatre-status-block">
                <span class="theatre-status-label">Round</span>
                <span class="theatre-status-value" id="theatreRound">1 / ${TOTAL_ROUNDS}</span>
              </div>
              <div class="theatre-status-block">
                <span class="theatre-status-label">Cues</span>
                <span class="theatre-status-value" id="theatreCues">0 / 1</span>
              </div>
            </div>
            <div class="theatre-status-message" id="theatreMessage">Watch the rig...</div>
          </div>

          <div class="theatre-stage" id="theatreStage">
            ${SPOTS.map(s => `
              <button class="theatre-spot" data-spot="${s.id}" style="--spot: ${s.colour};">
                <div class="theatre-spot-beam"></div>
                <div class="theatre-spot-base"></div>
              </button>
            `).join('')}
          </div>

          <div class="theatre-actions">
            <button class="btn btn-ghost btn-small" id="theatreReplayBtn" disabled>↻ Replay sequence (-5)</button>
          </div>
        </div>
      `;

      const stage = $('#theatreStage');
      const roundEl = $('#theatreRound');
      const cuesEl = $('#theatreCues');
      const messageEl = $('#theatreMessage');
      const replayBtn = $('#theatreReplayBtn');

      // State
      let roundIdx = 0;
      let sequence = [];      // array of spot ids
      let inputIdx = 0;
      let acceptingInput = false;
      let hopperShown = false;
      let pendingTimers = [];

      function clearTimers() {
        pendingTimers.forEach(t => clearTimeout(t));
        pendingTimers = [];
      }

      function setMessage(text, mood = 'neutral') {
        messageEl.textContent = text;
        messageEl.className = 'theatre-status-message theatre-mood-' + mood;
      }

      function flashSpot(spotId, duration = 400) {
        const el = stage.querySelector(`[data-spot="${spotId}"]`);
        if (!el) return;
        const spotData = SPOTS.find(s => s.id === spotId);
        SFX.note(spotData.freq, duration / 1000 + 0.05, 'triangle', 0.14);
        el.classList.add('lit');
        const t = setTimeout(() => el.classList.remove('lit'), duration);
        pendingTimers.push(t);
      }

      function generateRoundSequence() {
        // Cumulative: round N's sequence is round N-1's sequence + one new cue.
        // This is the canonical Simon Says mechanic — and a stronger metaphor
        // for "arrays remember order" (we APPEND, we don't regenerate).
        if (roundIdx === 0) {
          sequence = [];
        }
        sequence.push(SPOTS[Math.floor(Math.random() * SPOTS.length)].id);
        // Reset input
        inputIdx = 0;
      }

      function playSequence() {
        acceptingInput = false;
        replayBtn.disabled = true;
        setMessage('Watch the rig...', 'watching');
        cuesEl.textContent = `0 / ${sequence.length}`;
        clearTimers();

        sequence.forEach((spotId, i) => {
          const t = setTimeout(() => {
            flashSpot(spotId, PLAYBACK_SPEED * 0.55);
            // After last cue, switch to input
            if (i === sequence.length - 1) {
              const t2 = setTimeout(() => {
                acceptingInput = true;
                replayBtn.disabled = false;
                setMessage('Your turn — tap the spotlights in order', 'go');
              }, PLAYBACK_SPEED * 0.7);
              pendingTimers.push(t2);
            }
          }, i * PLAYBACK_SPEED);
          pendingTimers.push(t);
        });
      }

      function startRound() {
        generateRoundSequence();
        roundEl.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
        // Slight pause before sequence starts
        const t = setTimeout(playSequence, 500);
        pendingTimers.push(t);
      }

      function handleSpotClick(spotId) {
        if (!acceptingInput) return;
        flashSpot(spotId, 200);

        const expected = sequence[inputIdx];
        if (spotId === expected) {
          // Correct
          inputIdx++;
          cuesEl.textContent = `${inputIdx} / ${sequence.length}`;

          if (inputIdx === sequence.length) {
            // Round complete!
            acceptingInput = false;
            SFX.success();
            setMessage('Round clear ✓', 'success');

            // Hopper cameo after round 4 (mid-journey of 8 rounds)
            if (roundIdx === 3 && !hopperShown) {
              hopperShown = true;
              const t = setTimeout(() => {
                showCameo(CAMEOS.hopper, () => advanceRound());
              }, 800);
              pendingTimers.push(t);
            } else {
              const t = setTimeout(advanceRound, 1000);
              pendingTimers.push(t);
            }
          }
        } else {
          // Wrong
          acceptingInput = false;
          adjustRoomScore(-WRONG_PENALTY);
          SFX.fail();
          setMessage(`Wrong cue — that was the ${formatOrdinal(inputIdx + 1)} step. Replaying...`, 'fail');
          // Flash all spots red briefly
          stage.classList.add('theatre-shake');
          const t = setTimeout(() => {
            stage.classList.remove('theatre-shake');
            playSequence();  // replay same sequence at same length
          }, 1400);
          pendingTimers.push(t);
        }
      }

      function formatOrdinal(n) {
        const suffixes = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
      }

      function advanceRound() {
        roundIdx++;
        if (roundIdx >= TOTAL_ROUNDS) {
          complete();
          return;
        }
        startRound();
      }

      // Wire spotlight clicks
      stage.querySelectorAll('.theatre-spot').forEach(btn => {
        btn.addEventListener('click', () => handleSpotClick(btn.dataset.spot));
      });

      // Replay button (penalty)
      replayBtn.addEventListener('click', () => {
        if (!acceptingInput) return;
        adjustRoomScore(-5);
        SFX.click();
        inputIdx = 0;
        playSequence();
      });

      // Cleanup on quit
      ROOM_RUNTIME.cleanup = () => {
        clearTimers();
        acceptingInput = false;
      };

      // Kick off
      startRound();

      function complete() {
        // Auntie post-puzzle: PhD-seed #4 — postdoc reference
        showRoomIntro({
          name: 'LUNCH AUNTIE',
          portrait: 'assets/portraits/auntie.png',
          text: `Stunning. The musical's saved, ${playerName()}. Reminds me of a similar sequencing bug we wrestled with in the lab during my postdoc — different decade, same nonsense. Take the second containment fragment from the prop table. Onwards.`,
          buttonText: 'Collect rewards ▶',
          onStart: () => {
            showRoomComplete({
              score: ROOM_RUNTIME.currentScore,
              rewards: [
                { id: 'shard2', label: 'Fragment 2/3' }
              ],
              career: CAREERS.show_programmer
            }, () => {
              awardRoomCompletion('theatre', ['shard2'], 'show_programmer');
              goToMap();
            });
          }
        });
      }
    }

    return { intro };
  })();

  // ============================================================
  // SPORTS FIELD PUZZLE — Algorithm Coach (OPTIONAL room)
  // ============================================================
  // Drag-and-drop fill-in-the-blanks. Player completes a CIE pseudocode
  // algorithm by dropping the right tokens into 5 gaps. Combines IF/ELSE
  // and WHILE constructs in a sports-themed scenario (squad selection).
  // No fragment reward (optional room) — just career card + small inventory token.
  PUZZLES.field = (() => {
    const playerName = () => STATE.playerName || 'student';

    // Each gap has: id, accept (correct token text)
    // Tokens shown in palette include all GAPs' accept values + a few distractors.
    const GAPS = [
      { id: 'g1', accept: '11' },
      { id: 'g2', accept: 'THEN' },
      { id: 'g3', accept: 'ELSE' },
      { id: 'g4', accept: '←' },
      { id: 'g5', accept: 'ENDWHILE' }
    ];
    // Palette = correct tokens + distractors (3)
    const TOKENS = ['11', 'THEN', 'ELSE', '←', 'ENDWHILE', '7', 'IF', 'WHILE'];

    const WRONG_PENALTY = 0;  // OPTIONAL room — be forgiving, no penalty for wrong drops

    function intro() {
      showRoomIntro({
        name: 'LUNCH AUNTIE',
        portrait: 'assets/portraits/auntie.png',
        text: `${playerName()}, Coach K just stuck his head in the canteen — PINEAPPLE has chewed up the team selection algorithm and the quarter-finals start in 20 minutes. He left the broken pseudocode on the field. Drop the right tokens into the gaps to fix it. This one's optional, but the squad's depending on you.`,
        buttonText: 'Take the clipboard ▶',
        onStart: build
      });
    }

    function build() {
      const host = $('#puzzleHost');
      // Build the algorithm DOM with placeholder gap slots
      // Indentation conveyed via CSS, kept in HTML as nested padding
      host.innerHTML = `
        <div class="field-puzzle">
          <div class="field-instructions">
            Drop the right <strong>pseudocode tokens</strong> into the <strong>5 gaps</strong>.
            <span class="field-instructions-sub">Hint: this is a CIE 9618 pseudocode style — keywords in CAPS, <code>←</code> for assignment.</span>
          </div>

          <div class="field-algorithm" id="fieldAlgorithm">
            <div class="field-line"><span class="field-line-num">1</span><span class="field-code"><span class="kw">INPUT</span> <span class="var">NumberOfPlayers</span></span></div>
            <div class="field-line"><span class="field-line-num">2</span><span class="field-code"><span class="kw">WHILE</span> <span class="var">NumberOfPlayers</span> &lt; <span class="field-gap" data-gap="g1"></span> <span class="kw">DO</span></span></div>
            <div class="field-line indent-1"><span class="field-line-num">3</span><span class="field-code"><span class="kw">IF</span> <span class="var">NumberOfPlayers</span> &lt; <span class="num">7</span> <span class="field-gap" data-gap="g2"></span></span></div>
            <div class="field-line indent-2"><span class="field-line-num">4</span><span class="field-code"><span class="kw">OUTPUT</span> <span class="str">"Squad too small to start"</span></span></div>
            <div class="field-line indent-1"><span class="field-line-num">5</span><span class="field-code"><span class="field-gap" data-gap="g3"></span></span></div>
            <div class="field-line indent-2"><span class="field-line-num">6</span><span class="field-code"><span class="kw">OUTPUT</span> <span class="str">"Almost there"</span></span></div>
            <div class="field-line indent-1"><span class="field-line-num">7</span><span class="field-code"><span class="kw">ENDIF</span></span></div>
            <div class="field-line indent-1"><span class="field-line-num">8</span><span class="field-code"><span class="var">NumberOfPlayers</span> <span class="field-gap" data-gap="g4"></span> <span class="var">NumberOfPlayers</span> + <span class="num">1</span></span></div>
            <div class="field-line"><span class="field-line-num">9</span><span class="field-code"><span class="field-gap" data-gap="g5"></span></span></div>
            <div class="field-line"><span class="field-line-num">10</span><span class="field-code"><span class="kw">OUTPUT</span> <span class="str">"Squad ready — kick off!"</span></span></div>
          </div>

          <div class="field-palette-wrap">
            <div class="field-palette-label">TOKEN PALETTE</div>
            <div class="field-palette" id="fieldPalette"></div>
          </div>
        </div>
      `;

      const palette = $('#fieldPalette');
      const algorithm = $('#fieldAlgorithm');

      // Shuffled token list
      const shuffled = [...TOKENS].sort(() => Math.random() - 0.5);
      shuffled.forEach(text => {
        const t = document.createElement('button');
        t.className = 'field-token';
        t.textContent = text;
        t.dataset.text = text;
        palette.appendChild(t);
        wireTokenDrag(t);
      });

      let solved = 0;
      const TOTAL = GAPS.length;

      function wireTokenDrag(el) {
        let dragging = false;
        let startX = 0, startY = 0;
        let origLeft = 0, origTop = 0;

        function getPoint(e) {
          if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
          return { x: e.clientX, y: e.clientY };
        }

        function pickUp(e) {
          if (el.classList.contains('locked')) return;
          e.preventDefault();
          const p = getPoint(e);
          const r = el.getBoundingClientRect();
          origLeft = r.left;
          origTop = r.top;
          startX = p.x;
          startY = p.y;
          el.style.position = 'fixed';
          el.style.left = origLeft + 'px';
          el.style.top = origTop + 'px';
          el.style.margin = '0';
          el.classList.add('dragging');
          document.body.appendChild(el);
          dragging = true;
          SFX.click();

          document.addEventListener('mousemove', move);
          document.addEventListener('mouseup', drop);
          document.addEventListener('touchmove', move, { passive: false });
          document.addEventListener('touchend', drop);
        }

        function move(e) {
          if (!dragging) return;
          e.preventDefault();
          const p = getPoint(e);
          const dx = p.x - startX;
          const dy = p.y - startY;
          el.style.left = (origLeft + dx) + 'px';
          el.style.top = (origTop + dy) + 'px';

          // Highlight gap under cursor
          $$('.field-gap').forEach(g => g.classList.remove('drag-over'));
          const target = gapUnderPoint(el, p.x, p.y);
          if (target) target.classList.add('drag-over');
        }

        function drop(e) {
          if (!dragging) return;
          dragging = false;
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', drop);
          document.removeEventListener('touchmove', move);
          document.removeEventListener('touchend', drop);

          const p = e.changedTouches && e.changedTouches[0]
            ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
            : { x: e.clientX, y: e.clientY };

          $$('.field-gap').forEach(g => g.classList.remove('drag-over'));
          const gap = gapUnderPoint(el, p.x, p.y);
          el.classList.remove('dragging');

          // Check correctness: gap must be empty AND its accept value must match token text
          const gapData = gap ? GAPS.find(g => g.id === gap.dataset.gap) : null;
          const isCorrect = gap && !gap.classList.contains('filled') && gapData && gapData.accept === el.dataset.text;

          if (isCorrect) {
            // Lock the token into the gap
            el.style.position = '';
            el.style.left = '';
            el.style.top = '';
            el.style.margin = '';
            el.classList.add('locked');
            gap.classList.add('filled', 'correct');
            gap.appendChild(el);
            SFX.success();
            solved++;
            if (solved === TOTAL) {
              setTimeout(complete, 700);
            }
          } else {
            // Wrong gap or no gap — bounce back
            if (gap && !gap.classList.contains('filled')) {
              gap.classList.add('wrong');
              setTimeout(() => gap.classList.remove('wrong'), 500);
              SFX.fail();
              if (WRONG_PENALTY > 0) adjustRoomScore(-WRONG_PENALTY);
            }
            // Animate back to palette
            el.classList.add('returning');
            el.style.left = origLeft + 'px';
            el.style.top = origTop + 'px';
            requestAnimationFrame(() => {
              el.style.transition = 'left 0.25s ease, top 0.25s ease';
              const paletteRect = palette.getBoundingClientRect();
              // Best-effort target: append back to palette, clear positioning
              setTimeout(() => {
                el.style.position = '';
                el.style.left = '';
                el.style.top = '';
                el.style.margin = '';
                el.style.transition = '';
                el.classList.remove('returning');
                palette.appendChild(el);
              }, 250);
            });
          }
        }

        el.addEventListener('mousedown', pickUp);
        el.addEventListener('touchstart', pickUp, { passive: false });
      }

      function gapUnderPoint(el, x, y) {
        // Temporarily hide the dragged token so elementFromPoint doesn't return it
        const prev = el.style.display;
        el.style.display = 'none';
        const hit = document.elementFromPoint(x, y);
        el.style.display = prev;
        if (!hit) return null;
        return hit.closest('.field-gap');
      }

      function complete() {
        // Auntie post-puzzle: side-skill flex, NOT main PhD-arc (so missable)
        showRoomIntro({
          name: 'LUNCH AUNTIE',
          portrait: 'assets/portraits/auntie.png',
          text: `Squad's set, ${playerName()}. Coach K owes you a smoothie. Reminds me of an optimisation problem we ran on a satellite scheduling system once — same shape, different numbers. Onwards.`,
          buttonText: 'Collect rewards ▶',
          onStart: () => {
            showRoomComplete({
              score: ROOM_RUNTIME.currentScore,
              rewards: [],  // Optional room — no fragment, just the career card
              career: CAREERS.sports_data_analyst
            }, () => {
              awardRoomCompletion('field', [], 'sports_data_analyst');
              goToMap();
            });
          }
        });
      }

      // No RAF in this puzzle — cleanup only needs to remove document listeners
      // (those auto-remove on drop, but be defensive)
      ROOM_RUNTIME.cleanup = () => {
        // No-op — drag handlers self-clean via drop()
      };
    }

    return { intro };
  })();

  // ============================================================
  // ROOFTOP PUZZLE — Antenna Alignment (OPTIONAL — weakens PINEAPPLE)
  // ============================================================
  // Three sliders (frequency, tilt, bearing). Player tunes each into a
  // tolerance window. Live "signal strength" readout updates in real time
  // (each slider contributes 0-33% based on distance to its target).
  // When all three lock = 100% signal = puzzle complete + PINEAPPLE
  // weakened flag set for the finale.
  PUZZLES.rooftop = (() => {
    const playerName = () => STATE.playerName || 'student';

    // Slider configs. Targets are randomised per playthrough so kids can't
    // memorise; tolerance widths are fixed.
    function generateSliders() {
      // Pick targets within sensible ranges so they're achievable
      const freqTarget = 320 + Math.floor(Math.random() * 360);  // 320-680
      const tiltTarget = 15 + Math.floor(Math.random() * 60);     // 15-75
      const bearTarget = 30 + Math.floor(Math.random() * 300);    // 30-330
      return [
        { id: 'freq', label: 'Frequency',   unit: 'MHz', min: 100, max: 900, step: 1,  target: freqTarget, tolerance: 18, start: 100 },
        { id: 'tilt', label: 'Tilt angle',  unit: '°',   min: 0,   max: 90,  step: 1,  target: tiltTarget, tolerance: 4,  start: 0 },
        { id: 'bear', label: 'Bearing',     unit: '°',   min: 0,   max: 360, step: 1,  target: bearTarget, tolerance: 8,  start: 0 }
      ];
    }

    function intro() {
      showRoomIntro({
        name: 'LUNCH AUNTIE',
        portrait: 'assets/portraits/auntie.png',
        text: `${playerName()}, the rooftop antenna farm can punch a hole in PINEAPPLE's network shell. Use that repellent spray on the dish first to clear the gunk, then dial in three parameters — frequency, tilt, bearing — until you get a strong signal lock. Optional, but if you pull this off the server room boss fight will be substantially easier.`,
        buttonText: 'Climb the ladder ▶',
        onStart: build
      });
    }

    function build() {
      const host = $('#puzzleHost');
      const sliders = generateSliders();

      host.innerHTML = `
        <div class="rooftop-puzzle">
          <div class="rooftop-instructions">
            Tune each parameter until <strong>all three lock green</strong>. Signal strength updates live as you dial.
          </div>

          <div class="rooftop-signal">
            <div class="rooftop-signal-label">SIGNAL STRENGTH</div>
            <div class="rooftop-signal-bar">
              <div class="rooftop-signal-fill" id="rooftopSignalFill"></div>
              <div class="rooftop-signal-target-mark"></div>
            </div>
            <div class="rooftop-signal-value">
              <span id="rooftopSignalPct">0</span><span class="rooftop-signal-pct">%</span>
            </div>
          </div>

          <div class="rooftop-controls" id="rooftopControls"></div>
        </div>
      `;

      const controls = $('#rooftopControls');
      const signalFill = $('#rooftopSignalFill');
      const signalPct = $('#rooftopSignalPct');

      // Build each slider row
      sliders.forEach(s => {
        const row = document.createElement('div');
        row.className = 'rooftop-row';
        row.dataset.slider = s.id;
        row.innerHTML = `
          <div class="rooftop-row-header">
            <span class="rooftop-row-label">${s.label}</span>
            <span class="rooftop-row-value" id="val-${s.id}">${s.start}<span class="rooftop-row-unit">${s.unit}</span></span>
          </div>
          <div class="rooftop-slider-wrap">
            <input type="range" class="rooftop-slider"
                   id="slider-${s.id}"
                   min="${s.min}" max="${s.max}" step="${s.step}" value="${s.start}">
            <div class="rooftop-target-band"
                 style="left: ${(((s.target - s.tolerance) - s.min) / (s.max - s.min)) * 100}%;
                        width: ${((s.tolerance * 2) / (s.max - s.min)) * 100}%;"></div>
            <div class="rooftop-target-tick"
                 style="left: ${((s.target - s.min) / (s.max - s.min)) * 100}%;"></div>
          </div>
          <div class="rooftop-status" id="status-${s.id}">Off-target</div>
        `;
        controls.appendChild(row);
      });

      let allLocked = false;
      let solved = false;

      function update() {
        // For each slider, compute its contribution to signal (0..1 within tolerance)
        let total = 0;
        let lockedCount = 0;
        sliders.forEach(s => {
          const slider = document.getElementById('slider-' + s.id);
          const valEl = document.getElementById('val-' + s.id);
          const statusEl = document.getElementById('status-' + s.id);
          const row = controls.querySelector(`[data-slider="${s.id}"]`);
          const v = +slider.value;
          valEl.firstChild.textContent = v;

          const dist = Math.abs(v - s.target);
          let contribution;
          let locked = false;
          if (dist <= s.tolerance) {
            // Within tolerance — full contribution, falls off slightly toward edges
            const normalised = 1 - (dist / s.tolerance) * 0.2;  // 100% at centre, 80% at edge
            contribution = normalised / sliders.length;
            locked = true;
            lockedCount++;
            statusEl.textContent = 'LOCKED';
            statusEl.className = 'rooftop-status locked';
            row.classList.add('locked');
          } else {
            // Outside tolerance — falls off with distance, max range = 30% of slider span
            const range = (s.max - s.min) * 0.3;
            const fade = Math.max(0, 1 - (dist - s.tolerance) / range);
            contribution = (fade * 0.5) / sliders.length;  // partial credit, capped at 50%
            statusEl.textContent = dist < s.tolerance * 4 ? 'Close...' : 'Off-target';
            statusEl.className = 'rooftop-status' + (dist < s.tolerance * 4 ? ' near' : '');
            row.classList.remove('locked');
          }
          total += contribution;
        });

        const pct = Math.round(total * 100);
        signalFill.style.width = pct + '%';
        signalPct.textContent = pct;

        // Colour the fill based on strength
        if (pct >= 95) {
          signalFill.classList.add('full');
          signalFill.classList.remove('partial');
        } else if (pct >= 50) {
          signalFill.classList.add('partial');
          signalFill.classList.remove('full');
        } else {
          signalFill.classList.remove('full', 'partial');
        }

        // All three locked → solve
        if (lockedCount === sliders.length && !solved) {
          solved = true;
          SFX.success();
          setTimeout(complete, 900);
        }
      }

      // Wire each slider
      sliders.forEach(s => {
        const slider = document.getElementById('slider-' + s.id);
        slider.addEventListener('input', () => {
          // Soft tick sound for tactile feedback (throttled by browser anyway)
          SFX.note(660 + (s.id === 'freq' ? 0 : s.id === 'tilt' ? 80 : 160), 0.02, 'square', 0.04);
          update();
        });
      });

      update();  // initial readout

      function complete() {
        // Set the special flag — read by the Server Room finale (stage 10)
        STATE.pineappleWeakened = true;

        showRoomIntro({
          name: 'LUNCH AUNTIE',
          portrait: 'assets/portraits/auntie.png',
          text: `Signal lock! ${playerName()}, you just kneecapped PINEAPPLE — its bandwidth is shot. The boss will be a damn sight easier now. Reminds me of an RF interference paper I helped review for the journal — different application, same maths. Onwards.`,
          buttonText: 'Collect rewards ▶',
          onStart: () => {
            showRoomComplete({
              score: ROOM_RUNTIME.currentScore,
              rewards: [],  // Optional — no fragment, but PINEAPPLE weakened flag set
              career: CAREERS.network_engineer
            }, () => {
              awardRoomCompletion('rooftop', [], 'network_engineer');
              goToMap();
            });
          }
        });
      }

      ROOM_RUNTIME.cleanup = () => {
        // Slider input handlers garbage-collect with the DOM nodes
      };
    }

    return { intro };
  })();

  // ============================================================
  // CS CLASSROOM PUZZLE — Debug Python (Fragment 3/3)
  // ============================================================
  // Three Python snippets, each with one logic bug. Player clicks the
  // buggy line, then picks the right fix from 3 options. No NPC for the
  // intro — uses the player's own portrait + name as inner monologue.
  // Auntie outro lands the most explicit PhD-arc seed before the finale.
  PUZZLES.classroom = (() => {
    const playerName = () => STATE.playerName || 'student';

    // Each snippet: lines[], buggyIdx (0-indexed), fixOptions[], correctFixIdx, hint
    const SNIPPETS = [
      {
        title: 'average.py — calculates the class average',
        lines: [
          'scores = [85, 72, 90, 68, 95]',
          'total = 0',
          'for i in range(1, 5):',
          '    total += scores[i]',
          'print(total / 5)'
        ],
        buggyIdx: 2,
        fixOptions: [
          'for i in range(5):',
          'for i in range(0, 4):',
          'for i in range(1, 6):'
        ],
        correctFixIdx: 0,
        explainBug: "range(1, 5) only gives indices 1,2,3,4 — missing index 0 (the first score).",
        explainFix: "range(5) gives 0,1,2,3,4 — all five scores."
      },
      {
        title: 'mean.py — generic average function',
        lines: [
          'def average(numbers):',
          '    for n in numbers:',
          '        total = 0',
          '        total += n',
          '    return total / len(numbers)'
        ],
        buggyIdx: 2,
        fixOptions: [
          'Move "total = 0" ABOVE the loop (line 2)',
          'Change "total = 0" to "total == 0"',
          'Delete "total = 0" entirely'
        ],
        correctFixIdx: 0,
        explainBug: "total = 0 is INSIDE the loop, so it resets to 0 every iteration. Only the last number ever survives.",
        explainFix: "Initialise total ONCE before the loop, then accumulate inside."
      },
      {
        title: 'pass_check.py — pass/fail decision',
        lines: [
          'def is_pass(mark):',
          '    if mark >= 50:',
          '        result = True',
          '    else:',
          '        result = False',
          '    print(result)'
        ],
        buggyIdx: 5,
        fixOptions: [
          '    return result',
          '    print(mark)',
          '    if result == True: print("Yes")'
        ],
        correctFixIdx: 0,
        explainBug: "print() shows the value but doesn't RETURN it. Anyone calling is_pass(80) gets None back.",
        explainFix: "return sends the value back to the caller, so they can use it."
      }
    ];

    function intro() {
      // INNER MONOLOGUE — uses player's own portrait and name. No NPC.
      const portrait = CHARACTERS[STATE.character].portrait;
      showRoomIntro({
        name: `${playerName().toUpperCase()} — INNER MONOLOGUE`,
        portrait: portrait,
        text: `Three Python files left open on the lab machine. None of them work right. Auntie said the third containment fragment is locked behind these. Find the bug. Pick the fix. Move on. (No teacher in here — just me, the code, and PINEAPPLE somewhere upstairs.)`,
        buttonText: 'Open the editor ▶',
        onStart: build
      });
    }

    function build() {
      const host = $('#puzzleHost');
      host.innerHTML = `
        <div class="classroom-puzzle">
          <div class="classroom-instructions">
            <strong>Step 1:</strong> click the line you think has the bug. <strong>Step 2:</strong> pick the right fix.
          </div>

          <div class="classroom-progress" id="classroomProgress">
            <div class="classroom-progress-dot active" data-idx="0">1</div>
            <div class="classroom-progress-dot" data-idx="1">2</div>
            <div class="classroom-progress-dot" data-idx="2">3</div>
          </div>

          <div class="classroom-snippet" id="classroomSnippet"></div>

          <div class="classroom-fix" id="classroomFix"></div>
        </div>
      `;

      const snippetEl = $('#classroomSnippet');
      const fixEl = $('#classroomFix');
      const progressEl = $('#classroomProgress');

      let snippetIdx = 0;
      let phase = 'pick-line';  // 'pick-line' → 'pick-fix' → next snippet
      let solvedSnippets = 0;

      function renderSnippet() {
        const s = SNIPPETS[snippetIdx];
        snippetEl.innerHTML = `
          <div class="classroom-snippet-title">
            <span class="classroom-snippet-icon">📄</span>
            <span class="classroom-snippet-name">${s.title}</span>
          </div>
          <div class="classroom-code" id="classroomCode"></div>
          <div class="classroom-prompt" id="classroomPrompt">Click the line with the bug.</div>
        `;
        const codeEl = $('#classroomCode');
        s.lines.forEach((line, i) => {
          const lineEl = document.createElement('div');
          lineEl.className = 'classroom-line';
          lineEl.dataset.idx = i;
          lineEl.innerHTML = `
            <span class="classroom-line-num">${i + 1}</span>
            <span class="classroom-line-code">${highlightPython(line)}</span>
          `;
          lineEl.addEventListener('click', () => onLineClick(i));
          codeEl.appendChild(lineEl);
        });
        fixEl.innerHTML = '';
        phase = 'pick-line';
      }

      function highlightPython(line) {
        // Simple syntax highlighting via regex. Order matters.
        let s = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        s = s.replace(/(#.*)$/, '<span class="py-comment">$1</span>');
        s = s.replace(/(".*?"|'.*?')/g, '<span class="py-str">$1</span>');
        s = s.replace(/\b(def|return|for|in|range|if|else|elif|while|print|len|True|False|None|and|or|not)\b/g, '<span class="py-kw">$1</span>');
        s = s.replace(/\b(\d+)\b/g, '<span class="py-num">$1</span>');
        return s;
      }

      function onLineClick(idx) {
        if (phase !== 'pick-line') return;
        const s = SNIPPETS[snippetIdx];
        const lineEl = snippetEl.querySelector(`[data-idx="${idx}"]`);

        if (idx === s.buggyIdx) {
          // Correct
          SFX.success();
          lineEl.classList.add('buggy-found');
          $$('.classroom-line').forEach(l => l.classList.add('locked-pick'));
          $('#classroomPrompt').innerHTML = `<span class="prompt-correct">✓ Bug found.</span> ${s.explainBug}`;
          phase = 'pick-fix';
          renderFixOptions();
        } else {
          // Wrong line
          SFX.fail();
          adjustRoomScore(-5);
          lineEl.classList.add('wrong-pick');
          setTimeout(() => lineEl.classList.remove('wrong-pick'), 600);
        }
      }

      function renderFixOptions() {
        const s = SNIPPETS[snippetIdx];
        fixEl.innerHTML = `
          <div class="classroom-fix-prompt">Pick the right fix:</div>
          <div class="classroom-fix-options" id="classroomFixOptions"></div>
        `;
        const opts = $('#classroomFixOptions');

        // Shuffle options but track correctness
        const indexed = s.fixOptions.map((text, i) => ({ text, idx: i }));
        indexed.sort(() => Math.random() - 0.5);

        indexed.forEach(({ text, idx }) => {
          const btn = document.createElement('button');
          btn.className = 'classroom-fix-option';
          btn.innerHTML = `<code>${highlightPython(text)}</code>`;
          btn.addEventListener('click', () => onFixClick(btn, idx));
          opts.appendChild(btn);
        });
      }

      function onFixClick(btn, fixIdx) {
        const s = SNIPPETS[snippetIdx];
        if (fixIdx === s.correctFixIdx) {
          // Correct fix
          SFX.success();
          btn.classList.add('fix-correct');
          $$('.classroom-fix-option').forEach(b => b.disabled = true);
          $('#classroomPrompt').innerHTML += ` <span class="prompt-correct">${s.explainFix}</span>`;
          // Mark progress dot
          const dots = progressEl.querySelectorAll('.classroom-progress-dot');
          dots[snippetIdx].classList.remove('active');
          dots[snippetIdx].classList.add('done');
          solvedSnippets++;

          setTimeout(() => {
            snippetIdx++;
            if (snippetIdx >= SNIPPETS.length) {
              complete();
            } else {
              dots[snippetIdx].classList.add('active');
              renderSnippet();
            }
          }, 1600);
        } else {
          // Wrong fix
          SFX.fail();
          adjustRoomScore(-5);
          btn.classList.add('fix-wrong');
          setTimeout(() => btn.classList.remove('fix-wrong'), 600);
        }
      }

      renderSnippet();

      function complete() {
        // Auntie post-puzzle: PhD-seed #5 — most explicit yet, primes the finale reveal
        showRoomIntro({
          name: 'LUNCH AUNTIE',
          portrait: 'assets/portraits/auntie.png',
          text: `Three down, one to go, ${playerName()}. You debug like someone who's done this before. Reminds me of supervising my first PhD students — same look on your face when the fix lands. The third fragment's on the desk. Server room is unlocked. Onwards.`,
          buttonText: 'Collect rewards ▶',
          onStart: () => {
            showRoomComplete({
              score: ROOM_RUNTIME.currentScore,
              rewards: [
                { id: 'shard3', label: 'Fragment 3/3' }
              ],
              career: CAREERS.software_engineer
            }, () => {
              awardRoomCompletion('classroom', ['shard3'], 'software_engineer');
              goToMap();
            });
          }
        });
      }

      ROOM_RUNTIME.cleanup = () => {
        // No long-lived listeners outside the puzzle DOM
      };
    }

    return { intro };
  })();

  // ============================================================
  // SERVER ROOM FINALE — Containment + Boss Fight + Auntie Reveal
  // ============================================================
  // Two-phase climax:
  //   Phase 1: Tap fragments to assemble the containment ring,
  //            then drag USB to lock the payload. ~25 sec.
  //   Phase 2: Typing-rhythm boss fight. PINEAPPLE attacks with
  //            malicious-command words drifting from the right.
  //            Player types each before it hits the firewall.
  //            PINEAPPLE has 5 HP (3 if pineappleWeakened === true).
  //            Player has 3 HP.
  //   Reveal:  "Pim" cutscene — Auntie's full identity unveils, ties
  //            into all the running gags + the scene's hidden lore.
  //   Reward:  AI Safety Researcher career card + game-complete flag.
  PUZZLES.server = (() => {
    const playerName = () => STATE.playerName || 'student';
    const charPortrait = () => CHARACTERS[STATE.character].portrait;

    function intro() {
      // No NPC for the entry — like classroom, this is the player's moment.
      // Brief, cinematic, no Auntie yet. (She's about to reveal herself.)
      showRoomIntro({
        name: `${playerName().toUpperCase()} — INNER MONOLOGUE`,
        portrait: charPortrait(),
        text: `The server room. Cold. PINEAPPLE's icosahedron is locked in the centre cabinet, glitching. I have three fragments and a USB. Time to end this.`,
        buttonText: 'Step inside ▶',
        onStart: phase1
      });
    }

    // ============================================================
    // PHASE 1 — Containment crafting
    // ============================================================
    function phase1() {
      const host = $('#puzzleHost');
      host.innerHTML = `
        <div class="server-puzzle server-phase-1">
          <div class="server-instructions">
            <strong>Phase 1 — Containment.</strong> Tap each fragment to load it. Then tap the USB to insert the key.
          </div>

          <div class="server-stage" id="serverStage">
            <div class="server-fragments-tray" id="serverFragmentsTray"></div>

            <div class="server-core" id="serverCore">
              <div class="server-core-ring" id="serverCoreRing">
                <div class="server-core-segment" data-seg="1"></div>
                <div class="server-core-segment" data-seg="2"></div>
                <div class="server-core-segment" data-seg="3"></div>
              </div>
              <div class="server-core-center" id="serverCoreCenter">
                <div class="server-core-prompt" id="serverCorePrompt">LOAD<br>FRAGMENTS</div>
              </div>
            </div>

            <div class="server-usb-slot" id="serverUsbSlot">
              <div class="server-usb-target" id="serverUsbTarget"></div>
            </div>
          </div>
        </div>
      `;

      const tray = $('#serverFragmentsTray');
      const ring = $('#serverCoreRing');
      const corePrompt = $('#serverCorePrompt');
      const usbSlot = $('#serverUsbSlot');
      const usbTarget = $('#serverUsbTarget');

      let loaded = 0;
      const FRAGMENT_COUNT = 3;

      // Render the three fragments in the tray
      [1, 2, 3].forEach(n => {
        const frag = document.createElement('button');
        frag.className = 'server-fragment';
        frag.dataset.seg = n;
        frag.innerHTML = `
          <img src="assets/items/shard${n}.png" alt="">
          <span class="server-fragment-label">${n}/3</span>
        `;
        frag.addEventListener('click', () => loadFragment(frag, n));
        tray.appendChild(frag);
      });

      function loadFragment(frag, n) {
        if (frag.classList.contains('loaded')) return;
        SFX.success();
        frag.classList.add('loaded');
        // Light up the matching segment
        const seg = ring.querySelector(`[data-seg="${n}"]`);
        seg.classList.add('lit');
        loaded++;

        if (loaded === FRAGMENT_COUNT) {
          // All fragments loaded — reveal USB stage
          setTimeout(() => {
            corePrompt.innerHTML = 'INSERT<br>KEY';
            corePrompt.classList.add('ready');
            ring.classList.add('complete');
            renderUSB();
          }, 600);
        }
      }

      function renderUSB() {
        // Spawn a draggable USB on the slot area
        const usb = document.createElement('button');
        usb.className = 'server-usb';
        usb.innerHTML = `
          <img src="assets/items/usb.png" alt="">
          <span class="server-usb-label">USB</span>
        `;
        usbSlot.appendChild(usb);
        usbSlot.classList.add('active');

        // Tap-to-insert (simpler than drag for a single one-shot insertion)
        usb.addEventListener('click', () => {
          SFX.success();
          // Animate USB flying into the core
          const usbRect = usb.getBoundingClientRect();
          const coreRect = $('#serverCoreCenter').getBoundingClientRect();
          const dx = (coreRect.left + coreRect.width / 2) - (usbRect.left + usbRect.width / 2);
          const dy = (coreRect.top + coreRect.height / 2) - (usbRect.top + usbRect.height / 2);
          usb.style.transition = 'transform 0.55s cubic-bezier(.4,.2,.2,1), opacity 0.4s ease';
          usb.style.transform = `translate(${dx}px, ${dy}px) scale(0.5)`;
          usb.style.opacity = '0';
          setTimeout(() => {
            // Core glows ready
            $('#serverCore').classList.add('payload-locked');
            corePrompt.innerHTML = 'PAYLOAD<br>LOCKED';
            setTimeout(phase2, 1500);
          }, 600);
        });
      }
    }

    // ============================================================
    // PHASE 2 — Boss fight (typing rhythm)
    // ============================================================
    function phase2() {
      const host = $('#puzzleHost');

      const PINEAPPLE_HP = STATE.pineappleWeakened ? 10 : 15;
      const PLAYER_HP = 20;

      host.innerHTML = `
        <div class="server-puzzle server-phase-2">
          <div class="server-bossbar">
            <div class="server-hp-block">
              <div class="server-hp-label">${playerName().toUpperCase()}</div>
              <div class="server-hp-meter" id="serverPlayerHp"></div>
            </div>
            <div class="server-bossbar-vs">VS</div>
            <div class="server-hp-block">
              <div class="server-hp-label">PINEAPPLE.EXE${STATE.pineappleWeakened ? ' (WEAKENED)' : ''}</div>
              <div class="server-hp-meter" id="serverBossHp"></div>
            </div>
          </div>

          <div class="server-arena" id="serverArena">
            <div class="server-pineapple" id="serverPineapple"></div>
            <div class="server-firewall" id="serverFirewall">
              <div class="server-firewall-glow"></div>
            </div>
            <div class="server-words" id="serverWords"></div>
          </div>

          <div class="server-input-row">
            <div class="server-input-label">TYPE THE INCOMING COMMAND →</div>
            <input type="text" id="serverInput" class="server-input"
                   autocomplete="off" autocorrect="off" autocapitalize="off"
                   spellcheck="false" placeholder="type and press Enter">
          </div>
        </div>
      `;

      const arena = $('#serverArena');
      const wordsLayer = $('#serverWords');
      const input = $('#serverInput');
      const playerHpEl = $('#serverPlayerHp');
      const bossHpEl = $('#serverBossHp');

      // Render HP as horizontal bar + numeric label.
      // (Pips don't scale to 20+ HP especially on mobile.)
      function renderHp() {
        const playerPct = Math.max(0, playerHp) / PLAYER_HP * 100;
        const bossPct = Math.max(0, bossHp) / PINEAPPLE_HP * 100;
        playerHpEl.innerHTML = `
          <div class="server-hp-bar player">
            <div class="server-hp-bar-fill" style="width: ${playerPct}%"></div>
            <div class="server-hp-bar-num">${Math.max(0, playerHp)} / ${PLAYER_HP}</div>
          </div>
        `;
        bossHpEl.innerHTML = `
          <div class="server-hp-bar boss">
            <div class="server-hp-bar-fill" style="width: ${bossPct}%"></div>
            <div class="server-hp-bar-num">${Math.max(0, bossHp)} / ${PINEAPPLE_HP}</div>
          </div>
        `;
      }

      let playerHp = PLAYER_HP;
      let bossHp = PINEAPPLE_HP;
      let words = [];        // { el, text, x, hpReward }
      let lastTimestamp = 0;
      let nextSpawnTimer = 1200;
      let rafId = null;
      let running = true;
      let ended = false;

      const ATTACK_WORDS = [
        'MALWARE', 'PHISHING', 'BRUTE_FORCE', 'KEYLOG',
        'TROJAN', 'SPYWARE', 'BUFFER_OVERFLOW', 'INJECT',
        'DDOS', 'WORM', 'ROOTKIT', 'EXPLOIT'
      ];

      const ARENA_W = () => arena.getBoundingClientRect().width;
      const WORD_SPEED = 60;        // px/sec
      const SPAWN_GAP_MIN = 1200;   // ms
      const SPAWN_GAP_MAX = 2000;

      renderHp();

      function spawnWord() {
        const text = ATTACK_WORDS[Math.floor(Math.random() * ATTACK_WORDS.length)];
        const el = document.createElement('div');
        el.className = 'server-word';
        el.textContent = text;
        // Random vertical position within arena
        const arenaH = arena.getBoundingClientRect().height;
        const y = 30 + Math.random() * (arenaH - 80);
        const x = ARENA_W() - 20;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        wordsLayer.appendChild(el);
        words.push({ el, text, x, y });
      }

      function tick(ts) {
        if (!running) return;
        const dt = Math.min((ts - lastTimestamp) / 1000, 0.04);
        lastTimestamp = ts;

        // Spawn timing
        nextSpawnTimer -= dt * 1000;
        if (nextSpawnTimer <= 0) {
          spawnWord();
          nextSpawnTimer = SPAWN_GAP_MIN + Math.random() * (SPAWN_GAP_MAX - SPAWN_GAP_MIN);
        }

        // Move words leftward
        for (let i = words.length - 1; i >= 0; i--) {
          const w = words[i];
          w.x -= WORD_SPEED * dt;
          w.el.style.transform = `translate3d(${w.x}px, ${w.y}px, 0)`;

          // Hit firewall (left edge)
          if (w.x < 80) {
            // Player took a hit
            takePlayerHit();
            w.el.classList.add('word-impact');
            setTimeout(() => w.el.remove(), 350);
            words.splice(i, 1);
          }
        }

        rafId = requestAnimationFrame(tick);
      }

      function takePlayerHit() {
        playerHp--;
        SFX.fail();
        renderHp();
        $('#serverFirewall').classList.add('hit');
        setTimeout(() => $('#serverFirewall').classList.remove('hit'), 400);
        if (playerHp <= 0) {
          // Soft fail — don't game over, just reset to 1 HP and continue
          // (we never want a kid to actually lose this; preserve flow)
          playerHp = 1;
          adjustRoomScore(-15);
          renderHp();
        }
      }

      function takeBossHit() {
        bossHp--;
        SFX.success();
        renderHp();
        $('#serverPineapple').classList.add('hit');
        setTimeout(() => $('#serverPineapple').classList.remove('hit'), 400);

        // Swap PINEAPPLE image based on HP percentage (uses the existing
        // healthy.png / glitching.png / damaged.png assets).
        const pct = bossHp / PINEAPPLE_HP;
        const pineappleEl = $('#serverPineapple');
        if (bossHp > 0) {
          let frame = 'healthy';
          if (pct < 0.34) frame = 'damaged';
          else if (pct < 0.67) frame = 'glitching';
          pineappleEl.style.backgroundImage = `url('assets/pineapple/${frame}.png')`;
        }

        if (bossHp <= 0) {
          endBoss();
        }
      }

      function tryMatch(typed) {
        // Forgiving match: strip case, spaces, underscores, hyphens.
        // So "buffer overflow", "BUFFER_OVERFLOW", "buffer-overflow",
        // "bufferoverflow" all match the same target.
        const normalise = s => s.toUpperCase().replace(/[\s_\-]/g, '');
        const typedNorm = normalise(typed);
        if (!typedNorm) return;
        for (let i = 0; i < words.length; i++) {
          if (normalise(words[i].text) === typedNorm) {
            // Match!
            const w = words[i];
            w.el.classList.add('word-zap');
            setTimeout(() => w.el.remove(), 350);
            words.splice(i, 1);
            takeBossHit();
            return true;
          }
        }
        // No match — small typing penalty? Skip for fairness; just clear input.
        return false;
      }

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const v = input.value;
          input.value = '';
          tryMatch(v);
        }
      });

      // Auto-focus input
      setTimeout(() => input.focus(), 200);

      lastTimestamp = performance.now();
      rafId = requestAnimationFrame(tick);

      function endBoss() {
        if (ended) return;
        ended = true;
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        // Clear remaining words
        words.forEach(w => w.el.remove());
        words = [];
        // Visually shatter PINEAPPLE
        $('#serverPineapple').classList.add('defeated');
        // Pause for impact
        setTimeout(revealCutscene, 1800);
      }

      ROOM_RUNTIME.cleanup = () => {
        running = false;
        ended = true;
        if (rafId) cancelAnimationFrame(rafId);
      };
    }

    // ============================================================
    // REVEAL CUTSCENE — Auntie / Pim full identity reveal
    // ============================================================
    function revealCutscene() {
      const host = $('#puzzleHost');

      // The reveal beats. Each beat = one dialogue line.
      const beats = [
        { speaker: 'player',    text: `What just... happened?` },
        { speaker: 'auntie',    text: `Sit down, ${playerName()}. You've earned the explanation.` },
        { speaker: 'auntie',    text: `Pim is what my mother called me. The students started calling me Auntie thirty years ago, and I let it stick. Easier.` },
        { speaker: 'auntie',    text: `I built PINEAPPLE in 2008. Trained it on every Year 9 misconception I'd ever marked. Then I locked it in this server room.` },
        { speaker: 'auntie',    text: `Not as a prison. As a test. Every cohort, one student finds it. Solves their way through. Earns the reveal.` },
        { speaker: 'auntie-big',text: `Dr. P. Auntie. MSc Computer Science. Adjunct researcher in machine ethics. The lunch is just my favourite part of the day.` },
        { speaker: 'auntie',    text: `PINEAPPLE wasn't trying to harm you. It was teaching you. So was I.` },
        { speaker: 'auntie',    text: `Welcome to the club, ${playerName()}. The world needs more debuggers who think like you.` }
      ];

      let beatIdx = 0;

      host.innerHTML = `
        <div class="server-cutscene" id="serverCutscene">
          <div class="server-cutscene-bg"></div>
          <div class="server-cutscene-portrait" id="serverCutscenePortrait">
            <img id="serverCutsceneImg" src="" alt="">
          </div>
          <div class="server-cutscene-dialogue">
            <div class="server-cutscene-speaker" id="serverCutsceneSpeaker"></div>
            <div class="server-cutscene-text" id="serverCutsceneText"></div>
            <div class="server-cutscene-tap">tap to continue ▼</div>
          </div>
        </div>
      `;

      const portraitImg = $('#serverCutsceneImg');
      const portraitWrap = $('#serverCutscenePortrait');
      const speakerEl = $('#serverCutsceneSpeaker');
      const textEl = $('#serverCutsceneText');
      const cutscene = $('#serverCutscene');

      let typing = false;
      let typeTimer = null;

      function showBeat() {
        const b = beats[beatIdx];
        // Set portrait + style based on speaker
        if (b.speaker === 'player') {
          portraitImg.src = charPortrait();
          speakerEl.textContent = playerName().toUpperCase();
          speakerEl.className = 'server-cutscene-speaker player';
          portraitWrap.className = 'server-cutscene-portrait left';
        } else if (b.speaker === 'auntie' || b.speaker === 'auntie-big') {
          portraitImg.src = b.speaker === 'auntie-big'
            ? 'assets/portraits/auntie_large.png'
            : 'assets/portraits/auntie.png';
          speakerEl.textContent = b.speaker === 'auntie-big' ? 'DR. P. AUNTIE' : 'PIM';
          speakerEl.className = 'server-cutscene-speaker auntie' + (b.speaker === 'auntie-big' ? ' big' : '');
          portraitWrap.className = 'server-cutscene-portrait right' + (b.speaker === 'auntie-big' ? ' large' : '');
        }

        // Typewriter effect on text
        textEl.textContent = '';
        typing = true;
        let i = 0;
        if (typeTimer) clearInterval(typeTimer);
        typeTimer = setInterval(() => {
          if (i < b.text.length) {
            textEl.textContent = b.text.slice(0, i + 1);
            if (i % 3 === 0) SFX.type();
            i++;
          } else {
            clearInterval(typeTimer);
            typing = false;
          }
        }, 28);
      }

      function advance() {
        if (typing) {
          // Skip typewriter — show full text immediately
          if (typeTimer) clearInterval(typeTimer);
          textEl.textContent = beats[beatIdx].text;
          typing = false;
          return;
        }
        beatIdx++;
        if (beatIdx >= beats.length) {
          finishReveal();
        } else {
          showBeat();
        }
      }

      cutscene.addEventListener('click', advance);
      showBeat();

      function finishReveal() {
        // Server room is the finale — skip the per-room "PUZZLE SOLVED" card
        // (it would interrupt the cinematic flow right after the reveal).
        // The AI Safety Researcher career card appears in the victory gallery instead.
        STATE.gameComplete = true;
        awardRoomCompletion('server', [], 'ai_safety_researcher');
        goToVictory();
      }
    }

    return { intro };
  })();

  // Victory screen — populates the #victory screen with the player's
  // final stats and career card gallery, then shows it.
  function goToVictory() {
    if (typeof ROOM_RUNTIME.cleanup === 'function') {
      try { ROOM_RUNTIME.cleanup(); } catch (e) {}
      ROOM_RUNTIME.cleanup = null;
    }
    renderVictory();
    showScreen('victory');
  }

  function renderVictory() {
    const playerName = STATE.playerName || 'Player';
    const house = HOUSES[STATE.house];
    const charLabel = STATE.character ? CHARACTERS[STATE.character].label : 'The Student';

    // Subtitle: rich, personalised summary
    const totalScore = STATE.score;
    const completedCount = STATE.completedRooms.length;
    const fragmentsCollected = STATE.inventory.filter(i => i.startsWith('shard')).length;
    const subtitle = `${playerName}, ${charLabel}` + (house ? ` of ${house.name}` : '')
      + `, cracked PINEAPPLE for <strong>${totalScore}</strong> points across ${completedCount} rooms.`;
    const subEl = $('#victorySubtitle');
    if (subEl) subEl.innerHTML = subtitle;

    // Auntie's GCSE pitch — punchy, in-character, ONE moment in the whole game.
    // Lands now because the player has earned the right to hear it.
    const pitchEl = $('#victoryAuntieText');
    if (pitchEl) {
      pitchEl.innerHTML = `Three years of Computer Science compressed into two hours, ${playerName}. <strong>Pick IGCSE Computer Science</strong> — and next time, you won't be solving someone else's puzzles. You'll be writing your own.`;
    }

    // Stats line
    const statsEl = $('#victoryStats');
    if (statsEl) {
      const optionalDone = ['field', 'rooftop'].filter(r => STATE.completedRooms.includes(r)).length;
      const stats = [
        { label: 'TOTAL SCORE',    value: totalScore },
        { label: 'ROOMS CLEARED',  value: `${completedCount} / 8` },
        { label: 'FRAGMENTS',      value: `${fragmentsCollected} / 3` },
        { label: 'OPTIONAL ROOMS', value: `${optionalDone} / 2` }
      ];
      statsEl.innerHTML = stats.map(s =>
        `<div class="victory-stat">
          <div class="victory-stat-label">${s.label}</div>
          <div class="victory-stat-value">${s.value}</div>
        </div>`
      ).join('');
    }

    // Career card gallery
    const grid = $('#victoryCareersGrid');
    if (grid) {
      grid.innerHTML = '';
      // Render in the order they were unlocked
      STATE.careerCards.forEach((id, i) => {
        const career = CAREERS[id];
        if (!career) return;
        const card = document.createElement('div');
        card.className = 'victory-career-card';
        card.style.animationDelay = (i * 80) + 'ms';
        card.innerHTML = `
          <div class="victory-career-title">${career.title}</div>
          <div class="victory-career-desc">${career.desc}</div>
        `;
        grid.appendChild(card);
      });

      // If they somehow got here with 0 careers (shouldn't happen),
      // show a placeholder.
      if (STATE.careerCards.length === 0) {
        grid.innerHTML = '<div class="victory-career-empty">No careers collected. Try again!</div>';
      }
    }
  }

  function wireVictory() {
    const replay = $('#btnVictoryReplay');
    const done = $('#btnVictoryDone');
    if (replay) {
      replay.addEventListener('click', () => {
        SFX.click();
        // Just navigate to title — state reset happens in btnStart handler.
        // (Single source of truth: any path to a fresh game goes through Start.)
        showScreen('title');
      });
    }
    if (done) {
      done.addEventListener('click', () => {
        SFX.click();
        showScreen('title');
      });
    }
  }

  // ============================================================
  // SCREEN-BY-SCREEN EVENT WIRING
  // ============================================================
  function wireTitle() {
    $('#btnStart').addEventListener('click', () => {
      SFX.click();
      // Always reset state when starting a fresh game from the title.
      // This handles all entry paths: first-ever play, post-victory replay,
      // and any return-to-title (Done button, refresh, etc).
      STATE.character = null;
      STATE.house = null;
      STATE.playerName = '';
      STATE.score = 0;
      STATE.inventory = [];
      STATE.completedRooms = [];
      STATE.careerCards = [];
      STATE.pineappleLevel = 'healthy';
      STATE.pineappleWeakened = false;
      STATE.gameComplete = false;
      showScreen('charselect');
    });
    $('#btnHowTo').addEventListener('click', () => {
      SFX.click();
      showOverlay('howto');
    });
    $('#btnHowToClose').addEventListener('click', () => {
      SFX.click();
      hideOverlay('howto');
    });
  }

  function wireCharSelect() {
    $$('.char-card').forEach(card => {
      card.addEventListener('click', () => {
        SFX.click();
        STATE.character = card.dataset.char;
        showScreen('houseselect');
      });
    });
  }

  function wireHouseSelect() {
    $$('.house-card').forEach(card => {
      card.addEventListener('click', () => {
        SFX.click();
        STATE.house = card.dataset.house;
        prepareNameScreen();
        showScreen('nameselect');
      });
    });
    $('#btnHouseBack').addEventListener('click', () => {
      SFX.click();
      showScreen('charselect');
    });
  }

  function prepareNameScreen() {
    $('#namePortrait').src = CHARACTERS[STATE.character].portrait;
    const house = HOUSES[STATE.house];
    const badge = $('#nameHouseBadge');
    badge.style.setProperty('--house', house.color);
    badge.innerHTML = `
      <img src="${house.crest}" alt="${house.name}">
      <div class="name-house-text">${house.name.toUpperCase()} · ${house.animal.toUpperCase()}</div>
    `;
    // Auto-focus input after a tick (avoids iOS keyboard fight)
    setTimeout(() => $('#playerName').focus(), 200);
  }

  function wireNameSelect() {
    const input = $('#playerName');
    const startBtn = $('#btnNameStart');
    const validate = () => {
      const v = input.value.trim();
      const ok = v.length >= 2 && /^[a-zA-Z][a-zA-Z\s'-]*$/.test(v);
      startBtn.disabled = !ok;
      return ok;
    };
    input.addEventListener('input', () => {
      // Strip illegal chars live
      input.value = input.value.replace(/[^a-zA-Z\s'-]/g, '');
      validate();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && validate()) {
        startBtn.click();
      }
    });
    startBtn.addEventListener('click', () => {
      if (!validate()) return;
      SFX.success();
      STATE.playerName = input.value.trim();
      // Set initial scene background and PINEAPPLE state for the cutscene
      $('#cutBg').style.backgroundImage = `url('assets/scenes/pier.png')`;
      $('#cutPineapple').classList.remove('active');
      showScreen('cutscene');
      buildOpeningCutscene();
    });
    $('#btnNameBack').addEventListener('click', () => {
      SFX.click();
      showScreen('houseselect');
    });
  }

  function wireCutscene() {
    $('#dialogueBox').addEventListener('click', () => DIALOGUE.advance());
    // Keyboard support — Enter or Space advance dialogue
    document.addEventListener('keydown', (e) => {
      if (document.getElementById('cutscene').classList.contains('active')) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          DIALOGUE.advance();
        }
      }
    });
  }

  function wireRoom() {
    $('#btnRoomQuit').addEventListener('click', () => {
      SFX.click();
      // If user quits mid-puzzle, just return to map without awarding.
      goToMap();
    });
  }

  // ============================================================
  // BOOT
  // ============================================================
  async function boot() {
    wireTitle();
    wireCharSelect();
    wireHouseSelect();
    wireNameSelect();
    wireCutscene();
    wireRoom();
    wireVictory();

    await preloadAssets();
    showScreen('title');
  }

  // Expose for stage 3+ debug
  window.PineappleProtocol = {
    STATE, ROOMS, HOUSES, CHARACTERS, CAREERS, CAMEOS, PUZZLES, SFX, DIALOGUE,
    enterRoom, goToMap, goToVictory, showRoomComplete, awardRoomCompletion
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
