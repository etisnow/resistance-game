import {filter, map} from 'lodash';

import {EEventID, EPanicID} from 'shared/enum/cards';
import {fullDeckObject} from 'shared/constant/cards';

// Разделы справочника карт. Порядок внутри раздела — тот, в котором карты
// показываются игроку, поэтому списки заданы руками, а не выведены из
// eventType: «дефенсив» и «офенсив» — это про то, когда карту играют (в ответ
// на чужой ход или своим ходом по другому игроку), а такого признака у карт
// нет. «События» — всё остальное: карты, которые никого не трогают.
export interface ICardSection {
	title: string;
	cardIds: string[];
}

const panicIds: string[] = [
	EPanicID.threeFour,
	EPanicID.oneTwo,
	EPanicID.chainReaction,
	EPanicID.blindDate,
	EPanicID.oldRopes,
	EPanicID.onlyBetweenUs,
	EPanicID.youCallThisParty,
	EPanicID.goAway,
	EPanicID.oops,
	EPanicID.friendship,
	EPanicID.forgetfulness,
	EPanicID.recognitionTime,
];

const eventIds: string[] = [
	EEventID.tenacity,
	EEventID.suspicion,
	EEventID.analysis,
	EEventID.whiskey,
	EEventID.lookaround,
];

const defensiveIds: string[] = [
	EEventID.noThanks,
	EEventID.fear,
	EEventID.miss,
	EEventID.leaveMeAlone,
	EEventID.noFire,
	EEventID.axe,
];

const offensiveIds: string[] = [
	EEventID.flamethrower,
	EEventID.infect,
	EEventID.quarantine,
	EEventID.barricade,
	EEventID.positionswap,
	EEventID.reelFishingRods,
	EEventID.seduction,
];

// Часть карт лежит в enum, но выключена из колоды (закомментирована в cards.ts).
// Показывать то, что в игре не встретится, незачем — сверяемся с колодой.
const inDeck = (cardIds: string[]) => filter(cardIds, (cardId) => !!fullDeckObject[cardId]);

export const cardSections: ICardSection[] = map([
	{title: 'Паники', cardIds: panicIds},
	{title: 'События', cardIds: eventIds},
	{title: 'Дефенсив', cardIds: defensiveIds},
	{title: 'Офенсив', cardIds: offensiveIds},
], (section) => ({...section, cardIds: inDeck(section.cardIds)}));
