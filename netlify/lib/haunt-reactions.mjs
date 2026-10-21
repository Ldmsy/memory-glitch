import {randomInt} from 'node:crypto';

// Presentation is random. The detector, its evidence, and its confidence are not.
export const HAUNT_LINES = Object.freeze({
 candy: Object.freeze([
  'I unwrapped that thought. It was another wrapper.',
  'My train of thought was replaced by a gummy worm.',
  'That answer was 90% sugar and 10% absolutely no idea.',
  'A caramel has glued my facts together. Incorrectly.'
 ]),
 spider: Object.freeze([
  'Eight legs. Zero idea where I put that fact.',
  'I searched the web. A very small, literal web.',
  'My thought got stuck in a cobweb. The spider wants rent.',
  'A spider has filed my facts under miscellaneous legs.'
 ]),
 ghost: Object.freeze([
  'That fact left the chat wearing a tiny bedsheet.',
  'My train of thought is now a ghost train. No timetable.',
  'I asked the afterlife. They put me on hold.',
  'The thought is haunting a different tab.'
 ]),
 pumpkin: Object.freeze([
  'I checked my head. Seeds. Just seeds.',
  'My last brain cell is carving a pumpkin. From the inside.',
  'The facts were here. Then someone made soup.',
  'That answer came from the decorative part of my brain.'
 ]),
 // Fictional character parody: every line jokes about the AI, not real events.
 trump: Object.freeze([
  'Tremendous memory. Nobody knows where it is.',
  'My brain just filed for ghost protection.',
  'Huge thoughts. Tiny broom. The facts fell off.',
  'I have the best cobwebs. Absolutely no facts, but incredible cobwebs.'
 ])
});

// Keep the historical export and payload key for existing clients; the shared
// image pool now contains both cat reactions and fictional Trump meme captions.
export const HAUNT_CATS = Object.freeze(['chaos', 'calico', 'polite', 'dinner', 'grumpy', 'crying', 'confused', 'surprised', 'trump-1', 'trump-2', 'trump-3', 'trump-4', 'trump-5']);

export function createHaunt(check, choose = randomInt) {
 if (check?.status !== 'issue' || !Array.isArray(check.issues) || !check.issues.length) return null;
 if (check.issues.some(issue => !['missing', 'contradiction'].includes(issue.kind))) return null;
 const characters = Object.keys(HAUNT_LINES);
 const character = characters[choose(characters.length)];
 const lines = HAUNT_LINES[character];
 return {
  character,
  line: lines[choose(lines.length)],
  // Pick once per incident; the stored annotation makes reloads stable.
  catId: HAUNT_CATS[choose(HAUNT_CATS.length)],
  admission: check.issues.some(issue => issue.kind === 'contradiction') ? 'I got that wrong.' : 'I lost the thread.'
 };
}
