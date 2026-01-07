/**
 * Q1 Sum - Main Game Logic
 */

const State = {
    N: 2, // Default is cells per quadrant = 2 (so 4x4 grid)
    gridSize: 4, // 2 * N
    grid: [], // 2D array of integers
    q1MaxValues: [], // 2D array storing the max possible value for each Q1 cell
    history: [],
    history: [],
    historyStack: [], // Renaming or adjusting history usage if needed, but existing is fine
    isWon: false,
    showFireworks: false,
    winTimeout: null,
    currentScore: 0,
    targetScore: 0
};

const UI = {
    grid: document.getElementById('game-grid'),
    currentScore: document.getElementById('current-score'),
    targetScore: document.getElementById('target-score'),
    undoBtn: document.getElementById('btn-undo'),
    newGameBtn: document.getElementById('btn-new-game'),
    sizeButtons: document.querySelectorAll('.size-btn'),
    winnerBanner: document.getElementById('winner-banner'),
    isAnimating: false
};

// --- Core Logic ---

function initGame(n = null) {
    if (n) {
        State.N = n;
        State.gridSize = n * 2;
    }

    // Generate Grid
    State.grid = [];
    for (let r = 0; r < State.gridSize; r++) {
        const row = [];
        for (let c = 0; c < State.gridSize; c++) {
            row.push(Math.floor(Math.random() * 100)); // 0-99
        }
        State.grid.push(row);
    }

    State.history = [];
    State.currentScore = calculateQ1Sum();
    State.targetScore = calculateTheoreticalMax();

    // Reset win state
    State.isWon = false;
    clearTimeout(State.winTimeout);
    UI.winnerBanner.classList.add('hidden');
    UI.winnerBanner.classList.remove('pulsing');
    stopFireworks();

    updateUI();
}

function calculateTheoreticalMax() {
    let sum = 0;
    // Reset max values grid
    State.q1MaxValues = Array(State.N).fill().map(() => Array(State.N).fill(0));

    // For each cell in Q1 (0..N-1, 0..N-1), find the max of its 4 "sisters"
    for (let r = 0; r < State.N; r++) {
        for (let c = 0; c < State.N; c++) {
            const v1 = State.grid[r][c]; // Top-Left
            const v2 = State.grid[r][State.gridSize - 1 - c]; // Top-Right (Same row, flipped col)
            const v3 = State.grid[State.gridSize - 1 - r][c]; // Bottom-Left (Flipped row, same col)
            const v4 = State.grid[State.gridSize - 1 - r][State.gridSize - 1 - c]; // Bottom-Right (Both flipped)

            const max = Math.max(v1, v2, v3, v4);
            sum += max;
            State.q1MaxValues[r][c] = max;
        }
    }
    return sum;
}

function calculateQ1Sum() {
    let sum = 0;
    // Top-left quadrant is rows 0..N-1 and cols 0..N-1
    for (let r = 0; r < State.N; r++) {
        for (let c = 0; c < State.N; c++) {
            sum += State.grid[r][c];
        }
    }
    return sum;
}


function flipRow(rowIndex, recordHistory = true) {
    if (UI.isAnimating) return;
    UI.isAnimating = true;

    animateRowFlip(rowIndex).then(() => {
        // Save state for undo
        if (recordHistory) {
            pushHistory({ type: 'row', index: rowIndex });
        }

        // Reverse the row logic
        State.grid[rowIndex].reverse();

        // Swap DOM elements to match the logical reverse
        // We only swap the cells, not the button at the end
        let start = 0;
        let end = State.gridSize - 1;
        while (start < end) {
            const cellIndexStart = rowIndex * (State.gridSize + 1) + start;
            const cellIndexEnd = rowIndex * (State.gridSize + 1) + end;

            const elStart = UI.grid.children[cellIndexStart];
            const elEnd = UI.grid.children[cellIndexEnd];

            swapDomElements(elStart, elEnd);

            start++;
            end--;
        }

        afterMove();
        UI.isAnimating = false;
    });
}

function flipCol(colIndex, recordHistory = true) {
    if (UI.isAnimating) return;
    UI.isAnimating = true;

    animateColFlip(colIndex).then(() => {
        if (recordHistory) {
            pushHistory({ type: 'col', index: colIndex });
        }

        // Extract column, reverse, put back
        let start = 0;
        let end = State.gridSize - 1;

        while (start < end) {
            // Logical Swap
            const temp = State.grid[start][colIndex];
            State.grid[start][colIndex] = State.grid[end][colIndex];
            State.grid[end][colIndex] = temp;

            // DOM Swap
            const cellIndexStart = start * (State.gridSize + 1) + colIndex;
            const cellIndexEnd = end * (State.gridSize + 1) + colIndex;

            const elStart = UI.grid.children[cellIndexStart];
            const elEnd = UI.grid.children[cellIndexEnd];

            swapDomElements(elStart, elEnd);

            start++;
            end--;
        }

        afterMove();
        UI.isAnimating = false;
    });
}

