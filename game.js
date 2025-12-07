const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let W = canvas.width, H = canvas.height;

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const bgMusic = document.getElementById('bgMusic');
const progressEl = document.getElementById('progress');
const attemptEl = document.getElementById('attempt');

const cpSetBtn = document.getElementById('cpSet');
const cpDelBtn = document.getElementById('cpDel');

const rotateOverlay = document.getElementById('rotateOverlay'); // <<< MOD

let gameLoopId = null;
let gameStarted = false;
let paused = false;
let pauseMenuVisible = false;

/* ===========================
   GAME STATE
   =========================== */
let attempt = 1;                // shows on death, must increase even in practice
const mapSpeedMax = 6;

let cameraX = 0;                // world offset (how far map has scrolled)
let player = {                  // player in screen coordinates for drawing; world position is cameraX + player.x
  x: 100,
  y: 0,         // set below from ground
  size: 50,
  vy: 0,
  gravity: 1,
  jump: -18,
  onGround: true,
  angle: 0
};

// obstacles
let obstacles = [];
const spikeCount = 120;
function generateSpikes(seedRandom=false){
  obstacles = [];
  let lastX = 500;
  for(let i=0;i<spikeCount;i++){
    let gap = 200 + Math.random()*100; // 200-300px
    lastX += gap;
    obstacles.push({ x: lastX, type: 'spike' });
  }
}
generateSpikes();

// background parallax layers
const bgLayers = [
  { color:'#111', x:0, speed:0.2 },
  { color:'#222', x:0, speed:0.5 },
  { color:'#333', x:0, speed:1 }
];

/* ===========================
   PRACTICE & CHECKPOINTS
   =========================== */
let practiceMode = false;
let checkpoints = []; // stack: push -> newest is last index

function placeCheckpointFromCurrentPlayer(){
  const worldX = cameraX + player.x;
  const playerWorldY = player.y;
  const playerOnGround = player.onGround;
  const time = bgMusic.currentTime || 0;
  checkpoints.push({ worldX, playerWorldY, playerOnGround, time });
}

function deleteLastCheckpoint(){
  if(checkpoints.length > 0){
    checkpoints.pop();
  }
}

/* ===========================
   INPUT HANDLING & AUTO-JUMP
   ===========================
   We'll use Pointer Events to unify mouse & touch.
   On mobile, pointer events ensure we get coordinates for menu taps.
   Also keep 'holding' semantics.
*/
let holding = false;

// unify pointer down/up to cover touch/mouse/stylus
canvas.addEventListener('pointerdown', (e) => {
  // If pause menu visible, treat pointerdown as menu interaction (coordinates)
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if(pauseMenuVisible){
    // handle menu icon taps by checking dynamic positions
    handlePauseMenuPointer(mx, my);
    e.preventDefault();
    return;
  }

  // Otherwise, gameplay input: start jump and set holding
  holding = true;
  jump();
  e.preventDefault();
}, {passive:false}); // <<< MOD

canvas.addEventListener('pointerup', (e) => {
  // pointerup ends holding - but if pointer started outside canvas it may still trigger: simple set false
  holding = false;
  e.preventDefault();
}, {passive:false});

canvas.addEventListener('pointercancel', () => {
  holding = false;
});

// Also support keyboard for desktop
window.addEventListener('keydown', (e) => {
  if(e.code === 'Space'){
    e.preventDefault();
    holding = true;
    jump();
  } else if(e.key === 'c' || e.key === 'C'){
    if(practiceMode) placeCheckpointFromCurrentPlayer();
  } else if(e.key === 'x' || e.key === 'X'){
    if(practiceMode) deleteLastCheckpoint();
  }
});
window.addEventListener('keyup', (e) => {
  if(e.code === 'Space'){
    e.preventDefault();
    holding = false;
  }
});

/* ===========================
   PLAYER UPDATE / PHYSICS
   =========================== */
function jump(){
  if(player.onGround){
    player.vy = player.jump;
    player.onGround = false;
  }
}

function updatePlayer(){
  player.vy += player.gravity;
  player.y += player.vy;

  // handle rotation for visual
  player.angle += player.vy < 0 ? 10 : -5;
  if(player.angle > 90) player.angle = 90;
  if(player.angle < -90) player.angle = -90;

  const groundY = H - 50 - player.size;
  if(player.y >= groundY){
    // landed
    player.y = groundY;
    player.vy = 0;
    const justLanded = !player.onGround;
    player.onGround = true;
    player.angle = 0;
    if(justLanded && holding){
      jump();
    }
  } else {
    player.onGround = false;
  }
}

