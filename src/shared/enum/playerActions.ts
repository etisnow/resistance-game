export enum EPlayerActionType {
	cardPick = 'cardPick',
	cardDiscard = 'discard',
	cardTrade = 'cardTrade',
	cardAct = 'act',
	cardSelect = 'select',
	cardsSelect = 'selectCards',
	playerSelect = 'playerSelect',
	// Игрок закрыл окно с чужими картами — осмотр подтверждён, ход идёт дальше
	// (см. ETurnContextType.cardsView).
	viewConfirm = 'viewConfirm',
	actionDecision = 'actionDecision',
	actionCancel = 'actionCancel',
}
