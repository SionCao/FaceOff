// FaceOff
// Xinyue Cao
// 27.04.2026

// Instructions:
// Face Off is an interactive computational artwork that transforms real-time facial capture into falling “face balls”, using gameplay to explore how friction between human behaviour and computational systems generates new forms of interaction and relation.
// Press K to connect Arduino through Web Serial, then step on the CENTER pad to begin. Align your face inside the guide oval and hold still for the countdown. The system captures your face and turns it into falling “face balls”. Use body movement to hit the balls. Upper body hits score +1, lower body hits score +2, and big balls score +3. Step on UP / DOWN / LEFT / RIGHT pads to change music effects and ball behaviour. For testing without Arduino, press SPACE to start or restart.
// Optional Blurb:
// This work explores gameplay as a space of friction between human bodies and computational systems. The player’s face is captured, fragmented, and returned as falling game objects. Through body tracking, sound, and sensor input, the system creates a feedback loop between physical movement and machine perception. Rather than removing friction, the project treats delay, misalignment, and bodily adjustment as central parts of the interaction.

//  Acknowledgements：Rokeby, D. (1990). Very Nervous System. http://www.davidrokeby.com/vns.html

//  Acknowledgements：Porter, B. (2010) PlayStation 2 Controller Arduino Library v1.0. http://www.billporter.info/2010/06/05/playstation-2-controller-arduino-library-v1-0/

// Acknowledgements: Hall, R. (n.d.) Physical Computing 1: Week 5 – Serial Communication and JSON. Course lecture slides. 

// Acknowledgements: ml5.js. BodyPose Reference. https://docs.ml5js.org/#/reference/bodypose

// Acknowledgements: p5.js Reference — createGraphics() https://p5js.org/reference/p5/createGraphics/

//  Acknowledgements：Shiffman, D. (2012). The Nature of Code. https://natureofcode.com

let capture;
let bodyPose;
let poses = [];
let bodyReady = false;

// sound setting
let startSound;
let hitSound;
let missSound;
let gameOverSound;
let bgm;
let rumbleOsc;
let currentMissRate = 1.0;

// control music effect
let lowPass;
let highPass;
let currentMusicMode = "normal";
let bgmBaseVolume = 0.25;
let effectUntil = 0;
let activeMusicEffect = "normal";
let currentRate = 1.0;
let targetRate = 1.0;
let currentLPF = 22000;
let targetLPF = 22000;
let currentHPF = 20;
let targetHPF = 20;
let currentBGMVolume = 0.25;
let targetBGMVolume = 0.25;
let currentLPFRes = 1;
let targetLPFRes = 1;
let currentHPFRes = 1;
let targetHPFRes = 1;

// ball mode
let currentBallMode = "normal";
let ballModeUntil = 0;

// web serial
let serialPort = null;
let serialReader = null;
let serialConnected = false;
let serialBuffer = "";
let lastPadEvent = "none";
let lastPadEventTime = 0;
let padCooldown = 180;

// sensor parsing
let prevSensorActive = {
  right: false,
  up: false,
  down: false,
  left: false,
  center: false
};

let sensorThreshold = {
  right: 120,
  up: 120,
  down: 120,
  left: 120,
  center: 120
};

// game states
let gameState = "idle";
let countdownStart = 0;
let countdownDuration = 1800; // can fix
let flashStart = 0;
let flashDuration = 250;

// captured face
let playerFaceImg = null;
let hasCapturedFace = false;

// balls
let balls = [];
let landedBalls = [];
let burstParticles = [];
let lastSpawnTime = 0;
let spawnInterval = 1100;
let minSpawnInterval = 420;

// score
let score = 0;
let missed = 0;
let maxMissed = 12;
let combo = 0;
let comboText = "";
let comboTimer = 0;

//  game over flood
let gameOverFloodBalls = [];
let gameOverFloodStart = 0;
let gameOverFloodDuration = 2200;

// body collision
let bodyPoints = [];
let torsoWeakZone = null;

// camera
let camScale = 1;
let camOffsetX = 0;
let camOffsetY = 0;

// face validation
let lastEstimatedFaceBox = null;
let faceIsValidForCapture = false;

// guide
let guide = {
  cx: 0,
  cy: 0,
  w: 240,
  h: 295
};

// debug
let showCamera = true;
let showBodyDebug = false;
let showFaceBoxDebug = false;

function preload() {
  soundFormats("wav", "mp3", "ogg");
  startSound = loadSound("321Go.wav");
  hitSound = loadSound("Hit.wav");
  missSound = loadSound("miss.wav");
  gameOverSound = loadSound("gameover.wav");
  bgm = loadSound("gameBGM.wav");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  textFont("sans-serif");

  capture = createCapture(VIDEO, () => {
    console.log("camera ready");
    initBodyPose();
  });

  capture.size(640, 480);
  capture.hide();

  rumbleOsc = new p5.Oscillator("sine");
  rumbleOsc.freq(42);
  rumbleOsc.amp(0);
  rumbleOsc.start();

  lowPass = new p5.LowPass();
  highPass = new p5.HighPass();

  if (bgm) {
    bgm.disconnect();
    bgm.connect(lowPass);
    lowPass.connect(highPass);
    highPass.connect();
  }

  resetMusicEffect();
}

function initBodyPose() {
  bodyPose = ml5.bodyPose(
    { modelType: "SINGLEPOSE_LIGHTNING" },
    () => {
      console.log("BodyPose ready");
      bodyReady = true;
      bodyPose.detectStart(capture, gotPoses);
    }
  );
}

function gotPoses(results) {
  poses = results || [];
}

