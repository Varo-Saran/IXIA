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

  it('returns friendly message for expressions with unsupported characters', () => {
    const result = solveMathProblem('sin(1)');
    assert.strictEqual(
      result,
      'Math Spark currently handles only numeric arithmetic. Please enter numbers and operators only.'
    );
  });

  it('returns friendly message for expressions containing variables', () => {
    const result = solveMathProblem('3x + 2 = 11');
    assert.strictEqual(
      result,
      'Math Spark currently handles only numeric arithmetic. Please enter numbers and operators only.'
    );
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
