import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// ─────────────────────────────────────────────────────────────────────────────
// cta-figure
//
// The green metallic beam sculpture rendered behind the CTA text. Two rounded
// beams with sticks, lit by a procedural RoomEnvironment (no external HDR).
// Renders into the given container (transparent background), sized by a
// ResizeObserver. No OrbitControls — they'd capture wheel/touch and break Lenis
// page scroll — instead it sways gently and does a full horizontal spin every
// SPIN_INTERVAL seconds, matching the hero logo. Static under reduced motion.
// Call the returned destroy() in onUnmounted.
// ─────────────────────────────────────────────────────────────────────────────

// ── Rounded-box helper ───────────────────────────────────────────────────────

function createRoundedBox(
	material: THREE.Material,
	w: number,
	h: number,
	d: number,
	radius = 0.1,
): THREE.Mesh {
	const r = Math.min(radius, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);

	const shape = new THREE.Shape();
	shape.moveTo(-w / 2 + r, -h / 2);
	shape.lineTo(w / 2 - r, -h / 2);
	shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
	shape.lineTo(w / 2, h / 2 - r);
	shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
	shape.lineTo(-w / 2 + r, h / 2);
	shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
	shape.lineTo(-w / 2, -h / 2 + r);
	shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

	const extrudeDepth = d - r * 2;
	const geom = new THREE.ExtrudeGeometry(shape, {
		depth: extrudeDepth,
		bevelEnabled: true,
		bevelThickness: r,
		bevelSize: r,
		bevelSegments: 2,
		curveSegments: 12,
	});
	geom.translate(0, 0, -extrudeDepth / 2);

	return new THREE.Mesh(geom, material);
}

// ── Init ─────────────────────────────────────────────────────────────────────

