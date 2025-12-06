/* game.js — Full rebuilt for: progress top, pause menu animated, practice points, proper respawn. */

// ---------- CONFIG ----------
const MUSIC_URL = "https://raw.githubusercontent.com/enddeadless/assets/main/music/music.mp3";
// fallback if not available:
// const MUSIC_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3";

const CANVAS_ID = "gameCanvas";
const PROGRESS_FILL_ID = "progressFill";
const START_BTN_ID = "startBtn";
const PAUSE_BTN_ID = "pauseBtn";
const BG_MUSIC_ID = "bgMusic";
const ATTEMPT_ID = "attempt";
const PRACTICE_UI_ID = "practiceUI";
const PLACE_RESPAWN_ID = "placeRespawn";
const REMOVE_RESPAWN_ID = "removeRespawn";

// gameplay params
const PLAYER_SIZE = 50;
const GRAVITY = 1.0;
const JUMP_V = -18;
const MAP_SPEED = 6; // camera speed independent of music
const SPIKE_W = 50;
const SPIKE_H = 50;
const NUM_SPIKES = 80;
const SPIKE_GAP_MIN = 200;   // you asked larger gaps; final set
const SPIKE_GAP_RANGE = 100; // so gap random in [200,300]

// pause menu circle icon radius
const PAUSE_BTN_RADIUS = 40;

// ---------- DOM + CANVAS ----------
const canvas = document.getElementById(CANVAS_ID);
const ctx = canvas.getContext("2d");
let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;

const progressFill = document.getElementById(PROGRESS_FILL_ID);
const startBtn = document.getElementById(START_BTN_ID);
const pauseBtn = document.getElementById(PAUSE_BTN_ID);
const bgMusic = document.getElementById(BG_MUSIC_ID);
const attemptEl = document.getElementById(ATTEMPT_ID);
const practiceUI = document.getElementById(PRACTICE_UI_ID);
const placeRespawnBtn = document.getElementById(PLACE_RESPAWN_ID);
const removeRespawnBtn = document.getElementById(REMOVE_RESPAWN_ID);

// attach music url
bgMusic.src = MUSIC_URL;

// ---------- STATE ----------
let attempt = 1;
let gameStarted = false;
let paused = false;
let practiceMode = false;

let cameraX = 0;
let player = {
  x: 100,
  y: H - 100,
  size: PLAYER_SIZE,
  vy: 0,
  onGround: true,
  angle: 0
};

let obstacles = []; // {x, type:'spike'}
let respawnPoints = []; // {cameraX, musicTime, percent}

// loops
let gameLoopId = null;
let menuLoopId = null;

// hover tracking for pause menu
let pauseMenuVisible = false;
let mouse = {x: 0, y: 0, overIndex: -1}; // overIndex: 0 resume,1 restart,2 practice

// ---------- UTIL & GENERATE ----------
function generateSpikes() {
  obstacles = [];
  let lastX = 500;
  for (let i = 0; i < NUM_SPIKES; i++) {
    const gap = SPIKE_GAP_MIN + Math.random() * SPIKE_GAP_RANGE; // 200..300
    lastX += gap;
    obstacles.push({ x: lastX, type: "spike" });
  }
}

// simple clamp
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ---------- DRAW HELPERS ----------
function clear() { ctx.clearRect(0, 0, W, H); }

function drawParallax() {
  // simple color bands as background layers (kept simple)
  const layers = [
    { color: "#0a0a0f", speed: 0.2 },
    { color: "#0f0f14", speed: 0.5 },
    { color: "#14141a", speed: 1 }
  ];
  layers.forEach((layer, idx) => {
    // small loop offset effect based on cameraX for nicer movement
    const offset = (cameraX * (layer.speed * 0.02)) % W;
    ctx.fillStyle = layer.color;
    ctx.fillRect(-offset, 0, W, H);
    ctx.fillRect(W - offset, 0, W, H);
  });
}

function drawGround() {
  ctx.fillStyle = "#444";
  ctx.fillRect(0, H - 50, W, 50);
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x + player.size / 2, player.y + player.size / 2);
  ctx.rotate((player.angle * Math.PI) / 180);
  ctx.fillStyle = "#18ff6b";
  ctx.shadowColor = "#18ff6b";
  ctx.shadowBlur = 12;
  ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size);
  ctx.restore();
  ctx.shadowBlur = 0;
}

