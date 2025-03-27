import * as THREE from 'three';
import { config } from './config.js';

let scene, camera, renderer;
let cats = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedCat = null;
let isPetting = false;
const clock = new THREE.Clock();

const loadingScreen = document.getElementById('loading-screen');
const loadingText = document.getElementById('loading-text');

async function generateCatTexture() {
  try {
    const result = await websim.imageGen({
      prompt: "A cute, fluffy cat sitting, facing forward, photorealistic, white background",
      aspect_ratio: "1:1",
    });

    const img = new Image();
    img.crossOrigin = "Anonymous"; // Important for CORS if using external images
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = result.url;
    });

    // Create a canvas to process the image
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Simple white background removal (tolerance can be adjusted)
    const tolerance = 50; // Adjust as needed for edge detection quality
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Check if the pixel is close to white
      if (r > 255 - tolerance && g > 255 - tolerance && b > 255 - tolerance) {
        data[i + 3] = 0; // Set alpha to 0 (transparent)
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Create THREE texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;

  } catch (error) {
    console.error("Error generating or processing cat image:", error);
    // Optionally return a placeholder texture or handle the error
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 128;
    fallbackCanvas.height = 128;
    const fallbackCtx = fallbackCanvas.getContext('2d');
    fallbackCtx.fillStyle = 'red'; // Simple placeholder
    fallbackCtx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(fallbackCanvas);
  }
}

async function createCat() {
  const texture = await generateCatTexture();
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);

  sprite.scale.set(config.catScale, config.catScale, config.catScale);
  sprite.position.set(
    (Math.random() - 0.5) * 5,
    config.catScale / 2, // Position sprite slightly above ground
    (Math.random() - 0.5) * 5
  );

  // Add custom properties for movement and state
  sprite.userData = {
    targetPosition: new THREE.Vector3().copy(sprite.position),
    isMoving: false,
    isPet: false,
    idleOffset: Math.random() * Math.PI * 2, // For varied idle animation
    walkPhase: Math.random() * Math.PI * 2 // For varied walk animation
  };

  scene.add(sprite);
  cats.push(sprite);
}

async function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(config.backgroundColor);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 2, 5);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('scene-container').appendChild(renderer.domElement);

  // Add ground plane
  const groundGeometry = new THREE.PlaneGeometry(10, 10);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x90EE90, side: THREE.DoubleSide }); // Light green
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Add lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);

  // Generate cats
  loadingText.textContent = `Generating ${config.numCats} cats... (0/${config.numCats})`;
  for (let i = 0; i < config.numCats; i++) {
    await createCat();
    loadingText.textContent = `Generating ${config.numCats} cats... (${i + 1}/${config.numCats})`;
  }
  loadingScreen.style.display = 'none'; // Hide loading screen

  // Event listeners
  window.addEventListener('resize', onWindowResize, false);
  renderer.domElement.addEventListener('mousedown', onMouseDown, false);
  renderer.domElement.addEventListener('mousemove', onMouseMove, false);
  renderer.domElement.addEventListener('mouseup', onMouseUp, false);
  renderer.domElement.addEventListener('touchstart', onTouchStart, false);
  renderer.domElement.addEventListener('touchmove', onTouchMove, false);
  renderer.domElement.addEventListener('touchend', onTouchEnd, false);

  animate();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateMousePosition(clientX, clientY) {
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
}

function onMouseDown(event) {
  updateMousePosition(event.clientX, event.clientY);
  handleInteractionStart();
}

function onMouseMove(event) {
  if (isPetting && selectedCat) {
    updateMousePosition(event.clientX, event.clientY);
    handleInteractionMove();
  }
}

function onMouseUp(event) {
  handleInteractionEnd();
}

function onTouchStart(event) {
    if (event.touches.length === 1) {
        updateMousePosition(event.touches[0].clientX, event.touches[0].clientY);
        handleInteractionStart();
    }
}

function onTouchMove(event) {
    if (event.touches.length === 1 && isPetting && selectedCat) {
        updateMousePosition(event.touches[0].clientX, event.touches[0].clientY);
        handleInteractionMove();
    }
}

function onTouchEnd(event) {
    handleInteractionEnd();
}


function handleInteractionStart() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(cats);

  if (intersects.length > 0) {
    const intersectedCat = intersects[0].object;
    const distance = camera.position.distanceTo(intersectedCat.position);

    if (distance < config.pettingDistance * 10) { // Adjusted check for petting range
      selectedCat = intersectedCat;
      selectedCat.userData.isPet = true;
      isPetting = true;
      selectedCat.userData.isMoving = false; // Stop moving when petted
      console.log("Petting started");
    }
  }
}

