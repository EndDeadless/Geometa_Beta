const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const bgMusic = document.getElementById('bgMusic');
const progressEl = document.getElementById('progress');
const attemptEl = document.getElementById('attempt');

const cpSetBtn = document.getElementById('cpSet');
const cpDelBtn = document.getElementById('cpDel');

let gameStarted = false;
let paused = false;
let attempt = 1;
let gameLoopId = null;

let practiceMode = false;
let checkpoints = [];

// ================= PLAYER =================
let player = {
    x: 100,
    y: H - 100,
    size: 50,
    vy: 0,
    gravity: 1,
    jump: -18,
    onGround: true,
    angle: 0
};

let cameraX = 0;
const speed = 6;

// ================= OBSTACLES =================
let obstacles = [];
function generateSpikes(){
    obstacles = [];
    let x = 500;
    for(let i=0;i<120;i++){
        x += 200 + Math.random()*100;
        obstacles.push({ x });
    }
}
generateSpikes();

// ================= INPUT =================
let holding = false;
function jump(){
    if(player.onGround){
        player.vy = player.jump;
        player.onGround = false;
    }
}

canvas.addEventListener('mousedown', ()=>{ holding=true; jump(); });
canvas.addEventListener('mouseup', ()=> holding=false);
canvas.addEventListener('touchstart', e=>{ e.preventDefault(); holding=true; jump(); });
canvas.addEventListener('touchend', ()=> holding=false);

window.addEventListener('keydown', e=>{
    if(e.code === 'Space') jump();
    if(practiceMode && e.code === 'KeyC') placeCheckpoint();
    if(practiceMode && e.code === 'KeyX') deleteCheckpoint();
});

// ================= CHECKPOINT =================
function placeCheckpoint(){
    checkpoints.push({
        x: player.x,
        y: player.y,
        vy: player.vy,
        onGround: player.onGround,
        angle: player.angle,
        cameraX: cameraX,
        music: bgMusic.currentTime
    });
}

function deleteCheckpoint(){
    if(checkpoints.length > 0) checkpoints.pop();
}

function respawnCheckpoint(){
    let cp = checkpoints[checkpoints.length - 1];
    player.x = cp.x;
    player.y = cp.y;
    player.vy = cp.vy;
    player.onGround = cp.onGround;
    player.angle = cp.angle;
    cameraX = cp.cameraX;
    bgMusic.currentTime = cp.music;
    bgMusic.play();
}

// ================= UPDATE =================
function updatePlayer(){
    player.vy += player.gravity;
    player.y += player.vy;

    const groundY = H - 50 - player.size;
    if(player.y >= groundY){
        player.y = groundY;
        player.vy = 0;
        player.onGround = true;
        if(holding) jump();
    }
}

function updateProgress(){
    if(bgMusic.duration){
        let percent = (bgMusic.currentTime / bgMusic.duration) * 100;
        progressEl.style.width = percent + "%";
        progressEl.textContent = Math.floor(percent) + "%";
    }
}

// ================= COLLISION =================
function hitSpike(o){
    let sx = o.x - cameraX;
    return (
        player.x + player.size > sx &&
        player.x < sx + 50 &&
        player.y + player.size > H - 100
    );
}

// ================= DRAW =================
function draw(){
    ctx.clearRect(0,0,W,H);

    // ground
    ctx.fillStyle = '#555';
    ctx.fillRect(0, H-50, W, 50);

    // spikes
    ctx.fillStyle = '#f00';
    obstacles.forEach(o=>{
        let sx = o.x - cameraX;
        if(sx < -50 || sx > W) return;
        ctx.beginPath();
        ctx.moveTo(sx, H-50);
        ctx.lineTo(sx+25, H-100);
        ctx.lineTo(sx+50, H-50);
        ctx.fill();
    });

    // checkpoints
    ctx.fillStyle = '#0f0';
    checkpoints.forEach(cp=>{
        let sx = cp.cameraX + cp.x - cameraX;
        ctx.beginPath();
        ctx.moveTo(sx, cp.y-10);
        ctx.lineTo(sx+10, cp.y);
        ctx.lineTo(sx, cp.y+10);
        ctx.lineTo(sx-10, cp.y);
        ctx.fill();
    });

    // player
    ctx.fillStyle = '#0f0';
    ctx.fillRect(player.x, player.y, player.size, player.size);
}

// ================= GAME LOOP =================
function gameLoop(){
    if(!gameStarted || paused) return;

    updatePlayer();
    cameraX += speed;
    updateProgress();
    draw();

    for(let o of obstacles){
        if(hitSpike(o)){
            attempt++;
            showAttempt();

            if(practiceMode && checkpoints.length > 0){
                setTimeout(respawnCheckpoint, 200);
            }else{
                setTimeout(resetGame, 600);
            }
            return;
        }
    }

    gameLoopId = requestAnimationFrame(gameLoop);
}

// ================= RESET =================
function resetGame(){
    cancelAnimationFrame(gameLoopId);
    player.y = H - 100;
    player.vy = 0;
    player.onGround = true;
    cameraX = 0;
    bgMusic.currentTime = 0;
    bgMusic.play();
    gameLoop();
}

// ================= UI =================
function showAttempt(){
    attemptEl.textContent = `Attempt ${attempt}`;
    attemptEl.style.opacity = 1;
    setTimeout(()=> attemptEl.style.opacity=0, 800);
}

startBtn.onclick = ()=>{
    attempt = 1;
    gameStarted = true;
    startBtn.style.display = 'none';
    bgMusic.play();
    showAttempt();
    gameLoop();
};

pauseBtn.onclick = ()=>{
    if(paused){
        paused=false; bgMusic.play(); gameLoop();
    }else{
        paused=true; bgMusic.pause();
    }
};

cpSetBtn.onclick = ()=> practiceMode && placeCheckpoint();
cpDelBtn.onclick = ()=> practiceMode && deleteCheckpoint();

window.onresize = ()=>{
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
};
