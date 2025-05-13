// Importar módulos necesarios de Three.js
import * as THREE from 'three';

// Configuración del juego
const CONFIG = {
  BOX_SIZE: 3,
  BOX_HEIGHT: 0.5,
  INITIAL_SPEED: 0.08,
  SPEED_INCREASE: 0.002,
  CAMERA_OFFSET: 4,
  BOUNDS: 5,
  COLORS: {
    BACKGROUND: 0x1a1a1a,
    AMBIENT_LIGHT: 0xffffff,
    AMBIENT_INTENSITY: 0.9
  },
  ANIMATION: {
    DROP_SPEED: 0.4,
    BLOCK_PLACE_DELAY: 100,
    CAMERA_SPEED: 0.1
  }
};

// Estado del juego
const gameState = {
  scene: null,
  camera: null,
  renderer: null,
  stack: [],
  currentBlock: null,
  direction: 1,
  gameEnded: false,
  isPlacingBlock: false,
  score: 0,
  speed: CONFIG.INITIAL_SPEED,
  animationId: null,
  lastTime: 0,
  deltaTime: 0,
  sounds: {
    drop: new Audio('/Sounds/drop.mp3'),
    fail: new Audio('/Sounds/fail.mp3')
  }
};

// Función para configurar la escena
function setupScene() {
  gameState.scene = new THREE.Scene();
  gameState.scene.background = new THREE.Color(CONFIG.COLORS.BACKGROUND);
}

// Función para configurar la cámara
function setupCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  gameState.camera = new THREE.OrthographicCamera(
    -CONFIG.BOUNDS * aspect,
    CONFIG.BOUNDS * aspect,
    CONFIG.BOUNDS,
    -CONFIG.BOUNDS,
    0.1,
    100
  );
  gameState.camera.position.set(CONFIG.CAMERA_OFFSET, CONFIG.CAMERA_OFFSET, CONFIG.CAMERA_OFFSET);
  gameState.camera.lookAt(0, 0, 0);
}

// Función para configurar el renderizador
function setupRenderer() {
  gameState.renderer = new THREE.WebGLRenderer({ antialias: true });
  gameState.renderer.setSize(window.innerWidth, window.innerHeight);
  gameState.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(gameState.renderer.domElement);
}

// Función para configurar las luces
function setupLights() {
  const ambient = new THREE.AmbientLight(
    CONFIG.COLORS.AMBIENT_LIGHT,
    CONFIG.COLORS.AMBIENT_INTENSITY
  );
  gameState.scene.add(ambient);
}

// Función para cargar sonidos
async function loadSounds() {
  try {
    await Promise.all([
      gameState.sounds.drop.load(),
      gameState.sounds.fail.load()
    ]);
    gameState.sounds.drop.volume = 0.5;
    gameState.sounds.fail.volume = 0.5;
  } catch (error) {
    console.warn('Error al cargar sonidos:', error);
  }
}

// Función para manejar el redimensionamiento de la ventana
function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  gameState.camera.left = -CONFIG.BOUNDS * aspect;
  gameState.camera.right = CONFIG.BOUNDS * aspect;
  gameState.camera.top = CONFIG.BOUNDS;
  gameState.camera.bottom = -CONFIG.BOUNDS;
  gameState.camera.updateProjectionMatrix();
  gameState.renderer.setSize(window.innerWidth, window.innerHeight);
}

