// The game's music, written out as notes. No sound is made here; music.js plays it.
// Three pieces, one per level. Each is 16 bars of 4 beats and then repeats.

export const BEATS_PER_BAR = 4;

// Each piece: a tempo, the notes of its key, one chord per bar, and a tune written as
// [note, length in beats] pairs that add up to 4 beats in every bar.
export const PIECES = {
  // Level 1 and the menus. D minor: steady and a little wistful.
  storefront: {
    tempo: 92, home: 'D', homeChord: 'Dm',
    scale: ['D', 'E', 'F', 'G', 'A', 'Bb', 'C', 'C#'],
    progression: ['Dm', 'C', 'Bb', 'C', 'Dm', 'F', 'C', 'Dm', 'Gm', 'Dm', 'Bb', 'A', 'Gm', 'Dm', 'A', 'Dm'],
    melody: [
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
    ],
  },
  // Level 2. F major and quicker: a busy office on a bright morning.
  office: {
    tempo: 104, home: 'F', homeChord: 'F',
    scale: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
    progression: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'F'],
    melody: [
      [['A5', 1], ['C6', 1], ['A5', 1], ['F5', 1]],
      [['G5', 1.5], ['E5', 0.5], ['G5', 2]],
      [['F5', 1], ['A5', 1], ['D6', 1], ['A5', 1]],
      [['Bb5', 1.5], ['A5', 0.5], ['F5', 2]],
      [['A5', 1], ['C6', 1], ['A5', 1], ['F5', 1]],
      [['G5', 1], ['E5', 1], ['C5', 1], ['E5', 1]],
      [['D5', 1], ['F5', 1], ['Bb5', 2]],
      [['G5', 2], ['E5', 1], ['G5', 1]],
      [['D5', 1], ['F5', 1], ['A5', 1], ['F5', 1]],
      [['Bb5', 2], ['D6', 2]],
      [['C6', 1], ['A5', 1], ['F5', 1], ['A5', 1]],
      [['G5', 3], ['E5', 1]],
      [['F5', 1.5], ['G5', 0.5], ['A5', 1], ['D6', 1]],
      [['D6', 1], ['Bb5', 1], ['F5', 2]],
      [['E5', 1], ['G5', 1], ['C6', 2]],
      [['F5', 4]],
    ],
  },
  // Level 3. E minor, with a B major chord pulling back home: watchful, more at stake.
  datacenter: {
    tempo: 98, home: 'E', homeChord: 'Em',
    scale: ['E', 'F#', 'G', 'A', 'B', 'C', 'D', 'D#'],
    progression: ['Em', 'C', 'G', 'D', 'Em', 'C', 'D', 'Em', 'Am', 'Em', 'C', 'B', 'Am', 'Em', 'B', 'Em'],
    melody: [
      [['E5', 1], ['G5', 1], ['B5', 1.5], ['A5', 0.5]],
      [['G5', 2], ['E5', 1], ['C5', 1]],
      [['D5', 1], ['G5', 1], ['B5', 2]],
      [['A5', 1.5], ['F#5', 0.5], ['D5', 2]],
      [['E5', 1], ['G5', 1], ['B5', 1.5], ['A5', 0.5]],
      [['C6', 1.5], ['B5', 0.5], ['G5', 2]],
      [['F#5', 1], ['A5', 1], ['D6', 1], ['A5', 1]],
      [['E5', 4]],
      [['A5', 1], ['C6', 1], ['A5', 1], ['E5', 1]],
      [['G5', 2], ['B5', 2]],
      [['C6', 1], ['G5', 1], ['E5', 1], ['G5', 1]],
      [['F#5', 2], ['D#5', 2]],
      [['A5', 1.5], ['B5', 0.5], ['C6', 1], ['A5', 1]],
      [['G5', 1], ['B5', 1], ['E5', 2]],
      [['D#5', 1], ['F#5', 1], ['B5', 1], ['F#5', 1]],
      [['E5', 4]],
    ],
  },
};
export const PIECE_FOR_LEVEL = ['storefront', 'office', 'datacenter'];

export const CHORDS = {
  Dm: ['D', 'F', 'A'], C: ['C', 'E', 'G'], Bb: ['Bb', 'D', 'F'], F: ['F', 'A', 'C'], Gm: ['G', 'Bb', 'D'], A: ['A', 'C#', 'E'],
  Em: ['E', 'G', 'B'], G: ['G', 'B', 'D'], D: ['D', 'F#', 'A'], Am: ['A', 'C', 'E'], B: ['B', 'D#', 'F#'],
};

// Short phrases played once when a level ends, in the key of the piece that was playing.
// Each is [note of the home chord (0 root, 1 third, 2 fifth), octave, start in beats, length in beats].
export const STINGS = {
  win: [[0, 5, 0, 0.5], [1, 5, 0.5, 0.5], [2, 5, 1, 0.5], [0, 6, 1.5, 2.5], [2, 5, 1.5, 2.5], [0, 4, 1.5, 2.5]],
  lose: [[2, 5, 0, 1], [1, 5, 1, 1], [0, 5, 2, 1], [2, 4, 3, 3], [0, 3, 3, 3]],
};
export function stingNotes(kind, pieceName) {
  const chord = CHORDS[PIECES[pieceName].homeChord];
  // A chord note whose letter sits below the root goes up an octave, so third and fifth are always above the root.
  const lift = (name) => (SEMITONE[name] < SEMITONE[chord[0]] ? 1 : 0);
  return STINGS[kind].map(([degree, octave, start, length]) => ({ note: `${chord[degree]}${octave + lift(chord[degree])}`, start, length }));
}

const SEMITONE = { C: 0, 'C#': 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, Bb: 10, B: 11 };
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
