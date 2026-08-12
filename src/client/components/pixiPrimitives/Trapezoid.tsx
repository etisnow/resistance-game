import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import type { GraphicsBehaviorThis } from "./behaviorTypes";
import { perspectiveEdges } from "client/helpers/perspective";

// Заливка той же трапеции, в которой лежат на столе карты (см.
// PerspectiveTexture): ею рисуются торцы карт в колоде.
interface TrapezoidProps {
	// Ширина посередине и высота — как у карты, поверх которой она лежит.
	width: number;
	height: number;
	taper: number;
	color: number;
	yCoord?: number;
}

type IRestProps = Record<string, unknown>;

const TYPE = "Trapezoid";
export const behavior = {
	customDisplayObject: (_props: TrapezoidProps) => new PIXI.Graphics(),
	customApplyProps: function(
		this: GraphicsBehaviorThis<IRestProps>,
		instance: PIXI.Graphics,
		oldProps: TrapezoidProps | undefined,
		newProps: TrapezoidProps,
	) {
		const { width, height, taper, color, yCoord = 0 } = newProps;
		if (typeof oldProps !== "undefined") {
			instance.clear();
		}
		const { near, far } = perspectiveEdges(width, taper);
		const top = yCoord - height / 2;
		const bottom = yCoord + height / 2;
		instance.beginFill(color);
		instance.drawPolygon([
			-far / 2, top,
			far / 2, top,
			near / 2, bottom,
			-near / 2, bottom,
		]);
		instance.endFill();

		// Свои пропсы дальше не пускаем: width и height у любого DisplayObject —
		// это масштаб, и pixi растянул бы ими уже нарисованную фигуру ещё раз.
		const {width: _width, height: _height, taper: _taper, color: _color, yCoord: _yCoord, ...rest} =
			newProps as TrapezoidProps & IRestProps;
		const {width: _oldWidth, height: _oldHeight, taper: _oldTaper, color: _oldColor, yCoord: _oldY, ...oldRest} =
			(oldProps ?? {}) as TrapezoidProps & IRestProps;
		this.applyDisplayObjectProps(oldRest, rest);
	},
};

export default CustomPIXIComponent(behavior, TYPE);
