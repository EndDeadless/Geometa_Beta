// game.js (cập nhật - hỗ trợ Practice Mode + Checkpoints + fix nhảy + menu click coords)
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

let attempt = 1;
let paused = false;
let gameStarted = false;
let gameLoopId;

// Player
let player = {x:100, y:H-100, size:50, vy:0, gravity:1, jump:-18, onGround:true, angle:0};
const mapSpeedMax = 6;
let cameraX = 0;

// Obstacles
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
    {color:'#111',x:0,speed:0.2},
    {color:'#222',x:0,speed:0.5},
    {color:'#333',x:0,speed:1}
];

// Practice / Checkpoints
let practiceMode = false;           // đang ở practice (kỹ thuật)
let practiceActiveButtons = false;  // 2 nút vuông hiển thị
let checkpoints = []; // mảng các checkpoint: { worldX, time }
function placeCheckpoint(){
    // store worldX = cameraX + player.x so that map placement aligns with player screen pos
    const worldX = cameraX + player.x;
    const time = bgMusic.currentTime || 0;
    checkpoints.push({worldX, time});
    // show icon (drawn in render loop)
}
function deleteCheckpoint(){
    if(checkpoints.length>0) checkpoints.pop();
}

// Controls
let holding=false;
canvas.addEventListener('touchstart',(e)=>{ e.preventDefault(); holding=true; jump(); });
canvas.addEventListener('touchend',(e)=>{ e.preventDefault(); holding=false; });
canvas.addEventListener('mousedown',(e)=>{ e.preventDefault(); holding=true; jump(); });
canvas.addEventListener('mouseup',(e)=>{ e.preventDefault(); holding=false; });
canvas.addEventListener('mouseout',()=>{ holding=false; });

window.addEventListener('keydown',e=>{
    if(e.code==='Space'){ e.preventDefault(); jump(); }
});

function jump(){ if(player.onGround){ player.vy = player.jump; player.onGround=false; } }

// Player update
function updatePlayer(){
    player.vy += player.gravity;
    player.y += player.vy;
    player.angle += player.vy<0?10:-5;
    if(player.angle>90) player.angle=90;
    if(player.angle<-90) player.angle=-90;
    const groundY = H-50-player.size;
    if(player.y>=groundY){
        player.y=groundY; player.vy=0; player.onGround=true; player.angle=0; if(holding) jump();
    } else player.onGround=false;
}

// Draw
function drawBackground(){
    bgLayers.forEach(layer=>{
        layer.x -= layer.speed;
        if(layer.x <= -W) layer.x = 0;
        let grd = ctx.createLinearGradient(0,0,W,H);
        grd.addColorStop(0, layer.color);
        grd.addColorStop(1, '#000');
        ctx.fillStyle = grd;
        ctx.fillRect(layer.x,0,W,H);
        ctx.fillRect(layer.x+W,0,W,H);
    });
}
function drawPlayer(){
    ctx.save();
    ctx.translate(player.x+player.size/2,player.y+player.size/2);
    ctx.rotate(player.angle*Math.PI/180);
    ctx.fillStyle="#0f0";
    ctx.fillRect(-player.size/2,-player.size/2,player.size,player.size);
    ctx.restore();
}
function drawGround(){ ctx.fillStyle="#555"; ctx.fillRect(0,H-50,W,50); }
function drawObstacles(){
    obstacles.forEach(obs=>{
        let screenX = obs.x - cameraX;
        if(screenX+50<0||screenX>W) return;
        ctx.fillStyle = '#f00';
        ctx.beginPath();
        ctx.moveTo(screenX,H-50);
        ctx.lineTo(screenX+25,H-50-50);
        ctx.lineTo(screenX+50,H-50);
        ctx.closePath();
        ctx.fill();
    });
}
function drawCheckpoints(){
    // draw rhombus (hình thoi) green at world position
    checkpoints.forEach(cp=>{
        let screenX = cp.worldX - cameraX;
        if(screenX < -50 || screenX > W + 50) return;
        // draw rhombus
        const cx = screenX + 0; // center x
        const cy = H - 50 - 80; // slightly above ground
        const r = 12;
        ctx.fillStyle = '#0f0';
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        ctx.fill();
    });
}

