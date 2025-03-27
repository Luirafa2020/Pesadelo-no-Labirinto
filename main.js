// --- START OF FILE main.js ---

// --- Importações Three.js ---
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// --- Importa funções dos nossos outros módulos ---
import { loadTextures } from './textures.js';

// --- Constantes do Labirinto ---
const MAZE_SIZE = 12;
const CELL_WIDTH = 5;
const WALL_HEIGHT = 3.5;
const WALL_THICKNESS = 0.5;

// --- Variáveis Globais ---
let scene, camera, renderer, controls;
let mazeData;
const collisionObjects = [];
let exitObject = null;
let gameOverTriggered = false;
const gameOverScreen = document.getElementById('gameOverScreen');

const player = {
    height: 1.8,
    speed: 4.5,
    radius: 0.4,
    collisionBox: new THREE.Box3(),
    velocity: new THREE.Vector3()
};

// --- Variáveis do Monstro ---
const monster = {
    group: null,
    speed: 4.8,
    collisionRadius: 0.7,
    catchDistance: 1.9,
    path: [],
    currentTargetIndex: 0,
    lastKnownPlayerCell: { x: -1, y: -1 },
    pathRecalculationTimer: 0,
    pathRecalculationInterval: 0.7,
    state: 'HUNTING',
    desiredHeight: WALL_HEIGHT * 0.80,
    verticalOffset: 0.05,
    baseOffsetY: 0,
    rotationSpeed: 3.5,
};

// --- Controles de Movimento ---
let moveForward = false; let moveBackward = false;
let moveLeft = false; let moveRight = false;
let flashlightOn = true;

// --- Luzes ---
let flashlight; let ambientLight;

// --- Outros ---
const clock = new THREE.Clock();
let gameRunning = false; let audioInitialized = false;

// --- Elementos do DOM ---
const blocker = document.getElementById('blocker'); const instructions = document.getElementById('instructions');
const loadingText = document.getElementById('loading'); const crosshair = document.getElementById('crosshair');
const messageElement = document.getElementById('message'); const endScreen = document.getElementById('endScreen');
const canvas = document.getElementById('gameCanvas');

// --- Helpers ---
const targetQuaternion = new THREE.Quaternion();
const rotationMatrix = new THREE.Matrix4();
const targetPositionForRotation = new THREE.Vector3();
const monsterMoveDir = new THREE.Vector3();
const currentMonsterPos = new THREE.Vector3();
const currentBasePos = new THREE.Vector3();
const targetPosForMovement = new THREE.Vector3();
const positionUpdateVector = new THREE.Vector3();
const epsilon = 0.01;


// --- Inicialização ---
async function init() {
    try {
        gameOverTriggered = false;
        setupScene();
        setupLights();
        controls = new PointerLockControls(camera, document.body);
        setupControlsListeners();
        setupEventListeners();

        const loadedTextures = await loadTextures(renderer);
        if (!loadedTextures) throw new Error("Falha crítica ao carregar texturas SVG.");

        loadingText.textContent = "Gerando Labirinto...";
        mazeData = MazeGenerator.generateMaze(MAZE_SIZE, MAZE_SIZE);
        buildMazeGeometry(loadedTextures);

        loadingText.textContent = "Invocando a Sombra...";
        await createMonster();

        loadingText.textContent = "Sintonizando o Medo...";
        audioInitialized = AudioSystem.initAudio();
        if (!audioInitialized) {
           showMessage("Aviso: Áudio não pôde ser inicializado.", 5000, true);
        } else {
             if(typeof AudioSystem !== 'undefined') {
                AudioSystem.updateMonsterSounds(1000);
             }
        }

        loadingText.style.display = 'none';
        instructions.innerHTML = `
                <h1>Pesadelo no Labirinto</h1> <p>Clique para iniciar</p>
                <p>(W, A, S, D = Mover | MOUSE = Olhar | F = Lanterna)</p>
                <p style="color: #f33; font-weight: bold;">ELE TE ENCONTROU.</p>
                <p>Encontre a saída... SE PUDER.</p>
                <p style="font-weight: bold; color: #0f0;">Pronto!</p>`;

    } catch (error) {
        console.error("Erro fatal na inicialização:", error);
        loadingText.textContent = `Erro na inicialização: ${error.message}. Recarregue a página.`;
        loadingText.style.color = 'red';
    }
}