function draw() {
  background(255);
  updateCameraFit();
  updateGuide();
  updateMusicEffectState();
  updateBallModeState();

  if (showCamera) drawCameraBackground();

  updateBodyPoints();
  lastEstimatedFaceBox = estimateFaceBoxFromPose();
  faceIsValidForCapture = isFaceReadyForCapture(lastEstimatedFaceBox);
  torsoWeakZone = getReducedTorsoRect();

  switch (gameState) {
    case "idle":
      drawIdleScreen();
      break;

    case "align_face":
      drawAlignFaceScreen();
      break;

    case "countdown":
      drawCountdownScreen();

      if (!faceIsValidForCapture) {
        gameState = "align_face";
      } else if (millis() - countdownStart >= countdownDuration) {
        capturePlayerFaceFromPose();
      }
      break;

    case "flash":
      drawPlayingScene();
      drawFlash();
      if (millis() - flashStart >= flashDuration) {
        gameState = "playing";
        lastSpawnTime = millis();
      }
      break;

    case "playing":
      updateGame();
      drawPlayingScene();
      break;

    case "game_over_flood":
      updateGameOverFlood();
      drawGameOverFloodScene();
      break;

    case "game_over":
      drawGameOverFloodScene();
      drawGameOverScreen();
      break;
  }

  if (showBodyDebug) drawBodyDebug();
  if (showFaceBoxDebug) drawFaceBoxDebug();
}

// camera and pose utils
function updateCameraFit() {
  let camW = capture.width || 640;
  let camH = capture.height || 480;

  camScale = min(width / camW, height / camH);
  let drawW = camW * camScale;
  let drawH = camH * camScale;

  camOffsetX = (width - drawW) * 0.5;
  camOffsetY = (height - drawH) * 0.5;
}

function updateGuide() {
  guide.cx = width * 0.5;
  guide.cy = height * 0.43;

  // stated window
  let baseW = min(260, width * 0.22);
  guide.w = max(220, baseW);
  guide.h = guide.w * 1.23;
}

function drawCameraBackground() {
  push();
  translate(camOffsetX + capture.width * camScale, camOffsetY);
  scale(-camScale, camScale);
  image(capture, 0, 0, capture.width, capture.height);
  pop();

  push();
  fill(255, 90);
  noStroke();
  rect(0, 0, width, height);
  pop();
}

// state control
function beginFaceCaptureFlow() {
  userStartAudio();
  resetGame();
  stopBGM();
  gameState = "align_face";
}

function startGameFlow() {
  userStartAudio();

  if (startSound && startSound.isLoaded()) {
    startSound.stop();
    startSound.rate(1.0);
    startSound.setVolume(1.0);
    startSound.play();
  }

  setTimeout(() => {
    startBGM();
  }, 450);
}

function resetGame() {
  balls = [];
  landedBalls = [];
  burstParticles = [];
  gameOverFloodBalls = [];

  score = 0;
  missed = 0;
  combo = 0;
  comboText = "";
  comboTimer = 0;

  currentMissRate = 1.0;
  rumbleOsc.amp(0, 0.05);

  spawnInterval = 1100;
  playerFaceImg = null;
  hasCapturedFace = false;

  currentBallMode = "normal";
  ballModeUntil = 0;
}

function maybeStartCountdown() {
  if (faceIsValidForCapture) {
    if (gameState !== "countdown") {
      gameState = "countdown";
      countdownStart = millis();
    }
  } else {
    gameState = "align_face";
  }
}

function capturePlayerFaceFromPose() {
  let box = estimateFaceBoxFromPose();

  if (!box || !isFaceReadyForCapture(box)) {
    gameState = "align_face";
    return;
  }

  let cropX = box.w * 0.12;
  let cropY = box.h * 0.12;

  let sx = constrain(floor(box.x + cropX), 0, capture.width - 1);
  let sy = constrain(floor(box.y + cropY), 0, capture.height - 1);
  let sw = constrain(floor(box.w - cropX * 2), 90, capture.width - sx);
  let sh = constrain(floor(box.h - cropY * 2), 110, capture.height - sy);

  let raw = capture.get(sx, sy, sw, sh);

  let size = max(sw, sh);
  let square = createGraphics(size, size);
  square.clear();
  square.imageMode(CENTER);

  let scaleToFill = 1.22;
  square.image(raw, size / 2, size / 2, sw * scaleToFill, sh * scaleToFill);

  let maskG = createGraphics(size, size);
  maskG.pixelDensity(1);
  maskG.background(0);
  maskG.noStroke();
  maskG.fill(255);
  maskG.circle(size / 2, size / 2, size * 0.94);

  let masked = square.get();
  masked.mask(maskG.get());

  playerFaceImg = masked;
  hasCapturedFace = true;

  startGameFlow();
  gameState = "flash";
  flashStart = millis();
}

// music control
function startBGM() {
  if (!bgm || !bgm.isLoaded()) return;
  if (bgm.isPlaying()) return;

  resetMusicEffect();
  bgm.setVolume(0);
  bgm.loop();
  bgm.setVolume(bgmBaseVolume, 1.2);
}

function stopBGM() {
  if (bgm && bgm.isPlaying()) {
    bgm.setVolume(0, 0.5);
    setTimeout(() => {
      if (bgm && bgm.isPlaying()) bgm.stop();
    }, 550);
  }
  currentMusicMode = "normal";
  activeMusicEffect = "normal";
  effectUntil = 0;
}

