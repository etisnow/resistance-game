// Маршрутизация по hash: витрину можно открыть с файловой системы, положить за
// любой прокси и не настраивать переписывание путей на сервере.

export interface IRoute {
	name: string;
	param: string;
}

export type TRenderer = (route: IRoute) => Promise<HTMLElement> | HTMLElement;

export const parseHash = (): IRoute => {
	const raw = window.location.hash.replace(/^#\/?/, '');
	const [name = '', param = ''] = raw.split('/');
	return {name: name || 'overview', param: decodeURIComponent(param)};
};

export const navigate = (path: string) => {
	window.location.hash = `#/${path}`;
};

export const link = (path: string): string => `#/${path}`;

export const onRouteChange = (handler: (route: IRoute) => void) => {
	window.addEventListener('hashchange', () => handler(parseHash()));
	handler(parseHash());
};
