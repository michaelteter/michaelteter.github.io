// --- Constants & Config ---
const TILE_SIZE = 40;
let ROWS = 10;
let COLS = 20;

// Mutable configuration object (bound to UI)
const GameConfig = {
    // Green Tower
    greenDamage: (typeof Towers !== 'undefined' ? Towers.greenDamage : 80),
    greenRange: (typeof Towers !== 'undefined' ? Towers.greenRange : 150),
    greenDelay: (typeof Towers !== 'undefined' ? Towers.greenDelay : 0),

    // Red Tower
    redDamage: (typeof Towers !== 'undefined' ? Towers.redDamage : 50),
    redRange: (typeof Towers !== 'undefined' ? Towers.redRange : 250),
    redSpeed: (typeof Towers !== 'undefined' ? Towers.redSpeed : 6),
    redDelay: (typeof Towers !== 'undefined' ? Towers.redDelay : 1500),

    // Blue Tower
    blueDamage: (typeof Towers !== 'undefined' ? Towers.blueDamage : 10),
    blueRadius: (typeof Towers !== 'undefined' ? Towers.blueRadius : 100),
    blueDelay: (typeof Towers !== 'undefined' ? Towers.blueDelay : 2000),
    blueSlowFactor: (typeof Towers !== 'undefined' ? Towers.blueSlowFactor : 0.5),
    blueDuration: (typeof Towers !== 'undefined' ? Towers.blueDuration : 1000),

    // Enemies (Load from enemies.js if available, else default)
    greenHP: (typeof Enemies !== 'undefined' ? Enemies.greenHP : 100),
    greenSpeed: (typeof Enemies !== 'undefined' ? Enemies.greenSpeed : 100),

    orangeHP: (typeof Enemies !== 'undefined' ? Enemies.orangeHP : 60),
    orangeSpeed: (typeof Enemies !== 'undefined' ? Enemies.orangeSpeed : 140),

    // Misc
    particleLife: 500
};

// UI Grouping Configuration
const LayoutGroups = [
    {
        title: "Towers",
        type: "columns",
        columns: [
            { title: "Green", keys: ['greenDamage', 'greenRange', 'greenDelay'] },
            { title: "Red", keys: ['redDamage', 'redRange', 'redDelay'] },
            { title: "Blue", keys: ['blueDamage', 'blueRadius', 'blueDelay', 'blueSlowFactor', 'blueDuration'] }
        ]
    },
    {
        title: "Ships",
        type: "columns",
        columns: [
            { title: "Green", keys: ['greenHP', 'greenSpeed'] },
            { title: "Orange", keys: ['orangeHP', 'orangeSpeed'] }
        ]
    },
    {
        title: "Misc",
        type: "simple",
        keys: ['particleLife']
    }
];

