// --- Global Variables ---
let scene, camera, renderer, lowPolyMesh, stars, raycaster, mouse;
let clock = new THREE.Clock(); // For time-based animation
let isFlying = false; // Flag for camera animation state
let flyStartTime = 0; // Timestamp when fly animation starts
const flyDuration = 5.0; // **** INCREASED DURATION for more complex path ****
let hasTransitioned = false; // Flag to check if view has switched to tiles
let tilesAnimated = false; // Flag to ensure tiles animate in only once

// --- Camera Animation Keyframes ---
const cameraStartPos = new THREE.Vector3(0, 5, 25);
const cameraStartLook = new THREE.Vector3(0, 0, 0);
const keyframe1Pos = new THREE.Vector3(0, 2, -120);
const keyframe1Look = new THREE.Vector3(0, -5, -150);
const keyframe2Pos = new THREE.Vector3(0, -25, -100);
const keyframe2Look = new THREE.Vector3(0, -10, -100);

// --- Mouse Trail for Highlighting ---
const mouseTrail = [];
const TRAIL_LENGTH = 18; // Number of trail points to keep
const TRAIL_FADE = 1.2; // How quickly the trail fades (higher = faster fade)

// --- Initialization ---
function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(
        80,
        window.innerWidth / window.innerHeight,
        0.1,
        2000
    );
    camera.position.copy(cameraStartPos);
    camera.lookAt(cameraStartLook);

    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('bg-canvas'),
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // --- Starfield ---
    const starVertices = [];
    const numStars = 30000, starSpread = 1000;
    for (let i = 0; i < numStars; i++) {
        const x = THREE.MathUtils.randFloatSpread(starSpread * 2);
        const y = THREE.MathUtils.randFloat(10, starSpread);
        const z = THREE.MathUtils.randFloatSpread(starSpread * 2);
        if (Math.sqrt(x * x + y * y + z * z) > 100) {
            starVertices.push(x, y, z);
        }
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 3.5,
        sizeAttenuation: true,
        transparent: true,
        opacity: 2.8,
        map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/spark1.png'),
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // --- Low Poly Plane Geometry ---
    const planeWidth = 150, planeHeight = 150, widthSegments = 200, heightSegments = 200;
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, widthSegments, heightSegments);
    const vertices = geometry.attributes.position;
    const colors = [], originalZ = [], baseColors = [];
    const blueColors = [
        new THREE.Color(0x0a1a2f),
        new THREE.Color(0x102a4c),
        new THREE.Color(0x1a3a6a),
        new THREE.Color(0x26508e),
        new THREE.Color(0x3a6aa0)
    ];
    for (let i = 0; i < vertices.count; i++) {
        const z = Math.random() * 2.5 - 1.25;
        vertices.setZ(i, z);
        originalZ.push(z);
        const zValue = vertices.getZ(i);
        let colorIndex = 0;
        if (zValue > 0.8) colorIndex = 4;
        else if (zValue > 0.3) colorIndex = 3;
        else if (zValue > -0.3) colorIndex = 2;
        else if (zValue > -0.8) colorIndex = 1;
        const color = blueColors[colorIndex];
        colors.push(color.r, color.g, color.b);
        baseColors.push(color.r, color.g, color.b);
    }
    vertices.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('baseColor', new THREE.Float32BufferAttribute([...colors], 3));
    geometry.userData.originalZ = originalZ;
    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        flatShading: true
    });
    lowPolyMesh = new THREE.Mesh(geometry, material);
    lowPolyMesh.rotation.x = -Math.PI / 2.2;
    lowPolyMesh.position.y = -10;
    scene.add(lowPolyMesh);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x404040, 1.0);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1000, 100, 100);
    scene.add(directionalLight);

    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('resize', onWindowResize, false);

    animate();
}

/**
 * Handles mouse movement to update mouse coordinates and trigger terrain highlighting.
 */
function onMouseMove(event) {
    if (hasTransitioned) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Project mouse to world position on the terrain plane
    if (lowPolyMesh && raycaster) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(lowPolyMesh);
        if (intersects.length > 0) {
            const intersectionPoint = intersects[0].point.clone();
            // Add to trail (with age 0)
            mouseTrail.push({ point: intersectionPoint, age: 0 });
            // Limit trail length
            if (mouseTrail.length > TRAIL_LENGTH) mouseTrail.shift();
        }
    }
}

/**
 * Easing function for smooth animation (cubic in/out).
 */
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Animates the project tiles into view with a staggered effect.
 */
function animateTilesIn() {
    const tiles = document.querySelectorAll('.futuristic-card-link');
    tiles.forEach((tile, i) => {
        if (tile) {
            tile.classList.remove('visible');
            tile.style.transitionDelay = '0s';
            setTimeout(() => {
                tile.style.transitionDelay = (i * 0.09) + 's';
                tile.classList.add('visible');
            }, 100);
        }
    });
}

let currentLookAt = new THREE.Vector3();

/**
 * The main animation loop, called recursively via requestAnimationFrame.
 */
