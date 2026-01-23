// --- Global Variables ---
let scene, camera, renderer, lowPolyMesh, stars, raycaster, mouse;
let clock = new THREE.Clock();

// --- Realistic Star System Data ---
let starTwinkleData = []; // Stores per-star animation data (phase, speed, baseOpacity)
let starColors = null; // BufferAttribute for star colors
let starSizes = null; // BufferAttribute for star sizes
let starBaseSizes = []; // Original sizes for reference during animation
let starBaseColors = []; // Original colors for reference during animation

// --- Constellation Portal System ---
const portalInstances = [];
const isMobileDevice = window.innerWidth < 768 || 'ontouchstart' in window;

// --- Security: Input Sanitization Function ---
function sanitizeText(text) {
    if (typeof text !== 'string') return '';
    // Remove potentially harmful characters and HTML tags
    return text.replace(/[<>"'&]/g, function(match) {
        const escapeChars = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '&': '&amp;'
        };
        return escapeChars[match];
    }).substring(0, 500); // Limit length to prevent DoS
}
let isFlying = false; // Flag for camera animation state (index page only)
let flyStartTime = 0;
const flyDuration = 3.0;
let hasTransitioned = false; // Flag: view switched to tiles (index page) OR fun projects page loaded
let tilesAnimated = false; // Flag: ensure tiles animate in only once per page load
let highlightedVertexIndices = []; // Array to store currently highlighted vertices
const HIGHLIGHT_RADIUS = 1.5; // Radius for vertex highlighting

let isFlyingToFunProjects = false;
let flyToFunProjectsStartTime = 0;
const flyToFunProjectsDuration = 1.5; // seconds

// Add these camera positions for More Projects transition
const moreProjFlyPos = new THREE.Vector3(0, -5, -150); // Steeper dive forward
const moreProjFlyLook = new THREE.Vector3(0, -20, -200); // Look down more
const flyToMoreProjDuration = 2.0; // Faster transition

// Add these camera positions for back transition
const backTransitionDuration = 0.2;
let isTransitioningBack = false;
let backTransitionStartTime = 0;

// --- Camera Positions ---
const cameraStartPos = new THREE.Vector3(0, 5, 25); // For index page initial view
const cameraStartLook = new THREE.Vector3(0, 0, 0); // For index page initial view
const cameraFlyKeyframe1Pos = new THREE.Vector3(0, 2, -120);
const cameraFlyKeyframe1Look = new THREE.Vector3(0, -5, -150);
const cameraFlyKeyframe2Pos = new THREE.Vector3(0, -25, -100); // End position for fly-in
const cameraFlyKeyframe2Look = new THREE.Vector3(0, -10, -100); // End lookAt for fly-in

const cameraFunProjectsPos = new THREE.Vector3(0, -15, -80); // Static position for fun projects page
const cameraFunProjectsLook = new THREE.Vector3(0, -10, -100); // Static lookAt for fun projects page

// --- Mouse Trail for Highlighting (Only active on index page before transition) ---
const mouseTrail = [];
const TRAIL_LENGTH = 18;
const TRAIL_FADE = 1.2;

// --- Page Detection ---
// Detect if we are on the fun projects page
const isFunProjectsPage = /\/fun-projects(?:\/index\.html|\.html|\/)?$/.test(window.location.pathname);

