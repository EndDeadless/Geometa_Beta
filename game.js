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
const mapSpeed = 5; // tốc độ “di chuyển” map

// obstacles
let obstacles = [
    {x:500,type:'spike'},{x:900,type:'block'},{x:1300,type:'spike'},
    {x:1800,type:'block'},{x:2300,type:'spike'},{x:2800,type:'block'},
    {x:3300,type:'block'},{x:3800,type:'spike'},{x:4300,type:'block'}
];

// parallax backgrounds
const bgLayers = [
    {color:'#111',x:0,speed:0.2},
    {color:'#222',x:0,speed:0.5},
    {color:'#333',x:0,speed:1}
];

function drawBackground(){
    bgLayers.forEach(layer=>{
        layer.x -= layer.speed;
        if(layer.x <= -W) layer.x = 0;
        ctx.fillStyle = layer.color;
        ctx.fillRect(layer.x,0,W,H);
        ctx.fillRect(layer.x+W,0,W,H);
    });
}

function drawPlayer(){
    ctx.fillStyle="#0f0";
    ctx.fillRect(player.x,player.y,player.size,player.size);
}

function drawGround(){
    ctx.fillStyle="#555";
    ctx.fillRect(0,H-50,W,50);
}

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

function updatePlayer(){
    player.vy += player.gravity;
    player.y += player.vy;
    const groundY = H-50-player.size;
    if(player.y>groundY){player.y=groundY;player.vy=0;player.onGround=true;}
}

function updateCamera(){
    cameraX += mapSpeed; // map tự chạy
}

function updateProgress(){
    if(!bgMusic.duration) return;
    let percent = Math.min((bgMusic.currentTime/bgMusic.duration)*100,100);
    progressEl.style.width = percent+"%";
    progressEl.textContent = Math.floor(percent)+"%";
}

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
    requestAnimationFrame(gameLoop);
}

function jump(){
    if(player.onGround){
        player.vy = player.jump;
        player.onGround=false;
    }
}

startBtn.addEventListener('click', ()=>{
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

// touch/click nhảy
canvas.addEventListener('touchstart', jump);
canvas.addEventListener('mousedown', jump);

window.addEventListener('resize', ()=>{
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
});
