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

const selectionCanvas = document.createElement("canvas") as HTMLCanvasElement;
const selectionCtx = selectionCanvas.getContext('2d') as CanvasRenderingContext2D;

let colorMap: { [color: string]: number } = {};

// Funzione per aggiornare le dimensioni del canvas
const resizeCanvas = () => {
  // https://stackoverflow.com/a/8876069
  canvas.width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0) * window.devicePixelRatio;
  canvas.height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0) * window.devicePixelRatio;

  selectionCanvas.width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0) * window.devicePixelRatio;
  selectionCanvas.height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0) * window.devicePixelRatio;
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
    connectionSelected: "orange",
    connectionTemporary: "gray",
    text: "#000000"
  },
  dark: {
    background: "#333333",
    backgroundGrid: "#444444",
    rectangleFill: "#4682b4",
    rectangleStroke: "#ffffff",
    rectangleSelected: "orange",
    rectangleSelectedStroke: "#D08770",
    connection: "#5E81AC",
    connectionSelected: "orange",
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

const createUniqueColor = (id: number) => {
  const r = (id & 0xff0000) >> 16;
  const g = (id & 0x00ff00) >> 8;
  const b = id & 0x0000ff;
  let output = `rgb(${r}, ${g}, ${b})`;
  colorMap[output] = id;
  console.log("ColorMap:", colorMap);
  return output;
}

const addNode = (x: number, y: number, width: number, height: number) => {
  let id = Math.floor(Math.random() * 1000000);
  let color = createUniqueColor(id)
  nodes.push({ id, x, y, width, height, selectionColor: color, })
  draw()
}

const drawRect = ({ x, y, width, height, selected = false, selectionColor }: Node) => {
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
  console.log("x:", x, "y:", y, "width:", width, "height:", height);

  selectionCtx.fillStyle = selectionColor;
  selectionCtx.fillRect(x, y, width, height)
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

const drawBezierCurveConnection = ({ from, to, isTemporary = false, selected = false, selectionColor }: Connection) => {
  ctx.beginPath();
  ctx.setLineDash([]);
  ctx.strokeStyle = currentTheme.connection;
  ctx.lineWidth = 4
  if (isTemporary) {
    ctx.strokeStyle = 'gray'
    ctx.setLineDash([5, 10]);
  }
  if (selected) {
    ctx.lineWidth = 6;
    ctx.strokeStyle = currentTheme.connectionSelected;
  }
  ctx.moveTo(from.x + from.width, from.y + from.height / 2);
  ctx.bezierCurveTo(from.x + from.width + 50, from.y + from.height / 2, to.x - 50, to.y + to.height / 2, to.x, to.y + to.height / 2);
  ctx.stroke();

  selectionCtx.beginPath();
  ctx.setLineDash([]);
  selectionCtx.lineWidth = 6;
  selectionCtx.strokeStyle = selectionColor;
  selectionCtx.fillStyle = selectionColor;
  selectionCtx.moveTo(from.x + from.width, from.y + from.height / 2);
  selectionCtx.bezierCurveTo(from.x + from.width + 50, from.y + from.height / 2, to.x - 50, to.y + to.height / 2, to.x, to.y + to.height / 2);
  selectionCtx.stroke();
}

const createTemporaryConnection = (start: Node, { x, y }: Point) => {
  x = (x - viewportTransform.x) / viewportTransform.scale
  y = (y - viewportTransform.y) / viewportTransform.scale
  tempStartRect = start
  temporaryConnection = {
    selectionColor: currentTheme.connectionTemporary,
    id: 0,
    from: start,
    to: { id: 0, x, y, width: 1, height: 1, selectionColor: currentTheme.connectionTemporary },
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

/*   selectionCtx.setTransform(1, 0, 0, 1, 0, 0); */
  selectionCtx.setTransform(viewportTransform.scale, 0, 0, viewportTransform.scale, viewportTransform.x, viewportTransform.y);

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
  selectionCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

const isMouseInsideObj = (x: number, y: number) => {
  x = (x - viewportTransform.x) / viewportTransform.scale
  y = (y - viewportTransform.y) / viewportTransform.scale
  return nodes.find(obj => x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height)
}

const updateSelection = (x: number, y: number) => {
/*   let nx = (x - viewportTransform.x) / viewportTransform.scale
  let ny = (y - viewportTransform.y) / viewportTransform.scale
  console.log("nx:", nx, "ny:", ny); */

  // Ottieni il colore del pixel sul canvas invisibile
  const pixel = selectionCtx.getImageData(x, y, 1, 1).data;
  const color = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;

  // Identifica la figura
  let shapeID = colorMap[color];
  if (shapeID) {
    console.log("Figura selezionata con ID:", shapeID);
    nodes.forEach((node) => {
      if (node.id === shapeID) {
        node.selected = true;
      } else {
        node.selected = false;
      }
    });
    connections.forEach((connection) => {
      if (connection.id === shapeID) {
        connection.selected = true;
      } else {
        connection.selected = false;
      }
    });
  } else {
    console.log("Nessuna figura selezionata");
    nodes.forEach((node) => {
      node.selected = false;
    });
    connections.forEach((connection) => {
      connection.selected = false;
    });
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
      let id = Math.floor(Math.random() * 1000000);
      let color = createUniqueColor(id)
      connections.push({ id, from: tempStartRect, to: endRect, isTemporary: false, selected: false, selectionColor: color })
    }
  }
  canvas.removeEventListener("mousemove", onMouseMoveHandler);
  draw();
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete') {
    nodes = nodes.filter(obj => !obj.selected)
    connections = connections.filter(connection => !connection.from.selected && !connection.to.selected)

    connections = connections.filter(connection => !connection.selected);

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

