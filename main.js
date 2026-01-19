import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import gsap from 'gsap';

let scene, camera, renderer, instancedMesh, analyzer, clock;
let isPlaying = false;
let currentTrackIndex = 1;
const dummy = new THREE.Object3D();

// --- NEON CLUB SHADERS ---
const vertexShader = `
    varying vec3 vColor;
    varying float vGlow;
    uniform float uTime;
    uniform float uAudio;
    uniform int uMode;

    void main() {
        vColor = color;
        vec3 pos = position;

        // Reactive Glitch Logic
        float noise = sin(pos.y * 10.0 + uTime * 5.0) * uAudio * 2.0;
        pos.x += noise;
        
        vec4 mvPosition = instanceMatrix * vec4(pos, 1.0);
        vGlow = uAudio;
        gl_Position = projectionMatrix * modelViewMatrix * mvPosition;
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    varying float vGlow;
    void main() {
        // High-intensity neon bleed
        vec3 finalColor = vColor * (1.5 + vGlow * 8.0);
        gl_FragColor = vec4(finalColor, 0.9);
    }
`;

async function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 1000;

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('main-view'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const loader = new FontLoader();
    const font = await loader.loadAsync('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json');
    
    setupClubVisuals(font);
    animate();
}

function setupClubVisuals(font) {
    // 1. CLEAR TEXT (Readability Fix)
    const textGeo = new TextGeometry('AI LOUNGE\nAFTER DARK', { font, size: 50, height: 5, curveSegments: 12 });
    textGeo.center();
    const textMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 1 });
    const textMesh = new THREE.Mesh(textGeo, textMat);
    textMesh.name = "introText";
    scene.add(textMesh);

    // 2. THE VISUALIZER (Instanced Rings for DJ Vibe)
    const ringGeo = new THREE.TorusGeometry(100, 1, 16, 32);
    const ringMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uAudio: { value: 0 }, uMode: { value: 1 } },
        vertexShader, fragmentShader, transparent: true, blending: THREE.AdditiveBlending, vertexColors: true
    });

    const count = 500; // 500 massive neon rings
    instancedMesh = new THREE.InstancedMesh(ringGeo, ringMat, count);
    
    const colors = new Float32Array(count * 3);
    const c1 = new THREE.Color(0xbc00ff); // Purple
    const c2 = new THREE.Color(0x00f2ff); // Cyan

    for (let i = 0; i < count; i++) {
        const mix = c1.clone().lerp(c2, Math.random());
        colors[i * 3] = mix.r; colors[i * 3 + 1] = mix.g; colors[i * 3 + 2] = mix.b;
        
        // Arrange in a tunnel
        dummy.position.set(0, 0, i * -20);
        dummy.updateMatrix();
        instancedMesh.setMatrix(i, dummy.matrix);
    }
    ringGeo.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
    instancedMesh.visible = false;
    scene.add(instancedMesh);

    window.addEventListener('mousedown', startClubMode, { once: true });
}

function startClubMode() {
    isPlaying = true;
    const text = scene.getObjectByName("introText");
    
    // Dissolve text and bring in the club
    gsap.to(text.material, { opacity: 0, duration: 2 });
    gsap.to(camera.position, { z: 200, duration: 3, ease: "expo.out" });
    
    instancedMesh.visible = true;
    document.getElementById('ui-layer').style.display = 'flex';
    document.getElementById('click-hint').style.display = 'none';

    playTrack(currentTrackIndex);
}

function playTrack(index) {
    const audio = document.getElementById(`audio-${index}`);
    if (!analyzer) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = ctx.createMediaElementSource(audio);
        analyzer = ctx.createAnalyser();
        analyzer.fftSize = 512;
        source.connect(analyzer);
        analyzer.connect(ctx.destination);
    }
    audio.play();
    instancedMesh.material.uniforms.uMode.value = index;
}

window.switchTrack = function() {
    const oldAudio = document.getElementById(`audio-${currentTrackIndex}`);
    oldAudio.pause(); oldAudio.currentTime = 0;
    currentTrackIndex = (currentTrackIndex % 3) + 1;
    playTrack(currentTrackIndex);
};

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    
    if (instancedMesh && isPlaying) {
        instancedMesh.material.uniforms.uTime.value = time;
        const data = new Uint8Array(analyzer.frequencyBinCount);
        analyzer.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const level = avg / 45.0;
        
        instancedMesh.material.uniforms.uAudio.value = level;

        for (let i = 0; i < instancedMesh.count; i++) {
            const zPos = ((i * 20 + time * 100) % 2000) - 1000;
            const scale = 1 + (level * (i % 5 == 0 ? 2 : 0.5));
            
            dummy.position.set(
                Math.sin(time + i) * 50, 
                Math.cos(time + i) * 50, 
                zPos
            );
            dummy.rotation.z = time * 0.2 + (i * 0.01);
            dummy.scale.set(scale, scale, 1);
            dummy.updateMatrix();
            instancedMesh.setMatrix(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
    }
    renderer.render(scene, camera);
}

init();
