const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const progressEl = document.getElementById("progress");
const attemptEl = document.getElementById("attempt");
const bgMusic = document.getElementById("bgMusic");

let gameStarted = false;
let paused = false;
let attempt = 1;

/* PLAYER */
const player = {
    x:100, y:H-100,
    size:50,
    vy:0,
    gravity:1,
    jump:-18,
    onGround:true,
    angle:0
};

/* CAMERA */
let cameraX = 0;
const speed = 6;

/* OBSTACLE */
let obstacles = [];
function generateSpikes(){
    obstacles=[];
    let x=500;
    for(let i=0;i<120;i++){
        x+=200+Math.random()*100;
        obstacles.push({x});
    }
}
generateSpikes();

/* PRACTICE MODE */
let practiceMode = false;
let checkpoints = [];

/* INPUT */
window.addEventListener("keydown",e=>{
    if(e.code==="Space") jump();
});

/* JUMP */
function jump(){
    if(player.onGround){
        player.vy = player.jump;
        player.onGround = false;
    }
}

/* UPDATE */
function updatePlayer(){
    player.vy += player.gravity;
    player.y += player.vy;

    const ground = H-50-player.size;
    if(player.y>=ground){
        player.y=ground;
        player.vy=0;
        player.onGround=true;
        player.angle=0;
    }
}

/* DRAW */
function drawPlayer(){
    ctx.save();
    ctx.translate(player.x+25,player.y+25);
    ctx.rotate(player.angle*Math.PI/180);
    ctx.fillStyle="#0f0";
    ctx.fillRect(-25,-25,50,50);
    ctx.restore();
}
function drawGround(){
    ctx.fillStyle="#555";
    ctx.fillRect(0,H-50,W,50);
}
function drawObstacles(){
    ctx.fillStyle="#f00";
    obstacles.forEach(o=>{
        let x=o.x-cameraX;
        if(x<-50||x>W) return;
        ctx.beginPath();
        ctx.moveTo(x,H-50);
        ctx.lineTo(x+25,H-100);
        ctx.lineTo(x+50,H-50);
        ctx.fill();
    });
}

/* CHECKPOINT ICONS */
function drawCheckpoints(){
    if(!practiceMode) return;
    ctx.fillStyle="#0f0";
    checkpoints.forEach(c=>{
        let x=c.x-cameraX;
        if(x<0||x>W) return;
        ctx.beginPath();
        ctx.moveTo(x,H-140);
        ctx.lineTo(x+10,H-130);
        ctx.lineTo(x,H-120);
        ctx.lineTo(x-10,H-130);
        ctx.fill();
    });
}

/* PRACTICE BUTTONS */
function drawPracticeButtons(){
    if(!practiceMode) return;

    let size=60, y=H-80;
    let addX=W/2-50, delX=W/2+50;

    ctx.fillStyle="#333";
    ctx.fillRect(addX-30,y-30,60,60);
    ctx.fillRect(delX-30,y-30,60,60);

    ctx.fillStyle="#0f0";
    ctx.beginPath();
    ctx.moveTo(addX,y-15);
    ctx.lineTo(addX+15,y);
    ctx.lineTo(addX,y+15);
    ctx.lineTo(addX-15,y);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(delX,y-15);
    ctx.lineTo(delX+15,y);
    ctx.lineTo(delX,y+15);
    ctx.lineTo(delX-15,y);
    ctx.fill();

    ctx.strokeStyle="#000";
    ctx.lineWidth=4;
    ctx.beginPath();
    ctx.moveTo(delX-15,y-15);
    ctx.lineTo(delX+15,y+15);
    ctx.stroke();
}

/* COLLISION */
function hitSpike(o){
    let px=player.x+25;
    let sx=o.x-cameraX+25;
    return Math.abs(px-sx)<35 && player.y+50>H-100;
}

/* CLICK */
canvas.addEventListener("click",e=>{
    let mx=e.clientX,my=e.clientY;

    if(!practiceMode) return;

    let y=H-80, size=60;
    if(Math.abs(mx-(W/2-50))<30 && Math.abs(my-y)<30){
        checkpoints.push({
            x:cameraX,
            y:player.y,
            vy:player.vy,
            music:bgMusic.currentTime
        });
    }
    if(Math.abs(mx-(W/2+50))<30 && Math.abs(my-y)<30){
        checkpoints.pop();
    }
});

/* RESET */
function resetGame(){
    cameraX=0;
    player.y=H-100;
    player.vy=0;
    checkpoints=[];
    bgMusic.currentTime=0;
}

/* LOOP */
function gameLoop(){
    if(!gameStarted||paused) return;

    ctx.clearRect(0,0,W,H);
    drawGround();
    drawObstacles();
    drawCheckpoints();
    drawPlayer();
    drawPracticeButtons();
    updatePlayer();

    cameraX+=speed;
    progressEl.style.width = (bgMusic.currentTime/bgMusic.duration*100||0)+"%";

    for(let o of obstacles){
        if(hitSpike(o)){
            if(practiceMode&&checkpoints.length){
                let c=checkpoints.at(-1);
                cameraX=c.x;
                player.y=c.y;
                player.vy=c.vy;
                bgMusic.currentTime=c.music;
            }else{
                attempt++;
                resetGame();
            }
            break;
        }
    }
    requestAnimationFrame(gameLoop);
}

/* START */
startBtn.onclick=()=>{
    startBtn.style.display="none";
    bgMusic.play();
    gameStarted=true;
    gameLoop();
};

/* PAUSE */
pauseBtn.onclick=()=>{
    practiceMode=!practiceMode;
    checkpoints=[];
};
