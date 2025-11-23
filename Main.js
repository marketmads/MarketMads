import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";

let isMobile = window.innerWidth < 900 || /Android|iPhone/i.test(navigator.userAgent);

// ===== UI Control for PC/Mobile =====
if (!isMobile) {
  document.getElementById("joystick-base").classList.add("hidden");
  document.getElementById("radialButton").classList.add("hidden");
}

// ===== SCENE =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

// ===== PLAYER CAMERA HIERARCHY =====
const playerPivot = new THREE.Object3D();
playerPivot.position.set(0, 2, 5);
scene.add(playerPivot);

const cameraPivot = new THREE.Object3D();
playerPivot.add(cameraPivot);

const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);
cameraPivot.add(camera);

// ===== RENDERER =====
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Resize listener
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ===== LIGHT =====
scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.2));

// ===== TERRAIN =====
const groundGeo = new THREE.PlaneGeometry(60, 60, 20, 20);
groundGeo.rotateX(-Math.PI / 2);
for (let i = 0; i < groundGeo.attributes.position.count; i++){
  const x = groundGeo.attributes.position.getX(i);
  const z = groundGeo.attributes.position.getZ(i);
  const y = Math.sin(x*0.15)*0.3 + Math.cos(z*0.15)*0.3;
  groundGeo.attributes.position.setY(i,y);
}
const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color:0x3caa5b }));
scene.add(ground);

// ===== MOVEMENT =====
const keys = {};
window.addEventListener("keydown", e=>keys[e.code]=true);
window.addEventListener("keyup", e=>keys[e.code]=false);

function movePlayer(dt){
  const speed = 7 * dt;

  const forward = new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(0, playerPivot.rotation.y, 0));
  const right = new THREE.Vector3(1,0,0).applyEuler(new THREE.Euler(0, playerPivot.rotation.y, 0));

  playerPivot.position.addScaledVector(forward, joyValue.y * speed);
  playerPivot.position.addScaledVector(right, joyValue.x * speed);

  if(keys["Space"]) playerPivot.position.y += speed;
  if(keys["ShiftLeft"]) playerPivot.position.y -= speed;
}

// ===== CAMERA LOOK =====
document.body.addEventListener("click",()=>document.body.requestPointerLock());
let yaw=0,pitch=0;
window.addEventListener("mousemove",e=>{
  if(document.pointerLockElement===document.body){
    yaw -= e.movementX*0.002;
    pitch -= e.movementY*0.002;
    pitch = Math.max(-Math.PI/2,Math.min(Math.PI/2,pitch));
    playerPivot.rotation.y=yaw;
    cameraPivot.rotation.x=pitch;
  }
});

// ===== JOYSTICK =====
let joyActive=false, joyStart={x:0,y:0}, joyValue={x:0,y:0};
const base=document.getElementById("joystick-base");
const stick=document.getElementById("joystick-stick");

if(isMobile){
  base.addEventListener("touchstart",e=>{
    joyActive=true;
    const t=e.touches[0];
    joyStart.x=t.clientX; joyStart.y=t.clientY;
  });

  base.addEventListener("touchend",()=>{
    joyActive=false; joyValue.x=joyValue.y=0;
    stick.style.left="35px"; stick.style.top="35px";
  });

  base.addEventListener("touchmove",e=>{
    const t=e.touches[0];
    const dx=t.clientX-joyStart.x;
    const dy=t.clientY-joyStart.y;
    const dist=Math.sqrt(dx*dx+dy*dy);
    const max=50;
    const angle=Math.atan2(dy,dx);
    const d=Math.min(max,dist);
    const nx=Math.cos(angle)*d;
    const ny=Math.sin(angle)*d;
    joyValue.x=nx/max; joyValue.y=ny/max;
    stick.style.left=(35+nx)+"px";
    stick.style.top=(35+ny)+"px";
  });
}

// ===== TEXTURES =====
const loader = new THREE.TextureLoader();
function tex(p){
  const t=loader.load("textures/"+p);
  t.magFilter=THREE.NearestFilter;
  t.minFilter=THREE.NearestFilter;
  return t;
}

function grass() {
  return [
    new THREE.MeshStandardMaterial({ map:tex("grass_side.png") }),
    new THREE.MeshStandardMaterial({ map:tex("grass_side.png") }),
    new THREE.MeshStandardMaterial({ map:tex("grass_top.png") }),
    new THREE.MeshStandardMaterial({ map:tex("grass_bottom.png") }),
    new THREE.MeshStandardMaterial({ map:tex("grass_side.png") }),
    new THREE.MeshStandardMaterial({ map:tex("grass_side.png") }),
  ];
}

const blockTypes=[
  ()=>grass(),
  ()=>new THREE.MeshStandardMaterial({ map:tex("dirt.png") }),
  ()=>new THREE.MeshStandardMaterial({ map:tex("stone.png") }),
  ()=>new THREE.MeshStandardMaterial({ map:tex("wood.png") }),
  ()=>new THREE.MeshStandardMaterial({ map:tex("sand.png") }),
  ()=>new THREE.MeshStandardMaterial({ map:tex("glass.png"),transparent:true,opacity:0.55 })
];

