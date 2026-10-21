// Only these cards may cross the chat boundary. Transcript and remixes never do.
export function activeMemories(cards) {
  return cards.filter(c => c.status === 'active' || c.status === 'keep').map(({id,text}) => ({id,text}));
}
export function chatPayload(cards, message) {
  return {operation:'chat', message, memories:activeMemories(cards)};
}
export function fragmentMemory(text, level) {
  if (level === 0) return [];
  const units = [...text];
  const budget = Math.max(1, Math.floor(units.length * level / 100));
  // Keep separated traces, not a summary that secretly carries all original facts.
  const first = Math.ceil(budget * .65), last = budget - first;
  return [units.slice(0,first).join(''), ...(last ? [units.slice(-last).join('')] : [])];
}
export function remixPayload(previousStory, level) {
  return {operation:'remix', level, fragments:fragmentMemory(previousStory, level)};
}
export const EXAMPLES = [
  '我的万圣节项目叫南瓜邮局。地点在 UNSW。预算只有 50 澳元。吉祥物是一只捧腹大笑的奶龙。',
  '昨天我穿着吸血鬼披风赶公交。司机以为我去参加婚礼。最后我带着两袋南瓜坐错了方向。',
  '我想让奶龙在万圣节当保安。它的任务是保护糖果。试岗五分钟后，它把证物全部吃掉了。'
];