// --- Initialization ---
function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(
        80, // Field of View
        window.innerWidth / window.innerHeight, // Aspect Ratio
        0.1, // Near clipping plane
        2000 // Far clipping plane
    );

    // Set initial camera based on page
    if (isFunProjectsPage) {
        camera.position.copy(cameraFunProjectsPos);
        camera.lookAt(cameraFunProjectsLook);
        hasTransitioned = true; // Mark as 'transitioned' so mouse trail is inactive
    } else {
        camera.position.copy(cameraStartPos);
        camera.lookAt(cameraStartLook);
        // Initialize Raycaster and mouse only for index page interaction
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        window.addEventListener('mousemove', onMouseMove, false); // Only add listener on index
    }


    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('bg-canvas'),
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Ensure the canvas stays behind content but visible during transitions
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '-1';


    // --- Realistic Starfield with Color & Size Variation ---
    const starVertices = [];
    const starColorValues = [];
    const starSizeValues = [];
    starTwinkleData = [];
    starBaseSizes = [];
    starBaseColors = [];

    const numStars = 25000;
    const starSpread = 1000;

    // Star color temperature palette (from hot blue to cool red-orange)
    const starColorPalette = [
        { r: 0.6, g: 0.7, b: 1.0 },   // Blue-white (hot O/B stars)
        { r: 0.75, g: 0.85, b: 1.0 }, // Light blue-white
        { r: 0.9, g: 0.95, b: 1.0 },  // White-blue tint
        { r: 1.0, g: 1.0, b: 1.0 },   // Pure white (A stars)
        { r: 1.0, g: 0.98, b: 0.95 }, // Warm white
        { r: 1.0, g: 0.95, b: 0.85 }, // Yellow-white (F/G stars like Sun)
        { r: 1.0, g: 0.9, b: 0.75 },  // Light yellow
        { r: 1.0, g: 0.85, b: 0.7 },  // Yellow-orange (K stars)
        { r: 1.0, g: 0.75, b: 0.6 },  // Orange
    ];

    for (let i = 0; i < numStars; i++) {
        const x = THREE.MathUtils.randFloatSpread(starSpread * 2);
        const y = THREE.MathUtils.randFloat(-starSpread * 0.5, starSpread * 1.5);
        const z = THREE.MathUtils.randFloatSpread(starSpread * 2);

        // Ensure stars are not too close initially
        if (Math.sqrt(x * x + y * y + z * z) > 50) {
            starVertices.push(x, y, z);

            // Color variation - weighted towards white/blue-white (most common visible)
            const colorRand = Math.pow(Math.random(), 0.7); // Bias towards lower indices (bluer)
            const colorIndex = Math.floor(colorRand * starColorPalette.length);
            const starColor = starColorPalette[Math.min(colorIndex, starColorPalette.length - 1)];

            // Add slight random variation to each star's color
            const colorVariation = 0.05;
            const finalR = Math.min(1, starColor.r + (Math.random() - 0.5) * colorVariation);
            const finalG = Math.min(1, starColor.g + (Math.random() - 0.5) * colorVariation);
            const finalB = Math.min(1, starColor.b + (Math.random() - 0.5) * colorVariation);
            starColorValues.push(finalR, finalG, finalB);
            starBaseColors.push(finalR, finalG, finalB); // Store original colors for twinkling

            // Size variation using power distribution (many dim, few bright)
            // Magnitude-like distribution: most stars small, few large bright ones
            const sizeRand = Math.random();
            let starSize;
            if (sizeRand > 0.998) {
                // Very rare bright stars (0.2%)
                starSize = THREE.MathUtils.randFloat(8, 12);
            } else if (sizeRand > 0.99) {
                // Rare bright stars (0.8%)
                starSize = THREE.MathUtils.randFloat(5, 8);
            } else if (sizeRand > 0.95) {
                // Uncommon medium-bright stars (4%)
                starSize = THREE.MathUtils.randFloat(3, 5);
            } else if (sizeRand > 0.7) {
                // Common medium stars (25%)
                starSize = THREE.MathUtils.randFloat(1.5, 3);
            } else {
                // Most common dim stars (70%)
                starSize = THREE.MathUtils.randFloat(0.5, 1.5);
            }
            starSizeValues.push(starSize);
            starBaseSizes.push(starSize);

            // Twinkling data: phase offset, speed, and base brightness
            starTwinkleData.push({
                phase: Math.random() * Math.PI * 2,
                speed: 0.5 + Math.random() * 2.5, // Varied twinkle speeds
                baseAlpha: 0.6 + Math.random() * 0.4, // Base brightness variation
                twinkleAmount: 0.1 + Math.random() * 0.3 // How much it twinkles
            });
        }
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColorValues, 3));
    starGeometry.setAttribute('size', new THREE.Float32BufferAttribute(starSizeValues, 1));

    // Store references for animation
    starColors = starGeometry.attributes.color;
    starSizes = starGeometry.attributes.size;

    // Create a softer, more realistic star texture programmatically
    const starCanvas = document.createElement('canvas');
    starCanvas.width = 64;
    starCanvas.height = 64;
    const starCtx = starCanvas.getContext('2d');

    // Create radial gradient for soft glow effect
    const gradient = starCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(0.75, 'rgba(255, 255, 255, 0.05)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    starCtx.fillStyle = gradient;
    starCtx.fillRect(0, 0, 64, 64);

    const starTexture = new THREE.CanvasTexture(starCanvas);
    starTexture.needsUpdate = true;

    const starMaterial = new THREE.PointsMaterial({
        size: 3,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        map: starTexture,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: true // Enable per-vertex colors
    });

    stars = new THREE.Points(starGeometry, starMaterial);

    // Slightly adjust star position/rotation for fun projects page
    if (isFunProjectsPage) {
        stars.rotation.x = 0.1;
        stars.position.y = -30;
    }
    scene.add(stars);

    // --- Add a second layer of distant dim background stars for depth ---
    const bgStarVertices = [];
    const bgStarColors = [];
    const numBgStars = 8000;
    const bgSpread = 1800;

    for (let i = 0; i < numBgStars; i++) {
        const x = THREE.MathUtils.randFloatSpread(bgSpread * 2);
        const y = THREE.MathUtils.randFloat(-bgSpread * 0.3, bgSpread * 1.2);
        const z = THREE.MathUtils.randFloatSpread(bgSpread * 2);

        const dist = Math.sqrt(x * x + y * y + z * z);
        if (dist > 400) { // Only far away stars
            bgStarVertices.push(x, y, z);

            // Dimmer, mostly white/blue tint for distant stars
            const dimFactor = 0.3 + Math.random() * 0.3;
            bgStarColors.push(
                dimFactor * (0.8 + Math.random() * 0.2),
                dimFactor * (0.85 + Math.random() * 0.15),
                dimFactor * (0.9 + Math.random() * 0.1)
            );
        }
    }

    const bgStarGeometry = new THREE.BufferGeometry();
    bgStarGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bgStarVertices, 3));
    bgStarGeometry.setAttribute('color', new THREE.Float32BufferAttribute(bgStarColors, 3));

    const bgStarMaterial = new THREE.PointsMaterial({
        size: 1.2,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.6,
        map: starTexture,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: true
    });

    const bgStars = new THREE.Points(bgStarGeometry, bgStarMaterial);
    if (isFunProjectsPage) {
        bgStars.rotation.x = 0.1;
        bgStars.position.y = -30;
    }
    scene.add(bgStars);

    // --- Low Poly Plane Geometry (Only add if NOT on fun projects page) ---
    if (!isFunProjectsPage) {
        const planeWidth = 150, planeHeight = 150, widthSegments = 250, heightSegments = 200;
        const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, widthSegments, heightSegments);
        const vertices = geometry.attributes.position;
        const colors = [], originalZ = [], baseColors = [];
        const blueColors = [
            new THREE.Color(0x0a1a2f), new THREE.Color(0x102a4c), new THREE.Color(0x1a3a6a),
            new THREE.Color(0x26508e), new THREE.Color(0x3a6aa0)
        ];
        for (let i = 0; i < vertices.count; i++) {
            const z = Math.random() * 2.5 - 1.25;
            vertices.setZ(i, z);
            originalZ.push(z);
            const zValue = vertices.getZ(i);
            let colorIndex = Math.floor(THREE.MathUtils.mapLinear(zValue, -1.25, 1.25, 0, 4.99));
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
            vertexColors: true, side: THREE.DoubleSide, flatShading: true
        });
        lowPolyMesh = new THREE.Mesh(geometry, material);
        lowPolyMesh.rotation.x = -Math.PI / 2.2;
        lowPolyMesh.position.y = -10;
        scene.add(lowPolyMesh);
    }

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x505070, 0.8); // Slightly more ambient
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(10, 50, 20); // Adjusted light direction
    scene.add(directionalLight);
    // Add a subtle point light for interest
    const pointLight = new THREE.PointLight(0x667eea, 0.5, 300); // Use theme color
    pointLight.position.set(0, -50, -150);
    scene.add(pointLight);


    window.addEventListener('resize', onWindowResize, false);

    // Start animation loop
    animate();

    // --- Post-Initialization UI Logic ---
    // If on fun projects page, directly animate tiles/portals in
    if (isFunProjectsPage) {
        const funTilesSection = document.getElementById('fun-projects-tiles-section');
        if (funTilesSection && !tilesAnimated) {
            funTilesSection.classList.add('active'); // Ensure section is displayed
            // Use timeout to allow initial render before animation starts
             setTimeout(() => {
                // Check if using new portal system
                const funPortalsGrid = document.getElementById('fun-portals-grid');
                if (funPortalsGrid && !isMobileDevice) {
                    initConstellationPortals();
                } else {
                    // Mobile fallback: animate portal containers as simple cards
                    animateMobilePortals('#fun-projects-tiles-section .portal-container');
                }
                tilesAnimated = true;
             }, 100); // Small delay
        }
    }
}