function drawSpikes() {
  ctx.fillStyle = "#FF3B3B";
  obstacles.forEach(o => {
    const sx = o.x - cameraX;
    if (sx > -SPIKE_W && sx < W + SPIKE_W) {
      ctx.beginPath();
      ctx.moveTo(sx, H - 50);
      ctx.lineTo(sx + SPIKE_W / 2, H - 50 - SPIKE_H);
      ctx.lineTo(sx + SPIKE_W, H - 50);
      ctx.closePath();
      ctx.fill();
    }
  });
}

// ---------- PHYSICS & UPDATES ----------
function updatePlayer(dt) {
  player.vy += GRAVITY;
  player.y += player.vy;
  // rotation: tilt up when vy<0, tilt down when falling
  player.angle += player.vy < 0 ? 12 * (dt / (1000 / 60)) : -6 * (dt / (1000 / 60));
  player.angle = clamp(player.angle, -90, 90);

  const groundY = H - 50 - player.size;
  if (player.y >= groundY) {
    player.y = groundY;
    player.vy = 0;
    if (!player.onGround) {
      player.onGround = true;
      // immediate auto-jump only while holding
      if (input.holding) tryJump();
    }
  } else {
    player.onGround = false;
  }
}

function updateCamera(dt) {
  cameraX += MAP_SPEED * (dt / (1000 / 60)); // smoother/time-corrected
}

// collision detection—triangle-approx with padding to avoid early kills
function collisionWithSpike(spike) {
  let px = player.x, py = player.y, ps = player.size;
  let sx = spike.x - cameraX, sy = H - 50 - SPIKE_H, ss = SPIKE_W;
  // quick bounding box check first
  if (px + ps <= sx + 6 || px >= sx + ss - 6) return false;
  if (py + ps <= sy + 6) return false;
  // now require hitting low-center (near triangle top)
  // compute relative x center
  const cx = px + ps / 2;
  // triangle apex x ~ sx+ss/2; require center x inside small central band OR bottom overlap
  if (cx > sx + 8 && cx < sx + ss - 8 && (py + ps) > sy + 10) return true;
  return false;
}

function checkCollisions() {
  for (let o of obstacles) {
    if (collisionWithSpike(o)) return true;
  }
  return false;
}

// ---------- INPUT ----------
const input = { holding: false };

// mouse / touch / key handlers
canvas.addEventListener("mousedown", () => { input.holding = true; tryJump(); });
canvas.addEventListener("mouseup", () => { input.holding = false; });
canvas.addEventListener("touchstart", (e) => { e.preventDefault(); input.holding = true; tryJump(); }, {passive:false});
canvas.addEventListener("touchend", (e) => { e.preventDefault(); input.holding = false; }, {passive:false});
window.addEventListener("keydown", (e) => { if (e.code === "Space") tryJump(); });

// tryJump only triggers if on ground (GeometryDash style)
function tryJump() {
  if (player.onGround) {
    player.vy = JUMP_V;
    player.onGround = false;
  }
}

// ---------- PROGRESS (music-linked) ----------
function updateProgressDom() {
  if (!bgMusic || !bgMusic.duration) return;
  const percent = Math.min(100, (bgMusic.currentTime / bgMusic.duration) * 100);
  progressFill.style.width = percent + "%";
  progressFill.textContent = Math.floor(percent) + "%";
}

// ---------- ATTEMPT UI ----------
function showAttempt() {
  attemptEl.textContent = `Attempt ${attempt}`;
  attemptEl.style.opacity = "1";
  setTimeout(() => { attemptEl.style.opacity = "0"; }, 1100);
}

// ---------- RESPAWN / RESET ----------
function resetToStart() {
  // stop loops
  cancelAnimationFrame(gameLoopId);
  cancelAnimationFrame(menuLoopId);
  // reset states
  cameraX = 0;
  player.y = H - 50 - player.size;
  player.vy = 0;
  player.onGround = true;
  player.angle = 0;
  generateSpikes();
  // reset music & progress
  try { bgMusic.currentTime = 0; bgMusic.play().catch(()=>{}); } catch(e){}
  updateProgressDom();
  // restart game after small delay
  setTimeout(() => { gameStarted = true; paused = false; startGameLoop(); }, 120);
}

