// Ambient module declarations for third-party packages that ship without
// (or with mismatched) type definitions for the sub-paths this client uses.

// react-spring's `universal` entry point exposes the same hooks/components API
// as the typed `web` entry, plus the untyped `Globals` injection object.
declare module "react-spring/universal" {
	export * from "react-spring/web";

	export const Globals: {
		injectApplyAnimatedValues<Instance>(
			fn: (instance: Instance, props: object) => void,
			transform: (style: object) => object,
		): void;
		injectFrame(
			requestFrame: (cb: FrameRequestCallback) => number,
			cancelFrame: (handle: number) => void,
		): void;
	};
}

declare module "react-scroll" {
	export interface ScrollOptions {
		duration?: number;
		delay?: number;
		smooth?: boolean | string;
		containerId?: string;
		offset?: number;
	}
	export const animateScroll: {
		scrollToBottom(options?: ScrollOptions): void;
		scrollToTop(options?: ScrollOptions): void;
		scrollTo(to: number, options?: ScrollOptions): void;
		scrollMore(by: number, options?: ScrollOptions): void;
	};
}

// Side-effect-only import registering jest-dom matchers in the test setup file.
declare module "@testing-library/jest-dom/extend-expect";

// Vite injects env vars on `import.meta.env` (the project doesn't pull in vite/client types).
interface ImportMetaEnv {
	readonly VITE_SERVER_URL?: string;
}
interface ImportMeta {
	readonly env?: ImportMetaEnv;
}

declare module "fscreen" {
	interface FScreen {
		fullscreenEnabled: boolean;
		fullscreenElement: Element | null;
		requestFullscreen(element: Element | null): void;
		exitFullscreen(): void;
		addEventListener(
			type: string,
			handler: (event: Event) => void,
			options?: boolean | AddEventListenerOptions,
		): void;
		removeEventListener(
			type: string,
			handler: (event: Event) => void,
			options?: boolean | EventListenerOptions,
		): void;
	}
	const fscreen: FScreen;
	export default fscreen;
}
