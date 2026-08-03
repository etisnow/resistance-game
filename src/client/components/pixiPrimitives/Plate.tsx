import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import type { GraphicsBehaviorThis } from "./behaviorTypes";

// Подложка со скруглёнными краями — под короткую подпись поверх чего угодно.
// Рисуется вокруг начала координат, чтобы её можно было положить прямо под
// текст с anchor 0.5.
//
// Размеры называются plateWidth/plateHeight, а цвет — color: props отсюда
// раскладываются прямо по объекту PIXI, и width/height/fill попали бы в
// одноимённые свойства Graphics — первые два растянули бы саму подложку, а
// третье вообще только для чтения и роняет весь стол.
interface PlateProps {
  plateWidth: number;
  plateHeight: number;
  borderRadius: number;
  color: number;
}

const TYPE = "Plate";
export const behavior = {
  customDisplayObject: (_props: PlateProps) => new PIXI.Graphics(),
  customApplyProps: function(
    this: GraphicsBehaviorThis<PlateProps>,
    instance: PIXI.Graphics,
    oldProps: PlateProps | undefined,
    newProps: PlateProps,
  ) {
    const { plateWidth, plateHeight, borderRadius, color } = newProps;
    if (typeof oldProps !== "undefined") {
      instance.clear();
    }
    instance.beginFill(color);
    instance.drawRoundedRect(-plateWidth / 2, -plateHeight / 2, plateWidth, plateHeight, borderRadius);
    instance.endFill();

    this.applyDisplayObjectProps(oldProps, newProps);
  },
};

export default CustomPIXIComponent(behavior, TYPE);