function swapDomElements(el1, el2) {
    const parent = el1.parentNode;
    const temp = document.createElement('div'); // placeholder
    parent.replaceChild(temp, el1);
    parent.replaceChild(el1, el2);
    parent.replaceChild(el2, temp);
}

function afterMove() {
    State.currentScore = calculateQ1Sum();

    // Check for Win
    if (!State.isWon && State.currentScore === State.targetScore) {
        State.isWon = true;
        UI.winnerBanner.classList.remove('hidden');
        UI.winnerBanner.classList.add('pulsing');
        startFireworks();

        // Stop effects after 5 seconds, but keep isWon true (to keep buttons disabled)
        clearTimeout(State.winTimeout);
        State.winTimeout = setTimeout(() => {
            // UI.winnerBanner.classList.add('hidden'); // Keep banner!
            UI.winnerBanner.classList.remove('pulsing'); // Stop pulsing
            stopFireworks();
        }, 5000);
    } else if (State.currentScore !== State.targetScore) {
        // If they undo out of a win or mess it up (though hard to mess up once won without undo)
        // Actually, if they undo a win, isWon needs to reset.
    }

    updateUI();
}

function pushHistory(move) {
    // We now just push the move descriptor.
    // The state is deterministic, so undoing just means playing the move again.
    // (Flipping a row twice returns to original state)
    State.history.push(move);
}

function undo() {
    if (State.history.length === 0 || UI.isAnimating) return;

    const lastMove = State.history.pop();

    // Reset win state if we undo
    State.isWon = false;
    clearTimeout(State.winTimeout);
    UI.winnerBanner.classList.add('hidden');
    UI.winnerBanner.classList.remove('pulsing'); // Remove .pulsing on undo
    stopFireworks();

    if (lastMove.type === 'row') {
        flipRow(lastMove.index, false);
    } else if (lastMove.type === 'col') {
        flipCol(lastMove.index, false);
    }

    // UI update happens inside flipRow/flipCol -> afterMove
    // But we might need to force update undo button state immediately?
    // flipRow calls afterMove which calls updateUI. So we are good.
}

// --- Rendering ---

function updateUI() {
    UI.currentScore.textContent = State.currentScore;
    UI.targetScore.textContent = State.targetScore;
    UI.undoBtn.disabled = State.history.length === 0 || State.isWon;

    renderGrid();
}


function renderGrid() {
    // Check if we need to rebuild the grid (size change or first render)
    // We count children. The grid has gridSize^2 cells + gridSize row buttons + gridSize col buttons
    const totalCells = State.gridSize * State.gridSize;
    const totalButtons = State.gridSize * 2;
    // Simple check: if different number of children, full rebuild
    // Children = cells + buttons
    const expectedChildren = totalCells + totalButtons;

    if (UI.grid.children.length !== expectedChildren) {
        UI.grid.innerHTML = '';
        UI.grid.style.gridTemplateColumns = `repeat(${State.gridSize}, 60px) auto`;

        // 1. Create matrix of cells
        for (let r = 0; r < State.gridSize; r++) {
            for (let c = 0; c < State.gridSize; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.id = `cell-${r}-${c}`;
                UI.grid.appendChild(cell);
            }
            // Row Button
            const btn = document.createElement('button');
            btn.className = 'flip-btn row-flip';
            btn.innerHTML = '⇄';
            btn.onclick = () => flipRow(r, true);
            btn.disabled = State.isWon; // Initial create
            UI.grid.appendChild(btn);
        }

        // 2. Last row: Column Flip Buttons
        for (let c = 0; c < State.gridSize; c++) {
            const btn = document.createElement('button');
            btn.className = 'flip-btn col-flip';
            btn.innerHTML = '⇅';
            btn.onclick = () => flipCol(c, true);
            btn.disabled = State.isWon; // Initial create
            UI.grid.appendChild(btn);
        }
    }

    // Update button disabled state (for existing buttons)
    const flipButtons = UI.grid.querySelectorAll('.flip-btn');
    flipButtons.forEach(btn => btn.disabled = State.isWon);

    // Now update values and classes (Full refresh of content and cleanliness)
    for (let r = 0; r < State.gridSize; r++) {
        for (let c = 0; c < State.gridSize; c++) {
            // Child index calculation:
            // Row structure: N cells + 1 btn.
            // Index = r * (size + 1) + c
            const cellIndex = r * (State.gridSize + 1) + c;
            const cell = UI.grid.children[cellIndex];

            // Clean up potentially leftover styles from animation
            cell.classList.remove('moving');
            cell.style.transform = '';
            cell.style.zIndex = '';

            cell.textContent = State.grid[r][c];

            // Check for correct value in Q1
            cell.classList.remove('correct-value');
            if (r < State.N && c < State.N) {
                if (State.grid[r][c] === State.q1MaxValues[r][c]) {
                    cell.classList.add('correct-value');
                }
            }
        }
    }
}

