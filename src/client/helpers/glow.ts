import * as PIXI from 'pixi.js';

/**
 * Свечение по кромке круга: середина остаётся чистой, светится только край и
 * воздух вокруг него. Пятном свет закрывал бы собой то, что подсвечивает, — а
 * подсветить надо кружок миссии, не пряча ни знака, ни точек в нём.
 *
 * Белое нарочно: спрайт с ним красится tint'ом в цвет того, что подсвечивает, —
 * зелёный у выполненной миссии, красный у сорванной.
 *
 * Печём в канвас один раз, как и стекло кружка (см. sphereShade): градиентов у
 * PIXI.Graphics нет, а картинке в ресурсах тут делать нечего — свечение целиком
 * описывается числами ниже.
 */

// Где по радиусу спрайта проходит сама кромка. Половина: спрайт вдвое шире
// кружка, и на эту долю приходится его край (см. rimGlowShare у того, кто
// спрайт ставит).
const rimAt = 0.5;
// Насколько свет заходит внутрь кружка и наружу от него, в долях радиуса
// спрайта. Внутрь — чуть-чуть, только чтобы кромка не обрывалась ножом.
const inner = 0.12;
const outer = 0.3;
const rimAlpha = 1;
const innerAlpha = 0.18;
const outerAlpha = 0.3;

let cached: PIXI.Texture | null = null;

export const rimGlowTexture = (size = 256): PIXI.Texture => {
	if (cached) return cached;

	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Нет 2d-контекста для свечения кромки');

	const radius = size / 2;
	const gradient = context.createRadialGradient(radius, radius, 0, radius, radius, radius);
	gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
	gradient.addColorStop(Math.max(0, rimAt - inner), 'rgba(255, 255, 255, 0)');
	gradient.addColorStop(rimAt - inner / 2, `rgba(255, 255, 255, ${innerAlpha})`);
	gradient.addColorStop(rimAt, `rgba(255, 255, 255, ${rimAlpha})`);
	gradient.addColorStop(rimAt + outer / 2, `rgba(255, 255, 255, ${outerAlpha})`);
	gradient.addColorStop(Math.min(1, rimAt + outer), 'rgba(255, 255, 255, 0)');
	context.fillStyle = gradient;
	context.fillRect(0, 0, size, size);

	cached = PIXI.Texture.from(canvas);
	return cached;
};
