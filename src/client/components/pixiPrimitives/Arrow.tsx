import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import {degToRag} from 'client/helpers/roomHelpers';

const getCirclePoint = (radius, deg, centerX, centerY) => {
	const currentRad = degToRag(deg);
	const x = radius*Math.cos(currentRad) + centerX;
	const y = radius*Math.sin(currentRad) + centerY;
	return {x,y};
}


const TYPE = "Arrow";
export const behavior = {
  customDisplayObject: props => new PIXI.Graphics(),
  customApplyProps: function(instance, oldProps, newProps) {
    const { color, ax, ay,mid1X, mid1Y, mid2X, mid2Y, bx, by, arrowX, arrowY, arrowHeight, arrowRotation } = newProps;
    if (typeof oldProps !== "undefined") {
      instance.clear();
    }
    instance.lineStyle(2, color);
    instance.moveTo(ax, ay);
    instance.bezierCurveTo(mid1X, mid1Y, mid2X, mid2Y, bx, by)

    const {x: leftX, y:leftY} = getCirclePoint(arrowHeight, arrowRotation + 90 - 15, arrowX, arrowY);
    const {x: rightX, y:rightY} = getCirclePoint(arrowHeight, arrowRotation + 90 + 15, arrowX, arrowY);
    instance.lineStyle(0, color);
    instance.beginFill(color, 1);
    instance.moveTo(arrowX, arrowY);
    instance.lineTo(leftX, leftY);
    instance.lineTo(rightX, rightY);
    instance.endFill();

    this.applyDisplayObjectProps(oldProps, newProps);
  },
};

export default CustomPIXIComponent(behavior, TYPE);



//instance
//	//.clear()
//	.lineStyle(2, color)
//	.moveTo(ax, ay)
//	.bezierCurveTo(mid1X, mid1Y, mid2X, mid2Y, bx, by)
//	.endFill();
