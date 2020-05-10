import { CustomPIXIComponent, withApp } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import {resources} from 'client/resources/resources';
import { each, find } from "lodash";

/*

* */


const TYPE = "GlowEffect";
export const behavior = {
  customDisplayObject: props => new PIXI.Container(),
  customApplyProps: function(container, oldProps, newProps) {
    const { app, ...styles } = newProps;
	const addedDisplacement = find(container.children, (child) => child instanceof PIXI.Sprite)
	//
	if (!addedDisplacement) {
		console.log('removed')

		const glow = PIXI.Sprite.from(resources['glowEffect']);
		const displacementSprite = PIXI.Sprite.from(resources['noise']);

		glow.x = 0
		glow.y = 0
		glow.anchor = new PIXI.Point(0.5, 0.5);

		container.addChild(glow);
		displacementSprite.texture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
		displacementSprite.x = 0
		displacementSprite.y = 0
		displacementSprite.anchor = new PIXI.Point(0.5, 0.5);
		const displacementFilter = new PIXI.filters.DisplacementFilter(displacementSprite);
		displacementFilter.padding = 10;
		displacementSprite.position = glow.position;
		container.addChild(displacementSprite)

		console.log(app.stage.children)

		glow.filters = [displacementFilter];

		displacementFilter.scale.x = 30;
		displacementFilter.scale.y = 30;

		container.animate = () => {
			try {
			    displacementSprite.x++;
			    // Reset x to 0 when it's over width to keep values from going to very huge numbers.
			    if (displacementSprite.x > displacementSprite.width) { displacementSprite.x = 0; }
			} catch (e) {
				app.ticker.remove(container.animate);
			}

		}
		app.ticker.add(container.animate);
	    return this.applyDisplayObjectProps(oldProps, newProps);
	}
    return this.applyDisplayObjectProps(oldProps, newProps);
  },
};

const GlowEffect = withApp(CustomPIXIComponent(behavior, TYPE))

export default GlowEffect;



/*
    instance.beginFill(color);
    instance.moveTo(xCoord, yCoord);
    instance.drawCircle(xCoord, yCoord, r);

    instance.endFill();*/
