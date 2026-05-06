import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- Procedural Texture Generation ---
function createHexTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#050505'; ctx.fillRect(0,0,512,512);
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2;
    const a = 2 * Math.PI / 6; const r = 32;
    for (let y = r; y < 512 + r; y += r * Math.sin(a)) {
        for (let x = r, j = 0; x < 512 + r; x += r * (1 + Math.cos(a)), y += (-1) ** j++ * r * Math.sin(a)) {
            ctx.beginPath(); for (let i = 0; i < 6; i++) ctx.lineTo(x + r * Math.cos(a * i), y + r * Math.sin(a * i));
            ctx.closePath(); ctx.stroke();
        }
    }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(20, 20);
    return tex;
}

function createCarbonTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111'; ctx.fillRect(0,0,128,128); ctx.fillStyle = '#222';
    for(let i=0; i<128; i+=16) { for(let j=0; j<128; j+=16) { if((i+j)%32 === 0) ctx.fillRect(i,j,16,16); } }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(5, 5);
    return tex;
}

function createSkyboxTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000005'; ctx.fillRect(0,0,1024,1024);
    for(let i=0; i<1000; i++) {
        ctx.fillStyle = Math.random() > 0.8 ? '#00f0ff' : (Math.random() > 0.8 ? '#ff0055' : '#ffffff');
        ctx.beginPath(); ctx.arc(Math.random()*1024, Math.random()*1024, Math.random()*1.5, 0, Math.PI*2); ctx.fill();
    }
    return new THREE.CanvasTexture(canvas);
}

// --- Audio Engine ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime; let vol = state.volume;
    
    if (type === 'shoot') {
        osc.type = 'square'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.15);
        gain.gain.setValueAtTime(0.1 * vol, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'boom') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.5);
        gain.gain.setValueAtTime(0.4 * vol, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
    } else if (type === 'jump') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(150, now); osc.frequency.linearRampToValueAtTime(400, now + 0.2);
        gain.gain.setValueAtTime(0.1 * vol, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'dash') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(600, now); osc.frequency.linearRampToValueAtTime(100, now + 0.2);
        gain.gain.setValueAtTime(0.2 * vol, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'hit') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.2 * vol, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'damage') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
        gain.gain.setValueAtTime(0.5 * vol, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
    }
}

// --- Global State ---
const state = {
    inGame: false, isPaused: false, isGameOver: false,
    score: 0, timeLeft: 60, hp: 100,
    mapType: 'arena', weapon: 'Pistol', 
    bloomIntensity: 2.0, resScale: 1.0, difficulty: 1, matchTime: 60, volume: 1.0, sensitivity: 1.0
};

// --- DOM & Settings ---
const DOM = {
    mainMenu: document.getElementById('main-menu'), pauseMenu: document.getElementById('pause-menu'), gameOverScreen: document.getElementById('game-over-screen'),
    hud: document.getElementById('hud-layer'), tabBtns: document.querySelectorAll('.tab-btn'), tabPanes: document.querySelectorAll('.tab-pane'),
    weaponBtns: document.querySelectorAll('.weapon-btn'), mapBtns: document.querySelectorAll('.map-btn'),
    startBtn: document.getElementById('start-game-btn'), resumeBtn: document.getElementById('resume-btn'), quitBtn: document.getElementById('quit-btn'), restartBtn: document.getElementById('restart-btn'), menuBtn: document.getElementById('menu-btn'),
    score: document.getElementById('scoreValue'), timer: document.getElementById('timerValue'), weaponName: document.getElementById('weaponValue'), finalScore: document.getElementById('final-score'),
    crosshair: document.getElementById('crosshair'), hitMarker: document.getElementById('hit-marker'), healthBar: document.getElementById('health-bar'), damageOverlay: document.getElementById('damage-overlay'),
    killFeed: document.getElementById('kill-feed'), dirDamageContainer: document.getElementById('damage-indicator-container'), healthText: document.getElementById('health-text')
};

DOM.tabBtns.forEach(btn => btn.addEventListener('click', () => {
    DOM.tabBtns.forEach(b => b.classList.remove('active')); DOM.tabPanes.forEach(p => p.classList.remove('active'));
    btn.classList.add('active'); document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active'); playSound('hit');
}));