function handleInteractionMove() {
    // Optional: Add visual feedback during petting if needed
     if (selectedCat) {
         // Example: Make the cat slightly larger or add a particle effect
         // selectedCat.scale.set(config.catScale * 1.1, config.catScale * 1.1, config.catScale * 1.1);
     }
}

function handleInteractionEnd() {
  if (selectedCat) {
    selectedCat.userData.isPet = false;
    // selectedCat.scale.set(config.catScale, config.catScale, config.catScale); // Reset scale
    console.log("Petting ended");
  }
  selectedCat = null;
  isPetting = false;
}


function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const elapsedTime = clock.getElapsedTime();

  cats.forEach(cat => {
    if (cat.userData.isPet) {
       // Make the cat 'purr' or react to petting
       // Simple wiggle effect
       cat.rotation.z = Math.sin(elapsedTime * 10) * 0.1;
       cat.position.y = config.catScale / 2 + Math.sin(elapsedTime * 15 + cat.userData.idleOffset) * config.idleAnimationHeight * 0.5; // Subtle bounce
    } else {
       cat.rotation.z = 0; // Reset rotation

      if (!cat.userData.isMoving) {
        // Idle behavior: gentle bounce
        cat.position.y = config.catScale / 2 + Math.sin(elapsedTime * 5 + cat.userData.idleOffset) * config.idleAnimationHeight;

        // Randomly decide to move
        if (Math.random() < 0.005) { // Adjust probability as needed
          cat.userData.targetPosition.set(
            (Math.random() - 0.5) * 9, // Stay within ground bounds
            config.catScale / 2,
            (Math.random() - 0.5) * 9
          );
          cat.userData.isMoving = true;
        }
      } else {
        // Move towards target position
        const direction = new THREE.Vector3().subVectors(cat.userData.targetPosition, cat.position);
        if (direction.lengthSq() > 0.01) { // Check if close enough to target
          direction.normalize();
          cat.position.add(direction.multiplyScalar(config.movementSpeed + Math.random() * 0.002)); // Add some randomness to speed

          // Walking animation (vertical bounce)
          cat.userData.walkPhase += config.walkingAnimationSpeed;
          cat.position.y = config.catScale / 2 + Math.abs(Math.sin(cat.userData.walkPhase)) * config.idleAnimationHeight * 1.5; // Higher bounce for walking

        } else {
          cat.userData.isMoving = false; // Reached target
          cat.position.y = config.catScale / 2; // Reset height
          cat.userData.walkPhase = Math.random() * Math.PI * 2; // Reset walk phase
        }
      }
    }
     // Make sprite always face the camera
     cat.lookAt(camera.position);
  });

  renderer.render(scene, camera);
}

init();
`````` index.html
<!DOCTYPE html>
<html>
<head>
  <title>Interactive Cats</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="style.css">
  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
      }
    }
  </script>
</head>
<body>
  <div id="loading-screen">
    <div id="loading-text">Generating cats...</div>
  </div>
  <div id="scene-container"></div>
  <script src="config.js" type="module"></script>
  <script src="app.js" type="module"></script>
</body>
</html>

import * as THREE from 'three';
import { config } from './config.js';

let scene, camera, renderer;
let cats = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedCat = null;
let isPetting = false;
const clock = new THREE.Clock();

const loadingScreen = document.getElementById('loading-screen');
const loadingText = document.getElementById('loading-text');
const sceneContainer = document.getElementById('scene-container');

async function generateCatTexture() {
  console.log("Requesting cat image...");
  try {
    const result = await websim.imageGen({
      prompt: config.imageGenPrompt,
      aspect_ratio: config.imageGenAspectRatio,
    });
    console.log("Image generated:", result.url);

    const img = new Image();
    img.crossOrigin = "Anonymous";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = (err) => {
        console.error("Image load error:", err);
        reject(err);
      };
      img.src = result.url;
    });

    console.log("Image loaded, processing background...");
    // Create a canvas to process the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.naturalWidth || img.width; // Use naturalWidth for reliability
    canvas.height = img.naturalHeight || img.height;

    if (canvas.width === 0 || canvas.height === 0) {
         throw new Error("Image has zero dimensions");
    }

    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const tolerance = config.backgroundRemovalTolerance;
    const rThreshold = 255 - tolerance;
    const gThreshold = 255 - tolerance;
    const bThreshold = 255 - tolerance;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Check if the pixel is close to white
      if (r > rThreshold && g > gThreshold && b > bThreshold) {
        data[i + 3] = 0; // Set alpha to 0 (transparent)
      }
    }
    ctx.putImageData(imageData, 0, 0);
    console.log("Background removal complete.");

    // Create THREE texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;

  } catch (error) {
    console.error("Error generating or processing cat image:", error);
    // Return a fallback texture
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 128;
    fallbackCanvas.height = 128;
    const fallbackCtx = fallbackCanvas.getContext('2d');
    fallbackCtx.fillStyle = 'magenta'; // Bright color to indicate error
    fallbackCtx.fillRect(0, 0, 128, 128);
    fallbackCtx.fillStyle = 'black';
    fallbackCtx.font = '16px sans-serif';
    fallbackCtx.textAlign = 'center';
    fallbackCtx.fillText('Error', 64, 64);
    const fallbackTexture = new THREE.CanvasTexture(fallbackCanvas);
    fallbackTexture.needsUpdate = true;
    return fallbackTexture;
  }
}