function resetMusicEffect() {
  if (!bgm) return;

  activeMusicEffect = "normal";
  effectUntil = 0;

  currentRate = 1.0;
  targetRate = 1.0;

  currentLPF = 22000;
  targetLPF = 22000;

  currentHPF = 20;
  targetHPF = 20;

  currentBGMVolume = bgmBaseVolume;
  targetBGMVolume = bgmBaseVolume;

  currentLPFRes = 1;
  targetLPFRes = 1;

  currentHPFRes = 1;
  targetHPFRes = 1;

  if (bgm.isPlaying()) {
    bgm.rate(currentRate);
    bgm.setVolume(currentBGMVolume);
  }

  if (lowPass) {
    lowPass.freq(currentLPF);
    lowPass.res(currentLPFRes);
  }

  if (highPass) {
    highPass.freq(currentHPF);
    highPass.res(currentHPFRes);
  }

  currentMusicMode = "normal";
}

function updateMusicEffectState() {
  if (!bgm || !bgm.isLoaded()) return;

  if (activeMusicEffect !== "normal" && millis() > effectUntil) {
    activeMusicEffect = "normal";

    targetRate = 1.0;
    targetLPF = 22000;
    targetHPF = 20;
    targetBGMVolume = bgmBaseVolume;

    targetLPFRes = 1;
    targetHPFRes = 1;

    currentMusicMode = "normal";
  }

  currentRate = lerp(currentRate, targetRate, 0.22);
  currentLPF = lerp(currentLPF, targetLPF, 0.20);
  currentHPF = lerp(currentHPF, targetHPF, 0.20);
  currentBGMVolume = lerp(currentBGMVolume, targetBGMVolume, 0.18);

  currentLPFRes = lerp(currentLPFRes, targetLPFRes, 0.18);
  currentHPFRes = lerp(currentHPFRes, targetHPFRes, 0.18);

  if (bgm.isPlaying()) {
    bgm.rate(currentRate);
    bgm.setVolume(currentBGMVolume);
  }

  if (lowPass) {
    lowPass.freq(currentLPF);
    lowPass.res(currentLPFRes);
  }

  if (highPass) {
    highPass.freq(currentHPF);
    highPass.res(currentHPFRes);
  }
}

function applyMusicEffect(dir) {
  if (!bgm || !bgm.isLoaded()) return;
  if (!bgm.isPlaying()) startBGM();

  activeMusicEffect = dir;
  effectUntil = millis() + 900;

  currentBallMode = dir;
  ballModeUntil = millis() + 1800;

  if (dir === "up") {
    targetRate = 1.18;
    targetLPF = 18000;
    targetHPF = 180;
    targetBGMVolume = 0.30;
    targetLPFRes = 1;
    targetHPFRes = 3;
    currentMusicMode = "UP / brighter faster";
  } else if (dir === "down") {
    targetRate = 0.86;
    targetLPF = 1200;
    targetHPF = 20;
    targetBGMVolume = 0.26;
    targetLPFRes = 6;
    targetHPFRes = 1;
    currentMusicMode = "DOWN / deeper slower";
  } else if (dir === "left") {
    targetRate = 0.96;
    targetLPF = 700;
    targetHPF = 20;
    targetBGMVolume = 0.27;
    targetLPFRes = 8;
    targetHPFRes = 1;
    currentMusicMode = "LEFT / warm muffled";
  } else if (dir === "right") {
    targetRate = 1.04;
    targetLPF = 22000;
    targetHPF = 1200;
    targetBGMVolume = 0.30;
    targetLPFRes = 1;
    targetHPFRes = 6;
    currentMusicMode = "RIGHT / thin bright";
  }
}

function updateBallModeState() {
  if (currentBallMode !== "normal" && millis() > ballModeUntil) {
    currentBallMode = "normal";
  }
}

// serial
async function connectArduino() {
  if (!("serial" in navigator)) {
    alert("Please use Chrome or Edge for Web Serial.");
    return;
  }

  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 57600 });
    serialConnected = true;
    serialBuffer = "";
    console.log("Arduino connected");
    readSerialLoop();
  } catch (err) {
    console.error("Arduino connection failed:", err);
  }
}

async function readSerialLoop() {
  while (serialPort && serialPort.readable) {
    try {
      serialReader = serialPort.readable.getReader();

      while (true) {
        const { value, done } = await serialReader.read();
        if (done) break;

        if (value) {
          serialBuffer += new TextDecoder().decode(value);

          let lines = serialBuffer.split("\n");
          serialBuffer = lines.pop();

          for (let line of lines) {
            handleSerialLine(line.trim());
          }
        }
      }
    } catch (err) {
      console.error("Serial read error:", err);
      break;
    } finally {
      if (serialReader) serialReader.releaseLock();
    }
  }

  serialConnected = false;
}

function handleSerialLine(line) {
  if (!line) return;

  console.log("SERIAL:", line);

  let pad = parsePadFromSerial(line);
  if (pad) triggerPadAction(pad);
}

function parsePadFromSerial(line) {
  let s = line.trim();

  try {
    let obj = JSON.parse(s);

    if (
      typeof obj.right === "number" &&
      typeof obj.up === "number" &&
      typeof obj.down === "number" &&
      typeof obj.left === "number" &&
      typeof obj.center === "number"
    ) {
      let vals = [obj.right, obj.up, obj.down, obj.left, obj.center];
      return detectPadFromFiveSensorValues(vals);
    }
  } catch (e) {}

  if (/^\d+$/.test(s)) {
    let n = int(s);
    if (n === 0) return "right";
    if (n === 1) return "up";
    if (n === 2) return "down";
    if (n === 3) return "left";
    if (n === 4) return "center";
  }

  let nums = s.match(/-?\d+/g);
  if (nums && nums.length >= 5) {
    let vals = nums.slice(0, 5).map(Number);
    return detectPadFromFiveSensorValues(vals);
  }

  return null;
}

