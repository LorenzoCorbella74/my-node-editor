import { Connection, ConnectionDirection, Node, NodeType, Point } from './models';
import './style.css'

const APP_VERSION = "0.1.0";
const CELL_SIZE = 25;
const NODE_WIDTH = 50;
const NODE_HEIGHT = 50;

let viewportTransform = {
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
    rectangleStroke: "#000000",
    rectangleSelected: "orange",
    rectangleSelectedStroke: "#D08770",
    connection: "#5E81AC",
    connectionSelected: "orange",
    connectionTemporary: "gray",
    text: "#000000",
    nodeColors: {
      'type-1': '#4A90E2',
      'type-2': '#7ED321',
      'type-3': '#add8e6',
      'type-4': '#D0021B'
    }
  },
  dark: {
    background: "#333333",
    backgroundGrid: "#444444",
    rectangleStroke: "#ffffff",
    rectangleSelected: "orange",
    rectangleSelectedStroke: "#D08770",
    connection: "#5E81AC",
    connectionSelected: "orange",
    connectionTemporary: "gray",
    text: "#ffffff",
    nodeColors: {
      'type-1': '#357ABD',
      'type-2': '#50E3C2',
      'type-3': '#FF8C42',
      'type-4': '#D9534F'
    }
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
  // console.log("ColorMap:", colorMap);
  return output;
}

const addNode = (x: number, y: number, width: number, height: number, color: string, label: string) => {
  let id = Math.floor(Math.random() * 1000000);
  let selectionColor = createUniqueColor(id);
  nodes.push({ id, x, y, width, height, selectionColor, color, label });
  draw();
};

