/* game.js
  Mini Geometry Dash (canvas)
  - parallax backgrounds (multi-layer)
  - theme transitions based on music progress
  - obstacles arranged in segments (GD-like)
  - progress bar synced to bgMusic.currentTime/bgMusic.duration
  - input: Space / click / touch
*/

/* ------------- CONFIG ------------- */
const CONFIG = {
  canvasId: 'gameCanvas',
  musicSelector: '#bgMusic',
  mapPixelPerSecond: 350, // base px/s — will be adjusted from music duration
  spawnSegmentIntervalSec: 0.75, // used to place groups rhythmically
  obstacleGapMin: 220,
  obstacleGapMax: 520,
  maxObstaclesAhead: 40,
  themeCount: 3, // number of distinct visual themes across level
};

/* ------------- BOILERPLATE ------------- */
const canvas = document.getElementById(CONFIG.canvasId);
const ctx = canvas.getContext('2d', { alpha: false });

let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;

window.addEventListener('resize', () => {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  // regenerate parallax layers size if needed
  layers.forEach(l => l.resize && l.resize());
});

/* ------------- AUDIO ------------- */
const bgMusic = document.querySelector(CONFIG.musicSelector);

/* ------------- UI ------------- */
const startBtn = document.getElementById('startBtn');
const progressBar = document.getElementById('progressBar');

/* ------------- Utility ------------- */
const rand = (a,b) => a + Math.random()*(b-a);
const choice = arr => arr[Math.floor(Math.random()*arr.length)];
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

/* ------------- THEMES (visual palettes) ------------- */
// Each theme: gradient colors, parallax colors, ambient light
const THEMES = [
  {
    name: 'Blue Neon',
    sky: ['#0f172a','#102a43'],
    accent: '#00E5FF',
    particlesColor: 'rgba(200,240,255,0.12)',
    decoHueShift: -10
  },
  {
    name: 'Purple Glow',
    sky: ['#140f2f','#2b0f4a'],
    accent: '#C084FC',
    particlesColor: 'rgba(220,180,255,0.12)',
    decoHueShift: 30
  },
  {
    name: 'Sunset Blaze',
    sky: ['#3b0f0f','#ff8a00'],
    accent: '#FFD166',
    particlesColor: 'rgba(255,210,160,0.12)',
    decoHueShift: 70
  }
];

/* ------------- PARALLAX LAYERS ------------- */
/*
  Each layer has:
  - speedFactor: 0..1 (0 = static far background; 1 = same speed as foreground)
  - draw(ctx, offset) : function to render that layer given offset (progress)
  We'll provide fallback procedural drawing if images not present.
*/
let layers = [];

/* procedural decorations as fallback */
function makeProceduralLayer(seed, detail, colorFn){
  // seed: for variation; detail: density
  const points = [];
  for(let i=0;i<Math.ceil(W/100)*detail;i++){
    points.push({
      x: Math.random()*W*3 - W, // allow wide scrolling
      y: Math.random()*H*0.8,
      size: 6 + Math.random()*24
    });
  }
  return {
    speedFactor: rand(0.05,0.35),
    draw: (ctx, offset, theme) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      points.forEach((p,i)=>{
        const dx = (p.x - offset*200* (1 - (0.3*this.speedFactor))) % (W*3);
        const px = dx < 0 ? dx + W*3 : dx;
        const hueShift = theme.decoHueShift || 0;
        ctx.fillStyle = colorFn ? colorFn(p,i,theme) : `hsla(${120+hueShift},80%,65%,0.06)`;
        ctx.beginPath();
        ctx.arc(px - W, p.y, p.size * (0.5 + 0.5*Math.sin(i + Date.now()*0.002)), 0, Math.PI*2);
        ctx.fill();
      });
      ctx.restore();
    },
    resize(){ /* noop */ }
  };
}

/* real parallax layers array (ordered far -> near) */
layers.push({
  name: 'skyGradient',
  speedFactor: 0,
  draw: (ctx, offset, theme) => {
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, theme.sky[0]);
    g.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);
  }
});

