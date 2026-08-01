import React from 'react';
import {clamp} from 'lodash';
import {computed, observable, runInAction} from 'mobx';

// Выше 3x бэкбуфер растить бессмысленно: на глаз разницы уже нет, а площадь (и
// вместе с ней нагрузка на GPU) растёт квадратично.
const maxResolution = 3;

const readResolution = (): number => clamp(window.devicePixelRatio || 1, 1, maxResolution);

const readWindowSize = () => ({
	width: Math.max(1, Math.round(window.innerWidth || 0)),
	height: Math.max(1, Math.round(window.innerHeight || 0)),
});

/**
 * Размеры сцены. Живут отдельно от window.innerWidth по двум причинам.
 *
 * Во-первых, канвас должен совпадать с тем прямоугольником, в котором он реально
 * лежит: в фуллскрине, при выезжающей адресной строке на мобильном и внутри
 * любого контейнера это не то же самое, что размер окна.
 *
 * Во-вторых, они observable. Весь стол считает координаты от ширины и высоты, и
 * до этого пересчёт происходил только при перерисовке по игровым событиям — окно
 * растянули, а сцена осталась в координатах первого кадра, растянутая по CSS с
 * чужим соотношением сторон.
 */
class Viewport {
	@observable width: number;
	@observable height: number;
	@observable resolution: number;

	private element: HTMLElement | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private resolutionQuery: MediaQueryList | null = null;
	private resolutionListener: (() => void) | null = null;
	private frame: number | null = null;

	constructor() {
		const {width, height} = readWindowSize();
		this.width = width;
		this.height = height;
		this.resolution = readResolution();
	}

	// Короткая сторона — общий масштаб стола: круг игроков вписан в обе оси
	// сразу, поэтому размеры бейджей и карт нельзя считать от одной ширины.
	@computed get shortSide(): number {
		return Math.min(this.width, this.height);
	}

	@computed get aspectRatio(): number {
		return this.width / this.height;
	}

	@computed get isPortrait(): boolean {
		return this.height >= this.width;
	}

	/**
	 * Следим за размером конкретного элемента (контейнера канваса). Возвращает
	 * функцию отписки.
	 *
	 * ResizeObserver ловит любое изменение раскладки, а не только ресайз окна;
	 * слушатели окна нужны там, где размер элемента не меняется, а канвас всё же
	 * надо тронуть: смена ориентации и DPI.
	 */
	observe(element: HTMLElement | null): () => void {
		this.disconnect();
		this.element = element;

		if (element && typeof ResizeObserver === 'function') {
			this.resizeObserver = new ResizeObserver(this.schedule);
			this.resizeObserver.observe(element);
		}
		window.addEventListener('resize', this.schedule);
		window.addEventListener('orientationchange', this.schedule);
		window.visualViewport?.addEventListener('resize', this.schedule);
		this.watchResolution();

		this.measure();
		return () => this.disconnect();
	}

	disconnect() {
		if (this.frame !== null) {
			window.cancelAnimationFrame(this.frame);
			this.frame = null;
		}
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		window.removeEventListener('resize', this.schedule);
		window.removeEventListener('orientationchange', this.schedule);
		window.visualViewport?.removeEventListener('resize', this.schedule);
		this.unwatchResolution();
		this.element = null;
	}

	// Замер откладываем до кадра: за один драг рамки окна событий прилетают
	// десятки, а пересчёт стола нужен ровно один раз перед отрисовкой.
	private schedule = () => {
		if (this.frame !== null) return;
		this.frame = window.requestAnimationFrame(() => {
			this.frame = null;
			this.measure();
		});
	};

	// Публичный синхронный замер — для тестов и для случаев, когда результат
	// нужен прямо сейчас, не дожидаясь кадра.
	measure = () => {
		const fallback = readWindowSize();
		const rect = this.element ? this.element.getBoundingClientRect() : null;
		// Пока элемент схлопнут (например, скрыт), доверяем окну: нулевой канвас
		// уронил бы рендерер.
		const width = rect && rect.width >= 1 ? Math.round(rect.width) : fallback.width;
		const height = rect && rect.height >= 1 ? Math.round(rect.height) : fallback.height;
		const resolution = readResolution();

		if (width === this.width && height === this.height && resolution === this.resolution) return;
		runInAction(() => {
			this.width = width;
			this.height = height;
			this.resolution = resolution;
		});
	};

	// Смену devicePixelRatio (зум страницы, переезд окна на монитор с другим DPI)
	// событие resize приносит не всегда, а медиазапрос — всегда. Запрос привязан
	// к текущему значению, поэтому после срабатывания его надо перевесить.
	private watchResolution() {
		if (typeof window.matchMedia !== 'function') return;
		const query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
		const listener = () => {
			this.schedule();
			this.unwatchResolution();
			this.watchResolution();
		};
		if (typeof query.addEventListener === 'function') {
			query.addEventListener('change', listener);
		} else {
			query.addListener(listener);
		}
		this.resolutionQuery = query;
		this.resolutionListener = listener;
	}

	private unwatchResolution() {
		const query = this.resolutionQuery;
		const listener = this.resolutionListener;
		if (!query || !listener) return;
		if (typeof query.removeEventListener === 'function') {
			query.removeEventListener('change', listener);
		} else {
			query.removeListener(listener);
		}
		this.resolutionQuery = null;
		this.resolutionListener = null;
	}
}

export const viewport = new Viewport();

/**
 * Вешает наблюдение на элемент, размер которого и есть размер сцены.
 * Элемент должен быть в потоке независимо от канваса (абсолютное
 * позиционирование), иначе ResizeObserver зациклится: замер → ресайз канваса →
 * новый замер.
 */
export const useViewportElement = <T extends HTMLElement>(): React.RefObject<T> => {
	const ref = React.useRef<T>(null);
	React.useLayoutEffect(() => viewport.observe(ref.current), []);
	return ref;
};
