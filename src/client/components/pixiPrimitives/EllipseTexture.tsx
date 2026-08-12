import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import type { GraphicsBehaviorThis } from "./behaviorTypes";

/**
 * Картинка, вписанная в эллипс: заливка эллипса текстурой, а не спрайт с ней.
 *
 * Спрайт остался бы прямоугольником и торчал бы углами за кружок игрока, а
 * маска в pixi требует держать графику отдельным объектом в дереве и следить за
 * её трансформом. Graphics умеет заливать фигуру текстурой сам — этого хватает.
 *
 * Картинка вписывается «по большей стороне»: заполняет эллипс целиком, лишнее
 * уходит за край. Так она не растягивается под чужие пропорции.
 *
 * focus выбирает, какой её кусок должен попасть в кадр: у карты это не вся
 * карта с заголовком и текстом, а только сама иллюстрация. Кадрируем матрицей
 * заливки, а не отдельной текстурой с frame: та требует загруженной картинки в
 * момент создания и падает, если кадр не влез в ещё не известный ей размер.
 */

interface IFocus {
	// Кусок картинки, который надо показать, — в долях её размеров.
	x: number;
	y: number;
	width: number;
	height: number;
}

interface EllipseTextureProps {
	rx: number;
	ry: number;
	texture: PIXI.Texture;
	focus?: IFocus;
	alpha?: number;
}

const wholeTexture: IFocus = {x: 0, y: 0, width: 1, height: 1};

const TYPE = "EllipseTexture";
export const behavior = {
	customDisplayObject: (_props: EllipseTextureProps) => new PIXI.Graphics(),
	customApplyProps: function(
		this: GraphicsBehaviorThis<EllipseTextureProps>,
		instance: PIXI.Graphics,
		oldProps: EllipseTextureProps | undefined,
		newProps: EllipseTextureProps,
	) {
		const { rx, ry, texture, focus = wholeTexture } = newProps;
		if (typeof oldProps !== "undefined") {
			instance.clear();
		}
		// Пока картинка не догрузилась, её размеры — нули: заливать по ним нечего,
		// а перерисуется бейдж и без того (стол пересчитывает его на каждом ходе).
		const width = Math.max(1, texture.width);
		const height = Math.max(1, texture.height);
		// Масштаб — по кадру, а не по всей картинке: в эллипс должен влезть именно он.
		const cover = Math.max((rx * 2) / (width * focus.width), (ry * 2) / (height * focus.height));
		// И сдвиг такой, чтобы середина кадра пришлась на середину эллипса.
		const matrix = new PIXI.Matrix()
			.scale(cover, cover)
			.translate(
				-(focus.x + focus.width / 2) * width * cover,
				-(focus.y + focus.height / 2) * height * cover,
			);

		instance.beginTextureFill({ texture, matrix });
		instance.drawEllipse(0, 0, Math.max(0, rx), Math.max(0, ry));
		instance.endFill();

		this.applyDisplayObjectProps(oldProps, newProps);
	},
};

export default CustomPIXIComponent(behavior, TYPE);
