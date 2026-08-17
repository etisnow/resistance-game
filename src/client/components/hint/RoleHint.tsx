import React from 'react';
import {observer} from 'mobx-react-lite';
import {ESpecialRole} from 'shared/enum/role';
import {MERLIN_LIKE, RESISTANCE_SIDE, ROLE_MARK_LOOK, SPY_SIDE, type TRoleMark} from 'client/helpers/roleMark';
import {HintPopup} from 'client/components/hint/HoverHint';
import {roleHintStore} from 'client/components/hint/roleHintStore';
import './styles.scss';

/**
 * Что значит жетон роли на кружке. Раньше это говорилось один раз — окном во
 * весь экран на старте партии, — и прочитать его было можно ровно однажды:
 * перезагрузил вкладку и остался с буквой на кружке без объяснений. Теперь
 * объяснение висит на самом жетоне и доступно всю партию.
 */

const ROLE_TITLE: {[key in TRoleMark]: string} = {
	[ESpecialRole.merlin]: 'Мерлин',
	[ESpecialRole.assassin]: 'Убийца',
	[ESpecialRole.percival]: 'Персиваль',
	[ESpecialRole.morgana]: 'Моргана',
	// У этого жетона нет роли — в том и дело: Персиваль видит двоих и не знает,
	// кто из них кто.
	[MERLIN_LIKE]: 'Мерлин или Моргана',
	// Сторона без особой роли — только на развязке (см. roleMarkOf).
	[SPY_SIDE]: 'Шпион',
	[RESISTANCE_SIDE]: 'Сопротивление',
};

// Чужой жетон Мерлина и Персиваля виден только на развязке — оттого и прошедшее
// время. А вот чужих Убийцу с Морганой свои знают всю партию, и им рассказывают,
// что те делают.
const ROLE_TEXT: {[key in TRoleMark]: {you: string, other: string}} = {
	[ESpecialRole.merlin]: {
		you: 'Тебе видно, кто шпион. Но выдать себя нельзя: если сопротивление возьмёт три миссии, Убийца назовёт того, кого считает Мерлином, и попадание отдаст партию шпионам.',
		other: 'Всю партию видел, кто шпион. Шпионы его не знали — и должны были найти выстрелом.',
	},
	[ESpecialRole.assassin]: {
		you: 'Ты шпион и знаешь своих. Если сопротивление выполнит три миссии, у тебя будет один выстрел: назовёшь Мерлина — партия ваша.',
		other: 'Шпион, которому достался выстрел. Если сопротивление выполнит три миссии, он назовёт того, кого считает Мерлином: попадание отдаст партию шпионам.',
	},
	[ESpecialRole.percival]: {
		you: 'Тебе показали Мерлина — но вместе с Морганой и не сказав, кто из них кто. Разобраться в этих двоих и прикрыть настоящего — вся твоя игра.',
		other: 'Сопротивленец, которому показали Мерлина вместе с Морганой. Кто из них кто, он выяснял сам.',
	},
	[ESpecialRole.morgana]: {
		you: 'Ты шпионка, и Персиваль видит тебя наравне с Мерлином — не зная, кто из вас кто. Веди себя как Мерлин, и он прикроет не того.',
		other: 'Шпионка, которую Персиваль видит наравне с Мерлином. В этом вся её роль — чтобы он ошибся.',
	},
	[MERLIN_LIKE]: {
		you: 'Один из этих двоих — Мерлин, второй — Моргана. Кто именно, тебе не сказали.',
		other: 'Один из этих двоих — Мерлин, второй — Моргана. Кто именно, тебе не сказали.',
	},
	// Эти два жетона зажигаются на развязке, и говорить им уже не о чем, кроме
	// того, как эта партия игралась, — оттого и прошедшее время у обоих.
	[SPY_SIDE]: {
		you: 'Ты играл за шпионов: знал своих с первой минуты и мог сдать «Провал» на любой миссии, куда попадал.',
		other: 'Шпион. Знал своих с первой минуты и мог сдать «Провал» на любой миссии, куда попадал.',
	},
	[RESISTANCE_SIDE]: {
		you: 'Ты играл за сопротивление: чужих ролей не знал, а «Провала» у тебя не было вовсе — с миссии от тебя всегда шёл «Успех».',
		other: 'Сопротивленец. Чужих ролей не знал, а «Провала» у него не было вовсе — с миссии от него всегда шёл «Успех».',
	},
};

export const roleHintText = (role: TRoleMark, isYou: boolean): string =>
	isYou ? ROLE_TEXT[role].you : ROLE_TEXT[role].other;

const RoleHintOverlay = observer(() => {
	const {role, isYou, anchor, isPinned} = roleHintStore;
	if (!role || !anchor) return null;
	// «Это ты» — только там, где роль и правда твоя. У жетона «Мерлин или
	// Моргана» на своём кружке стоять нечему: его видит Персиваль на чужих.
	const isSelfRole = isYou && role !== MERLIN_LIKE;
	return (
		<HintPopup anchor={anchor} isPinned={isPinned} onClose={roleHintStore.hide} className={'roleHintPopup'}>
			<span className={'roleHint'} style={{'--role-color': hexColor(role)} as React.CSSProperties}>
				<span className={'roleHintHead'}>
					{ROLE_TITLE[role]}
					{isSelfRole ? <span className={'roleHintYou'}>это ты</span> : null}
				</span>
				<span className={'roleHintText'}>{roleHintText(role, isYou)}</span>
			</span>
		</HintPopup>
	);
});

// Цвет подсказки — цвет самого жетона: подсказка и жетон должны читаться как
// одна вещь (см. roleMark).
const hexColor = (role: TRoleMark): string =>
	`#${ROLE_MARK_LOOK[role].fill.toString(16).padStart(6, '0')}`;

export default RoleHintOverlay;
