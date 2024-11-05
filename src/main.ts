import { Connection, Node, Point } from './models';
import './style.css'

const CELL_SIZE = 25;
const NODE_WIDTH = 50;
const NODE_HEIGHT = 50;

const viewportTransform = {
  x: 0,
  y: 0,
  scale: 1
}

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

// Funzione per aggiornare le dimensioni del canvas
const resizeCanvas = () => {
  // https://stackoverflow.com/a/8876069
  canvas.width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0) * window.devicePixelRatio;
  canvas.height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0) * window.devicePixelRatio;
}

resizeCanvas();

//  previous mouse position for later
let previousX = 0;
let previousY = 0;
let prevSelectObjX = 0;
let prevSelectObjY = 0;

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

const drawRect = ({ x, y, width, height, selected = false }: Node) => {
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
  ctx.strokeStyle = currentTheme.backgroundGrid;
  canvas.style.backgroundColor = currentTheme.background;
  ctx.setLineDash([]);
  ctx.lineWidth = 1;

  ctx.beginPath();
  /* Vertical lines spanning the full width */
  for (
    let x = ((viewportTransform.x / viewportTransform.scale) % CELL_SIZE) * viewportTransform.scale;
    x <= canvas.width;
    x += CELL_SIZE * viewportTransform.scale
  ) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  /* Horizontal lines spanning the full height */
  for (
    let y = ((viewportTransform.y / viewportTransform.scale) % CELL_SIZE) * viewportTransform.scale;
    y <= canvas.height;
    y += CELL_SIZE * viewportTransform.scale
  ) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();
}

const drawBezierCurveConnection = ({ from, to, isTemporary = false, selected = false }: Connection) => {
  ctx.beginPath();
  ctx.setLineDash([]);
  ctx.strokeStyle = currentTheme.connection;
  ctx.lineWidth = 1
  if (isTemporary) {
    ctx.strokeStyle = 'gray'
    ctx.setLineDash([5, 10]);
  }
  if (selected) {
    ctx.strokeStyle = currentTheme.connectionSelected;
  }
  ctx.moveTo(from.x + from.width, from.y + from.height / 2);
  ctx.bezierCurveTo(from.x + from.width + 50, from.y + from.height / 2, to.x - 50, to.y + to.height / 2, to.x, to.y + to.height / 2);
  ctx.stroke();
}

const createTemporaryConnection = (start: Node, { x, y }: Point) => {
  x = (x - viewportTransform.x) / viewportTransform.scale
  y = (y - viewportTransform.y) / viewportTransform.scale
  tempStartRect = start
  temporaryConnection = {
    id: 'temp',
    from: start,
    to: { id: 'temp', x, y, width: 1, height: 1 },
    isTemporary: true,
    selected: false
  }
}

const draw = () => {
  // adjust canvas for panning and zooming
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid()
  ctx.setTransform(viewportTransform.scale, 0, 0, viewportTransform.scale, viewportTransform.x, viewportTransform.y);
  // draw Nodes
  for (let obj of nodes) {
    drawRect(obj)
  }
  // draw connections
  for (let connection of connections) {
    drawBezierCurveConnection(connection)
  }
  // draw temporary connection
  if (temporaryConnection !== null && temporaryConnection?.from && temporaryConnection?.to) {
    drawBezierCurveConnection(temporaryConnection)
  }
  // TODO: ??? Scala il contenuto per compensare la risoluzione aumentata
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

const updatePanning = ({ x, y }: Point) => {
  viewportTransform.x += x - previousX;
  viewportTransform.y += y - previousY;
  previousX = x;
  previousY = y;
}

const updateSelectedObjPosition = (selectedObj: Node, { x, y }: Point) => {
  selectedObj.x += (x - prevSelectObjX) / viewportTransform.scale;
  selectedObj.y += (y - prevSelectObjY) / viewportTransform.scale;
  prevSelectObjX = x;
  prevSelectObjY = y;
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
  let { x, y } = getMousePos(e)
  // previous mouse pos for panning
  previousX = x;
  previousY = y;
  // previous mouse pos for object selection
  prevSelectObjX = x;
  prevSelectObjY = y;

  updateSelection(x, y)

  canvas.addEventListener("mousemove", onMouseMoveHandler);
})

canvas.addEventListener("mouseup", (e: any) => {
  let { x, y } = getMousePos(e)
  canvas.style.cursor = "default";
  if (e.shiftKey && temporaryConnection && tempStartRect) {
    temporaryConnection = null
    let endRect = isMouseInsideObj(x, y)
    if (endRect) {
      let id = Math.random().toString(36).substring(7);
      connections.push({ id, from: tempStartRect, to: endRect, isTemporary: false, selected: false })
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
  addNode(x, y, NODE_WIDTH, NODE_HEIGHT)
})

window.addEventListener("resize", () => {
  resizeCanvas()
  draw()
});

document.getElementById("toggleTheme")?.addEventListener("click", () => {
  currentTheme = (currentTheme === themes.light) ? themes.dark : themes.light;
  draw();
});

addNode(0, 0, NODE_WIDTH, NODE_HEIGHT)
addNode(100, 100, NODE_WIDTH, NODE_HEIGHT)

draw()

