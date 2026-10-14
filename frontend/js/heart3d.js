/**
 * 3D Cardiovascular Digital Twin & Animated Cardio Exercise Simulator
 * Multimodal AI Hackathon 2026 - Track A
 * 
 * Major Features:
 * 1. Bio-Mechanical Heart with Torsional Wring Contraction (Systole/Diastole Apical Twist)
 * 2. 3 Visual Shader Themes: Bio-Realistic, Cyber-Hologram Neon, and X-Ray Angiography
 * 3. Atmospheric Biosensor Particle Field & Holographic Medical HUD Scan Rings
 * 4. Procedural 3D Animated Human Athlete (Jogging, Cycling, Jumping Jacks, Yoga)
 * 5. Dynamic Coronary Stenosis Occlusion & Collateral Vessel Angiogenesis Animation
 * 6. Web Audio API Synchronized Cardiac Pulse & EKG Monitor Synthesizer
 */

class Heart3DViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // Mode: 'heart' or 'exercise'
        this.currentMode = 'heart';
        this.currentTheme = 'biorealistic'; // 'biorealistic', 'cyber', 'xray'
        
        // Scene Groups
        this.heartGroup = new THREE.Group();
        this.vesselsGroup = new THREE.Group();
        this.particlesGroup = new THREE.Group();
        this.torsoGroup = new THREE.Group();
        this.hudGroup = new THREE.Group();
        this.exerciseGroup = new THREE.Group();
        this.interactiveMeshes = [];
        
        // Coronary elements
        this.vesselMeshes = { lad: null, lcx: null, rca: null };
        this.vesselMaterials = { lad: null, lcx: null, rca: null };
        this.stenosisMarkers = { lad: null, lcx: null, rca: null };
        this.plaqueMeshes = { lad: null, lcx: null, rca: null };
        this.collateralVessels = [];
        
        // Blood flow & ambient particles
        this.particleStreams = { lad: [], lcx: [], rca: [] };
        this.ambientParticles = null;
        
        // Risk levels
        this.risks = { cad: 0.1, lad: 0.1, lcx: 0.1, rca: 0.1 };
        
        // Raycasting
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredObject = null;
        
        // Animation state
        this.isBeating = true;
        this.heartRateBpm = 72;
        this.clock = new THREE.Clock();
        this.targetCameraPos = null;
        this.targetControlsTarget = null;
        
        // 3D Exercise Athlete state
        this.currentExercise = 'jogging'; // 'jogging', 'cycling', 'hiit', 'yoga'
        this.athleteLimbs = {};
        this.isExercising = true;
        
        // Web Audio Synthesizer
        this.audioCtx = null;
        this.soundEnabled = false;
        this.lastBeatTime = 0;
        
        // Callbacks
        this.onSelectVessel = null;
        
        this.init();
    }
    
    init() {
        const width = this.container.clientWidth || 600;
        const height = this.container.clientHeight || 500;
        
        // 1. Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060911);
        
        // 2. Camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(0, 4, 24);
        
        // 3. Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.35;
        this.container.appendChild(this.renderer.domElement);
        
        // 4. Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.minDistance = 6;
        this.controls.maxDistance = 60;
        this.controls.target.set(0, 0, 0);
        
        // 5. Lighting
        this.setupLighting();
        
        // 6. Build Cardiac Anatomy
        this.buildHeartAnatomy();
        this.buildCoronaryVessels();
        this.buildBloodFlowParticles();
        this.buildTorsoCage();
        this.buildHolographicScanHUD();
        this.buildAmbientDust();
        
        // 7. Build 3D Exercise Athlete
        this.buildExerciseAthlete();
        
        // Add to main scene
        this.scene.add(this.torsoGroup);
        this.scene.add(this.hudGroup);
        this.scene.add(this.heartGroup);
        this.heartGroup.add(this.vesselsGroup);
        this.heartGroup.add(this.particlesGroup);
        this.scene.add(this.exerciseGroup);
        this.exerciseGroup.visible = false;
        
        // Event Listeners
        window.addEventListener('resize', () => this.onWindowResize());
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
        
        // Start Render Loop
        this.animate();
    }
    
    setupLighting() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(this.ambientLight);
        
        this.keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.keyLight.position.set(12, 20, 16);
        this.scene.add(this.keyLight);
        
        this.cyanRim = new THREE.DirectionalLight(0x06b6d4, 0.85);
        this.cyanRim.position.set(-18, 8, -15);
        this.scene.add(this.cyanRim);
        
        this.redRim = new THREE.DirectionalLight(0xf43f5e, 0.5);
        this.redRim.position.set(15, -12, 10);
        this.scene.add(this.redRim);
        
        // Central Point Light for glowing core
        this.corePointLight = new THREE.PointLight(0xf43f5e, 1.2, 15);
        this.corePointLight.position.set(0, 0, 1);
        this.heartGroup.add(this.corePointLight);
    }
    
    buildHeartAnatomy() {
        // Ventricles geometry with anatomical apical taper
        const ventricleGeo = new THREE.SphereGeometry(4.3, 40, 40);
        ventricleGeo.scale(0.88, 1.28, 0.84);
        
        const pos = ventricleGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            let y = pos.getY(i);
            let x = pos.getX(i);
            let z = pos.getZ(i);
            if (y < 0) {
                let factor = 1.0 + (y / 5.2) * 0.46;
                pos.setX(i, x * Math.max(factor, 0.22) - 0.22);
                pos.setZ(i, z * Math.max(factor, 0.22));
            }
            if (z > 1.4 && Math.abs(x) < 1.9 && y < 1.6) {
                pos.setZ(i, z - 0.28 * Math.cos(x));
            }
        }
        ventricleGeo.computeVertexNormals();
        
        this.myoMat = new THREE.MeshStandardMaterial({
            color: 0x9f1239,
            roughness: 0.35,
            metalness: 0.15,
            emissive: 0x4c0519,
            emissiveIntensity: 0.3
        });
        
        this.ventriclesMesh = new THREE.Mesh(ventricleGeo, this.myoMat);
        this.ventriclesMesh.position.set(0, -1.2, 0);
        this.ventriclesMesh.userData = {
            name: "Myocardium (Left & Right Ventricles)",
            type: "muscle",
            desc: "Primary contractile pumps. Undergoes torsional wringing motion to maximize stroke volume."
        };
        this.heartGroup.add(this.ventriclesMesh);
        this.interactiveMeshes.push(this.ventriclesMesh);
        
        // Atria
        const atriumGeo = new THREE.SphereGeometry(2.3, 28, 28);
        atriumGeo.scale(1.2, 0.9, 0.9);
        this.atriumMat = new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.5, metalness: 0.1 });
        
        const rightAtrium = new THREE.Mesh(atriumGeo, this.atriumMat);
        rightAtrium.position.set(2.4, 2.5, -0.6);
        rightAtrium.userData = { name: "Right Atrium", type: "chamber", desc: "Receives systemic venous return." };
        this.heartGroup.add(rightAtrium);
        this.interactiveMeshes.push(rightAtrium);
        
        const leftAtrium = new THREE.Mesh(atriumGeo, this.atriumMat);
        leftAtrium.position.set(-2.2, 2.7, -1.2);
        leftAtrium.userData = { name: "Left Atrium", type: "chamber", desc: "Receives pulmonary venous inflow." };
        this.heartGroup.add(leftAtrium);
        this.interactiveMeshes.push(leftAtrium);
        
        // Aorta & Arch
        this.aortaCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.3, 1.8, 0.5),
            new THREE.Vector3(0.5, 3.8, 0.2),
            new THREE.Vector3(0.2, 5.5, -0.4),
            new THREE.Vector3(-1.4, 5.3, -1.2),
            new THREE.Vector3(-1.8, 3.2, -1.8),
            new THREE.Vector3(-1.8, -1.5, -1.8)
        ]);
        const aortaGeo = new THREE.TubeGeometry(this.aortaCurve, 42, 0.92, 16, false);
        this.aortaMat = new THREE.MeshStandardMaterial({
            color: 0xd97706,
            roughness: 0.28,
            metalness: 0.2,
            emissive: 0x78350f,
            emissiveIntensity: 0.25
        });
        const aorta = new THREE.Mesh(aortaGeo, this.aortaMat);
        aorta.userData = { name: "Aorta & Aortic Arch", type: "vessel", desc: "Primary systemic high-pressure conduit." };
        this.heartGroup.add(aorta);
        this.interactiveMeshes.push(aorta);
        
        // Brachiocephalic branches
        const bBranches = [
            { pos: new THREE.Vector3(0.4, 5.6, -0.2), dir: new THREE.Vector3(0.5, 1.8, 0.2), name: "Brachiocephalic Artery" },
            { pos: new THREE.Vector3(-0.3, 5.7, -0.7), dir: new THREE.Vector3(0.0, 1.9, 0.0), name: "Left Common Carotid" },
            { pos: new THREE.Vector3(-1.0, 5.5, -1.0), dir: new THREE.Vector3(-0.4, 1.8, -0.2), name: "Left Subclavian" }
        ];
        bBranches.forEach(b => {
            const bMesh = new THREE.Mesh(
                new THREE.TubeGeometry(new THREE.CatmullRomCurve3([b.pos, b.pos.clone().add(b.dir)]), 8, 0.26, 8, false),
                this.aortaMat
            );
            bMesh.userData = { name: b.name, type: "vessel", desc: "Aortic arch upper branch." };
            this.heartGroup.add(bMesh);
            this.interactiveMeshes.push(bMesh);
        });
        
        // Pulmonary Trunk & Branches
        this.pulmMat = new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            roughness: 0.35,
            metalness: 0.15,
            emissive: 0x075985,
            emissiveIntensity: 0.2
        });
        const pulmTrunk = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
                new THREE.Vector3(0.8, 1.2, 1.4),
                new THREE.Vector3(0.2, 3.0, 1.1),
                new THREE.Vector3(-0.6, 4.1, 0.2)
            ]), 24, 0.82, 14, false),
            this.pulmMat
        );
        pulmTrunk.userData = { name: "Pulmonary Artery Trunk", type: "vessel", desc: "Right ventricular outflow to lungs." };
        this.heartGroup.add(pulmTrunk);
        this.interactiveMeshes.push(pulmTrunk);
        
        const lPulm = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.6, 4.1, 0.2), new THREE.Vector3(-2.8, 4.1, -0.8)]), 12, 0.5, 10, false),
            this.pulmMat
        );
        this.heartGroup.add(lPulm);
        const rPulm = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.6, 4.1, 0.2), new THREE.Vector3(2.5, 3.6, -1.2)]), 12, 0.5, 10, false),
            this.pulmMat
        );
        this.heartGroup.add(rPulm);
    }
    
    buildCoronaryVessels() {
        // --- LAD (Left Anterior Descending) ---
        this.ladCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.4, 2.6, 0.9),
            new THREE.Vector3(-0.8, 1.8, 2.1),
            new THREE.Vector3(-0.7, 0.6, 2.7),
            new THREE.Vector3(-0.5, -0.8, 2.7),
            new THREE.Vector3(-0.3, -2.4, 2.2),
            new THREE.Vector3(-0.2, -4.2, 0.9)
        ]);
        this.vesselMaterials.lad = new THREE.MeshStandardMaterial({
            color: 0x10b981,
            roughness: 0.15,
            metalness: 0.4,
            emissive: 0x10b981,
            emissiveIntensity: 0.5
        });
        this.vesselMeshes.lad = new THREE.Mesh(new THREE.TubeGeometry(this.ladCurve, 55, 0.24, 16, false), this.vesselMaterials.lad);
        this.vesselMeshes.lad.userData = {
            id: "LAD",
            name: "Left Anterior Descending (LAD) Artery",
            territory: "Anterior wall, Septum, and Cardiac Apex",
            clinicalNote: "The 'Widowmaker' vessel. Severe stenosis triggers massive anterior STEMI.",
            type: "target_vessel"
        };
        this.vesselsGroup.add(this.vesselMeshes.lad);
        this.interactiveMeshes.push(this.vesselMeshes.lad);
        
        // Diagonals (D1)
        const d1 = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.8, 1.5, 2.2),
                new THREE.Vector3(-1.8, 0.8, 2.3),
                new THREE.Vector3(-2.6, -0.2, 1.8)
            ]), 16, 0.14, 10, false),
            this.vesselMaterials.lad
        );
        d1.userData = { ...this.vesselMeshes.lad.userData, name: "LAD Diagonal Branch (D1)" };
        this.vesselsGroup.add(d1);
        this.interactiveMeshes.push(d1);
        
        // --- LCX (Left Circumflex) ---
        this.lcxCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.5, 2.4, 0.8),
            new THREE.Vector3(-1.6, 2.0, 1.1),
            new THREE.Vector3(-2.8, 1.2, 0.4),
            new THREE.Vector3(-3.2, 0.2, -0.7),
            new THREE.Vector3(-2.6, -1.2, -1.6),
            new THREE.Vector3(-1.6, -2.6, -1.7)
        ]);
        this.vesselMaterials.lcx = new THREE.MeshStandardMaterial({
            color: 0x10b981,
            roughness: 0.15,
            metalness: 0.4,
            emissive: 0x10b981,
            emissiveIntensity: 0.5
        });
        this.vesselMeshes.lcx = new THREE.Mesh(new THREE.TubeGeometry(this.lcxCurve, 50, 0.22, 16, false), this.vesselMaterials.lcx);
        this.vesselMeshes.lcx.userData = {
            id: "LCX",
            name: "Left Circumflex (LCX) Artery",
            territory: "Lateral & Posterior Left Ventricle",
            clinicalNote: "Supplies posterolateral cardiac wall. Stenosis causes lateral ischemia.",
            type: "target_vessel"
        };
        this.vesselsGroup.add(this.vesselMeshes.lcx);
        this.interactiveMeshes.push(this.vesselMeshes.lcx);
        
        // Obtuse marginal (OM1)
        const om1 = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
                new THREE.Vector3(-2.8, 1.1, 0.3),
                new THREE.Vector3(-3.4, -0.2, 0.7),
                new THREE.Vector3(-3.2, -1.8, 0.5)
            ]), 16, 0.13, 10, false),
            this.vesselMaterials.lcx
        );
        om1.userData = { ...this.vesselMeshes.lcx.userData, name: "LCX Obtuse Marginal Branch (OM1)" };
        this.vesselsGroup.add(om1);
        this.interactiveMeshes.push(om1);
        
        // --- RCA (Right Coronary Artery) ---
        this.rcaCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.8, 2.2, 1.2),
            new THREE.Vector3(2.1, 1.6, 1.3),
            new THREE.Vector3(2.9, 0.4, 1.0),
            new THREE.Vector3(3.0, -1.0, 0.3),
            new THREE.Vector3(2.2, -2.2, -0.6),
            new THREE.Vector3(0.6, -3.2, -1.2)
        ]);
        this.vesselMaterials.rca = new THREE.MeshStandardMaterial({
            color: 0x10b981,
            roughness: 0.15,
            metalness: 0.4,
            emissive: 0x10b981,
            emissiveIntensity: 0.5
        });
        this.vesselMeshes.rca = new THREE.Mesh(new THREE.TubeGeometry(this.rcaCurve, 50, 0.23, 16, false), this.vesselMaterials.rca);
        this.vesselMeshes.rca.userData = {
            id: "RCA",
            name: "Right Coronary Artery (RCA)",
            territory: "Right Ventricle, Inferior wall & SA/AV Nodes",
            clinicalNote: "Stenosis frequently triggers inferior wall STEMI and AV conduction blocks.",
            type: "target_vessel"
        };
        this.vesselsGroup.add(this.vesselMeshes.rca);
        this.interactiveMeshes.push(this.vesselMeshes.rca);
        
        // Acute Marginal
        const am = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
                new THREE.Vector3(2.9, 0.2, 0.9),
                new THREE.Vector3(2.4, -0.9, 1.6),
                new THREE.Vector3(1.4, -2.1, 1.7)
            ]), 14, 0.12, 10, false),
            this.vesselMaterials.rca
        );
        am.userData = { ...this.vesselMeshes.rca.userData, name: "RCA Acute Marginal Branch" };
        this.vesselsGroup.add(am);
        this.interactiveMeshes.push(am);
        
        // Atherosclerotic Plaque Bulges & Stenosis Markers
        this.createPlaqueAndMarker('lad', new THREE.Vector3(-0.7, 0.6, 2.7));
        this.createPlaqueAndMarker('lcx', new THREE.Vector3(-2.8, 1.2, 0.4));
        this.createPlaqueAndMarker('rca', new THREE.Vector3(2.9, 0.4, 1.0));
        
        // Collateral Angiogenesis Micro-Vessels (spawned by exercise)
        this.buildCollateralMicroVessels();
    }
    
    createPlaqueAndMarker(vesselKey, pos) {
        // Glowing Occlusion Ring
        const ringGeo = new THREE.TorusGeometry(0.44, 0.09, 12, 28);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.lookAt(pos.clone().add(new THREE.Vector3(0, 1, 0)));
        this.vesselsGroup.add(ring);
        this.stenosisMarkers[vesselKey] = ring;
        
        // Visible Atheroma Plaque Core
        const plaqueGeo = new THREE.SphereGeometry(0.32, 14, 14);
        plaqueGeo.scale(1.2, 0.7, 0.8);
        const plaqueMat = new THREE.MeshStandardMaterial({
            color: 0xfacc15, // Lipid atheroma yellow
            roughness: 0.6,
            metalness: 0.1,
            transparent: true,
            opacity: 0.0
        });
        const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
        plaque.position.copy(pos);
        this.vesselsGroup.add(plaque);
        this.plaqueMeshes[vesselKey] = plaque;
    }
    
    buildCollateralMicroVessels() {
        // Sprouting micro-collaterals connecting RCA to LAD and LCX
        const curves = [
            new THREE.CatmullRomCurve3([new THREE.Vector3(-0.6, -0.6, 2.6), new THREE.Vector3(0.5, -1.2, 2.0), new THREE.Vector3(1.8, -1.5, 1.4)]),
            new THREE.CatmullRomCurve3([new THREE.Vector3(-2.2, 0.4, 1.2), new THREE.Vector3(-1.4, -0.8, 2.4), new THREE.Vector3(-0.4, -1.6, 2.4)]),
            new THREE.CatmullRomCurve3([new THREE.Vector3(1.2, -2.4, 1.2), new THREE.Vector3(0.3, -3.2, 1.8), new THREE.Vector3(-0.2, -3.8, 1.1)])
        ];
        
        const colMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.0
        });
        
        curves.forEach(c => {
            const mesh = new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.08, 8, false), colMat.clone());
            this.vesselsGroup.add(mesh);
            this.collateralVessels.push(mesh);
        });
    }
    
    buildBloodFlowParticles() {
        const createStream = (curve, count, colorHex) => {
            const particles = [];
            const geo = new THREE.SphereGeometry(0.08, 8, 8);
            const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85 });
            
            for (let i = 0; i < count; i++) {
                const mesh = new THREE.Mesh(geo, mat.clone());
                const t = i / count;
                mesh.position.copy(curve.getPointAt(t));
                mesh.userData = { t, speed: 0.085 + Math.random() * 0.035, baseSpeed: 0.085 };
                this.particlesGroup.add(mesh);
                particles.push({ mesh, curve, t });
            }
            return particles;
        };
        
        this.particleStreams.lad = createStream(this.ladCurve, 30, 0x34d399);
        this.particleStreams.lcx = createStream(this.lcxCurve, 26, 0x34d399);
        this.particleStreams.rca = createStream(this.rcaCurve, 28, 0x34d399);
    }
    
    buildHolographicScanHUD() {
        // Rotating Sci-Fi Medical Biosensor Rings
        const ringGeo1 = new THREE.RingGeometry(6.4, 6.46, 64);
        const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide, transparent: true, opacity: 0.22 });
        this.scanRing1 = new THREE.Mesh(ringGeo1, ringMat1);
        this.scanRing1.rotation.x = Math.PI / 2;
        this.hudGroup.add(this.scanRing1);
        
        const ringGeo2 = new THREE.RingGeometry(7.2, 7.24, 48);
        const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x3b82f6, side: THREE.DoubleSide, transparent: true, opacity: 0.18 });
        this.scanRing2 = new THREE.Mesh(ringGeo2, ringMat2);
        this.scanRing2.rotation.x = Math.PI / 2.3;
        this.scanRing2.rotation.y = Math.PI / 6;
        this.hudGroup.add(this.scanRing2);
        
        // Holographic Horizon Grid
        const gridHelper = new THREE.GridHelper(24, 24, 0x06b6d4, 0x1e293b);
        gridHelper.position.y = -6.5;
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.25;
        this.hudGroup.add(gridHelper);
    }
    
    buildAmbientDust() {
        // Floating luminescent particles (Bio-nanobots / ambient lighting)
        const count = 140;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 30;
            positions[i + 1] = (Math.random() - 0.5) * 24;
            positions[i + 2] = (Math.random() - 0.5) * 30;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
            size: 0.25,
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending
        });
        this.ambientParticles = new THREE.Points(geo, mat);
        this.scene.add(this.ambientParticles);
    }
    
    buildTorsoCage() {
        const ribCount = 8;
        const ribMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.12, wireframe: true });
        
        for (let i = 0; i < ribCount; i++) {
            const y = 6.0 - i * 1.5;
            const rx = 6.2 + Math.sin(i / ribCount * Math.PI) * 2.8;
            const rz = 5.0 + Math.sin(i / ribCount * Math.PI) * 1.8;
            const curve = new THREE.EllipseCurve(0, 0, rx, rz, -Math.PI * 0.75, Math.PI * 0.75, false, 0);
            const points = curve.getPoints(32).map(p => new THREE.Vector3(p.x, y, p.y - 0.5));
            const ribMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.09, 6, false), ribMat);
            this.torsoGroup.add(ribMesh);
        }
        
        // Sternum
        const sternum = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9.5, 0.15), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.18 }));
        sternum.position.set(0, 0.5, 4.8);
        this.torsoGroup.add(sternum);
        
        // Spine
        const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 12), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.18 }));
        spine.position.set(0, 0, -4.6);
        this.torsoGroup.add(spine);
        
        this.torsoVisible = true;
    }
    
    // =========================================================================
    // 3D Animated Human Athlete (Cardio Exercise Simulator)
    // =========================================================================
    buildExerciseAthlete() {
        const athleteMat = new THREE.MeshStandardMaterial({
            color: 0x06b6d4,
            roughness: 0.3,
            metalness: 0.35,
            emissive: 0x083344,
            emissiveIntensity: 0.3
        });
        const jointMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, metalness: 0.5 });
        
        const root = new THREE.Group();
        root.position.set(0, -3.5, 0);
        
        // Pelvis
        const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.6, 0.7, 12), athleteMat);
        pelvis.position.y = 4.2;
        root.add(pelvis);
        
        // Torso & Chest
        const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 2.0, 12), athleteMat);
        chest.position.y = 5.6;
        root.add(chest);
        
        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 16), athleteMat);
        head.position.y = 7.2;
        root.add(head);
        
        // Limbs Generator
        const makeLimb = (length, radius) => {
            const group = new THREE.Group();
            const joint = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.3, 10, 10), jointMat);
            const bone = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.9, radius, length, 10), athleteMat);
            bone.position.y = -length / 2;
            group.add(joint);
            group.add(bone);
            return { group, length };
        };
        
        // Right Leg
        const rHip = new THREE.Group();
        rHip.position.set(0.6, 4.0, 0);
        const rThigh = makeLimb(2.2, 0.3);
        rHip.add(rThigh.group);
        const rKnee = new THREE.Group();
        rKnee.position.set(0, -2.2, 0);
        const rShin = makeLimb(2.1, 0.25);
        rKnee.add(rShin.group);
        rThigh.group.add(rKnee);
        root.add(rHip);
        
        // Left Leg
        const lHip = new THREE.Group();
        lHip.position.set(-0.6, 4.0, 0);
        const lThigh = makeLimb(2.2, 0.3);
        lHip.add(lThigh.group);
        const lKnee = new THREE.Group();
        lKnee.position.set(0, -2.2, 0);
        const lShin = makeLimb(2.1, 0.25);
        lKnee.add(lShin.group);
        lThigh.group.add(lKnee);
        root.add(lHip);
        
        // Right Arm
        const rShoulder = new THREE.Group();
        rShoulder.position.set(1.2, 6.4, 0);
        const rUpperArm = makeLimb(1.8, 0.22);
        rShoulder.add(rUpperArm.group);
        const rElbow = new THREE.Group();
        rElbow.position.set(0, -1.8, 0);
        const rForearm = makeLimb(1.6, 0.2);
        rElbow.add(rForearm.group);
        rUpperArm.group.add(rElbow);
        root.add(rShoulder);
        
        // Left Arm
        const lShoulder = new THREE.Group();
        lShoulder.position.set(-1.2, 6.4, 0);
        const lUpperArm = makeLimb(1.8, 0.22);
        lShoulder.add(lUpperArm.group);
        const lElbow = new THREE.Group();
        lElbow.position.set(0, -1.8, 0);
        const lForearm = makeLimb(1.6, 0.2);
        lElbow.add(lForearm.group);
        lUpperArm.group.add(lElbow);
        root.add(lShoulder);
        
        // Miniature Beating Heart Hologram inside the runner's chest!
        const runnerHeart = new THREE.Mesh(
            new THREE.SphereGeometry(0.38, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0xef4444, wireframe: true })
        );
        runnerHeart.position.set(0.1, 5.7, 0.3);
        root.add(runnerHeart);
        
        this.athleteLimbs = {
            root, chest, head, runnerHeart,
            rHip, rKnee, lHip, lKnee,
            rShoulder, rElbow, lShoulder, lElbow
        };
        
        this.exerciseGroup.add(root);
    }
    
    setMode(mode) {
        this.currentMode = mode;
        if (mode === 'exercise') {
            this.heartGroup.visible = false;
            this.torsoGroup.visible = false;
            this.exerciseGroup.visible = true;
            this.camera.position.set(0, 3, 20);
            this.controls.target.set(0, 2, 0);
        } else {
            this.heartGroup.visible = true;
            this.torsoGroup.visible = this.torsoVisible;
            this.exerciseGroup.visible = false;
            this.camera.position.set(0, 4, 24);
            this.controls.target.set(0, 0, 0);
        }
    }
    
    setExerciseType(type) {
        this.currentExercise = type;
    }
    
    setTheme(theme) {
        this.currentTheme = theme;
        if (theme === 'cyber') {
            this.myoMat.wireframe = true;
            this.myoMat.color.setHex(0x06b6d4);
            this.myoMat.emissive.setHex(0x0891b2);
            this.aortaMat.wireframe = true;
            this.pulmMat.wireframe = true;
            this.scene.background.setHex(0x030712);
        } else if (theme === 'xray') {
            this.myoMat.wireframe = false;
            this.myoMat.color.setHex(0x1e293b);
            this.myoMat.emissive.setHex(0x0f172a);
            this.aortaMat.color.setHex(0x94a3b8);
            this.pulmMat.color.setHex(0x64748b);
            this.scene.background.setHex(0x000000);
        } else { // Bio-realistic
            this.myoMat.wireframe = false;
            this.myoMat.color.setHex(0x9f1239);
            this.myoMat.emissive.setHex(0x4c0519);
            this.aortaMat.wireframe = false;
            this.aortaMat.color.setHex(0xd97706);
            this.pulmMat.wireframe = false;
            this.pulmMat.color.setHex(0x0284c7);
            this.scene.background.setHex(0x060911);
        }
    }
    
    // =========================================================================
    // Web Audio Synchronized Cardiac Synthesizer
    // =========================================================================
    toggleSound(enable) {
        this.soundEnabled = enable !== undefined ? enable : !this.soundEnabled;
        if (this.soundEnabled && !this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        }
        return this.soundEnabled;
    }
    
    playCardiacSound() {
        if (!this.soundEnabled || !this.audioCtx) return;
        try {
            const ctx = this.audioCtx;
            const now = ctx.currentTime;
            
            // 1. "Lub" (S1 - AV valves closure)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(80, now);
            osc1.frequency.exponentialRampToValueAtTime(35, now + 0.12);
            gain1.gain.setValueAtTime(0.3, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.15);
            
            // 2. "Dub" (S2 - Semilunar aortic/pulmonary valves closure)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(110, now + 0.16);
            osc2.frequency.exponentialRampToValueAtTime(45, now + 0.28);
            gain2.gain.setValueAtTime(0.25, now + 0.16);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.16);
            osc2.stop(now + 0.31);
        } catch (e) {
            // Audio policy or suspended
        }
    }
    
    // =========================================================================
    // Dynamic Risk Mapping & Exercise Angiogenesis
    // =========================================================================
    updateVesselRisks(risks, showCollaterals = false) {
        this.risks = { ...this.risks, ...risks };
        
        const interpolateColor = (prob) => {
            const green = new THREE.Color(0x10b981);
            const amber = new THREE.Color(0xf59e0b);
            const red = new THREE.Color(0xef4444);
            if (prob < 0.35) return green.clone().lerp(amber, prob / 0.35);
            if (prob < 0.70) return amber.clone().lerp(red, (prob - 0.35) / 0.35);
            return red;
        };
        
        ['lad', 'lcx', 'rca'].forEach(v => {
            const prob = this.risks[v] || 0.1;
            const targetColor = interpolateColor(prob);
            
            if (this.vesselMaterials[v]) {
                this.vesselMaterials[v].color.copy(targetColor);
                this.vesselMaterials[v].emissive.copy(targetColor);
                this.vesselMaterials[v].emissiveIntensity = 0.35 + prob * 0.65;
            }
            
            // Constriction Marker
            const marker = this.stenosisMarkers[v];
            if (marker) {
                if (prob >= 0.40) {
                    marker.material.opacity = Math.min((prob - 0.40) * 2.2, 0.95);
                    marker.material.color.copy(targetColor);
                } else {
                    marker.material.opacity = 0.0;
                }
            }
            
            // Atheroma Plaque Visibility
            const plaque = this.plaqueMeshes[v];
            if (plaque) {
                plaque.material.opacity = prob >= 0.50 ? Math.min((prob - 0.50) * 2.5, 0.9) : 0.0;
            }
            
            // Flow Speed (Hypoperfusion)
            if (this.particleStreams[v]) {
                this.particleStreams[v].forEach(p => {
                    p.mesh.material.color.copy(targetColor);
                    const flowReduction = prob > 0.7 ? 0.35 : (prob > 0.4 ? 0.65 : 1.0);
                    p.mesh.userData.speed = p.mesh.userData.baseSpeed * flowReduction;
                });
            }
        });
        
        // Collateral Angiogenesis Micro-vessels glow
        this.collateralVessels.forEach(m => {
            m.material.opacity = showCollaterals ? 0.85 : 0.0;
        });
    }
    
    toggleTorso(visible) {
        this.torsoVisible = visible !== undefined ? visible : !this.torsoVisible;
        this.torsoGroup.visible = this.torsoVisible;
    }
    
    toggleHeartbeat(beating) {
        this.isBeating = beating !== undefined ? beating : !this.isBeating;
    }
    
    setCameraPreset(presetName) {
        switch (presetName) {
            case 'lad': this.tweenCamera(new THREE.Vector3(0, 0, 16), new THREE.Vector3(0, -0.5, 1.5)); break;
            case 'lcx': this.tweenCamera(new THREE.Vector3(-14, 2, 8), new THREE.Vector3(-1.8, 0, 0)); break;
            case 'rca': this.tweenCamera(new THREE.Vector3(14, -2, 9), new THREE.Vector3(1.8, -0.8, 0.5)); break;
            case 'torso': this.tweenCamera(new THREE.Vector3(0, 6, 28), new THREE.Vector3(0, 0, 0)); break;
            case 'reset':
            default: this.tweenCamera(new THREE.Vector3(0, 4, 24), new THREE.Vector3(0, 0, 0)); break;
        }
    }
    
    tweenCamera(targetPos, targetControls) {
        this.targetCameraPos = targetPos;
        this.targetControlsTarget = targetControls;
    }
    
    onWindowResize() {
        if (!this.container) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    onMouseMove(event) {
        if (this.currentMode !== 'heart') return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactiveMeshes);
        
        const tooltip = document.getElementById('anatomy-tooltip');
        if (intersects.length > 0) {
            const hit = intersects[0].object;
            this.renderer.domElement.style.cursor = 'pointer';
            if (tooltip && hit.userData && hit.userData.name) {
                tooltip.style.display = 'block';
                tooltip.style.left = `${event.clientX - rect.left + 15}px`;
                tooltip.style.top = `${event.clientY - rect.top + 15}px`;
                const u = hit.userData;
                let riskHtml = '';
                if (u.type === 'target_vessel') {
                    const prob = this.risks[u.id.toLowerCase()] || 0.1;
                    const pct = (prob * 100).toFixed(1);
                    const riskClass = prob > 0.7 ? 'risk-badge-high' : (prob > 0.3 ? 'risk-badge-med' : 'risk-badge-low');
                    riskHtml = `<div class="tooltip-risk ${riskClass}">Stenosis Probability: <strong>${pct}%</strong></div>`;
                }
                tooltip.innerHTML = `
                    <div class="tooltip-header">${u.name}</div>
                    ${riskHtml}
                    <div class="tooltip-desc">${u.desc || u.territory || ''}</div>
                `;
            }
        } else {
            this.renderer.domElement.style.cursor = 'default';
            if (tooltip) tooltip.style.display = 'none';
        }
    }
    
    onClick(event) {
        if (this.currentMode !== 'heart') return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactiveMeshes);
        if (intersects.length > 0) {
            const hit = intersects[0].object;
            if (hit.userData && hit.userData.id) {
                if (this.onSelectVessel) this.onSelectVessel(hit.userData.id);
                this.setCameraPreset(hit.userData.id.toLowerCase());
            } else if (this.onSelectVessel) {
                this.onSelectVessel('CAD');
            }
        }
    }
    
    // =========================================================================
    // Main Animation Loop
    // =========================================================================
    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();
        
        // Rotate Biosensor HUD Scan Rings
        if (this.scanRing1) this.scanRing1.rotation.z += delta * 0.15;
        if (this.scanRing2) this.scanRing2.rotation.z -= delta * 0.22;
        
        // Float ambient dust
        if (this.ambientParticles) {
            this.ambientParticles.rotation.y = time * 0.04;
        }
        
        if (this.currentMode === 'heart') {
            // 1. Torsional Wring Cardiac Contraction (Bio-Mechanical Systole/Diastole)
            if (this.isBeating && this.ventriclesMesh) {
                const beatFreq = (this.heartRateBpm / 60) * Math.PI * 2;
                const phase = (time * beatFreq) % (Math.PI * 2);
                
                // Audio trigger on peak of systole
                if (phase < 0.25 && time - this.lastBeatTime > 0.5) {
                    this.lastBeatTime = time;
                    this.playCardiacSound();
                }
                
                // Sharp contraction then elastic recoil
                const contraction = Math.pow(Math.sin(phase), 4);
                const twist = Math.sin(phase) * 0.085; // Counter-clockwise apical wring
                
                this.ventriclesMesh.scale.set(1 - contraction * 0.08, 1 - contraction * 0.14, 1 - contraction * 0.08);
                this.ventriclesMesh.rotation.y = twist;
            }
            
            // 2. Hemodynamic Particles Flow
            ['lad', 'lcx', 'rca'].forEach(v => {
                const stream = this.particleStreams[v];
                if (stream) {
                    stream.forEach(p => {
                        p.t += p.mesh.userData.speed * delta;
                        if (p.t > 1.0) p.t = 0.0;
                        p.mesh.position.copy(p.curve.getPointAt(p.t));
                    });
                }
                
                // Pulse stenosis constriction rings
                const marker = this.stenosisMarkers[v];
                if (marker && marker.material.opacity > 0) {
                    const s = 1.0 + Math.sin(time * 6.0) * 0.14;
                    marker.scale.set(s, s, s);
                }
            });
            
        } else if (this.currentMode === 'exercise') {
            // 3. Biomechanical Athlete Animation
            this.animateAthlete(time, delta);
        }
        
        // Smooth camera tween
        if (this.targetCameraPos) {
            this.camera.position.lerp(this.targetCameraPos, 0.06);
            if (this.camera.position.distanceTo(this.targetCameraPos) < 0.05) this.targetCameraPos = null;
        }
        if (this.targetControlsTarget) {
            this.controls.target.lerp(this.targetControlsTarget, 0.06);
            if (this.controls.target.distanceTo(this.targetControlsTarget) < 0.05) this.targetControlsTarget = null;
        }
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
    
    animateAthlete(time, delta) {
        const L = this.athleteLimbs;
        if (!L.root) return;
        
        const ex = this.currentExercise;
        
        // Pulse mini-heart inside runner
        if (L.runnerHeart) {
            const hPulse = 1.0 + Math.sin(time * 12.0) * 0.18;
            L.runnerHeart.scale.set(hPulse, hPulse, hPulse);
        }
        
        if (ex === 'jogging') {
            // Running / Jogging Gait Cycle
            const speed = 7.0;
            const cycle = time * speed;
            
            // Torso bounce & slight tilt
            L.root.position.y = -3.5 + Math.abs(Math.sin(cycle)) * 0.45;
            L.chest.rotation.x = 0.18;
            L.chest.rotation.y = Math.sin(cycle) * 0.15;
            
            // Hips & Legs
            L.rHip.rotation.x = Math.sin(cycle) * 0.85;
            L.lHip.rotation.x = -Math.sin(cycle) * 0.85;
            L.rKnee.rotation.x = Math.max(0, -Math.sin(cycle + 0.4) * 1.4);
            L.lKnee.rotation.x = Math.max(0, Math.sin(cycle + 0.4) * 1.4);
            
            // Arms counter-swing
            L.rShoulder.rotation.x = -Math.sin(cycle) * 0.85;
            L.lShoulder.rotation.x = Math.sin(cycle) * 0.85;
            L.rElbow.rotation.x = -0.9 - Math.sin(cycle) * 0.3;
            L.lElbow.rotation.x = -0.9 + Math.sin(cycle) * 0.3;
            
        } else if (ex === 'cycling') {
            // Cycling Cadence Cycle
            const speed = 8.5;
            const cycle = time * speed;
            L.root.position.y = -3.2;
            L.chest.rotation.x = 0.55; // Forward aerodynamic tuck
            
            // Rotary crank pedal motion
            L.rHip.rotation.x = 0.6 + Math.sin(cycle) * 0.7;
            L.lHip.rotation.x = 0.6 + Math.sin(cycle + Math.PI) * 0.7;
            L.rKnee.rotation.x = 0.8 + Math.cos(cycle) * 0.7;
            L.lKnee.rotation.x = 0.8 + Math.cos(cycle + Math.PI) * 0.7;
            
            // Hands gripping handlebars
            L.rShoulder.rotation.x = 0.9;
            L.lShoulder.rotation.x = 0.9;
            L.rElbow.rotation.x = -0.7;
            L.lElbow.rotation.x = -0.7;
            
        } else if (ex === 'hiit') {
            // Jumping Jacks / Calisthenics
            const speed = 6.0;
            const cycle = time * speed;
            const jump = Math.abs(Math.sin(cycle));
            L.root.position.y = -3.5 + jump * 0.8;
            
            // Spread legs and arms out and in
            const spread = Math.sin(cycle);
            L.rHip.rotation.z = Math.max(0, spread * 0.5);
            L.lHip.rotation.z = Math.min(0, -spread * 0.5);
            L.rShoulder.rotation.z = Math.max(0, spread * 1.8);
            L.lShoulder.rotation.z = Math.min(0, -spread * 1.8);
            
        } else {
            // Yoga & Vagal Breathwork (Tree / Warrior Pose)
            const breath = Math.sin(time * 1.8);
            L.root.position.y = -3.5;
            L.chest.rotation.x = 0;
            L.chest.scale.set(1.0 + breath * 0.08, 1.0, 1.0 + breath * 0.08);
            
            L.rShoulder.rotation.z = 1.4;
            L.lShoulder.rotation.z = -1.4;
            L.rShoulder.rotation.x = 0;
            L.lShoulder.rotation.x = 0;
            L.rElbow.rotation.x = 0;
            L.lElbow.rotation.x = 0;
            
            L.rHip.rotation.x = 0;
            L.lHip.rotation.x = 0;
            L.rHip.rotation.z = 0.15;
            L.lHip.rotation.z = -0.15;
        }
    }
}
