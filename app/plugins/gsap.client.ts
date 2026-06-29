import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default defineNuxtPlugin(() => {
	gsap.registerPlugin(ScrollTrigger);

	gsap.defaults({ ease: "power3.out" });

	return {
		provide: {
			gsap: gsap,
			ScrollTrigger: ScrollTrigger,
		},
	};
});