function detectPadFromFiveSensorValues(vals) {
  let currentActive = {
    right: vals[0] > sensorThreshold.right,
    up: vals[1] > sensorThreshold.up,
    down: vals[2] > sensorThreshold.down,
    left: vals[3] > sensorThreshold.left,
    center: vals[4] > sensorThreshold.center
  };

  let names = ["right", "up", "down", "left", "center"];
  let strongestIndex = 0;
  let strongestValue = vals[0];

  for (let i = 1; i < 5; i++) {
    if (vals[i] > strongestValue) {
      strongestValue = vals[i];
      strongestIndex = i;
    }
  }

  let strongestPad = names[strongestIndex];

  if (currentActive[strongestPad] && !prevSensorActive[strongestPad]) {
    prevSensorActive = currentActive;
    return strongestPad;
  }

  prevSensorActive = currentActive;
  return null;
}

function triggerPadAction(pad) {
  let now = millis();

  if (pad === lastPadEvent && now - lastPadEventTime < padCooldown) return;

  lastPadEvent = pad;
  lastPadEventTime = now;

  console.log("PAD:", pad);

  if (pad === "center") {
    if (gameState === "idle" || gameState === "game_over") {
      beginFaceCaptureFlow();
      return;
    }
  }

  if (gameState === "playing") {
    if (pad === "up" || pad === "down" || pad === "left" || pad === "right") {
      applyMusicEffect(pad);
    }
  }
}

// face & pose 
function getPoseKeypoint(name) {
  if (!poses.length || !poses[0] || !poses[0].keypoints) return null;
  return poses[0].keypoints.find(k => k.name === name) || null;
}

function validKP(kp) {
  return kp && (kp.confidence === undefined || kp.confidence > 0.08);
}

function estimateFaceBoxFromPose() {
  if (!poses.length || !poses[0] || !poses[0].keypoints) return null;

  let nose = getPoseKeypoint("nose");
  let leftEye = getPoseKeypoint("left_eye");
  let rightEye = getPoseKeypoint("right_eye");
  let leftEar = getPoseKeypoint("left_ear");
  let rightEar = getPoseKeypoint("right_ear");
  let leftShoulder = getPoseKeypoint("left_shoulder");
  let rightShoulder = getPoseKeypoint("right_shoulder");

  if (!validKP(nose) || !validKP(leftEye) || !validKP(rightEye)) return null;

  let xs = [];
  let ys = [];

  [nose, leftEye, rightEye, leftEar, rightEar].forEach(k => {
    if (validKP(k)) {
      xs.push(k.x);
      ys.push(k.y);
    }
  });

  if (xs.length < 3) return null;

  let minX = min(xs);
  let maxX = max(xs);
  let minY = min(ys);
  let maxY = max(ys);

  let faceWidth = maxX - minX;
  let faceHeight = maxY - minY;

  let eyeDist = dist(leftEye.x, leftEye.y, rightEye.x, rightEye.y);

  if (faceWidth < 40) {
    faceWidth = max(eyeDist * 2.3, 100);
    minX = nose.x - faceWidth * 0.5;
    maxX = nose.x + faceWidth * 0.5;
  }

  if (faceHeight < 45) {
    faceHeight = max(eyeDist * 1.8, 110);
  }

  if (validKP(leftShoulder) && validKP(rightShoulder)) {
    let shoulderDist = dist(
      leftShoulder.x, leftShoulder.y,
      rightShoulder.x, rightShoulder.y
    );
    faceWidth = min(faceWidth, shoulderDist * 0.78);
  }

  let w = max(faceWidth * 1.60, 120);
  let h = max(faceHeight * 2.20, 150);

  let x = nose.x - w * 0.5;
  let y = nose.y - h * 0.43;

  if (h < 95 || w < 85) return null;

  return { x, y, w, h };
}

function isFaceReadyForCapture(box) {
  if (!box) return false;

  let nose = getPoseKeypoint("nose");
  let leftEye = getPoseKeypoint("left_eye");
  let rightEye = getPoseKeypoint("right_eye");
  if (!validKP(nose) || !validKP(leftEye) || !validKP(rightEye)) return false;
  if (box.w < 80 || box.h < 105) return false;

  let ratio = box.h / box.w;
  if (ratio < 0.80 || ratio > 2.40) return false;
  if (box.x < -25 || box.y < -25) return false;
  if (box.x + box.w > capture.width + 25) return false;
  if (box.y + box.h > capture.height + 25) return false;

  let screenX = camOffsetX + (capture.width - box.x - box.w) * camScale;
  let screenY = camOffsetY + box.y * camScale;
  let screenW = box.w * camScale;
  let screenH = box.h * camScale;

  let faceCx = screenX + screenW / 2;
  let faceCy = screenY + screenH / 2;

  let dx = abs(faceCx - guide.cx);
  let dy = abs(faceCy - guide.cy);

  if (dx > guide.w * 0.50) return false;
  if (dy > guide.h * 0.46) return false;
  if (screenW < guide.w * 0.38 || screenW > guide.w * 1.85) return false;
  if (screenH < guide.h * 0.38 || screenH > guide.h * 1.85) return false;

  return true;
}

