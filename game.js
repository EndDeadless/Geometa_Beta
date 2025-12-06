const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const audio = document.getElementById("bgm");
const startScreen = document.getElementById("startScreen");
const progressBar = document.getElementById("progress");
const percentText = document.getElementById("percent");
const menuBtn = document.getElementById("menuBtn");

resize();
window.addEventListener("resize", resize);

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}

/* ===== GAME STATE ===== */
let started = false;
let paused = false;
let attempt = 1;
let holding = false;

/* ===== WORLD ===== */
const groundY = canvas.height * 0.75;
const speed = 4; // < 6

/* ===== PLAYER ===== */
const player = {
  x: 150,
  y: groundY,
  size: 40,
  vy: 0,
  gravity: 0.8,
  jumpPower: -14,
  onGround: true,
  rotation: 0
};

/* ===== OBSTACLES ===== */
let obstacles = [];

function buildMap() {
  obstacles = [];
  let x = canvas.width + 300;

  for (let i = 0; i < 60; i++) {
    obstacles.push({
      x,
      size: 40
    });
    x += 240 + Math.random() * 200; // GIÃN XA, NHẢY KỊP
  }
}

/* ===== INPUT ===== */
function tryJump() {
  if (player.onGround) {
    player.vy = player.jumpPower;
    player.onGround = false;
  }
}

window.addEventListener("mousedown", () => holding = true);
window.addEventListener("mouseup", () => holding = false);
window.addEventListener("touchstart", () => holding = true);
window.addEventListener("touchend", () => holding = false);
window.addEventListener("keydown", e => {
  if (e.code === "Space") holding = true;
});
window.addEventListener("keyup", e => {
  if (e.code === "Space") holding = false;
});

/* ===== MENU ===== */
menuBtn.onclick = () => {
  paused = !paused;
  paused ? audio.pause() : audio.play();
};

/* ===== START ===== */
startScreen.onclick = async () => {
  startScreen.style.display = "none";
  started = true;
  attempt = 1;
  resetGame();
  await audio.play();
  requestAnimationFrame(loop);
};

/* ===== RESET ===== */
function resetGame() {
  player.y = groundY;
  player.vy = 0;
  player.onGround = true;
  player.rotation = 0;

  audio.currentTime = 0;
  buildMap();
}

/* ===== MAIN LOOP ===== */
function loop() {
  if (!paused && started) update();
  render();
  requestAnimationFrame(loop);
}

/* ===== UPDATE ===== */
function update() {
  // Jump logic
  if (holding && player.onGround) tryJump();

  // Physics
  player.vy += player.gravity;
  player.y += player.vy;

  if (player.y >= groundY) {
    player.y = groundY;
    player.vy = 0;
    player.onGround = true;
  }

  if (!player.onGround) player.rotation += 0.15;

  // Obstacles
  obstacles.forEach(o => o.x -= speed);

  // Collision
  obstacles.forEach(o => {
    if (
      player.x + player.size > o.x + 6 &&
      player.x < o.x + o.size - 6 &&
      player.y + player.size > groundY - o.size
    ) {
      die();
    }
  });

  // Progress by MUSIC TIME
  if (audio.duration) {
    const p = audio.currentTime / audio.duration * 100;
    progressBar.style.width = p + "%";
    percentText.innerText = Math.floor(p) + "%";
  }
}

/* ===== DIE ===== */
function die() {
  attempt++;
  audio.pause();
  resetGame();
  audio.play();
}

/* ===== RENDER ===== */
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Ground
  ctx.fillStyle = "#111";
  ctx.fillRect(0, groundY + 40, canvas.width, canvas.height);

  // Player
  ctx.save();
  ctx.translate(player.x + player.size/2, player.y + player.size/2);
  ctx.rotate(player.rotation);
  ctx.fillStyle = "#00ffff";
  ctx.fillRect(-player.size/2, -player.size/2, player.size, player.size);
  ctx.restore();

  // Spikes
  ctx.fillStyle = "#fff";
  obstacles.forEach(o => {
    ctx.beginPath();
    ctx.moveTo(o.x, groundY + 40);
    ctx.lineTo(o.x + o.size/2, groundY - o.size);
    ctx.lineTo(o.x + o.size, groundY + 40);
    ctx.closePath();
    ctx.fill();
  });

  // Attempt
  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.fillText("Attempt " + attempt, 30, 80);
}
