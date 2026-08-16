import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import { clamp } from "lodash";
import { turnTimerColor } from "client/helpers/turnColor";
import type { GraphicsBehaviorThis } from "./behaviorTypes";

/**
 * Прицел: четыре уголка вокруг цели, сама она остаётся открытой. Кольцом её
 * было бы не обвести — на столе вокруг кружка и без того тесно (жетоны голосов,
 * стрелки к команде, кольца миссии), а уголки читаются как наводка и не спорят
 * с ними.
 *
 * Он же часы: по контуру прицела бежит светящаяся стрелка. Полоски таймера
 * сверху экрана больше нет — время идёт здесь, на том, кого ждут.
 *
 * Часы эти показывают не остаток, а ход времени. Остаток тут не работает:
 * отпущенные секунды выходят, а стол на этом не замирает — сервер отвечает за
 * молчащего сам и идёт дальше (см. askDecision), — и заполненная до края шкала
 * перестала бы что-либо значить. Стрелка вместо этого идёт по кругу вечно, а
 * сколько времени прошло, говорит цвет: он достаётся каждому кусочку контура в
 * тот миг, когда стрелка по нему прошла, и там остаётся до следующего её круга
 * (см. turnTimerColor).
 *
 * Идёт она по самим уголкам и только по ним: просветы между уголками — не часть
 * пути, и время в них не тратится. Дойдя до конца уголка, стрелка тут же
 * оказывается в начале следующего. Иначе на пустом месте она пропадала бы почти
 * на треть круга, и часы больше молчали бы, чем шли.
 */
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
  // Момент старта отсчёта (Date.now(); см. TimerController.startedAt). Ноль —
  // отсчёта нет, и прицел остаётся просто прицелом. Стрелку ведём от этой
  // отметки, а не от тикающих раз в секунду секунд: секунда — это шестьдесят
  // кадров, и по ним стрелка не шла бы, а прыгала.
  startedAt?: number;
}

// Сам прицел заметно тусклее стрелки: та идёт поверх, и спорить с ней прицелу
// незачем.
const reticleAlpha = 0.55;

// Круг стрелки — за столько секунд. Число ни к чему не привязано: отпущенные на
// решение секунды считает сервер, а часам важно другое — чтобы движение
// читалось, но не мельтешило на краю глаза.
const lapSeconds = 10;
// Шлейф ровно в круг: пройденное не гаснет, а так и остаётся гореть до тех пор,
// пока стрелка не пойдёт по нему снова и не перепишет его новым цветом. Круги
// разного цвета (см. turnTimerColor), поэтому граница между старым и новым — это
// и есть стрелка, и никакой другой отметки ей не нужно.
const trailLapSpan = 1;
const trailAlphaHead = 1;
// Голова чуть толще хвоста — по этому утолщению её видно и там, где соседние
// круги близки по цвету.
const trailWidthHead = 1.6;
const trailWidthFalloff = 0.8;
// Свечение: под самой линией идёт вторая, втрое толще и почти прозрачная. Ярче
// от простого поднятия яркости линия не станет — цвет у неё и так чистый, а
// толще её делать нельзя, прицел превратится в обод. Ореол же на тёмном столе
// читается именно как свет, и заодно смягчает край тонкой линии.
const glowWidthShare = 3;
const glowAlphaShare = 0.38;
// Дойдя до красного, цвет останавливается (см. turnTimerColor), и дальше тревогу
// набирает свет: следующий круг раздаёт ореолу лишнюю толщину — постепенно, той
// же стрелкой, кусочек за кусочком, — и на этом рост кончается. Круг, с которого
// он идёт, — сразу за последним цветным.
const glowGrowLap = 4;
const glowWidthMax = 4;

// Шаг разбиения контура: столько точек приходится на плечо уголка и столько же
// на само скругление. Кусочки выходят примерно по пикселю — крупнее нельзя: по
// ним разгорается голова стрелки, и ступени стали бы видны.
const armSamples = 16;
const cornerSamples = 16;
// Вырожденный отрезок пикси не переварит — нормаль в нём считать не из чего.
const minStrokeLength = 0.05;

/**
 * На сколько пути голова стрелки перетекает из цвета прошлого круга в свой.
 *
 * Без растяжки у головы жёсткий край, и вот что из этого выходит: весь контур
 * прицела — от силы четверть тысячи точек, и даже на быстром круге стрелка идёт
 * пару десятков точек в секунду, то есть меньше половины пикселя за кадр.
 * Сдвинуться плавно жёсткий край при такой скорости физически не может — он
 * через кадр-другой перекрашивает очередную точку из тусклой в яркую. На глаз
 * это ровно тем и выглядит: мерцающая точка, ползущая рывками.
 *
 * С растяжкой края нет вовсе: за кадр чуть меняется цвет сразу десятка точек, и
 * глаз читает это как непрерывное движение.
 */