// --- Configuração da Cena Three.js ---
function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.16);
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.y = player.height; camera.position.x = CELL_WIDTH * 0.5 + 0.1; camera.position.z = CELL_WIDTH * 0.5 + 0.1;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
}

// --- Configuração da Iluminação ---
function setupLights() {
    ambientLight = new THREE.AmbientLight(0x030305); scene.add(ambientLight);
    flashlight = new THREE.SpotLight(0xFFF5E0, 2.6, 45, Math.PI / 6.5, 0.25, 1.9);
    flashlight.position.set(0, -0.1, 0.2); flashlight.target.position.set(0, -0.1, -1);
    camera.add(flashlight); camera.add(flashlight.target); scene.add(camera);
}

// --- Configuração dos LISTENERS dos Controles ---
function setupControlsListeners() {
    blocker.addEventListener('click', () => { if (!gameOverTriggered && (!endScreen.style.display || endScreen.style.display === 'none')) { controls.lock(); } });
    controls.addEventListener('lock', () => { if (gameOverTriggered) return; instructions.style.display = 'none'; blocker.style.display = 'none'; crosshair.style.display = 'block'; gameRunning = true; if (audioInitialized && typeof AudioSystem !== 'undefined') AudioSystem.startAudioContext(); console.log("Pointer Locked. Game Running."); });
    controls.addEventListener('unlock', () => { if (!gameOverTriggered && (!endScreen.style.display || endScreen.style.display === 'none')) { blocker.style.display = 'flex'; instructions.style.display = 'block'; } crosshair.style.display = 'none'; gameRunning = false; moveForward = moveBackward = moveLeft = moveRight = false; console.log("Pointer Unlocked. Game Paused/Ended."); });
    scene.add(controls.getObject());
}

