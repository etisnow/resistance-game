import barricadeBadge from "client/resources/images/barricade_badge.png";
import disconnected from "client/resources/images/disconnected.png";
import playerbadgeGlow from "client/resources/images/playerbadgeGlow.png";
import noise from "client/resources/images/noise.jpg";
// Столешница: круглый люк, увиденный сверху. В эллипс стола он не вписывается, а
// растягивается — это тот же круг, только в проекции стола (см. TableSurface).
import tableTop from "client/resources/images/table.jpg";

// Лица игроков: ими залит кружок за столом (см. BadgeBody). Кадрированы под его
// пропорции (badgeAspect), поэтому вписываются в него без подгонки. Раздаёт их
// сервер на старте партии, по одной на человека (см. gameStarter).
import avatar1 from "client/resources/images/avatars/1.jpg";
import avatar2 from "client/resources/images/avatars/2.jpg";
import avatar3 from "client/resources/images/avatars/3.jpg";
import avatar4 from "client/resources/images/avatars/4.jpg";
import avatar5 from "client/resources/images/avatars/5.jpg";
import avatar6 from "client/resources/images/avatars/6.jpg";
import avatar7 from "client/resources/images/avatars/7.jpg";
import avatar8 from "client/resources/images/avatars/8.jpg";

/* PLAYER STATUSES */
// Личные пометки на соседях. Картинки пока «нечтовские» — свой набор («свой»,
// «под вопросом», «шпион») придёт вместе с визуальным стилем в фазе 3.
import playerStatusQuestion from 'client/resources/images/playerStatuses/question.png';
import playerStatusThing from 'client/resources/images/playerStatuses/thing.png';
import playerStatusInfected from 'client/resources/images/playerStatuses/infected.png';
import playerStatusClear from 'client/resources/images/playerStatuses/clear.png';

const resources = {
	playerbadgeGlow,
	noise,
	tableTop,

	playerStatusQuestion,
	playerStatusThing,
	playerStatusInfected,
	playerStatusClear,

	playerBadges: {
		'door': barricadeBadge,
		'disconnected': disconnected,
	},

	// Порядок важен: сервер присылает номер аватарки в этом списке.
	avatars: [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6, avatar7, avatar8],
};

export {resources};