function setupSelection(btns, stateKey) {
    btns.forEach(btn => btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active')); btn.classList.add('active');
        state[stateKey] = btn.dataset[stateKey] || btn.dataset.weapon || btn.dataset.map;
        playSound('hit');
    }));
}
setupSelection(DOM.weaponBtns, 'weapon'); setupSelection(DOM.mapBtns, 'mapType');

function bindOption(sliderId, valId, stateKey, parser, formatter, callback) {
    const slider = document.getElementById(sliderId); const valLabel = document.getElementById(valId);
    slider.addEventListener('input', (e) => {
        state[stateKey] = parser(e.target.value); valLabel.innerText = formatter(state[stateKey]);
        if(callback) callback();
    });
}
bindOption('opt-bloom', 'opt-bloom-val', 'bloomIntensity', parseFloat, v => v===0?'Off':(v===1?'Low':'High'), () => bloomPass.strength = state.bloomIntensity);
bindOption('opt-res', 'opt-res-val', 'resScale', parseFloat, v => (v*100)+'%', () => renderer.setPixelRatio(window.devicePixelRatio * state.resScale));
bindOption('opt-diff', 'opt-diff-val', 'difficulty', parseInt, v => v===0?'Easy':(v===1?'Normal':'Hard'));
bindOption('opt-time', 'opt-time-val', 'matchTime', parseInt, v => v);
bindOption('opt-vol', 'opt-vol-val', 'volume', parseFloat, v => Math.round(v*100)+'%');
bindOption('opt-sens', 'opt-sens-val', 'sensitivity', parseFloat, v => v.toFixed(1), () => controls.pointerSpeed = state.sensitivity);

// --- Engine Setup ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050510, 0.015);

const skyboxGeo = new THREE.SphereGeometry(500, 32, 32);
const skyboxMat = new THREE.MeshBasicMaterial({ map: createSkyboxTexture(), side: THREE.BackSide, color: 0x888888 });
const skybox = new THREE.Mesh(skyboxGeo, skyboxMat); scene.add(skybox);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight); renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 2.0, 0.4, 0.85);
bloomPass.threshold = 0.1; composer.addPass(bloomPass);

const controls = new PointerLockControls(camera, document.body); scene.add(controls.getObject());

const playerGroup = new THREE.Group();
const bodyGeo = new THREE.BoxGeometry(1, 1.5, 1);
const bodyMat = new THREE.MeshPhongMaterial({ color: 0x00f0ff, emissive: 0x0055aa, emissiveIntensity: 0.2 });
const playerBody = new THREE.Mesh(bodyGeo, bodyMat); playerBody.position.y = 0.75; playerBody.castShadow = true; playerGroup.add(playerBody);
const playerHead = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshPhongMaterial({ color: 0xffffff }));
playerHead.position.y = 1.8; playerHead.castShadow = true; playerGroup.add(playerHead);

const playerController = new THREE.Group(); playerController.position.set(0, 1, 0);
scene.add(playerController); playerController.add(playerGroup);
controls.getObject().position.set(0, 1, 0); camera.position.set(0, 2, 5); camera.lookAt(0, 1, -10);

let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, canJump = false, doubleJumped = false, isDashing = false;
let walkBob = 0;
const velocity = new THREE.Vector3(); const direction = new THREE.Vector3();
const gravity = 40;

scene.add(new THREE.AmbientLight(0xffffff, 0.3));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 50, 20); dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024; dirLight.shadow.mapSize.height = 1024;
scene.add(dirLight);

// --- Advanced Map Generation ---
let mapObjects = []; let enemies = []; let projectiles = []; let enemyLasers = []; let particles = []; let damageSprites = [];
const hexTex = createHexTexture(); const carbonTex = createCarbonTexture();
const floorRaycaster = new THREE.Raycaster();

function clearMap() {
    [mapObjects, enemies.map(e=>e.group), projectiles.map(p=>p.mesh), enemyLasers.map(l=>l.mesh), particles, damageSprites.map(s=>s.sprite)].flat().forEach(obj => scene.remove(obj));
    mapObjects = []; enemies = []; projectiles = []; enemyLasers = []; particles = []; damageSprites = [];
}

function addMapObject(mesh) {
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh); mapObjects.push(mesh);
}