async function createCat() {
  const texture = await generateCatTexture();
  // Ensure texture is valid before creating material
   if (!texture) {
        console.error("Failed to create texture for cat.");
        return; // Skip creating this cat
   }
  const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true, // Enable transparency
      alphaTest: 0.1 // Don't render pixels with low alpha
    });
  const sprite = new THREE.Sprite(material);

  // Calculate aspect ratio to avoid distortion
  const aspect = (texture.image.width || 1) / (texture.image.height || 1);
  sprite.scale.set(config.catScale * aspect, config.catScale, config.catScale);

  const halfBounds = config.sceneBounds / 2;
  sprite.position.set(
    THREE.MathUtils.randFloat(-halfBounds, halfBounds),
    config.catScale / 2, // Position sprite slightly above ground
    THREE.MathUtils.randFloat(-halfBounds, halfBounds)
  );

  // Add custom properties for movement and state
  sprite.userData = {
    targetPosition: new THREE.Vector3().copy(sprite.position),
    isMoving: false,
    isPet: false,
    idleTime: Math.random() * 5, // Timer for idle actions
    animationPhase: Math.random() * Math.PI * 2, // For varied animation cycles
    baseY: config.catScale / 2, // Store the base Y position
    currentSpeed: config.movementSpeed * THREE.MathUtils.randFloat(0.8, 1.2) // Slightly vary speed
  };

  scene.add(sprite);
  cats.push(sprite);
}

async function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(config.backgroundColor);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 2, 5);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio); // Improve sharpness on high DPI screens
  sceneContainer.appendChild(renderer.domElement);

  // Add ground plane
  const groundGeometry = new THREE.PlaneGeometry(config.sceneBounds * 1.2, config.sceneBounds * 1.2); // Slightly larger ground
  const groundMaterial = new THREE.MeshStandardMaterial({ color: config.groundColor, side: THREE.DoubleSide });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0; // Place ground at y=0
  scene.add(ground);

  // Add lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(5, 10, 7.5);
  directionalLight.castShadow = false; // Disable shadows for performance if not needed
  scene.add(directionalLight);

  // Generate cats
  loadingText.textContent = `Generating ${config.numCats} cats... (0/${config.numCats})`;
  const catPromises = [];
  for (let i = 0; i < config.numCats; i++) {
    // Start generation in parallel but update text sequentially
    const promise = createCat().then(() => {
         const currentCount = cats.length;
         loadingText.textContent = `Generating ${config.numCats} cats... (${currentCount}/${config.numCats})`;
         console.log(`Cat ${currentCount}/${config.numCats} created.`);
    });
    catPromises.push(promise);
  }
  await Promise.all(catPromises); // Wait for all cats to be generated and added

  console.log("All cats generated.");
  loadingScreen.style.display = 'none'; // Hide loading screen

  // Event listeners
  window.addEventListener('resize', onWindowResize, false);
  sceneContainer.addEventListener('pointerdown', onPointerDown, false); // Use pointer events for broader compatibility
  sceneContainer.addEventListener('pointermove', onPointerMove, false);
  sceneContainer.addEventListener('pointerup', onPointerUp, false);
  sceneContainer.addEventListener('pointerleave', onPointerUp, false); // Treat leaving the area as pointer up


  animate();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateMousePosition(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function onPointerDown(event) {
    if (event.isPrimary) { // Only handle primary pointer (e.g., left mouse, first touch)
        updateMousePosition(event.clientX, event.clientY);
        handleInteractionStart();
        sceneContainer.style.cursor = 'grabbing';
    }
}

function onPointerMove(event) {
  if (event.isPrimary && isPetting && selectedCat) {
    updateMousePosition(event.clientX, event.clientY);
    handleInteractionMove();
  }
}

function onPointerUp(event) {
    if (event.isPrimary) {
        handleInteractionEnd();
        sceneContainer.style.cursor = 'grab';
    }
}


function handleInteractionStart() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(cats);

  if (intersects.length > 0) {
    const intersectedCat = intersects[0].object;
    const distance = camera.position.distanceTo(intersectedCat.position); // Check distance from camera

    // Use config.pettingDistance as the max range
    if (distance < config.pettingDistance) {
      selectedCat = intersectedCat;
      selectedCat.userData.isPet = true;
      isPetting = true;
      selectedCat.userData.isMoving = false; // Stop moving when petted
      console.log("Petting started");
    } else {
         console.log("Cat too far to pet:", distance.toFixed(2), "max:", config.pettingDistance);
    }
  }
}

