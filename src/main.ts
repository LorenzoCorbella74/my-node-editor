import './style.css'


const cellSize = 25;

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

// https://stackoverflow.com/a/8876069
canvas.width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
canvas.height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

const viewportTransform = {
  x: 0,
  y: 0,
  scale: 1
}

type Rect = {
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  selected?: boolean
}

// We need to keep track of our previous mouse position for later
let previousX = 0;
let previousY = 0;

let selectObjX = 0;
let selectObjY = 0;

let objs: Rect[] = [];

const addObj = (x: number, y: number, width: number, height: number, color: string) => {
  objs.push({ x, y, width, height, color })
  render()
}

const drawRect = (x: number, y: number, width: number, height: number, color: string, selected = false) => {
  ctx.fillStyle = color
  if (selected) {
    ctx.strokeStyle = 'orange'
    ctx.lineWidth = 2
  } else {
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 1
  }
  ctx.fillRect(x, y, width, height)
  ctx.strokeRect(x, y, width, height)
}

const drawGrid = () => {
  /* Style of the grid line */
  ctx.strokeStyle = "rgb(229,231,235)";
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

const render = () => {
  // New code 👇
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid()
  ctx.setTransform(viewportTransform.scale, 0, 0, viewportTransform.scale, viewportTransform.x, viewportTransform.y);
  // New Code 👆


  for (let obj of objs) {
    drawRect(obj.x, obj.y, obj.width, obj.height, obj.color, obj.selected)
  }

}


const updateSelection = (x: number, y: number) => {
  x = (x - viewportTransform.x) / viewportTransform.scale
  y = (y - viewportTransform.y) / viewportTransform.scale
  for (let obj of objs) {
    if (x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height) {
      obj.selected = true
    } else {
      obj.selected = false
    }
  }
  render()
}

const updatePanning = (e: any) => {
  const localX = e.clientX;
  const localY = e.clientY;
  viewportTransform.x += localX - previousX;
  viewportTransform.y += localY - previousY;
  previousX = localX;
  previousY = localY;
}

const updateSelectedObjPosition = (selectedObj:Rect, { x, y }: any) => {
  selectedObj.x += (x - selectObjX) / viewportTransform.scale;
  selectedObj.y += (y - selectObjY) / viewportTransform.scale;
  selectObjX = x;
  selectObjY = y;
}

const updateZooming = (e: any) => {

  const oldScale = viewportTransform.scale;
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

const onMouseMove = (e: any) => {
  if (e.ctrlKey) {
    let selectedObj = objs.find(obj => obj.selected)
    if (selectedObj) {
      updateSelectedObjPosition(selectedObj, e)
    }
  } else {
    updatePanning(e)
  }
  render()
}

const onMouseWheel = (e: any) => {
  updateZooming(e)
  render()
}

canvas.addEventListener("wheel", onMouseWheel);

canvas.addEventListener("mousedown", (e) => {

  // previous mouse pos for panning
  previousX = e.clientX;
  previousY = e.clientY;

  // previous mouse pos for object selection
  selectObjX = e.clientX;
  selectObjY = e.clientY;

  updateSelection(e.clientX, e.clientY)

  canvas.addEventListener("mousemove", onMouseMove);
})

canvas.addEventListener("mouseup", (e: any) => {
  canvas.removeEventListener("mousemove", onMouseMove);
})


canvas.addEventListener('dblclick', (e) => {
  // add an object inside the canvas grid using the mouse position
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) - viewportTransform.x) / viewportTransform.scale;
  const y = ((e.clientY - rect.top) - viewportTransform.y) / viewportTransform.scale;
  addObj(x, y, 50, 50, 'green',)
  console.log('doubleclick', e)
})



addObj(0, 0, 50, 50, 'red')
addObj(100, 100, 50, 50, 'blue')


render()
// ``