function buildColosseum() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshPhongMaterial({ map: hexTex, color: 0xaaaaaa }));
    floor.rotation.x = -Math.PI / 2; addMapObject(floor);

    const cMat = new THREE.MeshPhongMaterial({map: carbonTex, color: 0x555555});
    const glowMat = new THREE.MeshPhongMaterial({map: carbonTex, emissive: 0x00f0ff, emissiveIntensity: 0.5});
    
    // Center Tower
    addMapObject(new THREE.Mesh(new THREE.BoxGeometry(20, 8, 20), cMat)).position.set(0, 4, 0);
    
    // Ramps
    const rGeo = new THREE.BoxGeometry(10, 1, 25);
    for(let i=0; i<4; i++) {
        const ramp = new THREE.Mesh(rGeo, glowMat);
        ramp.position.set(0, 4, 20);
        ramp.rotation.x = -Math.PI / 6;
        
        const pivot = new THREE.Group();
        pivot.add(ramp); pivot.rotation.y = (Math.PI/2) * i;
        scene.add(pivot); mapObjects.push(ramp); // Add ramp mesh for raycasting
    }

    // Outer Pillars
    for(let i=0; i<8; i++) {
        const angle = (Math.PI/4) * i;
        const p = new THREE.Mesh(new THREE.BoxGeometry(10, 20, 10), cMat);
        p.position.set(60 * Math.cos(angle), 10, 60 * Math.sin(angle));
        addMapObject(p);
    }
}

function buildLabyrinth() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshPhongMaterial({ color: 0x050505 }));
    floor.rotation.x = -Math.PI / 2; addMapObject(floor);
    scene.fog.density = 0.04;

    const wallMat = new THREE.MeshPhongMaterial({ color: 0x0a0a1a, emissive: 0xff0055, emissiveIntensity: 0.2, map: carbonTex });
    const gridSize = 10; const cellSize = 15;
    
    // Simple Cellular Automata for maze
    for(let x=-gridSize/2; x<gridSize/2; x++) {
        for(let z=-gridSize/2; z<gridSize/2; z++) {
            if (x===0 && z===0) continue; // Clear start
            if (Math.random() > 0.6) {
                const wall = new THREE.Mesh(new THREE.BoxGeometry(cellSize, 20, cellSize), wallMat);
                wall.position.set(x*cellSize, 10, z*cellSize);
                addMapObject(wall);
            }
        }
    }
    // Ceiling
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshPhongMaterial({ map: hexTex, color: 0xaaaaaa }));
    roof.rotation.x = Math.PI / 2; roof.position.y = 20; addMapObject(roof);
}

function buildVerticalSlums() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshPhongMaterial({ map: hexTex, color: 0x0a0a0a }));
    floor.rotation.x = -Math.PI / 2; addMapObject(floor);

    const cMat = new THREE.MeshPhongMaterial({map: carbonTex, color: 0x333333});
    const gMat = new THREE.MeshPhongMaterial({color: 0x0a0a1a, emissive: 0x00f0ff, emissiveIntensity: 0.5});

    for(let i=0; i<15; i++) {
        const px = (Math.random()-0.5)*150, pz = (Math.random()-0.5)*150;
        if (Math.abs(px) < 20 && Math.abs(pz) < 20) continue; // Clear spawn

        // Stacked boxes
        let curY = 0;
        for(let j=0; j<4; j++) {
            const h = Math.random()*10 + 5;
            const w = 30 - (j * 6); // Gets narrower
            const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), j%2===0 ? cMat : gMat);
            box.position.set(px + (Math.random()*4-2), curY + h/2, pz + (Math.random()*4-2));
            addMapObject(box);
            curY += h;
        }
    }
}

function buildMap(type) {
    clearMap();
    if (type === 'arena') buildColosseum();
    else if (type === 'platform') buildLabyrinth();
    else buildVerticalSlums();
    
    const enemyCount = state.difficulty === 0 ? 10 : (state.difficulty === 1 ? 20 : 30);
    for(let i=0; i<enemyCount; i++) spawnEnemy();
}

