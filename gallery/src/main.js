import * as THREE from "three";
import "./styles.css";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { createGalleryTracker, createSender } from './tracking.js';

gsap.registerPlugin(SplitText);
const pageStarted = performance.now();
let trackingStorage;
try { trackingStorage = window.sessionStorage; } catch { trackingStorage = {getItem:()=>null,setItem:()=>{}}; }
const sendTracking = createSender({
  api: import.meta.env.VITE_API_URL || '', storage:trackingStorage,
  fetchEvent: (...args) => fetch(...args), uuid: () => crypto.randomUUID(),
  pathname: () => location.pathname
});
const tracking = createGalleryTracker({send:sendTracking});
sendTracking('page_view', {language:navigator.language.slice(0,100), viewport:`${innerWidth}x${innerHeight}`});
document.addEventListener('visibilitychange', () => document.hidden ? tracking.hide() : tracking.show());
window.addEventListener('pagehide', () => tracking.exit());
window.addEventListener('pageshow', event => { if (event.persisted) tracking.show(); });

const memories = [
  {
    "image": "bg1.jpg",
    "title": "Today, especially you",
    "copy": "Happy birthday, Krishna Priya. I wanted to make you something you could keep, so here’s a little corner of the internet made for you.",
    "palette": [
      "#fff9ed",
      "#f4d78c",
      "#efc8ca"
    ]
  },
  {
    "image": "g1.jpg",
    "title": "Flowers, just because",
    "copy": "A birthday deserves flowers. So do ordinary afternoons. I hope this year brings you plenty of both.",
    "palette": [
      "#fff5f2",
      "#ecc4cf",
      "#f4dfb3"
    ]
  },
  {
    "image": "bg4.jpg",
    "title": "A little filmy",
    "copy": "May there be days with perfect lighting, your favourite song, and a moment you wish you could replay.",
    "palette": [
      "#fff7eb",
      "#e7c390",
      "#e4c9c7"
    ]
  },
  {
    "image": "g2.jpg",
    "title": "The whole look",
    "copy": "There’s something lovely about the way you put a look together—the colours, the little details, all of it. I wanted this to have a little of that care too.",
    "palette": [
      "#fcf5ef",
      "#dfc5d0",
      "#f4d9aa"
    ]
  },
  {
    "image": "bg6.jpg",
    "title": "For the unplanned evenings",
    "copy": "Here’s to good food, one more photo, and plans that turn out better than anyone expected.",
    "palette": [
      "#fff6e7",
      "#e9c291",
      "#e5c9b8"
    ]
  },
  {
    "image": "bg5.jpg",
    "title": "Something worth dancing to",
    "copy": "I hope this year gives you reasons to celebrate before the next birthday comes around. Small wins deserve a favourite song too.",
    "palette": [
      "#fff5f2",
      "#ebc0c9",
      "#f3d88f"
    ]
  },
  {
    "image": "bg8.jpg",
    "title": "The wish you keep to yourself",
    "copy": "Whatever you’re hoping for when you blow out the candles, I hope this year brings you closer to it. That wish gets to stay yours.",
    "palette": [
      "#f9f5ef",
      "#e2cbd8",
      "#eee0b6"
    ]
  },
  {
    "image": "g3.jpg",
    "title": "A small confession",
    "copy": "I think you’re lovely, and I’d like to get to know you better. Making this was my slightly elaborate way of saying that. Happy birthday.",
    "palette": [
      "#fff7ee",
      "#edc6ca",
      "#efd296"
    ]
  }
];
const imageUrl = (name) => new URL(`../images/${name}`, import.meta.url).href;
const canvas = document.querySelector("#scene");
const kicker = document.querySelector("#active-kicker");
const title = document.querySelector("#active-title");
const copy = document.querySelector("#active-copy");
const intro = document.querySelector(".intro");
const captionText = document.querySelector(".caption-text");
const progress = document.querySelector(".wish-progress");
const ending = document.querySelector(".ending");
const scrollHint = document.querySelector("#scroll-hint");
const loading = document.querySelector(".loading-screen");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
// Keep cover cropping independently reversible without changing card geometry.
const preservePhotoProportions = true;
let galleryReady = false;
let captionVersion = 0;
let captionAnimation;
let captionSplits = [];

