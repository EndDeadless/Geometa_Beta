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
let gameLoopId;
let practiceMode = false;

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
        let gap = 250 + Math.random()*150; // 250-400px khoảng cách xa hơn
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

function jump(){if(player.onGround){player.vy=player.jump; player.onGround=false;}}

// Player update
function updatePlayer(){
    player.vy += player.gravity;
    player.y += player.vy;
    player.angle += player.vy<0?10:-5;
    if(player.angle>90) player.angle=90;
    if(player.angle<-90) player.angle=-90;
    const groundY = H-50-player.size;
    if(player.y>=groundY){player.y=groundY; player.vy=0; player.onGround=true; player.angle=0; if(holding) jump();} 
    else player.onGround=false;
}

// Draw
function drawBackground(){
    bgLayers.forEach(layer=>{
        layer.x -= layer.speed;
        if(layer.x <= -W) layer.x =0;
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
function drawGround(){ctx.fillStyle="#555"; ctx.fillRect(0,H-50,W,50);}
function drawObstacles(){
    obstacles.forEach(obs=>{
        let screenX = obs.x-cameraX;
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

// Camera
function updateCamera(){cameraX+=mapSpeedMax;}

// Progress bar top
function updateProgress(){
    if(!bgMusic.duration) return;
    let percent = Math.min((bgMusic.currentTime/bgMusic.duration)*100,100);
    progressEl.style.width=percent+"%";
    progressEl.textContent=Math.floor(percent)+"%";
}

// Collision
function checkCollisionSpike(spike){
    let px=player.x,py=player.y,ps=player.size;
    let sx=spike.x-cameraX,sy=H-50-50,ss=50;
    if(px+ps>sx+5 && px<sx+ss-5 && py+ps>sy+10) return true;
    return false;
}
function checkCollision(){for(let obs of obstacles) if(checkCollisionSpike(obs)) return true; return false;}

// Attempt
function showAttempt(){
    attemptEl.textContent = `Attempt ${attempt}`;
    attemptEl.style.opacity=1;
    let alpha=1;
    let interval = setInterval(()=>{
        alpha-=0.02;
        attemptEl.style.opacity=alpha;
        if(alpha<=0) clearInterval(interval);
    },30);
}

// Reset
function resetGame(){
    cancelAnimationFrame(gameLoopId);
    player.y=H-100; player.vy=0; player.onGround=true; player.angle=0; cameraX=0;
    generateSpikes();
    bgMusic.currentTime=0;
    bgMusic.play();
    progressEl.style.width='0%'; progressEl.textContent='0%';
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
        setTimeout(resetGame,1000);
        return;
    }
    gameLoopId=requestAnimationFrame(gameLoop);
}

// Start
startBtn.addEventListener('click',()=>{
    bgMusic.play().then(()=>{
        gameStarted=true;
        startBtn.style.display="none";
        showAttempt();
        gameLoop();
    }).catch(e=>{
        gameStarted=true;
        startBtn.style.display="none";
        showAttempt();
        gameLoop();
    });
});

// Pause menu with hover + scale
let pauseMenuVisible=false;
let mouseX=0, mouseY=0;
let hoverIndex=-1; // 0:resume, 1:restart, 2:practice
canvas.addEventListener('mousemove',e=>{
    mouseX=e.clientX; mouseY=e.clientY;
    if(pauseMenuVisible){
        hoverIndex=-1;
        const btns = [{x:W/2-100,y:H/2},{x:W/2,y:H/2},{x:W/2+100,y:H/2}];
        btns.forEach((b,i)=>{
            if(Math.hypot(mouseX-b.x,mouseY-b.y)<40) hoverIndex=i;
        });
    }
});

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
}

pauseBtn.addEventListener('click',()=>{if(pauseMenuVisible) hidePauseMenu(); else showPauseMenu();});

function drawPauseMenu(){
    ctx.fillStyle='rgba(0,0,0,0.7)';
    ctx.fillRect(0,0,W,H);
    const btns = [
        {x:W/2-100,y:H/2,type:'triangle',color:'#000'},
        {x:W/2,y:H/2,type:'arrow',color:'#000'},
        {x:W/2+100,y:H/2,type:'rhombus',color:'#0f0'}
    ];
    btns.forEach((b,i)=>{
        let scale = hoverIndex===i?1.2:1;
        drawCircleIcon(b.x,b.y,40*scale,'#fff',b.type,b.color);
    });
}

function drawCircleIcon(x,y,r,bgColor,type,iconColor){
    ctx.save();
    ctx.translate(x,y);
    ctx.fillStyle=bgColor; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=iconColor; ctx.beginPath();
    if(type==='triangle'){
        ctx.moveTo(-r/2,-r/2); ctx.lineTo(-r/2,r/2); ctx.lineTo(r/2,0); ctx.closePath();
    } else if(type==='arrow'){
        ctx.moveTo(-r/2,0); ctx.lineTo(r/2,0); ctx.lineTo(0,-r/2); ctx.closePath();
    } else if(type==='rhombus'){
        ctx.moveTo(0,-r/2); ctx.lineTo(r/2,0); ctx.lineTo(0,r/2); ctx.lineTo(-r/2,0); ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
}

// Pause Menu click
canvas.addEventListener('click',function(e){
    if(pauseMenuVisible){
        let mx=e.clientX,my=e.clientY;
        const btns = [{x:W/2-100,y:H/2},{x:W/2,y:H/2},{x:W/2+100,y:H/2}];
        btns.forEach((b,i)=>{
            if(Math.hypot(mx-b.x,my-b.y)<40){
                if(i===0) hidePauseMenu(); // resume
                if(i===1){resetGame(); hidePauseMenu();} // restart
                if(i===2){practiceMode=!practiceMode; hidePauseMenu();} // practice
            }
        });
    }
});

window.addEventListener('resize',()=>{W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight;});
