import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { Fn, log, normalLocal, vec4 , positionLocal, positionWorld,vec2,vec3,mix,smoothstep,cameraProjectionMatrix,
  uniform,distance,uv,texture,screenUV,modelViewMatrix,varying,float,cos,PI2} from "three/tsl";
import {
  BoxGeometry,
  Color,
  Mesh,
  NodeMaterial,
  PerspectiveCamera,
  Scene,
  WebGPURenderer,
} from "three/webgpu";
//import model from "../public/original.glb?url";
import * as Three from "three";
import { DRACOLoader } from "three/examples/jsm/Addons.js"; 
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import {Trail} from "./trail"

const sketch: Sketch<"webgpu"> = async ({
  wrap,
  canvas,
  width,
  height,
  pixelRatio,
}) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }

  const renderer = new WebGPURenderer({ canvas, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(new Color(0x000000), 1);
  await renderer.init();

  const raycaster = new Three.Raycaster();

  const camera = new PerspectiveCamera(50, width / height, 0.1, 1000);
  camera.position.set(0, 0, 14);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enableRotate = false;
  controls.enablePan = false;

  const stats = new Stats();
  document.body.appendChild(stats.dom);
  

  const scene = new Scene();
  //Start of the code
  //=================
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  const materials = [];
  const mouse = new Three.Vector3();
  const mouse2D = new Three.Vector2();
  const uMouse = uniform(mouse,'vec3');
  const trail = new Trail(width,height);
  let canv = trail.canvas;
  canv.style.position = 'absolute';
  canv.style.top = '0';
  canv.style.left = '0';
  canv.style.zIndex= '1000';
  canv.style.width = '300px';
  canv.style.height = `${500*height/width}px`;
  //document.body.appendChild(canv);

  const trailTexture = new Three.CanvasTexture(trail.getTexture());
  trailTexture.needsUpdate = true;
  trailTexture.flipY = false;

  let dummy = new Three.Mesh(new Three.PlaneGeometry(19,19),new Three.MeshBasicMaterial({color:0x00ff00}));
  

  document.addEventListener('mousemove',(e) => {
    let mouseX = (e.clientX/width)*2-1;
    let mouseY = (e.clientY/height)*2+1;
    raycaster.setFromCamera(new Three.Vector2(mouseX,mouseY),camera);
    const intersects = raycaster.intersectObjects([dummy]);
    mouse2D.set(e.clientX,e.clientY);
    if(intersects.length>0)
    {
      console.log(intersects[0].point);
      uMouse.value.copy(intersects[0].point);
    }
  });

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.load('original.glb',(gltf)=>{
    const model = gltf.scene;
    model.position.set(0,2,0);
    model.traverse((child) => {
      // We only want to affect the visible parts (Meshes).
      if(child instanceof Mesh)
      {
        // Create a new, blank NodeMaterial to write our custom shaders.
        let material = new NodeMaterial();
        // Keep references to the model's original textures.
        let texture1= child.material.map;// Usually the main color (albedo) map.
        let texture2 = child.material.emissiveMap;// The glow map.
        // A 'varying' is a variable passed from the vertex shader to the fragment shader.
        // We'll use this to pass our calculated screen UVs.
        let uvscreen = varying(vec2(0.,0.));
        // --- TSL Helper Functions ---

        // A function to create procedural colors, often used in demos.
        // const palette = Fn((t) => {
        //   const a = vec3(0.5,0.5,0.5);
        //   const b = vec3(0.5,0.5,0.5);
        //   const c = vec3(1.0,1.0,1.0);
        //   const d = vec3(0.00,0.10,0.20);
        //   return a.add(b.mul(cos(PI2.mul(c.mul(t).add(d)))));
        // });
        // A function to convert colors from sRGB to Linear space.
        // This is important for correct lighting and blending calculations.
        const sRGBTransferOETF = (color: any) => {
            const a = color.pow(0.41666).mul(1.055).sub(0.055);
            const b = color.mul(12.92);
            const factor = color.lessThanEqual(0.0031308);
            
            // This function now directly returns the final node from the chain of operations.
            return mix(a, b, factor); 
        };
        // --- Vertex Shader Logic (material.positionNode) ---
        // This code runs for every vertex in the model and determines its final position.
        material.positionNode = Fn(()=> {
          const pos = positionLocal;// Get the vertex's original position.
           // --- Calculate Screen-Space UVs ---
          // Project the 3D vertex position into 2D screen space (Normalized Device Coordinates).
          const ndc = cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(pos,1.)); //normalized device coordinates
          // Convert NDC (from -1 to +1) to UVs (from 0 to 1).
          uvscreen.assign(ndc.xy.div(ndc.w).add(1.).div(2.));
          // Invert the Y-axis to match the trail texture's orientation.
          uvscreen.y = uvscreen.y.oneMinus();
          // --- Apply Extrusion Effect ---
          // Sample the trail texture using our calculated screen UVs.
          // The '.r' gets the red channel (brightness, since it's a grayscale image).
          const extrude = texture(trailTexture,uvscreen).r;
          // Modify the vertex's Z position based on the trail's brightness.
          // Where the trail is bright (extrude=1), Z is unchanged. Where it's dark (extrude=0), Z is scaled down.
          pos.z.mulAssign(mix(0.03,1.,extrude));
          return pos; // Return the final, modified vertex position.
        })();
        // --- Fragment Shader Logic (material.colorNode) ---
        // This code runs for every pixel on the model's surface and determines its final color.
        material.colorNode = Fn(() => {
          const dist = distance(positionWorld,uMouse);
          // Sample the original textures, converting them to Linear space for correct mixing.
          const tt1 = sRGBTransferOETF(texture(texture1,uv()));
          const tt2 = sRGBTransferOETF(texture(texture2,uv()));
          // Sample the trail texture's brightness using the built-in screenUV.
          const extrude = texture(trailTexture,screenUV);
          // --- Multi-Layer Color Blending ---
          // Define 6 different color "layers" using channels from the original textures.
          let level0 = tt2.b; // Layer 0: Blue from emissive map
          let level1 = tt2.g; // Layer 1: Green from emissive map
          let level2 = tt2.r; // Layer 2: Red from emissive map
          let level3 = tt1.b; // Layer 3: Blue from main map
          let level4 = tt1.g; // Layer 4: Green from main map
          let level5 = tt1.r; // Layer 5: Red from main map
          // Start with the base layer.
          let final = level0;
          // Use the `extrude` value (trail brightness) to smoothly mix between layers.
          // As `extrude` goes from 0 to 1, we reveal each subsequent layer.
          final = mix(final,level1,smoothstep(0.,0.2,extrude));
          final = mix(final,level2,smoothstep(0.2,0.4,extrude));
          final = mix(final,level3,smoothstep(0.4,0.6,extrude));
          final = mix(final,level4,smoothstep(0.6,0.8,extrude));
          final = mix(final,level5,smoothstep(0.8,1,extrude));
          // This line would apply the procedural palette to the final grayscale value.
          // let finalCol = palette( final );
          
          // Return the final color as a vec4 (RGB + Alpha).
          //return vec4(vec3(finalCol),1);
          return vec4(vec3(final),1);
        })();
        child.material = material;
        materials.push(material);
      }
    });
    scene.add(model);
  })


  //=================

  wrap.render = ({ playhead }) => {
    
    trail.update(mouse2D);
    trailTexture.needsUpdate = true;
    controls.update();
    stats.update();
    renderer.render(scene, camera);
  };

  wrap.resize = ({ width, height }) => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  wrap.unload = () => {
    renderer.dispose();
  };
};

const settings: SketchSettings = {
  mode: "webgpu",
  // dimensions: [800, 800],
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: 6_000,
  playFps: 60,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
