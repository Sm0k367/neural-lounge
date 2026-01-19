import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import gsap from 'gsap';

let scene, camera, renderer, instancedMesh, analyzer, clock, audioCtx;
let isPlaying = false;
let currentTrackIndex = 1;
const dummy = new THREE.Object3D();

// --- HIGH-END CLUB SHADER ---
const vertexShader = `
    varying vec3 vColor;
    varying float vGlow;
    uniform float uTime;
    uniform float uAudio;
    void main() {
        vColor = color;
        vec3 pos = position;
        // The "420" Glitch: Shift rings based on frequency
        float drift = sin(uTime * 2.0 + instanceMatrix[3][2] * 0.05) * uAudio * 15.0;
        pos.x += drift;
        vec4 mvPosition = instanceMatrix * vec4(pos, 1.0);
        vGlow = uAudio;
        gl_Position = projectionMatrix * modelViewMatrix * mvPosition;
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    varying float vGlow;
    void main() {
        vec3 glow = vColor * (1.2 + vGlow * 12.0);
        gl_FragColor = vec4(glow, 0.85);
    }
`;

async function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 1200;

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('main-view'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const loader = new FontLoader();
    const font = await loader.loadAsync('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json');
    
    setupIntro(font);
    animate();
}

function setupIntro(font) {
    // Readability pass: Solid 3D Text
    const textGeo = new TextGeometry('AI LOUNGE\nAFTER DARK', { font, size: 50, height: 4, curveSegments: 12 });
    textGeo.center();
    const textMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 1 });
    const textMesh = new THREE.Mesh(textGeo, textMat);
    textMesh.name = "introText";
    scene.add(textMesh);

    // Prepare the Rings (Hidden initially)
    const ringGeo = new THREE.TorusGeometry(120, 1.5, 16, 40);
    const ringMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uAudio: { value: 0 } },
        vertexShader, fragmentShader, transparent: true, blending: THREE.AdditiveBlending, vertexColors: true
    });

    const count = 400;
    instancedMesh = new THREE.InstancedMesh(ringGeo, ringMat, count);
    const colors = new Float32Array(count * 3);
    const p1 = new THREE.Color(0xbc00ff);
    const p2 = new THREE.Color(0x00f2ff);

    for (let i = 0; i < count; i++) {
        const c = p1.clone().lerp(p2, Math.random());
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
        dummy.position.set(0, 0, i * -25);
        dummy.updateMatrix();
        instancedMesh.setMatrix(i, dummy.matrix);
    }
    ringGeo.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
    instancedMesh.visible = false;
    scene.add(instancedMesh);

    // CRITICAL: Bind the "Drop the Beat" to a broad window listener
    window.addEventListener('click', () => {
        if(!isPlaying) unlockAndPlay();
    }, { once: true });
}

async function unlockAndPlay() {
    isPlaying = true;
    
    // 1. Create AudioContext inside the user gesture
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    // 2. Clear UI and Reveal Visuals
    document.getElementById('click-hint').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex';
    
    const text = scene.getObjectByName("introText");
    gsap.to(text.material, { opacity: 0, duration: 1.5 });
    gsap.to(camera.position, { z: 250, duration: 2.5, ease: "power2.inOut" });
    
    instancedMesh.visible = true;
    startTrack(currentTrackIndex);
}

function startTrack(index) {
    const audio = document.getElementById(`audio-${index}`);
    
    // Connect to analyzer only once
    if (!analyzer) {
        const source = audioCtx.createMediaElementSource(audio);
        analyzer = audioCtx.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);
        analyzer.connect(audioCtx.destination);
    }
    
    audio.play();
    document.getElementById('now-playing').innerText = `SYSTEM_DROP // 0${index}`;
}

window.switchTrack = function() {
    const old = document.getElementById(`audio-${currentTrackIndex}`);
    old.pause(); old.currentTime = 0;
    currentTrackIndex = (currentTrackIndex % 3) + 1;
    startTrack(currentTrackIndex);
};

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    
    if (instancedMesh && instancedMesh.visible) {
        instancedMesh.material.uniforms.uTime.value = time;
        
        let audioLevel = 0;
        if (analyzer) {
            const data = new Uint8Array(analyzer.frequencyBinCount);
            analyzer.getByteFrequencyData(data);
            audioLevel = (data.reduce((a, b) => a + b, 0) / data.length) / 40.0;
            instancedMesh.material.uniforms.uAudio.value = audioLevel;
            document.getElementById('progress-line').style.width = Math.min(audioLevel * 300, 100) + "%";
        }

        for (let i = 0; i < instancedMesh.count; i++) {
            const z = ((i * 25 + time * 120) % 2000) - 1000;
            const s = 1 + (audioLevel * (i % 4 === 0 ? 1.5 : 0.2));
            dummy.position.set(Math.sin(time + i * 0.1) * 30, Math.cos(time + i * 0.1) * 30, z);
            dummy.rotation.z = time * 0.1 + (i * 0.05);
            dummy.scale.set(s, s, 1);
            dummy.updateMatrix();
            instancedMesh.setMatrix(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
    }
    renderer.render(scene, camera);
}

init();
