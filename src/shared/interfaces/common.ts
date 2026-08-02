import {ETurnContextType} from 'shared/enum/turnContextType';
import type {EEventID, EPanicID} from 'shared/enum/cards';

export interface IFormatTradeContext {
	offensePlayerId: string | null;
	defensePlayerId: string | null;
	isCardPicked?: boolean;
	// Карта, которой действие затеяно: клиент рисует её на стрелке и берёт с неё
	// цвет. У обмена карта скрыта, поэтому её здесь и нет.
	cardId?: EEventID;
	type: ETurnContextType;
}

// Разовое применение карты, которое не оставляет после себя стрелки: подсмотр
// «Подозрением», отказ «Нет уж спасибо» и прочее. Клиент рисует такую карту
// поверх бейджа игрока, который её применил, со сдвигом в сторону цели.
// seq растёт на игру: по нему клиент отличает новое применение от уже показанного.
export interface IFormatCardEffect {
	seq: number;
	cardId: string;
	playerId: string;
	targetPlayerId: string | null;
}

// Взятие карт из колоды. Кто взял и сколько — самих карт здесь нет: чужую руку
// видеть нельзя, а свою прилетевшую карту клиент и так узнаёт по руке. Стол
// пускает карту от колоды к тому, кто её взял: себе — в руку, остальным — в
// кружок игрока. seq растёт на игру, как у cardEffects.
export interface IFormatCardDraw {
	seq: number;
	playerId: string;
	// Забывчивость берёт три карты разом, упорство и свидание вслепую — одну.
	count: number;
}

// Карта паники, которая прямо сейчас лежит на столе (Game.panicCard). Клиент
// показывает её крупно в центре стола и держит колоду закрытой, пока она там.
// uniqueId свой у каждого экземпляра карты — по нему клиент отличает новую
// панику от той же самой, что уже лежит на столе.
export interface IFormatPanicCard {
	id: EPanicID;
	uniqueId: string | null;
}