// Camera
function updateCamera(){
    cameraX += mapSpeedMax;
}

// Progress
function updateProgress(){
    if(!bgMusic.duration) return;
    let percent = Math.min((bgMusic.currentTime/bgMusic.duration)*100,100);
    progressEl.style.width = percent + "%";
    progressEl.textContent = Math.floor(percent) + "%";
}

// Collision
function checkCollisionSpike(spike){
    let px=player.x,py=player.y,ps=player.size;
    let sx=spike.x-cameraX,sy=H-50-50,ss=50;
    if(px+ps>sx+5 && px<sx+ss-5 && py+ps>sy+10) return true;
    return false;
}
function checkCollision(){
    for(let obs of obstacles) if(checkCollisionSpike(obs)) return true;
    return false;
}

// Attempt display
function showAttempt(){
    attemptEl.textContent = `Attempt ${attempt}`;
    attemptEl.style.opacity = 1;
    let alpha = 1;
    let interval = setInterval(()=>{
        alpha -= 0.02;
        attemptEl.style.opacity = alpha;
        if(alpha<=0){ clearInterval(interval); attemptEl.style.opacity = 0; }
    },30);
}

// Reset (full reset to start)
function resetGame(){
    cancelAnimationFrame(gameLoopId);
    player.y = H-100; player.vy=0; player.onGround=true; player.angle=0; cameraX=0;
    generateSpikes();
    bgMusic.currentTime = 0;
    try{ bgMusic.play(); }catch(e){}
    progressEl.style.width = '0%'; progressEl.textContent='0%';
    gameStarted = true;
    gameLoop();
}

// Respawn to last checkpoint (practice)
function respawnToLastCheckpoint(){
    const last = checkpoints[checkpoints.length-1];
    if(!last) return resetGame();
    // set camera so that player's screen x is same: cameraX = worldX - player.x
    cameraX = last.worldX - player.x;
    // set player on ground and reset velocity
    player.y = H-50-player.size; player.vy = 0; player.onGround = true; player.angle = 0;
    // set music time
    bgMusic.currentTime = last.time || 0;
    // ensure progress updated
    updateProgress();
    gameStarted = true;
    // continue game loop
    gameLoop();
}

// Game loop
function gameLoop(){
    if(!gameStarted || paused) return;
    ctx.clearRect(0,0,W,H);
    drawBackground();
    drawGround();
    drawObstacles();
    drawCheckpoints();
    drawPlayer();
    updatePlayer();
    updateCamera();
    updateProgress();

    if(checkCollision()){
        // collision happened
        if(practiceMode && checkpoints.length>0){
            // do NOT full restart: go to last checkpoint
            attempt++;
            showAttempt();
            // small delay to show attempt then respawn
            setTimeout(()=>{ respawnToLastCheckpoint(); }, 300);
            return;
        } else {
            // normal behavior: full reset
            gameStarted = false;
            attempt++;
            showAttempt();
            setTimeout(resetGame,1000);
            return;
        }
    }

    gameLoopId = requestAnimationFrame(gameLoop);
}

// UI: start
startBtn.addEventListener('click',()=>{
    bgMusic.play().then(()=>{
        gameStarted=true;
        startBtn.style.display="none";
        canvas.focus();
        showAttempt();
        gameLoop();
    }).catch(e=>{
        gameStarted=true;
        startBtn.style.display="none";
        canvas.focus();
        showAttempt();
        gameLoop();
    });
});

// Pause menu animation + icons
let pauseMenuVisible=false;
function showPauseMenu(){
    pauseMenuVisible=true;
    paused=true;
    bgMusic.pause();
    drawPauseMenu();
}
function hidePauseMenu(){
    pauseMenuVisible=false;
    paused=false;
    bgMusic.play();
    // hide practice buttons only if practice mode not active
    if(!practiceMode){ cpSetBtn.style.display='none'; cpDelBtn.style.display='none'; practiceActiveButtons=false; }
    // continue game loop
    gameLoop();
}
pauseBtn.addEventListener('click',()=>{ if(pauseMenuVisible) hidePauseMenu(); else showPauseMenu(); });

