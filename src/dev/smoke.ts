import * as THREE from 'three';
const canvas = document.getElementById('c') as HTMLCanvasElement;
const r = new THREE.WebGLRenderer({ canvas, antialias: true });
r.setSize(innerWidth, innerHeight, false);
r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
r.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x120d0a);
const cam = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100); cam.position.set(6, 6, 8); cam.lookAt(0, 0.5, 0);
const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.8 })); floor.position.y = -0.2; floor.receiveShadow = true; scene.add(floor);
const house = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 1.2), new THREE.MeshStandardMaterial({ color: 0xe8dcc0 })); house.position.y = 0.5; house.castShadow = true; scene.add(house);
const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.9, 4), new THREE.MeshStandardMaterial({ color: 0xa8743a, flatShading: true })); roof.position.y = 1.45; roof.rotation.y = Math.PI / 4; roof.castShadow = true; scene.add(roof);
const l = new THREE.PointLight(0xffb060, 60, 30, 2); l.position.set(-3, 4, 2); l.castShadow = true; scene.add(l);
scene.add(new THREE.HemisphereLight(0x8090ff, 0x201008, 0.5));
const t0 = performance.now(); let frames = 0;
function loop() { frames++; r.render(scene, cam); requestAnimationFrame(loop); }
loop();
setTimeout(() => console.warn('fps~' + (frames / ((performance.now() - t0) / 1000)).toFixed(1) + ' gl=' + r.getContext().getParameter(r.getContext().VERSION)), 1200);
