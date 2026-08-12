import * as PIXI from 'pixi.js';

/**
 * Светотень кружка игрока — того самого «яйца», которым он сидит за столом.
 *
 * Цветные бейджи нарисованы шариками: свет падает сверху слева, тень уходит к
 * нижнему правому краю. Всё остальное, чем кружок бывает закрыт (карты статусов
 * — нечто, заражение, карантин, см. StatusSkin), нарисовано плоско, и рядом с
 * шариками читается наклейкой. Эта текстура кладётся поверх ЛЮБОГО кружка и
 * даёт им всем один и тот же свет с одной стороны.
 *
 * Второй слой — кант: сплошное затемнение по самому ободу. Без него край
 * кружка режется по тёмному столу ровной яркой границей, будто вырезан ножницами.
 *
 * Запекаем один раз в канвас: градиентов у PIXI.Graphics нет, а держать ради
 * этого картинку в ресурсах незачем — светотень целиком описывается числами ниже.
 */

// Где стоит источник света, в долях размера от левого верхнего угла.
const lightX = 0.34;
const lightY = 0.3;
// Насколько ярок блик и как далеко он расходится (в долях размера). Блик тут
// именно блик, а не белая заливка поверх: широкое и яркое пятно смылит и
// картинку карты, и рисунок самого бейджа.
const highlightAlpha = 0.1;
const highlightEdge = 0.28;
// Насколько густа тень на дальней от света стороне. Тень здесь — намёк на
// сторону света, а не затемнение: густую видно как грязь поверх картинки.
const shadeAlpha = 0.12;
// Кант: с какой доли радиуса он начинается и насколько тёмен у самого края. Он
// только снимает резкость границы — заметить его нельзя, можно лишь заметить,
// что без него край режет глаз. Поэтому начинается далеко от края и набирает
// силу плавно: узкая тёмная полоса по ободу читается нарисованной обводкой.
const rimFrom = 0.35;
const rimAlpha = 0.07;
// Промежуточная точка того же канта: до середины своей ширины его нет вовсе, и
// только у самого края он чуть темнеет. Прямой градиент дал бы ровное серое
// кольцо — глаз ловит его как контур.
const rimMidStop = 0.62;
const rimMidAlpha = 0.01;

let cached: PIXI.Texture | null = null;

export const sphereShadeTexture = (size = 256): PIXI.Texture => {
	if (cached) return cached;

	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Нет 2d-контекста для светотени кружка');

	const radius = size / 2;
	// Заливаем только сам эллипс: за его пределами текстура должна остаться
	// прозрачной, иначе светотень вылезет углами за кружок.
	const fillEllipse = (style: CanvasGradient) => {
		context.fillStyle = style;
		context.beginPath();
		context.ellipse(radius, radius, radius, radius, 0, 0, Math.PI * 2);
		context.fill();
	};

	// Свет: от источника — блик, дальше чистая картинка, а у противоположного
	// края тень. Центр градиента у света, поэтому тень ложится гуще именно с
	// дальней стороны — так же, как нарисована на цветных бейджах.
	const light = context.createRadialGradient(
		size * lightX, size * lightY, 0,
		size * lightX, size * lightY, size,
	);
	light.addColorStop(0, `rgba(255, 255, 255, ${highlightAlpha})`);
	light.addColorStop(highlightEdge, 'rgba(255, 255, 255, 0)');
	light.addColorStop(1, `rgba(0, 0, 0, ${shadeAlpha})`);
	fillEllipse(light);

	// Кант — уже вокруг всего кружка, а не от света: край должен уходить в
	// темноту со всех сторон одинаково.
	const rim = context.createRadialGradient(radius, radius, radius * rimFrom, radius, radius, radius);
	rim.addColorStop(0, 'rgba(0, 0, 0, 0)');
	rim.addColorStop(rimMidStop, `rgba(0, 0, 0, ${rimMidAlpha})`);
	rim.addColorStop(1, `rgba(0, 0, 0, ${rimAlpha})`);
	fillEllipse(rim);

	cached = PIXI.Texture.from(canvas);
	return cached;
};