// --- State Management ---
const State = {
    money: 1000,
    lives: 20,
    wave: 1,
    selectedTower: null,
    towers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    lastTime: 0,
    mouse: { x: 0, y: 0, tileX: 0, tileY: 0 },
    mapIndex: 0,
    roundActive: false,
    enemiesSpawnedThisRound: 0,
    totalEnemiesToSpawn: 0,
    gameId: 0 // To invalidate pending spawns on reset
};

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
    State.money = 1000;
    State.lives = 20;
    State.wave = 1;
    State.roundActive = false;
    State.enemiesSpawnedThisRound = 0;
    State.totalEnemiesToSpawn = 0;
    updateStats();

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
                row.push(1);
                StartCells.push({c, r});
            }
            else if (char === 'E') {
                row.push(1);
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
    const uiPanel = document.getElementById('ui-panel');
    if (uiPanel) uiPanel.style.width = canvas.width + "px";

    const statsBar = document.querySelector('.stats-bar');
    if (statsBar) statsBar.style.width = canvas.width + "px";

    // Update Map Label
    const mapLbl = document.getElementById('map-current');
    if (mapLbl) mapLbl.textContent = (index + 1);

    renderStaticBackground();
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

function shadeColor(color, percent) {
    var f=parseInt(color.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
    return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
}

let enemyIdCounter = 0;

// --- Initialization ---
function init() {
    setupInputs();
    setupEvents();
    loadMap(0); // Load default map
    startNextRound();
    requestAnimationFrame(gameLoop);
}

function setupInputs() {
    const panel = document.getElementById('config-inputs');
    panel.innerHTML = '';

    LayoutGroups.forEach(group => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'config-group';

        const header = document.createElement('h4');
        header.textContent = group.title;
        groupDiv.appendChild(header);

        if (group.type === 'columns') {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'config-row';

            group.columns.forEach(col => {
                const colDiv = document.createElement('div');
                colDiv.className = 'config-col';

                const colTitle = document.createElement('h5');
                colTitle.textContent = col.title;
                colDiv.appendChild(colTitle);

                col.keys.forEach(key => createInput(colDiv, key));
                rowDiv.appendChild(colDiv);
            });
            groupDiv.appendChild(rowDiv);
        } else {
            // Simple list
            group.keys.forEach(key => createInput(groupDiv, key));
        }

        // Inject Map Control into Misc (REMOVED - Moved to static UI)

        panel.appendChild(groupDiv);
    });
}

function createInput(container, key) {
    const div = document.createElement('div');
    div.className = 'config-item';
    // Beautify label
    let label = key.replace(/green|red|blue|orange|Enemy/g, '');
    if(label === 'HP') label = 'HP';
    else label = label.charAt(0).toUpperCase() + label.slice(1);

    if (label === '') label = key;

    div.innerHTML = `
        <label>${label}</label>
        <input type="number" id="cfg-${key}" value="${GameConfig[key]}" step="any">
    `;
    container.appendChild(div);

    const input = div.querySelector('input');
    input.addEventListener('change', (e) => {
        GameConfig[key] = parseFloat(e.target.value);
    });
}

function setupEvents() {
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        State.mouse.x = e.clientX - rect.left;
        State.mouse.y = e.clientY - rect.top;
        State.mouse.tileX = Math.floor(State.mouse.x / TILE_SIZE);
        State.mouse.tileY = Math.floor(State.mouse.y / TILE_SIZE);
    });

    canvas.addEventListener('click', e => {
        if (State.selectedTower) {
            tryPlaceTower();
        }
    });

    // Expose selectTower to window for buttons
    window.selectTower = function(type) {
        State.selectedTower = type;
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
        const btn = document.querySelector(`.btn-${type}`);
        if(btn) btn.classList.add('selected');
    }

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
}

function renderStaticBackground() {
    bgCtx.fillStyle = '#111';
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const x = c * TILE_SIZE;
            const y = r * TILE_SIZE;
            const type = Grid[r][c];
            // Path types: 1, 3(N), 4(E), 5(S), 6(W)
            const isPath = (type === 1 || type >= 3);
            const isBuildable = type === 0;
            const isStructure = type === 2;

            // Wireframe: Only stroke
            bgCtx.strokeStyle = isPath ? '#111' : '#333';
            bgCtx.lineWidth = 1;
            bgCtx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);

            // Structure (X and O)
            if (!isPath) {
                bgCtx.beginPath();
                bgCtx.moveTo(x, y);
                bgCtx.lineTo(x + TILE_SIZE, y + TILE_SIZE);
                bgCtx.moveTo(x + TILE_SIZE, y);
                bgCtx.lineTo(x, y + TILE_SIZE);

                // Distinguish O (Buildable) vs X (Non-Buildable)
                if (isStructure) { // X
                     bgCtx.strokeStyle = '#551111'; // Dark red for blocked
                } else { // O
                     bgCtx.strokeStyle = '#333';
                }
                bgCtx.stroke();

                if (isStructure) {
                    // Double cross for X
                    bgCtx.strokeRect(x+10, y+10, TILE_SIZE-20, TILE_SIZE-20);
                }
            }

            // Draw S and E labels?
            // Draw S and E labels? (Removed per user request)
        }
    }

    // Draw path center lines for debug
    /*
    bgCtx.strokeStyle = '#00ff66';
    bgCtx.lineWidth = 2;
    bgCtx.shadowBlur = 5;
    bgCtx.shadowColor = '#00ff66';
    bgCtx.beginPath();
    // Hardcoded lines removed as they don't match L-shape
    bgCtx.stroke();
    */
}

