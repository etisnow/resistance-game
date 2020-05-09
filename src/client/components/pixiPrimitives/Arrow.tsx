import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";

const TYPE = "Arrow";
export const behavior = {
  customDisplayObject: props => new PIXI.Graphics(),
  customApplyProps: function(instance, oldProps, newProps) {
    const { color, ax, ay,mid1X, mid1Y, mid2X, mid2Y, bx, by } = newProps;
    if (typeof oldProps !== "undefined") {
      instance.clear();
    }
    instance.lineStyle(2, color);
    instance.moveTo(ax, ay);
    instance.drawCircle(bx, by, 20);
    instance.bezierCurveTo(mid1X, mid1Y, mid2X, mid2Y, bx, by)

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