function clearTextReveal() {
  captionSplits.forEach(split => split.revert());
  captionSplits = [];
}

function revealCaption() {
  clearTextReveal();
  if (reducedMotion.matches) return;
  // Adapted from GreenSock's character reveal: https://codepen.io/GreenSock/pen/bGEqbaQ
  // Our existing virtual scroll selects wishes, so a document ScrollTrigger isn't needed.
  [title, copy].forEach((element, index) => {
    const isTitle = index === 0;
    captionSplits.push(SplitText.create(element, {
      type: "lines,words,chars",
      mask: "lines",
      linesClass: "reveal-line",
      charsClass: "reveal-char",
      autoSplit: true,
      aria: "auto",
      onSplit(self) {
        return gsap.from(self.chars, {
          duration: .6,
          ease: "circ.out",
          y: isTitle ? 80 : 24,
          stagger: isTitle ? .02 : { amount: .55 },
          delay: isTitle ? 0 : .12
        });
      }
    }));
  });
}

reducedMotion.addEventListener("change", () => {
  captionAnimation?.cancel();
  clearTextReveal();
});
for (let i = 0; i < memories.length; i++) {
  const mark = document.createElement("span");
  mark.setAttribute("aria-hidden", "true");
  progress.append(mark);
}
document.querySelector("#retry-load").addEventListener("click", () => window.location.reload());
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClear = false;
const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 220);
const scene = new THREE.Scene();
const loader = new THREE.TextureLoader();
const clock = new THREE.Clock();
const depthStep = 7.2;
const cameraLead = 9.8;
const bgScene = new THREE.Scene();
const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const bgUniforms = {
  uTime: { value: 0 },
  uVelocityIntensity: { value: 0 },
  uBackgroundColor: { value: new THREE.Color(memories[0].palette[0]) },
  uBlob1Color: { value: new THREE.Color(memories[0].palette[1]) },
  uBlob2Color: { value: new THREE.Color(memories[0].palette[2]) },
  uNoiseStrength: { value: 0.04 },
  uBlobRadius: { value: 0.65 },
  uBlobRadiusSecondary: { value: 0.65 * 0.78 },
  uBlobStrength: { value: 0.9 }
};
const nextBackgroundColor = new THREE.Color();
const nextBlob1Color = new THREE.Color();
const nextBlob2Color = new THREE.Color();
const currentTextColor = new THREE.Color();
bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  depthWrite: false, depthTest: false, uniforms: bgUniforms,
  vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
  fragmentShader: `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;
    uniform float uVelocityIntensity;
    uniform vec3 uBackgroundColor;
    uniform vec3 uBlob1Color;
    uniform vec3 uBlob2Color;
    uniform float uNoiseStrength;
    uniform float uBlobRadius;
    uniform float uBlobRadiusSecondary;
    uniform float uBlobStrength;
    float random(vec2 coord) { return fract(sin(dot(coord, vec2(12.9898,78.233)))*43758.5453123); }
    void main() {
      vec3 color=uBackgroundColor;
      float animTime=uTime*.28;
      vec2 blob1Center=vec2(.50+sin(animTime*1.000)*.13+sin(animTime*1.618)*.05,.48+cos(animTime*.794)*.09+cos(animTime*1.272)*.03);
      vec2 blob2Center=vec2(.35+cos(animTime*.927)*.11+cos(animTime*1.414)*.04,.55+sin(animTime*1.175)*.07+sin(animTime*.618)*.03);
      float blob1=smoothstep(uBlobRadius,0.0,distance(vUv,blob1Center));
      float blob2=smoothstep(uBlobRadiusSecondary,0.0,distance(vUv,blob2Center));
      vec3 blob1SoftColor=mix(uBlob1Color,uBackgroundColor,.35);
      vec3 blob2SoftColor=mix(uBlob2Color,uBackgroundColor,.35);
      color=mix(color,blob1SoftColor,blob1*uBlobStrength);
      color=mix(color,blob2SoftColor,blob2*uBlobStrength);
      color+=uVelocityIntensity*.10;
      float grain=random(vUv*vec2(1387.13,947.91))-.5;
      color+=grain*uNoiseStrength;
      color=clamp(color,0.0,1.0);
      gl_FragColor=vec4(color,1.0);
    }`
})));
const loadTexture = (memory, index) => {
  const texture = loader.load(imageUrl(memory.image), loaded => {
    if (preservePhotoProportions) {
      const imageAspect = loaded.image.width / loaded.image.height;
      const cardAspect = 3.25 / 4.35;
      // Sample a centred cover crop, preserving the original image proportions.
      loaded.repeat.set(Math.min(1, cardAspect / imageAspect), Math.min(1, imageAspect / cardAspect));
    }
    renderer.initTexture(loaded);
    if (index === 0) {
      requestAnimationFrame(() => {
        galleryReady = true;
        tracking.ready(performance.now() - pageStarted);
        tracking.view(1);
        document.body.classList.add("gallery-ready");
        document.querySelector(".story-shell").setAttribute("aria-busy", "false");
        loading.setAttribute("aria-hidden", "true");
        revealCaption();
      });
    }
  }, undefined, () => {
    if (index === 0) {
      document.querySelector("#loading-message").textContent = "The first photograph couldn’t load. Please try again.";
      document.querySelector("#retry-load").hidden = false;
    }
    console.warn(`Could not load birthday photograph: ${memory.image}`);
    tracking.error(index + 1);
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};
const createDepthMaterial = texture => new THREE.ShaderMaterial({
  transparent: true, depthWrite: true,
  uniforms: { uMap: {value: texture}, uUvScale: {value: texture.repeat}, uTime: {value: 0}, uVelocity: {value: 0}, uFocus: {value: 0}, uOpacity: {value: 1} },
  vertexShader: `
    varying vec2 vUv;
    uniform float uTime;
    uniform float uVelocity;
    uniform float uFocus;
    void main() {
      vUv=uv;
      vec3 p=position;
      float edge=abs(uv.x-.5)+abs(uv.y-.5);
      float lift=smoothstep(.95,.1,edge);
      p.z+=lift*uFocus*.38;
      p.z+=sin((uv.y+uTime*.18)*9.0)*.055*uVelocity;
      p.x+=(uv.y-.5)*.08*uVelocity;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
    }`,
  fragmentShader: `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uMap;
    uniform vec2 uUvScale;
    uniform float uFocus;
    uniform float uOpacity;
    void main() {
      vec2 photoUv=(vUv-.5)*uUvScale+.5;
      vec4 tex=texture2D(uMap,photoUv);
      float vignette=smoothstep(.92,.16,distance(vUv,vec2(.5)));
      tex.rgb*=.58+vignette*.38+uFocus*.34;
      gl_FragColor=vec4(tex.rgb,tex.a*uOpacity);
    }`
});
const cards = memories.map((memory,index) => {
  const material=createDepthMaterial(loadTexture(memory,index));
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(3.25,4.35,36,36),material);
  const side=index%2===0?-1:1;
  const layer=index%3;
  mesh.position.set(side*(.38+layer*.18),(layer-1)*.22,-index*depthStep);
  mesh.rotation.set(.035*side,-.105*side,.035*side);
  mesh.userData.baseX=mesh.position.x;
  mesh.userData.baseY=mesh.position.y;
  mesh.userData.baseRotY=mesh.rotation.y;
  mesh.userData.baseRotZ=mesh.rotation.z;
  scene.add(mesh);
  return mesh;
});
let targetScroll=0;
let scroll=0;
let previousScroll=0;
let velocity=0;
let activeIndex=-1;
let touchStartY=0;
const pointer=new THREE.Vector2();
function pushScroll(delta) { if (!galleryReady) return; targetScroll=THREE.MathUtils.clamp(targetScroll+delta,0,1); }
async function setCaption(index) {
  if (index === activeIndex) return;
  const firstCaption = activeIndex === -1;
  activeIndex = index;
  const version = ++captionVersion;
  captionAnimation?.cancel();
  if (!firstCaption && !reducedMotion.matches) {
    captionAnimation = captionText.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards", easing: "ease-out" });
    await captionAnimation.finished.catch(() => {});
    if (version !== captionVersion) return;
    captionAnimation.cancel();
  }
  progress.setAttribute("aria-valuenow", String(index + 1));
  progress.setAttribute("aria-valuetext", `Wish ${index + 1} of ${memories.length}`);
  [...progress.children].forEach((mark, i) => {
    mark.classList.toggle("is-active", i === index);
    mark.classList.toggle("is-past", i < index);
  });
  clearTextReveal();
  kicker.textContent = `Wish ${String(index + 1).padStart(2, "0")} / 08`;
  title.textContent = memories[index].title;
  copy.textContent = memories[index].copy;
  if (galleryReady) { revealCaption(); tracking.view(index + 1); }
}
document.querySelector("#read-again").addEventListener("click", () => {
  tracking.replay();
  targetScroll = 0;
  document.querySelector("#read-again").blur();
});
function updatePalette(progress) {
  const scaled=progress*(memories.length-1);
  const left=Math.floor(scaled);
  const right=Math.min(left+1,memories.length-1);
  const blend=scaled-left;
  const a=memories[left].palette;
  const b=memories[right].palette;
  bgUniforms.uBackgroundColor.value.set(a[0]).lerp(nextBackgroundColor.set(b[0]),blend);
  bgUniforms.uBlob1Color.value.set(a[1]).lerp(nextBlob1Color.set(b[1]),blend);
  bgUniforms.uBlob2Color.value.set(a[2]).lerp(nextBlob2Color.set(b[2]),blend);
  currentTextColor.copy(bgUniforms.uBackgroundColor.value);
  const luminance=currentTextColor.r*.2126+currentTextColor.g*.7152+currentTextColor.b*.0722;
  const bright=luminance>.68;
  document.documentElement.style.setProperty("--page-text",bright?"#2e2e2e":"#fff8ed");
  document.documentElement.style.setProperty("--page-muted",bright?"rgba(46,46,46,.72)":"rgba(255,247,232,.78)");
  document.documentElement.style.setProperty("--page-soft",bright?"rgba(46,46,46,.56)":"rgba(255,232,205,.72)");
  document.documentElement.style.setProperty("--page-shadow",bright?"0 18px 42px rgba(255,255,255,.18)":"0 18px 42px rgba(0,0,0,.65)");
}
function resize() {
  const {innerWidth:width,innerHeight:height}=window;
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  renderer.setSize(width,height);
  const mobile=width<720;
  cards.forEach((card,index)=>{
    const side=index%2===0?-1:1;
    card.scale.setScalar(mobile?.7:1);
    card.userData.baseX=mobile?0:side*(.38+(index%3)*.18);
    card.userData.baseY=mobile?0:(index%3-1)*.22;
  });
}
function animate() {
  requestAnimationFrame(animate);
  const time=clock.getElapsedTime();
  scroll+=(targetScroll-scroll)*.085;
  velocity+=((scroll-previousScroll)*135-velocity)*.14;
  previousScroll=scroll;
  const scaled=scroll*(memories.length-1);
  const cameraZ=cameraLead-scaled*depthStep;
  const focusIndex=THREE.MathUtils.clamp(Math.round(scaled),0,memories.length-1);
  const lookZ=cameraZ-11;
  const mobile=window.innerWidth<720;
  camera.position.set(mobile?pointer.x*.08:Math.sin(scaled*.72)*.42+pointer.x*.28,mobile?.05+pointer.y*.08:Math.sin(time*.2)*.22+pointer.y*.18,cameraZ);
  camera.lookAt(mobile?0:-.08,0,lookZ);
  setCaption(focusIndex);
  const introOpacity = 1 - THREE.MathUtils.smoothstep(scaled, .12, .65);
  intro.style.opacity = introOpacity;
  intro.setAttribute("aria-hidden", String(introOpacity === 0));
  const atEnd = scroll >= .995;
  if (atEnd && galleryReady) tracking.complete();
  ending.hidden = !atEnd;
  scrollHint.hidden = atEnd;
  updatePalette(scroll);
  bgUniforms.uTime.value=time;
  const velocityIntensity=THREE.MathUtils.clamp(Math.abs(velocity)/1.8,0,1);
  const depthProgress=scaled-Math.floor(scaled);
  bgUniforms.uVelocityIntensity.value+=(velocityIntensity-bgUniforms.uVelocityIntensity.value)*.1;
  bgUniforms.uBlobRadius.value=.65+depthProgress*.08;
  bgUniforms.uBlobRadiusSecondary.value=bgUniforms.uBlobRadius.value*.78;
  bgUniforms.uBlobStrength.value=.9+bgUniforms.uVelocityIntensity.value*.1;
  cards.forEach((card,index)=>{
    const depthDistance=cameraZ-card.position.z;
    const focus=THREE.MathUtils.clamp(1-Math.abs(depthDistance-cameraLead)/depthStep,0,1);
    const ahead=depthDistance>0;
    const visibleDepth=THREE.MathUtils.clamp((depthDistance+2)/28,0,1);
    const passedFade=THREE.MathUtils.clamp(depthDistance/2.2,0,1);
    const opacity=ahead?THREE.MathUtils.clamp((.18+focus*.82+visibleDepth*.18)*passedFade,0,1):0;
    const parallax=(index-scaled)*.04;
    card.material.uniforms.uTime.value=time+index*.3;
    card.material.uniforms.uVelocity.value=Math.min(Math.abs(velocity),2);
    card.material.uniforms.uFocus.value=focus;
    card.material.uniforms.uOpacity.value=opacity;
    card.position.x=card.userData.baseX+Math.sin(time*.24+index)*.06+parallax;
    card.position.y=card.userData.baseY+Math.cos(time*.19+index)*.04;
    card.rotation.y=card.userData.baseRotY+velocity*.08+(index-scaled)*.018;
    card.rotation.z=card.userData.baseRotZ+velocity*.045;
    card.renderOrder=index;
  });
  renderer.clear();
  renderer.render(bgScene,bgCamera);
  renderer.render(scene,camera);
}
window.addEventListener("resize",resize);
window.addEventListener("wheel",event=>{event.preventDefault();pushScroll(event.deltaY*.00042);},{passive:false});
window.addEventListener("touchstart",event=>{touchStartY=event.touches[0]?.clientY??0;});
window.addEventListener("touchmove",event=>{const y=event.touches[0]?.clientY??touchStartY;event.preventDefault();pushScroll((touchStartY-y)*.0014);touchStartY=y;},{passive:false});
window.addEventListener("keydown",event=>{
  if (event.target.closest("button, input, textarea, select, a") || event.ctrlKey || event.metaKey || event.altKey) return;
  if(["ArrowDown","PageDown"," "].includes(event.key)){event.preventDefault();pushScroll(.08);}
  if(["ArrowUp","PageUp"].includes(event.key)){event.preventDefault();pushScroll(-.08);}
});
window.addEventListener("pointermove",event=>{
  pointer.x+=(event.clientX/window.innerWidth-.5-pointer.x)*.18;
  pointer.y+=(-(event.clientY/window.innerHeight-.5)-pointer.y)*.18;
});
resize();
setCaption(0);
animate();
