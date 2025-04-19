// --- Global Variables ---
let scene, camera, renderer, lowPolyMesh, stars, raycaster, mouse;
let clock = new THREE.Clock(); // For time-based animation
let isFlying = false; // Flag for camera animation state
let flyStartTime = 0; // Timestamp when fly animation starts
const flyDuration = 3.5; // Duration of the camera flight in seconds
let cameraStart = { y: 5, z: 25 }; // Initial camera position
let cameraEnd = { y: 30, z: -80 }; // Target camera position after flight
let hasTransitioned = false; // Flag to check if view has switched to tiles
let tilesAnimated = false; // Flag to ensure tiles animate in only once

// --- Initialization ---

/**
 * Initializes the entire Three.js scene, objects, lighting, and event listeners.
 */
function initThreeJS() {
    // --- Scene Setup ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Black background

    // --- Camera Setup ---
    camera = new THREE.PerspectiveCamera(
        60, // Field of view
        window.innerWidth / window.innerHeight, // Aspect ratio
        0.1, // Near clipping plane
        2000 // Far clipping plane
    );
    camera.position.set(0, cameraStart.y, cameraStart.z); // Set initial position
    camera.lookAt(0, 0, 0); // Look at the center of the scene

    // --- Renderer Setup ---
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('bg-canvas'), // Use the existing canvas
        antialias: true // Enable anti-aliasing for smoother edges
    });
    renderer.setSize(window.innerWidth, window.innerHeight); // Set size to full window
    // Adjust pixel ratio for high-density displays (like Retina)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // --- Starfield ---
    const starVertices = [];
    const numStars = 5000;
    const starSpread = 1000;
    for (let i = 0; i < numStars; i++) {
        // Generate random positions for stars
        const x = THREE.MathUtils.randFloatSpread(starSpread * 2);
        const y = THREE.MathUtils.randFloat(10, starSpread); // Keep stars generally above horizon
        const z = THREE.MathUtils.randFloatSpread(starSpread * 2);
        // Ensure stars are not too close to the center initially
        if (Math.sqrt(x*x + y*y + z*z) > 100) {
            starVertices.push(x, y, z);
        }
    }
    // Create geometry and material for stars
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 3.5,
        sizeAttenuation: true, // Make points smaller further away
        transparent: true,
        opacity: 2.8, // High opacity for additive blending brightness
        // Use a texture for star shape
        map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/spark1.png'),
        blending: THREE.AdditiveBlending, // Add colors for brighter effect
        depthWrite: false // Prevent stars obscuring each other unnaturally
    });
    stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars); // Add stars to the scene

    // --- Low Poly Plane Geometry ---
    const planeWidth = 150;
    const planeHeight = 150;
    const widthSegments = 200; // More segments for smoother waves/interaction
    const heightSegments = 200;
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, widthSegments, heightSegments);
    const vertices = geometry.attributes.position; // Access vertex positions
    const colors = []; // Array to store vertex colors
    const originalZ = []; // Store original Z positions for wave animation
    const baseColors = []; // Store original colors for hover reset

    // Define a color palette for the terrain
    const blueColors = [
        new THREE.Color(0x0a1a2f), // Darkest blue
        new THREE.Color(0x102a4c),
        new THREE.Color(0x1a3a6a),
        new THREE.Color(0x26508e),
        new THREE.Color(0x3a6aa0)  // Lightest blue
    ];

    // Generate height (z) and color for each vertex
    for (let i = 0; i < vertices.count; i++) {
        // Random Z height for terrain variation
        const z = Math.random() * 2.5 - 1.25;
        vertices.setZ(i, z);
        originalZ.push(z); // Store for animation

        // Determine color based on height
        const zValue = vertices.getZ(i);
        let colorIndex = 0;
        if (zValue > 0.8) colorIndex = 4;
        else if (zValue > 0.3) colorIndex = 3;
        else if (zValue > -0.3) colorIndex = 2;
        else if (zValue > -0.8) colorIndex = 1;
        const color = blueColors[colorIndex];

        // Add color data to arrays
        colors.push(color.r, color.g, color.b);
        baseColors.push(color.r, color.g, color.b); // Store base color
    }
    vertices.needsUpdate = true; // Mark positions as updated
    geometry.computeVertexNormals(); // Calculate normals for lighting

    // Set vertex colors attribute
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    // Store base colors separately for hover effect reset
    geometry.setAttribute('baseColor', new THREE.Float32BufferAttribute([...colors], 3));
    // Store original Z positions in userData for easy access in animation loop
    geometry.userData.originalZ = originalZ;

    // Create material using vertex colors and flat shading
    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide, // Render both sides
        flatShading: true // Characteristic low-poly look
    });

    // Create mesh and add to scene
    lowPolyMesh = new THREE.Mesh(geometry, material);
    lowPolyMesh.rotation.x = -Math.PI / 2.2; // Tilt the plane
    lowPolyMesh.position.y = -10; // Lower the plane
    scene.add(lowPolyMesh);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x404040, 1.0); // Soft ambient light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // White directional light
    directionalLight.position.set(1000, 100, 100); // Position it far away
    scene.add(directionalLight);

    // --- Raycaster for Mouse Interaction ---
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2(); // Store normalized mouse coordinates (-1 to +1)

    // --- Event Listeners ---
    window.addEventListener('mousemove', onMouseMove, false); // Track mouse movement
    window.addEventListener('resize', onWindowResize, false); // Handle window resizing

    // --- Start Animation Loop ---
    animate();
}

