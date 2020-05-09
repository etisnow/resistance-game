import { Container, Sprite, applyProps } from "react-pixi-fiber";
import { Globals, animated } from 'react-spring/universal'
import { CustomPIXIComponent, Graphics } from "react-pixi-fiber";
import * as PIXI from 'pixi.js'
import Circle from 'client/components/pixiPrimitives/Circle';
import Arrow from 'client/components/pixiPrimitives/Arrow';


Globals.injectApplyAnimatedValues(
	(instance, props) => {
		//console.log('OLD PROPS', oldProps)
		//console.log(instance)
		//if (instance instanceof PIXI.Graphics) return;
		//console.log()
		applyProps(instance, {}, props)
		//for (let prop in props) {
		//	if(instance.hasOwnProperty(prop)) {
		//		instance[prop] = props[prop]
		//	}
		//}
		//if (props.scale) instance.scale.set(props.scale)
	},
	style => style
)
Globals.injectFrame(cb => (global as any).requestAnimationFrame(cb), cb => (global as any).cancelAnimationFrame(cb))






const AnimatedPixi = {
	Container: animated(Container),
	Sprite: animated(Sprite),
	Circle: animated(Circle),
	Arrow: animated(Arrow),
};




export { AnimatedPixi }