const drawRect = ({ x, y, width, height, selected = false, selectionColor, color, label }: Node) => {
  ctx.beginPath();
  if (selected) {
    ctx.fillStyle = currentTheme.rectangleSelected;
    ctx.strokeStyle = currentTheme.rectangleSelectedStroke;
    ctx.lineWidth = 2
  } else {
    ctx.fillStyle = color;
    ctx.strokeStyle = currentTheme.rectangleStroke;
    ctx.lineWidth = 1
  }
  ctx.roundRect(x, y, width, height, 10)
  ctx.fill()
  ctx.stroke()

  // draw on invisivle canvas
  selectionCtx.fillStyle = selectionColor;
  selectionCtx.fillRect(x, y, width, height)

  if (label) {
    ctx.fillStyle = currentTheme.text;
    ctx.font = "12px Arial";
    ctx.fillText(label, x + 4, y - 6);
  }
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

const drawBezierCurveConnection = ({ from, to, isTemporary = false, selected = false, selectionColor, label, direction, dashed }: Connection) => {
  ctx.beginPath();
  const startX = from.x + from.width;
  const startY = from.y + from.height / 2;
  const endX = to.x;
  const endY = to.y + to.height / 2;

  const cp1X = startX + (endX - startX) / 2;
  const cp1Y = startY;
  const cp2X = endX - (endX - startX) / 2;
  const cp2Y = endY;

  ctx.lineWidth = 3;
  ctx.setLineDash([]);

  if (isTemporary) {
    ctx.strokeStyle = 'gray'
    ctx.setLineDash([5, 10]);
  }
  if (dashed) {
    ctx.setLineDash([5, 10]);
  }
  if (selected) {
    ctx.lineWidth = 5;
    ctx.strokeStyle = currentTheme.connectionSelected;
  }


  ctx.moveTo(startX, startY);
  ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
  ctx.strokeStyle = selected ? 'orange' : currentTheme.connection;
  ctx.stroke();

  // draw to invisible canvas
  selectionCtx.beginPath();
  selectionCtx.setLineDash([]);
  selectionCtx.lineWidth = 5;
  selectionCtx.strokeStyle = selectionColor;
  selectionCtx.fillStyle = selectionColor;
  selectionCtx.moveTo(startX, startY);
  selectionCtx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
  selectionCtx.stroke();
  selectionCtx.fill();

  if (direction !== 'none') {
    drawArrowhead(startX, startY, endX, endY, direction);
  }

  if (label) {
    ctx.fillStyle = currentTheme.text;
    ctx.font = "12px Arial";
    ctx.fillText(label, (startX + endX) / 2, (startY + endY) / 2);
  }
};

const drawArrowhead = (startX: number, startY: number, endX: number, endY: number, direction: 'AtoB' | 'BtoA' | 'both') => {
  const arrowLength = 10;
  if (direction === 'AtoB' || direction === 'both') {
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - arrowLength * Math.cos(- Math.PI / 6), endY - arrowLength * Math.sin(- Math.PI / 6));
    ctx.lineTo(endX - arrowLength * Math.cos(+ Math.PI / 6), endY - arrowLength * Math.sin(+ Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = currentTheme.connection;
    ctx.fill();
  }
  if (direction === 'BtoA' || direction === 'both') {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + arrowLength * Math.cos(- Math.PI / 6), startY + arrowLength * Math.sin(- Math.PI / 6));
    ctx.lineTo(startX + arrowLength * Math.cos(+ Math.PI / 6), startY + arrowLength * Math.sin(+ Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = currentTheme.connection;
    ctx.fill();
  }
};

const createTemporaryConnection = (start: Node, { x, y }: Point) => {
  x = (x - viewportTransform.x) / viewportTransform.scale
  y = (y - viewportTransform.y) / viewportTransform.scale
  tempStartRect = start
  temporaryConnection = {
    selectionColor: '',
    id: 0,
    from: start,
    to: { id: 0, x, y, width: 1, height: 1, selectionColor: '', color: '', label: '' },
    isTemporary: true,
    selected: false,
    label: '',
    direction: 'none',
    dashed: true
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
  const pixel = selectionCtx.getImageData(x, y, 1, 1).data;
  const color = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
  const shapeID = colorMap[color];
  if (!shapeID) {
    return null;
  } else {
    let foundNode = nodes.find(obj => obj.id === shapeID);
    let foundConnection = connections.find(obj => obj.id === shapeID);
    if (foundNode) {
      return { result: foundNode, type: 'node' };
    } else if (foundConnection) {
      return { result: foundConnection, type: 'connection' };
    }
  }
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

const createElementsFromImportedFile = (data: any) => {

  let n:Connection[] = []
  // restore references
  for (let i = 0; i < data.connections.length; i++) {
    const connection = data.connections[i];
    connection.from = data.nodes.find((node: any) => node.id === connection.from.id);
    connection.to = data.nodes.find((node: any) => node.id === connection.to.id);
    n.push(connection)
  }
  if (data.ver === APP_VERSION) {
    nodes = data.nodes;
    connections = n;
    viewportTransform = data.viewportTransform;
    currentTheme = data.currentTheme;
    colorMap = data.colorMap;
    resizeCanvas();
    draw();
  } else {
    console.log('Was not possible to import the file!')
  }
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
      // create connection
      let id = Math.floor(Math.random() * 1000000);
      let color = createUniqueColor(id)
      connections.push({
        id,
        from: tempStartRect,
        to: endRect.result as Node,
        isTemporary: false,
        selected: false,
        selectionColor: color,
        label: '',
        direction: 'none',
        dashed: false
      });
      nodes.forEach(node => node.selected = false)
    }
  }
  canvas.removeEventListener("mousemove", onMouseMoveHandler);
  draw();
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete') {
    // delete selected nodes and attached connections
    nodes = nodes.filter(obj => !obj.selected)
    connections = connections.filter(connection => !connection.from.selected && !connection.to.selected)
    // remove connections
    connections = connections.filter(connection => !connection.selected);

    draw()
  }
});

window.addEventListener("resize", () => {
  resizeCanvas()
  draw()
});

document.getElementById("sun-empty")!.style.display = "none";

document.querySelector(".btn-theme")?.addEventListener("click", () => {
  if (currentTheme === themes.light) {
    document.getElementById("sun-full")!.style.display = "none";
    document.getElementById("sun-empty")!.style.display = "block";
  } else {
    document.getElementById("sun-full")!.style.display = "block";
    document.getElementById("sun-empty")!.style.display = "none";
  }
  currentTheme = (currentTheme === themes.light) ? themes.dark : themes.light;
  draw();
});

document.querySelector(".btn-import")?.addEventListener("click", (e) => {
  e.preventDefault();
  let input = document.getElementById('file-input')!;
  input.onchange = e => {
    // getting a hold of the file reference
    var file = (e.target as any)?.files[0];
    // setting up the reader
    var reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    // here we tell the reader what to do when it's done reading...
    reader.onload = readerEvent => {
      let content = readerEvent.target?.result as string; // this is the content!
      try {
        createElementsFromImportedFile(JSON.parse(content));
      } catch (error) {
        console.log('Was not possible to import the file!')
      }
    }
  }
  input.click();
});

document.querySelector(".btn-download")?.addEventListener("click", (e) => {
  e.preventDefault();
  let output = {
    ver: APP_VERSION,
    date: new Date().toISOString(),
    viewportTransform: viewportTransform,
    nodes,
    connections,
    currentTheme,
    colorMap
  }
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(output));
  var dlAnchorElem = document.getElementById('downloadAnchorElem')!;
  dlAnchorElem.setAttribute("href", dataStr);
  let date = new Date();
  dlAnchorElem.setAttribute("download", `nodes_${date.toISOString()}.json`); // ``
  dlAnchorElem.click();
});

document.querySelector(".btn-trash")?.addEventListener("click", (e: any) => {
  e.preventDefault();
  nodes = [];
  connections = [];
  viewportTransform = {
    x: 0,
    y: 0,
    scale: 1
  }
  draw();
});

