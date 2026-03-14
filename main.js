import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from './PhysicsWorld.js';
import { Tower } from './Tower.js';

let scene, camera, renderer, controls;
let physicsWorld, tower;
let groundBody;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let dragJoint;
let dummyBody;
let isDragging = false;
let draggedBlock = null;
let gameOver = false;

const overlay = document.getElementById('overlay');
const restartBtn = document.getElementById('restart-btn');

/**
 * Initializes the game world, including Three.js scene, Cannon-es physics,
 * lighting, camera, and the Jenga tower.
 */
function init() {
    // --- Three.js Setup ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd1e5);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(10, 10, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 5, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 30, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.camera.far = 100;
    scene.add(dirLight);

    // Ground Visual
    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // --- Physics Setup ---
    physicsWorld = new PhysicsWorld();
    groundBody = physicsWorld.createGround();

    // Tower Setup
    tower = new Tower(scene, physicsWorld);
    tower.generate(18);

    // Dragging helper body
    dummyBody = new CANNON.Body({ mass: 0 });
    dummyBody.type = CANNON.Body.KINEMATIC;
    dummyBody.collisionFilterGroup = 0;
    dummyBody.collisionFilterMask = 0;
    physicsWorld.world.addBody(dummyBody);

    // --- Event Listeners ---
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onWindowResize);
    restartBtn.addEventListener('click', restartGame);

    animate();
}

function onMouseDown(event) {
    if (gameOver) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(tower.blocks.map(b => b.mesh));

    if (intersects.length > 0) {
        controls.enabled = false;
        isDragging = true;
        const clickedMesh = intersects[0].object;
        const block = tower.blocks.find(b => b.mesh === clickedMesh);
        draggedBlock = block;

        const hitPoint = intersects[0].point;
        const localHitPoint = block.body.pointToLocalFrame(new CANNON.Vec3(hitPoint.x, hitPoint.y, hitPoint.z));

        dummyBody.position.copy(new CANNON.Vec3(hitPoint.x, hitPoint.y, hitPoint.z));

        dragJoint = new CANNON.PointToPointConstraint(
            block.body,
            localHitPoint,
            dummyBody,
            new CANNON.Vec3(0, 0, 0)
        );
        physicsWorld.world.addConstraint(dragJoint);
    }
}

function onMouseMove(event) {
    if (!isDragging || !draggedBlock) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Use a plane that faces the camera for dragging
    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);
    const planeNormal = cameraDir.negate();
    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, draggedBlock.mesh.position);

    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, intersection);

    if (intersection) {
        dummyBody.position.copy(new CANNON.Vec3(intersection.x, intersection.y, intersection.z));
    }
}

function onMouseUp() {
    isDragging = false;
    draggedBlock = null;
    controls.enabled = true;
    if (dragJoint) {
        physicsWorld.world.removeConstraint(dragJoint);
        dragJoint = null;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function checkGameOver() {
    if (gameOver) return;

    let fallen = 0;
    tower.blocks.forEach(block => {
        if (block === draggedBlock) return;

        // A block is considered "fallen" if its Y position is significantly lower than its starting point
        // and it's near the ground.
        // Or more simply, if any block that started above the first few layers hits the ground.
        // Let's use a simpler heuristic: if a block's center Y is < 0.5 and it wasn't in the bottom layer.
        // Even better: just track how many blocks have Y < 0.5 (nearly touching the ground)
        // that are not part of the initial bottom layer.

        // Let's use the user's specific requirement: "more than 2 blocks hit the ground plane"
        // Since bottom layer blocks ARE on the ground plane, we should only count blocks
        // that fell FROM above.

        if (block.body.position.y < 0.5 && block.initialY > 0.7) {
            fallen++;
        }
    });

    if (fallen > 2) {
        gameOver = true;
        overlay.style.display = 'flex';
    }
}

function restartGame() {
    tower.reset();
    tower.generate(18);
    gameOver = false;
    overlay.style.display = 'none';
}

/**
 * The main animation loop.
 * Handles physics stepping, visual synchronization, and rendering.
 */
function animate() {
    requestAnimationFrame(animate);

    if (!gameOver) {
        // Step the physics world (approx. 60 FPS)
        physicsWorld.step(1 / 60);

        // IMPORTANT: Synchronize Three.js meshes with Cannon.js bodies
        // This is where the physics simulation results are applied to the visuals.
        tower.update();

        checkGameOver();
    }

    controls.update();
    renderer.render(scene, camera);
}

init();
