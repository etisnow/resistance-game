import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import {degToRag} from 'client/helpers/roomHelpers';
import type { GraphicsBehaviorThis } from "./behaviorTypes";

interface ArrowProps {
	color: number;
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
	tailX: number;
	tailY: number;
	tailHeight: number;
	tailRotation: number;
}

const getCirclePoint = (radius: number, deg: number, centerX: number, centerY: number) => {
	const currentRad = degToRag(deg);
	const x = radius*Math.cos(currentRad) + centerX;
	const y = radius*Math.sin(currentRad) + centerY;
	return {x,y};
}


const drawArrowHead = (
	instance: PIXI.Graphics,
	color: number,
	tipX: number,
	tipY: number,
	height: number,
	rotation: number,
) => {
	const {x: leftX, y:leftY} = getCirclePoint(height, rotation + 90 - 15, tipX, tipY);
	const {x: rightX, y:rightY} = getCirclePoint(height, rotation + 90 + 15, tipX, tipY);
	instance.lineStyle(0, color);
	instance.beginFill(color, 1);
	instance.moveTo(tipX, tipY);
	instance.lineTo(leftX, leftY);
	instance.lineTo(rightX, rightY);
	instance.endFill();
}

const TYPE = "Arrow";
export const behavior = {
  customDisplayObject: (_props: ArrowProps) => new PIXI.Graphics(),
  customApplyProps: function(
    this: GraphicsBehaviorThis<ArrowProps>,
    instance: PIXI.Graphics,
    oldProps: ArrowProps | undefined,
    newProps: ArrowProps,
  ) {
    const { color, ax, ay,mid1X, mid1Y, mid2X, mid2Y, bx, by, arrowX, arrowY, arrowHeight, arrowRotation, tailX, tailY, tailHeight, tailRotation } = newProps;
    if (typeof oldProps !== "undefined") {
      instance.clear();
    }
    instance.lineStyle(2, color);
    instance.moveTo(ax, ay);
    instance.bezierCurveTo(mid1X, mid1Y, mid2X, mid2Y, bx, by)

    drawArrowHead(instance, color, arrowX, arrowY, arrowHeight, arrowRotation);
    if (tailHeight > 0) {
      drawArrowHead(instance, color, tailX, tailY, tailHeight, tailRotation);
    }

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
