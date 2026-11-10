const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('high-score');
const startOverlay = document.getElementById('start-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const finalScoreText = document.getElementById('final-score-text');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const muteBtn = document.getElementById('mute-btn');

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 250;
const GROUND_Y = 205;
const GRAVITY = 0.65;
const JUMP_VELOCITY = -12.5;

// Game state
let isPlaying = false;
let isGameOver = false;
let score = 0;
let highScore = parseInt(localStorage.getItem('dino_high_score') || '0', 10);
let gameSpeed = 6;
let frameCount = 0;
let lastMilestone = 0;
let animationId = null;

highScoreDisplay.textContent = String(highScore).padStart(5, '0');

// Mute button handler
muteBtn.addEventListener('click', () => {
  const isMuted = window.soundCtrl.toggleMute();
  muteBtn.textContent = isMuted ? '🔇 Sound: OFF' : '🔊 Sound: ON';
});

// Dino character
const dino = {
  x: 60,
  y: GROUND_Y - 44,
  width: 44,
  height: 46,
  standingHeight: 46,
  duckingHeight: 26,
  vy: 0,
  isGrounded: true,
  isDucking: false,
  legFrame: 0,

  reset() {
    this.x = 60;
    this.isDucking = false;
    this.height = this.standingHeight;
    this.y = GROUND_Y - this.height;
    this.vy = 0;
    this.isGrounded = true;
    this.legFrame = 0;
  },

  jump() {
    if (this.isGrounded && !this.isDucking) {
      this.vy = JUMP_VELOCITY;
      this.isGrounded = false;
      window.soundCtrl.playJump();
    }
  },

  duck(state) {
    if (this.isDucking === state) return;
    this.isDucking = state;
    if (this.isDucking) {
      this.height = this.duckingHeight;
      if (this.isGrounded) {
        this.y = GROUND_Y - this.duckingHeight;
      }
    } else {
      this.height = this.standingHeight;
      if (this.isGrounded) {
        this.y = GROUND_Y - this.standingHeight;
      }
    }
  },

  update() {
    if (!this.isGrounded) {
      this.vy += GRAVITY;
      this.y += this.vy;
      if (this.y >= GROUND_Y - this.height) {
        this.y = GROUND_Y - this.height;
        this.vy = 0;
        this.isGrounded = true;
      }
    }

    if (frameCount % 6 === 0) {
      this.legFrame = (this.legFrame + 1) % 2;
    }
  },

  draw() {
    ctx.fillStyle = '#535353';

    if (!this.isDucking) {
      // Standing / Running Dino
      // Head
      ctx.fillRect(this.x + 18, this.y, 22, 16);
      ctx.fillRect(this.x + 36, this.y + 6, 8, 10);
      // Eye
      ctx.fillStyle = '#fff';
      ctx.fillRect(this.x + 22, this.y + 3, 4, 4);
      ctx.fillStyle = '#535353';

      // Body
      ctx.fillRect(this.x + 8, this.y + 14, 22, 22);
      // Small Arms
      ctx.fillRect(this.x + 28, this.y + 20, 6, 4);

      // Tail
      ctx.fillRect(this.x, this.y + 20, 8, 10);
      ctx.fillRect(this.x + 4, this.y + 16, 6, 6);

      // Legs
      if (!this.isGrounded) {
        // Legs tucked while jumping
        ctx.fillRect(this.x + 12, this.y + 36, 4, 6);
        ctx.fillRect(this.x + 22, this.y + 36, 4, 6);
      } else {
        if (this.legFrame === 0) {
          ctx.fillRect(this.x + 10, this.y + 36, 4, 10);
          ctx.fillRect(this.x + 22, this.y + 36, 6, 5);
        } else {
          ctx.fillRect(this.x + 10, this.y + 36, 6, 5);
          ctx.fillRect(this.x + 22, this.y + 36, 4, 10);
        }
      }
    } else {
      // Ducking Dino
      // Long lower body
      ctx.fillRect(this.x + 6, this.y + 6, 38, 16);
      // Head extended forward
      ctx.fillRect(this.x + 38, this.y + 4, 16, 12);
      // Eye
      ctx.fillStyle = '#fff';
      ctx.fillRect(this.x + 46, this.y + 6, 3, 3);
      ctx.fillStyle = '#535353';

      // Tail
      ctx.fillRect(this.x, this.y + 10, 8, 8);

      // Legs
      if (this.legFrame === 0) {
        ctx.fillRect(this.x + 14, this.y + 20, 4, 6);
        ctx.fillRect(this.x + 28, this.y + 20, 6, 4);
      } else {
        ctx.fillRect(this.x + 14, this.y + 20, 6, 4);
        ctx.fillRect(this.x + 28, this.y + 20, 4, 6);
      }
    }
  }
};

// Obstacle management
class Obstacle {
  constructor(type) {
    this.type = type; // 'cactus-small', 'cactus-large', 'cactus-group', 'bird'
    this.x = CANVAS_WIDTH + Math.random() * 50;

    if (this.type === 'cactus-small') {
      this.width = 18;
      this.height = 36;
      this.y = GROUND_Y - this.height;
    } else if (this.type === 'cactus-large') {
      this.width = 25;
      this.height = 50;
      this.y = GROUND_Y - this.height;
    } else if (this.type === 'cactus-group') {
      this.width = 46;
      this.height = 40;
      this.y = GROUND_Y - this.height;
    } else if (this.type === 'bird') {
      this.width = 38;
      this.height = 24;
      // High (requires ducking) or low (requires jumping)
      this.y = Math.random() > 0.5 ? GROUND_Y - 55 : GROUND_Y - 26;
      this.wingFrame = 0;
    }
  }

  update() {
    this.x -= gameSpeed;
    if (this.type === 'bird' && frameCount % 12 === 0) {
      this.wingFrame = (this.wingFrame + 1) % 2;
    }
  }

  draw() {
    ctx.fillStyle = '#535353';

    if (this.type.startsWith('cactus')) {
      // Main trunk
      ctx.fillRect(this.x + (this.width / 2) - 4, this.y, 8, this.height);
      // Arms
      ctx.fillRect(this.x, this.y + 10, 6, 12);
      ctx.fillRect(this.x, this.y + 10, this.width / 2, 4);
      ctx.fillRect(this.x + this.width - 6, this.y + 6, 6, 12);
      ctx.fillRect(this.x + (this.width / 2), this.y + 14, this.width / 2, 4);
    } else if (this.type === 'bird') {
      // Bird body
      ctx.fillRect(this.x + 8, this.y + 8, 22, 10);
      // Head & beak
      ctx.fillRect(this.x, this.y + 10, 8, 6);
      ctx.fillRect(this.x - 4, this.y + 12, 4, 2);

      // Flapping wings
      if (this.wingFrame === 0) {
        ctx.fillRect(this.x + 14, this.y, 8, 8);
      } else {
        ctx.fillRect(this.x + 14, this.y + 16, 8, 8);
      }
    }
  }

  getBounds() {
    // Slight padding tolerance for forgiving hitboxes
    return {
      x: this.x + 4,
      y: this.y + 4,
      width: this.width - 8,
      height: this.height - 6
    };
  }
}

let obstacles = [];
let spawnTimer = 0;

function spawnObstacle() {
  const types = ['cactus-small', 'cactus-large', 'cactus-group'];
  // Introduce birds after score reaches 150
  if (score > 150) {
    types.push('bird');
  }

  const selectedType = types[Math.floor(Math.random() * types.length)];
  obstacles.push(new Obstacle(selectedType));
}

// Background clouds & ground details
let groundOffset = 0;
const clouds = [
  { x: 180, y: 45, width: 45 },
  { x: 420, y: 70, width: 35 },
  { x: 700, y: 35, width: 50 }
];

function drawEnvironment() {
  // Draw ground line
  ctx.strokeStyle = '#535353';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
  ctx.stroke();

  // Ground grit / pebbles pattern
  groundOffset = (groundOffset + gameSpeed) % 24;
  ctx.fillStyle = '#888';
  for (let x = -groundOffset; x < CANVAS_WIDTH; x += 30) {
    ctx.fillRect(x + 5, GROUND_Y + 5, 4, 1.5);
    ctx.fillRect(x + 18, GROUND_Y + 12, 6, 1.5);
  }

  // Draw Clouds
  ctx.fillStyle = '#d3d3d3';
  clouds.forEach(cloud => {
    cloud.x -= gameSpeed * 0.2;
    if (cloud.x + cloud.width < 0) {
      cloud.x = CANVAS_WIDTH + Math.random() * 80;
      cloud.y = 30 + Math.random() * 50;
    }
    // Cloud shape
    ctx.beginPath();
    ctx.arc(cloud.x + 10, cloud.y + 10, 10, 0, Math.PI * 2);
    ctx.arc(cloud.x + 22, cloud.y + 6, 14, 0, Math.PI * 2);
    ctx.arc(cloud.x + 34, cloud.y + 10, 10, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Check collisions
function checkCollision(dinoObj, obs) {
  const dBox = {
    x: dinoObj.x + 4,
    y: dinoObj.y + 4,
    width: dinoObj.width - 8,
    height: dinoObj.height - 6
  };
  const oBox = obs.getBounds();

  return (
    dBox.x < oBox.x + oBox.width &&
    dBox.x + dBox.width > oBox.x &&
    dBox.y < oBox.y + oBox.height &&
    dBox.y + dBox.height > oBox.y
  );
}

// Game loop
function gameLoop() {
  frameCount++;
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawEnvironment();

  dino.update();
  dino.draw();

  // Obstacle handling
  spawnTimer--;
  if (spawnTimer <= 0) {
    spawnObstacle();
    // Random delay between obstacles, scaled by speed
    spawnTimer = Math.floor(Math.random() * 45 + (85 - Math.min(gameSpeed * 2.5, 35)));
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.update();
    obs.draw();

    if (checkCollision(dino, obs)) {
      gameOver();
      return;
    }

    if (obs.x + obs.width < 0) {
      obstacles.splice(i, 1);
    }
  }

  // Score progression
  if (frameCount % 4 === 0) {
    score++;
    scoreDisplay.textContent = String(score).padStart(5, '0');

    // Milestones every 100 points
    if (score > 0 && score % 100 === 0 && score !== lastMilestone) {
      lastMilestone = score;
      window.soundCtrl.playMilestone();
    }

    // Gradually ramp up speed
    if (score % 80 === 0 && gameSpeed < 14) {
      gameSpeed += 0.35;
    }
  }

  animationId = requestAnimationFrame(gameLoop);
}

function startGame() {
  startOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');

  score = 0;
  lastMilestone = 0;
  gameSpeed = 6;
  frameCount = 0;
  spawnTimer = 40;
  obstacles = [];
  dino.reset();

  scoreDisplay.textContent = '00000';
  isPlaying = true;
  isGameOver = false;

  window.soundCtrl.init();
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(gameLoop);
}

function gameOver() {
  isPlaying = false;
  isGameOver = true;
  window.soundCtrl.playHit();

  if (score > highScore) {
    highScore = score;
    localStorage.setItem('dino_high_score', highScore);
    highScoreDisplay.textContent = String(highScore).padStart(5, '0');
  }

  finalScoreText.textContent = `Score: ${score}`;
  gameOverOverlay.classList.remove('hidden');
}

// User Controls
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (!isPlaying) {
      startGame();
    } else {
      dino.jump();
    }
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    if (isPlaying) {
      dino.duck(true);
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowDown') {
    dino.duck(false);
  }
});

// Click / Touch controls
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
canvas.addEventListener('pointerdown', () => {
  if (!isPlaying) {
    startGame();
  } else {
    dino.jump();
  }
});

// Initial draw of static screen
ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
drawEnvironment();
dino.draw();

