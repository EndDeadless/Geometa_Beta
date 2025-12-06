<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Mini Geometry Dash - Parallax & Themes</title>
<style>
  :root{
    --progress-width: 60%;
  }
  html,body{height:100%;margin:0;background:#000;font-family:Inter, system-ui, Arial;}
  #root{position:relative;width:100%;height:100vh;overflow:hidden;}
  canvas{display:block;width:100%;height:100%;}
  #startBtn{
    position:absolute;
    top:50%;left:50%;
    transform:translate(-50%,-50%);
    z-index:40;
    padding:16px 28px;
    font-size:20px;
    border-radius:12px;
    border:none;
    background:#FFD700;
    box-shadow:0 8px 24px rgba(0,0,0,0.6);
    cursor:pointer;
  }
  #progressContainer{
    position:absolute;
    top:18px;
    left:50%;
    transform:translateX(-50%);
    width:var(--progress-width);
    height:28px;
    background:#bdbdbd; /* nền xám */
    border-radius:16px;
    overflow:hidden;
    z-index:40;
    box-shadow:0 4px 12px rgba(0,0,0,0.35);
  }
  #progressBar{
    height:100%;
    width:0%;
    background:#ffffff; /* tiến trình trắng */
    display:flex;
    justify-content:center;
    align-items:center;
    color:#000;
    font-weight:700;
    font-size:13px;
    transition:width 120ms linear;
  }
  /* small UI tips */
  #hint {
    position:absolute; left:16px; bottom:16px;
    z-index:40; color:#fff; opacity:.85; font-size:13px;
    background:rgba(0,0,0,0.25); padding:8px 10px; border-radius:8px;
  }
</style>
</head>
<body>
<div id="root">
  <canvas id="gameCanvas"></canvas>

  <button id="startBtn">Start Game</button>

  <div id="progressContainer">
    <div id="progressBar">0%</div>
  </div>

  <div id="hint">Space / Click / Tap để nhảy</div>

  <!-- music: đặt file vào assets/music/music.mp3 -->
  <audio id="bgMusic" src="assets/music/Giấc mơ ngân hà 2-đệm.mp3" preload="auto"></audio>
</div>

<script src="game.js"></script>
</body>
</html>
