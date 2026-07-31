import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

// ─────────────────────────────────────────────────────────────────────────────
// hero-logo
//
// The 3D Whop logo rendered in the hero. Three extruded rounded slabs, tilted
// -45°, metallic clearcoat material lit by an HDR environment. Renders into
// the given container (transparent background), sized by a ResizeObserver.
// No OrbitControls — they'd capture wheel/touch and break Lenis page scroll —
// instead the logo sways gently on its own (skipped under reduced motion).
// Call the returned destroy() in onUnmounted.
// ─────────────────────────────────────────────────────────────────────────────

// ── Shape builder ────────────────────────────────────────────────────────────

interface RoundedCorners {
	topLeft?: boolean;
	topRight?: boolean;
	bottomRight?: boolean;
	bottomLeft?: boolean;
}

function createShape(w: number, h: number, r: number, corners: RoundedCorners = {}): THREE.Shape {
	const { topLeft = false, topRight = false, bottomRight = false, bottomLeft = false } = corners;
	const s = new THREE.Shape();

	s.moveTo(0, bottomLeft ? r : 0);
	if (bottomLeft) s.absarc(r, r, r, Math.PI, Math.PI * 1.5, false);
	s.lineTo(bottomRight ? w - r : w, 0);
	if (bottomRight) s.absarc(w - r, r, r, -Math.PI / 2, 0, false);
	s.lineTo(w, topRight ? h - r : h);
	if (topRight) s.absarc(w - r, h - r, r, 0, Math.PI / 2, false);
	s.lineTo(topLeft ? r : 0, h);
	if (topLeft) s.absarc(r, h - r, r, Math.PI / 2, Math.PI, false);
	s.lineTo(0, bottomLeft ? r : 0);

	return s;
}

// ── Mesh builder ─────────────────────────────────────────────────────────────

function createMesh(corners: RoundedCorners, height = 4): THREE.Mesh {
	const shape = createShape(1.5, height, 1.4, corners);

	const geometry = new THREE.ExtrudeGeometry(shape, {
		depth: 0.53,
		bevelEnabled: true,
		bevelThickness: 0.2,
		bevelSize: 0.2,
		bevelSegments: 32,
	});

	// Align to same baseline (bottom at y: 0)
	geometry.computeBoundingBox();
	const box = geometry.boundingBox!;
	geometry.translate(-(box.max.x + box.min.x) / 2, -box.min.y, -(box.max.z + box.min.z) / 2);

	const material = new THREE.MeshPhysicalMaterial({
		color: 0xfa4616,
		metalness: 1.0,
		roughness: 0.15,
		envMapIntensity: 2.5,
		clearcoat: 1.0,
		clearcoatRoughness: 0.1,
	});

	return new THREE.Mesh(geometry, material);
}

// ── Init ─────────────────────────────────────────────────────────────────────

export interface HeroLogoOptions {
	/**
	 * How the camera frames the logo.
	 *
	 * "box" fits the static silhouette — tightest crop, but only correct while
	 * the logo faces the camera. During the flip the tilted near corner swings
	 * toward the lens and perspective magnifies it (~1.8x at the extreme), so it
	 * can push past the top of the frame in a short container.
	 *
	 * "sphere" fits the bounding sphere instead. A sphere centred on the pivot is
	 * rotation-invariant, so no part of the logo can leave the frame at any angle.
	 * Costs some apparent size; use it wherever the container may be short.
	 */
	framing?: "box" | "sphere";
}

export function initHeroLogo(container: HTMLElement, options: HeroLogoOptions = {}): () => void {
	const { framing = "box" } = options;

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
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.2;
	container.appendChild(renderer.domElement);

	// ── Environment (HDR) ────────────────────────────────────────────────────
	const pmremGenerator = new THREE.PMREMGenerator(renderer);
	pmremGenerator.compileEquirectangularShader();

	new HDRLoader().load("/hdr/royal_esplanade_1k.hdr", (texture) => {
		const envMap = pmremGenerator.fromEquirectangular(texture).texture;
		scene.environment = envMap;
		texture.dispose();
		pmremGenerator.dispose();
	});

	// ── Lighting ─────────────────────────────────────────────────────────────
	scene.add(new THREE.AmbientLight(0xffffff, 5));

	const dirLight = new THREE.DirectionalLight(0xffffff, 10);
	dirLight.position.set(1, 4, 3);
	scene.add(dirLight);

	const dirLight2 = new THREE.DirectionalLight(0xffffff, 6);
	dirLight2.position.set(-5, 5, -5);
	scene.add(dirLight2);

	const frontLight = new THREE.DirectionalLight(0xffffff, 8);
	frontLight.position.set(0, 2, 10);
	scene.add(frontLight);

	const bottomLeftLight = new THREE.DirectionalLight(0xffffff, 6);
	bottomLeftLight.position.set(-3, -1, 3);
	scene.add(bottomLeftLight);

	const bottomRightLight = new THREE.DirectionalLight(0xffffff, 6);
	bottomRightLight.position.set(1, -3, 3);
	scene.add(bottomRightLight);

	// ── The 3 slabs ──────────────────────────────────────────────────────────
	const mesh1 = createMesh({ topLeft: true }, 1.5);
	mesh1.position.x = -2.05;

	const mesh2 = createMesh({ topLeft: true }, 3.55);
	mesh2.position.x = 0;

	const mesh3 = createMesh({ topLeft: true, bottomRight: true }, 5.6);
	mesh3.position.x = 2.05;

	// Inner group: the tilted logo, shifted so its visual center sits exactly
	// on the origin. Outer pivot: carries the animated rotations — because the
	// logo's center coincides with the pivot's origin, the spin revolves
	// around the logo's center instead of its construction origin.
	const logo = new THREE.Group();
	logo.add(mesh1, mesh2, mesh3);
	logo.rotation.z = THREE.MathUtils.degToRad(-45);

	const bounds = new THREE.Box3().setFromObject(logo);
	const center = bounds.getCenter(new THREE.Vector3());
	logo.position.sub(center);

	const pivot = new THREE.Group();
	pivot.add(logo);
	scene.add(pivot);

	// ── Camera framing — fit the logo inside the container at any aspect ─────
	function frame(): void {
		const size = bounds.getSize(new THREE.Vector3());
		const margin = 1.25;
		const vFov = THREE.MathUtils.degToRad(camera.fov);
		const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);

		if (framing === "sphere") {
			// The logo is recentred on the pivot origin, so this radius is measured
			// about the axis it spins on — pull back until that sphere clears the
			// tighter of the two half-angles and nothing can clip at any rotation.
			const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius * margin;
			camera.position.set(0, 0, radius / Math.sin(Math.min(vFov, hFov) / 2));
		} else {
			const distV = (size.y * margin) / (2 * Math.tan(vFov / 2));
			const distH = (size.x * margin) / (2 * Math.tan(hFov / 2));
			camera.position.set(0, 0, Math.max(distV, distH) + size.z / 2);
		}
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

	// ── Render loop — gentle idle sway + a full x-axis flip every 8 seconds
	// (static under reduced motion) ───────────────────────────────────────────
	const SPIN_INTERVAL = 16; // seconds between flips
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

			// The flip runs in the first SPIN_DURATION of each interval; a full
			// 360° lands back at 0, so the cycle wrap is seamless. The first
			// flip waits one interval so the logo enters calmly.
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
			if (obj instanceof THREE.Mesh) {
				obj.geometry.dispose();
				(obj.material as THREE.Material).dispose();
			}
		});
		scene.environment?.dispose();
		renderer.dispose();
		renderer.domElement.remove();
	};
}