/**
 * Handles mouse movement for terrain highlighting (Index Page Only).
 */
function onMouseMove(event) {
    // Only run if raycaster exists and we haven't transitioned past the terrain view
    if (!raycaster || !mouse || hasTransitioned || !lowPolyMesh) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(lowPolyMesh);
    // Remove trail: always clear and only highlight current hover
    highlightedVertexIndices = [];
    if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point.clone();
        // Find all vertices within highlight radius
        const positionAttribute = lowPolyMesh.geometry.attributes.position;
        for (let i = 0; i < positionAttribute.count; i++) {
            const vertexPosition = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
            if (vertexPosition.distanceTo(lowPolyMesh.worldToLocal(intersectionPoint.clone())) < HIGHLIGHT_RADIUS) {
                highlightedVertexIndices.push(i);
            }
        }
    }
}

/** Easing function */
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Animates project tiles into view with a staggered effect.
 * Takes a CSS selector to target specific tiles.
 */
function animateTilesIn(selector) {
    const tiles = document.querySelectorAll(selector);
    tiles.forEach((tile, i) => {
        if (tile) {
            // Instead, just add the visible class with a staggered delay (no forced style reset):
            setTimeout(() => {
                tile.classList.add('visible');
            }, i * 90); // 90ms stagger, no forced style reset
        }
    });
}

/**
 * Mobile fallback: Animates portal containers as simple clickable cards.
 * On mobile, the Three.js canvas is hidden via CSS, showing portal-content directly.
 */
function animateMobilePortals(selector) {
    const portals = document.querySelectorAll(selector);
    portals.forEach((portal, i) => {
        if (portal) {
            // Add visible class with stagger
            setTimeout(() => {
                portal.classList.add('visible');
            }, i * 100);

            // Ensure click navigation works on mobile
            portal.addEventListener('click', (e) => {
                const url = portal.dataset.url;
                const target = portal.dataset.target || '_blank';
                if (url) {
                    if (target === '_blank') {
                        window.open(url, '_blank', 'noopener,noreferrer');
                    } else {
                        window.location.href = url;
                    }
                }
            });
        }
    });
}

let currentLookAt = new THREE.Vector3();

/**
 * Main animation loop.
 */