function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();
    const delta = clock.getDelta();

    // --- Camera Fly Animation (Multi-Stage) ---
    if (isFlying) {
        let t_overall = (performance.now() - flyStartTime) / 1000 / flyDuration;
        t_overall = Math.min(t_overall, 1);

        // Make turn-around much faster
        const stage1Duration = 0.8; // 80% fly forward
        const stage2Duration = 0.2; // 20% turn around

        if (t_overall <= stage1Duration) {
            let t_stage1 = t_overall / stage1Duration;
            t_stage1 = easeInOutCubic(t_stage1);
            camera.position.lerpVectors(cameraStartPos, keyframe1Pos, t_stage1);
            currentLookAt.lerpVectors(cameraStartLook, keyframe1Look, t_stage1);
        } else {
            let t_stage2 = (t_overall - stage1Duration) / stage2Duration;
            t_stage2 = easeInOutCubic(t_stage2);
            camera.position.lerpVectors(keyframe1Pos, keyframe2Pos, t_stage2);
            currentLookAt.lerpVectors(keyframe1Look, keyframe2Look, t_stage2);
        }
        camera.lookAt(currentLookAt);

        if (t_overall >= 1 && !hasTransitioned) {
            hasTransitioned = true;
            setTimeout(() => {
                document.getElementById('tiles-section').classList.add('active');
                if (!tilesAnimated) {
                    animateTilesIn();
                    tilesAnimated = true;
                }
            }, 100);
        }
    }

    // --- Terrain Wave Animation ---
    if (lowPolyMesh) {
        const vertices = lowPolyMesh.geometry.attributes.position;
        const originalZ = lowPolyMesh.geometry.userData.originalZ;
        for (let i = 0; i < vertices.count; i++) {
            const x = vertices.getX(i), y = vertices.getY(i), baseZ = originalZ[i];
            const wave = Math.sin((x + elapsedTime * 1.5) * 0.15) * 0.5 +
                Math.cos((y + elapsedTime * 1.5) * 0.15) * 0.5 +
                Math.sin((x + y + elapsedTime * 0.8) * 0.1) * 0.3;
            vertices.setZ(i, baseZ + wave);
        }
        vertices.needsUpdate = true;
    }

    // --- Mouse Trail Highlighting ---
    if (lowPolyMesh && raycaster) {
        const colors = lowPolyMesh.geometry.attributes.color;
        const baseColors = lowPolyMesh.geometry.attributes.baseColor;
        const positionAttribute = lowPolyMesh.geometry.attributes.position;
        colors.array.set(baseColors.array); // Reset all colors

        // Age the trail points and remove old ones
        for (let i = 0; i < mouseTrail.length; i++) {
            mouseTrail[i].age += delta;
        }
        while (mouseTrail.length > 0 && mouseTrail[0].age > TRAIL_LENGTH / TRAIL_FADE) {
            mouseTrail.shift();
        }

        // Highlight vertices near any trail point
        const tempColor = new THREE.Color();
        for (let i = 0; i < positionAttribute.count; i++) {
            const vertexPosition = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
            let maxIntensity = 0;
            for (let j = 0; j < mouseTrail.length; j++) {
                const trail = mouseTrail[j];
                const distance = vertexPosition.distanceTo(lowPolyMesh.worldToLocal(trail.point.clone()));
                const highlightRadius = 2;
                if (distance < highlightRadius) {
                    // Fade intensity with distance and trail age
                    const falloff = Math.pow(1.0 - (distance / highlightRadius), 4);
                    const ageFade = Math.max(0, 1 - trail.age / (TRAIL_LENGTH / TRAIL_FADE));
                    maxIntensity = Math.max(maxIntensity, falloff * ageFade);
                }
            }
            if (maxIntensity > 0) {
                tempColor.fromBufferAttribute(baseColors, i);
                tempColor.lerp(new THREE.Color(0xffffff), 1.4 * maxIntensity);
                colors.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
            }
        }
        colors.needsUpdate = true;
    }

    // --- Starfield Animation ---
    if (stars) {
        stars.rotation.y += 0.0001;
        stars.material.opacity = 0.9 + Math.sin(elapsedTime * 0.5) * 0.2;
    }

    renderer.render(scene, camera);
}

/**
 * Handles window resize events to update camera and renderer.
 */
function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// --- Wait for DOM to be ready before initializing ---
document.addEventListener('DOMContentLoaded', () => {
    const flyBtn = document.getElementById('fly-btn');
    const welcomeTitle = document.getElementById('welcome-title');

    if (flyBtn && welcomeTitle) {
        flyBtn.addEventListener('click', () => {
            if (!isFlying) {
                isFlying = true;
                flyStartTime = performance.now();
                flyBtn.style.transition = 'opacity 0.5s ease-out';
                welcomeTitle.style.transition = 'opacity 0.5s ease-out';
                flyBtn.style.opacity = 0;
                welcomeTitle.style.opacity = 0;
                setTimeout(() => {
                    if (flyBtn) flyBtn.style.display = 'none';
                }, 500);
            }
        });
    } else {
        console.error("Button or Title element not found!");
    }

    initThreeJS();
});