function updateBodyPoints() {
  bodyPoints = [];

  if (!poses.length || !poses[0] || !poses[0].keypoints) return;

  let names = [
    "nose",
    "left_elbow", "right_elbow",
    "left_wrist", "right_wrist",
    "left_knee", "right_knee",
    "left_ankle", "right_ankle"
  ];

  for (let name of names) {
    let kp = getPoseKeypoint(name);
    if (validKP(kp)) {
      bodyPoints.push({
        name,
        x: camOffsetX + (capture.width - kp.x) * camScale,
        y: camOffsetY + kp.y * camScale
      });
    }
  }
}

function getReducedTorsoRect() {
  let ls = getPoseKeypoint("left_shoulder");
  let rs = getPoseKeypoint("right_shoulder");
  let lh = getPoseKeypoint("left_hip");
  let rh = getPoseKeypoint("right_hip");

  let pts = [ls, rs, lh, rh].filter(validKP);
  if (pts.length < 4) return null;

  let xs = pts.map(p => camOffsetX + (capture.width - p.x) * camScale);
  let ys = pts.map(p => camOffsetY + p.y * camScale);

  let minX = min(xs);
  let maxX = max(xs);
  let minY = min(ys);
  let maxY = max(ys);

  let fullW = maxX - minX;
  let fullH = maxY - minY;

  let x = minX + fullW * 0.22;
  let y = minY + fullH * 0.18;
  let w = fullW * 0.56;
  let h = fullH * 0.45;

  return { x, y, w, h };
}

// game logic
function updateGame() {
  if (hasCapturedFace && millis() - lastSpawnTime > spawnInterval) {
    spawnBall();
    lastSpawnTime = millis();
    spawnInterval = max(minSpawnInterval, spawnInterval - 8);
  }

  for (let i = balls.length - 1; i >= 0; i--) {
    let b = balls[i];

    b.vy += b.gravity;
    b.x += b.vx;
    b.y += b.vy;

    if (b.specialType === "drift") {
      let t = (millis() - b.bornAt) * 0.012;
      b.x += sin(t + b.wobbleOffset) * b.driftAmount;
    }

    if (b.specialType === "fake") {
      let t = (millis() - b.bornAt) * 0.014;
      b.x += sin(t + b.fakePhase) * b.zigzagAmount;

      if (t > 7 && t < 11) {
        b.x += b.fakeBurst;
      }

      if (t > 11 && t < 15) {
        b.x -= b.fakeBurst * 0.55;
      }
    }

    b.rotation += b.rotSpeed;
    b.vx *= 0.999;

    let speed = abs(b.vy) + abs(b.vx) * 0.6;
    let targetStretchY = map(speed, 0, 14, 1.0, 1.26, true);
    let targetStretchX = map(speed, 0, 14, 1.0, 0.8, true);

    b.stretchX = lerp(b.stretchX, targetStretchX, 0.16);
    b.stretchY = lerp(b.stretchY, targetStretchY, 0.16);

    b.x += sin(frameCount * 0.05 + b.wobbleOffset) * 0.28;

    let hitPart = checkBallBodyCollision(b);
    if (hitPart) {
      let burstStrength = 1;
      let points = 1;

      let lowerBodyHit =
        hitPart === "left_ankle" || hitPart === "right_ankle" ||
        hitPart === "left_knee" || hitPart === "right_knee";

      if (b.type === "big") {
        points = 3;
        burstStrength = lowerBodyHit ? 1.9 : 1.45;
      } else if (lowerBodyHit) {
        points = 2;
        burstStrength = 1.75;
      } else {
        points = 1;

        if (hitPart === "left_wrist" || hitPart === "right_wrist") {
          burstStrength = 1.15;
        } else if (hitPart === "left_elbow" || hitPart === "right_elbow") {
          burstStrength = 1.05;
        }
      }

      createBurst(b.x, b.y, b.r, burstStrength, hitPart);

      if (hitSound && hitSound.isLoaded()) {
        let rate = map(constrain(combo, 0, 12), 0, 12, 1.0, 1.45);
        hitSound.stop();
        hitSound.rate(rate);
        hitSound.setVolume(0.9);
        hitSound.play();
      }

      balls.splice(i, 1);

      currentMissRate = lerp(currentMissRate, 1.0, 0.35);
      score += points;
      combo++;
      comboText = "SELF ATTACK x" + combo;
      comboTimer = 60;
      continue;
    }

    let floorY = height - getLandedStackHeightAtX(b.x);
    if (b.y + b.r * b.stretchY >= floorY) {
      landBall(b);
      balls.splice(i, 1);
    }
  }

  updateBurstParticles();

  if (comboTimer > 0) {
    comboTimer--;
  }

  if (missed >= maxMissed && gameState === "playing") {
    startGameOverFlood();
  }
}

