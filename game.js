const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const bgMusic = document.getElementById('bgMusic');
const progressEl = document.getElementById('progress');
const attemptEl = document.getElementById('attempt');

let attempt = 1;
let paused = false;
let gameStarted = false;
let practiceMode = false;
let gameLoopId;

// Player
let player = {x:100, y:H-100, size:50, vy:0, gravity:1, jump:-18, onGround:true, angle:0};
const mapSpeedMax = 6;
let cameraX = 0;

// Practice points
let respawnPoints = [];

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

// Controls
let holding=false;
canvas.addEventListener('touchstart',()=>{holding=true;jump();});
canvas.addEventListener('touchend',()=>{holding=false;});
canvas.addEventListener('mousedown',()=>{holding=true;jump();});
canvas.addEventListener('mouseup',()=>{holding=false;});
window.addEventListener('keydown',e=>{if(e.code==='Space') jump();});

// Jump logic
function jump(){
    if(player.onGround){
        player.vy = player.jump;
        player.onGround=false;
    }
}

// Player update
function updatePlayer(){
    player.vy += player.gravity;
    player.y += player.vy;
    player.angle += player.vy<0 ? 10 : -5;
    if(player.angle>90) player.angle=90;
    if(player.angle<-90) player.angle=-90;

    const groundY = H-50-player.size;
    if(player.y>=groundY){
        player.y = groundY;
        player.vy=0;
        player.onGround=true;
        player.angle=0;
        if(holding) jump();
    } else {
        player.onGround=false;
    }
}

// Draw functions
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
    ctx.translate(player.x+player.size/2, player.y+player.size/2);
    ctx.rotate(player.angle*Math.PI/180);
    ctx.fillStyle="#0f0";
    ctx.fillRect(-player.size/2,-player.size/2,player.size,player.size);
    ctx.restore();
}

function drawGround(){
    ctx.fillStyle="#555";
    ctx.fillRect(0,H-50,W,50);
}

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

// Camera update
function updateCamera(){
    cameraX += mapSpeedMax;
}

// Progress bar
function updateProgress(){
    if(!bgMusic.duration) return;
    let percent = Math.min((bgMusic.currentTime/bgMusic.duration)*100,100);
    progressEl.style.width = percent+"%";
    progressEl.textContent = Math.floor(percent)+"%";
}

// Collision
function checkCollisionSpike(spike){
    let px=player.x, py=player.y, ps=player.size;
    let sx=spike.x-cameraX, sy=H-50-50, ss=50;
    // padding nhỏ để player phải chạm phần nhọn mới thua
    if(px+ps>sx+5 && px<sx+ss-5 && py+ps>sy+10) return true;
    return false;
}

function checkCollision(){
    for(let obs of obstacles){
        if(checkCollisionSpike(obs)) return true;
    }
    return false;
}

// Attempt display
function showAttempt(){
    attemptEl.textContent = `Attempt ${attempt}`;
    attemptEl.style.opacity = 1;
    let alpha=1;
    let interval = setInterval(()=>{
        alpha -= 0.02;
        attemptEl.style.opacity = alpha;
        if(alpha<=0) clearInterval(interval);
    },30);
}

// Reset game after fail
function resetGame(){
    cancelAnimationFrame(gameLoopId);
    player.y = H-100;
    player.vy=0;
    player.onGround=true;
    player.angle=0;
    cameraX=0;
    if(!practiceMode) respawnPoints = [];
    generateSpikes();
    bgMusic.currentTime = 0;
    bgMusic.play();
    progressEl.style.width = '0%';
    progressEl.textContent = '0%';
    gameStarted=true;
    gameLoop();
}

// Respawn at practice point
function respawnPractice(){
    if(respawnPoints.length===0){
        resetGame();
        return;
    }
    const lastPoint = respawnPoints[respawnPoints.length-1];
    player.y = H-100;
    player.vy=0;
    player.onGround=true;
    player.angle=0;
    cameraX = lastPoint.cameraX;
    bgMusic.currentTime = lastPoint.musicTime;
    gameStarted=true;
    gameLoop();
}