// --- Construção da Geometria do Labirinto ---
function buildMazeGeometry(textures) {
    const mazeGroup = new THREE.Group();
    const wallMaterial = new THREE.MeshStandardMaterial({ map: textures.wall, roughness: 0.85, metalness: 0.05 });
    const floorMaterial = new THREE.MeshStandardMaterial({ map: textures.floor, roughness: 0.9, metalness: 0.05 });
    const ceilingMaterial = new THREE.MeshStandardMaterial({ map: textures.ceiling, roughness: 0.95, metalness: 0.05 });
    const exitMaterial = new THREE.MeshStandardMaterial({ map: textures.exit, roughness: 0.7, metalness: 0.1, emissive: 0x008f00, emissiveMap: textures.exit, emissiveIntensity: 1.5, side: THREE.DoubleSide });
    const wallGeometryH = new THREE.BoxBufferGeometry(CELL_WIDTH, WALL_HEIGHT, WALL_THICKNESS);
    const wallGeometryV = new THREE.BoxBufferGeometry(WALL_THICKNESS, WALL_HEIGHT, CELL_WIDTH + WALL_THICKNESS);
    const floorCeilingGeometry = new THREE.PlaneBufferGeometry(MAZE_SIZE * CELL_WIDTH, MAZE_SIZE * CELL_WIDTH);
    const floorMesh = new THREE.Mesh(floorCeilingGeometry, floorMaterial);
    floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.set((MAZE_SIZE * CELL_WIDTH) / 2 - CELL_WIDTH / 2, 0, (MAZE_SIZE * CELL_WIDTH) / 2 - CELL_WIDTH / 2);
    mazeGroup.add(floorMesh);
    const ceilingMesh = new THREE.Mesh(floorCeilingGeometry, ceilingMaterial);
    ceilingMesh.rotation.x = Math.PI / 2; ceilingMesh.position.set((MAZE_SIZE * CELL_WIDTH) / 2 - CELL_WIDTH / 2, WALL_HEIGHT, (MAZE_SIZE * CELL_WIDTH) / 2 - CELL_WIDTH / 2);
    mazeGroup.add(ceilingMesh);
    const wallOffset = WALL_THICKNESS / 2; collisionObjects.length = 0;
    console.log("Construindo paredes e populando collisionObjects...");
    for (let y = 0; y < MAZE_SIZE; y++) {
        for (let x = 0; x < MAZE_SIZE; x++) {
            const cell = mazeData[y][x]; const cellBaseX = x * CELL_WIDTH; const cellBaseZ = y * CELL_WIDTH;
            let wallMesh; let isExitWall = false;
            if (cell.top) { isExitWall = cell.isExit && y === 0; const currentMaterial = isExitWall ? exitMaterial : wallMaterial;
                wallMesh = new THREE.Mesh(wallGeometryH, currentMaterial); wallMesh.position.set(cellBaseX + CELL_WIDTH / 2, WALL_HEIGHT / 2, cellBaseZ - wallOffset);
                mazeGroup.add(wallMesh); if (!isExitWall) { wallMesh.updateMatrixWorld(true); collisionObjects.push(new THREE.Box3().setFromObject(wallMesh)); } }
            if (cell.right) { isExitWall = cell.isExit && x === MAZE_SIZE - 1; const currentMaterial = isExitWall ? exitMaterial : wallMaterial;
                wallMesh = new THREE.Mesh(wallGeometryV, currentMaterial); wallMesh.position.set(cellBaseX + CELL_WIDTH + wallOffset, WALL_HEIGHT / 2, cellBaseZ + CELL_WIDTH / 2);
                mazeGroup.add(wallMesh); if (!isExitWall) { wallMesh.updateMatrixWorld(true); collisionObjects.push(new THREE.Box3().setFromObject(wallMesh)); } }
            if (y === MAZE_SIZE - 1 && cell.bottom) { isExitWall = cell.isExit; const currentMaterial = isExitWall ? exitMaterial : wallMaterial;
                wallMesh = new THREE.Mesh(wallGeometryH, currentMaterial); wallMesh.position.set(cellBaseX + CELL_WIDTH / 2, WALL_HEIGHT / 2, cellBaseZ + CELL_WIDTH + wallOffset);
                mazeGroup.add(wallMesh); if (!isExitWall) { wallMesh.updateMatrixWorld(true); collisionObjects.push(new THREE.Box3().setFromObject(wallMesh)); } }
            if (x === 0 && cell.left) { isExitWall = cell.isExit; const currentMaterial = isExitWall ? exitMaterial : wallMaterial;
                wallMesh = new THREE.Mesh(wallGeometryV, currentMaterial); wallMesh.position.set(cellBaseX - wallOffset, WALL_HEIGHT / 2, cellBaseZ + CELL_WIDTH / 2);
                mazeGroup.add(wallMesh); if (!isExitWall) { wallMesh.updateMatrixWorld(true); collisionObjects.push(new THREE.Box3().setFromObject(wallMesh)); } }
            if (cell.isExit) { addExitMarkerVisual(cellBaseX, cellBaseZ, cell, textures.exit); }
        }
    }
    console.log(`Construção concluída. ${collisionObjects.length} objetos de colisão adicionados.`);
    scene.add(mazeGroup);
}

// --- Adiciona marcador visual da saída ---
function addExitMarkerVisual(cellBaseX, cellBaseZ, cellData, texture) {
     if (exitObject) return; const exitSize = CELL_WIDTH * 0.8; const exitGeo = new THREE.PlaneBufferGeometry(exitSize, WALL_HEIGHT * 0.8);
     const exitMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0.1, emissive: 0x00FF00, emissiveMap: texture, emissiveIntensity: 2.0, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
     exitObject = new THREE.Mesh(exitGeo, exitMat); let posX = cellBaseX + CELL_WIDTH / 2; let posZ = cellBaseZ + CELL_WIDTH / 2; let rotY = 0; const offset = 0.1 + WALL_THICKNESS / 2;
     if (!cellData.top && cellData.y === 0) { posZ = cellBaseZ - offset; rotY = 0; }
     else if (!cellData.right && cellData.x === MAZE_SIZE - 1) { posX = cellBaseX + CELL_WIDTH + offset; rotY = -Math.PI / 2; }
     else if (!cellData.bottom && cellData.y === MAZE_SIZE - 1) { posZ = cellBaseZ + CELL_WIDTH + offset; rotY = Math.PI; }
     else if (!cellData.left && cellData.x === 0) { posX = cellBaseX - offset; rotY = Math.PI / 2; }
     exitObject.position.set(posX, WALL_HEIGHT / 2, posZ); exitObject.rotation.y = rotY; scene.add(exitObject);
     console.log("Marcador de saída visual adicionado em", exitObject.position);
}


