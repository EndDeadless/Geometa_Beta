const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// initial canvas size
function fitCanvas(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
fitCanvas();
let W = canvas.width, H = canvas.height;

// UI elements
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const bgMusic = document.getElementById('bgMusic');
const progressEl = document.getElementById('progress');
const attemptEl = document.getElementById('attempt');

const cpSetBtn = document.getElementById('cpSet');
const cpDelBtn = document.getElementById('cpDel');

// Game state
let attempt = 1;
let paused = false;
let gameStarted = false;
let gameLoopId = null;
let pauseMenuVisible = false;

// Player
let player = {
    x: 100,
    y: 0,        // will set based on H
    size: 50,
    vy: 0,
    gravity: 1,
    jump: -18,
    onGround: true,
    angle: 0,
    // freeze input flag to prevent accidental jumps during menu toggles/resets
    allowInput: true
};
player.y = H - 50 - player.size;

// Map / camera
const mapSpeedMax = 6;
let cameraX = 0;

// Obstacles (spikes)
let obstacles = [];
const spikeCount = 120;
function generateSpikes(){
    obstacles = [];
    let lastX = 500;
    for(let i=0;i<spikeCount;i++){
        let gap = 200 + Math.random()*100; // 200-300px
        lastX += gap;
        obstacles.push({x:lastX, type:'spike'});
    }
}
generateSpikes();

// Background parallax
const bgLayers = [
    {color:'#111', x:0, speed:0.2},
    {color:'#222', x:0, speed:0.5},
    {color:'#333', x:0, speed:1}
];

// Practice / Checkpoints
let practiceMode = false;           // bật practice hay ko
let practiceActiveButtons = false;  // 2 nút vuông hiển thị
let checkpoints = []; // mỗi checkpoint: { worldX, worldY, time }

// Input handling
let holding = false; // chuột/hold cho nhảy khi giữ
let pointerDown = false;

// Helpers
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function worldToScreenX(worldX){ return worldX - cameraX; }
function screenToWorldX(screenX){ return cameraX + screenX; }

// --- Jump / Input ---
function jump(){
    if(!player.allowInput) return;
    // chỉ được nhảy nếu đang chạm đất (giống geometry dash)
    if(player.onGround){
        player.vy = player.jump;
        player.onGround = false;
    }
}

// touch / mouse
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    pointerDown = true;
    jump();
});
canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    pointerDown = false;
});
canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    pointerDown = true;
    jump();
});
canvas.addEventListener('mouseup', (e) => {
    e.preventDefault();
    pointerDown = false;
});
canvas.addEventListener('mouseout', (e) => {
    pointerDown = false;
});

// keyboard (Space jump; c/x for practice only)
window.addEventListener('keydown', (e) => {
    if(e.code === 'Space'){ e.preventDefault(); jump(); }
    if(e.code === 'KeyC' && practiceMode){ // place checkpoint
        e.preventDefault();
        placeCheckpoint();
    }
    if(e.code === 'KeyX' && practiceMode){ // delete checkpoint
        e.preventDefault();
        deleteCheckpoint();
    }
});

// --- Player update ---
function updatePlayer(){
    player.vy += player.gravity;
    player.y += player.vy;

    // angle logic
    player.angle += (player.vy < 0) ? 10 : -5;
    player.angle = clamp(player.angle, -90, 90);

    const groundY = H - 50 - player.size;
    if(player.y >= groundY){
        player.y = groundY;
        player.vy = 0;
        player.onGround = true;
        player.angle = 0;
    } else {
        player.onGround = false;
    }
}

// --- Drawing ---
function drawBackground(){
    bgLayers.forEach(layer=>{
        layer.x -= layer.speed;
        if(layer.x <= -W) layer.x = 0;
        const grd = ctx.createLinearGradient(0,0,W,H);
        grd.addColorStop(0, layer.color);
        grd.addColorStop(1, '#000');
        ctx.fillStyle = grd;
        ctx.fillRect(layer.x,0,W,H);
        ctx.fillRect(layer.x+W,0,W,H);
    });
}