function spawnEnemy() {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 1.5), new THREE.MeshPhongMaterial({ color: 0xff0055, emissive: 0xff0055, emissiveIntensity: 1.0, map: carbonTex }));
    mesh.position.y = 1.25; mesh.castShadow = true; group.add(mesh);
    
    const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.2), new THREE.MeshBasicMaterial({color: 0x330000})); hpBg.position.y = 3.5;
    const hpFg = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.2), new THREE.MeshBasicMaterial({color: 0x00ff00})); hpFg.position.y = 3.51; hpFg.position.z = 0.01;
    group.add(hpBg); group.add(hpFg);

    group.position.set((Math.random()-0.5)*150, 100, (Math.random()-0.5)*150); // Start high and drop to floor
    scene.add(group);
    const speed = state.difficulty === 0 ? 4 : (state.difficulty === 1 ? 8 : 12);
    enemies.push({ group, mesh, hpFg, hp: 100, maxHp: 100, vel: new THREE.Vector3((Math.random()-0.5)*speed, 0, (Math.random()-0.5)*speed), lastShot: 0 });
}

// --- Combat & UI Feedback ---
const weapons = {
    Pistol: { damage: 34, fireRate: 300, type: 'ray' },
    AssaultRifle: { damage: 15, fireRate: 100, type: 'ray' },
    Sniper: { damage: 100, fireRate: 1200, type: 'ray', scoped: true },
    Shotgun: { damage: 12, fireRate: 800, type: 'spread', pellets: 8 },
    Rocket: { damage: 100, fireRate: 1000, type: 'projectile' }
};

let isShooting = false, isScoped = false, lastShot = 0;
const raycaster = new THREE.Raycaster(); const center = new THREE.Vector2(0, 0);

function createDamageSprite(damage, position) {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 40px Teko'; ctx.fillStyle = '#ff0055'; ctx.textAlign = 'center'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
    ctx.fillText(damage.toString(), 64, 45);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
    sprite.position.copy(position); sprite.position.y += 2; sprite.scale.set(3, 1.5, 1); scene.add(sprite);
    damageSprites.push({ sprite, life: 1.0 });
}

function addKillFeed() {
    const el = document.createElement('div'); el.className = 'kill-log'; el.innerHTML = `ELIMINATED <span style="color:#ff0055">ENEMY UNIT</span>`;
    DOM.killFeed.appendChild(el); setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
}

function showDirectionalDamage(sourcePos) {
    DOM.dirDamageContainer.classList.add('active');
    const playerPos = controls.getObject().position;
    const playerDir = new THREE.Vector3(0,0,-1).applyQuaternion(controls.getObject().quaternion);
    const toEnemy = new THREE.Vector3().subVectors(sourcePos, playerPos).normalize();
    const angle = Math.atan2(playerDir.x * toEnemy.z - playerDir.z * toEnemy.x, playerDir.x * toEnemy.x + playerDir.z * toEnemy.z) * (180 / Math.PI);
    
    document.querySelectorAll('.dir-damage').forEach(el => el.classList.remove('hit'));
    if (angle > -45 && angle <= 45) document.getElementById('dir-damage-top').classList.add('hit');
    else if (angle > 45 && angle <= 135) document.getElementById('dir-damage-right').classList.add('hit');
    else if (angle > -135 && angle <= -45) document.getElementById('dir-damage-left').classList.add('hit');
    else document.getElementById('dir-damage-bottom').classList.add('hit');
    setTimeout(() => DOM.dirDamageContainer.classList.remove('active'), 500);
}

function handleShooting(time) {
    if (!state.inGame || state.isPaused || state.isGameOver) return;
    if (!isShooting && weapons[state.weapon].type !== 'spread') return;
    const w = weapons[state.weapon];
    if (time - lastShot >= w.fireRate) {
        if (isShooting) {
            playSound('shoot'); fireWeapon(w); lastShot = time;
            if (w.type !== 'ray' || state.weapon === 'Pistol' || state.weapon === 'Sniper') isShooting = false;
        }
    }
}