/* ===========================
   DRAWING
   =========================== */
function drawBackground(){
  bgLayers.forEach(layer => {
    layer.x -= layer.speed;
    if(layer.x <= -W) layer.x += W; // wrap
    let grd = ctx.createLinearGradient(0,0,W,H);
    grd.addColorStop(0, layer.color);
    grd.addColorStop(1, '#000');
    ctx.fillStyle = grd;
    ctx.fillRect(layer.x,0,W,H);
    ctx.fillRect(layer.x+W,0,W,H);
  });
}

function drawGround(){
  ctx.fillStyle = "#555";
  ctx.fillRect(0, H - 50, W, 50);
}

function drawPlayer(){
  ctx.save();
  ctx.translate(player.x + player.size/2, player.y + player.size/2);
  ctx.rotate(player.angle * Math.PI / 180);
  ctx.fillStyle = "#0f0";
  ctx.fillRect(-player.size/2, -player.size/2, player.size, player.size);
  ctx.restore();
}

function drawObstacles(){
  obstacles.forEach(obs => {
    let screenX = obs.x - cameraX;
    if(screenX + 50 < 0 || screenX > W) return;
    ctx.fillStyle = '#f00';
    ctx.beginPath();
    ctx.moveTo(screenX, H - 50);
    ctx.lineTo(screenX + 25, H - 50 - 50);
    ctx.lineTo(screenX + 50, H - 50);
    ctx.closePath();
    ctx.fill();
  });
}

