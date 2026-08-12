import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import type { GraphicsBehaviorThis } from "./behaviorTypes";

interface EllipseProps {
  // xCoord/yCoord are optional: callers may omit them, in which case PIXI treats the
  // coordinates as 0 (same convention as Circle).
  xCoord?: number;
  yCoord?: number;
  rx: number;
  ry: number;
  color: number;
  // Прозрачность самой фигуры (свойство DisplayObject) — им гасят тени.
  alpha?: number;
}

const TYPE = "Ellipse";
export const behavior = {
  customDisplayObject: (_props: EllipseProps) => new PIXI.Graphics(),
  customApplyProps: function(
    this: GraphicsBehaviorThis<EllipseProps>,
    instance: PIXI.Graphics,
    oldProps: EllipseProps | undefined,
    newProps: EllipseProps,
  ) {
    const { xCoord = 0, yCoord = 0, rx, ry, color } = newProps;
    // Перерисовываем, только если фигура и правда изменилась: эллипсы висят на
    // каждом кружке игрока (тени, карта статуса), а стол пересчитывается на любой
    // мелочи — заново собирать их геометрию на каждый такой рендер незачем.
    const isSameShape = oldProps
      && oldProps.rx === rx && oldProps.ry === ry && oldProps.color === color
      && (oldProps.xCoord ?? 0) === xCoord && (oldProps.yCoord ?? 0) === yCoord;
    if (!isSameShape) {
      if (typeof oldProps !== "undefined") {
        instance.clear();
      }
      instance.beginFill(color);
      instance.drawEllipse(xCoord, yCoord, Math.max(0, rx), Math.max(0, ry));
      instance.endFill();
    }

    this.applyDisplayObjectProps(oldProps, newProps);
  },
};

export default CustomPIXIComponent(behavior, TYPE);
