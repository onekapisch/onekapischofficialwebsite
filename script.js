// --- Global Variables ---
let scene, camera, renderer, lowPolyMesh, stars, raycaster, mouse;
let clock = new THREE.Clock();
let isFlying = false; // Flag for camera animation state (index page only)
let flyStartTime = 0;
const flyDuration = 5.0;
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
const backTransitionDuration = 2.0;
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
const isFunProjectsPage = window.location.pathname.includes('fun-projects.html');

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


    // --- Starfield ---
    const starVertices = [];
    const numStars = 30000, starSpread = 1000;
    for (let i = 0; i < numStars; i++) {
        const x = THREE.MathUtils.randFloatSpread(starSpread * 2);
        // Adjusted Y range to feel more surrounding on fun projects page
        const y = THREE.MathUtils.randFloat(-starSpread * 0.5, starSpread * 1.5);
        const z = THREE.MathUtils.randFloatSpread(starSpread * 2);
         // Ensure stars are not too close initially
        if (Math.sqrt(x * x + y * y + z * z) > 50) {
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
        map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/spark1.png'), // Ensure this path is valid or replace
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    stars = new THREE.Points(starGeometry, starMaterial);
    // Slightly adjust star position/rotation for fun projects page? (Optional)
    if (isFunProjectsPage) {
         stars.rotation.x = 0.1; // Example subtle difference
         stars.position.y = -30;
    }
    scene.add(stars);

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
    // If on fun projects page, directly animate tiles in
    if (isFunProjectsPage) {
        const funTilesSection = document.getElementById('fun-projects-tiles-section');
        if (funTilesSection && !tilesAnimated) {
            funTilesSection.classList.add('active'); // Ensure section is displayed
            // Use timeout to allow initial render before animation starts
             setTimeout(() => {
                animateTilesIn('#fun-projects-tiles-section .futuristic-card-link');
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
             // Reset any previous transition delays immediately
             tile.style.transitionDelay = '0s';
             // Remove and re-add class slightly later to re-trigger animation if needed
            tile.classList.remove('visible');

            // Apply new delay and trigger visibility
             setTimeout(() => {
                 tile.style.transitionDelay = (i * 0.09) + 's'; // Staggered delay
                 tile.classList.add('visible');
             }, 50); // Small delay before starting animation sequence
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
                // Animate tiles in if not already done
                if (!tilesAnimated) {
                    animateTilesIn('#tiles-section .futuristic-card-link'); // Target index page tiles
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
        const contentElements = document.querySelectorAll('.futuristic-card-link, #contact-btn, #github-profile, .section-title');
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
                window.location.href = "fun-projects.html";
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
        if (t > 0.7) {
            document.body.style.opacity = 1 - ((t - 0.7) / 0.3);
        }

        if (t >= 1) {
            window.location.href = "index.html#tiles";
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

    // --- Starfield Animation (Runs on both pages) ---
    if (stars && !isFlyingToFunProjects) { // Normal star animation when not in transition
        stars.rotation.y += 0.001; // Slower rotation
        stars.material.opacity = 0.9 + Math.sin(elapsedTime * 0.3) * 0.3; // Smoother opacity pulse
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
    `;
    document.head.appendChild(style);

    // Initialize Three.js (which now handles page-specific setup)
    initThreeJS();

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
        const moreProjectsTile = document.getElementById('tile-4');
        if (moreProjectsTile) {
            moreProjectsTile.addEventListener('click', function(e) {
                e.preventDefault();
                if (!isFlyingToFunProjects) {
                    isFlyingToFunProjects = true;
                    flyToFunProjectsStartTime = performance.now();
                    
                    // Create the overlay for smooth transition if it doesn't exist
                    if (!document.getElementById('page-transition-overlay')) {
                        const overlay = document.createElement('div');
                        overlay.id = 'page-transition-overlay';
                        document.body.appendChild(overlay);
                    }
                    
                    // Start from current camera position
                    currentLookAt = camera.getWorldDirection(new THREE.Vector3());
                    
                    // Make sure the canvas is visible during transition
                    const canvas = document.getElementById('bg-canvas');
                    if (canvas) {
                        canvas.style.zIndex = '-1';
                        canvas.style.opacity = '1';
                    }
                }
            });
        }
        
        // Fix for GitHub icon - make sure it's visible and clickable
        const githubLogo = document.querySelector('.github-logo');
        if (githubLogo) {
            githubLogo.style.cursor = 'pointer';
            githubLogo.addEventListener('click', function() {
                window.open('https://www.github.com/onekapisch', '_blank');
            });
        }
    }

    // --- Page Transition Handling (Optional: Fade out before leaving) ---
    // This provides a smoother visual transition when clicking links
    document.body.addEventListener('click', function(event) {
        const targetLink = event.target.closest('a');

        // Check if it's a local link (not external, not #hash) and not the back button itself triggering it
        if (targetLink && targetLink.href && targetLink.hostname === window.location.hostname && !targetLink.href.includes('#') && targetLink.id !== 'back-btn') {

             // Check if it's the Fun Projects link on the index page
             if (!isFunProjectsPage && targetLink.href.includes('fun-projects.html')) {
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
});