function drawCheckpoints(){
  checkpoints.forEach(cp => {
    const screenX = cp.worldX - cameraX;
    const screenY = cp.playerWorldY;
    if(screenX < -50 || screenX > W + 50) return;
    const cx = screenX;
    const cy = screenY;
    const r = Math.max(10, Math.min(20, player.size/4));
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#070';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

/* ===========================
   CAMERA & PROGRESS
   =========================== */
function updateCamera(){
  cameraX += mapSpeedMax;
}

function updateProgress(){
  if(!bgMusic.duration || isNaN(bgMusic.duration) || bgMusic.duration === 0) return;
  let percent = Math.min((bgMusic.currentTime / bgMusic.duration) * 100, 100);
  progressEl.style.width = percent + "%";
  progressEl.textContent = Math.floor(percent) + "%";
}

/* ===========================
   COLLISION
   =========================== */
function checkCollisionSpike(spike){
  const px = player.x, py = player.y, ps = player.size;
  const sx = spike.x - cameraX, sy = H - 50 - 50, ss = 50;
  if(px + ps > sx + 5 && px < sx + ss - 5 && py + ps > sy + 10) return true;
  return false;
}
function checkCollision(){
  for(let obs of obstacles){
    if(checkCollisionSpike(obs)) return true;
  }
  return false;
}

/* ===========================
   ATTEMPT DISPLAY, RESET & RESPAWN
   =========================== */
function showAttempt(){
  attemptEl.textContent = `Attempt ${attempt}`;
  attemptEl.style.opacity = 1;
  let alpha = 1;
  const interval = setInterval(() => {
    alpha -= 0.02;
    attemptEl.style.opacity = alpha;
    if(alpha <= 0){
      clearInterval(interval);
      attemptEl.style.opacity = 0;
    }
  }, 30);
}

function fullResetToStart(){
  cancelAnimationFrame(gameLoopId);
  cameraX = 0;
  generateSpikes();
  player.y = H - 50 - player.size;
  player.vy = 0;
  player.onGround = true;
  player.angle = 0;
  try { bgMusic.currentTime = 0; } catch(e) {}
  try { bgMusic.play(); } catch(e) {}
  progressEl.style.width = '0%';
  progressEl.textContent = '0%';
  gameStarted = true;
  gameLoop();
}

function respawnToLastCheckpoint(){
  if(checkpoints.length === 0){
    fullResetToStart();
    return;
  }
  const last = checkpoints[checkpoints.length - 1];
  cameraX = last.worldX - player.x;
  player.y = last.playerWorldY;
  player.vy = 0;
  player.angle = 0;
  player.onGround = last.playerOnGround;
  try { bgMusic.currentTime = last.time || 0; } catch(e) {}
  updateProgress();
  gameStarted = true;
  gameLoop();
}

/* ===========================
   GAME LOOP
   =========================== */
function gameLoop(){
  if(!gameStarted || paused) return;
  ctx.clearRect(0,0,W,H);

  // draw
  drawBackground();
  drawGround();
  drawObstacles();
  drawCheckpoints();
  drawPlayer();

  // update physics & world
  updatePlayer();
  updateCamera();
  updateProgress();

  // collision detection
  if(checkCollision()){
    attempt++;
    showAttempt();

    if(practiceMode && checkpoints.length > 0){
      setTimeout(() => {
        respawnToLastCheckpoint();
      }, 250);
      return;
    } else {
      gameStarted = false;
      setTimeout(() => {
        fullResetToStart();
      }, 700);
      return;
    }
  }

  // request next frame
  gameLoopId = requestAnimationFrame(gameLoop);
}

/* ===========================
   UI: Start / Pause / PauseMenu / Practice buttons
   =========================== */

// ensure canvas focus so space works
canvas.setAttribute('tabindex', '0');
canvas.addEventListener('click', () => { canvas.focus(); });

// initial player Y
player.y = H - 50 - player.size;
player.onGround = true;

// Start button behavior
startBtn.addEventListener('click', () => {
  bgMusic.play().then(() => {
    gameStarted = true;
    startBtn.style.display = 'none';
    canvas.focus();
    showAttempt();
    gameLoop();
  }).catch(() => {
    gameStarted = true;
    startBtn.style.display = 'none';
    canvas.focus();
    showAttempt();
    gameLoop();
  });
});

// Pause button toggles Pause Menu (drawn on canvas)
pauseBtn.addEventListener('click', () => {
  if(pauseMenuVisible) hidePauseMenu();
  else showPauseMenu();
});

function drawPauseMenu(){
  // draw overlay
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0,0,W,H);
  // compute dynamic icon positions and radius so mobile scales
  const iconR = Math.max(32, Math.min(64, Math.min(W, H) * 0.06)); // <<< MOD: dynamic sizing
  const centerY = H/2;
  const centerX = W/2;
  // positions
  const leftX = centerX - iconR*3;
  const midX = centerX;
  const rightX = centerX + iconR*3;

  drawCircleIcon(leftX, centerY, iconR, '#fff', 'triangle', '#000');
  drawCircleIcon(midX, centerY, iconR, '#fff', 'arrow', '#000');
  const bg = practiceMode ? '#0a0' : '#fff';
  const iconColor = practiceMode ? '#000' : '#0f0';
  drawCircleIcon(rightX, centerY, iconR, bg, 'rhombus', iconColor);

  // save last drawn icon geometry for hit testing (<<< MOD)
  lastPauseMenuIcons = {
    left: { x:leftX, y:centerY, r:iconR },
    mid: { x:midX, y:centerY, r:iconR },
    right: { x:rightX, y:centerY, r:iconR }
  };
}

let lastPauseMenuIcons = null; // <<< MOD: store last positions for hit tests

function drawCircleIcon(x, y, r, bgColor, type, iconColor){
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = iconColor;
  ctx.beginPath();
  if(type === 'triangle'){
    ctx.moveTo(x - r/2, y - r/2);
    ctx.lineTo(x - r/2, y + r/2);
    ctx.lineTo(x + r/2, y);
    ctx.closePath();
  } else if(type === 'arrow'){
    // stylized restart arrow
    ctx.arc(x, y, r/2, 0, Math.PI * 1.5);
    ctx.moveTo(x + r/2, y);
    ctx.lineTo(x + r/4, y - r/4);
    ctx.lineTo(x + r/4, y + r/4);
    ctx.closePath();
  } else if(type === 'rhombus'){
    ctx.moveTo(x, y - r/2);
    ctx.lineTo(x + r/2, y);
    ctx.lineTo(x, y + r/2);
    ctx.lineTo(x - r/2, y);
    ctx.closePath();
  }
  ctx.fill();
}

// show pause menu overlay and pause game
function showPauseMenu(){
  pauseMenuVisible = true;
  paused = true;
  try { bgMusic.pause(); } catch(e) {}
  // draw menu once (canvas drawn overlay)
  drawPauseMenu();
}

// hide menu and continue
function hidePauseMenu(){
  pauseMenuVisible = false;
  paused = false;
  if(!practiceMode){
    cpSetBtn.style.display = 'none';
    cpDelBtn.style.display = 'none';
  }
  try { bgMusic.play(); } catch(e) {}
  gameLoop();
}

// handle clicks on canvas for pause menu icons
function handlePauseMenuPointer(mx, my){
  if(!pauseMenuVisible || !lastPauseMenuIcons) return;
  // check distances to each icon center
  const l = lastPauseMenuIcons.left;
  const m = lastPauseMenuIcons.mid;
  const p = lastPauseMenuIcons.right;
  if(Math.hypot(mx - l.x, my - l.y) < l.r){
    // resume
    hidePauseMenu();
    return;
  }
  if(Math.hypot(mx - m.x, my - m.y) < m.r){
    // restart
    fullResetToStart();
    hidePauseMenu();
    return;
  }
  if(Math.hypot(mx - p.x, my - p.y) < p.r){
    // toggle practice mode
    togglePracticeMode();
    return;
  }
}

/* ===========================
   Practice Buttons (DOM elements)
   =========================== */
function drawRhombusInElement(el, crossed=false){
  const svgNS = "http://www.w3.org/2000/svg";
  el.innerHTML = '';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '40');
  svg.setAttribute('height', '40');
  svg.setAttribute('viewBox', '0 0 40 40');
  const g = document.createElementNS(svgNS, 'g');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', 'M20 5 L33 20 L20 35 L7 20 Z');
  path.setAttribute('fill', '#0f0');
  g.appendChild(path);
  if(crossed){
    const cross = document.createElementNS(svgNS, 'path');
    cross.setAttribute('d', 'M8 8 L32 32 M32 8 L8 32');
    cross.setAttribute('stroke', '#000');
    cross.setAttribute('stroke-width', '3');
    cross.setAttribute('stroke-linecap', 'round');
    g.appendChild(cross);
  }
  svg.appendChild(g);
  el.appendChild(svg);
}
drawRhombusInElement(cpSetBtn, false);
drawRhombusInElement(cpDelBtn, true);

// cp buttons click handlers
cpSetBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if(!practiceMode) return;
  placeCheckpointFromCurrentPlayer();
});
cpDelBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if(!practiceMode) return;
  deleteLastCheckpoint();
});

