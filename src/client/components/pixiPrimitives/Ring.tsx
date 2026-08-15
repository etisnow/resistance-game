import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import type { GraphicsBehaviorThis } from "./behaviorTypes";

// Кольцо: обводка и (необязательно) заливка внутри. Отдельным примитивом, а не
// пропами Circle: props отсюда раскладываются прямо по объекту PIXI, и толщина
// линии, названная как поле Graphics, вела бы себя непредсказуемо (та же грабля,
// что и у Plate).
interface RingProps {
  r: number;
  thickness: number;
  color: number;
  // Заливка внутри кольца. Прозрачность нулевая — значит кольцо пустое.
  fillColor?: number;
  fillAlpha?: number;
}

const TYPE = "Ring";
export const behavior = {
  customDisplayObject: (_props: RingProps) => new PIXI.Graphics(),
  customApplyProps: function(
    this: GraphicsBehaviorThis<RingProps>,
    instance: PIXI.Graphics,
    oldProps: RingProps | undefined,
    newProps: RingProps,
  ) {
    const { r, thickness, color, fillColor = color, fillAlpha = 0 } = newProps;
    if (typeof oldProps !== "undefined") {
      instance.clear();
    }
    if (fillAlpha > 0) {
      instance.beginFill(fillColor, fillAlpha);
    }
    instance.lineStyle(thickness, color, 1);
    instance.drawCircle(0, 0, r);
    if (fillAlpha > 0) {
      instance.endFill();
    }

    this.applyDisplayObjectProps(oldProps, newProps);
  },
};

export default CustomPIXIComponent(behavior, TYPE);