// --- CRIAÇÃO DO MONSTRO ---
async function createMonster() {
    if (monster.group) { scene.remove(monster.group); /* TODO: Dispose */ }

    const modelPath = 'monstro/';
    const mtlFile = 'Shadow_Fiend_0327022411_texture.mtl';
    const objFile = 'Shadow_Fiend_0327022411_texture.obj';

    try {
        const mtlLoader = new MTLLoader(); mtlLoader.setPath(modelPath);
        const materials = await mtlLoader.loadAsync(mtlFile);
        materials.preload();

        for (const matName in materials.materials) {
            const mat = materials.materials[matName];
            if (mat.roughness) mat.roughness = 0.85;
            if (mat.metalness) mat.metalness = 0.1;
        }

        const objLoader = new OBJLoader(); objLoader.setMaterials(materials); objLoader.setPath(modelPath);
        const loadedObject = await objLoader.loadAsync(objFile);
        monster.group = loadedObject;

        const box = new THREE.Box3().setFromObject(monster.group);
        const size = new THREE.Vector3(); box.getSize(size);
        console.log("Tamanho original do Shadow Fiend:", size);

        let scale = (size.y > 0) ? monster.desiredHeight / size.y : 1.0;
        monster.group.scale.set(scale, scale, scale);
        console.log("Aplicando escala ao Shadow Fiend:", scale);

        box.setFromObject(monster.group); // Recalcula box
        monster.baseOffsetY = -box.min.y + monster.verticalOffset;

        let startX = 3; let startY = 2;
        if (startX >= MAZE_SIZE || startY >= MAZE_SIZE || startX < 0 || startY < 0) {
            console.warn(`Célula inicial do monstro (${startX}, ${startY}) inválida! Usando (1,1).`);
            startX = 1; startY = 1;
        }

        const worldPos = getPositionFromCell({ x: startX, y: startY });
        monster.group.position.set(worldPos.x, monster.baseOffsetY, worldPos.z);
        console.log("Posição inicial do Shadow Fiend:", monster.group.position);

        // Aplica rotação inicial de 180 graus no eixo Y para corrigir a orientação do modelo.
        monster.group.rotation.y = Math.PI;
        console.log("Aplicada rotação inicial de 180 graus no eixo Y.");

        // A orientação para olhar para o jogador/centro será feita no primeiro update

        monster.group.traverse((child) => { if (child.isMesh) { child.castShadow = false; child.receiveShadow = false; } });

        monster.lastKnownPlayerCell = { x: -1, y: -1 }; monster.path = []; monster.currentTargetIndex = 0; monster.state = 'HUNTING';

        scene.add(monster.group);
        console.log(`Shadow Fiend adicionado na célula (${startX}, ${startY})`);

    } catch (error) {
        console.error("Erro ao carregar o modelo Shadow Fiend:", error);
        loadingText.textContent = `Erro carregando monstro: ${error.message}. Tente recarregar.`;
        loadingText.style.color = 'red';
        throw error;
    }
}