function respawnAtPoint(point) {
  // stop loops
  cancelAnimationFrame(gameLoopId);
  cancelAnimationFrame(menuLoopId);
  // set camera and music position exactly
  cameraX = point.cameraX;
  try { bgMusic.currentTime = point.musicTime; bgMusic.play().catch(()=>{}); } catch(e){}
  // reset player
  player.y = H - 50 - player.size;
  player.vy = 0;
  player.onGround = true;
  player.angle = 0;
  // continue
  setTimeout(()=> { gameStarted = true; paused = false; startGameLoop(); }, 120);
}

// ---------- PAUSE MENU RENDER & INTERACTION ----------
// We will render pause menu on a separate loop (menuLoop). Hover detection uses mouse coords
canvas.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (pauseMenuVisible) {
    // determine hover index
    const centers = [
      {x: W/2 - 100, y: H/2},
      {x: W/2,       y: H/2},
      {x: W/2 + 100, y: H/2}
    ];
    mouse.overIndex = -1;
    centers.forEach((c,i) => {
      if (Math.hypot(mouse.x - c.x, mouse.y - c.y) < PAUSE_BTN_RADIUS) mouse.overIndex = i;
    });
  }
});

canvas.addEventListener("click", (e) => {
  // Pause menu clicks
  if (pauseMenuVisible) {
    const centers = [
      {x: W/2 - 100, y: H/2},
      {x: W/2,       y: H/2},
      {x: W/2 + 100, y: H/2}
    ];
    for (let i=0;i<centers.length;i++){
      if (Math.hypot(e.clientX - centers[i].x, e.clientY - centers[i].y) < PAUSE_BTN_RADIUS) {
        if (i===0) { hidePauseMenu(); }         // resume
        if (i===1) { attempt = 1; resetToStart(); hidePauseMenu(); } // restart (sets attempt back? original wanted attempt++ only on death; restart resets attempt)
        if (i===2) { practiceMode = !practiceMode; updatePracticeUI(); hidePauseMenu(); }
        return;
      }
    }
  }
});

// show/hide pause menu controlled by pauseBtn
pauseBtn.addEventListener("click", () => {
  if (!pauseMenuVisible) showPauseMenu(); else hidePauseMenu();
});

function showPauseMenu(){
  pauseMenuVisible = true;
  paused = true;
  bgMusic.pause();
  // cancel game loop render so menu owns canvasing
  cancelAnimationFrame(gameLoopId);
  startMenuLoop();
}

function hidePauseMenu(){
  pauseMenuVisible = false;
  paused = false;
  cancelAnimationFrame(menuLoopId);
  try { bgMusic.play().catch(()=>{}); } catch(e){}
  startGameLoop();
}

// renders the menu continuously (for hover/scale)
function startMenuLoop() {
  function menuFrame() {
    if (!pauseMenuVisible) return;
    clear();
    drawParallax();
    drawGround();
    drawSpikes();
    drawPlayer();
    // progress on top (we draw DOM progress separately, but keep it updated)
    updateProgressDom();
    // dark overlay
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, W, H);
    // draw 3 circular buttons with icons, apply scale on hover
    const centerY = H/2;
    const centers = [{x:W/2-100,y:centerY},{x:W/2,y:centerY},{x:W/2+100,y:centerY}];
    centers.forEach((c,i) => {
      const isHover = mouse.overIndex === i;
      const scale = isHover ? 1.18 : 1.0;
      const r = PAUSE_BTN_RADIUS * scale;
      // circle background (white)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI*2); ctx.fill();
      // draw icon
      ctx.fillStyle = (i===2 ? "#19ff72" : "#000000"); // green rhombus for practice, black for others
      ctx.save();
      ctx.translate(c.x, c.y);
      if (i===0) { // triangle
        ctx.beginPath(); ctx.moveTo(-r*0.45, -r*0.45); ctx.lineTo(-r*0.45, r*0.45); ctx.lineTo(r*0.45, 0); ctx.closePath(); ctx.fill();
      } else if (i===1) { // curved arrow (simple)
        ctx.strokeStyle = "#000"; ctx.lineWidth = 4; ctx.beginPath();
        ctx.arc(0,0,r*0.5, 0.1*Math.PI, 1.3*Math.PI); ctx.stroke();
        // arrow head
        ctx.beginPath(); ctx.moveTo(r*0.5,0); ctx.lineTo(r*0.25,-r*0.18); ctx.lineTo(r*0.25,r*0.18); ctx.closePath(); ctx.fillStyle="#000"; ctx.fill();
      } else { // rhombus
        ctx.beginPath(); ctx.moveTo(0,-r*0.45); ctx.lineTo(r*0.45,0); ctx.lineTo(0,r*0.45); ctx.lineTo(-r*0.45,0); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    });

    menuLoopId = requestAnimationFrame(menuFrame);
  }
  menuFrame();
}

