// --- Constants & Config ---
const TILE_SIZE = 40;
let ROWS = 10;
let COLS = 20;

// Mutable configuration object (bound to UI)
const GameConfig = {
    // Laser Tower (was Green)
    laserDamage: (typeof TOWERS !== 'undefined' ? TOWERS[TOWER_TYPES.LASER].damage : 80),
    laserRange: (typeof TOWERS !== 'undefined' ? TOWERS[TOWER_TYPES.LASER].range : 150),
    laserDelay: (typeof TOWERS !== 'undefined' ? TOWERS[TOWER_TYPES.LASER].cooldown : 0),

    // Missile Tower (was Red)
    missileDamage: (typeof TOWERS !== 'undefined' ? TOWERS[TOWER_TYPES.MISSILE].damage : 50),
    missileRange: (typeof TOWERS !== 'undefined' ? TOWERS[TOWER_TYPES.MISSILE].range : 250),
    missileSpeed: (typeof TOWERS !== 'undefined' && TOWERS[TOWER_TYPES.MISSILE].projectile ? TOWERS[TOWER_TYPES.MISSILE].projectile.speed : 6),
    missileDelay: (typeof TOWERS !== 'undefined' ? TOWERS[TOWER_TYPES.MISSILE].cooldown : 1500),

    // EMP Tower (was Blue)
    empDamage: (typeof TOWERS !== 'undefined' ? TOWERS[TOWER_TYPES.EMP].damage : 10),
    empRadius: (typeof TOWERS !== 'undefined' ? TOWERS[TOWER_TYPES.EMP].range : 100),
    empDelay: (typeof TOWERS !== 'undefined' ? TOWERS[TOWER_TYPES.EMP].cooldown : 2000),
    empSlowFactor: (typeof TOWERS !== 'undefined' && TOWERS[TOWER_TYPES.EMP].effect ? TOWERS[TOWER_TYPES.EMP].effect.factor : 0.5),
    empDuration: (typeof TOWERS !== 'undefined' && TOWERS[TOWER_TYPES.EMP].effect ? TOWERS[TOWER_TYPES.EMP].effect.duration : 1000),

    // Artillery Tower (was Purple)
    artilleryDamage: (typeof TOWERS !== 'undefined' ? TOWERS[TOWER_TYPES.ARTILLERY].damage : 150),
    artilleryRange: (typeof TOWERS !== 'undefined' ? TOWERS[TOWER_TYPES.ARTILLERY].range : 150),
    artilleryDelay: (typeof TOWERS !== 'undefined' ? TOWERS[TOWER_TYPES.ARTILLERY].cooldown : 1000),

    // Railgun
    railgunDamage: (typeof TOWERS !== 'undefined' ? TOWERS[TOWER_TYPES.RAILGUN].damage : 150),
    railgunDelay: (typeof TOWERS !== 'undefined' ? TOWERS[TOWER_TYPES.RAILGUN].cooldown : 2000),

    // Misc
    particleLife: 500
};

// Dynamically inject Enemy defaults into GameConfig
if (typeof ENEMIES !== 'undefined') {
    ENEMIES.forEach(e => {
        GameConfig[e.id + 'HP'] = e.hp;
        GameConfig[e.id + 'Speed'] = e.speed;
        GameConfig[e.id + 'Value'] = e.value; // Reward
    });
}



// --- State Management ---
// ... (Lines 71-454 omitted for brevity, ensure context match if replacing large chunk or stick to small chunks)
// Actually I need to be careful with replace_file_content. It replaces the TargetContent.
// I should split this into two calls or ensure I match the large block perfectly.
// Since LayoutGroups is separate from setupInputs in the file, I should do them separately or assume I can't reach both in one block if they are far apart.
// LayoutGroups is lines 44-69. setupInputs is line 451.
// They are far apart. I will do LayoutGroups first, then setupInputs.

// --- State Management ---
const State = {
    money: (typeof CONSTS !== 'undefined' && CONSTS.START_MONEY) ? CONSTS.START_MONEY : 1000,
    lives: (typeof CONSTS !== 'undefined' && CONSTS.START_LIVES) ? CONSTS.START_LIVES : 20,
    wave: 1,
    score: 0,
    spawningState: 'idle', // 'idle', 'spawning', 'cooldown'
    shipsInCurrentGroup: 0,
    groupCooldownTimer: 0,
    selectedTower: null, // "placement mode" type (string)
    selectedTowerInstance: null, // "context mode" instance (object)
    towers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    lastTime: 0,
    mouse: { x: 0, y: 0, tileX: 0, tileY: 0, inCanvas: false },
    mapIndex: 0,
    roundActive: false,
    enemiesSpawnedThisRound: 0, // In current group
    totalEnemiesToSpawn: 0, // Target per group
    spawnTimer: 0,
    nextSpawnDelay: 0,
    gameId: 0, // To invalidate pending spawns on reset
    flashLife: 0, // For exit flash effect
    paused: true,
    gameOver: false,
    musicPlaying: false,
    uiMouse: { x: 0, y: 0 }
};

const bgMusic = new Audio(); // Start empty
bgMusic.loop = false; // Playlist handling instead of loop
bgMusic.volume = (typeof CONSTS !== 'undefined' && CONSTS.MUSIC_VOLUME !== undefined) ? CONSTS.MUSIC_VOLUME : 0.5;



let currentSongIndex = 0;

function playNextSong() {
    if (typeof CONSTS === 'undefined' || !CONSTS.SONGS || CONSTS.SONGS.length === 0) return;

    currentSongIndex = (currentSongIndex + 1) % CONSTS.SONGS.length;

    bgMusic.src = CONSTS.SONGS[currentSongIndex];
    bgMusic.play().catch(e => console.log("Next song play failed:", e));

    // Force State / UI Sync
    State.musicPlaying = true;
    const btn = document.getElementById('btn-music');
    if (btn) {
        btn.innerHTML = '<span class="audio-icon">&#10074;&#10074;</span> Music';
        btn.classList.add('active');
        btn.classList.remove('paused');
    }
}
window.playNextSong = playNextSong;

bgMusic.addEventListener('ended', playNextSong);

function unlockAudio() {
    if (State.musicPlaying && bgMusic.paused) {
        bgMusic.play().catch(e => console.log("Unlock play failed", e));
    }
    // Remove from both to ensure we only try once
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
}

// --- Core Systems ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency on main canvas

// Double buffering / Caching for static background
const bgCanvas = document.createElement('canvas');
bgCanvas.width = canvas.width;
bgCanvas.height = canvas.height;
const bgCtx = bgCanvas.getContext('2d');

// Map State
let Grid = [];
let StartCells = [];
let EndCells = [];

function loadMap(index) {
    if (index < 0 || index >= Maps.length) return;
    stopAllSFX(); // Clear any lingering sounds from previous map/pause
    State.mapIndex = index;
    State.gameId++; // Invalidate previous session spawns
    // User requested to ignore the first newline if present
    let mapStr = Maps[index];
    if (mapStr.startsWith('\n')) mapStr = mapStr.substring(1);

    // Also trim end to avoid trailing empty lines from template literal indentation
    mapStr = mapStr.trimEnd();

    const lines = mapStr.split('\n');

    ROWS = lines.length;
    COLS = lines[0].length;

    // Resize Canvas
    canvas.width = COLS * TILE_SIZE;
    canvas.height = ROWS * TILE_SIZE;
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;

    Grid = [];
    StartCells = [];
    EndCells = [];

    // Reset State
    State.towers = [];
    State.enemies = [];
    State.projectiles = [];
    State.particles = [];
    State.money = (typeof CONSTS !== 'undefined' && CONSTS.START_MONEY) ? CONSTS.START_MONEY : 1000;
    State.lives = (typeof CONSTS !== 'undefined' && CONSTS.START_LIVES) ? CONSTS.START_LIVES : 20;
    State.wave = 1;
    State.score = 0;
    State.spawningState = 'idle';
    State.roundActive = false; // "Round" now implies "Active Gameplay/Stream"
    State.enemiesSpawnedThisRound = 0; // Current Group Count
    State.totalEnemiesToSpawn = 0;
    State.spawnTimer = 0;
    State.nextSpawnDelay = 0;
    State.groupCooldownTimer = 0;
    State.paused = true; // Pause on map load
    State.gameOver = false;
    updateStats();
    updatePauseButton();

    for (let r = 0; r < ROWS; r++) {
        const row = [];
        const line = lines[r] || "X".repeat(COLS);
        for (let c = 0; c < COLS; c++) {
            const char = line[c] || 'X';
            // 0: Buildable Wall (O)
            // 1: Generic Path (Space, S, E) - No forced turn
            // 2: Non-Buildable Wall (X)
            // Directions: 3:N, 4:E, 5:S, 6:W

            if (char === 'O') row.push(0);
            else if (char === 'X') row.push(2);
            else if (char === ' ') row.push(1);
            else if (char === 'S') {
                row.push(7); // 7: Start
                StartCells.push({c, r});
            }
            else if (char === 'E') {
                row.push(8); // 8: End
                EndCells.push({c, r});
            }
            else if (char === 'n') row.push(3);
            else if (char === 'e') row.push(4);
            else if (char === 's') row.push(5);
            else if (char === 'w') row.push(6);
            else {
                row.push(2); // Default to wall
            }
        }
        Grid.push(row);
    }

    // Adjust UI Panel width if needed, or keep fixed
    // Width adjustment removed for horizontal layout


    // Update Map Label
    const mapLbl = document.getElementById('map-current');
    if (mapLbl) mapLbl.textContent = `Map ${index + 1}`;

    handleResize();
}

// --- Sound Helper ---
const SoundBank = {}; // Map<filename, Array<Audio>>
const POOL_SIZE = 8;
// No global ActiveSFX array needed, we iterate pools




