export const config = {
  numCats: 5, // Number of cats to generate
  catScale: 0.3, // Size of the cat sprites
  movementSpeed: 0.005, // Base speed of cat movement
  pettingDistance: 0.5, // Max distance for petting interaction
  idleAnimationSpeed: 0.01, // Speed of the idle bounce animation
  idleAnimationHeight: 0.01, // Height of the idle bounce animation
  walkingAnimationSpeed: 0.02, // Speed of the walking animation
  backgroundColor: '#87CEEB' // Sky blue background
};

export const config = {
  numCats: 5, // Number of cats to generate
  catScale: 0.5, // Size of the cat sprites
  movementSpeed: 0.5, // Base speed of cat movement (units per second)
  pettingDistance: 5, // Max distance from CAMERA for petting interaction
  idleAnimationSpeed: 5, // Speed factor of the idle bounce animation
  idleAnimationHeight: 0.02, // Height factor of the idle bounce animation
  walkingAnimationSpeed: 15, // Speed factor of the walking animation
  walkingAnimationHeight: 0.03, // Height factor of the walking animation
  pettingAnimationSpeed: 15, // Speed factor of the petting animation
  pettingAnimationWiggle: 0.1, // Wiggle amount during petting
  backgroundColor: '#87CEEB', // Sky blue background
  groundColor: '#90EE90', // Light green ground
  imageGenPrompt: "A cute, fluffy cat sitting, facing forward, photorealistic style, plain white background, full body shot",
  imageGenAspectRatio: "1:1",
  backgroundRemovalTolerance: 30, // Lower value = stricter white removal (0-255)
  randomMoveProbability: 0.01, // Chance per frame for an idle cat to start moving
  sceneBounds: 9, // Cats will try to stay within [-bounds/2, bounds/2] on x/z axes
};

