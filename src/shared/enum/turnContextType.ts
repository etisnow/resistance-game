export enum ETurnContextType {
	trade = 'trade',
	positionswap = 'positionswap',
	burn = 'burn',
	tenacityCardSelect = 'tenacityCardSelect',
	suspicionPersonSelect = 'suspicionPersonSelect',
	barricadePersonSelect = 'barricadePersonSelect',
	seduction = 'seduction',
	quarantinePersonSelect = 'quarantinePersonSelect',
	axePersonSelect = 'axePersonSelect',
	analysisPersonSelect = 'analysisPersonSelect',
	// Игрок смотрит чужие карты («Анализ», «Подозрение»): стол показывает от него
	// к цели стрелку с лупой, пока он не закроет окно с картами.
	cardsView = 'cardsView',

	/*PANICS */
	friendshipSeduction = 'friendshipSeduction',
	chainReaction = 'chainReaction',
	blindDateCardSelect = 'blindDateCardSelect',
	oneTwoPersonSelect = 'oneTwoPersonSelect',
	onlyBetweenUsPersonSelect = 'onlyBetweenUsPersonSelect',
	forgetfullnessSelect = 'forgetfullnessSelect',
}

