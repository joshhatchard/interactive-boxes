// ==============================
// Global Variables
// ==============================

let squares = []; // Array to hold all shape cells (squares) currently displayed on the canvas
let hueBase; // Base hue value used for dynamic background and color generation
let shapeImages = []; // Array to hold all shape image assets (square, circle, triangle, etc.)
let canvas; // Canvas object reference

// Sound assets
let bgMusic; // Background music
let splitSound, mergeSound, rotateSound, switchSound; // Sound effects for specific actions

// ==============================
// Preload assets (runs before setup)
// ==============================
function preload() {
  // Load and store image assets into the shapeImages array
  shapeImages.push(
    // Assets created by Joshua Hatchard (me)
    loadImage('assets/square1.png'),
    loadImage('assets/square3.png'),
    loadImage('assets/circle1.png'),
    loadImage('assets/circle2.png'),
    loadImage('assets/circle4.png'),
    loadImage('assets/triangle2.png')
  );

  // Load audio assets
  // Royalty free audio sourced from Pixabay
  // Audio created by HitsLab - Pixabay
  bgMusic = loadSound('audio/background.mp3');
  // Audio created by Rasool Assad - Pixabay
  splitSound = loadSound('audio/split.mp3');
  // Audio created by northern87 - Pixabay
  mergeSound = loadSound('audio/merge.mp3');
  // Audio created by abhicreates - Pixabay
  rotateSound = loadSound('audio/rotate.mp3');
  // Audio created by Universfield - Pixabay
  switchSound = loadSound('audio/switch.mp3');
}

// ==============================
// Setup (runs once at start)
// ==============================
function setup() {
  canvas = createCanvas(windowWidth, windowHeight); // Create full-window canvas
  canvas.elt.oncontextmenu = () => false; // Disable right-click context menu on canvas

  colorMode(HSB, 360, 100, 100); // Use Hue-Saturation-Brightness color mode
  noStroke(); // Disable outline strokes
  hueBase = random(360); // Pick a random hue base for the color palette

  // Start looping background music if it's loaded and not already playing
  if (bgMusic && !bgMusic.isPlaying()) {
    bgMusic.setVolume(0.3);
    bgMusic.loop();
  }

  // Initialize 2x2 grid of ShapeCells at depth 0
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      squares.push(new ShapeCell(i / 2, j / 2, 0.5, 0.5, 0));
    }
  }
}

// ==============================
// Main draw loop (runs every frame)
// ==============================
function draw() {
  background(hueBase, 80, 70); // Set dynamic HSB background color

  // Calculate size and position of the 2x2 grid
  let cellSize = min(width / 2, height / 2) - 40;
  let gridSize = cellSize * 2;
  let offsetX = (width - gridSize) / 2;
  let offsetY = (height - gridSize) / 2;

  // Sort squares so animating ones are drawn last (appear on top)
  let renderQueue = squares.slice().sort((a, b) => (a.animating ? 1 : 0) - (b.animating ? 1 : 0));

  // Draw each shape cell
  for (let cell of renderQueue) {
    cell.display(offsetX, offsetY, gridSize);
  }
}

// ==============================
// Helper function: Get cell under mouse
// ==============================
function getCellUnderMouse() {
  // Calculate grid dimensions and position
  let cellSize = min(width / 2, height / 2) - 20;
  let gridSize = cellSize * 2;
  let offsetX = (width - gridSize) / 2;
  let offsetY = (height - gridSize) / 2;

  // Return the first square that contains the current mouse position
  return squares.find(cell => cell.contains(mouseX, mouseY, offsetX, offsetY, gridSize)) || null;
}

// ==============================
// Mouse interaction: click to split or merge
// ==============================
function mousePressed() {
  let cell = getCellUnderMouse(); // Find clicked cell
  if (!cell) return;

  if (mouseButton === LEFT) {
    cell.startShrink(); // Left-click: split cell
  } else if (mouseButton === RIGHT) {
    attemptMerge(cell); // Right-click: try merging adjacent cells
  }
}

