import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import type { GraphicsBehaviorThis } from "./behaviorTypes";

// Прицел: четыре уголка вокруг цели, сама она остаётся открытой. Кольцом её
// было бы не обвести — на столе вокруг кружка и без того тесно (карантин,
// стрелки, летящие карты), а уголки читаются как наводка и не спорят с ними.
interface ReticleProps {
  // Расстояние от центра до угла — по нему прицел и сжимается к цели.
  spread: number;
  // Длина плеча уголка: от угла внутрь, по обеим осям.
  arm: number;
  // Радиус скругления самого угла. Скругление рисуем геометрией: скруглять стык
  // линий умеет lineStyle({join}), но в этой версии pixi его ещё нет.
  cornerRadius: number;
  thickness: number;
  color: number;
}

const corners = [
  {sx: -1, sy: -1},
  {sx: 1, sy: -1},
  {sx: -1, sy: 1},
  {sx: 1, sy: 1},
];

const TYPE = "Reticle";
export const behavior = {
  customDisplayObject: (_props: ReticleProps) => new PIXI.Graphics(),
  customApplyProps: function(
    this: GraphicsBehaviorThis<ReticleProps>,
    instance: PIXI.Graphics,
    oldProps: ReticleProps | undefined,
    newProps: ReticleProps,
  ) {
    const { spread, arm, cornerRadius, thickness, color } = newProps;
    // Скругление не длиннее самого плеча: иначе дуга съест прямые участки и от
    // уголка останется одна закорючка.
    const round = Math.min(cornerRadius, arm);
    if (typeof oldProps !== "undefined") {
      instance.clear();
    }
    instance.lineStyle(thickness, color);
    for (const { sx, sy } of corners) {
      const x = sx * spread;
      const y = sy * spread;
      // Уголок — одна ломаная со скруглённым стыком: плечо к углу, дуга вокруг
      // самого угла (он же опорная точка кривой), плечо от угла вбок.
      instance.moveTo(x, y - sy * arm);
      instance.lineTo(x, y - sy * round);
      instance.quadraticCurveTo(x, y, x - sx * round, y);
      instance.lineTo(x - sx * arm, y);
    }

    this.applyDisplayObjectProps(oldProps, newProps);
  },
};

export default CustomPIXIComponent(behavior, TYPE);
