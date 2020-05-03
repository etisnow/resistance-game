import {resources} from 'client/resources/resources';
import {PixiController} from 'client/controllers/pixiController';
import { reduce } from 'lodash';

export const resourcesLoader = (pixiController: PixiController) => {
	return new Promise((resolve, reject) => {
		try {
			const resourcesLoader = reduce(resources, (loader, res, key) => {
				loader.add(key, resources[key]);
				return loader
			}, pixiController.app.loader);

			resourcesLoader.load((loader, resources) => {
				resolve(resources);
			});
		} catch (e) {
			reject(e);
		}

	})
}
