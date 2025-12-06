const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const startBtn = document.getElementById('startBtn');
const progressBar = document.getElementById('progressBar');
const bgMusic = document.getElementById('bgMusic');

let obstacles = [];
let obstacleSpeed = 10;
let distanceTravelled = 0;
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

// Background stars
let stars = [];
for (let i = 0; i < 100; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 3,
    speed: Math.random() * 2 + 0.5
  });
}

// Controls
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && player.onGround) {
    player.dy = player.jumpForce;
    player.onGround = false;
  }
});

// Spawn obstacles
function spawnObstacle() {
  const height = 50 + Math.random() * 150;
  const colors = ['#00FFFF','#FF69B4','#7CFC00','#FFD700'];
  obstacles.push({
    x: canvas.width + 50,
    y: canvas.height - height,
    width: 50,
    height: height,
    color: colors[Math.floor(Math.random() * colors.length)]
  });
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

  // Obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.x -= obstacleSpeed;

    ctx.fillStyle = obs.color;
    ctx.shadowColor = obs.color;
    ctx.shadowBlur = 10;
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    ctx.shadowBlur = 0;

    // Collision
    if (player.x < obs.x + obs.width &&
        player.x + player.width > obs.x &&
        player.y < obs.y + obs.height &&
        player.y + player.height > obs.y) {
      bgMusic.pause();
      alert('Game Over! Map dừng lại.');
      document.location.reload();
    }

    if (obs.x + obs.width < 0) obstacles.splice(i, 1);
  }

  // Update progress
  distanceTravelled += obstacleSpeed;
  const progressPercent = Math.min((distanceTravelled / mapLength) * 100, 100);
  progressBar.style.width = progressPercent + '%';

  requestAnimationFrame(update);
}

// Spawn obstacles every 1.5s
let obstacleInterval;

function startGame() {
  startBtn.style.display = 'none';
  bgMusic.play();
  distanceTravelled = 0;
  obstacles = [];
  
  // Obstacle speed based on music duration
  bgMusic.addEventListener('loadedmetadata', () => {
    const musicDuration = bgMusic.duration;
    obstacleSpeed = mapLength / (musicDuration * 60);
  });

  obstacleInterval = setInterval(spawnObstacle, 1500);

  // End game when music ends
  bgMusic.addEventListener('ended', () => {
    clearInterval(obstacleInterval);
    alert('Map kết thúc! Bạn đã đi được 100%');
    document.location.reload();
  });

  update();
}

startBtn.addEventListener('click', startGame);