// Game loop
function gameLoop(){
    if(!gameStarted || paused) return;
    ctx.clearRect(0,0,W,H);
    drawBackground();
    drawGround();
    drawObstacles();
    drawPlayer();
    updatePlayer();
    updateCamera();
    updateProgress();
    if(checkCollision()){
        gameStarted=false;
        attempt++;
        showAttempt();
        if(practiceMode && respawnPoints.length>0){
            setTimeout(respawnPractice,500);
        } else {
            setTimeout(resetGame,1000);
        }
        return;
    }
    gameLoopId = requestAnimationFrame(gameLoop);
}

// Keep jump while holding
function holdJump(){
    if(!paused) if(holding) jump();
    requestAnimationFrame(holdJump);
}

// Start game
startBtn.addEventListener('click',()=>{
    bgMusic.play().then(()=>{
        gameStarted=true;
        startBtn.style.display="none";
        showAttempt();
        gameLoop();
        holdJump();
    }).catch(e=>{
        console.log("Music blocked:", e);
        gameStarted=true;
        startBtn.style.display="none";
        showAttempt();
        gameLoop();
        holdJump();
    });
});

// Pause menu
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
    gameLoop();
    holdJump();
}

pauseBtn.addEventListener('click',()=>{
    if(pauseMenuVisible) hidePauseMenu();
    else showPauseMenu();
});

// Draw Pause Menu with icons
function drawPauseMenu(){
    ctx.fillStyle='rgba(0,0,0,0.7)';
    ctx.fillRect(0,0,W,H);

    // Resume button (triangle)
    ctx.fillStyle='#fff';
    ctx.beginPath();
    ctx.arc(W/2-100,H/2,40,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#000';
    ctx.beginPath();
    ctx.moveTo(W/2-110,H/2-20);
    ctx.lineTo(W/2-110,H/2+20);
    ctx.lineTo(W/2-70,H/2);
    ctx.closePath();
    ctx.fill();

    // Restart button (circle arrow)
    ctx.fillStyle='#fff';
    ctx.beginPath();
    ctx.arc(W/2,H/2,40,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle='#000';
    ctx.lineWidth=5;
    ctx.beginPath();
    ctx.arc(W/2,H/2,25,0,Math.PI*1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W/2+25,H/2);
    ctx.lineTo(W/2+10,H/2-15);
    ctx.lineTo(W/2+10,H/2+15);
    ctx.closePath();
    ctx.fillStyle='#000';
    ctx.fill();

    // Practice button (rhombus green)
    ctx.fillStyle='#fff';
    ctx.beginPath();
    ctx.arc(W/2+100,H/2,40,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#0f0';
    ctx.beginPath();
    ctx.moveTo(W/2+100,H/2-20);
    ctx.lineTo(W/2+120,H/2);
    ctx.lineTo(W/2+100,H/2+20);
    ctx.lineTo(W/2+80,H/2);
    ctx.closePath();
    ctx.fill();
}

// Pause Menu click
canvas.addEventListener('click',function(e){
    if(pauseMenuVisible){
        let mx=e.clientX, my=e.clientY;
        // Resume
        if(Math.hypot(mx-(W/2-100),my-H/2)<40) hidePauseMenu();
        // Restart
        if(Math.hypot(mx-(W/2),my-H/2)<40){resetGame(); hidePauseMenu();}
        // Practice Mode
        if(Math.hypot(mx-(W/2+100),my-H/2)<40){practiceMode=!practiceMode; hidePauseMenu();}
    }
});

// Practice mode buttons (placeholders)
canvas.addEventListener('click',function(e){
    if(practiceMode){
        // TODO: implement add/remove respawn points
    }
});

window.addEventListener('resize',()=>{
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
});
