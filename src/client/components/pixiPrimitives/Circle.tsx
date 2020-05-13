import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";

const TYPE = "Circle";
export const behavior = {
  customDisplayObject: props => new PIXI.Graphics(),
  customApplyProps: function(instance, oldProps, newProps) {
    const { xCoord, yCoord, r, color } = newProps;
    console.log('CIRCLE')
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