// --- Manipuladores de Eventos ---
function setupEventListeners() { window.addEventListener('resize', onWindowResize, false); document.addEventListener('keydown', onKeyDown, false); document.addEventListener('keyup', onKeyUp, false); }
function onWindowResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }
function onKeyDown(event) { if (!controls.isLocked || gameOverTriggered) return; switch (event.code) { case 'ArrowUp': case 'KeyW': moveForward = true; break; case 'ArrowDown': case 'KeyS': moveBackward = true; break; case 'ArrowLeft': case 'KeyA': moveRight = true; break; // Revertido
case 'ArrowRight': case 'KeyD': moveLeft = true; break; // Revertido
case 'KeyF': toggleFlashlight(); break; } }
function onKeyUp(event) { switch (event.code) { case 'ArrowUp': case 'KeyW': moveForward = false; break; case 'ArrowDown': case 'KeyS': moveBackward = false; break; case 'ArrowLeft': case 'KeyA': moveRight = false; break; // Revertido
case 'ArrowRight': case 'KeyD': moveLeft = false; break; // Revertido
} }

// --- Lógica de Atualização Principal (Game Loop) ---
function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    if (gameRunning && controls.isLocked === true && !gameOverTriggered) {
        updatePlayer(delta);
        updateMonster(delta);
        checkExitCondition();
    }
    renderer.render(scene, camera);
}

// --- Função de Colisão e Deslizamento (Jogador) ---
const collisionResult = new THREE.Vector3(); const playerWorldBox = new THREE.Box3();
const collisionCheckIterations = 3;
function collideAndSlide(currentPos, deltaMove, playerRadius, playerHeight, colliders) {
    if (!colliders || colliders.length === 0) { return deltaMove; }

    collisionResult.copy(deltaMove);
    const playerHalfHeight = playerHeight / 2;
    const playerCenterY = currentPos.y - player.height + playerHalfHeight;

    for (let iter = 0; iter < collisionCheckIterations && collisionResult.lengthSq() > epsilon * epsilon; iter++) {
        playerWorldBox.setFromCenterAndSize(
             new THREE.Vector3(currentPos.x + collisionResult.x, playerCenterY, currentPos.z + collisionResult.z),
             new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2)
        );

        let collisionDetectedInIter = false;
        for (const collider of colliders) {
            if (playerWorldBox.intersectsBox(collider)) {
                collisionDetectedInIter = true;
                const centerDistX = (currentPos.x + collisionResult.x) - collider.getCenter(new THREE.Vector3()).x;
                const centerDistZ = (currentPos.z + collisionResult.z) - collider.getCenter(new THREE.Vector3()).z;
                const combinedHalfWidth = playerRadius + (collider.max.x - collider.min.x) / 2;
                const combinedHalfDepth = playerRadius + (collider.max.z - collider.min.z) / 2;
                const overlapX = combinedHalfWidth - Math.abs(centerDistX);
                const overlapZ = combinedHalfDepth - Math.abs(centerDistZ);

                if (overlapX > 0 && overlapZ > 0) {
                    let normal = new THREE.Vector3();
                    if (overlapX < overlapZ) { normal.set(Math.sign(centerDistX), 0, 0); }
                    else { normal.set(0, 0, Math.sign(centerDistZ)); }
                    const dot = collisionResult.dot(normal);
                    if (dot < 0) { const correction = normal.clone().multiplyScalar(-dot * 1.01); collisionResult.add(correction); }
                }
            }
        }
        if (!collisionDetectedInIter) break;
    }
    collisionResult.y = 0;
    return collisionResult;
}

// --- Atualização da Lógica do Jogador (COM COLISÃO) ---
function updatePlayer(delta) {
    const moveSpeed = player.speed; const dampingFactor = 15.0; const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection); cameraDirection.y = 0; cameraDirection.normalize();
    const cameraRight = new THREE.Vector3(); cameraRight.crossVectors(camera.up, cameraDirection).normalize();
    let moveX = 0; let moveZ = 0;
    if (moveForward) { moveX += cameraDirection.x; moveZ += cameraDirection.z; } if (moveBackward) { moveX -= cameraDirection.x; moveZ -= cameraDirection.z; }
    if (moveLeft) { moveX -= cameraRight.x; moveZ -= cameraRight.z; } if (moveRight) { moveX += cameraRight.x; moveZ += cameraRight.z; }
    const moveDirection = new THREE.Vector3(moveX, 0, moveZ); const isTryingToMove = moveDirection.lengthSq() > epsilon;
    const targetVelocity = new THREE.Vector3();
    if (isTryingToMove) { moveDirection.normalize(); targetVelocity.copy(moveDirection).multiplyScalar(moveSpeed); }
    player.velocity.lerp(targetVelocity, dampingFactor * delta);

    const deltaPosition = player.velocity.clone().multiplyScalar(delta);
    const currentPosition = controls.getObject().position;

    const actualDeltaPosition = collideAndSlide( currentPosition, deltaPosition, player.radius, player.height, collisionObjects );
    currentPosition.add(actualDeltaPosition);

    const movedSignificantly = actualDeltaPosition.lengthSq() > (moveSpeed * delta * 0.1) ** 2;
    if (isTryingToMove && movedSignificantly && audioInitialized && typeof AudioSystem !== 'undefined' && typeof audioContext !== 'undefined' && audioContext?.state === 'running') {
         AudioSystem.playFootstepSound();
    }
}


