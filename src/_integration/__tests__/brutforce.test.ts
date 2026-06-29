import {runBrutforce} from '_integration/brutforce';

// Fuzz test: play many full random games to completion. The runner throws if
// the engine throws, a game gets stuck, or it fails to reach a valid end state,
// so a green run means the server survived every random sequence of actions.
describe('brutforce', () => {
	it('plays many random full games to completion without crashing', () => {
		const result = runBrutforce(500);
		expect(result.iterations).toBe(500);
	}, 180000);
});
