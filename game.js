const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const startBtn = document.getElementById('startBtn');
const progressBar = document.getElementById('progressBar');
const bgMusic = document.getElementById('bgMusic');

let obstacles = [];
let mapLength = 5000; // tổng chiều dài map

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

// Particles và stars background
let particles = [];
for(let i=0;i<150;i++){
  particles.push({
    x: Math.random()*canvas.width,
    y: Math.random()*canvas.height,
    size: Math.random()*3+1,
    speed: Math.random()*2+0.5,
    color: `rgba(255,255,255,${Math.random()})`
  });
}

// Hàm nhảy
function jump() {
  if(player.onGround){
    player.dy = player.jumpForce;
    player.onGround = false;
  }
}

// Controls
window.addEventListener('keydown', e => { if(e.code==='Space') jump(); });
window.addEventListener('touchstart', jump);
window.addEventListener('mousedown', jump);

// Spawn obstacles kiểu "cây gai" tam giác
function spawnObstacle() {
  const size = 50 + Math.random() * 80;
  obstacles.push({
    x: canvas.width + 50,
    y: canvas.height - 100,
    size: size,
    color: '#FFD700',
    startX: canvas.width + 50,
    glowPhase: Math.random() * Math.PI * 2
  });
}

// Vẽ cây gai tam giác
function drawSpike(obs){
  const glow = 10 + 10 * Math.sin(Date.now()*0.005 + obs.glowPhase);
  ctx.fillStyle = obs.color;
  ctx.shadowColor = obs.color;
  ctx.shadowBlur = glow;
  ctx.beginPath();
  // Vẽ 3 tam giác nhỏ tạo thành cây gai
  for(let i=0;i<3;i++){
    const yOffset = i*obs.size*0.3;
    const sizeOffset = obs.size - i*obs.size*0.3;
    ctx.moveTo(obs.x, obs.y - yOffset);
    ctx.lineTo(obs.x + sizeOffset, obs.y - yOffset);
    ctx.lineTo(obs.x + sizeOffset/2, obs.y - sizeOffset - yOffset);
    ctx.closePath();
  }
  ctx.fill();
  ctx.shadowBlur = 0;
}

// Game loop
function update(){
  // Gradient background động
  const gradient = ctx.createLinearGradient(0,0,0,canvas.height);
  const t = Date.now()*0.002;
  gradient.addColorStop(0, `hsl(${Math.sin(t)*50+210},60%,40%)`);
  gradient.addColorStop(1, `hsl(${Math.cos(t)*50+180},70%,30%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // Particles
  particles.forEach(p=>{
    p.x -= p.speed;
    if(p.x<0) p.x=canvas.width;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
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

  // Progress theo nhạc (chuẩn khớp nhạc)
  let progressPercent = 0;
  if(bgMusic.duration>0){
    progressPercent = Math.min((bgMusic.currentTime / bgMusic.duration)*100,100);
  }
  progressBar.style.width = progressPercent + '%';
  progressBar.innerText = `${Math.floor(progressPercent)}%`;

  // Obstacles
  obstacles.forEach(obs=>{
    obs.x = obs.startX - (progressPercent/100)*mapLength;
    drawSpike(obs);

    // Collision bounding box
    if(player.x<obs.x + obs.size &&
       player.x + player.width>obs.x &&
       player.y<obs.y &&
       player.y + player.height>obs.y - obs.size){
         bgMusic.pause();
         alert('Game Over! Map dừng lại.');
         document.location.reload();
    }
  });

  requestAnimationFrame(update);
}

// Spawn obstacles
let obstacleInterval;

// Start game
function startGame(){
  startBtn.style.display='none';
  obstacles=[];
  bgMusic.play();

  obstacleInterval = setInterval(spawnObstacle,1500);

  bgMusic.addEventListener('ended',()=>{
    clearInterval(obstacleInterval);
    alert('Map kết thúc! Bạn đã đi được 100%');
    document.location.reload();
  });

  update();
}

startBtn.addEventListener('click',startGame);