const headFadeLength = 8;

// Смешение двух цветов по каналам. Нужно ровно на голове стрелки: там свежий
// цвет перетекает в тот, что лежал на этом месте круг назад.
const mixColor = (from: number, to: number, share: number): number => {
  let mixed = 0;
  for (let shift = 16; shift >= 0; shift -= 8) {
    const channel = ((from >> shift) & 0xff) + (((to >> shift) & 0xff) - ((from >> shift) & 0xff)) * share;
    mixed |= Math.round(channel) << shift;
  }
  return mixed;
};

const corners = [
  // По часовой от макушки: правый верхний, правый нижний, левый нижний, левый
  // верхний. Уголок рисуется от плеча к углу и дальше вбок, и у двух из
  // четырёх этот собственный порядок идёт против часовой — их разворачиваем,
  // чтобы весь контур читался одним ходом стрелки.
  {sx: 1, sy: -1, isReversed: true},
  {sx: 1, sy: 1, isReversed: false},
  {sx: -1, sy: 1, isReversed: true},
  {sx: -1, sy: -1, isReversed: false},
];

interface IContourPoint {
  x: number;
  y: number;
  // Сколько контура пройдено до этой точки. Просветы между уголками в счёт не
  // идут вовсе: стрелка ходит по нарисованному, а не по воображаемому кругу, и
  // в пустоте ей делать нечего. Из-за этого же она идёт ровно — по углу от
  // середины прицела её скорость гуляла бы, у углов вдвое быстрее, чем на
  // середине плеча.
  at: number;
}

interface IContour {
  // Уголки по отдельности: одной ломаной их рисовать нельзя, иначе просветы
  // затянет линией.
  brackets: IContourPoint[][];
  length: number;
}

/**
 * Уголки прицела ломаными. Каждый — плечо к углу, дуга вокруг самого угла (он
 * же опорная точка кривой) и плечо от угла вбок.
 */
const reticleContour = (spread: number, arm: number, round: number): IContour => {
  const brackets: IContourPoint[][] = [];
  let passed = 0;
  for (const {sx, sy, isReversed} of corners) {
    const x = sx * spread;
    const y = sy * spread;
    const shape: {x: number, y: number}[] = [];
    for (let i = 0; i <= armSamples; i++) {
      const from = arm - (arm - round) * (i / armSamples);
      shape.push({x, y: y - sy * from});
    }
    // Квадратичная кривая: концы плеч, вершина угла — опорная точка.
    for (let i = 1; i <= cornerSamples; i++) {
      const t = i / cornerSamples;
      const back = 1 - t;
      shape.push({
        x: back * back * x + 2 * back * t * x + t * t * (x - sx * round),
        y: back * back * (y - sy * round) + 2 * back * t * y + t * t * y,
      });
    }
    for (let i = 1; i <= armSamples; i++) {
      const to = round + (arm - round) * (i / armSamples);
      shape.push({x: x - sx * to, y});
    }
    if (isReversed) shape.reverse();
    const points: IContourPoint[] = [];
    shape.forEach((point, index) => {
      const previous = index ? shape[index - 1] : undefined;
      if (previous) passed += Math.hypot(point.x - previous.x, point.y - previous.y);
      points.push({x: point.x, y: point.y, at: passed});
    });
    brackets.push(points);
  }
  return {brackets, length: passed};
};

type TReticleConfig = Required<ReticleProps>;

class ReticleGraphics extends PIXI.Graphics {
  // Публичным полем, а не пропом: props react-pixi-fiber раскладывает прямо по
  // объекту, а рисовать надо каждый кадр и из тикера.
  config: TReticleConfig = {
    spread: 0,
    arm: 0,
    cornerRadius: 0,
    thickness: 1,
    color: 0xFFFFFF,
    startedAt: 0,
  };
  // Ломаные пересчитываем только вместе с размером прицела: он меняется на
  // ресайзе окна, а кадров между этим — тысячи.
  private contour: IContour | null = null;

  setShape() {
    const {spread, arm, cornerRadius} = this.config;
    // Скругление не длиннее самого плеча: иначе дуга съест прямые участки и от
    // уголка останется одна закорючка.
    this.contour = spread > 0 && arm > 0
      ? reticleContour(spread, arm, Math.min(cornerRadius, arm))
      : null;
  }

