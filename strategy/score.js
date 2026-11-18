// The game's music, written out as notes. No sound is made here; music.js plays it.
// Key of D minor, 4 beats to the bar, 16 bars, then it repeats.

export const TEMPO = 92;          // beats per minute
export const BEATS_PER_BAR = 4;
export const SCALE = ['D', 'E', 'F', 'G', 'A', 'Bb', 'C', 'C#']; // D minor, with C# for the A major chord

export const CHORDS = {
  Dm: ['D', 'F', 'A'], C: ['C', 'E', 'G'], Bb: ['Bb', 'D', 'F'], F: ['F', 'A', 'C'], Gm: ['G', 'Bb', 'D'], A: ['A', 'C#', 'E'],
};

// One chord per bar.
export const PROGRESSION = ['Dm', 'C', 'Bb', 'C', 'Dm', 'F', 'C', 'Dm', 'Gm', 'Dm', 'Bb', 'A', 'Gm', 'Dm', 'A', 'Dm'];

// The tune: for each bar, [note, length in beats] pairs that add up to 4 beats.
export const MELODY = [
  [['D5', 1.5], ['E5', 0.5], ['F5', 1], ['A5', 1]],
  [['G5', 1.5], ['F5', 0.5], ['E5', 2]],
  [['Bb4', 1], ['D5', 1], ['F5', 2]],
  [['E5', 1], ['G5', 1], ['E5', 1], ['C5', 1]],
  [['D5', 1.5], ['E5', 0.5], ['F5', 1], ['A5', 1]],
  [['C6', 1.5], ['A5', 0.5], ['F5', 2]],
  [['G5', 1], ['E5', 1], ['C5', 1], ['E5', 1]],
  [['D5', 4]],
  [['G5', 1], ['Bb5', 1], ['D6', 1], ['Bb5', 1]],
  [['A5', 2], ['F5', 1], ['D5', 1]],
  [['Bb4', 1], ['D5', 1], ['F5', 1], ['D5', 1]],
  [['E5', 2], ['C#5', 2]],
  [['G5', 1.5], ['A5', 0.5], ['Bb5', 1], ['G5', 1]],
  [['F5', 1], ['A5', 1], ['D6', 2]],
  [['C#6', 1], ['A5', 1], ['E5', 1], ['C#5', 1]],
  [['D5', 4]],
];

const SEMITONE = { C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, Bb: 10, B: 11 };
export const nameOf = (note) => note.replace(/-?\d+$/, '');
export function frequency(note) {
  const octave = Number(note.match(/-?\d+$/)[0]);
  const midi = 12 * (octave + 1) + SEMITONE[nameOf(note)];
  return 440 * 2 ** ((midi - 69) / 12);
}

// The plucked accompaniment for one bar: eight notes walking up and down the chord.
export function arpeggio(chordName, high = false) {
  const [root, third, fifth] = CHORDS[chordName];
  const o = high ? 4 : 3;
  const up = (name, base) => `${name}${SEMITONE[name] < SEMITONE[root] ? base + 1 : base}`;
  const notes = [`${root}${o}`, up(fifth, o), up(third, o + 1), up(fifth, o), `${root}${o + 1}`, up(fifth, o), up(third, o + 1), up(fifth, o)];
  // Keep the accompaniment below the tune.
  return notes.map((n) => (frequency(n) > 1000 ? n.replace(/\d+$/, (oct) => String(Number(oct) - 1)) : n));
}
export const bassNote = (chordName) => `${CHORDS[chordName][0]}2`;