function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();
    const delta = clock.getDelta();

    // --- Camera Fly Animation (Index Page Only) ---
    if (isFlying && !isFunProjectsPage) {
        let t_overall = (performance.now() - flyStartTime) / 1000 / flyDuration;
        t_overall = Math.min(t_overall, 1);

        // Animation path stages
        const stage1Duration = 0.8; // Fly forward
        const stage2Duration = 0.2; // Turn around

        if (t_overall <= stage1Duration) {
            let t_stage1 = easeInOutCubic(t_overall / stage1Duration);
            camera.position.lerpVectors(cameraStartPos, cameraFlyKeyframe1Pos, t_stage1);
            currentLookAt.lerpVectors(cameraStartLook, cameraFlyKeyframe1Look, t_stage1);
        } else {
            let t_stage2 = easeInOutCubic((t_overall - stage1Duration) / stage2Duration);
            camera.position.lerpVectors(cameraFlyKeyframe1Pos, cameraFlyKeyframe2Pos, t_stage2);
            currentLookAt.lerpVectors(cameraFlyKeyframe1Look, cameraFlyKeyframe2Look, t_stage2);
        }
        camera.lookAt(currentLookAt);

        // --- Transition to Tiles View ---
        if (t_overall >= 1 && !hasTransitioned) {
            hasTransitioned = true; // Mark transition complete
            // Show the main tiles section
            const tilesSection = document.getElementById('tiles-section');
            const githubProfile = document.getElementById('github-profile'); // GitHub profile section
            if (tilesSection) {
                tilesSection.classList.add('active');
                // Animate tiles/portals in if not already done
                if (!tilesAnimated) {
                    // Check if using new portal system
                    const portalsGrid = document.getElementById('portals-grid');
                    if (portalsGrid && !isMobileDevice) {
                        // Initialize constellation portals if not already done
                        if (portalInstances.length === 0) {
                            initConstellationPortals();
                        } else {
                            animatePortalsIn();
                        }
                    } else {
                        // Mobile fallback: animate portal containers as simple cards
                        animateMobilePortals('#tiles-section .portal-container');
                    }
                    tilesAnimated = true;
                }
                // Show contact button after tiles animate in (ensure it's not hidden)
                const contactBtn = document.getElementById('contact-btn');
                if (contactBtn) {
                    setTimeout(() => contactBtn.classList.remove('hidden'), 700); // Delay showing button
                }
            }
            // Show GitHub profile section
            if (githubProfile) {
                githubProfile.classList.remove('hidden'); // Remove the hidden class
                githubProfile.classList.add('visible'); // Ensure the visible class is added
            }
        }
    } else if (isFlyingToFunProjects && !isFunProjectsPage) {
        // Get the elapsed time for the transition animation
        let t = (performance.now() - flyToFunProjectsStartTime) / 1000 / flyToMoreProjDuration;
        t = Math.min(t, 1);
        
        // Use easing for smoother animation
        let tEased = easeInOutCubic(t);

        // Enhanced star field effects during transition
        if (stars) {
            // Make stars move faster during transition
            stars.rotation.y += 0.003;
            // Intensify star brightness during transition
            stars.material.opacity = 0.9 + Math.sin(elapsedTime * 0.8) * 0.5;
            // Add a slight "falling" effect to stars
            stars.position.y -= 0.15;
        }

        // Smooth forward dive animation for camera
        camera.position.lerp(moreProjFlyPos, 0.05);
        currentLookAt.lerp(moreProjFlyLook, 0.05);
        camera.lookAt(currentLookAt);
        
        // Hide page content gradually but keep starfield visible
        const contentElements = document.querySelectorAll('.portal-container, .futuristic-card-link, #contact-btn, #github-profile, .section-title');
        if (t > 0.4) {
            contentElements.forEach(el => {
                if (el) el.style.opacity = Math.max(0, 1 - ((t - 0.4) / 0.4));
            });
        }

        // Only fade screen to black at the very end, AFTER animation completes
        if (t > 0.9) {
            // Create or get overlay element for smooth fade
            let overlay = document.getElementById('page-transition-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'page-transition-overlay';
                overlay.style.position = 'fixed';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.backgroundColor = '#000';
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.2s ease-in';
                overlay.style.zIndex = '1000';
                document.body.appendChild(overlay);
            }
            
            // Fade to black at the very end
            overlay.style.opacity = (t - 0.9) / 0.1;
            
            // Navigate at the very end
            if (t >= 1) {
                window.location.href = "fun-projects/";
            }
        }
    } else if (isFunProjectsPage && isTransitioningBack) {
        let t = (performance.now() - backTransitionStartTime) / 1000 / backTransitionDuration;
        t = Math.min(t, 1);

        // Reverse the camera movement
        camera.position.lerp(new THREE.Vector3(0, -25, -100), 0.05);
        currentLookAt.lerp(new THREE.Vector3(0, -10, -100), 0.05);
        camera.lookAt(currentLookAt);

        // Fade out near the end
        if (t > 0.4) {
            document.body.style.opacity = 1 - ((t - 0.4) / 0.6);
        }

        if (t >= 1) {
            window.location.href = "../#tiles";
        }
    } else if (isFunProjectsPage) {
        camera.lookAt(cameraFunProjectsLook); // Keep looking at the target
        
        // Add subtle movement on fun projects page for more interest
        camera.position.y += Math.sin(elapsedTime * 0.5) * 0.02;
        camera.position.x += Math.sin(elapsedTime * 0.3) * 0.01;
    }

    // --- Terrain Wave & Highlighting (Index Page Only, Before Transition) ---
    if (lowPolyMesh && !hasTransitioned) {
        // Wave animation
        const vertices = lowPolyMesh.geometry.attributes.position;
        const originalZ = lowPolyMesh.geometry.userData.originalZ;
        for (let i = 0; i < vertices.count; i++) {
            const x = vertices.getX(i), y = vertices.getY(i), baseZ = originalZ[i];
            const wave = Math.sin((x + elapsedTime * 1.2) * 0.12) * 0.6 +
                         Math.cos((y + elapsedTime * 1.0) * 0.10) * 0.6 +
                         Math.sin((x * 0.5 + y * 0.5 + elapsedTime * 0.7) * 0.08) * 0.4;
            vertices.setZ(i, baseZ + wave);
        }
        vertices.needsUpdate = true;

        // Mouse hover highlighting (no trail)
        const colors = lowPolyMesh.geometry.attributes.color;
        const baseColors = lowPolyMesh.geometry.attributes.baseColor;
        colors.array.set(baseColors.array); // Reset colors

        // Only highlight current hover (no trail)
        if (highlightedVertexIndices.length > 0) {
            for (let i = 0; i < highlightedVertexIndices.length; i++) {
                const idx = highlightedVertexIndices[i];
                // Shine white
                colors.setXYZ(idx, 1, 1, 1);
            }
        }
        colors.needsUpdate = true;
    }

    // --- Realistic Starfield Animation with Twinkling (Runs on both pages) ---
    if (stars && !isFlyingToFunProjects) {
        // Slow rotation for subtle movement
        stars.rotation.y += 0.0003;

        // Individual star twinkling animation
        if (starColors && starSizes && starTwinkleData.length > 0 && starBaseColors.length > 0) {
            const colorArray = starColors.array;
            const sizeArray = starSizes.array;

            // Update all stars but with efficient calculation
            const numStars = starTwinkleData.length;

            for (let i = 0; i < numStars; i++) {
                const twinkle = starTwinkleData[i];

                // Calculate twinkle factor using sine wave with per-star phase and speed
                const twinkleFactor = Math.sin(elapsedTime * twinkle.speed + twinkle.phase);

                // Modulate brightness (color intensity) for twinkling effect
                const brightness = twinkle.baseAlpha + twinkleFactor * twinkle.twinkleAmount;

                // Apply brightness to base colors
                const colorIndex = i * 3;
                colorArray[colorIndex] = starBaseColors[colorIndex] * brightness;
                colorArray[colorIndex + 1] = starBaseColors[colorIndex + 1] * brightness;
                colorArray[colorIndex + 2] = starBaseColors[colorIndex + 2] * brightness;

                // Subtle size pulsing for brighter stars only
                if (starBaseSizes[i] > 3) {
                    sizeArray[i] = starBaseSizes[i] * (0.92 + twinkleFactor * 0.12);
                }
            }

            starColors.needsUpdate = true;
            starSizes.needsUpdate = true;
        }
    }

    renderer.render(scene, camera);
}