  redraw() {
    const {thickness, color, startedAt} = this.config;
    this.clear();
    const contour = this.contour;
    if (!contour || contour.length <= 0 || thickness <= 0) return;

    // Сам прицел — всегда и целиком: того, чей ход, видно и в те мгновения,
    // когда никакого отсчёта нет (вскрытие голосов, оглашение миссии).
    for (const points of contour.brackets) {
      this.lineStyle(thickness, color, reticleAlpha);
      points.forEach(({x, y}, index) => index ? this.lineTo(x, y) : this.moveTo(x, y));
    }
    if (!startedAt) return;

    // Отсчёт всегда с нуля: свой startedAt приходит на каждое новое ожидание
    // (см. TimerController.initTimer).
    const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
    const laps = elapsed / lapSeconds;
    // Где стрелка сейчас — в пройденной длине контура.
    const head = (laps - Math.floor(laps)) * contour.length;
    const trailLength = trailLapSpan * contour.length;
    // Сколько секунд назад стрелка была вот на столько позади себя.
    const secondsBehind = (behind: number) => (behind / contour.length) * lapSeconds;

    // behind — насколько середина кусочка отстала от головы, в длине контура.
    const stroke = (from: {x: number, y: number}, to: {x: number, y: number}, behind: number) => {
      const age = behind / trailLength;
      // Хвост длиннее того, что стрелка успела пройти, не бывает: в начале
      // отсчёта горит ровно столько, сколько по контуру уже прошли.
      if (age >= 1 || secondsBehind(behind) > elapsed) return;
      if (Math.hypot(to.x - from.x, to.y - from.y) < minStrokeLength) return;
      // Цвет — по кругам, а не по секундам: каждый новый круг стрелки должен
      // отличаться от предыдущего (см. turnTimerColor).
      const strokeLaps = (elapsed - secondsBehind(behind)) / lapSeconds;
      const blend = Math.min(1, behind / headFadeLength);
      const fresh = turnTimerColor(strokeLaps);
      // Голова не обрывается краем, а перетекает: на первых точках за ней цвет
      // смешан с тем, что лежал здесь круг назад. На первом круге мешать не с
      // чем — там она проступает из самого прицела.
      const isOverwriting = strokeLaps >= 1;
      const alpha = trailAlphaHead * (isOverwriting ? 1 : blend);
      if (alpha <= 0.004) return;
      const strokeColor = isOverwriting && blend < 1
        ? mixColor(turnTimerColor(strokeLaps - 1), fresh, blend)
        : fresh;
      const width = thickness * (1 + (trailWidthHead - 1) * blend * Math.pow(1 - age, trailWidthFalloff));
      // Сначала ореол, потом сама линия: она должна лечь поверх своего света.
      const glow = glowWidthShare
        + (glowWidthMax - glowWidthShare) * clamp(strokeLaps - glowGrowLap, 0, 1);
      this.lineStyle(width * glow, strokeColor, alpha * glowAlphaShare);
      this.moveTo(from.x, from.y);
      this.lineTo(to.x, to.y);
      this.lineStyle(width, strokeColor, alpha);
      this.moveTo(from.x, from.y);
      this.lineTo(to.x, to.y);
    };

    for (const points of contour.brackets) {
      for (let i = 1; i < points.length; i++) {
        const from = points[i - 1];
        const to = points[i];
        if (!from || !to || to.at <= from.at) continue;
        // Кусочек, на котором стрелка стоит прямо сейчас, дорисовываем ровно
        // до неё — иначе она перескакивала бы с точки на точку.
        if (head > from.at && head <= to.at) {
          const share = (head - from.at) / (to.at - from.at);
          stroke(from, {
            x: from.x + (to.x - from.x) * share,
            y: from.y + (to.y - from.y) * share,
          }, (head - from.at) / 2);
          continue;
        }
        // Насколько давно стрелка прошла этот кусочек — в длине контура,
        // считая назад от его середины и по кругу.
        const middle = (from.at + to.at) / 2;
        stroke(from, to, ((head - middle) % contour.length + contour.length) % contour.length);
      }
    }
  }

  // Стрелка идёт сама по себе, кадрами пикси, а не перерисовкой React: React
  // прицелу нужен, только когда сменился ходящий или начался новый отсчёт, — а
  // гонять реконсиляцию по шестьдесят раз в секунду ради одной фигуры незачем.
  private run = () => {
    if (!this.config.startedAt) return;
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

const TYPE = "Reticle";
export const behavior = {
  customDisplayObject: (_props: ReticleProps) => new ReticleGraphics(),
  customApplyProps: function(
    this: GraphicsBehaviorThis<ReticleProps>,
    instance: ReticleGraphics,
    oldProps: ReticleProps | undefined,
    newProps: ReticleProps,
  ) {
    const { spread, arm, cornerRadius, thickness, color, startedAt = 0 } = newProps;
    const isSameShape = oldProps
      && oldProps.spread === spread
      && oldProps.arm === arm
      && oldProps.cornerRadius === cornerRadius;
    instance.config = { spread, arm, cornerRadius, thickness, color, startedAt };
    if (!isSameShape) instance.setShape();
    instance.redraw();

    this.applyDisplayObjectProps(oldProps, newProps);
  },
};

export default CustomPIXIComponent(behavior, TYPE);
