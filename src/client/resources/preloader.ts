import * as PIXI from 'pixi.js';
import {resources} from 'client/resources/resources';

// Стартовая загрузка всех картинок в кэш PIXI. Без неё Texture.from() в
// компонентах создаёт текстуру «на лету»: карта появляется пустым прямоугольником
// и дорисовывается через сотни миллисекунд — на раздаче руки это видно.
//
// NOTE: греем именно через Texture.from, а не через PIXI.Loader. Компоненты
// (Card, PlayerBadge, notifier) берут текстуры тем же вызовом, часть — прямо при
// импорте модуля, то есть ДО прелоада. Loader клал бы в кэш вторую запись по тому
// же url и ругался «Texture added to the cache … that already had an entry».

// Сколько ждём загрузку, прежде чем пустить игрока дальше. Один зависший запрос
// не должен запирать лобби навсегда — недогруженное дорисуется по ходу игры.
const LOAD_TIMEOUT = 20000;

// resources — дерево из строк-URL и вложенных объектов (playerBadges).
const collectUrls = (node: unknown, out: Set<string>): Set<string> => {
	if (typeof node === 'string') {
		out.add(node);
	} else if (node && typeof node === 'object') {
		for (const value of Object.values(node)) collectUrls(value, out);
	}
	return out;
};

// Резолвится и на ошибке: битый файл не должен останавливать загрузку остальных.
const warmTexture = (url: string): Promise<void> => {
	return new Promise<void>((resolve) => {
		const {baseTexture} = PIXI.Texture.from(url);
		if (baseTexture.valid) {
			resolve();
			return;
		}
		baseTexture.once('loaded', () => resolve());
		baseTexture.once('error', () => resolve());
	});
};

/**
 * Грузит все ассеты игры в кэш PIXI.
 * onProgress получает долю готового от 0 до 1.
 */
export const preloadAssets = (onProgress?: (progress: number) => void): Promise<void> => {
	const urls = [...collectUrls(resources, new Set<string>())];
	const total = urls.length;

	if (total === 0) {
		onProgress?.(1);
		return Promise.resolve();
	}
	onProgress?.(0);

	let done = 0;
	const loaded = Promise.all(urls.map((url) => warmTexture(url).then(() => {
		done += 1;
		onProgress?.(done / total);
	}))).then(() => undefined);

	const timeout = new Promise<void>((resolve) => {
		globalThis.setTimeout(resolve, LOAD_TIMEOUT);
	});

	return Promise.race([loaded, timeout]);
};
