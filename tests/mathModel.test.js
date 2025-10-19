const assert = require('assert');

require('../models/mathModel.js');

const { solveMathProblem, formatMathValue } = global.mathModel;

describe('mathModel.solveMathProblem', () => {
  it('evaluates mixed operator expression with precedence', () => {
    const result = solveMathProblem('2 + 2 * 2');
    assert.strictEqual(result, 6);
    assert.strictEqual(formatMathValue(result), '6');
  });

  it('evaluates expression with parentheses', () => {
    const result = solveMathProblem('(5 - 1) / 2');
    assert.strictEqual(result, 2);
    assert.strictEqual(formatMathValue(result), '2');
  });
});

function describe(name, fn) {
  try {
    fn();
    console.log(`\n${name}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}
