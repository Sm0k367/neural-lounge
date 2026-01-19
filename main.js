import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import gsap from 'gsap';

let scene, camera, renderer, instancedMesh, analyzer, clock, audioCtx;
let isPlaying = false;
let currentTrackIndex = 1;
const dummy = new THREE.Object3D();

// --- NEON TUNNEL SHADER ---
const vertexShader = `
    varying vec3 vColor;
    varying float vGlow;
    uniform float uTime;
    uniform float uAudio;
    void main() {
        vColor = color;
        vec3 pos = position;
        // The 420 Wobble
        float wobble = sin(uTime * 3.0 + instanceMatrix[3][2] * 0.04) * uAudio * 20.0;
        pos.x += wobble;
        vec4 mvPosition = instanceMatrix * vec4(pos, 1.0);
        vGlow = uAudio;
        gl_Position = projectionMatrix * modelViewMatrix * mvPosition;
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    varying float vGlow;
    void main() {
        vec3 finalColor = vColor * (1.5 + vGlow * 10.0);
        gl_FragColor = vec4(finalColor, 0.9);
    }
`;

async function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 1200;

    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('main-view'), 
        antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Prepare the DJ Tunnel (Hidden initially)
    const ringGeo = new THREE.TorusGeometry(130, 1.5, 16, 40);
    const ringMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uAudio: { value: 0 } },
        vertexShader, fragmentShader, transparent: true, blending: THREE.AdditiveBlending, vertexColors: true
    });

    const count = 400;
    instancedMesh = new THREE.InstancedMesh(ringGeo, ringMat, count);
    const colors = new Float32Array(count * 3);
    const c1 = new THREE.Color(0xbc00ff);
    const c2 = new THREE.Color(0x00f2ff);

    for (let i = 0; i < count; i++) {
        const c = c1.clone().lerp(c2, Math.random());
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
        dummy.position.set(0, 0, i * -25);
        dummy.updateMatrix();
        instancedMesh.setMatrix(i, dummy.matrix);
    }
    ringGeo.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
    instancedMesh.visible = false;
    scene.add(instancedMesh);

    // Font Loading with Fail-Safe
    const loader = new FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', 
        (font) => {
            const textGeo = new TextGeometry('AI LOUNGE\nAFTER DARK', { font, size: 50, height: 5, curveSegments: 12 });
            textGeo.center();
            const textMesh = new THREE.Mesh(textGeo, new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true }));
            textMesh.name = "introText";
            scene.add(textMesh);
        },
        undefined,
        () => {
            console.warn("Font failed, using fallback.");
            const fallback = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial({color: 0xbc00ff}));
            fallback.name = "introText";
            scene.add(fallback);
        }
    );

    window.addEventListener('click', startSequence, { once: true });
    animate();
}

async function startSequence() {
    if (isPlaying) return;
    isPlaying = true;

    // Initialize Audio
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    await audioCtx.resume();

    const introText = scene.getObjectByName("introText");
    if(introText) gsap.to(introText.material, { opacity: 0, duration: 1 });
    
    document.getElementById('click-hint').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex';
    
    gsap.to(camera.position, { z: 300, duration: 2, ease: "power2.inOut" });
    instancedMesh.visible = true;

    playTrack(currentTrackIndex);
}

function playTrack(index) {
    const audio = document.getElementById(`audio-${index}`);
    if (!analyzer) {
        const source = audioCtx.createMediaElementSource(audio);
        analyzer = audioCtx.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);
        analyzer.connect(audioCtx.destination);
    }
    audio.play();
    document.getElementById('now-playing').innerText = `SYSTEM_DROP // TRACK_0${index}`;
}

window.switchTrack = function() {
    const old = document.getElementById(`audio-${currentTrackIndex}`);
    old.pause(); old.currentTime = 0;
    currentTrackIndex = (currentTrackIndex % 3) + 1;
    playTrack(currentTrackIndex);
};

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    
    if (instancedMesh && instancedMesh.visible) {
        instancedMesh.material.uniforms.uTime.value = time;
        let level = 0;
        if (analyzer) {
            const data = new Uint8Array(analyzer.frequencyBinCount);
            analyzer.getByteFrequencyData(data);
            level = (data.reduce((a, b) => a + b, 0) / data.length) / 40.0;
            instancedMesh.material.uniforms.uAudio.value = level;
            document.getElementById('progress-line').style.width = Math.min(level * 250, 100) + "%";
        }

        for (let i = 0; i < instancedMesh.count; i++) {
            const z = ((i * 25 + time * 150) % 2000) - 1000;
            const s = 1 + (level * (i % 5 === 0 ? 2 : 0.3));
            dummy.position.set(Math.sin(time + i * 0.1) * 40, Math.cos(time + i * 0.1) * 40, z);
            dummy.rotation.z = time * 0.2 + (i * 0.02);
            dummy.scale.set(s, s, 1);
            dummy.updateMatrix();
            instancedMesh.setMatrix(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
    }
    renderer.render(scene, camera);
}

init();