function preloadSounds() {
    const soundUrls = new Set();

    if (typeof TOWERS !== 'undefined') {
        Object.values(TOWERS).forEach(def => {
            if (def.fire_sound) soundUrls.add(def.fire_sound);
            if (def.explode_sound) soundUrls.add(def.explode_sound);
        });
    }
    if (typeof ENEMIES !== 'undefined') {
        ENEMIES.forEach(def => {
            if (def.explode_sound) soundUrls.add(def.explode_sound);
        });
    }
    // Consts alarm sound
    if (typeof CONSTS !== 'undefined' && CONSTS.EXIT_ALARM_SOUND) {
        soundUrls.add(CONSTS.EXIT_ALARM_SOUND);
    }

    soundUrls.forEach(url => {
        if (!SoundBank[url]) {
            SoundBank[url] = [];
            for (let i = 0; i < POOL_SIZE; i++) {
                const a = new Audio(url);
                a.preload = 'auto';
                SoundBank[url].push(a);
            }
        }
    });
}

function playSound(filename, volumeScale = 1.0) {
    if (!filename || !SoundBank[filename]) return null;

    const pool = SoundBank[filename];
    // Find free existing one
    const audio = pool.find(a => a.paused || a.ended);

    if (!audio) {
        // All sounds in pool are busy. Skip sound.
        return null;
    }

    const baseVol = (typeof CONSTS !== 'undefined' && CONSTS.SFX_VOLUME !== undefined) ? CONSTS.SFX_VOLUME : 0.5;
    audio.volume = Math.max(0, Math.min(1, baseVol * volumeScale));
    audio.currentTime = 0;

    audio.play().catch(e => {
        // Auto-play block or other error
    });
    return audio;
}

function stopAllSFX() {
    // Stop all pool sounds
    Object.values(SoundBank).forEach(pool => {
        pool.forEach(audio => {
            if (!audio.paused) {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                } catch (e) { }
            }
        });
    });

    // Stop Tower Loops / States
    State.towers.forEach(t => {
        if (t.soundInstance) {
            try {
                t.soundInstance.pause();
                t.soundInstance.currentTime = 0;
            } catch (e) { }
            t.soundInstance = null;
        }
        t.isEmitting = false;
    });
}

// --- Helpers ---
function pointDistance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}

function getNearestEnemy(x, y, range, enemies) {
    let nearest = null;
    let minDist = range;

    for (const e of enemies) {
        const d = pointDistance(x, y, e.x, e.y);
        if (d <= minDist) {
            minDist = d;
            nearest = e;
        }
    }
    return nearest;
}

function getWeakestEnemy(x, y, range, enemies) {
    let target = null;
    let minHP = Infinity;

    for (const e of enemies) {
        if (pointDistance(x, y, e.x, e.y) <= range) {
            if (e.hp < minHP) {
                minHP = e.hp;
                target = e;
            }
        }
    }
    return target;
}

function getStrongestEnemy(x, y, range, enemies) {
    let target = null;
    let maxHP = -Infinity;

    for (const e of enemies) {
        if (pointDistance(x, y, e.x, e.y) <= range) {
            if (e.hp > maxHP) {
                maxHP = e.hp;
                target = e;
            }
        }
    }
    return target;
}

function shadeColor(color, percent) {
    var f=parseInt(color.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
    return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
}

// Helper to parse hex
function hexToRb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const num = parseInt(hex, 16);
    return [num >> 16, num >> 8 & 255, num & 255];
}

function drawShape(ctx, shapeName, scale) {
    const shapeData = SHAPES[shapeName] || SHAPES.triangle;
    if (shapeData && shapeData.length > 0) {
        ctx.beginPath();
        ctx.moveTo(shapeData[0].x * scale, shapeData[0].y * scale);
        for (let i = 1; i < shapeData.length; i++) {
            ctx.lineTo(shapeData[i].x * scale, shapeData[i].y * scale);
        }
        ctx.closePath();
    } else {
        // Fallback
        ctx.beginPath();
        ctx.moveTo(scale, 0);
        ctx.lineTo(-scale/2, scale/2);
        ctx.lineTo(-scale/2, -scale/2);
        ctx.closePath();
    }
}

function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, l];
}

function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function blendColors(c1, c2, ratio) {
    // HSL Blend for "human" midpoint
    ratio = Math.max(0, Math.min(1, ratio));

    // Ensure valid fallback
    if (!c1) c1 = '#ffffff';
    if (!c2) c2 = '#ffffff';

    const [r1, g1, b1] = hexToRb(c1);
    const [r2, g2, b2] = hexToRb(c2);

    const [h1, s1, l1] = rgbToHsl(r1, g1, b1);
    const [h2, s2, l2] = rgbToHsl(r2, g2, b2);

    // Hue Interpolation (Shortest path)
    let dH = h2 - h1;
    if (dH > 0.5) dH -= 1;
    if (dH < -0.5) dH += 1;
    let h = h1 + dH * ratio;
    if (h < 0) h += 1;
    if (h > 1) h -= 1;

    // Saturation and Lightness
    let s = s1 + (s2 - s1) * ratio;
    let l = l1 + (l2 - l1) * ratio;

    const [r, g, b] = hslToRgb(h, s, l);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

let enemyIdCounter = 0;

// --- Initialization ---
function init() {

    preloadSounds();
    loadMap(0); // Load default map BEFORE events (resize)
    setupEvents();

    const splash = document.getElementById('splash-screen');
    const startBtn = document.getElementById('btn-start-game');
    const container = document.getElementById('game-container');

    if (splash && startBtn) {
        // Splash Mode
        if (container) container.classList.add('blurred');

        startBtn.addEventListener('click', () => {
             splash.style.display = 'none';
             if (container) container.classList.remove('blurred');

             // Unlock Audio / Start Music on Interaction
             if (typeof CONSTS !== 'undefined' && CONSTS.INITIAL_MUSIC_STATE && CONSTS.INITIAL_MUSIC_STATE.toLowerCase() === 'on') {
                if (!State.musicPlaying) {
                    toggleMusic();
                }
             }
        });

    } else {
        // Legacy / No Splash Mode
        if (typeof CONSTS !== 'undefined' && CONSTS.INITIAL_MUSIC_STATE && CONSTS.INITIAL_MUSIC_STATE.toLowerCase() === 'on') {
            // Attempt to start music (might be blocked by browser)
            if (!State.musicPlaying) {
                 toggleMusic();
            }
        }
    }

    // startNextRound(); // Don't auto-start round, let user play first
    requestAnimationFrame(gameLoop);
}





// Global Scale Factor
let appScale = 1;

function handleResize() {
    const container = document.getElementById('game-container');
    const layout = document.querySelector('.main-layout');
    const view = document.querySelector('.game-view');

    if (!layout || !view) return;

    // Available space from container (minus some padding for safety/aesthetics)
    const availW = view.offsetWidth - 40;
    const availH = view.offsetHeight - 40;

    // Logic Dimensions
    // Logic Dimensions
    const logicW = COLS * TILE_SIZE + 2; // +2 for right border
    const logicH = ROWS * TILE_SIZE + 2; // +2 for bottom border

    // Calculate Scale
    const scaleW = availW / logicW;
    const scaleH = availH / logicH;
    appScale = Math.min(scaleW, scaleH);

    // Minimum scale to prevent tiny canvas
    if (appScale < 0.1) appScale = 0.1;

    console.log("--- Resize Debug ---");
    console.log(`Container: ${view.offsetWidth}x${view.offsetHeight}`);
    console.log(`Available: ${availW}x${availH}`);
    console.log(`Logic: ${logicW}x${logicH}`);
    console.log(`Scales: W=${scaleW.toFixed(3)}, H=${scaleH.toFixed(3)}`);
    console.log(`Final Scale: ${appScale}`);
    console.log(`Canvas: ${logicW * appScale}x${logicH * appScale}`);

    // Update Canvas Size
    canvas.width = logicW * appScale;
    canvas.height = logicH * appScale;
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;

    // Apply Context Scale
    ctx.setTransform(appScale, 0, 0, appScale, 0, 0);
    bgCtx.setTransform(appScale, 0, 0, appScale, 0, 0);

    // Redraw Static Background
    renderStaticBackground();
}

function adjustSFX(dir) {
    if (typeof CONSTS === 'undefined') return;

    // Default step if not defined (fallback)
    const step = CONSTS.SFX_VOL_DOWN_AMOUNT || 0.1;

    let newVol = (CONSTS.SFX_VOLUME || 0.6) + (dir * step);
    newVol = Math.max(0, Math.min(1, newVol));

    // Update Constant (Runtime)
    CONSTS.SFX_VOLUME = newVol;

    // No visual feedback requested, but maybe console log?
    console.log("SFX Volume:", CONSTS.SFX_VOLUME.toFixed(1));
}
window.adjustSFX = adjustSFX;

function adjustMusic(dir) {
    if (typeof CONSTS === 'undefined') return;

    const step = CONSTS.MUSIC_VOL_DOWN_AMOUNT || 0.1;
    let newVol = bgMusic.volume + (dir * step);
    newVol = Math.max(0, Math.min(1, newVol));

    bgMusic.volume = newVol;
    // Update constant for persistence if we were saving it (we aren't, but good practice)
    CONSTS.MUSIC_VOLUME = newVol;

    console.log("Music Volume:", bgMusic.volume.toFixed(1));
}
window.adjustMusic = adjustMusic;


function toggleMusic() {
    window.toggleMusic = toggleMusic; // Ensure global access

    // Fix for Autoplay Policy:
    // If logically "On" but physically "Paused", this click is the user interaction we need to start it.
    // Don't toggle off; just play.
    if (State.musicPlaying && bgMusic.paused) {
        bgMusic.play().catch(e => console.log("Resuming audio failed:", e));

        // Ensure UI stays "Music On"
        const btn = document.getElementById('btn-music');
        if (btn) {
            btn.innerHTML = '<span class="audio-icon">&#10074;&#10074;</span> Music'; // Pause symbol + Text
            btn.classList.add('active');
            btn.classList.remove('paused');
        }
        return;
    }

    State.musicPlaying = !State.musicPlaying;
    const btn = document.getElementById('btn-music');

    if (State.musicPlaying) {
        // Initialize if src is empty
        if (!bgMusic.src || bgMusic.src === '') {
             if (typeof CONSTS !== 'undefined' && CONSTS.SONGS && CONSTS.SONGS.length > 0) {
                 if (CONSTS.RANDOM_FIRST_SONG) {
                     currentSongIndex = Math.floor(Math.random() * CONSTS.SONGS.length);
                 } else {
                     currentSongIndex = 0;
                 }
                 bgMusic.src = CONSTS.SONGS[currentSongIndex];
             } else {
                 // Fallback if no songs defined?
                 bgMusic.src = 'vector_assets/audio/GeometricLinesofDefense_2.mp3';
             }
        }

        bgMusic.play().catch(e => console.log("Audio play failed (user interaction needed?):", e));
        if (btn) {
            btn.innerHTML = '<span class="audio-icon">&#10074;&#10074;</span> Music'; // Pause symbol + Text
            btn.classList.add('active');
            btn.classList.remove('paused');
        }
    } else {
        bgMusic.pause();
        if (btn) {
            btn.innerHTML = '<span class="audio-icon">&#9658;</span> Music'; // Play symbol + Text
            btn.classList.remove('active');
            btn.classList.add('paused');
        }
    }
}

function setupEvents() {
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', e => {
        State.uiMouse.x = e.clientX;
        State.uiMouse.y = e.clientY;
    });

    // Initial Resize
    handleResize();

    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        State.mouse.x = (e.clientX - rect.left) / appScale;
        State.mouse.y = (e.clientY - rect.top) / appScale;
        State.mouse.tileX = Math.floor(State.mouse.x / TILE_SIZE);
        State.mouse.tileY = Math.floor(State.mouse.y / TILE_SIZE);
        State.mouse.inCanvas = true;
    });

    canvas.addEventListener('mouseleave', () => {
        State.mouse.inCanvas = false;
    });

    canvas.addEventListener('click', e => {
        const c = State.mouse.tileX;
        const r = State.mouse.tileY;

        // check for existing tower
        const existing = State.towers.find(t => t.c === c && t.r === r);

        if (existing) {
            // Toggle off if clicking the currently selected tower again
            if (State.selectedTowerInstance === existing) {
                deselectTowerInstance();
            } else {
                selectTowerInstance(existing);
            }
        } else if (State.selectedTower) {
            tryPlaceTower();
        } else {
            deselectTowerInstance();
        }
    });

    // Sell / Context Buttons
    const btnSell = document.getElementById('btn-sell');
    if(btnSell) btnSell.addEventListener('click', sellSelectedTower);


    // Expose selectTower to window for buttons
    window.selectTower = function(type) {
        // Toggle off if already selected
        if (State.selectedTower === type) {
            deselectTowerInstance(); // Handles full deselect and UI update
            return;
        }

        // Standard Selection
        State.selectedTowerInstance = null; // Clear instance selection
        State.selectedTower = type;
        if (type === 'railgun') {
            State.placementAngle = Math.PI; // Default West
        } else {
            State.placementAngle = 0;
        }

        // Visual Selection
        document.querySelectorAll('.tower-select .tower-btn').forEach(b => b.classList.remove('selected'));
        const btn = document.querySelector(`.btn-${type}`);
        if(btn) btn.classList.add('selected');

        // Update UI
        updatePanelVisibility();
    }

    // Audio Unlock for Autoplay Policy
    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    // Play/Pause
    const btnPlayPause = document.getElementById('btn-play-pause');
    if (btnPlayPause) btnPlayPause.addEventListener('click', togglePause);

    // Map Controls
    const prevBtn = document.getElementById('map-prev');
    const nextBtn = document.getElementById('map-next');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            let newIndex = (State.mapIndex - 1);
            if (typeof Maps !== 'undefined') {
                if (newIndex < 0) newIndex = Maps.length - 1;
                loadMap(newIndex);
                startNextRound();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
             let newIndex = (State.mapIndex + 1);
             if (typeof Maps !== 'undefined') {
                if (newIndex >= Maps.length) newIndex = 0;
                loadMap(newIndex);
                startNextRound();
             }
        });
    }

    // Music Control
    // Note: Event listener is handled via onclick in HTML to ensure reliability
    // Export toggleMusic for global access
    window.toggleMusic = toggleMusic;

    const btnNewGame = document.getElementById('btn-new-game');
    if (btnNewGame) btnNewGame.addEventListener('click', resetGame);

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) btnRestart.addEventListener('click', resetGame);

    // Context Controls (Railgun Direction)
    document.querySelectorAll('.dir-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const dir = parseInt(e.target.dataset.dir);
            // 3:N (-PI/2), 4:E (0), 5:S (PI/2), 6:W (PI)
            let angle = 0;
            if (dir === 3) angle = -Math.PI/2;
            if (dir === 4) angle = 0;
            if (dir === 5) angle = Math.PI/2;
            if (dir === 6) angle = Math.PI;

            if (State.selectedTowerInstance && State.selectedTowerInstance.type === 'railgun') {
                State.selectedTowerInstance.angle = angle;
                State.selectedTowerInstance.lastShot = Date.now(); // Reset Cooldown
                populateTowerInfo(State.selectedTowerInstance); // Update visuals
            } else if (State.selectedTower === 'railgun') {
                State.placementAngle = angle;
                populateTowerInfo('railgun'); // Update visuals
            }
        });
    });
}

