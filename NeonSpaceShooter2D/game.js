const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const scoreElement = document.getElementById('scoreValue');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreElement = document.getElementById('finalScore');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Resize canvas to full window
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Game State
let isGameRunning = false;
let score = 0;
let animationId;
let mouse = { x: canvas.width / 2, y: canvas.height / 2 };

// Inputs
const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

window.addEventListener('mousedown', (e) => {
    if (isGameRunning && player) {
        player.shoot();
    }
});

// Classes
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.color = '#0ff';
        this.speed = 5;
        this.angle = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Neon Glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        
        ctx.beginPath();
        // Draw a cool ship shape (triangle)
        ctx.moveTo(this.radius * 1.5, 0);
        ctx.lineTo(-this.radius, -this.radius);
        ctx.lineTo(-this.radius / 2, 0);
        ctx.lineTo(-this.radius, this.radius);
        ctx.closePath();

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.fill();

        ctx.restore();
    }

    update() {
        // Movement
        let dx = 0;
        let dy = 0;

        if (keys.w || keys.ArrowUp) dy -= this.speed;
        if (keys.s || keys.ArrowDown) dy += this.speed;
        if (keys.a || keys.ArrowLeft) dx -= this.speed;
        if (keys.d || keys.ArrowRight) dx += this.speed;

        // Normalize diagonal speed
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx = (dx / length) * this.speed;
            dy = (dy / length) * this.speed;
        }

        this.x += dx;
        this.y += dy;

        // Boundary checks
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        // Aim at mouse
        this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

        this.draw();
    }

    shoot() {
        const velocity = {
            x: Math.cos(this.angle) * 10,
            y: Math.sin(this.angle) * 10
        };
        // Spawn slightly ahead of the ship
        const spawnX = this.x + Math.cos(this.angle) * this.radius * 1.5;
        const spawnY = this.y + Math.sin(this.angle) * this.radius * 1.5;
        
        projectiles.push(new Projectile(spawnX, spawnY, velocity));
    }
}

class Projectile {
    constructor(x, y, velocity) {
        this.x = x;
        this.y = y;
        this.velocity = velocity;
        this.radius = 4;
        this.color = '#fff';
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#0ff';
        
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.draw();
    }
}

class Enemy {
    constructor(x, y, radius, color, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.vertices = Math.floor(Math.random() * 3) + 3; // Triangle, Square, Pentagon
        this.rotation = 0;
        this.rotationSpeed = (Math.random() - 0.5) * 0.1;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        
        ctx.beginPath();
        for (let i = 0; i < this.vertices; i++) {
            const angle = (i * 2 * Math.PI) / this.vertices;
            const px = Math.cos(angle) * this.radius;
            const py = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = this.color.replace(')', ', 0.2)').replace('rgb', 'rgba');
        ctx.fill();

        ctx.restore();
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.rotation += this.rotationSpeed;
        this.draw();
    }
}

class Particle {
    constructor(x, y, radius, color, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.alpha = 1;
        this.friction = 0.98;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.015;
        this.draw();
    }
}

// Game Entities Arrays
let player;
let projectiles = [];
let enemies = [];
let particles = [];
let spawnInterval;

function spawnEnemies() {
    spawnInterval = setInterval(() => {
        if (!isGameRunning) return;

        const radius = Math.random() * (30 - 15) + 15;
        let x, y;

        // Spawn on edges
        if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? 0 - radius : canvas.width + radius;
            y = Math.random() * canvas.height;
        } else {
            x = Math.random() * canvas.width;
            y = Math.random() < 0.5 ? 0 - radius : canvas.height + radius;
        }

        // Colors
        const colors = ['#f0f', '#0f0', '#ff0', '#f00'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        // Velocity towards player
        const angle = Math.atan2(player.y - y, player.x - x);
        const speed = Math.random() * 2 + 1; // Speed between 1 and 3
        const velocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };

        enemies.push(new Enemy(x, y, radius, color, velocity));
    }, 1000); // Spawn every 1 second
}

function createExplosion(x, y, color) {
    const particleCount = 15;
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(
            x, y, 
            Math.random() * 3 + 1, 
            color, 
            {
                x: (Math.random() - 0.5) * (Math.random() * 8),
                y: (Math.random() - 0.5) * (Math.random() * 8)
            }
        ));
    }
}

function animate() {
    animationId = requestAnimationFrame(animate);

    // Fade effect for trails
    ctx.fillStyle = 'rgba(5, 5, 16, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (player) {
        player.update();
    }

    // Handle Particles
    particles.forEach((particle, index) => {
        if (particle.alpha <= 0) {
            particles.splice(index, 1);
        } else {
            particle.update();
        }
    });

    // Handle Projectiles
    projectiles.forEach((projectile, pIndex) => {
        projectile.update();

        // Remove off-screen projectiles
        if (projectile.x + projectile.radius < 0 ||
            projectile.x - projectile.radius > canvas.width ||
            projectile.y + projectile.radius < 0 ||
            projectile.y - projectile.radius > canvas.height) {
            projectiles.splice(pIndex, 1);
        }
    });

    // Handle Enemies
    enemies.forEach((enemy, eIndex) => {
        enemy.update();

        // Collision Enemy <-> Player
        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer - enemy.radius - player.radius < 1) {
            gameOver();
        }

        // Collision Enemy <-> Projectile
        projectiles.forEach((projectile, pIndex) => {
            const dist = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
            
            // Hit detected
            if (dist - enemy.radius - projectile.radius < 1) {
                // Remove projectile
                projectiles.splice(pIndex, 1);

                // Create explosion
                createExplosion(enemy.x, enemy.y, enemy.color);

                // Shrink or remove enemy
                if (enemy.radius > 20) {
                    enemy.radius -= 10;
                    score += 5;
                } else {
                    enemies.splice(eIndex, 1);
                    score += 10;
                }
                
                scoreElement.innerText = score;
            }
        });
    });
}

function startGame() {
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    // Reset state
    score = 0;
    scoreElement.innerText = score;
    projectiles = [];
    enemies = [];
    particles = [];
    
    // Initialize player in center
    player = new Player(canvas.width / 2, canvas.height / 2);
    
    isGameRunning = true;
    
    if (animationId) cancelAnimationFrame(animationId);
    animate();
    
    clearInterval(spawnInterval);
    spawnEnemies();
}

function gameOver() {
    isGameRunning = false;
    cancelAnimationFrame(animationId);
    clearInterval(spawnInterval);
    
    finalScoreElement.innerText = score;
    gameOverScreen.classList.add('active');
    
    // Optional: Big explosion on player
    createExplosion(player.x, player.y, '#0ff');
    createExplosion(player.x, player.y, '#fff');
    createExplosion(player.x, player.y, '#f00');
    
    player = null; // Remove player
    
    // Draw final frame to show explosion
    ctx.fillStyle = 'rgba(5, 5, 16, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => p.draw());
}

// Event Listeners for UI
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