function spawnBall() {
  if (!playerFaceImg) return;

  let lane = floor(random(3));
  let x, y, vx, vy;

  if (lane === 0) {
    x = random(-120, width * 0.12);
    y = random(-120, -20);
    vx = random(2.6, 4.8);
    vy = random(1.8, 3.3);
  } else if (lane === 1) {
    x = random(width * 0.35, width * 0.65);
    y = random(-150, -30);
    vx = random(-0.7, 0.7);
    vy = random(2.2, 3.8);
  } else {
    x = random(width * 0.88, width + 120);
    y = random(-120, -20);
    vx = random(-4.8, -2.6);
    vy = random(1.8, 3.3);
  }

  let isBig = random() < 0.2;
  let r = isBig ? random(100, 150) : random(60, 120);

  let ballType = "normal";
  let gravity = isBig ? random(0.18, 0.26) : random(0.16, 0.24);

  let driftAmount = 0;
  let fakePhase = random(TWO_PI);
  let fakeBurst = random([-1, 1]) * random(6, 11);
  let zigzagAmount = 0;

  if (currentBallMode === "up") {
    vx *= 2.0;
    vy *= 1.7;
    gravity *= 1.25;
    ballType = "fast";
  } else if (currentBallMode === "down") {
    vx *= 0.45;
    vy *= 0.52;
    gravity *= 0.78;
    ballType = "slow";
  } else if (currentBallMode === "left") {
    vx *= 0.9;
    vy *= 0.88;
    gravity *= 0.95;
    zigzagAmount = random(4.5, 7.5);
    ballType = "fake";
  } else if (currentBallMode === "right") {
    driftAmount = random(4.5, 7.5);
    vx *= 1.05;
    vy *= 1.0;
    ballType = "drift";
  }

  balls.push({
    type: isBig ? "big" : "normal",
    specialType: ballType,
    x,
    y,
    r,
    vx,
    vy,
    gravity,
    rotation: random(TWO_PI),
    rotSpeed: random(-0.035, 0.035),
    stretchX: 1,
    stretchY: 1,
    wobbleOffset: random(TWO_PI),
    driftAmount,
    fakePhase,
    fakeBurst,
    zigzagAmount,
    bornAt: millis()
  });
}

function checkBallBodyCollision(ball) {
  for (let p of bodyPoints) {
    let hitRadius = 16;

    if (p.name === "left_wrist" || p.name === "right_wrist") hitRadius = 28;
    if (p.name === "left_elbow" || p.name === "right_elbow") hitRadius = 22;
    if (p.name === "nose") hitRadius = 18;
    if (p.name === "left_knee" || p.name === "right_knee") hitRadius = 24;
    if (p.name === "left_ankle" || p.name === "right_ankle") hitRadius = 32;

    let d = dist(ball.x, ball.y, p.x, p.y);
    if (d < ball.r + hitRadius) {
      return p.name;
    }
  }

  if (torsoWeakZone) {
    let cx = constrain(ball.x, torsoWeakZone.x, torsoWeakZone.x + torsoWeakZone.w);
    let cy = constrain(ball.y, torsoWeakZone.y, torsoWeakZone.y + torsoWeakZone.h);
    let d = dist(ball.x, ball.y, cx, cy);

    if (d < ball.r * 0.42) {
      return "torso";
    }
  }

  return null;
}

function landBall(ball) {
  let h = getLandedStackHeightAtX(ball.x);

  let landedR = ball.r;
  if (ball.type === "big") {
    landedR *= 1.35;
  }

  landedBalls.push({
    type: ball.type,
    x: constrain(ball.x, landedR, width - landedR),
    y: height - h - landedR * 0.82,
    r: landedR,
    rotation: random(TWO_PI),
    stretchX: random(1.08, 1.32),
    stretchY: random(0.72, 0.95),
    settle: 0
  });

  missed++;

  if (missSound && missSound.isLoaded()) {
    currentMissRate = max(0.72, currentMissRate - 0.045);
    missSound.stop();
    missSound.rate(currentMissRate);
    missSound.setVolume(0.95);
    missSound.play();
  }

  combo = 0;
  comboText = "";
  comboTimer = 0;
}

function getLandedStackHeightAtX(x) {
  let h = 0;
  for (let b of landedBalls) {
    if (abs(b.x - x) < (b.r + 55)) {
      h += b.r * 0.88;
    }
  }
  return h;
}

// game over flood
function startGameOverFlood() {
  stopBGM();

  if (gameOverSound && gameOverSound.isLoaded()) {
    gameOverSound.stop();
    gameOverSound.rate(1.0);
    gameOverSound.setVolume(1.0);
    gameOverSound.play();
  }

  rumbleOsc.freq(42);
  rumbleOsc.amp(0.14, 0.12);

  gameState = "game_over_flood";
  gameOverFloodBalls = [];
  gameOverFloodStart = millis();

  for (let i = 0; i < 42; i++) {
    let isBig = random() < 0.28;
    let r = isBig ? random(95, 165) : random(55, 120);

    gameOverFloodBalls.push({
      type: isBig ? "big" : "normal",
      x: random(-80, width + 80),
      y: random(-height * 1.4, -40),
      r,
      vx: random(-1.2, 1.2),
      vy: random(2.5, 6.5),
      gravity: random(0.18, 0.28),
      rotation: random(TWO_PI),
      rotSpeed: random(-0.03, 0.03),
      stretchX: 1,
      stretchY: 1,
      wobbleOffset: random(TWO_PI),
      landed: false
    });
  }
}

function updateGameOverFlood() {
  for (let b of gameOverFloodBalls) {
    if (b.landed) continue;

    b.vy += b.gravity;
    b.x += b.vx;
    b.y += b.vy;
    b.rotation += b.rotSpeed;

    let speed = abs(b.vy) + abs(b.vx) * 0.5;
    let targetStretchY = map(speed, 0, 14, 1.0, 1.22, true);
    let targetStretchX = map(speed, 0, 14, 1.0, 0.84, true);

    b.stretchX = lerp(b.stretchX, targetStretchX, 0.15);
    b.stretchY = lerp(b.stretchY, targetStretchY, 0.15);

    let floorY = height - getGameOverFloodHeightAtX(b.x);
    if (b.y + b.r * b.stretchY >= floorY) {
      b.y = floorY - b.r * 0.82;
      b.stretchX = random(1.08, 1.28);
      b.stretchY = random(0.74, 0.95);
      b.landed = true;
    }
  }

  if (millis() - gameOverFloodStart > gameOverFloodDuration) {
    rumbleOsc.amp(0, 0.4);
    gameState = "game_over";
  }
}