function renderStaticBackground() {
    // Switch to Screen Space for sharp lines
    bgCtx.save();
    bgCtx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform logic

    // Fill Background
    bgCtx.fillStyle = CONSTS.BG_COLOR;
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (!Grid[r]) continue;
            const type = Grid[r][c];

            // Calculate Screen Coordinates (Integer Snapped)
            const x1 = Math.floor(c * TILE_SIZE * appScale);
            const y1 = Math.floor(r * TILE_SIZE * appScale);
            const x2 = Math.floor((c + 1) * TILE_SIZE * appScale);
            const y2 = Math.floor((r + 1) * TILE_SIZE * appScale);

            const w = x2 - x1;
            const h = y2 - y1;

            // Path types: 1, 3(N), 4(E), 5(S), 6(W), 7(Start), 8(End)
            const isPath = (type === 1 || (type >= 3 && type !== 7 && type !== 8));
            const isStructure = type === 2; // X (Non-buildable)

            // Wireframe Grid
            bgCtx.lineWidth = 1;

            if (type === 7 || type === 8) {
                 // Start/End: Draw NOTHING.
            } else {
                 // Standard Cell
                 bgCtx.strokeStyle = isPath ? CONSTS.BG_COLOR : CONSTS.GAME_BORDER_COLOR;
                 if (!isPath) {
                    // Draw centered on pixel grid (+0.5)
                    // Use x1+0.5, y1+0.5, w, h to ensure adjacent borders overlap exactly
                    bgCtx.strokeRect(x1 + 0.5, y1 + 0.5, w, h);
                 }
            }

            // Structure (X only) - Draw diagonal lines
            if (isStructure) {
                bgCtx.beginPath();
                bgCtx.moveTo(x1, y1);
                bgCtx.lineTo(x2, y2);
                bgCtx.moveTo(x2, y1);
                bgCtx.lineTo(x1, y2);

                bgCtx.strokeStyle = CONSTS.WALL_COLOR;
                bgCtx.stroke();
            }
        }
    }

    bgCtx.restore();
}



function tryPlaceTower() {
    const c = State.mouse.tileX;
    const r = State.mouse.tileY;

    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    if (Grid[r][c] !== 0) return; // Must be Buildable Wall (0) [O]
    if (State.towers.find(t => t.c === c && t.r === r)) return;

    // Check Cost
    // Check Cost
    let cost = 0;
    if (State.selectedTower && TOWERS[State.selectedTower]) {
        cost = TOWERS[State.selectedTower].price;
    } else {
        // Fallback or explicit checks if needed, but generic approach is better now
        if (State.selectedTower === 'green') cost = 10;
        if (State.selectedTower === 'red') cost = 20;
        if (State.selectedTower === 'blue') cost = 30;
        if (State.selectedTower === 'purple') cost = 40;
    }

    if (State.money < cost) return;

    const x = c * TILE_SIZE + TILE_SIZE/2;
    const y = r * TILE_SIZE + TILE_SIZE/2;

    State.towers.push({
        type: State.selectedTower,
        c, r, x, y,
        c, r, x, y,
        type: State.selectedTower,
        c, r, x, y,
        angle: (State.selectedTower === 'railgun' ? (State.placementAngle !== undefined ? State.placementAngle : Math.PI) : 0),
        lastShot: 0
    });

    State.money -= cost;
    updateStats();
}

// --- Context UI ---
// --- Context UI ---
function updatePanelVisibility() {
    const panelConfig = document.getElementById('config-inputs');
    const panelContext = document.querySelector('.tower-context-panel');
    const panelSelect = document.querySelector('.tower-select'); // Buttons always visible now?

    // User requirement: "This lower panel [Context] will be displayed INSTEAD of the existing towers/enemies/misc buttons [Config Panel/Tabs]"
    // Tower Select Buttons (the 4 icons) should probably stay visible to allow changing selection?
    // "Then when a tower button is unselected, we return the UI panel to normal."
    // So:
    // If (SelectedTower OR SelectedInstance) -> Show Context, Hide Config
    // Else -> Show Config, Hide Context

    // panelSelect (Top buttons) - logic implies they stay, but maybe we just ensure config is swapped.
    if(panelSelect) panelSelect.style.display = 'grid'; // Ensure visible (was hidden by old logic)

    const active = State.selectedTower || State.selectedTowerInstance;

    if (active) {
        if(panelConfig) panelConfig.style.display = 'none';
        if(panelContext) panelContext.style.display = 'flex';
        populateTowerInfo(active);
    } else {
        if(panelConfig) panelConfig.style.display = 'flex';
        if(panelContext) panelContext.style.display = 'none';
    }
}

