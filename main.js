/**
 * NEURAL LOUNGE // MAX POTENTIAL V1.0
 * SHADER-BASED PARTICLE EXPLOSION & AUDIO MORPH
 */

let scene, camera, renderer, particleSystem, analyzer, clock;
let isExploded = false;
let currentTrack = 1;

// --- SHADER SOURCE: VERTEX ---
const _VS = `
    uniform float uTime;
    uniform float uExplode;
    uniform float uAudioFreq;
    attribute float aSize;
    attribute vec3 aVelocity;
    varying vec3 vColor;

    void main() {
        vColor = customColor;
        vec3 pos = position;

        // The Explosion Logic
        // Move particles outward based on uExplode progress and their unique velocity
        pos += aVelocity * uExplode * 500.0;

        // The Audio Ripple
        // Small vibration based on frequency data
        pos.x += sin(uTime * 10.0 + pos.y) * uAudioFreq * 2.0;
        pos.y += cos(uTime * 10.0 + pos.x) * uAudioFreq * 2.0;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

// --- SHADER SOURCE: FRAGMENT ---
const _FS = `
    varying vec3 vColor;
    void main() {
        // Create a soft circular particle
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        gl_FragColor = vec4(vColor, 1.0 - (d * 2.0));
    }
`;

async function initExperience() {
    setupScene();
    await createTextParticles("NEURAL LOUNGE");
    animate();
}

function setupScene() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 5000);
    camera.position.z = 600;

    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('main-view'), 
        antialias: true, 
        alpha: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

async function createTextParticles(text) {
    const loader = new THREE.FontLoader();
    // Using a standard Three.js font JSON
    loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
        const geometry = new THREE.TextGeometry(text, {
            font: font,
            size: 80,
            height: 5,
            curveSegments: 12
        });
        geometry.center();

        // Convert solid geometry into a Point Cloud
        const count = 25000;
        const posAttr = geometry.attributes.position;
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        const color = new THREE.Color(0xbc00ff);

        for (let i = 0; i < count; i++) {
            // Pick a random point from the original text geometry
            const idx = Math.floor(Math.random() * posAttr.count);
            positions[i*3] = posAttr.getX(idx);
            positions[i*3+1] = posAttr.getY(idx);
            positions[i*3+2] = posAttr.getZ(idx);

            // Random direction for explosion
            velocities[i*3] = (Math.random() - 0.5) * 2;
            velocities[i*3+1] = (Math.random() - 0.5) * 2;
            velocities[i*3+2] = (Math.random() - 0.5) * 2;

            colors[i*3] = color.r;
            colors[i*3+1] = color.g;
            colors[i*3+2] = color.b;

            sizes[i] = Math.random() * 2 + 1;
        }

        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        pGeo.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
        pGeo.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
        pGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

        const pMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uExplode: { value: 0 },
                uAudioFreq: { value: 0 }
            },
            vertexShader: _VS,
            fragmentShader: _FS,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        particleSystem = new THREE.Points(pGeo, pMat);
        scene.add(particleSystem);

        // Click to explode
        window.addEventListener('click', triggerExplosion);
    });
}

function triggerExplosion() {
    if (isExploded) return;
    isExploded = true;

    // Start Audio
    const audio = document.getElementById('audio-1');
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaElementSource(audio);
    analyzer = ctx.createAnalyser();
    source.connect(analyzer);
    analyzer.connect(ctx.destination);
    audio.play();

    // Visual Explosion Animation
    gsap.to(particleSystem.material.uniforms.uExplode, {
        value: 1,
        duration: 2,
        ease: "expo.out"
    });

    document.getElementById('ui-layer').style.display = 'flex';
}

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    if (particleSystem) {
        particleSystem.material.uniforms.uTime.value = time;
        
        if (analyzer) {
            const data = new Uint8Array(analyzer.frequencyBinCount);
            analyzer.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b) / data.length;
            particleSystem.material.uniforms.uAudioFreq.value = avg / 10.0;
        }
    }

    renderer.render(scene, camera);
}

// Ensure the initial call is made
initExperience();
