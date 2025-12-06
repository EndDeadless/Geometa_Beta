const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;

const startBtn = document.getElementById('startBtn');
const bgMusic = document.getElementById('bgMusic');
const progressEl = document.getElementById('progress');

let player = {
    x: 100,
    y: H - 100,
    size: 50,
    vy: 0,
    gravity: 1,
    jump: -18,
    onGround: true
};

let gameStarted = false;

// obstacles map mẫu (x, type)
let obstacles = [
    {x: 500, type: 'spike'}, {x: 900, type: 'block'}, {x: 1300, type: 'spike'},
    {x: 1800, type: 'block'}, {x: 2300, type: 'spike'}, {x: 2800, type: 'block'}
];

const obstacleImages = {};
function loadObstacleImages() {
    const spike = new Image();
    spike.src = 'assets/obstacles/spike.png';
    obstacleImages.spike = spike;

    const block = new Image();
    block.src = 'assets/obstacles/block.png';
    obstacleImages.block = block;
}
loadObstacleImages();

// parallax background
const bgLayers = [];
function loadBackgrounds() {
    for (let i = 1; i <= 3; i++) {
        let img = new Image();
        img.src = `assets/backgrounds/layer${i}.png`;
        bgLayers.push({img, x: 0, speed: 0.2*i});
    }
}
loadBackgrounds();

let cameraX = 0;

function drawBackground() {
    bgLayers.forEach(layer => {
        layer.x -= layer.speed;
        if (layer.x <= -W) layer.x = 0;
        ctx.drawImage(layer.img, layer.x, 0, W, H);
        ctx.drawImage(layer.img, layer.x + W, 0, W, H);
    });
}

function drawPlayer() {
    ctx.fillStyle = "#0f0";
    ctx.fillRect(player.x, player.y, player.size, player.size);
}

function drawObstacles() {
    obstacles.forEach(obs => {
        let screenX = obs.x - cameraX;
        if (screenX + 50 < 0 || screenX > W) return; // offscreen
        let img = obstacleImages[obs.type];
        if (img.complete) ctx.drawImage(img, screenX, H - 50 - (obs.type==='spike'?50:50), 50, 50);
        else { // fallback nếu img chưa load
            ctx.fillStyle = obs.type==='spike'?'#f00':'#00f';
            ctx.fillRect(screenX, H - 50 - 50, 50, 50);
        }
    });
}

function drawGround() {
    ctx.fillStyle = "#555";
    ctx.fillRect(0, H - 50, W, 50);
}

function updatePlayer() {
    player.vy += player.gravity;
    player.y += player.vy;

    const groundY = H - 50 - player.size;
    if (player.y > groundY) {
        player.y = groundY;
        player.vy = 0;
        player.onGround = true;
    }
}

function updateCamera() {
    cameraX = player.x - 100;
}

function updateProgress() {
    if (!bgMusic.duration) return;
    let percent = Math.min((bgMusic.currentTime / bgMusic.duration) * 100, 100);
    progressEl.style.width = percent + "%";
    progressEl.textContent = Math.floor(percent) + "%";
}

function gameLoop() {
    if (!gameStarted) return;
    ctx.clearRect(0,0,W,H);
    drawBackground();
    drawGround();
    drawObstacles();
    drawPlayer();
    updatePlayer();
    updateCamera();
    updateProgress();
    requestAnimationFrame(gameLoop);
}

function jump() {
    if (player.onGround) {
        player.vy = player.jump;
        player.onGround = false;
    }
}

startBtn.addEventListener('click', () => {
    bgMusic.play();
    gameStarted = true;
    startBtn.style.display = "none";
    gameLoop();
});

canvas.addEventListener('touchstart', jump);
canvas.addEventListener('mousedown', jump);

window.addEventListener('resize', () => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
});