// --- ATUALIZAÇÃO DA LÓGICA DO MONSTRO (MOVIMENTO + OLHAR JOGADOR) ---
function updateMonster(delta) {
    if (!monster.group || monster.state !== 'HUNTING' || !mazeData) return;

    const playerPos = controls.getObject().position;
    currentMonsterPos.copy(monster.group.position);
    currentBasePos.copy(currentMonsterPos).setY(monster.baseOffsetY);

    // --- 1. Verifica distância e Game Over ---
    const distanceToPlayerSq = currentBasePos.distanceToSquared(playerPos);
    if (distanceToPlayerSq < monster.catchDistance * monster.catchDistance) { triggerGameOver(); return; }

    // --- 2. Atualiza sons ---
    if (audioInitialized && typeof AudioSystem !== 'undefined') { AudioSystem.updateMonsterSounds(Math.sqrt(distanceToPlayerSq)); }

    // --- 3. Recalcula Caminho ---
    monster.pathRecalculationTimer += delta;
    const playerCell = getCellFromPosition(playerPos);
    const monsterCell = getCellFromPosition(currentBasePos);
    const needsRecalculation = monster.path.length === 0 || monster.currentTargetIndex >= monster.path.length || monster.pathRecalculationTimer >= monster.pathRecalculationInterval || (playerCell.x !== monster.lastKnownPlayerCell.x || playerCell.y !== monster.lastKnownPlayerCell.y);
    if (needsRecalculation) {
        monster.pathRecalculationTimer = 0;
        if (monsterCell.x === playerCell.x && monsterCell.y === playerCell.y) { monster.path = []; }
        else { const newPath = findPathBFS(monsterCell, playerCell, mazeData); monster.path = (newPath && newPath.length > 0) ? newPath : []; monster.currentTargetIndex = 0; }
        monster.lastKnownPlayerCell = playerCell;
    }

    // --- 4. Determina o Ponto Alvo para MOVIMENTO (Lógica Simplificada) ---
    let targetPosForMovementFound = false;
    let isFollowingPath = false;

    if (monster.path.length > 0 && monster.currentTargetIndex < monster.path.length) {
        // Segue o caminho calculado
        targetPosForMovement.copy(getPositionFromCell(monster.path[monster.currentTargetIndex]));
        targetPosForMovement.y = monster.baseOffsetY;
        targetPosForMovementFound = true;
        isFollowingPath = true;
    } else {
        // Se não há caminho válido, vai direto para o jogador
        targetPosForMovement.copy(playerPos).setY(monster.baseOffsetY);
        targetPosForMovementFound = true;
        isFollowingPath = false;
        // Força recalcular na próxima iteração se não estava já recalculando
        if (monster.pathRecalculationTimer < monster.pathRecalculationInterval * 0.5) {
             monster.pathRecalculationTimer = monster.pathRecalculationInterval;
        }
    }

    // --- 5. Movimento ---
    if (targetPosForMovementFound) {
        const distanceToMovementTargetSq = currentBasePos.distanceToSquared(targetPosForMovement);
        const reachNodeThresholdSq = 0.3 * 0.3; // Limiar para considerar que chegou ao nó

        if (distanceToMovementTargetSq > epsilon * epsilon) {
            monsterMoveDir.subVectors(targetPosForMovement, currentBasePos).normalize();
            const moveDistance = monster.speed * delta;
            // Remove a limitação para garantir movimento contínuo - sempre move a distância total do frame.
            const actualMoveDistance = moveDistance; // Math.min(moveDistance, Math.sqrt(distanceToMovementTargetSq));
            positionUpdateVector.copy(monsterMoveDir).multiplyScalar(actualMoveDistance);

            // Aplica o movimento
            monster.group.position.x += positionUpdateVector.x;
            monster.group.position.z += positionUpdateVector.z;
            monster.group.position.y = monster.baseOffsetY; // Garante Y base

            // Verifica se chegou ao nó do caminho (APENAS se estava seguindo o caminho)
            if (isFollowingPath) {
                // Recalcula a distância após mover
                const currentDistanceToNodeSq = monster.group.position.clone().setY(monster.baseOffsetY).distanceToSquared(targetPosForMovement);
                if (currentDistanceToNodeSq < reachNodeThresholdSq) {
                    monster.currentTargetIndex++;
                    // Se chegou ao fim do caminho atual, força recalcular
                    if (monster.currentTargetIndex >= monster.path.length) {
                        monster.pathRecalculationTimer = monster.pathRecalculationInterval; // Força recalcular logo
                    }
                }
            }
        } else if (isFollowingPath) {
             // Se já está no nó (distância muito pequena) e estava seguindo path, avança
             monster.currentTargetIndex++;
             if (monster.currentTargetIndex >= monster.path.length) {
                 monster.pathRecalculationTimer = monster.pathRecalculationInterval;
             }
        }
    }

    // --- 6. Rotação (SEMPRE olhando para o jogador - com correção de 180 graus) ---
    targetPositionForRotation.copy(playerPos);
    targetPositionForRotation.y = playerPos.y; // Considera a altura Y do player para o lookAt

    if (monster.group.position.distanceToSquared(targetPositionForRotation) > epsilon * epsilon) {
         // Calcula a rotação para o eixo -Z local apontar para o jogador
         rotationMatrix.lookAt(monster.group.position, targetPositionForRotation, monster.group.up);
         targetQuaternion.setFromRotationMatrix(rotationMatrix);

         // *** CORREÇÃO: Aplica uma rotação adicional de 180 graus no eixo Y local ***
         // Isso é necessário se a "frente" do modelo não for o eixo -Z padrão do lookAt.
         const yRotationOffset = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
         targetQuaternion.multiply(yRotationOffset);
         // **************************************************************************

         const angleToTarget = monster.group.quaternion.angleTo(targetQuaternion);
         if (angleToTarget > epsilon) {
             const slerpFactor = Math.min(1.0, (monster.rotationSpeed * delta) / angleToTarget);
             monster.group.quaternion.slerp(targetQuaternion, slerpFactor);
         } else {
             monster.group.quaternion.copy(targetQuaternion);
         }
    }
}


