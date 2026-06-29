import gsap from "gsap";

/* ---------------------------------
 * Types
 * --------------------------------- */
interface VariableFontHoverOptions {
	minWght?: number;
	maxWght?: number;
	wdth?: number;
	radiusMultiplier?: number;
	ignoreMobile?: boolean;
	mobileWidth?: number;
}

/* ---------------------------------
 * Init function
 * --------------------------------- */
export function initVariableFontHover(
	selector: string,
	options: VariableFontHoverOptions = {},
): void {
	const {
		minWght = 200,
		maxWght = 900,
		wdth = 100,
		radiusMultiplier = 3,
		ignoreMobile = true,
		mobileWidth = 580,
	} = options;

	const elements = document.querySelectorAll<HTMLElement>(selector);

	elements.forEach((el) => {
		const text = el.textContent;
		if (!text) return;

		/* -----------------------------
		 * Split text into spans
		 * ----------------------------- */
		el.textContent = "";

		[...text].forEach((char) => {
			const span = document.createElement("span");
			span.classList.add("char");
			span.textContent = char;
			el.appendChild(span);
		});

		const chars = el.querySelectorAll<HTMLElement>(".char");

		/* -----------------------------
		 * Mouse move handler
		 * ----------------------------- */
		const handleMove = (e: MouseEvent): void => {
			if (ignoreMobile && window.innerWidth <= mobileWidth) return;

			const rect = el.getBoundingClientRect();
			const radius = rect.height * radiusMultiplier;

			const mouseX = e.clientX;
			const mouseY = e.clientY;

			chars.forEach((char) => {
				const cRect = char.getBoundingClientRect();
				const cx = cRect.left + cRect.width / 2;
				const cy = cRect.top + cRect.height / 2;

				const dx = mouseX - cx;
				const dy = mouseY - cy;
				const distance = Math.sqrt(dx * dx + dy * dy);

				let pct = 0;
				if (distance <= radius) {
					pct = ((radius - distance) / radius) * 100;
				}

				const newWght
					= pct > 0
						? minWght + maxWght - (maxWght / 100) * pct
						: maxWght;

				gsap.to(char, {
					duration: 0.1,
					fontVariationSettings: `"wght" ${newWght}, "wdth" ${wdth}`,
					overwrite: true,
				});
			});
		};

		/* -----------------------------
		 * Reset handler
		 * ----------------------------- */
		const reset = (): void => {
			if (ignoreMobile && window.innerWidth <= mobileWidth) return;

			chars.forEach((char) => {
				gsap.to(char, {
					duration: 0.1,
					fontVariationSettings: `"wght" ${maxWght}, "wdth" ${wdth}`,
					overwrite: true,
				});
			});
		};

		el.addEventListener("mousemove", handleMove);
		el.addEventListener("mouseleave", reset);
	});
}