// helper: toggle practice mode with required resets and UI changes
function togglePracticeMode(){
  practiceMode = !practiceMode;

  attempt = 1;
  showAttempt();

  if(practiceMode){
    checkpoints = [];
    cpSetBtn.style.display = 'flex';
    cpDelBtn.style.display = 'flex';
  } else {
    checkpoints = [];
    cpSetBtn.style.display = 'none';
    cpDelBtn.style.display = 'none';
  }

  pauseMenuVisible = false;
  paused = false;

  fullResetToStart();

  try { bgMusic.play(); } catch(e) {}
}

// initial hide practice buttons
cpSetBtn.style.display = 'none';
cpDelBtn.style.display = 'none';

/* ===========================
   ORIENTATION / MOBILE HANDLING
   ===========================
   If on mobile and portrait -> require landscape.
   We pause the game and show rotate overlay until user rotates device.
*/
function checkOrientationAndMobile(){
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const portrait = window.innerHeight > window.innerWidth;
  if(isMobile && portrait){
    // show overlay and pause
    rotateOverlay.style.display = 'flex';
    paused = true;
    pauseMenuVisible = false;
    try { bgMusic.pause(); } catch(e){}
    return true;
  } else {
    rotateOverlay.style.display = 'none';
    // only resume if game was previously started
    if(gameStarted){ paused = false; try { bgMusic.play(); } catch(e){}; gameLoop(); }
    return false;
  }
}

// ===== ROTATE CONFIRM BUTTON (ADD ONLY) =====
const rotatedBtn = document.getElementById('rotatedBtn');

if(rotatedBtn){
  rotatedBtn.addEventListener('click', () => {
    const portrait = window.innerHeight > window.innerWidth;
    if(!portrait){
      rotateOverlay.style.display = 'none';
      paused = false;
      if(gameStarted){
        try { bgMusic.play(); } catch(e){}
        gameLoop();
      }
    }
  });
}

// call on load and resize/orientationchange
window.addEventListener('resize', () => {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  // adjust player ground pos safely
  player.y = Math.min(player.y, H - 50 - player.size);
  // recompute menu icon geometry next draw
  if(pauseMenuVisible) drawPauseMenu();
  // orientation check
  checkOrientationAndMobile();
});

// also handle orientation change explicitly
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    if(pauseMenuVisible) drawPauseMenu();
    checkOrientationAndMobile();
  }, 200);
});

// initial orientation check
checkOrientationAndMobile();

/* ===========================
   CANVAS CLICK / POINTER fallbacks
   =========================== */

/* ===========================
   INITIALIZATION: draw initial pause menu for UI
   =========================== */
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, W, H);
drawPauseMenu();

