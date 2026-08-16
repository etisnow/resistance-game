import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import type { GraphicsBehaviorThis } from "./behaviorTypes";

/**
 * Пунктирное кольцо, по которому бегут штрихи. Тот же смысл, что у спиннера, —
 * «идёт, ждём», — но обводкой уже нарисованной фигуры: кружка игрока или
 * кружка миссии на треке.
 *
 * Бежит не поворотом объекта, а сдвигом самих штрихов: кружок игрока — не круг,
 * а вытянутое «яйцо» (см. badgeAspect), и повёрнутый эллипс кувыркался бы вокруг
 * своего хозяина. Поэтому кольцо каждый кадр перерисовывается с новой фазой —
 * штрихов немного, это дешевле любой маски.
 */
interface DashedRingProps {
  rx: number;
  ry: number;
  thickness: number;
  color: number;
  // Сколько штрихов укладывается по кругу и какую долю шага занимает сам штрих.
  dashes?: number;
  dashShare?: number;
  // Оборотов в секунду; ноль — пунктир стоит.
  speed?: number;
  // Заливка внутри кольца — как у Ring: ноль прозрачности значит «пусто».
  fillColor?: number;
  fillAlpha?: number;
}

const defaultDashes = 14;
const defaultDashShare = 0.55;
const defaultSpeed = 0.28;
// На сколько отрезков ломается сам штрих: дуга эллипса прямой не рисуется.
const dashSegments = 5;

type TDashedRingConfig = Required<Omit<DashedRingProps, 'fillColor'>> & {fillColor: number};

class DashedRingGraphics extends PIXI.Graphics {
  // Публичным полем, а не пропом: props react-pixi-fiber раскладывает прямо по
  // объекту, а рисовать надо каждый кадр и из тикера.
  config: TDashedRingConfig = {
    rx: 0,
    ry: 0,
    thickness: 1,
    color: 0xFFFFFF,
    dashes: defaultDashes,
    dashShare: defaultDashShare,
    speed: defaultSpeed,
    fillColor: 0xFFFFFF,
    fillAlpha: 0,
  };
  private phase = 0;

  redraw() {
    const {rx, ry, thickness, color, dashes, dashShare, fillColor, fillAlpha} = this.config;
    this.clear();
    if (rx <= 0 || ry <= 0 || dashes <= 0) return;
    if (fillAlpha > 0) {
      this.beginFill(fillColor, fillAlpha);
      this.drawEllipse(0, 0, rx, ry);
      this.endFill();
    }
    this.lineStyle(thickness, color, 1);
    const step = (Math.PI * 2) / dashes;
    const dash = step * dashShare;
    for (let i = 0; i < dashes; i++) {
      const from = this.phase + i * step;
      for (let s = 0; s <= dashSegments; s++) {
        const t = from + (dash * s) / dashSegments;
        const x = Math.cos(t) * rx;
        const y = Math.sin(t) * ry;
        if (s === 0) this.moveTo(x, y);
        else this.lineTo(x, y);
      }
    }
  }

  // delta тикера — доля кадра при 60 fps, отсюда деление на 60.
  private run = (delta: number) => {
    if (!this.config.speed) return;
    this.phase += this.config.speed * 2 * Math.PI * delta / 60;
    this.redraw();
  };

  constructor() {
    super();
    PIXI.Ticker.shared.add(this.run);
  }

  override destroy(options?: {children?: boolean, texture?: boolean, baseTexture?: boolean}) {
    // Иначе тикер держит ссылку на уничтоженный Graphics и роняет отрисовку на
    // следующем же кадре.
    PIXI.Ticker.shared.remove(this.run);
    super.destroy(options);
  }
}

const TYPE = "DashedRing";
export const behavior = {
  customDisplayObject: (_props: DashedRingProps) => new DashedRingGraphics(),
  customApplyProps: function(
    this: GraphicsBehaviorThis<DashedRingProps>,
    instance: DashedRingGraphics,
    oldProps: DashedRingProps | undefined,
    newProps: DashedRingProps,
  ) {
    const {
      rx,
      ry,
      thickness,
      color,
      dashes = defaultDashes,
      dashShare = defaultDashShare,
      speed = defaultSpeed,
      fillColor = color,
      fillAlpha = 0,
    } = newProps;
    instance.config = {rx, ry, thickness, color, dashes, dashShare, speed, fillColor, fillAlpha};
    instance.redraw();

    this.applyDisplayObjectProps(oldProps, newProps);
  },
};

export default CustomPIXIComponent(behavior, TYPE);