/**
 * Handles mouse movement to update mouse coordinates and trigger terrain highlighting.
 * @param {MouseEvent} event - The mouse move event object.
 */
function onMouseMove(event) {
    // Don't update if camera animation is finished
    if (hasTransitioned) return;

    // Calculate normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the raycaster with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObject(lowPolyMesh);

    // Get color attributes
    const colors = lowPolyMesh.geometry.attributes.color;
    const baseColors = lowPolyMesh.geometry.attributes.baseColor;

    // Reset all vertex colors to their base colors first
    // More efficient than checking every vertex individually if it was highlighted before
     colors.array.set(baseColors.array); // Fast way to copy array data

    // If the ray intersects the plane
    if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point; // Point of intersection in world space
        const highlightRadius = 3; // Radius of the highlight effect
        const positionAttribute = lowPolyMesh.geometry.attributes.position;
        const localIntersectionPoint = lowPolyMesh.worldToLocal(intersectionPoint.clone()); // Convert intersection point to mesh's local space
        const tempColor = new THREE.Color(); // Reuse color object for efficiency

        // Iterate through all vertices to check distance
        for (let i = 0; i < positionAttribute.count; i++) {
            const vertexPosition = new THREE.Vector3();
            vertexPosition.fromBufferAttribute(positionAttribute, i); // Get vertex position

            // Calculate distance from vertex to intersection point
            const distance = vertexPosition.distanceTo(localIntersectionPoint);

            // If vertex is within the highlight radius
            if (distance < highlightRadius) {
                // Calculate intensity based on distance (closer = brighter)
                const falloff = Math.pow(1.0 - (distance / highlightRadius), 2); // Squared falloff for smoother edge
                // Get the base color of the vertex
                tempColor.fromBufferAttribute(baseColors, i);
                // Interpolate towards white based on falloff intensity
                tempColor.lerp(new THREE.Color(0xffffff), 0.4 * falloff); // Adjust 0.4 for highlight intensity
                // Set the calculated color for the vertex
                colors.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
            }
        }
    }

    // Mark the color attribute as needing an update
    colors.needsUpdate = true;
}


/**
 * Easing function for smooth animation (cubic in/out).
 * @param {number} t - Time progress (0 to 1).
 * @returns {number} - Eased value.
 */
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Animates the project tiles into view with a staggered effect.
 */
function animateTilesIn() {
    // Get all tile elements
    const tiles = document.querySelectorAll('.futuristic-card-link');
    tiles.forEach((tile, i) => {
        if (tile) {
            // Ensure tile starts hidden and reset any previous delay
            tile.classList.remove('visible');
            tile.style.transitionDelay = '0s';
            // Schedule adding the 'visible' class with a delay
            setTimeout(() => {
                tile.style.transitionDelay = (i * 0.09) + 's'; // Stagger delay
                tile.classList.add('visible'); // Trigger CSS transition/animation
            }, 100); // Small initial delay before starting the sequence
        }
    });
}

/**
 * The main animation loop, called recursively via requestAnimationFrame.
 */
