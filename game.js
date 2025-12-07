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
   ===========================
   checkpoints array stores objects:
     {
       worldX: <number>,             // absolute world x where checkpoint set
       playerWorldY: <number>,       // absolute world Y (so we can respawn exactly)
       playerOnGround: <bool>,       // whether player was on ground at moment of set
       time: <number>                // bgMusic.currentTime at set
     }
   Behavior:
   - When toggling practice ON => reset game to start (attempt = 1), clear checkpoints, auto-close menu, show cp buttons.
   - When toggling practice OFF => reset game to start (attempt = 1), clear checkpoints, auto-close menu, hide cp buttons.
   - Only in practice mode can press 'c' to place, 'x' to delete (and the two DOM square buttons also work).
   - When dying in practice: attempt still increments, then respawn to last checkpoint (if exist), music/time set to checkpoint.time.
   - Respawn must set player.y EXACTLY to saved playerWorldY and camera so that player screen position is identical.
*/
let practiceMode = false;
let checkpoints = []; // stack: push -> newest is last index

function placeCheckpointFromCurrentPlayer(){
  // compute absolute worldX and worldY at the moment of placement
  const worldX = cameraX + player.x;
  // world Y: compute absolute Y relative to canvas - top is 0, so player.y is already screen Y
  // But absolute world Y is just the screen Y (y doesn't change when camera moves vertically), so store player.y
  const playerWorldY = player.y;
  const playerOnGround = player.onGround;
  const time = bgMusic.currentTime || 0;
  checkpoints.push({ worldX, playerWorldY, playerOnGround, time });
  // no immediate reset; icon drawn in render loop
}

function deleteLastCheckpoint(){
  if(checkpoints.length > 0){
    checkpoints.pop();
  }
}

/* ===========================
   INPUT HANDLING & AUTO-JUMP
   ===========================
   Requirements:
   - Click / Space / Touch press triggers a jump immediately.
   - If the input is HELD (holding=true), then when the player lands the update loop should auto-invoke jump() once more to mimic Geometry Dash's "hold to auto-jump on landing".
   - When input released, holding=false so auto-jump stops after next landing.
*/
let holding = false;

function jump(){
  // Only jump if on ground (one discrete jump)
  if(player.onGround){
    player.vy = player.jump;
    player.onGround = false;
  }
}

// Mouse / touch
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  holding = true;
  jump();
});
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  holding = false;
});
canvas.addEventListener('mousedown', (e) => {
  // left button only
  if(e.button === 0){
    e.preventDefault();
    holding = true;
    jump();
  }
});
canvas.addEventListener('mouseup', (e) => {
  if(e.button === 0){
    e.preventDefault();
    holding = false;
  }
});
canvas.addEventListener('mouseout', () => {
  // if cursor leaves canvas, stop holding
  holding = false;
});

