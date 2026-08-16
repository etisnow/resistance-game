import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import type { GraphicsBehaviorThis } from "./behaviorTypes";

// Спиннер: бледное кольцо и бегущая по нему яркая дуга. Смысл тот же, что у
// любого спиннера — «занято, ждём», и на столе он нужен ровно там, где ждут
// ответа игрока.
//
// Крутится сам, от общего тикера pixi, а не пружиной и не таймером в React:
// перерисовывать дерево ради поворота одной дуги — дорого и незачем, тут нет
// перехода из состояния в состояние, только бесконечное ожидание.
interface SpinnerProps {
  r: number;
  thickness: number;
  color: number;
  // Длина дуги в долях полного оборота.
  arc?: number;
  // Насколько виден «след» — кольцо под дугой. Ноль — одна голая дуга.
  trackAlpha?: number;
  // Оборотов в секунду; знак задаёт сторону вращения.
  speed?: number;
}

const defaultArc = 0.3;
const defaultTrackAlpha = 0.2;
const defaultSpeed = 0.85;

class SpinnerGraphics extends PIXI.Graphics {
  // Публичное поле, а не проп: props react-pixi-fiber раскладывает прямо по
  // объекту, и скорость приезжает сюда из customApplyProps.
  turnsPerSecond = defaultSpeed;

  // delta тикера — доля кадра при 60 fps, отсюда деление на 60.
  private spin = (delta: number) => {
    this.rotation += this.turnsPerSecond * 2 * Math.PI * delta / 60;
  };

  constructor() {
    super();
    PIXI.Ticker.shared.add(this.spin);
  }

  override destroy(options?: {children?: boolean, texture?: boolean, baseTexture?: boolean}) {
    // Иначе тикер держит ссылку на уничтоженный Graphics и роняет отрисовку на
    // следующем же кадре.
    PIXI.Ticker.shared.remove(this.spin);
    super.destroy(options);
  }
}

const TYPE = "Spinner";
export const behavior = {
  customDisplayObject: (_props: SpinnerProps) => new SpinnerGraphics(),
  customApplyProps: function(
    this: GraphicsBehaviorThis<SpinnerProps>,
    instance: SpinnerGraphics,
    oldProps: SpinnerProps | undefined,
    newProps: SpinnerProps,
  ) {
    const {
      r,
      thickness,
      color,
      arc = defaultArc,
      trackAlpha = defaultTrackAlpha,
      speed = defaultSpeed,
    } = newProps;
    if (typeof oldProps !== "undefined") {
      instance.clear();
    }
    instance.turnsPerSecond = speed;
    if (trackAlpha > 0) {
      instance.lineStyle(thickness, color, trackAlpha);
      instance.drawCircle(0, 0, r);
    }
    instance.lineStyle(thickness, color, 1);
    // moveTo ровно в начало дуги: без него pixi дотянет линию из предыдущей
    // точки пути и через кольцо ляжет хорда.
    instance.moveTo(r, 0);
    instance.arc(0, 0, r, 0, arc * 2 * Math.PI);

    this.applyDisplayObjectProps(oldProps, newProps);
  },
};

export default CustomPIXIComponent(behavior, TYPE);