function drawGround(){
    ctx.fillStyle = "#555";
    ctx.fillRect(0, H-50, W, 50);
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
    for(let obs of obstacles){
        const screenX = obs.x - cameraX;
        if(screenX + 60 < 0 || screenX > W + 60) continue;
        ctx.fillStyle = '#f00';
        ctx.beginPath();
        ctx.moveTo(screenX, H-50);
        ctx.lineTo(screenX+25, H-50-50);
        ctx.lineTo(screenX+50, H-50);
        ctx.closePath();
        ctx.fill();
    }
}

function drawCheckpoints(){
    for(let cp of checkpoints){
        const screenX = cp.worldX - cameraX;
        if(screenX < -50 || screenX > W + 50) continue;
        // draw rhombus centered at cp.worldY
        const cx = screenX;
        const cy = cp.worldY;
        const r = 12;
        ctx.fillStyle = '#0f0';
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        ctx.fill();
    }
}

// --- Camera update ---
function updateCamera(){
    cameraX += mapSpeedMax;
}

// --- Progress bar update ---
function updateProgress(){
    if(!bgMusic.duration) return;
    const percent = clamp((bgMusic.currentTime / bgMusic.duration) * 100, 0, 100);
    progressEl.style.width = percent + "%";
    progressEl.textContent = Math.floor(percent) + "%";
}

// --- Collision ---
function checkCollisionSpike(spike){
    const px = player.x, py = player.y, ps = player.size;
    const sx = spike.x - cameraX, sy = H - 50 - 50, ss = 50;
    if(px + ps > sx + 5 && px < sx + ss - 5 && py + ps > sy + 10) return true;
    return false;
}

function checkCollision(){
    for(let obs of obstacles) if(checkCollisionSpike(obs)) return true;
    return false;
}

// --- Attempt display ---
function showAttempt(){
    attemptEl.textContent = `Attempt ${attempt}`;
    attemptEl.style.opacity = 1;
    let alpha = 1;
    const interval = setInterval(()=>{
        alpha -= 0.02;
        attemptEl.style.opacity = alpha;
        if(alpha <= 0){
            clearInterval(interval);
            attemptEl.style.opacity = 0;
        }
    }, 30);
}

// --- Reset full (to start) ---
function resetGameToStart(playMusic=true){
    // cancel loop first
    if(gameLoopId) cancelAnimationFrame(gameLoopId);
    // reset player & camera
    player.y = H - 50 - player.size;
    player.vy = 0;
    player.onGround = true;
    player.angle = 0;
    player.allowInput = true;
    cameraX = 0;
    // regenerate map
    generateSpikes();
    // reset music & progress
    try{
        bgMusic.currentTime = 0;
        if(playMusic) bgMusic.play();
    }catch(e){}
    progressEl.style.width = '0%';
    progressEl.textContent = '0%';
    // set gameStarted true to continue loop
    gameStarted = true;
    // run loop
    gameLoop();
}

// --- Respawn to last checkpoint (practice) ---
function respawnToLastCheckpoint(){
    if(checkpoints.length === 0){
        // if no checkpoint, behave like full reset in practice? The spec: when die in practice and no cp, reset to start
        resetGameToStart(true);
        return;
    }
    const last = checkpoints[checkpoints.length - 1];
    // set camera so that player's screen x is same: cameraX = worldX - player.x
    cameraX = last.worldX - player.x;
    // set player exact y and freeze vertical momentum
    player.y = last.worldY;
    player.vy = 0;
    player.onGround = (player.y >= H - 50 - player.size);
    player.angle = 0;
    player.allowInput = true;
    // set music time
    try{ bgMusic.currentTime = last.time || 0; }catch(e){}
    updateProgress();
    gameStarted = true;
    gameLoop();
}

// --- Checkpoint functions ---
function placeCheckpoint(){
    if(!practiceMode) return;
    // world position is cameraX + player.x
    const worldX = cameraX + player.x;
    const worldY = player.y;
    const time = bgMusic.currentTime || 0;
    checkpoints.push({worldX, worldY, time});
    // show small feedback
    flashCheckpointPlaced();
}