function animate() {
    requestAnimationFrame(animate); // Request the next frame

    const elapsedTime = clock.getElapsedTime(); // Time since initialization

    // --- Camera Fly Animation ---
    if (isFlying) {
        // Calculate progress (0 to 1) based on time and duration
        let t = (performance.now() - flyStartTime) / 1000 / flyDuration;
        t = Math.min(t, 1); // Clamp progress to 1
        t = easeInOutCubic(t); // Apply easing

        // Interpolate camera position
        camera.position.z = cameraStart.z + (cameraEnd.z - cameraStart.z) * t;
        camera.position.y = cameraStart.y + (cameraEnd.y - cameraStart.y) * t;
        camera.lookAt(0, 0, 0); // Keep looking at the center

        // --- Transition to Tiles View ---
        if (t >= 1 && !hasTransitioned) {
            hasTransitioned = true; // Mark transition as complete
            // Fade out initial content (handled by button click now)
            // document.getElementById('main-content').style.opacity = 0;
            // Wait for fade out, then display tiles
            setTimeout(() => {
                // document.getElementById('main-content').style.display = 'none';
                document.getElementById('tiles-section').classList.add('active'); // Show tiles section
                // Trigger tile animation only once
                if (!tilesAnimated) {
                    animateTilesIn();
                    tilesAnimated = true;
                }
            }, 600); // Delay should match fade-out duration
        }
    }

    // --- Terrain Wave Animation (only before transition) ---
    if (lowPolyMesh && !hasTransitioned) {
        const vertices = lowPolyMesh.geometry.attributes.position;
        const originalZ = lowPolyMesh.geometry.userData.originalZ;
        // Animate vertex Z positions based on sine/cosine waves and time
        for (let i = 0; i < vertices.count; i++) {
            const x = vertices.getX(i);
            const y = vertices.getY(i);
            const baseZ = originalZ[i];
            // Combine multiple waves for complexity
            const wave = Math.sin((x + elapsedTime * 1.5) * 0.15) * 0.5 +
                         Math.cos((y + elapsedTime * 1.5) * 0.15) * 0.5 +
                         Math.sin((x + y + elapsedTime * 0.8) * 0.1) * 0.3;
            vertices.setZ(i, baseZ + wave);
        }
        vertices.needsUpdate = true; // Mark positions as updated
        // Optional: Recompute normals if waves are large (can impact performance)
        // lowPolyMesh.geometry.computeVertexNormals();
    }

    // --- Starfield Animation ---
    if (stars) {
        stars.rotation.y += 0.0001; // Slowly rotate stars
        // Subtle opacity flicker
        stars.material.opacity = 0.8 + Math.sin(elapsedTime * 0.5) * 0.2;
    }

    // --- Render the scene ---
    renderer.render(scene, camera);
}

/**
 * Handles window resize events to update camera and renderer.
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight; // Update aspect ratio
    camera.updateProjectionMatrix(); // Apply changes
    renderer.setSize(window.innerWidth, window.innerHeight); // Resize renderer
    // Update pixel ratio (important for sharp rendering on high-res screens)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// --- Wait for DOM to be ready before initializing ---
document.addEventListener('DOMContentLoaded', () => {
    const flyBtn = document.getElementById('fly-btn');
    const welcomeTitle = document.getElementById('welcome-title'); // Get title element

    // Add click listener to the button
    if (flyBtn && welcomeTitle) { // Check if both elements exist
        flyBtn.addEventListener('click', () => {
            if (!isFlying) {
                isFlying = true; // Start the flying animation state
                flyStartTime = performance.now(); // Record start time

                // Add transitions for smooth fade-out
                flyBtn.style.transition = 'opacity 0.5s ease-out';
                welcomeTitle.style.transition = 'opacity 0.5s ease-out';

                // Start fade-out
                flyBtn.style.opacity = 0;
                welcomeTitle.style.opacity = 0;

                // After fade-out, hide the button completely
                setTimeout(() => {
                    if (flyBtn) flyBtn.style.display = 'none';
                    // Optionally hide title too if needed
                    // if (welcomeTitle) welcomeTitle.style.display = 'none';
                } , 500); // Match transition duration
            }
        });
    } else {
        console.error("Button or Title element not found!");
    }

    // Initialize the Three.js scene
    initThreeJS();
});
