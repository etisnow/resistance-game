import { Container, Sprite } from "react-pixi-fiber";
import { Globals, animated } from 'react-spring/universal'
//import { animated } from 'react-spring'
Globals.injectApplyAnimatedValues(
  (instance, props) => {
  	console.log('test')
    return instance.setNativeProps ? instance.setNativeProps(props) : false
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
};


export { AnimatedPixi }
