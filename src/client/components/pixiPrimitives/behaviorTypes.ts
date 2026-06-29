// `CustomPIXIComponent` behaviors run with a `this` enriched by react-pixi-fiber's
// inject API, which adds `applyDisplayObjectProps`. That method is not described by
// the package's published types, so we model the `this` context locally.
export interface GraphicsBehaviorThis<P> {
	applyDisplayObjectProps(oldProps: P | undefined, newProps: P): void;
}