// --- FUNÇÃO DE PATHFINDING (BFS) ---
function findPathBFS(startCoords, endCoords, maze) {
    const queue = []; const visited = new Set(); const parent = new Map();
    const startKey = `${startCoords.x},${startCoords.y}`;
    queue.push(startCoords); visited.add(startKey); parent.set(startKey, null);
    let pathFound = false;
    while (queue.length > 0) {
        const currentCell = queue.shift();
        if (currentCell.x === endCoords.x && currentCell.y === endCoords.y) { pathFound = true; break; }
        const neighbors = getValidNeighbors(currentCell, maze);
        for (const neighbor of neighbors) {
            const neighborKey = `${neighbor.x},${neighbor.y}`;
            if (!visited.has(neighborKey)) { visited.add(neighborKey); parent.set(neighborKey, currentCell); queue.push(neighbor); }
        }
    }
    if (pathFound) { const path = []; let current = endCoords;
        while (current !== null) { path.push(current); const currentKey = `${current.x},${current.y}`; current = parent.get(currentKey); }
        return path.reverse();
    } return null;
}
function getValidNeighbors(cell, maze) {
    const neighbors = []; const { x, y } = cell; const currentCellData = maze[y]?.[x]; if (!currentCellData) return [];
    if (y > 0 && !currentCellData.top && maze[y - 1]?.[x]) { neighbors.push({ x: x, y: y - 1 }); }
    if (x < MAZE_SIZE - 1 && !currentCellData.right && maze[y]?.[x + 1]) { neighbors.push({ x: x + 1, y: y }); }
    if (y < MAZE_SIZE - 1 && !currentCellData.bottom && maze[y + 1]?.[x]) { neighbors.push({ x: x, y: y + 1 }); }
    if (x > 0 && !currentCellData.left && maze[y]?.[x - 1]) { neighbors.push({ x: x - 1, y: y }); }
    return neighbors;
}

