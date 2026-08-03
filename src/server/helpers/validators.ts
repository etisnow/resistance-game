import {Game} from 'server/models/Game';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {Player} from 'server/models/Player';
import {ETurnState} from 'shared/enum/player';
import {find, uniq} from 'lodash';
import {getCardActions} from 'server/formatters/formatCardActions';
import {ENotificationAction} from 'shared/enum/notifications';
import {debugLog} from 'server/helpers/util';
import {ETurnContextType} from 'shared/enum/turnContextType';

export const isPlayerCanDiscardCard = (game: Game, player: Player, cardUniqueId: string | undefined) => {
	//Проверяем есть ли у него на руках такая карта
	const selectedCard = find(player.hand, {uniqueId:cardUniqueId});
	if (!selectedCard) {
		//throw new Error(`У игрока ${player.nickname} нету карту ${cardUniqueId}`)
		console.error(`У игрока ${player.nickname} нету карту ${cardUniqueId}`)
		return false;
	}
	if (!player.currentAction || player.currentAction.type !== ENotificationAction.turnCard) return false;

	const cardActions = getCardActions(game, player, selectedCard);
	const actAction = find(cardActions, { menuType: EPlayerActionType.cardDiscard });
	switch (player.turnState) {
		case ETurnState.inCardAction:
			if (!actAction) {
				debugLog('CARD ACTIONS WAS', cardActions, player.turnState, selectedCard.id)
			}
			return !!actAction;
		default:
			return false;
	}
};


export const isPlayerCanActCard = (game: Game, player: Player, cardUniqueId: string | undefined) => {
	//Проверяем есть ли у него на руках такая карта
	const selectedCard = find(player.hand, {uniqueId:cardUniqueId});
	if (!selectedCard) {
		//throw new Error(`У игрока ${player.nickname} нету карту ${cardUniqueId}`)
		console.error(`У игрока ${player.nickname} нету карту ${cardUniqueId}`)
		return false;
	}
	if (!player.currentAction || (player.currentAction.type !== ENotificationAction.turnCard && player.currentAction.type !== ENotificationAction.defenseTradeCard)) return false;
	const cardActions = getCardActions(game, player, selectedCard);
	const actAction = find(cardActions, { menuType: EPlayerActionType.cardAct});
	switch (player.turnState) {
		case ETurnState.inCardAction:
		case ETurnState.inDefenseTrade:
			if (!actAction) {
				debugLog('CARD ACTIONS WAS', cardActions, player.turnState, selectedCard.id)
			}
			return !!actAction;
		default:
			return false;
	}
};

export const isPlayerCanCancel = (game: Game, player: Player) => {
	switch (player.turnState) {
		case ETurnState.inCardActionProgress:
			if (game.turnContext) {
				switch (game.turnContext.type) {
					case ETurnContextType.analysisPersonSelect:
					case ETurnContextType.axePersonSelect:
					case ETurnContextType.barricadePersonSelect:
					case ETurnContextType.burn:
					case ETurnContextType.positionswap:
					case ETurnContextType.quarantinePersonSelect:
					case ETurnContextType.seduction:
					case ETurnContextType.suspicionPersonSelect:
						return true;
				}
			}
	}
	return false;
};

export const isPlayerCanTradeCard = (game: Game, player: Player, cardUniqueId: string | undefined) => {
	//Проверяем есть ли у него на руках такая карта
	const selectedCard = find(player.hand, {uniqueId:cardUniqueId});
	if (!selectedCard) {
		console.error(`У игрока ${player.nickname} нету карту ${cardUniqueId}`);
		return false;
		//throw new Error(`У игрока ${player.nickname} нету карту ${cardUniqueId}`)
	}
	const cardActions = getCardActions(game, player, selectedCard);
	const actAction = find(cardActions, { menuType: EPlayerActionType.cardTrade});
	switch (player.turnState) {
		case ETurnState.inDefenseTrade:
		case ETurnState.inOffenseTrade:
			if (!player.currentAction || (player.currentAction.type !== ENotificationAction.defenseTradeCard
				&& player.currentAction.type !== ENotificationAction.offenseTradeCard)) {
				debugLog('CARD ACTIONS WAS', cardActions, player.nickname, player.turnState, selectedCard.id)
				return false;
			}
			if (!actAction) {
				debugLog('CARD ACTIONS WAS', cardActions, player.turnState, selectedCard.id)
			}
			return !!actAction;
		default:
			return false;
	}
};

export const isPlayerCanSelectPlayer = (game: Game, player: Player, selectedPlayerId: string | undefined) => {
	//Проверяем есть ли в игре игрок с таким ID
	const selectedPlayer = find(game.players, {id:selectedPlayerId});
	if (!selectedPlayer) {
		//throw new Error(`Игрока с ID ${selectedPlayerId} не существует в игре`)
		console.error(`Игрока с ID ${selectedPlayerId} не существует в игре`);
		return false;
	}

	if (!player.currentAction || player.currentAction.type !== ENotificationAction.playerSelect) {
		debugLog('CARD ACTIONS WAS', player.currentAction, player.nickname, player.turnState, selectedPlayerId)
		return false;
	}
	const event = player.currentAction;
	if (!selectedPlayerId || !event.playersToSelect.includes(selectedPlayerId)) {
		console.error(`В эвенте нету ID пользователя`, event, selectedPlayerId)
		return false;
	}
	return event.playersToSelect.includes(selectedPlayerId)
};

export const isPlayerCanSelectCard = (_game: Game, player: Player, cardUniqueId: string | undefined) => {
	if (!player.currentAction || player.currentAction.type !== ENotificationAction.selectCard) {
		return false;
	}
	const event = player.currentAction;
	const selectedCard = find(event.cards, {uniqueId: cardUniqueId})
	if (!selectedCard) {
		console.error(`В предложенных картах нету ID выбранной`, event, cardUniqueId)
	}
	return !!selectedCard
};

// Пачка карт приходит одним действием, поэтому и проверяем её целиком: ровно
// столько карт, сколько просили, без повторов и все — из предложенных.
export const isPlayerCanSelectCards = (_game: Game, player: Player, cardUniqueIds: string[] | undefined) => {
	if (!player.currentAction || player.currentAction.type !== ENotificationAction.selectCards) {
		return false;
	}
	const event = player.currentAction;
	if (!cardUniqueIds || cardUniqueIds.length !== event.count) {
		console.error(`Выбрано не ${event.count} карт`, cardUniqueIds);
		return false;
	}
	if (uniq(cardUniqueIds).length !== cardUniqueIds.length) {
		console.error(`Одна и та же карта выбрана дважды`, cardUniqueIds);
		return false;
	}
	const unknownCard = find(cardUniqueIds, (uniqueId) => !find(event.cards, {uniqueId}));
	if (unknownCard) {
		console.error(`В предложенных картах нету ID выбранной`, event, unknownCard);
		return false;
	}
	return true;
};

export const isPlayerCanSelectDesicion =(_game: Game, player: Player, action: string | undefined) => {
	if (!player.currentAction || player.currentAction.type !== ENotificationAction.actionDecision) {
		return false;
	}
	const event = player.currentAction;
	const selectedAction = find(event.menu, {action});
	if (!selectedAction) {
		console.error(`В предложенных экшнах нету выбранного`, event, action)
	}
	return !!selectedAction
};