export function initCtaFigure(container: HTMLElement): () => void {
	const scene = new THREE.Scene();

	const camera = new THREE.PerspectiveCamera(
		60,
		container.clientWidth / Math.max(container.clientHeight, 1),
		0.1,
		100,
	);

	const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setClearColor(0x000000, 0);
	renderer.setSize(container.clientWidth, container.clientHeight);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.2;
	container.appendChild(renderer.domElement);

	// ── Environment (procedural room lights the metal) ───────────────────────
	const pmremGenerator = new THREE.PMREMGenerator(renderer);
	const envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
	scene.environment = envMap;
	pmremGenerator.dispose();

	// ── Material — brand green metal ─────────────────────────────────────────
	const beamMaterial = new THREE.MeshPhysicalMaterial({
		color: 0xa8ff57,
		metalness: 1.0,
		roughness: 0.15,
		envMapIntensity: 2.5,
		clearcoat: 1.0,
		clearcoatRoughness: 0.1,
	});

	// ── Geometry config ──────────────────────────────────────────────────────
	const beamSize = 1.2;
	const gap = 0.75;
	const beamRadius = 0.15;
	const stickRadius = 0.07;

	// ── 1. Left beam assembly ────────────────────────────────────────────────
	const leftBeamHeight = 5;
	const leftStartingY = -0.5;
	const leftTopStickHeight = 1.5;
	const leftBottomStickHeight = 3.0;

	const leftBeam = createRoundedBox(beamMaterial, beamSize, leftBeamHeight, beamSize, beamRadius);
	leftBeam.position.set(-(beamSize / 2 + gap / 2), leftStartingY + leftBeamHeight / 2, 0);

	const leftTopStick = createRoundedBox(beamMaterial, 0.3, leftTopStickHeight, 0.3, stickRadius);
	leftTopStick.position.set(
		leftBeam.position.x,
		leftBeam.position.y + leftBeamHeight / 2 + leftTopStickHeight / 2,
		0,
	);

	const leftBottomStick = createRoundedBox(beamMaterial, 0.3, leftBottomStickHeight, 0.3, stickRadius);
	leftBottomStick.position.set(
		leftBeam.position.x,
		leftBeam.position.y - leftBeamHeight / 2 - leftBottomStickHeight / 2,
		0,
	);

	// ── 2. Right beam assembly ───────────────────────────────────────────────
	const rightBeamHeight = leftBeamHeight * 1.4;
	const rightStartingY = 0;
	const rightStickHeight = 1.5;

	const rightBeam = createRoundedBox(beamMaterial, beamSize, rightBeamHeight, beamSize, beamRadius);
	rightBeam.position.set(beamSize / 2 + gap / 2, rightStartingY + rightBeamHeight / 2, 0);

	const rightTopStick = createRoundedBox(beamMaterial, 0.3, rightStickHeight, 0.3, stickRadius);
	rightTopStick.position.set(
		rightBeam.position.x,
		rightBeam.position.y + rightBeamHeight / 2 + rightStickHeight / 2,
		0,
	);

	const rightBottomStick = createRoundedBox(beamMaterial, 0.3, rightStickHeight, 0.3, stickRadius);
	rightBottomStick.position.set(
		rightBeam.position.x,
		rightBeam.position.y - rightBeamHeight / 2 - rightStickHeight / 2,
		0,
	);

	// Inner group holds the sculpture, shifted so its center sits on the origin.
	// Outer pivot carries the animated rotations so the spin revolves around the
	// sculpture's own center.
	const figure = new THREE.Group();
	figure.add(leftBeam, leftTopStick, leftBottomStick, rightBeam, rightTopStick, rightBottomStick);

	const bounds = new THREE.Box3().setFromObject(figure);
	const center = bounds.getCenter(new THREE.Vector3());
	figure.position.sub(center);

	const pivot = new THREE.Group();
	pivot.add(figure);
	scene.add(pivot);

	// ── Camera framing — fit the sculpture inside the container at any aspect ─
	function frame(): void {
		const size = bounds.getSize(new THREE.Vector3());
		const margin = 2; // larger = camera further back = smaller figure
		const vFov = THREE.MathUtils.degToRad(camera.fov);
		const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
		const distV = (size.y * margin) / (2 * Math.tan(vFov / 2));
		const distH = (size.x * margin) / (2 * Math.tan(hFov / 2));
		camera.position.set(0, 0, Math.max(distV, distH) + size.z / 2);
		camera.lookAt(0, 0, 0);
	}
	frame();

	// ── Resize ───────────────────────────────────────────────────────────────
	const resizeObserver = new ResizeObserver(() => {
		const w = container.clientWidth;
		const h = Math.max(container.clientHeight, 1);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		renderer.setSize(w, h);
		frame();
	});
	resizeObserver.observe(container);

	// ── Render loop — gentle sway + a full horizontal spin every SPIN_INTERVAL
	// seconds (matches the hero logo). Static under reduced motion. ───────────
	const SPIN_INTERVAL = 16; // seconds between spins
	const SPIN_DURATION = 1.6; // seconds per 360°

	function easeInOutCubic(t: number): number {
		return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
	}

	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	let rafId: number | null = null;

	function animate(time: number): void {
		rafId = requestAnimationFrame(animate);
		if (!reduced) {
			const t = time * 0.001;

			const cycle = t % SPIN_INTERVAL;
			const spinProgress = t < SPIN_INTERVAL ? 0 : Math.min(cycle / SPIN_DURATION, 1);
			const spin = easeInOutCubic(spinProgress) * Math.PI * 2;

			pivot.rotation.y = Math.sin(t * 0.4) * 0.35 + spin;
			pivot.rotation.x = Math.sin(t * 0.3 + 1.2) * 0.08;
		}
		renderer.render(scene, camera);
	}
	rafId = requestAnimationFrame(animate);

	// ── Destroy ──────────────────────────────────────────────────────────────
	return function destroy(): void {
		if (rafId !== null) cancelAnimationFrame(rafId);
		resizeObserver.disconnect();
		scene.traverse((obj) => {
			if (obj instanceof THREE.Mesh) obj.geometry.dispose();
		});
		beamMaterial.dispose();
		envMap.dispose();
		renderer.dispose();
		renderer.domElement.remove();
	};
}
