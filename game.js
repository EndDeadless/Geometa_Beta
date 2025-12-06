const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;

const startBtn = document.getElementById('startBtn');
const bgMusic = document.getElementById('bgMusic');
const progressEl = document.getElementById('progress');
const attemptEl = document.getElementById('attempt');

let attempt = 1;

// Player
let player = {x:100, y:H-100, size:50, vy:0, gravity:1, jump:-18, onGround:true, angle:0};
let gameStarted = false;
let cameraX = 0;
const mapSpeedMax = 6; // max speed camera/map

// Spike obstacles
let obstacles = [];
let spikeCount = 120;
for(let i=0;i<spikeCount;i++){
    let x = 500 + i*180 + Math.random()*80; // khoảng cách spike hợp lý
    obstacles.push({x, type:'spike'});
}

// Background parallax
const bgLayers = [
    {color:'#111',x:0,speed:0.2},
    {color:'#222',x:0,speed:0.5},
    {color:'#333',x:0,speed:1}
];

// Draw background
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

// Draw player
function drawPlayer(){
    ctx.save();
    ctx.translate(player.x+player.size/2, player.y+player.size/2);
    ctx.rotate(player.angle*Math.PI/180);
    ctx.fillStyle="#0f0";
    ctx.fillRect(-player.size/2,-player.size/2,player.size,player.size);
    ctx.restore();
}

// Ground
function drawGround(){
    ctx.fillStyle="#555";
    ctx.fillRect(0,H-50,W,50);
}

// Draw spike
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

// Update player
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
        if(holding) jump(); // giữ nhảy liên tục khi chạm đất
    }
}

// Jump logic
function jump(){
    if(player.onGround){
        player.vy = player.jump;
        player.onGround=false;
    }
}

// Update camera speed
function updateCamera(){
    cameraX += mapSpeedMax; // tốc độ map cố định max 6
}

// Update progress bar (khớp nhạc)
function updateProgress(){
    if(!bgMusic.duration) return;
    let percent = Math.min((bgMusic.currentTime/bgMusic.duration)*100,100);
    progressEl.style.width = percent+"%";
    progressEl.textContent = Math.floor(percent)+"%";
}

// Collision detection
function checkCollisionSpike(spike){
    let px=player.x, py=player.y, ps=player.size;
    let sx=spike.x-cameraX, sy=H-50-50, ss=50;
    return px<sx+ss && px+ps>sx && py<sy+ss && py+ps>sy;
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

// Reset game nội bộ
function resetGame(){
    player.y = H-100;
    player.vy=0;
    player.onGround=true;
    player.angle=0;
    cameraX=0;
    gameStarted=true;
}

// Game loop
function gameLoop(){
    if(!gameStarted) return;
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
        setTimeout(resetGame,1000);
        return;
    }
    requestAnimationFrame(gameLoop);
}

// Handle hold jump
let holding=false;
canvas.addEventListener('touchstart',()=>{holding=true;jump();});
canvas.addEventListener('touchend',()=>{holding=false;});
canvas.addEventListener('mousedown',()=>{holding=true;jump();});
canvas.addEventListener('mouseup',()=>{holding=false;});
window.addEventListener('keydown',e=>{if(e.code==='Space') jump();});

// Keep jump when holding
function holdJump(){
    if(holding) jump();
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

window.addEventListener('resize',()=>{
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
});
