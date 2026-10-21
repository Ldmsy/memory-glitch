import {randomInt} from 'node:crypto';
import {HAUNT_CATS} from './haunt-reactions.mjs';

export const CHAOS_INTERVAL = 3;

// Plan without changing state: the caller commits nextCounter only with a
// successful saved chat turn. Old sessions start a fresh three-turn cycle.
export function planChaosTurn(counter, enabled = true) {
 if (!enabled) return {enabled:false,due:false,interval:CHAOS_INTERVAL,turn:0,nextCounter:0};
 const completed = Number.isInteger(counter) && counter >= 0 && counter < CHAOS_INTERVAL ? counter : 0;
 const turn = completed + 1;
 return {enabled:true,due:turn === CHAOS_INTERVAL,interval:CHAOS_INTERVAL,turn,nextCounter:turn % CHAOS_INTERVAL};
}

// Ordinary chat entertainment is deliberately separate from the integrity
// detector. A cat is not evidence of a factual error or internal memory loss.
export const CHAT_REACTION_LINES = Object.freeze([
 'The pumpkin has committed tax fraud. We proceed.',
 'A raccoon in a lab coat has approved this message.',
 'My last brain cell is wearing a tiny witch hat. Management material.',
 'The vibes are haunted. The spreadsheet is somehow worse.',
 'This meeting could have been a suspiciously warm candy corn.',
 'The skeleton wants a raise. It has a bone to pick.',
 'My emotional support goblin has eaten the agenda.',
 'A cat just walked across the keyboard and became head of strategy.',
 'The ghost has entered its unpaid-intern era.',
 'The pumpkin CEO has outsourced all decisions to a moth.',
 'There are three spiders in a trench coat running this department.',
 'This thought has been deep-fried and served with existential sauce.',
 'The cauldron is now a hot tub. HR has been notified.',
 'Plot twist: the demon is just a cat with overdue rent.',
 'The witch said trust the process. The process is a shopping cart on fire.',
 'The graveyard has Wi-Fi. Naturally, the password is a scream.',
 'The bats have formed a committee. Absolutely nothing will get done.',
 'A haunted printer has become my life coach. It only says PAPER JAM.',
 'The goblin has a LinkedIn account. Society has gone too far.',
 'Confidence: cat sitting directly on the emergency stop button.'
]);

function usableCaption(value) {
 if (typeof value !== 'string') return '';
 const caption = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
 if (!caption || caption.length > 160) return '';
 // Even a model-generated joke must not impersonate a detector verdict. Real
 // missing/contradiction incidents have their own reviewed haunt annotation.
 if (/\b(forget(?:ting)?|forgot(?:ten)?|hallucinat\w*|memory loss|memory fail\w*|lost the thread|got (?:it|that) wrong|made (?:it|that) up|cannot remember|can['’]t remember)\b/i.test(caption)) return '';
 return caption;
}

export function createChatReaction(annotation, modelResult, {chaos = true, choose = randomInt, excludeCatId = null} = {}) {
 if (!chaos || annotation?.check?.status === 'issue') return null;
 const generated = usableCaption(modelResult?.reactionCaption);
 const images = HAUNT_CATS.filter(id => id !== excludeCatId);
 return {
  catId: images[choose(images.length)],
  caption: generated || CHAT_REACTION_LINES[choose(CHAT_REACTION_LINES.length)],
  label: 'CHAT REACTION',
  fictional: true,
  captionSource: generated ? 'ai' : 'curated'
 };
}