function tryPlaceTower() {
    const c = State.mouse.tileX;
    const r = State.mouse.tileY;

    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    if (Grid[r][c] !== 0) return; // Must be Buildable Wall (0) [O]
    if (State.towers.find(t => t.c === c && t.r === r)) return;

    const x = c * TILE_SIZE + TILE_SIZE/2;
    const y = r * TILE_SIZE + TILE_SIZE/2;

    State.towers.push({
        type: State.selectedTower,
        c, r, x, y,
        lastShot: 0
    });
}

// --- Wave Logic ---
// --- Wave Logic ---
function startNextRound() {
    if (StartCells.length === 0) return;
    State.roundActive = true;
    State.totalEnemiesToSpawn = 20; // Fixed 20 per round
    State.enemiesSpawnedThisRound = 0;

    // Determine Wave Type
    // Odd waves = Green, Even waves = Orange
    State.waveType = (State.wave % 2 !== 0) ? 'green' : 'orange';

    spawnNextEnemy();
}

function spawnNextEnemy() {
    if (!State.roundActive) return;
    if (State.enemiesSpawnedThisRound >= State.totalEnemiesToSpawn) return;

    // Pick random start
    const start = StartCells[Math.floor(Math.random() * StartCells.length)];
    const enemy = spawnEnemy(start); // capture the spawned enemy object

    State.enemiesSpawnedThisRound++;

    // Calculate delay for NEXT spawn based on THIS enemy's speed
    // Formula: Delay = 80000 / Speed
    // Speed 100 -> 800ms
    // Speed 200 -> 400ms
    const delay = 80000 / enemy.speed;

    const scheduledGameId = State.gameId;
    if (State.enemiesSpawnedThisRound < State.totalEnemiesToSpawn) {
        setTimeout(() => {
            if (State.gameId !== scheduledGameId) return; // Game reset, abort spawn
            spawnNextEnemy();
        }, delay);
    }
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
    const speed = (type === 'green') ? GameConfig.greenSpeed : GameConfig.orangeSpeed;
    const hp = (type === 'green') ? GameConfig.greenHP : GameConfig.orangeHP;
    const color = (type === 'green') ? '#00ff66' : '#ffaa00';

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
        speed: speed, // Base speed
        vx: vx,
        vy: vy,
        frozen: 0,
        slowFactor: 1,
        color: color
    };
    State.enemies.push(e);
    return e;
}

function spawnDebris(x, y, color, count) {
    for(let i=0; i<count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 20 + Math.random() * 60; // Pixels per second
        State.particles.push({
            type: 'debris',
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            maxLife: GameConfig.particleLife,
            color: color
        });
    }
}

function spawnProjectile(x, y, target, damage, speed) {
    State.projectiles.push({
        x, y, target, damage, speed,
        active: true
    });
}

