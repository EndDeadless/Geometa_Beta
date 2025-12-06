const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let score = 0;
const scoreDiv = document.getElementById('score');

// Player
const player = {
  x: 100,
  y: canvas.height - 150,
  width: 50,
  height: 50,
  color: '#FF4500',
  dy: 0,
  gravity: 1,
  jumpForce: -20,
  onGround: false
};

// Obstacles
let obstacles = [];
let obstacleSpeed = 8;

// Controls
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && player.onGround) {
    player.dy = player.jumpForce;
    player.onGround = false;
  }
});

// Create obstacles
function spawnObstacle() {
  const height = 50 + Math.random() * 100;
  obstacles.push({
    x: canvas.width + 50,
    y: canvas.height - height,
    width: 50,
    height: height,
    color: '#228B22'
  });
}

// Update
function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Player physics
  player.dy += player.gravity;
  player.y += player.dy;

  if (player.y + player.height >= canvas.height - 100) {
    player.y = canvas.height - 100 - player.height;
    player.dy = 0;
    player.onGround = true;
  }

  // Draw player
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // Obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.x -= obstacleSpeed;
    ctx.fillStyle = obs.color;
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

    // Collision
    if (player.x < obs.x + obs.width &&
        player.x + player.width > obs.x &&
        player.y < obs.y + obs.height &&
        player.y + player.height > obs.y) {
      alert('Game Over! Score: ' + score);
      document.location.reload();
    }

    // Remove off-screen
    if (obs.x + obs.width < 0) {
      obstacles.splice(i, 1);
      score++;
      scoreDiv.innerText = 'Score: ' + score;
    }
  }

  requestAnimationFrame(update);
}

// Spawn obstacles every 1.5s
setInterval(spawnObstacle, 1500);

update();