// ==============================
// Keyboard interaction: rotate or switch shapes
// ==============================
function keyPressed() {
  let cell = getCellUnderMouse(); // Find selected cell
  if (!cell) return;

  // Left/right arrow keys to switch shapes
  if (keyCode === LEFT_ARROW) {
    cell.cycleImage(-1);
  } else if (keyCode === RIGHT_ARROW) {
    cell.cycleImage(1);
  }
  // Up/down arrow keys to rotate
  else if (keyCode === UP_ARROW) {
    cell.startRotate(1); // Rotate clockwise
  } else if (keyCode === DOWN_ARROW) {
    cell.startRotate(-1); // Rotate counter-clockwise
  }
}

// ==============================
// Attempt to merge four adjacent cells into one
// ==============================
function attemptMerge(targetCell) {
  let depth = targetCell.depth;
  if (depth === 0) return; // Can't merge depth 0 cells

  // Get all cells at the same depth
  let sameLevelCells = squares.filter(c => c.depth === depth);

  // Calculate the parent's grid position and size
  let parentW = targetCell.rw * 2;
  let parentH = targetCell.rh * 2;
  let parentX = Math.floor(targetCell.rx / parentW) * parentW;
  let parentY = Math.floor(targetCell.ry / parentH) * parentH;

  // Find the group of 4 matching cells that form a square
  let group = sameLevelCells.filter(c =>
    c.rx >= parentX && c.rx < parentX + parentW &&
    c.ry >= parentY && c.ry < parentY + parentH &&
    c.rw === parentW / 2 && c.rh === parentH / 2
  );

  // If all 4 are present, animate and replace them with a parent cell
  if (group.length === 4) {
    for (let cell of group) {
      cell.animating = true;
      cell.animationType = 'shrinkForMerge';
      cell.animationStart = millis();
    }

    // Delay to allow shrink animation before merging
    setTimeout(() => {
      squares = squares.filter(c => !group.includes(c));
      let parent = new ShapeCell(parentX, parentY, parentW, parentH, depth - 1);
      parent.scale = 0.001; // Start tiny
      parent.animating = true;
      parent.animationType = 'grow';
      parent.animationStart = millis();
      squares.push(parent);

      if (mergeSound) mergeSound.play(); // Play merge sound
    }, 200);
  }
}

// ==============================
// ShapeCell class: Represents each individual shape
// ==============================
class ShapeCell {
  constructor(rx, ry, rw, rh, depth, colorOverride, rotation, shapeIndex) {
    this.rx = rx; // Relative X position (0 to 1)
    this.ry = ry; // Relative Y position
    this.rw = rw; // Relative width
    this.rh = rh; // Relative height
    this.depth = depth || 0; // Depth in hierarchy (used for splitting/merging)
    this.color = colorOverride || color(hueBase, 80, 70); // Assigned color
    this.rotation = rotation !== undefined ? rotation : random([0, HALF_PI, PI, PI + HALF_PI]); // Initial rotation
    this.shapeIndex = shapeIndex !== undefined ? shapeIndex : floor(random(shapeImages.length)); // Index of shape image

    this.scale = 1; // Scale for animation
    this.animating = false; // Whether the cell is currently animating
    this.animationType = null; // Type of animation ('shrink', 'grow', etc.)
    this.animationStart = 0; // Timestamp when animation started

    this.rotating = false; // Is the cell rotating?
    this.rotationFrom = this.rotation; // Start rotation angle
    this.rotationTo = this.rotation; // End rotation angle
    this.rotStart = 0; // Rotation start time

    this.nextShapeIndex = null; // For shape switching animation
  }