// --- Game Logic Loop ---
function update(dt) {
    const dtSec = dt / 1000;
    const now = Date.now();

    // Enemies
    for (let i = State.enemies.length - 1; i >= 0; i--) {
        const e = State.enemies[i];

        let currentSpeed = e.speed;
        if (e.frozen > 0) {
            currentSpeed *= e.slowFactor;
            e.frozen -= dt;
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
        if (e.x < -50 || e.x > canvas.width + 50 || e.y < -50 || e.y > canvas.height + 50) {
             // Only count leaks if not moving towards Center (spawn)?
             // Actually, if we are OB, we are deleted.
             // If we traveled through the map and exited, e.g. at E.

             // Check if we legitimate exited.
             // Logic: If on 'E', we continue straight. Eventually we hit OB.
             // Do we lose a life?
             // "The exit/end cells will be E." - implying successful traversing.
             // Usually in TD, reaching the end deletes life.

             if (e.x > canvas.width || e.y > canvas.height || e.x < 0 || e.y < 0) {
                 // For now, assume any exit reduces lives
                  State.lives--;
                  updateStats();
             }
             State.enemies.splice(i, 1);
        } else if (e.hp <= 0) {
            State.money += 10;
            updateStats();
            State.enemies.splice(i, 1);
            spawnDebris(e.x, e.y, (e.frozen > 0 ? '#ccffff' : '#00ff66'), 20);
        }
    }

    // Towers
    State.towers.forEach(t => {
        let range = 0;
        if (t.type === 'green') range = GameConfig.greenRange;
        else if (t.type === 'red') range = GameConfig.redRange;
        else if (t.type === 'blue') range = GameConfig.blueRadius;

        const target = getNearestEnemy(t.x, t.y, range, State.enemies);
        t.hasTarget = !!target; // For rendering laser

        if (t.type === 'green' && target) {
                target.hp -= GameConfig.greenDamage * dtSec;
                t.targetPos = {x: target.x, y: target.y}; // Cache for rendering

                // Continuous debris for laser
                if (Math.random() < 0.3) {
                    spawnDebris(target.x, target.y, (target.frozen > 0 ? '#ccffff' : '#00ff66'), 1);
                }
        }
        else if (t.type === 'red') {
            if (target && now - t.lastShot >= GameConfig.redDelay) {
                t.lastShot = now;
                spawnProjectile(t.x - 5, t.y, target, GameConfig.redDamage, GameConfig.redSpeed);
                setTimeout(() => { // Second shot logic
                        if(target.hp > 0) // Very rough check if target still vaguely valid
                            spawnProjectile(t.x + 5, t.y, target, GameConfig.redDamage, GameConfig.redSpeed);
                }, 150);
            }
        }
        else if (t.type === 'blue') {
            if (now - t.lastShot >= GameConfig.blueDelay) {
                t.lastShot = now;
                // Pulse Effect
                State.particles.push({
                    type: 'pulse', x: t.x, y: t.y, r: 0, maxR: range, life: 0, duration: 500
                });
                // Apply Slow & Damage
                State.enemies.forEach(e => {
                    if (pointDistance(t.x, t.y, e.x, e.y) <= range) {
                        e.frozen = GameConfig.blueDuration;
                        e.slowFactor = GameConfig.blueSlowFactor;
                        e.hp -= GameConfig.blueDamage;
                    }
                });
            }
        }
    });

    // Projectiles
    for (let i = State.projectiles.length - 1; i >= 0; i--) {
        const p = State.projectiles[i];
        if (!p.target || (p.target.hp <= 0 && !State.enemies.includes(p.target))) {
            // Target lost, kill missile
            spawnDebris(p.x, p.y, '#aaa', 5);
            State.projectiles.splice(i, 1);
            continue;
        }

        const dx = p.target.x - p.x;
        const dy = p.target.y - p.y;
        const dist = Math.hypot(dx, dy);
        const move = p.speed * 60 * dtSec; // Speed config seems high? RedSpeed 6.
        // If RedSpeed is 6 pixels per frame? Then 6 * 60 = 360 px/sec.

        if (dist <= move) {
            p.target.hp -= p.damage;
            // Debris on impact
            spawnDebris(p.target.x, p.target.y, (p.target.frozen > 0 ? '#ccffff' : '#00ff66'), 5);

            State.projectiles.splice(i, 1);
        } else {
            p.x += (dx/dist) * move;
            p.y += (dy/dist) * move;
            p.angle = Math.atan2(dy, dx);
        }
    }

    // Particles
    for (let i = State.particles.length - 1; i >= 0; i--) {
        const p = State.particles[i];
        if(p.type === 'pulse') {
            p.life += dt;
            if(p.life >= p.duration) State.particles.splice(i, 1);
            else p.r = (p.life / p.duration) * p.maxR;
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

    // Check Round End
    if (State.roundActive) {
        // Wait until enemies spawned? (We spawn simultaneously/instantly in startNextRound)
        // Check if any enemies remain
        // Check if any enemies remain AND we are done spawning
        if (State.enemies.length === 0 && State.enemiesSpawnedThisRound >= State.totalEnemiesToSpawn) {
            // Round Complte
            State.roundActive = false;
            State.wave++;
            setTimeout(startNextRound, 2000); // 2 second pause before next wave
            updateStats();
        }
    }
}

function updateStats() {
    document.getElementById('lives-display').innerText = State.lives;
    document.getElementById('wave-display').innerText = State.wave;
    document.getElementById('money-display').innerText = '$' + State.money;
}

// --- Rendering ---
function render() {
    // Clear Screen (Fixes ghosting/trails)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Static
    ctx.drawImage(bgCanvas, 0, 0);

    // Towers
    State.towers.forEach(t => {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.lineWidth = 2;

        if (t.type === 'green') {
            ctx.strokeStyle = '#00ff66';
            ctx.shadowColor = '#00ff66';
            ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(0,0, 10, 0, Math.PI*2); ctx.stroke();

            // Center dot
            ctx.fillStyle = '#00ff66';
            ctx.beginPath(); ctx.arc(0,0, 2, 0, Math.PI*2); ctx.fill();

            if (t.hasTarget && t.targetPos) {
                ctx.restore(); ctx.save(); // Global space
                ctx.strokeStyle = '#00ff66';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#00ff66';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.moveTo(t.x, t.y);
                ctx.lineTo(t.targetPos.x, t.targetPos.y);
                ctx.stroke();
            }
        } else if (t.type === 'red') {
            ctx.strokeStyle = '#ff3333';
            ctx.shadowColor = '#ff3333';
            ctx.shadowBlur = 10;
            ctx.strokeRect(-8, -8, 16, 16);
        } else if (t.type === 'blue') {
            ctx.strokeStyle = '#33ccff';
            ctx.shadowColor = '#33ccff';
            ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(0,0, 8, 0, Math.PI*2); ctx.stroke();
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

        ctx.beginPath();

        // Triangle pointing right - Wireframe
        const baseColor = e.color || '#00ff66';
        ctx.strokeStyle = e.frozen > 0 ? shadeColor(baseColor, -0.4) : baseColor;

        if (e.frozen > 0) ctx.shadowColor = shadeColor(baseColor, -0.6);
        ctx.shadowBlur = 5;
        ctx.lineWidth = 2;

        if (e.type === 'orange') {
            // Orange line with a small isosceles triangle tail (like a dart)

            // Main Line
            ctx.moveTo(-10, 0);
            ctx.lineTo(10, 0);

            // Tail Triangle
            ctx.moveTo(-10, 0);
            ctx.lineTo(-16, -4);
            ctx.lineTo(-16, 4);
            ctx.lineTo(-10, 0);
        } else {
            // Default Green Triangle pointing right
            ctx.moveTo(15, 0);
            ctx.lineTo(-10, 10);
            ctx.lineTo(-10, -10);
            ctx.closePath();
        }

        ctx.stroke();

        ctx.restore();
    });

    // Projectiles
    State.projectiles.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.strokeStyle = '#ffaa33';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#ffaa33';
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
            ctx.strokeStyle = `rgba(51, 204, 255, ${1 - p.r/p.maxR})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0,0, p.r, 0, Math.PI*2); ctx.stroke();
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

            if(tx > 0 && tx < canvas.width && ty > 0 && ty < canvas.height) {
                let range = (State.selectedTower === 'green') ? GameConfig.greenRange :
                            (State.selectedTower === 'blue') ? GameConfig.blueRadius : GameConfig.redRange;

                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.setLineDash([5,5]);
                ctx.arc(tx, ty, range, 0, Math.PI*2);
                ctx.stroke();
                ctx.setLineDash([]);

                // Valid placement?
                const r = State.mouse.tileY;
                const c = State.mouse.tileX;
                const valid = (r>=0 && r<ROWS && c>=0 && c<COLS && Grid[r][c]===0 && !State.towers.find(t=>t.c===c && t.r===r));

                ctx.strokeStyle = valid ? '#fff' : '#f00';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.5;
                ctx.beginPath(); ctx.arc(tx, ty, 10, 0, Math.PI*2); ctx.stroke();
                ctx.globalAlpha = 1.0;
            }
    }
}

function gameLoop(timestamp) {
    if (!State.lastTime) State.lastTime = timestamp;
    const dt = timestamp - State.lastTime;
    State.lastTime = timestamp;

    // Cap dt to prevent massive jumps
    update(Math.min(dt, 100));
    render();
    requestAnimationFrame(gameLoop);
}

init();
