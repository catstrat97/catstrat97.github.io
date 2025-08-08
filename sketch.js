let bgImgs = [];

// Settings object for dat.GUI
const settings = {
  rows: 4,
  baseCols: 4,
  waveExponent: 1,
  offsetMode: 'symmetrical', // 'symmetrical' | 'left' | 'right' | 'random'
  offsetMultiplier: 0,       // Controls offset amount
  colorVariant: 'white'      // 'white' | 'golden brown' | 'red' | 'black' | 'random alternating'
};

let baseAspect = 4 / 3;
let guiWidth = 300;
let canvasContainer;

const colorMap = {
  white: [255, 255, 255],
  'golden brown': [181, 101, 29],
  red: [171, 0, 17],
  black: [0, 0, 0]
};

function preload() {
  for (let i = 1; i <= 3; i++) {
    let path = `${i}.jpg`;
    bgImgs.push(loadImage(path));
  }
}

function setup() {
  canvasContainer = createDiv();
  canvasContainer.style('position', 'absolute');
  canvasContainer.style('top', '0');
  canvasContainer.style('left', `${guiWidth}px`);
  canvasContainer.style('z-index', '-1');

  let usableWidth = windowWidth - guiWidth;
  let usableHeight = windowHeight;
  let targetWidth = usableWidth;
  let targetHeight = usableWidth / baseAspect;

  if (targetHeight > usableHeight) {
    targetHeight = usableHeight;
    targetWidth = usableHeight * baseAspect;
  }

  let cnv = createCanvas(targetWidth, targetHeight);
  cnv.parent(canvasContainer);
  noStroke();

  // dat.GUI setup
  let gui = new dat.GUI({ width: guiWidth - 20 });
  gui.domElement.style.position = 'fixed';
  gui.domElement.style.top = '0px';
  gui.domElement.style.left = '0px';
  gui.domElement.style.background = 'rgba(30,30,30,0.9)';
  gui.domElement.style.padding = '10px';
  gui.domElement.style.color = '#fff';

  gui.add(settings, 'rows', 1, 24, 1).name('Rows');
  gui.add(settings, 'baseCols', 1, 24, 1).name('Base Columns');
  gui.add(settings, 'waveExponent', 1, 6, 0.1).name('Wave Exponent');

  // Offset mode controls
  let offsetFolder = gui.addFolder('Offset');
  offsetFolder.add(settings, 'offsetMode', ['symmetrical', 'left', 'right', 'random'])
              .name('Offset Mode')
              .onChange(() => {
                randomSeed(99);
              });
  offsetFolder.open();

  // Offset multiplier control
  let offsetSettingsFolder = gui.addFolder('Offset Settings');
  offsetSettingsFolder.add(settings, 'offsetMultiplier', 0, 1, 0.01)
                    .name('Offset Multiplier');
  offsetSettingsFolder.open();

  // Color variant controls
  let colorFolder = gui.addFolder('Colors');
  colorFolder.add(settings, 'colorVariant', ['white', 'golden brown', 'red', 'black', 'random alternating'])
            .name('Color Variant');
  colorFolder.open();
}

function draw() {
  background(0);

  // Background cycling (unchanged)
  // if (bgImgs.length > 0) {
  //   let speedBg = 0.08;
  //   let phaseBg = frameCount * speedBg;
  //   let raw = ((phaseBg % TWO_PI) + TWO_PI) % TWO_PI;
  //   let idx = floor((raw / TWO_PI) * bgImgs.length);
  //   idx = constrain(idx, 0, bgImgs.length - 1);
  //   image(bgImgs[idx], 0, 0, width, height);
  // } else {
  //   fill(50);
  //   rect(0, 0, width, height);
  // }

  const { rows, baseCols, waveExponent, offsetMode, offsetMultiplier, colorVariant } = settings;

  if (offsetMode === 'random') {
    randomSeed(99);
  }

  for (let i = 0; i < rows; i++) {
    let cols = baseCols + i;
    let cellW = width / cols;
    let cellH = height / rows;
    let half = floor(cols / 2);

    for (let j = 0; j < cols; j++) {
      let isCenter = (cols % 2 !== 0 && j === half);

      // Calculate offset
      let offset;
      switch (offsetMode) {
        case 'left':
          offset = j * offsetMultiplier;
          break;
        case 'right':
          offset = (cols - 1 - j) * offsetMultiplier;
          break;
        case 'random':
          offset = random(-PI, PI) * offsetMultiplier;
          break;
        case 'symmetrical':
        default:
          let m = (j < half) ? j : (cols - 1 - j);
          offset = m * offsetMultiplier;
      }

      // Wave calculation
      let wave = sin(frameCount * 0.05 + offset);
      let poweredWave = Math.sign(wave) * pow(abs(wave), waveExponent);
      let rectW = constrain(map(poweredWave, -1, 1, 0, cellW), 0, cellW);

      // Calculate position x,y
      let x, y = i * cellH;

      if (offsetMode === 'left') {
        x = j * cellW;
      } else if (offsetMode === 'right') {
        x = (j + 1) * cellW - rectW;
      } else if (isCenter) {
        x = j * cellW + (cellW - rectW) / 2;
      } else if (j < half) {
        x = j * cellW;
      } else {
        x = (j + 0.99) * cellW - rectW;
      }

      // Determine fill color
      let fillColor;
      if (colorVariant === 'random alternating') {
        // Cycle colors by row alternating
        let colors = ['white', 'golden brown', 'red', 'black'];
        fillColor = colorMap[colors[i % colors.length]];
      } else {
        fillColor = colorMap[colorVariant];
      }

      fill(fillColor[0], fillColor[1], fillColor[2]);
      rect(x, y, rectW, cellH);
    }
  }
}

function keyPressed() {
  if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
    setTimeout(resizeCanvasToFit, 200); // delay resize for fullscreen
  }
}

function windowResized() {
  resizeCanvasToFit();
}

function resizeCanvasToFit() {
  let usableWidth = windowWidth - guiWidth;
  let usableHeight = windowHeight;

  let targetWidth = usableWidth;
  let targetHeight = usableWidth / baseAspect;

  if (targetHeight > usableHeight) {
    targetHeight = usableHeight;
    targetWidth = usableHeight * baseAspect;
  }

  resizeCanvas(targetWidth, targetHeight);
}
