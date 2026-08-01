import {EGameLogType} from 'shared/enum/gameLogType';

// Одна строка игрового лога. Ники внутри text подсвечиваются на клиенте по
// списку игроков, поэтому отдельно их не передаём.
export interface IGameLogEntry {
	text: string;
	type: EGameLogType;
}