const showDialog = (callback: (title: string, direction: ConnectionDirection, dashed: boolean) => void) => {
  titleDialog.style.display = 'block';
  titleDialog.classList.remove('hide');
  titleDialog.classList.add('show');
  titleInput.value = currentElement?.label || '';
  titleInput.focus();
  if (currentElementType === 'connection') {
    (document.getElementById((currentElement as Connection).direction || 'none') as HTMLInputElement).checked = true;
    dashedInput.checked = (currentElement as Connection).dashed || false;
  }

  const onOk = () => {
    let direction: ConnectionDirection = 'none',
      dashed = false;
    if (currentElementType === 'connection') {
      direction = (document.querySelector('input[name="direction"]:checked') as HTMLInputElement).value as ConnectionDirection;
      dashed = (document.getElementById('style-dashed') as HTMLInputElement).checked;
    }
    titleDialog.classList.remove('show');
    titleDialog.classList.add('hide');
    setTimeout(() => {
      titleDialog.style.display = 'none';
    }, 500);
    if (currentElementType === 'connection') {
      callback(titleInput.value, direction, dashed);
    } else {
      callback(titleInput.value, 'none', false);
    }
    dialogOk.removeEventListener('click', onOk);
    dialogCancel.removeEventListener('click', onCancel);
    titleInput.value = ''; // clear input
    if (currentElementType === 'connection') {
      (document.getElementById('none')as HTMLInputElement).checked = true;
      dashedInput.checked = false;
    }
  };

  const onCancel = () => {
    titleDialog.classList.remove('show');
    titleDialog.classList.add('hide');
    setTimeout(() => {
      titleDialog.style.display = 'none';
    }, 500);
    dialogOk.removeEventListener('click', onOk);
    dialogCancel.removeEventListener('click', onCancel);
    titleInput.value = ''; // clear input
    if (currentElementType === 'connection') {
      directionInput.value = 'none';
      dashedInput.checked = false;
    }
  };

  dialogOk.addEventListener('click', onOk);
  dialogCancel.addEventListener('click', onCancel);
};

const contextMenu = document.getElementById('context-menu') as HTMLDivElement;
const nodeTypeMenu = document.getElementById('node-type-menu') as HTMLDivElement;
const contextCancel = document.getElementById('context-cancel') as HTMLLIElement;
const contextEdit = document.getElementById('context-edit') as HTMLLIElement;

const nodeType1 = document.getElementById('type-1') as HTMLLIElement;
const nodeType2 = document.getElementById('type-2') as HTMLLIElement;
const nodeType3 = document.getElementById('type-3') as HTMLLIElement;
const nodeType4 = document.getElementById('type-4') as HTMLLIElement;

const titleDialog = document.getElementById('title-dialog') as HTMLDivElement;
const onlyForConnection = document.getElementById('only-for-connection') as HTMLDivElement;
const titleInput = document.getElementById('title-input') as HTMLInputElement;
const directionInput = (document.querySelector('input[name="direction"]') as HTMLInputElement);
const dashedInput = (document.getElementById('style-dashed') as HTMLInputElement);
const dialogOk = document.getElementById('dialog-ok') as HTMLButtonElement;
const dialogCancel = document.getElementById('dialog-cancel') as HTMLButtonElement;

let currentElement: Node | Connection | null = null;
let currentElementType: 'node' | 'connection' | null = null;

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const { x, y } = getMousePos(e);
  const obj = isMouseInsideObj(x, y);

  // edit or delete action for NODES or CONNECTIONS
  if (obj) {
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    onlyForConnection.style.display = obj.type === 'connection' ? 'block' : 'none';

    // delete action
    contextCancel.onclick = () => {
      if (obj.type === 'node') {
        nodes = nodes.filter(node => node.id !== obj.result.id);
      } else {
        connections = connections.filter(connection => connection.id !== obj.result.id);
      }
      contextMenu.style.display = 'none';
      draw();
    };

    // edit action
    contextEdit.onclick = () => {
      contextMenu.style.display = 'none';
      currentElement = obj.result;
      currentElementType = obj.type as 'node' | 'connection';
      showDialog((title, direction, dashed) => {
        if (currentElement) {
          currentElement.label = title;
          if (currentElement.hasOwnProperty('direction')) {
            (currentElement as Connection).direction = direction;
            (currentElement as Connection).dashed = dashed;
          }
          draw();
        }
      });
    };
  } else {
    // ADD NODE via DROPDOWN MENU
    nodeTypeMenu.style.display = 'block';
    nodeTypeMenu.style.left = `${x}px`;
    nodeTypeMenu.style.top = `${y}px`;
    onlyForConnection.style.display = 'none';

    const addNodeOfType = (type: NodeType) => {
      const color = currentTheme.nodeColors[type];
      currentElement = null;
      currentElementType = 'node';
      showDialog((title) => {
        addNode(x, y, NODE_WIDTH, NODE_HEIGHT, color, title);
      });
      nodeTypeMenu.style.display = 'none';
    };

    nodeType1.onclick = () => addNodeOfType('type-1');
    nodeType2.onclick = () => addNodeOfType('type-2');
    nodeType3.onclick = () => addNodeOfType('type-3');
    nodeType4.onclick = () => addNodeOfType('type-4');
  }
});

document.addEventListener('click', () => {
  contextMenu.style.display = 'none';
  nodeTypeMenu.style.display = 'none';
});

draw()

