
import { Player, PotManager } from '../server/game.js';

console.log('--- Teating Side Pot Logic ---');

const pm = new PotManager();

// Scenario 1: Standard Side Pot
// Player A: 1000 (bets 1000 All-in)
// Player B: 100 (bets 100 All-in)
// Player C: 1000 (bets 1000 Call)

const pA = new Player('A', 'Alice', 1000);
const pB = new Player('B', 'Bob', 100);
const pC = new Player('C', 'Charlie', 1000);

// Simulate betting
console.log('Scenario 1: A(1000), B(100), C(1000). All go all-in (or call max).');

pA.bet(1000);
pB.bet(100);
pC.bet(1000);

// Collect bets
pm.collectBets([pA, pB, pC]);

console.log('Pots:', pm.pots);

// Expectations:
// Pot 0 (Main): 300 (100 from each). Eligible: A, B, C.
// Pot 1 (Side): 1800 (900 from A, 900 from C). Eligible: A, C.

const mainPot = pm.pots[0];
const sidePot = pm.pots[1];

let pass = true;

if (mainPot.amount !== 300) {
    console.error('FAIL: Main pot should be 300, got', mainPot.amount);
    pass = false;
}
if (sidePot.amount !== 1800) {
    console.error('FAIL: Side pot should be 1800, got', sidePot.amount);
    pass = false;
}
if (!mainPot.contributors.has('A') || !mainPot.contributors.has('B') || !mainPot.contributors.has('C')) {
    console.error('FAIL: Main pot missing contributors');
    pass = false;
}
if (!sidePot.contributors.has('A') || !sidePot.contributors.has('C')) {
    console.error('FAIL: Side pot missing contributors');
    pass = false;
}
if (sidePot.contributors.has('B')) {
    console.error('FAIL: B should not be in side pot');
    pass = false;
}

if (pass) console.log('PASS: Scenario 1');
else console.log('FAIL: Scenario 1');

// Scenario 2: Multi-way side pots
// A: 1000, B: 200, C: 500, D: 1000
// All in.
// Pot 0 (Main): 200 * 4 = 800. All eligible.
// Pot 1 (Side 1): (500-200) * 3 [A, C, D] = 300 * 3 = 900. Eligible: A, C, D.
// Pot 2 (Side 2): (1000-500) * 2 [A, D] = 500 * 2 = 1000. Eligible: A, D.

console.log('\nScenario 2: A(1000), B(200), C(500), D(1000). All in.');
const pm2 = new PotManager();
const p2A = new Player('A', 'Alice', 1000);
const p2B = new Player('B', 'Bob', 200);
const p2C = new Player('C', 'Charlie', 500);
const p2D = new Player('D', 'Dave', 1000);

p2A.bet(1000);
p2B.bet(200);
p2C.bet(500);
p2D.bet(1000);

pm2.collectBets([p2A, p2B, p2C, p2D]);

console.log('Pots:', pm2.pots);

pass = true;
if (pm2.pots[0].amount !== 800) { console.error('FAIL: Pot 0 expected 800, got', pm2.pots[0].amount); pass = false; }
if (pm2.pots[1].amount !== 900) { console.error('FAIL: Pot 1 expected 900, got', pm2.pots[1].amount); pass = false; }
if (pm2.pots[2].amount !== 1000) { console.error('FAIL: Pot 2 expected 1000, got', pm2.pots[2].amount); pass = false; }

if (pass) console.log('PASS: Scenario 2');
else console.log('FAIL: Scenario 2');
