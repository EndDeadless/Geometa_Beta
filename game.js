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

// Stars background
let stars = [];
for (let i = 0; i < 100; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 3,
    speed: Math.random() * 2 + 0.5
  });
}

// Jump function (for all inputs)
function jump() {
  if (player.onGround) {
    player.dy = player.jumpForce;
    player.onGround = false;
  }
}

// Controls
window.addEventListener('keydown', e => { if(e.code === 'Space') jump(); });
window.addEventListener('touchstart', jump);
window.addEventListener('mousedown', jump);

// Spawn triangle obstacles
function spawnObstacle() {
  const size = 50 + Math.random() * 100;
  obstacles.push({
    x: canvas.width + 50,
    y: canvas.height - 100,
    size: size,
    color: '#FFD700',
    startX: canvas.width + 50,
    glowPhase: Math.random() * Math.PI * 2 // for glow animation
  });
}

// Draw triangle with glow animation
function drawTriangle(obs) {
  const glow = 10 + 10 * Math.sin(Date.now() * 0.005 + obs.glowPhase);
  ctx.fillStyle = obs.color;
  ctx.shadowColor = obs.color;
  ctx.shadowBlur = glow;
  ctx.beginPath();
  ctx.moveTo(obs.x, obs.y);
  ctx.lineTo(obs.x + obs.size, obs.y);
  ctx.lineTo(obs.x + obs.size/2, obs.y - obs.size);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

// Game loop
function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Stars
  ctx.fillStyle = '#fff';
  stars.forEach(s => {
    s.x -= s.speed;
    if (s.x < 0) s.x = canvas.width;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI*2);
    ctx.fill();
  });

  // Player physics
  player.dy += player.gravity;
  player.y += player.dy;
  if(player.y + player.height >= canvas.height - 100){
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

  // Progress based on music
  let progressPercent = 0;
  if(bgMusic.duration > 0){
    progressPercent = Math.min((bgMusic.currentTime / bgMusic.duration) * 100, 100);
  }
  progressBar.style.width = progressPercent + '%';

  // Draw and move obstacles
  obstacles.forEach(obs => {
    obs.x = obs.startX - (progressPercent / 100) * mapLength;
    drawTriangle(obs);

    // Collision (bounding box of triangle)
    if(player.x < obs.x + obs.size &&
       player.x + player.width > obs.x &&
       player.y < obs.y &&
       player.y + player.height > obs.y - obs.size){
         bgMusic.pause();
         alert('Game Over! Map dừng lại.');
         document.location.reload();
    }
  });

  requestAnimationFrame(update);
}

// Spawn obstacles every 1.5s
let obstacleInterval;

// Start game
function startGame(){
  startBtn.style.display = 'none';
  obstacles = [];
  distanceTravelled = 0;

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
