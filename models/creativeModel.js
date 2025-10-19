(function (global) {
  function capitalizeFirstLetter(value) {
    if (!value) {
      return '';
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function getCreativeResponse(userMessage = '') {
    const rawSeed = typeof userMessage === 'string' ? userMessage.trim() : '';
    const seed = rawSeed || 'your idea';
    const formattedSeed = capitalizeFirstLetter(seed);
    const lowerSeed = formattedSeed.toLowerCase();

    const creativeKits = [
      {
        heading: '🌌 Story Seed Matrix',
        rows: [
          ['Protagonist', 'A restless cartographer mapping emotions'],
          ['Setting', 'A floating bazaar lit by aurora tides'],
          ['Conflict', `The map misbehaves whenever ${lowerSeed} is whispered`],
          ['Wildcard', `${formattedSeed} collides with an impossible rule`]
        ],
        outro: 'Combine any two cells and riff on them, or ask me for another matrix.'
      },
      {
        heading: '🎭 Prompt Remix Lab',
        lines: [
          `Anchor ➜ ${formattedSeed}.`,
          'Genre Flip ➜ Noir documentary told as journal entries.',
          'Sensory Hook ➜ The air smells like thunderstorms and vinyl records.'
        ],
        outro: 'Tweak any line to fit your vibe, and I can expand whichever spark you like next.'
      },
      {
        heading: '✨ Creative Stretch Circuit',
        lines: [
          '1. Draft a 20-second micro-scene using only questions.',
          '2. Swap in a surprising ally halfway through.',
          '3. End on a color that never appears in nature.'
        ],
        outro: `Try running the circuit with ${formattedSeed} as your muse, or ask for a fresh set.`
      }
    ];

    const kit = creativeKits[Math.floor(Math.random() * creativeKits.length)];
    let detailBlock = '';

    if (kit.rows) {
      const header = 'Focus | Spark';
      const separator = '-----|------';
      const tableRows = kit.rows.map(row => `${row[0]} | ${row[1]}`);
      detailBlock = [header, separator, ...tableRows].join('\n');
    } else if (kit.lines) {
      detailBlock = kit.lines.join('\n');
    }

    return `${kit.heading}\n${detailBlock}\n\n${kit.outro}`;
  }

  global.creativeModel = {
    getCreativeResponse,
    capitalizeFirstLetter,
  };
})(typeof window !== 'undefined' ? window : globalThis);
