export enum ENotificationAction {
	cardPick = 'cardPick',
	turnCard = 'turnCard',
	offenseTradeCard = 'offenseTradeCard',
	defenseTradeCard = 'defenseTradeCard',
	info = 'info',
	okayCard = 'okayCard',
	selectCard = 'selectCard',
	// Выбор сразу нескольких карт одним окном: игрок отмечает ровно count карт и
	// подтверждает выбор целиком (забывчивость).
	selectCards = 'selectCards',
	playerSelect = 'playerSelect',
	actionDecision = 'actionDecision',
	gameEnd = 'gameEnd',
}
