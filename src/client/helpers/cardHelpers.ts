import {filter} from 'lodash';
import {ICardMenuItem} from 'shared/interfaces/cardMenu';
import Player from 'client/models/Player';
import {fulldeck} from 'shared/constant/cards';
import {EEventID, EEventType} from 'shared/enum/cards';
import {ETurnState} from 'shared/enum/player';
import {EPlayerActionType} from 'shared/enum/playerActions';

const injuresCount = (player: Player) => {
	const injures = filter(player.hand, card => { return card.id === EEventID.zarazhenie});
	return injures.length;
};

export const getCardMenuItems = (cardId: EEventID, currentPlayer: Player, targetPlayer: Player | null): ICardMenuItem[] => {
	let actions : ICardMenuItem[] = [];
	const card = fulldeck[cardId];
	if (!card) { console.error('В колоде не найдена ' + cardId)}
	if (!card.eventType) return actions;
	if (card.id === "thing") return actions;

	const isCurrentPlayerInjured = currentPlayer.isInjured;
	const isCurrentPlayerThing = currentPlayer.isThing;

	const isTargetPlayerThing = targetPlayer && targetPlayer.isThing;

	//у инжуры дроп только если не заражен ИЛИ карт заражения больше 1 или игрок нечто
	const canDiscardInjure = !isCurrentPlayerInjured || injuresCount(currentPlayer) > 1 || isCurrentPlayerThing;
	const canTradeInjure = isCurrentPlayerThing || (isCurrentPlayerInjured && isTargetPlayerThing);



	switch (currentPlayer.turnState) {
		case ETurnState.idle:
		//case ETurnState.inPickingCard:
		//	return actions;
		case ETurnState.inCardAction:
			console.log('card evetn tyoe', card.eventType)
			if (currentPlayer.quarantine > 0 && card.eventType !== EEventType.axe) {
				actions.push({ menuType: EPlayerActionType.cardDiscard});
				return actions;
			}

			if (card.eventType === EEventType.axe) {
				actions.push({ menuType: EPlayerActionType.cardDiscard});
				if (currentPlayer.quarantine > 0) {
					actions.push({ menuType: EPlayerActionType.cardAct});
				}
				return actions;
				//TODO: Логика возможностей использования топора
				//if ()
			}


			if (card.eventType === EEventType.injure && canDiscardInjure) {
				actions.push({ menuType: EPlayerActionType.cardDiscard});
				return actions;
			}
			actions.push({ menuType: EPlayerActionType.cardDiscard});
			if (card.eventType === EEventType.playable) {
				actions.push({ menuType: EPlayerActionType.cardAct});
			}
			return actions;
		case ETurnState.inOffenseTrade:
			if (card.eventType === EEventType.injure) {
				if (canTradeInjure)	actions.push({ menuType: EPlayerActionType.cardTrade});
				return actions;
			}
			actions.push({ menuType: EPlayerActionType.cardTrade});
			return actions;
		case ETurnState.inDefenseTrade:
			if (card.eventType === EEventType.injure && canTradeInjure) {
				actions.push({ menuType: EPlayerActionType.cardTrade});
				return actions;
			}
			if (card.eventType === EEventType.antiTrade) {
				actions.push({ menuType: EPlayerActionType.cardAct});
				actions.push({ menuType: EPlayerActionType.cardTrade});
				return actions;
			}
			actions.push({ menuType: EPlayerActionType.cardTrade});
			break;
	}
	return actions;
};