layers.push(makeProceduralLayer(1, 10, (p,i,theme)=> theme.particlesColor ));
layers.push(makeProceduralLayer(2, 8, (p,i,theme)=> `hsla(0,0%,100%,${0.02 + Math.random()*0.04})`));

/* foreground decorative band */
layers.push({
  speedFactor: 0.6,
  draw: (ctx, offset, theme) => {
    // a wavy hill-like foreground band, changes with progress
    ctx.save();
    const yBase = H - 120;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, yBase);
    for(let i=0;i<=W;i+=20){
      const noise = 20 * Math.sin((i*0.02) + offset*6 + Date.now()*0.001);
      ctx.lineTo(i, yBase - noise);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    // use theme accent with low alpha
    ctx.fillStyle = hexToRgba(theme.accent, 0.12);
    ctx.fill();
    ctx.restore();
  }
});

/* helper: hex color to rgba */
function hexToRgba(hex, alpha){
  // simple conversion #RRGGBB
  if(!hex.startsWith('#')) return hex;
  const c = hex.substring(1);
  const r = parseInt(c.substring(0,2),16);
  const g = parseInt(c.substring(2,4),16);
  const b = parseInt(c.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ------------- OBSTACLE SYSTEM (GD-like patterns) ------------- */
/*
  Idea:
  - Pre-generate timeline: at times t1,t2,... we place obstacle clusters (segments)
  - Each cluster has a pattern: [spike cluster, block, saw, gap], width measured in pixels
  - We'll base timeline on music duration when available.
*/

const OB_TYPES = {
  SPIKE_CLUSTER: 'spike',
  BLOCK: 'block',
  SAW: 'saw'
};

// function to create patterns (like level editor blocks)
function makePattern(type, params){
  // returns object that drawObstacle can render
  return { type, ...params };
}

/* Draw functions for obstacles (procedural shapes) */
function drawObstacleAt(obs, x){
  // obs has: type, size, spikes (if cluster), height etc.
  ctx.save();
  ctx.translate(x, 0);
  if(obs.type === OB_TYPES.BLOCK){
    ctx.fillStyle = obs.color;
    ctx.shadowColor = obs.color;
    ctx.shadowBlur = 12;
    ctx.fillRect(0, H - 100 - obs.h, obs.w, obs.h);
    ctx.shadowBlur = 0;
  } else if(obs.type === OB_TYPES.SPIKE_CLUSTER){
    // draw spikes tightly packed, stackable height
    const w = obs.w;
    const h = obs.h;
    const count = Math.max(1, Math.floor(w / 24));
    for(let i=0;i<count;i++){
      const sx = i * (w/count);
      ctx.beginPath();
      ctx.moveTo(sx, H - 100);
      ctx.lineTo(sx + (w/count)/2, H - 100 - h);
      ctx.lineTo(sx + (w/count), H - 100);
      ctx.closePath();
      ctx.fillStyle = obs.color;
      ctx.shadowColor = obs.color;
      ctx.shadowBlur = 6 + 4*Math.sin((Date.now()+i*50)*0.004);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  } else if(obs.type === OB_TYPES.SAW){
    const cx = obs.w/2;
    const cy = H - 100 - obs.r - 6;
    // rotating saw
    const angle = (Date.now()*0.004) % (Math.PI*2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.fillStyle = obs.color;
    ctx.shadowColor = obs.color;
    ctx.shadowBlur = 14;
    const teeth = 12;
    for(let i=0;i<teeth;i++){
      const a1 = (i/teeth)*Math.PI*2;
      const a2 = a1 + Math.PI/teeth;
      ctx.moveTo(0,0);
      ctx.lineTo(Math.cos(a1)*obs.r, Math.sin(a1)*obs.r);
      ctx.lineTo(Math.cos(a2)*obs.r*0.6, Math.sin(a2)*obs.r*0.6);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur=0;
  }
  ctx.restore();
}

/* collision helpers (simple AABB or approximations) */
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh){
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/* ------------- LEVEL / TIMELINE GENERATION ------------- */
/*
  We'll generate a timeline of obstacle clusters based on music duration:
  - mapLength (px) = musicDuration * pixelsPerSecond.
  - we create segments spaced by variable gaps (min/max) and inside each segment place a pattern.
*/

let timeline = []; // array of { x: pxPosition, obstacles: [ {type,w,h,...} ] }

function generateTimeline(durationSec){
  timeline = [];
  let xCursor = 500; // start after some safe x
  const pixelsPerSec = clamp(CONFIG.mapPixelPerSecond, 200, 600);
  mapLength = Math.max(4000, Math.floor(durationSec * pixelsPerSec));
  // create segments across the map until near mapLength
  while(xCursor < mapLength - 400){
    const gap = rand(CONFIG.obstacleGapMin, CONFIG.obstacleGapMax);
    xCursor += gap;
    // choose a pattern type with some randomness and difficulty scaling by progress
    const progress = xCursor / mapLength;
    const patternChoice = Math.random();
    // place cluster with several obstacles horizontally inside clusterWidth
    const clusterWidth = rand(120, 420);
    const cluster = { x: xCursor, clusterWidth, list: [] };
    // choose few obstacles inside cluster (1..3)
    const itemCount = 1 + Math.floor(Math.random()*3);
    let subX = 0;
    for(let i=0;i<itemCount;i++){
      const w = 60 + Math.random()*120;
      const typeRoll = Math.random();
      if(typeRoll < 0.45){
        // spike cluster
        cluster.list.push({
          type: OB_TYPES.SPIKE_CLUSTER,
          w: w,
          h: 40 + Math.random()*80,
          color: '#FFD700',
          offset: subX
        });
      } else if(typeRoll < 0.75){
        // block
        cluster.list.push({
          type: OB_TYPES.BLOCK,
          w: w,
          h: 40 + Math.random()*140,
          color: '#FF6B6B',
          offset: subX
        });
      } else {
        // saw
        cluster.list.push({
          type: OB_TYPES.SAW,
          w: Math.min(140,w),
          r: 24 + Math.random()*36,
          color: '#9bf',
          offset: subX
        });
      }
      subX += w + rand(12, 28); // small gap inside cluster
    }
    timeline.push(cluster);
    // advance cursor beyond cluster
    xCursor += clusterWidth * 0.3;
  }
}

/* ------------- RENDER / GAME LOOP ------------- */

// state
let started = false;
let obstacleInterval = null;
let lastTime = 0;

// main render
function render(now){
  // now is high-res timestamp, but we'll rely on bgMusic for progress
  ctx.clearRect(0,0,W,H);

  const duration = bgMusic.duration || 1;
  const t = bgMusic.currentTime || 0;
  const progress = clamp(t / Math.max(duration, 0.0001), 0, 1);
  // select theme smoothly across themes list
  const themeIndexRaw = progress * (THEMES.length - 1);
  const low = Math.floor(themeIndexRaw);
  const high = Math.min(THEMES.length-1, low+1);
  const mix = themeIndexRaw - low;
  const theme = mixTheme(THEMES[low], THEMES[high], mix);

  // draw parallax layers: far -> near
  layers.forEach(layer => {
    // offset param derived from progress and layer.speedFactor
    const offset = progress * mapLength;
    layer.draw(ctx, offset, theme);
  });

  // foreground ground band
  drawGroundDecoration(ctx, progress, theme);

  // player physics & draw
  // gravity integrates per frame but tuned to look good across devices
  // small dt smoothing
  player.dy += player.gravity;
  player.y += player.dy;
  if(player.y + player.height >= H - 100){
    player.y = H - 100 - player.height;
    player.dy = 0;
    player.onGround = true;
  }

  // player glow
  ctx.save();
  ctx.fillStyle = player.color;
  ctx.shadowColor = player.color;
  ctx.shadowBlur = 18;
  ctx.fillRect(player.x, player.y, player.width, player.height);
  ctx.restore();

  // draw timeline obstacles relative to progress
  // offsetX = -progress * mapLength (i.e. move world left)
  const worldOffsetX = -progress * mapLength;
  for(const cluster of timeline){
    // render cluster positioned at cluster.x + item.offset + worldOffsetX
    for(const item of cluster.list){
      const xPos = cluster.x + item.offset + worldOffsetX;
      // culling
      if(xPos + item.w < -200 || xPos > W + 200) continue;
      drawObstacleAt(item, xPos);
      // collision simple checks:
      if(checkCollisionWithPlayer(item, xPos)){
        // stop music and show outcome
        bgMusic.pause();
        setTimeout(()=> alert('Game Over! Bạn đã chết.'), 50);
        started = false;
        return; // stop render (will still possibly be called; we rely on started flag)
      }
    }
  }

  // render UI progress
  progressBar.style.width = `${(progress*100).toFixed(1)}%`;
  progressBar.innerText = `${Math.floor(progress*100)}%`;

  // when music ended -> finish
  if(progress >= 0.999){
    started = false;
    setTimeout(()=> {
      alert('Hoàn thành map! 100%');
      location.reload();
    }, 200);
    return;
  }

  if(started) requestAnimationFrame(render);
}

/* helper: draw ground decoration */
function drawGroundDecoration(ctx, progress, theme){
  ctx.save();
  const yBase = H - 100;
  const g = ctx.createLinearGradient(0,yBase-240,0,H);
  g.addColorStop(0, hexToRgba(theme.accent, 0.08));
  g.addColorStop(1, hexToRgba('#000', 0.06));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0,H);
  ctx.lineTo(0,yBase);
  const step = 40;
  for(let x=0;x<=W;x+=step){
    const wave = 20 * Math.sin((x*0.018) + progress*8 + Date.now()*0.001);
    ctx.lineTo(x, yBase - wave);
  }
  ctx.lineTo(W,H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* mix two theme objects (linear interpolation of colors not perfect but ok) */
function mixTheme(a,b,mix){
  // simple: choose a or b according to mix threshold but smooth transition of accent by mixing alpha
  if(mix < 0.001) return a;
  if(mix > 0.999) return b;
  // return mid object (not perfect color interpolation; good enough)
  return {
    sky: [a.sky[0], b.sky[1]],
    accent: mix < 0.5 ? a.accent : b.accent,
    particlesColor: mix < 0.5 ? a.particlesColor : b.particlesColor,
    decoHueShift: a.decoHueShift*(1-mix) + b.decoHueShift*mix
  };
}

/* drawObstacleAt wrapper calls drawObstacleAt defined earlier */
function drawObstacleAt(item, xPos){
  drawObstacleAtProc(item, xPos);
}
/* implement draw function using earlier code but renamed for clarity */
function drawObstacleAtProc(obs, x){
  ctx.save();
  ctx.translate(x, 0);
  if(obs.type === OB_TYPES.BLOCK){
    ctx.fillStyle = obs.color;
    ctx.shadowColor = obs.color;
    ctx.shadowBlur = 10;
    ctx.fillRect(0, H - 100 - obs.h, obs.w, obs.h);
  } else if(obs.type === OB_TYPES.SPIKE_CLUSTER){
    const w = obs.w;
    const h = obs.h;
    const count = Math.max(1, Math.floor(w / 26));
    for(let i=0;i<count;i++){
      const sx = i * (w/count);
      ctx.beginPath();
      ctx.moveTo(sx, H - 100);
      ctx.lineTo(sx + (w/count)/2, H - 100 - h);
      ctx.lineTo(sx + (w/count), H - 100);
      ctx.closePath();
      ctx.fillStyle = obs.color;
      ctx.shadowColor = obs.color;
      ctx.shadowBlur = 6 + 3*Math.sin((Date.now()+i*60)*0.004);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  } else if(obs.type === OB_TYPES.SAW){
    const cx = obs.w/2;
    const cy = H - 100 - obs.r - 6;
    const angle = (Date.now()*0.006) % (Math.PI*2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.fillStyle = obs.color;
    ctx.shadowColor = obs.color;
    ctx.shadowBlur = 12;
    const teeth = 12;
    for(let i=0;i<teeth;i++){
      const a1 = (i/teeth)*Math.PI*2;
      const a2 = a1 + Math.PI/teeth;
      ctx.moveTo(0,0);
      ctx.lineTo(Math.cos(a1)*obs.r, Math.sin(a1)*obs.r);
      ctx.lineTo(Math.cos(a2)*obs.r*0.6, Math.sin(a2)*obs.r*0.6);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur=0;
  }
  ctx.restore();
}

/* collision check between player and obstacle at given x position */
function checkCollisionWithPlayer(item, xPos){
  const px = player.x;
  const py = player.y;
  const pw = player.width;
  const ph = player.height;

  if(item.type === OB_TYPES.BLOCK){
    const bx = xPos;
    const by = H - 100 - item.h;
    return rectsOverlap(px,py,pw,ph,bx,by,item.w,item.h);
  } else if(item.type === OB_TYPES.SPIKE_CLUSTER){
    const bx = xPos;
    const by = H - 100 - item.h;
    // approximate using bounding box of cluster
    return rectsOverlap(px,py,pw,ph,bx,by,item.w,item.h);
  } else if(item.type === OB_TYPES.SAW){
    const sx = xPos + item.w/2;
    const sy = H - 100 - item.r - 6;
    // do circle-rect approx
    const closestX = clamp(px + pw/2, sx - item.r, sx + item.r);
    const closestY = clamp(py + ph/2, sy - item.r, sy + item.r);
    const dx = (px + pw/2) - sx;
    const dy = (py + ph/2) - sy;
    const distSq = dx*dx + dy*dy;
    return distSq < (item.r + Math.max(pw,ph)/2)*(item.r + Math.max(pw,ph)/2);
  }
  return false;
}

/* ------------- GAME START / PREP ------------- */
startBtn.addEventListener('click', async () => {
  // ensure music loaded metadata
  try{
    await bgMusic.play().catch(()=>{}); // attempt play to unlock on mobile; ignore if blocked
    bgMusic.pause();
  }catch(e){/*ignore*/}

  // wait for metadata (duration)
  if(!bgMusic.duration || isNaN(bgMusic.duration) || bgMusic.duration === Infinity){
    await new Promise(res => {
      const onloaded = ()=>{ bgMusic.removeEventListener('loadedmetadata', onloaded); res(); };
      bgMusic.addEventListener('loadedmetadata', onloaded);
      // also fallback after 2s
      setTimeout(res,2000);
    });
  }

  // generate timeline based on duration
  const duration = bgMusic.duration || 20;
  generateTimeline(duration);

  // hide start
  startBtn.style.display = 'none';
  // start playing
  bgMusic.currentTime = 0;
  bgMusic.play().catch(()=>{ /* may be blocked on iOS until user interaction - but we had click */ });

  // set started and run loop
  started = true;
  requestAnimationFrame(render);
});

/* ------------- INIT: if no assets, continue (we use procedural drawing) ------------- */

/* If you want to preload images, do it here and swap layer draws to image draws.
   For now code uses procedural fallback to ensure "vẽ tay" look even without assets. */

/* ------------- END OF FILE ------------- */

/* Notes:
 - Put your music file in assets/music/music.mp3
 - You can tune CONFIG.mapPixelPerSecond to change overall speed (higher => obstacles spread out more in time)
 - Timeline generation tries to mimic clusters like GD (gaps, clusters, internal spacing)
 - Parallax layers are procedural but you can replace any layer.draw with image tiling to use actual background assets
*/