function deleteCheckpoint(){
    if(!practiceMode) return;
    if(checkpoints.length > 0){
        checkpoints.pop();
        flashCheckpointDeleted();
    }
}

// small visual feedback (fade text)
function flashCheckpointPlaced(){
    // reuse attemptEl area temporarily
    const old = attemptEl.textContent;
    attemptEl.textContent = "Checkpoint set";
    attemptEl.style.opacity = 1;
    setTimeout(()=>{ attemptEl.style.opacity = 0; attemptEl.textContent = old; }, 800);
}
function flashCheckpointDeleted(){
    const old = attemptEl.textContent;
    attemptEl.textContent = "Checkpoint deleted";
    attemptEl.style.opacity = 1;
    setTimeout(()=>{ attemptEl.style.opacity = 0; attemptEl.textContent = old; }, 800);
}

// --- Game loop ---
function gameLoop(){
    // stop if not started or paused
    if(!gameStarted || paused) return;
    ctx.clearRect(0,0,W,H);

    // draw
    drawBackground();
    drawGround();
    drawObstacles();
    drawCheckpoints();
    drawPlayer();

    // update
    updatePlayer();
    updateCamera();
    updateProgress();

    // collision handling
    if(checkCollision()){
        // collision happened
        // in practice mode: attempt must still increase (as requested)
        if(practiceMode){
            attempt++;
            showAttempt();
            // short delay then respawn to last checkpoint (or start)
            setTimeout(()=>{
                // respawn (keeps attempt increased)
                respawnToLastCheckpoint();
            }, 200);
            return;
        } else {
            // normal mode: full reset to start, attempt increases
            gameStarted = false;
            attempt++;
            showAttempt();
            setTimeout(()=>{ resetGameToStart(true); }, 800);
            return;
        }
    }

    // request next frame
    gameLoopId = requestAnimationFrame(gameLoop);
}

// --- UI: Start button ---
startBtn.addEventListener('click', ()=>{
    // start music and loop; handle play promise
    bgMusic.play().then(()=>{
        gameStarted = true;
        startBtn.style.display = "none";
        canvas.focus();
        attempt = 1; // fresh start
        showAttempt();
        gameLoop();
    }).catch((e)=>{
        // some browsers block autoplay; still start loop
        gameStarted = true;
        startBtn.style.display = "none";
        canvas.focus();
        attempt = 1;
        showAttempt();
        gameLoop();
    });
});

// --- Pause / Menu visuals ---
function drawPauseMenu(){
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0,0,W,H);
    // three circle icons centered
    drawCircleIcon(W/2 - 100, H/2, 40, '#fff', 'triangle', '#000'); // resume
    drawCircleIcon(W/2, H/2, 40, '#fff', 'arrow', '#000'); // restart
    drawCircleIcon(W/2 + 100, H/2, 40, practiceMode ? '#0a0' : '#fff', 'rhombus', practiceMode ? '#000' : '#0f0'); // practice toggle
}
function drawCircleIcon(x,y,r,bgColor,type,iconColor){
    ctx.fillStyle = bgColor;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = iconColor;
    ctx.beginPath();
    if(type === 'triangle'){
        ctx.moveTo(x - r/2, y - r/2); ctx.lineTo(x - r/2, y + r/2); ctx.lineTo(x + r/2, y); ctx.closePath();
    } else if(type === 'arrow'){
        ctx.arc(x,y,r/2,0,Math.PI*1.5); ctx.moveTo(x + r/2, y); ctx.lineTo(x + r/4, y - r/4); ctx.lineTo(x + r/4, y + r/4); ctx.closePath();
    } else if(type === 'rhombus'){
        ctx.moveTo(x, y - r/2); ctx.lineTo(x + r/2, y); ctx.lineTo(x, y + r/2); ctx.lineTo(x - r/2, y); ctx.closePath();
    }
    ctx.fill();
}

