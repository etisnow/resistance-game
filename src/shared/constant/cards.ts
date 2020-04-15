import {each, uniqueId} from 'lodash';

import {ECardType, EEventID, EEventType, EPanicID} from 'shared/enum/cards';
import {ICard} from 'shared/interfaces/cards';

export const cardAspectRatio = 1.3957;

const events: {[key: string]: ICard} = {
  [EEventID.yporstvo]: {
    type: ECardType.event,
    id: EEventID.yporstvo,
    eventType: EEventType.playable,
    description:
      "Возьмите три карты событий, оставьте на руке одну и сбросьте остальные две. Затем сыграйте или сбросьте одну карту",
    playersCount: [4,4,6,9,10],

  },
  [EEventID.fear]: {
    type: ECardType.event,
    id: EEventID.fear,
    eventType: EEventType.antiTrade,
    description:
      "Откажитесь от обмена картами и посмотрите карту, от которой отказались. Возьмите одну карту события.",
    playersCount: [5,6,8,11],
  },
  [EEventID.podozrenie]: {
    type: ECardType.event,
    id: EEventID.podozrenie,
    eventType: EEventType.playable,
    description: "Посмотрите одну случайную карту на руке соседнего игрока.",
    playersCount: [4,4,4,4,7,8,9,10]

  },
  [EEventID.mne_i_zdes_norm]: {
    type: ECardType.event,
    id: EEventID.mne_i_zdes_norm,
    eventType: EEventType.antiSwap,
    description:
      'Отмените эффект карты "Меняемся местами" или "Сматывай удочки", если стали её целью. Возьмите одну карту события',
    playersCount: [4,6,11],
  },
  [EEventID.menyaemsya_mestami]: {
    type: ECardType.event,
    id: EEventID.menyaemsya_mestami,
    eventType: EEventType.playable,
    description:
      "Поменяйтесь местами с соседним игроком, если он не на каратине и не за заколоченной дверью.",
    playersCount: [4,4,7,9,11]
  },
  [EEventID.ognemet]: {
    type: ECardType.event,
    id: EEventID.ognemet,
    eventType: EEventType.playable,
    description: "Соседний игрок выбывает из игры.",
    playersCount: [4,4,6,9,11]
  },
  [EEventID.smatyvay_udochki]: {
    type: ECardType.event,
    id: EEventID.smatyvay_udochki,
    eventType: EEventType.playable,
    description:
      "Поменяйтесь местами с любым игроком по вашему выбору, если он не на карантине. Игнорируйте все заколоченные двери",
    playersCount: [4,4,7,9,11]
  },
  [EEventID.topor]: {
    type: ECardType.event,
    id: EEventID.topor,
    eventType: EEventType.axe,
    description:
      'Сбросьте сыгранную на вас или на соседнего игрока карту карантин или выложенную между вами карту "Заколоченная дверь"',
    playersCount: [4,9]
  },
  [EEventID.look_around]: {
    type: ECardType.event,
    id: EEventID.look_around,
    eventType: EEventType.playable,
    description:
      "Очередность хода передается в обратную сторону. Меняется порядок хода игроков и направление обмена картами с соседом.",
    playersCount: [4,9]
  },
  [EEventID.visky]: {
    type: ECardType.event,
    id: EEventID.visky,
    eventType: EEventType.playable,
    description:
      "Покажите все свои карты остальным игрокам. Эту карту можно сыграть только на себя.",
    playersCount: [4,6,10]
  },
  [EEventID.zakolochennaya_dver]: {
    type: ECardType.event,
    id: EEventID.zakolochennaya_dver,
    eventType: EEventType.playable,
    description:
      "Положите эту карту между собой и соседним игроком. Между вами не может совершаться никаких действий или обменов.",
    playersCount: [4,7,11]
  },
  [EEventID.soblazn]: {
    type: ECardType.event,
    id: EEventID.soblazn,
    eventType: EEventType.playable,
    description:
      "Поменяйтесь одной картой с любым игроком по вашему выбору если он не на карантине. Ваш ход заканчивается.",
    playersCount: [4,4,6,7,8,10,11],
  },
  [EEventID.zarazhenie]: {
    type: ECardType.event,
    id: EEventID.zarazhenie,
    eventType: EEventType.injure,
    description:
      "Получив эту карту от другого игрока вы становитесь зараженым и обязаны держать её на руке до конца игры.",
    playersCount: [4,4,4,4,4,4,4,4,6,6,7,7,8,9,9,10,10,11,11,11],
  },
  [EEventID.karantin]: {
    type: ECardType.event,
    id: EEventID.karantin,
    eventType: EEventType.playable,
    description:
      "Сыграйте эту карту на себя или соседнего игрока. Следующие три своих хода игрок на карантине не может меняться картами, играть карты событий или становиться целью таких карт.",
    playersCount: [5,9],
  },
  [EEventID.nikakogo_sashlyka]: {
    type: ECardType.event,
    id: EEventID.nikakogo_sashlyka,
    eventType: EEventType.antiFire,
    description:
      'Отмените эффект карты Огнемет, если стали её целью. Возьмите одну карту события.',
    playersCount: [4,6,11],
  },
  [EEventID.analiz]: {
    type: ECardType.event,
    id: EEventID.analiz,
    eventType: EEventType.playable,
    description: "Посмотрите карты на руке соседнего игрока.",
    playersCount: [5,6,9],
  },
  [EEventID.no_thanks]: {
    type: ECardType.event,
    id: EEventID.no_thanks,
    eventType: EEventType.antiTrade,
    description: "Откажитесь от обмена картами. Возьмите одну карту события.",
    playersCount: [4,6,8,11],
  },
  [EEventID.mimo]: {
    type: ECardType.event,
    id: EEventID.mimo,
    eventType: EEventType.antiTrade,
    description:
      "Откажитесь от обмена картами. Вместо вас картами меняется следующий за вами игрок. Возьмите одну карту события.",
    playersCount: [4,6,11]
  },
};

