import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import type { GraphicsBehaviorThis } from "./behaviorTypes";

interface RectangleProps {
  xCoord: number;
  yCoord: number;
  width: number;
  height: number;
  color: number;
}

const TYPE = "Rectangle";
export const behavior = {
  customDisplayObject: (_props: RectangleProps) => new PIXI.Graphics(),
  customApplyProps: function(
    this: GraphicsBehaviorThis<RectangleProps>,
    instance: PIXI.Graphics,
    oldProps: RectangleProps | undefined,
    newProps: RectangleProps,
  ) {
    const { xCoord, yCoord, width, height, color } = newProps;
    if (typeof oldProps !== "undefined") {
      instance.clear();
    }
    instance.beginFill(color);
    instance.moveTo(xCoord, yCoord);
    instance.drawRect(xCoord, yCoord, width, height);

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
