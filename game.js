const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const startBtn = document.getElementById('startBtn');
const progressBar = document.getElementById('progressBar');
const bgMusic = document.getElementById('bgMusic');

let obstacles = [];
let mapLength = 5000;

// Player
const player = {
    x: 150,
    y: canvas.height - 150,
    width: 50,
    height: 50,
    color: '#FF4500',
    dy: 0,
    gravity: 1,
    jumpForce: -20,
    onGround: false
};

// Particles background
let particles = [];
for (let i = 0; i < 200; i++) {
    particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        speed: Math.random() * 2 + 0.5,
        color: `rgba(255,255,255,${Math.random()})`
    });
}

// Jump function
function jump() {
    if (player.onGround) {
        player.dy = player.jumpForce;
        player.onGround = false;
    }
}

// Controls
window.addEventListener('keydown', e => { if (e.code === 'Space') jump(); });
window.addEventListener('mousedown', jump);
window.addEventListener('touchstart', jump);

// Spawn obstacle clusters
let lastObstacleX = 0;
function spawnObstacle() {
    const minGap = 300;
    const maxGap = 600;
    const gap = minGap + Math.random() * (maxGap - minGap);

    const size = 50 + Math.random() * 50;
    const spikesInCluster = 3 + Math.floor(Math.random() * 2); // 3-4 tam giác dính

    obstacles.push({
        x: canvas.width + lastObstacleX + gap,
        y: canvas.height - 100,
        size: size,
        spikes: spikesInCluster,
        color: '#FFD700',
        startX: canvas.width + lastObstacleX + gap,
        glowPhase: Math.random() * Math.PI * 2
    });

    lastObstacleX += gap;
}

// Draw spike cluster
function drawSpike(obs) {
    const glow = 8 + 8 * Math.sin(Date.now() * 0.005 + obs.glowPhase);
    ctx.fillStyle = obs.color;
    ctx.shadowColor = obs.color;
    ctx.shadowBlur = glow;
    ctx.beginPath();
    for (let i = 0; i < obs.spikes; i++) {
        const yOffset = i * obs.size * 0.8;
        const sizeOffset = obs.size;
        ctx.moveTo(obs.x, obs.y - yOffset);
        ctx.lineTo(obs.x + sizeOffset, obs.y - yOffset);
        ctx.lineTo(obs.x + sizeOffset / 2, obs.y - sizeOffset - yOffset);
        ctx.closePath();
    }
    ctx.fill();
    ctx.shadowBlur = 0;
}

// Draw background with gradient + particles
function drawBackground(progress) {
    const t = Date.now() * 0.002;
    const startHue = 200 + progress * 100;
    const endHue = 150 + progress * 80;
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, `hsl(${startHue},60%,40%)`);
    gradient.addColorStop(1, `hsl(${endHue},70%,30%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Particles
    particles.forEach(p => {
        p.x -= p.speed;
        if (p.x < 0) p.x = canvas.width;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Update game loop
function update() {
    const progressPercent = (bgMusic.duration > 0) ? Math.min(bgMusic.currentTime / bgMusic.duration, 1) : 0;

    drawBackground(progressPercent);

    // Player physics
    player.dy += player.gravity;
    player.y += player.dy;
    if (player.y + player.height >= canvas.height - 100) {
        player.y = canvas.height - 100 - player.height;
        player.dy = 0;
        player.onGround = true;
    }

    // Player glow
    ctx.fillStyle = player.color;
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 15;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.shadowBlur = 0;

    // Update progress bar
    progressBar.style.width = `${progressPercent * 100}%`;
    progressBar.innerText = `${Math.floor(progressPercent * 100)}%`;

    // Draw obstacles
    obstacles.forEach(obs => {
        obs.x = obs.startX - progressPercent * mapLength;
        drawSpike(obs);

        // Collision detection
        if (player.x < obs.x + obs.size &&
            player.x + player.width > obs.x &&
            player.y < obs.y &&
            player.y + player.height > obs.y - obs.size * obs.spikes * 0.8) {
            bgMusic.pause();
            alert('Game Over! Bạn đã chết.');
            document.location.reload();
        }
    });

    requestAnimationFrame(update);
}

// Spawn obstacles interval
let obstacleInterval;

// Start game
function startGame() {
    startBtn.style.display = 'none';
    obstacles = [];
    lastObstacleX = 0;
    bgMusic.play();

    obstacleInterval = setInterval(spawnObstacle, 1500);

    bgMusic.addEventListener('ended', () => {
        clearInterval(obstacleInterval);
        alert('Map kết thúc! Bạn đã đi được 100%');
        document.location.reload();
    });

    update();
}

startBtn.addEventListener('click', startGame);
