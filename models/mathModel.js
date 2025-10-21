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

  function sanitizeMathExpression(message) {
    return message.replace(/[^0-9+\-*/().\s]/g, '');
  }

  function solveMathProblem(message) {
    if (/[A-Za-z=]/.test(message)) {
      return 'Math Spark currently handles only numeric arithmetic. Please enter numbers and operators only.';
    }

    const sanitized = sanitizeMathExpression(message);

    if (!/[0-9]/.test(sanitized)) {
      return null;
    }

    const potentialMath = sanitized.trim();
    const containsOperator = /[+\-*/]/.test(potentialMath.replace(/^[-+]+/, ''));

    if (
      !containsOperator &&
      /[^0-9+\-*/().\s]/.test(message)
    ) {
      return null;
    }

    if (
      potentialMath === '' ||
      (!containsOperator &&
        !potentialMath.includes('(') &&
        !potentialMath.includes(')'))
    ) {
      return null;
    }

    let index = 0;

    function skipWhitespace() {
      while (index < sanitized.length && /\s/.test(sanitized[index])) {
        index += 1;
      }
    }

    function parseNumber() {
      skipWhitespace();
      let start = index;
      let hasDecimal = false;

      while (index < sanitized.length) {
        const char = sanitized[index];
        if (char >= '0' && char <= '9') {
          index += 1;
        } else if (char === '.') {
          if (hasDecimal) {
            throw new Error('INVALID');
          }
          hasDecimal = true;
          index += 1;
        } else {
          break;
        }
      }

      if (start === index) {
        throw new Error('INVALID');
      }

      return Number.parseFloat(sanitized.slice(start, index));
    }

    function parseFactor() {
      skipWhitespace();
      const char = sanitized[index];

      if (char === '+' || char === '-') {
        index += 1;
        const value = parseFactor();
        return char === '-' ? -value : value;
      }

      if (char === '(') {
        index += 1;
        const value = parseExpression();
        skipWhitespace();
        if (sanitized[index] !== ')') {
          throw new Error('INVALID');
        }
        index += 1;
        return value;
      }

      return parseNumber();
    }

    function parseTerm() {
      let value = parseFactor();

      while (true) {
        skipWhitespace();
        const operator = sanitized[index];

        if (operator === '*' || operator === '/') {
          index += 1;
          const nextValue = parseFactor();
          if (operator === '*') {
            value *= nextValue;
          } else {
            if (nextValue === 0) {
              throw new Error('DIV_ZERO');
            }
            value /= nextValue;
          }
        } else {
          break;
        }
      }

      return value;
    }

    function parseExpression() {
      let value = parseTerm();

      while (true) {
        skipWhitespace();
        const operator = sanitized[index];

        if (operator === '+' || operator === '-') {
          index += 1;
          const nextValue = parseTerm();
          value = operator === '+' ? value + nextValue : value - nextValue;
        } else {
          break;
        }
      }

      return value;
    }

    try {
      const result = parseExpression();
      skipWhitespace();
      if (index !== sanitized.length) {
        throw new Error('INVALID');
      }
      if (!Number.isFinite(result)) {
        throw new Error('INVALID');
      }
      return result;
    } catch (error) {
      if (error && error.message === 'DIV_ZERO') {
        return 'Error: Division by zero';
      }
      return 'Error: Invalid expression';
    }
  }

  function getMathResponse(userMessage) {
    const mathResult = solveMathProblem(userMessage);
    if (mathResult === null) {
      return "I'm tuned for calculations right now—drop in an equation like \"42 / 6\" and I'll crunch it instantly.";
    }

    if (typeof mathResult === 'string') {
      return mathResult;
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