function populateTowerInfo(target) {
    const nameLbl = document.getElementById('ctx-tower-name');
    const infoLbl = document.getElementById('ctx-tower-info');
    const sellBtn = document.getElementById('btn-sell');
    const actionsDiv = document.getElementById('ctx-tower-actions');

    let type, def, isInstance = false;

    if (typeof target === 'string') {
        type = target;
        def = TOWERS[type];
    } else {
        // From existing tower instance (Context Menu)
        type = target.type; // Use the type from the instance
        def = target.def || TOWERS[type];
        isInstance = true;
    }

    if (!def) return;

    if(nameLbl) nameLbl.textContent = def.name;

    // Info String
    let info = [];
    const damage = GameConfig[type + 'Damage'] || def.damage;
    const range = GameConfig[type + 'Range'] || def.range;
    const cooldown = GameConfig[type + 'Delay'] || def.cooldown;

    let dps = (cooldown > 0) ? (damage * (1000/cooldown)) : (damage * (1000/60)); // rough est

    info.push(`Damage: ${damage}`);
    info.push(`Range: ${range}`);
    info.push(`Cooldown: ${(cooldown/1000).toFixed(1)}s`);

    if (def.type === TOWER_TYPES.EMP) {
        // Special Pulse Info
         const slow = GameConfig[type + 'SlowFactor'] || (def.effect ? def.effect.factor : 0.5);
         info.push(`Slow: ${(100 - slow*100).toFixed(0)}%`);
    }

    if (isInstance) {
        // Future: Kills, Total Damage
    } else {
        info.push(`Price: $${def.price}`);
    }

    if(infoLbl) infoLbl.innerHTML = info.join('<br>');

    // Actions
    if (isInstance) {
        if(actionsDiv) actionsDiv.style.display = 'flex';
        const basePrice = def.price;
        const sellVal = Math.floor(basePrice * CONSTS.TOWER_SALE_PCT);
        if(sellBtn) sellBtn.textContent = `Sell ($${sellVal})`;
    } else {
        // Placement mode - No actions (Sell)
        if(actionsDiv) actionsDiv.style.display = 'none';
    }

    // Controls (Railgun)
    const ctrlDiv = document.getElementById('ctx-tower-controls');
    if (ctrlDiv) {
        if (type === 'railgun') { // Show for both instance and placement
            ctrlDiv.style.display = 'flex';
            // Update active state
            const angle = isInstance ? target.angle : (State.placementAngle !== undefined ? State.placementAngle : Math.PI);

            // Normalize angle to roughly match direction
            // 3:N (-1.57), 4:E (0), 5:S (1.57), 6:W (3.14) or (-3.14)
            // Fuzzy match
            document.querySelectorAll('.dir-btn').forEach(btn => {
                btn.classList.remove('active');
                const dir = parseInt(btn.dataset.dir);
                let match = false;
                if (dir === 4 && Math.abs(angle) < 0.1) match = true;
                if (dir === 3 && Math.abs(angle + Math.PI/2) < 0.1) match = true;
                if (dir === 5 && Math.abs(angle - Math.PI/2) < 0.1) match = true;
                if (dir === 6 && (Math.abs(angle - Math.PI) < 0.1 || Math.abs(angle + Math.PI) < 0.1)) match = true;
                if (match) btn.classList.add('active');
            });

        } else {
            ctrlDiv.style.display = 'none';
        }
    }
}

function selectTowerInstance(tower) {
    State.selectedTowerInstance = tower;
    State.selectedTower = null; // Clear build mode
    document.querySelectorAll('.tower-select .tower-btn').forEach(b => b.classList.remove('selected'));

    updatePanelVisibility();
}

function deselectTowerInstance() {
    State.selectedTowerInstance = null;
    State.selectedTower = null; // Also clear placement state if cancelling
    // Clear button selection visually
    document.querySelectorAll('.tower-select .tower-btn').forEach(b => b.classList.remove('selected'));

    updatePanelVisibility();
}

function sellSelectedTower() {
    if (!State.selectedTowerInstance) return;

    const t = State.selectedTowerInstance;
    let basePrice = 0;
    if (t.type && TOWERS[t.type]) {
        basePrice = TOWERS[t.type].price;
    } else {
       if (t.type === 'green') basePrice = 10;
       else if (t.type === 'red') basePrice = 20;
       else if (t.type === 'blue') basePrice = 30;
       else if (t.type === 'purple') basePrice = 40;
    }

    const sellVal = Math.floor(basePrice * CONSTS.TOWER_SALE_PCT);
    State.money += sellVal;

    // Remove from array
    const idx = State.towers.indexOf(t);
    if (idx !== -1) State.towers.splice(idx, 1);

    deselectTowerInstance();
    updateStats();
}


// --- Wave Logic ---
// --- Wave / Stream Logic ---
function startNextRound() {
    if (StartCells.length === 0) return;
    State.roundActive = true;
    State.spawningState = 'spawning';

    // Group Size
    State.totalEnemiesToSpawn = (typeof CONSTS !== 'undefined' && CONSTS.SHIPS_PER_GROUP) ? CONSTS.SHIPS_PER_GROUP : 10;

    State.enemiesSpawnedThisRound = 0;
    State.spawnTimer = 0; // Reset timer
    State.nextSpawnDelay = 0; // First spawn is immediate
    State.groupCooldownTimer = 0;

    // Determine Wave Type
    // Cycle through defined enemies
    if (typeof ENEMIES !== 'undefined' && ENEMIES.length > 0) {
        const idx = (State.wave - 1) % ENEMIES.length;
        State.waveType = ENEMIES[idx].id;
    } else {
        State.waveType = (State.wave % 2 !== 0) ? 'green' : 'orange'; // Fallback
    }
}

function spawnNextEnemy() {
    if (!State.roundActive) return;
    if (State.enemiesSpawnedThisRound >= State.totalEnemiesToSpawn) return;

    // Pick random start
    const start = StartCells[Math.floor(Math.random() * StartCells.length)];
    const enemy = spawnEnemy(start); // capture the spawned enemy object

    State.enemiesSpawnedThisRound++;

    // Calculate delay for NEXT spawn based on THIS enemy's speed
    // Use constant gap
    const delay = (typeof CONSTS !== 'undefined' && CONSTS.SHIP_SPAWN_GAP_MS !== undefined) ? CONSTS.SHIP_SPAWN_GAP_MS : 1000;

    State.nextSpawnDelay = delay;
    State.spawnTimer = 0;
}

function spawnEnemy(startPos) {
    if (!startPos) return;

    const col = startPos.c;
    const row = startPos.r;

    const spawnX = (col * TILE_SIZE) + (TILE_SIZE / 2);
    const spawnY = (row * TILE_SIZE) + (TILE_SIZE / 2);

    // Type determined by round
    const type = State.waveType || 'green';

    // Stats based on type
    // Stats based on type (Data-Driven)
    let speed = 100;
    let hp = 100;
    let color = '#ffffff';

    let def = null;
    if (typeof ENEMIES !== 'undefined') {
        // Find static definition for Color, Name, etc.
        def = ENEMIES.find(e => e.id === type) || ENEMIES[0];
        color = def.color;

        // Fetch dynamic stats from GameConfig (UI bound)
        // Properties are stored as "greenHP", "greenSpeed" etc.
        hp = GameConfig[type + 'HP'] !== undefined ? GameConfig[type + 'HP'] : def.hp;
        speed = GameConfig[type + 'Speed'] !== undefined ? GameConfig[type + 'Speed'] : def.speed;
        value = GameConfig[type + 'Value'] !== undefined ? GameConfig[type + 'Value'] : (def.value || 10);

    } else {
        // Legacy Fallback
        speed = (type === 'green') ? GameConfig.greenSpeed : GameConfig.orangeSpeed;
        hp = (type === 'green') ? GameConfig.greenHP : GameConfig.orangeHP;
        value = 10;
        color = (type === 'green') ? '#00ff66' : '#ffaa00';
    }

    // Difficulty Scaling
    const numEnemyTypes = (typeof ENEMIES !== 'undefined' ? ENEMIES.length : 2);
    const setsCompleted = Math.floor((State.wave - 1) / numEnemyTypes);
    const difficultyFactor = (typeof CONSTS !== 'undefined' && CONSTS.DIFFICULTY_INCREASE_FACTOR) ? CONSTS.DIFFICULTY_INCREASE_FACTOR : 1.1;
    const valueFactor = (typeof CONSTS !== 'undefined' && CONSTS.VALUE_INCREASE_FACTOR) ? CONSTS.VALUE_INCREASE_FACTOR : 1.1;

    const scalingFactor = Math.pow(difficultyFactor, setsCompleted);
    const valueScalingFactor = Math.pow(valueFactor, setsCompleted);

    hp = hp * scalingFactor;
    value = Math.floor(value * valueScalingFactor);

    // Determine Direction (Primitive: assumes edge entry)
    let vx = 0, vy = 0;
    if (row === 0) vy = speed; // Top -> Down
    else if (row === ROWS - 1) vy = -speed; // Bottom -> Up
    else if (col === 0) vx = speed; // Left -> Right
    else if (col === COLS - 1) vx = -speed; // Right -> Left
    else vy = speed; // Default

    const e = {
        id: enemyIdCounter++,
        type: type,
        x: spawnX,
        y: spawnY,
        entryCol: col,
        entryRow: row,
        hp: hp,
        maxHp: hp,
        value: value,
        speed: speed, // Base speed
        vx: vx,
        vy: vy,
        frozen: 0,
        slowFactor: 1,
        color: color,
        shape: def ? def.shape : 'triangle',
        draw_scale: def ? (def.draw_scale || 1.0) : 1.0,
        resistance: def ? (def.resistance || {laser:1, projectile:1, pulse:1}) : {laser:1, projectile:1, pulse:1}
    };
    State.enemies.push(e);
    return e;
}

function spawnDebris(x, y, color, count, speedMulti=1, lifeMulti=1) {
    for(let i=0; i<count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (20 + Math.random() * 60) * speedMulti; // Pixels per second
        State.particles.push({
            type: 'debris',
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            maxLife: GameConfig.particleLife * lifeMulti,
            color: color
        });
    }
}