let currentBlock=0;

// ===== BLOCK SYSTEM =====
const raycaster=new THREE.Raycaster();
const blocks=[];
const blockData=[];

const preview=new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true}));
preview.visible=false;
scene.add(preview);

function place(){
  if(!preview.visible)return;
  const b=new THREE.Mesh(new THREE.BoxGeometry(1,1,1), blockTypes[currentBlock]());
  b.position.copy(preview.position);
  scene.add(b); blocks.push(b);
  blockData.push({x:b.position.x,y:b.position.y,z:b.position.z,type:currentBlock});
  saveWorld();
}

function remove(){
  raycaster.set(playerPivot.position, camera.getWorldDirection(new THREE.Vector3()));
  const hit=raycaster.intersectObjects(blocks,false).filter(h=>h.distance<6);
  if(hit.length>0){
    const obj=hit[0].object;
    const i=blocks.indexOf(obj);
    if(i!==-1){ scene.remove(obj); blocks.splice(i,1); blockData.splice(i,1); saveWorld(); }
  }
}

window.addEventListener("mousedown",e=>{
  if(e.button===0)place();
  if(e.button===2)remove();
});

window.addEventListener("contextmenu",e=>e.preventDefault());
window.addEventListener("wheel",e=>{
  currentBlock=(currentBlock+(e.deltaY>0?1:-1)+blockTypes.length)%blockTypes.length;
});

// ===== SAVE / LOAD =====
function saveWorld(){
  localStorage.setItem("marketmads-world", JSON.stringify(blockData));
}
(function load(){
  const saved=JSON.parse(localStorage.getItem("marketmads-world")||"[]");
  for(const b of saved){
    const cube=new THREE.Mesh(new THREE.BoxGeometry(1,1,1), blockTypes[b.type]());
    cube.position.set(b.x,b.y,b.z);
    blocks.push(cube);
    blockData.push(b);
    scene.add(cube);
  }
})();

// ===== RADIAL HOTBAR =====
const radialMenu=document.getElementById("radialMenu");
const radialCtx=radialMenu.getContext("2d");
radialMenu.width=window.innerWidth;
radialMenu.height=window.innerHeight;
const radialBtn=document.getElementById("radialButton");
let radialOpen=false;
let blockNames=["Grass","Dirt","Stone","Wood","Sand","Glass"];
let selectedIndex=0;

radialBtn.addEventListener("touchstart",()=>{ radialOpen=true; drawRadial(); });
radialBtn.addEventListener("touchend",()=>{
  radialOpen=false;
  currentBlock=selectedIndex;
  radialCtx.clearRect(0,0,radialMenu.width,radialMenu.height);
});

function drawRadial(){
  radialCtx.clearRect(0,0,radialMenu.width,radialMenu.height);
  const cx=radialMenu.width-60;
  const cy=radialMenu.height-60;
  const r=160;
  const seg=(2*Math.PI)/blockNames.length;
  for(let i=0;i<blockNames.length;i++){
    let start=i*seg, end=start+seg;
    radialCtx.beginPath();
    radialCtx.moveTo(cx,cy);
    radialCtx.arc(cx,cy,r,start,end);
    radialCtx.closePath();
    radialCtx.fillStyle=(i===selectedIndex)?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.15)";
    radialCtx.fill();
    const tx=cx+Math.cos(start+seg/2)*110;
    const ty=cy+Math.sin(start+seg/2)*110;
    radialCtx.fillStyle="white"; radialCtx.font="20px Arial";
    radialCtx.fillText(blockNames[i], tx-30, ty+5);
  }
}

window.addEventListener("touchmove",e=>{
  if(radialOpen && e.touches.length===1){
    const t=e.touches[0];
    const cx=radialMenu.width-60;
    const cy=radialMenu.height-60;
    const dx=t.clientX-cx, dy=t.clientY-cy;
    let angle=Math.atan2(dy,dx);
    if(angle<0)angle+=Math.PI*2;
    const seg=(2*Math.PI)/blockNames.length;
    selectedIndex=Math.floor(angle/seg);
    drawRadial();
  }
});

// ===== GAME LOOP =====
const clock=new THREE.Clock();
function animate(){
  const dt=clock.getDelta();
  movePlayer(dt);

  raycaster.set(playerPivot.position, camera.getWorldDirection(new THREE.Vector3()));
  const hits=raycaster.intersectObjects([ground,...blocks],false).filter(h=>h.distance<6);

  if(hits.length>0){
    const hit=hits[0];
    const pos=hit.point.clone().add(hit.face.normal);
    preview.position.set(Math.round(pos.x),Math.round(pos.y),Math.round(pos.z));
    preview.visible=true;
  } else preview.visible=false;

  renderer.render(scene,camera);
  requestAnimationFrame(animate);
}
animate();