/** Handles window resize */
function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// --- DOM Ready ---
document.addEventListener('DOMContentLoaded', () => {
    // Add styles for the transition overlay
    const style = document.createElement('style');
    style.textContent = `
        #page-transition-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: #000;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
            z-index: 1000;
        }
        
        /* Make sure the GitHub profile is visible and clickable */
        #github-profile {
            position: relative;
            z-index: 100;
        }
        .github-logo {
            cursor: pointer;
        }

        /* Drag & drop helpers */
        .tile-dragging {
            opacity: 0.5;
            transform: scale(0.98);
        }
        .tile-drop-target {
            outline: 2px dashed rgba(56,189,248,0.8);
            outline-offset: 6px;
        }
    `;
    document.head.appendChild(style);

    // Initialize Three.js (which now handles page-specific setup)
    initThreeJS();

    // --- Contact modal logic (runs on any page where elements exist) ---
    const sanitizeText = (text) => {
        if (typeof text !== 'string') return '';
        return text.replace(/[<>"'&]/g, (match) => {
            const escapeChars = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' };
            return escapeChars[match];
        }).substring(0, 500);
    };

    const contactBtn = document.getElementById('contact-btn');
    const contactModal = document.getElementById('contact-modal');
    const closeModal = document.getElementById('close-modal');
    const contactForm = document.getElementById('contact-form');
    const contactSuccess = document.getElementById('contact-success');

    if (contactBtn) contactBtn.classList.remove('hidden');

    // --- Transmission Portal Particle System ---
    let portalParticlesInterval = null;

    function createPortalParticles() {
        const particlesContainer = document.getElementById('portal-particles');
        if (!particlesContainer) return;

        // Clear existing particles
        particlesContainer.innerHTML = '';

        // Create floating particles
        const createParticle = () => {
            const particle = document.createElement('div');
            particle.className = 'floating-particle';

            // Random position
            const startX = Math.random() * 100;
            const startY = Math.random() * 100;

            // Random size
            const size = Math.random() * 4 + 2;

            // Random color
            const colors = ['#38bdf8', '#5eead4', '#667eea', '#ffffff'];
            const color = colors[Math.floor(Math.random() * colors.length)];

            // Random animation duration
            const duration = Math.random() * 4 + 3;
            const delay = Math.random() * 2;

            particle.style.cssText = `
                position: absolute;
                left: ${startX}%;
                top: ${startY}%;
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                border-radius: 50%;
                box-shadow: 0 0 ${size * 2}px ${color};
                opacity: 0;
                pointer-events: none;
                animation: floatParticle ${duration}s ease-in-out ${delay}s infinite;
            `;

            particlesContainer.appendChild(particle);

            // Remove particle after a while to prevent memory buildup
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.remove();
                }
            }, (duration + delay) * 3000);
        };

        // Create initial batch of particles
        for (let i = 0; i < 15; i++) {
            createParticle();
        }

        // Keep creating particles while modal is open
        portalParticlesInterval = setInterval(() => {
            if (contactModal && contactModal.classList.contains('show')) {
                createParticle();
            }
        }, 800);
    }

    function clearPortalParticles() {
        if (portalParticlesInterval) {
            clearInterval(portalParticlesInterval);
            portalParticlesInterval = null;
        }
        const particlesContainer = document.getElementById('portal-particles');
        if (particlesContainer) {
            particlesContainer.innerHTML = '';
        }
    }

    // Add particle animation keyframes dynamically
    if (!document.getElementById('portal-particle-styles')) {
        const particleStyles = document.createElement('style');
        particleStyles.id = 'portal-particle-styles';
        particleStyles.textContent = `
            @keyframes floatParticle {
                0% {
                    opacity: 0;
                    transform: translateY(0) translateX(0) scale(0);
                }
                20% {
                    opacity: 0.8;
                    transform: translateY(-10px) translateX(5px) scale(1);
                }
                50% {
                    opacity: 0.6;
                    transform: translateY(-25px) translateX(-10px) scale(0.8);
                }
                80% {
                    opacity: 0.3;
                    transform: translateY(-40px) translateX(8px) scale(0.5);
                }
                100% {
                    opacity: 0;
                    transform: translateY(-60px) translateX(0) scale(0);
                }
            }
        `;
        document.head.appendChild(particleStyles);
    }

    if (contactBtn && contactModal && closeModal) {
        const backdrop = contactModal.querySelector('.transmission-backdrop');

        const openModal = (e) => {
            if (e) e.preventDefault();
            contactModal.classList.remove('hidden');
            // Small delay to trigger CSS transition
            requestAnimationFrame(() => {
                contactModal.classList.add('show');
                createPortalParticles();
            });
        };

        const closeModalFn = (e) => {
            if (e) e.preventDefault();
            contactModal.classList.remove('show');
            clearPortalParticles();
            // Wait for animation to complete before hiding
            setTimeout(() => {
                if (!contactModal.classList.contains('show')) {
                    contactModal.classList.add('hidden');
                }
            }, 500);
        };

        contactBtn.addEventListener('click', openModal);
        closeModal.addEventListener('click', closeModalFn);

        // Close on backdrop click
        if (backdrop) {
            backdrop.addEventListener('click', closeModalFn);
        }

        // Also close if clicking the modal itself (outside portal)
        contactModal.addEventListener('click', (e) => {
            if (e.target === contactModal) closeModalFn(e);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && contactModal.classList.contains('show')) {
                closeModalFn();
            }
        });

        // Expose helpers for quick debugging
        window.__openContactModal = openModal;
        window.__closeContactModal = closeModalFn;
    }

    if (contactForm && contactModal && contactSuccess) {
        contactForm.addEventListener('submit', function (e) {
            e.preventDefault();

            // Add sending state to button
            const submitBtn = contactForm.querySelector('.transmit-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.querySelector('.btn-text').textContent = 'TRANSMITTING...';
            }

            fetch(contactForm.action, {
                method: 'POST',
                body: new FormData(contactForm),
                headers: { 'Accept': 'application/json' }
            }).then(response => {
                if (response.ok) {
                    contactForm.reset();
                    contactForm.style.display = 'none';
                    contactSuccess.classList.remove('hidden');

                    // Reset button state
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.querySelector('.btn-text').textContent = 'TRANSMIT';
                    }

                    setTimeout(() => {
                        contactModal.classList.remove('show');
                        clearPortalParticles();
                        setTimeout(() => {
                            contactModal.classList.add('hidden');
                            contactForm.style.display = 'flex';
                            contactSuccess.classList.add('hidden');
                        }, 500);
                    }, 3000);
                } else {
                    // Reset button state
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.querySelector('.btn-text').textContent = 'TRANSMIT';
                    }

                    response.json().then(data => {
                        if (Object.hasOwn(data, 'errors')) {
                            const sanitizedErrors = data["errors"]
                                .map(error => sanitizeText(error["message"] || 'Unknown error'))
                                .join(", ");
                            alert(sanitizedErrors || 'There was a problem sending your message. Please try again.');
                        } else {
                            alert('There was a problem sending your message. Please try again.');
                        }
                    }).catch(() => {
                        alert('There was a problem sending your message. Please try again.');
                    });
                }
            }).catch(() => {
                // Reset button state
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.querySelector('.btn-text').textContent = 'TRANSMIT';
                }
                alert('There was a problem sending your message. Check your connection and try again.');
            });
        });
    }

    // --- Fix: Only trigger "Enter the Galaxy" on button click, not anywhere else ---
    if (!isFunProjectsPage) {
        const flyBtn = document.getElementById('fly-btn');
        const mainContent = document.getElementById('main-content');
        if (flyBtn && mainContent) {
            flyBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent bubbling
                if (!isFlying) {
                    isFlying = true;
                    flyStartTime = performance.now();
                    mainContent.style.transition = 'opacity 0.5s ease-out';
                    mainContent.style.opacity = 0;
                    setTimeout(() => {
                        mainContent.style.display = 'none';
                    }, 500);
                }
            });
        }
    }

    // --- Event Listeners (Only add for index page elements) ---
    if (!isFunProjectsPage) {
        const flyBtn = document.getElementById('fly-btn');
        const welcomeTitle = document.getElementById('welcome-title');
        const mainContent = document.getElementById('main-content'); // Get main content container

        if (flyBtn && welcomeTitle && mainContent) {
            flyBtn.addEventListener('click', () => {
                if (!isFlying) {
                    isFlying = true;
                    flyStartTime = performance.now();
                    // Fade out main content smoothly
                    mainContent.style.transition = 'opacity 0.5s ease-out';
                    mainContent.style.opacity = 0;
                     // Hide after fade out
                    setTimeout(() => {
                         mainContent.style.display = 'none';
                    }, 500); // Match transition duration
                }
            });
        } else {
            console.error("Required elements (fly-btn, welcome-title, main-content) not found on index page!");
        }

        // --- Seamless transition for "More Projects" tile ---
        // Note: This is now handled by the ConstellationPortal class for portal-based navigation
        // The portal's activatePortal() method handles the camera fly animation
        
        // Fix for GitHub icon - make sure it's visible and clickable
        const githubLogo = document.querySelector('.github-logo');
        if (githubLogo) {
            githubLogo.style.cursor = 'pointer';
            githubLogo.addEventListener('click', function() {
                window.open('https://www.github.com/onekapisch', '_blank');
            });
        }
    }

    // --- Drag & Drop ordering for tiles (persisted in localStorage) ---
    function setupDragAndDrop(containerSelector, storageKey) {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        const tiles = Array.from(container.querySelectorAll('.futuristic-card-link'));
        tiles.forEach((tile, idx) => {
            tile.dataset.tileId = tile.dataset.tileId || tile.id || `${storageKey}-tile-${idx}`;
            tile.setAttribute('draggable', 'true');
        });

        // Apply saved order if present
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
            if (Array.isArray(saved) && saved.length) {
                saved.forEach(id => {
                    const match = tiles.find(t => t.dataset.tileId === id);
                    if (match) container.appendChild(match);
                });
            }
        } catch (err) {
            console.warn('Tile order load failed', err);
        }

        let dragging = null;
        let dragMoved = false;

        const persistOrder = () => {
            const order = Array.from(container.querySelectorAll('.futuristic-card-link')).map(t => t.dataset.tileId);
            try {
                localStorage.setItem(storageKey, JSON.stringify(order));
            } catch (err) {
                console.warn('Tile order save failed', err);
            }
        };

        const getDragAfterElement = (y) => {
            const siblings = [...container.querySelectorAll('.futuristic-card-link:not(.tile-dragging)')];
            let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
            siblings.forEach(child => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    closest = { offset, element: child };
                }
            });
            return closest.element;
        };

        tiles.forEach(tile => {
            tile.addEventListener('dragstart', (e) => {
                dragging = tile;
                dragMoved = false;
                tile.classList.add('tile-dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            tile.addEventListener('dragend', () => {
                if (dragging) {
                    dragging.classList.remove('tile-dragging');
                    dragging = null;
                }
                container.querySelectorAll('.tile-drop-target').forEach(el => el.classList.remove('tile-drop-target'));
                if (dragMoved) {
                    persistOrder();
                    tile.dataset.dragJustEnded = 'true';
                    setTimeout(() => { tile.dataset.dragJustEnded = 'false'; }, 50);
                }
            });

            tile.addEventListener('click', (e) => {
                if (tile.dataset.dragJustEnded === 'true') {
                    e.preventDefault();
                }
            });
        });

        container.addEventListener('dragover', (e) => {
            if (!dragging) return;
            e.preventDefault();
            const afterElement = getDragAfterElement(e.clientY);
            container.querySelectorAll('.tile-drop-target').forEach(el => el.classList.remove('tile-drop-target'));
            if (afterElement == null) {
                container.appendChild(dragging);
            } else {
                container.insertBefore(dragging, afterElement);
                afterElement.classList.add('tile-drop-target');
            }
            dragMoved = true;
        });
    }

    setupDragAndDrop('#tiles-section .grid', 'index-tiles-order');
    setupDragAndDrop('#fun-projects-tiles-section .flex', 'fun-tiles-order');

    // --- Page Transition Handling (Optional: Fade out before leaving) ---
    // This provides a smoother visual transition when clicking links
    document.body.addEventListener('click', function(event) {
        const targetLink = event.target.closest('a');

        // Check if it's a local link (not external, not #hash) and not the back button itself triggering it
        if (targetLink && targetLink.href && targetLink.hostname === window.location.hostname && !targetLink.href.includes('#') && targetLink.id !== 'back-btn') {

             // Check if it's the Fun Projects link on the index page
             if (!isFunProjectsPage && targetLink.href.includes('/fun-projects')) {
                event.preventDefault(); // Prevent immediate navigation
                document.body.style.transition = 'opacity 0.5s ease-out';
                document.body.style.opacity = 0;
                setTimeout(() => {
                     window.location.href = targetLink.href; // Navigate after fade
                }, 500); // Match fade duration
             }
            // Add similar logic for the back button if desired
            else if (isFunProjectsPage && targetLink.id === 'back-btn') {
                 event.preventDefault();
                 document.body.style.transition = 'opacity 0.5s ease-out';
                 document.body.style.opacity = 0;
                 setTimeout(() => {
                     window.location.href = targetLink.href;
                 }, 500);
            }
        }
    });

    // Add back button handler
    const backBtn = document.getElementById('back-btn');
    if (backBtn && isFunProjectsPage) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (!isTransitioningBack) {
                isTransitioningBack = true;
                backTransitionStartTime = performance.now();
                currentLookAt = camera.getWorldDirection(new THREE.Vector3());
            }
        });
    }

    const backHomeBtn = document.getElementById('back-home-btn');
    if (backHomeBtn && !isFunProjectsPage) {
        backHomeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = './';
        });
    }

    // --- Initialize Constellation Portals (only for fun-projects page, index page initializes after camera transition) ---
    // Note: Index page portals are initialized in the camera transition callback
});