const panic = {
  [EPanicID.tree_four]: {
    type: ECardType.panic,
    id: EPanicID.tree_four,
    description: 'Все сыгранные карты "Заколоченная дверь" сбрасываются.',
    playersCount: [4,9],

  },
  [EPanicID.tsepnaya_reactsia]: {
    type: ECardType.panic,
    id: EPanicID.tsepnaya_reactsia,
    description:
      'Каждый игрок одновременно с остальными отдает одну карту следующему по порядку хода игроку, игнорируя все сыгранные карты "Карантин" и "Заколоченная дверь". Вы не можете отказаться от получения карты при помощи других карт. Нечто может заразить другого игрока, передав ему карту заражения. Ваш ход заканчивается.',
    playersCount: [4,9],

  },
  [EPanicID.svidanie_vslepyy]: {
    type: ECardType.panic,
    id: EPanicID.svidanie_vslepyy,
    description:
      "Поменяйте одну карту с руки на верхнюю карту общей колоды, сбрасывая все попадающиеся карты паники. Ваш ход заказчивается",
    playersCount: [4,9],

  },
  [EPanicID.starye_verevki]: {
    type: ECardType.panic,
    id: EPanicID.starye_verevki,
    description: "Все сыгранные карты карантин сбрасываются.",
    playersCount: [6,9],

  },
  [EPanicID.one_two]: {
    type: ECardType.panic,
    id: EPanicID.one_two,
    description:
      "Поменяйтесь местами с третьим от вас игроков слева или справа по вашему выбору. Игнорируйте все заколоченные двери. Если игрок на карантине смены мест не происходит.",
    playersCount: [5,9],
  },
  [EPanicID.only_between_us]: {
    type: ECardType.panic,
    id: EPanicID.only_between_us,
    description:
      "Покажите все карты на руке соседнему игроку по вашему выбору.",
    playersCount: [7,9],
  },
  [EPanicID.i_eto_vecherinka]: {
    type: ECardType.panic,
    id: EPanicID.i_eto_vecherinka,
    description:
      "Все сыгранные карты карантин и заколоченная дверь сбрасываются. Затем, начиная с вас и по часовой стрелке все игроки парами меняются местами. В случае нечетного числа игроков, последний игрок остается на месте.",
    playersCount: [5,9],
  },
  [EPanicID.go_proch]: {
    type: ECardType.panic,
    id: EPanicID.go_proch,
    description:
      "Поменяйтесь местами с любым игроком по вашему выбору, если он не на карантине.",
    playersCount: [5],
  },
  [EPanicID.oops]: {
    type: ECardType.panic,
    id: EPanicID.oops,
    description: "Покажите все свои карты на руке остальным игрокам.",
    playersCount: [10],
  },
  [EPanicID.davai_druzhit]: {
    type: ECardType.panic,
    id: EPanicID.davai_druzhit,
    description:
      "Поменяйтесь одной картой с любым игроком по вашему выбору, если он не на карантине.",
    playersCount: [7,9],
  },
  [EPanicID.zabyvchivost]: {
    type: ECardType.panic,
    id: EPanicID.zabyvchivost,
    description:
      "Сбросьте три карты с руки и возьмите три новые карты событий. Сбрасывайте все попадающиеся карты паники.",
    playersCount: [4],
  },
  [EPanicID.time_priznaniy]: {
    type: ECardType.panic,
    id: EPanicID.time_priznaniy,
    description:
      "Начиная с вам и по порядку хода, каждый игрок либо показывает, либо не показывает все карты на руке остальным игрокам. Время признаний заканчивается, когда кто_то из игроков показывает карту заражения, при этом нет необходимости показывать остальные карты на руке.",
    playersCount: [8],
  },
};

const cardBacks : {[key: string]: ICard} = {
  event_back: {
    type: ECardType.back,
    id: "event_back",
    description:'',
    playersCount: [],
  },
  panic_back: {
    type: ECardType.back,
    id: "panic_back",
    description:'',
    playersCount: [],
  },
};

const thingCard : ICard = {
  type: ECardType.thing,
  id: "thing",
  description: "Ты нечто.",
  playersCount: [0],
};

const fulldeck = Object.assign({}, events, panic, cardBacks, { thing:thingCard }) as {[key: string]: ICard};

export const handCardsCount = 4;

let fullDeckObject = {};
each(fulldeck, card => {
	fullDeckObject[card.id] = card
});

export const getCard = cardId => {
  return {...fullDeckObject[cardId], uniqueId: uniqueId('card_')}
}
export { fulldeck, thingCard, cardBacks, fullDeckObject };