function handleInteractionMove() {
    // This function is called while dragging/moving the pointer while petting.
    // Could add more interactive feedback here if desired.
    if (selectedCat) {
        // Maybe check raycaster again to see if pointer is still over the cat?
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects([selectedCat]); // Only check the selected cat
        if (intersects.length === 0) {
            // Pointer moved off the cat, stop petting
            // handleInteractionEnd();
            // Or keep petting until pointer up, depending on desired feel.
        }
    }
}

function handleInteractionEnd() {
  if (selectedCat) {
    selectedCat.userData.isPet = false;
    // Restore scale or other properties if changed during petting
    // selectedCat.scale.set(config.catScale, config.catScale, config.catScale);
    console.log("Petting ended");
  }
  selectedCat = null;
  isPetting = false;
}


function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const elapsedTime = clock.getElapsedTime();

  cats.forEach(cat => {
    const userData = cat.userData;
    userData.animationPhase += delta; // Increment phase regardless of state

    if (userData.isPet) {
       // Petting animation: wiggle and bounce slightly faster
       cat.rotation.z = Math.sin(userData.animationPhase * config.pettingAnimationSpeed) * config.pettingAnimationWiggle;
       cat.position.y = userData.baseY + Math.sin(userData.animationPhase * config.pettingAnimationSpeed * 1.5) * config.idleAnimationHeight * 0.5;
    } else {
       cat.rotation.z = 0; // Reset rotation

      if (!userData.isMoving) {
        // Idle behavior: gentle bounce, check if should move
        cat.position.y = userData.baseY + Math.sin(userData.animationPhase * config.idleAnimationSpeed + userData.idleTime) * config.idleAnimationHeight; // Add idleTime offset

        // Randomly decide to move
        if (Math.random() < config.randomMoveProbability) {
          const halfBounds = config.sceneBounds / 2;
          userData.targetPosition.set(
            THREE.MathUtils.randFloat(-halfBounds, halfBounds),
            userData.baseY,
            THREE.MathUtils.randFloat(-halfBounds, halfBounds)
          );
          userData.isMoving = true;
          userData.currentSpeed = config.movementSpeed * THREE.MathUtils.randFloat(0.8, 1.2); // Pick new speed
          console.log("Cat starting to move to", userData.targetPosition.x.toFixed(1), userData.targetPosition.z.toFixed(1));
        }
      } else {
        // Move towards target position
        const direction = new THREE.Vector3().subVectors(userData.targetPosition, cat.position);
        direction.y = 0; // Move only on the XZ plane
        const distanceToTarget = direction.length();

        if (distanceToTarget > 0.1) { // Check if close enough to target
            const moveDistance = userData.currentSpeed * delta;
            // Check if moveDistance would overshoot the target
            if (moveDistance >= distanceToTarget) {
                cat.position.copy(userData.targetPosition); // Snap to target
                userData.isMoving = false;
                cat.position.y = userData.baseY; // Reset height precisely
                 console.log("Cat reached target");
            } else {
                 direction.normalize();
                 cat.position.add(direction.multiplyScalar(moveDistance));

                // Walking animation (vertical bounce)
                cat.position.y = userData.baseY + Math.abs(Math.sin(userData.animationPhase * config.walkingAnimationSpeed)) * config.walkingAnimationHeight;
            }

        } else {
          userData.isMoving = false; // Reached target
          cat.position.y = userData.baseY; // Reset height
          userData.idleTime = elapsedTime; // Reset idle timer offset
          console.log("Cat reached target (close enough)");
        }
      }
    }
     // Sprites inherently face the camera, no need for lookAt for SpriteMaterial
     // cat.lookAt(camera.position); // Only needed for Mesh objects usually
  });

  renderer.render(scene, camera);
}

// Check for WebSim capabilities before initializing
if (typeof websim !== 'undefined' && websim.imageGen && websim.chat) {
    init().catch(err => {
        console.error("Initialization failed:", err);
        loadingText.textContent = "Error loading. Please try refreshing.";
        loadingScreen.style.backgroundColor = 'rgba(150, 0, 0, 0.8)'; // Error indication
    });
} else {
    loadingText.textContent = "Required AI capabilities not available. Cannot load.";
    console.error("WebSim capabilities (imageGen, chat) not found.");
     loadingScreen.style.backgroundColor = 'rgba(150, 0, 0, 0.8)'; // Error indication
}

