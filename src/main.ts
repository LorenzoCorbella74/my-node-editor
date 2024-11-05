import { Connection, Node } from './models';
import './style.css'

const cellSize = 25;

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

// Funzione per aggiornare le dimensioni del canvas
const resizeCanvas = () => {
  // https://stackoverflow.com/a/8876069
  canvas.width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0) * window.devicePixelRatio;
  canvas.height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0) * window.devicePixelRatio;
}

resizeCanvas();

const viewportTransform = {
  x: 0,
  y: 0,
  scale: 1
}

//  previous mouse position for later
let previousX = 0;
let previousY = 0;
let selectObjX = 0;
let selectObjY = 0;

let nodes: Node[] = [];

let connections: Connection[] = [];
let temporaryConnection: Connection | null;
let tempStartRect: Node | null;


const themes = {
  light: {
    background: "#ffffff",
    backgroundGrid: "#f0f0f0",
    rectangleFill: "#add8e6",
    rectangleStroke: "#000000",
    rectangleSelected: "orange",
    rectangleSelectedStroke: "#D08770",
    connection: "#5E81AC",
    connectionSelected: "#D08770",
    connectionTemporary: "gray",
    text: "#000000"
  },
  dark: {
    background: "#333333",
    backgroundGrid: "#444444",
    rectangleFill: "#4682b4",
    rectangleStroke: "#ffffff",
    rectangleSelected: "orange",
    rectangleSelectedStroke: "#D08770f",
    connection: "#5E81AC",
    connectionSelected: "#D08770",
    connectionTemporary: "gray",
    text: "#ffffff"
  }
};

let currentTheme = themes.light;


const getMousePos = (evt: any) => {
  var rect = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top
  };
}

const addNode = (x: number, y: number, width: number, height: number) => {
  let id = Math.random().toString(36).substring(7);
  nodes.push({ id, x, y, width, height })
  draw()
}

const drawRect = (x: number, y: number, width: number, height: number, selected = false) => {
  if (selected) {
    ctx.fillStyle = currentTheme.rectangleSelected;
    ctx.strokeStyle = currentTheme.rectangleSelectedStroke;
    ctx.lineWidth = 2
  } else {
    ctx.fillStyle = currentTheme.rectangleFill;
    ctx.strokeStyle = currentTheme.rectangleStroke;
    ctx.lineWidth = 1
  }
  ctx.fillRect(x, y, width, height)
  ctx.strokeRect(x, y, width, height)
}

const drawGrid = () => {
  /* Style of the grid line */
  ctx.strokeStyle = currentTheme.backgroundGrid;
  canvas.style.backgroundColor = currentTheme.background;
  ctx.setLineDash([]);
  ctx.lineWidth = 1;

  ctx.beginPath();

  /* Vertical lines spanning the full width */
  for (
    /* Start the first line based on offsetX and scale */
    let x = ((viewportTransform.x / viewportTransform.scale) % cellSize) * viewportTransform.scale;
    x <= canvas.width;
    /* Cell size based on scale amount */
    x += cellSize * viewportTransform.scale
  ) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }

  /* Horizontal lines spanning the full height */
  for (
    /* Start the first line based on offsetY and scale */
    let y = ((viewportTransform.y / viewportTransform.scale) % cellSize) * viewportTransform.scale;
    y <= canvas.height;
    /* Cell size based on scale amount */
    y += cellSize * viewportTransform.scale
  ) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }

  /* Draw the lines (path) on the canvas */
  ctx.stroke();
}

const drawBezierCurveConnection = (from: Node, to: Node, isTemporary = false, selected = false) => {
  ctx.beginPath();
  ctx.setLineDash([]);
  ctx.strokeStyle = currentTheme.connection;
  ctx.lineWidth = 1
  if (isTemporary) {
    ctx.strokeStyle = 'gray'
    ctx.setLineDash([5, 10]);
  }
  ctx.moveTo(from.x + from.width, from.y + from.height / 2);
  ctx.bezierCurveTo(from.x + from.width + 50, from.y + from.height / 2, to.x - 50, to.y + to.height / 2, to.x, to.y + to.height / 2);
  ctx.stroke();
}

const createTemporaryConnection = (start: Node, { x, y }: { x: number, y: number }) => {
  x = (x - viewportTransform.x) / viewportTransform.scale
  y = (y - viewportTransform.y) / viewportTransform.scale
  tempStartRect = start
  if (start) {
    temporaryConnection = {
      id: 'temp',
      from: start,
      to: { id: 'temp', x, y, width: 1, height: 1 },
      isTemporary: true,
      selected: false
    }
  }
}