// Función para agregar un nuevo bloque
function addBlock(x, y, width, depth, moving = false) {
  const geometry = new THREE.BoxGeometry(width, CONFIG.BOX_HEIGHT, depth);
  const material = new THREE.MeshLambertMaterial({
    color: new THREE.Color(`hsl(${Math.random() * 360}, 100%, 60%)`)
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, 0);
  gameState.scene.add(mesh);

  const block = { mesh, width, depth, moving };
  if (moving) {
    gameState.currentBlock = block;
  } else {
    gameState.stack.push(block);
  }
  
  return block;
}

// Función para agregar un nuevo bloque móvil
function addNewMovingBlock() {
  const lastBlock = gameState.stack[gameState.stack.length - 1];
  const nextY = gameState.stack.length * CONFIG.BOX_HEIGHT;
  const newBlock = addBlock(-CONFIG.BOUNDS, nextY, lastBlock.width, lastBlock.depth, true);
  gameState.currentBlock = newBlock;
  gameState.isPlacingBlock = false;
  return newBlock;
}

// Función para actualizar la puntuación
function updateScore() {
  gameState.score++;
  document.getElementById('score').textContent = `Bloques: ${gameState.score}`;
}

// Función para aumentar la dificultad
function increaseDifficulty() {
  gameState.speed += CONFIG.SPEED_INCREASE;
}

// Función para finalizar el juego
function endGame() {
  gameState.gameEnded = true;
  const gameOver = document.getElementById('gameOver');
  const finalScore = document.getElementById('finalScore');
  
  if (gameOver && finalScore) {
    gameOver.style.display = 'block';
    finalScore.textContent = `Lograste ${gameState.score} bloques`;
  }
  
  if (gameState.animationId) {
    cancelAnimationFrame(gameState.animationId);
  }
}

// Función para configurar los eventos de entrada
function setupEventListeners() {
  const handleInput = (e) => {
    if (e.type === 'keydown' && e.code !== 'Space') return;
    if (!gameState.gameEnded && !gameState.isPlacingBlock) {
      e.preventDefault();
      placeBlock();
    }
  };

  window.addEventListener('resize', onWindowResize, false);
  window.addEventListener('keydown', handleInput, { passive: false });
  window.addEventListener('touchstart', handleInput, { passive: false });
  window.addEventListener('mousedown', handleInput, { passive: false });
  
  document.addEventListener('touchmove', (e) => {
    if (!gameState.gameEnded) e.preventDefault();
  }, { passive: false });
}

// Función para colocar un bloque
function placeBlock() {
  if (!gameState.currentBlock || gameState.gameEnded || gameState.isPlacingBlock) return;
  
  gameState.isPlacingBlock = true;
  gameState.currentBlock.moving = false;
  const prev = gameState.stack[gameState.stack.length - 1];
  const delta = gameState.currentBlock.mesh.position.x - prev.mesh.position.x;
  const overhang = Math.abs(delta);

  if (overhang >= gameState.currentBlock.width) {
    gameState.sounds.fail.play().catch(console.error);
    return endGame();
  }

  const newWidth = gameState.currentBlock.width - overhang;
  const blockDir = delta > 0 ? 1 : -1;

  // Ajustar bloque alineado
  gameState.currentBlock.mesh.scale.x = newWidth / gameState.currentBlock.width;
  gameState.currentBlock.mesh.position.x -= delta / 2;
  gameState.currentBlock.width = newWidth;

  // Crear pieza que cae
  createFallingPiece(blockDir, newWidth, overhang);

  // Agregar a la pila y actualizar puntuación
  gameState.stack.push(gameState.currentBlock);
  updateScore();
  
  // Reproducir sonido
  gameState.sounds.drop.play().catch(console.error);

  // Aumentar dificultad
  increaseDifficulty();
  
  // Pequeño retraso antes de crear un nuevo bloque
  setTimeout(() => {
    if (!gameState.gameEnded) {
      addNewMovingBlock();
    }
  }, CONFIG.ANIMATION.BLOCK_PLACE_DELAY);
}

// Función para crear una pieza que cae
function createFallingPiece(blockDir, newWidth, overhang) {
  const dropGeom = new THREE.BoxGeometry(overhang, CONFIG.BOX_HEIGHT, gameState.currentBlock.depth);
  const dropMat = new THREE.MeshLambertMaterial({ 
    color: gameState.currentBlock.mesh.material.color,
    transparent: true,
    opacity: 0.9
  });
  
  const drop = new THREE.Mesh(dropGeom, dropMat);
  drop.castShadow = true;
  drop.receiveShadow = true;
  
  drop.position.set(
    gameState.currentBlock.mesh.position.x + blockDir * (newWidth / 2 + overhang / 2),
    gameState.currentBlock.mesh.position.y,
    0
  );
  
  gameState.scene.add(drop);
  animateFallingPiece(drop);
}

// Función para animar la caída de una pieza
function animateFallingPiece(piece) {
  const startTime = performance.now();
  const startY = piece.position.y;
  const duration = 1000;
  
  const animate = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    piece.position.y = startY - (startY + 10) * easedProgress;
    
    piece.rotation.x += 0.05;
    piece.rotation.z += 0.03;
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      gameState.scene.remove(piece);
      piece.geometry.dispose();
      piece.material.dispose();
    }
  };
  
  requestAnimationFrame(animate);
}

// Función para mover el bloque actual
function moveCurrentBlock(deltaTime) {
  if (!gameState.currentBlock?.moving || gameState.gameEnded) return;
  
  gameState.currentBlock.mesh.position.x += gameState.speed * gameState.direction * deltaTime;
  
  if (Math.abs(gameState.currentBlock.mesh.position.x) > CONFIG.BOUNDS) {
    gameState.direction *= -1;
    gameState.currentBlock.mesh.position.x = Math.max(
      -CONFIG.BOUNDS, 
      Math.min(CONFIG.BOUNDS, gameState.currentBlock.mesh.position.x)
    );
  }
}

// Función para actualizar la cámara
function updateCamera(deltaTime) {
  if (!gameState.stack.length) return;
  
  const targetY = gameState.stack.length * CONFIG.BOX_HEIGHT + 2;
  const currentY = gameState.camera.position.y;
  
  if (currentY < targetY) {
    const newY = currentY + (targetY - currentY) * CONFIG.ANIMATION.CAMERA_SPEED * deltaTime;
    gameState.camera.position.y = newY;
    gameState.camera.lookAt(0, newY - 2, 0);
  }
}

// Función para actualizar el juego
function updateGame(deltaTime) {
  if (gameState.gameEnded) return;
  
  moveCurrentBlock(deltaTime);
  updateCamera(deltaTime);
}

// Bucle de animación
function animate(currentTime) {
  gameState.animationId = requestAnimationFrame(animate);
  
  const deltaTime = Math.min(currentTime - gameState.lastTime, 100) / 16.67;
  gameState.lastTime = currentTime;
  
  updateGame(deltaTime);
  gameState.renderer.render(gameState.scene, gameState.camera);
}

// Función para inicializar el juego
async function init() {
  // Configuración inicial
  setupScene();
  setupCamera();
  setupRenderer();
  setupLights();
  
  // Cargar sonidos
  await loadSounds();
  
  // Configurar eventos
  setupEventListeners();
  
  // Agregar bloques iniciales
  addBlock(0, 0, CONFIG.BOX_SIZE, CONFIG.BOX_SIZE);
  addNewMovingBlock();
  
  // Iniciar bucle de animación
  gameState.lastTime = performance.now();
  gameState.animationId = requestAnimationFrame(animate);
}

// Iniciar el juego cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