// Keyboard
window.addEventListener('keydown', (e) => {
  if(e.code === 'Space'){
    e.preventDefault();
    holding = true;
    jump();
  } else if(e.key === 'c' || e.key === 'C'){
    // only allow when in practice mode
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
    // detect landing event: if previously not on ground, now landed and holding -> auto-jump
    const justLanded = !player.onGround;
    player.onGround = true;
    player.angle = 0;
    if(justLanded && holding){
      // auto-jump immediately on landing if user is holding
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
  // draw every checkpoint as a green rhombus at saved worldX and saved playerWorldY
  checkpoints.forEach(cp => {
    const screenX = cp.worldX - cameraX;
    const screenY = cp.playerWorldY;
    // only draw if on screen (with margin)
    if(screenX < -50 || screenX > W + 50) return;
    const cx = screenX;
    const cy = screenY; // place exactly where player was when set
    const r = Math.max(10, Math.min(20, player.size/4)); // reasonable size
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
    // optional: draw small outline
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
  // update parallax layers in drawBackground
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
  // pixel-ish box vs triangle approx
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
  // full reset: reset camera, regenerate spikes, reset player pos, reset music to start
  cancelAnimationFrame(gameLoopId);
  cameraX = 0;
  generateSpikes();
  // reset player vertical pos
  player.y = H - 50 - player.size;
  player.vy = 0;
  player.onGround = true;
  player.angle = 0;
  // reset music
  try { bgMusic.currentTime = 0; } catch(e) {}
  try { bgMusic.play(); } catch(e) {}
  // reset progress bar
  progressEl.style.width = '0%';
  progressEl.textContent = '0%';
  gameStarted = true;
  gameLoop();
}

function respawnToLastCheckpoint(){
  if(checkpoints.length === 0){
    // fallback to full reset
    fullResetToStart();
    return;
  }
  const last = checkpoints[checkpoints.length - 1];
  // set camera so player.x on screen remains same: cameraX = worldX - player.x
  cameraX = last.worldX - player.x;
  // set player exact Y to saved Y
  player.y = last.playerWorldY;
  player.vy = 0;
  player.angle = 0;
  player.onGround = last.playerOnGround;
  // set music time and progress
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
    // always increment attempt on death (including practice)
    attempt++;
    showAttempt();

    if(practiceMode && checkpoints.length > 0){
      // in practice: respawn to last checkpoint
      // small delay to show attempt then respawn so player sees death
      setTimeout(() => {
        respawnToLastCheckpoint();
      }, 250);
      return;
    } else {
      // normal mode: full restart after a delay
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
  // start music and game
  bgMusic.play().then(() => {
    gameStarted = true;
    startBtn.style.display = 'none';
    canvas.focus();
    showAttempt();
    gameLoop();
  }).catch(() => {
    // in case autoplay blocked
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
  // three circular icons centered horizontally
  drawCircleIcon(W/2 - 100, H/2, 40, '#fff', 'triangle', '#000'); // resume
  drawCircleIcon(W/2, H/2, 40, '#fff', 'arrow', '#000');         // restart
  // practice toggle: color changes when active
  const bg = practiceMode ? '#0a0' : '#fff';
  const iconColor = practiceMode ? '#000' : '#0f0';
  drawCircleIcon(W/2 + 100, H/2, 40, bg, 'rhombus', iconColor);
}

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
  // pause audio
  try { bgMusic.pause(); } catch(e) {}
  // draw overlay frame
  drawPauseMenu();
}

// hide menu and continue
function hidePauseMenu(){
  pauseMenuVisible = false;
  paused = false;
  // if not in practice mode, ensure practice buttons hidden
  if(!practiceMode){
    cpSetBtn.style.display = 'none';
    cpDelBtn.style.display = 'none';
  }
  // resume music & game loop
  try { bgMusic.play(); } catch(e) {}
  gameLoop();
}

// handle clicks on canvas for pause menu icons
canvas.addEventListener('click', function(e){
  // get canvas-local coords
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if(pauseMenuVisible){
    const cx = W/2 - 100, cy = H/2;
    const rx = W/2, ry = H/2;
    const px = W/2 + 100, py = H/2;
    if(Math.hypot(mx - cx, my - cy) < 40){
      // resume
      hidePauseMenu();
      return;
    }
    if(Math.hypot(mx - rx, my - ry) < 40){
      // restart
      // restart should reset to start (and keep practice mode as is? original requirement: toggling practice resets the game,
      // but pressing restart inside pause should just restart the current mode — so here: fullResetToStart())
      fullResetToStart();
      hidePauseMenu();
      return;
    }
    if(Math.hypot(mx - px, my - py) < 40){
      // toggle practice mode
      togglePracticeMode();
      // togglePracticeMode will auto-close the menu and reset as required
      return;
    }
  }
});

/* ===========================
   Practice Buttons (DOM elements)
   - Two square buttons shown only when practiceMode active.
   - cpSetBtn (left) places checkpoint when clicked.
   - cpDelBtn (right) deletes last checkpoint when clicked.
   - Icons are created via SVG to match prior look.
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
  // Place checkpoint at current player world position (store worldX and worldY)
  placeCheckpointFromCurrentPlayer();
});
cpDelBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if(!practiceMode) return;
  deleteLastCheckpoint();
});

// helper: toggle practice mode with required resets and UI changes
function togglePracticeMode(){
  // Toggle
  practiceMode = !practiceMode;

  // When toggled either way, requirement: reset attempt and reset game to start (0%)
  attempt = 1;
  showAttempt();

  // Clear or keep checkpoints? User required: when exit practice -> play from start and remove cp icons.
  if(practiceMode){
    // entering practice -> clear existing checkpoints (start fresh) then show cp buttons
    checkpoints = [];
    cpSetBtn.style.display = 'flex';
    cpDelBtn.style.display = 'flex';
  } else {
    // exiting practice -> clear checkpoints and hide buttons
    checkpoints = [];
    cpSetBtn.style.display = 'none';
    cpDelBtn.style.display = 'none';
  }

  // Auto-close pause menu immediately and start from beginning (as requested)
  pauseMenuVisible = false;
  paused = false;

  // Reset to start
  fullResetToStart();

  // If music paused, ensure play
  try { bgMusic.play(); } catch(e) {}
}

// initial hide practice buttons
cpSetBtn.style.display = 'none';
cpDelBtn.style.display = 'none';

/* ===========================
   CANVAS CLICK / POINTER fallbacks
   ===========================
   Note: We already used mousedown/up + touchstart/end above for jump/hold.
   Keep simple: clicks outside menu are treated as gameplay input (already handled).
*/

/* ===========================
   RESIZE HANDLING
   =========================== */
window.addEventListener('resize', () => {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  // reposition player to ground if needed
  // Ensure saved checkpoints' Y remain consistent relative to resized canvas:
  // For simplicity, when resizing we keep player.y as same value; this may slightly shift checkpoint visual but acceptable.
  // If you want to scale, we need extra logic — not requested.
});

/* ===========================
   INITIALIZATION: draw initial pause menu for UI
   =========================== */
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, W, H);
drawPauseMenu();