function drawPauseMenu(){
    // draw immediately onto canvas (one-frame overlay)
    ctx.fillStyle='rgba(0,0,0,0.7)';
    ctx.fillRect(0,0,W,H);
    // Resume (triangle)
    drawCircleIcon(W/2-100,H/2,40,'#fff','triangle','#000');
    // Restart (arrow)
    drawCircleIcon(W/2,H/2,40,'#fff','arrow','#000');
    // Practice toggle (rhombus)
    drawCircleIcon(W/2+100,H/2,40, practiceMode? '#0a0' : '#fff','rhombus', practiceMode? '#000' : '#0f0');
}
function drawCircleIcon(x,y,r,bgColor,type,iconColor){
    ctx.fillStyle=bgColor; ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=iconColor; ctx.beginPath();
    if(type==='triangle'){
        ctx.moveTo(x-r/2,y-r/2); ctx.lineTo(x-r/2,y+r/2); ctx.lineTo(x+r/2,y); ctx.closePath();
    } else if(type==='arrow'){
        ctx.arc(x,y,r/2,0,Math.PI*1.5); ctx.moveTo(x+r/2,y); ctx.lineTo(x+r/4,y-r/4); ctx.lineTo(x+r/4,y+r/4); ctx.closePath();
    } else if(type==='rhombus'){
        ctx.moveTo(x,y-r/2); ctx.lineTo(x+r/2,y); ctx.lineTo(x,y+r/2); ctx.lineTo(x-r/2,y); ctx.closePath();
    }
    ctx.fill();
}

// canvas click coordinates helper (use bounding rect)
function getCanvasPos(e){
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left), y: (e.clientY - rect.top) };
}

// Pause Menu click handling and other canvas clicks
canvas.addEventListener('click',function(e){
    const pos = getCanvasPos(e);
    const mx = pos.x, my = pos.y;
    if(pauseMenuVisible){
        const cx = W/2 - 100, cy = H/2;
        const rx = W/2, ry = H/2;
        const px = W/2 + 100, py = H/2;
        if(Math.hypot(mx - cx, my - cy) < 40){ // Resume
            hidePauseMenu();
            return;
        }
        if(Math.hypot(mx - rx, my - ry) < 40){ // Restart
            resetGame();
            hidePauseMenu();
            return;
        }
        if(Math.hypot(mx - px, my - py) < 40){ // Practice toggle
            // toggle practice mode
            practiceMode = !practiceMode;
            // when enabling practice mode -> show the two square buttons
            if(practiceMode){
                cpSetBtn.style.display = 'flex';
                cpDelBtn.style.display = 'flex';
                practiceActiveButtons = true;
            } else {
                cpSetBtn.style.display = 'none';
                cpDelBtn.style.display = 'none';
                practiceActiveButtons = false;
                checkpoints = []; // optional: clear checkpoints when exit practice (you wanted when exit play from start)
            }
            // redraw pause menu to update practice icon color
            drawPauseMenu();
            return;
        }
    } else {
        // If not in pause menu, clicks on canvas should be treated as gameplay input; already handled by mousedown/up
    }
});

// Practice buttons (square) - using DOM elements for simpler hitboxes and crisp icons
function drawRhombusInElement(el, crossed=false){
    // create inner SVG for icon
    const svgNS = "http://www.w3.org/2000/svg";
    el.innerHTML = ''; // clear
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width','40'); svg.setAttribute('height','40'); svg.setAttribute('viewBox','0 0 40 40');
    const g = document.createElementNS(svgNS, 'g');
    // rhombus path
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

// cpSet and cpDel click handlers
cpSetBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    if(!practiceMode) return;
    placeCheckpoint();
});
cpDelBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    if(!practiceMode) return;
    deleteCheckpoint();
});

// make sure canvas gets focus so space works
canvas.addEventListener('click',()=>{ canvas.focus(); });

// Resize handling
window.addEventListener('resize',()=>{
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    // reposition practice buttons (CSS uses calc so it's responsive)
});

// Fix initial focus
canvas.setAttribute('tabindex','0');
canvas.focus();

// Start bgMusic on user gesture if available
// (Handled on Start button click)

// Initial draw (menu)
ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
drawPauseMenu();
