const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;

const startBtn = document.getElementById('startBtn');
const bgMusic = document.getElementById('bgMusic');
const progressEl = document.getElementById('progress');

let player = {x:100, y:H-100, size:50, vy:0, gravity:1, jump:-18, onGround:true};
let gameStarted = false;
let cameraX = 0;
const mapSpeed = 6;

// Particle system for jump/glow
let particles = [];

// Obstacles: spike/block with spacing
let obstacles = [];
for(let i=1;i<=40;i++){
    let type = Math.random()<0.5?'spike':'block';
    obstacles.push({x:500+i*250,type});
}

// Parallax background layers
const bgLayers = [
    {color:'#111',x:0,speed:0.2},
    {color:'#222',x:0,speed:0.5},
    {color:'#333',x:0,speed:1}
];

// Draw background parallax + glow
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

// Player
function drawPlayer(){
    ctx.fillStyle="#0f0";
    ctx.shadowColor = "#0f0";
    ctx.shadowBlur = 15;
    ctx.fillRect(player.x,player.y,player.size,player.size);
    ctx.shadowBlur = 0;
}

// Ground
function drawGround(){
    ctx.fillStyle="#555";
    ctx.fillRect(0,H-50,W,50);
}

// Obstacles
function drawObstacles(){
    obstacles.forEach(obs=>{
        let screenX = obs.x - cameraX;
        if(screenX+50<0||screenX>W) return;
        ctx.fillStyle = obs.type==='spike'?'#f00':'#00f';
        if(obs.type==='spike'){
            ctx.beginPath();
            ctx.moveTo(screenX,H-50);
            ctx.lineTo(screenX+25,H-50-50);
            ctx.lineTo(screenX+50,H-50);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillRect(screenX,H-50-50,50,50);
        }
    });
}

// Particles
function updateParticles(){
    particles.forEach((p,i)=>{
        p.x += p.vx;
        p.y += p.vy;
        p.life -=1;
        ctx.fillStyle = `rgba(255,255,0,${p.life/50})`;
        ctx.beginPath();
        ctx.arc(p.x,p.y,3,0,Math.PI*2);
        ctx.fill();
        if(p.life<=0) particles.splice(i,1);
    });
}

// Update player
function updatePlayer(){
    player.vy += player.gravity;
    player.y += player.vy;
    const groundY = H-50-player.size;
    if(player.y>groundY){player.y=groundY;player.vy=0;player.onGround=true;}
}

// Update camera
function updateCamera(){cameraX += mapSpeed;}

// Progress
function updateProgress(){
    if(!bgMusic.duration) return;
    let percent = Math.min((bgMusic.currentTime/bgMusic.duration)*100,100);
    progressEl.style.width = percent+"%";
    progressEl.textContent = Math.floor(percent)+"%";
}

// Collision detection
function checkCollisionRect(rect){
    let px=player.x, py=player.y, ps=player.size;
    let rx=rect.x-cameraX, ry=H-50-50, rs=50;
    return px<rx+rs && px+ps>rx && py<ry+rs && py+ps>ry;
}
function checkCollisionSpike(spike){
    let px=player.x, py=player.y, ps=player.size;
    let sx=spike.x-cameraX, sy=H-50-50, ss=50;
    return px<sx+ss && px+ps>sx && py<sy+ss && py+ps>sy;
}
function checkCollision(){
    for(let obs of obstacles){
        if(obs.type==='block' && checkCollisionRect(obs)) return true;
        if(obs.type==='spike' && checkCollisionSpike(obs)) return true;
    }
    return false;
}

// Game loop
function gameLoop(){
    if(!gameStarted) return;
    ctx.clearRect(0,0,W,H);
    drawBackground();
    drawGround();
    drawObstacles();
    drawPlayer();
    updateParticles();
    updatePlayer();
    updateCamera();
    updateProgress();
    if(checkCollision()){
        gameStarted=false;
        alert("Game Over!");
        location.reload();
        return;
    }
    requestAnimationFrame(gameLoop);
}

// Jump
function jump(){
    if(player.onGround){
        player.vy=player.jump;
        player.onGround=false;
        // tạo particles
        for(let i=0;i<10;i++){
            particles.push({
                x:player.x+player.size/2,
                y:player.y+player.size,
                vx:(Math.random()-0.5)*4,
                vy:Math.random()*-3-2,
                life:50
            });
        }
    }
}

// Start
startBtn.addEventListener('click',()=>{
    bgMusic.play().then(()=>{
        gameStarted=true;
        startBtn.style.display="none";
        gameLoop();
    }).catch(e=>{
        console.log("Music blocked:", e);
        gameStarted=true;
        startBtn.style.display="none";
        gameLoop();
    });
});

canvas.addEventListener('touchstart',jump);
canvas.addEventListener('mousedown',jump);

window.addEventListener('resize',()=>{
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
});
