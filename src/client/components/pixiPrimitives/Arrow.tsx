import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import {degToRag} from 'client/helpers/roomHelpers';
import type { GraphicsBehaviorThis } from "./behaviorTypes";

interface ArrowProps {
	arrowColor: number;
	ax: number;
	ay: number;
	mid1X: number;
	mid1Y: number;
	mid2X: number;
	mid2Y: number;
	bx: number;
	by: number;
	arrowX: number;
	arrowY: number;
	arrowHeight: number;
	arrowRotation: number;
}

const getCirclePoint = (radius: number, deg: number, centerX: number, centerY: number) => {
	const currentRad = degToRag(deg);
	const x = radius*Math.cos(currentRad) + centerX;
	const y = radius*Math.sin(currentRad) + centerY;
	return {x,y};
}


// Толщина линии стрелки: на тёмном столе тонкая линия теряется, тем более что
// идёт она по картинке комнаты, а не по чистому фону.
const lineThickness = 3;

const TYPE = "Arrow";
export const behavior = {
  customDisplayObject: (_props: ArrowProps) => new PIXI.Graphics(),
  customApplyProps: function(
    this: GraphicsBehaviorThis<ArrowProps>,
    instance: PIXI.Graphics,
    oldProps: ArrowProps | undefined,
    newProps: ArrowProps,
  ) {
    const { arrowColor: color, ax, ay,mid1X, mid1Y, mid2X, mid2Y, bx, by, arrowX, arrowY, arrowHeight, arrowRotation } = newProps;
    if (typeof oldProps !== "undefined") {
      instance.clear();
    }
    instance.lineStyle(lineThickness, color);
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