function fireWeapon(w) {
    DOM.crosshair.style.transform = `translate(-50%, -60%) scale(1.2)`; setTimeout(() => DOM.crosshair.style.transform = `translate(-50%, -50%) scale(1)`, 100);
    const enemyMeshes = enemies.map(e => e.mesh);
    if (w.type === 'ray') {
        raycaster.setFromCamera(center, camera); const intersects = raycaster.intersectObjects(enemyMeshes);
        if (intersects.length > 0) damageEnemy(intersects[0].object, w.damage);
    } else if (w.type === 'spread') {
        for(let i=0; i<w.pellets; i++) {
            raycaster.setFromCamera(new THREE.Vector2((Math.random()-0.5)*0.15, (Math.random()-0.5)*0.15), camera);
            const intersects = raycaster.intersectObjects(enemyMeshes); if (intersects.length > 0) damageEnemy(intersects[0].object, w.damage);
        }
    } else if (w.type === 'projectile') {
        const rocket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1), new THREE.MeshBasicMaterial({color: 0xffaa00}));
        rocket.position.copy(camera.position); rocket.quaternion.copy(camera.quaternion); rocket.translateZ(-2);
        const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
        scene.add(rocket); projectiles.push({ mesh: rocket, dir: dir, speed: 60, life: 3.0 });
    }
}

function damageEnemy(mesh, amount) {
    const enemy = enemies.find(e => e.mesh === mesh); if (!enemy) return;
    enemy.hp -= amount; enemy.hpFg.scale.x = Math.max(0, enemy.hp / enemy.maxHp); enemy.hpFg.position.x = -1 * (1 - enemy.hpFg.scale.x);
    createDamageSprite(amount, enemy.group.position);
    DOM.hitMarker.classList.add('active'); setTimeout(() => DOM.hitMarker.classList.remove('active'), 100);
    createParticles(enemy.group.position, 0xff0055, 5); playSound('hit');

    if (enemy.hp <= 0) {
        playSound('boom'); createParticles(enemy.group.position, 0xffaa00, 40);
        scene.remove(enemy.group); enemies.splice(enemies.indexOf(enemy), 1);
        state.score++; DOM.score.innerText = state.score; addKillFeed(); spawnEnemy();
    }
}

function playerTakeDamage(amount, sourcePos) {
    state.hp -= amount; DOM.healthBar.style.width = `${Math.max(0, state.hp)}%`; DOM.healthText.innerText = `INTEGRITY: ${Math.max(0, state.hp)}%`;
    showDirectionalDamage(sourcePos); DOM.damageOverlay.classList.add('active'); playSound('damage');
    setTimeout(() => DOM.damageOverlay.classList.remove('active'), 300);
    if (state.hp <= 0) gameOver();
}

function createParticles(pos, color, count=10) {
    const mat = new THREE.MeshBasicMaterial({color});
    for(let i=0; i<count; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat);
        p.position.copy(pos); p.userData = { vel: new THREE.Vector3((Math.random()-0.5)*20, Math.random()*20, (Math.random()-0.5)*20), life: 1.0 };
        scene.add(p); particles.push(p);
    }
}

// --- Inputs ---
document.addEventListener('keydown', (e) => {
    if (!state.inGame) return;
    switch (e.code) {
        case 'KeyW': moveForward = true; break; case 'KeyA': moveLeft = true; break;
        case 'KeyS': moveBackward = true; break; case 'KeyD': moveRight = true; break;
        case 'ShiftLeft': 
            if (!isDashing) { isDashing = true; playSound('dash'); velocity.x *= 5; velocity.z *= 5; setTimeout(() => isDashing = false, 500); } break;
        case 'Space': 
            if (canJump) { velocity.y = 20; canJump = false; playSound('jump'); } 
            else if (!doubleJumped) { velocity.y = 20; doubleJumped = true; playSound('jump'); createParticles(playerGroup.position, 0x00f0ff, 10); } break;
        case 'Escape': togglePause(); break;
    }
});
document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'KeyW': moveForward = false; break; case 'KeyA': moveLeft = false; break;
        case 'KeyS': moveBackward = false; break; case 'KeyD': moveRight = false; break;
    }
});
document.addEventListener('mousedown', e => {
    if (state.inGame && !state.isPaused && e.button === 0) { if (!controls.isLocked) controls.lock(); else isShooting = true; }
    if (state.inGame && e.button === 2 && weapons[state.weapon].scoped) { isScoped = true; camera.fov = 20; camera.updateProjectionMatrix(); DOM.crosshair.classList.add('scoped'); }
});
document.addEventListener('mouseup', e => {
    if (e.button === 0) isShooting = false;
    if (e.button === 2) { isScoped = false; camera.fov = 75; camera.updateProjectionMatrix(); DOM.crosshair.classList.remove('scoped'); }
});
document.addEventListener('contextmenu', e => e.preventDefault());

