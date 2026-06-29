import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";

interface RoundedRectProps {
  fill: number;
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
  [key: string]: unknown;
}

type RoundedRectRest = Record<string, unknown>;

interface RoundedRectBehaviorThis {
  applyDisplayObjectProps(oldProps: RoundedRectRest, newProps: RoundedRectRest): void;
}

const TYPE = "RoundedRect";
export const behavior = {
  customDisplayObject: (_props: RoundedRectProps) => new PIXI.Graphics(),
  customApplyProps: function(
    this: RoundedRectBehaviorThis,
    instance: PIXI.Graphics,
    oldProps: RoundedRectProps,
    newProps: RoundedRectProps,
  ) {
    const { fill, x, y, width, height, borderRadius, ...newPropsRest } = newProps;
    const { fill: _oldFill, borderRadius: _oldRadius, ...oldPropsRest } = oldProps;
    if (typeof oldProps !== "undefined") {
      instance.clear();
    }
    instance.beginFill(fill);
	instance.drawRoundedRect(x,y,width,height,borderRadius);
	instance.endFill();

    this.applyDisplayObjectProps(oldPropsRest, newPropsRest);
  },
};

export default CustomPIXIComponent(behavior, TYPE);
