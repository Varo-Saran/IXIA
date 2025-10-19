(function (global) {
  function formatMathValue(value) {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return value;
      }
      if (Number.isInteger(value)) {
        return value.toString();
      }
      const fixed = Number.parseFloat(value.toFixed(6));
      return fixed.toString();
    }
    return value;
  }

  function solveMathProblem(message) {
    const mathRegex = /(-?\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(-?\d+(?:\.\d+)?)/;
    const match = message.match(mathRegex);

    if (match) {
      const num1 = parseFloat(match[1]);
      const operator = match[2];
      const num2 = parseFloat(match[3]);

      switch (operator) {
        case '+':
          return num1 + num2;
        case '-':
          return num1 - num2;
        case '*':
          return num1 * num2;
        case '/':
          return num2 !== 0 ? num1 / num2 : 'Error: Division by zero';
        default:
          return null;
      }
    }

    return null;
  }

  function getMathResponse(userMessage) {
    const mathResult = solveMathProblem(userMessage);
    if (mathResult === null) {
      return "I'm tuned for calculations right now—drop in an equation like \"42 / 6\" and I'll crunch it instantly.";
    }

    const formatted = formatMathValue(mathResult);
    if (typeof formatted === 'string' && formatted.startsWith('Error')) {
      return formatted;
    }

    return `The result of the calculation is: ${formatted}`;
  }

  global.mathModel = {
    formatMathValue,
    solveMathProblem,
    getMathResponse,
  };
})(typeof window !== 'undefined' ? window : globalThis);
