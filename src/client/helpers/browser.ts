export type TBrowser = 'chrome' | 'edge' | 'opera' | 'yandex' | 'firefox' | 'safari' | 'unknown';

// Chromium отдаёт бренды через User-Agent Client Hints, остальные — только UA-строкой.
interface IUserAgentBrand {
	brand: string;
	version: string;
}

const brandsOf = (): IUserAgentBrand[] => {
	const data = (navigator as Navigator & {userAgentData?: {brands?: IUserAgentBrand[]}}).userAgentData;
	return data?.brands ?? [];
};

/**
 * Определяет браузер, чтобы показать инструкцию именно про него.
 * Порядок проверок важен: Edge/Opera/Yandex тоже пишут в UA слово Chrome.
 */
export const detectBrowser = (): TBrowser => {
	if (typeof navigator === 'undefined') return 'unknown';

	const brands = brandsOf().map((b) => b.brand.toLowerCase()).join(' ');
	if (brands.includes('microsoft edge')) return 'edge';
	if (brands.includes('opera')) return 'opera';
	if (brands.includes('yandex')) return 'yandex';

	const ua = navigator.userAgent;
	if (/Firefox\/|FxiOS/.test(ua)) return 'firefox';
	if (/Edg[A-Z]?\//.test(ua)) return 'edge';
	if (/YaBrowser/.test(ua)) return 'yandex';
	if (/OPR\/|Opera/.test(ua)) return 'opera';
	if (/Chrome\/|CriOS/.test(ua)) return 'chrome';
	// Safari определяем последним: его строку копируют все остальные.
	if (/Safari\//.test(ua)) return 'safari';
	if (brands.includes('chromium') || brands.includes('google chrome')) return 'chrome';
	return 'unknown';
};
