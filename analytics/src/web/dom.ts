// Минимальный слой над DOM. Фреймворка здесь нет намеренно: страниц немного,
// состояние живёт в URL, а лишний рантайм на публичной витрине ни к чему.

type TChild = Node | string | number | null | undefined | false;

interface IProps {
	class?: string;
	text?: string;
	html?: string;
	href?: string;
	title?: string;
	type?: string;
	value?: string;
	placeholder?: string;
	rows?: number;
	dataset?: Record<string, string>;
	style?: string;
	onclick?: (event: MouseEvent) => void;
	oninput?: (event: Event) => void;
	onchange?: (event: Event) => void;
}

export const el = <K extends keyof HTMLElementTagNameMap>(
	tag: K,
	props: IProps = {},
	children: TChild[] = [],
): HTMLElementTagNameMap[K] => {
	const node = document.createElement(tag);
	if (props.class) node.className = props.class;
	if (props.text !== undefined) node.textContent = props.text;
	if (props.html !== undefined) node.innerHTML = props.html;
	if (props.title) node.title = props.title;
	if (props.style) node.setAttribute('style', props.style);
	if (props.href && node instanceof HTMLAnchorElement) node.href = props.href;
	if (node instanceof HTMLInputElement) {
		if (props.type) node.type = props.type;
		if (props.value !== undefined) node.value = props.value;
		if (props.placeholder) node.placeholder = props.placeholder;
	}
	if (node instanceof HTMLTextAreaElement) {
		if (props.value !== undefined) node.value = props.value;
		if (props.placeholder) node.placeholder = props.placeholder;
		if (props.rows) node.rows = props.rows;
	}
	if (props.dataset) for (const [key, value] of Object.entries(props.dataset)) node.dataset[key] = value;
	if (props.onclick) node.addEventListener('click', props.onclick as EventListener);
	if (props.oninput) node.addEventListener('input', props.oninput);
	if (props.onchange) node.addEventListener('change', props.onchange);
	append(node, children);
	return node;
};

export const append = (parent: Node, children: TChild[]) => {
	for (const child of children) {
		if (child === null || child === undefined || child === false) continue;
		parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
	}
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export const svg = (tag: string, attrs: Record<string, string | number> = {}, children: (SVGElement | null)[] = []): SVGElement => {
	const node = document.createElementNS(SVG_NS, tag);
	for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
	for (const child of children) if (child) node.appendChild(child);
	return node;
};

export const clear = (node: Element) => {
	while (node.firstChild) node.removeChild(node.firstChild);
};
