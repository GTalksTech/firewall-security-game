// The music's written score: bars add up, notes are in key, and the arrangement lines up.

import { test, assert, assertEqual } from './harness.js';
import { BEATS_PER_BAR, SCALE, CHORDS, PROGRESSION, MELODY, frequency, nameOf, arpeggio, bassNote } from '../strategy/score.js';

export function register() {
  test('score: there is a melody bar for every chord bar', () => {
    assertEqual(MELODY.length, PROGRESSION.length);
    assertEqual(PROGRESSION.length, 16);
  });
  test('score: every melody bar adds up to exactly four beats', () => {
    MELODY.forEach((bar, i) => assertEqual(bar.reduce((sum, [, beats]) => sum + beats, 0), BEATS_PER_BAR, `bar ${i + 1}`));
  });
  test('score: every note is in the key, and every chord is known', () => {
    for (const bar of MELODY) for (const [note] of bar) assert(SCALE.includes(nameOf(note)), `${note} is out of key`);
    for (const chord of PROGRESSION) assert(CHORDS[chord], `unknown chord ${chord}`);
    for (const notes of Object.values(CHORDS)) for (const n of notes) assert(SCALE.includes(n), `${n} is out of key`);
  });
  test('score: each bar of the tune starts or ends on a note of its chord', () => {
    MELODY.forEach((bar, i) => {
      const chord = CHORDS[PROGRESSION[i]];
      assert(chord.includes(nameOf(bar[0][0])) || chord.includes(nameOf(bar[bar.length - 1][0])), `bar ${i + 1} never lands on ${PROGRESSION[i]}`);
    });
  });
  test('score: the tune begins and ends on the home note', () => {
    assertEqual(nameOf(MELODY[0][0][0]), 'D');
    assertEqual(nameOf(MELODY[15][0][0]), 'D');
    assertEqual(PROGRESSION[0], 'Dm');
    assertEqual(PROGRESSION[15], 'Dm');
  });
  test('score: note names turn into the right pitches', () => {
    assert(Math.abs(frequency('A4') - 440) < 1e-9);
    assert(Math.abs(frequency('A5') - 880) < 1e-9);
    assert(Math.abs(frequency('D5') - 587.33) < 0.01);
    assert(Math.abs(frequency('C#5') - 554.37) < 0.01);
    assert(Math.abs(frequency('Bb4') - 466.16) < 0.01);
  });
  test('score: the accompaniment has eight chord notes per bar and stays in a playable range', () => {
    for (const chord of Object.keys(CHORDS)) {
      for (const high of [false, true]) {
        const notes = arpeggio(chord, high);
        assertEqual(notes.length, 8);
        for (const n of notes) {
          assert(CHORDS[chord].includes(nameOf(n)), `${n} is not in ${chord}`);
          const f = frequency(n);
          assert(f > 100 && f < 1100, `${n} at ${f.toFixed(0)} Hz`);
        }
      }
      assert(frequency(bassNote(chord)) > 60 && frequency(bassNote(chord)) < 130, `bass for ${chord}`);
    }
  });
}
