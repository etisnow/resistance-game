import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import type { GraphicsBehaviorThis } from "./behaviorTypes";

/**
 * Перекрестие поверх лица: Убийца взял этого игрока на прицел (FR-15). Не
 * уголки, какими стол отмечает ходящего (см. Reticle), — уголки говорят «сейчас
 * его очередь», а здесь речь ровно о противоположном.
 *
 * Кольцо с четырьмя штрихами внутрь и точкой в середине: узнаваемая оптика, и
 * читается она даже поверх пёстрой аватарки — за счёт того, что под каждой
 * линией лежит тёмная подложка вдвое толще.
 */
interface CrosshairProps {
  rx: number;
  ry: number;
  thickness: number;
  color: number;
  // Доля радиуса, с которой начинается штрих: 1 — от самого кольца, 0 — от центра.
  tickShare?: number;
  // Радиус точки в середине, в долях rx.
  dotShare?: number;
}

const defaultTickShare = 0.42;
const defaultDotShare = 0.08;
// Подложка под линиями: тёмная и толще самой линии. Без неё перекрестие теряется
// на светлых местах лица.
const shadowColor = 0x140406;
const shadowShare = 2.4;
const shadowAlpha = 0.55;
// На сколько отрезков ломается дуга кольца: прямыми её не нарисовать.
const ringSegments = 48;

class CrosshairGraphics extends PIXI.Graphics {
  config: Required<CrosshairProps> = {
    rx: 0,
    ry: 0,
    thickness: 2,
    color: 0xFFFFFF,
    tickShare: defaultTickShare,
    dotShare: defaultDotShare,
  };

  redraw() {
    const {rx, ry, thickness, color, tickShare, dotShare} = this.config;
    this.clear();
    if (rx <= 0 || ry <= 0 || thickness <= 0) return;

    // Сначала вся подложка, потом всё перекрестие: иначе тень одной линии легла
    // бы поверх соседней.
    for (const isShadow of [true, false]) {
      const width = isShadow ? thickness * shadowShare : thickness;
      const paint = isShadow ? shadowColor : color;
      const alpha = isShadow ? shadowAlpha : 1;
      this.lineStyle(width, paint, alpha);
      for (let i = 0; i <= ringSegments; i++) {
        const t = (i / ringSegments) * Math.PI * 2;
        const x = Math.cos(t) * rx;
        const y = Math.sin(t) * ry;
        if (i === 0) this.moveTo(x, y);
        else this.lineTo(x, y);
      }
      // Штрихи по четырём сторонам — от кольца внутрь, не смыкаясь в центре.
      this.moveTo(0, -ry); this.lineTo(0, -ry * tickShare);
      this.moveTo(0, ry); this.lineTo(0, ry * tickShare);
      this.moveTo(-rx, 0); this.lineTo(-rx * tickShare, 0);
      this.moveTo(rx, 0); this.lineTo(rx * tickShare, 0);
      this.lineStyle(0);
      this.beginFill(paint, alpha);
      this.drawCircle(0, 0, rx * dotShare * (isShadow ? shadowShare * 0.7 : 1));
      this.endFill();
    }
  }

  constructor() {
    super();
  }
}

const TYPE = "Crosshair";
export const behavior = {
  customDisplayObject: (_props: CrosshairProps) => new CrosshairGraphics(),
  customApplyProps: function(
    this: GraphicsBehaviorThis<CrosshairProps>,
    instance: CrosshairGraphics,
    oldProps: CrosshairProps | undefined,
    newProps: CrosshairProps,
  ) {
    const {rx, ry, thickness, color, tickShare = defaultTickShare, dotShare = defaultDotShare} = newProps;
    instance.config = {rx, ry, thickness, color, tickShare, dotShare};
    instance.redraw();

    this.applyDisplayObjectProps(oldProps, newProps);
  },
};

export default CustomPIXIComponent(behavior, TYPE);
