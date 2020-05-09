// components/Rectangle.js
import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";

const TYPE = "Arrow";
export const behavior = {
	customDisplayObject: props => new PIXI.Graphics(),
	customApplyProps: function(instance, oldProps, newProps) {
	    if (typeof oldProps !== "undefined") {
	      instance.clear();
	    }
		const {
			ax,
			ay,
			bx,
			by,
			mid1X,
			mid1Y,
			mid2X,
			mid2Y,
			arrowX,
			arrowY,
			arrowRotation,
			arrowHeight,
			color
		} = newProps;
		console.log('ARROW!!!!!!!!!!!!!!', newProps)

		//const { fill, x, y, width, height } = newProps;
		instance
			.clear()
			.lineStyle(2, color)
			.moveTo(ax, ay)
			.bezierCurveTo(mid1X, mid1Y, mid2X, mid2Y, bx, by)
			.endFill();
	}
};
export default CustomPIXIComponent(behavior, TYPE);
