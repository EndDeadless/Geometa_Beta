const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;

/* ================= CORE STATE ================= */
let gameStarted = false;
let paused = false;
let practiceMode = false;
let attempt = 1;
let animationId;

/* ================= INPUT ================= */
let isHoldingJump = false;

/* ================= PLAYER ================= */
const player = {
    x: 120,
    y: 0,
    size: 50,
    vy: 0,
    jump: -18,
    gravity: 1,
    onGround: false,
    angle: 0,
    allowInput: true
};

/* ================= MAP ================= */
let cameraX = 0;
const mapSpeed = 6;
const groundHeight = 50;

/* ================= MUSIC / UI ================= */
const bgMusic = document.getElementById("bgMusic");
const progressEl = document.getElementById("progress");
const attemptEl = document.getElementById("attempt");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");

/* ================= BACKGROUND ================= */
const bgLayers = [
    { color: "#111", speed: 0.2, x: 0 },
    { color: "#222", speed: 0.5, x: 0 },
    { color: "#333", speed: 1,   x: 0 }
];

/* ================= OBSTACLES ================= */
let obstacles = [];
function generateSpikes() {
    obstacles = [];
    let x = 600;
    for (let i = 0; i < 120; i++) {
        x += 200 + Math.random() * 120;
        obstacles.push({ x });
    }
}

/* ================= PRACTICE ================= */
let checkpoints = [];

/* ================= JUMP LOGIC ================= */
function tryJump() {
    if (!player.allowInput) return;
    if (player.onGround) {
        player.vy = player.jump;
        player.onGround = false;
    }
}

/* ================= INPUT EVENTS ================= */
canvas.addEventListener("mousedown", () => {
    isHoldingJump = true;
    tryJump();
});
canvas.addEventListener("mouseup", () => isHoldingJump = false);

canvas.addEventListener("touchstart", e => {
    e.preventDefault();
    isHoldingJump = true;
    tryJump();
});
canvas.addEventListener("touchend", () => isHoldingJump = false);

window.addEventListener("keydown", e => {
    if (e.code === "Space") {
        e.preventDefault();
        if (!isHoldingJump) {
            isHoldingJump = true;
            tryJump();
        }
    }

    if (practiceMode) {
        if (e.key.toLowerCase() === "c") addCheckpoint();
        if (e.key.toLowerCase() === "x") removeCheckpoint();
    }
});

window.addEventListener("keyup", e => {
    if (e.code === "Space") isHoldingJump = false;
});

/* ================= CHECKPOINT ================= */
function addCheckpoint() {
    checkpoints.push({
        x: cameraX,
        y: player.y,
        vy: player.vy,
        time: bgMusic.currentTime
    });
}

function removeCheckpoint() {
    checkpoints.pop();
}

/* ================= UPDATE ================= */
function updatePlayer() {
    player.vy += player.gravity;
    player.y += player.vy;
    player.angle += player.vy < 0 ? 10 : -6;
    player.angle = Math.max(-90, Math.min(90, player.angle));

    const groundY = H - groundHeight - player.size;

    if (player.y >= groundY) {
        player.y = groundY;
        player.vy = 0;

        if (!player.onGround) {
            player.onGround = true;
            player.angle = 0;

            // ✅ HOLD JUMP (Geometry Dash)
            if (isHoldingJump && player.allowInput) {
                player.vy = player.jump;
                player.onGround = false;
            }
        }
    } else {
        player.onGround = false;
    }
}

function updateCamera() {
    cameraX += mapSpeed;
}

function updateProgress() {
    if (!bgMusic.duration) return;
    const p = Math.min(bgMusic.currentTime / bgMusic.duration * 100, 100);
    progressEl.style.width = p + "%";
    progressEl.textContent = Math.floor(p) + "%";
}

/* ================= COLLISION ================= */
function checkCollision() {
    for (const s of obstacles) {
        const sx = s.x - cameraX;
        if (
            player.x + player.size > sx + 8 &&
            player.x < sx + 42 &&
            player.y + player.size > H - groundHeight - 40
        ) return true;
    }
    return false;
}

/* ================= RESET ================= */
function resetGame(toCheckpoint = false) {
    cancelAnimationFrame(animationId);
    attempt++;
    showAttempt();

    if (practiceMode && toCheckpoint && checkpoints.length) {
        const cp = checkpoints[checkpoints.length - 1];
        cameraX = cp.x;
        player.y = cp.y;
        player.vy = cp.vy;
        bgMusic.currentTime = cp.time;
    } else {
        cameraX = 0;
        player.y = H - groundHeight - player.size;
        player.vy = 0;
        checkpoints = [];
        bgMusic.currentTime = 0;
    }

    bgMusic.play();
    gameLoop();
}

function showAttempt() {
    attemptEl.textContent = `Attempt ${attempt}`;
    attemptEl.style.opacity = 1;
    setTimeout(() => attemptEl.style.opacity = 0, 1000);
}

/* ================= DRAW ================= */
function draw() {
    ctx.clearRect(0, 0, W, H);

    bgLayers.forEach(l => {
        l.x -= l.speed;
        if (l.x <= -W) l.x = 0;
        ctx.fillStyle = l.color;
        ctx.fillRect(l.x, 0, W, H);
        ctx.fillRect(l.x + W, 0, W, H);
    });

    ctx.fillStyle = "#555";
    ctx.fillRect(0, H - groundHeight, W, groundHeight);

    obstacles.forEach(o => {
        const x = o.x - cameraX;
        ctx.fillStyle = "#f00";
        ctx.beginPath();
        ctx.moveTo(x, H - groundHeight);
        ctx.lineTo(x + 25, H - groundHeight - 50);
        ctx.lineTo(x + 50, H - groundHeight);
        ctx.fill();
    });

    // checkpoints
    ctx.fillStyle = "#0f0";
    checkpoints.forEach(cp => {
        const x = cp.x - cameraX + player.size / 2;
        ctx.beginPath();
        ctx.moveTo(x, cp.y);
        ctx.lineTo(x + 10, cp.y + 10);
        ctx.lineTo(x, cp.y + 20);
        ctx.lineTo(x - 10, cp.y + 10);
        ctx.fill();
    });

    ctx.save();
    ctx.translate(player.x + 25, player.y + 25);
    ctx.rotate(player.angle * Math.PI / 180);
    ctx.fillStyle = "#0f0";
    ctx.fillRect(-25, -25, 50, 50);
    ctx.restore();
}

/* ================= GAME LOOP ================= */
function gameLoop() {
    if (paused) return;

    updatePlayer();
    updateCamera();
    updateProgress();
    draw();

    if (checkCollision()) {
        resetGame(practiceMode);
        return;
    }

    animationId = requestAnimationFrame(gameLoop);
}

/* ================= START / PAUSE ================= */
startBtn.onclick = () => {
    generateSpikes();
    gameStarted = true;
    startBtn.style.display = "none";
    bgMusic.play();
    showAttempt();
    gameLoop();
};

pauseBtn.onclick = () => paused = !paused;

window.addEventListener("resize", () => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
});