const draw = () => {
  // adjust canvas for panning and zooming
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid()
  ctx.setTransform(viewportTransform.scale, 0, 0, viewportTransform.scale, viewportTransform.x, viewportTransform.y);

  // draw Rects
  for (let obj of nodes) {
    drawRect(obj.x, obj.y, obj.width, obj.height, obj.selected)
  }
  // draw connections
  for (let connection of connections) {
    drawBezierCurveConnection(connection.from, connection.to)
  }
  // draw temporary connection
  if (temporaryConnection !== null && temporaryConnection?.from && temporaryConnection?.to) {
    drawBezierCurveConnection(temporaryConnection.from, temporaryConnection.to, true)
  }

  // Scala il contenuto per compensare la risoluzione aumentata
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

const isMouseInsideObj = (x: number, y: number) => {
  x = (x - viewportTransform.x) / viewportTransform.scale
  y = (y - viewportTransform.y) / viewportTransform.scale
  return nodes.find(obj => x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height)
}

const updateSelection = (x: number, y: number) => {
  x = (x - viewportTransform.x) / viewportTransform.scale
  y = (y - viewportTransform.y) / viewportTransform.scale
  for (let obj of nodes) {
    if (x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height) {
      obj.selected = true
    } else {
      obj.selected = false
    }
  }
  draw()
}

const updatePanning = ({ x, y }: { x: number, y: number }) => {
  viewportTransform.x += x - previousX;
  viewportTransform.y += y - previousY;
  previousX = x;
  previousY = y;
}

const updateSelectedObjPosition = (selectedObj: Node, { x, y }: { x: number, y: number }) => {
  selectedObj.x += (x - selectObjX) / viewportTransform.scale;
  selectedObj.y += (y - selectObjY) / viewportTransform.scale;
  selectObjX = x;
  selectObjY = y;
}

const updateZooming = (e: any) => {
  if (e.deltaY < 0) {
    canvas.style.cursor = "zoom-in";
  } else {
    canvas.style.cursor = "zoom-out";
  }
  const oldX = viewportTransform.x;
  const oldY = viewportTransform.y;
  const localX = e.clientX;
  const localY = e.clientY;
  const previousScale = viewportTransform.scale;

  // restrict scale
  let newScale = viewportTransform.scale + e.deltaY * -0.001;
  newScale = Math.min(Math.max(newScale, 0.5), 2);

  const newX = localX - (localX - oldX) * (newScale / previousScale);
  const newY = localY - (localY - oldY) * (newScale / previousScale);

  viewportTransform.x = newX;
  viewportTransform.y = newY;
  viewportTransform.scale = newScale;
}

const onMouseMoveHandler = (e: any) => {
  let mouse = getMousePos(e)
  // move object
  if (e.ctrlKey) {
    canvas.style.cursor = "move";
    let selectedObj = nodes.find(obj => obj.selected)
    if (selectedObj) {
      updateSelectedObjPosition(selectedObj, mouse)
    }
    // create temporary connection
  } else if (e.shiftKey) {
    canvas.style.cursor = "crosshair";
    let selectedObj = nodes.find(obj => obj.selected)
    if (selectedObj) {
      createTemporaryConnection(selectedObj, mouse)
    } else {
      temporaryConnection = null
    }
    // panning
  } else {
    canvas.style.cursor = "grab";
    updatePanning(mouse)
  }
  draw()
}

const onMouseWheelHandler = (e: any) => {
  if (e.ctrlKey) {
    e.preventDefault()
  }
  updateZooming(e)
  draw()
}

canvas.addEventListener("wheel", onMouseWheelHandler);

canvas.addEventListener("mousedown", (e) => {
  let {x,y} = getMousePos(e)
  // previous mouse pos for panning
  previousX = x;
  previousY = y;
  // previous mouse pos for object selection
  selectObjX = x;
  selectObjY = y;

  updateSelection(x, y)

  canvas.addEventListener("mousemove", onMouseMoveHandler);
})

canvas.addEventListener("mouseup", (e: any) => {
  let {x,y} = getMousePos(e)
  canvas.style.cursor = "default";
  if (e.shiftKey && temporaryConnection && tempStartRect) {
    temporaryConnection = null
    let endRect = isMouseInsideObj(x, y)
    if (endRect) {
      let id = Math.random().toString(36).substring(7);
      connections.push({id, from: tempStartRect, to: endRect, isTemporary: false, selected: false })
    }
  }
  canvas.removeEventListener("mousemove", onMouseMoveHandler);
  draw();
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete') {
    nodes = nodes.filter(obj => !obj.selected)
    connections = connections.filter(connection => !connection.from.selected && !connection.to.selected)
    draw()
  }
});

// TODO: add data to nodes
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  let { x, y } = getMousePos(e)
  let obj = isMouseInsideObj(x, y)
  if (obj) {
    prompt('Enter label')
    draw()
  }
});

canvas.addEventListener('dblclick', (e) => {
  let { x: mx, y: my } = getMousePos(e)
  let x = (mx - viewportTransform.x) / viewportTransform.scale
  let y = (my - viewportTransform.y) / viewportTransform.scale
  addNode(x, y, 50, 50)
})

window.addEventListener("resize", () => {
  resizeCanvas()
  draw()
});

document.getElementById("toggleTheme")?.addEventListener("click", () => {
  currentTheme = (currentTheme === themes.light) ? themes.dark : themes.light;
  draw();
});

addNode(0, 0, 50, 50)
addNode(100, 100, 50, 50)

draw()

