import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";

const TYPE = "Circle";
export const behavior = {
  customDisplayObject: props => new PIXI.Graphics(),
  customApplyProps: function(instance, oldProps, newProps) {
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