function spawnProjectile(x, y, target, damage, speed, color, damageType) {
    State.projectiles.push({
        x, y, target, damage, speed, color,
        damage_type: damageType || TOWER_DAMAGE_TYPES.EXPLOSIVE, // Default if missing
        active: true
    });
}

// --- Game Logic Loop ---
function update(dt) {
    const dtSec = dt / 1000;
    const now = Date.now();

    // Reset loop (e.g. particles) if Game Over
    if (State.gameOver) {
        // Only update particles
        for (let i = State.particles.length - 1; i >= 0; i--) {
            const p = State.particles[i];
            if(p.type === 'pulse' || p.type === 'beam') {
                p.life += dt;
                if(p.life >= p.duration) State.particles.splice(i, 1);
                else if(p.type === 'pulse') p.r = (p.life / p.duration) * p.maxR;
            } else if (p.type === 'debris') {
                p.life += dt;
                if (p.life >= p.maxLife) {
                    State.particles.splice(i, 1);
                } else {
                    p.x += p.vx * dtSec;
                    p.y += p.vy * dtSec;
                }
            } else {
                p.life--;
                if(p.life <= 0) State.particles.splice(i, 1);
            }
        }
        return; // Skip rest of update
    }

    // Decrement flash life
    if (State.flashLife > 0) {
        State.flashLife -= dt;
    }

    // Stream Spawning Logic
    if (State.roundActive) {
        if (State.spawningState === 'spawning') {
            // Spawn Ships
            if (State.enemiesSpawnedThisRound < State.totalEnemiesToSpawn) {
                State.spawnTimer += dt;
                if (State.spawnTimer >= State.nextSpawnDelay) {
                    spawnNextEnemy();
                }
            } else {
                // Group Finished -> Cooldown
                State.spawningState = 'cooldown';
                State.groupCooldownTimer = 0;
            }
        } else if (State.spawningState === 'cooldown') {
            // Wait between groups
            State.groupCooldownTimer += dt;
            const groupGap = (typeof CONSTS !== 'undefined' && CONSTS.GROUP_SPAWN_GAP_MS !== undefined) ? CONSTS.GROUP_SPAWN_GAP_MS : 3000;
            if (State.groupCooldownTimer >= groupGap) { // Configurable Pause
                // Next Group
                State.wave++; // Increase internal difficulty counter

                // Reset for next group
                State.spawningState = 'spawning';
                State.enemiesSpawnedThisRound = 0;
                State.spawnTimer = 0;
                State.nextSpawnDelay = 0;

                // Rotate Enemy Type
                if (typeof ENEMIES !== 'undefined' && ENEMIES.length > 0) {
                    const idx = (State.wave - 1) % ENEMIES.length;
                    State.waveType = ENEMIES[idx].id;
                }

                // Update UI (optional, if we want to show difficulty tier somewhere, but we removed Wave display)
                // We keep Wave display ID but call it Score? No, we renamed it.
                // Maybe just updateStats to refresh disabled buttons if needed.
                updateStats();
            }
        }
    }

    // Enemies
    for (let i = State.enemies.length - 1; i >= 0; i--) {
        const e = State.enemies[i];

        let currentSpeed = e.speed;
        if (e.frozen > 0) {
            currentSpeed *= e.slowFactor;
            e.frozen -= dt;
        }

        // Fix: Update velocity vector magnitude immediately to reflect speed changes
        // This ensures ships slow down instantly, not just at the next corner.
        if (currentSpeed > 0) {
             if (e.vx !== 0) e.vx = Math.sign(e.vx) * currentSpeed;
             if (e.vy !== 0) e.vy = Math.sign(e.vy) * currentSpeed;
        }

        // Calculate move distance for this frame
        let moveDist = currentSpeed * dtSec;

        // Current Tile Center
        const currTileX = Math.floor(e.x / TILE_SIZE);
        const currTileY = Math.floor(e.y / TILE_SIZE);
        const centerX = currTileX * TILE_SIZE + TILE_SIZE / 2;
        const centerY = currTileY * TILE_SIZE + TILE_SIZE / 2;

        // Axis Alignment / Drift Fix
        // Force the non-moving axis to snap exactly to center to prevent diagonal drift
        if (Math.abs(e.vx) > Math.abs(e.vy)) { // Moving Horizontally
            e.y = centerY;
        } else if (Math.abs(e.vy) > Math.abs(e.vx)) { // Moving Vertically
            e.x = centerX;
        }

        // Vector to Center
        const dx = centerX - e.x;
        const dy = centerY - e.y;
        const distToCenter = Math.hypot(dx, dy);

        // Check if we are moving towards the center (dot product > 0)
        // If we are moving AWAY from center, we don't snap/turn (we just left it)
        let movingTowards = (dx * e.vx + dy * e.vy) > 0;

        // floating point fix: sticky turns
        // If we are very close to center but "moving away", check if we missed a required turn.
        // This happens if we overshoot the center by a tiny fraction of a pixel in one frame.
        if (!movingTowards && distToCenter < 2.0) {
             if (currTileY >= 0 && currTileY < ROWS && currTileX >= 0 && currTileX < COLS) {
                 const type = Grid[currTileY][currTileX];
                 // 3:N, 4:E, 5:S, 6:W
                 // If the map says TURN, but our current velocity doesn't match that direction,
                 // we must have missed the turn. Force snap.
                 if (type === 3 && e.vy >= -0.1) movingTowards = true;      // Supposed to go N (-y), but not doing so
                 else if (type === 4 && e.vx <= 0.1) movingTowards = true;  // Supposed to go E (+x), but not doing so
                 else if (type === 5 && e.vy <= 0.1) movingTowards = true;  // Supposed to go S (+y), but not doing so
                 else if (type === 6 && e.vx >= -0.1) movingTowards = true; // Supposed to go W (-x), but not doing so
             }
        }

        // We only turn if we are approaching the center and close enough to reach it this frame
        if (movingTowards && moveDist >= distToCenter) {
            // 1. Move to Center
            e.x = centerX;
            e.y = centerY;
            moveDist -= distToCenter; // Remaining movement

            // 2. Check Map Direction
            if (currTileY >= 0 && currTileY < ROWS && currTileX >= 0 && currTileX < COLS) {
                 const type = Grid[currTileY][currTileX];
                 // 3:N, 4:E, 5:S, 6:W
                 if (type === 3) { // N
                     e.vx = 0; e.vy = -currentSpeed;
                 } else if (type === 4) { // E
                     e.vx = currentSpeed; e.vy = 0;
                 } else if (type === 5) { // S
                     e.vx = 0; e.vy = currentSpeed;
                 } else if (type === 6) { // W
                     e.vx = -currentSpeed; e.vy = 0;
                 }
                 // If type is 1 (Space/S/E), keep going (maintain current vx, vy)
                 // Re-apply magnitude in case speed changed due to frozen/unfrozen between frames
                 else {
                     // Ensure velocity matches currentSpeed
                     if (e.vx !== 0) e.vx = Math.sign(e.vx) * currentSpeed;
                     if (e.vy !== 0) e.vy = Math.sign(e.vy) * currentSpeed;
                 }
            }
        }

        // Apply remaining move or full move
        e.x += (e.vx / currentSpeed) * moveDist;
        e.y += (e.vy / currentSpeed) * moveDist;

        // Out of bounds cleanup
        // Trigger exit immediately when the center of the ship leaves the canvas area
        // Use Logical Dimensions (COLS*TILE_SIZE) not canvas width (which is scaled)
        if (e.x < 0 || e.x > (COLS * TILE_SIZE) || e.y < 0 || e.y > (ROWS * TILE_SIZE)) {
             // For now, assume any exit reduces lives
             State.lives--;
             State.flashLife = CONSTS.EXIT_FLASH_DURATION; // Trigger Flash
             if (typeof CONSTS !== 'undefined' && CONSTS.EXIT_ALARM_SOUND) {
                 playSound(CONSTS.EXIT_ALARM_SOUND, CONSTS.EXIT_ALARM_VOLUME || 1.0);
             }
             updateStats();

             State.enemies.splice(i, 1);

             if (State.lives < 0 && !State.gameOver) {
                 triggerGameOver();
             }
        } else if (e.hp <= 0) {
            const val = (e.value || 10);
            State.money += val;
            State.score += val;
            updateStats();

            if (typeof ENEMIES !== 'undefined') {
                 const def = ENEMIES.find(def => def.id === e.type);
                 if (def && def.explode_sound) {
                     playSound(def.explode_sound, def.explode_sound_volume || 1.0);
                 }
            }

            State.enemies.splice(i, 1);
            spawnDebris(e.x, e.y, e.color, 20); // Use enemy color for death
        }
    }

    // Towers
    // Towers
    State.towers.forEach(t => {
        // Ensure def exists (for legacy/live reload safety)
        if (!t.def) t.def = TOWERS[t.type];
        const def = t.def;

        // Dynamic Stats (from UI or Default)
        // Access keys dynamically: 'greenRange', 'redDelay', etc.
        const range = GameConfig[t.type + 'Range'] !== undefined ? GameConfig[t.type + 'Range'] : def.range;
        const cooldown = GameConfig[t.type + 'Delay'] !== undefined ? GameConfig[t.type + 'Delay'] : def.cooldown;
        const damage = GameConfig[t.type + 'Damage'] !== undefined ? GameConfig[t.type + 'Damage'] : def.damage;

        // Target Selection
        let target = null;
        // Check for EMP (Pulse) logic or standard
        if (def.type === TOWER_TYPES.EMP) {
            // Pulse logic often triggers if ANY enemy is in range, but targeting logic might pick nearest
            // If stickiness matters for pulse (e.g. tracking one to show range? It doesn't really target).
        } else {

             // Determine Targeting Mode
             const mode = def.targeting_mode || (typeof TARGETING_MODES !== 'undefined' ? TARGETING_MODES.nearest : 'nearest');

             // Check if current target is still valid
             let keepingCurrent = false;
             if (t.currentTarget) {
                 // Must exist, be alive, and be in range
                 const stillExists = State.enemies.includes(t.currentTarget);
                 const alive = t.currentTarget.hp > 0;
                 const inRange = stillExists && (pointDistance(t.x, t.y, t.currentTarget.x, t.currentTarget.y) <= range);

                 if (stillExists && alive && inRange) {
                     keepingCurrent = true;
                 } else {
                     t.currentTarget = null; // Lost target
                 }
             }

             // Selection Logic
             // Sticky modes: fixed, weakest, strongest.
             // If we have a valid current target and mode is sticky, keep it.
             // 'nearest' is NOT sticky (always dynamic).
             const isSticky = (mode !== 'nearest' && mode !== (typeof TARGETING_MODES !== 'undefined' ? TARGETING_MODES.nearest : 'nearest')); // strict check against value string

             if (isSticky && keepingCurrent) {
                 target = t.currentTarget;
             } else {
                 // Find new target based on criteria
                 // Note: 'fixed' basically behaves like sticky nearest (locks onto nearest, then holds)
                 // 'weakest' / 'strongest' find new specific targets if sticky failed or initial search.
                 // Actually, if 'weakest' is sticky, does it switch if a WEAKER one enters?
                 // Plan says: "stay on target until it explodes or goes out of range" -> Implies strict stickiness.

                 if (mode === (typeof TARGETING_MODES !== 'undefined' ? TARGETING_MODES.strongest : 'strongest')) {
                     target = getStrongestEnemy(t.x, t.y, range, State.enemies);
                 } else if (mode === (typeof TARGETING_MODES !== 'undefined' ? TARGETING_MODES.weakest : 'weakest')) {
                     target = getWeakestEnemy(t.x, t.y, range, State.enemies);
                 } else {
                     // Default / Nearest / Fixed (initial acquisition)
                     target = getNearestEnemy(t.x, t.y, range, State.enemies);
                 }

                 // Update current sticky target
                 t.currentTarget = target;
             }
        }

        t.hasTarget = !!target;
        if (target) {
            t.targetPos = {x: target.x, y: target.y};

            // Smooth Rotation
            const targetAngle = Math.atan2(target.y - t.y, target.x - t.x);
            let diff = targetAngle - t.angle;

            // Normalize diff to -PI...PI (Shortest path)
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            // Apply Rotation
            const maxRot = (def.retarget_rotation_rate !== undefined ? def.retarget_rotation_rate : (CONSTS.TOWER_RETARGET_ROTATION_RATE || 5.0)) * dtSec;

            if (Math.abs(diff) <= maxRot) {
                t.angle = targetAngle; // Snap if close
            } else {
                t.angle += Math.sign(diff) * maxRot;
            }

            // Check Lock
            const threshold = CONSTS.FIRING_ANGLE_THRESHOLD !== undefined ? CONSTS.FIRING_ANGLE_THRESHOLD : 0.1;
            t.locked = (Math.abs(diff) < threshold);
        } else {
            t.locked = false; // No target = no lock (or true if we want them to fire blindly, but they need a target to fire anyway)
        }

        // Firing Logic
        if (def.type === TOWER_TYPES.LASER) {
            const shotDur = GameConfig['laserShotDuration'] || def.shot_duration_ms || 2000;
            const pauseDur = GameConfig['laserFiringPause'] || def.firing_pause_ms || 1000;

            // Pulse Cycle
            if (t.isFiring === undefined) { t.isFiring = true; t.fireTimer = 0; } // Safety init

            t.fireTimer += dt;
            if (t.isFiring) {
                 if (t.fireTimer >= shotDur) {
                     t.isFiring = false;
                     t.fireTimer = 0;
                 }
            } else {
                 if (t.fireTimer >= pauseDur) {


                     t.isFiring = true;
                     t.fireTimer = 0;
                 }
            }

            // Laser Sound Control
            // Emit if: Firing in cycle AND locked on target
            const shouldEmit = (t.isFiring && target && t.locked);

            if (shouldEmit) {
                if (!t.isEmitting) {
                     // Start Sound
                     t.soundInstance = playSound(def.fire_sound, def.fire_sound_volume);
                     t.isEmitting = true;
                }
            } else {
                if (t.isEmitting) {
                     // Stop Sound
                     if (t.soundInstance) {
                         t.soundInstance.pause();
                         t.soundInstance.currentTime = 0;
                     }
                     t.isEmitting = false;
                     t.soundInstance = null;
                }
            }

            // Fire only if active cycle AND locked
            if (shouldEmit) {
                // Use defined damage type or default
                const dtype = def.damage_type || TOWER_DAMAGE_TYPES.LASER;
                const rVal = (target.resistance && target.resistance[dtype] !== undefined) ? target.resistance[dtype] : 1.0;

                target.hp -= (damage * rVal) * dtSec;

                // Visuals: Impact Particles
                if (Math.random() < 0.3) {
                     const debrisColor = blendColors(def.color, target.color || '#fff', 0.5);
                     spawnDebris(target.x, target.y, debrisColor, Math.max(1, 1 * CONSTS.IMPACT_PARTICLE_MULTIPLIER));
                }
            }
        }
        else if (def.type === TOWER_TYPES.MISSILE || def.type === TOWER_TYPES.ARTILLERY) {
            if (target && t.locked && now - t.lastShot >= cooldown) {
                t.lastShot = now;
                playSound(def.fire_sound, def.fire_sound_volume);

                // Fire from all outlets
                def.outlets.forEach(outlet => {
                    setTimeout(() => {
                         // Re-check target existence/validity inside timeout?
                         // Simple check: is target still alive?
                         if (target && target.hp > 0) {
                             // Calc spawn pos relative to tower
                             // If rotated (artillary), need to rotate outlet pos too?
                             // For now, simple offset (or implement rotation math if needed)
                             // Given Artillary has 0,0 outlet, rotation doesn't matter for origin.
                             // Red tower has offset, but doesn't rotate.
                             // So we can stick to simple logic for now.

                             const sx = t.x + outlet.x;
                             const sy = t.y + outlet.y;
                             spawnProjectile(sx, sy, target, damage, def.projectile.speed, def.projectile.color, def.damage_type);
                         }
                    }, outlet.delay);
                });
            }
        }
        else if (def.type === TOWER_TYPES.EMP) {
             if (now - t.lastShot >= cooldown && (!target || t.locked)) { // Allow pulse if no target req (but here logic implies targeting)? Pulse usually fires if *any* enemy in range.
                 // Actually, standard Pulse behavior in this codebase finds 'target' = nearest enemy.
                 // If we enforce locking, Pulse must face nearest enemy to fire.
                 // Let's enforce it for consistency per user request "prevent a tower from firing while it is rotating"
                 if (target && !t.locked) return; // Skip if tracking but not locked

                 t.lastShot = now;
                 playSound(def.fire_sound, def.fire_sound_volume);

                // Visual Pulse
                State.particles.push({
                    type: 'pulse', x: t.x, y: t.y, r: 0, maxR: range, life: 0, duration: 500, color: def.color
                });

                // Apply Effect to ALL in range
                if (def.effect && def.effect.type === 'slow') {
                    State.enemies.forEach(e => {
                        if (pointDistance(t.x, t.y, e.x, e.y) <= range) {
                            e.frozen = def.effect.duration; // 'frozen' is actually slow duration
                            e.slowFactor = def.effect.factor;

                            const dtype = def.damage_type || TOWER_DAMAGE_TYPES.ELECTROMAGNETIC; // Pulse default
                            const rVal = (e.resistance && e.resistance[dtype] !== undefined) ? e.resistance[dtype] : 1.0;
                            e.hp -= (damage * rVal);
                        }
                    });
                }
             }
        }
        else if (def.type === TOWER_TYPES.RAILGUN) {
             if (now - t.lastShot >= cooldown) {
                // Determine direction based on angle
                const cos = Math.cos(t.angle);
                const sin = Math.sin(t.angle);
                let dirIdx = 0; // 0:E, 1:S, 2:W, 3:N
                if (Math.abs(cos) > Math.abs(sin)) {
                    dirIdx = cos > 0 ? 0 : 2;
                } else {
                    dirIdx = sin > 0 ? 1 : 3;
                }

                // Hit Scan Check
                const beamWidth = 20;
                let targets = [];
                let triggerFound = false;

                State.enemies.forEach(e => {
                    let hit = false;
                    const dx = e.x - t.x;
                    const dy = e.y - t.y;
                    let dist = Infinity;

                    if (dirIdx === 0) { // East
                         if (dx > 0 && Math.abs(dy) < beamWidth) { hit = true; dist = dx; }
                    } else if (dirIdx === 2) { // West
                         if (dx < 0 && Math.abs(dy) < beamWidth) { hit = true; dist = -dx; }
                    } else if (dirIdx === 3) { // North
                         if (dy < 0 && Math.abs(dx) < beamWidth) { hit = true; dist = -dy; }
                    } else if (dirIdx === 1) { // South
                         if (dy > 0 && Math.abs(dx) < beamWidth) { hit = true; dist = dy; }
                    }

                    if (hit) {
                        targets.push(e);
                        // Check trigger condition (Linear Distance)
                        if (dist <= range) {
                            triggerFound = true;
                        }
                    }
                });

                if (triggerFound && targets.length > 0) {
                     // Fire
                     t.lastShot = now;
                     playSound(def.fire_sound, def.fire_sound_volume);

                     // Beam End Point
                     let endX = t.x, endY = t.y;
                     if (dirIdx === 0) endX = COLS * TILE_SIZE;
                     if (dirIdx === 2) endX = 0;
                     if (dirIdx === 3) endY = 0;
                     if (dirIdx === 1) endY = ROWS * TILE_SIZE;

                     State.particles.push({
                         type: 'beam',
                         x: t.x, y: t.y,
                         ex: endX, ey: endY,
                         life: 0,
                         duration: 1000,
                         color: def.color
                     });

                     // Damage
                     targets.forEach(e => {
                         const dtype = def.damage_type || TOWER_DAMAGE_TYPES.HIGH_ENERGY;
                         const rVal = (e.resistance && e.resistance[dtype] !== undefined) ? e.resistance[dtype] : 1.0;
                         e.hp -= (damage * rVal);
                         const debrisColor = blendColors(def.color, e.color || '#fff', 0.5);
                         spawnDebris(e.x, e.y, debrisColor, 5);
                     });
                }
             }
        }
    });

    // Projectiles
    for (let i = State.projectiles.length - 1; i >= 0; i--) {
        const p = State.projectiles[i];
        // Check target validity
        const targetValid = p.target && p.target.hp > 0 && State.enemies.includes(p.target);

        if (!targetValid) {
            // Target lost: Continue in last known direction (dumb fire)
            if (p.vx && p.vy) {
                p.x += p.vx;
                p.y += p.vy;

                // Remove if off screen
                if (p.x < 0 || p.x > (COLS * TILE_SIZE) || p.y < 0 || p.y > (ROWS * TILE_SIZE)) {
                    State.projectiles.splice(i, 1);
                }
            } else {
                // Never started moving? Kill it.
                spawnDebris(p.x, p.y, '#aaa', 5);
                State.projectiles.splice(i, 1);
            }
            continue;
        }

        // Target Homing Logic
        const dx = p.target.x - p.x;
        const dy = p.target.y - p.y;
        const dist = Math.hypot(dx, dy);
        const move = p.speed * 60 * dtSec;

        if (dist <= move) {
            // Impact
            // Projectile itself holds damage but not its type? We need to pass type or lookup tower def?
            // Actually, we spawnProjectiles from a tower definition.
            // But we don't store the damage type on the projectile object currently.
            // CONSTS doesn't seem to define projectile 'types' separately.
            // But in spawnProjectile (function we didn't view yet), we might need to pass it.
            // Or here, we need to know the source tower type? The projectile has no ref to source.
            // WAIT. We need to check if we can add damageType to projectile when spawned.

            // Assuming we patch spawnProjectile or can check p.damage_type if we added it.
            // existing spawnProjectile takes (x,y,target,damage,speed,color).
            // We should add damageType to it.

            // For now, let's look at where spawnProjectile is called (lines 1583) from tower.
            // We can add it there or assume 'explosive' default for now if missing?
            // Most projectiles are explosive. Artillary and Red are explosive.
            // If we add damageType to projectile object, we can read it here.

            // Let's assume we will add it to projectile object.
             const dtype = p.damage_type || TOWER_DAMAGE_TYPES.EXPLOSIVE;
             const rVal = (p.target.resistance && p.target.resistance[dtype] !== undefined) ? p.target.resistance[dtype] : 1.0;

            p.target.hp -= (p.damage * rVal);
            // Mix Red (#ff3333) + Target Color
            const debrisColor = blendColors('#ff3333', p.target.color || '#fff', 0.5);
            spawnDebris(p.target.x, p.target.y, debrisColor, Math.max(1, 5 * CONSTS.IMPACT_PARTICLE_MULTIPLIER));
            State.projectiles.splice(i, 1);
        } else {
            // Move & Update Velocity (for dumb fire persistence)
            const vx = (dx/dist) * move;
            const vy = (dy/dist) * move;

            p.x += vx;
            p.y += vy;
            p.vx = vx;
            p.vy = vy;
            p.angle = Math.atan2(dy, dx);
        }
    }

    // Particles
    for (let i = State.particles.length - 1; i >= 0; i--) {
        const p = State.particles[i];
        if(p.type === 'pulse' || p.type === 'beam') {
            p.life += dt;
            if(p.life >= p.duration) State.particles.splice(i, 1);
            else if(p.type === 'pulse') p.r = (p.life / p.duration) * p.maxR;
        } else if (p.type === 'debris') {
            p.life += dt;
            if (p.life >= p.maxLife) {
                State.particles.splice(i, 1);
            } else {
                p.x += p.vx * dtSec;
                p.y += p.vy * dtSec;
            }
        } else {
            p.life--;
            if(p.life <= 0) State.particles.splice(i, 1);
        }
    }


}