// ---------- PRACTICE UI (HTML buttons) ----------
function updatePracticeUI(){
  if (practiceMode) {
    practiceUI.style.display = "flex";
    // enable buttons pointer events already set in CSS
  } else {
    practiceUI.style.display = "none";
  }
}

// place respawn point (store cameraX and musicTime)
placeRespawnBtn.addEventListener("click", () => {
  if (!practiceMode) return;
  // clamp cameraX >= 0
  const musicTime = bgMusic.duration ? bgMusic.currentTime : 0;
  respawnPoints.push({
    cameraX: Math.max(0, cameraX),
    musicTime: musicTime,
    percent: bgMusic.duration ? (musicTime / bgMusic.duration) : 0
  });
  flashToast(`Placed respawn #${respawnPoints.length} (${Math.floor((respawnPoints[respawnPoints.length-1].percent*100))}%)`);
});

// remove last respawn
removeRespawnBtn.addEventListener("click", () => {
  if (!practiceMode) return;
  if (respawnPoints.length === 0) { flashToast("No respawn to remove"); return; }
  respawnPoints.pop();
  flashToast(`Removed last respawn, now ${respawnPoints.length} left`);
});

// tiny toast helper (attemptEl used briefly)
function flashToast(msg) {
  attemptEl.textContent = msg;
  attemptEl.style.opacity = "1";
  setTimeout(()=> attemptEl.style.opacity = "0", 1100);
}

// ---------- MAIN GAME LOOP ----------
let lastTime = performance.now();
function startGameLoop() {
  lastTime = performance.now();
  function frame(now) {
    if (!gameStarted || paused) return;
    const dt = Math.min(40, now - lastTime); // cap delta
    lastTime = now;
    // update
    updatePlayer(dt);
    updateCamera(dt);
    // draw
    clear();
    drawParallax();
    drawGround();
    drawSpikes();
    drawPlayer();
    // dom progress update
    updateProgressDom();
    // collision
    if (checkCollisions()) {
      // handle death
      gameStarted = false;
      attempt++;
      showAttempt();
      // if practice and have respawn -> respawn
      if (practiceMode && respawnPoints.length > 0) {
        setTimeout(() => { respawnAtPoint(respawnPoints[respawnPoints.length - 1]); }, 400);
      } else {
        setTimeout(() => { resetToStart(); }, 700);
      }
      return;
    }

    gameLoopId = requestAnimationFrame(frame);
  }
  gameLoopId = requestAnimationFrame(frame);
}

// ---------- START / PAUSE BUTTONS ----------
startBtn.addEventListener("click", () => {
  // start music and game
  bgMusic.play().catch(()=>{ /* some browsers block autoplay until user interacts: clicking Start is a user gesture so should work */ });
  startBtn.style.display = "none";
  gameStarted = true; paused = false;
  updatePracticeUI();
  startGameLoop();
});

pauseBtn.addEventListener("click", () => {
  if (!pauseMenuVisible) showPauseMenu();
  else hidePauseMenu();
});

// keep DOM progress synced even when menu visible
bgMusic.addEventListener("timeupdate", updateProgressDom);

// handle resize
window.addEventListener("resize", () => {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  // keep player on ground after resize
  player.y = Math.min(player.y, H - 50 - player.size);
});

// ---------- INITIAL SETUP ----------
(function init(){
  // seed obstacles
  generateSpikes();
  // UI initial
  updatePracticeUI();
  // attempt hidden initial
  attemptEl.style.opacity = "0";
  // If music fails to load, set fallback to MDN sample
  bgMusic.onerror = () => {
    console.warn("Music failed to load; falling back to sample.");
    bgMusic.src = "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3";
    bgMusic.load();
  };
})();
