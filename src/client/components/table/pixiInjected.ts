import { Container, Sprite, applyProps } from "react-pixi-fiber";
import { Globals, animated } from 'react-spring/universal'
import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from 'pixi.js'
import Circle from 'client/components/pixiPrimitives/Circle';


Globals.injectApplyAnimatedValues(
  (instance, {scale, ...props}) => {
	for (let prop in props) {
		instance[prop] = props[prop]
	}
	if (scale) instance.scale.set(scale)
  },
  style => style
)
Globals.injectFrame(cb => (global as any).requestAnimationFrame(cb), cb => (global as any).cancelAnimationFrame(cb))

/*
Globals.injectApplyAnimatedValues((instance, { scale, ...props }) => {
	console.log('test')
  if (instance.pluginName) {
    for (let prop in props) instance[prop] = props[prop]
    if (scale) instance.scale.set(scale)
  } else return false
}, style => style)

*/

const AnimatedPixi = {
	Container: animated(Container),
	Sprite: animated(Sprite),
	Circle: animated(Circle),
};




export { AnimatedPixi }