function updateStats() {
    document.getElementById('lives-display').innerText = Math.max(0, State.lives);
    document.getElementById('score-display').innerText = State.score;
    document.getElementById('money-display').innerText = '$' + State.money;

    // Dynamic Tower Buttons
    if (typeof TOWER_TYPES !== 'undefined') {
        Object.values(TOWER_TYPES).forEach(type => {
            const btn = document.querySelector(`.btn-${type}`);
            if (btn) {
                const def = TOWERS[type];

                // Inject Color for CSS
                btn.style.setProperty('--selected-color', def.color);

                if (State.money < def.price) {
                     btn.disabled = true;
                     btn.classList.add('disabled');
                     // If currently selected and we can't afford it, deselect?
                     // Probably annoying if user is just waiting for money.
                     // But strictly speaking they can't place it.
                     // Let's just disable the button. The place logic also checks cost.
                } else {
                     btn.disabled = false;
                     btn.classList.remove('disabled');
                }
            }
        });
    }
}

function triggerGameOver() {
    stopAllSFX(); // Stop active loops (lasers) before explosions start
    State.gameOver = true;
    State.flashLife = 0; // Clear any pending exit flash
    deselectTowerInstance();

    // UI Updates
    // Hide ALL standard panels
    const uiElements = document.querySelectorAll('.stats-bar, .controls-row, .tower-select, .tower-context-panel, .config-panel');
    uiElements.forEach(el => { if(el) el.style.display = 'none'; });

    const panelGameOver = document.getElementById('game-over-panel');
    const finalScoreLbl = document.getElementById('final-score');

    if (panelGameOver) {
        panelGameOver.style.display = 'flex';
        if (finalScoreLbl) finalScoreLbl.innerText = State.score;
    }

    // Explode Towers
    const towersToExplode = [...State.towers];
    towersToExplode.forEach(t => {
        const delay = Math.random() * 1000;
        setTimeout(() => {
            let color = '#fff';
            if (t.def && t.def.color) color = t.def.color;
            else if (TOWERS[t.type]) color = TOWERS[t.type].color;

            if (t.def && t.def.explode_sound) {
                 playSound(t.def.explode_sound, t.def.explode_sound_volume || 1.0);
            }

            spawnDebris(t.x, t.y, color, 150, 5.0, 2.0);
            State.towers = State.towers.filter(activeT => activeT !== t);
        }, delay);
    });

    // Explode Enemies
    const enemiesToExplode = [...State.enemies];
    enemiesToExplode.forEach(e => {
        const delay = Math.random() * 1000;
        setTimeout(() => {
            if (typeof ENEMIES !== 'undefined') {
                 const def = ENEMIES.find(def => def.id === e.type);
                 if (def && def.explode_sound) {
                     playSound(def.explode_sound, def.explode_sound_volume || 1.0);
                 }
            }

            spawnDebris(e.x, e.y, e.color || '#ff8800', 100, 4.0, 1.5);
            State.enemies = State.enemies.filter(activeE => activeE !== e);
        }, delay);
    });

    // Explode Projectiles
    const projectilesToExplode = [...State.projectiles];
    projectilesToExplode.forEach(p => {
        const delay = Math.random() * 500;
        setTimeout(() => {
            spawnDebris(p.x, p.y, p.color || '#ffff00', 30, 2.0, 0.5);
            State.projectiles = State.projectiles.filter(activeP => activeP !== p);
        }, delay);
    });
}

