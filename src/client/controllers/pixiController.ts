import * as PIXI from 'pixi.js';
import RootController from 'client/controllers/rootController';
import SocketController from 'client/controllers/socketController';
import {getWindowWidth} from 'client/helpers/window';

import { reduce } from 'lodash';
import {observable} from 'mobx';
import {resourcesLoader} from 'client/controllers/pixi/resourcesLoader';


class PixiController {
	app: any;
	root: RootController;
	socket: SocketController;
	width: number;
	height: number;
	@observable isInited: boolean = false;
	@observable isLoaded: boolean = false;
	resources: any;
	constructor(root: RootController) {
		this.root = root;
		this.socket = root.socketController;
	}
	init(wrapperElement) {
		if (this.isInited) return;
		this.width = wrapperElement.offsetWidth ;
		this.height = wrapperElement.offsetHeight ;
		console.log({width: this.width, height:this.height})
		this.app = new PIXI.Application({width: this.width, height:this.height, transparent: true});
		console.log(wrapperElement)
		wrapperElement.appendChild(this.app.view);
		this.load();
		this.isInited = true;
	}

	load = async () => {
		try {
			const resources = await resourcesLoader(this);
			this.resources = resources;
			this.isLoaded = true;
			this.renderScene();
		} catch (e) {
			this.isLoaded = false;
		}
	};

	renderScene = () => {
		// This creates a texture from a 'bunny.png' image
		const bunny = new PIXI.Sprite(this.resources.thing.texture);
		// Setup the position of the bunny
		bunny.x = this.width / 2;
		bunny.y = this.height / 2;
		// Rotate around the center
		bunny.anchor.x = 0.5;
		bunny.anchor.y = 0.5;
		// Add the bunny to the scene we are building
		this.app.stage.addChild(bunny);
		// Listen for frame updates
		this.app.ticker.add(() => {
		     // each frame we spin the bunny around a bit
		    bunny.rotation += 0.2;
		});
	}
}

export { PixiController }