// ============================================
// CONSTELLATION PORTAL SYSTEM
// ============================================

class ConstellationPortal {
    constructor(container) {
        this.container = container;
        this.canvas = container.querySelector('.portal-canvas');
        this.projectData = {
            id: container.dataset.projectId,
            url: container.dataset.url,
            target: container.dataset.target || '_blank',
            title: container.dataset.title,
            image: container.dataset.image
        };

        // Portal state
        this.isHovered = false;
        this.convergenceProgress = 0; // 0 = scattered, 1 = converged
        this.targetConvergence = 0;

        // Star configuration
        this.numStars = 18;
        this.stars = [];
        this.scatteredPositions = [];
        this.convergedPositions = [];
        this.constellationLines = [];

        // Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.starPoints = null;
        this.linesMesh = null;
        this.portalRing = null;
        this.glowSprite = null;

        // Animation
        this.animationId = null;
        this.clock = new THREE.Clock();

        // Mouse position for tilt
        this.mouseX = 0;
        this.mouseY = 0;

        this.init();
    }

    init() {
        if (!this.canvas) return;

        // Setup Three.js scene
        this.scene = new THREE.Scene();

        // Orthographic camera for 2D-like rendering
        const aspect = 1;
        const frustumSize = 10;
        this.camera = new THREE.OrthographicCamera(
            -frustumSize * aspect / 2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            -frustumSize / 2,
            0.1,
            100
        );
        this.camera.position.z = 10;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true
        });
        this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);

        // Generate star positions
        this.generateStarPositions();

        // Create visual elements
        this.createStars();
        this.createConstellationLines();
        this.createPortalRing();
        this.createGlow();

        // Setup event listeners
        this.setupEventListeners();

        // Start animation loop
        this.animate();
    }

    generateStarPositions() {
        const scatterRadius = 4;
        const ringRadius = 3;

        for (let i = 0; i < this.numStars; i++) {
            // Scattered positions (random within area)
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * scatterRadius * 0.8 + scatterRadius * 0.2;
            const scatter = {
                x: Math.cos(angle) * r + (Math.random() - 0.5) * 2,
                y: Math.sin(angle) * r + (Math.random() - 0.5) * 2,
                z: (Math.random() - 0.5) * 0.5,
                driftSpeed: 0.3 + Math.random() * 0.5,
                driftOffset: Math.random() * Math.PI * 2
            };
            this.scatteredPositions.push(scatter);

            // Converged positions (ring formation)
            const ringAngle = (i / this.numStars) * Math.PI * 2;
            const converged = {
                x: Math.cos(ringAngle) * ringRadius,
                y: Math.sin(ringAngle) * ringRadius,
                z: 0
            };
            this.convergedPositions.push(converged);

            // Current star state
            this.stars.push({
                x: scatter.x,
                y: scatter.y,
                z: scatter.z,
                size: 0.08 + Math.random() * 0.06,
                brightness: 0.6 + Math.random() * 0.4
            });
        }

        // Generate constellation line connections (only between nearby stars)
        for (let i = 0; i < this.numStars; i++) {
            for (let j = i + 1; j < this.numStars; j++) {
                const dx = this.scatteredPositions[i].x - this.scatteredPositions[j].x;
                const dy = this.scatteredPositions[i].y - this.scatteredPositions[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 3 && Math.random() > 0.5) {
                    this.constellationLines.push({ from: i, to: j });
                }
            }
        }
    }

    createStars() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.numStars * 3);
        const sizes = new Float32Array(this.numStars);
        const colors = new Float32Array(this.numStars * 3);

        for (let i = 0; i < this.numStars; i++) {
            positions[i * 3] = this.stars[i].x;
            positions[i * 3 + 1] = this.stars[i].y;
            positions[i * 3 + 2] = this.stars[i].z;
            sizes[i] = this.stars[i].size * 50;

            // Cyan-white color
            const brightness = this.stars[i].brightness;
            colors[i * 3] = 0.7 * brightness;
            colors[i * 3 + 1] = 0.9 * brightness;
            colors[i * 3 + 2] = 1.0 * brightness;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.3,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending
        });

        this.starPoints = new THREE.Points(geometry, material);
        this.scene.add(this.starPoints);
    }

    createConstellationLines() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.constellationLines.length * 6);

        for (let i = 0; i < this.constellationLines.length; i++) {
            const line = this.constellationLines[i];
            const fromStar = this.stars[line.from];
            const toStar = this.stars[line.to];

            positions[i * 6] = fromStar.x;
            positions[i * 6 + 1] = fromStar.y;
            positions[i * 6 + 2] = fromStar.z;
            positions[i * 6 + 3] = toStar.x;
            positions[i * 6 + 4] = toStar.y;
            positions[i * 6 + 5] = toStar.z;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.25,
            blending: THREE.AdditiveBlending
        });

        this.linesMesh = new THREE.LineSegments(geometry, material);
        this.scene.add(this.linesMesh);
    }

    createPortalRing() {
        // Outer ring
        const ringGeometry = new THREE.TorusGeometry(3, 0.08, 16, 64);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending
        });
        this.portalRing = new THREE.Mesh(ringGeometry, ringMaterial);
        this.portalRing.scale.set(0, 0, 1);
        this.scene.add(this.portalRing);

        // Inner ring
        const innerRingGeometry = new THREE.TorusGeometry(2.8, 0.03, 16, 64);
        const innerRingMaterial = new THREE.MeshBasicMaterial({
            color: 0x5eead4,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending
        });
        this.innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
        this.innerRing.scale.set(0, 0, 1);
        this.scene.add(this.innerRing);
    }

    createGlow() {
        // Central glow sprite
        const spriteMaterial = new THREE.SpriteMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending
        });
        this.glowSprite = new THREE.Sprite(spriteMaterial);
        this.glowSprite.scale.set(8, 8, 1);
        this.scene.add(this.glowSprite);
    }

    setupEventListeners() {
        this.container.addEventListener('mouseenter', () => {
            this.isHovered = true;
            this.targetConvergence = 1;
        });

        this.container.addEventListener('mouseleave', () => {
            this.isHovered = false;
            this.targetConvergence = 0;
        });

        this.container.addEventListener('mousemove', (e) => {
            const rect = this.container.getBoundingClientRect();
            this.mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
            this.mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        });

        this.container.addEventListener('click', (e) => {
            e.preventDefault();
            this.activatePortal();
        });

        // Handle resize
        window.addEventListener('resize', () => this.onResize());
    }

    activatePortal() {
        // Flash effect
        if (this.glowSprite) {
            gsap.to(this.glowSprite.material, {
                opacity: 1,
                duration: 0.15,
                onComplete: () => {
                    gsap.to(this.glowSprite.material, {
                        opacity: 0,
                        duration: 0.3
                    });
                }
            });
        }

        // Handle "More Projects" tile with simple direct navigation
        if (this.projectData.id === 'more-projects') {
            // Create overlay for smooth fade transition
            let overlay = document.getElementById('page-transition-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'page-transition-overlay';
                overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;opacity:0;pointer-events:none;z-index:1000;';
                document.body.appendChild(overlay);
            }

            // Fade out content and navigate
            const tiles = document.querySelectorAll('.portal-container, #github-profile, #contact-btn');
            tiles.forEach(el => {
                if (el) {
                    el.style.transition = 'opacity 0.4s ease-out';
                    el.style.opacity = '0';
                }
            });

            // Fade in the overlay
            overlay.style.transition = 'opacity 0.5s ease-in';
            setTimeout(() => {
                overlay.style.opacity = '1';
            }, 200);

            // Navigate after fade completes
            setTimeout(() => {
                window.location.href = this.projectData.url;
            }, 600);
            return;
        }

        // Navigate after brief delay for other portals
        setTimeout(() => {
            if (this.projectData.target === '_blank') {
                window.open(this.projectData.url, '_blank', 'noopener,noreferrer');
            } else {
                window.location.href = this.projectData.url;
            }
        }, 200);
    }

    onResize() {
        if (!this.canvas || !this.renderer) return;
        this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        const elapsed = this.clock.getElapsedTime();

        // Smooth convergence animation
        const convergenceSpeed = 0.08;
        this.convergenceProgress += (this.targetConvergence - this.convergenceProgress) * convergenceSpeed;

        // Update star positions
        this.updateStars(elapsed);

        // Update constellation lines
        this.updateLines();

        // Update portal ring
        this.updatePortalRing();

        // Update glow
        this.updateGlow();

        // Camera tilt based on mouse
        if (this.isHovered) {
            this.camera.position.x = this.mouseX * 0.5;
            this.camera.position.y = -this.mouseY * 0.5;
            this.camera.lookAt(0, 0, 0);
        } else {
            this.camera.position.x *= 0.9;
            this.camera.position.y *= 0.9;
            this.camera.lookAt(0, 0, 0);
        }

        this.renderer.render(this.scene, this.camera);
    }

    updateStars(elapsed) {
        if (!this.starPoints) return;

        const positions = this.starPoints.geometry.attributes.position.array;

        for (let i = 0; i < this.numStars; i++) {
            const scattered = this.scatteredPositions[i];
            const converged = this.convergedPositions[i];

            // Add idle drift to scattered positions
            const drift = Math.sin(elapsed * scattered.driftSpeed + scattered.driftOffset) * 0.15;
            const driftY = Math.cos(elapsed * scattered.driftSpeed * 0.7 + scattered.driftOffset) * 0.15;

            // Interpolate between scattered and converged
            const t = this.convergenceProgress;
            const easeT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

            this.stars[i].x = scattered.x + drift + (converged.x - scattered.x - drift) * easeT;
            this.stars[i].y = scattered.y + driftY + (converged.y - scattered.y - driftY) * easeT;
            this.stars[i].z = scattered.z + (converged.z - scattered.z) * easeT;

            positions[i * 3] = this.stars[i].x;
            positions[i * 3 + 1] = this.stars[i].y;
            positions[i * 3 + 2] = this.stars[i].z;
        }

        this.starPoints.geometry.attributes.position.needsUpdate = true;

        // Pulse star brightness when converged
        const pulse = 0.9 + Math.sin(elapsed * 3) * 0.1 * this.convergenceProgress;
        this.starPoints.material.opacity = 0.9 * pulse;
    }

    updateLines() {
        if (!this.linesMesh) return;

        const positions = this.linesMesh.geometry.attributes.position.array;

        for (let i = 0; i < this.constellationLines.length; i++) {
            const line = this.constellationLines[i];
            const fromStar = this.stars[line.from];
            const toStar = this.stars[line.to];

            positions[i * 6] = fromStar.x;
            positions[i * 6 + 1] = fromStar.y;
            positions[i * 6 + 2] = fromStar.z;
            positions[i * 6 + 3] = toStar.x;
            positions[i * 6 + 4] = toStar.y;
            positions[i * 6 + 5] = toStar.z;
        }

        this.linesMesh.geometry.attributes.position.needsUpdate = true;

        // Fade out lines as stars converge
        this.linesMesh.material.opacity = 0.25 * (1 - this.convergenceProgress);
    }

    updatePortalRing() {
        if (!this.portalRing) return;

        const t = this.convergenceProgress;
        const scale = t * 1;

        this.portalRing.scale.set(scale, scale, 1);
        this.portalRing.material.opacity = t * 0.8;
        this.portalRing.rotation.z += 0.005;

        if (this.innerRing) {
            this.innerRing.scale.set(scale, scale, 1);
            this.innerRing.material.opacity = t * 0.5;
            this.innerRing.rotation.z -= 0.008;
        }
    }

    updateGlow() {
        if (!this.glowSprite) return;

        // Subtle glow that pulses when converged
        const baseOpacity = this.convergenceProgress * 0.15;
        const pulse = Math.sin(this.clock.getElapsedTime() * 2) * 0.05;
        this.glowSprite.material.opacity = Math.max(0, baseOpacity + pulse * this.convergenceProgress);
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
        if (this.scene) {
            this.scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(m => m.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }
    }
}

// Initialize all constellation portals
function initConstellationPortals() {
    const containers = document.querySelectorAll('.portal-container');

    containers.forEach((container, index) => {
        // Add visible class with stagger
        setTimeout(() => {
            container.classList.add('visible');
        }, index * 100);

        // Create portal instance
        const portal = new ConstellationPortal(container);
        portalInstances.push(portal);
    });
}

// Animate portals in (called after camera transition)
function animatePortalsIn() {
    const containers = document.querySelectorAll('.portal-container');
    containers.forEach((container, index) => {
        setTimeout(() => {
            container.classList.add('visible');
        }, index * 100);
    });
}