function resetGame() {
    stopAllSFX();
    const panelGameOver = document.getElementById('game-over-panel');
    if (panelGameOver) panelGameOver.style.display = 'none';

    // Restore Standard UI
    const stats = document.querySelector('.stats-bar');
    if(stats) stats.style.display = 'flex';

    const controls = document.querySelector('.controls-row');
    if(controls) controls.style.display = 'flex';

    const towerSelect = document.querySelector('.tower-select');
    if(towerSelect) towerSelect.style.display = 'grid';

    const config = document.querySelector('.config-panel');
    if(config) config.style.display = 'flex';

    // Check if tower context should be hidden (it's hidden by default, and we deselected)
    const towerCtx = document.querySelector('.tower-context-panel');
    if(towerCtx) towerCtx.style.display = 'none';

    // Reload current map to reset logic state
    loadMap(State.mapIndex);
    // Note: loadMap does not stop music, which is desired.
}

// --- Rendering ---
function render() {
    // Clear Screen (Fixes ghosting/trails)
    ctx.clearRect(0, 0, COLS * TILE_SIZE, ROWS * TILE_SIZE);

    // Draw Static scaled (bgCanvas is already scaled, so draw it 1:1 in screen coords)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bgCanvas, 0, 0);
    ctx.restore();

    // Towers
    // Towers
    State.towers.forEach(t => {
        // Ensure def exists
        if (!t.def) t.def = TOWERS[t.type];
        const def = t.def;

        // Selection Highlight
        if (State.selectedTowerInstance === t) {
             ctx.save();
             const color = def.color || '#fff';
             ctx.strokeStyle = color;
             ctx.lineWidth = 2;
             ctx.shadowBlur = 10;
             ctx.shadowColor = color;

             // Draw border around the tile
             const tx = t.c * TILE_SIZE;
             const ty = t.r * TILE_SIZE;
             ctx.strokeRect(tx + 1, ty + 1, TILE_SIZE - 2, TILE_SIZE - 2);

             // Draw Range Circle
             const range = GameConfig[t.type + 'Range'] || def.range;
             if (range) {
                 ctx.beginPath();
                 ctx.globalAlpha = 0.3;
                 ctx.lineWidth = 2;
                 ctx.arc(0, 0, range, 0, Math.PI*2); // We are inside loop but NOT translated yet? NO.
                 // Wait, we are NOT translated yet.
                 // Lines 1895-1908 are BEFORE ctx.translate(t.x, t.y).
                 // So we need to use t.x, t.y or translate.
                 // Actually, ctx.strokeRect uses tx, ty (top-left).
                 // t.x, t.y are centers.

                 ctx.strokeRect(tx + 1, ty + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                 // Redoing range circle in correct coordinates
                 ctx.beginPath();
                 ctx.arc(t.x, t.y, range, 0, Math.PI*2);
                 ctx.stroke();
                 ctx.globalAlpha = 1.0;
             }

             ctx.restore();
        }

        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.lineWidth = 2;

        // Generic Color Selection
        const color = def.color || '#fff';
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        // Global Rotation (Persistent)
        if (t.angle !== undefined) {
             ctx.rotate(t.angle);
        }

        ctx.fillStyle = CONSTS.BG_COLOR; // Fill black to hide grid lines underneath
        drawShape(ctx, def.shape, 10);
        ctx.fill();
        ctx.stroke();

        // Overlay Effects
        if (def.type === TOWER_TYPES.LASER) {
            // Draw Laser
            if (t.hasTarget && t.targetPos && t.locked && t.isFiring) {
                ctx.restore(); ctx.save(); // Global space
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.shadowColor = color;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.moveTo(t.x, t.y);
                ctx.lineTo(t.targetPos.x, t.targetPos.y);
                ctx.stroke();
            }
        }

        ctx.restore();
    });

    // Enemies
    State.enemies.forEach(e => {
        ctx.save();
        ctx.translate(e.x, e.y);

        // Rotate to velocity direction
        const angle = Math.atan2(e.vy, e.vx);
        ctx.rotate(angle);
        if (e.draw_scale) ctx.scale(e.draw_scale, e.draw_scale);

        ctx.beginPath();

        // Triangle pointing right - Wireframe
        const baseColor = e.color || '#00ff66';
        ctx.strokeStyle = e.frozen > 0 ? shadeColor(baseColor, -0.4) : baseColor;

        if (e.frozen > 0) ctx.shadowColor = shadeColor(baseColor, -0.6);
        ctx.shadowBlur = 5;
        ctx.lineWidth = 2;

        // Data-Driven Shape Rendering
        const shapeName = e.shape || 'triangle';
        drawShape(ctx, shapeName, 10);
        ctx.stroke();

        ctx.restore();
    });

    // Projectiles
    State.projectiles.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            const pColor = p.color || '#ff3333';
            ctx.strokeStyle = pColor;
            ctx.lineWidth = 2;
            ctx.shadowColor = pColor;
            ctx.shadowBlur = 5;
            ctx.beginPath();
            ctx.moveTo(-6, 0);
            ctx.lineTo(6, 0);
            ctx.stroke();
            ctx.restore();
    });

    // Particles
    State.particles.forEach(p => {
        if(p.type === 'pulse'){
            ctx.save();
            ctx.translate(p.x, p.y);
            // Use particle specific color if available, else default blue
            const col = p.color || '#33ccff';
            ctx.strokeStyle = col;
            // Manual alpha setting since it's hard to parse hex to rgba here easily without helper,
            // but we can just use globalAlpha
            ctx.globalAlpha = 1 - p.r/p.maxR;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0,0, p.r, 0, Math.PI*2); ctx.stroke();
            ctx.restore();
        } else if (p.type === 'beam') {
            ctx.save();
            let alpha = 1.0;
            if (p.life > 500) alpha = 1.0 - ((p.life - 500) / 500);
            if (alpha < 0) alpha = 0;

            ctx.globalAlpha = alpha;
            ctx.strokeStyle = p.color || '#4b0082';
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 15;
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.ex, p.ey);
            ctx.stroke();

            // Core
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
            ctx.restore();
        } else if (p.type === 'debris') {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.globalAlpha = 1 - (p.life / p.maxLife);
            ctx.fillStyle = p.color; // Use fill for small particles (dots)
            ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
    });

    // Ghost Placement
    if (State.selectedTower) {
            const tx = State.mouse.tileX * TILE_SIZE + TILE_SIZE/2;
            const ty = State.mouse.tileY * TILE_SIZE + TILE_SIZE/2;

            // Fix: Do not check against canvas.width/height directly as they are scaled pixels,
            // whereas tx/ty are logical. We just need to check if mouse is in canvas (to start)
            // and rely on tile coordinate validity.
            if(State.mouse.inCanvas) {
                // Check validity first
                const r = State.mouse.tileY;
                const c = State.mouse.tileX;

                const type = State.selectedTower;
                const def = TOWERS[type];
                if (!def) return; // safety

                // Calculate Validity
                let valid = (r>=0 && r<ROWS && c>=0 && c<COLS && Grid[r][c]===0 && !State.towers.find(t=>t.c===c && t.r===r));

                // Check Funds
                if (valid && State.money < def.price) valid = false;

                let range = GameConfig[type + 'Range'] || def.range;
                if (!range) range = def.range;

                let color = def.color || '#fff';

                // Determine drawing color based on validity

                // Determine drawing color based on validity
                // Determine drawing color based on validity
                let drawColor = valid ? color : CONSTS.UNAVAILABLE_PLACEMENT_COLOR;

                // Highlight Valid Placement Cell (User Request)
                if (valid) {
                    ctx.save();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = color;

                    const cellX = c * TILE_SIZE;
                    const cellY = r * TILE_SIZE;
                    ctx.strokeRect(cellX + 1, cellY + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                    ctx.restore();
                }

                // Draw Radius (Always, using drawColor)
                ctx.beginPath();
                ctx.strokeStyle = drawColor;
                ctx.globalAlpha = 0.3;
                ctx.lineWidth = 2;
                ctx.arc(tx, ty, range, 0, Math.PI*2);
                ctx.stroke();
                ctx.globalAlpha = 1.0;

                // Draw Ghost Tower (Always, using drawColor)
                ctx.save();
                ctx.translate(tx, ty);

                // Opacity: Valid = 1.0 (Not dimmed), Invalid = 0.8
                ctx.globalAlpha = valid ? 1.0 : 0.8;

                ctx.strokeStyle = drawColor;
                ctx.lineWidth = 2;

                if (def.type === TOWER_TYPES.ARTILLERY) {
                     // For ghost, default rotation
                     // (Optional: could rotate to mouse or center, but keep simple)
                }

                if (def.type === TOWER_TYPES.RAILGUN && State.placementAngle !== undefined) {
                     ctx.rotate(State.placementAngle);
                }

                drawShape(ctx, def.shape, 10);
                ctx.stroke();

                ctx.restore();
            }
    }

    // Exit Flash Effect
    if (State.flashLife > 0) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to draw in screen space
        ctx.globalAlpha = Math.max(0, State.flashLife / CONSTS.EXIT_FLASH_DURATION);
        ctx.strokeStyle = CONSTS.EXIT_FLASH_COLOR;
        ctx.lineWidth = 2; // Make it slightly thicker for visibility
        const flashW = COLS * TILE_SIZE * appScale;
        const flashH = ROWS * TILE_SIZE * appScale;
        ctx.strokeRect(1, 1, flashW - 2, flashH - 2);
        ctx.restore();
    }
}

