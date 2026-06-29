import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import type { GraphicsBehaviorThis } from "./behaviorTypes";

interface CircleProps {
  // xCoord/yCoord are optional: callers may omit them, in which case PIXI treats the
  // coordinates as 0 (preserving the prior untyped behaviour).
  xCoord?: number;
  yCoord?: number;
  r: number;
  color: number;
}

const TYPE = "Circle";
export const behavior = {
  customDisplayObject: (_props: CircleProps) => new PIXI.Graphics(),
  customApplyProps: function(
    this: GraphicsBehaviorThis<CircleProps>,
    instance: PIXI.Graphics,
    oldProps: CircleProps | undefined,
    newProps: CircleProps,
  ) {
    const { xCoord = 0, yCoord = 0, r, color } = newProps;
    if (typeof oldProps !== "undefined") {
      instance.clear();
    }
    instance.beginFill(color);
    instance.moveTo(xCoord, yCoord);
    instance.drawCircle(xCoord, yCoord, r);

    instance.endFill();

    this.applyDisplayObjectProps(oldProps, newProps);
  },
};

export default CustomPIXIComponent(behavior, TYPE);



/*
    instance.beginFill(color);
    instance.moveTo(xCoord, yCoord);
    instance.drawCircle(xCoord, yCoord, r);

    instance.endFill();*/
