import {el} from 'analytics/web/dom';
import {adminApi, adminToken} from 'analytics/web/api';
import {dateTime, duration, num, sourceLabel, winnerLabel} from 'analytics/web/format';
import {empty, sectionTitle, table} from 'analytics/web/pages/parts';

/**
 * Админка. Живёт в той же витрине, но всё за паролем (Bearer-токен из
 * ANALYTICS_ADMIN_TOKEN). Отсюда чинится главная беда узкой компании — один
 * человек под тремя никами.
 */
export const adminPage = async (): Promise<HTMLElement> => {
	const page = el('div', {class: 'page'});
	page.appendChild(sectionTitle('Админка'));

	const content = el('div', {});
	const status = el('p', {class: 'admin-status'});

	const showLogin = () => {
		content.replaceChildren();
		const input = el('input', {type: 'password', placeholder: 'пароль админки', class: 'input'});
		content.appendChild(
			el('form', {class: 'login'}, [
				input,
				el('button', {
					class: 'button',
					text: 'Войти',
					onclick: async (event) => {
						event.preventDefault();
						try {
							await adminApi.login(input.value.trim());
							await showPanel();
						} catch (e) {
							adminToken.clear();
							status.textContent = e instanceof Error ? e.message : 'Не вышло';
						}
					},
				}),
			]),
		);
		content.appendChild(el('p', {class: 'hint', text: 'Пароль задаётся переменной ANALYTICS_ADMIN_TOKEN на сервере аналитики.'}));
	};

	const showPanel = async () => {
		content.replaceChildren();
		const [stats, matches, players] = await Promise.all([adminApi.stats(), adminApi.matches(200), adminApi.players()]);

		content.appendChild(
			el('div', {class: 'tiles'}, [
				tile('Партий', num(stats.counts.matches), `скрыто ${stats.hiddenMatches}`),
				tile('Игроков', num(stats.counts.players), `скрыто ${stats.hiddenPlayers}`),
				tile('Событий', num(stats.counts.events), `статусов ${num(stats.counts.marks)}`),
				tile('Размер базы', `${(stats.dbSizeBytes / 1024 / 1024).toFixed(1)} МБ`, stats.dbPath),
				tile('Слитых ников', num(stats.counts.aliases), stats.lastIngestAt ? `последняя партия ${dateTime(stats.lastIngestAt)}` : 'партий ещё не было'),
			]),
		);

		content.appendChild(sectionTitle('Источники'));
		content.appendChild(
			table(
				['Источник', 'Партий'],
				stats.bySource.map((row) => [sourceLabel(row.key), row.count]),
			),
		);

		// --- Игроки -----------------------------------------------------------
		content.appendChild(sectionTitle('Игроки'));
		content.appendChild(
			table(
				['Ник', 'Ключ', 'Партий', 'Показывать', 'Действия'],
				players.map((player) => [
					player.displayName,
					player.key,
					player.matches,
					player.isHidden ? 'скрыт' : 'да',
					el('span', {class: 'row-actions'}, [
						el('button', {
							class: 'button button--small',
							text: player.isHidden ? 'показать' : 'скрыть',
							onclick: () => act(() => adminApi.setPlayerHidden(player.key, !player.isHidden)),
						}),
						el('button', {
							class: 'button button--small',
							text: 'переименовать',
							onclick: () => {
								const name = window.prompt('Новое отображаемое имя', player.displayName);
								if (name) act(() => adminApi.renamePlayer(player.key, name));
							},
						}),
					]),
				]),
			),
		);

		const mergeFrom = el('input', {class: 'input', placeholder: 'ник-дубль (исчезнет)'});
		const mergeInto = el('input', {class: 'input', placeholder: 'основной ник (останется)'});
		content.appendChild(
			el('div', {class: 'admin-form'}, [
				el('h3', {text: 'Склеить два ника в одного человека'}),
				el('p', {class: 'hint', text: 'Все партии, события и статусы дубля переедут на основной ник, а будущие партии с ним лягут туда же автоматически.'}),
				el('div', {class: 'admin-row'}, [
					mergeFrom,
					mergeInto,
					el('button', {
						class: 'button',
						text: 'Склеить',
						onclick: () => act(() => adminApi.mergePlayers(mergeFrom.value.trim(), mergeInto.value.trim())),
					}),
				]),
			]),
		);

		// --- Партии -----------------------------------------------------------
		content.appendChild(sectionTitle('Партии'));
		content.appendChild(
			table(
				['Когда', 'Источник', 'Игроков', 'Победа', 'Длительность', 'Видна', 'Действия'],
				matches.rows.map((row) => [
					dateTime(row.startedAt),
					sourceLabel(row.source),
					row.playerCount,
					winnerLabel(row.winner),
					duration(row.durationMs),
					row.isHidden ? 'скрыта' : 'да',
					el('span', {class: 'row-actions'}, [
						el('button', {
							class: 'button button--small',
							text: row.isHidden ? 'показать' : 'скрыть',
							onclick: () => act(() => adminApi.setMatchHidden(row.matchId, !row.isHidden)),
						}),
						el('button', {
							class: 'button button--small button--danger',
							text: 'удалить',
							onclick: () => {
								if (window.confirm('Удалить партию со всеми событиями? Отменить будет нельзя.')) {
									act(() => adminApi.deleteMatch(row.matchId));
								}
							},
						}),
					]),
				]),
			),
		);

		// --- Обслуживание -----------------------------------------------------
		content.appendChild(sectionTitle('Обслуживание'));
		const titleInput = el('input', {class: 'input', placeholder: 'заголовок витрины'});
		const spool = el('textarea', {
			class: 'input input--area',
			placeholder: 'JSONL из спул-файла игрового сервера: по одной партии в строке',
			rows: 4,
		});

		content.appendChild(
			el('div', {class: 'admin-form'}, [
				el('div', {class: 'admin-row'}, [
					el('button', {
						class: 'button',
						text: 'Пересчитать статусы',
						title: 'Пересобрать статусы из сырых событий: правота, «итоговое мнение», схлопывание прокрутки',
						onclick: () =>
							act(async () => {
								const result = await adminApi.recompute();
								status.textContent = `Пересобрано партий: ${result.matches}, статусов: ${result.marks}`;
							}),
					}),
					el('a', {class: 'button', href: adminApi.exportUrl(), text: 'Скачать дамп'}),
					el('button', {
						class: 'button',
						text: 'Выйти',
						onclick: () => {
							adminToken.clear();
							showLogin();
						},
					}),
				]),
				el('div', {class: 'admin-row'}, [
					titleInput,
					el('button', {
						class: 'button',
						text: 'Сменить заголовок',
						onclick: () => act(() => adminApi.setSettings({title: titleInput.value.trim()})),
					}),
				]),
				el('div', {class: 'admin-row'}, [
					el('button', {
						class: 'button',
						text: 'Показывать ники публично',
						onclick: () => act(() => adminApi.setSettings({showNicknames: 'true'})),
					}),
					el('button', {
						class: 'button',
						text: 'Скрыть ники (обезличить)',
						onclick: () => act(() => adminApi.setSettings({showNicknames: 'false'})),
					}),
				]),
				el('h3', {text: 'Импорт спула'}),
				spool,
				el('button', {
					class: 'button',
					text: 'Загрузить партии',
					onclick: () =>
						act(async () => {
							const result = await adminApi.importSpool(spool.value);
							status.textContent = `Принято ${result.accepted}, дублей ${result.duplicates}, отклонено ${result.rejected}`;
						}),
				}),
			]),
		);
	};

	const act = async (action: () => Promise<unknown>) => {
		try {
			status.textContent = 'Выполняю…';
			await action();
			status.textContent = 'Готово';
			await showPanel();
		} catch (e) {
			status.textContent = e instanceof Error ? e.message : 'Ошибка';
		}
	};

	page.appendChild(status);
	page.appendChild(content);

	if (adminToken.get()) {
		try {
			await showPanel();
		} catch {
			adminToken.clear();
			showLogin();
		}
	} else {
		showLogin();
	}

	return page;
};

const tile = (label: string, value: string, hint: string) =>
	el('div', {class: 'tile'}, [
		el('span', {class: 'tile-label', text: label}),
		el('span', {class: 'tile-value', text: value}),
		el('span', {class: 'tile-hint', text: hint}),
	]);

export const adminEmpty = empty;