controls.addEventListener('lock', () => { if (state.inGame && state.isPaused) togglePause(); });
controls.addEventListener('unlock', () => {
    if (state.inGame && !state.isPaused && !state.isGameOver) togglePause();
    if (isScoped) { isScoped = false; camera.fov = 75; camera.updateProjectionMatrix(); DOM.crosshair.classList.remove('scoped'); }
});

// --- Flow ---
function startGame() {
    state.inGame = true; state.isPaused = false; state.isGameOver = false;
    state.score = 0; state.timeLeft = state.matchTime; state.hp = 100;
    DOM.score.innerText = state.score; DOM.timer.innerText = state.timeLeft;
    DOM.weaponName.innerText = state.weapon.toUpperCase(); DOM.healthBar.style.width = '100%'; DOM.healthText.innerText = 'INTEGRITY: 100%'; DOM.killFeed.innerHTML = '';
    DOM.mainMenu.classList.add('hidden'); DOM.gameOverScreen.classList.add('hidden'); DOM.hud.classList.remove('hidden');
    buildMap(state.mapType);
    controls.getObject().position.set(0, 10, 0); velocity.set(0,0,0);
    if (audioCtx.state === 'suspended') audioCtx.resume();
    controls.lock(); playSound('boom');
}

function togglePause() {
    state.isPaused = !state.isPaused;
    if (state.isPaused) { controls.unlock(); DOM.pauseMenu.classList.remove('hidden'); } else { DOM.pauseMenu.classList.add('hidden'); controls.lock(); }
}

function gameOver() {
    state.isGameOver = true; state.inGame = false; controls.unlock();
    DOM.hud.classList.add('hidden'); DOM.gameOverScreen.classList.remove('hidden'); DOM.finalScore.innerText = state.score;
}

setInterval(() => {
    if (state.inGame && !state.isPaused && !state.isGameOver) {
        state.timeLeft--; DOM.timer.innerText = state.timeLeft; if (state.timeLeft <= 0) gameOver();
    }
}, 1000);

DOM.startBtn.addEventListener('click', startGame); DOM.restartBtn.addEventListener('click', startGame);
DOM.resumeBtn.addEventListener('click', togglePause); DOM.quitBtn.addEventListener('click', () => location.reload());
DOM.menuBtn.addEventListener('click', () => location.reload());
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight); });

// --- Floor Collision Raycasting ---
function getFloorHeight(position) {
    floorRaycaster.set(new THREE.Vector3(position.x, position.y + 2, position.z), new THREE.Vector3(0, -1, 0));
    const intersects = floorRaycaster.intersectObjects(mapObjects);
    if (intersects.length > 0) return intersects[0].point.y;
    return 0; // Fallback floor
}