// --- Verifica Condição de Saída (Vitória) ---
function checkExitCondition() {
    if (!gameRunning || gameOverTriggered || !exitObject) return;
    const distanceToExit = camera.position.distanceTo(exitObject.position);
    const exitActivationDistance = CELL_WIDTH * 0.6;
    if (distanceToExit < exitActivationDistance) { triggerWin(); }
}

// --- Funções de Fim de Jogo ---
function triggerWin() {
    if (gameOverTriggered) return; console.log("Jogador escapou!"); gameRunning = false; gameOverTriggered = true;
    if (controls.isLocked) controls.unlock(); blocker.style.display = 'none'; crosshair.style.display = 'none';
    messageElement.style.display = 'none'; endScreen.style.display = 'flex'; gameOverScreen.style.display = 'none';
    if (audioInitialized && typeof AudioSystem !== 'undefined') { AudioSystem.stopContinuousSounds(); /* Tocar som de vitória */ }
}
function triggerGameOver() {
    if (gameOverTriggered) return; console.error("GAME OVER - Monstro pegou o jogador!"); gameRunning = false; gameOverTriggered = true;
    if (controls.isLocked) controls.unlock(); blocker.style.display = 'none'; crosshair.style.display = 'none';
    messageElement.style.display = 'none'; gameOverScreen.style.display = 'flex'; endScreen.style.display = 'none';
    if (audioInitialized && typeof AudioSystem !== 'undefined') { AudioSystem.stopContinuousSounds(); AudioSystem.playScareSound(); }
    if(monster.group) monster.state = 'IDLE'; // Para o monstro
}

// --- Funções Auxiliares ---
function toggleFlashlight() {
    flashlightOn = !flashlightOn; flashlight.intensity = flashlightOn ? 2.6 : 0;
    showMessage(`Lanterna ${flashlightOn ? 'LIGADA' : 'DESLIGADA'}`, 1500);
}
let messageTimeout;
function showMessage(text, duration = 3000, isWarning = false) {
    messageElement.textContent = text; messageElement.style.display = 'block'; messageElement.style.color = isWarning ? '#ff8800' : '#ffcc00';
    clearTimeout(messageTimeout); messageTimeout = setTimeout(() => { messageElement.style.display = 'none'; }, duration);
}
function getCellFromPosition(position) {
    const x = Math.floor(position.x / CELL_WIDTH); const y = Math.floor(position.z / CELL_WIDTH);
    return { x: Math.max(0, Math.min(MAZE_SIZE - 1, x)), y: Math.max(0, Math.min(MAZE_SIZE - 1, y)) };
}
function getPositionFromCell(cell) {
    return { x: cell.x * CELL_WIDTH + CELL_WIDTH / 2, z: cell.y * CELL_WIDTH + CELL_WIDTH / 2 };
}

// --- Inicia o Jogo ---
init().then(() => {
    animate(); console.log("Inicialização completa, iniciando loop de animação.");
}).catch(err => {
     console.error("Falha ao iniciar o jogo após carregamento:", err);
     loadingText.textContent = `Erro Crítico: ${err.message}. Não foi possível iniciar o jogo.`;
     loadingText.style.color = 'red'; loadingText.style.display = 'block'; instructions.innerHTML = '<h1>Erro</h1>';
});
// --- FIM DO ARQUIVO main.js ---
