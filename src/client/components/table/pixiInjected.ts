import { Container, Sprite, applyProps } from "react-pixi-fiber";
import { Globals, animated } from 'react-spring/universal'
import * as PIXI from 'pixi.js'
import Circle from 'client/components/pixiPrimitives/Circle';
import Arrow from 'client/components/pixiPrimitives/Arrow';


Globals.injectApplyAnimatedValues(
	(instance: PIXI.DisplayObject, props: object) => {
		applyProps(instance, {}, props)
	},
	style => style
)
Globals.injectFrame(
	(cb: FrameRequestCallback) => globalThis.requestAnimationFrame(cb),
	(handle: number) => globalThis.cancelAnimationFrame(handle),
)



export const getPixiTexture = (resource: string | undefined) => {
	if (!resource) {
		throw new Error('Ресурс ' + resource + ' не найден.')
	}
	return PIXI.Texture.from(resource)
}


const AnimatedPixi = {
	Container: animated(Container),
	Sprite: animated(Sprite),
	Circle: animated(Circle),
	Arrow: animated(Arrow),
};




export { AnimatedPixi }