  // Render this shape cell
  display(offsetX, offsetY, gridSize) {
    // Handle rotation animation
    if (this.rotating) {
      let t = (millis() - this.rotStart) / 200;
      if (t >= 1) {
        this.rotation = this.rotationTo % TWO_PI;
        this.rotating = false;
      } else {
        this.rotation = lerp(this.rotationFrom, this.rotationTo, easeInOutCubic(t));
      }
    }

    // Convert relative coordinates to pixel positions
    let x = offsetX + this.rx * gridSize;
    let y = offsetY + this.ry * gridSize;
    let w = this.rw * gridSize;
    let h = this.rh * gridSize;
    let drawX = x + w / 2;
    let drawY = y + h / 2;

    // Highlight on hover
    let displayColor = this.color;
    if (this.contains(mouseX, mouseY, offsetX, offsetY, gridSize)) {
      let h = hue(this.color);
      let s = saturation(this.color);
      let b = brightness(this.color);
      displayColor = color(h, s, b - 10);
    }

    let currentScale = this.scale;

    // Handle different animations
    if (this.animating) {
      let elapsed = millis() - this.animationStart;
      let duration = 200;
      if (this.animationType === 'shrinkForChange' || this.animationType === 'growAfterChange') duration = 150;

      let amt = constrain(elapsed / duration, 0, 1);
      let eased = easeInOutCubic(amt);

      if (this.animationType === 'shrink') {
        currentScale = constrain(lerp(1, 0, eased), 0.001, 1);
        if (amt >= 1) this._completeShrink();
      } else if (this.animationType === 'grow') {
        currentScale = constrain(lerp(0, 1, eased), 0.001, 1);
        this.scale = currentScale;
        if (amt >= 1) this.animating = false;
      } else if (this.animationType === 'shrinkForChange') {
        currentScale = constrain(lerp(1, 0, eased), 0.001, 1);
        if (amt >= 1) {
          this.shapeIndex = this.nextShapeIndex;
          this.animationType = 'growAfterChange';
          this.animationStart = millis();
        }
      } else if (this.animationType === 'growAfterChange') {
        currentScale = constrain(lerp(0, 1, eased), 0.001, 1);
        this.scale = currentScale;
        if (amt >= 1) this.animating = false;
      } else if (this.animationType === 'shrinkForMerge') {
        currentScale = constrain(lerp(1, 0, eased), 0.001, 1);
        this.scale = currentScale;
        if (amt >= 1) this.animating = false;
      }
    }

    // Draw the shape
    push();
    translate(drawX, drawY); // Move origin to center of cell
    rotate(this.rotation); // Apply rotation
    imageMode(CENTER);
    tint(displayColor); // Tint the image with cell color

    let img = shapeImages[this.shapeIndex]; // Get shape image
    if (img) {
      let gap = 0.01 * gridSize;
      let size = min(w, h) - gap;
      image(img, 0, 0, size * currentScale, size * currentScale);
    } else {
      fill(displayColor);
      rect(-w / 2, -h / 2, w * currentScale, h * currentScale);
    }
    pop();
  }

  // Check if a point is inside this cell
  contains(px, py, offsetX, offsetY, gridSize) {
    let x = offsetX + this.rx * gridSize;
    let y = offsetY + this.ry * gridSize;
    let w = this.rw * gridSize;
    let h = this.rh * gridSize;
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }

  // Start shrinking animation to split the cell
  startShrink() {
    this.animating = true;
    this.animationType = 'shrink';
    this.animationStart = millis();
  }

  // Handle cell split completion
  _completeShrink() {
    squares = squares.filter(c => c !== this);
    let children = this._createChildren(); // Split into 4 smaller cells
    for (let child of children) {
      child.scale = 0.001;
      child.animating = true;
      child.animationType = 'grow';
      child.animationStart = millis();
      squares.push(child);
    }

    if (splitSound) splitSound.play(); // Play split sound
  }

  // Create 4 smaller cells from this one
  _createChildren() {
    if (this.depth >= 3) return [this]; // Max depth reached
    let halfW = this.rw / 2;
    let halfH = this.rh / 2;
    let d = this.depth + 1;
    return [
      new ShapeCell(this.rx, this.ry, halfW, halfH, d),
      new ShapeCell(this.rx + halfW, this.ry, halfW, halfH, d),
      new ShapeCell(this.rx, this.ry + halfH, halfW, halfH, d),
      new ShapeCell(this.rx + halfW, this.ry + halfH, halfW, halfH, d)
    ];
  }

  // Rotate the cell by 90 degrees in the given direction
  startRotate(direction) {
    if (this.rotating) return;
    this.rotating = true;
    this.rotationFrom = this.rotation;
    this.rotationTo = this.rotation + direction * HALF_PI;
    this.rotStart = millis();

    if (rotateSound) rotateSound.play();
  }

  // Animate switching to the next shape image
  cycleImage(direction) {
    if (this.animating) return;
    this.nextShapeIndex = (this.shapeIndex + direction + shapeImages.length) % shapeImages.length;
    this.animating = true;
    this.animationType = 'shrinkForChange';
    this.animationStart = millis();

    if (switchSound) switchSound.play();
  }
}

// ==============================
// Easing function for smooth animations
// ==============================
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2;
}

// ==============================
// Handle window resize event
// ==============================
function windowResized() {
  resizeCanvas(windowWidth, windowHeight); // Adjust canvas size dynamically
}