// --- Loop ---
let prevTimeLoop = performance.now();
function animate(time) {
    requestAnimationFrame(animate);
    const delta = (time - prevTimeLoop) / 1000; prevTimeLoop = time;
    skybox.rotation.y += 0.01 * delta;

    if (state.inGame && !state.isPaused && !state.isGameOver) {
        // Movement
        if (!isDashing) { velocity.x -= velocity.x * 10.0 * delta; velocity.z -= velocity.z * 10.0 * delta; } 
        else { velocity.x -= velocity.x * 2.0 * delta; velocity.z -= velocity.z * 2.0 * delta; }
        velocity.y -= gravity * delta;

        direction.z = Number(moveForward) - Number(moveBackward); direction.x = Number(moveRight) - Number(moveLeft); direction.normalize();
        const speed = 100.0;
        if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

        controls.moveRight(-velocity.x * delta); controls.moveForward(-velocity.z * delta);
        controls.getObject().position.y += (velocity.y * delta);

        // Advanced Floor Collision
        const floorY = getFloorHeight(controls.getObject().position);
        // Player height is 1 unit above floor
        if (controls.getObject().position.y <= floorY + 1) { 
            velocity.y = Math.max(0, velocity.y); // Don't fall through floor, but allow upward momentum from ramps
            controls.getObject().position.y = floorY + 1; 
            canJump = true; doubleJumped = false; 
        }

        const ctrlObj = controls.getObject(); playerGroup.position.copy(ctrlObj.position); playerGroup.rotation.y = ctrlObj.rotation.y;
        if ((moveForward || moveBackward || moveLeft || moveRight) && canJump) {
            walkBob += delta * 15; playerBody.position.y = 0.75 + Math.sin(walkBob) * 0.1; playerHead.position.y = 1.8 + Math.sin(walkBob) * 0.1;
        } else { playerBody.position.y = 0.75; playerHead.position.y = 1.8; }
        playerBody.rotation.z = THREE.MathUtils.lerp(playerBody.rotation.z, (moveRight ? -0.15 : (moveLeft ? 0.15 : 0)), 0.1);

        handleShooting(time);

        // Enemy AI
        enemies.forEach(e => {
            e.group.lookAt(ctrlObj.position.x, e.group.position.y, ctrlObj.position.z);
            e.group.children[1].lookAt(camera.position); e.group.children[2].lookAt(camera.position);

            // Enemy Floor Collision
            const eFloor = getFloorHeight(e.group.position);
            e.group.position.y -= gravity * delta;
            if (e.group.position.y < eFloor + 1) e.group.position.y = eFloor + 1;

            if (state.mapType === 'platform') {
                // Avoid falling off maze edges simply by slowing down or just static movement
                // Simple wander
                e.group.position.addScaledVector(e.vel, delta * 0.5);
            } else {
                e.group.position.addScaledVector(e.vel, delta);
            }
            
            if (Math.abs(e.group.position.x) > 100) e.vel.x *= -1;
            if (Math.abs(e.group.position.z) > 100) e.vel.z *= -1;

            const fireRate = state.difficulty === 0 ? 3000 : (state.difficulty === 1 ? 2000 : 1000);
            if (time - e.lastShot > fireRate) {
                if (Math.random() > 0.3 && e.group.position.distanceTo(ctrlObj.position) < 80) {
                    playSound('shoot');
                    const laser = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.5), new THREE.MeshBasicMaterial({color: 0xff0000}));
                    laser.position.copy(e.group.position); laser.position.y += 1.5;
                    const inaccuracy = state.difficulty === 0 ? 5 : (state.difficulty === 1 ? 2 : 0.5);
                    laser.lookAt(ctrlObj.position.x + (Math.random()-0.5)*inaccuracy, ctrlObj.position.y + 1, ctrlObj.position.z + (Math.random()-0.5)*inaccuracy);
                    scene.add(laser); enemyLasers.push({ mesh: laser, dir: new THREE.Vector3(0,0,-1).applyQuaternion(laser.quaternion), life: 2.0 });
                    e.lastShot = time;
                }
            }
        });

        const damageAmt = state.difficulty === 0 ? 5 : (state.difficulty === 1 ? 15 : 30);
        for (let i = enemyLasers.length - 1; i >= 0; i--) {
            const l = enemyLasers[i]; l.mesh.position.addScaledVector(l.dir, 60 * delta); l.life -= delta;
            if (l.mesh.position.distanceTo(ctrlObj.position) < 2) { playerTakeDamage(damageAmt, l.mesh.position); scene.remove(l.mesh); enemyLasers.splice(i, 1); }
            else if (l.life <= 0) { scene.remove(l.mesh); enemyLasers.splice(i, 1); }
        }

        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i]; p.mesh.position.addScaledVector(p.dir, p.speed * delta); p.life -= delta;
            let exploded = false;
            enemies.forEach(e => { if (p.mesh.position.distanceTo(e.group.position) < 6) { damageEnemy(e.mesh, weapons.Rocket.damage); exploded = true; } });
            if (p.life <= 0 || exploded || p.mesh.position.y < -10) { playSound('boom'); createParticles(p.mesh.position, 0xffaa00, 40); scene.remove(p.mesh); projectiles.splice(i, 1); }
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.position.addScaledVector(p.userData.vel, delta); p.userData.vel.y -= gravity * 0.5 * delta; p.userData.life -= delta * 1.5;
        p.material.opacity = Math.max(0, p.userData.life); p.material.transparent = true;
        if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); }
    }
    
    for (let i = damageSprites.length - 1; i >= 0; i--) {
        const s = damageSprites[i]; s.sprite.position.y += 2 * delta; s.life -= delta; s.sprite.material.opacity = s.life;
        if (s.life <= 0) { scene.remove(s.sprite); damageSprites.splice(i, 1); }
    }

    composer.render();
}
animate(performance.now());
