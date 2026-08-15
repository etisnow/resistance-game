export enum ENotificationAction {
	info = 'info',
	// Выбор игрока за столом: лидер набирает команду.
	playerSelect = 'playerSelect',
	// Вопрос с кнопками: голос «За / Против», карта миссии «Успех / Провал».
	actionDecision = 'actionDecision',
	gameEnd = 'gameEnd',
}