function getGameOverFloodHeightAtX(x) {
  let h = 0;
  for (let b of gameOverFloodBalls) {
    if (!b.landed) continue;
    if (abs(b.x - x) < (b.r + 55)) {
      h += b.r * 0.86;
    }
  }
  return h;
}

// burst effect
function createBurst(x, y, r, strength = 1, hitPart = "") {
  let count = floor(map(r, 60, 120, 8, 14) * strength);

  for (let i = 0; i < count; i++) {
    let ang = random(TWO_PI);
    let spd = random(2.0, 6.0) * strength;
    let upwardBoost = 0;

    if (hitPart === "left_ankle" || hitPart === "right_ankle") {
      upwardBoost = random(1.5, 3.2);
    } else if (hitPart === "left_knee" || hitPart === "right_knee") {
      upwardBoost = random(0.8, 1.8);
    }

    let pr = random(r * 0.12, r * 0.3);

    burstParticles.push({
      x,
      y,
      vx: cos(ang) * spd,
      vy: sin(ang) * spd - random(0.2, 1.2) * strength - upwardBoost,
      gravity: 0.12,
      drag: 0.985,
      r: pr,
      rot: random(TWO_PI),
      rotSpeed: random(-0.08, 0.08),
      alpha: 255,
      life: random(28, 46),
      stretchX: random(0.8, 1.35),
      stretchY: random(0.8, 1.35)
    });
  }
}

function updateBurstParticles() {
  for (let i = burstParticles.length - 1; i >= 0; i--) {
    let p = burstParticles[i];

    p.vy += p.gravity;
    p.vx *= p.drag;
    p.vy *= p.drag;

    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.rotSpeed;

    p.alpha -= 255 / p.life;

    if (p.alpha <= 0) {
      burstParticles.splice(i, 1);
    }
  }
}

// drawing
function drawPlayingScene() {
  drawLandedBalls();
  drawFallingBalls();
  drawBurstParticles();
  drawHUD();
  drawComboText();
}

function drawGameOverFloodScene() {
  background(245);

  if (showCamera) drawCameraBackground();

  drawLandedBalls();

  for (let b of gameOverFloodBalls) {
    drawFaceBall(
      b.x,
      b.y,
      b.r,
      b.rotation,
      b.stretchX,
      b.stretchY,
      b.type || "normal"
    );
  }
}

function drawFallingBalls() {
  for (let b of balls) {
    drawFaceBall(
      b.x,
      b.y,
      b.r,
      b.rotation,
      b.stretchX,
      b.stretchY,
      b.specialType || b.type || "normal"
    );
  }
}

function drawLandedBalls() {
  for (let b of landedBalls) {
    b.settle += 0.03;
    let sx = lerp(b.stretchX, 1.08, min(b.settle, 1));
    let sy = lerp(b.stretchY, 0.94, min(b.settle, 1));
    drawFaceBall(b.x, b.y, b.r, b.rotation, sx, sy, b.type || "normal");
  }
}

function drawBurstParticles() {
  for (let p of burstParticles) {
    push();
    translate(p.x, p.y);
    rotate(p.rot);
    scale(p.stretchX, p.stretchY);

    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.ellipse(0, 0, p.r, p.r, 0, 0, Math.PI * 2);
    drawingContext.clip();

    tint(255, p.alpha);

    if (playerFaceImg) {
      imageMode(CENTER);
      image(playerFaceImg, 0, 0, p.r * 2.2, p.r * 2.0);
    } else {
      noStroke();
      fill(220, p.alpha);
      ellipse(0, 0, p.r * 2, p.r * 2);
    }

    noTint();
    drawingContext.restore();

    noFill();
    stroke(255, p.alpha * 0.45);
    strokeWeight(1);
    ellipse(0, 0, p.r * 2, p.r * 2);
    pop();
  }
}

function drawFaceBall(x, y, r, rot = 0, sx = 1, sy = 1, type = "normal") {
  push();
  translate(x, y);
  rotate(rot);
  scale(sx, sy);

  noStroke();
  fill(255, 28);
  ellipse(r * 0.14, r * 0.14, r * 2.08, r * 2.0);

  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.ellipse(0, 0, r, r, 0, 0, Math.PI * 2);
  drawingContext.clip();

  if (playerFaceImg) {
    imageMode(CENTER);
    let faceW = r * 2.42;
    let faceH = r * 2.18;
    image(playerFaceImg, 0, 0, faceW, faceH);

    noStroke();
    fill(255, 55);
    ellipse(-r * 0.22, -r * 0.28, r * 0.7, r * 0.42);

    fill(0, 20);
    ellipse(r * 0.22, r * 0.28, r * 1.75, r * 1.5);
  } else {
    fill(220);
    ellipse(0, 0, r * 2, r * 2);
  }

  drawingContext.restore();

  if (type === "big") {
    noFill();
    stroke(255, 180, 0, 180);
    strokeWeight(4);
    ellipse(0, 0, r * 2.06, r * 2.06);
  }

  if (type === "fake") {
    noFill();
    stroke(120, 120, 120, 190);
    strokeWeight(3);
    ellipse(0, 0, r * 2.18, r * 2.18);
  }

  if (type === "drift") {
    noFill();
    stroke(0, 180, 255, 190);
    strokeWeight(3);
    ellipse(0, 0, r * 2.14, r * 2.14);
  }

  if (type === "fast") {
    noFill();
    stroke(255, 80, 80, 190);
    strokeWeight(3);
    ellipse(0, 0, r * 2.12, r * 2.12);
  }

  if (type === "slow") {
    noFill();
    stroke(120, 80, 255, 190);
    strokeWeight(3);
    ellipse(0, 0, r * 2.12, r * 2.12);
  }

  noFill();
  stroke(255, 130);
  strokeWeight(1.5);
  ellipse(0, 0, r * 2, r * 2);
  pop();
}

