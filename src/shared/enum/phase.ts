// Фаза раунда. Она одна на весь стол и однозначно говорит, чего сервер ждёт и от
// кого: набора команды — от лидера, голосов — от всех, карт миссии — от команды.
export enum EGamePhase {
	teamBuilding = 'teamBuilding',
	voting = 'voting',
	mission = 'mission',
	over = 'over',
}
