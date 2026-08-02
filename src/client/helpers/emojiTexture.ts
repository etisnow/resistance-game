import * as PIXI from 'pixi.js';

// Эмодзи на столе рисуем не текстом, а разово запечённой текстурой: PIXI.Text
// растеризует надпись заново на каждое изменение стиля, а значки на столе
// появляются и исчезают постоянно — на софтверном GL это заметно дорого.
const cache = new Map<string, PIXI.Texture>();

// Шрифты, в которых у эмодзи есть цветной глиф; последним — обычный запасной.
const emojiFont = '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';

export const emojiTexture = (emoji: string, size = 128): PIXI.Texture => {
	const key = `${emoji}:${size}`;
	const cached = cache.get(key);
	if (cached) return cached;

	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Нет 2d-контекста для эмодзи ' + emoji);
	context.font = `${Math.round(size * 0.78)}px ${emojiFont}`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillText(emoji, size / 2, size / 2);

	const texture = PIXI.Texture.from(canvas);
	cache.set(key, texture);
	return texture;
};