function gameLoop(timestamp) {
    if (!State.lastTime) State.lastTime = timestamp;
    const dt = timestamp - State.lastTime;
    State.lastTime = timestamp;

    if (!State.paused || State.gameOver) {
        // Cap dt to prevent massive jumps
        const safeDt = Math.min(dt, 100);
        update(safeDt);
    }

    render();
    renderTowerButtons();
    requestAnimationFrame(gameLoop);
}

function renderTowerButtons() {
    const types = typeof TOWER_TYPES !== 'undefined' ? Object.values(TOWER_TYPES) : [];
    types.forEach(type => {
        const btnCanvas = document.getElementById(`btn-canvas-${type}`);
        if (!btnCanvas) return;

        const bCtx = btnCanvas.getContext('2d', { alpha: true });
        const rect = btnCanvas.getBoundingClientRect();

        // Clear
        bCtx.clearRect(0, 0, btnCanvas.width, btnCanvas.height);

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let angle = -Math.PI / 2; // Default Up for fixed
        if (type !== TOWER_TYPES.EMP && type !== TOWER_TYPES.RAILGUN) {
            angle = Math.atan2(State.uiMouse.y - centerY, State.uiMouse.x - centerX);
        }

        bCtx.save();
        bCtx.translate(btnCanvas.width/2, btnCanvas.height/2);
        bCtx.rotate(angle);

        // Color
        let color = '#fff';
        if (TOWERS[type]) color = TOWERS[type].color;

        bCtx.strokeStyle = color;
        bCtx.lineWidth = 2;
        bCtx.lineCap = 'round';
        bCtx.lineJoin = 'round';
        bCtx.shadowColor = color;
        bCtx.shadowBlur = 5;

        drawShape(bCtx, TOWERS[type].shape, 12); // Scale 12 fits 40x40
        bCtx.stroke();

        // Add a center dot or detail?
        if (type === TOWER_TYPES.LASER) {
             // specific detail?
        }

        bCtx.restore();
    });
}

function togglePause() {
    if (State.gameOver) return; // Locked
    State.paused = !State.paused;
    if (State.paused) {
        stopAllSFX();
    }
    updatePauseButton();
    if (!State.paused && !State.roundActive && State.enemies.length === 0) {
        if (State.wave === 1 && State.enemiesSpawnedThisRound === 0) {
             startNextRound();
        }
    }
}

function updatePauseButton() {
    const btn = document.getElementById('btn-play-pause');
    if (btn) {
        // Use a fixed-width span for the icon to prevent shifting
        const icon = State.paused ? '&#9658;' : '&#10074;&#10074;';
        btn.innerHTML = `<span style="display:inline-block; width: 24px; text-align:center;">${icon}</span> Game`;

        // Change color: Green for Play (when paused), Orange for Pause (when playing)
        // Original request: "Pause color be orange instead of red".
        // Logic: State.paused is TRUE -> Button shows PLAY Icon -> Green.
        // Logic: State.paused is FALSE -> Button shows PAUSE Icon -> Orange.
        btn.style.color = State.paused ? 'var(--accent-green)' : '#ffaa00';
        btn.style.borderColor = btn.style.color;
    }
}

init();
