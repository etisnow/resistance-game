import React from 'react';
import {isWebGLAvailable} from 'client/helpers/webgl';
import {WebGLMessage} from 'client/components/webgl/WebGLMessage';
import {ErrorComponent} from 'client/components/util/Error';

interface IStageBoundaryProps {
	children: React.ReactNode;
}

interface IStageBoundaryState {
	failed: boolean;
}

// PIXI-рендерер может не подняться и там, где WebGL формально «поддерживается»:
// заблокированный драйвер, потерянный контекст, режим экономии. Падение <Stage>
// уносит весь экран стола, поэтому ловим его тут и объясняем причину.
export class StageBoundary extends React.Component<IStageBoundaryProps, IStageBoundaryState> {
	override state: IStageBoundaryState = {failed: false};

	static getDerivedStateFromError(): IStageBoundaryState {
		return {failed: true};
	}

	override componentDidCatch(error: Error) {
		console.error('Стол не отрисовался:', error);
	}

	override render() {
		if (!this.state.failed) return this.props.children;
		// Упасть мог и не рендерер — про WebGL пишем, только если его правда нет.
		return isWebGLAvailable() ? <ErrorComponent/> : <WebGLMessage/>;
	}
}
