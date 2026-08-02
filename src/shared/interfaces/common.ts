import {ETurnContextType} from 'shared/enum/turnContextType';
import type {EEventID} from 'shared/enum/cards';

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