// show/hide pause menu
function showPauseMenu(){
    pauseMenuVisible = true;
    paused = true;
    bgMusic.pause();
    // draw menu overlay once
    drawPauseMenu();
    // freeze input
    player.allowInput = false;
}
function hidePauseMenu(){
    pauseMenuVisible = false;
    paused = false;
    // resume music and loop
    try{ bgMusic.play(); }catch(e){}
    player.allowInput = true;
    // if practice not active then hide practice buttons
    if(!practiceMode){
        cpSetBtn.style.display = 'none';
        cpDelBtn.style.display = 'none';
        practiceActiveButtons = false;
    }
    gameLoop();
}

pauseBtn.addEventListener('click', ()=>{
    if(pauseMenuVisible) hidePauseMenu(); else showPauseMenu();
});

// Canvas click helper (get relative coords)
function getCanvasPos(e){
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left), y: (e.clientY - rect.top) };
}

// Pause menu click handling (on canvas)
canvas.addEventListener('click', function(e){
    const pos = getCanvasPos(e);
    const mx = pos.x, my = pos.y;
    if(pauseMenuVisible){
        const cx = W/2 - 100, cy = H/2;
        const rx = W/2, ry = H/2;
        const px = W/2 + 100, py = H/2;
        // resume
        if(Math.hypot(mx - cx, my - cy) < 40){
            hidePauseMenu();
            return;
        }
        // restart
        if(Math.hypot(mx - rx, my - ry) < 40){
            // full reset to start, attempt reset to 1
            attempt = 1;
            showAttempt();
            resetGameToStart(true);
            hidePauseMenu();
            return;
        }
        // practice toggle
        if(Math.hypot(mx - px, my - py) < 40){
            // toggle practice mode
            practiceMode = !practiceMode;
            // When toggling practice mode (on or off), MUST reset game to start and reset attempt to 1
            attempt = 1;
            showAttempt();
            // clear or keep checkpoints?
            if(!practiceMode){
                // turning OFF practice: clear checkpoints and hide buttons
                checkpoints = [];
                cpSetBtn.style.display = 'none';
                cpDelBtn.style.display = 'none';
                practiceActiveButtons = false;
            } else {
                // turning ON practice: show the two square buttons
                cpSetBtn.style.display = 'flex';
                cpDelBtn.style.display = 'flex';
                practiceActiveButtons = true;
            }
            // Reset game to start (so entering practice always from 0%)
            resetGameToStart(true);
            // Auto close menu so player can continue immediately
            hidePauseMenu();
            return;
        }
    } else {
        // not in menu: clicking canvas acts as jump (handled already by mousedown), no menu actions.
    }
});

// --- Practice buttons (DOM) ---
// draw icons inside buttons (rhombus and crossed rhombus)
function drawRhombusInElement(el, crossed=false){
    const svgNS = "http://www.w3.org/2000/svg";
    el.innerHTML = '';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width','40'); svg.setAttribute('height','40'); svg.setAttribute('viewBox','0 0 40 40');
    const g = document.createElementNS(svgNS, 'g');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d','M20 5 L33 20 L20 35 L7 20 Z');
    path.setAttribute('fill', '#0f0');
    g.appendChild(path);
    if(crossed){
        const cross = document.createElementNS(svgNS, 'path');
        cross.setAttribute('d','M8 8 L32 32 M32 8 L8 32');
        cross.setAttribute('stroke','#000'); cross.setAttribute('stroke-width','3'); cross.setAttribute('stroke-linecap','round');
        g.appendChild(cross);
    }
    svg.appendChild(g);
    el.appendChild(svg);
}
drawRhombusInElement(cpSetBtn, false);
drawRhombusInElement(cpDelBtn, true);

// click handlers for cp buttons
cpSetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if(!practiceMode) return;
    placeCheckpoint();
});
cpDelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if(!practiceMode) return;
    deleteCheckpoint();
});

// make sure canvas focus for keyboard
canvas.addEventListener('click', ()=>{ canvas.focus(); });
canvas.setAttribute('tabindex','0');
canvas.focus();

// --- Resize handling ---
window.addEventListener('resize', ()=>{
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    // keep player on ground if needed
    const groundY = H - 50 - player.size;
    if(player.y > groundY) player.y = groundY;
});

// --- Initial draw (menu overlay) ---
ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
drawPauseMenu(); // show initial menu so user sees icons