function animateRowFlip(rowIndex) {
    return new Promise(resolve => {
        // Calculate constants
        const cellSize = 60;
        const gap = 4;
        const totalSize = cellSize + gap;

        const updates = [];

        // Iterate through ALL columns in the row
        for (let c = 0; c < State.gridSize; c++) {
            const cell = UI.grid.children[rowIndex * (State.gridSize + 1) + c];

            // Calculate target position (mirror)
            const targetC = (State.gridSize - 1) - c;

            // Distance to move: (target - current) * size
            const dist = (targetC - c) * totalSize;

            // Z-Order: Leftmost (low index) is highest
            const zIndex = 100 - c;

            // Remove highlight before animation
            cell.classList.remove('correct-value');

            updates.push({
                el: cell,
                x: dist,
                z: zIndex
            });
        }

        // Apply Styles
        requestAnimationFrame(() => {
            updates.forEach(u => {
                u.el.classList.add('moving');
                u.el.style.zIndex = u.z;
                u.el.style.transform = `translateX(${u.x}px)`;
            });
        });

        // Wait for CSS transition (0.4s)
        setTimeout(resolve, 400);
    });
}

function animateColFlip(colIndex) {
    return new Promise(resolve => {
        const cellSize = 60;
        const gap = 4;
        const totalSize = cellSize + gap;

        const updates = [];

        // Iterate through all rows for this column
        for (let r = 0; r < State.gridSize; r++) {
            const cell = UI.grid.children[r * (State.gridSize + 1) + colIndex];

            // Calculate target position (mirror)
            const targetR = (State.gridSize - 1) - r;

            // Distance to move
            const dist = (targetR - r) * totalSize;

            // Z-Order: Topmost (low index) is highest
            const zIndex = 100 - r;

            // Remove highlight before animation
            cell.classList.remove('correct-value');

            updates.push({
                el: cell,
                y: dist,
                z: zIndex
            });
        }

        requestAnimationFrame(() => {
            updates.forEach(u => {
                u.el.classList.add('moving');
                u.el.style.zIndex = u.z;
                u.el.style.transform = `translateY(${u.y}px)`;
            });
        });

        setTimeout(resolve, 400);
    });
}


// --- Event Listeners ---

UI.newGameBtn.addEventListener('click', () => {
    initGame(); // Keep current N
});

UI.undoBtn.addEventListener('click', undo);

UI.sizeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Remove active class
        UI.sizeButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        const size = parseInt(e.target.dataset.size);
        const n = size / 2;
        State.N = n; // Ensure state is updated so initGame uses new N even without arg if we wanted
        initGame(n);
    });
});

// --- Fireworks ---

const canvas = document.getElementById('fireworks');
const ctx = canvas.getContext('2d');
let particles = [];
let animationId = null;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        // Random velocity
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 6 + 2;
        this.vx = Math.cos(angle) * velocity;
        this.vy = Math.sin(angle) * velocity;
        this.alpha = 1;
        this.decay = Math.random() * 0.015 + 0.005;
        this.gravity = 0.05;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.alpha -= this.decay;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function createFirework() {
    const x = Math.random() * canvas.width;
    const y = Math.random() * (canvas.height / 2); // Top half
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#ffffff'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    for (let i = 0; i < 50; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear but keep trail? No, clear fully for now

    // Randomly spawn
    if (Math.random() < 0.05) {
        createFirework();
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw();
        if (p.alpha <= 0) {
            particles.splice(i, 1);
        }
    }

    if (State.showFireworks) {
        animationId = requestAnimationFrame(loop);
    }
}

function startFireworks() {
    if (State.showFireworks) return;
    State.showFireworks = true;
    particles = [];

    // Immediate burst!
    for(let i=0; i<5; i++) createFirework();

    loop();
}

function stopFireworks() {
    State.showFireworks = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = [];
}


// Start
initGame(2); // Start with 4x4 (N=2)