function drawHUD() {
  fill(20);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(18);
  text(`Score: ${score}`, 20, 20);
  text(`Missed: ${missed}/${maxMissed}`, 20, 46);

  fill(20, 120);
  textSize(14);
  text(`Upper body +1 / Lower body +2 / Big ball +3`, 20, 74);
  text(`CENTER = face capture / restart`, 20, 94);
  text(`UP / DOWN / LEFT / RIGHT = music + ball modes`, 20, 114);
  text(`K = connect Arduino`, 20, 134);
  text(serialConnected ? `Arduino: connected` : `Arduino: not connected`, 20, 154);
  text(`Music FX: ${currentMusicMode}`, 20, 174);
  text(`Ball Mode: ${currentBallMode}`, 20, 194);
  text(`UP=FAST  DOWN=SLOW  LEFT=FAKE  RIGHT=DRIFT`, 20, 214);
}

function drawComboText() {
  if (combo >= 2 && comboTimer > 0) {
    push();
    textAlign(CENTER, CENTER);
    textSize(34);
    fill(20);
    text(comboText, width / 2, height * 0.14);
    pop();
  }
}

function drawIdleScreen() {
  fill(20);
  textAlign(CENTER, CENTER);

  textSize(34);
  text("FACE BALL GAME", width / 2, height * 0.28);

  textSize(18);
  text("Press K once to connect Arduino", width / 2, height * 0.38);
  text("Step on CENTER pad to begin face capture", width / 2, height * 0.43);
  text("After face capture: 321Go -> music -> game", width / 2, height * 0.48);

  drawGuideOverlay();
}

function drawAlignFaceScreen() {
  drawGuideOverlay();

  fill(20);
  textAlign(CENTER, CENTER);
  textSize(30);
  text("Align your face", width / 2, height * 0.18);

  textSize(16);
  text("Show both eyes and nose inside the oval", width / 2, height * 0.24);

  if (faceIsValidForCapture) {
    maybeStartCountdown();
  }
}

function drawCountdownScreen() {
  drawGuideOverlay();

  let elapsed = millis() - countdownStart;
  let remain = max(0, countdownDuration - elapsed);
  let sec = ceil(remain / 1000);

  fill(20);
  textAlign(CENTER, CENTER);

  textSize(22);
  text("Hold still", width / 2, height * 0.16);
  textSize(120);
  text(sec, width / 2, height * 0.5);
  textSize(16);
  text("Capturing face...", width / 2, height * 0.68);
}

function drawGuideOverlay() {
  push();
  noFill();
  stroke(faceIsValidForCapture ? color(40, 170, 80) : color(255, 255, 255, 170));
  strokeWeight(3);
  ellipse(guide.cx, guide.cy, guide.w, guide.h);

  fill(255, 255, 255, 25);
  noStroke();
  ellipse(guide.cx, guide.cy, guide.w * 0.92, guide.h * 0.92);
  pop();
}

function drawFlash() {
  let t = (millis() - flashStart) / flashDuration;
  let a = map(t, 0, 1, 255, 0);
  noStroke();
  fill(255, a);
  rect(0, 0, width, height);
}

function drawGameOverScreen() {
  push();
  fill(255, 230);
  noStroke();
  rect(0, 0, width, height);

  fill(20);
  textAlign(CENTER, CENTER);
  textSize(52);
  text("GAME OVER", width / 2, height * 0.36);

  textSize(26);
  text(`Score: ${score}`, width / 2, height * 0.48);
  text(`Missed: ${missed}`, width / 2, height * 0.55);

  textSize(18);
  text("Step on CENTER pad to restart", width / 2, height * 0.67);
  pop();
}

// bodydebug
function drawBodyDebug() {
  push();

  for (let p of bodyPoints) {
    noStroke();

    if (p.name.includes("wrist")) fill(0, 180, 255);
    else if (p.name.includes("ankle")) fill(255, 120, 0);
    else if (p.name.includes("knee")) fill(255, 190, 0);
    else fill(80, 120, 255);

    circle(p.x, p.y, 12);
  }

  if (torsoWeakZone) {
    noFill();
    stroke(255, 0, 0, 120);
    rect(torsoWeakZone.x, torsoWeakZone.y, torsoWeakZone.w, torsoWeakZone.h);
  }

  pop();
}

function drawFaceBoxDebug() {
  if (!lastEstimatedFaceBox) return;

  push();
  noFill();
  stroke(255, 0, 0);
  strokeWeight(2);

  rect(
    camOffsetX + (capture.width - lastEstimatedFaceBox.x - lastEstimatedFaceBox.w) * camScale,
    camOffsetY + lastEstimatedFaceBox.y * camScale,
    lastEstimatedFaceBox.w * camScale,
    lastEstimatedFaceBox.h * camScale
  );

  pop();
}

// input function
function keyPressed() {
  if (key === " ") {
    if (gameState === "idle" || gameState === "game_over") {
      beginFaceCaptureFlow();
    }
  }

  if (key === "k" || key === "K") {
    connectArduino();
  }

  if (key === "d" || key === "D") {
    showBodyDebug = !showBodyDebug;
  }

  if (key === "f" || key === "F") {
    showFaceBoxDebug = !showFaceBoxDebug;
  }

  if (key === "c" || key === "C") {
    showCamera = !showCamera;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}