// The music's written score: bars add up, notes are in key, and the arrangement lines up.

import { test, assert, assertEqual } from './harness.js';
import { BEATS_PER_BAR, PIECES, PIECE_FOR_LEVEL, CHORDS, STINGS, stingNotes, frequency, nameOf, arpeggio, bassNote } from '../strategy/score.js';

export function register(content) {
  test('score: there is a different piece for each level', () => {
    assertEqual(PIECE_FOR_LEVEL.length, content.levels.length);
    assertEqual(new Set(PIECE_FOR_LEVEL).size, PIECE_FOR_LEVEL.length);
    for (const name of PIECE_FOR_LEVEL) assert(PIECES[name], `no piece called ${name}`);
    const tunes = Object.values(PIECES).map((p) => JSON.stringify(p.melody));
    assertEqual(new Set(tunes).size, tunes.length, 'two pieces share a tune');
    const keys = Object.values(PIECES).map((p) => p.homeChord);
    assertEqual(new Set(keys).size, keys.length, 'two pieces share a key');
  });

  for (const [name, piece] of Object.entries(PIECES)) {
    test(`score ${name}: 16 bars, with a melody bar for every chord bar`, () => {
      assertEqual(piece.progression.length, 16);
      assertEqual(piece.melody.length, 16);
      assert(piece.tempo >= 80 && piece.tempo <= 120, `tempo ${piece.tempo}`);
    });
    test(`score ${name}: every melody bar adds up to exactly four beats`, () => {
      piece.melody.forEach((bar, i) => assertEqual(bar.reduce((sum, [, beats]) => sum + beats, 0), BEATS_PER_BAR, `bar ${i + 1}`));
    });
    test(`score ${name}: every note and every chord is in the key`, () => {
      for (const bar of piece.melody) for (const [note] of bar) assert(piece.scale.includes(nameOf(note)), `${note} is out of key`);
      for (const chord of piece.progression) {
        assert(CHORDS[chord], `unknown chord ${chord}`);
        for (const n of CHORDS[chord]) assert(piece.scale.includes(n), `${n} in ${chord} is out of key`);
      }
    });
    test(`score ${name}: each bar of the tune starts or ends on a note of its chord`, () => {
      piece.melody.forEach((bar, i) => {
        const chord = CHORDS[piece.progression[i]];
        assert(chord.includes(nameOf(bar[0][0])) || chord.includes(nameOf(bar[bar.length - 1][0])), `bar ${i + 1} never lands on ${piece.progression[i]}`);
      });
    });
    test(`score ${name}: it starts on the home chord and ends on the home note`, () => {
      assertEqual(piece.progression[0], piece.homeChord);
      assertEqual(piece.progression[15], piece.homeChord);
      assertEqual(nameOf(piece.melody[15][piece.melody[15].length - 1][0]), piece.home);
      assert(CHORDS[piece.homeChord].includes(nameOf(piece.melody[0][0][0])), 'the first note is not in the home chord');
    });
    test(`score ${name}: the tune stays in a comfortable range`, () => {
      for (const bar of piece.melody) for (const [note] of bar) {
        const f = frequency(note);
        assert(f > 430 && f < 1200, `${note} at ${f.toFixed(0)} Hz`);
      }
    });
    test(`score ${name}: the accompaniment has eight chord notes per bar and sits below the tune`, () => {
      for (const chord of new Set(piece.progression)) {
        for (const high of [false, true]) {
          const notes = arpeggio(chord, high);
          assertEqual(notes.length, 8);
          for (const n of notes) {
            assert(CHORDS[chord].includes(nameOf(n)), `${n} is not in ${chord}`);
            const f = frequency(n);
            assert(f > 100 && f <= 1000, `${n} at ${f.toFixed(0)} Hz`);
          }
        }
        assert(frequency(bassNote(chord)) > 60 && frequency(bassNote(chord)) < 130, `bass for ${chord}`);
      }
    });
    test(`score ${name}: the win and lose phrases use only its home chord, rising to win and falling to lose`, () => {
      for (const kind of Object.keys(STINGS)) {
        const notes = stingNotes(kind, name);
        for (const n of notes) assert(CHORDS[piece.homeChord].includes(nameOf(n.note)), `${n.note} in ${kind}`);
        const lead = notes.filter((n, i) => i < 3).map((n) => frequency(n.note));
        if (kind === 'win') assert(lead[0] < lead[1] && lead[1] < lead[2], 'the win phrase does not rise');
        else assert(lead[0] > lead[1] && lead[1] > lead[2], 'the lose phrase does not fall');
      }
    });
  }

  test('score: note names turn into the right pitches', () => {
    assert(Math.abs(frequency('A4') - 440) < 1e-9);
    assert(Math.abs(frequency('A5') - 880) < 1e-9);
    assert(Math.abs(frequency('D5') - 587.33) < 0.01);
    assert(Math.abs(frequency('C#5') - 554.37) < 0.01);
    assert(Math.abs(frequency('Bb4') - 466.16) < 0.01);
    assert(Math.abs(frequency('D#5') - 622.25) < 0.01);
    assert(Math.abs(frequency('F#5') - 739.99) < 0.01);
  });
}
